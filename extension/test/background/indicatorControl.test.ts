import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import {
  showIndicator,
  hideIndicator,
  setupNavigationListener,
  isIndicatorActive,
  cleanupNavigationListener,
} from "../../src/background/indicatorControl";
import browser from "webextension-polyfill";

vi.mock("webextension-polyfill", () => ({
  default: {
    scripting: {
      executeScript: vi.fn(),
      insertCSS: vi.fn(),
      removeCSS: vi.fn(),
    },
    tabs: {
      onUpdated: {
        addListener: vi.fn(),
        removeListener: vi.fn(),
      },
    },
    webNavigation: {
      onCommitted: {
        addListener: vi.fn(),
        removeListener: vi.fn(),
      },
    },
  },
}));

describe("indicatorControl", () => {
  describe("showIndicator", () => {
    beforeEach(() => {
      vi.clearAllMocks();
      vi.mocked(browser.scripting.executeScript).mockResolvedValue([]);
      vi.mocked(browser.scripting.insertCSS).mockResolvedValue(undefined);
      vi.mocked(browser.scripting.removeCSS).mockResolvedValue(undefined);
    });

    afterEach(() => {
      cleanupNavigationListener();
    });

    it("should call browser.scripting.executeScript with the correct tabId", async () => {
      await showIndicator(123);
      expect(browser.scripting.executeScript).toHaveBeenCalledWith({
        target: { tabId: 123 },
        func: expect.any(Function),
      });
    });

    it("should add spark-indicator-active class to html element", async () => {
      await showIndicator(123);

      // Capture and test the injected function
      const call = vi.mocked(browser.scripting.executeScript).mock.calls[0];
      const options = call[0] as { func: () => void };

      // Mock document.documentElement
      const mockClassList = {
        add: vi.fn(),
        remove: vi.fn(),
      };
      const originalDocumentElement = globalThis.document?.documentElement;
      Object.defineProperty(globalThis, "document", {
        value: { documentElement: { classList: mockClassList } },
        writable: true,
        configurable: true,
      });

      // Execute the function
      options.func();

      expect(mockClassList.add).toHaveBeenCalledWith("spark-indicator-active");

      // Restore
      if (originalDocumentElement) {
        Object.defineProperty(globalThis, "document", {
          value: { documentElement: originalDocumentElement },
          writable: true,
          configurable: true,
        });
      }
    });

    it("should not throw when executeScript fails", async () => {
      vi.mocked(browser.scripting.executeScript).mockRejectedValue(new Error("Tab not found"));
      await expect(showIndicator(123)).resolves.toBeUndefined();
    });
  });

  describe("hideIndicator", () => {
    beforeEach(() => {
      vi.clearAllMocks();
      vi.mocked(browser.scripting.executeScript).mockResolvedValue([]);
      vi.mocked(browser.scripting.insertCSS).mockResolvedValue(undefined);
      vi.mocked(browser.scripting.removeCSS).mockResolvedValue(undefined);
    });

    afterEach(() => {
      cleanupNavigationListener();
    });

    it("should call browser.scripting.executeScript with the correct tabId", async () => {
      await hideIndicator(123);
      expect(browser.scripting.executeScript).toHaveBeenCalledWith({
        target: { tabId: 123 },
        func: expect.any(Function),
      });
    });

    it("should remove spark-indicator-active class from html element", async () => {
      await hideIndicator(123);

      // Capture and test the injected function
      const call = vi.mocked(browser.scripting.executeScript).mock.calls[0];
      const options = call[0] as { func: () => void };

      // Mock document.documentElement
      const mockClassList = {
        add: vi.fn(),
        remove: vi.fn(),
      };
      const originalDocumentElement = globalThis.document?.documentElement;
      Object.defineProperty(globalThis, "document", {
        value: { documentElement: { classList: mockClassList } },
        writable: true,
        configurable: true,
      });

      // Execute the function
      options.func();

      expect(mockClassList.remove).toHaveBeenCalledWith("spark-indicator-active");

      // Restore
      if (originalDocumentElement) {
        Object.defineProperty(globalThis, "document", {
          value: { documentElement: originalDocumentElement },
          writable: true,
          configurable: true,
        });
      }
    });

    it("should not throw when executeScript fails", async () => {
      vi.mocked(browser.scripting.executeScript).mockRejectedValue(new Error("Tab not found"));
      await expect(hideIndicator(123)).resolves.toBeUndefined();
    });
  });

  describe("indicator state tracking", () => {
    beforeEach(() => {
      vi.clearAllMocks();
      vi.mocked(browser.scripting.executeScript).mockResolvedValue([]);
      vi.mocked(browser.scripting.insertCSS).mockResolvedValue(undefined);
      vi.mocked(browser.scripting.removeCSS).mockResolvedValue(undefined);
    });

    afterEach(() => {
      cleanupNavigationListener();
    });

    it("should track active indicators when showIndicator is called", async () => {
      await showIndicator(123);
      expect(isIndicatorActive(123)).toBe(true);
    });

    it("should remove from tracking when hideIndicator is called", async () => {
      await showIndicator(123);
      expect(isIndicatorActive(123)).toBe(true);
      await hideIndicator(123);
      expect(isIndicatorActive(123)).toBe(false);
    });

    it("should not track indicator if insertCSS fails", async () => {
      vi.mocked(browser.scripting.insertCSS).mockRejectedValue(new Error("Tab not found"));
      await showIndicator(123);
      expect(isIndicatorActive(123)).toBe(false);
    });
  });

  describe("navigation listener", () => {
    let capturedTabsListener:
      | ((tabId: number, changeInfo: { status?: string }, tab: { id?: number }) => void)
      | null = null;
    let capturedWebNavListener:
      | ((details: { tabId: number; frameId: number }) => void)
      | null = null;

    beforeEach(() => {
      vi.clearAllMocks();
      vi.mocked(browser.scripting.executeScript).mockResolvedValue([]);
      vi.mocked(browser.scripting.insertCSS).mockResolvedValue(undefined);
      vi.mocked(browser.scripting.removeCSS).mockResolvedValue(undefined);
      vi.mocked(browser.tabs.onUpdated.addListener).mockImplementation((listener) => {
        capturedTabsListener = listener as typeof capturedTabsListener;
      });
      vi.mocked(browser.webNavigation.onCommitted.addListener).mockImplementation((listener) => {
        capturedWebNavListener = listener as typeof capturedWebNavListener;
      });
    });

    afterEach(() => {
      cleanupNavigationListener();
      capturedTabsListener = null;
      capturedWebNavListener = null;
    });

    it("should register both webNavigation and tabs.onUpdated listeners", () => {
      setupNavigationListener();
      expect(browser.webNavigation.onCommitted.addListener).toHaveBeenCalledTimes(1);
      expect(browser.tabs.onUpdated.addListener).toHaveBeenCalledTimes(1);
    });

    it("should not register multiple listeners on repeated calls", () => {
      setupNavigationListener();
      setupNavigationListener();
      setupNavigationListener();
      expect(browser.webNavigation.onCommitted.addListener).toHaveBeenCalledTimes(1);
      expect(browser.tabs.onUpdated.addListener).toHaveBeenCalledTimes(1);
    });

    it("should inject on webNavigation.onCommitted for main frame", async () => {
      setupNavigationListener();
      await showIndicator(123);
      vi.clearAllMocks();

      // Simulate navigation committed (main frame)
      capturedWebNavListener?.({ tabId: 123, frameId: 0 });

      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(browser.scripting.insertCSS).toHaveBeenCalledWith({
        target: { tabId: 123 },
        css: expect.any(String),
      });
    });

    it("should not inject on webNavigation.onCommitted for iframes", async () => {
      setupNavigationListener();
      await showIndicator(123);
      vi.clearAllMocks();

      // Simulate navigation committed (iframe, frameId !== 0)
      capturedWebNavListener?.({ tabId: 123, frameId: 1 });

      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(browser.scripting.insertCSS).not.toHaveBeenCalled();
    });

    it("should re-apply class via executeScript when page completes loading for active indicator tab", async () => {
      setupNavigationListener();
      await showIndicator(123);
      vi.clearAllMocks();

      // Simulate navigation complete
      capturedTabsListener?.(123, { status: "complete" }, { id: 123 });

      // Wait for async re-injection
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(browser.scripting.executeScript).toHaveBeenCalledWith({
        target: { tabId: 123 },
        func: expect.any(Function),
      });
    });

    it("should not re-apply class for tabs without active indicator", async () => {
      setupNavigationListener();
      // Don't show indicator for tab 123

      // Simulate navigation complete
      capturedTabsListener?.(123, { status: "complete" }, { id: 123 });

      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(browser.scripting.executeScript).not.toHaveBeenCalled();
    });

    it("should not re-apply class for loading status (handled by webNavigation)", async () => {
      setupNavigationListener();
      await showIndicator(123);
      vi.clearAllMocks();

      // Simulate loading status - now handled by webNavigation, not tabs.onUpdated
      capturedTabsListener?.(123, { status: "loading" }, { id: 123 });

      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(browser.scripting.insertCSS).not.toHaveBeenCalled();
    });

    it("should remove listeners when cleanupNavigationListener is called", () => {
      setupNavigationListener();
      cleanupNavigationListener();
      expect(browser.webNavigation.onCommitted.removeListener).toHaveBeenCalled();
      expect(browser.tabs.onUpdated.removeListener).toHaveBeenCalled();
    });
  });
});
