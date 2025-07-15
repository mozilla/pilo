import { useState, useEffect, type ReactElement } from "react";
import browser from "webextension-polyfill";
import "./SidePanel.css";
import { EventLog } from "../../src/EventLog";
import { useEventStore } from "../../src/useEventStore";
import { useSystemTheme } from "../../src/useSystemTheme";
import type { ExecuteTaskMessage, ExecuteTaskResponse } from "../../src/types/browser";

interface Settings {
  apiKey: string;
  apiEndpoint: string;
  model: string;
}

interface StoredSettings {
  apiKey?: string;
  apiEndpoint?: string;
  model?: string;
}

interface RealtimeMessage {
  type: string;
  event?: {
    type: string;
    data: any;
  };
}

interface EventData {
  type: string;
  data: any;
}

const SETTINGS_SAVE_DELAY = 1500;

export default function SidePanel(): ReactElement {
  const [task, setTask] = useState("");
  const [isExecuting, setIsExecuting] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<string | null>(null);
  const [settings, setSettings] = useState<Settings>({
    apiKey: "",
    apiEndpoint: "https://api.openai.com/v1",
    model: "gpt-4.1",
  });
  const [showSettings, setShowSettings] = useState(false);
  const { events, logger, clearEvents } = useEventStore();
  const { isDark, theme: t } = useSystemTheme();

  const focusRing = "focus:ring-2 focus:ring-blue-500 focus:border-transparent";

  // Helper function to add events to logger
  const addEventsToLogger = (eventList: EventData[]) => {
    eventList.forEach((event) => {
      logger.addEvent(event.type, event.data);
    });
  };

  // Load settings on component mount
  useEffect(() => {
    loadSettings();
  }, []);

  // Listen for real-time events from background script
  useEffect(() => {
    const handleMessage = (message: unknown) => {
      const typedMessage = message as RealtimeMessage;
      if (typedMessage.type === "realtimeEvent" && typedMessage.event) {
        logger.addEvent(typedMessage.event.type, typedMessage.event.data);
      }
    };

    browser.runtime.onMessage.addListener(handleMessage);

    return () => {
      browser.runtime.onMessage.removeListener(handleMessage);
    };
  }, [logger]);

  const loadSettings = async () => {
    try {
      // Direct storage access - no background worker needed
      const stored = (await browser.storage.local.get([
        "apiKey",
        "apiEndpoint",
        "model",
      ])) as StoredSettings;
      const newSettings = {
        apiKey: stored.apiKey || "",
        apiEndpoint: stored.apiEndpoint || "https://api.openai.com/v1",
        model: stored.model || "gpt-4.1",
      };
      setSettings(newSettings);

      // Show settings if no API key is configured
      if (!newSettings.apiKey) {
        setShowSettings(true);
      }
    } catch (error) {
      console.error("Failed to load settings:", error);
    }
  };

  const saveSettings = async () => {
    setSaveStatus("Saving...");

    try {
      // Direct storage access - much simpler!
      await browser.storage.local.set({
        apiKey: settings.apiKey,
        apiEndpoint: settings.apiEndpoint,
        model: settings.model,
      });

      setSaveStatus("Settings saved successfully!");
      setTimeout(() => {
        setShowSettings(false);
        setSaveStatus(null);
      }, SETTINGS_SAVE_DELAY);
    } catch (error) {
      setSaveStatus(`Error: ${error instanceof Error ? error.message : String(error)}`);
      console.error("Save settings error:", error);
    }
  };

  const handleExecute = async () => {
    if (!task.trim()) return;
    if (!settings.apiKey) {
      setResult("Please configure your API key in settings first");
      setShowSettings(true);
      return;
    }

    setIsExecuting(true);
    setResult(null);
    clearEvents(); // Clear previous events

    try {
      // Get current tab ID and URL for the background script
      const [currentTab] = await browser.tabs.query({ active: true, currentWindow: true });

      // Only use background worker for actual Spark task execution
      const message: ExecuteTaskMessage = {
        type: "executeTask",
        task: task.trim(),
        apiKey: settings.apiKey,
        apiEndpoint: settings.apiEndpoint,
        model: settings.model,
        tabId: currentTab?.id,
        startUrl: currentTab?.url,
      };
      const response = (await browser.runtime.sendMessage(message)) as ExecuteTaskResponse;

      if (response && response.success) {
        setResult(response.result || "Task completed successfully!");
        setTask("");

        // Add events from background script to our logger (fallback for any missed real-time events)
        if (response.events && response.events.length > 0) {
          addEventsToLogger(response.events);
        }
      } else {
        setResult(`Error: ${response?.message || "Task execution failed"}`);

        // Add events even on error
        if (response?.events && response.events.length > 0) {
          addEventsToLogger(response.events);
        }
      }
    } catch (error) {
      setResult(`Error: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setIsExecuting(false);
    }
  };

  if (showSettings) {
    return (
      <div className={`h-screen ${t.bg.primary} ${t.text.primary} flex flex-col`}>
        <div className={`${t.bg.secondary} border-b ${t.border.primary} p-6`}>
          <h1 className={`text-2xl font-bold ${t.text.primary} mb-2`}>🔥 Spark Settings</h1>
          <p className={`${t.text.muted} text-sm`}>Configure your AI provider</p>
        </div>

        <div className="flex-1 p-6 overflow-y-auto">
          <div className="space-y-6">
            <div className="space-y-2">
              <label className={`block text-sm font-medium ${t.text.secondary}`}>API Key</label>
              <input
                type="password"
                value={settings.apiKey}
                onChange={(e) => setSettings({ ...settings, apiKey: e.target.value })}
                placeholder="sk-..."
                className={`w-full px-3 py-2 ${t.bg.input} border ${t.border.input} rounded-lg ${t.text.primary} placeholder-gray-400 focus:outline-none ${focusRing}`}
              />
            </div>

            <div className="space-y-2">
              <label className={`block text-sm font-medium ${t.text.secondary}`}>
                API Endpoint
              </label>
              <input
                type="text"
                value={settings.apiEndpoint}
                onChange={(e) => setSettings({ ...settings, apiEndpoint: e.target.value })}
                placeholder="https://api.openai.com/v1"
                className={`w-full px-3 py-2 ${t.bg.input} border ${t.border.input} rounded-lg ${t.text.primary} placeholder-gray-400 focus:outline-none ${focusRing}`}
              />
            </div>

            <div className="space-y-2">
              <label className={`block text-sm font-medium ${t.text.secondary}`}>Model</label>
              <input
                type="text"
                value={settings.model}
                onChange={(e) => setSettings({ ...settings, model: e.target.value })}
                placeholder="gpt-4.1"
                className={`w-full px-3 py-2 ${t.bg.input} border ${t.border.input} rounded-lg ${t.text.primary} placeholder-gray-400 focus:outline-none ${focusRing}`}
              />
            </div>

            {saveStatus && (
              <div
                className={`p-3 rounded-lg text-sm font-medium ${
                  saveStatus.startsWith("Error")
                    ? `${t.bg.error} ${t.text.error} border ${t.border.error}`
                    : `${t.bg.success} ${t.text.success} border ${t.border.success}`
                }`}
              >
                {saveStatus}
              </div>
            )}

            <div className="flex gap-3 pt-4">
              <button
                onClick={saveSettings}
                disabled={!!saveStatus}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
              >
                Save Settings
              </button>
              {settings.apiKey && (
                <button
                  onClick={() => setShowSettings(false)}
                  className={`flex-1 px-4 py-2 ${isDark ? "bg-gray-600 hover:bg-gray-700" : "bg-gray-500 hover:bg-gray-600"} text-white rounded-lg transition-colors font-medium`}
                >
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
    <div className={`h-screen ${t.bg.primary} ${t.text.primary} flex flex-col`}>
      <div className={`${t.bg.secondary} border-b ${t.border.primary} p-6 relative`}>
        <h1 className={`text-2xl font-bold ${t.text.primary} mb-2`}>🔥 Spark</h1>
        <p className={`${t.text.muted} text-sm`}>AI-powered web automation</p>
        <button
          onClick={() => setShowSettings(true)}
          className={`absolute top-6 right-6 p-2 ${t.text.muted} ${t.hover.settings} rounded-lg transition-colors`}
          title="Settings"
        >
          ⚙️
        </button>
      </div>

      <div className="flex-1 p-6 overflow-y-auto">
        <div className="space-y-6">
          <div className="space-y-3">
            <label htmlFor="task-input" className={`block text-sm font-medium ${t.text.secondary}`}>
              What would you like to do?
            </label>
            <textarea
              id="task-input"
              value={task}
              onChange={(e) => setTask(e.target.value)}
              placeholder="Describe what you want to do on this page..."
              rows={4}
              disabled={isExecuting}
              className={`w-full px-3 py-2 ${t.bg.input} border ${t.border.input} rounded-lg ${t.text.primary} placeholder-gray-400 focus:outline-none ${focusRing} resize-none`}
            />

            <button
              onClick={handleExecute}
              disabled={isExecuting || !task.trim()}
              className="w-full px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
            >
              {isExecuting ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    ></circle>
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 0 1 8-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 0 1 4 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    ></path>
                  </svg>
                  Executing...
                </span>
              ) : (
                "Execute Task"
              )}
            </button>
          </div>

          {result && (
            <div
              className={`p-4 rounded-lg text-sm ${
                result.startsWith("Error")
                  ? `${t.bg.error} ${t.text.error} border ${t.border.error}`
                  : `${t.bg.success} ${t.text.success} border ${t.border.success}`
              }`}
            >
              {result}
            </div>
          )}

          <EventLog events={events} theme={t} />
        </div>
      </div>

      <div className={`${t.bg.secondary} border-t ${t.border.primary} p-4 text-center`}>
        <p className={`${t.text.muted} text-xs`}>Powered by Spark AI</p>
      </div>
    </div>
  );
}
