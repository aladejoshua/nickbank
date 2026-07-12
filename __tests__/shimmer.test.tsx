import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, act } from "@testing-library/react";
import "@testing-library/jest-dom";

Element.prototype.scrollIntoView = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), back: vi.fn() }),
  usePathname: () => "/",
}));

vi.mock("convex/react", () => ({
  useQuery: () => undefined,
  useMutation: () => vi.fn(),
  ConvexProvider: ({ children }: { children: React.ReactNode }) => children,
}));

import MessageList from "../components/MessageList";
import ThinkingIndicator from "../components/ThinkingIndicator";
import type { MessageData } from "../components/MessageList";

function getVisibleWord(): string | null {
  const el = document.querySelector(".shimmer-word.shimmer-text");
  return el?.textContent ?? null;
}

beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
});

describe("ThinkingIndicator", () => {
  it("renders the first word on mount", () => {
    render(<ThinkingIndicator />);
    expect(getVisibleWord()).toBe("Thinking");
  });

  it("cycles to the next word after 1800ms", () => {
    render(<ThinkingIndicator />);
    act(() => {
      vi.advanceTimersByTime(1800);
    });
    expect(getVisibleWord()).toBe("Searching transcripts");
  });

  it("cycles through all words", () => {
    render(<ThinkingIndicator />);
    const words = ["Thinking", "Searching transcripts", "Analyzing", "Composing"];
    for (let i = 0; i < words.length; i++) {
      act(() => {
        vi.advanceTimersByTime(1800);
      });
      expect(getVisibleWord()).toBe(words[(i + 1) % words.length]);
    }
  });
});

describe("MessageList shimmer behavior", () => {
  const userMsg: MessageData = {
    id: "u1",
    role: "user",
    content: "Hello",
    sources: [],
  };

  const assistantMsgEmpty: MessageData = {
    id: "a1",
    role: "assistant",
    content: "",
    sources: [],
  };

  const assistantMsgWithContent: MessageData = {
    id: "a1",
    role: "assistant",
    content: "Hi there!",
    sources: [],
  };

  it("shows ThinkingIndicator when isWaiting and no assistant message", () => {
    render(
      <MessageList messages={[userMsg]} isStreaming={false} isWaiting={true} />
    );
    expect(getVisibleWord()).toBe("Thinking");
  });

  it("hides ThinkingIndicator when assistant message has content", () => {
    render(
      <MessageList
        messages={[userMsg, assistantMsgWithContent]}
        isStreaming={true}
        isWaiting={true}
      />
    );
    expect(document.querySelector(".shimmer-word")).not.toBeInTheDocument();
  });

  it("shows ThinkingIndicator when assistant message is empty", () => {
    render(
      <MessageList
        messages={[userMsg, assistantMsgEmpty]}
        isStreaming={false}
        isWaiting={true}
      />
    );
    expect(getVisibleWord()).toBe("Thinking");
  });

  it("hides ThinkingIndicator when not waiting", () => {
    render(
      <MessageList messages={[userMsg]} isStreaming={false} isWaiting={false} />
    );
    expect(document.querySelector(".shimmer-word")).not.toBeInTheDocument();
  });

  it("does not show ThinkingIndicator simultaneously with assistant message that has content", () => {
    render(
      <MessageList
        messages={[userMsg, assistantMsgWithContent]}
        isStreaming={true}
        isWaiting={true}
      />
    );
    expect(document.querySelectorAll(".shimmer-word").length).toBe(0);
  });

  it("ThinkingIndicator does not shift down when assistant message arrives", () => {
    const { rerender } = render(
      <MessageList messages={[userMsg]} isStreaming={false} isWaiting={true} />
    );

    expect(getVisibleWord()).toBe("Thinking");

    rerender(
      <MessageList
        messages={[userMsg, assistantMsgWithContent]}
        isStreaming={true}
        isWaiting={true}
      />
    );

    expect(document.querySelector(".shimmer-word")).not.toBeInTheDocument();
    expect(screen.getByText("Hi there!")).toBeInTheDocument();
  });

  it("only last assistant message gets isStreaming prop", () => {
    const msgs: MessageData[] = [
      userMsg,
      { id: "a1", role: "assistant", content: "First response", sources: [] },
      { id: "u2", role: "user", content: "Second question", sources: [] },
      { id: "a2", role: "assistant", content: "Second ", sources: [] },
    ];

    const { container } = render(
      <MessageList messages={msgs} isStreaming={true} isWaiting={false} />
    );

    const blinkCursors = container.querySelectorAll(".animate-blink");
    expect(blinkCursors).toHaveLength(1);
  });
});
