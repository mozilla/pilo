/**
 * Extension Config Mapping
 *
 * Maps a full PiloConfig (from the core config system) to the extension's
 * settings shape. Used by the CLI to extract the 4 extension-relevant fields
 * when writing the seed config file (pilo.config.json) during extension install.
 *
 * The extension only supports a subset of providers. Unsupported providers
 * (vertex, openai-compatible, lmstudio) are silently dropped so the seed file
 * never contains a value that the extension cannot handle.
 */

import type { PiloConfig } from "pilo-core";

// Providers the extension's settings store accepts (mirrors the Settings type
// in packages/extension/src/ui/stores/settingsStore.ts).
export const EXTENSION_SUPPORTED_PROVIDERS = ["openai", "openrouter", "google", "ollama"] as const;
export type ExtensionProvider = (typeof EXTENSION_SUPPORTED_PROVIDERS)[number];

/**
 * The settings shape the extension expects (matches the Settings interface in
 * packages/extension/src/ui/stores/settingsStore.ts).
 */
export interface ExtensionSettings {
  provider?: ExtensionProvider;
  model?: string;
  apiKey?: string;
  apiEndpoint?: string;
}

/**
 * Map a PiloConfig to the extension's settings shape.
 *
 * Rules:
 * - Only fields with meaningful (non-empty) values are included in the result.
 * - Providers not supported by the extension are mapped to `undefined` and
 *   therefore omitted from the output.
 * - API keys and endpoint URLs are lifted from their provider-specific fields
 *   in PiloConfig and unified into `apiKey` / `apiEndpoint`.
 *
 * @param config - A PiloConfig or PiloConfigResolved from the core config system.
 * @returns An ExtensionSettings object containing only the fields that have
 *          meaningful values. Fields with no value are not present in the object.
 */
export function mapConfigToExtensionSettings(config: PiloConfig): ExtensionSettings {
  const result: ExtensionSettings = {};

  // --- provider ---
  const rawProvider = config.provider;
  const isSupported =
    rawProvider !== undefined &&
    (EXTENSION_SUPPORTED_PROVIDERS as readonly string[]).includes(rawProvider);
  const provider: ExtensionProvider | undefined = isSupported
    ? (rawProvider as ExtensionProvider)
    : undefined;

  if (provider !== undefined) {
    result.provider = provider;
  }

  // --- model ---
  if (config.model !== undefined && config.model !== "") {
    result.model = config.model;
  }

  // --- apiKey and apiEndpoint (provider-specific) ---
  switch (provider) {
    case "openai": {
      if (config.openai_api_key !== undefined && config.openai_api_key !== "") {
        result.apiKey = config.openai_api_key;
      }
      // OpenAI uses a fixed, well-known endpoint; the extension handles it
      // natively so we do not need to inject apiEndpoint here.
      break;
    }

    case "openrouter": {
      if (config.openrouter_api_key !== undefined && config.openrouter_api_key !== "") {
        result.apiKey = config.openrouter_api_key;
      }
      // OpenRouter also has a fixed endpoint understood by the extension.
      break;
    }

    case "google": {
      if (
        config.google_generative_ai_api_key !== undefined &&
        config.google_generative_ai_api_key !== ""
      ) {
        result.apiKey = config.google_generative_ai_api_key;
      }
      // Google uses API key authentication only; no endpoint needed.
      break;
    }

    case "ollama": {
      // Ollama requires no API key.
      if (config.ollama_base_url !== undefined && config.ollama_base_url !== "") {
        result.apiEndpoint = config.ollama_base_url;
      }
      break;
    }

    default:
      // Unsupported or undefined provider: no apiKey / apiEndpoint to extract.
      break;
  }

  return result;
}
