import { createThread, listUIMessages, saveMessage, syncStreams, vStreamArgs } from "@convex-dev/agent";
import { paginationOptsValidator } from "convex/server";
import { v } from "convex/values";
import { components, internal } from "./_generated/api";
import { mutation, query, internalAction, internalMutation } from "./_generated/server";
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
  args: { userId: v.string() },
  handler: async (ctx, { userId }) => {
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
      mode: "general",
      createdAt: Date.now(),
    });

    return threadId;
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
    return { ...paginated, streams };
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
    await ctx.scheduler.runAfter(0, internal.chat.generateResponseAsync, {
      threadId,
      promptMessageId: messageId,
      mode,
    });
    return messageId;
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
    } catch (error) {
      console.error("generateResponseAsync failed:", error);
      await ctx.runMutation(internal.chat.logGenerationError, {
        threadId,
        promptMessageId,
        error: error instanceof Error ? error.message : String(error),
      });
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
