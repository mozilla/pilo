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

  const getModelPlaceholder = (provider: string): string => {
    switch (provider) {
      case "openrouter":
        return "google/gemini-2.5-flash";
      case "google":
        return "gemini-2.5-flash";
      case "ollama":
        return "llama3.2";
      default:
        return "gpt-4.1-mini";
    }
  };

  const getEndpointLabel = (provider: string): string => {
    switch (provider) {
      case "openai":
        return "API Endpoint";
      case "ollama":
        return "Base URL";
      default:
        return "API Endpoint (Not used)";
    }
  };

  const getEndpointPlaceholder = (provider: string): string => {
    switch (provider) {
      case "openai":
        return "https://api.openai.com/v1";
      case "ollama":
        return "http://localhost:11434/api";
      default:
        return "Not used by this provider";
    }
  };

  const handleProviderChange = (newProvider: "openai" | "openrouter" | "google" | "ollama") => {
    const updates: Partial<typeof settings> = { provider: newProvider };

    // Prefill default endpoints when switching providers
    if (newProvider === "openai" && !settings.apiEndpoint) {
      updates.apiEndpoint = "https://api.openai.com/v1";
    } else if (newProvider === "ollama" && !settings.apiEndpoint) {
      updates.apiEndpoint = "http://localhost:11434/api";
    }
    // Clear endpoint when switching to providers that don't use it
    else if (newProvider !== "openai" && newProvider !== "ollama") {
      updates.apiEndpoint = "";
    }

    updateSettings(updates);
  };

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
    <div className={`h-screen flex flex-col ${t.bg.sidebar}`}>
      <div
        className={`${t.bg.panel} m-6 rounded-2xl flex-1 overflow-hidden shadow-lg flex flex-col`}
      >
        <div className={`${t.bg.secondary} border-b ${t.border.secondary} p-4`}>
          <div className="flex items-center gap-3 mb-2">
            <span className="text-2xl">⚡</span>
            <div>
              <h1 className={`text-lg font-medium ${t.text.primary}`}>Spark Settings</h1>
              <p className={`${t.text.secondary} text-xs`}>Configure your AI provider</p>
            </div>
          </div>
        </div>

        <div className="flex-1 p-6 overflow-y-auto">
          <div className="space-y-6">
            <div className="space-y-2">
              <label className={`block text-sm font-medium ${t.text.secondary}`}>Provider</label>
              <select
                value={settings.provider}
                onChange={(e) =>
                  handleProviderChange(
                    e.target.value as "openai" | "openrouter" | "google" | "ollama",
                  )
                }
                className={`w-full px-3 py-2 ${t.bg.input} border ${t.border.input} rounded-lg ${t.text.primary} focus:outline-none ${focusRing}`}
              >
                <option value="openai">OpenAI</option>
                <option value="openrouter">OpenRouter</option>
                <option value="google">Google Generative AI</option>
                <option value="ollama">Ollama (Local)</option>
              </select>
            </div>

            <div className="space-y-2">
              <label className={`block text-sm font-medium ${t.text.secondary}`}>Model</label>
              <input
                type="text"
                value={settings.model}
                onChange={(e) => updateSettings({ model: e.target.value })}
                placeholder={getModelPlaceholder(settings.provider)}
                className={`w-full px-3 py-2 ${t.bg.input} border ${t.border.input} rounded-lg ${t.text.primary} placeholder-gray-400 focus:outline-none ${focusRing}`}
              />
            </div>

            <div className="space-y-2">
              <label className={`block text-sm font-medium ${t.text.secondary}`}>
                {getEndpointLabel(settings.provider)}
              </label>
              <input
                type="text"
                value={settings.apiEndpoint}
                onChange={(e) => updateSettings({ apiEndpoint: e.target.value })}
                placeholder={getEndpointPlaceholder(settings.provider)}
                disabled={settings.provider !== "openai" && settings.provider !== "ollama"}
                className={`w-full px-3 py-2 ${t.bg.input} border ${t.border.input} rounded-lg ${t.text.primary} placeholder-gray-400 focus:outline-none ${focusRing} disabled:opacity-50 disabled:cursor-not-allowed`}
              />
              {settings.provider === "ollama" && (
                <p className={`text-xs ${t.text.secondary}`}>Make sure Ollama is running locally</p>
              )}
            </div>

            <div className="space-y-2">
              <label className={`block text-sm font-medium ${t.text.secondary}`}>
                API Key {settings.provider === "ollama" && "(Optional)"}
              </label>
              <input
                type="password"
                value={settings.apiKey}
                onChange={(e) => updateSettings({ apiKey: e.target.value })}
                placeholder="sk-..."
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
                className="flex-1 px-4 py-2 bg-[#FF6B35] text-white rounded-lg hover:bg-[#E55A2B] disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
              >
                Save Settings
              </button>
              <button
                onClick={onBack}
                className={`flex-1 px-4 py-2 ${isDark ? "bg-gray-800 hover:bg-gray-700" : "bg-gray-200 hover:bg-gray-300"} ${isDark ? "text-gray-100" : "text-gray-900"} rounded-lg transition-colors font-medium`}
              >
                Back to Chat
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
