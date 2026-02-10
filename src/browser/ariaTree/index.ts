/**
 * Spark Aria Tree Module
 *
 * Shared accessibility tree generation for both CLI (Playwright) and Extension consumers.
 * Extracted from Playwright's aria snapshot code, stripped to AI-mode only.
 *
 * Both consumers inject this code into the browser page context:
 * - CLI: via page.evaluate() with a bundled script
 * - Extension: via content script imports
 */

export { generateAndRenderAriaTree, applySetOfMarks, removeSetOfMarks } from "./ariaSnapshot.js";
export type { AriaNode, AriaRole, AriaProps, Box, RefCounter } from "./types.js";
