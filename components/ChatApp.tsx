"use client";

import { useState, useCallback, useRef } from "react";
import Header from "./Header";
import HeroBanner from "./HeroBanner";
import MessageList, { type MessageData } from "./MessageList";
import ChatInput, { type ChatInputHandle } from "./ChatInput";
import EmptyState from "./EmptyState";
import ErrorMessage from "./ErrorMessage";
import type { Source } from "./Message";

type AppState = "idle" | "sending" | "streaming" | "error";

const LATEST_VIDEO = {
  title: "i used to want $2k/month. i made $10k a day this month",
  date: "July 11, 2026",
  videoUrl: "https://www.youtube.com/watch?v=ocaSKkM16xU",
  thumbnailUrl: "https://img.youtube.com/vi/ocaSKkM16xU/mqdefault.jpg",
};

const MOCK_RESPONSES: { content: string; sources: Source[] }[] = [
  {
    content:
      "Nick talks a lot about cold email and emphasizes keeping costs low. He recommends using tools like Instantly for sending, Apify for lead scraping, and Million Verifier for validation. The total stack should cost under $200/month. If a client can't afford that, they're probably not worth pursuing — it's a core cost of growth.",
    sources: [
      {
        title: "i used to want $2k/month. i made $10k a day this month",
        date: "July 11, 2026",
        videoUrl: "https://www.youtube.com/watch?v=ocaSKkM16xU",
      },
      {
        title: "success should be easy, actually",
        date: "July 1, 2026",
        videoUrl: "https://www.youtube.com/watch?v=JS6tQZQVZ38",
      },
      {
        title: "daily update - jul 9",
        date: "July 9, 2026",
        videoUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
      },
    ],
  },
  {
    content:
      "According to Nick, you should frame everything in terms of revenue generated or expenses saved. Don't say 'our tool tells you which three numbers matter this week' — say 'our tool will save on average $15 to $20,000 a month by telling you which three numbers matter this week.' One is a feature, the other is a benefit. Think in business owner language.",
    sources: [
      {
        title: "success should be easy, actually",
        date: "July 1, 2026",
        videoUrl: "https://www.youtube.com/watch?v=JS6tQZQVZ38",
      },
      {
        title: "i used to want $2k/month. i made $10k a day this month",
        date: "July 11, 2026",
        videoUrl: "https://www.youtube.com/watch?v=ocaSKkM16xU",
      },
      {
        title: "daily update - jul 5",
        date: "July 5, 2026",
        videoUrl: "https://www.youtube.com/watch?v=abc123",
      },
      {
        title: "daily update - jun 30",
        date: "June 30, 2026",
        videoUrl: "https://www.youtube.com/watch?v=xyz789",
      },
    ],
  },
  {
    content:
      "Nick's biggest advice is to only optimize a process if you're already doing it. He sees too many people building automated systems before sending a single cold email or application. Make a rule: you can only improve what you're actually doing. Otherwise, you're just preparing — not actually doing the work.",
    sources: [
      {
        title: "i used to want $2k/month. i made $10k a day this month",
        date: "July 11, 2026",
        videoUrl: "https://www.youtube.com/watch?v=ocaSKkM16xU",
      },
      {
        title: "success should be easy, actually",
        date: "July 1, 2026",
        videoUrl: "https://www.youtube.com/watch?v=JS6tQZQVZ38",
      },
    ],
  },
  {
    content:
      "Nick recommends starting small to build credibility. Get a few paying clients on platforms like Upwork or Freelancer.com first. Once you have that track record, you can pitch bigger companies. The 15 years of blue-collar experience is actually a gold mine — it's what legitimizes you over some analyst with a master's degree.",
    sources: [
      {
        title: "success should be easy, actually",
        date: "July 1, 2026",
        videoUrl: "https://www.youtube.com/watch?v=JS6tQZQVZ38",
      },
      {
        title: "daily update - jul 3",
        date: "July 3, 2026",
        videoUrl: "https://www.youtube.com/watch?v=def456",
      },
      {
        title: "daily update - jun 28",
        date: "June 28, 2026",
        videoUrl: "https://www.youtube.com/watch?v=ghi789",
      },
    ],
  },
  {
    content:
      "Nick suggests automating anything to do with growth — which is essentially getting more eyeballs on your brand. For e-commerce, he ran a successful campaign using Apify scrapers across Reddit subreddits to find relevant posts, then pre-drafted organic-sounding comments recommending the product. This is basically astroturfing, but done with real people because AI slop comments are now easily detectable.",
    sources: [
      {
        title: "i used to want $2k/month. i made $10k a day this month",
        date: "July 11, 2026",
        videoUrl: "https://www.youtube.com/watch?v=ocaSKkM16xU",
      },
      {
        title: "daily update - jul 8",
        date: "July 8, 2026",
        videoUrl: "https://www.youtube.com/watch?v=jkl012",
      },
    ],
  },
  {
    content:
      "Nick talks about choice architecture — you can change behavior by designing your environment so the things you want to do are easy and the things you don't want to do are hard. For example, he puts his vitamins on the counter instead of in a cabinet, which improved his consistency by 5x. Apply this to business: make outreach easy and make procrastination hard.",
    sources: [
      {
        title: "success should be easy, actually",
        date: "July 1, 2026",
        videoUrl: "https://www.youtube.com/watch?v=JS6tQZQVZ38",
      },
      {
        title: "daily update - jul 4",
        date: "July 4, 2026",
        videoUrl: "https://www.youtube.com/watch?v=mno345",
      },
      {
        title: "daily update - jun 25",
        date: "June 25, 2026",
        videoUrl: "https://www.youtube.com/watch?v=pqr678",
      },
      {
        title: "daily update - jun 20",
        date: "June 20, 2026",
        videoUrl: "https://www.youtube.com/watch?v=stu901",
      },
    ],
  },
];

let messageId = 0;
function nextId() {
  return `msg-${++messageId}`;
}

function getRandomResponse() {
  return MOCK_RESPONSES[Math.floor(Math.random() * MOCK_RESPONSES.length)];
}

export default function ChatApp() {
  const [messages, setMessages] = useState<MessageData[]>([]);
  const [mode, setMode] = useState<"general" | "nick-only">("general");
  const [heroDismissed, setHeroDismissed] = useState(false);
  const [inputValue, setInputValue] = useState("");
  const [appState, setAppState] = useState<AppState>("idle");
  const streamingRef = useRef<NodeJS.Timeout | null>(null);
  const chatInputRef = useRef<ChatInputHandle>(null);

  const handleSend = useCallback(async () => {
    const text = inputValue.trim();
    if (!text || appState === "sending" || appState === "streaming") return;

    if (text === "/wwnd") {
      setMode("nick-only");
      setInputValue("");
      setMessages((prev) => [
        ...prev,
        { id: nextId(), role: "system", content: "Switched to What Will Nick Do mode" },
      ]);
      return;
    }

    const userMsg: MessageData = {
      id: nextId(),
      role: "user",
      content: text,
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputValue("");
    setAppState("sending");

    const mock = getRandomResponse();
    const assistantId = nextId();
    let charIndex = 0;

    await new Promise((r) => setTimeout(r, 600));

    setAppState("streaming");
    setMessages((prev) => [
      ...prev,
      { id: assistantId, role: "assistant", content: "", sources: mock.sources },
    ]);

    streamingRef.current = setInterval(() => {
      charIndex++;
      const partial = mock.content.slice(0, charIndex);
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantId ? { ...m, content: partial } : m
        )
      );

      if (charIndex >= mock.content.length) {
        if (streamingRef.current) clearInterval(streamingRef.current);
        setAppState("idle");
        setTimeout(() => chatInputRef.current?.focus(), 0);
      }
    }, 15);
  }, [inputValue, appState, mode, messages]);

  const handleDismissError = () => setAppState("idle");

  const handleExampleClick = (text: string) => {
    setInputValue(text);
    setTimeout(() => chatInputRef.current?.focus(), 0);
  };

  const handleNewChat = () => {
    if (streamingRef.current) clearInterval(streamingRef.current);
    setMessages([]);
    setInputValue("");
    setHeroDismissed(false);
    setAppState("idle");
  };

  return (
    <div className="flex h-screen flex-col bg-[--bg]">
      <Header onNewChat={handleNewChat} />

      {!heroDismissed && messages.length === 0 && (
        <HeroBanner
          title={LATEST_VIDEO.title}
          date={LATEST_VIDEO.date}
          videoUrl={LATEST_VIDEO.videoUrl}
          thumbnailUrl={LATEST_VIDEO.thumbnailUrl}
          onDismiss={() => setHeroDismissed(true)}
        />
      )}

      {appState === "error" && <ErrorMessage onDismiss={handleDismissError} />}

      {messages.length === 0 ? (
        <EmptyState
          onExampleClick={handleExampleClick}
          showSuggestions={inputValue.length === 0}
        />
      ) : (
        <MessageList messages={messages} isStreaming={appState === "streaming"} />
      )}

      <ChatInput
        ref={chatInputRef}
        value={inputValue}
        onChange={setInputValue}
        onSend={handleSend}
        disabled={appState === "sending" || appState === "streaming"}
        mode={mode}
        inChat={messages.length > 0}
        tokenCount={messages.reduce((acc, m) => acc + Math.ceil(m.content.length / 4), 0)}
        placeholder={
          mode === "nick-only"
            ? "Ask what Nick would do about..."
            : "Ask anything about Nick's content..."
        }
      />
    </div>
  );
}
