# Project Plan: "Did Nick Answer My Question?"

## Project Overview
- **Name**: Did Nick Answer My Question?
- **Goal**: An honest RAG chatbot that answers questions based *only* on Nick's daily update transcripts.
- **Key Modes**:
  - Default mode: General Q&A
  - **"What Will Nick Do"** mode: Strict retrieval from transcripts only
- **Target**: Share in Nick's free community (Maker Zero)

## Core Rules (Non-Negotiable)
- Never give general advice.
- Always cite exact video date + direct YouTube link.
- If Nick didn't answer → Clearly say so + link to latest video + instruct user to comment there.
- No role-playing as Nick.

## Thread Model: One Thread Per User (Forever)
- Each user gets **exactly one thread** — ever.
- "New Chat" **deletes the old thread entirely** and creates a fresh one. No orphans, no history pile-up.
- No thread list, no thread switcher, no conversation history sidebar.
- Thread is tied to a user identifier (anonymous ID via `localStorage` or fingerprint — no auth required for MVP).
- When user clicks "New Chat" → old thread + all its messages are deleted from Convex → new thread created.
- The agent component's `createThread` / thread deletion handles this. We do NOT use `continueThread` across chat resets.
- This keeps the free tier usage lean (one thread = one context window = fewer tokens per request).

## Tech Stack (Convex-Native)

| Layer | Package | Purpose |
|-------|---------|---------|
| Frontend | Next.js 16 (App Router) + TypeScript + TailwindCSS | UI (already built) |
| Backend + DB | Convex | Database, serverless functions |
| AI Agent | `@convex-dev/agent` | Thread management, message history, streaming, context |
| RAG | `@convex-dev/rag` | Semantic search, chunking, embeddings, vector storage |
| LLM | `@ai-sdk/google` (`google("gemini-2.5-flash")`) | Free tier Gemini for chat |
| Embeddings | `@ai-sdk/google` (`google.textEmbedding("text-embedding-004")`) | 768-dim embeddings for RAG |
| Rate Limiting | `@convex-dev/rate-limiter` | Per-user rate limits (built into Agent) |
| Design | Dark theme, glassmorphic UI | Already built |
| Deployment | Vercel (frontend) + Convex (backend) | |

### Why Convex-Native?
- **Agent component** handles threads, messages, streaming over websockets (no HTTP streaming needed), conversation context, and usage tracking — all built-in
- **RAG component** handles chunking, embedding, vector search, namespaces, graceful content replacement — no custom schema needed
- **Rate limiter** integrates directly with Agent for per-user limits
- Everything persists automatically, works across clients, survives server restarts

## Architecture

```
┌─────────────────────────────────────────────────────┐
│  Next.js Frontend (Vercel)                         │
│  ┌───────────────────────────────────────────┐      │
│  │ ChatApp.tsx → uses useAgent() hooks       │      │
│  │ - Creates threads                         │      │
│  │ - Sends messages                          │      │
│  │ - Streams responses via websocket         │      │
│  │ - Displays sources from RAG search        │      │
│  └───────────────────────────────────────────┘      │
└──────────────────────┬──────────────────────────────┘
                       │ websocket + queries
┌──────────────────────▼──────────────────────────────┐
│  Convex Backend                                     │
│  ┌───────────────────────────────────────────┐      │
│  │ Agent Component (@convex-dev/agent)       │      │
│  │ - Thread management                       │      │
│  │ - Message persistence                     │      │
│  │ - Streaming deltas over websocket         │      │
│  │ - Context injection (hybrid search)       │      │
│  │ - Two agents: generalAgent, nickAgent     │      │
│  └───────────────┬───────────────────────────┘      │
│                  │ uses                              │
│  ┌───────────────▼───────────────────────────┐      │
│  │ RAG Component (@convex-dev/rag)           │      │
│  │ - Namespace: "nick-transcripts"           │      │
│  │ - Auto-chunks + embeds transcript text    │      │
│  │ - Vector search with relevance scores     │      │
│  │ - Key-based content replacement           │      │
│  │ - Filter by date, topic                   │      │
│  └───────────────────────────────────────────┘      │
│                                                     │
│  ┌───────────────────────────────────────────┐      │
│  │ Rate Limiter (@convex-dev/rate-limiter)   │      │
│  │ - 20 messages/hour per user               │      │
│  │ - Configurable per agent                  │      │
│  └───────────────────────────────────────────┘      │
└─────────────────────────────────────────────────────┘
```

## Convex Component Installation

```typescript
// convex/convex.config.ts
import { defineApp } from "convex/server";
import agent from "@convex-dev/agent/convex.config";
import rag from "@convex-dev/rag/convex.config";
import rateLimiter from "@convex-dev/rate-limiter/convex.config";

const app = defineApp();
app.use(agent);
app.use(rag);
app.use(rateLimiter);

export default app;
```

## npm Dependencies to Add

```bash
npm i @convex-dev/agent @convex-dev/rag @convex-dev/rate-limiter @ai-sdk/google ai
```

## Agent Definitions

### 1. General Q&A Agent
```typescript
// convex/agents/general.ts
import { Agent } from "@convex-dev/agent";
import { google } from "@ai-sdk/google";
import { components } from "../_generated/api";

export const generalAgent = new Agent(components.agent, {
  name: "General Q&A",
  languageModel: google("gemini-2.5-flash"),
  instructions: `You are a helpful assistant that answers questions about Nick's content.
  
Core rules:
- Only answer based on information from Nick's daily update transcripts
- Always cite the exact video date and YouTube link when referencing content
- If Nick hasn't covered a topic, clearly say so and link to the latest video
- Never give general advice — only what Nick has explicitly said
- Never role-play as Nick
- Be concise and direct`,
});
```

### 2. "What Will Nick Do?" Agent (Strict RAG)
```typescript
// convex/agents/nick-only.ts
import { Agent } from "@convex-dev/agent";
import { google } from "@ai-sdk/google";
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
   - Link to the latest video
   - Suggest the user comment on the video to ask
5. Never role-play as Nick or speak in first person as him
6. If search results are empty or irrelevant, say so honestly
7. Be concise and direct`,
  tools: {
    searchNicksContent: createTool({
      description: "Search Nick's daily update transcripts for relevant content",
      inputSchema: z.object({
        query: z.string().describe("The search query to find relevant transcript content"),
      }),
      handler: async (ctx, { query }) => {
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
```

## RAG Setup: Ingesting Transcripts

```typescript
// convex/rag.ts
import { RAG } from "@convex-dev/rag";
import { components } from "./_generated/api";
import { google } from "@ai-sdk/google";

export const rag = new RAG(components.rag, {
  textEmbeddingModel: google.textEmbedding("text-embedding-004"),
  embeddingDimension: 768,
});
```

```typescript
// convex/transcripts.ts — Mutation to ingest a transcript
import { v } from "convex/values";
import { mutation } from "./_generated/server";
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
      key: videoUrl, // Use video URL as key for graceful replacement
      title: `${title} (${date})`,
      text: content,
      filterValues: [
        { name: "date", value: date },
      ],
    });
    return entryId;
  },
});
```

```typescript
// convex/transcripts.ts — Batch ingestion action
import { action } from "./_generated/server";
import { internal } from "./_generated/api";

export const ingestAllTranscripts = action({
  args: {},
  handler: async (ctx) => {
    const transcripts = [
      // Array of { date, title, videoUrl, content } objects
      // Populated from the /transcripts/ folder
    ];
    
    for (const t of transcripts) {
      await ctx.runMutation(internal.transcripts.ingestTranscript, {
        date: t.date,
        title: t.title,
        videoUrl: t.videoUrl,
        content: t.content,
      });
    }
    
    return { ingested: transcripts.length };
  },
});
```

## Chat Flow (Frontend ↔ Convex)

### Backend (convex/chat.ts)
```typescript
import {
  createThread,
  deleteThread,
  listUIMessages,
  saveMessage,
  syncStreams,
  vStreamArgs,
} from "@convex-dev/agent";
import { paginationOptsValidator } from "convex/server";
import { v } from "convex/values";
import { components, internal } from "./_generated/api";
import { mutation, query, internalAction } from "./_generated/server";
import { generalAgent } from "./agents/general";
import { nickOnlyAgent } from "./agents/nickOnly";

// Each user has exactly one thread. "New Chat" deletes the old one.
export const getOrCreateThread = mutation({
  args: {
    userId: v.string(), // anonymous ID from localStorage
    mode: v.union(v.literal("general"), v.literal("nick-only")),
  },
  handler: async (ctx, { userId, mode }) => {
    // Look for existing thread for this user
    const existing = await ctx.db
      .query("threads")
      .filter((q) => q.eq(q.field("userId"), userId))
      .first();

    if (existing) {
      return existing.threadId;
    }

    // Create new thread
    const threadId = await createThread(ctx, components.agent, {});
    await ctx.db.insert("threads", {
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
    const thread = await ctx.db
      .query("threads")
      .filter((q) => q.eq(q.field("userId"), userId))
      .first();

    if (thread) {
      await deleteThread(ctx, components.agent, {
        threadId: thread.threadId,
      });
      await ctx.db.delete(thread._id);
    }

    // Create fresh thread
    const threadId = await createThread(ctx, components.agent, {});
    await ctx.db.insert("threads", {
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
      { saveStreamDeltas: true },
    );
  },
});
```

### User Identity (No Auth)
```typescript
// lib/userId.ts — generate or retrieve anonymous user ID
export function getUserId(): string {
  if (typeof window === "undefined") return "";
  let id = localStorage.getItem("nickbank-user-id");
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem("nickbank-user-id", id);
  }
  return id;
}
```

### Convex Table: `threads`
```typescript
// Auto-created by Agent component, but we add our own lookup table:
threads: defineTable({
  userId: v.string(),       // anonymous ID from localStorage
  threadId: v.string(),     // Agent component's thread ID
  mode: v.union(v.literal("general"), v.literal("nick-only")),
  createdAt: v.number(),
}).index("by_userId", ["userId"])
```

### Frontend (ChatApp.tsx changes)
```typescript
// Replace mock logic with real Convex calls
import { useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { getUserId } from "../../lib/userId";

// In ChatApp.tsx:
const userId = getUserId();
const resetChat = useMutation(api.chat.resetChat);
const sendMessage = useMutation(api.chat.sendMessage);

// Get or create thread on mount
const threadId = useQuery(api.chat.getOrCreateThread, { userId, mode });

const handleSend = async (text: string) => {
  if (!threadId) return;
  await sendMessage({ threadId, prompt: text, mode });
};

const handleNewChat = async () => {
  // Deletes old thread + messages, creates fresh one
  await resetChat({ userId });
  setMessages([]);
  setHeroDismissed(false);
};
```

**Key behavioral change in ChatApp.tsx:**
- `handleNewChat` calls `resetChat` which deletes the old thread entirely
- No message history survives a "New Chat" click
- Thread is re-created on next message send
- `useQuery(api.chat.listMessages, ...)` reactively shows messages — all streaming updates reflect live

## File Structure (Updated)

```
/nickbank
├── app/
│   ├── layout.tsx              ✅ exists
│   ├── page.tsx                ✅ exists
│   ├── globals.css             ✅ exists
│   └── api/                    ❌ NEW — not needed (Agent uses websocket)
├── components/                 ✅ exists (11 components)
│   ├── ChatApp.tsx             🔧 UPDATE — replace mock with Convex calls
│   ├── MessageList.tsx         🔧 UPDATE — use Agent's streaming
│   ├── Message.tsx             ✅ exists
│   ├── SourceCard.tsx          ✅ exists
│   ├── Header.tsx              ✅ exists
│   ├── HeroBanner.tsx          🔧 UPDATE — fetch latest from Convex
│   ├── EmptyState.tsx          ✅ exists
│   ├── ChatInput.tsx           ✅ exists
│   ├── LoadingDots.tsx         ✅ exists
│   ├── ErrorMessage.tsx        ✅ exists
│   └── ModeToggle.tsx          ✅ exists
├── convex/                     ❌ NEW — entire Convex backend
│   ├── convex.config.ts        ❌ Component registration
│   ├── schema.ts               ❌ Auto-generated by components
│   ├── agents/
│   │   ├── general.ts          ❌ General Q&A agent
│   │   └── nickOnly.ts         ❌ Strict RAG agent
│   ├── rag.ts                  ❌ RAG instance setup
│   ├── transcripts.ts          ❌ Ingestion mutations + actions
│   ├── chat.ts                 ❌ Thread/message/streaming logic
│   └── http.ts                 ❌ HTTP routes (if needed)
├── scripts/
│   └── ingest-transcripts.ts   ❌ NEW — read /transcripts/ and ingest
├── transcripts/                ✅ exists (24 markdown files)
├── package.json                🔧 UPDATE — add Convex component deps
├── .env.local                  ❌ NEW — CONVEX_URL, GOOGLE_AI_API_KEY
└── next.config.ts              🔧 UPDATE — add Convex config
```

## Implementation Phases

### Phase 1: Convex Backend Setup (Day 1)
1. Install Convex components: `npm i @convex-dev/agent @convex-dev/rag @convex-dev/rate-limiter @ai-sdk/google ai`
2. Create `convex/convex.config.ts` — register all 3 components
3. Run `npx convex dev` — generates code, creates tables
4. Create `convex/rag.ts` — RAG instance with Gemini embeddings
5. Create `convex/agents/general.ts` — General Q&A agent
6. Create `convex/agents/nickOnly.ts` — Strict RAG agent with search tool
7. Create `convex/chat.ts` — Thread/message/streaming mutations & queries
8. Create `convex/transcripts.ts` — Ingestion mutations
9. Set up `.env.local` with `CONVEX_URL` and `GOOGLE_AI_API_KEY`

### Phase 2: Transcript Ingestion (Day 1-2)
1. Write `scripts/ingest-transcripts.ts` — parse all 24 markdown files
2. Extract YAML frontmatter (date, title, video_url) + body content
3. Call `ingestTranscript` mutation for each file
4. Verify RAG search returns relevant results
5. Test with sample queries

### Phase 3: Frontend Integration (Day 2-3)
1. Add Convex provider to `app/layout.tsx`
2. Update `ChatApp.tsx` — replace mock logic with real Convex mutations
3. Wire up thread creation, message sending, response streaming
4. Update `HeroBanner.tsx` — fetch latest transcript from Convex
5. Test full chat flow end-to-end

### Phase 4: Polish & Rules (Day 3-4)
1. Implement strict prompting rules (cite sources, no general advice)
2. Add "Nick hasn't covered this" fallback logic
3. Ensure source cards show real video links from RAG results
4. Add rate limiting (20 msgs/hour per user)
5. Test mode switching (general ↔ nick-only)

### Phase 5: Deploy (Day 4-5)
1. Deploy Convex: `npx convex deploy`
2. Set Vercel env vars (CONVEX_URL, GOOGLE_AI_API_KEY)
3. Deploy Vercel: `git push` or `vercel --prod`
4. Test production deployment
5. Share in Maker Zero community

## Cost Management
- **Convex Starter**: Free tier — 1M function calls, 1GB storage, 500MB egress
- **Gemini 2.5 Flash**: Free tier — generous RPM/RPD limits
- **Text Embedding 004**: Free tier for embedding calls
- **Rate limiting**: 20 msgs/hour per user to stay within free tiers
- Monitor via Convex dashboard + Google AI Studio

## Success Criteria
- Accurate, honest answers with proper citations (video date + YouTube link)
- Zero hallucinated advice
- Streaming responses feel instant (websocket-based)
- Thread history persists across page reloads
- Mode toggle works: general Q&A vs strict "What Will Nick Do?"
- Easy to add new transcripts (run ingestion script)
- Works on mobile
