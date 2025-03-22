import { Page, ElementHandle } from "playwright";

type NodeType = "element" | "text" | "action" | "empty" | "ignored" | "unknown";

interface DOMNode {
  type: NodeType;
  name?: string;
  text?: string;
  children?: DOMNode[];
  actionType?: string;
  visibleText?: string;
  elementId?: number;
}

export class PageMapper {
  private page: Page;
  private actionableElements: Map<number, ElementHandle> = new Map();

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

    const body = await this.page.$("body");
    if (!body) {
      return {
        pageTitle: title,
        url,
        structure: { type: "element", name: "error", children: [] },
      };
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
  private formatDOMStructure(node: DOMNode, level: number = 0): string {
    let output = "";

    if (node.type === "text") {
      const normalizedText = this.normalizeText(node.text);
      if (normalizedText) {
        output += normalizedText + " ";
      }
    } else if (node.type === "action" && node.elementId) {
      const normalizedText = this.normalizeText(node.visibleText);
      if (normalizedText) {
        output += `<% ${node.actionType}[${node.elementId}] "${normalizedText}" %> `;
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
   * Creates a compact snapshot and stores references to actionable elements
   */
  async createCompactSnapshot(): Promise<string> {
    // Clear previous state
    this.actionableElements.clear();

    // First pass: Add our stable identifiers to actionable elements and collect them
    const elements = await this.page.$$eval(
      'input, button, select, textarea, a[href], [role="button"], [role="link"], [role="searchbox"], [role="textbox"], [role="combobox"]',
      (elements) => {
        return elements
          .filter((el) => {
            const rect = el.getBoundingClientRect();
            return rect.width > 0 && rect.height > 0;
          })
          .map((el, index) => {
            const id = index + 1; // Start IDs at 1
            el.classList.add(`spark-action-${id}`);
            return id;
          });
      }
    );

    // Second pass: Get handles to the elements we marked
    for (const id of elements) {
      const element = await this.page.$(`.spark-action-${id}`);
      if (element) {
        this.actionableElements.set(id, element);
      }
    }

    const snapshot = await this.createPageSnapshot();
    let output = `# ${snapshot.pageTitle}\nURL: ${snapshot.url}\n\n`;
    output += this.formatDOMStructure(snapshot.structure);
    return output.replace(/\n{2,}/g, "\n\n");
  }

  /**
   * Use an element ID to interact with the actual element
   */
  async interactWithElement(
    elementId: number,
    action: "click" | "fill" | "select",
    value?: string
  ): Promise<boolean> {
    try {
      const element = this.actionableElements.get(elementId);
      if (!element) {
        throw new Error(`No element found with ID: ${elementId}`);
      }

      // Get detailed element info for validation
      const elementInfo = await element.evaluate((el: HTMLElement) => ({
        tagName: el.tagName.toLowerCase(),
        role: el.getAttribute("role")?.toLowerCase(),
        type: el.getAttribute("type")?.toLowerCase(),
        isInput: el instanceof HTMLInputElement,
        isTextArea: el instanceof HTMLTextAreaElement,
        isSelect: el instanceof HTMLSelectElement,
      }));

      switch (action) {
        case "click":
          await element.click();
          break;

        case "fill":
          if (!value) throw new Error("Value required for fill action");
          if (
            !elementInfo.isInput &&
            !elementInfo.isTextArea &&
            elementInfo.role !== "searchbox" &&
            elementInfo.role !== "textbox"
          ) {
            throw new Error(
              `Cannot fill element: ${JSON.stringify(elementInfo)}`
            );
          }
          await element.fill(value);
          break;

        case "select":
          if (!value) throw new Error("Value required for select action");
          if (!elementInfo.isSelect) {
            throw new Error(
              `Cannot select option on element: ${JSON.stringify(elementInfo)}`
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

  /**
   * Extracts the complete DOM structure from an element
   */
  private async extractDOMStructure(element: ElementHandle): Promise<DOMNode> {
    try {
      const nodeInfo = await element.evaluate(
        (el: HTMLElement, ignoredTags: string[]) => {
          function getActionType(element: HTMLElement): string {
            const tagName = element.tagName.toLowerCase();
            const role = element.getAttribute("role")?.toLowerCase();
            const type = element.getAttribute("type")?.toLowerCase();

            if (type === "search" || role === "searchbox") return "SEARCHBOX";
            if (type === "submit") return "SUBMIT";
            if (role) return role.toUpperCase();
            if (tagName === "a") return "LINK";
            if (tagName === "button") return "BUTTON";
            if (tagName === "select") return "SELECT";
            if (tagName === "textarea") return "TEXTAREA";
            if (tagName === "input") {
              return type ? type.toUpperCase() : "INPUT";
            }
            return tagName.toUpperCase();
          }

          function getVisibleText(element: HTMLElement): string {
            return (
              element.getAttribute("aria-label") ||
              element
                .getAttribute("aria-labelledby")
                ?.split(" ")
                .map((id) => document.getElementById(id)?.textContent)
                .filter(Boolean)
                .join(" ") ||
              (element.id &&
                document.querySelector(`label[for="${element.id}"]`)
                  ?.textContent) ||
              (element instanceof HTMLInputElement && element.placeholder) ||
              (element instanceof HTMLInputElement && element.value) ||
              element.textContent ||
              ""
            );
          }

          function getActionId(element: HTMLElement): number {
            const className = Array.from(element.classList).find((c) =>
              c.startsWith("spark-action-")
            );
            if (!className) return 0;
            return parseInt(className.replace("spark-action-", ""));
          }

          function processNode(node: Node): DOMNode {
            if (node.nodeType === 3) {
              // Text node
              const text = node.textContent?.trim();
              return text
                ? { type: "text", text }
                : { type: "element", name: "empty", children: [] };
            }

            if (node.nodeType === 1 && node instanceof HTMLElement) {
              const tagName = node.tagName.toLowerCase();

              // Skip ignored tags
              if (ignoredTags.includes(tagName)) {
                return { type: "element", name: "ignored", children: [] };
              }

              const className = Array.from(node.classList).find((c) =>
                c.startsWith("spark-action-")
              );
              if (className) {
                const visibleText = getVisibleText(node).trim();
                if (visibleText) {
                  return {
                    type: "action",
                    name: tagName,
                    actionType: getActionType(node),
                    visibleText,
                    elementId: getActionId(node),
                  };
                }
              }

              // Process children
              const children = Array.from(node.childNodes)
                .map(processNode)
                .filter(
                  (node) => node.type !== "empty" && node.type !== "ignored"
                );

              return {
                type: "element",
                name: tagName,
                children: children.length > 0 ? children : [],
              };
            }

            return { type: "element", name: "unknown", children: [] };
          }

          return processNode(el);
        },
        Array.from(this.ignoredTags)
      );

      return nodeInfo;
    } catch (error) {
      console.error("Error extracting DOM structure:", error);
      return { type: "element", name: "error", children: [] };
    }
  }
}
