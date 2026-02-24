import { describe, it, expect } from "vitest";
import {
  mapConfigToExtensionSettings,
  EXTENSION_SUPPORTED_PROVIDERS,
} from "../src/extensionConfig.js";
import type { PiloConfig } from "pilo-core";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Minimal PiloConfig with no fields set (empty input). */
const emptyConfig: PiloConfig = {};

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------

describe("mapConfigToExtensionSettings", () => {
  // -------------------------------------------------------------------------
  // Supported providers
  // -------------------------------------------------------------------------

  describe("openai provider", () => {
    it("maps provider and apiKey from openai_api_key", () => {
      const result = mapConfigToExtensionSettings({
        provider: "openai",
        model: "gpt-4.1",
        openai_api_key: "sk-test-abc123",
      });

      expect(result).toEqual({
        provider: "openai",
        model: "gpt-4.1",
        apiKey: "sk-test-abc123",
      });
    });

    it("omits apiKey when openai_api_key is absent", () => {
      const result = mapConfigToExtensionSettings({
        provider: "openai",
        model: "gpt-4.1",
      });

      expect(result).toEqual({ provider: "openai", model: "gpt-4.1" });
      expect(result).not.toHaveProperty("apiKey");
    });

    it("omits apiKey when openai_api_key is an empty string", () => {
      const result = mapConfigToExtensionSettings({
        provider: "openai",
        openai_api_key: "",
      });

      expect(result).toEqual({ provider: "openai" });
      expect(result).not.toHaveProperty("apiKey");
    });

    it("does not include apiEndpoint for openai", () => {
      const result = mapConfigToExtensionSettings({
        provider: "openai",
        openai_api_key: "sk-test-abc123",
      });

      expect(result).not.toHaveProperty("apiEndpoint");
    });
  });

  describe("openrouter provider", () => {
    it("maps provider and apiKey from openrouter_api_key", () => {
      const result = mapConfigToExtensionSettings({
        provider: "openrouter",
        model: "openai/gpt-4.1",
        openrouter_api_key: "sk-or-test-abc123",
      });

      expect(result).toEqual({
        provider: "openrouter",
        model: "openai/gpt-4.1",
        apiKey: "sk-or-test-abc123",
      });
    });

    it("omits apiKey when openrouter_api_key is absent", () => {
      const result = mapConfigToExtensionSettings({
        provider: "openrouter",
      });

      expect(result).toEqual({ provider: "openrouter" });
      expect(result).not.toHaveProperty("apiKey");
    });

    it("omits apiKey when openrouter_api_key is an empty string", () => {
      const result = mapConfigToExtensionSettings({
        provider: "openrouter",
        openrouter_api_key: "",
      });

      expect(result).toEqual({ provider: "openrouter" });
      expect(result).not.toHaveProperty("apiKey");
    });

    it("does not include apiEndpoint for openrouter", () => {
      const result = mapConfigToExtensionSettings({
        provider: "openrouter",
        openrouter_api_key: "sk-or-test-abc123",
      });

      expect(result).not.toHaveProperty("apiEndpoint");
    });
  });

  describe("google provider", () => {
    it("maps provider and apiKey from google_generative_ai_api_key", () => {
      const result = mapConfigToExtensionSettings({
        provider: "google",
        model: "gemini-2.5-flash",
        google_generative_ai_api_key: "AIzaSy-fake-google-key",
      });

      expect(result).toEqual({
        provider: "google",
        model: "gemini-2.5-flash",
        apiKey: "AIzaSy-fake-google-key",
      });
    });

    it("omits apiKey when google_generative_ai_api_key is absent", () => {
      const result = mapConfigToExtensionSettings({
        provider: "google",
        model: "gemini-2.5-flash",
      });

      expect(result).toEqual({ provider: "google", model: "gemini-2.5-flash" });
      expect(result).not.toHaveProperty("apiKey");
    });

    it("omits apiKey when google_generative_ai_api_key is an empty string", () => {
      const result = mapConfigToExtensionSettings({
        provider: "google",
        google_generative_ai_api_key: "",
      });

      expect(result).toEqual({ provider: "google" });
      expect(result).not.toHaveProperty("apiKey");
    });

    it("does not include apiEndpoint for google (API-key-only auth)", () => {
      const result = mapConfigToExtensionSettings({
        provider: "google",
        google_generative_ai_api_key: "AIzaSy-fake-google-key",
      });

      expect(result).not.toHaveProperty("apiEndpoint");
    });
  });

  describe("ollama provider", () => {
    it("maps provider and apiEndpoint from ollama_base_url", () => {
      const result = mapConfigToExtensionSettings({
        provider: "ollama",
        model: "llama3.2",
        ollama_base_url: "http://localhost:11434",
      });

      expect(result).toEqual({
        provider: "ollama",
        model: "llama3.2",
        apiEndpoint: "http://localhost:11434",
      });
    });

    it("omits apiEndpoint when ollama_base_url is absent", () => {
      const result = mapConfigToExtensionSettings({
        provider: "ollama",
        model: "llama3.2",
      });

      expect(result).toEqual({ provider: "ollama", model: "llama3.2" });
      expect(result).not.toHaveProperty("apiEndpoint");
    });

    it("omits apiEndpoint when ollama_base_url is an empty string", () => {
      const result = mapConfigToExtensionSettings({
        provider: "ollama",
        ollama_base_url: "",
      });

      expect(result).toEqual({ provider: "ollama" });
      expect(result).not.toHaveProperty("apiEndpoint");
    });

    it("does not include apiKey for ollama (no API key needed)", () => {
      const result = mapConfigToExtensionSettings({
        provider: "ollama",
        ollama_base_url: "http://localhost:11434",
      });

      expect(result).not.toHaveProperty("apiKey");
    });

    it("maps a custom ollama endpoint correctly", () => {
      const result = mapConfigToExtensionSettings({
        provider: "ollama",
        model: "phi3",
        ollama_base_url: "http://remote-host:11434/api",
      });

      expect(result).toEqual({
        provider: "ollama",
        model: "phi3",
        apiEndpoint: "http://remote-host:11434/api",
      });
    });
  });

  // -------------------------------------------------------------------------
  // Unsupported providers
  // -------------------------------------------------------------------------

  describe("unsupported providers", () => {
    it("omits provider for 'vertex'", () => {
      const result = mapConfigToExtensionSettings({
        provider: "vertex",
        model: "gemini-1.5-pro",
        vertex_project: "my-project",
      });

      expect(result).not.toHaveProperty("provider");
    });

    it("still maps model even when provider is unsupported", () => {
      const result = mapConfigToExtensionSettings({
        provider: "vertex",
        model: "gemini-1.5-pro",
      });

      expect(result.model).toBe("gemini-1.5-pro");
    });

    it("omits apiKey and apiEndpoint for unsupported providers", () => {
      const result = mapConfigToExtensionSettings({
        provider: "vertex",
        vertex_project: "my-project",
      });

      expect(result).not.toHaveProperty("apiKey");
      expect(result).not.toHaveProperty("apiEndpoint");
    });

    it("omits provider for 'openai-compatible'", () => {
      const result = mapConfigToExtensionSettings({
        provider: "openai-compatible",
        openai_compatible_base_url: "http://localhost:8080/v1",
      });

      expect(result).not.toHaveProperty("provider");
    });

    it("omits provider for 'lmstudio'", () => {
      const result = mapConfigToExtensionSettings({
        provider: "lmstudio",
        model: "my-local-model",
      });

      expect(result).not.toHaveProperty("provider");
    });
  });

  // -------------------------------------------------------------------------
  // Missing / undefined / empty fields
  // -------------------------------------------------------------------------

  describe("missing and undefined fields", () => {
    it("returns an empty object for an empty config", () => {
      const result = mapConfigToExtensionSettings(emptyConfig);

      expect(result).toEqual({});
    });

    it("omits model when it is undefined", () => {
      const result = mapConfigToExtensionSettings({ provider: "openai" });

      expect(result).not.toHaveProperty("model");
    });

    it("omits model when it is an empty string", () => {
      const result = mapConfigToExtensionSettings({ provider: "openai", model: "" });

      expect(result).not.toHaveProperty("model");
    });

    it("omits provider when config.provider is undefined", () => {
      const result = mapConfigToExtensionSettings({ model: "gpt-4.1" });

      expect(result).not.toHaveProperty("provider");
    });

    it("includes only the fields that have meaningful values", () => {
      const result = mapConfigToExtensionSettings({
        provider: "openai",
        openai_api_key: "sk-test-abc123",
        // model intentionally omitted
      });

      expect(Object.keys(result)).toEqual(["provider", "apiKey"]);
    });
  });

  // -------------------------------------------------------------------------
  // Output shape compatibility with extension Settings interface
  // -------------------------------------------------------------------------

  describe("output shape matches extension Settings interface", () => {
    it("all present fields use the correct property names expected by the extension", () => {
      const result = mapConfigToExtensionSettings({
        provider: "openai",
        model: "gpt-4.1",
        openai_api_key: "sk-test-abc123",
      });

      // The extension's Settings interface expects exactly these keys
      const allowedKeys: Array<keyof typeof result> = [
        "provider",
        "model",
        "apiKey",
        "apiEndpoint",
      ];
      for (const key of Object.keys(result)) {
        expect(allowedKeys).toContain(key);
      }
    });

    it("provider value is always one of the 4 extension-supported values when present", () => {
      const providers: Array<PiloConfig["provider"]> = [
        "openai",
        "openrouter",
        "google",
        "ollama",
        "vertex",
        "openai-compatible",
        "lmstudio",
      ];

      for (const provider of providers) {
        const result = mapConfigToExtensionSettings({ provider });
        if (result.provider !== undefined) {
          expect(EXTENSION_SUPPORTED_PROVIDERS).toContain(result.provider);
        }
      }
    });

    it("a fully-populated openrouter config produces a clean settings object", () => {
      const result = mapConfigToExtensionSettings({
        provider: "openrouter",
        model: "anthropic/claude-3-5-sonnet",
        openrouter_api_key: "sk-or-fake-key-abc123",
        // Non-extension fields should not leak into the output
        headless: true,
        debug: false,
        max_iterations: 50,
        browser: "firefox",
      });

      expect(result).toEqual({
        provider: "openrouter",
        model: "anthropic/claude-3-5-sonnet",
        apiKey: "sk-or-fake-key-abc123",
      });
    });
  });
});
