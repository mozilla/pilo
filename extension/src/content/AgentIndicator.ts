/**
 * Effect mode type for visual indicator effects
 */
export type EffectMode = "glow" | "water" | "paper";

/**
 * Available effect modes for the agent indicator
 */
export const EFFECT_MODES: EffectMode[] = ["glow", "water", "paper"];

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
/* CSS Variables for effect customization */
:root {
  /* Water effect variables - designed to look like a clear sunny pond */
  --water-tint: rgba(0, 80, 140, 0.18);
  --water-refraction: 0.8px;
  --water-speed: 2.5s;
  --water-saturate: 1.12;
  --water-brightness: 1.02;
  --water-caustic-intensity: 0.9;
  --water-surface-reflection: 0.98;
  --water-surface-height: 18%;

  /* Paper effect variables */
  --paper-tint: rgba(255, 248, 230, 0.4);
  --paper-shadow-strength: 0.25;
  --paper-grain-opacity: 0.08;
  --paper-breathe-distance: 3px;
  --paper-breathe-duration: 3s;
}

/* Base pseudo-element styles - hidden by default */
body::before,
body::after,
#spark-agent-indicator::before,
#spark-agent-indicator::after {
  content: "";
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  pointer-events: none;
  z-index: 2147483646;
  opacity: 0;
  transition: opacity 0.3s ease;
}

/* Glow effect animation */
@keyframes spark-pulse {
  0%, 100% {
    opacity: 0.6;
  }
  50% {
    opacity: 0.85;
  }
}

/* Overlay div base styles - no visual effect until mode is activated */
.spark-agent-indicator {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
  z-index: 2147483647;
}

/* ========== GLOW EFFECT ========== */
html.agent-mode-glow .spark-agent-indicator {
  box-shadow:
    inset 60px 60px 80px -40px rgba(139, 92, 246, 0.6),
    inset -60px 60px 80px -40px rgba(139, 92, 246, 0.6),
    inset 60px -60px 80px -40px rgba(139, 92, 246, 0.6),
    inset -60px -60px 80px -40px rgba(139, 92, 246, 0.6);
  animation: spark-pulse 3s ease-in-out infinite;
}

/* ========== WATER EFFECT ========== */
/* Refraction effect - distorts content as if viewed through water */
@keyframes spark-water-refract {
  0%, 100% {
    backdrop-filter: blur(var(--water-refraction)) saturate(var(--water-saturate)) brightness(var(--water-brightness));
  }
  25% {
    backdrop-filter: blur(calc(var(--water-refraction) * 1.8)) saturate(calc(var(--water-saturate) * 1.01)) brightness(calc(var(--water-brightness) * 1.02));
  }
  50% {
    backdrop-filter: blur(calc(var(--water-refraction) * 0.6)) saturate(calc(var(--water-saturate) * 1.03)) brightness(var(--water-brightness));
  }
  75% {
    backdrop-filter: blur(calc(var(--water-refraction) * 1.4)) saturate(var(--water-saturate)) brightness(calc(var(--water-brightness) * 0.98));
  }
}

/* Caustic light patterns - sunlight refracted through water onto the page */
@keyframes spark-water-caustics {
  0% {
    background-position: 50% 50%, 0% 0%, 100% 0%, 0% 100%, 100% 100%, 0% 50%, 50% 0%, 100% 50%, 50% 50%;
  }
  25% {
    background-position: 50% 50%, 25% 20%, 75% 25%, 25% 75%, 80% 70%, 20% 70%, 70% 20%, 80% 40%, 35% 65%;
  }
  50% {
    background-position: 50% 50%, 50% 40%, 50% 50%, 50% 50%, 50% 40%, 50% 90%, 90% 50%, 50% 30%, 65% 35%;
  }
  75% {
    background-position: 50% 50%, 75% 60%, 25% 75%, 75% 25%, 20% 60%, 80% 60%, 30% 80%, 20% 60%, 45% 55%;
  }
  100% {
    background-position: 50% 50%, 100% 80%, 0% 100%, 100% 0%, 0% 30%, 100% 30%, 10% 100%, 0% 70%, 55% 45%;
  }
}

/* Surface reflection - sunlight glinting off the water surface */
@keyframes spark-water-surface {
  0%, 100% {
    opacity: var(--water-surface-reflection);
    background-position: 0% 0%, 50% 0%, 100% 0%;
  }
  33% {
    opacity: calc(var(--water-surface-reflection) * 1.4);
    background-position: 33% 0%, 66% 0%, 0% 0%;
  }
  66% {
    opacity: calc(var(--water-surface-reflection) * 0.7);
    background-position: 66% 0%, 33% 0%, 50% 0%;
  }
}

/* Ripple effect on water surface */
@keyframes spark-water-ripple {
  0%, 100% {
    transform: scaleY(1) scaleX(1);
  }
  25% {
    transform: scaleY(1.01) scaleX(0.995);
  }
  50% {
    transform: scaleY(1.02) scaleX(1.005);
  }
  75% {
    transform: scaleY(1.005) scaleX(0.998);
  }
}

/* Wave line animation for visible ripples */
@keyframes spark-water-wave {
  0% {
    background-position: 0% 0%, 50% 0%, 100% 0%, 0% 2%, 0% 4%;
  }
  50% {
    background-position: 50% 0%, 100% 0%, 50% 0%, 50% 2%, 50% 4%;
  }
  100% {
    background-position: 100% 0%, 50% 0%, 0% 0%, 100% 2%, 100% 4%;
  }
}

/* Refraction layer - the water body distorting the page */
html.agent-mode-water #spark-agent-indicator::before {
  background: var(--water-tint);
  backdrop-filter: blur(var(--water-refraction)) saturate(var(--water-saturate)) brightness(var(--water-brightness));
  opacity: 1;
  animation: spark-water-refract var(--water-speed) ease-in-out infinite;
}

/* Water surface layer - the visible surface you're looking up at from underwater */
html.agent-mode-water .spark-agent-indicator {
  background:
    /* Sharp water surface line - distinct boundary between air and water */
    linear-gradient(180deg,
      rgba(255, 255, 255, 1) 0%,
      rgba(255, 255, 255, 0.98) 0.3%,
      rgba(200, 235, 255, 0.95) 0.6%,
      rgba(150, 215, 250, 0.85) 1.2%,
      rgba(100, 195, 245, 0.65) 2%,
      rgba(60, 175, 235, 0.4) 3.5%,
      rgba(30, 155, 220, 0.2) 6%,
      rgba(10, 140, 210, 0.1) 10%,
      transparent 15%
    ),
    /* Sun core - tiny, intensely bright white center */
    radial-gradient(ellipse 1.5% 0.8% at 62% 0.4%, rgba(255, 255, 255, 1) 0%, rgba(255, 255, 255, 1) 50%, transparent 100%),
    /* Sun inner glow - small bright halo */
    radial-gradient(ellipse 3% 1.5% at 62% 0.5%, rgba(255, 255, 255, 0.95) 0%, rgba(255, 255, 240, 0.7) 40%, transparent 100%),
    /* Sun outer glow - subtle warm halo */
    radial-gradient(ellipse 5% 2.5% at 62% 0.6%, rgba(255, 255, 220, 0.5) 0%, rgba(255, 255, 200, 0.2) 50%, transparent 100%),
    /* Sun glitter trail - vertical shimmer on water */
    radial-gradient(ellipse 1% 4% at 62% 2%, rgba(255, 255, 255, 0.8) 0%, rgba(255, 255, 255, 0.3) 50%, transparent 100%),
    /* Tiny bright sparkles scattered on surface */
    radial-gradient(ellipse 0.8% 0.4% at 45% 0.5%, rgba(255, 255, 255, 1) 0%, transparent 100%),
    radial-gradient(ellipse 0.6% 0.3% at 78% 1.2%, rgba(255, 255, 255, 0.95) 0%, transparent 100%),
    radial-gradient(ellipse 0.7% 0.35% at 25% 1.8%, rgba(255, 255, 255, 0.9) 0%, transparent 100%),
    radial-gradient(ellipse 0.5% 0.25% at 88% 0.6%, rgba(255, 255, 255, 0.85) 0%, transparent 100%),
    radial-gradient(ellipse 0.4% 0.2% at 35% 2.2%, rgba(255, 255, 255, 0.8) 0%, transparent 100%),
    radial-gradient(ellipse 0.6% 0.3% at 55% 1.5%, rgba(255, 255, 255, 0.75) 0%, transparent 100%);
  animation: spark-water-ripple calc(var(--water-speed) * 1.2) ease-in-out infinite;
}

/* Caustic light patterns - dancing sunlight refracted through water surface */
html.agent-mode-water #spark-agent-indicator::after {
  background:
    /* Underwater edge vignette - darker at edges like looking through water */
    radial-gradient(ellipse 90% 80% at 50% 50%, transparent 40%, rgba(0, 60, 100, 0.15) 80%, rgba(0, 40, 80, 0.25) 100%),
    /* Caustic light networks - white/cyan light patterns like on pool bottom */
    radial-gradient(ellipse 25% 20% at 15% 45%, rgba(255, 255, 255, calc(var(--water-caustic-intensity) * 0.4)) 0%, rgba(220, 255, 255, calc(var(--water-caustic-intensity) * 0.2)) 40%, transparent 70%),
    radial-gradient(ellipse 30% 25% at 78% 35%, rgba(255, 255, 255, calc(var(--water-caustic-intensity) * 0.35)) 0%, rgba(220, 255, 255, calc(var(--water-caustic-intensity) * 0.18)) 45%, transparent 75%),
    radial-gradient(ellipse 22% 28% at 45% 70%, rgba(255, 255, 255, calc(var(--water-caustic-intensity) * 0.38)) 0%, rgba(220, 255, 255, calc(var(--water-caustic-intensity) * 0.2)) 40%, transparent 68%),
    radial-gradient(ellipse 28% 22% at 88% 60%, rgba(255, 255, 255, calc(var(--water-caustic-intensity) * 0.32)) 0%, rgba(220, 255, 255, calc(var(--water-caustic-intensity) * 0.16)) 42%, transparent 72%),
    radial-gradient(ellipse 20% 24% at 25% 85%, rgba(255, 255, 255, calc(var(--water-caustic-intensity) * 0.3)) 0%, rgba(220, 255, 255, calc(var(--water-caustic-intensity) * 0.15)) 38%, transparent 65%),
    radial-gradient(ellipse 26% 20% at 60% 25%, rgba(255, 255, 255, calc(var(--water-caustic-intensity) * 0.36)) 0%, rgba(220, 255, 255, calc(var(--water-caustic-intensity) * 0.18)) 40%, transparent 70%),
    radial-gradient(ellipse 24% 26% at 8% 30%, rgba(255, 255, 255, calc(var(--water-caustic-intensity) * 0.28)) 0%, rgba(220, 255, 255, calc(var(--water-caustic-intensity) * 0.14)) 42%, transparent 68%),
    radial-gradient(ellipse 18% 22% at 50% 50%, rgba(255, 255, 255, calc(var(--water-caustic-intensity) * 0.25)) 0%, rgba(220, 255, 255, calc(var(--water-caustic-intensity) * 0.12)) 35%, transparent 60%);
  background-size: 100% 100%, 200% 200%, 200% 200%, 200% 200%, 200% 200%, 200% 200%, 200% 200%, 200% 200%, 200% 200%;
  opacity: 1;
  animation: spark-water-caustics var(--water-speed) ease-in-out infinite;
}

/* ========== PAPER EFFECT ========== */
@keyframes spark-paper-breathe {
  0%, 100% {
    transform: translateY(0);
    box-shadow:
      inset 0 0 60px rgba(139, 90, 43, 0.1),
      0 4px 20px rgba(0, 0, 0, var(--paper-shadow-strength)),
      0 8px 40px rgba(0, 0, 0, calc(var(--paper-shadow-strength) * 0.5));
  }
  50% {
    transform: translateY(calc(var(--paper-breathe-distance) * -1));
    box-shadow:
      inset 0 0 80px rgba(139, 90, 43, 0.15),
      0 8px 30px rgba(0, 0, 0, calc(var(--paper-shadow-strength) * 1.3)),
      0 16px 60px rgba(0, 0, 0, calc(var(--paper-shadow-strength) * 0.7));
  }
}

html.agent-mode-paper .spark-agent-indicator {
  background: var(--paper-tint);
  animation: spark-paper-breathe var(--paper-breathe-duration) ease-in-out infinite;
}

html.agent-mode-paper #spark-agent-indicator::before {
  background-image:
    url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E");
  opacity: var(--paper-grain-opacity);
}

html.agent-mode-paper #spark-agent-indicator::after {
  background:
    radial-gradient(ellipse at 30% 20%, rgba(255, 250, 240, 0.3) 0%, transparent 50%),
    radial-gradient(ellipse at center, transparent 0%, rgba(139, 90, 43, 0.15) 100%);
  opacity: 1;
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
 * @param mode - The visual effect mode to use (defaults to "glow")
 */
export function showIndicator(mode: EffectMode = "glow"): void {
  if (!document.body) {
    return;
  }
  if (document.getElementById("spark-agent-indicator")) {
    return;
  }
  injectStyles();
  // Remove any existing mode classes before adding the new one
  EFFECT_MODES.forEach((m) => document.documentElement.classList.remove(`agent-mode-${m}`));
  document.documentElement.classList.add(`agent-mode-${mode}`);
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
  // Remove all agent-mode classes from html element
  EFFECT_MODES.forEach((m) => document.documentElement.classList.remove(`agent-mode-${m}`));
  removeStyles();
}
