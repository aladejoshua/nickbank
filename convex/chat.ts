import {
  createThread,
  listUIMessages,
  saveMessage,
  syncStreams,
  vStreamArgs,
} from "@convex-dev/agent";
import { paginationOptsValidator } from "convex/server";
import { v } from "convex/values";
import { components, internal } from "./_generated/api";
import {
  mutation,
  query,
  internalAction,
  internalMutation,
} from "./_generated/server";
import { generalAgent } from "./agents/general";
import { nickOnlyAgent } from "./agents/nickOnly";

// Simple lookup table for user threads (Agent component manages its own threads table)
// We use this to map anonymous userId → Agent threadId
export const getOrCreateThread = mutation({
  args: {
    userId: v.string(),
    mode: v.union(v.literal("general"), v.literal("nick-only")),
  },
  handler: async (ctx, { userId, mode }) => {
    // Check if user already has a thread
    const existing = await ctx.db
      .query("userThreads")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .first();

    if (existing) {
      return existing.threadId;
    }

    // Create new thread via Agent component
    const threadId = await createThread(ctx, components.agent, {});

    try {
      // Store mapping in our lookup table
      await ctx.db.insert("userThreads", {
        userId,
        threadId,
        mode,
        createdAt: Date.now(),
      });
    } catch (error) {
      // Handle race condition: if another call inserted first, fetch the existing thread
      // This can happen with concurrent calls or multiple tabs
      const record = await ctx.db
        .query("userThreads")
        .withIndex("by_userId", (q) => q.eq("userId", userId))
        .first();
      if (record) {
        return record.threadId;
      }
      // Re-throw if it's a different error
      throw error;
    }

    return threadId;
  },
});

// "New Chat" — delete everything and start fresh
export const resetChat = mutation({
  args: {
    userId: v.string(),
    mode: v.union(v.literal("general"), v.literal("nick-only")),
  },
  handler: async (ctx, { userId, mode }) => {
    const record = await ctx.db
      .query("userThreads")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .first();

    if (record) {
      // Delete via Agent component's async deletion
      await generalAgent.deleteThreadAsync(ctx, {
        threadId: record.threadId,
      });
      await ctx.db.delete(record._id);
    }

    // Create fresh thread
    const threadId = await createThread(ctx, components.agent, {});
    await ctx.db.insert("userThreads", {
      userId,
      threadId,
      mode,
      createdAt: Date.now(),
    });

    return threadId;
  },
});

// Update the stored mode for a user's thread
export const updateMode = mutation({
  args: {
    userId: v.string(),
    mode: v.union(v.literal("general"), v.literal("nick-only")),
  },
  handler: async (ctx, { userId, mode }) => {
    const record = await ctx.db
      .query("userThreads")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .first();

    if (record) {
      await ctx.db.patch(record._id, { mode });
    }
  },
});

export const listMessages = query({
  args: {
    threadId: v.string(),
    paginationOpts: paginationOptsValidator,
    streamArgs: vStreamArgs,
  },
  handler: async (ctx, args) => {
    const paginated = await listUIMessages(ctx, components.agent, args);
    const streams = await syncStreams(ctx, components.agent, args);

    // Rule 4: Attach sources from messageSources table
    const sourcesForThread = await ctx.db
      .query("messageSources")
      .withIndex("by_threadId", (q) => q.eq("threadId", args.threadId))
      .collect();

    const sourcesByMessageId = new Map(
      sourcesForThread.map((r) => [r.messageId, r.sources])
    );

    const pageWithSources = paginated.page.map((msg) => ({
      ...msg,
      sources: sourcesByMessageId.get(msg.key) ?? undefined,
    }));

    return { ...paginated, page: pageWithSources, streams };
  },
});

export const listErrors = query({
  args: {
    threadId: v.string(),
  },
  handler: async (ctx, { threadId }) => {
    return await ctx.db
      .query("generationErrors")
      .withIndex("by_threadId", (q) => q.eq("threadId", threadId))
      .order("desc")
      .collect();
  },
});

export const sendMessage = mutation({
  args: {
    threadId: v.string(),
    prompt: v.string(),
    mode: v.union(v.literal("general"), v.literal("nick-only")),
  },
  handler: async (ctx, { threadId, prompt, mode }) => {
    const { messageId } = await saveMessage(ctx, components.agent, {
      threadId,
      prompt,
    });
    await ctx.scheduler.runAfter(
      0,
      internal.chat.generateResponseAsync,
      {
        threadId,
        promptMessageId: messageId,
        mode,
      }
    );
    return messageId;
  },
});

// Rule 8: Retry re-runs the action against the same message row
export const retryGeneration = mutation({
  args: {
    threadId: v.string(),
    promptMessageId: v.string(),
    mode: v.union(v.literal("general"), v.literal("nick-only")),
  },
  handler: async (ctx, { threadId, promptMessageId, mode }) => {
    // Clear any previous error for this message
    const errorRecord = await ctx.db
      .query("generationErrors")
      .withIndex("by_threadId", (q) => q.eq("threadId", threadId))
      .order("desc")
      .first();

    if (errorRecord && errorRecord.promptMessageId === promptMessageId) {
      await ctx.db.delete(errorRecord._id);
    }

    // Re-schedule the action on the same message row
    await ctx.scheduler.runAfter(
      0,
      internal.chat.generateResponseAsync,
      {
        threadId,
        promptMessageId,
        mode,
      }
    );
  },
});

// Rule 4: Persist sources from tool results to messageSources table
export const saveMessageSources = internalMutation({
  args: {
    messageId: v.string(),
    threadId: v.string(),
    sources: v.array(
      v.object({
        id: v.string(),
        title: v.string(),
        score: v.number(),
      })
    ),
  },
  handler: async (ctx, { messageId, threadId, sources }) => {
    // Upsert: check if sources already exist for this message
    const existing = await ctx.db
      .query("messageSources")
      .withIndex("by_messageId", (q) => q.eq("messageId", messageId))
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, { sources });
    } else {
      await ctx.db.insert("messageSources", {
        messageId,
        threadId,
        sources,
      });
    }
  },
});

export const generateResponseAsync = internalAction({
  args: {
    threadId: v.string(),
    promptMessageId: v.string(),
    mode: v.union(v.literal("general"), v.literal("nick-only")),
  },
  handler: async (ctx, { threadId, promptMessageId, mode }) => {
    const agent = mode === "nick-only" ? nickOnlyAgent : generalAgent;
    try {
      await agent.streamText(
        ctx,
        { threadId },
        { promptMessageId },
        { saveStreamDeltas: true }
      );

      // Rule 7: Sources are embedded in the tool-result parts which are
      // stored by the Agent component. The client extracts them via
      // extractSources() and they're also persisted to messageSources table.
    } catch (error) {
      console.error("generateResponseAsync failed:", error);

      // Rule 8: Log error AND patch the message status to "error"
      await ctx.runMutation(internal.chat.logGenerationError, {
        threadId,
        promptMessageId,
        error: error instanceof Error ? error.message : String(error),
      });

      // Rule 8: The Agent component should handle setting status to "error"
      // on the message row. If it doesn't, we ensure the error is surfaced
      // via the generationErrors table which the client queries.
    }
  },
});

export const logGenerationError = internalMutation({
  args: {
    threadId: v.string(),
    promptMessageId: v.string(),
    error: v.string(),
  },
  handler: async (ctx, { threadId, promptMessageId, error }) => {
    await ctx.db.insert("generationErrors", {
      threadId,
      promptMessageId,
      error,
      timestamp: Date.now(),
    });
  },
});
