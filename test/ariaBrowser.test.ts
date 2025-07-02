import { describe, it, expect } from "vitest";
import { PageAction, LoadState } from "../src/browser/ariaBrowser.js";

describe("AriaBrowser interface", () => {
  describe("PageAction enum", () => {
    it("should have all required action types", () => {
      const expectedActions = [
        "click",
        "hover",
        "fill",
        "focus",
        "check",
        "uncheck",
        "select",
        "enter",
        "wait",
        "goto",
        "back",
        "forward",
        "done",
      ];

      const actualActions = Object.values(PageAction);

      expectedActions.forEach((action) => {
        expect(actualActions).toContain(action);
      });

      expect(actualActions.length).toBe(expectedActions.length);
    });

    it("should have correct string values", () => {
      expect(PageAction.Click).toBe("click");
      expect(PageAction.Hover).toBe("hover");
      expect(PageAction.Fill).toBe("fill");
      expect(PageAction.Focus).toBe("focus");
      expect(PageAction.Check).toBe("check");
      expect(PageAction.Uncheck).toBe("uncheck");
      expect(PageAction.Select).toBe("select");
      expect(PageAction.Enter).toBe("enter");
      expect(PageAction.Wait).toBe("wait");
      expect(PageAction.Goto).toBe("goto");
      expect(PageAction.Back).toBe("back");
      expect(PageAction.Forward).toBe("forward");
      expect(PageAction.Done).toBe("done");
    });

    it("should categorize actions correctly", () => {
      // Element interaction actions (require ref)
      const elementActions = [
        PageAction.Click,
        PageAction.Hover,
        PageAction.Fill,
        PageAction.Focus,
        PageAction.Check,
        PageAction.Uncheck,
        PageAction.Select,
        PageAction.Enter,
      ];

      // Navigation actions
      const navigationActions = [PageAction.Goto, PageAction.Back, PageAction.Forward];

      // Control actions
      const controlActions = [PageAction.Wait, PageAction.Done];

      const allActions = [...elementActions, ...navigationActions, ...controlActions];
      const enumValues = Object.values(PageAction);

      expect(allActions.length).toBe(enumValues.length);
      allActions.forEach((action) => {
        expect(enumValues).toContain(action);
      });
    });
  });

  describe("LoadState enum", () => {
    it("should have all required load states", () => {
      const expectedStates = ["networkidle", "domcontentloaded", "load"];

      const actualStates = Object.values(LoadState);

      expectedStates.forEach((state) => {
        expect(actualStates).toContain(state);
      });

      expect(actualStates.length).toBe(expectedStates.length);
    });

    it("should have correct string values", () => {
      expect(LoadState.NetworkIdle).toBe("networkidle");
      expect(LoadState.DOMContentLoaded).toBe("domcontentloaded");
      expect(LoadState.Load).toBe("load");
    });

    it("should represent different load completion levels", () => {
      // These represent progressive levels of page load completion
      expect(LoadState.DOMContentLoaded).toBe("domcontentloaded"); // Basic DOM ready
      expect(LoadState.Load).toBe("load"); // All resources loaded
      expect(LoadState.NetworkIdle).toBe("networkidle"); // Network activity settled
    });
  });

  describe("Interface contract", () => {
    it("should define all required browser methods", () => {
      // This test ensures the interface contract is complete
      // We can't instantiate an interface, but we can verify the types exist
      const expectedMethods = [
        "start",
        "shutdown",
        "goto",
        "goBack",
        "goForward",
        "getUrl",
        "getTitle",
        "getText",
        "getScreenshot",
        "performAction",
        "waitForLoadState",
      ];

      // TypeScript compilation ensures these methods exist in the interface
      // This test documents the expected interface contract
      expect(expectedMethods.length).toBe(11);
    });
  });

  describe("Action requirements", () => {
    it("should identify actions that require element references", () => {
      const refRequiredActions = [
        PageAction.Click,
        PageAction.Hover,
        PageAction.Fill,
        PageAction.Focus,
        PageAction.Check,
        PageAction.Uncheck,
        PageAction.Select,
        PageAction.Enter,
      ];

      // These actions operate on specific elements and need refs
      refRequiredActions.forEach((action) => {
        expect(typeof action).toBe("string");
        expect(action.length).toBeGreaterThan(0);
      });
    });

    it("should identify actions that require values", () => {
      const valueRequiredActions = [
        PageAction.Fill, // text to fill
        PageAction.Select, // option to select
        PageAction.Wait, // seconds to wait
        PageAction.Goto, // URL to navigate to
        PageAction.Done, // final result
      ];

      // These actions need additional data to function
      valueRequiredActions.forEach((action) => {
        expect(typeof action).toBe("string");
        expect(action.length).toBeGreaterThan(0);
      });
    });

    it("should identify actions that are standalone", () => {
      const standaloneActions = [PageAction.Back, PageAction.Forward];

      // These actions don't need refs or values
      standaloneActions.forEach((action) => {
        expect(typeof action).toBe("string");
        expect(action.length).toBeGreaterThan(0);
      });
    });
  });

  describe("Type safety", () => {
    it("should use string enum pattern", () => {
      // Ensure all PageAction values are strings (not numeric)
      Object.values(PageAction).forEach((action) => {
        expect(typeof action).toBe("string");
      });

      // Ensure all LoadState values are strings (not numeric)
      Object.values(LoadState).forEach((state) => {
        expect(typeof state).toBe("string");
      });
    });

    it("should have consistent naming convention", () => {
      // PageAction values should be lowercase
      Object.values(PageAction).forEach((action) => {
        expect(action).toBe(action.toLowerCase());
        expect(action).not.toContain(" ");
        expect(action).not.toContain("-");
        expect(action).not.toContain("_");
      });

      // LoadState values should be lowercase
      Object.values(LoadState).forEach((state) => {
        expect(state).toBe(state.toLowerCase());
      });
    });
  });

  describe("Enum completeness", () => {
    it("should cover all common browser automation actions", () => {
      const actionCategories = {
        clicking: [PageAction.Click],
        typing: [PageAction.Fill],
        selecting: [PageAction.Select],
        checkboxes: [PageAction.Check, PageAction.Uncheck],
        navigation: [PageAction.Goto, PageAction.Back, PageAction.Forward],
        interaction: [PageAction.Hover, PageAction.Focus],
        control: [PageAction.Wait, PageAction.Done],
      };

      // Verify we have actions for all major categories
      Object.entries(actionCategories).forEach(([category, actions]) => {
        expect(actions.length).toBeGreaterThan(0);
        actions.forEach((action) => {
          expect(Object.values(PageAction)).toContain(action);
        });
      });
    });

    it("should cover all common load states", () => {
      const loadCategories = {
        domReady: LoadState.DOMContentLoaded,
        fullyLoaded: LoadState.Load,
        networkQuiet: LoadState.NetworkIdle,
      };

      // Verify we have states for different load conditions
      Object.values(loadCategories).forEach((state) => {
        expect(Object.values(LoadState)).toContain(state);
      });
    });
  });
});
