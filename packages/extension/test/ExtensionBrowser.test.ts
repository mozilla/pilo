import { describe, it, expect, beforeEach, vi } from "vitest";
import { ExtensionBrowser } from "../src/ExtensionBrowser";
import browser from "webextension-polyfill";

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
});
