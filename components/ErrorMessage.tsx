"use client";

interface ErrorMessageProps {
  message?: string;
  onDismiss: () => void;
}

export default function ErrorMessage({
  message = "Something went wrong. Please try again.",
  onDismiss,
}: ErrorMessageProps) {
  return (
    <div className="animate-slide-in-top pointer-events-none absolute inset-x-0 top-16 z-40 mx-auto w-fit px-4">
      <div className="pointer-events-auto flex items-center gap-3 rounded-xl bg-[#1a1a1a] px-4 py-3 shadow-lg ring-1 ring-[--error]/20">
        <svg
          className="h-5 w-5 shrink-0 text-[--error]"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={1.5}
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z"
          />
        </svg>
        <p className="flex-1 text-sm text-[--text-primary]">{message}</p>
        <button
          onClick={onDismiss}
          className="shrink-0 rounded-md p-1 text-[--text-secondary] transition-colors hover:text-[--text-primary]"
        >
          <svg
            className="h-4 w-4"
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
    </div>
  );
}
