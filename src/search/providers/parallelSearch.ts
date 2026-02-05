/**
 * Parallel API Search Provider
 *
 * API-based search provider that uses the Parallel API for search.
 * Returns results formatted as markdown for consistency with browser providers.
 */

import type { AriaBrowser } from "../../browser/ariaBrowser.js";
import type { SearchProvider } from "../searchProvider.js";

interface ParallelSearchResult {
  url: string;
  title?: string;
  excerpt?: string;
}

interface ParallelApiResponse {
  results?: ParallelSearchResult[];
  error?: string;
}

export class ParallelSearchProvider implements SearchProvider {
  readonly name = "parallel-api";
  readonly requiresBrowser = false;

  constructor(private apiKey: string) {}

  async search(query: string, _browser?: AriaBrowser): Promise<string> {
    const response = await fetch("https://api.parallel.ai/v1beta/search", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": this.apiKey,
        "parallel-beta": "search-extract-2025-10-10",
      },
      body: JSON.stringify({
        objective: query,
        search_queries: [query],
        excerpts: { max_chars_per_result: 10000 },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => "Unknown error");
      throw new Error(`Parallel API error (${response.status}): ${errorText}`);
    }

    const data = (await response.json()) as ParallelApiResponse;

    if (data.error) {
      throw new Error(`Parallel API error: ${data.error}`);
    }

    return this.formatAsMarkdown(query, data);
  }

  private formatAsMarkdown(query: string, data: ParallelApiResponse): string {
    if (!data.results || data.results.length === 0) {
      return `# Search Results for "${query}"\n\nNo results found.`;
    }

    const lines: string[] = [`# Search Results for "${query}"`, ""];

    data.results.forEach((result, index) => {
      const title = result.title || result.url;
      lines.push(`## ${index + 1}. [${title}](${result.url})`);
      lines.push("");
      if (result.excerpt) {
        lines.push(result.excerpt);
        lines.push("");
      }
    });

    return lines.join("\n");
  }
}
