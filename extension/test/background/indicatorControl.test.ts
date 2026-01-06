import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import {
  showIndicator,
  hideIndicator,
  setupNavigationListener,
  isIndicatorActive,
  cleanupNavigationListener,
  resetIndicatorState,
  ensureIndicatorCSSRegistered,
  cleanupStaleRegistrations,
} from "../../src/background/indicatorControl";
import browser from "webextension-polyfill";

// Type definitions for test mocks
type ExecuteScriptOptions = Pick<browser.Scripting.ScriptInjection, "target"> & {
  func: () => void;
};
type RegisteredContentScriptMock = Pick<
  browser.Scripting.RegisteredContentScript,
  "id" | "matches" | "js" | "css"
>;

vi.mock("webextension-polyfill", () => ({
  default: {
    scripting: {
      executeScript: vi.fn(),
      insertCSS: vi.fn(),
      removeCSS: vi.fn(),
      registerContentScripts: vi.fn(),
      unregisterContentScripts: vi.fn(),
      getRegisteredContentScripts: vi.fn(),
    },
    tabs: {
      onUpdated: {
        addListener: vi.fn(),
        removeListener: vi.fn(),
      },
      onRemoved: {
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
      vi.mocked(browser.scripting.registerContentScripts).mockResolvedValue(undefined);
      vi.mocked(browser.scripting.unregisterContentScripts).mockResolvedValue(undefined);
      resetIndicatorState();
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
      const options = call[0] as ExecuteScriptOptions;

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
      vi.mocked(browser.scripting.insertCSS).mockRejectedValue(new Error("Tab not found"));
      await expect(showIndicator(123)).resolves.toBeUndefined();
    });
  });

  describe("hideIndicator", () => {
    beforeEach(() => {
      vi.clearAllMocks();
      vi.mocked(browser.scripting.executeScript).mockResolvedValue([]);
      vi.mocked(browser.scripting.insertCSS).mockResolvedValue(undefined);
      vi.mocked(browser.scripting.removeCSS).mockResolvedValue(undefined);
      vi.mocked(browser.scripting.registerContentScripts).mockResolvedValue(undefined);
      vi.mocked(browser.scripting.unregisterContentScripts).mockResolvedValue(undefined);
      resetIndicatorState();
    });

    afterEach(() => {
      cleanupNavigationListener();
    });

    it("should call browser.scripting.executeScript with the correct tabId", async () => {
      await showIndicator(123);
      vi.clearAllMocks();
      await hideIndicator(123);
      expect(browser.scripting.executeScript).toHaveBeenCalledWith({
        target: { tabId: 123 },
        func: expect.any(Function),
      });
    });

    it("should remove spark-indicator-active class from html element", async () => {
      await showIndicator(123);
      await hideIndicator(123);

      // Capture and test the injected function
      const calls = vi.mocked(browser.scripting.executeScript).mock.calls;
      const lastCall = calls[calls.length - 1];
      const options = lastCall[0] as ExecuteScriptOptions;

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
      vi.mocked(browser.scripting.registerContentScripts).mockResolvedValue(undefined);
      vi.mocked(browser.scripting.unregisterContentScripts).mockResolvedValue(undefined);
      resetIndicatorState();
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
    let capturedWebNavListener: ((details: { tabId: number; frameId: number }) => void) | null =
      null;

    beforeEach(() => {
      vi.clearAllMocks();
      vi.mocked(browser.scripting.executeScript).mockResolvedValue([]);
      vi.mocked(browser.scripting.insertCSS).mockResolvedValue(undefined);
      vi.mocked(browser.scripting.removeCSS).mockResolvedValue(undefined);
      vi.mocked(browser.scripting.registerContentScripts).mockResolvedValue(undefined);
      vi.mocked(browser.scripting.unregisterContentScripts).mockResolvedValue(undefined);
      vi.mocked(browser.tabs.onUpdated.addListener).mockImplementation((listener) => {
        capturedTabsListener = listener as typeof capturedTabsListener;
      });
      vi.mocked(browser.webNavigation.onCommitted.addListener).mockImplementation((listener) => {
        capturedWebNavListener = listener as typeof capturedWebNavListener;
      });
      resetIndicatorState();
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

      expect(browser.scripting.executeScript).toHaveBeenCalledWith({
        target: { tabId: 123 },
        func: expect.any(Function),
      });
    });

    it("should not inject on webNavigation.onCommitted for iframes", async () => {
      setupNavigationListener();
      await showIndicator(123);
      vi.clearAllMocks();

      // Simulate navigation committed (iframe, frameId !== 0)
      capturedWebNavListener?.({ tabId: 123, frameId: 1 });

      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(browser.scripting.executeScript).not.toHaveBeenCalled();
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

      expect(browser.scripting.executeScript).not.toHaveBeenCalled();
    });

    it("should remove listeners when cleanupNavigationListener is called", () => {
      setupNavigationListener();
      cleanupNavigationListener();
      expect(browser.webNavigation.onCommitted.removeListener).toHaveBeenCalled();
      expect(browser.tabs.onUpdated.removeListener).toHaveBeenCalled();
    });
  });

  describe("ensureIndicatorCSSRegistered", () => {
    beforeEach(() => {
      vi.clearAllMocks();
      vi.mocked(browser.scripting.registerContentScripts).mockResolvedValue(undefined);
      vi.mocked(browser.scripting.getRegisteredContentScripts).mockResolvedValue([]);
      resetIndicatorState();
    });

    it("should call registerContentScripts with correct parameters on first call", async () => {
      await ensureIndicatorCSSRegistered();

      expect(browser.scripting.registerContentScripts).toHaveBeenCalledWith([
        {
          id: "spark-indicator",
          matches: ["<all_urls>"],
          css: ["indicator.css"],
          runAt: "document_start",
          persistAcrossSessions: false,
        },
      ]);
    });

    it("should use single shared ID (not per-tab)", async () => {
      await ensureIndicatorCSSRegistered();

      expect(browser.scripting.registerContentScripts).toHaveBeenCalledWith([
        expect.objectContaining({ id: "spark-indicator" }),
      ]);
    });

    it("should not register again if already registered", async () => {
      await ensureIndicatorCSSRegistered();
      await ensureIndicatorCSSRegistered();

      expect(browser.scripting.registerContentScripts).toHaveBeenCalledTimes(1);
    });

    it("should not throw when registration fails", async () => {
      vi.mocked(browser.scripting.registerContentScripts).mockRejectedValue(
        new Error("Already registered"),
      );

      await expect(ensureIndicatorCSSRegistered()).resolves.toBeUndefined();
    });

    it("should set persistAcrossSessions to false", async () => {
      await ensureIndicatorCSSRegistered();

      expect(browser.scripting.registerContentScripts).toHaveBeenCalledWith([
        expect.objectContaining({
          persistAcrossSessions: false,
        }),
      ]);
    });
  });

  describe("unregisterIndicatorCSSIfUnused (via hideIndicator)", () => {
    beforeEach(() => {
      vi.clearAllMocks();
      vi.mocked(browser.scripting.registerContentScripts).mockResolvedValue(undefined);
      vi.mocked(browser.scripting.unregisterContentScripts).mockResolvedValue(undefined);
      vi.mocked(browser.scripting.insertCSS).mockResolvedValue(undefined);
      vi.mocked(browser.scripting.removeCSS).mockResolvedValue(undefined);
      vi.mocked(browser.scripting.executeScript).mockResolvedValue([]);
      resetIndicatorState();
    });

    afterEach(() => {
      cleanupNavigationListener();
    });

    it("should unregister when no active indicators remain", async () => {
      // Setup: register and add one indicator
      await showIndicator(123);
      vi.clearAllMocks();

      // Hide the only indicator
      await hideIndicator(123);

      expect(browser.scripting.unregisterContentScripts).toHaveBeenCalledWith({
        ids: ["spark-indicator"],
      });
    });

    it("should NOT unregister when other indicators are still active", async () => {
      // Setup: two tabs with indicators
      await showIndicator(123);
      await showIndicator(456);
      vi.clearAllMocks();

      // Hide one indicator
      await hideIndicator(123);

      expect(browser.scripting.unregisterContentScripts).not.toHaveBeenCalled();
    });

    it("should not throw when unregistration fails", async () => {
      vi.mocked(browser.scripting.unregisterContentScripts).mockRejectedValue(
        new Error("Not registered"),
      );

      await showIndicator(123);
      await expect(hideIndicator(123)).resolves.toBeUndefined();
    });
  });

  describe("showIndicator with dynamic registration", () => {
    beforeEach(() => {
      vi.clearAllMocks();
      vi.mocked(browser.scripting.registerContentScripts).mockResolvedValue(undefined);
      vi.mocked(browser.scripting.insertCSS).mockResolvedValue(undefined);
      vi.mocked(browser.scripting.executeScript).mockResolvedValue([]);
      resetIndicatorState();
    });

    afterEach(() => {
      cleanupNavigationListener();
    });

    it("should register shared content script CSS for future navigations", async () => {
      await showIndicator(123);

      expect(browser.scripting.registerContentScripts).toHaveBeenCalledWith([
        expect.objectContaining({
          id: "spark-indicator",
          css: ["indicator.css"],
          runAt: "document_start",
        }),
      ]);
    });

    it("should only register once for multiple tabs", async () => {
      await showIndicator(123);
      await showIndicator(456);

      expect(browser.scripting.registerContentScripts).toHaveBeenCalledTimes(1);
    });

    it("should inject CSS into current page", async () => {
      await showIndicator(123);

      expect(browser.scripting.insertCSS).toHaveBeenCalledWith({
        target: { tabId: 123 },
        css: expect.stringContaining("spark-indicator-active"),
      });
    });

    it("should add class to current page", async () => {
      await showIndicator(123);

      expect(browser.scripting.executeScript).toHaveBeenCalledWith({
        target: { tabId: 123 },
        func: expect.any(Function),
      });
    });

    it("should register CSS before injecting to current page", async () => {
      const callOrder: string[] = [];
      vi.mocked(browser.scripting.registerContentScripts).mockImplementation(async () => {
        callOrder.push("register");
      });
      vi.mocked(browser.scripting.insertCSS).mockImplementation(async () => {
        callOrder.push("insertCSS");
      });

      await showIndicator(123);

      expect(callOrder).toEqual(["register", "insertCSS"]);
    });
  });

  describe("hideIndicator with dynamic registration", () => {
    beforeEach(() => {
      vi.clearAllMocks();
      vi.mocked(browser.scripting.registerContentScripts).mockResolvedValue(undefined);
      vi.mocked(browser.scripting.unregisterContentScripts).mockResolvedValue(undefined);
      vi.mocked(browser.scripting.removeCSS).mockResolvedValue(undefined);
      vi.mocked(browser.scripting.insertCSS).mockResolvedValue(undefined);
      vi.mocked(browser.scripting.executeScript).mockResolvedValue([]);
      resetIndicatorState();
    });

    afterEach(() => {
      cleanupNavigationListener();
    });

    it("should remove class from current page", async () => {
      await showIndicator(123);
      vi.clearAllMocks();

      await hideIndicator(123);

      expect(browser.scripting.executeScript).toHaveBeenCalledWith({
        target: { tabId: 123 },
        func: expect.any(Function),
      });
    });

    it("should remove CSS from current page", async () => {
      await showIndicator(123);
      vi.clearAllMocks();

      await hideIndicator(123);

      expect(browser.scripting.removeCSS).toHaveBeenCalledWith({
        target: { tabId: 123 },
        css: expect.stringContaining("spark-indicator-active"),
      });
    });

    it("should unregister content script CSS when last indicator is hidden", async () => {
      await showIndicator(123);
      vi.clearAllMocks();

      await hideIndicator(123);

      expect(browser.scripting.unregisterContentScripts).toHaveBeenCalledWith({
        ids: ["spark-indicator"],
      });
    });

    it("should NOT unregister when other tabs still have indicators", async () => {
      await showIndicator(123);
      await showIndicator(456);
      vi.clearAllMocks();

      await hideIndicator(123);

      expect(browser.scripting.unregisterContentScripts).not.toHaveBeenCalled();
    });

    it("should unregister CSS after removing from current page", async () => {
      await showIndicator(123);
      vi.clearAllMocks();

      const callOrder: string[] = [];
      vi.mocked(browser.scripting.executeScript).mockImplementation(async () => {
        callOrder.push("executeScript");
        return [];
      });
      vi.mocked(browser.scripting.removeCSS).mockImplementation(async () => {
        callOrder.push("removeCSS");
      });
      vi.mocked(browser.scripting.unregisterContentScripts).mockImplementation(async () => {
        callOrder.push("unregister");
      });

      await hideIndicator(123);

      expect(callOrder).toEqual(["executeScript", "removeCSS", "unregister"]);
    });
  });

  describe("double registration handling", () => {
    beforeEach(() => {
      vi.clearAllMocks();
      // Reset mocks to clear any queued Once behaviors from previous tests
      vi.mocked(browser.scripting.registerContentScripts).mockReset();
      vi.mocked(browser.scripting.insertCSS).mockReset();
      vi.mocked(browser.scripting.executeScript).mockReset();
      // Now set the default resolved values
      vi.mocked(browser.scripting.registerContentScripts).mockResolvedValue(undefined);
      vi.mocked(browser.scripting.insertCSS).mockResolvedValue(undefined);
      vi.mocked(browser.scripting.executeScript).mockResolvedValue([]);
      resetIndicatorState();
    });

    afterEach(() => {
      cleanupNavigationListener();
    });

    it("should handle calling showIndicator twice for same tab", async () => {
      vi.mocked(browser.scripting.registerContentScripts)
        .mockResolvedValueOnce(undefined)
        .mockRejectedValueOnce(new Error("Duplicate script ID"));

      await showIndicator(123);
      await expect(showIndicator(123)).resolves.toBeUndefined();
    });

    it("should not double-register for same tab", async () => {
      await showIndicator(123);
      await showIndicator(123);

      // registerContentScripts only called once due to cssRegistered flag
      expect(browser.scripting.registerContentScripts).toHaveBeenCalledTimes(1);
      // But insertCSS and executeScript are called each time
      expect(browser.scripting.insertCSS).toHaveBeenCalledTimes(2);
    });
  });

  describe("race condition handling", () => {
    beforeEach(() => {
      vi.clearAllMocks();
      vi.mocked(browser.scripting.registerContentScripts).mockResolvedValue(undefined);
      vi.mocked(browser.scripting.unregisterContentScripts).mockResolvedValue(undefined);
      vi.mocked(browser.scripting.insertCSS).mockResolvedValue(undefined);
      vi.mocked(browser.scripting.removeCSS).mockResolvedValue(undefined);
      vi.mocked(browser.scripting.executeScript).mockResolvedValue([]);
      resetIndicatorState();
    });

    afterEach(() => {
      cleanupNavigationListener();
    });

    it("should handle concurrent showIndicator calls without duplicate registration", async () => {
      let registerCallCount = 0;
      vi.mocked(browser.scripting.registerContentScripts).mockImplementation(async () => {
        registerCallCount++;
        await new Promise((resolve) => setTimeout(resolve, 10)); // Simulate delay
      });

      // Call showIndicator concurrently
      await Promise.all([showIndicator(123), showIndicator(456), showIndicator(789)]);

      // Should only register once despite concurrent calls
      expect(registerCallCount).toBe(1);
    });

    it("should handle hideIndicator called while showIndicator is in progress", async () => {
      // Simulate slow registration
      let registrationResolve: () => void;
      vi.mocked(browser.scripting.registerContentScripts).mockImplementation(() => {
        return new Promise((resolve) => {
          registrationResolve = resolve as () => void;
        });
      });

      // Start showIndicator (will block on registration, but adds to activeIndicators immediately)
      const showPromise = showIndicator(123);

      // Tab is already in activeIndicators (added synchronously at start of showIndicator)
      expect(isIndicatorActive(123)).toBe(true);

      // Now hide (before registration completes)
      await hideIndicator(123);

      // Tab should be removed from activeIndicators
      expect(isIndicatorActive(123)).toBe(false);

      // Unregister is NOT called because cssRegistered is still false
      // (registration hasn't completed yet, so there's nothing to unregister)
      expect(browser.scripting.unregisterContentScripts).not.toHaveBeenCalled();

      // Complete the registration
      registrationResolve!();
      await showPromise;

      // After registration completes, the tab is no longer tracked (was removed by hideIndicator),
      // so the indicator won't be visible. This is the expected edge case behavior.
    });
  });

  describe("navigation listener with dynamic registration", () => {
    let capturedWebNavListener: ((details: { tabId: number; frameId: number }) => void) | null =
      null;

    beforeEach(() => {
      vi.clearAllMocks();
      vi.mocked(browser.scripting.registerContentScripts).mockResolvedValue(undefined);
      vi.mocked(browser.scripting.insertCSS).mockResolvedValue(undefined);
      vi.mocked(browser.scripting.executeScript).mockResolvedValue([]);
      vi.mocked(browser.webNavigation.onCommitted.addListener).mockImplementation((listener) => {
        capturedWebNavListener = listener as typeof capturedWebNavListener;
      });
      resetIndicatorState();
    });

    afterEach(() => {
      cleanupNavigationListener();
      capturedWebNavListener = null;
    });

    it("should only executeScript to add class (no insertCSS needed)", async () => {
      setupNavigationListener();
      await showIndicator(123);
      vi.clearAllMocks();

      // Simulate navigation committed
      capturedWebNavListener?.({ tabId: 123, frameId: 0 });
      await new Promise((resolve) => setTimeout(resolve, 0));

      // Should add class but NOT inject CSS (CSS is auto-injected via registerContentScripts)
      expect(browser.scripting.executeScript).toHaveBeenCalledWith({
        target: { tabId: 123 },
        func: expect.any(Function),
      });
      expect(browser.scripting.insertCSS).not.toHaveBeenCalled();
    });
  });

  describe("cleanupStaleRegistrations", () => {
    beforeEach(() => {
      vi.clearAllMocks();
      vi.mocked(browser.scripting.getRegisteredContentScripts).mockResolvedValue([]);
      vi.mocked(browser.scripting.unregisterContentScripts).mockResolvedValue(undefined);
      resetIndicatorState();
    });

    it("should unregister spark-indicator script on startup", async () => {
      const mockScripts: RegisteredContentScriptMock[] = [
        { id: "spark-indicator", matches: ["<all_urls>"], js: [], css: ["indicator.css"] },
        { id: "other-script", matches: ["<all_urls>"], js: [], css: [] },
      ];
      vi.mocked(browser.scripting.getRegisteredContentScripts).mockResolvedValue(
        mockScripts as browser.Scripting.RegisteredContentScript[],
      );

      await cleanupStaleRegistrations();

      expect(browser.scripting.unregisterContentScripts).toHaveBeenCalledWith({
        ids: ["spark-indicator"],
      });
    });

    it("should not call unregister if no stale registrations exist", async () => {
      const mockScripts: RegisteredContentScriptMock[] = [
        { id: "other-script", matches: ["<all_urls>"], js: [], css: [] },
      ];
      vi.mocked(browser.scripting.getRegisteredContentScripts).mockResolvedValue(
        mockScripts as browser.Scripting.RegisteredContentScript[],
      );

      await cleanupStaleRegistrations();

      expect(browser.scripting.unregisterContentScripts).not.toHaveBeenCalled();
    });

    it("should not throw if getRegisteredContentScripts fails", async () => {
      vi.mocked(browser.scripting.getRegisteredContentScripts).mockRejectedValue(
        new Error("API not available"),
      );

      await expect(cleanupStaleRegistrations()).resolves.toBeUndefined();
    });
  });

  describe("tab closure handling", () => {
    let capturedTabRemovedListener: ((tabId: number) => void) | null = null;

    beforeEach(() => {
      vi.clearAllMocks();
      vi.mocked(browser.scripting.registerContentScripts).mockResolvedValue(undefined);
      vi.mocked(browser.scripting.unregisterContentScripts).mockResolvedValue(undefined);
      vi.mocked(browser.scripting.insertCSS).mockResolvedValue(undefined);
      vi.mocked(browser.scripting.removeCSS).mockResolvedValue(undefined);
      vi.mocked(browser.scripting.executeScript).mockResolvedValue([]);
      vi.mocked(browser.tabs.onRemoved.addListener).mockImplementation((listener) => {
        capturedTabRemovedListener = listener as typeof capturedTabRemovedListener;
      });
      resetIndicatorState();
    });

    afterEach(() => {
      cleanupNavigationListener();
      capturedTabRemovedListener = null;
    });

    it("should register tab removal listener on setup", () => {
      setupNavigationListener();
      expect(browser.tabs.onRemoved.addListener).toHaveBeenCalled();
    });

    it("should remove indicator tracking when tab is closed", async () => {
      setupNavigationListener();
      await showIndicator(123);

      expect(isIndicatorActive(123)).toBe(true);

      // Simulate tab close
      capturedTabRemovedListener?.(123);

      expect(isIndicatorActive(123)).toBe(false);
    });

    it("should unregister CSS when last indicator tab is closed", async () => {
      setupNavigationListener();
      await showIndicator(123);
      vi.clearAllMocks();

      // Simulate tab close
      capturedTabRemovedListener?.(123);

      // Wait for async cleanup
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(browser.scripting.unregisterContentScripts).toHaveBeenCalledWith({
        ids: ["spark-indicator"],
      });
    });

    it("should NOT unregister CSS when other tabs still have indicators", async () => {
      setupNavigationListener();
      await showIndicator(123);
      await showIndicator(456);
      vi.clearAllMocks();

      // Simulate tab close for one tab
      capturedTabRemovedListener?.(123);

      // Wait for async cleanup
      await new Promise((resolve) => setTimeout(resolve, 0));

      // Should NOT unregister because tab 456 still has indicator
      expect(browser.scripting.unregisterContentScripts).not.toHaveBeenCalled();
    });
  });
});
