"use client";

import { useRef, useEffect } from "react";
import Message, { type Source } from "./Message";
import LoadingDots from "./LoadingDots";

export interface MessageData {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  sources?: Source[];
}

interface MessageListProps {
  messages: MessageData[];
  isStreaming: boolean;
}

export default function MessageList({ messages, isStreaming }: MessageListProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isStreaming) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    } else {
      const t = setTimeout(() => {
        bottomRef.current?.scrollIntoView({ behavior: "smooth" });
      }, 50);
      return () => clearTimeout(t);
    }
  }, [messages, isStreaming]);

  const showLoading =
    isStreaming &&
    (messages.length === 0 || messages[messages.length - 1].role !== "assistant");

  return (
    <div className="flex-1 overflow-y-auto pt-14 pb-24">
      <div className="mx-auto flex max-w-2xl flex-col gap-3 py-4">
        {messages.map((msg) => (
          <Message key={msg.id} {...msg} />
        ))}
        {showLoading && (
          <div className="flex justify-start">
            <div className="rounded-2xl rounded-bl-md bg-[--assistant-bubble]">
              <LoadingDots />
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}
