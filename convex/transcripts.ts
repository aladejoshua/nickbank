import { v } from "convex/values";
import { action } from "./_generated/server";
import { rag } from "./rag";

export const ingestTranscript = action({
  args: {
    date: v.string(),
    title: v.string(),
    videoUrl: v.string(),
    content: v.string(),
    contentHash: v.optional(v.string()),
  },
  handler: async (ctx, { date, title, videoUrl, content, contentHash }) => {
    const result = await rag.add(ctx, {
      namespace: "nick-transcripts",
      key: videoUrl || title,
      title: `${title} (${date})`,
      text: content,
      filterValues: [{ name: "date", value: date }],
      contentHash,
    });
    return { entryId: result.entryId, created: result.created };
  },
});

export const getLatestTranscript = action({
  args: {},
  handler: async (ctx) => {
    const results = await rag.search(ctx, {
      namespace: "nick-transcripts",
      query: "latest daily update",
      limit: 1,
    });
    if (results.entries.length === 0) return null;
    const entry = results.entries[0];
    return {
      title: entry.title ?? "Untitled",
      date: entry.filterValues?.[0]?.value ?? "",
    };
  },
});

export const listIngestedTranscripts = action({
  args: {},
  handler: async (ctx) => {
    const namespace = await rag.getOrCreateNamespace(ctx, {
      namespace: "nick-transcripts",
      status: "ready",
    });
    const entries = await rag.list(ctx, {
      namespaceId: namespace.namespaceId,
      limit: 100,
    });
    return entries.page.map((e) => ({
      key: e.key ?? "",
      title: e.title ?? "Untitled",
      date: e.filterValues?.[0]?.value ?? "",
      status: e.status,
    }));
  },
});

export const searchTranscripts = action({
  args: { query: v.string() },
  handler: async (ctx, { query }) => {
    const results = await rag.search(ctx, {
      namespace: "nick-transcripts",
      query,
      limit: 5,
      vectorScoreThreshold: 0.2,
    });
    return results.text;
  },
});
