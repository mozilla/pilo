/**
 * DOM Simplifier - Transforms HTML DOM into simplified text with actionable elements
 * This module provides functionality to:
 * 1. Transform complex HTML into a simplified text representation
 * 2. Preserve interactive elements (links, buttons, forms, etc.)
 * 3. Maintain proper spacing and formatting
 * 4. Handle special cases like hidden elements and ARIA roles
 */

import { Browser } from "./browser/Browser";
import {
  SimplifierConfig,
  SimplifierResult,
  ElementReference,
  ActionResult,
} from "./types";

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
    // Cache for element visibility and preservation checks
    const visibilityCache = new WeakMap<Element, boolean>();
    const preservationCache = new WeakMap<Element, boolean>();

    /**
     * Checks if an element is hidden via CSS or attributes
     * This includes:
     * - hidden attribute
     * - aria-hidden="true"
     * - display: none
     * - visibility: hidden
     * - opacity: 0
     * - zero dimensions (width/height = 0)
     * - positioned outside viewport
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
     * Adds a special class to the element for reliable future selection
     */
    function getUniqueSelector(element: Element, id: number): string {
      // Add our special class to make selection easier and more reliable
      const className = `__SPARK_ID_${id}__`;
      element.classList.add(className);

      // In JSDOM the class selector might not work properly,
      // so we'll also add a data attribute as a fallback
      element.setAttribute("data-simplifier-id", id.toString());

      // For tests, use the data attribute selector since it's more reliable in JSDOM
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

      // Special handling for input values - use the actual current value property
      // rather than just the attribute which may be outdated
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
      if (!config.cleanupWhitespace) {
        return text;
      }

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

      // Helper to create rich event objects
      function createEvent(type: string, options: any = {}) {
        let event;

        // JSDOM doesn't support all event constructors or has limited implementation
        // Use simpler events in test environments
        if (
          typeof window.MouseEvent !== "function" ||
          typeof window.InputEvent !== "function" ||
          typeof window.FocusEvent !== "function"
        ) {
          event = document.createEvent("Event");
          event.initEvent(type, true, true);
          return event;
        }

        // Use appropriate event constructor based on event type
        switch (type) {
          case "click":
          case "mousedown":
          case "mouseup":
          case "mouseover":
          case "mouseout":
          case "mousemove":
            event = new MouseEvent(type, {
              bubbles: true,
              cancelable: true,
              view: window,
              detail: 1,
              ...options,
            });
            break;

          case "focus":
          case "blur":
            event = new FocusEvent(type, {
              bubbles: true,
              cancelable: true,
              view: window,
              ...options,
            });
            break;

          case "input":
          case "change":
            // For frameworks that check for trustedEvents
            // First try InputEvent if available
            try {
              event = new InputEvent(type, {
                bubbles: true,
                cancelable: true,
                data: value || "",
                inputType: "insertText",
                ...options,
              });
            } catch (e) {
              // Fall back to Event if InputEvent not supported
              event = new Event(type, {
                bubbles: true,
                cancelable: true,
                ...options,
              });
            }
            break;

          default:
            event = new Event(type, {
              bubbles: true,
              cancelable: true,
              ...options,
            });
        }

        return event;
      }

      // Perform the action
      switch (action.toLowerCase()) {
        case "click":
          // Create a more realistic click event flow
          element.dispatchEvent(createEvent("mousedown"));
          element.dispatchEvent(createEvent("mouseup"));
          element.dispatchEvent(createEvent("click"));

          // If it's a checkbox or radio, directly set checked state
          if (
            element instanceof HTMLInputElement &&
            (element.type === "checkbox" || element.type === "radio")
          ) {
            element.checked = !element.checked;
          }

          return { success: true };

        case "fill":
          if (
            element instanceof HTMLInputElement ||
            element instanceof HTMLTextAreaElement
          ) {
            // Set value directly first
            element.value = value || "";

            // Dispatch events that frameworks expect
            element.dispatchEvent(createEvent("focus"));

            // More robust input event with proper data
            const inputEvent = createEvent("input", { data: value });
            // For React and other frameworks that might read from target.value during event handling
            Object.defineProperty(inputEvent, "target", {
              writable: false,
              value: element,
            });
            element.dispatchEvent(inputEvent);

            // Ensure change event also has proper target with updated value
            const changeEvent = createEvent("change");
            Object.defineProperty(changeEvent, "target", {
              writable: false,
              value: element,
            });
            element.dispatchEvent(changeEvent);

            // Set the value again to ensure it's updated
            element.value = value || "";

            element.dispatchEvent(createEvent("blur"));

            // Verify that the value was actually set
            if (element.value !== value) {
              // If value wasn't set, try again using different approach
              element.value = value || "";
              // For some frameworks, we need to manually trigger their change detection
              setTimeout(() => {
                element.dispatchEvent(createEvent("input", { data: value }));
                element.dispatchEvent(createEvent("change"));
              }, 0);
            }

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

            // Create and dispatch events in the correct order
            element.dispatchEvent(createEvent("focus"));
            element.dispatchEvent(createEvent("input"));
            element.dispatchEvent(createEvent("change"));
            element.dispatchEvent(createEvent("blur"));

            // For tests - set the value directly again to ensure it takes effect
            if (element.value !== value) {
              element.value = value || "";
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
              // Simulate a more realistic click for checkboxes/radios
              element.dispatchEvent(createEvent("mousedown"));
              element.dispatchEvent(createEvent("mouseup"));
              element.dispatchEvent(createEvent("click"));

              // Directly set checked state in case click doesn't work
              if (!element.checked) {
                element.checked = true;
                element.dispatchEvent(createEvent("change"));
              }
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
              // Simulate a more realistic click for checkboxes
              element.dispatchEvent(createEvent("mousedown"));
              element.dispatchEvent(createEvent("mouseup"));
              element.dispatchEvent(createEvent("click"));

              // Directly set unchecked state in case click doesn't work
              if (element.checked) {
                element.checked = false;
                element.dispatchEvent(createEvent("change"));
              }
            }
            return { success: true };
          }
          return {
            success: false,
            error: "Element is not a checkbox input",
          };

        case "focus":
          (element as HTMLElement).focus();
          element.dispatchEvent(createEvent("focus"));

          // Special case for JSDOM which doesn't fully implement focus
          if (
            document.activeElement &&
            typeof (document.activeElement as HTMLElement).focus !== "function"
          ) {
            // Manually mark the element as focused for tests
            (element as any)._focused = true;
          }

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
 * Main DOM Simplifier class that provides a high-level interface
 * for transforming DOM elements and interacting with them
 */
export class DOMSimplifier {
  private config: SimplifierConfig;

  /**
   * Creates a new DOMSimplifier instance
   */
  constructor(private browser: Browser, config?: Partial<SimplifierConfig>) {
    this.config = this.mergeConfig(DOMSimplifier.defaultConfig(), config || {});
  }

  /**
   * Transforms a DOM element into simplified text
   */
  async transform(selector: string): Promise<SimplifierResult> {
    return this.browser.simplifyDOM(selector, this.config);
  }

  /**
   * Interacts with an element by its ID
   */
  async interactWithElement(
    id: number,
    action: string,
    value?: string
  ): Promise<boolean> {
    const result = await this.browser.performAction(id, action, value);
    return result.success;
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
}
