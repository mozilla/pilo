import { useState, useEffect, type ReactElement } from "react";
import browser from "webextension-polyfill";
import { marked } from "marked";
import { ChatMessage } from "../../ChatMessage";
import { useChat } from "../../useChat";
import type { ChatMessage as ChatMessageType } from "../../hooks/useConversation";
import { useEvents } from "../../stores/eventStore";
import { useSettings } from "../../stores/settingsStore";
import { useSystemTheme } from "../../useSystemTheme";
import type { Theme } from "../../theme";
import type {
  ExecuteTaskMessage,
  ExecuteTaskResponse,
  CancelTaskMessage,
  CancelTaskResponse,
} from "../../types/browser";

interface RealtimeMessage {
  type: string;
  event?: {
    type: string;
    data: any;
  };
}

interface EventData {
  type: string;
  data: any;
}

interface ChatViewProps {
  currentTab: browser.Tabs.Tab | null;
  onOpenSettings: () => void;
}

// Markdown rendering utilities
const renderMarkdown = (content: string): string => {
  return marked(content, {
    breaks: true,
    gfm: true,
  }) as string;
};

// Markdown content component
interface MarkdownContentProps {
  children: string;
  className?: string;
}

const MarkdownContent = ({ children, className = "" }: MarkdownContentProps): ReactElement => (
  <span className={className} dangerouslySetInnerHTML={{ __html: renderMarkdown(children) }} />
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
        return `text-sm ${t.text.primary}`;
      case "reasoning":
        return `text-sm ${t.text.secondary}`;
      case "error":
        return "text-sm text-red-600 p-2 bg-red-50 rounded border border-red-200";
      case "result":
        return "text-sm";
      default:
        return "text-sm";
    }
  };

  return (
    <div className="mb-2">
      <div className={getClassName()}>
        <MarkdownContent>{message.content}</MarkdownContent>
      </div>
    </div>
  );
};

// Loading spinner component
const LoadingSpinner = (): ReactElement => (
  <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
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

  if (taskMessages.length === 0 && !latestStatus) return <></>;

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
    <div className="flex justify-start mb-4">
      <div
        className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${t.bg.secondary} ${t.text.primary} border ${t.border.primary}`}
      >
        {/* Header */}
        <div className="flex items-center gap-2 mb-1">
          <span className="text-lg">⚡</span>
          <span className={`text-sm font-semibold ${t.text.primary}`}>Spark</span>
        </div>

        {/* Render messages chronologically with dynamic headings */}
        {taskMessages.map((msg) => {
          const heading = getHeading(msg.type);
          return (
            <div key={msg.id}>
              {heading && (
                <div className="text-sm font-semibold text-gray-500 mb-2 mt-3 first:mt-0">
                  {heading}
                </div>
              )}
              <TaskMessage message={msg} theme={t} />
            </div>
          );
        })}

        {/* Current status for active tasks */}
        {!resultMessage && isActive && (
          <div className="flex items-center gap-2 text-sm">
            <LoadingSpinner />
            <span className={t.text.muted}>
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
    </div>
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
      const typedMessage = message as RealtimeMessage;
      if (typedMessage.type === "realtimeEvent" && typedMessage.event) {
        addEvent(typedMessage.event.type, typedMessage.event.data);

        // Handle task started event to show plan
        if (
          typedMessage.event.type === "task:started" &&
          typedMessage.event.data?.plan &&
          currentTaskId
        ) {
          addMessage("plan", typedMessage.event.data.plan, currentTaskId);
        }

        // Handle reasoning events for streaming chat
        if (
          typedMessage.event.type === "agent:reasoned" &&
          typedMessage.event.data?.thought &&
          currentTaskId
        ) {
          addMessage("reasoning", typedMessage.event.data.thought, currentTaskId);
        }

        // Handle agent status updates
        if (
          typedMessage.event.type === "agent:status" &&
          typedMessage.event.data?.message &&
          currentTaskId
        ) {
          addMessage("status", typedMessage.event.data.message, currentTaskId);
        }

        // Handle AI generation errors
        if (
          typedMessage.event.type === "ai:generation:error" &&
          typedMessage.event.data?.error &&
          currentTaskId
        ) {
          addMessage("error", `AI Error: ${typedMessage.event.data.error}`, currentTaskId);
        }

        // Handle validation errors
        if (
          typedMessage.event.type === "task:validation_error" &&
          typedMessage.event.data?.errors &&
          currentTaskId
        ) {
          const errorMessages = typedMessage.event.data.errors.join(", ");
          addMessage("error", `Validation Error: ${errorMessages}`, currentTaskId);
        }

        // Handle browser action result failures
        if (
          typedMessage.event.type === "browser:action:completed" &&
          typedMessage.event.data?.success === false &&
          currentTaskId
        ) {
          const errorText = typedMessage.event.data.error || "Browser action failed";
          addMessage("error", `Action Failed: ${errorText}`, currentTaskId);
        }
      }
    };

    browser.runtime.onMessage.addListener(handleMessage);

    return () => {
      browser.runtime.onMessage.removeListener(handleMessage);
    };
  }, [addEvent, addMessage, currentTaskId]);

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
      const messagePromise = browser.runtime.sendMessage(message);
      const timeoutPromise = new Promise(
        (_, reject) => setTimeout(() => reject(new Error("Background script timeout")), 60000), // 60 second timeout
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

  return (
    <div className={`h-screen ${t.bg.primary} ${t.text.primary} flex flex-col`}>
      {/* Header */}
      <div
        className={`${t.bg.secondary} border-b ${t.border.primary} p-4 flex items-center justify-between`}
      >
        <div className="flex items-center gap-3">
          <span className="text-2xl">⚡</span>
          <div>
            <h1 className={`text-lg font-bold ${t.text.primary}`}>Spark</h1>
            <p className={`${t.text.muted} text-xs`}>
              {currentTab?.url ? new URL(currentTab.url).hostname : "AI-powered web automation"}
            </p>
          </div>
        </div>
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
            <h2 className={`text-xl font-bold ${t.text.primary} mb-2`}>Welcome to Spark!</h2>
            <p className={`${t.text.muted} text-sm max-w-sm`}>
              I can help you automate tasks on any webpage. Just describe what you'd like me to do!
            </p>
          </div>
        )}

        <div className="space-y-4">
          {messages
            .filter((msg) => msg.type === "user" || msg.type === "system")
            .map((message) => (
              <ChatMessage
                key={message.id}
                type={message.type as "user" | "assistant" | "system"}
                content={message.content}
                timestamp={message.timestamp}
                theme={t}
              />
            ))}

          {/* Render task bubbles */}
          {Array.from(
            new Set(
              messages
                .filter((msg) => msg.taskId)
                .map((msg) => msg.taskId)
                .filter((taskId): taskId is string => taskId !== undefined),
            ),
          ).map((taskId) => (
            <TaskBubble
              key={taskId}
              taskId={taskId}
              messages={messages}
              currentTaskId={currentTaskId}
              theme={t}
            />
          ))}
        </div>

        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className={`${t.bg.secondary} border-t ${t.border.primary} p-4`}>
        <div className="flex gap-2">
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
              className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-medium"
            >
              Stop
            </button>
          ) : (
            <button
              onClick={handleExecute}
              disabled={!task.trim()}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
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
