/**
 * SearchService
 *
 * Owns search provider lifecycle and browser coordination.
 * Created eagerly in WebAgent.execute() so initialization errors
 * surface before the main loop starts.
 */

import type { AriaBrowser } from "../browser/ariaBrowser.js";
import type { SearchProviderName } from "../configDefaults.js";
import {
  createSearchProvider,
  type SearchProvider,
  type CreateSearchProviderOptions,
} from "./searchProvider.js";

export class SearchService {
  private constructor(
    private readonly provider: SearchProvider,
    private readonly browser: AriaBrowser,
  ) {}

  static async create(
    providerName: Exclude<SearchProviderName, "none">,
    browser: AriaBrowser,
    options?: CreateSearchProviderOptions,
  ): Promise<SearchService> {
    const provider = await createSearchProvider(providerName, options);
    return new SearchService(provider, browser);
  }

  async search(query: string): Promise<string> {
    const browser = this.provider.requiresBrowser ? this.browser : undefined;
    return this.provider.search(query, browser);
  }
}
