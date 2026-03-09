/**
 * Tabstack SDK client factory.
 *
 * Thin wrapper around the @tabstack/sdk to create client instances
 * from an API key. The caller manages the client lifecycle.
 */

import Tabstack from "@tabstack/sdk";

export type { default as Tabstack } from "@tabstack/sdk";

export function createTabstackClient(apiKey: string): Tabstack {
  return new Tabstack({ apiKey });
}
