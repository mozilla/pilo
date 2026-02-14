import browser from "webextension-polyfill";
import { AgentManager, EventStoreLogger } from "../src/AgentManager.js";
import { useConversationStore } from "../src/stores/conversationStore.js";
import {
  showIndicator,
  hideIndicator,
  isIndicatorActive,
  setupNavigationListener,
  cleanupStaleRegistrations,
} from "../src/background/indicatorControl.js";
import type {
  ChromeBrowser,
  ExtensionMessage,
  ExecuteTaskMessage,
  ExecuteTaskResponse,
  CancelTaskMessage,
  CancelTaskResponse,
} from "../src/types/browser.js";

interface StorageSettings {
  apiKey?: string;
  apiEndpoint?: string;
  model?: string;
  provider?: "openai" | "openrouter" | "google" | "ollama";
}

export default defineBackground(() => {
  console.log("Background script loaded");

  // Clean up any orphaned registrations from previous session (e.g., after crash)
  cleanupStaleRegistrations().catch(() => {});

  // Set up navigation listener to re-inject indicator CSS on cross-origin navigations
  setupNavigationListener();

  // Track running tasks by tab ID and their abort controllers
  const runningTasks = new Map<number, AbortController>();

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
  browser.runtime.onMessage.addListener((message: unknown) => {
    // Type guard to validate message structure
    if (!message || typeof message !== "object" || !("type" in message)) {
      return Promise.resolve({ success: false, message: "Invalid message format" });
    }

    const typedMessage = message as ExtensionMessage;

    // Note: Indicator events are now handled via CSS injection (see indicatorControl.ts)
    // The indicator is shown via logger.subscribe() in the executeTask handler below,
    // not via realtimeEvent messages (which don't reach the background script since
    // runtime.sendMessage doesn't deliver to the sender's own onMessage listener).

    // realtimeEvent messages are consumed by sidepanel via runtime.sendMessage from EventStoreLogger
    if (typedMessage.type === "realtimeEvent") {
      // Return undefined to indicate no response (sidepanel consumes these)
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

            // Debug: Log what settings we got (without the full API key for security)
            console.log("Settings loaded:", {
              hasApiKey: !!settings.apiKey,
              apiKeyLength: settings.apiKey?.length || 0,
              apiKeyPrefix: settings.apiKey?.substring(0, 8) || "none",
              provider: settings.provider,
              model: settings.model,
              apiEndpoint: settings.apiEndpoint,
            });

            // API key is optional for Ollama
            if (!settings.apiKey && settings.provider !== "ollama") {
              response = {
                success: false,
                message: "API key not configured. Please set up your credentials first.",
              };
              break;
            }

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

            // Create event store logger with tabId to enable indicator forwarding
            const logger = new EventStoreLogger(tabId);

            // Subscribe to logger events to show/hide indicator
            // This is needed because runtime.sendMessage doesn't deliver to the sender's own listener
            const unsubscribe = logger.subscribe((events) => {
              // Show indicator on task:started (planning complete)
              if (!isIndicatorActive(tabId) && events.some((e) => e.type === "task:started")) {
                showIndicator(tabId).catch(() => {});
              }
              // Hide indicator on task completion or abort
              if (
                isIndicatorActive(tabId) &&
                events.some((e) => e.type === "task:completed" || e.type === "task:aborted")
              ) {
                hideIndicator(tabId).catch(() => {});
                unsubscribe();
              }
            });

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
                apiKey: settings.apiKey || "",
                apiEndpoint: settings.apiEndpoint,
                model: settings.model || "gpt-4.1-mini",
                provider: settings.provider,
                logger,
                tabId: executeMessage.tabId,
                data: executeMessage.data,
                abortSignal: abortController.signal,
              });

              console.log(`Task completed successfully:`, result);

              // Emit task:completed event to trigger indicator hide via subscription
              logger.addEvent("task:completed", {
                finalAnswer: result,
                success: true,
                timestamp: Date.now(),
                iterationId: "completed",
              });

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
                // Emit task:aborted event for cancellation to hide indicator
                logger.addEvent("task:aborted", {
                  reason: "Task cancelled by user",
                  finalAnswer: "Task cancelled",
                  timestamp: Date.now(),
                  iterationId: "cancelled",
                });
                response = {
                  success: true, // Treat cancellation as success to avoid error styling
                  result: "Task cancelled",
                };
              } else {
                const errorMessage = error instanceof Error ? error.message : String(error);
                // Emit task:aborted event for errors to hide indicator
                logger.addEvent("task:aborted", {
                  reason: errorMessage,
                  finalAnswer: `Task failed: ${errorMessage}`,
                  timestamp: Date.now(),
                  iterationId: "error",
                });
                response = {
                  success: false,
                  message: `Task execution failed: ${errorMessage}`,
                };
              }
            } finally {
              // Clean up the task tracking, then hide indicator
              runningTasks.delete(tabId);
              await hideIndicator(tabId);
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

  // Note: Indicator now persists across navigations automatically via CSS injection
  // (see indicatorControl.ts) - no need for tabs.onUpdated listener

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
