"use client";

import { useRef, useEffect, useState, forwardRef, useImperativeHandle } from "react";
import { CornerDownLeft } from "lucide-react";

interface ChatInputProps {
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  disabled?: boolean;
  placeholder?: string;
  mode?: "general" | "nick-only";
  tokenCount?: number;
  inChat?: boolean;
}

export interface ChatInputHandle {
  focus: () => void;
}

const MAX_CHARS = 500;

const commands = [
  {
    command: "/wwnd",
    label: "What Will Nick Do",
    description: "Answer based only on Nick's transcripts",
  },
];

function DisclaimerModal({ onClose }: { onClose: () => void }) {
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
            Disclaimer
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
        <div className="space-y-3 text-sm leading-relaxed text-[--text-secondary]">
          <p>
            This is an AI chatbot that attempts to answer questions based on Nick&apos;s daily update transcripts. We do not own the underlying knowledge base or content.
          </p>
          <p>
            This tool uses AI to retrieve and summarize information from publicly available YouTube transcripts. Like all AI systems, it can make mistakes, misinterpret content, or produce inaccurate answers. Nothing produced by this tool should be taken as direct advice from Nick.
          </p>
          <p>
            The responses generated here are not from Nick himself. We are simply answering to the best of our ability based on his publicly available content. Nick is not affiliated with, endorsing, or legally bound to any answers produced by this tool.
          </p>
          <p>
            If Nick hasn&apos;t addressed a question in his transcripts, the bot will attempt to say so — but it may not always be correct.
          </p>
        </div>
      </div>
    </div>
  );
}

const ChatInput = forwardRef<ChatInputHandle, ChatInputProps>(
  function ChatInput({ value, onChange, onSend, disabled, placeholder = "Ask anything about Nick's content...", mode = "general", tokenCount = 0, inChat = false }, ref) {
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const [showCommands, setShowCommands] = useState(false);
    const [filteredCommands, setFilteredCommands] = useState(commands);
    const [selectedIndex, setSelectedIndex] = useState(0);
    const [showDisclaimer, setShowDisclaimer] = useState(false);

    useImperativeHandle(ref, () => ({
      focus: () => textareaRef.current?.focus(),
    }));

    useEffect(() => {
      if (textareaRef.current) {
        textareaRef.current.style.height = "auto";
        textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 96)}px`;
      }
    }, [value]);

    useEffect(() => {
    if (!inChat && value === "/") {
      setShowCommands(true);
      setFilteredCommands(commands);
      setSelectedIndex(0);
    } else if (!inChat && value.startsWith("/")) {
      const query = value.toLowerCase();
      const filtered = commands.filter((c) => c.command.startsWith(query));
      setFilteredCommands(filtered);
      setShowCommands(filtered.length > 0);
      setSelectedIndex(0);
    } else {
      setShowCommands(false);
    }
    }, [value]);

    const handleCommandSelect = (command: string) => {
      onChange(command);
      setShowCommands(false);
      textareaRef.current?.focus();
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
      if (showCommands && filteredCommands.length > 0) {
        if (e.key === "ArrowDown") {
          e.preventDefault();
          setSelectedIndex((i) => (i + 1) % filteredCommands.length);
          return;
        }
        if (e.key === "ArrowUp") {
          e.preventDefault();
          setSelectedIndex((i) => (i - 1 + filteredCommands.length) % filteredCommands.length);
          return;
        }
        if (e.key === "Enter" && !e.shiftKey) {
          e.preventDefault();
          handleCommandSelect(filteredCommands[selectedIndex].command);
          return;
        }
        if (e.key === "Escape") {
          e.preventDefault();
          setShowCommands(false);
          return;
        }
      }

      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        if (value.trim() && !disabled) {
          onSend();
        }
      }
    };

    const canSend = value.trim().length > 0 && !disabled;

    return (
      <>
        <div className="fixed bottom-0 left-0 right-0 z-50 bg-gradient-to-t from-black via-black to-black/0 pt-6 pb-4">
          <div className="mx-auto max-w-2xl px-4">
            {showCommands && filteredCommands.length > 0 && (
              <div className="glass-strong mb-2 w-fit overflow-hidden rounded-xl bg-[#111] ring-1 ring-[--border]">
                {filteredCommands.map((cmd, i) => (
                  <button
                    key={cmd.command}
                    onClick={() => handleCommandSelect(cmd.command)}
                    className={`flex w-full items-center px-3 py-2 text-left transition-colors ${
                      i === selectedIndex
                        ? "bg-[--surface-hover]"
                        : "hover:bg-[--surface-hover]"
                    }`}
                  >
                    <span className="font-mono text-sm text-[--text-primary]">
                      {cmd.command}
                    </span>
                  </button>
                ))}
              </div>
            )}
            <div
              className={`overflow-hidden rounded-2xl bg-[#111] ring-1 ring-[--border] transition-all focus-within:border-[--border-strong] focus-within:shadow-[0_0_0_1px_var(--accent-glow)]`}
            >
              {(mode === "nick-only" || !inChat) && (
                <div className="flex items-center gap-2 px-4 py-2">
                  {mode === "nick-only" ? (
                    <p className="text-[11px] text-[--accent]">
                      Strict mode — only what Nick said in transcripts
                    </p>
                  ) : (
                    <p className="text-[11px] text-[--text-muted]">
                      Type <span className="font-mono text-[--text-secondary]">/</span> for commands
                    </p>
                  )}
                </div>
              )}
              <div className="flex items-end gap-2 px-4 py-2">
                <textarea
                  ref={textareaRef}
                  value={value}
                  onChange={(e) => {
                    if (e.target.value.length <= MAX_CHARS) {
                      onChange(e.target.value);
                    }
                  }}
                  onKeyDown={handleKeyDown}
                  disabled={disabled}
                  placeholder={placeholder}
                  rows={1}
                  className="no-scrollbar max-h-24 min-h-[24px] flex-1 resize-none bg-transparent py-0.5 text-sm leading-relaxed text-[--text-primary] placeholder:text-[--text-muted] focus:outline-none"
                />
                <button
                  onClick={onSend}
                  disabled={!canSend}
                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl transition-all duration-150 ${
                    canSend
                      ? "bg-[--accent] text-white shadow-lg shadow-[--accent]/20 hover:bg-[--accent-hover] hover:shadow-[--accent]/30 active:scale-95"
                      : "bg-[--surface] text-[--text-muted]"
                  }`}
                  aria-label="Send message"
                >
                  <CornerDownLeft className="h-4 w-4" />
                </button>
              </div>
            </div>
            <div className="mt-2 flex items-center justify-between px-1">
              <button
                onClick={() => setShowDisclaimer(true)}
                className="text-[11px] text-[--text-muted] hover:text-[--text-secondary] transition-colors underline underline-offset-2"
              >
                AI-powered — not affiliated with Nick
              </button>
              <p className="text-[11px] text-[--text-muted]">
                {tokenCount >= 1000000
                  ? `${(tokenCount / 1000000).toFixed(1)}M`
                  : tokenCount >= 1000
                    ? `${(tokenCount / 1000).toFixed(1)}K`
                    : tokenCount} / 1M tokens
              </p>
              {value.length > MAX_CHARS * 0.8 && (
                <p
                  className={`text-[11px] ${
                    value.length >= MAX_CHARS
                      ? "text-[--error]"
                      : "text-[--text-muted]"
                  }`}
                >
                  {value.length}/{MAX_CHARS}
                </p>
              )}
            </div>
          </div>
        </div>
        {showDisclaimer && <DisclaimerModal onClose={() => setShowDisclaimer(false)} />}
      </>
    );
  }
);

export default ChatInput;
