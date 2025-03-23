/**
 * Types shared between Browser abstraction, DOM simplifier, and WebAgent
 */

export interface SimplifierConfig {
  // Elements to preserve with their allowed attributes
  // Key is the tag name, value is array of allowed attributes
  preserveElements: Record<string, string[]>;
  // Elements that create text breaks (like paragraphs)
  blockElements: string[];
  // Elements that don't have closing tags
  selfClosingElements: string[];
  // Elements to completely remove including their content
  removeElements: string[];
  // Whether to include elements hidden via CSS/attributes
  includeHiddenElements: boolean;
  // Whether to preserve elements with ARIA roles
  preserveAriaRoles: boolean;
  // List of ARIA roles to consider actionable
  actionableRoles: string[];
  // Whether to clean up whitespace
  cleanupWhitespace: boolean;
}

export interface SimplifierResult {
  // The simplified text representation
  text: string;
  // References to preserved elements for later interaction
  references: Record<number, ElementReference>;
}

export interface ElementReference {
  // CSS selector to find the element
  selector: string;
  // The element's tag name
  tagName: string;
  // Preserved attributes
  attributes: Record<string, string>;
}

export interface ActionResult {
  success: boolean;
  error?: string;
}
