// Import ariaTree functionality from shared module
import browser from "webextension-polyfill";
import { generateAndRenderAriaTree } from "spark/ariaTree";
import type {
  ExtensionMessage,
  GetPageInfoResponse,
  ExecutePageActionResponse,
} from "../src/types/browser";

// Make ARIA tree function available globally for executeScript
declare global {
  interface Window {
    generateAndRenderAriaTree: typeof generateAndRenderAriaTree;
  }
}

export default defineContentScript({
  matches: ["<all_urls>"],
  runAt: "document_start",
  registration: "manifest",
  main() {
    console.log("[Spark] Content script loaded at document_start");
    // Make ARIA tree function available globally for executeScript
    window.generateAndRenderAriaTree = generateAndRenderAriaTree;

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
