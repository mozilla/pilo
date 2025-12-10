import { describe, it, expect, afterEach } from "vitest";
import {
  createOverlayElement,
  getIndicatorStyles,
  injectStyles,
  removeStyles,
  showIndicator,
  hideIndicator,
  EFFECT_MODES,
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

describe("showIndicator with effect modes", () => {
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
    // Remove all agent-mode classes
    document.documentElement.classList.remove(
      "agent-mode-glow",
      "agent-mode-water",
      "agent-mode-paper",
    );
  });

  it("should accept effect mode parameter without throwing", () => {
    // Act & Assert - should not throw with mode parameter
    expect(() => showIndicator("water")).not.toThrow();
  });

  it("should add agent-mode-glow class to html element by default", () => {
    // Act
    showIndicator();

    // Assert
    expect(document.documentElement.classList.contains("agent-mode-glow")).toBe(true);
  });

  it("should add agent-mode-water class when water mode specified", () => {
    // Act
    showIndicator("water");

    // Assert
    expect(document.documentElement.classList.contains("agent-mode-water")).toBe(true);
  });

  it("should add agent-mode-paper class when paper mode specified", () => {
    // Act
    showIndicator("paper");

    // Assert
    expect(document.documentElement.classList.contains("agent-mode-paper")).toBe(true);
  });

  it("should still create overlay div when mode is specified", () => {
    // Act
    showIndicator("water");

    // Assert
    const indicator = document.getElementById("spark-agent-indicator");
    expect(indicator).not.toBeNull();
    expect(document.body.contains(indicator)).toBe(true);
  });
});

describe("hideIndicator with effect modes", () => {
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
    // Remove all agent-mode classes
    document.documentElement.classList.remove(
      "agent-mode-glow",
      "agent-mode-water",
      "agent-mode-paper",
    );
  });

  it("should remove agent-mode-glow class when hiding", () => {
    // Arrange
    showIndicator("glow");
    expect(document.documentElement.classList.contains("agent-mode-glow")).toBe(true);

    // Act
    hideIndicator();

    // Assert
    expect(document.documentElement.classList.contains("agent-mode-glow")).toBe(false);
  });

  it("should remove agent-mode-water class when hiding", () => {
    // Arrange
    showIndicator("water");
    expect(document.documentElement.classList.contains("agent-mode-water")).toBe(true);

    // Act
    hideIndicator();

    // Assert
    expect(document.documentElement.classList.contains("agent-mode-water")).toBe(false);
  });

  it("should remove agent-mode-paper class when hiding", () => {
    // Arrange
    showIndicator("paper");
    expect(document.documentElement.classList.contains("agent-mode-paper")).toBe(true);

    // Act
    hideIndicator();

    // Assert
    expect(document.documentElement.classList.contains("agent-mode-paper")).toBe(false);
  });
});

describe("effect mode switching", () => {
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
    // Remove all agent-mode classes
    document.documentElement.classList.remove(
      "agent-mode-glow",
      "agent-mode-water",
      "agent-mode-paper",
    );
  });

  it("should remove previous mode class when switching to new mode", () => {
    // Arrange - start with glow mode
    showIndicator("glow");
    expect(document.documentElement.classList.contains("agent-mode-glow")).toBe(true);

    // Act - hide and show with different mode
    hideIndicator();
    showIndicator("water");

    // Assert - only water mode should be active
    expect(document.documentElement.classList.contains("agent-mode-glow")).toBe(false);
    expect(document.documentElement.classList.contains("agent-mode-water")).toBe(true);
  });

  it("should allow only one mode class at a time when directly switching", () => {
    // Arrange - manually set up glow mode class
    showIndicator("glow");

    // Act - remove indicator div only (simulating a mode switch scenario)
    const indicator = document.getElementById("spark-agent-indicator");
    if (indicator) {
      indicator.remove();
    }
    // Now show with water mode (this is where we want to ensure old class is removed)
    showIndicator("water");

    // Assert - should have water mode, and NOT glow (ensures showIndicator removes old modes)
    expect(document.documentElement.classList.contains("agent-mode-water")).toBe(true);
    expect(document.documentElement.classList.contains("agent-mode-glow")).toBe(false);
  });
});

describe("CSS structure for pseudo-elements", () => {
  it("should define body::before pseudo-element", () => {
    const styles = getIndicatorStyles();
    expect(styles).toContain("body::before");
  });

  it("should define body::after pseudo-element", () => {
    const styles = getIndicatorStyles();
    expect(styles).toContain("body::after");
  });

  it("should define overlay div ::before pseudo-element", () => {
    const styles = getIndicatorStyles();
    expect(styles).toContain("#spark-agent-indicator::before");
  });

  it("should define overlay div ::after pseudo-element", () => {
    const styles = getIndicatorStyles();
    expect(styles).toContain("#spark-agent-indicator::after");
  });

  it("should include content property for pseudo-elements", () => {
    const styles = getIndicatorStyles();
    expect(styles).toContain('content: ""');
  });

  it("should include pointer-events: none for non-blocking overlay", () => {
    const styles = getIndicatorStyles();
    expect(styles).toContain("pointer-events: none");
  });

  it("should include fixed positioning for viewport-relative overlay", () => {
    const styles = getIndicatorStyles();
    expect(styles).toContain("position: fixed");
  });
});

describe("CSS variables for effects", () => {
  it("should define water effect CSS variables on :root", () => {
    const styles = getIndicatorStyles();
    expect(styles).toContain("--water-tint");
    expect(styles).toContain("--water-caustic-intensity");
    expect(styles).toContain("--water-speed");
  });

  it("should define paper effect CSS variables on :root", () => {
    const styles = getIndicatorStyles();
    expect(styles).toContain("--paper-shadow-strength");
    expect(styles).toContain("--paper-grain-opacity");
    expect(styles).toContain("--paper-breathe-distance");
    expect(styles).toContain("--paper-breathe-duration");
  });
});

describe("glow effect CSS", () => {
  it("should have html.agent-mode-glow selector", () => {
    const styles = getIndicatorStyles();
    expect(styles).toContain("html.agent-mode-glow");
  });

  it("should style the overlay div when glow mode is active", () => {
    const styles = getIndicatorStyles();
    expect(styles).toContain("html.agent-mode-glow .spark-agent-indicator");
  });

  it("should include box-shadow for corner glow effect", () => {
    const styles = getIndicatorStyles();
    expect(styles).toContain("box-shadow");
    expect(styles).toContain("inset");
  });

  it("should include spark-pulse animation", () => {
    const styles = getIndicatorStyles();
    expect(styles).toContain("@keyframes spark-pulse");
    expect(styles).toContain("animation");
  });
});

describe("water effect CSS", () => {
  it("should have html.agent-mode-water selector", () => {
    const styles = getIndicatorStyles();
    expect(styles).toContain("html.agent-mode-water");
  });

  it("should use backdrop-filter for underwater haze", () => {
    const styles = getIndicatorStyles();
    expect(styles).toContain("backdrop-filter");
    expect(styles).toContain("blur(");
  });

  it("should have refraction animation keyframes", () => {
    const styles = getIndicatorStyles();
    expect(styles).toContain("@keyframes spark-water-refract");
  });

  it("should have caustics animation keyframes", () => {
    const styles = getIndicatorStyles();
    expect(styles).toContain("@keyframes spark-water-caustics");
  });

  it("should have surface reflection animation keyframes", () => {
    const styles = getIndicatorStyles();
    expect(styles).toContain("@keyframes spark-water-surface");
  });

  it("should use CSS variables for customization", () => {
    const styles = getIndicatorStyles();
    expect(styles).toContain("var(--water-tint)");
    expect(styles).toContain("var(--water-speed)");
  });
});

describe("paper effect CSS", () => {
  it("should have html.agent-mode-paper selector", () => {
    const styles = getIndicatorStyles();
    expect(styles).toContain("html.agent-mode-paper");
  });

  it("should have shadow for lifted paper appearance", () => {
    const styles = getIndicatorStyles();
    // Should have either box-shadow or drop-shadow for paper effect
    expect(styles).toMatch(/box-shadow|drop-shadow/);
  });

  it("should have grain texture via SVG noise filter", () => {
    const styles = getIndicatorStyles();
    expect(styles).toContain("feTurbulence");
  });

  it("should have breathing animation keyframes", () => {
    const styles = getIndicatorStyles();
    expect(styles).toContain("@keyframes spark-paper-breathe");
  });

  it("should apply breathing animation", () => {
    const styles = getIndicatorStyles();
    expect(styles).toContain("spark-paper-breathe");
  });

  it("should use CSS variables for customization", () => {
    const styles = getIndicatorStyles();
    expect(styles).toContain("var(--paper-shadow-strength)");
    expect(styles).toContain("var(--paper-breathe-duration)");
  });
});

describe("integration: effect mode switching end-to-end", () => {
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
    // Remove all agent-mode classes
    document.documentElement.classList.remove(
      "agent-mode-glow",
      "agent-mode-water",
      "agent-mode-paper",
    );
  });

  it("should switch between all modes correctly", () => {
    // Start with glow (default)
    showIndicator();
    expect(document.documentElement.classList.contains("agent-mode-glow")).toBe(true);
    expect(document.getElementById("spark-agent-indicator")).not.toBeNull();

    // Hide and switch to water
    hideIndicator();
    expect(document.documentElement.classList.contains("agent-mode-glow")).toBe(false);
    showIndicator("water");
    expect(document.documentElement.classList.contains("agent-mode-water")).toBe(true);
    expect(document.documentElement.classList.contains("agent-mode-glow")).toBe(false);

    // Hide and switch to paper
    hideIndicator();
    showIndicator("paper");
    expect(document.documentElement.classList.contains("agent-mode-paper")).toBe(true);
    expect(document.documentElement.classList.contains("agent-mode-water")).toBe(false);

    // Hide and switch back to glow
    hideIndicator();
    showIndicator("glow");
    expect(document.documentElement.classList.contains("agent-mode-glow")).toBe(true);
    expect(document.documentElement.classList.contains("agent-mode-paper")).toBe(false);

    // Final cleanup
    hideIndicator();
    expect(document.getElementById("spark-agent-indicator")).toBeNull();
    expect(document.documentElement.classList.contains("agent-mode-glow")).toBe(false);
  });
});

describe("backwards compatibility", () => {
  afterEach(() => {
    const indicator = document.getElementById("spark-agent-indicator");
    if (indicator) {
      indicator.remove();
    }
    const styles = document.getElementById("spark-agent-indicator-styles");
    if (styles) {
      styles.remove();
    }
    document.documentElement.classList.remove(
      "agent-mode-glow",
      "agent-mode-water",
      "agent-mode-paper",
    );
  });

  it("should default to glow mode when showIndicator called without arguments", () => {
    // Act
    showIndicator();

    // Assert
    expect(document.documentElement.classList.contains("agent-mode-glow")).toBe(true);
  });
});

describe("EFFECT_MODES export", () => {
  it("should export array containing all effect modes", () => {
    expect(EFFECT_MODES).toContain("glow");
    expect(EFFECT_MODES).toContain("water");
    expect(EFFECT_MODES).toContain("paper");
  });

  it("should have exactly 3 modes", () => {
    expect(EFFECT_MODES.length).toBe(3);
  });
});
