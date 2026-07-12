"use client";

export default function LoadingDots() {
  return (
    <div className="flex items-center gap-1.5 px-4 py-3">
      <span className="loading-dot h-2 w-2 rounded-full bg-[--text-secondary]" />
      <span className="loading-dot h-2 w-2 rounded-full bg-[--text-secondary]" />
      <span className="loading-dot h-2 w-2 rounded-full bg-[--text-secondary]" />
    </div>
  );
}
