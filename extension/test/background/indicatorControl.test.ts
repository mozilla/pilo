import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import {
  getIndicatorCSS,
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
      insertCSS: vi.fn(),
      removeCSS: vi.fn(),
    },
    tabs: {
      onUpdated: {
        addListener: vi.fn(),
        removeListener: vi.fn(),
      },
    },
  },
}));

describe("indicatorControl", () => {
  describe("getIndicatorCSS", () => {
    it("should return a non-empty CSS string", () => {
      const css = getIndicatorCSS();
      expect(css).toBeTruthy();
      expect(typeof css).toBe("string");
      expect(css.length).toBeGreaterThan(0);
    });

    it("should include pulse animation keyframes", () => {
      const css = getIndicatorCSS();
      expect(css).toContain("@keyframes spark-pulse");
    });

    it("should use html::after pseudo-element", () => {
      const css = getIndicatorCSS();
      expect(css).toContain("html::after");
    });

    it("should have pointer-events: none to not block interactions", () => {
      const css = getIndicatorCSS();
      expect(css).toContain("pointer-events: none");
    });

    it("should have fixed positioning", () => {
      const css = getIndicatorCSS();
      expect(css).toContain("position: fixed");
    });

    it("should have purple glow box-shadow", () => {
      const css = getIndicatorCSS();
      expect(css).toContain("box-shadow");
      expect(css).toContain("rgba(139, 92, 246");
    });
  });

  describe("showIndicator", () => {
    beforeEach(() => {
      vi.clearAllMocks();
      vi.mocked(browser.scripting.insertCSS).mockResolvedValue(undefined);
    });

    it("should call browser.scripting.insertCSS with the correct tabId", async () => {
      await showIndicator(123);
      expect(browser.scripting.insertCSS).toHaveBeenCalledWith(
        expect.objectContaining({
          target: { tabId: 123 },
        }),
      );
    });

    it("should inject CSS containing spark-pulse animation", async () => {
      await showIndicator(123);
      const call = vi.mocked(browser.scripting.insertCSS).mock.calls[0];
      const cssOptions = call[0] as { css: string };
      expect(cssOptions.css).toContain("spark-pulse");
    });

    it("should not throw when insertCSS fails", async () => {
      vi.mocked(browser.scripting.insertCSS).mockRejectedValue(new Error("Tab not found"));
      await expect(showIndicator(123)).resolves.toBeUndefined();
    });
  });

  describe("hideIndicator", () => {
    beforeEach(() => {
      vi.clearAllMocks();
      vi.mocked(browser.scripting.removeCSS).mockResolvedValue(undefined);
    });

    it("should call browser.scripting.removeCSS with the correct tabId", async () => {
      await hideIndicator(123);
      expect(browser.scripting.removeCSS).toHaveBeenCalledWith(
        expect.objectContaining({
          target: { tabId: 123 },
        }),
      );
    });

    it("should remove CSS containing spark-pulse animation", async () => {
      await hideIndicator(123);
      const call = vi.mocked(browser.scripting.removeCSS).mock.calls[0];
      const cssOptions = call[0] as { css: string };
      expect(cssOptions.css).toContain("spark-pulse");
    });

    it("should not throw when removeCSS fails", async () => {
      vi.mocked(browser.scripting.removeCSS).mockRejectedValue(new Error("Tab not found"));
      await expect(hideIndicator(123)).resolves.toBeUndefined();
    });
  });

  describe("indicator state tracking", () => {
    beforeEach(() => {
      vi.clearAllMocks();
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
    let capturedListener:
      | ((tabId: number, changeInfo: { status?: string }, tab: { id?: number }) => void)
      | null = null;

    beforeEach(() => {
      vi.clearAllMocks();
      vi.mocked(browser.scripting.insertCSS).mockResolvedValue(undefined);
      vi.mocked(browser.scripting.removeCSS).mockResolvedValue(undefined);
      vi.mocked(browser.tabs.onUpdated.addListener).mockImplementation((listener) => {
        capturedListener = listener as typeof capturedListener;
      });
    });

    afterEach(() => {
      cleanupNavigationListener();
      capturedListener = null;
    });

    it("should register a tabs.onUpdated listener when setupNavigationListener is called", () => {
      setupNavigationListener();
      expect(browser.tabs.onUpdated.addListener).toHaveBeenCalledTimes(1);
    });

    it("should not register multiple listeners on repeated calls", () => {
      setupNavigationListener();
      setupNavigationListener();
      setupNavigationListener();
      expect(browser.tabs.onUpdated.addListener).toHaveBeenCalledTimes(1);
    });

    it("should re-inject CSS when page completes loading for active indicator tab", async () => {
      setupNavigationListener();
      await showIndicator(123);
      vi.clearAllMocks();

      // Simulate navigation complete
      capturedListener?.(123, { status: "complete" }, { id: 123 });

      // Wait for async re-injection
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(browser.scripting.insertCSS).toHaveBeenCalledWith(
        expect.objectContaining({
          target: { tabId: 123 },
        }),
      );
    });

    it("should not re-inject CSS for tabs without active indicator", async () => {
      setupNavigationListener();
      // Don't show indicator for tab 123

      // Simulate navigation complete
      capturedListener?.(123, { status: "complete" }, { id: 123 });

      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(browser.scripting.insertCSS).not.toHaveBeenCalled();
    });

    it("should not re-inject CSS for non-complete status changes", async () => {
      setupNavigationListener();
      await showIndicator(123);
      vi.clearAllMocks();

      // Simulate loading status (not complete)
      capturedListener?.(123, { status: "loading" }, { id: 123 });

      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(browser.scripting.insertCSS).not.toHaveBeenCalled();
    });

    it("should remove listener when cleanupNavigationListener is called", () => {
      setupNavigationListener();
      cleanupNavigationListener();
      expect(browser.tabs.onUpdated.removeListener).toHaveBeenCalled();
    });
  });
});
