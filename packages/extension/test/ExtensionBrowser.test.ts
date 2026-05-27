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
  });
});
