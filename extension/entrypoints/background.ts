export default defineBackground(() => {
  // Handle Chrome sidePanel API - open sidebar when action button is clicked
  if (browser.action && browser.sidePanel) {
    browser.action.onClicked.addListener(async (tab) => {
      try {
        await browser.sidePanel.open({ tabId: tab.id });
      } catch (error) {
        console.error('Failed to open sidebar:', error);
      }
    });

    // Set sidebar to be enabled by default
    browser.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
  }

  // Handle messages from sidebar and other parts of the extension
  browser.runtime.onMessage.addListener(async (message, sender) => {
    switch (message.type) {
      case 'executeTask':
        try {
          // TODO: Integrate with Spark library
          // For now, just simulate task execution
          const { task, tabId, url } = message;
          
          // Simulate some processing time
          await new Promise(resolve => setTimeout(resolve, 1000));
          
          // TODO: Actually execute the task using Spark
          // const result = await executeSparkTask(task, tabId, url);
          
          return {
            success: true,
            message: `Task "${task}" executed successfully (placeholder)`,
            // result: result
          };
        } catch (error) {
          console.error('Error executing task:', error);
          return {
            success: false,
            message: error.message || 'Unknown error occurred'
          };
        }
        
      default:
        return {
          success: false,
          message: 'Unknown message type'
        };
    }
  });
});
