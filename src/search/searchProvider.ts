/**
 * Search Provider Interface and Factory
 *
 * All providers return markdown strings. The LLM parses the results
 * just like it parses any other web page - no brittle parsing needed.
 */

import type { AriaBrowser } from "../browser/ariaBrowser.js";
import type { SearchProvider as SearchProviderType } from "../configDefaults.js";

export interface SearchProvider {
  readonly name: string;
  readonly requiresBrowser: boolean;
  search(query: string, browser?: AriaBrowser): Promise<string>;
}

export interface CreateSearchProviderOptions {
  /** API key for providers that require authentication (e.g., Parallel) */
  apiKey?: string;
}

/**
 * Creates a search provider based on the given provider name.
 * API keys should be passed via options (typically read from config by the caller).
 */
export async function createSearchProvider(
  providerName: Exclude<SearchProviderType, "none">,
  options: CreateSearchProviderOptions = {},
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
    case "parallel-api": {
      if (!options.apiKey) {
        throw new Error("Parallel API key is required for parallel-api search provider");
      }
      const { ParallelSearchProvider } = await import("./providers/parallelSearch.js");
      return new ParallelSearchProvider(options.apiKey);
    }
    default:
      throw new Error(`Unknown search provider: ${providerName}`);
  }
}
