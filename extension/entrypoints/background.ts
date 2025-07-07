import { AgentAPI, EventStoreLogger } from "../src/AgentAPI";

export default defineBackground(() => {
  console.log("Background script loaded");

  // Handle extension button clicks to open panel
  // Chrome uses browser.action, Firefox uses browser.browserAction (polyfill normalizes to browser.action)
  if (browser.action && browser.action.onClicked) {
    browser.action.onClicked.addListener(async (tab) => {
      console.log("Extension button clicked for tab:", tab.id);

      // Chrome: Use sidePanel API
      if (browser.sidePanel && browser.sidePanel.open) {
        try {
          await browser.sidePanel.open({ tabId: tab.id });
          console.log("SidePanel opened successfully");
        } catch (error) {
          console.error("Failed to open sidePanel:", error);
        }
      }
      // Firefox: Use sidebarAction API
      else if (browser.sidebarAction && browser.sidebarAction.open) {
        try {
          await browser.sidebarAction.open();
          console.log("Sidebar opened successfully");
        } catch (error) {
          console.error("Failed to open sidebar:", error);
        }
      }
      // Fallback: Firefox sidebar should open automatically via manifest
      else {
        console.log("No panel API available - Firefox sidebar should open automatically");
      }
    });
  } else {
    console.error("No action API available");
  }

  // Handle messages from sidebar and other parts of the extension
  browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
    console.log("Background received message:", message.type);

    (async () => {
      try {
        let response;

        switch (message.type) {
          case "executeTask":
            console.log("Executing task:", message.task);

            // Get settings from storage
            const settings = await browser.storage.local.get(["apiKey", "apiEndpoint", "model"]);

            if (!settings.apiKey) {
              response = {
                success: false,
                message: "API key not configured. Please set up your credentials first.",
              };
              break;
            }

            try {
              // Create event store logger to capture events for React
              const logger = new EventStoreLogger();

              console.log(
                `Starting task execution for tab ${message.tabId} with URL: ${message.startUrl}`,
              );

              // Use AgentAPI to run the task
              const result = await AgentAPI.runTask(message.task, {
                apiKey: settings.apiKey,
                model: settings.model || "gpt-4.1",
                logger: logger,
                tabId: message.tabId,
                startUrl: message.startUrl,
              });

              console.log(`Task completed successfully:`, result);

              response = {
                success: true,
                result: result,
                events: logger.getEvents(), // Include events for React UI
              };
            } catch (error) {
              console.error("Task execution error:", error);

              response = {
                success: false,
                message: `Task execution failed: ${error.message}`,
                events: logger?.getEvents() || [], // Include events even on error
              };
            }
            break;

          default:
            response = {
              success: false,
              message: "Unknown message type",
            };
        }

        console.log("Sending response:", response);
        sendResponse(response);
      } catch (error) {
        console.error("Error in message handler:", error);
        sendResponse({
          success: false,
          message: error.message || "Unknown error occurred",
        });
      }
    })();

    return true; // Required for async response
  });
});
