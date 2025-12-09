import { describe, it, expect, afterEach } from "vitest";
import {
  createOverlayElement,
  getIndicatorStyles,
  injectStyles,
  removeStyles,
  showIndicator,
  hideIndicator,
} from "../../src/content/AgentIndicator";

describe("createOverlayElement", () => {
  it("should return a div element for DOM insertion", () => {
    // Act
    const element = createOverlayElement();

    // Assert
    expect(element).toBeInstanceOf(HTMLDivElement);
  });

  it("should be identifiable for later removal (has expected ID)", () => {
    // Act
    const element = createOverlayElement();

    // Assert
    expect(element.id).toBe("spark-agent-indicator");
  });

  it("should have the indicator class for styling", () => {
    // Act
    const element = createOverlayElement();

    // Assert
    expect(element.classList.contains("spark-agent-indicator")).toBe(true);
  });
});

describe("getIndicatorStyles", () => {
  it("should return a non-empty CSS string", () => {
    // Act
    const styles = getIndicatorStyles();

    // Assert
    expect(typeof styles).toBe("string");
    expect(styles.length).toBeGreaterThan(0);
  });

  it("should define the pulsing animation", () => {
    // Act
    const styles = getIndicatorStyles();

    // Assert
    expect(styles).toContain("@keyframes");
    expect(styles).toContain("spark-pulse");
  });

  it("should style the indicator class", () => {
    // Act
    const styles = getIndicatorStyles();

    // Assert
    expect(styles).toContain(".spark-agent-indicator");
    expect(styles).toContain("animation");
  });

  it("should position glow effects in corners using multiple shadows", () => {
    // Act
    const styles = getIndicatorStyles();

    // Assert - multiple inset box-shadows with offsets create corner glow effect
    const shadowMatches = styles.match(/inset\s+-?\d+px\s+-?\d+px/g);
    expect(shadowMatches?.length).toBeGreaterThanOrEqual(4);
  });
});

describe("injectStyles", () => {
  afterEach(() => {
    // Clean up any injected styles
    const styleElement = document.getElementById("spark-agent-indicator-styles");
    if (styleElement) {
      styleElement.remove();
    }
  });

  it("should add styles to document head", () => {
    // Act
    injectStyles();

    // Assert
    const styleElement = document.head.querySelector("style");
    expect(styleElement).not.toBeNull();
  });

  it("should use unique ID to enable cleanup", () => {
    // Act
    injectStyles();

    // Assert
    const styleElement = document.getElementById("spark-agent-indicator-styles");
    expect(styleElement).not.toBeNull();
  });

  it("should be safe to call multiple times (idempotent)", () => {
    // Act - call twice
    injectStyles();
    injectStyles();

    // Assert - should only have one style element
    const styleElements = document.querySelectorAll("#spark-agent-indicator-styles");
    expect(styleElements.length).toBe(1);
  });

  it("should handle missing document.head gracefully", () => {
    // Arrange - remove document.head
    const originalHead = document.head;
    Object.defineProperty(document, "head", { value: null, configurable: true });

    // Act & Assert - should not throw
    expect(() => injectStyles()).not.toThrow();

    // Cleanup
    Object.defineProperty(document, "head", { value: originalHead, configurable: true });
  });
});

describe("removeStyles", () => {
  afterEach(() => {
    // Clean up any injected styles
    const styleElement = document.getElementById("spark-agent-indicator-styles");
    if (styleElement) {
      styleElement.remove();
    }
  });

  it("should remove previously injected styles", () => {
    // Arrange
    injectStyles();
    expect(document.getElementById("spark-agent-indicator-styles")).not.toBeNull();

    // Act
    removeStyles();

    // Assert
    expect(document.getElementById("spark-agent-indicator-styles")).toBeNull();
  });

  it("should be safe to call when no styles exist", () => {
    // Arrange - ensure no styles exist
    expect(document.getElementById("spark-agent-indicator-styles")).toBeNull();

    // Act & Assert - should not throw
    expect(() => removeStyles()).not.toThrow();
  });
});

describe("showIndicator", () => {
  afterEach(() => {
    // Clean up indicator and styles
    const indicator = document.getElementById("spark-agent-indicator");
    if (indicator) {
      indicator.remove();
    }
    const styles = document.getElementById("spark-agent-indicator-styles");
    if (styles) {
      styles.remove();
    }
  });

  it("should display the border overlay on the page", () => {
    // Act
    showIndicator();

    // Assert
    const indicator = document.getElementById("spark-agent-indicator");
    expect(indicator).not.toBeNull();
    expect(document.body.contains(indicator)).toBe(true);
  });

  it("should ensure styles are available before showing", () => {
    // Arrange - ensure no styles exist initially
    expect(document.getElementById("spark-agent-indicator-styles")).toBeNull();

    // Act
    showIndicator();

    // Assert - styles should have been injected
    const styles = document.getElementById("spark-agent-indicator-styles");
    expect(styles).not.toBeNull();
  });

  it("should be safe to call multiple times (idempotent)", () => {
    // Act - call twice
    showIndicator();
    showIndicator();

    // Assert - should only have one indicator element
    const indicators = document.querySelectorAll("#spark-agent-indicator");
    expect(indicators.length).toBe(1);
  });

  it("should handle missing document.body gracefully", () => {
    // Arrange - remove document.body
    const originalBody = document.body;
    Object.defineProperty(document, "body", { value: null, configurable: true });

    // Act & Assert - should not throw
    expect(() => showIndicator()).not.toThrow();

    // Cleanup
    Object.defineProperty(document, "body", { value: originalBody, configurable: true });
  });
});

describe("hideIndicator", () => {
  afterEach(() => {
    // Clean up indicator and styles
    const indicator = document.getElementById("spark-agent-indicator");
    if (indicator) {
      indicator.remove();
    }
    const styles = document.getElementById("spark-agent-indicator-styles");
    if (styles) {
      styles.remove();
    }
  });

  it("should remove the border overlay from the page", () => {
    // Arrange - show the indicator first
    showIndicator();
    expect(document.getElementById("spark-agent-indicator")).not.toBeNull();

    // Act
    hideIndicator();

    // Assert
    expect(document.getElementById("spark-agent-indicator")).toBeNull();
  });

  it("should clean up associated styles", () => {
    // Arrange - show the indicator first (which injects styles)
    showIndicator();
    expect(document.getElementById("spark-agent-indicator-styles")).not.toBeNull();

    // Act
    hideIndicator();

    // Assert
    expect(document.getElementById("spark-agent-indicator-styles")).toBeNull();
  });

  it("should be safe to call when no indicator is visible", () => {
    // Arrange - ensure no indicator exists
    expect(document.getElementById("spark-agent-indicator")).toBeNull();

    // Act & Assert - should not throw
    expect(() => hideIndicator()).not.toThrow();
  });

  it("should handle missing document.body gracefully", () => {
    // Arrange - remove document.body
    const originalBody = document.body;
    Object.defineProperty(document, "body", { value: null, configurable: true });

    // Act & Assert - should not throw
    expect(() => hideIndicator()).not.toThrow();

    // Cleanup
    Object.defineProperty(document, "body", { value: originalBody, configurable: true });
  });
});
