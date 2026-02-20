import browser from "webextension-polyfill";

type SeedProvider = "openai" | "openrouter" | "google" | "ollama";

/**
 * The shape of `pilo.config.json` written by the CLI into the extension directory.
 * All fields are optional -- the CLI only writes fields with meaningful values.
 */
export interface PiloConfigSeed {
  provider?: SeedProvider;
  model?: string;
  apiKey?: string;
  apiEndpoint?: string;
}

/** Valid provider values the extension settings store accepts. */
const VALID_PROVIDERS: ReadonlySet<string> = new Set<SeedProvider>([
  "openai",
  "openrouter",
  "google",
  "ollama",
]);

/**
 * Reads `pilo.config.json` from the extension's root directory (written by the CLI
 * during `pilo extension install`) and writes any present fields into
 * `browser.storage.local`, overriding existing user-set values.
 *
 * Silently does nothing if:
 * - The file is absent (404)
 * - The fetch throws for any reason
 * - The file content is not valid JSON
 * - The parsed object contains no recognised fields
 */
export async function applyConfigSeed(): Promise<void> {
  let seed: PiloConfigSeed;

  try {
    const url = browser.runtime.getURL("pilo.config.json");
    const response = await fetch(url);

    if (!response.ok) {
      // File not present (most likely a 404 in dev without the seed file) -- no-op.
      return;
    }

    const raw = await response.text();
    seed = JSON.parse(raw) as PiloConfigSeed;
  } catch {
    // Fetch error or JSON parse error -- silently continue.
    return;
  }

  // Build a partial storage object from only the valid, present fields.
  const toWrite: Record<string, string> = {};

  if (typeof seed.apiKey === "string" && seed.apiKey.length > 0) {
    toWrite.apiKey = seed.apiKey;
  }

  if (typeof seed.apiEndpoint === "string" && seed.apiEndpoint.length > 0) {
    toWrite.apiEndpoint = seed.apiEndpoint;
  }

  if (typeof seed.model === "string" && seed.model.length > 0) {
    toWrite.model = seed.model;
  }

  if (typeof seed.provider === "string" && VALID_PROVIDERS.has(seed.provider)) {
    toWrite.provider = seed.provider;
  }

  if (Object.keys(toWrite).length === 0) {
    return;
  }

  try {
    await browser.storage.local.set(toWrite);
    console.log("Pilo: applied config seed from pilo.config.json", Object.keys(toWrite));
  } catch (error) {
    console.error("Pilo: failed to apply config seed:", error);
  }
}
