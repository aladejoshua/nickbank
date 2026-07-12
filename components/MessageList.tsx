"use client";

import { useRef, useEffect } from "react";
import Message, { type Source } from "./Message";
import ThinkingIndicator from "./ThinkingIndicator";

export interface MessageData {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  sources?: Source[];
  isPending?: boolean;
}

interface MessageListProps {
  messages: MessageData[];
  isStreaming: boolean;
  isWaiting: boolean;
}

export default function MessageList({ messages, isStreaming, isWaiting }: MessageListProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isWaiting || isStreaming) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    } else {
      const t = setTimeout(() => {
        bottomRef.current?.scrollIntoView({ behavior: "smooth" });
      }, 50);
      return () => clearTimeout(t);
    }
  }, [messages, isStreaming, isWaiting]);

  const lastMsg = messages.length > 0 ? messages[messages.length - 1] : null;
  const showThinking = isWaiting && (!lastMsg || lastMsg.role !== "assistant" || lastMsg.content.trim().length === 0);

  return (
    <div className="flex-1 overflow-y-auto pt-14 pb-24">
      <div className="mx-auto flex max-w-2xl flex-col gap-3 py-4">
        {messages.map((msg, i) => (
          <Message
            key={msg.id}
            {...msg}
            isStreaming={isStreaming && i === messages.length - 1 && msg.role === "assistant"}
          />
        ))}
        {showThinking && <ThinkingIndicator />}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}
