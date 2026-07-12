import { v } from "convex/values";
import { mutation, action } from "./_generated/server";
import { rag } from "./rag";

export const ingestTranscript = mutation({
  args: {
    date: v.string(),
    title: v.string(),
    videoUrl: v.string(),
    content: v.string(),
  },
  handler: async (ctx, { date, title, videoUrl, content }) => {
    const entryId = await rag.add(ctx, {
      namespace: "nick-transcripts",
      key: videoUrl,
      title: `${title} (${date})`,
      text: content,
      filterValues: [{ name: "date", value: date }],
    });
    return entryId;
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
