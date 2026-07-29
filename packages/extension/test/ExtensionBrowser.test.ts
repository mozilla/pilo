import { describe, it, expect, beforeEach, vi } from "vitest";
import { ExtensionBrowser } from "../src/background/ExtensionBrowser";
import browser from "webextension-polyfill";
import { BrowserActionException, InvalidRefException } from "pilo-core/core";

vi.mock("webextension-polyfill", () => ({
  default: {
    tabs: {
      query: vi.fn(),
      get: vi.fn(),
      update: vi.fn(),
      onUpdated: {
        addListener: vi.fn(),
        removeListener: vi.fn(),
      },
      onRemoved: {
        addListener: vi.fn(),
        removeListener: vi.fn(),
      },
    },
    scripting: {
      executeScript: vi.fn(),
    },
    webNavigation: {
      onCompleted: {
        addListener: vi.fn(),
        removeListener: vi.fn(),
      },
    },
  },
}));

describe("ExtensionBrowser", () => {
  let extensionBrowser: ExtensionBrowser;
  const mockTabId = 123;

  beforeEach(() => {
    vi.clearAllMocks();
    extensionBrowser = new ExtensionBrowser(mockTabId);

    vi.mocked(browser.tabs.get).mockResolvedValue({
      id: mockTabId,
      active: true,
      url: "https://example.com",
    } as any);

    vi.mocked(browser.tabs.query).mockResolvedValue([
      { id: mockTabId, active: true, url: "https://example.com" } as any,
    ]);
  });

  describe("searchPage", () => {
    it("returns matches from a single executeScript call (top frame only, frameUrl undefined)", async () => {
      vi.mocked(browser.scripting.executeScript).mockResolvedValue([
        {
          result: {
            totalMatches: 1,
            matches: [
              {
                match: "logout",
                contextBefore: "click ",
                contextAfter: " here",
                nearestRef: "E5",
              },
            ],
          },
        } as any,
      ]);

      const result = await extensionBrowser.searchPage({ pattern: "logout" });

      expect(browser.scripting.executeScript).toHaveBeenCalledTimes(1);
      const call = vi.mocked(browser.scripting.executeScript).mock.calls[0][0] as any;
      expect(call.target).toEqual({ tabId: mockTabId });
      expect(call.args).toEqual([
        {
          pattern: "logout",
          regex: false,
          caseSensitive: false,
          contextChars: 80,
          maxResults: 10,
        },
      ]);

      expect(result.totalMatches).toBe(1);
      expect(result.truncated).toBe(false);
      expect(result.matches).toHaveLength(1);
      expect(result.matches[0]).toEqual({
        match: "logout",
        contextBefore: "click ",
        contextAfter: " here",
        nearestRef: "E5",
        frameUrl: undefined,
      });
    });

    it("forwards regex and caseSensitive flags", async () => {
      vi.mocked(browser.scripting.executeScript).mockResolvedValue([
        { result: { totalMatches: 0, matches: [] } } as any,
      ]);

      await extensionBrowser.searchPage({
        pattern: "Lo[gG]out",
        regex: true,
        caseSensitive: true,
        contextChars: 20,
        maxResults: 3,
      });

      const call = vi.mocked(browser.scripting.executeScript).mock.calls[0][0] as any;
      expect(call.args).toEqual([
        {
          pattern: "Lo[gG]out",
          regex: true,
          caseSensitive: true,
          contextChars: 20,
          maxResults: 3,
        },
      ]);
    });

    it("marks the result as truncated when totalMatches exceeds returned matches", async () => {
      vi.mocked(browser.scripting.executeScript).mockResolvedValue([
        {
          result: {
            totalMatches: 25,
            matches: Array.from({ length: 10 }, (_, i) => ({
              match: `m${i}`,
              contextBefore: "",
              contextAfter: "",
              nearestRef: undefined,
            })),
          },
        } as any,
      ]);

      const result = await extensionBrowser.searchPage({ pattern: "x", maxResults: 10 });

      expect(result.totalMatches).toBe(25);
      expect(result.matches).toHaveLength(10);
      expect(result.truncated).toBe(true);
    });

    it("wraps executeScript rejection as a search_page error", async () => {
      vi.mocked(browser.scripting.executeScript).mockRejectedValue(
        new Error("SyntaxError: Invalid regular expression"),
      );

      await expect(extensionBrowser.searchPage({ pattern: "(", regex: true })).rejects.toThrow(
        /search_page failed/,
      );
    });
  });

  describe("findElements", () => {
    it("returns elements from a single executeScript call (top frame only, frameUrl undefined)", async () => {
      vi.mocked(browser.scripting.executeScript).mockResolvedValue([
        {
          result: {
            totalMatches: 1,
            matches: [
              {
                tag: "a",
                text: "Home",
                attributes: { href: "https://example.com/home" },
                nearestRef: "E5",
              },
            ],
          },
        } as any,
      ]);

      const result = await extensionBrowser.findElements({ selector: "a.nav-link" });

      expect(browser.scripting.executeScript).toHaveBeenCalledTimes(1);
      const call = vi.mocked(browser.scripting.executeScript).mock.calls[0][0] as any;
      expect(call.target).toEqual({ tabId: mockTabId });
      expect(call.args).toEqual([
        {
          selector: "a.nav-link",
          withinRef: null,
          attributes: null,
          maxResults: 20,
          includeText: true,
        },
      ]);

      expect(result.totalMatches).toBe(1);
      expect(result.truncated).toBe(false);
      expect(result.elements).toHaveLength(1);
      expect(result.elements[0]).toEqual({
        tag: "a",
        text: "Home",
        attributes: { href: "https://example.com/home" },
        nearestRef: "E5",
        frameUrl: undefined,
      });
    });

    it("forwards withinRef, attributes, maxResults, and includeText", async () => {
      vi.mocked(browser.scripting.executeScript).mockResolvedValue([
        { result: { totalMatches: 0, matches: [] } } as any,
      ]);

      await extensionBrowser.findElements({
        selector: "[data-id]",
        withinRef: "E42",
        attributes: ["data-id", "class"],
        maxResults: 5,
        includeText: false,
      });

      const call = vi.mocked(browser.scripting.executeScript).mock.calls[0][0] as any;
      expect(call.args).toEqual([
        {
          selector: "[data-id]",
          withinRef: "E42",
          attributes: ["data-id", "class"],
          maxResults: 5,
          includeText: false,
        },
      ]);
    });

    it("returns auto-resolved href and src attributes from the in-page result", async () => {
      vi.mocked(browser.scripting.executeScript).mockResolvedValue([
        {
          result: {
            totalMatches: 2,
            matches: [
              {
                tag: "a",
                text: "Home",
                attributes: { href: "https://example.com/home" },
                nearestRef: undefined,
              },
              {
                tag: "img",
                text: "",
                attributes: { src: "https://example.com/cat.png" },
                nearestRef: undefined,
              },
            ],
          },
        } as any,
      ]);

      const result = await extensionBrowser.findElements({ selector: "a, img" });

      expect(result.elements).toHaveLength(2);
      expect(result.elements[0].attributes).toEqual({ href: "https://example.com/home" });
      expect(result.elements[1].attributes).toEqual({ src: "https://example.com/cat.png" });
    });

    it("marks the result as truncated when totalMatches exceeds returned elements", async () => {
      vi.mocked(browser.scripting.executeScript).mockResolvedValue([
        {
          result: {
            totalMatches: 50,
            matches: Array.from({ length: 20 }, (_, i) => ({
              tag: "li",
              text: `Item ${i}`,
              attributes: undefined,
              nearestRef: undefined,
            })),
          },
        } as any,
      ]);

      const result = await extensionBrowser.findElements({ selector: "li", maxResults: 20 });

      expect(result.totalMatches).toBe(50);
      expect(result.elements).toHaveLength(20);
      expect(result.truncated).toBe(true);
    });

    it("throws when the in-page function returns an error (bad selector)", async () => {
      vi.mocked(browser.scripting.executeScript).mockResolvedValue([
        {
          result: {
            error: "Failed to execute 'querySelectorAll': '???' is not a valid selector.",
          },
        } as any,
      ]);

      await expect(extensionBrowser.findElements({ selector: "???" })).rejects.toThrow(
        /find_elements failed.*not a valid selector/,
      );
    });

    it("throws when the in-page function returns a withinRef-not-found error (top frame only)", async () => {
      vi.mocked(browser.scripting.executeScript).mockResolvedValue([
        {
          result: { error: 'withinRef "Z9" not found in this frame' },
        } as any,
      ]);

      await expect(
        extensionBrowser.findElements({ selector: "a", withinRef: "Z9" }),
      ).rejects.toThrow(/find_elements failed.*withinRef "Z9" not found/);
    });

    it("wraps executeScript rejection as a find_elements error", async () => {
      vi.mocked(browser.scripting.executeScript).mockRejectedValue(new Error("kaboom"));

      await expect(extensionBrowser.findElements({ selector: "a" })).rejects.toThrow(
        /find_elements failed/,
      );
    });
  });

  describe("Click Action - New Tab Prevention", () => {
    it("should successfully perform click action", async () => {
      vi.mocked(browser.scripting.executeScript).mockImplementation(async () => {
        return [
          {
            result: { success: true, message: "Clicked element test-link" },
          } as any,
        ];
      });

      await extensionBrowser.performAction("test-link", "click" as any);

      expect(browser.scripting.executeScript).toHaveBeenCalled();
    });

    it("should handle click failures gracefully", async () => {
      vi.mocked(browser.scripting.executeScript).mockImplementation(async () => {
        // Simulate a click failure
        return [
          {
            result: { success: false, error: "Click failed" },
          } as any,
        ];
      });

      await expect(extensionBrowser.performAction("test-link", "click" as any)).rejects.toThrow(
        "Click failed",
      );

      expect(browser.scripting.executeScript).toHaveBeenCalled();
    });

    it("should complete click action without errors", async () => {
      vi.mocked(browser.scripting.executeScript).mockResolvedValue([
        {
          result: { success: true, message: "Clicked element test-link" },
        } as any,
      ]);

      await expect(
        extensionBrowser.performAction("test-link", "click" as any),
      ).resolves.not.toThrow();

      expect(browser.scripting.executeScript).toHaveBeenCalled();
    });
  });

  describe("metadata error handling", () => {
    it("should translate missing field metadata refs into InvalidRefException", async () => {
      vi.mocked(browser.scripting.executeScript).mockResolvedValue([
        {
          result: {
            success: false,
            error: "Element with ref missing-input not found in DOM",
            errorType: "invalid-ref",
          },
        } as any,
      ]);

      await expect(extensionBrowser.getFieldMetadata("missing-input")).rejects.toThrow(
        InvalidRefException,
      );
    });

    it("should translate missing form submission refs into InvalidRefException", async () => {
      vi.mocked(browser.scripting.executeScript).mockResolvedValue([
        {
          result: {
            success: false,
            error: "Element with ref missing-submit not found in DOM",
            errorType: "invalid-ref",
          },
        } as any,
      ]);

      await expect(extensionBrowser.getFormSubmissionContext("missing-submit")).rejects.toThrow(
        InvalidRefException,
      );
    });

    it("should wrap field metadata script failures in BrowserActionException", async () => {
      vi.mocked(browser.scripting.executeScript)
        .mockResolvedValueOnce([{ result: true } as any])
        .mockRejectedValueOnce(new Error("Cannot access contents of url"));

      const error = await extensionBrowser.getFieldMetadata("input1").catch((err) => err);
      expect(error).toBeInstanceOf(BrowserActionException);
      expect(error.message).toContain(
        "Failed to get field metadata: Cannot access contents of url",
      );
    });

    it("should wrap empty field metadata script results in BrowserActionException", async () => {
      vi.mocked(browser.scripting.executeScript)
        .mockResolvedValueOnce([{ result: true } as any])
        .mockResolvedValueOnce([]);

      const error = await extensionBrowser.getFieldMetadata("input1").catch((err) => err);
      expect(error).toBeInstanceOf(BrowserActionException);
      expect(error.message).toContain("Failed to get field metadata: script returned no result");
    });

    it("should wrap form submission script failures in BrowserActionException", async () => {
      vi.mocked(browser.scripting.executeScript)
        .mockResolvedValueOnce([{ result: true } as any])
        .mockRejectedValueOnce(new Error("Cannot access contents of url"));

      const error = await extensionBrowser.getFormSubmissionContext("submit1").catch((err) => err);
      expect(error).toBeInstanceOf(BrowserActionException);
      expect(error.message).toContain(
        "Failed to get form submission context: Cannot access contents of url",
      );
    });

    it("should wrap empty form submission script results in BrowserActionException", async () => {
      vi.mocked(browser.scripting.executeScript)
        .mockResolvedValueOnce([{ result: true } as any])
        .mockResolvedValueOnce([]);

      const error = await extensionBrowser.getFormSubmissionContext("submit1").catch((err) => err);
      expect(error).toBeInstanceOf(BrowserActionException);
      expect(error.message).toContain(
        "Failed to get form submission context: script returned no result",
      );
    });
  });
});
