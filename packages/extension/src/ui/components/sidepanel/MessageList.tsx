import { type ReactElement } from "react";
import Markdown from "marked-react";
import { Bot, User } from "lucide-react";
import { cn } from "../../../lib/utils";
import { useAutoScroll } from "../../hooks/useAutoScroll";
import type { ChatMessage } from "../../hooks/useConversation";

// ---------------------------------------------------------------------------
// MarkdownContent
// ---------------------------------------------------------------------------

interface MarkdownContentProps {
  children: string;
  className?: string;
}

/**
 * Renders markdown with marked-react. Uses the `prose-chat` utility class for
 * typography tokens that are preserved from the original CSS foundation.
 */
const MarkdownContent = ({ children, className }: MarkdownContentProps): ReactElement => (
  <div className={cn("markdown-content", "prose", "prose-chat", "max-w-none", className)}>
    <Markdown value={children} breaks gfm />
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
// TaskCompletionSeparator
// ---------------------------------------------------------------------------

const TaskCompletionSeparator = (): ReactElement => (
  <div className="my-8 flex items-center px-4">
    <div className="flex-1 border-t-2 border-border/50" />
  </div>
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

  return (
    <div className="mb-2">
      <MarkdownContent className={getClassName()}>{message.content}</MarkdownContent>
    </div>
  );
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

  const hasPlan = taskMessages.some((msg) => msg.type === "plan");

  // Track which section headings we've shown
  const seenTypes = new Set<string>();

  const getHeading = (type: string) => {
    if (seenTypes.has(type)) return null;
    seenTypes.add(type);

    switch (type) {
      case "plan":
        return "📋 Plan:";
      case "reasoning":
        return "💭 Actions:";
      case "result":
        return "✨ Answer:";
      default:
        return null;
    }
  };

  return (
    <div className="flex items-start gap-3 px-4 py-3">
      {/* Bot avatar */}
      <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-primary/15 text-primary">
        <Bot className="h-3.5 w-3.5" />
      </div>

      {/* Task content */}
      <div
        className={cn(
          "min-w-0 flex-1 rounded-lg border border-border px-4 py-2",
          hasPlan ? "w-full" : "max-w-xs lg:max-w-md",
          "bg-secondary text-foreground",
        )}
      >
        {/* Render messages chronologically with dynamic headings */}
        {taskMessages.map((msg) => {
          const heading = getHeading(msg.type);
          return (
            <div key={msg.id}>
              {heading && (
                <div className="text-sm font-semibold text-primary mb-2 mt-3 first:mt-0">
                  {heading}
                </div>
              )}
              <TaskMessage message={msg} />
            </div>
          );
        })}

        {/* Current status for active tasks or early phase status-only tasks */}
        {!resultMessage && (isActive || isEarlyPhase) && (
          <div className="flex items-center gap-2 text-sm mt-2">
            <LoadingSpinner />
            <span className="text-primary">
              {latestStatus ? latestStatus.content : "Starting task..."}
            </span>
          </div>
        )}

        {/* Timestamp for completed tasks */}
        {resultMessage && (
          <div className="text-xs text-muted-foreground mt-1">
            {resultMessage.timestamp.toLocaleTimeString()}
          </div>
        )}
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// TypingIndicator
// ---------------------------------------------------------------------------

const TypingIndicator = (): ReactElement => (
  <div className="flex items-start gap-3 px-4 py-3">
    <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-primary/15 text-primary">
      <Bot className="h-3.5 w-3.5" />
    </div>
    <div className="flex items-center gap-1 pt-1">
      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground [animation-delay:0ms]" />
      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground [animation-delay:150ms]" />
      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground [animation-delay:300ms]" />
    </div>
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
    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
      <Bot className="h-5 w-5 text-primary" />
    </div>
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
  <div className="flex items-start gap-3 px-4 py-3">
    <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-secondary text-secondary-foreground">
      <User className="h-3.5 w-3.5" />
    </div>
    <div className="min-w-0 flex-1 pt-0.5">
      <p className="text-[13px] leading-relaxed text-foreground whitespace-pre-wrap break-words">
        {message.content}
      </p>
      <p className="mt-1 text-[10px] text-muted-foreground">
        {message.timestamp.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
      </p>
    </div>
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
 * - A TaskCompletionSeparator is inserted after each completed (non-active) task
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
   * Determines whether the task associated with taskId has a result message.
   */
  const isTaskCompleted = (taskId: string): boolean =>
    messages.some((msg) => msg.taskId === taskId && msg.type === "result");

  /**
   * Build ordered list of elements — same algorithm as the original
   * ChatView.renderMessages(), but without theme object dependencies.
   */
  const renderMessages = () => {
    const renderedTaskIds = new Set<string>();
    const elements: ReactElement[] = [];

    messages.forEach((message) => {
      if (message.type === "user") {
        elements.push(<UserMessageBubble key={message.id} message={message} />);
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

        // Separator after completed tasks that are no longer active
        if (isTaskCompleted(message.taskId) && currentTaskId !== message.taskId) {
          elements.push(<TaskCompletionSeparator key={`separator-${message.taskId}`} />);
        }
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
