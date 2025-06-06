// sidebar.js

function getSettings() {
  return browser.storage.local
    .get(['apiEndpoint', 'apiKey', 'model'])
    .then((result) => ({
      apiEndpoint: result.apiEndpoint || 'https://api.openai.com/v1',
      apiKey: result.apiKey || '',
      model: result.model || 'gpt-4.1-nano',
    }));
}

function displayResponse(text) {
  document.getElementById('spark-response').textContent = text;
}

function clearLog() {
  let logDiv = document.getElementById('spark-log');
  if (logDiv) logDiv.innerHTML = '';
}

document
  .getElementById('query-form')
  .addEventListener('submit', async (event) => {
    event.preventDefault();
    const query = document.getElementById('query').value;
    displayResponse('Thinking...');
    clearLog();
    const { apiEndpoint, apiKey, model } = await getSettings();
    try {
      console.log(!window.AgentAPI);
      console.log(!window.AgentAPI.initWebAgent);
      console.log(!window.AgentAPI.SidebarLogger);
      if (
        !window.AgentAPI ||
        !window.AgentAPI.initWebAgent ||
        !window.AgentAPI.SidebarLogger
      ) {
        throw new Error('AgentAPI not loaded');
      }
      const logger = new window.AgentAPI.SidebarLogger('spark-log');
      const agent = await window.AgentAPI.initWebAgent(
        apiKey,
        apiEndpoint,
        model,
        logger
      );

      document
        .getElementById('stop-button')
        .addEventListener('click', function () {
          agent.close();
          displayResponse('Task stopped.');
        });

      const result = await agent.execute(query);
      await agent.close();
      displayResponse(result);
    } catch (e) {
      displayResponse('Error: ' + e.message);
    }
  });
