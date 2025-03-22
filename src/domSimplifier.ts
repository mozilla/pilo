/**
 * Create a self-contained action performer function
 * This can be serialized and injected into any context
 */
export function createActionPerformer() {
  return function elementActionPerformer(
    selector: string,
    action: string,
    value?: string
  ): ActionResult {
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
            error: `Cannot fill element of type ${element.tagName}`,
          };

        case "select":
          if (element instanceof HTMLSelectElement) {
            element.value = value || "";
            element.dispatchEvent(new Event("change", { bubbles: true }));
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
 * DOM Simplifier - Transforms HTML DOM into simplified text with actionable elements
 * Using a clean architecture with a self-contained core function
 */

// Type definitions
export interface SimplifierConfig {
  preserveElements: Record<string, string[]>;
  blockElements: string[];
  selfClosingElements: string[];
  removeElements: string[];
  includeHiddenElements: boolean;
  preserveAriaRoles: boolean;
  actionableRoles: string[];
}

export interface SimplifierResult {
  text: string;
  references: Record<number, ElementReference>;
}

export interface ElementReference {
  selector: string;
  tagName: string;
  attributes: Record<string, string>;
}

export interface ActionResult {
  success: boolean;
  error?: string;
}

// Add type declarations at the top of the file
declare global {
  interface Window {
    domTransformer: typeof domTransformer;
    elementActionPerformer: typeof elementActionPerformer;
  }
}

/**
 * The core DOM transformation function - designed to be self-contained
 * so it can be either called directly or serialized and injected into a page
 */
export function createDOMTransformer() {
  // This returns the actual transformer function
  return function domTransformer(
    selector: string,
    config: SimplifierConfig
  ): SimplifierResult {
    // Inner utility functions that will be included when serialized

    /**
     * Check if an element is hidden via CSS or attributes
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
     * Check if an element should be completely removed
     */
    function shouldRemoveElement(tagName: string): boolean {
      return config.removeElements.includes(tagName);
    }

    /**
     * Check if an element should be preserved
     */
    function shouldPreserveElement(node: Element): boolean {
      const tagName = node.tagName.toLowerCase();

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
     * Get allowed attributes for an element
     */
    function getElementAllowedAttributes(tagName: string): string[] {
      return config.preserveElements[tagName] || [];
    }

    /**
     * Check if an element is a block element
     */
    function isBlockElement(tagName: string): boolean {
      return config.blockElements.includes(tagName);
    }

    /**
     * Check if an element is a heading
     */
    function isHeadingElement(tagName: string): boolean {
      return /^h[1-6]$/.test(tagName);
    }

    /**
     * Check if an element is self-closing
     */
    function isSelfClosingElement(tagName: string): boolean {
      return config.selfClosingElements.includes(tagName);
    }

    /**
     * Normalize whitespace in text
     */
    function normalizeWhitespace(text: string): string {
      return text.replace(/\s+/g, " ");
    }

    /**
     * Escape HTML special characters
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
     * Generate a unique selector for an element
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
     * Process a text node
     */
    function processTextNode(node: Text, buffer: string): string {
      return buffer + normalizeWhitespace(node.textContent || "");
    }

    /**
     * Process a heading element
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
     * Serialize a preserved element
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
          const value = node.getAttribute(attr) || "";
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
     * Process an element node
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
        return buffer + serializePreservedElement(node, context);
      }

      // Handle block elements - they create text breaks
      if (isBlock && buffer.trim()) {
        buffer = buffer.trim() + "\n\n";
      }

      // Process all children
      let result = buffer;
      for (let i = 0; i < node.childNodes.length; i++) {
        result = processNode(node.childNodes[i], result, context);
      }

      // Add line break after block elements with content
      if (isBlock && result.trim() !== buffer.trim()) {
        result = result.trim() + "\n\n";
      }

      return result;
    }

    /**
     * Process a DOM node
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
        text: result.trim(),
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
 * DOM adapter interface - for different environments
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
 * Main DOM Simplifier class
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
   * Merges configuration objects
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
   * Returns the default configuration
   */
  static defaultConfig(): SimplifierConfig {
    return {
      // Elements to preserve with their allowed attributes
      preserveElements: {
        a: ["title"],
        button: ["type", "disabled"],
        input: ["type", "placeholder", "value", "checked", "disabled"],
        select: ["disabled"],
        option: ["value", "selected"],
        textarea: ["placeholder", "disabled"],
        form: ["action", "method"],
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
      ],

      // Self-closing elements
      selfClosingElements: ["input", "img", "br", "hr", "meta", "link"],

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
      ],
    };
  }
}

/**
 * Browser implementation of the DOM adapter
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
      // For simple actions, we can use Playwright's built-in methods
      const locator = this.page.locator(reference.selector);

      // For complex or custom actions, we can use our action performer
      if (action.toLowerCase() === "custom") {
        // First inject our action performer
        await this.page.addScriptTag({
          content: `window.elementActionPerformer = ${elementActionPerformer.toString()};`,
        });

        // Now we can safely call it with args wrapped in an object
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
          { selector: reference.selector, action: "custom", value }
        );
      }

      // Use Playwright's native methods for standard actions
      switch (action.toLowerCase()) {
        case "click":
          await locator.click();
          return { success: true };

        case "fill":
          await locator.fill(value || "");
          return { success: true };

        case "select":
          await locator.selectOption(value || "");
          return { success: true };

        case "check":
          await locator.check();
          return { success: true };

        case "uncheck":
          await locator.uncheck();
          return { success: true };

        case "focus":
          await locator.focus();
          return { success: true };

        default:
          // For any other actions, inject and use our action performer
          await this.page.addScriptTag({
            content: `window.elementActionPerformer = ${elementActionPerformer.toString()};`,
          });

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
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }
}
