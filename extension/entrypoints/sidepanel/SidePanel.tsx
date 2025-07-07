import React, { useState } from 'react';
import './SidePanel.css';

export default function SidePanel() {
  const [task, setTask] = useState('');
  const [isExecuting, setIsExecuting] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  const handleExecute = async () => {
    if (!task.trim()) return;

    setIsExecuting(true);
    setResult(null);

    try {
      // Get current active tab
      const tabs = await browser.tabs.query({ active: true, currentWindow: true });
      const currentTab = tabs[0];

      // Send message to background script to execute task
      const response = await browser.runtime.sendMessage({
        type: 'executeTask',
        task: task.trim(),
        tabId: currentTab.id,
        url: currentTab.url
      });

      if (response.success) {
        setResult('Task executed successfully!');
        setTask('');
      } else {
        setResult(`Error: ${response.message}`);
      }
    } catch (error) {
      setResult(`Error: ${error.message}`);
    } finally {
      setIsExecuting(false);
    }
  };

  return (
    <div className="sidepanel">
      <div className="sidepanel-header">
        <h1>🔥 Spark</h1>
        <p>AI-powered web automation</p>
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
      </div>

      <div className="sidepanel-footer">
        <p>Powered by Spark AI</p>
      </div>
    </div>
  );
}