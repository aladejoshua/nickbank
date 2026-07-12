"use client";

import { useState, useCallback, useEffect, useMemo, useRef } from "react";
import { useMutation, useQuery, useAction } from "convex/react";
import { api } from "../convex/_generated/api";
import { getUserId } from "../lib/userId";
import Header from "./Header";
import HeroBanner from "./HeroBanner";
import MessageList from "./MessageList";
import ChatInput from "./ChatInput";
import type { ChatInputHandle } from "./ChatInput";
import EmptyState from "./EmptyState";
import ErrorMessage from "./ErrorMessage";
import type { Source } from "./Message";

type AppState = "idle" | "sending" | "streaming" | "error";

const FALLBACK_VIDEO = {
  title: "i used to want $2k/month. i made $10k a day this month",
  date: "July 11, 2026",
  videoUrl: "https://www.youtube.com/watch?v=ocaSKkM16xU",
  thumbnailUrl: "https://img.youtube.com/vi/ocaSKkM16xU/mqdefault.jpg",
};

// Rule 6 + Rule 9: Timeout for messages stuck on pending/streaming (30 seconds)
const STUCK_TIMEOUT_MS = 60_000;

interface MessageData {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  sources: Source[];
  isPending?: boolean;
  isError?: boolean;
  error?: string;
}

// Rule 4: Parse structured sources from tool-result parts
// Tool returns JSON: { text: string, sources: Array<{id, title, score}> }
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function extractSources(msg: any): Source[] {
  const sources: Source[] = [];

  if (msg.parts) {
    for (const part of msg.parts) {
      if (part.type === "tool-result" && typeof part.result === "string") {
        try {
          const parsed = JSON.parse(part.result);
          if (parsed.sources && Array.isArray(parsed.sources)) {
            for (const s of parsed.sources) {
              if (s.id && s.title && typeof s.score === "number") {
                const existing = sources.find((src) => src.id === s.id);
                if (!existing) {
                  sources.push({
                    id: s.id,
                    title: s.title,
                    score: s.score,
                  });
                }
              }
            }
          }
        } catch {
          // Not JSON — fall back to extracting YouTube URLs from text
          const videoMatches = part.result.match(
            /https:\/\/www\.youtube\.com\/watch\?v=[\w-]+/g
          );
          if (videoMatches) {
            for (const url of videoMatches) {
              const existing = sources.find((src) => src.id === url);
              if (!existing) {
                sources.push({
                  id: url,
                  title: "Nick's Daily Update",
                  score: 0.5,
                });
              }
            }
          }
        }
      }
    }
  }

  // Also check for sources attached by the query (from messageSources table)
  if (msg.sources && Array.isArray(msg.sources)) {
    for (const s of msg.sources) {
      if (s.id && s.title && typeof s.score === "number") {
        const existing = sources.find((src) => src.id === s.id);
        if (!existing) {
          sources.push({
            id: s.id,
            title: s.title,
            score: s.score,
          });
        }
      }
    }
  }

  return sources;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapMessage(msg: any): MessageData {
  return {
    id: msg.key ?? msg._id ?? `msg-${msg.order}`,
    role: (msg.role as "user" | "assistant" | "system") ?? "assistant",
    content: msg.text ?? "",
    sources: extractSources(msg),
    isError: msg.status === "error",
    error: msg.error,
  };
}

export default function ChatApp() {
  const chatInputRef = useRef<ChatInputHandle>(null);
  const [mode, setMode] = useState<"general" | "nick-only">("general");
  const [heroDismissed, setHeroDismissed] = useState(false);
  const [inputValue, setInputValue] = useState("");
  const [appState, setAppState] = useState<AppState>("idle");
  const [optimisticMessages, setOptimisticMessages] = useState<MessageData[]>([]);
  const [waitingForResponse, setWaitingForResponse] = useState(false);
  const [generationError, setGenerationError] = useState<string | null>(null);

  const userId = useMemo(() => getUserId(), []);

  const getOrCreateThread = useMutation(api.chat.getOrCreateThread);
  const resetChat = useMutation(api.chat.resetChat);
  const sendMessageMutation = useMutation(api.chat.sendMessage);
  const updateModeMutation = useMutation(api.chat.updateMode);
  const retryGenerationMutation = useMutation(api.chat.retryGeneration);
  const getLatestTranscript = useAction(api.transcripts.getLatestTranscript);

  const [threadId, setThreadId] = useState<string | null>(null);
  const [latestVideo, setLatestVideo] = useState(FALLBACK_VIDEO);

  // Fetch latest video for hero banner
  useEffect(() => {
    getLatestTranscript()
      .then((result) => {
        if (result) {
          setLatestVideo({
            title: String(result.title),
            date: String(result.date),
            videoUrl: FALLBACK_VIDEO.videoUrl,
            thumbnailUrl: FALLBACK_VIDEO.thumbnailUrl,
          });
        }
      })
      .catch(() => {
        // Keep fallback video on error
      });
  }, [getLatestTranscript]);

  // Query messages for the current thread
  const messagesResult = useQuery(
    api.chat.listMessages,
    threadId
      ? {
          threadId,
          paginationOpts: { cursor: null, numItems: 100 },
        }
      : "skip"
  );

  // Query for generation errors on the current thread
  const errors = useQuery(
    api.chat.listErrors,
    threadId ? { threadId } : "skip"
  );

  const latestError = errors && errors.length > 0 ? errors[0] : null;

  // Convert Agent messages to our MessageData format
  const realMessages = useMemo(() => {
    if (!messagesResult) return [];
    return messagesResult.page.map(mapMessage);
  }, [messagesResult]);

  // Merge: show real messages + any optimistic messages not yet confirmed
  const messages = useMemo(() => {
    if (realMessages.length === 0) return optimisticMessages;
    // Match optimistic messages to real ones by ID (set after sendMessageMutation returns)
    // or by content match for user messages (handles race where ID update hasn't processed yet)
    const realIds = new Set(realMessages.map((m) => m.id));
    const realUserTexts = new Set(
      realMessages.filter((m) => m.role === "user").map((m) => m.content)
    );
    const unconfirmed = optimisticMessages.filter(
      (m) => !realIds.has(m.id) && !(m.role === "user" && realUserTexts.has(m.content))
    );
    return [...realMessages, ...unconfirmed];
  }, [realMessages, optimisticMessages]);

  // Check if any message is still streaming
  const isStreaming = useMemo(() => {
    if (!messagesResult) return false;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return messagesResult.page.some((msg: any) => msg.status === "streaming");
  }, [messagesResult]);

  // Clear waiting state once assistant reply with content arrives
  useEffect(() => {
    if (waitingForResponse && messages.length > 0) {
      const lastMsg = messages[messages.length - 1];
      if (lastMsg.role === "assistant" && lastMsg.content.trim().length > 0) {
        setWaitingForResponse(false);
      }
    }
  }, [messages, waitingForResponse]);

  // Reset app state when streaming finishes
  useEffect(() => {
    if (!isStreaming && appState === "streaming") {
      setAppState("idle");
    }
  }, [isStreaming, appState]);

  // Detect generation errors and transition to error state
  // Triggers when: action logs an error while streaming, OR
  // a message is stuck on "pending" and there's a matching error in generationErrors
  useEffect(() => {
    if (!latestError) return;

    // Case 1: error arrives during streaming
    if (appState === "streaming") {
      setGenerationError(latestError.error);
      setAppState("error");
      setWaitingForResponse(false);
      return;
    }

    // Case 2: message stuck on "pending" and error already logged
    // Don't wait for timeout — surface the real error immediately
    if (waitingForResponse && appState !== "error") {
      const lastMsg = messages.length > 0 ? messages[messages.length - 1] : null;
      if (lastMsg?.role === "assistant" && lastMsg.content.trim().length === 0) {
        setGenerationError(latestError.error);
        setAppState("error");
        setWaitingForResponse(false);
      }
    }
  }, [latestError, appState, waitingForResponse, messages]);

  // Rule 6 + Rule 9: Timeout fallback for messages stuck on pending/streaming
  // If no update in 30s, surface an error state.
  // Timer resets on stream activity (messages OR streams data changing)
  // so slow LLMs aren't killed prematurely.
  const lastActivityTime = useRef<number | null>(null);

  useEffect(() => {
    if (isStreaming || waitingForResponse) {
      lastActivityTime.current = Date.now();
    } else {
      lastActivityTime.current = null;
    }
  }, [isStreaming, waitingForResponse]);

  // Reset timer on any reactive update — messages text changing OR stream deltas arriving
  useEffect(() => {
    if (lastActivityTime.current) {
      lastActivityTime.current = Date.now();
    }
  }, [messages, messagesResult]);

  useEffect(() => {
    if (!lastActivityTime.current) return;

    const checkStuck = setInterval(() => {
      if (!lastActivityTime.current) return;
      const elapsed = Date.now() - lastActivityTime.current;
      if (elapsed > STUCK_TIMEOUT_MS) {
        // Rule 6 + Rule 9: Message is stuck — surface error state
        // Prefer the actual error from generationErrors over generic timeout
        const errorMsg = latestError?.error ?? "Response timed out. Please try again.";
        setGenerationError(errorMsg);
        setAppState("error");
        setWaitingForResponse(false);
        lastActivityTime.current = null;
      }
    }, 1000);

    return () => clearInterval(checkStuck);
  }, [isStreaming, waitingForResponse]);

  const handleSend = useCallback(async () => {
    const text = inputValue.trim();
    if (!text || appState === "sending" || appState === "streaming") return;

    if (text === "/wwnd") {
      setMode("nick-only");
      setInputValue("");
      if (threadId) {
        updateModeMutation({ userId, mode: "nick-only" }).catch(console.error);
      }
      return;
    }

    const userMsg: MessageData = {
      id: `optimistic-${Date.now()}`,
      role: "user",
      content: text,
      sources: [],
      isPending: true,
    };

    setInputValue("");
    setOptimisticMessages((prev) => [...prev, userMsg]);
    setAppState("sending");
    setWaitingForResponse(true);
    setGenerationError(null);

    try {
      let currentThreadId = threadId;
      if (!currentThreadId) {
        currentThreadId = await getOrCreateThread({ userId, mode });
        setThreadId(currentThreadId);
      }

      const realMessageId = await sendMessageMutation({
        threadId: currentThreadId,
        prompt: text,
        mode,
      });

      // Update optimistic message with the real message ID for proper merge correlation
      setOptimisticMessages((prev) =>
        prev.map((m) => (m.id === userMsg.id ? { ...m, id: realMessageId } : m))
      );

      setAppState("streaming");
    } catch (error) {
      console.error("Failed to send message:", error);
      setAppState("error");
      setWaitingForResponse(false);
      setOptimisticMessages((prev) => prev.filter((m) => m.id !== userMsg.id));
    }
  }, [inputValue, appState, mode, threadId, userId, getOrCreateThread, sendMessageMutation, updateModeMutation]);

  // Rule 8: Retry re-runs the action against the same message row
  const handleRetry = useCallback(
    async (messageId: string) => {
      if (!threadId) return;
      setGenerationError(null);
      setAppState("streaming");
      setWaitingForResponse(true);

      try {
        await retryGenerationMutation({
          threadId,
          promptMessageId: messageId,
          mode,
        });
      } catch (error) {
        console.error("Failed to retry:", error);
        setAppState("error");
        setWaitingForResponse(false);
      }
    },
    [threadId, mode, retryGenerationMutation]
  );

  const handleDismissError = () => {
    setGenerationError(null);
    setAppState("idle");
  };

  const handleExampleClick = (text: string) => {
    setInputValue(text);
    setTimeout(() => chatInputRef.current?.focus(), 0);
  };

  const handleNewChat = async () => {
    setAppState("idle");
    setWaitingForResponse(false);
    setGenerationError(null);
    setOptimisticMessages([]);
    try {
      await resetChat({ userId, mode });
    } catch {
      // Thread might not exist yet, that's fine
    }
    setThreadId(null);
    setInputValue("");
    setHeroDismissed(false);
  };

  return (
    <div className="flex h-screen flex-col bg-[--bg]">
      <Header onNewChat={handleNewChat} />

      {!heroDismissed && messages.length === 0 && (
        <HeroBanner
          title={latestVideo.title}
          date={latestVideo.date}
          videoUrl={latestVideo.videoUrl}
          thumbnailUrl={latestVideo.thumbnailUrl}
          onDismiss={() => setHeroDismissed(true)}
        />
      )}

      {appState === "error" && (
        <ErrorMessage
          message={generationError ?? undefined}
          onDismiss={handleDismissError}
        />
      )}

      {messages.length === 0 ? (
        <EmptyState
          onExampleClick={handleExampleClick}
          showSuggestions={inputValue.length === 0}
        />
      ) : (
        <MessageList
          messages={messages}
          isStreaming={isStreaming}
          isWaiting={waitingForResponse}
          onRetry={handleRetry}
        />
      )}

      <ChatInput
        ref={chatInputRef}
        value={inputValue}
        onChange={setInputValue}
        onSend={handleSend}
        disabled={appState === "sending" || appState === "streaming"}
        mode={mode}
        inChat={messages.length > 0}
        tokenCount={messages.reduce(
          (acc, m) => acc + m.content.length,
          0
        )}
        placeholder={
          mode === "nick-only"
            ? "Ask what Nick would do about..."
            : "Ask anything about Nick's content..."
        }
      />
    </div>
  );
}
