import { describe, it, expect, vi, beforeEach } from "vitest";
import browser from "webextension-polyfill";
import { applyConfigSeed } from "../../src/background/configSeed";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock("webextension-polyfill", () => ({
  default: {
    runtime: {
      getURL: vi.fn((path: string) => `chrome-extension://test-id/${path}`),
    },
    storage: {
      local: {
        set: vi.fn(),
        get: vi.fn(),
      },
    },
  },
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Create a minimal Response-like object returned by fetch(). */
function makeFetchResponse(body: string, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: () => Promise.resolve(body),
  } as unknown as Response;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("applyConfigSeed", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(browser.storage.local.set).mockResolvedValue(undefined);
  });

  // -------------------------------------------------------------------------
  // Successful fetch -- all 4 fields present
  // -------------------------------------------------------------------------

  describe("when pilo.config.json exists with all fields", () => {
    it("writes all four fields to browser.storage.local", async () => {
      const seed = {
        provider: "openrouter",
        model: "google/gemini-2.5-flash",
        apiKey: "sk-or-test-key",
        apiEndpoint: "https://openrouter.ai/api/v1",
      };

      vi.stubGlobal("fetch", vi.fn().mockResolvedValue(makeFetchResponse(JSON.stringify(seed))));

      await applyConfigSeed();

      expect(browser.storage.local.set).toHaveBeenCalledOnce();
      expect(browser.storage.local.set).toHaveBeenCalledWith({
        provider: "openrouter",
        model: "google/gemini-2.5-flash",
        apiKey: "sk-or-test-key",
        apiEndpoint: "https://openrouter.ai/api/v1",
      });
    });

    it("uses the URL returned by browser.runtime.getURL", async () => {
      const fetchMock = vi
        .fn()
        .mockResolvedValue(makeFetchResponse(JSON.stringify({ model: "x" })));
      vi.stubGlobal("fetch", fetchMock);

      await applyConfigSeed();

      expect(browser.runtime.getURL).toHaveBeenCalledWith("pilo.config.json");
      expect(fetchMock).toHaveBeenCalledWith("chrome-extension://test-id/pilo.config.json");
    });
  });

  // -------------------------------------------------------------------------
  // Successful fetch -- partial fields
  // -------------------------------------------------------------------------

  describe("when pilo.config.json has only some fields", () => {
    it("writes only the fields that are present (provider + model only)", async () => {
      const seed = { provider: "openai", model: "gpt-4o" };

      vi.stubGlobal("fetch", vi.fn().mockResolvedValue(makeFetchResponse(JSON.stringify(seed))));

      await applyConfigSeed();

      expect(browser.storage.local.set).toHaveBeenCalledOnce();
      expect(browser.storage.local.set).toHaveBeenCalledWith({
        provider: "openai",
        model: "gpt-4o",
      });
    });

    it("writes only apiKey when it is the sole field", async () => {
      const seed = { apiKey: "sk-test-only-key" };

      vi.stubGlobal("fetch", vi.fn().mockResolvedValue(makeFetchResponse(JSON.stringify(seed))));

      await applyConfigSeed();

      expect(browser.storage.local.set).toHaveBeenCalledOnce();
      expect(browser.storage.local.set).toHaveBeenCalledWith({ apiKey: "sk-test-only-key" });
    });

    it("writes only apiEndpoint when it is the sole field (ollama-style)", async () => {
      const seed = { apiEndpoint: "http://localhost:11434" };

      vi.stubGlobal("fetch", vi.fn().mockResolvedValue(makeFetchResponse(JSON.stringify(seed))));

      await applyConfigSeed();

      expect(browser.storage.local.set).toHaveBeenCalledOnce();
      expect(browser.storage.local.set).toHaveBeenCalledWith({
        apiEndpoint: "http://localhost:11434",
      });
    });

    it("does not write fields that are absent from the seed file", async () => {
      // apiKey and apiEndpoint absent -- should NOT appear in storage.local.set call
      const seed = { provider: "google", model: "gemini-1.5-pro" };

      vi.stubGlobal("fetch", vi.fn().mockResolvedValue(makeFetchResponse(JSON.stringify(seed))));

      await applyConfigSeed();

      const call = vi.mocked(browser.storage.local.set).mock.calls[0][0] as Record<string, string>;
      expect(call).not.toHaveProperty("apiKey");
      expect(call).not.toHaveProperty("apiEndpoint");
    });
  });

  // -------------------------------------------------------------------------
  // File not found (404)
  // -------------------------------------------------------------------------

  describe("when pilo.config.json returns a 404", () => {
    it("does not write anything to storage", async () => {
      vi.stubGlobal("fetch", vi.fn().mockResolvedValue(makeFetchResponse("", 404)));

      await applyConfigSeed();

      expect(browser.storage.local.set).not.toHaveBeenCalled();
    });

    it("resolves without throwing", async () => {
      vi.stubGlobal("fetch", vi.fn().mockResolvedValue(makeFetchResponse("", 404)));

      await expect(applyConfigSeed()).resolves.toBeUndefined();
    });
  });

  // -------------------------------------------------------------------------
  // Invalid JSON
  // -------------------------------------------------------------------------

  describe("when pilo.config.json contains invalid JSON", () => {
    it("does not write anything to storage", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue(makeFetchResponse("{ this is not json }", 200)),
      );

      await applyConfigSeed();

      expect(browser.storage.local.set).not.toHaveBeenCalled();
    });

    it("resolves without throwing", async () => {
      vi.stubGlobal("fetch", vi.fn().mockResolvedValue(makeFetchResponse("corrupted", 200)));

      await expect(applyConfigSeed()).resolves.toBeUndefined();
    });
  });

  // -------------------------------------------------------------------------
  // Fetch error (network failure, etc.)
  // -------------------------------------------------------------------------

  describe("when fetch throws an error", () => {
    it("does not write anything to storage", async () => {
      vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("Network failure")));

      await applyConfigSeed();

      expect(browser.storage.local.set).not.toHaveBeenCalled();
    });

    it("resolves without throwing", async () => {
      vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));

      await expect(applyConfigSeed()).resolves.toBeUndefined();
    });
  });

  // -------------------------------------------------------------------------
  // Overriding existing values
  // -------------------------------------------------------------------------

  describe("overriding existing storage values", () => {
    it("overwrites whatever was previously in storage", async () => {
      // browser.storage.local.set is a direct write -- it always wins over prior values.
      // This test verifies the correct keys are sent to set() (browser handles the merge).
      const seed = {
        provider: "ollama",
        model: "llama3.2",
        apiEndpoint: "http://localhost:11434",
      };

      vi.stubGlobal("fetch", vi.fn().mockResolvedValue(makeFetchResponse(JSON.stringify(seed))));

      await applyConfigSeed();

      // The seed values must be sent to storage regardless of what was there before.
      expect(browser.storage.local.set).toHaveBeenCalledWith({
        provider: "ollama",
        model: "llama3.2",
        apiEndpoint: "http://localhost:11434",
      });
    });

    it("does not clear fields absent from the seed (only present fields are sent)", async () => {
      // If the seed only has apiKey, the set() call must NOT include model/provider/apiEndpoint,
      // so existing storage values for those keys are preserved.
      const seed = { apiKey: "new-sk-key" };

      vi.stubGlobal("fetch", vi.fn().mockResolvedValue(makeFetchResponse(JSON.stringify(seed))));

      await applyConfigSeed();

      const writtenFields = vi.mocked(browser.storage.local.set).mock.calls[0][0] as Record<
        string,
        string
      >;
      expect(Object.keys(writtenFields)).toEqual(["apiKey"]);
    });
  });

  // -------------------------------------------------------------------------
  // Edge cases
  // -------------------------------------------------------------------------

  describe("edge cases", () => {
    it("ignores empty string values for apiKey", async () => {
      const seed = { apiKey: "", model: "gpt-4o" };

      vi.stubGlobal("fetch", vi.fn().mockResolvedValue(makeFetchResponse(JSON.stringify(seed))));

      await applyConfigSeed();

      const call = vi.mocked(browser.storage.local.set).mock.calls[0][0] as Record<string, string>;
      expect(call).not.toHaveProperty("apiKey");
      expect(call).toHaveProperty("model", "gpt-4o");
    });

    it("ignores an invalid provider value", async () => {
      // "vertex" is not in the extension's supported provider list
      const seed = { provider: "vertex", model: "gemini-pro" };

      vi.stubGlobal("fetch", vi.fn().mockResolvedValue(makeFetchResponse(JSON.stringify(seed))));

      await applyConfigSeed();

      const call = vi.mocked(browser.storage.local.set).mock.calls[0][0] as Record<string, string>;
      expect(call).not.toHaveProperty("provider");
    });

    it("does nothing when the seed object has no valid fields at all", async () => {
      // All values empty or unrecognised
      const seed = { provider: "unsupported", apiKey: "", model: "" };

      vi.stubGlobal("fetch", vi.fn().mockResolvedValue(makeFetchResponse(JSON.stringify(seed))));

      await applyConfigSeed();

      expect(browser.storage.local.set).not.toHaveBeenCalled();
    });

    it("handles all four valid providers", async () => {
      const providers = ["openai", "openrouter", "google", "ollama"] as const;

      for (const provider of providers) {
        vi.clearAllMocks();
        vi.mocked(browser.storage.local.set).mockResolvedValue(undefined);

        vi.stubGlobal(
          "fetch",
          vi.fn().mockResolvedValue(makeFetchResponse(JSON.stringify({ provider }))),
        );

        await applyConfigSeed();

        expect(browser.storage.local.set).toHaveBeenCalledWith({ provider });
      }
    });
  });
});
