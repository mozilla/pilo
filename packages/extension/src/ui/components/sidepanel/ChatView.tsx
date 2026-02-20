import { useState, useEffect, useCallback, useRef, type ReactElement } from "react";
import browser from "webextension-polyfill";
import { useEvents } from "../../stores/eventStore";
import { useSettings } from "../../stores/settingsStore";
import { useConversationStore } from "../../../shared/conversationStore";
import { useConversation } from "../../hooks/useConversation";
import { useAutoScroll } from "../../hooks/useAutoScroll";
import { MessageList } from "./MessageList";
import { ChatInput } from "./ChatInput";
import type {
  ExecuteTaskMessage,
  ExecuteTaskResponse,
  CancelTaskMessage,
  CancelTaskResponse,
  RealtimeEventMessage,
  RealtimeEvent,
} from "../../../shared/types/browser";
import {
  isTaskStartedData,
  isAgentReasonedData,
  isAgentStatusData,
  isAIGenerationErrorData,
  isTaskValidationErrorData,
  isBrowserActionCompletedData,
  isBrowserActionStartedData,
  isAgentActionData,
} from "../../../shared/utils/typeGuards";
import type { BrowserActionStartedEventData } from "../../../shared/types/browser";

// Interface for events in ExecuteTaskResponse
interface EventData {
  type: string;
  data: unknown;
}

interface ChatViewProps {
  currentTab: browser.Tabs.Tab | null;
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

// ---------------------------------------------------------------------------
// InputDisabledOverlay
// ---------------------------------------------------------------------------

interface InputDisabledOverlayProps {
  onNewRequest: () => void;
}

const InputDisabledOverlay = ({ onNewRequest }: InputDisabledOverlayProps): ReactElement => (
  <div className="absolute inset-0 bg-background/90 flex items-center justify-center backdrop-blur-sm z-10">
    <div className="text-center px-4">
      <p className="text-foreground text-sm mb-3">
        Continued conversation context not yet supported.
      </p>
      <button
        onClick={onNewRequest}
        className="px-4 py-2 bg-primary text-primary-foreground text-sm rounded-lg hover:bg-primary/90 transition-colors font-medium"
        data-testid="new-request-button"
      >
        New Request
      </button>
    </div>
  </div>
);

// ---------------------------------------------------------------------------
// ChatView
// ---------------------------------------------------------------------------

export default function ChatView({ currentTab }: ChatViewProps): ReactElement {
  const [stableTabId, setStableTabId] = useState<number | undefined>(currentTab?.id);
  const [lastCompletedTaskId, setLastCompletedTaskId] = useState<string | null>(null);
  const { addEvent, clearEvents } = useEvents();
  const { settings } = useSettings();

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
    currentTaskId,
    isExecuting,
    setExecutionState,
    clearMessages,
  } = useConversation(stableTabId);

  // Auto-scroll is used by MessageList internally; we still need scrollToBottomOnNewMessage
  // to trigger a scroll after calling addMessage from event handlers.
  const { scrollToBottomOnNewMessage } = useAutoScroll(messages, stableTabId);

  // ---------------------------------------------------------------------------
  // DEV ONLY: Seed mock messages for UI design iteration.
  // Guarded by import.meta.env.MODE so it is skipped in Vitest (MODE === 'test')
  // and only runs during real WXT dev server sessions (MODE === 'development').
  // Remove this block before shipping.
  // ---------------------------------------------------------------------------
  const seededRef = useRef(false);

  useEffect(() => {
    if (import.meta.env.MODE !== "development") return;
    if (seededRef.current) return;
    seededRef.current = true;

    // Stable task IDs for grouping.
    const TASK_A = "mock-task-001"; // Completed task with markdown result
    const TASK_B = "mock-task-002"; // Completed task with error
    const TASK_C = "mock-task-003"; // Active / in-progress task

    // --- Task A: completed, markdown result ----------------------------------
    addMessage("user", "Summarize the key features on the Stripe pricing page");

    addMessage(
      "plan",
      "1. Navigate to the Stripe pricing page\n2. Extract feature comparison data\n3. Summarize key features and pricing tiers",
      TASK_A,
    );
    addMessage("status", "Navigating to stripe.com", TASK_A);
    addMessage("status", "Extracting feature comparison data", TASK_A);
    addMessage("status", "Summarizing pricing tiers", TASK_A);
    addMessage(
      "result",
      [
        "## Stripe Pricing: Key Features",
        "",
        "**Pay-as-you-go** pricing with no setup fees or monthly charges.",
        "",
        "### Core Plans",
        "",
        "- **Integrated**: `2.9% + 30¢` per successful card charge. Includes the full payments platform.",
        "- **Customized**: Volume discounts, multi-product bundles, and country-specific rates available for high-volume businesses.",
        "",
        "### Included Features (all plans)",
        "",
        "- Supports **135+ currencies** and dozens of local payment methods",
        "- Built-in **fraud protection** via Stripe Radar",
        "- **Dashboard**, reporting, and developer APIs included at no extra cost",
        "- Instant payouts available for an additional `1.5%` fee",
        "",
        "### Add-ons (billed separately)",
        "",
        "- **Stripe Billing** (subscriptions): starting at `0.5%` of recurring revenue",
        "- **Stripe Connect** (marketplace payouts): `0.25%` per payout",
        "- **Stripe Tax**: `0.5%` of transactions where tax is calculated",
      ].join("\n"),
      TASK_A,
    );

    // --- Task B: completed, with an error -----------------------------------
    addMessage("user", "Click the Sign Up button on the page");

    addMessage(
      "plan",
      "1. Locate the Sign Up button on the current page\n2. Click the button",
      TASK_B,
    );
    addMessage("status", "Scanning page for Sign Up button", TASK_B);
    addMessage("status", "Clicking Sign Up button", TASK_B);
    addMessage(
      "error",
      "Action Failed: Element not found - the Sign Up button is not visible on the current page",
      TASK_B,
    );
    addMessage(
      "result",
      "Could not complete the task. The Sign Up button was not found on the current page - it may be behind a modal, off-screen, or not present at this URL.",
      TASK_B,
    );

    // --- System message -----------------------------------------------------
    addMessage("system", "Task completed");

    // --- Task C: active / in-progress (no result yet) -----------------------
    addMessage("user", "Fill in the contact form with my details");

    addMessage(
      "plan",
      "1. Locate the contact form on the page\n2. Fill in the name, email, and message fields\n3. Submit the form",
      TASK_C,
    );
    addMessage("status", "Locating contact form", TASK_C);
    addMessage("status", "Filling in name field", TASK_C);

    // Mark Task C as the active task so the spinner + InputDisabledOverlay render.
    // We also set isExecuting so the TaskBubble shows the loading state.
    //
    // startTask() generates a timestamp-based ID; we patch the store directly
    // so currentTaskId === TASK_C, which matches the seeded messages above.
    startTask();
    if (stableTabId !== undefined) {
      const storeState = useConversationStore.getState();
      // Guard for test environments where setTaskId may not be mocked.
      if (typeof storeState.setTaskId === "function") {
        storeState.setTaskId(stableTabId, TASK_C);
      }
    }
    setExecutionState(true);

    // Trigger the InputDisabledOverlay for visual review.
    // Comment this line out to hide the overlay and see the active spinner instead.
    // setLastCompletedTaskId(TASK_C);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  // ---------------------------------------------------------------------------
  // END DEV SEED
  // ---------------------------------------------------------------------------

  // Helper to add events to logger
  const addEventsToLogger = (eventList: EventData[]) => {
    eventList.forEach((event) => {
      addEvent(event.type, event.data);
    });
  };

  // Enhanced addMessage that also triggers scroll
  const addMessageAndScroll = (
    type: Parameters<typeof addMessage>[0],
    content: string,
    taskId?: string,
  ) => {
    addMessage(type, content, taskId);
    scrollToBottomOnNewMessage();
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
          if (taskId) {
            // Display actionItems if present, otherwise fall back to full plan
            if (typedMessage.event.data.actionItems?.length) {
              const displayPlan = typedMessage.event.data.actionItems
                .map((item, index) => `${index + 1}. ${item}`)
                .join("\n");
              addMessageAndScroll("plan", displayPlan, taskId);
            } else if (typedMessage.event.data.plan) {
              addMessageAndScroll("plan", typedMessage.event.data.plan, taskId);
            }
          }
        }

        // Handle reasoning events for streaming chat
        if (
          typedMessage.event.type === "agent:reasoned" &&
          isAgentReasonedData(typedMessage.event.data)
        ) {
          if (typedMessage.event.data.thought && taskId) {
            addMessageAndScroll("reasoning", typedMessage.event.data.thought, taskId);
          }
        }

        // Handle agent status updates
        if (
          typedMessage.event.type === "agent:status" &&
          isAgentStatusData(typedMessage.event.data)
        ) {
          if (typedMessage.event.data.message && taskId) {
            addMessageAndScroll("status", typedMessage.event.data.message, taskId);
          }
        }

        // Handle browser action started events
        if (typedMessage.event.type === "browser:action_started") {
          const eventData = typedMessage.event.data;
          if (isBrowserActionStartedData(eventData) && taskId) {
            const statusMessage = formatBrowserAction(eventData);
            if (statusMessage) {
              addMessageAndScroll("status", statusMessage, taskId);
            }
          }
        }

        // Handle agent action events (e.g., extract)
        if (typedMessage.event.type === "agent:action") {
          const eventData = typedMessage.event.data;
          if (isAgentActionData(eventData) && taskId) {
            if (eventData.action === "extract") {
              addMessageAndScroll("status", "Extracting data", taskId);
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
          addMessageAndScroll("error", `AI Error: ${typedMessage.event.data.error}`, taskId);
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
          addMessageAndScroll("error", `Validation Error: ${errorMessages}`, taskId);
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
          addMessageAndScroll("error", `Action Failed: ${errorText}`, taskId);
        }
      }
    };

    browser.runtime.onMessage.addListener(handleMessage);

    return () => {
      browser.runtime.onMessage.removeListener(handleMessage);
    };
  }, [addEvent, addMessage, stableTabId]);

  const handleNewRequest = () => {
    setLastCompletedTaskId(null);
  };

  const handleSendMessage = async (taskText: string) => {
    // API key is optional for Ollama
    if (!settings.apiKey && settings.provider !== "ollama") {
      addMessageAndScroll("system", "Please configure your API key in settings first");
      return;
    }

    // Add user message and start task
    addMessageAndScroll("user", taskText);
    const taskId = startTask();

    setExecutionState(true);
    clearEvents(); // Clear previous events

    try {
      if (!currentTab?.id) {
        addMessageAndScroll("error", "No active tab found", taskId);
        return;
      }

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
        (_, reject) => setTimeout(() => reject(new Error("Background script timeout")), 600000), // 10 mins
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
        addMessageAndScroll("result", resultText, taskId);

        // Add events from background script to our logger (fallback for any missed real-time events)
        if (response.events && response.events.length > 0) {
          addEventsToLogger(response.events);
        }
      } else {
        const errorText = `Error: ${response?.message || "Task execution failed"}`;
        addMessageAndScroll("result", errorText, taskId);

        // Add events even on error
        if (response?.events && response.events.length > 0) {
          addEventsToLogger(response.events);
        }
      }
    } catch (error) {
      const errorText = `Error: ${error instanceof Error ? error.message : String(error)}`;
      addMessageAndScroll("result", errorText, taskId);
    } finally {
      setExecutionState(false);
      endTask();
      setLastCompletedTaskId(taskId);
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
          addMessageAndScroll(
            "error",
            `Failed to cancel task: ${response?.message || "Unknown error"}`,
            currentTaskId,
          );
        }
      }
    } catch (error) {
      console.error("Failed to cancel task:", error);
      if (currentTaskId) {
        addMessageAndScroll(
          "error",
          `Cancellation failed: ${error instanceof Error ? error.message : "Unknown error"}`,
          currentTaskId,
        );
      }
    }
  };

  const handleClearChat = useCallback(() => {
    clearMessages();
    setLastCompletedTaskId(null);
  }, [clearMessages]);

  // Expose handleClearChat via a custom event so SidePanel (SidebarHeader) can call it
  useEffect(() => {
    const el = document.documentElement;
    el.addEventListener("pilo:clear-chat", handleClearChat);
    return () => el.removeEventListener("pilo:clear-chat", handleClearChat);
  }, [handleClearChat]);

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      {/* Message List */}
      <MessageList
        messages={messages}
        currentTaskId={currentTaskId}
        isExecuting={isExecuting}
        tabId={stableTabId}
      />

      {/* Input Area */}
      <div className="relative">
        {/* Overlay when task is completed */}
        {lastCompletedTaskId && !isExecuting && (
          <InputDisabledOverlay onNewRequest={handleNewRequest} />
        )}

        <ChatInput
          onSend={handleSendMessage}
          isLoading={isExecuting}
          disabled={lastCompletedTaskId !== null && !isExecuting}
          onStop={handleCancel}
        />
      </div>
    </div>
  );
}
