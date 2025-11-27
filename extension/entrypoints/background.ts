import browser from "webextension-polyfill";
import { AgentManager, EventStoreLogger } from "../src/AgentManager";
import { useConversationStore } from "../src/stores/conversationStore";
import type {
  ChromeBrowser,
  ExtensionMessage,
  ExecuteTaskMessage,
  ExecuteTaskResponse,
  CancelTaskMessage,
  CancelTaskResponse,
} from "../src/types/browser";

interface StorageSettings {
  apiKey?: string;
  apiEndpoint?: string;
  model?: string;
  provider?: "openai" | "openrouter";
}

export default defineBackground(() => {
  console.log("Background script loaded");

  // Track running tasks by tab ID and their abort controllers
  const runningTasks = new Map<number, AbortController>();

  // Configure side panel to open on action click (persists across restarts)
  browser.runtime.onInstalled.addListener(() => {
    const chromeBrowser = browser as ChromeBrowser;
    if (chromeBrowser.sidePanel?.setPanelBehavior) {
      chromeBrowser.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
      console.log("Side panel configured to open on action click");
    }
  });

  // Handle extension button clicks to open panel
  // Polyfill should normalize but doesn't seem to work properly
  const browserAction = browser.action || browser.browserAction;
  if (browserAction) {
    browserAction.onClicked.addListener(async (tab) => {
      console.log("Extension button clicked for tab:", tab.id);

      // Chrome: Use sidePanel API
      const chromeBrowser = browser as ChromeBrowser;
      if (chromeBrowser.sidePanel) {
        try {
          await chromeBrowser.sidePanel.open({ windowId: tab.windowId });
          console.log("SidePanel opened successfully");
        } catch (error) {
          console.error("Failed to open sidePanel:", error);
        }
      }
      // Firefox: Use sidebarAction API
      else if (browser.sidebarAction) {
        try {
          await browser.sidebarAction.toggle();
          console.log("Sidebar toggled successfully");
        } catch (error) {
          console.error("Failed to toggle sidebar:", error);
        }
      }
      // Fallback: Firefox sidebar should open automatically via manifest
      else {
        console.log("No panel API available - Firefox sidebar should open automatically");
      }
    });
  }

  // Handle messages from sidebar and other parts of the extension
  browser.runtime.onMessage.addListener((message: unknown, _sender: any) => {
    // Type guard to validate message structure
    if (!message || typeof message !== "object" || !("type" in message)) {
      return Promise.resolve({ success: false, message: "Invalid message format" });
    }

    const typedMessage = message as ExtensionMessage;

    // Handle realtimeEvent messages immediately - just ignore them
    if (typedMessage.type === "realtimeEvent") {
      // These are meant for sidepanel consumption, not background handling
      console.log("Background received message: realtimeEvent", typedMessage.event);
      // Return undefined to indicate no response
      return;
    }

    console.log("Background received message:", typedMessage.type, typedMessage);

    // Return a Promise for async processing
    return (async () => {
      try {
        let response: ExecuteTaskResponse | CancelTaskResponse;

        switch (typedMessage.type) {
          case "executeTask":
            const executeMessage = typedMessage as ExecuteTaskMessage;
            console.log("Executing task:", executeMessage.task);

            // Get settings from storage
            const settings = (await browser.storage.local.get([
              "apiKey",
              "apiEndpoint",
              "model",
              "provider",
            ])) as StorageSettings;

            if (!settings.apiKey) {
              response = {
                success: false,
                message: "API key not configured. Please set up your credentials first.",
              };
              break;
            }

            // Create event store logger to capture events for React
            const logger = new EventStoreLogger();

            // Create AbortController for this task
            const abortController = new AbortController();
            const tabId = executeMessage.tabId;

            if (!tabId) {
              response = {
                success: false,
                message: "No tab ID provided for task execution",
              };
              break;
            }

            // Cancel any existing task for this tab
            if (runningTasks.has(tabId)) {
              runningTasks.get(tabId)?.abort();
            }

            runningTasks.set(tabId, abortController);

            try {
              console.log(
                `Starting task execution for tab ${executeMessage.tabId} with data:`,
                executeMessage.data,
              );

              // Use AgentManager to run the task with AbortSignal
              const result = await AgentManager.runTask(executeMessage.task, {
                apiKey: settings.apiKey,
                apiEndpoint: settings.apiEndpoint,
                model: settings.model || "gpt-4.1-mini",
                provider: settings.provider,
                logger,
                tabId: executeMessage.tabId,
                data: executeMessage.data,
                abortSignal: abortController.signal,
              });

              console.log(`Task completed successfully:`, result);

              response = {
                success: true,
                result: result,
              };
            } catch (error) {
              console.error("Task execution error:", error);

              // Check if this was a cancellation
              const isCancellation =
                error instanceof Error &&
                (error.name === "AbortError" ||
                  (abortController.signal.aborted &&
                    (error.message.includes("cancelled") || error.message.includes("aborted"))));

              if (isCancellation) {
                response = {
                  success: true, // Treat cancellation as success to avoid error styling
                  result: "Task cancelled",
                };
              } else {
                response = {
                  success: false,
                  message: `Task execution failed: ${error instanceof Error ? error.message : String(error)}`,
                };
              }
            } finally {
              // Clean up the task tracking
              runningTasks.delete(tabId);
            }
            break;

          case "cancelTask":
            const cancelMessage = typedMessage as CancelTaskMessage;
            console.log("Cancelling running tasks");

            // Cancel all running tasks (or specific tab if provided)
            let cancelledCount = 0;
            if (cancelMessage.tabId) {
              // Cancel task for specific tab
              const controller = runningTasks.get(cancelMessage.tabId);
              if (controller) {
                controller.abort();
                cancelledCount = 1;
              }
            } else {
              // Cancel all running tasks
              for (const [, controller] of runningTasks.entries()) {
                controller.abort();
                cancelledCount++;
              }
            }

            response = {
              success: true,
              message:
                cancelledCount > 0
                  ? `Cancelled ${cancelledCount} running task(s)`
                  : "No running tasks to cancel",
            };
            break;

          default:
            response = {
              success: false,
              message: "Unknown message type",
            };
        }

        console.log("Sending response:", response);
        return response;
      } catch (error) {
        console.error("Error in message handler:", error);
        return {
          success: false,
          message: error instanceof Error ? error.message : "Unknown error occurred",
        };
      }
    })();
  });

  // Handle tab removal to cancel running tasks
  browser.tabs.onRemoved.addListener((tabId) => {
    console.log(`Tab ${tabId} removed, cancelling any running tasks`);
    const controller = runningTasks.get(tabId);
    if (controller) {
      controller.abort();
      runningTasks.delete(tabId);
    }
  });

  // Start cleanup timer for conversations
  setInterval(async () => {
    try {
      const activeTabs = await browser.tabs.query({});
      const activeTabIds = activeTabs
        .map((tab) => tab.id)
        .filter((id) => id !== undefined) as number[];
      useConversationStore.getState().cleanupClosedTabs(activeTabIds);
    } catch (error) {
      console.error("Failed to cleanup closed tabs:", error);
    }
  }, 60000); // 1 minute
});
