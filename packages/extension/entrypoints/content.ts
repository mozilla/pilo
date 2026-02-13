// Import ariaSnapshot functionality
import browser from "webextension-polyfill";
import { generateAriaTree, renderAriaTree } from "../src/vendor/ariaSnapshot";
import type {
  ExtensionMessage,
  GetPageInfoResponse,
  ExecutePageActionResponse,
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

    // Note: Indicator is now controlled via CSS injection from background script
    // (see indicatorControl.ts) - no need to query state or handle messages here

    // Listen for messages from background script
    browser.runtime.onMessage.addListener((request: unknown, _sender, sendResponse) => {
      // Type guard to validate message structure
      if (!request || typeof request !== "object" || !("type" in request)) {
        sendResponse({ success: false, message: "Invalid message format" });
        return true;
      }

      const typedRequest = request as ExtensionMessage;
      switch (typedRequest.type) {
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
