import { describe, it, expect, vi, beforeEach } from "vitest";
import { createSearchTools } from "../../src/tools/searchTools.js";
import { WebAgentEventEmitter, WebAgentEventType } from "../../src/events.js";
import type { SearchService } from "../../src/search/searchService.js";

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

const createMockSearchService = (): SearchService =>
  ({
    search: vi.fn().mockResolvedValue("# Search Results\n\n1. [Result](https://example.com)"),
  }) as unknown as SearchService;

describe("Search Tools", () => {
  let mockSearchService: SearchService;
  let eventEmitter: WebAgentEventEmitter;
  let tools: ReturnType<typeof createSearchTools>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockSearchService = createMockSearchService();
    eventEmitter = new WebAgentEventEmitter();

    tools = createSearchTools({
      searchService: mockSearchService,
      eventEmitter,
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
    it("should execute search and return results", async () => {
      const mockMarkdown = "# Search Results\n\n1. [Result](https://example.com)";
      vi.mocked(mockSearchService.search).mockResolvedValue(mockMarkdown);

      const result = await tools.webSearch.execute!({ query: "test query" }, {
        toolCallId: "test",
        messages: [],
      } as any);

      expect(mockSearchService.search).toHaveBeenCalledWith("test query");
      expect(result).toEqual({
        success: true,
        action: "webSearch",
        query: "test query",
        markdown: mockMarkdown,
      });
    });

    it("should emit events on successful search", async () => {
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
      vi.mocked(mockSearchService.search).mockRejectedValue(new Error("Search failed"));

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
      vi.mocked(mockSearchService.search).mockRejectedValue(new Error("Network error"));

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
      vi.mocked(mockSearchService.search).mockRejectedValue("string error");

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
