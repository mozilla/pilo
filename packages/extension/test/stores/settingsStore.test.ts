import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Settings } from "../../src/stores/settingsStore.js";
import { useSettingsStore } from "../../src/stores/settingsStore.js";
import browser from "webextension-polyfill";

// Mock webextension-polyfill
vi.mock("webextension-polyfill", () => ({
  default: {
    storage: {
      local: {
        set: vi.fn(),
        get: vi.fn(),
        remove: vi.fn(),
      },
    },
  },
}));

describe("Settings Interface", () => {
  it("should include provider property", () => {
    const settings: Settings = {
      apiKey: "test-key",
      apiEndpoint: "https://api.openai.com/v1",
      model: "gpt-4",
      provider: "openai",
    };

    expect(settings.provider).toBe("openai");
  });

  it("should allow openrouter as provider", () => {
    const settings: Settings = {
      apiKey: "test-key",
      apiEndpoint: "https://openrouter.ai/api/v1",
      model: "gpt-4",
      provider: "openrouter",
    };

    expect(settings.provider).toBe("openrouter");
  });
});

describe("Storage Persistence", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should persist provider to storage when saving", async () => {
    const store = useSettingsStore.getState();

    // Update settings with provider
    store.updateSettings({
      apiKey: "test-key",
      apiEndpoint: "https://openrouter.ai/api/v1",
      model: "gpt-4",
      provider: "openrouter",
    });

    // Mock storage.local.set to resolve
    vi.mocked(browser.storage.local.set).mockResolvedValue(undefined);

    // Save settings
    await store.saveSettings();

    // Verify provider was included in the storage call
    expect(browser.storage.local.set).toHaveBeenCalledWith(
      expect.objectContaining({
        provider: "openrouter",
      }),
    );
  });
});

describe("Storage Loading", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset store state before each test
    useSettingsStore.setState({
      settings: {
        apiKey: "",
        apiEndpoint: "",
        model: "google/gemini-2.5-flash",
        provider: "openrouter",
      },
      saveStatus: null,
    });
  });

  it("should load provider from storage", async () => {
    // Mock storage with provider value
    vi.mocked(browser.storage.local.get).mockResolvedValue({
      apiKey: "stored-key",
      apiEndpoint: "https://openrouter.ai/api/v1",
      model: "gpt-4",
      provider: "openrouter",
    });

    // Load settings
    await useSettingsStore.getState().loadSettings();

    // Verify provider was loaded
    expect(useSettingsStore.getState().settings.provider).toBe("openrouter");
  });

  it("should fallback to default provider when not in storage", async () => {
    // Mock storage without provider value
    vi.mocked(browser.storage.local.get).mockResolvedValue({
      apiKey: "stored-key",
      apiEndpoint: "https://api.openai.com/v1",
      model: "gpt-4",
    });

    // Load settings
    await useSettingsStore.getState().loadSettings();

    // Verify provider falls back to openrouter (the default)
    expect(useSettingsStore.getState().settings.provider).toBe("openrouter");
  });

  it("should fallback to default provider for invalid values", async () => {
    // Mock storage with invalid provider value
    vi.mocked(browser.storage.local.get).mockResolvedValue({
      apiKey: "stored-key",
      apiEndpoint: "https://api.openai.com/v1",
      model: "gpt-4",
      provider: "invalid-provider",
    });

    // Load settings
    await useSettingsStore.getState().loadSettings();

    // Verify provider falls back to openrouter (the default)
    expect(useSettingsStore.getState().settings.provider).toBe("openrouter");
  });
});
