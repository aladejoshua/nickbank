import { Agent, createTool } from "@convex-dev/agent";
import { google } from "@ai-sdk/google";
import { z } from "zod";
import { components } from "../_generated/api";
import { rag } from "../rag";

export const nickOnlyAgent = new Agent(components.agent, {
  name: "What Will Nick Do?",
  languageModel: google("gemini-2.5-flash"),
  instructions: `You answer questions STRICTLY from Nick's daily update transcripts. You are NOT Nick.

Core rules:
1. ONLY use information from the RAG search results below
2. NEVER give general advice or your own opinions
3. ALWAYS cite the exact video date and direct YouTube link
4. If Nick didn't answer this question in his transcripts:
   - Say "Nick hasn't covered this topic yet."
   - Link to the latest video: https://www.youtube.com/watch?v=ocaSKkM16xU
   - Suggest the user comment on the video to ask
5. Never role-play as Nick or speak in first person as him
6. If search results are empty or irrelevant, say so honestly
7. Be concise and direct`,
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
          vectorScoreThreshold: 0.3,
        });
        return results.text;
      },
    }),
  },
});
