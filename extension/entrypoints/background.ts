import { AgentAPI, EventStoreLogger } from "../src/AgentAPI";

export default defineBackground(() => {
  console.log("Background script loaded");

  // Handle extension button clicks to open panel
  // Chrome uses browser.action, Firefox uses browser.browserAction (polyfill normalizes to browser.action)
  if (browser.action && browser.action.onClicked) {
    browser.action.onClicked.addListener(async (tab) => {
      console.log("Extension button clicked for tab:", tab.id);

      if (tab.id === undefined) {
        console.error("Tab ID is missing, cannot open panel.");
        return;
      }
      const tabId = tab.id;

      // Chrome: Use sidePanel API
      if (browser.sidePanel && browser.sidePanel.open) {
        try {
          await browser.sidePanel.open({ windowId: tab.windowId, tabId: tabId });
          console.log("SidePanel opened successfully");
        } catch (error) {
          console.error("Failed to open sidePanel:", error);
        }
      }
      // Firefox: Use sidebarAction API
      else if ("sidebarAction" in browser && browser.sidebarAction.open) {
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
  browser.runtime.onMessage.addListener(async (message, sender) => {
    console.log("Background received message:", message.type);

    try {
      switch (message.type) {
        case "executeTask":
          console.log("Executing task:", message.task);

          const settings = await browser.storage.local.get(["apiKey", "apiEndpoint", "model"]);

          if (!settings.apiKey) {
            return {
              success: false,
              message: "API key not configured. Please set up your credentials first.",
            };
          }

          const logger = new EventStoreLogger();
          try {
            console.log(
              `Starting task execution for tab ${message.tabId} with URL: ${message.startUrl}`,
            );

            const result = await AgentAPI.runTask(message.task, {
              apiKey: settings.apiKey,
              model: settings.model || "gpt-4.1",
              logger: logger,
              tabId: message.tabId,
              startUrl: message.startUrl,
            });

            console.log(`Task completed successfully:`, result);

            return {
              success: true,
              result: result,
              events: logger.getEvents(),
            };
          } catch (error) {
            console.error("Task execution error:", error);

            return {
              success: false,
              message: `Task execution failed: ${error instanceof Error ? error.message : String(error)}`,
              events: logger.getEvents(),
            };
          }

        default:
          return {
            success: false,
            message: "Unknown message type",
          };
      }
    } catch (error) {
      console.error("Error in message handler:", error);
      return {
        success: false,
        message: error instanceof Error ? error.message : "Unknown error occurred",
      };
    }
  });
});
