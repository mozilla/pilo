/**
 * DOM Simplifier - Transforms HTML DOM into simplified text with actionable elements
 * This module provides functionality to:
 * 1. Transform complex HTML into a simplified text representation
 * 2. Preserve interactive elements (links, buttons, forms, etc.)
 * 3. Maintain proper spacing and formatting
 * 4. Handle special cases like hidden elements and ARIA roles
 */

// Type definitions for configuration and results
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

// Add type declarations for browser context
declare global {
  interface Window {
    domTransformer: typeof domTransformer;
    elementActionPerformer: typeof elementActionPerformer;
  }
}

/**
 * Creates a self-contained DOM transformer function that can be serialized and injected
 * into any context (browser, Playwright, etc.)
 */
export function createDOMTransformer() {
  return function domTransformer(
    selector: string,
    config: SimplifierConfig
  ): SimplifierResult {
    /**
     * Checks if an element is hidden via CSS or attributes
     * This includes:
     * - hidden attribute
     * - aria-hidden="true"
     * - display: none
     * - visibility: hidden
     * - opacity: 0
     */
    function isElementHidden(element: Element): boolean {
      try {
        // Check for hidden attribute
        if (element.hasAttribute("hidden")) {
          return true;
        }

        // Check for aria-hidden="true"
        if (element.getAttribute("aria-hidden") === "true") {
          return true;
        }

        // Check for inline display: none or visibility: hidden
        const style = element.getAttribute("style");
        if (style) {
          if (
            style.includes("display: none") ||
            style.includes("visibility: hidden") ||
            style.includes("opacity: 0")
          ) {
            return true;
          }
        }

        // Check computed styles
        try {
          const computedStyle = window.getComputedStyle(element);
          if (
            computedStyle.display === "none" ||
            computedStyle.visibility === "hidden" ||
            parseFloat(computedStyle.opacity) === 0
          ) {
            return true;
          }
        } catch (e) {
          // Ignore errors from getComputedStyle
        }

        return false;
      } catch (e) {
        return false;
      }
    }

    /**
     * Checks if an element should be completely removed
     * This is for elements like script, style, etc. that we never want to include
     */
    function shouldRemoveElement(tagName: string): boolean {
      return config.removeElements.includes(tagName);
    }

    /**
     * Checks if an element should be preserved in the output
     * This includes:
     * 1. Elements in preserveElements config
     * 2. Elements with actionable ARIA roles (if configured)
     * 3. Anchor tags with actual content
     */
    function shouldPreserveElement(node: Element): boolean {
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
          return false;
        }
      }

      // Check if element type should be preserved
      if (tagName in config.preserveElements) {
        return true;
      }

      // Check for aria roles if configured
      if (
        config.preserveAriaRoles &&
        node.hasAttribute("role") &&
        config.actionableRoles.includes(node.getAttribute("role") || "")
      ) {
        return true;
      }

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
     * Priority:
     * 1. ID if present
     * 2. data-simplifier-id if already assigned
     * 3. Generate new data attribute
     */
    function getUniqueSelector(element: Element): string {
      // Simple implementation - in production, you would want a more robust version
      if (element.id) {
        return `#${element.id}`;
      }

      // Try data-simplifier-id if already assigned
      if (element.hasAttribute("data-simplifier-id")) {
        return `[data-simplifier-id="${element.getAttribute(
          "data-simplifier-id"
        )}"]`;
      }

      // Create a data attribute for identification if needed
      const uuid = crypto.randomUUID
        ? crypto.randomUUID()
        : Math.random().toString(36).substring(2, 15);

      const attrName = `data-simplifier-${uuid}`;
      element.setAttribute(attrName, "true");

      return `[${attrName}="true"]`;
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
     * This is where we:
     * 1. Assign sequential IDs
     * 2. Store references for later interaction
     * 3. Handle self-closing elements
     * 4. Process child content
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
      const selector = getUniqueSelector(node);

      // Add data-simplifier-id attribute to the actual element for later reference
      node.setAttribute("data-simplifier-id", id.toString());

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
          attrsStr += ` ${attr}="${escapeHtml(value)}"`;
          attributes[attr] = value;
        }
      }

      // Add aria role if configured
      if (config.preserveAriaRoles && node.hasAttribute("role")) {
        const role = node.getAttribute("role") || "";
        attrsStr += ` role="${escapeHtml(role)}"`;
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
        return `<${tagName}${attrsStr}>`;
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
     * Processes an element node, handling:
     * 1. Element removal
     * 2. Hidden elements
     * 3. Block elements
     * 4. Preserved elements
     * 5. Child content
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
     * Cleans up whitespace in the final result:
     * 1. Removes excessive line breaks
     * 2. Removes excessive spaces
     * 3. Trims leading/trailing whitespace
     */
    function cleanupWhitespace(text: string): string {
      return (
        text
          // Remove extra line breaks
          .replace(/\n{2,}/g, "\n") // Keep single line breaks, remove extras
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
      console.error("Error in DOM transformation:", error);
      throw error;
    }
  };
}

// The serializable DOM transformer function
export const domTransformer = createDOMTransformer();

/**
 * Create a self-contained action performer function
 * This can be serialized and injected into any context
 */
export function createActionPerformer() {
  return async function elementActionPerformer(
    selector: string,
    action: string,
    value?: string
  ): Promise<ActionResult> {
    try {
      // Find the element using the selector
      const element = document.querySelector(selector);
      if (!element) {
        return {
          success: false,
          error: `Element not found: ${selector}`,
        };
      }

      // Perform the action
      switch (action.toLowerCase()) {
        case "click":
          (element as HTMLElement).click();
          return { success: true };

        case "fill":
          if (
            element instanceof HTMLInputElement ||
            element instanceof HTMLTextAreaElement
          ) {
            element.value = value || "";
            element.dispatchEvent(new Event("input", { bubbles: true }));
            element.dispatchEvent(new Event("change", { bubbles: true }));
            return { success: true };
          }
          return {
            success: false,
            error: `Cannot fill element of type ${element.tagName.toLowerCase()}`,
          };

        case "select":
          if (element instanceof HTMLSelectElement) {
            // Store original value to check if change actually occurred
            const originalValue = element.value;

            // Set the new value
            element.value = value || "";

            // Create and dispatch both input and change events
            const events = ["input", "change"];
            events.forEach((eventType) => {
              element.dispatchEvent(new Event(eventType, { bubbles: true }));
            });

            // Wait for a short time to ensure the change is processed
            await new Promise((resolve) => setTimeout(resolve, 100));

            // Check if the value actually changed
            if (element.value === originalValue) {
              return {
                success: false,
                error: "Select value did not change after attempted selection",
              };
            }

            return { success: true };
          }
          return {
            success: false,
            error: "Element is not a select element",
          };

        case "check":
          if (
            element instanceof HTMLInputElement &&
            (element.type === "checkbox" || element.type === "radio")
          ) {
            if (!element.checked) {
              element.click();
            }
            return { success: true };
          }
          return {
            success: false,
            error: "Element is not a checkbox or radio input",
          };

        case "uncheck":
          if (
            element instanceof HTMLInputElement &&
            element.type === "checkbox"
          ) {
            if (element.checked) {
              element.click();
            }
            return { success: true };
          }
          return {
            success: false,
            error: "Element is not a checkbox input",
          };

        case "focus":
          (element as HTMLElement).focus();
          return { success: true };

        default:
          return {
            success: false,
            error: `Unsupported action: ${action}`,
          };
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  };
}

// Create the action performer once
export const elementActionPerformer = createActionPerformer();

/**
 * DOM adapter interface - for different environments (browser, Playwright, etc.)
 */
export interface DOMAdapter {
  /**
   * Transform a DOM structure into simplified text
   */
  transformDOM(
    selector: string,
    config: SimplifierConfig
  ): Promise<SimplifierResult>;

  /**
   * Perform an action on a referenced element
   */
  performAction(
    reference: ElementReference,
    action: string,
    value?: string
  ): Promise<ActionResult>;
}

/**
 * Main DOM Simplifier class that provides a high-level interface
 * for transforming DOM elements and interacting with them
 */
export class DOMSimplifier {
  private config: SimplifierConfig;
  private adapter: DOMAdapter;

  /**
   * Creates a new DOMSimplifier instance
   */
  constructor(adapter: DOMAdapter, config?: Partial<SimplifierConfig>) {
    this.adapter = adapter;
    this.config = this.mergeConfig(DOMSimplifier.defaultConfig(), config || {});
  }

  /**
   * Transforms a DOM element into simplified text
   */
  async transform(selector: string): Promise<SimplifierResult> {
    return this.adapter.transformDOM(selector, this.config);
  }

  /**
   * Interacts with an element by its ID
   */
  async interactWithElement(
    id: number,
    action: string,
    value?: string
  ): Promise<ActionResult> {
    const reference: ElementReference = {
      selector: `[data-simplifier-id="${id}"]`,
      tagName: "",
      attributes: {},
    };

    return this.adapter.performAction(reference, action, value);
  }

  /**
   * Merges configuration objects, handling both primitive and object values
   */
  private mergeConfig(
    defaultConfig: SimplifierConfig,
    userConfig: Partial<SimplifierConfig>
  ): SimplifierConfig {
    const result = { ...defaultConfig };

    for (const key in userConfig) {
      if (userConfig.hasOwnProperty(key)) {
        const typedKey = key as keyof SimplifierConfig;

        if (
          typeof userConfig[typedKey] === "object" &&
          userConfig[typedKey] !== null &&
          typeof defaultConfig[typedKey] === "object" &&
          defaultConfig[typedKey] !== null
        ) {
          // @ts-ignore - This is safe since we checked types
          result[typedKey] = {
            ...defaultConfig[typedKey],
            ...userConfig[typedKey],
          };
        } else {
          // @ts-ignore - This is safe since we checked property exists
          result[typedKey] = userConfig[typedKey];
        }
      }
    }

    return result;
  }

  /**
   * Returns the default configuration with:
   * - Preserved elements and their attributes
   * - Block elements
   * - Self-closing elements
   * - Elements to remove
   * - Hidden element handling
   * - ARIA role handling
   */
  static defaultConfig(): SimplifierConfig {
    return {
      // Elements to preserve with their allowed attributes
      preserveElements: {
        a: ["title", "role"],
        button: ["type", "disabled", "role"],
        input: ["type", "placeholder", "value", "checked", "disabled", "role"],
        select: ["disabled", "role"],
        option: ["value", "selected"],
        textarea: ["placeholder", "disabled", "role"],
        form: ["method", "role", "action"],
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
    };
  }
}

/**
 * Browser implementation of the DOM adapter
 * This is used when running directly in a browser context
 */
export class BrowserAdapter implements DOMAdapter {
  /**
   * Transform a DOM structure into simplified text in browser context
   */
  async transformDOM(
    selector: string,
    config: SimplifierConfig
  ): Promise<SimplifierResult> {
    // In browser context, we can call the function directly
    return domTransformer(selector, config);
  }

  /**
   * Perform an action on a referenced element in browser context
   */
  async performAction(
    reference: ElementReference,
    action: string,
    value?: string
  ): Promise<ActionResult> {
    // In browser context, we can call the function directly
    return elementActionPerformer(reference.selector, action, value);
  }
}

/**
 * Playwright implementation of the DOM adapter
 * This is used when running in a Playwright context
 */
export class PlaywrightAdapter implements DOMAdapter {
  private page: any; // Playwright Page object

  /**
   * Create a new PlaywrightAdapter
   */
  constructor(page: any) {
    this.page = page;
  }

  /**
   * Transform a DOM structure into simplified text in Playwright context
   */
  async transformDOM(
    selector: string,
    config: SimplifierConfig
  ): Promise<SimplifierResult> {
    // First inject our transformer function into the page context
    await this.page.addScriptTag({
      content: `window.domTransformer = ${domTransformer.toString()};`,
    });

    // Now we can safely call the injected function with args wrapped in an object
    return await this.page.evaluate(
      ({ selector, config }: { selector: string; config: SimplifierConfig }) =>
        window.domTransformer(selector, config),
      { selector, config }
    );
  }

  /**
   * Perform an action on a referenced element in Playwright context
   */
  async performAction(
    reference: ElementReference,
    action: string,
    value?: string
  ): Promise<ActionResult> {
    try {
      // Inject our action performer into the page context
      await this.page.addScriptTag({
        content: `window.elementActionPerformer = ${elementActionPerformer.toString()};`,
      });

      // Use our custom implementation for all actions
      return await this.page.evaluate(
        ({
          selector,
          action,
          value,
        }: {
          selector: string;
          action: string;
          value?: string;
        }) => window.elementActionPerformer(selector, action, value),
        { selector: reference.selector, action, value }
      );
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }
}
