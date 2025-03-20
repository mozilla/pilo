import { Page, ElementHandle } from "playwright";

type NodeType = "element" | "text" | "action";

interface DOMNode {
  type: NodeType;
  name?: string;
  text?: string;
  children?: DOMNode[];
  actionType?: string;
  visibleText?: string;
}

export class PageMapper {
  private page: Page;
  private actionIdCounter: number = 0;

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

  // Block elements that should start a new line
  private readonly blockElements = new Set([
    "p",
    "div",
    "h1",
    "h2",
    "h3",
    "h4",
    "h5",
    "h6",
    "li",
    "tr",
    "td",
    "th",
    "section",
    "article",
    "nav",
    "header",
    "footer",
    "main",
    "aside",
  ]);

  // Interactive elements that need special formatting
  private readonly actionElements = new Set([
    "a",
    "button",
    "input",
    "select",
    "textarea",
    "label",
    "[role='button']",
    "[role='link']",
    "[role='menuitem']",
    "[role='tab']",
    "[role='option']",
    "[role='checkbox']",
    "[role='radio']",
    "[role='switch']",
    "[role='combobox']",
    "[role='listbox']",
    "[role='menubar']",
    "[role='tablist']",
    "[role='tree']",
    "[role='grid']",
    "[role='list']",
    "[role='menu']",
    "[role='dialog']",
    "[role='alert']",
    "[role='alertdialog']",
    "[role='status']",
    "[role='log']",
    "[role='marquee']",
    "[role='timer']",
    "[role='progressbar']",
    "[role='slider']",
    "[role='spinbutton']",
    "[role='textbox']",
    "[contenteditable='true']",
  ]);

  constructor(page: Page) {
    this.page = page;
  }

  /**
   * Normalizes text by removing extra whitespace and cleaning up the content
   */
  private normalizeText(text: string | null | undefined): string {
    if (!text) return "";
    return text
      .replace(/\s+/g, " ") // Replace multiple spaces with single space
      .replace(/\n+/g, " ") // Replace newlines with space
      .replace(/\t+/g, " ") // Replace tabs with space
      .replace(/<[^>]*>/g, "") // Remove HTML tags
      .trim(); // Remove leading/trailing whitespace
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

    // Reset the action ID counter for a new snapshot
    this.actionIdCounter = 0;

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
    const output = this.formatDOMStructure(snapshot.structure);
    // Replace 2 or more newlines with exactly 2 newlines
    return output.replace(/\n{2,}/g, "\n\n");
  }

  /**
   * Gets a descriptive action type for an element
   */
  private getActionType(element: Element): string {
    const tagName = element.tagName.toLowerCase();
    const role = element.getAttribute("role")?.toUpperCase();
    const type = element.getAttribute("type")?.toLowerCase();

    // Handle elements with roles first
    if (role) {
      return role;
    }

    // Handle specific element types
    switch (tagName) {
      case "a":
        return "LINK";
      case "button":
        return "BUTTON";
      case "input":
        switch (type) {
          case "text":
          case "email":
          case "password":
          case "tel":
          case "url":
          case "search":
            return "INPUT";
          case "checkbox":
            return "CHECKBOX";
          case "radio":
            return "RADIO";
          case "file":
            return "FILE";
          case "submit":
            return "SUBMIT";
          case "reset":
            return "RESET";
          case "button":
            return "BUTTON";
          case "number":
            return "NUMBER";
          case "range":
            return "RANGE";
          case "date":
          case "time":
          case "datetime-local":
            return "DATE";
          case "color":
            return "COLOR";
          case "hidden":
            return "HIDDEN";
          default:
            return "INPUT";
        }
      case "select":
        return "SELECT";
      case "textarea":
        return "TEXTAREA";
      case "form":
        return "FORM";
      case "label":
        return "LABEL";
      default:
        return tagName.toUpperCase();
    }
  }

  /**
   * Extracts the complete DOM structure from an element
   */
  private async extractDOMStructure(element: ElementHandle): Promise<DOMNode> {
    try {
      const context = {
        ignoredTags: Array.from(this.ignoredTags),
        blockElements: Array.from(this.blockElements),
        actionElements: Array.from(this.actionElements),
      };

      const nodeInfo = await element.evaluate(
        (
          el: Element,
          context: {
            ignoredTags: string[];
            blockElements: string[];
            actionElements: string[];
          }
        ) => {
          function processNode(node: Node): DOMNode | null {
            if (node.nodeType === 3) {
              // Text node
              const text = node.textContent?.trim();
              return text ? { type: "text", text } : null;
            }

            if (node.nodeType === 1) {
              // Element node
              const element = node as Element;
              const tagName = element.tagName.toLowerCase();

              // Check if element is visible
              const style = window.getComputedStyle(element);
              const isVisible =
                style.display !== "none" &&
                style.visibility !== "hidden" &&
                style.opacity !== "0" &&
                (element as HTMLElement).offsetWidth > 0 &&
                (element as HTMLElement).offsetHeight > 0;

              // Skip if element is not visible
              if (!isVisible) {
                return null;
              }

              // Handle images specially
              if (tagName === "img") {
                const altText = element.getAttribute("alt");
                const titleText = element.getAttribute("title");
                const ariaLabel = element.getAttribute("aria-label");

                // Try to get meaningful text from the image
                const text = altText || titleText || ariaLabel;
                if (!text) return null; // Skip images with no text

                return {
                  type: "text",
                  text: text,
                };
              }

              // Skip ignored tags
              if (context.ignoredTags.includes(tagName)) {
                return null;
              }

              // Check if element is interactive (has role or is in actionElements)
              const hasRole = element.hasAttribute("role");
              const role = element.getAttribute("role");
              const isActionElement =
                context.actionElements.includes(tagName) ||
                (hasRole &&
                  context.actionElements.includes(`[role='${role}']`));

              // Skip hidden inputs and forms
              if (isActionElement) {
                if (
                  tagName === "input" &&
                  element.getAttribute("type") === "hidden"
                ) {
                  return null;
                }
                if (tagName === "form") {
                  return null;
                }

                // Try multiple fallbacks for visible text in order of preference
                let visibleText = "";

                // 1. Try aria-label first (most explicit)
                visibleText = element.getAttribute("aria-label") || "";

                // 2. Try aria-labelledby if no aria-label
                if (!visibleText) {
                  const labelledby = element.getAttribute("aria-labelledby");
                  if (labelledby) {
                    const labelElement = document.getElementById(labelledby);
                    if (labelElement) {
                      visibleText = labelElement.textContent?.trim() || "";
                    }
                  }
                }

                // 3. Try label element for form controls
                if (
                  !visibleText &&
                  ["input", "select", "textarea"].includes(tagName)
                ) {
                  const id = element.getAttribute("id");
                  if (id) {
                    const label = document.querySelector(`label[for="${id}"]`);
                    if (label) {
                      visibleText = label.textContent?.trim() || "";
                    }
                  }
                }

                // 4. Try placeholder for inputs
                if (!visibleText && tagName === "input") {
                  visibleText = (element as HTMLInputElement).placeholder || "";
                }

                // 5. Try value for inputs and buttons
                if (
                  !visibleText &&
                  (tagName === "input" || tagName === "button")
                ) {
                  visibleText =
                    (element as HTMLInputElement | HTMLButtonElement).value ||
                    "";
                }

                // 6. Try direct text content as last resort (excluding child elements)
                if (!visibleText) {
                  // Get only direct text nodes, excluding child elements
                  const directTextNodes = Array.from(element.childNodes)
                    .filter((node) => node.nodeType === 3)
                    .map((node) => node.textContent?.trim())
                    .filter((text) => text && !text.includes("{")); // Filter out CSS-like content
                  visibleText = directTextNodes.join(" ").trim();
                }

                // Skip if no meaningful text
                if (!visibleText) {
                  return null;
                }

                // Get descriptive action type
                const actionType = getActionType(element);

                return {
                  type: "action",
                  name: tagName,
                  actionType,
                  visibleText,
                };
              }

              // Process children
              const children = Array.from(element.childNodes)
                .map(processNode)
                .filter((node): node is DOMNode => node !== null);

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

          // Helper function to get action type
          function getActionType(element: Element): string {
            const tagName = element.tagName.toLowerCase();
            const role = element.getAttribute("role")?.toUpperCase();
            const type = element.getAttribute("type")?.toLowerCase();

            // Handle elements with roles first
            if (role) {
              return role;
            }

            // Handle specific element types
            switch (tagName) {
              case "a":
                return "LINK";
              case "button":
                return "BUTTON";
              case "input":
                switch (type) {
                  case "text":
                  case "email":
                  case "password":
                  case "tel":
                  case "url":
                  case "search":
                    return "INPUT";
                  case "checkbox":
                    return "CHECKBOX";
                  case "radio":
                    return "RADIO";
                  case "file":
                    return "FILE";
                  case "submit":
                    return "SUBMIT";
                  case "reset":
                    return "RESET";
                  case "button":
                    return "BUTTON";
                  case "number":
                    return "NUMBER";
                  case "range":
                    return "RANGE";
                  case "date":
                  case "time":
                  case "datetime-local":
                    return "DATE";
                  case "color":
                    return "COLOR";
                  case "hidden":
                    return "HIDDEN";
                  default:
                    return "INPUT";
                }
              case "select":
                return "SELECT";
              case "textarea":
                return "TEXTAREA";
              case "form":
                return "FORM";
              case "label":
                return "LABEL";
              default:
                return tagName.toUpperCase();
            }
          }

          return processNode(el) as DOMNode;
        },
        context
      );

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
   * Formats the DOM structure into the new compact text format
   */
  private formatDOMStructure(node: DOMNode, level: number = 0): string {
    let output = "";

    if (node.type === "text") {
      const normalizedText = this.normalizeText(node.text);
      if (normalizedText) {
        output += normalizedText + " ";
      }
    } else if (node.type === "action") {
      this.actionIdCounter++;
      const normalizedText = this.normalizeText(node.visibleText);
      if (normalizedText) {
        output += `<% ${node.actionType}[${this.actionIdCounter}] "${normalizedText}" %> `;
      }
    } else if (node.type === "element") {
      const isBlock = this.blockElements.has(node.name || "");
      const isTable = node.name === "table";
      const isHeading = /^h[1-6]$/.test(node.name || "");

      // Add newline before block elements (except tables)
      if (isBlock && !isTable) {
        output = output.trim() + "\n";
      }

      // Handle headings
      if (isHeading) {
        const level = parseInt(node.name![1]);
        output += "#".repeat(level) + " ";
      }

      // Process children
      if (node.children) {
        for (const child of node.children) {
          const childOutput = this.formatDOMStructure(child, level + 1);
          if (childOutput.trim()) {
            output += childOutput;
          }
        }
      }

      // Handle table rows
      if (isTable && node.name === "tr") {
        output = output.trim() + " |\n";
      }
    }

    return output;
  }

  /**
   * Use an element ID from the LLM to interact with the actual element
   */
  async interactWithElement(
    elementId: number,
    action: "click" | "fill" | "select",
    value?: string
  ): Promise<boolean> {
    try {
      // Find the element with the matching action ID and get its type
      const elementInfo = await this.page.evaluate((id: number) => {
        const elements = Array.from(
          document.querySelectorAll(
            "a, button, input, form, select, textarea, label"
          )
        );
        let currentId = 0;

        for (const el of elements) {
          currentId++;
          if (currentId === id) {
            return {
              tagName: el.tagName.toLowerCase(),
              exists: true,
            };
          }
        }
        return {
          tagName: "",
          exists: false,
        };
      }, elementId);

      if (!elementInfo.exists) {
        throw new Error(`No element found with ID: ${elementId}`);
      }

      // Create a selector to find the element
      const selector = `a, button, input, form, select, textarea, label:nth-of-type(${elementId})`;
      const element = await this.page.$(selector);

      if (!element) {
        throw new Error(`Could not find element with selector: ${selector}`);
      }

      switch (action) {
        case "click":
          await element.click();
          break;
        case "fill":
          if (!value) throw new Error("Value required for fill action");
          if (!["input", "textarea"].includes(elementInfo.tagName)) {
            throw new Error(
              `Cannot fill element of type ${elementInfo.tagName}`
            );
          }
          await element.fill(value);
          break;
        case "select":
          if (!value) throw new Error("Value required for select action");
          if (elementInfo.tagName !== "select") {
            throw new Error(
              `Cannot select option on element of type ${elementInfo.tagName}`
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
