/**
 * Creates the overlay element for the agent indicator border
 */
export function createOverlayElement(): HTMLDivElement {
  const element = document.createElement("div");
  element.id = "spark-agent-indicator";
  element.classList.add("spark-agent-indicator");
  return element;
}

/**
 * Returns the CSS styles for the agent indicator
 */
export function getIndicatorStyles(): string {
  return `
@keyframes spark-pulse {
  0%, 100% {
    opacity: 0.6;
  }
  50% {
    opacity: 1;
  }
}
.spark-agent-indicator {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
  z-index: 2147483647;
  box-shadow:
    inset 60px 60px 80px -40px rgba(139, 92, 246, 0.6),
    inset -60px 60px 80px -40px rgba(139, 92, 246, 0.6),
    inset 60px -60px 80px -40px rgba(139, 92, 246, 0.6),
    inset -60px -60px 80px -40px rgba(139, 92, 246, 0.6);
  animation: spark-pulse 2s ease-in-out infinite;
}
`;
}

/**
 * Injects the indicator styles into the document head
 */
export function injectStyles(): void {
  if (!document.head) {
    return;
  }
  if (document.getElementById("spark-agent-indicator-styles")) {
    return;
  }
  const style = document.createElement("style");
  style.id = "spark-agent-indicator-styles";
  style.textContent = getIndicatorStyles();
  document.head.appendChild(style);
}

/**
 * Removes the injected indicator styles from the document
 */
export function removeStyles(): void {
  const styleElement = document.getElementById("spark-agent-indicator-styles");
  if (styleElement) {
    styleElement.remove();
  }
}

/**
 * Shows the agent indicator border overlay on the page
 */
export function showIndicator(): void {
  if (!document.body) {
    return;
  }
  if (document.getElementById("spark-agent-indicator")) {
    return;
  }
  injectStyles();
  const overlay = createOverlayElement();
  document.body.appendChild(overlay);
}

/**
 * Hides the agent indicator border overlay
 */
export function hideIndicator(): void {
  const indicator = document.getElementById("spark-agent-indicator");
  if (indicator) {
    indicator.remove();
  }
  removeStyles();
}
