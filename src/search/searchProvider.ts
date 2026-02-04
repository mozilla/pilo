/**
 * Search Provider Interface and Factory
 *
 * All providers return markdown strings. The LLM parses the results
 * just like it parses any other web page - no brittle parsing needed.
 */

import type { AriaBrowser } from "../browser/ariaBrowser.js";
import type { SearchProvider as SearchProviderType } from "../configDefaults.js";
import { config } from "../config.js";

export interface SearchProvider {
  readonly name: string;
  readonly requiresBrowser: boolean;
  search(query: string, browser?: AriaBrowser): Promise<string>;
}

/**
 * Creates a search provider based on the given provider name.
 * API keys are read from config (set via environment variables).
 */
export async function createSearchProvider(
  providerName: Exclude<SearchProviderType, "none">,
): Promise<SearchProvider> {

  switch (providerName) {
    case "duckduckgo": {
      const { DuckDuckGoSearchProvider } = await import("./providers/duckduckgoSearch.js");
      return new DuckDuckGoSearchProvider();
    }
    case "google": {
      const { GoogleSearchProvider } = await import("./providers/googleSearch.js");
      return new GoogleSearchProvider();
    }
    case "bing": {
      const { BingSearchProvider } = await import("./providers/bingSearch.js");
      return new BingSearchProvider();
    }
    case "parallel": {
      const apiKey = config.get("parallel_api_key");
      if (!apiKey) {
        throw new Error("Parallel API key is required for parallel search provider");
      }
      const { ParallelSearchProvider } = await import("./providers/parallelSearch.js");
      return new ParallelSearchProvider(apiKey);
    }
    default:
      throw new Error(`Unknown search provider: ${providerName}`);
  }
}
