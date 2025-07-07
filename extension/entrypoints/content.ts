export default defineContentScript({
  matches: ['<all_urls>'],
  main() {
    // Content script for Spark Extension
    // This will be used to interact with page content when executing tasks
    
    // Listen for messages from background script
    browser.runtime.onMessage.addListener((request, sender, sendResponse) => {
      switch (request.type) {
        case 'getPageInfo':
          // TODO: Extract page information for Spark automation
          sendResponse({
            title: document.title,
            url: window.location.href,
            // Add more page analysis here
          });
          break;
        case 'executePageAction':
          // TODO: Execute specific actions on the page
          sendResponse({ success: true });
          break;
        default:
          sendResponse({ success: false, message: 'Unknown message type' });
      }
      
      return true; // Keep message channel open for async response
    });
  },
});
