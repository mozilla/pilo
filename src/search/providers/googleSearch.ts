/**
 * Google Search Provider
 *
 * Browser-based search provider that uses Google search.
 */

import { BrowserSearchProvider } from "./browserSearch.js";

export class GoogleSearchProvider extends BrowserSearchProvider {
  readonly name = "google";

  getSearchUrl(query: string): string {
    return `https://www.google.com/search?q=${encodeURIComponent(query)}`;
  }
}
