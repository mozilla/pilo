import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import browser from "webextension-polyfill";
import { reviver } from "../utils/storage";

export interface Settings {
  apiKey: string;
  apiEndpoint: string;
  model: string;
  provider: "openai" | "openrouter" | "google" | "ollama";
}

export interface SettingsStore {
  settings: Settings;
  saveStatus: string | null;

  // Actions
  updateSettings: (updates: Partial<Settings>) => void;
  saveSettings: () => Promise<void>;
  loadSettings: () => Promise<void>;
  setSaveStatus: (status: string | null) => void;
}

const defaultSettings: Settings = {
  apiKey: "",
  apiEndpoint: "",
  model: "google/gemini-2.5-flash",
  provider: "openrouter",
};

// Create browser storage adapter for settings
const browserStorage = createJSONStorage(
  () => ({
    getItem: async (name: string): Promise<string | null> => {
      const result = await browser.storage.local.get(name);
      const value = result[name];
      return typeof value === "string" ? value : null;
    },
    setItem: async (name: string, value: string): Promise<void> => {
      await browser.storage.local.set({ [name]: value });
    },
    removeItem: async (name: string): Promise<void> => {
      await browser.storage.local.remove(name);
    },
  }),
  {
    reviver,
  },
);

export const useSettingsStore = create<SettingsStore>()(
  persist(
    (set, get) => ({
      settings: defaultSettings,
      saveStatus: null,

      updateSettings: (updates: Partial<Settings>) => {
        set((state) => ({
          settings: { ...state.settings, ...updates },
        }));
      },

      saveSettings: async () => {
        const { settings } = get();
        set({ saveStatus: "Saving..." });

        try {
          // Save directly to browser storage (bypassing Zustand persistence)
          await browser.storage.local.set({
            apiKey: settings.apiKey,
            apiEndpoint: settings.apiEndpoint,
            model: settings.model,
            provider: settings.provider,
          });

          set({ saveStatus: "Settings saved successfully!" });

          // Clear status after delay
          setTimeout(() => {
            set({ saveStatus: null });
          }, 1500);
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          set({ saveStatus: `Error: ${errorMessage}` });
          console.error("Save settings error:", error);
        }
      },

      loadSettings: async () => {
        try {
          const stored = await browser.storage.local.get([
            "apiKey",
            "apiEndpoint",
            "model",
            "provider",
          ]);

          // Validate provider value
          const isValidProvider =
            stored.provider === "openai" ||
            stored.provider === "openrouter" ||
            stored.provider === "google" ||
            stored.provider === "ollama";
          const provider = isValidProvider
            ? (stored.provider as "openai" | "openrouter" | "google" | "ollama")
            : defaultSettings.provider;

          const newSettings: Settings = {
            apiKey: (stored.apiKey as string) || defaultSettings.apiKey,
            apiEndpoint: (stored.apiEndpoint as string) || defaultSettings.apiEndpoint,
            model: (stored.model as string) || defaultSettings.model,
            provider,
          };

          set({ settings: newSettings });
        } catch (error) {
          console.error("Failed to load settings:", error);
          set({ settings: defaultSettings });
        }
      },

      setSaveStatus: (status: string | null) => {
        set({ saveStatus: status });
      },
    }),
    {
      name: "spark-settings",
      storage: browserStorage,
      // Only persist settings, not saveStatus
      partialize: (state) => ({
        settings: state.settings,
      }),
    },
  ),
);

/**
 * Hook for managing application settings
 */
export function useSettings() {
  const store = useSettingsStore();

  return {
    settings: store.settings,
    saveStatus: store.saveStatus,
    updateSettings: store.updateSettings,
    saveSettings: store.saveSettings,
    loadSettings: store.loadSettings,
    setSaveStatus: store.setSaveStatus,
  };
}
