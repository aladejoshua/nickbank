import { createThread, listUIMessages, saveMessage, syncStreams, vStreamArgs } from "@convex-dev/agent";
import { paginationOptsValidator } from "convex/server";
import { v } from "convex/values";
import { components, internal } from "./_generated/api";
import { mutation, query, internalAction } from "./_generated/server";
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

    // Store mapping in our lookup table
    await ctx.db.insert("userThreads", {
      userId,
      threadId,
      mode,
      createdAt: Date.now(),
    });

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
    await agent.streamText(
      ctx,
      { threadId },
      { promptMessageId },
      { saveStreamDeltas: true }
    );
  },
});
