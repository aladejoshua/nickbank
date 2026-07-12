"use client";

import { useState, useEffect } from "react";

const words = ["Thinking", "Searching transcripts", "Analyzing", "Composing"];

export default function ThinkingIndicator() {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setIndex((i) => (i + 1) % words.length);
    }, 1800);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="animate-fade-in-up flex px-4 transition-opacity duration-300 justify-start">
      <div className="max-w-[95%] rounded-2xl rounded-bl-md px-4 py-3">
        <div className="relative h-[1.25rem] overflow-hidden">
          {words.map((word) => (
            <span
              key={word}
              className="shimmer-text block text-sm"
              style={{ visibility: "hidden", whiteSpace: "nowrap" }}
            >
              {word}
            </span>
          ))}
          <span
            className="shimmer-word shimmer-text absolute top-0 left-0 text-sm"
            style={{ whiteSpace: "nowrap" }}
          >
            {words[index]}
          </span>
        </div>
      </div>
    </div>
  );
}
