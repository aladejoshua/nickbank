"use client";

import { useState, useCallback, useEffect, useMemo, useRef } from "react";
import { useMutation, useQuery } from "convex/react";
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

const LATEST_VIDEO = {
  title: "i used to want $2k/month. i made $10k a day this month",
  date: "July 11, 2026",
  videoUrl: "https://www.youtube.com/watch?v=ocaSKkM16xU",
  thumbnailUrl: "https://img.youtube.com/vi/ocaSKkM16xU/mqdefault.jpg",
};

interface MessageData {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  sources: Source[];
  isPending?: boolean;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapMessage(msg: any): MessageData {
  return {
    id: msg.key ?? msg._id ?? `msg-${msg.order}`,
    role: (msg.role as "user" | "assistant" | "system") ?? "assistant",
    content: msg.text ?? "",
    sources: extractSources(msg),
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

  const [threadId, setThreadId] = useState<string | null>(null);

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
    // Any optimistic messages without a matching real message are still pending
    const realIds = new Set(realMessages.map((m) => m.id));
    const unconfirmed = optimisticMessages.filter((m) => !realIds.has(m.id));
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
  useEffect(() => {
    if (latestError && appState === "streaming") {
      setGenerationError(latestError.error);
      setAppState("error");
      setWaitingForResponse(false);
    }
  }, [latestError, appState]);

  const handleSend = useCallback(async () => {
    const text = inputValue.trim();
    if (!text || appState === "sending" || appState === "streaming") return;

    if (text === "/wwnd") {
      setMode("nick-only");
      setInputValue("");
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
  }, [inputValue, appState, mode, threadId, userId, getOrCreateThread, sendMessageMutation]);

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
      await resetChat({ userId });
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
          title={LATEST_VIDEO.title}
          date={LATEST_VIDEO.date}
          videoUrl={LATEST_VIDEO.videoUrl}
          thumbnailUrl={LATEST_VIDEO.thumbnailUrl}
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
        <MessageList messages={messages} isStreaming={isStreaming} isWaiting={waitingForResponse} />
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
          (acc, m) => acc + Math.ceil(m.content.length / 4),
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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function extractSources(msg: any): Source[] {
  const sources: Source[] = [];

  if (msg.parts) {
    for (const part of msg.parts) {
      if (part.type === "tool-result" && typeof part.result === "string") {
        const videoMatches = part.result.match(
          /https:\/\/www\.youtube\.com\/watch\?v=[\w-]+/g
        );
        const dateMatches = part.result.match(
          /(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},\s+\d{4}/g
        );

        if (videoMatches) {
          for (const url of videoMatches) {
            const existing = sources.find((s) => s.videoUrl === url);
            if (!existing) {
              sources.push({
                title: "Nick's Daily Update",
                date: dateMatches?.[0] ?? "",
                videoUrl: url,
              });
            }
          }
        }
      }
    }
  }

  return sources;
}
