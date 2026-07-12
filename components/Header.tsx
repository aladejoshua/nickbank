"use client";

interface HeaderProps {
  onNewChat: () => void;
}

export default function Header({ onNewChat }: HeaderProps) {
  return (
    <header className="fixed top-0 left-0 right-0 z-50 flex h-14 items-center justify-between bg-black px-4">
      <div className="flex items-center gap-2">
        <img
          src="/icon.svg"
          alt="Did Nick Answer?"
          className="h-8 w-8 rounded-lg"
        />
        <span className="text-sm font-semibold tracking-tight">
          Did Nick Answer?
        </span>
      </div>

      <button
        onClick={onNewChat}
        className="glass flex h-8 items-center gap-1.5 rounded-lg px-3 text-xs text-[--text-secondary] transition-colors hover:text-[--text-primary]"
        title="New chat"
      >
        <svg
          className="h-3.5 w-3.5"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={1.5}
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M12 4.5v15m7.5-7.5h-15"
          />
        </svg>
        <span className="text-xs">New Chat</span>
      </button>
    </header>
  );
}
