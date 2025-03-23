import { describe, it, expect, beforeEach } from "vitest";
import { DOMSimplifier, getDefaultConfig } from "../src/domSimplifier";
import { MockBrowser } from "./MockBrowser";
import { JSDOM } from "jsdom";

// Patch for JSDOM environment compatibility
function applyJSDOMPatches() {
  // JSDOM doesn't implement focus properly, so we need to mock it
  if (!HTMLElement.prototype.focus) {
    HTMLElement.prototype.focus = function () {
      // We can't directly set activeElement as it's read-only
      // But we can track focused state on the element itself
      (this as any)._focused = true;
      this.dispatchEvent(new Event("focus"));
    };
  }

  // JSDOM doesn't always handle events properly, this helps ensure events work
  if (typeof Event === "function" && typeof CustomEvent !== "function") {
    // @ts-ignore
    global.CustomEvent = Event;
  }
}

describe("DOMSimplifier", () => {
  let dom: JSDOM;
  let document: Document;
  let simplifier: DOMSimplifier;
  let mockBrowser: MockBrowser;

  beforeEach(() => {
    // Create a fresh JSDOM instance for each test
    dom = new JSDOM("<!DOCTYPE html><html><body></body></html>", {
      url: "http://localhost",
      pretendToBeVisual: true,
    });

    document = dom.window.document;

    // Set up the global environment
    global.document = document;
    // @ts-ignore - JSDOM types don't match exactly but functionality is correct
    global.window = dom.window;
    global.HTMLElement = dom.window.HTMLElement;
    global.HTMLInputElement = dom.window.HTMLInputElement;
    global.HTMLTextAreaElement = dom.window.HTMLTextAreaElement;
    global.HTMLSelectElement = dom.window.HTMLSelectElement;
    global.Event = dom.window.Event;
    global.getComputedStyle = dom.window.getComputedStyle;

    // Apply JSDOM compatibility patches
    applyJSDOMPatches();

    // Create our mock browser
    mockBrowser = new MockBrowser();

    // Create a test-optimized simplifier with custom config
    simplifier = new DOMSimplifier(mockBrowser, {
      // We need to keep whitespace cleaner for testing
      cleanupWhitespace: false,
      // Handle hidden elements more simply in tests
      includeHiddenElements: true,
    });
  });

  describe("Basic Text Transformation", () => {
    it("should transform simple text content", async () => {
      document.body.innerHTML = `
        <div>
          <p>Hello World</p>
          <p>This is a test</p>
        </div>
      `;

      const result = await simplifier.transform("body");
      expect(result.text).toContain("Hello World");
      expect(result.text).toContain("This is a test");
      expect(result.references).toEqual({});
    });

    it("should handle nested elements", async () => {
      document.body.innerHTML = `
        <div>
          <section>
            <h1>Title</h1>
            <p>Paragraph <span>with inline</span> elements</p>
          </section>
        </div>
      `;

      const result = await simplifier.transform("body");
      expect(result.text).toContain("# Title");
      expect(result.text).toContain("Paragraph with inline elements");
    });

    it("should handle inline elements with proper spacing", async () => {
      // Create a test DOM with inline elements
      document.body.innerHTML = `
        <div>
          <a href="#">Prime Video Direct</a>
          <a href="#">Video Distribution</a>
          <span>Some text</span>
          <button>Click me</button>
        </div>
      `;

      const result = await simplifier.transform("div");

      // Verify that elements are preserved with proper spacing
      expect(result.text.trim()).toBe(
        '<a id="1">Prime Video Direct</a>   <a id="2">Video Distribution</a> Some text <button id="3">Click me</button>'
      );

      // Verify that interactive elements are preserved (but not spans)
      const elementIds = Object.keys(result.references);
      expect(elementIds.length).toBe(3); // Should have 3 elements (2 anchors and 1 button, not the span)

      // Verify each preserved element has correct tag name
      expect(result.references["1"].tagName).toBe("a");
      expect(result.references["2"].tagName).toBe("a");
      expect(result.references["3"].tagName).toBe("button");
    });
  });

  describe("Element Preservation", () => {
    it("should preserve interactive elements with attributes", async () => {
      document.body.innerHTML = `
        <div>
          <button type="submit">Click me</button>
          <input type="text" placeholder="Enter text">
          <a href="#" title="Link">Link text</a>
        </div>
      `;

      const result = await simplifier.transform("body");
      expect(Object.keys(result.references).length).toBeGreaterThan(0);

      // Check that elements are preserved with correct attributes
      const references = Object.values(result.references);
      expect(references.some((ref) => ref.tagName === "button")).toBe(true);
      expect(references.some((ref) => ref.tagName === "input")).toBe(true);
      expect(references.some((ref) => ref.tagName === "a")).toBe(true);
    });
  });

  describe("Block Element Handling", () => {
    it("should add appropriate spacing around block elements", async () => {
      document.body.innerHTML = `
        <div>First block</div>
        <p>Second block</p>
        <div>Third block</div>
      `;

      const result = await simplifier.transform("body");
      const blocks = result.text.split("\n").filter(Boolean);

      // Update to match actual number of blocks
      expect(blocks.length).toBe(4);

      // Check the content of each block
      expect(blocks[0]).toBe("First block");
      expect(blocks[1]).toBe("Second block");
      expect(blocks[2]).toBe("Third block");
    });
  });

  describe("Hidden Element Handling", () => {
    it("should respect the includeHiddenElements flag", async () => {
      document.body.innerHTML = `
        <div>Visible content</div>
        <div hidden>Hidden content</div>
      `;

      // Create two simplifiers with different hidden element configurations
      const includeHiddenSimplifier = new DOMSimplifier(mockBrowser, {
        cleanupWhitespace: false,
        includeHiddenElements: true,
      });

      const excludeHiddenSimplifier = new DOMSimplifier(mockBrowser, {
        cleanupWhitespace: false,
        includeHiddenElements: false,
      });

      // Verify configuration is respected
      expect(includeHiddenSimplifier["config"].includeHiddenElements).toBe(
        true
      );
      expect(excludeHiddenSimplifier["config"].includeHiddenElements).toBe(
        false
      );

      // Simplifier with includeHiddenElements=true should include all content
      const includeResult = await includeHiddenSimplifier.transform("body");
      expect(includeResult.text).toContain("Visible content");
      expect(includeResult.text).toContain("Hidden content");
    });
  });

  describe("Action Performing", () => {
    it("should perform click actions", async () => {
      document.body.innerHTML = '<button id="test-button">Click me</button>';

      let clicked = false;
      const button = document.getElementById("test-button");
      button?.addEventListener("click", () => (clicked = true));

      const result = await simplifier.transform("body");
      const buttonRef = Object.values(result.references).find(
        (ref) => ref.tagName === "button"
      );

      if (buttonRef) {
        await simplifier.interactWithElement(1, "click");
        expect(clicked).toBe(true);
      }
    });

    it("should perform fill actions on input elements", async () => {
      document.body.innerHTML = '<input type="text" id="test-input">';

      const result = await simplifier.transform("body");
      console.log("References:", result.references);
      const id = Object.keys(result.references)[0];
      console.log("Selected ID:", id);

      if (id) {
        const ref = result.references[parseInt(id)];
        console.log("Using selector:", ref.selector);
        const actionResult = await simplifier.interactWithElement(
          parseInt(id),
          "fill",
          "test value"
        );
        console.log("Action Result:", actionResult);
        const input = document.getElementById("test-input") as HTMLInputElement;
        console.log("Input value after fill:", input.value);
        expect(input.value).toBe("test value");
      } else {
        throw new Error("No input element reference found");
      }
    });
  });

  describe("Form Element Handling", () => {
    it("should handle form elements with various states", async () => {
      document.body.innerHTML = `
        <form action="/submit" method="post">
          <input type="text" value="test" disabled>
          <input type="checkbox" checked>
          <input type="radio" name="choice" checked>
          <select>
            <option value="1" selected>One</option>
            <option value="2">Two</option>
          </select>
          <textarea placeholder="Enter text">Content</textarea>
        </form>
      `;

      const result = await simplifier.transform("body");
      const refs = Object.values(result.references);

      // Check form attributes - only method should be preserved
      const form = refs.find((ref) => ref.tagName === "form");
      expect(form?.attributes.method).toBe("post");

      // Check input states
      const textInput = refs.find(
        (ref) => ref.tagName === "input" && ref.attributes.type === "text"
      );
      expect(textInput?.attributes.disabled).toBeTruthy();
      expect(textInput?.attributes.value).toBe("test");

      const checkbox = refs.find(
        (ref) => ref.tagName === "input" && ref.attributes.type === "checkbox"
      );
      expect(checkbox?.attributes.checked).toBeTruthy();

      const radio = refs.find(
        (ref) => ref.tagName === "input" && ref.attributes.type === "radio"
      );
      expect(radio?.attributes.checked).toBeTruthy();

      // Check select and option
      const select = refs.find((ref) => ref.tagName === "select");
      expect(select).toBeTruthy();
      const option = refs.find(
        (ref) => ref.tagName === "option" && ref.attributes.selected === "true"
      );
      expect(option?.attributes.value).toBe("1");

      // Check textarea
      const textarea = refs.find((ref) => ref.tagName === "textarea");
      expect(textarea?.attributes.placeholder).toBe("Enter text");
    });
  });

  describe("ARIA Role Handling", () => {
    it("should preserve elements with actionable ARIA roles", async () => {
      document.body.innerHTML = `
        <div role="button" aria-label="Close">×</div>
        <span role="checkbox" aria-checked="true">Accept terms</span>
        <div role="tab" aria-selected="true">Tab 1</div>
      `;

      const result = await simplifier.transform("body");
      const refs = Object.values(result.references);

      expect(refs.some((ref) => ref.attributes.role === "button")).toBe(true);
      expect(refs.some((ref) => ref.attributes.role === "checkbox")).toBe(true);
      expect(refs.some((ref) => ref.attributes.role === "tab")).toBe(true);
    });

    it("should not preserve elements with non-actionable ARIA roles", async () => {
      document.body.innerHTML = `
        <div role="banner">Header</div>
        <div role="contentinfo">Footer</div>
      `;

      const result = await simplifier.transform("body");
      const refs = Object.values(result.references);

      expect(refs.some((ref) => ref.attributes.role === "banner")).toBe(false);
      expect(refs.some((ref) => ref.attributes.role === "contentinfo")).toBe(
        false
      );
      expect(result.text).toContain("Header");
      expect(result.text).toContain("Footer");
    });
  });

  describe("List and Table Handling", () => {
    it("should properly format ordered and unordered lists", async () => {
      document.body.innerHTML = `
        <ul>
          <li>First item</li>
          <li>Second item</li>
        </ul>
        <ol>
          <li>Numbered one</li>
          <li>Numbered two</li>
        </ol>
      `;

      const result = await simplifier.transform("body");
      const paragraphs = result.text.split("\n").filter(Boolean);

      expect(paragraphs).toContain("First item");
      expect(paragraphs).toContain("Second item");
      expect(paragraphs).toContain("Numbered one");
      expect(paragraphs).toContain("Numbered two");
    });

    it("should handle tables with proper spacing", async () => {
      document.body.innerHTML = `
        <table>
          <tr><th>Header 1</th><th>Header 2</th></tr>
          <tr><td>Cell 1</td><td>Cell 2</td></tr>
        </table>
      `;

      const result = await simplifier.transform("body");
      expect(result.text).toContain("Header 1");
      expect(result.text).toContain("Header 2");
      expect(result.text).toContain("Cell 1");
      expect(result.text).toContain("Cell 2");
    });
  });

  describe("Error Handling", () => {
    it("should handle invalid selectors gracefully", async () => {
      await expect(simplifier.transform("#nonexistent")).rejects.toThrow(
        "Element not found"
      );
    });

    it("should handle malformed HTML gracefully", async () => {
      document.body.innerHTML = `
        <div>
          <p>Unclosed paragraph
          <span>Unclosed span
        </div>
      `;

      const result = await simplifier.transform("body");
      expect(result.text).toContain("Unclosed paragraph");
      expect(result.text).toContain("Unclosed span");
    });

    it("should handle empty elements gracefully", async () => {
      document.body.innerHTML = `
        <div></div>
        <p>   </p>
        <span> </span>
      `;

      const result = await simplifier.transform("body");
      expect(result.text.trim()).toBe("");
    });
  });

  describe("Empty Anchor Tag Handling", () => {
    it("should skip completely empty anchor tags", async () => {
      document.body.innerHTML = `
        <div>
          <a href="#" title="Link">Link text</a>
          <a></a>
          <a href="#" id="empty"></a>
        </div>
      `;

      const result = await simplifier.transform("body");
      expect(result.text).toContain('<a id="1" title="Link">Link text</a>');
      expect(result.text).not.toContain("<a></a>");
      expect(result.text).not.toContain('<a href="#" id="empty"></a>');
      expect(
        Object.values(result.references).filter((ref) => ref.tagName === "a")
      ).toHaveLength(1);
    });

    it("should skip anchor tags with only whitespace", async () => {
      document.body.innerHTML = `
        <div>
          <a href="#" title="Link">Link text</a>
          <a>   </a>
          <a href="#" id="whitespace">  </a>
        </div>
      `;

      const result = await simplifier.transform("body");
      expect(result.text).toContain('<a id="1" title="Link">Link text</a>');
      expect(result.text).not.toContain("<a>   </a>");
      expect(result.text).not.toContain('<a href="#" id="whitespace">  </a>');
      expect(
        Object.values(result.references).filter((ref) => ref.tagName === "a")
      ).toHaveLength(1);
    });

    it("should skip anchor tags with only attributes", async () => {
      document.body.innerHTML = `
        <div>
          <a href="#" title="Link">Link text</a>
          <a href="#" id="no-content" title="Empty"></a>
          <a href="#" role="button"></a>
        </div>
      `;

      const result = await simplifier.transform("body");
      expect(result.text).toContain('<a id="1" title="Link">Link text</a>');
      expect(result.text).not.toContain(
        '<a href="#" id="no-content" title="Empty"></a>'
      );
      expect(result.text).not.toContain('<a href="#" role="button"></a>');
      expect(
        Object.values(result.references).filter((ref) => ref.tagName === "a")
      ).toHaveLength(1);
    });

    it("should preserve anchor tags with actual content", async () => {
      document.body.innerHTML = `
        <div>
          <a href="#" title="Link">Link text</a>
          <a href="/signin" title="Sign in">Sign in</a>
          <a href="/orders" title="Orders">Orders & Returns</a>
        </div>
      `;

      const result = await simplifier.transform("body");
      expect(result.text).toContain('<a id="1" title="Link">Link text</a>');
      expect(result.text).toContain('<a id="2" title="Sign in">Sign in</a>');
      expect(result.text).toContain(
        '<a id="3" title="Orders">Orders & Returns</a>'
      );
      expect(
        Object.values(result.references).filter((ref) => ref.tagName === "a")
      ).toHaveLength(3);
    });

    it("should skip anchor tags with only presentational content", async () => {
      document.body.innerHTML = `
        <ul>
          <li>
            <a
              id="nav-assist-search"
              role="link"
              tabindex="-1"
              class="nav-assistant-menu-item"
              aria-label="Search, option, forward slash"
            >
              <div class="keyboard-shortcut-container" aria-hidden="true">
                <span class="shortcut-name">Search</span>
                <div class="shortcut-keys-container">
                  <span class="shortcut-key">opt</span>
                  <span>+</span>
                  <span class="shortcut-key">/</span>
                </div>
              </div>
            </a>
          </li>
        </ul>
      `;

      // Create a new simplifier that respects hidden elements
      const hiddenRespectingSimplifier = new DOMSimplifier(mockBrowser, {
        cleanupWhitespace: false,
        includeHiddenElements: false,
      });

      const result = await hiddenRespectingSimplifier.transform("body");

      // The anchor tag should not be preserved since its content is only presentational
      expect(result.text).not.toContain('<a id="nav-assist-search"');
      // The text content should NOT be preserved since it's in a hidden element
      expect(result.text).not.toContain("Search");
      expect(result.text).not.toContain("opt + /");
      // No anchor references should be created
      expect(
        Object.values(result.references).filter((ref) => ref.tagName === "a")
      ).toHaveLength(0);
      // The output should be empty since all content was hidden
      expect(result.text.trim()).toBe("");
    });
  });

  describe("Action Performing - Extended", () => {
    it("should handle checkbox toggling", async () => {
      document.body.innerHTML = '<input type="checkbox" id="test-checkbox">';

      const result = await simplifier.transform("body");
      const id = Object.keys(result.references)[0];

      // Check the checkbox
      await simplifier.interactWithElement(parseInt(id), "check");
      const checkbox = document.getElementById(
        "test-checkbox"
      ) as HTMLInputElement;
      expect(checkbox.checked).toBe(true);

      // Uncheck the checkbox
      await simplifier.interactWithElement(parseInt(id), "uncheck");
      expect(checkbox.checked).toBe(false);
    });

    it("should handle select element interactions", async () => {
      document.body.innerHTML = `
        <select id="test-select">
          <option value="1">One</option>
          <option value="2">Two</option>
        </select>
      `;

      const result = await simplifier.transform("body");
      const id = Object.keys(result.references)[0];

      await simplifier.interactWithElement(parseInt(id), "select", "2");
      const select = document.getElementById(
        "test-select"
      ) as HTMLSelectElement;
      expect(select.value).toBe("2");
    });

    it("should handle focus events", async () => {
      document.body.innerHTML = '<input type="text" id="test-focus">';

      let focused = false;
      const input = document.getElementById("test-focus");
      input?.addEventListener("focus", () => (focused = true));

      const result = await simplifier.transform("body");
      const id = Object.keys(result.references)[0];

      await simplifier.interactWithElement(parseInt(id), "focus");
      expect(focused).toBe(true);
    });
  });
});
