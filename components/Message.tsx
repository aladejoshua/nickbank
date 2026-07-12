"use client";

import { useState } from "react";
import Markdown from "react-markdown";
import SourceCard from "./SourceCard";

// Rule 4: sources must be Array<{ id: string, title: string, score: number }>
export interface Source {
  id: string;
  title: string;
  score: number;
}

interface MessageProps {
  role: "user" | "assistant" | "system";
  content: string;
  sources?: Source[];
  isStreaming?: boolean;
  isPending?: boolean;
  isError?: boolean;
  onRetry?: () => void;
}

function SourcesModal({
  sources,
  onClose,
}: {
  sources: Source[];
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4"
      onClick={onClose}
    >
      <div
        className="max-h-[80vh] w-full max-w-md overflow-y-auto rounded-2xl bg-[#111] p-5 ring-1 ring-[--border]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-[--text-primary]">
            All Sources ({sources.length})
          </h3>
          <button
            onClick={onClose}
            className="rounded-md p-1 text-[--text-secondary] hover:text-[--text-primary]"
          >
            <svg
              className="h-5 w-5"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M6 18 18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>
        <div className="flex flex-col gap-2">
          {sources.map((source) => (
            <SourceCard key={source.id} {...source} />
          ))}
        </div>
      </div>
    </div>
  );
}

export default function Message({
  role,
  content,
  sources,
  isStreaming,
  isPending,
  isError,
  onRetry,
}: MessageProps) {
  const [showAllSources, setShowAllSources] = useState(false);

  if (role === "system") {
    return (
      <div className="animate-fade-in-up px-4 py-2 text-center text-xs italic text-[--text-muted]">
        {content}
      </div>
    );
  }

  const isUser = role === "user";
  const visibleSources = sources?.slice(0, 2) ?? [];
  const hiddenCount = (sources?.length ?? 0) - 2;

  return (
    <>
      <div
        className={`animate-fade-in-up flex px-4 transition-opacity duration-300 ${isUser ? "justify-end" : "justify-start"} ${isPending ? "opacity-50" : ""}`}
      >
        <div
          className={`${isUser ? "max-w-[80%] rounded-2xl rounded-br-md bg-white/10 px-4 py-3" : "max-w-[95%] rounded-2xl rounded-bl-md px-4 py-3"}`}
        >
          <div className="text-sm leading-relaxed text-[--text-primary] prose prose-invert prose-sm max-w-none prose-p:my-1 prose-headings:my-2 prose-ul:my-1 prose-ol:my-1 prose-li:my-0 prose-a:text-[--accent] prose-code:text-[--accent] prose-code:bg-white/10 prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-pre:bg-white/5 prose-strong:text-[--text-primary]">
            <Markdown>{content}</Markdown>
            {isStreaming && (
              <span className="animate-blink ml-0.5 inline-block h-4 w-0.5 bg-[--accent]" />
            )}
          </div>
          {/* Rule 6: error state with retry action */}
          {isError && !isUser && (
            <div className="mt-2 flex items-center gap-2">
              <span className="text-xs text-[--error]">Generation failed</span>
              {onRetry && (
                <button
                  onClick={onRetry}
                  className="rounded-md bg-[--error]/10 px-2 py-1 text-xs font-medium text-[--error] transition-colors hover:bg-[--error]/20"
                >
                  Retry
                </button>
              )}
            </div>
          )}
          {!isUser && visibleSources.length > 0 && (
            <div className="mt-3 flex flex-col gap-1.5 sm:flex-row sm:flex-wrap">
              {visibleSources.map((source) => (
                <SourceCard key={source.id} {...source} />
              ))}
              {hiddenCount > 0 && (
                <button
                  onClick={() => setShowAllSources(true)}
                  className="mt-1 text-left text-xs font-medium text-[--accent] hover:underline"
                >
                  +{hiddenCount} more {hiddenCount === 1 ? "source" : "sources"}
                </button>
              )}
            </div>
          )}
        </div>
      </div>
      {showAllSources && sources && (
        <SourcesModal
          sources={sources}
          onClose={() => setShowAllSources(false)}
        />
      )}
    </>
  );
}
