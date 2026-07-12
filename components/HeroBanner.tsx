"use client";

import Image from "next/image";

interface HeroBannerProps {
  title: string;
  date: string;
  videoUrl: string;
  thumbnailUrl: string;
  onDismiss: () => void;
}

export default function HeroBanner({
  title,
  date,
  videoUrl,
  thumbnailUrl,
  onDismiss,
}: HeroBannerProps) {
  return (
    <div className="animate-fade-in-up mx-auto max-w-2xl px-4 pt-20 pb-4">
      <div className="glass-strong relative overflow-hidden rounded-xl p-4">
        <button
          onClick={onDismiss}
          className="absolute right-3 top-3 z-10 rounded-md p-1 text-[--text-muted] transition-colors hover:text-[--text-primary]"
          aria-label="Dismiss"
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
        <div className="flex gap-4">
          <Image
            src={thumbnailUrl}
            alt={title}
            width={160}
            height={96}
            loader={({ src }) => src}
            unoptimized
            className="h-20 w-36 shrink-0 rounded-lg object-cover sm:h-24 sm:w-40"
          />
          <div className="flex min-w-0 flex-col justify-center">
            <p className="text-xs text-[--text-secondary]">{date}</p>
            <h3 className="mt-1 line-clamp-2 text-sm font-medium text-[--text-primary]">
              {title}
            </h3>
            <a
              href={videoUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-[--accent] hover:underline"
            >
              Watch on YouTube
              <svg
                className="h-3 w-3"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={2}
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M13.5 6H5.25A2.25 2.25 0 0 0 3 8.25v10.5A2.25 2.25 0 0 0 5.25 21h10.5A2.25 2.25 0 0 0 18 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25"
                />
              </svg>
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
