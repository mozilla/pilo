// sidebar.js

function getSettings() {
    return browser.storage.local.get(['apiEndpoint', 'apiKey', 'model']).then((result) => ({
        apiEndpoint: result.apiEndpoint || "https://api.openai.com/v1",
        apiKey: result.apiKey || "",
        model: result.model || "gpt-4.1-nano"
    }));
}

function displayResponse(text) {
    document.getElementById('spark-response').textContent = text;
}

function clearLog() {
    let logDiv = document.getElementById('spark-log');
    if (logDiv) logDiv.innerHTML = '';
}

document.getElementById("query-form").addEventListener("submit", async event => {
    event.preventDefault();
    const query = document.getElementById("query").value;
    displayResponse('Thinking...');
    clearLog();
    const { apiEndpoint, apiKey, model } = await getSettings();
    try {
        if (!window.AgentAPI || !window.AgentAPI.runWebAgentTask || !window.AgentAPI.SidebarLogger) {
            throw new Error('AgentAPI not loaded');
        }
        const logger = new window.AgentAPI.SidebarLogger('spark-log');
        const answer = await window.AgentAPI.runWebAgentTask(
            query,
            apiKey,
            apiEndpoint,
            model,
            logger
        );
        displayResponse(answer);
    } catch (e) {
        displayResponse('Error: ' + e.message);
    }
});
