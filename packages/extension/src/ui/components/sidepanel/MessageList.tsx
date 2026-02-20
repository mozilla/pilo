import { type ReactElement, type ReactNode, createElement } from "react";
import Markdown, { type ReactRenderer } from "marked-react";

import { cn } from "../../../lib/utils";
import { useAutoScroll } from "../../hooks/useAutoScroll";
import type { ChatMessage } from "../../hooks/useConversation";

// ---------------------------------------------------------------------------
// chatRenderer — custom marked-react renderer for the sidebar design language
// ---------------------------------------------------------------------------

/**
 * Custom renderer object passed to marked-react's <Markdown renderer={...} />.
 *
 * Methods are called with `this` bound to the internal ReactRenderer instance,
 * so `this.elementId` is always available for React key assignment. The library
 * increments the element id counter before invoking each method, so every call
 * produces a unique key automatically.
 *
 * Design tokens used here intentionally mirror the sidebar's established
 * conventions: Geist sans/mono fonts, text-[13px] body copy, CSS variable
 * color references, and tight-but-readable spacing.
 */
const chatRenderer: Partial<ReactRenderer> = {
  // Headings — keep them modest inside the narrow sidebar
  heading(this: ReactRenderer, children: ReactNode, level: 1 | 2 | 3 | 4 | 5 | 6): ReactElement {
    const sizeClass = level <= 2 ? "text-sm font-semibold" : "text-xs font-semibold";
    return createElement(
      `h${level}`,
      { key: this.elementId, className: `${sizeClass} text-foreground mt-3 mb-1` },
      children,
    );
  },

  // Paragraph
  paragraph(this: ReactRenderer, children: ReactNode): ReactElement {
    return createElement(
      "p",
      { key: this.elementId, className: "text-[13px] leading-relaxed text-foreground my-1.5" },
      children,
    );
  },

  // Fenced code block (pre > code)
  code(this: ReactRenderer, code: ReactNode, _lang: string | undefined): ReactElement {
    return createElement(
      "pre",
      {
        key: this.elementId,
        className:
          "bg-secondary/50 rounded-md p-3 text-xs font-mono overflow-x-auto my-2 border border-border/50",
      },
      createElement("code", null, code),
    );
  },

  // Inline code
  codespan(this: ReactRenderer, code: ReactNode): ReactElement {
    return createElement(
      "code",
      {
        key: this.elementId,
        className: "bg-secondary/50 rounded px-1.5 py-0.5 text-xs font-mono",
      },
      code,
    );
  },

  // Unordered / ordered lists
  list(
    this: ReactRenderer,
    children: ReactNode,
    ordered: boolean,
    start: number | undefined,
  ): ReactElement {
    const tag = ordered ? "ol" : "ul";
    const markerClass = ordered ? "list-decimal" : "list-disc";
    return createElement(
      tag,
      {
        key: this.elementId,
        className: `${markerClass} text-[13px] leading-relaxed my-1.5 pl-5 space-y-1`,
        ...(ordered && start !== undefined && start !== 1 ? { start } : {}),
      },
      children,
    );
  },

  // List items
  listItem(this: ReactRenderer, children: ReactNode[]): ReactElement {
    return createElement(
      "li",
      { key: this.elementId, className: "text-[13px] text-foreground" },
      children,
    );
  },

  // Links
  link(this: ReactRenderer, href: string, text: ReactNode): ReactElement {
    return createElement(
      "a",
      {
        key: this.elementId,
        href,
        target: "_blank",
        rel: "noopener noreferrer",
        className:
          "text-primary underline underline-offset-2 hover:text-primary/80 transition-colors",
      },
      text,
    );
  },

  // Blockquote
  blockquote(this: ReactRenderer, children: ReactNode): ReactElement {
    return createElement(
      "blockquote",
      {
        key: this.elementId,
        className:
          "border-l-2 border-primary/30 pl-3 my-2 text-muted-foreground italic text-[13px]",
      },
      children,
    );
  },

  // Strong / bold
  strong(this: ReactRenderer, children: ReactNode): ReactElement {
    return createElement(
      "strong",
      { key: this.elementId, className: "font-semibold text-foreground" },
      children,
    );
  },

  // Emphasis / italic
  em(this: ReactRenderer, children: ReactNode): ReactElement {
    return createElement("em", { key: this.elementId, className: "italic" }, children);
  },

  // Horizontal rule
  hr(this: ReactRenderer): ReactElement {
    return createElement("hr", { key: this.elementId, className: "border-border my-3" });
  },

  // Table container
  table(this: ReactRenderer, children: ReactNode[]): ReactElement {
    return createElement(
      "div",
      { key: this.elementId, className: "overflow-x-auto my-2" },
      createElement(
        "table",
        { className: "w-full text-xs border-collapse border border-border" },
        children,
      ),
    );
  },

  // Table header section (<thead>)
  tableHeader(this: ReactRenderer, children: ReactNode): ReactElement {
    return createElement("thead", { key: this.elementId, className: "bg-secondary/50" }, children);
  },

  // Table body section (<tbody>)
  tableBody(this: ReactRenderer, children: ReactNode[]): ReactElement {
    return createElement("tbody", { key: this.elementId }, children);
  },

  // Table row
  tableRow(this: ReactRenderer, children: ReactNode[]): ReactElement {
    return createElement(
      "tr",
      { key: this.elementId, className: "border-b border-border" },
      children,
    );
  },

  // Table cell (th or td)
  tableCell(
    this: ReactRenderer,
    children: ReactNode[],
    flags: { header?: boolean; align?: "center" | "left" | "right" | null },
  ): ReactElement {
    const tag = flags.header ? "th" : "td";
    const alignClass =
      flags.align === "center"
        ? "text-center"
        : flags.align === "right"
          ? "text-right"
          : "text-left";
    return createElement(
      tag,
      {
        key: this.elementId,
        className: `px-2 py-1.5 border border-border ${alignClass} ${flags.header ? "font-semibold text-foreground" : "text-foreground/90"}`,
      },
      children,
    );
  },
};

// ---------------------------------------------------------------------------
// MarkdownContent
// ---------------------------------------------------------------------------

interface MarkdownContentProps {
  children: string;
  className?: string;
}

/**
 * Renders markdown with marked-react using the custom `chatRenderer`.
 *
 * The renderer handles all element styling directly, so we no longer need
 * Tailwind Typography's `prose` / `prose-chat` utility classes here.
 * `markdown-content` is kept so the CSS list-style restoration rules in
 * SidePanel.css still apply as a safety net.
 */
const MarkdownContent = ({ children, className }: MarkdownContentProps): ReactElement => (
  <div className={cn("markdown-content", "max-w-none", className)}>
    <Markdown value={children} breaks gfm renderer={chatRenderer} />
  </div>
);

// ---------------------------------------------------------------------------
// LoadingSpinner
// ---------------------------------------------------------------------------

const LoadingSpinner = (): ReactElement => (
  <svg className="animate-spin text-primary h-4 w-4" fill="none" viewBox="0 0 24 24">
    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
    <path
      className="opacity-75"
      fill="currentColor"
      d="M4 12a8 8 0 0 1 8-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 0 1 4 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
    />
  </svg>
);

// ---------------------------------------------------------------------------
// TaskMessage
// ---------------------------------------------------------------------------

interface TaskMessageProps {
  message: ChatMessage;
}

const TaskMessage = ({ message }: TaskMessageProps): ReactElement => {
  const getClassName = () => {
    switch (message.type) {
      case "plan":
        return "text-message-assistant text-muted-foreground text-xs";
      case "reasoning":
        return "text-message-assistant text-muted-foreground";
      case "error":
        return "text-message-assistant text-red-600 dark:text-red-400 p-2 bg-red-50 dark:bg-red-950/50 rounded border border-red-200 dark:border-red-800";
      case "result":
        return "text-message-assistant text-sm";
      default:
        return "text-message-assistant";
    }
  };

  return <MarkdownContent className={getClassName()}>{message.content}</MarkdownContent>;
};

// ---------------------------------------------------------------------------
// TaskBubble
// ---------------------------------------------------------------------------

interface TaskBubbleProps {
  taskId: string;
  messages: ChatMessage[];
  currentTaskId: string | null;
}

const TaskBubble = ({ taskId, messages, currentTaskId }: TaskBubbleProps): ReactElement => {
  const taskMessages = messages.filter((msg) => msg.taskId === taskId && msg.type !== "status");
  const statusMessages = messages.filter((msg) => msg.taskId === taskId && msg.type === "status");
  const latestStatus = statusMessages.length > 0 ? statusMessages[statusMessages.length - 1] : null;
  const resultMessage = taskMessages.find((msg) => msg.type === "result");
  const isActive = currentTaskId === taskId;
  // Show spinner when only status messages exist (before any task messages arrive),
  // such as during the initial planning phase.
  const isEarlyPhase = taskMessages.length === 0 && latestStatus !== null;

  if (taskMessages.length === 0 && !latestStatus) return <></>;

  // Track which section headings we've shown
  const seenTypes = new Set<string>();

  const getHeading = (type: string): { emoji: string; label: string } | null => {
    if (seenTypes.has(type)) return null;
    seenTypes.add(type);

    switch (type) {
      case "plan":
        return { emoji: "📋", label: "Plan" };
      case "reasoning":
        return { emoji: "💭", label: "Actions" };
      case "result":
        return { emoji: "✨", label: "Answer" };
      default:
        return null;
    }
  };

  return (
    <div className="px-4 py-3">
      {/* Render messages chronologically with dynamic headings */}
      <div className="flex flex-col gap-6">
        {taskMessages.map((msg) => {
          const heading = getHeading(msg.type);
          return (
            <div key={msg.id}>
              {heading && (
                <div className="flex items-center gap-2 border-b border-border pb-2 mb-2">
                  <span className="text-sm">{heading.emoji}</span>
                  <span className="text-sm font-medium text-foreground">{heading.label}</span>
                </div>
              )}
              <TaskMessage message={msg} />
            </div>
          );
        })}
      </div>

      {/* Current status for active tasks or early phase status-only tasks */}
      {!resultMessage && (isActive || isEarlyPhase) && (
        <div className="flex items-center gap-2 text-sm mt-2">
          <LoadingSpinner />
          <span className="text-primary">
            {latestStatus ? latestStatus.content : "Starting task..."}
          </span>
        </div>
      )}
    </div>
  );
};

// ---------------------------------------------------------------------------
// TypingIndicator
// ---------------------------------------------------------------------------

const TypingIndicator = (): ReactElement => (
  <div className="flex items-center gap-1 px-4 py-3">
    <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground [animation-delay:0ms]" />
    <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground [animation-delay:150ms]" />
    <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground [animation-delay:300ms]" />
  </div>
);

// ---------------------------------------------------------------------------
// EmptyState
// ---------------------------------------------------------------------------

const EmptyState = (): ReactElement => (
  <div
    className="flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center h-full"
    data-testid="welcome-message"
  >
    <div>
      <p className="text-sm font-medium text-foreground">What can I help with?</p>
      <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
        Enter an instruction and the agent will respond.
      </p>
    </div>
  </div>
);

// ---------------------------------------------------------------------------
// UserMessageBubble
// ---------------------------------------------------------------------------

interface UserMessageBubbleProps {
  message: ChatMessage;
}

const UserMessageBubble = ({ message }: UserMessageBubbleProps): ReactElement => (
  <div className="border border-border bg-secondary/40 rounded-lg px-3 py-2.5">
    <p className="text-[13px] leading-relaxed text-foreground whitespace-pre-wrap break-words">
      {message.content}
    </p>
    <p className="mt-1 text-[10px] text-muted-foreground">
      {message.timestamp.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
    </p>
  </div>
);

// ---------------------------------------------------------------------------
// SystemMessageBubble
// ---------------------------------------------------------------------------

const SystemMessageBubble = ({ message }: UserMessageBubbleProps): ReactElement => (
  <div className="px-4 py-2">
    <p className="text-xs text-muted-foreground text-center">{message.content}</p>
  </div>
);

// ---------------------------------------------------------------------------
// MessageList (public export)
// ---------------------------------------------------------------------------

export interface MessageListProps {
  messages: ChatMessage[];
  currentTaskId: string | null;
  isExecuting: boolean;
  tabId?: number;
}

/**
 * Renders the scrollable message area for the sidepanel chat.
 *
 * Message grouping rules (same as original ChatView.renderMessages):
 * - user / system messages render directly as their own rows
 * - task-related messages (plan, reasoning, result, error, status) are grouped
 *   into a single TaskBubble per taskId, rendered at first occurrence
 *
 * The TypingIndicator appears when `isExecuting` is true and there is no active
 * TaskBubble yet (i.e., the task has started but no events have been received).
 */
export function MessageList({
  messages,
  currentTaskId,
  isExecuting,
  tabId,
}: MessageListProps): ReactElement {
  const { messagesEndRef, scrollContainerRef, handleScroll } = useAutoScroll(messages, tabId);

  if (messages.length === 0 && !isExecuting) {
    return <EmptyState />;
  }

  /**
   * Build ordered list of elements — same algorithm as the original
   * ChatView.renderMessages(), but without theme object dependencies.
   */
  const renderMessages = () => {
    const renderedTaskIds = new Set<string>();
    const elements: ReactElement[] = [];

    messages.forEach((message) => {
      if (message.type === "user") {
        elements.push(
          <div key={message.id} className="p-3">
            <UserMessageBubble message={message} />
          </div>,
        );
      } else if (message.type === "system") {
        elements.push(<SystemMessageBubble key={message.id} message={message} />);
      } else if (message.taskId && !renderedTaskIds.has(message.taskId)) {
        // First occurrence of this taskId — render the whole TaskBubble
        renderedTaskIds.add(message.taskId);
        elements.push(
          <TaskBubble
            key={message.taskId}
            taskId={message.taskId}
            messages={messages}
            currentTaskId={currentTaskId}
          />,
        );
      }
    });

    return elements;
  };

  // Show typing indicator when executing but no task messages yet (early phase
  // before any task:started event arrives and populates the TaskBubble).
  const hasActiveTaskMessages =
    currentTaskId !== null && messages.some((msg) => msg.taskId === currentTaskId);

  return (
    <div
      ref={scrollContainerRef}
      onScroll={handleScroll}
      className="flex-1 min-h-0 overflow-y-auto flex flex-col divide-y divide-border/50"
    >
      {renderMessages()}
      {isExecuting && !hasActiveTaskMessages && <TypingIndicator />}
      <div ref={messagesEndRef} />
    </div>
  );
}
