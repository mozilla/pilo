import { describe, it, expect, vi, beforeEach } from "vitest";
import { SearchService } from "../../src/search/searchService.js";
import type { AriaBrowser } from "../../src/browser/ariaBrowser.js";

// Mock the search provider module
vi.mock("../../src/search/searchProvider.js", () => ({
  createSearchProvider: vi.fn(),
}));

import { createSearchProvider } from "../../src/search/searchProvider.js";

const mockCreateSearchProvider = vi.mocked(createSearchProvider);

const createMockBrowser = (): AriaBrowser =>
  ({
    browserName: "mock-browser",
    start: vi.fn(),
    shutdown: vi.fn(),
    goto: vi.fn(),
    goBack: vi.fn(),
    goForward: vi.fn(),
    getUrl: vi.fn().mockResolvedValue("https://example.com"),
    getTitle: vi.fn().mockResolvedValue("Example Page"),
    getTreeWithRefs: vi.fn().mockResolvedValue("<div>content</div>"),
    getMarkdown: vi.fn().mockResolvedValue("# Page Content"),
    getScreenshot: vi.fn().mockResolvedValue(Buffer.from("mock")),
    performAction: vi.fn(),
    waitForLoadState: vi.fn(),
    runInTemporaryTab: vi.fn(),
  }) as unknown as AriaBrowser;

describe("SearchService", () => {
  let mockBrowser: AriaBrowser;

  beforeEach(() => {
    vi.clearAllMocks();
    mockBrowser = createMockBrowser();
  });

  describe("create()", () => {
    it("should create a service with the given provider", async () => {
      const mockProvider = {
        name: "duckduckgo",
        requiresBrowser: true,
        search: vi.fn(),
      };
      mockCreateSearchProvider.mockResolvedValue(mockProvider);

      const service = await SearchService.create("duckduckgo", mockBrowser);

      expect(mockCreateSearchProvider).toHaveBeenCalledWith("duckduckgo", undefined);
      expect(service).toBeInstanceOf(SearchService);
    });

    it("should forward API key to provider factory", async () => {
      const mockProvider = {
        name: "parallel-api",
        requiresBrowser: false,
        search: vi.fn(),
      };
      mockCreateSearchProvider.mockResolvedValue(mockProvider);

      await SearchService.create("parallel-api", mockBrowser, { apiKey: "test-key" });

      expect(mockCreateSearchProvider).toHaveBeenCalledWith("parallel-api", { apiKey: "test-key" });
    });

    it("should propagate provider creation errors", async () => {
      mockCreateSearchProvider.mockRejectedValue(new Error("Provider init failed"));

      await expect(SearchService.create("duckduckgo", mockBrowser)).rejects.toThrow(
        "Provider init failed",
      );
    });
  });

  describe("search()", () => {
    it("should pass browser when provider requires it", async () => {
      const mockProvider = {
        name: "duckduckgo",
        requiresBrowser: true,
        search: vi.fn().mockResolvedValue("# Results"),
      };
      mockCreateSearchProvider.mockResolvedValue(mockProvider);

      const service = await SearchService.create("duckduckgo", mockBrowser);
      const result = await service.search("test query");

      expect(mockProvider.search).toHaveBeenCalledWith("test query", mockBrowser);
      expect(result).toBe(
        '# Results\n\n**IMPORTANT:** These are only search result summaries. When you find relevant results, use `goto({"url": "..."})` to visit the actual page and get complete information.',
      );
    });

    it("should not pass browser when provider does not require it", async () => {
      const mockProvider = {
        name: "parallel-api",
        requiresBrowser: false,
        search: vi.fn().mockResolvedValue("# API Results"),
      };
      mockCreateSearchProvider.mockResolvedValue(mockProvider);

      const service = await SearchService.create("parallel-api", mockBrowser, {
        apiKey: "key",
      });
      const result = await service.search("test query");

      expect(mockProvider.search).toHaveBeenCalledWith("test query", undefined);
      expect(result).toBe(
        '# API Results\n\n**IMPORTANT:** These are only search result summaries. When you find relevant results, use `goto({"url": "..."})` to visit the actual page and get complete information.',
      );
    });

    it("should propagate search errors", async () => {
      const mockProvider = {
        name: "duckduckgo",
        requiresBrowser: true,
        search: vi.fn().mockRejectedValue(new Error("Search failed")),
      };
      mockCreateSearchProvider.mockResolvedValue(mockProvider);

      const service = await SearchService.create("duckduckgo", mockBrowser);

      await expect(service.search("test query")).rejects.toThrow("Search failed");
    });
  });
});
