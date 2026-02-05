import { describe, it, expect, vi, beforeEach } from "vitest";
import { createSearchTools } from "../../src/tools/searchTools.js";
import { WebAgentEventEmitter, WebAgentEventType } from "../../src/events.js";
import type { AriaBrowser } from "../../src/browser/ariaBrowser.js";

// Mock the ai module
vi.mock("ai", () => ({
  tool: vi.fn((config: unknown) => {
    const typedConfig = config as {
      description: string;
      inputSchema: unknown;
      execute: (args: unknown, options?: unknown) => Promise<unknown>;
    };
    return {
      ...typedConfig,
      description: typedConfig.description,
      inputSchema: typedConfig.inputSchema,
      execute: typedConfig.execute,
    };
  }),
}));

// Mock the search provider module
vi.mock("../../src/search/searchProvider.js", () => ({
  createSearchProvider: vi.fn(),
}));

import { createSearchProvider } from "../../src/search/searchProvider.js";

const mockCreateSearchProvider = vi.mocked(createSearchProvider);

// Mock browser
const createMockBrowser = (): AriaBrowser => ({
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
  runInIsolatedTab: vi.fn(),
});

describe("Search Tools", () => {
  let mockBrowser: AriaBrowser;
  let eventEmitter: WebAgentEventEmitter;
  let tools: ReturnType<typeof createSearchTools>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockBrowser = createMockBrowser();
    eventEmitter = new WebAgentEventEmitter();
    tools = createSearchTools({
      browser: mockBrowser,
      eventEmitter,
      searchProvider: "duckduckgo",
      searchApiKey: undefined,
    });
  });

  describe("Tool Structure", () => {
    it("should create webSearch tool", () => {
      expect(tools).toBeDefined();
      expect(tools.webSearch).toBeDefined();
    });

    it("should have correct description", () => {
      expect(tools.webSearch.description).toContain("Search the web");
    });

    it("should have correct input schema", () => {
      const schema = tools.webSearch.inputSchema as {
        safeParse: (input: unknown) => { success: boolean };
      };
      expect(schema).toBeDefined();

      // Valid input
      const valid = schema.safeParse({ query: "test search" });
      expect(valid.success).toBe(true);

      // Missing query
      const invalid = schema.safeParse({});
      expect(invalid.success).toBe(false);
    });
  });

  describe("webSearch execution", () => {
    it("should execute search with browser-based provider", async () => {
      const mockMarkdown = "# Search Results\n\n1. [Result](https://example.com)";
      const mockProvider = {
        name: "duckduckgo",
        requiresBrowser: true,
        search: vi.fn().mockResolvedValue(mockMarkdown),
      };
      mockCreateSearchProvider.mockResolvedValue(mockProvider);

      const result = await tools.webSearch.execute!({ query: "test query" }, {
        toolCallId: "test",
        messages: [],
      } as any);

      expect(mockCreateSearchProvider).toHaveBeenCalledWith("duckduckgo", {
        apiKey: undefined,
      });
      expect(mockProvider.search).toHaveBeenCalledWith("test query", mockBrowser);
      expect(result).toEqual({
        success: true,
        action: "webSearch",
        query: "test query",
        markdown: mockMarkdown,
      });
    });

    it("should execute search with API-based provider (no browser)", async () => {
      const mockMarkdown = "# Search Results\n\n1. [Result](https://example.com)";
      const mockProvider = {
        name: "parallel",
        requiresBrowser: false,
        search: vi.fn().mockResolvedValue(mockMarkdown),
      };
      mockCreateSearchProvider.mockResolvedValue(mockProvider);

      const result = await tools.webSearch.execute!({ query: "test query" }, {
        toolCallId: "test",
        messages: [],
      } as any);

      expect(mockProvider.search).toHaveBeenCalledWith("test query", undefined);
      expect(result).toEqual({
        success: true,
        action: "webSearch",
        query: "test query",
        markdown: mockMarkdown,
      });
    });

    it("should pass API key to search provider", async () => {
      const toolsWithApiKey = createSearchTools({
        browser: mockBrowser,
        eventEmitter,
        searchProvider: "parallel",
        searchApiKey: "test-api-key",
      });

      const mockProvider = {
        name: "parallel",
        requiresBrowser: false,
        search: vi.fn().mockResolvedValue("# Results"),
      };
      mockCreateSearchProvider.mockResolvedValue(mockProvider);

      await toolsWithApiKey.webSearch.execute!({ query: "test" }, {
        toolCallId: "test",
        messages: [],
      } as any);

      expect(mockCreateSearchProvider).toHaveBeenCalledWith("parallel", {
        apiKey: "test-api-key",
      });
    });

    it("should emit events on successful search", async () => {
      const mockProvider = {
        name: "duckduckgo",
        requiresBrowser: true,
        search: vi.fn().mockResolvedValue("# Results"),
      };
      mockCreateSearchProvider.mockResolvedValue(mockProvider);

      const emitSpy = vi.spyOn(eventEmitter, "emit");

      await tools.webSearch.execute!({ query: "test" }, {
        toolCallId: "test",
        messages: [],
      } as any);

      expect(emitSpy).toHaveBeenCalledWith(WebAgentEventType.AGENT_ACTION, {
        action: "webSearch",
        value: "test",
      });
      expect(emitSpy).toHaveBeenCalledWith(WebAgentEventType.BROWSER_ACTION_COMPLETED, {
        success: true,
        action: "webSearch",
      });
    });

    it("should handle search errors gracefully", async () => {
      const mockProvider = {
        name: "duckduckgo",
        requiresBrowser: true,
        search: vi.fn().mockRejectedValue(new Error("Search failed")),
      };
      mockCreateSearchProvider.mockResolvedValue(mockProvider);

      const result = await tools.webSearch.execute!({ query: "test" }, {
        toolCallId: "test",
        messages: [],
      } as any);

      expect(result).toEqual({
        success: false,
        action: "webSearch",
        query: "test",
        error: "Search failed",
        isRecoverable: true,
      });
    });

    it("should emit failure event on error", async () => {
      const mockProvider = {
        name: "duckduckgo",
        requiresBrowser: true,
        search: vi.fn().mockRejectedValue(new Error("Network error")),
      };
      mockCreateSearchProvider.mockResolvedValue(mockProvider);

      const emitSpy = vi.spyOn(eventEmitter, "emit");

      await tools.webSearch.execute!({ query: "test" }, {
        toolCallId: "test",
        messages: [],
      } as any);

      expect(emitSpy).toHaveBeenCalledWith(WebAgentEventType.BROWSER_ACTION_COMPLETED, {
        success: false,
        action: "webSearch",
        error: "Network error",
        isRecoverable: true,
      });
    });

    it("should handle non-Error exceptions", async () => {
      const mockProvider = {
        name: "duckduckgo",
        requiresBrowser: true,
        search: vi.fn().mockRejectedValue("string error"),
      };
      mockCreateSearchProvider.mockResolvedValue(mockProvider);

      const result = await tools.webSearch.execute!({ query: "test" }, {
        toolCallId: "test",
        messages: [],
      } as any);

      expect(result).toEqual({
        success: false,
        action: "webSearch",
        query: "test",
        error: "string error",
        isRecoverable: true,
      });
    });
  });
});
