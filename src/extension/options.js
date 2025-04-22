// options.js

document.addEventListener('DOMContentLoaded', () => {
    const endpointInput = document.getElementById('api-endpoint');
    const keyInput = document.getElementById('api-key');
    const modelInput = document.getElementById('model');
    const status = document.getElementById('status');
    const form = document.getElementById('options-form');

    // Load saved settings
    if (browser && browser.storage && browser.storage.local) {
        browser.storage.local.get(['apiEndpoint', 'apiKey', 'model']).then((result) => {
            if (result.apiEndpoint) endpointInput.value = result.apiEndpoint;
            if (result.apiKey) keyInput.value = result.apiKey;
            if (result.model) modelInput.value = result.model;
        });
    }

    form.addEventListener('submit', (e) => {
        e.preventDefault();
        const apiEndpoint = endpointInput.value.trim();
        const apiKey = keyInput.value.trim();
        const model = modelInput.value.trim();
        if (browser && browser.storage && browser.storage.local) {
            browser.storage.local.set({ apiEndpoint, apiKey, model }).then(() => {
                status.textContent = 'Saved!';
                setTimeout(() => { status.textContent = ''; }, 1500);
            });
        }
    });
});
