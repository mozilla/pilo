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

document.getElementById("query-form").addEventListener("submit", async event => {
    event.preventDefault();
    const query = document.getElementById("query").value;
    displayResponse('Thinking...');
    const { apiEndpoint, apiKey, model } = await getSettings();
    try {
        if (!window.AgentAPI || !window.AgentAPI.runWebAgentTask) {
            throw new Error('AgentAPI not loaded');
        }
        const answer = await window.AgentAPI.runWebAgentTask(query, apiKey, apiEndpoint, model);
        displayResponse(answer);
    } catch (e) {
        displayResponse('Error: ' + e.message);
    }
});
