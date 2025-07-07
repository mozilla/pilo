import React, { useState, useEffect } from 'react';
import './SidePanel.css';

interface Settings {
  apiKey: string;
  apiEndpoint: string;
  model: string;
}

export default function SidePanel() {
  const [task, setTask] = useState('');
  const [isExecuting, setIsExecuting] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<string | null>(null);
  const [settings, setSettings] = useState<Settings>({
    apiKey: '',
    apiEndpoint: 'https://api.openai.com/v1',
    model: 'gpt-4-turbo'
  });
  const [showSettings, setShowSettings] = useState(false);

  // Load settings on component mount
  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      // Direct storage access - no background worker needed
      const stored = await browser.storage.local.get(['apiKey', 'apiEndpoint', 'model']);
      const newSettings = {
        apiKey: stored.apiKey || '',
        apiEndpoint: stored.apiEndpoint || 'https://api.openai.com/v1',
        model: stored.model || 'gpt-4-turbo'
      };
      setSettings(newSettings);
      
      // Show settings if no API key is configured
      if (!newSettings.apiKey) {
        setShowSettings(true);
      }
    } catch (error) {
      console.error('Failed to load settings:', error);
    }
  };

  const saveSettings = async () => {
    setSaveStatus('Saving...');
    
    try {
      // Direct storage access - much simpler!
      await browser.storage.local.set({
        apiKey: settings.apiKey,
        apiEndpoint: settings.apiEndpoint,
        model: settings.model
      });
      
      setSaveStatus('Settings saved successfully!');
      setTimeout(() => {
        setShowSettings(false);
        setSaveStatus(null);
      }, 1500);
    } catch (error) {
      setSaveStatus(`Error: ${error.message}`);
      console.error('Save settings error:', error);
    }
  };

  const handleExecute = async () => {
    if (!task.trim()) return;
    if (!settings.apiKey) {
      setResult('Please configure your API key in settings first');
      setShowSettings(true);
      return;
    }

    setIsExecuting(true);
    setResult(null);

    try {
      // Only use background worker for actual Spark task execution
      const response = await browser.runtime.sendMessage({
        type: 'executeTask',
        task: task.trim(),
        apiKey: settings.apiKey,
        apiEndpoint: settings.apiEndpoint,
        model: settings.model
      });

      if (response && response.success) {
        setResult(response.result || 'Task completed successfully!');
        setTask('');
      } else {
        setResult(`Error: ${response?.message || 'Task execution failed'}`);
      }
    } catch (error) {
      setResult(`Error: ${error.message}`);
    } finally {
      setIsExecuting(false);
    }
  };

  if (showSettings) {
    return (
      <div className="sidepanel">
        <div className="sidepanel-header">
          <h1>🔥 Spark Settings</h1>
          <p>Configure your AI provider</p>
        </div>

        <div className="sidepanel-content">
          <div className="settings-form">
            <label>
              API Key:
              <input
                type="password"
                value={settings.apiKey}
                onChange={(e) => setSettings({...settings, apiKey: e.target.value})}
                placeholder="sk-..."
              />
            </label>
            
            <label>
              API Endpoint:
              <input
                type="text"
                value={settings.apiEndpoint}
                onChange={(e) => setSettings({...settings, apiEndpoint: e.target.value})}
                placeholder="https://api.openai.com/v1"
              />
            </label>
            
            <label>
              Model:
              <input
                type="text"
                value={settings.model}
                onChange={(e) => setSettings({...settings, model: e.target.value})}
                placeholder="gpt-4-turbo"
              />
            </label>
            
            {saveStatus && (
              <div className={`save-status ${saveStatus.startsWith('Error') ? 'error' : 'success'}`}>
                {saveStatus}
              </div>
            )}
            
            <div className="settings-buttons">
              <button onClick={saveSettings} className="save-btn" disabled={!!saveStatus}>
                Save Settings
              </button>
              {settings.apiKey && (
                <button onClick={() => setShowSettings(false)} className="cancel-btn">
                  Cancel
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="sidepanel">
      <div className="sidepanel-header">
        <h1>🔥 Spark</h1>
        <p>AI-powered web automation</p>
        <button 
          onClick={() => setShowSettings(true)} 
          className="settings-btn"
          title="Settings"
        >
          ⚙️
        </button>
      </div>

      <div className="sidepanel-content">
        <div className="task-form">
          <label htmlFor="task-input">What would you like to do?</label>
          <textarea
            id="task-input"
            value={task}
            onChange={(e) => setTask(e.target.value)}
            placeholder="Describe what you want to do on this page..."
            rows={4}
            disabled={isExecuting}
          />
          
          <button 
            onClick={handleExecute}
            disabled={isExecuting || !task.trim()}
            className="execute-btn"
          >
            {isExecuting ? 'Executing...' : 'Execute Task'}
          </button>
        </div>

        {result && (
          <div className={`result ${result.startsWith('Error') ? 'error' : 'success'}`}>
            {result}
          </div>
        )}

        <div id="spark-log" className="log-area"></div>
      </div>

      <div className="sidepanel-footer">
        <p>Powered by Spark AI</p>
      </div>
    </div>
  );
}