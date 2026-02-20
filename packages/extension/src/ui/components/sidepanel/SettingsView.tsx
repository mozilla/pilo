import { useState, useEffect, useCallback } from "react";
import { Eye, EyeOff, Check } from "lucide-react";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { ScrollArea } from "../ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import { useSettings } from "../../stores/settingsStore";
import { cn } from "../../../lib/utils";
import type { Settings } from "../../stores/settingsStore";

interface SettingsViewProps {
  onBack: () => void;
}

type Provider = Settings["provider"];

const DEFAULT_SETTINGS: Settings = {
  apiKey: "",
  apiEndpoint: "",
  model: "google/gemini-2.5-flash",
  provider: "openrouter",
};

const PROVIDER_LABELS: Record<Provider, string> = {
  openai: "OpenAI",
  openrouter: "OpenRouter",
  google: "Google Generative AI",
  ollama: "Ollama",
};

function getModelPlaceholder(provider: Provider): string {
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
}

function getEndpointPlaceholder(provider: Provider): string {
  switch (provider) {
    case "openai":
      return "https://api.openai.com/v1";
    case "ollama":
      return "http://localhost:11434/api";
    default:
      return "";
  }
}

function getEndpointLabel(provider: Provider): string {
  return provider === "ollama" ? "Base URL" : "API Endpoint";
}

const showsEndpoint = (provider: Provider) => provider === "openai" || provider === "ollama";

export default function SettingsView({ onBack }: SettingsViewProps) {
  const { settings, saveSettings, updateSettings, saveStatus } = useSettings();

  // Local draft state — changes only commit to the store on Save
  const [draft, setDraft] = useState<Settings>(() => ({ ...settings }));
  const [showApiKey, setShowApiKey] = useState(false);
  const [saved, setSaved] = useState(false);

  // Sync draft when store settings change externally (e.g. initial load)
  useEffect(() => {
    setDraft({ ...settings });
  }, [settings]);

  const updateDraft = useCallback(<K extends keyof Settings>(field: K, value: Settings[K]) => {
    setDraft((prev) => ({ ...prev, [field]: value }));
  }, []);

  const handleProviderChange = useCallback((newProvider: Provider) => {
    setDraft((prev) => {
      const updates: Partial<Settings> = { provider: newProvider };

      // Prefill default endpoints when switching to providers that use them
      if (newProvider === "openai" && !prev.apiEndpoint) {
        updates.apiEndpoint = "https://api.openai.com/v1";
      } else if (newProvider === "ollama" && !prev.apiEndpoint) {
        updates.apiEndpoint = "http://localhost:11434/api";
      } else if (newProvider !== "openai" && newProvider !== "ollama") {
        // Clear endpoint for providers that don't use it
        updates.apiEndpoint = "";
      }

      return { ...prev, ...updates };
    });
  }, []);

  const handleSave = useCallback(async () => {
    // Push draft into the store then persist to browser.storage
    updateSettings({ ...draft });
    await saveSettings();

    if (!saveStatus?.startsWith("Error")) {
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
      setTimeout(() => onBack(), 1500);
    }
  }, [draft, updateSettings, saveSettings, saveStatus, onBack]);

  const handleReset = useCallback(() => {
    setDraft({ ...DEFAULT_SETTINGS });
  }, []);

  // Compare draft against the live store snapshot (not the local draft baseline)
  const currentSettings: Settings = {
    apiKey: settings.apiKey,
    apiEndpoint: settings.apiEndpoint,
    model: settings.model,
    provider: settings.provider,
  };
  const hasChanges = JSON.stringify(draft) !== JSON.stringify(currentSettings);

  return (
    <ScrollArea className="h-full w-full">
      <div className="flex flex-col gap-5 px-4 py-4">
        {/* Header */}
        <div>
          <h2 className="text-sm font-semibold text-foreground">Settings</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Configure your AI provider connection.
          </p>
        </div>

        {/* Provider */}
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="provider" className="text-xs font-medium text-foreground">
            Provider
          </Label>
          <Select
            value={draft.provider}
            onValueChange={(value) => handleProviderChange(value as Provider)}
          >
            <SelectTrigger
              id="provider"
              className="h-8 w-full bg-secondary/50 border-border text-[13px] text-foreground"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-card border-border">
              {(Object.entries(PROVIDER_LABELS) as [Provider, string][]).map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Model */}
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="model" className="text-xs font-medium text-foreground">
            Model
          </Label>
          <Input
            id="model"
            type="text"
            value={draft.model}
            onChange={(e) => updateDraft("model", e.target.value)}
            placeholder={getModelPlaceholder(draft.provider)}
            className="h-8 bg-secondary/50 border-border text-[13px] text-foreground placeholder:text-muted-foreground focus-visible:ring-primary/40"
          />
        </div>

        {/* API Endpoint — only shown for providers that use it */}
        {showsEndpoint(draft.provider) && (
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="api-endpoint" className="text-xs font-medium text-foreground">
              {getEndpointLabel(draft.provider)}
            </Label>
            <Input
              id="api-endpoint"
              type="text"
              value={draft.apiEndpoint}
              onChange={(e) => updateDraft("apiEndpoint", e.target.value)}
              placeholder={getEndpointPlaceholder(draft.provider)}
              className="h-8 bg-secondary/50 border-border text-[13px] text-foreground placeholder:text-muted-foreground focus-visible:ring-primary/40"
            />
            {draft.provider === "ollama" && (
              <p className="text-xs text-muted-foreground">Make sure Ollama is running locally.</p>
            )}
          </div>
        )}

        {/* API Key */}
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="api-key" className="text-xs font-medium text-foreground">
            API Key{" "}
            {draft.provider === "ollama" && (
              <span className="text-muted-foreground font-normal">(Optional)</span>
            )}
          </Label>
          <div className="relative">
            <Input
              id="api-key"
              type={showApiKey ? "text" : "password"}
              value={draft.apiKey}
              onChange={(e) => updateDraft("apiKey", e.target.value)}
              placeholder="sk-..."
              className="h-8 pr-9 bg-secondary/50 border-border text-[13px] text-foreground placeholder:text-muted-foreground focus-visible:ring-primary/40"
            />
            <button
              type="button"
              onClick={() => setShowApiKey((prev) => !prev)}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
              aria-label={showApiKey ? "Hide API key" : "Show API key"}
            >
              {showApiKey ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
            </button>
          </div>
        </div>

        {/* Save Button */}
        <Button
          onClick={handleSave}
          disabled={!hasChanges && !saved}
          className={cn("h-8 mt-1 text-xs font-medium", saved && "bg-primary/80")}
        >
          {saved ? (
            <>
              <Check className="mr-1.5 h-3.5 w-3.5" />
              Saved
            </>
          ) : (
            "Save Settings"
          )}
        </Button>

        {/* Reset to defaults */}
        <button
          type="button"
          onClick={handleReset}
          className="text-[11px] text-muted-foreground hover:text-foreground transition-colors text-center"
        >
          Reset to defaults
        </button>
      </div>
    </ScrollArea>
  );
}
