**Done.** I've created the file with a comprehensive project plan.

```markdown
# Project Plan: "Did Nick Answer My Question?"

## Project Overview
- **Name**: Did Nick Answer My Question?
- **Goal**: A honest RAG chatbot that answers questions based *only* on Nick's daily update transcripts.
- **Key Modes**:
  - Default mode: General Q&A
  - **"What Will Nick Do"** mode: Strict retrieval from transcripts only
- **Target**: Share in Nick's free community (Maker Zero)

## Core Rules (Non-Negotiable)
- Never give general advice.
- Always cite exact video date + direct YouTube link.
- If Nick didn't answer → Clearly say so + link to latest video + instruct user to comment there.
- No role-playing as Nick.

## Tech Stack
- **Frontend**: Next.js 15 (App Router) + TypeScript + TailwindCSS
- **Backend + DB + Vectors**: Convex (Starter tier)
- **AI / LLM**: Gemini Flash / Flash-Lite (free tier first, fallback to local Ollama)
- **Embeddings**: Gemini embedding model or nomic-embed-text (local)
- **Design**: Dark theme, glassmorphic UI, inspired by Grok/xAI interface
- **Deployment**: Vercel (frontend) + Convex (backend)

## Data Structure (Convex)

**Main Table: `transcripts`**
- `id`: string
- `date`: string (YYYY-MM-DD)
- `title`: string
- `video_url`: string
- `content`: string (full cleaned transcript)
- `topics`: array of strings (optional)

**Chunks Table or embedded vector field** for RAG.

## Folder Structure
```
/did-nick-answer
├── app/                  # Next.js app
├── components/
├── lib/
│   ├── convex/           # Convex queries & mutations
│   └── rag.ts            # RAG logic
├── scripts/
│   └── ingest-transcript.ts   # Add new transcripts
├── convex/               # Convex backend
│   ├── schema.ts
│   ├── transcripts.ts
│   └── vectors.ts
├── transcripts/          # Raw cleaned MD files (local backup)
└── ...
```

## Main Features
1. Chat interface with mode toggle
2. Strict "Did Nick Answer?" logic
3. Source citations with video links
4. Transcript ingestion tool
5. Latest video highlight
6. Dark glassmorphic UI

## Phase 1: MVP (Next 1-2 weeks)
- Set up Convex + Next.js project
- Define schema + vector index
- Build transcript ingestion script
- Implement basic RAG with Gemini
- Create chat UI + "What Will Nick Do" mode
- Add strict prompting rules

## Phase 2: Polish
- Beautiful glassmorphic design
- Rate limiting
- History / conversations
- Mobile responsiveness
- "Add new transcript" admin flow

## Phase 3: Community Release
- Deploy to Vercel
- Write announcement post for Maker Zero
- Add usage guidelines

## Cost Management
- Stay on Convex Starter + Gemini free tier as long as possible
- Monitor usage dashboard

## Success Criteria
- Accurate, honest answers with proper citations
- Zero hallucinated advice
- Smooth UX
- Easy to maintain and add new transcripts

