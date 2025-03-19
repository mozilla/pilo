import { Page, ElementHandle } from "playwright";

interface ElementInfo {
  id: string;
  type: string;
  text: string;
  placeholder?: string;
  location: string;
  isVisible: boolean;
  selector: string;
  attributes: Record<string, string>;
}

export class PageMapper {
  private page: Page;
  private elementMap: Map<string, string> = new Map();
  private idCounter: number = 0;

  constructor(page: Page) {
    this.page = page;
  }

  /**
   * Creates a simplified representation of the page for the LLM
   */
  async createPageSnapshot(): Promise<{
    pageTitle: string;
    url: string;
    elements: ElementInfo[];
  }> {
    const title = await this.page.title();
    const url = this.page.url();

    // Reset the element map for a new snapshot
    this.elementMap = new Map();
    this.idCounter = 0;

    // Get all interactive and important elements, excluding irrelevant ones
    const elements = await this.page.$$(`
      button:not([type="hidden"]), 
      a:not([type="hidden"]), 
      input:not([type="hidden"]), 
      select:not([type="hidden"]), 
      textarea:not([type="hidden"]), 
      [role="button"]:not([type="hidden"]), 
      [role="link"]:not([type="hidden"]), 
      [role="checkbox"]:not([type="hidden"]), 
      [role="radio"]:not([type="hidden"]),
      [role="tab"]:not([type="hidden"]),
      h1:not([type="hidden"]), 
      h2:not([type="hidden"]), 
      h3:not([type="hidden"]),
      label:not([type="hidden"]),
      [aria-label]:not([type="hidden"])
    `);

    const elementInfos: ElementInfo[] = [];

    for (const element of elements) {
      // Skip elements that should be ignored
      if (await this.shouldIgnoreElement(element)) {
        continue;
      }

      const elementInfo = await this.extractElementInfo(element);
      if (elementInfo) {
        elementInfos.push(elementInfo);
      }
    }

    return {
      pageTitle: title,
      url,
      elements: elementInfos,
    };
  }

  /**
   * Creates a compact text representation of the page for the LLM
   */
  async createCompactSnapshot(): Promise<string> {
    const snapshot = await this.createPageSnapshot();

    // Format the page title and URL
    let output = `Page: ${snapshot.pageTitle}\nURL: ${snapshot.url}\n\n`;

    // Format each element
    snapshot.elements.forEach((element) => {
      // Extract just the number from the ID (e.g., "element-89" -> "89")
      const id = element.id.split("-")[1];
      output += `[${id}] ${element.type} "${element.text}"\n`;
    });

    return output;
  }

  /**
   * Checks if an element should be ignored based on its type or attributes
   */
  private async shouldIgnoreElement(element: ElementHandle): Promise<boolean> {
    try {
      const tagName = await element.evaluate((el) =>
        (el as Element).tagName.toLowerCase()
      );
      const isHidden = await element.evaluate((el) => {
        const element = el as Element;
        return (
          element.hasAttribute("hidden") ||
          element.getAttribute("aria-hidden") === "true" ||
          window.getComputedStyle(element).display === "none" ||
          window.getComputedStyle(element).visibility === "hidden"
        );
      });

      // List of elements to ignore
      const ignoredElements = [
        "script",
        "style",
        "meta",
        "noscript",
        "link",
        "head",
        "iframe",
        "svg",
        "template",
        "comment",
      ];

      return ignoredElements.includes(tagName) || isHidden;
    } catch (error) {
      console.error("Error checking if element should be ignored:", error);
      return false; // If we can't determine, include the element
    }
  }

  /**
   * Extracts relevant information from a DOM element
   */
  private async extractElementInfo(
    element: ElementHandle
  ): Promise<ElementInfo | null> {
    try {
      // Check if element is visible
      const isVisible = await element.isVisible();

      // Skip invisible elements
      if (!isVisible) {
        return null;
      }

      // Get tagName and other properties
      const tagName = await element.evaluate((el) =>
        (el as Element).tagName.toLowerCase()
      );

      // Get cleaned text content, filtering out CSS and excessive whitespace
      const textContent = await element.evaluate((el) => {
        const element = el as Element;
        // Skip if this is a style element
        if (element.tagName.toLowerCase() === "style") {
          return "";
        }

        // Special handling for select elements
        if (element.tagName.toLowerCase() === "select") {
          const options = Array.from(element.querySelectorAll("option"))
            .map((option) => option.textContent?.trim() || "")
            .filter((text) => text.length > 0)
            .join(", ");
          return options;
        }

        // Handle images by replacing them with their alt text
        const clone = element.cloneNode(true) as Element;

        // First, collect all images and their replacement text
        const imageReplacements = Array.from(
          clone.getElementsByTagName("img")
        ).map((img) => {
          const alt =
            img.getAttribute("alt") ||
            img.getAttribute("aria-label") ||
            img.getAttribute("title") ||
            "";
          return {
            element: img,
            replacement: alt ? `[img ${alt}]` : "[img]",
          };
        });

        // Then process each replacement in reverse order to avoid DOM issues
        for (let i = imageReplacements.length - 1; i >= 0; i--) {
          const { element: img, replacement } = imageReplacements[i];
          const parent = img.parentNode;
          if (parent) {
            // If the image is the only content, replace it entirely
            if (parent.childNodes.length === 1) {
              parent.textContent = replacement;
            } else {
              // Otherwise, insert the replacement text and remove the image
              parent.insertBefore(
                document.createTextNode(replacement + " "),
                img
              );
              parent.removeChild(img);
            }
          }
        }

        // Get text content and clean it
        let text = clone.textContent || "";

        // Remove CSS-like content (contains { or } or @media or @keyframes)
        if (
          text.includes("{") ||
          text.includes("}") ||
          text.includes("@media") ||
          text.includes("@keyframes")
        ) {
          return "";
        }

        // Check if this is a pre-formatted element or code block
        const isPreformatted =
          element.tagName.toLowerCase() === "pre" ||
          element.closest("pre") !== null ||
          element.getAttribute("role") === "code" ||
          element.closest('[role="code"]') !== null;

        if (isPreformatted) {
          // For pre-formatted text, preserve newlines but clean up extra spaces
          return text.replace(/[ \t]+/g, " ").trim();
        }

        // For regular text:
        // 1. Replace multiple spaces with single space
        // 2. Replace multiple newlines with a single newline
        // 3. Trim leading/trailing whitespace
        text = text
          .replace(/[ \t]+/g, " ") // Replace multiple spaces/tabs with single space
          .replace(/\n\s*\n/g, "\n") // Replace multiple newlines with single newline
          .trim();

        return text;
      });

      // Get attributes that need to be awaited
      const placeholder = await element.evaluate(
        (el) =>
          (el as Element).getAttribute("placeholder") ||
          (el as Element).getAttribute("aria-placeholder") ||
          ""
      );

      const ariaLabel = await element.evaluate((el) =>
        (el as Element).getAttribute("aria-label")
      );

      const attributes: Record<string, string> = {};
      if (ariaLabel) {
        attributes["aria-label"] = ariaLabel;
      }

      // Generate a stable selector for this element
      const selector = await this.generateStableSelector(element);

      // Create a unique ID for LLM reference
      const id = `element-${this.idCounter++}`;

      // Store the mapping from ID to selector for later use
      this.elementMap.set(id, selector);

      return {
        id,
        type: tagName,
        text: textContent,
        placeholder,
        location: selector,
        isVisible,
        selector,
        attributes,
      };
    } catch (error) {
      console.error("Error extracting element info:", error);
      return null;
    }
  }

  /**
   * Generate a stable selector for an element that can be used later
   */
  private async generateStableSelector(
    element: ElementHandle
  ): Promise<string> {
    try {
      // Try to get a data-testid or similar attribute first
      const testId = await element.evaluate((el) => {
        const element = el as Element;
        return (
          element.getAttribute("data-testid") ||
          element.getAttribute("data-test-id") ||
          element.getAttribute("id") ||
          element.getAttribute("name")
        );
      });

      if (testId) {
        const attrType = await element.evaluate((el) => {
          const element = el as Element;
          if (element.hasAttribute("data-testid")) return "data-testid";
          if (element.hasAttribute("data-test-id")) return "data-test-id";
          if (element.hasAttribute("id")) return "id";
          if (element.hasAttribute("name")) return "name";
          return null;
        });

        if (attrType) {
          return `[${attrType}="${testId}"]`;
        }
      }

      // Fall back to a more complex selector
      return await element.evaluate((el) => {
        const element = el as Element;
        // Try to create a selector based on attributes and text
        const tagName = element.tagName.toLowerCase();
        const text = element.textContent?.trim();
        const type = element.getAttribute("type");

        if (text && text.length < 50) {
          // For buttons and links with text
          if (
            tagName === "button" ||
            tagName === "a" ||
            element.getAttribute("role") === "button"
          ) {
            // Escape quotes in text to prevent selector syntax errors
            const escapedText = text.replace(/"/g, '\\"');
            return `${tagName}:has-text("${escapedText}")`;
          }
        }

        if (type) {
          if (
            tagName === "input" &&
            (element.getAttribute("placeholder") ||
              element.getAttribute("aria-label"))
          ) {
            const placeholder =
              element.getAttribute("placeholder") ||
              element.getAttribute("aria-label") ||
              "";
            // Escape quotes in placeholder to prevent selector syntax errors
            const escapedPlaceholder = placeholder.replace(/"/g, '\\"');
            return `input[type="${type}"][placeholder="${escapedPlaceholder}"]`;
          }
          return `${tagName}[type="${type}"]`;
        }

        // If nothing else works, generate a CSS selector path
        let path = "";
        let currentEl: Element | null = element;
        while (currentEl && currentEl !== document.body) {
          let selector = currentEl.tagName.toLowerCase();
          if (currentEl.id) {
            selector += `#${currentEl.id}`;
            path = selector + (path ? ">" + path : "");
            break;
          } else {
            const siblings = Array.from(
              currentEl.parentElement?.children || []
            );
            if (siblings.length > 1) {
              const index = siblings.indexOf(currentEl) + 1;
              selector += `:nth-child(${index})`;
            }
            path = selector + (path ? ">" + path : "");
            currentEl = currentEl.parentElement;
          }
        }

        return path;
      }, element);
    } catch (error) {
      // If all else fails, get Playwright to generate a selector
      return await element.evaluate((el) => {
        const element = el as Element;
        return `${element.tagName.toLowerCase()}`;
      });
    }
  }

  /**
   * Use an element ID from the LLM to interact with the actual element
   */
  async interactWithElement(
    elementId: string,
    action: "click" | "fill" | "select",
    value?: string
  ): Promise<boolean> {
    const selector = this.elementMap.get(elementId);
    if (!selector) {
      throw new Error(`No element found with ID: ${elementId}`);
    }

    try {
      const element = await this.page.$(selector);
      if (!element) {
        throw new Error(`Could not find element with selector: ${selector}`);
      }

      // Validate element type before attempting actions
      const elementType = await element.evaluate((el) => {
        const element = el as Element;
        return element.tagName.toLowerCase();
      });

      switch (action) {
        case "click":
          await element.click();
          break;
        case "fill":
          if (!value) throw new Error("Value required for fill action");
          if (!["input", "textarea"].includes(elementType)) {
            throw new Error(`Cannot fill element of type ${elementType}`);
          }
          await element.fill(value);
          break;
        case "select":
          if (!value) throw new Error("Value required for select action");
          if (elementType !== "select") {
            throw new Error(
              `Cannot select option on element of type ${elementType}`
            );
          }
          await element.selectOption(value);
          break;
      }
      return true;
    } catch (error) {
      console.error(
        `Error performing ${action} on element ${elementId}:`,
        error
      );
      return false;
    }
  }
}

// Example usage:
/*
const browser = await playwright.chromium.launch();
const page = await browser.newPage();
await page.goto('https://example.com');

const pageMapper = new PageMapper(page);
const pageSnapshot = await pageMapper.createPageSnapshot();

// Send pageSnapshot to LLM for analysis
const llmResponse = await sendToLLM(pageSnapshot);

// When LLM wants to interact with an element
if (llmResponse.action === 'click' && llmResponse.elementId) {
  await pageMapper.interactWithElement(llmResponse.elementId, 'click');
}
*/
