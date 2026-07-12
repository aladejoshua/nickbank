"use client";

interface ModeToggleProps {
  mode: "general" | "nick-only";
  onToggle: () => void;
}

export default function ModeToggle({ mode, onToggle }: ModeToggleProps) {
  return (
    <div className="flex flex-col items-center gap-1">
      <button
        onClick={onToggle}
        className="glass relative flex h-9 w-72 items-center rounded-full p-1"
        role="switch"
        aria-checked={mode === "nick-only"}
      >
        <span
          className="absolute h-7 w-[140px] rounded-full bg-[--accent]/20 transition-all duration-200"
          style={{
            left: mode === "nick-only" ? "140px" : "4px",
          }}
        />
        <span
          className={`relative z-10 flex-1 text-center text-xs font-medium transition-colors duration-200 ${
            mode === "general" ? "text-[--accent]" : "text-[--text-muted]"
          }`}
        >
          General Q&amp;A
        </span>
        <span
          className={`relative z-10 flex-1 text-center text-xs font-medium transition-colors duration-200 ${
            mode === "nick-only" ? "text-[--accent]" : "text-[--text-muted]"
          }`}
        >
          What Will Nick Do?
        </span>
      </button>
      {mode === "nick-only" && (
        <p className="text-[11px] text-[--text-secondary]">
          Answers based only on Nick&apos;s transcripts
        </p>
      )}
    </div>
  );
}
