/**
 * DuckDuckGo Search Provider
 *
 * Browser-based search provider that uses DuckDuckGo Lite.
 */

import { BrowserSearchProvider } from "./browserSearch.js";

export class DuckDuckGoSearchProvider extends BrowserSearchProvider {
  readonly name = "duckduckgo";

  getSearchUrl(query: string): string {
    return `https://lite.duckduckgo.com/lite/?q=${encodeURIComponent(query)}`;
  }
}
