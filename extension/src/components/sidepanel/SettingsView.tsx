import { type ReactElement } from "react";
import { useSettings } from "../../stores/settingsStore";
import { useSystemTheme } from "../../useSystemTheme";

interface SettingsViewProps {
  onBack: () => void;
}

export default function SettingsView({ onBack }: SettingsViewProps): ReactElement {
  const { settings, saveStatus, updateSettings, saveSettings } = useSettings();
  const { isDark, theme: t } = useSystemTheme();

  const focusRing = "focus:ring-2 focus:ring-blue-500 focus:border-transparent";

  const handleSave = async () => {
    await saveSettings();
    // Auto-close settings after successful save
    if (!saveStatus?.startsWith("Error")) {
      setTimeout(() => {
        onBack();
      }, 1500);
    }
  };

  return (
    <div className={`h-screen ${t.bg.primary} ${t.text.primary} flex flex-col`}>
      <div className={`${t.bg.secondary} border-b ${t.border.primary} p-4`}>
        <div className="flex items-center gap-3 mb-2">
          <span className="text-2xl">⚡</span>
          <div>
            <h1 className={`text-lg font-bold ${t.text.primary}`}>Spark Settings</h1>
            <p className={`${t.text.muted} text-xs`}>Configure your AI provider</p>
          </div>
        </div>
      </div>

      <div className="flex-1 p-6 overflow-y-auto">
        <div className="space-y-6">
          <div className="space-y-2">
            <label className={`block text-sm font-medium ${t.text.secondary}`}>API Key</label>
            <input
              type="password"
              value={settings.apiKey}
              onChange={(e) => updateSettings({ apiKey: e.target.value })}
              placeholder="sk-..."
              className={`w-full px-3 py-2 ${t.bg.input} border ${t.border.input} rounded-lg ${t.text.primary} placeholder-gray-400 focus:outline-none ${focusRing}`}
            />
          </div>

          <div className="space-y-2">
            <label className={`block text-sm font-medium ${t.text.secondary}`}>API Endpoint</label>
            <input
              type="text"
              value={settings.apiEndpoint}
              onChange={(e) => updateSettings({ apiEndpoint: e.target.value })}
              placeholder="https://api.openai.com/v1"
              className={`w-full px-3 py-2 ${t.bg.input} border ${t.border.input} rounded-lg ${t.text.primary} placeholder-gray-400 focus:outline-none ${focusRing}`}
            />
          </div>

          <div className="space-y-2">
            <label className={`block text-sm font-medium ${t.text.secondary}`}>Model</label>
            <input
              type="text"
              value={settings.model}
              onChange={(e) => updateSettings({ model: e.target.value })}
              placeholder="gpt-4.1-mini"
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
              onClick={handleSave}
              disabled={!!saveStatus}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
            >
              Save Settings
            </button>
            <button
              onClick={onBack}
              className={`flex-1 px-4 py-2 ${isDark ? "bg-gray-600 hover:bg-gray-700" : "bg-gray-500 hover:bg-gray-600"} text-white rounded-lg transition-colors font-medium`}
            >
              Back to Chat
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
