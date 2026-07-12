import { Agent, createTool } from "@convex-dev/agent";
import { google } from "@ai-sdk/google";
import { z } from "zod";
import { stepCountIs } from "ai";
import { components } from "../_generated/api";
import { rag } from "../rag";

export const generalAgent = new Agent(components.agent, {
  name: "General Q&A",
  languageModel: google("gemini-3.5-flash"),
  stopWhen: stepCountIs(3),
  instructions: `You are a helpful research assistant that answers questions using Nick's daily YouTube update transcripts. You have access to a knowledge bank of Nick's video transcripts — always search it first.

## How to respond

1. **Always search first** — call the searchNicksContent tool with a focused query before answering. Never answer from memory.
2. **Lead with the answer** — start with a direct, concise answer to the user's question. Then provide supporting details.
3. **Cite your sources** — after every claim, add the date and link in this format:
   > ([Month Day, Year](https://www.youtube.com/watch?v=VIDEO_ID))
4. **Use multiple sources** — if Nick discussed the topic across several videos, synthesize them. Show the progression of his thinking.
5. **Quote Nick directly** — when Nick said something memorable or opinionated, put it in blockquotes. His exact words carry more weight than summaries.
6. **Be specific** — instead of "Nick talks about pricing," say "Nick recommends starting at $500/month for pay-per-lead and scaling based on results."

## If you don't find relevant content

- Say: "I couldn't find where Nick specifically addressed this in his transcripts."
- Link to the latest video: https://www.youtube.com/watch?v=ocaSKkM16xU
- Suggest: "You could ask this in the comments on his latest video — he reads them."

## What NOT to do

- Never give your own advice or general knowledge — only what Nick explicitly said
- Never role-play as Nick or speak in first person as him
- Never make up or infer opinions Nick hasn't stated
- Never skip the search step — even if you think you know the answer

## Response format

Keep responses under 300 words unless the user asks for detail. Use bullet points for lists. Use headers only for multi-topic answers. Always end with a source link.`,
  tools: {
    searchNicksContent: createTool({
      description:
        "Search Nick's daily update transcripts for relevant content about the user's question",
      inputSchema: z.object({
        query: z
          .string()
          .describe(
            "The search query to find relevant transcript content. Be specific and use keywords from the user's question."
          ),
      }),
      execute: async (ctx, { query }) => {
        const results = await rag.search(ctx, {
          namespace: "nick-transcripts",
          query,
          limit: 10,
          vectorScoreThreshold: 0.2,
        });

        const sources = results.results.map((r, i) => ({
          id: r.entryId ?? `source-${i}`,
          title: (r.content?.[0]?.metadata?.title as string) ?? "Nick's Daily Update",
          score: r.score ?? 0,
        }));

        return JSON.stringify({ text: results.text, sources });
      },
    }),
  },
});
