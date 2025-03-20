import { Page, ElementHandle } from "playwright";

interface DOMNode {
  type: "element" | "text";
  name?: string; // tag name for elements
  text?: string; // text content for text nodes
  children?: DOMNode[];
}

export class PageMapper {
  private page: Page;
  private elementMap: Map<string, string> = new Map();
  private idCounter: number = 0;

  // Tags to ignore
  private readonly ignoredTags = new Set([
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
    "br",
    "hr",
  ]);

  constructor(page: Page) {
    this.page = page;
  }

  /**
   * Creates a complete DOM structure representation of the page
   */
  async createPageSnapshot(): Promise<{
    pageTitle: string;
    url: string;
    structure: DOMNode;
  }> {
    const title = await this.page.title();
    const url = this.page.url();

    // Reset the element map for a new snapshot
    this.elementMap = new Map();
    this.idCounter = 0;

    // Get the body element
    const body = await this.page.$("body");
    if (!body) {
      throw new Error("Could not find body element");
    }

    const structure = await this.extractDOMStructure(body);

    return {
      pageTitle: title,
      url,
      structure,
    };
  }

  /**
   * Creates a compact text representation of the DOM structure
   */
  async createCompactSnapshot(): Promise<string> {
    const snapshot = await this.createPageSnapshot();
    return this.formatDOMStructure(snapshot.structure);
  }

  /**
   * Extracts the complete DOM structure from an element
   */
  private async extractDOMStructure(element: ElementHandle): Promise<DOMNode> {
    try {
      const nodeInfo = await element.evaluate((el, ignoredTags) => {
        function processNode(node: Node): any {
          if (node.nodeType === 3) {
            // Text node
            const text = node.textContent?.trim();
            return text ? { type: "text", text } : null;
          }

          if (node.nodeType === 1) {
            // Element node
            const element = node as Element;
            const tagName = element.tagName.toLowerCase();

            // Skip ignored tags
            if (ignoredTags.includes(tagName)) {
              return null;
            }

            // Process children
            const children = Array.from(element.childNodes)
              .map(processNode)
              .filter(Boolean);

            // If no children and no text content, skip this element
            if (children.length === 0 && !element.textContent?.trim()) {
              return null;
            }

            return {
              type: "element",
              name: tagName,
              children,
            };
          }

          return null;
        }

        return processNode(el);
      }, Array.from(this.ignoredTags));

      return nodeInfo;
    } catch (error) {
      console.error("Error extracting DOM structure:", error);
      return {
        type: "element",
        name: "error",
        children: [],
      };
    }
  }

  /**
   * Formats the DOM structure into an indented text representation
   */
  private formatDOMStructure(node: DOMNode, level: number = 0): string {
    const indent = "  ".repeat(level);
    let output = "";

    if (node.type === "text") {
      output += `${indent}${node.text}\n`;
    } else {
      output += `${indent}${node.name}\n`;
      if (node.children) {
        for (const child of node.children) {
          output += this.formatDOMStructure(child, level + 1);
        }
      }
    }

    return output;
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

// Get the compact text representation
const compactSnapshot = await pageMapper.createCompactSnapshot();
console.log(compactSnapshot);
*/
