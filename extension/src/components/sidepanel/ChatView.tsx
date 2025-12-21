import { useState, useEffect, type ReactElement } from "react";
import browser from "webextension-polyfill";
import Markdown from "marked-react";
import clsx from "clsx";
import { ChatMessage } from "../../ChatMessage";
import { useChat } from "../../useChat";
import type { ChatMessage as ChatMessageType } from "../../hooks/useConversation";
import { useEvents } from "../../stores/eventStore";
import { useSettings } from "../../stores/settingsStore";
import { useConversationStore } from "../../stores/conversationStore";
import { useSystemTheme } from "../../useSystemTheme";
import type { Theme } from "../../theme";
import type {
  ExecuteTaskMessage,
  ExecuteTaskResponse,
  CancelTaskMessage,
  CancelTaskResponse,
  RealtimeEventMessage,
  RealtimeEvent,
} from "../../types/browser";
import {
  isTaskStartedData,
  isAgentReasonedData,
  isAgentStatusData,
  isAIGenerationErrorData,
  isTaskValidationErrorData,
  isBrowserActionCompletedData,
  isBrowserActionStartedData,
  isAgentActionData,
} from "../../utils/typeGuards";
import type { BrowserActionStartedEventData } from "../../types/browser";

// Interface for events in ExecuteTaskResponse
interface EventData {
  type: string;
  data: unknown;
}

interface ChatViewProps {
  currentTab: browser.Tabs.Tab | null;
  onOpenSettings: () => void;
}

/**
 * Maximum number of validation retries before showing error to user.
 * Validation errors below this threshold are considered recoverable
 * and are handled automatically by the agent.
 */
const MAX_VALIDATION_RETRIES = 3;

/**
 * Formats a browser action into a human-readable status message.
 *
 * @param data - The browser action started event data
 * @returns A human-readable description of the action
 */
export function formatBrowserAction(data: BrowserActionStartedEventData): string {
  const { action, value } = data;

  switch (action) {
    case "click":
      return "Clicking";
    case "fill":
      return "Filling";
    case "goto": {
      if (value) {
        try {
          const url = new URL(value);
          return `Navigating to ${url.hostname}`;
        } catch (error) {
          console.warn("Failed to parse URL in formatBrowserAction:", error);
          return `Navigating to ${value}`;
        }
      }
      return "Navigating";
    }
    case "select":
      return value ? `Selecting '${value}'` : "Selecting";
    default:
      return "";
  }
}

/**
 * Determines whether an error event should be displayed to the user.
 * Filters out non-fatal errors that are handled automatically by the agent.
 *
 * Non-user-facing errors include:
 * - Validation errors during retry attempts (below MAX_VALIDATION_RETRIES)
 * - Recoverable browser action errors (agent will retry automatically)
 * - AI generation errors marked as tool errors (agent will retry)
 *
 * @param event - The realtime event
 * @returns true if error should be shown to user, false otherwise
 */
export function shouldDisplayError(event: RealtimeEvent): boolean {
  // Filter validation errors during retries
  if (event.type === "task:validation_error" && isTaskValidationErrorData(event.data)) {
    return (event.data.retryCount ?? 0) >= MAX_VALIDATION_RETRIES;
  }

  // Filter recoverable browser action errors
  if (event.type === "browser:action:completed" && isBrowserActionCompletedData(event.data)) {
    if (event.data.success === false) {
      return !event.data.isRecoverable;
    }
  }

  // Filter AI generation errors that are tool errors (will be retried)
  if (event.type === "ai:generation:error" && isAIGenerationErrorData(event.data)) {
    return !event.data.isToolError;
  }

  // Show all other errors by default
  return true;
}

/**
 * Renders markdown with marked-react which provides better security by preventing XSS attacks through
 * HTML injection. The component supports GitHub Flavored Markdown (GFM) and handles
 * line breaks properly.
 *
 * @param children - The markdown content to render
 * @param className - Optional additional CSS classes to apply
 */
interface MarkdownContentProps {
  children: string;
  className?: string;
}

const MarkdownContent = ({ children, className }: MarkdownContentProps): ReactElement => (
  <div className={clsx("markdown-content", "prose", "prose-chat", "max-w-none", className)}>
    <Markdown value={children} breaks gfm />
  </div>
);

// Task message component
interface TaskMessageProps {
  message: ChatMessageType;
  theme: Theme;
}

const TaskMessage = ({ message, theme: t }: TaskMessageProps): ReactElement => {
  const getClassName = () => {
    switch (message.type) {
      case "plan":
        return `text-message-assistant ${t.text.secondary} text-xs`;
      case "reasoning":
        return `text-message-assistant ${t.text.secondary}`;
      case "error":
        return "text-message-assistant text-red-600 p-2 bg-red-50 rounded border border-red-200";
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

// Loading spinner component
const LoadingSpinner = ({ theme: t }: { theme: Theme }): ReactElement => (
  <svg className={`animate-spin ${t.stroke.accent} h-4 w-4`} fill="none" viewBox="0 0 24 24">
    <circle
      className="opacity-25"
      cx="12"
      cy="12"
      r="10"
      stroke="currentColor"
      strokeWidth="4"
    ></circle>
    <path
      className="opacity-75"
      fill="currentColor"
      d="M4 12a8 8 0 0 1 8-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 0 1 4 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
    ></path>
  </svg>
);

// Task bubble component
interface TaskBubbleProps {
  taskId: string;
  messages: ChatMessageType[];
  currentTaskId: string | null;
  theme: Theme;
}

const TaskBubble = ({
  taskId,
  messages,
  currentTaskId,
  theme: t,
}: TaskBubbleProps): ReactElement => {
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

  let liClass = "";
  let divClass = "";

  if (hasPlan) {
    liClass = "flex mb-4";
    divClass = clsx("w-full px-4 py-2 rounded-lg", t.bg.secondary, t.text.primary);
  } else {
    liClass = "flex mb-4 justify-start";
    divClass = clsx(
      "max-w-xs lg:max-w-md px-4 py-2 rounded-lg border",
      t.bg.secondary,
      t.text.primary,
      t.border.primary,
    );
  }

  return (
    <li className={liClass}>
      <div className={divClass}>
        {/* Render messages chronologically with dynamic headings */}
        {taskMessages.map((msg) => {
          const heading = getHeading(msg.type);
          return (
            <div key={msg.id}>
              {heading && (
                <div className={`text-sm font-semibold ${t.text.accent} mb-2 mt-3 first:mt-0`}>
                  {heading}
                </div>
              )}
              <TaskMessage message={msg} theme={t} />
            </div>
          );
        })}

        {/* Current status for active tasks or early phase status-only tasks */}
        {!resultMessage && (isActive || isEarlyPhase) && (
          <div className="flex items-center gap-2 text-sm">
            <LoadingSpinner theme={t} />
            <span className={t.text.accent}>
              {latestStatus ? latestStatus.content : "Starting task..."}
            </span>
          </div>
        )}

        {/* Timestamp for completed tasks */}
        {resultMessage && (
          <div className={`text-xs ${t.text.muted} mt-1`}>
            {resultMessage.timestamp.toLocaleTimeString()}
          </div>
        )}
      </div>
    </li>
  );
};

export default function ChatView({ currentTab, onOpenSettings }: ChatViewProps): ReactElement {
  const [task, setTask] = useState("");
  const [stableTabId, setStableTabId] = useState<number | undefined>(currentTab?.id);
  const { addEvent, clearEvents } = useEvents();
  const { settings } = useSettings();
  const { theme: t } = useSystemTheme();

  // Update stable tab ID only when current tab actually changes
  useEffect(() => {
    if (currentTab?.id !== stableTabId) {
      setStableTabId(currentTab?.id);
    }
  }, [currentTab?.id, stableTabId]);

  const {
    messages,
    addMessage,
    startTask,
    endTask,
    messagesEndRef,
    scrollContainerRef,
    handleScroll,
    currentTaskId,
    isExecuting,
    setExecutionState,
  } = useChat(stableTabId);

  const focusRing = "focus:ring-2 focus:ring-blue-500 focus:border-transparent";

  // Helper function to add events to logger
  const addEventsToLogger = (eventList: EventData[]) => {
    eventList.forEach((event) => {
      addEvent(event.type, event.data);
    });
  };

  // Listen for real-time events from background script
  useEffect(() => {
    const handleMessage = (message: unknown) => {
      const typedMessage = message as RealtimeEventMessage;
      if (typedMessage.type === "realtimeEvent") {
        addEvent(typedMessage.event.type, typedMessage.event.data);

        // Read taskId directly from store to avoid race condition with React state.
        // When events arrive immediately after startTask(), the store is updated
        // but React may not have re-rendered yet, leaving currentTaskId stale.
        //
        // XXX this is an icky workaround.  what we really want is to make
        // every event contain a task ID so that we don't have manually
        // manage these associations, and race conditions like this disappear.
        const conversation = stableTabId
          ? useConversationStore.getState().getConversation(stableTabId)
          : null;
        const taskId = conversation?.currentTaskId ?? null;

        // Handle task started event to show plan
        if (
          typedMessage.event.type === "task:started" &&
          isTaskStartedData(typedMessage.event.data)
        ) {
          if (typedMessage.event.data.plan && taskId) {
            addMessage("plan", typedMessage.event.data.plan, taskId);
          }
        }

        // Handle reasoning events for streaming chat
        if (
          typedMessage.event.type === "agent:reasoned" &&
          isAgentReasonedData(typedMessage.event.data)
        ) {
          if (typedMessage.event.data.thought && taskId) {
            addMessage("reasoning", typedMessage.event.data.thought, taskId);
          }
        }

        // Handle agent status updates
        if (
          typedMessage.event.type === "agent:status" &&
          isAgentStatusData(typedMessage.event.data)
        ) {
          if (typedMessage.event.data.message && taskId) {
            addMessage("status", typedMessage.event.data.message, taskId);
          }
        }

        // Handle browser action started events
        if (typedMessage.event.type === "browser:action_started") {
          const eventData = typedMessage.event.data;
          if (isBrowserActionStartedData(eventData) && taskId) {
            const statusMessage = formatBrowserAction(eventData);
            if (statusMessage) {
              addMessage("status", statusMessage, taskId);
            }
          }
        }

        // Handle agent action events (e.g., extract)
        if (typedMessage.event.type === "agent:action") {
          const eventData = typedMessage.event.data;
          if (isAgentActionData(eventData) && taskId) {
            if (eventData.action === "extract") {
              addMessage("status", "Extracting data", taskId);
            }
          }
        }

        // Handle AI generation errors (only show non-tool errors)
        if (
          typedMessage.event.type === "ai:generation:error" &&
          isAIGenerationErrorData(typedMessage.event.data) &&
          typedMessage.event.data.error &&
          taskId &&
          shouldDisplayError(typedMessage.event)
        ) {
          addMessage("error", `AI Error: ${typedMessage.event.data.error}`, taskId);
        }

        // Handle validation errors (only show if max retries exceeded)
        if (
          typedMessage.event.type === "task:validation_error" &&
          isTaskValidationErrorData(typedMessage.event.data) &&
          typedMessage.event.data.errors &&
          taskId &&
          shouldDisplayError(typedMessage.event)
        ) {
          const errorMessages = typedMessage.event.data.errors.join(", ");
          addMessage("error", `Validation Error: ${errorMessages}`, taskId);
        }

        // Handle browser action result failures (only show non-recoverable errors)
        if (
          typedMessage.event.type === "browser:action:completed" &&
          isBrowserActionCompletedData(typedMessage.event.data) &&
          typedMessage.event.data.success === false &&
          taskId &&
          shouldDisplayError(typedMessage.event)
        ) {
          const errorText = typedMessage.event.data.error || "Browser action failed";
          addMessage("error", `Action Failed: ${errorText}`, taskId);
        }
      }
    };

    browser.runtime.onMessage.addListener(handleMessage);

    return () => {
      browser.runtime.onMessage.removeListener(handleMessage);
    };
  }, [addEvent, addMessage, stableTabId]);

  const handleExecute = async () => {
    if (!task.trim()) return;
    if (!settings.apiKey) {
      addMessage("system", "Please configure your API key in settings first");
      onOpenSettings();
      return;
    }

    // Save task before clearing input
    const taskText = task.trim();

    // Add user message and start task
    addMessage("user", taskText);
    const taskId = startTask();

    // Clear input immediately after sending
    setTask("");

    setExecutionState(true);
    clearEvents(); // Clear previous events

    try {
      // Use current tab from state instead of querying
      if (!currentTab?.id) {
        addMessage("error", "No active tab found", taskId);
        return;
      }

      // Only use background worker for actual Spark task execution
      const message: ExecuteTaskMessage = {
        type: "executeTask",
        task: taskText,
        apiKey: settings.apiKey,
        apiEndpoint: settings.apiEndpoint,
        model: settings.model,
        tabId: currentTab.id,
        data: { currentUrl: currentTab.url },
      };

      console.log("Sending message to background script:", message);

      // Add timeout to prevent hanging in Firefox
      // XXXdmose Ultimately, we should make this abort anything that's in
      // flight; likely using the handleCancel function, perhaps with a few
      // tweaks (ie clean and clear presentation to the user). It could be that
      // once we add status events in, we should drop the number back down.
      const messagePromise = browser.runtime.sendMessage(message);
      const timeoutPromise = new Promise(
        (_, reject) => setTimeout(() => reject(new Error("Background script timeout")), 300000), // 5 mins
      );

      let response: ExecuteTaskResponse;
      try {
        response = (await Promise.race([messagePromise, timeoutPromise])) as ExecuteTaskResponse;
        console.log("✅ Received response from background script:", response);
      } catch (messageError) {
        console.error("❌ Failed to receive response from background script:", messageError);
        throw messageError;
      }

      if (response && response.success) {
        const resultText = response.result || "Task completed successfully!";
        addMessage("result", resultText, taskId);

        // Add events from background script to our logger (fallback for any missed real-time events)
        if (response.events && response.events.length > 0) {
          addEventsToLogger(response.events);
        }
      } else {
        const errorText = `Error: ${response?.message || "Task execution failed"}`;
        addMessage("result", errorText, taskId);

        // Add events even on error
        if (response?.events && response.events.length > 0) {
          addEventsToLogger(response.events);
        }
      }
    } catch (error) {
      const errorText = `Error: ${error instanceof Error ? error.message : String(error)}`;
      addMessage("result", errorText, taskId);
    } finally {
      setExecutionState(false);
      endTask();
    }
  };

  const handleCancel = async () => {
    try {
      const message: CancelTaskMessage = {
        type: "cancelTask",
        tabId: currentTab?.id,
      };
      const response = (await browser.runtime.sendMessage(message)) as CancelTaskResponse;

      if (response && response.success) {
        // Don't add cancellation message here - it will come from the background script response
        setExecutionState(false);
        endTask();
      } else {
        // Handle cancellation request failure
        if (currentTaskId) {
          addMessage(
            "error",
            `Failed to cancel task: ${response?.message || "Unknown error"}`,
            currentTaskId,
          );
        }
      }
    } catch (error) {
      console.error("Failed to cancel task:", error);
      // Handle cancellation request failure
      if (currentTaskId) {
        addMessage(
          "error",
          `Cancellation failed: ${error instanceof Error ? error.message : "Unknown error"}`,
          currentTaskId,
        );
      }
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleExecute();
    }
  };

  /**
   * Renders all messages in the order they exist in the enclosing scope's
   * messages array.
   *
   * We iterate through them once, rendering user/system messages directly
   * and task bubbles at the first occurrence of each unique taskId. This
   * ensures task-related messages (plan, reasoning, result)
   * are grouped together in a single bubble while maintaining overall
   * chronological order.
   *
   * @returns Array of React elements to render in the message list
   */
  const renderMessages = () => {
    const renderedTaskIds = new Set<string>();
    const elements: React.ReactElement[] = [];

    messages.forEach((message) => {
      if (message.type === "user" || message.type === "system") {
        elements.push(
          <ChatMessage
            key={message.id}
            type={message.type as "user" | "assistant" | "system"}
            content={message.content}
            timestamp={message.timestamp}
            theme={t}
          />,
        );
      }

      // Render task bubble when we encounter the first message with this taskId
      else if (message.taskId && !renderedTaskIds.has(message.taskId)) {
        renderedTaskIds.add(message.taskId);
        elements.push(
          <TaskBubble
            key={message.taskId}
            taskId={message.taskId}
            messages={messages}
            currentTaskId={currentTaskId}
            theme={t}
          />,
        );
      }
    });

    return elements;
  };

  return (
    <div className={`h-screen flex flex-col ${t.bg.sidebar}`}>
      {/* Header */}
      <div className="p-4 flex items-center justify-end">
        <button
          onClick={onOpenSettings}
          className={`p-2 ${t.text.muted} ${t.hover.settings} rounded-lg transition-colors`}
          title="Settings"
        >
          ⚙️
        </button>
      </div>

      {/* Chat Messages */}
      <div ref={scrollContainerRef} onScroll={handleScroll} className="flex-1 overflow-y-auto p-4">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <h2 className={`text-xl font-medium ${t.text.primary} mb-2`}>Welcome to Spark!</h2>
            <p className={`${t.text.muted} text-sm max-w-sm`}>
              I can help you automate tasks on any webpage. Just describe what you'd like me to do!
            </p>
          </div>
        )}

        <ul className="space-y-4" role="list">
          {renderMessages()}
        </ul>

        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className={`border-t ${t.border.primary} p-4`}>
        <div className="flex items-center gap-2">
          <textarea
            value={task}
            onChange={(e) => setTask(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="What would you like me to do?"
            rows={2}
            disabled={isExecuting}
            className={`flex-1 px-3 py-2 ${t.bg.input} border ${t.border.input} rounded-lg ${t.text.primary} placeholder-gray-400 focus:outline-none ${focusRing} resize-none`}
          />
          {isExecuting ? (
            <button
              onClick={handleCancel}
              className="px-3 py-1.5 bg-red-600 text-white text-sm rounded-lg hover:bg-red-700 transition-colors font-medium"
            >
              Stop
            </button>
          ) : (
            <button
              onClick={handleExecute}
              disabled={!task.trim()}
              className="px-3 py-1.5 bg-[#FF6B35] text-white text-sm rounded-lg hover:bg-[#E55A2B] disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
            >
              Send
            </button>
          )}
        </div>
        <div className={`text-xs ${t.text.muted} mt-2 text-center`}>
          Press Enter to send • Shift+Enter for new line
        </div>
      </div>
    </div>
  );
}
