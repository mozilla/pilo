import { describe, it, expect, vi, beforeEach } from "vitest";
import { createInspectionTools } from "../../src/tools/inspectionTools.js";
import { WebAgentEventEmitter, WebAgentEventType } from "../../src/events.js";
import type {
  AriaBrowser,
  SearchPageResult,
  FindElementsResult,
} from "../../src/browser/ariaBrowser.js";

// Mock the ai module — mirror searchTools.test.ts so the tool's
// description/inputSchema/execute are passed through verbatim.
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

const createMockBrowser = (
  searchResult: SearchPageResult = { totalMatches: 0, truncated: false, matches: [] },
  findResult: FindElementsResult = { totalMatches: 0, truncated: false, elements: [] },
): AriaBrowser =>
  ({
    searchPage: vi.fn().mockResolvedValue(searchResult),
    findElements: vi.fn().mockResolvedValue(findResult),
  }) as unknown as AriaBrowser;

describe("Inspection Tools", () => {
  let mockBrowser: AriaBrowser;
  let eventEmitter: WebAgentEventEmitter;
  let tools: ReturnType<typeof createInspectionTools>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockBrowser = createMockBrowser();
    eventEmitter = new WebAgentEventEmitter();

    tools = createInspectionTools({
      browser: mockBrowser,
      eventEmitter,
    });
  });

  describe("Tool Structure", () => {
    it("should create search_page tool", () => {
      expect(tools).toBeDefined();
      expect(tools.search_page).toBeDefined();
    });

    it("should have a description that mentions text search of the page", () => {
      expect(tools.search_page.description).toMatch(/text search|search.*text|find.*phrase/i);
    });

    it("should validate input schema correctly", () => {
      const schema = tools.search_page.inputSchema as {
        safeParse: (input: unknown) => { success: boolean; data?: any };
      };

      // Pattern is required
      const valid = schema.safeParse({ pattern: "logout" });
      expect(valid.success).toBe(true);

      // Missing pattern should fail
      const invalid = schema.safeParse({});
      expect(invalid.success).toBe(false);

      // Defaults applied when omitted
      if (valid.success && valid.data) {
        expect(valid.data.regex).toBe(false);
        expect(valid.data.caseSensitive).toBe(false);
        expect(valid.data.contextChars).toBe(80);
        expect(valid.data.maxResults).toBe(10);
      }
    });

    it("should reject out-of-range contextChars and maxResults", () => {
      const schema = tools.search_page.inputSchema as {
        safeParse: (input: unknown) => { success: boolean };
      };

      expect(schema.safeParse({ pattern: "x", contextChars: -1 }).success).toBe(false);
      expect(schema.safeParse({ pattern: "x", contextChars: 501 }).success).toBe(false);
      expect(schema.safeParse({ pattern: "x", maxResults: 0 }).success).toBe(false);
      expect(schema.safeParse({ pattern: "x", maxResults: 51 }).success).toBe(false);
    });
  });

  describe("search_page execution", () => {
    it("should call browser.searchPage with the provided options", async () => {
      const mockResult: SearchPageResult = {
        totalMatches: 2,
        truncated: false,
        matches: [
          {
            match: "logout",
            contextBefore: "click ",
            contextAfter: " here",
            nearestRef: "E12",
          },
          {
            match: "Logout",
            contextBefore: "the ",
            contextAfter: " button",
            nearestRef: undefined,
            frameUrl: "https://iframe.example/",
          },
        ],
      };
      vi.mocked(mockBrowser.searchPage).mockResolvedValue(mockResult);

      const result = await tools.search_page.execute!(
        { pattern: "logout", regex: false, caseSensitive: false, contextChars: 80, maxResults: 10 },
        { toolCallId: "test", messages: [] } as any,
      );

      expect(mockBrowser.searchPage).toHaveBeenCalledWith({
        pattern: "logout",
        regex: false,
        caseSensitive: false,
        contextChars: 80,
        maxResults: 10,
      });

      expect(result).toEqual({
        success: true,
        action: "search_page",
        pattern: "logout",
        totalMatches: 2,
        truncated: false,
        matches: mockResult.matches,
      });
    });

    it("should emit AGENT_ACTION and BROWSER_ACTION_COMPLETED on success", async () => {
      const emitSpy = vi.spyOn(eventEmitter, "emit");

      await tools.search_page.execute!(
        { pattern: "foo", regex: false, caseSensitive: false, contextChars: 80, maxResults: 10 },
        { toolCallId: "test", messages: [] } as any,
      );

      expect(emitSpy).toHaveBeenCalledWith(WebAgentEventType.AGENT_ACTION, {
        action: "search_page",
        value: "foo",
      });
      expect(emitSpy).toHaveBeenCalledWith(WebAgentEventType.BROWSER_ACTION_COMPLETED, {
        success: true,
        action: "search_page",
      });
    });

    it("should return a recoverable error result when the browser throws", async () => {
      vi.mocked(mockBrowser.searchPage).mockRejectedValue(new Error("bad regex"));

      const result = await tools.search_page.execute!(
        { pattern: "(", regex: true, caseSensitive: false, contextChars: 80, maxResults: 10 },
        { toolCallId: "test", messages: [] } as any,
      );

      expect(result).toEqual({
        success: false,
        action: "search_page",
        pattern: "(",
        error: "bad regex",
        isRecoverable: true,
      });
    });

    it("should emit failure event when browser throws", async () => {
      vi.mocked(mockBrowser.searchPage).mockRejectedValue(new Error("kaboom"));

      const emitSpy = vi.spyOn(eventEmitter, "emit");

      await tools.search_page.execute!(
        { pattern: "x", regex: false, caseSensitive: false, contextChars: 80, maxResults: 10 },
        { toolCallId: "test", messages: [] } as any,
      );

      expect(emitSpy).toHaveBeenCalledWith(WebAgentEventType.BROWSER_ACTION_COMPLETED, {
        success: false,
        action: "search_page",
        error: "kaboom",
        isRecoverable: true,
      });
    });

    it("should coerce non-Error rejections to string", async () => {
      vi.mocked(mockBrowser.searchPage).mockRejectedValue("string error");

      const result = await tools.search_page.execute!(
        { pattern: "x", regex: false, caseSensitive: false, contextChars: 80, maxResults: 10 },
        { toolCallId: "test", messages: [] } as any,
      );

      expect(result).toMatchObject({
        success: false,
        action: "search_page",
        pattern: "x",
        error: "string error",
        isRecoverable: true,
      });
    });
  });

  describe("find_elements", () => {
    describe("Tool Structure", () => {
      it("should create find_elements tool", () => {
        expect(tools.find_elements).toBeDefined();
      });

      it("should have a description that mentions CSS selectors", () => {
        expect(tools.find_elements.description).toMatch(/CSS.?selector/i);
      });

      it("should validate input schema correctly", () => {
        const schema = tools.find_elements.inputSchema as {
          safeParse: (input: unknown) => { success: boolean; data?: any };
        };

        // selector is required
        const valid = schema.safeParse({ selector: "a" });
        expect(valid.success).toBe(true);

        // Missing selector should fail
        const invalid = schema.safeParse({});
        expect(invalid.success).toBe(false);

        // Defaults applied when omitted
        if (valid.success && valid.data) {
          expect(valid.data.maxResults).toBe(20);
          expect(valid.data.includeText).toBe(true);
          // withinRef / attributes are optional and not defaulted
          expect(valid.data.withinRef).toBeUndefined();
          expect(valid.data.attributes).toBeUndefined();
        }
      });

      it("should reject out-of-range maxResults", () => {
        const schema = tools.find_elements.inputSchema as {
          safeParse: (input: unknown) => { success: boolean };
        };

        expect(schema.safeParse({ selector: "a", maxResults: 0 }).success).toBe(false);
        expect(schema.safeParse({ selector: "a", maxResults: 101 }).success).toBe(false);
        expect(schema.safeParse({ selector: "a", maxResults: 1 }).success).toBe(true);
        expect(schema.safeParse({ selector: "a", maxResults: 100 }).success).toBe(true);
      });
    });

    describe("find_elements execution", () => {
      it("should call browser.findElements with the provided options", async () => {
        const mockResult: FindElementsResult = {
          totalMatches: 2,
          truncated: false,
          elements: [
            {
              tag: "a",
              text: "Home",
              attributes: { href: "https://example.com/home" },
              nearestRef: "E5",
            },
            {
              tag: "a",
              text: "About",
              attributes: { href: "https://example.com/about" },
              nearestRef: "E6",
              frameUrl: "https://iframe.example/",
            },
          ],
        };
        vi.mocked(mockBrowser.findElements).mockResolvedValue(mockResult);

        const result = await tools.find_elements.execute!(
          {
            selector: "a.nav-link",
            withinRef: "E1",
            attributes: ["href"],
            maxResults: 20,
            includeText: true,
          },
          { toolCallId: "test", messages: [] } as any,
        );

        expect(mockBrowser.findElements).toHaveBeenCalledWith({
          selector: "a.nav-link",
          withinRef: "E1",
          attributes: ["href"],
          maxResults: 20,
          includeText: true,
        });

        expect(result).toEqual({
          success: true,
          action: "find_elements",
          selector: "a.nav-link",
          totalMatches: 2,
          truncated: false,
          elements: mockResult.elements,
        });
      });

      it("should propagate withinRef when provided and omit when not", async () => {
        vi.mocked(mockBrowser.findElements).mockResolvedValue({
          totalMatches: 0,
          truncated: false,
          elements: [],
        });

        // With withinRef
        await tools.find_elements.execute!(
          { selector: "a", withinRef: "E42", maxResults: 20, includeText: true },
          { toolCallId: "test", messages: [] } as any,
        );
        expect(mockBrowser.findElements).toHaveBeenLastCalledWith({
          selector: "a",
          withinRef: "E42",
          attributes: undefined,
          maxResults: 20,
          includeText: true,
        });

        // Without withinRef (omitted by schema)
        await tools.find_elements.execute!({ selector: "a", maxResults: 20, includeText: true }, {
          toolCallId: "test",
          messages: [],
        } as any);
        expect(mockBrowser.findElements).toHaveBeenLastCalledWith({
          selector: "a",
          withinRef: undefined,
          attributes: undefined,
          maxResults: 20,
          includeText: true,
        });
      });

      it("should forward an attributes filter to the browser", async () => {
        vi.mocked(mockBrowser.findElements).mockResolvedValue({
          totalMatches: 0,
          truncated: false,
          elements: [],
        });

        await tools.find_elements.execute!(
          {
            selector: "[data-id]",
            attributes: ["data-id", "class"],
            maxResults: 20,
            includeText: true,
          },
          { toolCallId: "test", messages: [] } as any,
        );

        expect(mockBrowser.findElements).toHaveBeenLastCalledWith({
          selector: "[data-id]",
          withinRef: undefined,
          attributes: ["data-id", "class"],
          maxResults: 20,
          includeText: true,
        });
      });

      it("should emit AGENT_ACTION and BROWSER_ACTION_COMPLETED on success", async () => {
        const emitSpy = vi.spyOn(eventEmitter, "emit");

        await tools.find_elements.execute!(
          { selector: "a.nav", maxResults: 20, includeText: true },
          { toolCallId: "test", messages: [] } as any,
        );

        expect(emitSpy).toHaveBeenCalledWith(WebAgentEventType.AGENT_ACTION, {
          action: "find_elements",
          value: "a.nav",
        });
        expect(emitSpy).toHaveBeenCalledWith(WebAgentEventType.BROWSER_ACTION_COMPLETED, {
          success: true,
          action: "find_elements",
        });
      });

      it("should return a recoverable error result when the browser throws (bad selector)", async () => {
        vi.mocked(mockBrowser.findElements).mockRejectedValue(
          new Error("Failed to execute 'querySelectorAll': '???' is not a valid selector."),
        );

        const result = await tools.find_elements.execute!(
          { selector: "???", maxResults: 20, includeText: true },
          { toolCallId: "test", messages: [] } as any,
        );

        expect(result).toMatchObject({
          success: false,
          action: "find_elements",
          selector: "???",
          isRecoverable: true,
        });
        expect((result as { error: string }).error).toMatch(/not a valid selector/);
      });

      it("should emit failure event when browser throws (withinRef not found)", async () => {
        vi.mocked(mockBrowser.findElements).mockRejectedValue(
          new Error('withinRef "Z9" not found'),
        );

        const emitSpy = vi.spyOn(eventEmitter, "emit");

        await tools.find_elements.execute!(
          { selector: "a", withinRef: "Z9", maxResults: 20, includeText: true },
          { toolCallId: "test", messages: [] } as any,
        );

        expect(emitSpy).toHaveBeenCalledWith(WebAgentEventType.BROWSER_ACTION_COMPLETED, {
          success: false,
          action: "find_elements",
          error: 'withinRef "Z9" not found',
          isRecoverable: true,
        });
      });

      it("should coerce non-Error rejections to string", async () => {
        vi.mocked(mockBrowser.findElements).mockRejectedValue("string error");

        const result = await tools.find_elements.execute!(
          { selector: "a", maxResults: 20, includeText: true },
          { toolCallId: "test", messages: [] } as any,
        );

        expect(result).toMatchObject({
          success: false,
          action: "find_elements",
          selector: "a",
          error: "string error",
          isRecoverable: true,
        });
      });
    });
  });
});
