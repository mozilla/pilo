/**
 * Exa API Search Provider
 *
 * API-based search provider that uses the Exa API for search.
 * Returns results formatted as markdown for consistency with browser providers.
 */

import type { AriaBrowser } from "../../browser/ariaBrowser.js";
import type { SearchProvider } from "../searchProvider.js";
import {
  wrapExternalContentWithWarning,
  ExternalContentLabel,
} from "../../utils/promptSecurity.js";
import { abbreviateForDebug } from "../debugPreview.js";

interface ExaSearchResult {
  url: string;
  title?: string;
  highlights?: string[];
}

interface ExaApiResponse {
  results?: ExaSearchResult[];
}

export class ExaSearchProvider implements SearchProvider {
  readonly name = "exa-api";
  readonly requiresBrowser = false;

  constructor(
    private apiKey: string,
    private debug = false,
  ) {}

  async search(query: string, _browser?: AriaBrowser): Promise<string> {
    const url = "https://api.exa.ai/search";
    const body = JSON.stringify({
      query,
      // Opt into highlights, or Exa returns metadata only (no snippets).
      contents: { highlights: { maxCharacters: 1500 } },
    });

    if (this.debug) {
      // Log the exact outbound request body (sans API key) so the query and
      // contents options are observable. Matches the [X:debug] console.warn convention.
      console.warn(`[ExaSearch:debug] POST ${url}`, body);
    }

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": this.apiKey,
      },
      body,
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => "Unknown error");
      throw new Error(`Exa API error (${response.status}): ${errorText}`);
    }

    const data = (await response.json()) as ExaApiResponse;

    if (this.debug) {
      // Log the count plus an abbreviated sample of the first result so all
      // returned fields (including ones we don't map, like summary/score/
      // publishedDate) are visible, with long strings truncated.
      const results = data.results ?? [];
      console.warn(
        `[ExaSearch:debug] response: ${results.length} result(s), sample:`,
        abbreviateForDebug(results[0]),
      );
    }

    return this.formatAsMarkdown(query, data);
  }

  private formatAsMarkdown(query: string, data: ExaApiResponse): string {
    const header = `# Search Results for "${query}" (via ${this.name})`;

    let wrapped: string;
    if (!data.results || data.results.length === 0) {
      wrapped = wrapExternalContentWithWarning(
        `${header}\n\nNo results found.`,
        ExternalContentLabel.SearchResults,
      );
    } else {
      const lines: string[] = [];

      data.results.forEach((result, index) => {
        const title = result.title || result.url;
        lines.push(`${index + 1}. [${title}](${result.url})`);
        if (result.highlights?.length) {
          lines.push(result.highlights.join("\n"));
        }
        lines.push("");
      });

      wrapped = wrapExternalContentWithWarning(
        `${header}\n\n${lines.join("\n").trim()}`,
        ExternalContentLabel.SearchResults,
      );
    }

    return wrapped;
  }
}
