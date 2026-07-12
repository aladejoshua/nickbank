"use client";

interface SourceCardProps {
  title: string;
  date: string;
  videoUrl: string;
}

function getVideoId(url: string): string | null {
  const match = url.match(/[?&]v=([^&]+)/);
  return match ? match[1] : null;
}

export default function SourceCard({ title, date, videoUrl }: SourceCardProps) {
  const videoId = getVideoId(videoUrl);

  return (
    <a
      href={videoUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="group flex min-w-0 flex-1 items-center gap-1.5 rounded-lg px-2 py-2 transition-colors hover:bg-[--surface]"
    >
      {videoId ? (
        <img
          src={`https://img.youtube.com/vi/${videoId}/mqdefault.jpg`}
          alt={title}
          className="h-12 w-16 shrink-0 rounded-md object-cover"
        />
      ) : (
        <div className="flex h-12 w-16 shrink-0 items-center justify-center rounded-md bg-[--error]/10">
          <svg className="h-5 w-5 text-[--error]" viewBox="0 0 24 24" fill="currentColor">
            <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
          </svg>
        </div>
      )}
      <div className="h-8 w-px shrink-0 bg-[--border]" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-xs font-medium text-[--text-primary] group-hover:text-[--accent]">
          {title}
        </p>
        <p className="text-[11px] text-[--text-secondary]">{date}</p>
      </div>
      <svg
        className="h-4 w-4 shrink-0 text-[--text-muted] transition-colors group-hover:text-[--accent]"
        fill="none"
        viewBox="0 0 24 24"
        strokeWidth={1.5}
        stroke="currentColor"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M13.5 6H5.25A2.25 2.25 0 0 0 3 8.25v10.5A2.25 2.25 0 0 0 5.25 21h10.5A2.25 2.25 0 0 0 18 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25"
        />
      </svg>
    </a>
  );
}
