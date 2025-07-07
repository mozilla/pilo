export default defineBackground(() => {
  console.log('Background script loaded');
  
  // Explicitly handle action clicks to open sidePanel
  browser.action.onClicked.addListener(async (tab) => {
    console.log('Extension button clicked for tab:', tab.id);
    
    if (browser.sidePanel && browser.sidePanel.open) {
      try {
        await browser.sidePanel.open({ tabId: tab.id });
        console.log('SidePanel opened successfully');
      } catch (error) {
        console.error('Failed to open sidePanel:', error);
      }
    } else {
      console.error('sidePanel API not available');
    }
  });

  // Handle messages from sidebar and other parts of the extension
  browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
    console.log('Background received message:', message.type);
    
    (async () => {
      try {
        let response;
        
        switch (message.type) {
          case 'executeTask':
            // TODO: Implement Spark task execution here
            console.log('Task execution not implemented yet');
            response = {
              success: false,
              message: 'Task execution not implemented yet - Spark integration coming soon!'
            };
            break;
            
          default:
            response = {
              success: false,
              message: 'Unknown message type'
            };
        }
        
        console.log('Sending response:', response);
        sendResponse(response);
      } catch (error) {
        console.error('Error in message handler:', error);
        sendResponse({
          success: false,
          message: error.message || 'Unknown error occurred'
        });
      }
    })();
    
    return true; // Required for async response
  });
});
