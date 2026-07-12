import { defineTable, defineSchema } from "convex/server";
import { v } from "convex/values";

// Schema for our userThreads lookup table
// (Agent component manages its own threads/messages/streams tables)
export default defineSchema({
  userThreads: defineTable({
    userId: v.string(),
    threadId: v.string(),
    mode: v.union(v.literal("general"), v.literal("nick-only")),
    createdAt: v.number(),
  }).index("by_userId", ["userId"]),

  generationErrors: defineTable({
    threadId: v.string(),
    promptMessageId: v.string(),
    error: v.string(),
    timestamp: v.number(),
  }).index("by_threadId", ["threadId"]),

  // Rule 4: sources attached to assistant messages for citation display
  messageSources: defineTable({
    messageId: v.string(),
    threadId: v.string(),
    sources: v.array(
      v.object({
        id: v.string(),
        title: v.string(),
        score: v.number(),
      })
    ),
  })
    .index("by_messageId", ["messageId"])
    .index("by_threadId", ["threadId"]),
});
