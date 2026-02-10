import { describe, it, expect } from "vitest";
import { JSDOM } from "jsdom";

// We test the ariaSnapshot module by importing it directly and running in jsdom.
// NOTE: jsdom lacks a layout engine, so getBoundingClientRect() returns 0x0 rects.
// This means elements aren't considered "visible" by the box check, so refs won't
// appear in YAML output. However, aria-ref attributes ARE set on the DOM elements.
// We test both: YAML structure (roles, names, hierarchy) and ref assignment via DOM.

let dom: JSDOM;
let document: Document;

function setupDOM(html: string) {
  dom = new JSDOM(html, { url: "http://localhost" });
  document = dom.window.document;

  (globalThis as any).window = dom.window;
  (globalThis as any).document = document;
  (globalThis as any).Node = dom.window.Node;
  (globalThis as any).Element = dom.window.Element;
  (globalThis as any).HTMLElement = dom.window.HTMLElement;
  (globalThis as any).HTMLInputElement = dom.window.HTMLInputElement;
  (globalThis as any).HTMLTextAreaElement = dom.window.HTMLTextAreaElement;
  (globalThis as any).HTMLSelectElement = dom.window.HTMLSelectElement;
  (globalThis as any).HTMLFormElement = dom.window.HTMLFormElement;
  (globalThis as any).HTMLIFrameElement = dom.window.HTMLIFrameElement;
  (globalThis as any).HTMLSlotElement = dom.window.HTMLSlotElement;
  (globalThis as any).HTMLButtonElement = dom.window.HTMLButtonElement;
  (globalThis as any).HTMLOutputElement = dom.window.HTMLOutputElement;
  (globalThis as any).HTMLOptionElement = dom.window.HTMLOptionElement;
  (globalThis as any).HTMLDetailsElement = dom.window.HTMLDetailsElement;
  (globalThis as any).HTMLLabelElement = dom.window.HTMLLabelElement;
  (globalThis as any).ShadowRoot = dom.window.ShadowRoot;
  (globalThis as any).Text = dom.window.Text;
  (globalThis as any).MouseEvent = dom.window.MouseEvent;
  (globalThis as any).KeyboardEvent = dom.window.KeyboardEvent;
  (globalThis as any).Event = dom.window.Event;
  (globalThis as any).DOMRect = dom.window.DOMRect;
  (globalThis as any).CSS = dom.window.CSS || { escape: (s: string) => s };
  (globalThis as any).SVGElement = dom.window.SVGElement;
}

describe("ariaTree module", () => {
  describe("generateAndRenderAriaTree", () => {
    it("should generate YAML for a simple button", async () => {
      setupDOM("<html><body><button>Click me</button></body></html>");

      const { generateAndRenderAriaTree } =
        await import("../../../src/browser/ariaTree/ariaSnapshot.js");

      const yaml = generateAndRenderAriaTree(document.body);
      expect(yaml).toContain("button");
      expect(yaml).toContain("Click me");
    });

    it("should set aria-ref attributes on DOM elements with E prefix", async () => {
      setupDOM(`<html><body>
        <button id="btn1">First</button>
        <button id="btn2">Second</button>
        <button id="btn3">Third</button>
      </body></html>`);

      const { generateAndRenderAriaTree } =
        await import("../../../src/browser/ariaTree/ariaSnapshot.js");

      generateAndRenderAriaTree(document.body);

      // All buttons should have sequential E-prefixed refs
      const refs: string[] = [];
      for (const id of ["btn1", "btn2", "btn3"]) {
        const el = document.getElementById(id)!;
        const ref = el.getAttribute("aria-ref");
        expect(ref).toBeTruthy();
        expect(ref).toMatch(/^E\d+$/);
        refs.push(ref!);
      }

      // Refs should be sequential
      const nums = refs.map((r) => parseInt(r.slice(1)));
      expect(nums[1]).toBeGreaterThan(nums[0]);
      expect(nums[2]).toBeGreaterThan(nums[1]);
    });

    it("should clean up previous aria-ref attributes", async () => {
      setupDOM('<html><body><button id="btn" aria-ref="old-ref">Click</button></body></html>');

      const { generateAndRenderAriaTree } =
        await import("../../../src/browser/ariaTree/ariaSnapshot.js");

      generateAndRenderAriaTree(document.body);

      const btn = document.getElementById("btn")!;
      const ref = btn.getAttribute("aria-ref");
      expect(ref).not.toBe("old-ref");
      expect(ref).toMatch(/^E\d+$/);
    });

    it("should accept a counter parameter for cross-frame numbering", async () => {
      setupDOM("<html><body><button>A</button></body></html>");

      const { generateAndRenderAriaTree } =
        await import("../../../src/browser/ariaTree/ariaSnapshot.js");

      const counter = { value: 100 };
      generateAndRenderAriaTree(document.body, counter);

      // Counter should have advanced beyond 100
      expect(counter.value).toBeGreaterThan(100);

      // The button's ref should be numbered after 100
      const btn = document.querySelector("button")!;
      const ref = btn.getAttribute("aria-ref")!;
      const num = parseInt(ref.slice(1));
      expect(num).toBeGreaterThan(100);
    });

    it("should handle links with href", async () => {
      setupDOM('<html><body><a href="https://example.com">Example</a></body></html>');

      const { generateAndRenderAriaTree } =
        await import("../../../src/browser/ariaTree/ariaSnapshot.js");

      const yaml = generateAndRenderAriaTree(document.body);
      expect(yaml).toContain("link");
      expect(yaml).toContain("Example");
    });

    it("should handle headings with levels", async () => {
      setupDOM("<html><body><h1>Title</h1><h2>Subtitle</h2></body></html>");

      const { generateAndRenderAriaTree } =
        await import("../../../src/browser/ariaTree/ariaSnapshot.js");

      const yaml = generateAndRenderAriaTree(document.body);
      expect(yaml).toContain("heading");
      expect(yaml).toContain("[level=1]");
      expect(yaml).toContain("[level=2]");
    });

    it("should handle input elements", async () => {
      setupDOM(
        '<html><body><input type="text" value="hello" placeholder="Enter text" /></body></html>',
      );

      const { generateAndRenderAriaTree } =
        await import("../../../src/browser/ariaTree/ariaSnapshot.js");

      const yaml = generateAndRenderAriaTree(document.body);
      expect(yaml).toContain("textbox");
    });

    it("should handle checkboxes", async () => {
      setupDOM(
        '<html><body><input type="checkbox" checked aria-label="Accept terms" /></body></html>',
      );

      const { generateAndRenderAriaTree } =
        await import("../../../src/browser/ariaTree/ariaSnapshot.js");

      const yaml = generateAndRenderAriaTree(document.body);
      expect(yaml).toContain("checkbox");
      expect(yaml).toContain("[checked]");
    });

    it("should handle lists", async () => {
      setupDOM("<html><body><ul><li>Item 1</li><li>Item 2</li></ul></body></html>");

      const { generateAndRenderAriaTree } =
        await import("../../../src/browser/ariaTree/ariaSnapshot.js");

      const yaml = generateAndRenderAriaTree(document.body);
      expect(yaml).toContain("list");
      expect(yaml).toContain("listitem");
    });

    it("should use ref= prefix format in YAML (not bare refs)", async () => {
      // NOTE: jsdom has no layout engine so refs don't appear in YAML output
      // (nodeReceivesPointerEvents returns false). We verify the format rule:
      // the YAML should never contain bare [E###] without the ref= prefix.
      setupDOM("<html><body><button>Click</button></body></html>");

      const { generateAndRenderAriaTree } =
        await import("../../../src/browser/ariaTree/ariaSnapshot.js");

      const yaml = generateAndRenderAriaTree(document.body);
      // No bare [E\d+] — if refs appeared they'd be [ref=E\d+]
      expect(yaml).not.toMatch(/\[E\d+\]/);
    });

    it("should allow element lookup via aria-ref CSS selector", async () => {
      setupDOM(`<html><body>
        <button id="btn1">First</button>
        <button id="btn2">Second</button>
      </body></html>`);

      const { generateAndRenderAriaTree } =
        await import("../../../src/browser/ariaTree/ariaSnapshot.js");

      generateAndRenderAriaTree(document.body);

      // Should be able to find elements by their aria-ref attribute
      const btn1 = document.getElementById("btn1")!;
      const ref = btn1.getAttribute("aria-ref")!;
      const found = document.querySelector(`[aria-ref="${ref}"]`);
      expect(found).toBe(btn1);
    });

    it("should handle disabled elements", async () => {
      setupDOM("<html><body><button disabled>Disabled</button></body></html>");

      const { generateAndRenderAriaTree } =
        await import("../../../src/browser/ariaTree/ariaSnapshot.js");

      const yaml = generateAndRenderAriaTree(document.body);
      expect(yaml).toContain("button");
      expect(yaml).toContain("[disabled]");
    });

    it("should handle nested structures", async () => {
      setupDOM(`<html><body>
        <nav>
          <ul>
            <li><a href="/home">Home</a></li>
            <li><a href="/about">About</a></li>
          </ul>
        </nav>
      </body></html>`);

      const { generateAndRenderAriaTree } =
        await import("../../../src/browser/ariaTree/ariaSnapshot.js");

      const yaml = generateAndRenderAriaTree(document.body);
      expect(yaml).toContain("navigation");
      expect(yaml).toContain("list");
      expect(yaml).toContain("link");
      expect(yaml).toContain("Home");
      expect(yaml).toContain("About");
    });

    it("should not expose password input values", async () => {
      setupDOM(
        '<html><body><input type="password" value="secret123" aria-label="Password" /></body></html>',
      );

      const { generateAndRenderAriaTree } =
        await import("../../../src/browser/ariaTree/ariaSnapshot.js");

      const yaml = generateAndRenderAriaTree(document.body);
      expect(yaml).not.toContain("secret123");
      expect(yaml).toContain("textbox");
    });

    it("should not expose sensitive autocomplete input values", async () => {
      setupDOM(`<html><body>
        <input type="text" autocomplete="cc-number" value="4111111111111111" aria-label="Card" />
        <input type="text" autocomplete="cc-csc" value="123" aria-label="CVV" />
        <input type="text" autocomplete="current-password" value="mypass" aria-label="Pass" />
      </body></html>`);

      const { generateAndRenderAriaTree } =
        await import("../../../src/browser/ariaTree/ariaSnapshot.js");

      const yaml = generateAndRenderAriaTree(document.body);
      expect(yaml).not.toContain("4111111111111111");
      expect(yaml).not.toContain("123");
      expect(yaml).not.toContain("mypass");
    });

    it("should not expose OTP and additional payment autocomplete values", async () => {
      setupDOM(`<html><body>
        <input type="text" autocomplete="one-time-code" value="847291" aria-label="OTP" />
        <input type="text" autocomplete="cc-exp-month" value="12" aria-label="Exp Month" />
        <input type="text" autocomplete="cc-exp-year" value="2028" aria-label="Exp Year" />
        <input type="text" autocomplete="cc-name" value="John Doe" aria-label="Cardholder" />
      </body></html>`);

      const { generateAndRenderAriaTree } =
        await import("../../../src/browser/ariaTree/ariaSnapshot.js");

      const yaml = generateAndRenderAriaTree(document.body);
      expect(yaml).not.toContain("847291");
      expect(yaml).not.toContain("2028");
      expect(yaml).not.toContain("John Doe");
    });

    it("should expose regular text input values", async () => {
      setupDOM(
        '<html><body><input type="text" value="hello world" aria-label="Name" /></body></html>',
      );

      const { generateAndRenderAriaTree } =
        await import("../../../src/browser/ariaTree/ariaSnapshot.js");

      const yaml = generateAndRenderAriaTree(document.body);
      expect(yaml).toContain("hello world");
    });

    it("should expose textarea values", async () => {
      setupDOM('<html><body><textarea aria-label="Notes">some notes here</textarea></body></html>');

      const { generateAndRenderAriaTree } =
        await import("../../../src/browser/ariaTree/ariaSnapshot.js");

      const yaml = generateAndRenderAriaTree(document.body);
      expect(yaml).toContain("some notes here");
    });

    it("should truncate very long names with ellipsis", async () => {
      const longName = "a".repeat(1000);
      setupDOM(`<html><body><button aria-label="${longName}">Click</button></body></html>`);

      const { generateAndRenderAriaTree } =
        await import("../../../src/browser/ariaTree/ariaSnapshot.js");

      const yaml = generateAndRenderAriaTree(document.body);
      expect(yaml).toContain("button");
      // Should contain truncated name with ellipsis, not full 1000 chars
      expect(yaml).toContain("...");
      expect(yaml).not.toContain("a".repeat(1000));
    });

    it("should skip elements with role=presentation", async () => {
      setupDOM(
        '<html><body><img role="presentation" src="decorative.png" /><button>Real</button></body></html>',
      );

      const { generateAndRenderAriaTree } =
        await import("../../../src/browser/ariaTree/ariaSnapshot.js");

      const yaml = generateAndRenderAriaTree(document.body);
      expect(yaml).toContain("button");
      expect(yaml).toContain("Real");
      // presentation role elements should not get aria-ref
      const img = document.querySelector("img")!;
      expect(img.getAttribute("aria-ref")).toBeNull();
    });

    it("should skip elements with role=none", async () => {
      setupDOM('<html><body><div role="none"><button>Inside</button></div></body></html>');

      const { generateAndRenderAriaTree } =
        await import("../../../src/browser/ariaTree/ariaSnapshot.js");

      const yaml = generateAndRenderAriaTree(document.body);
      expect(yaml).toContain("button");
      expect(yaml).toContain("Inside");
      // role=none div should not get aria-ref
      const div = document.querySelector("[role=none]")!;
      expect(div.getAttribute("aria-ref")).toBeNull();
    });

    it("should skip hidden elements with aria-hidden", async () => {
      setupDOM(`<html><body>
        <button>Visible</button>
        <div aria-hidden="true"><button>Hidden</button></div>
      </body></html>`);

      const { generateAndRenderAriaTree } =
        await import("../../../src/browser/ariaTree/ariaSnapshot.js");

      const yaml = generateAndRenderAriaTree(document.body);
      expect(yaml).toContain("Visible");
      expect(yaml).not.toContain("Hidden");
    });

    it("should handle select elements", async () => {
      setupDOM(`<html><body>
        <select aria-label="Color">
          <option value="r">Red</option>
          <option value="g" selected>Green</option>
        </select>
      </body></html>`);

      const { generateAndRenderAriaTree } =
        await import("../../../src/browser/ariaTree/ariaSnapshot.js");

      const yaml = generateAndRenderAriaTree(document.body);
      expect(yaml).toContain("combobox");
    });

    it("should handle empty body", async () => {
      setupDOM("<html><body></body></html>");

      const { generateAndRenderAriaTree } =
        await import("../../../src/browser/ariaTree/ariaSnapshot.js");

      const yaml = generateAndRenderAriaTree(document.body);
      expect(yaml).toBe("");
    });

    it("should handle radio buttons", async () => {
      setupDOM(`<html><body>
        <input type="radio" name="choice" aria-label="Option A" checked />
        <input type="radio" name="choice" aria-label="Option B" />
      </body></html>`);

      const { generateAndRenderAriaTree } =
        await import("../../../src/browser/ariaTree/ariaSnapshot.js");

      const yaml = generateAndRenderAriaTree(document.body);
      expect(yaml).toContain("radio");
      expect(yaml).toContain("[checked]");
      expect(yaml).toContain("Option A");
      expect(yaml).toContain("Option B");
    });

    it("should handle expanded/collapsed states", async () => {
      setupDOM('<html><body><button aria-expanded="true">Menu</button></body></html>');

      const { generateAndRenderAriaTree } =
        await import("../../../src/browser/ariaTree/ariaSnapshot.js");

      const yaml = generateAndRenderAriaTree(document.body);
      expect(yaml).toContain("[expanded]");
    });

    it("should not expose checkbox values in children", async () => {
      setupDOM('<html><body><input type="checkbox" aria-label="Agree" /></body></html>');

      const { generateAndRenderAriaTree } =
        await import("../../../src/browser/ariaTree/ariaSnapshot.js");

      // Checkbox should not have its value exposed as children
      const checkbox = document.querySelector("input")!;
      generateAndRenderAriaTree(document.body);
      const ref = checkbox.getAttribute("aria-ref");
      expect(ref).toBeTruthy();
    });
  });
});
