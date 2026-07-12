# Convex + Next.js Knowledge-Bank Chat — Architecture Rules

These rules are **mandatory**, not suggestions. Any implementation that deviates from them should be treated as a bug unless there is an explicit, documented reason.

---

## 1. Core principle

Convex queries are reactive. The client subscribes to data, not to a stream protocol. **All UI updates must flow through the database via `useQuery`.** Do not build custom WebSocket/SSE handling on the client to simulate what Convex already does automatically, unless implementing true HTTP token streaming per Rule 5.

---

## 2. Function type rules (non-negotiable)

| Function type | Allowed to do | Forbidden from doing |
|---|---|---|
| **Mutation** | Insert/patch/delete rows, schedule actions via `ctx.scheduler.runAfter` | Calling `fetch`, calling any external API, calling an LLM or embeddings endpoint |
| **Action** | Call external APIs (LLM, embeddings, third-party vector DBs), call mutations to persist results | Being used as the entry point from the client for writes — it must be scheduled from a mutation, or invoked via an `httpAction` for streaming, never called directly as the primary write path |
| **Query** | Read data, is reactive | Any mutation of state, any external network call |

**Rule**: the client never calls an action directly to send a chat message. The client calls a **mutation**. The mutation is responsible for persisting the user's turn and scheduling the action that does retrieval + generation.

---

## 3. Required message send flow

1. Client calls `sendMessage` **mutation** with the user's text.
2. Mutation, in a single transaction:
   - Inserts the user message row.
   - Inserts a placeholder assistant message row with `status: "pending"`.
   - Calls `ctx.scheduler.runAfter(0, internal.chat.generateReply, { messageId })`.
3. Scheduled **action** `generateReply`:
   - Embeds the query.
   - Runs vector search against the knowledge bank.
   - Assembles context + calls the LLM.
   - Streams/patches the assistant message row as described in Rule 5.
   - On completion, patches `status: "complete"`.
   - On failure, patches `status: "error"` with an `error` field — never leaves the row stuck on `"pending"`.
4. Client has a live `useQuery` subscription on the thread/messages. It never polls. It never manages the streaming transport itself beyond reading `status` and `content`.

No other flow is acceptable. Do not call the LLM from inside the mutation. Do not have the client poll for updates.

---

## 4. Required schema fields

Every chat message row must include at minimum:

```
messages: {
  threadId: Id<"threads">,
  role: "user" | "assistant",
  content: string,
  status: "pending" | "streaming" | "complete" | "error",
  error: string | undefined,
  sources: Array<{ id: string, title: string, score: number }> | undefined,
  createdAt: number,
}
```

`sources` must be populated from the knowledge-bank retrieval step and attached to the assistant message so the UI can show citations. Never discard retrieval provenance.

---

## 5. Streaming rules

Pick **one** of the following two patterns per project. Do not mix them.

### Pattern A — DB-patch streaming (simpler, default choice for v1)
- Buffer LLM tokens in memory inside the action.
- Patch the assistant message's `content` field on an interval (150–250ms) or on sentence boundaries — never on every single token.
- Set `status: "streaming"` on the first patch, `status: "complete"` on the final patch.

### Pattern B — Persistent HTTP streaming (use for production-grade UX)
- Use `@convex-dev/persistent-text-streaming` or `@convex-dev/agent`.
- The HTTP stream serves the live token-by-token experience to the originating browser tab.
- The same component must also durably persist chunks to the database so:
  - A page reload resumes from the DB state, not from nothing.
  - Other tabs/users subscribed to the same thread see the message update via `useQuery`, not just the tab that opened the stream.

**Forbidden**: writing every individual token as a separate database write. This is explicitly called out as an anti-pattern — it is too many writes and will not scale.

---

## 6. Client UI rules

- **Optimistic send**: on submit, use Convex's optimistic update support in `useMutation` so the user's message appears instantly, before the mutation round-trip completes.
- **No manual re-render logic for streaming**: the assistant message bubble reads `status` and `content` from the live query result. When `content` changes, React re-renders it. Do not build a separate token-accumulation state machine on the client for Pattern A.
- **Status → UI mapping** (required):
  - `pending` → show a "thinking" / retrieval indicator, no bubble content yet.
  - `streaming` → show the partial content with a streaming cursor.
  - `complete` → render final content, render `sources` as citations.
  - `error` → render an inline error state with a retry action that re-triggers the action (not a full new message).
- **Never leave a message permanently stuck on `pending` or `streaming`** in the UI without a timeout fallback (e.g., if no update in 30s, surface an error state).

---

## 7. Knowledge bank retrieval rules

- Retrieval must happen inside the **action**, never client-side, never inside a mutation.
- Every generated answer must carry its retrieved `sources` back onto the message row (Rule 4). If the model is asked to answer and no relevant sources are found, the action must still complete the message and explicitly mark that no sources were found — it must not silently hallucinate an unsourced answer without flagging it.

---

## 8. Error handling rules

- Any thrown error inside the action must be caught and turned into a `status: "error"` patch on the message row. Unhandled action failures that leave a row on `pending` forever are treated as a defect.
- Retries must re-run the action against the same message row (reset to `pending`/`streaming`), not create a duplicate assistant message.

---

## 9. What NOT to do

- Do not call the LLM or embeddings API directly from a mutation.
- Do not have the client poll a query in a loop instead of relying on Convex reactivity.
- Do not write one database patch per token.
- Do not build custom WebSocket handling to replace `useQuery` reactivity.
- Do not drop retrieval `sources` before they reach the client.
- Do not let a message sit indefinitely in `pending`/`streaming` with no timeout or error path.