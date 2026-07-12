"use client";

import { useState, useCallback, useEffect, useMemo } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../convex/_generated/api";
import { getUserId } from "../lib/userId";
import Header from "./Header";
import HeroBanner from "./HeroBanner";
import MessageList from "./MessageList";
import ChatInput from "./ChatInput";
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
  const [mode, setMode] = useState<"general" | "nick-only">("general");
  const [heroDismissed, setHeroDismissed] = useState(false);
  const [inputValue, setInputValue] = useState("");
  const [appState, setAppState] = useState<AppState>("idle");

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

  // Convert Agent messages to our MessageData format
  const messages = useMemo(() => {
    if (!messagesResult) return [];
    return messagesResult.page.map(mapMessage);
  }, [messagesResult]);

  // Check if any message is still streaming
  const isStreaming = useMemo(() => {
    if (!messagesResult) return false;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return messagesResult.page.some((msg: any) => msg.status === "streaming");
  }, [messagesResult]);

  // Reset app state when streaming finishes
  useEffect(() => {
    if (!isStreaming && appState === "streaming") {
      setAppState("idle");
    }
  }, [isStreaming, appState]);

  const handleSend = useCallback(async () => {
    const text = inputValue.trim();
    if (!text || appState === "sending" || appState === "streaming") return;

    if (text === "/wwnd") {
      setMode("nick-only");
      setInputValue("");
      return;
    }

    setInputValue("");
    setAppState("sending");

    try {
      // Get or create thread
      let currentThreadId = threadId;
      if (!currentThreadId) {
        currentThreadId = await getOrCreateThread({ userId, mode });
        setThreadId(currentThreadId);
      }

      // Send the message
      await sendMessageMutation({
        threadId: currentThreadId,
        prompt: text,
        mode,
      });

      setAppState("streaming");
    } catch (error) {
      console.error("Failed to send message:", error);
      setAppState("error");
    }
  }, [inputValue, appState, mode, threadId, userId, getOrCreateThread, sendMessageMutation]);

  const handleDismissError = () => setAppState("idle");

  const handleExampleClick = (text: string) => {
    setInputValue(text);
  };

  const handleNewChat = async () => {
    setAppState("idle");
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
        <ErrorMessage onDismiss={handleDismissError} />
      )}

      {messages.length === 0 ? (
        <EmptyState
          onExampleClick={handleExampleClick}
          showSuggestions={inputValue.length === 0}
        />
      ) : (
        <MessageList messages={messages} isStreaming={isStreaming} />
      )}

      <ChatInput
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
