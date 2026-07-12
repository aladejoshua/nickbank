"use client";

interface EmptyStateProps {
  onExampleClick: (text: string) => void;
  showSuggestions: boolean;
}

const examples = [
  "What does Nick think about cold email?",
  "How does Nick approach client pricing?",
  "What tools does Nick recommend?",
];

export default function EmptyState({ onExampleClick, showSuggestions }: EmptyStateProps) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center px-4 pt-16 pb-40">
      <img
        src="/icon.svg"
        alt=""
        className="h-16 w-16 rounded-2xl"
      />
      <h2 className="mt-6 text-center text-lg font-semibold text-[--text-primary]">
        Ask me anything about Nick&apos;s daily updates
      </h2>
      <p className="mt-2 max-w-sm text-center text-sm text-[--text-secondary]">
        I&apos;ll answer based on his transcripts and cite the exact source.
      </p>
      {showSuggestions && (
        <div className="mt-8 flex flex-wrap justify-center gap-2">
          {examples.map((example) => (
            <button
              key={example}
              onClick={() => onExampleClick(example)}
              className="glass rounded-full px-4 py-2 text-sm text-[--text-secondary] transition-all hover:bg-[--surface-hover] hover:text-[--text-primary]"
            >
              {example}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
