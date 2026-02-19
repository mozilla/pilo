/**
 * Bing Search Provider
 *
 * Browser-based search provider that uses Bing search.
 */

import { BrowserSearchProvider } from "./browserSearch.js";

export class BingSearchProvider extends BrowserSearchProvider {
  readonly name = "bing";

  getSearchUrl(query: string): string {
    return `https://www.bing.com/search?q=${encodeURIComponent(query)}`;
  }
}
