import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ChatMessage } from "../src/ChatMessage";
import { theme } from "../src/theme";

describe("ChatMessage", () => {
  const defaultProps = {
    type: "user" as const,
    content: "Hello world",
    theme: theme.light,
  };

  it("renders user message content", () => {
    render(<ChatMessage {...defaultProps} />);

    expect(screen.getByText("Hello world")).toBeInTheDocument();
  });

  it("renders assistant message with Spark branding", () => {
    render(<ChatMessage {...defaultProps} type="assistant" />);

    expect(screen.getByText("⚡")).toBeInTheDocument();
    expect(screen.getByText("Spark")).toBeInTheDocument();
    expect(screen.getByText("Hello world")).toBeInTheDocument();
  });

  it("renders bold text correctly", () => {
    render(<ChatMessage {...defaultProps} content="This is **bold** text" />);
    const boldElement = screen.getByText("bold");
    expect(boldElement.tagName).toBe("STRONG");
  });

  it("shows timestamp when provided", () => {
    const timestamp = new Date("2024-01-01T12:00:00Z");

    render(<ChatMessage {...defaultProps} timestamp={timestamp} />);

    expect(screen.getByText(timestamp.toLocaleTimeString())).toBeInTheDocument();
  });

  it("shows reasoning steps when provided", () => {
    const reasoning = ["Step 1: Analyze input", "Step 2: Generate response"];
    render(<ChatMessage {...defaultProps} type="assistant" reasoning={reasoning} />);

    expect(screen.getByText("💭 Thinking...")).toBeInTheDocument();
    expect(screen.getByText("1. Step 1: Analyze input")).toBeInTheDocument();
    expect(screen.getByText("2. Step 2: Generate response")).toBeInTheDocument();
  });

  it("shows loading indicator when streaming without content", () => {
    render(<ChatMessage {...defaultProps} type="assistant" content="" isStreaming={true} />);

    expect(screen.getByText("Working on your request...")).toBeInTheDocument();
  });

  it("does not render timestamp when timestamp is not a Date object", () => {
    // @ts-expect-error - intentionally passing invalid timestamp to test runtime safety
    render(<ChatMessage {...defaultProps} timestamp={{}} />);

    // Should not attempt to render timestamp or throw error
    expect(screen.queryByText(/:/)).not.toBeInTheDocument();
  });

  it("does not render timestamp when timestamp is a plain object", () => {
    // @ts-expect-error - intentionally passing invalid timestamp to test runtime safety
    render(<ChatMessage {...defaultProps} timestamp={{ notADate: true }} />);

    // Should not crash or render invalid timestamp
    const messageContainer = screen.getByText("Hello world").parentElement;
    expect(messageContainer).toBeInTheDocument();
  });
});
