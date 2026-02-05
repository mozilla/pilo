/**
 * Browser-based Search Provider Base Class
 *
 * Abstract base class for search providers that navigate to search engines
 * and return markdown. The LLM parses the results like any other web page.
 */

import type { AriaBrowser } from "../../browser/ariaBrowser.js";
import { LoadState } from "../../browser/ariaBrowser.js";
import type { SearchProvider } from "../searchProvider.js";

/**
 * Abstract base class for browser-based search providers.
 * Subclasses just provide the search URL - no parsing needed.
 *
 * Search is performed in an isolated tab so the agent's current page
 * context is preserved.
 */
export abstract class BrowserSearchProvider implements SearchProvider {
  readonly requiresBrowser = true;

  abstract readonly name: string;

  /**
   * Get the search URL for the given query.
   */
  abstract getSearchUrl(query: string): string;

  /**
   * Search for the given query using the browser in an isolated tab.
   * Returns the page markdown for the LLM to parse.
   */
  async search(query: string, browser?: AriaBrowser): Promise<string> {
    if (!browser) {
      throw new Error(`${this.name} search requires a browser`);
    }

    const url = this.getSearchUrl(query);

    const markdown = await browser.runInIsolatedTab(async (tab) => {
      await tab.goto(url);
      await tab.waitForLoadState(LoadState.Load);
      return tab.getMarkdown();
    });

    return `# Search Results for "${query}" (via ${this.name})\n\n\`\`\`\n${markdown}\n\`\`\``;
  }
}
