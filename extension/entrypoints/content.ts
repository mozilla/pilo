// Import ariaSnapshot functionality
import browser from "webextension-polyfill";
import { generateAriaTree, renderAriaTree } from "../src/vendor/ariaSnapshot";
import { handleIndicatorMessage } from "../src/content/indicatorHandler";
import { showIndicator } from "../src/content/AgentIndicator";
import type {
  ExtensionMessage,
  GetPageInfoResponse,
  ExecutePageActionResponse,
  RealtimeEventMessage,
} from "../src/types/browser";

// Make ARIA tree functions available globally for executeScript
declare global {
  interface Window {
    generateAriaTree: typeof generateAriaTree;
    renderAriaTree: typeof renderAriaTree;
  }
}

export default defineContentScript({
  matches: ["<all_urls>"],
  runAt: "document_start",
  registration: "manifest",
  main() {
    console.log("[Spark] Content script loaded at document_start");
    // Make ARIA tree functions available globally for executeScript
    window.generateAriaTree = generateAriaTree;
    window.renderAriaTree = renderAriaTree;

    // Check if there's already a running task for this tab and show indicator if so
    // This handles the race condition where the task started before the content script loaded
    browser.runtime
      .sendMessage({ type: "getIndicatorState" })
      .then((response: unknown) => {
        const typedResponse = response as { shouldShowIndicator?: boolean } | undefined;
        if (typedResponse?.shouldShowIndicator) {
          console.log("[Spark] Task already running, showing indicator");
          showIndicator();
        }
      })
      .catch((error) => {
        // Ignore errors - this is best-effort
        console.log("[Spark] Could not get indicator state:", error);
      });

    // Listen for messages from background script
    browser.runtime.onMessage.addListener((request: unknown, _sender, sendResponse) => {
      // Type guard to validate message structure
      if (!request || typeof request !== "object" || !("type" in request)) {
        sendResponse({ success: false, message: "Invalid message format" });
        return true;
      }

      const typedRequest = request as ExtensionMessage;
      switch (typedRequest.type) {
        case "realtimeEvent":
          // Handle indicator events for visual feedback
          handleIndicatorMessage(typedRequest as RealtimeEventMessage);
          // No response needed for indicator events
          return true;
        case "getPageInfo":
          // Extract page information for Spark automation
          const pageInfo: GetPageInfoResponse = {
            title: document.title,
            url: window.location.href,
          };
          sendResponse(pageInfo);
          break;
        case "executePageAction":
          // Execute specific actions on the page
          const actionResponse: ExecutePageActionResponse = { success: true };
          sendResponse(actionResponse);
          break;
        default:
          const errorResponse: ExecutePageActionResponse = {
            success: false,
            message: "Unknown message type",
          };
          sendResponse(errorResponse);
      }

      return true; // Keep message channel open for async response
    });
  },
});
