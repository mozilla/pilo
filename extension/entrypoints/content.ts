// Import ariaSnapshot functionality
import { generateAriaTree, renderAriaTree } from "../src/vendor/ariaSnapshot.js";

export default defineContentScript({
  matches: ["<all_urls>"],
  main() {
    // Make ARIA tree functions available globally for executeScript
    declare global {
      interface Window {
        generateAriaTree: typeof generateAriaTree;
        renderAriaTree: typeof renderAriaTree;
      }
    }

    window.generateAriaTree = generateAriaTree;
    window.renderAriaTree = renderAriaTree;

    // Listen for messages from background script
    browser.runtime.onMessage.addListener((request, sender, sendResponse) => {
      switch (request.type) {
        case "getPageInfo":
          // Extract page information for Spark automation
          sendResponse({
            title: document.title,
            url: window.location.href,
            // Add more page analysis here
          });
          break;
        case "executePageAction":
          // Execute specific actions on the page
          sendResponse({ success: true });
          break;
        default:
          sendResponse({ success: false, message: "Unknown message type" });
      }

      return true; // Keep message channel open for async response
    });
  },
});
