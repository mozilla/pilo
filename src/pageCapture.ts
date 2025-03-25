/**
 * PageCapture - Transforms HTML DOM into simplified text with actionable elements
 * This module provides functionality to:
 * 1. Transform complex HTML into a simplified text representation
 * 2. Preserve interactive elements (links, buttons, forms, etc.)
 * 3. Maintain proper spacing and formatting
 * 4. Handle special cases like hidden elements and ARIA roles
 */

import { Browser } from "./browser/browser.js";

/**
 * Configuration for DOM simplification
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

/**
 * Result of the page transformation
 */
export interface SimplifierResult {
  // The simplified text representation
  text: string;
  // References to preserved elements for later interaction
  references: Record<number, ElementReference>;
}

/**
 * Reference to a preserved element in the page
 */
export interface ElementReference {
  // CSS selector to find the element
  selector: string;
  // The element's tag name
  tagName: string;
  // Preserved attributes
  attributes: Record<string, string>;
}

/**
 * Result of an action performed on an element
 */
export interface ActionResult {
  success: boolean;
  error?: string;
}

// Add type declarations for browser context
declare global {
  interface Window {
    __PageCapture: {
      config: SimplifierConfig;
      transform: (selector: string) => SimplifierResult;
    };
  }
}

/**
 * Default configuration for DOM simplification
 */
export function getDefaultConfig(): SimplifierConfig {
  return {
    // Elements to preserve with their allowed attributes
    preserveElements: {
      a: ["title", "role"],
      button: ["type", "disabled", "role"],
      input: ["type", "placeholder", "value", "checked", "disabled", "role"],
      select: ["disabled", "role"],
      option: ["value", "selected"],
      textarea: ["placeholder", "disabled", "role"],
      form: ["method", "role"],
    },

    // Elements considered as block elements (create text breaks)
    blockElements: [
      "div",
      "p",
      "h1",
      "h2",
      "h3",
      "h4",
      "h5",
      "h6",
      "ul",
      "ol",
      "li",
      "table",
      "tr",
      "form",
      "section",
      "article",
      "header",
      "footer",
      "nav",
      "aside",
      "blockquote",
      "pre",
      "hr",
    ],

    // Self-closing elements
    selfClosingElements: ["input", "hr", "meta", "link"],

    // Elements to completely remove including their content
    removeElements: [
      "script",
      "style",
      "noscript",
      "template",
      "iframe",
      "svg",
      "math",
      "head",
      "canvas",
      "object",
      "embed",
      "video",
      "audio",
      "map",
      "track",
      "param",
      "applet",
      "br",
      "meta",
      "link",
      "img",
    ],

    // Whether to include hidden elements
    includeHiddenElements: false,

    // Whether to preserve elements with aria roles
    preserveAriaRoles: true,

    // Aria roles to consider actionable
    actionableRoles: [
      "button",
      "link",
      "checkbox",
      "radio",
      "textbox",
      "combobox",
      "listbox",
      "menu",
      "menuitem",
      "tab",
      "searchbox",
      "switch",
      "spinbutton",
    ],

    // Whether to clean up whitespace
    cleanupWhitespace: true,
  };
}

/**
 * Creates a self-contained page transformer function that can be serialized and injected
 * into any context (browser, Playwright, etc.)
 */
export function createPageTransformer(config: SimplifierConfig) {
  return function pageTransformer(selector: string): SimplifierResult {
    // Cache for element visibility and preservation checks
    const visibilityCache = new WeakMap<Element, boolean>();
    const preservationCache = new WeakMap<Element, boolean>();

    /**
     * Checks if an element is hidden via CSS or attributes
     */
    function isElementHidden(element: Element): boolean {
      try {
        // Check cache first
        if (visibilityCache.has(element)) {
          return visibilityCache.get(element)!;
        }

        // JSDOM doesn't fully implement all style features
        // In test environments, just check the basics
        if (typeof window.getComputedStyle !== "function") {
          const hasHidden = element.hasAttribute("hidden");
          const isAriaHidden = element.getAttribute("aria-hidden") === "true";
          visibilityCache.set(element, hasHidden || isAriaHidden);
          return hasHidden || isAriaHidden;
        }

        // Check for hidden attribute
        if (element.hasAttribute("hidden")) {
          visibilityCache.set(element, true);
          return true;
        }

        // Check for aria-hidden="true"
        if (element.getAttribute("aria-hidden") === "true") {
          visibilityCache.set(element, true);
          return true;
        }

        // Check commonly used CSS classes that hide elements
        const classList = element.classList;
        const hiddenClasses = [
          "hidden",
          "d-none",
          "display-none",
          "invisible",
          "hide",
          "visually-hidden",
        ];
        for (const cls of hiddenClasses) {
          if (classList.contains(cls)) {
            visibilityCache.set(element, true);
            return true;
          }
        }

        // Check inline display: none or visibility: hidden
        const style = element.getAttribute("style");
        if (style) {
          if (
            style.includes("display: none") ||
            style.includes("visibility: hidden") ||
            style.includes("opacity: 0") ||
            style.includes("width: 0") ||
            style.includes("height: 0") ||
            (style.includes("position: absolute") &&
              (style.includes("left: -9999px") ||
                style.includes("top: -9999px")))
          ) {
            visibilityCache.set(element, true);
            return true;
          }
        }

        // Check computed styles
        try {
          const computedStyle = window.getComputedStyle(element);
          if (
            computedStyle.display === "none" ||
            computedStyle.visibility === "hidden" ||
            parseFloat(computedStyle.opacity) === 0 ||
            (parseFloat(computedStyle.width) === 0 &&
              parseFloat(computedStyle.height) === 0)
          ) {
            visibilityCache.set(element, true);
            return true;
          }

          // Check if element is outside the viewport
          const rect = element.getBoundingClientRect();
          if (
            (rect.width === 0 && rect.height === 0) ||
            rect.top < -10000 ||
            rect.left < -10000
          ) {
            visibilityCache.set(element, true);
            return true;
          }
        } catch (e) {
          // Ignore errors from getComputedStyle
        }

        visibilityCache.set(element, false);
        return false;
      } catch (e) {
        visibilityCache.set(element, false);
        return false;
      }
    }

    /**
     * Checks if an element should be completely removed
     */
    function shouldRemoveElement(tagName: string): boolean {
      return config.removeElements.includes(tagName);
    }

    /**
     * Checks if an element should be preserved in the output
     */
    function shouldPreserveElement(node: Element): boolean {
      // Check cache first
      if (preservationCache.has(node)) {
        return preservationCache.get(node)!;
      }

      const tagName = node.tagName.toLowerCase();

      // Special handling for anchor tags - skip empty ones
      if (tagName === "a") {
        // Get visible text content only
        let visibleText = "";
        for (let i = 0; i < node.childNodes.length; i++) {
          const child = node.childNodes[i];
          if (child.nodeType === Node.TEXT_NODE) {
            visibleText += child.textContent || "";
          } else if (child.nodeType === Node.ELEMENT_NODE) {
            const element = child as Element;
            // Skip hidden elements unless configured to include them
            if (config.includeHiddenElements || !isElementHidden(element)) {
              visibleText += element.textContent || "";
            }
          }
        }

        // If there's no visible text content, skip this anchor
        if (!visibleText.trim()) {
          preservationCache.set(node, false);
          return false;
        }
      }

      // Check if element type should be preserved
      if (tagName in config.preserveElements) {
        preservationCache.set(node, true);
        return true;
      }

      // Check for aria roles if configured
      if (
        config.preserveAriaRoles &&
        node.hasAttribute("role") &&
        config.actionableRoles.includes(node.getAttribute("role") || "")
      ) {
        preservationCache.set(node, true);
        return true;
      }

      preservationCache.set(node, false);
      return false;
    }

    /**
     * Gets the list of attributes that should be preserved for an element type
     */
    function getElementAllowedAttributes(tagName: string): string[] {
      return config.preserveElements[tagName] || [];
    }

    /**
     * Checks if an element is a block element (creates text breaks)
     */
    function isBlockElement(tagName: string): boolean {
      return config.blockElements.includes(tagName);
    }

    /**
     * Checks if an element is a heading (h1-h6)
     */
    function isHeadingElement(tagName: string): boolean {
      return /^h[1-6]$/.test(tagName);
    }

    /**
     * Checks if an element is self-closing (no closing tag)
     */
    function isSelfClosingElement(tagName: string): boolean {
      return config.selfClosingElements.includes(tagName);
    }

    /**
     * Normalizes whitespace in text (replaces multiple spaces with single space)
     */
    function normalizeWhitespace(text: string): string {
      return text.replace(/\s+/g, " ");
    }

    /**
     * Escapes HTML special characters to prevent XSS
     */
    function escapeHtml(str: string): string {
      return str
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
    }

    /**
     * Generates a unique selector for an element
     * Adds a data attribute for reliable future selection
     */
    function getUniqueSelector(element: Element, id: number): string {
      // Add a data attribute for reliable element selection
      element.setAttribute("data-simplifier-id", id.toString());

      // Return the data attribute selector
      return `[data-simplifier-id="${id}"]`;
    }

    /**
     * Properly escapes attribute values for HTML output
     */
    function escapeAttributeValue(value: string): string {
      return value
        .replace(/&/g, "&amp;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
    }

    /**
     * Processes a text node, normalizing whitespace
     */
    function processTextNode(node: Text, buffer: string): string {
      return buffer + normalizeWhitespace(node.textContent || "");
    }

    /**
     * Processes a heading element, converting to markdown style
     * Example: <h1>Title</h1> -> # Title
     */
    function processHeadingElement(
      node: Element,
      tagName: string,
      buffer: string,
      context: {
        idCounter: number;
        elementReferences: Record<number, ElementReference>;
      }
    ): string {
      // Ensure clean break before heading
      if (buffer.trim()) {
        buffer = buffer.trim() + "\n\n";
      }

      // Get heading level and create markdown style prefix
      const level = parseInt(tagName.charAt(1));
      const prefix = "#".repeat(level) + " ";

      // Process heading content
      let headingContent = "";
      for (let i = 0; i < node.childNodes.length; i++) {
        headingContent = processNode(
          node.childNodes[i],
          headingContent,
          context
        );
      }

      // Add formatted heading
      return buffer + prefix + headingContent.trim() + "\n\n";
    }

    /**
     * Serializes a preserved element with its attributes and content
     */
    function serializePreservedElement(
      node: Element,
      context: {
        idCounter: number;
        elementReferences: Record<number, ElementReference>;
      }
    ): string {
      const tagName = node.tagName.toLowerCase();

      // Assign sequential ID
      const id = context.idCounter++;

      // Store reference to original element
      const attributes: Record<string, string> = {};
      const selector = getUniqueSelector(node, id);

      // Get allowed attributes for this element type
      const allowedAttrs = getElementAllowedAttributes(tagName);

      // Build attributes string, starting with the ID
      let attrsStr = ` id="${id}"`;

      // Add configured attributes
      for (const attr of allowedAttrs) {
        if (node.hasAttribute(attr)) {
          // Handle boolean attributes
          const isBooleanAttr = [
            "disabled",
            "checked",
            "selected",
            "readonly",
            "required",
            "multiple",
          ].includes(attr);
          const value = isBooleanAttr ? "true" : node.getAttribute(attr) || "";
          attrsStr += ` ${attr}="${escapeAttributeValue(value)}"`;
          attributes[attr] = value;
        }
      }

      // Special handling for input values
      if (
        tagName === "input" ||
        tagName === "textarea" ||
        tagName === "select"
      ) {
        const inputElement = node as
          | HTMLInputElement
          | HTMLTextAreaElement
          | HTMLSelectElement;
        // Only add value if it's allowed for this element type
        if (allowedAttrs.includes("value")) {
          // Get the current value from the property, not the attribute
          const currentValue = inputElement.value || "";

          // Override the value attribute with the current property value
          if (currentValue) {
            attrsStr += ` value="${escapeAttributeValue(currentValue)}"`;
            attributes["value"] = currentValue;
          }
        }
      }

      // Add aria role if configured
      if (config.preserveAriaRoles && node.hasAttribute("role")) {
        const role = node.getAttribute("role") || "";
        attrsStr += ` role="${escapeAttributeValue(role)}"`;
        attributes["role"] = role;
      }

      // Store reference
      context.elementReferences[id] = {
        selector,
        tagName,
        attributes,
      };

      // Handle self-closing elements
      if (isSelfClosingElement(tagName)) {
        return `<${tagName}${attrsStr} />`;
      }

      // For container elements, process children
      let content = "";
      for (let i = 0; i < node.childNodes.length; i++) {
        content = processNode(node.childNodes[i], content, context);
      }

      // Return complete element
      return `<${tagName}${attrsStr}>${content}</${tagName}>`;
    }

    /**
     * Processes an element node
     */
    function processElementNode(
      node: Element,
      buffer: string,
      context: {
        idCounter: number;
        elementReferences: Record<number, ElementReference>;
      }
    ): string {
      const tagName = node.tagName.toLowerCase();

      // Check if this element should be completely removed
      if (shouldRemoveElement(tagName)) {
        return buffer; // Skip this element and all its children
      }

      // Check if this element is hidden and should be excluded
      if (!config.includeHiddenElements && isElementHidden(node)) {
        return buffer; // Skip this element and all its children
      }

      const isBlock = isBlockElement(tagName);

      // Handle special elements
      if (isHeadingElement(tagName)) {
        return processHeadingElement(node, tagName, buffer, context);
      }

      // Check if this is an element we should preserve
      if (shouldPreserveElement(node)) {
        // Add a space before the preserved element if needed
        if (buffer.length > 0 && !buffer.match(/\s$/)) {
          buffer += " ";
        }
        const result = buffer + serializePreservedElement(node, context);

        // Add two spaces after preserved elements if the next sibling is a preserved element
        const nextSibling = node.nextSibling;
        if (!isBlock && nextSibling) {
          let nextPreserved = false;
          let current: ChildNode | null = nextSibling;
          while (current) {
            if (current.nodeType === Node.ELEMENT_NODE) {
              if (shouldPreserveElement(current as Element)) {
                nextPreserved = true;
                break;
              }
              break;
            } else if (current.nodeType === Node.TEXT_NODE) {
              if ((current as Text).textContent?.trim()) {
                break;
              }
            }
            current = current.nextSibling;
          }
          if (nextPreserved) {
            return result + "  ";
          }
        }
        return result;
      }

      // Handle block elements - they create text breaks
      if (isBlock && buffer.trim()) {
        buffer = buffer.trim() + "\n";
      }

      // Process all children
      let result = buffer;
      for (let i = 0; i < node.childNodes.length; i++) {
        result = processNode(node.childNodes[i], result, context);
      }

      // Add line break after block elements with content
      if (isBlock && result.trim() !== buffer.trim()) {
        result = result.trim() + "\n";
      }

      return result;
    }

    /**
     * Main node processing function that handles both text and element nodes
     */
    function processNode(
      node: Node,
      buffer: string,
      context: {
        idCounter: number;
        elementReferences: Record<number, ElementReference>;
      }
    ): string {
      if (!node) return buffer;

      if (node.nodeType === Node.TEXT_NODE) {
        return processTextNode(node as Text, buffer);
      } else if (node.nodeType === Node.ELEMENT_NODE) {
        return processElementNode(node as Element, buffer, context);
      }

      return buffer;
    }

    /**
     * Cleans up whitespace in the final result
     */
    function cleanupWhitespace(text: string): string {
      if (!config.cleanupWhitespace) {
        return text;
      }

      return (
        text
          // Remove extra line breaks
          .replace(/\n{2,}/g, "\n\n")
          // Remove extra spaces
          .replace(/[ ]{2,}/g, " ")
          // Remove leading and trailing spaces
          .replace(/^\s+|\s+$/gm, "")
          // Remove extra spaces inside tags
          .replace(/>[ ]+([<a-z])/gi, ">$1")
          .replace(/([a-z>])[ ]+</gi, "$1<")
          // Final trim
          .trim()
      );
    }

    // Main execution starts here
    try {
      const rootElement = document.querySelector(selector);
      if (!rootElement) {
        throw new Error(`Element not found: ${selector}`);
      }

      const context = {
        idCounter: 1,
        elementReferences: {} as Record<number, ElementReference>,
      };

      const result = processNode(rootElement, "", context);

      return {
        text: cleanupWhitespace(result),
        references: context.elementReferences,
      };
    } catch (error) {
      console.error("Error in page transformation:", error);
      throw error;
    }
  };
}

/**
 * Main PageCapture class that provides a high-level interface
 * for transforming page content and interacting with elements
 */
export class PageCapture {
  private config: SimplifierConfig;
  private initialized = false;
  private elementReferences: Record<number, ElementReference> = {};

  /**
   * Creates a new PageCapture instance
   */
  constructor(private browser: Browser, config?: Partial<SimplifierConfig>) {
    this.config = { ...getDefaultConfig(), ...(config || {}) };
  }

  /**
   * Initialize the browser with required functions
   */
  private async initialize(): Promise<void> {
    // Check if PageCapture is already defined in browser context
    const isInitialized = await this.browser
      .evaluate<boolean>(() => {
        return (
          typeof window.__PageCapture !== "undefined" &&
          typeof window.__PageCapture.transform === "function"
        );
      })
      .catch(() => false);

    // If already properly initialized, just set the flag and return
    if (isInitialized) {
      this.initialized = true;
      return;
    }

    // Reset the initialization flag since we need to reinitialize
    this.initialized = false;

    // Convert only the page transformer function to a string
    const pageTransformerFn = createPageTransformer.toString();

    // Inject just the transformer function and config
    await this.browser.addScriptTag({
      content: `
        window.__PageCapture = {};
        window.__PageCapture.config = ${JSON.stringify(this.config)};
        window.__PageCapture.transform = (${pageTransformerFn})(window.__PageCapture.config);
      `,
    });

    this.initialized = true;
  }

  /**
   * Captures the page content and stores element references
   * @param selector CSS selector for the element to capture, defaults to "body"
   * @returns The simplified page text
   */
  async capture(selector: string = "body"): Promise<string> {
    await this.initialize();

    const result = await this.browser.evaluate<SimplifierResult>(
      (selector: string) => window.__PageCapture.transform(selector),
      selector
    );

    // Store element references for later use
    this.elementReferences = result.references;

    return result.text;
  }

  /**
   * Gets all the current element references captured
   */
  getElementReferences(): Record<number, ElementReference> {
    return this.elementReferences;
  }

  /**
   * Performs an action on an element by its ID
   */
  async performAction(
    id: number,
    action: string,
    value?: string
  ): Promise<ActionResult> {
    // Ensure initialization before performing action
    await this.initialize();

    // Check if the ID exists in our references
    if (!this.elementReferences[id]) {
      return {
        success: false,
        error: `Element with ID ${id} not found. Have you called capture() first?`,
      };
    }

    // Use the browser's native performAction method with the stored selector
    const selector = this.elementReferences[id].selector;
    return this.browser.performAction(selector, action, value);
  }
}
