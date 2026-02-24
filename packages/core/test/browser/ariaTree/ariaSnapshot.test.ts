import { describe, it, expect } from "vitest";
import { JSDOM, VirtualConsole } from "jsdom";

// We test the ariaSnapshot module by importing it directly and running in jsdom.
// NOTE: jsdom lacks a layout engine, so getBoundingClientRect() returns 0x0 rects.
// This means elements aren't considered "visible" by the box check, so refs won't
// appear in YAML output. However, data-pilo-ref attributes ARE set on the DOM elements.
// We test both: YAML structure (roles, names, hierarchy) and ref assignment via DOM.

let dom: JSDOM;
let document: Document;

// Suppress jsdom's "Not implemented" warnings for getComputedStyle with pseudo-elements.
// These are expected — jsdom has no layout engine, which is why elements report as 0x0.
const virtualConsole = new VirtualConsole();

function setupDOM(html: string) {
  dom = new JSDOM(html, { url: "http://localhost", virtualConsole });
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

    it("should only set data-pilo-ref on visible interactable elements", async () => {
      // jsdom has no layout engine — getBoundingClientRect() returns 0x0 —
      // so elements are not considered visible/interactable.
      // data-pilo-ref should NOT be set in jsdom because refs are only assigned
      // to elements that pass nodeReceivesPointerEvents (visible + pointer events).
      setupDOM(`<html><body>
        <button id="btn1">First</button>
        <button id="btn2">Second</button>
        <button id="btn3">Third</button>
      </body></html>`);

      const { generateAndRenderAriaTree } =
        await import("../../../src/browser/ariaTree/ariaSnapshot.js");

      generateAndRenderAriaTree(document.body);

      // In jsdom, no elements are visible so no data-pilo-ref should be set
      for (const id of ["btn1", "btn2", "btn3"]) {
        const el = document.getElementById(id)!;
        expect(el.getAttribute("data-pilo-ref")).toBeNull();
      }
    });

    it("should clean up previous data-pilo-ref and data-pilo-role attributes", async () => {
      setupDOM(
        '<html><body><button id="btn" data-pilo-ref="old-ref" data-pilo-role="button">Click</button></body></html>',
      );

      const { generateAndRenderAriaTree } =
        await import("../../../src/browser/ariaTree/ariaSnapshot.js");

      generateAndRenderAriaTree(document.body);

      // Old attributes should be removed (new ones won't be set since jsdom has no layout)
      const btn = document.getElementById("btn")!;
      expect(btn.getAttribute("data-pilo-ref")).toBeNull();
      expect(btn.getAttribute("data-pilo-role")).toBeNull();
    });

    it("should accept a counter parameter for cross-frame numbering", async () => {
      // In jsdom, no elements are visible so counter won't advance.
      // This test verifies the counter parameter is accepted without error.
      setupDOM("<html><body><button>A</button></body></html>");

      const { generateAndRenderAriaTree } =
        await import("../../../src/browser/ariaTree/ariaSnapshot.js");

      const counter = { value: 100 };
      generateAndRenderAriaTree(document.body, counter);

      // Counter stays at 100 since no elements are visible in jsdom
      expect(counter.value).toBe(100);
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

    it("should not set data-pilo-ref in jsdom (no layout engine)", async () => {
      // data-pilo-ref is only set on visible/interactable elements.
      // In jsdom, getBoundingClientRect returns 0x0 so no elements qualify.
      setupDOM(`<html><body>
        <button id="btn1">First</button>
        <button id="btn2">Second</button>
      </body></html>`);

      const { generateAndRenderAriaTree } =
        await import("../../../src/browser/ariaTree/ariaSnapshot.js");

      generateAndRenderAriaTree(document.body);

      // No data-pilo-ref attributes should exist
      const refsFound = document.querySelectorAll("[data-pilo-ref]");
      expect(refsFound.length).toBe(0);
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
      // presentation role elements should not get data-pilo-ref
      const img = document.querySelector("img")!;
      expect(img.getAttribute("data-pilo-ref")).toBeNull();
    });

    it("should skip elements with role=none", async () => {
      setupDOM('<html><body><div role="none"><button>Inside</button></div></body></html>');

      const { generateAndRenderAriaTree } =
        await import("../../../src/browser/ariaTree/ariaSnapshot.js");

      const yaml = generateAndRenderAriaTree(document.body);
      expect(yaml).toContain("button");
      expect(yaml).toContain("Inside");
      // role=none div should not get data-pilo-ref
      const div = document.querySelector("[role=none]")!;
      expect(div.getAttribute("data-pilo-ref")).toBeNull();
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

      const yaml = generateAndRenderAriaTree(document.body);
      // Checkbox role should be present but no value text exposed
      expect(yaml).toContain("checkbox");
    });
  });

  describe("applySetOfMarks / removeSetOfMarks", () => {
    it("should create a container element with the correct id", async () => {
      setupDOM(`<html><body>
        <button data-pilo-ref="E1">Click</button>
      </body></html>`);

      const { applySetOfMarks } = await import("../../../src/browser/ariaTree/ariaSnapshot.js");

      applySetOfMarks();

      const container = document.getElementById("__pilo-som-container");
      expect(container).not.toBeNull();
    });

    it("should set pointer-events: none and high z-index on container", async () => {
      setupDOM(`<html><body>
        <button data-pilo-ref="E1">Click</button>
      </body></html>`);

      const { applySetOfMarks } = await import("../../../src/browser/ariaTree/ariaSnapshot.js");

      applySetOfMarks();

      const container = document.getElementById("__pilo-som-container")!;
      expect(container.style.pointerEvents).toBe("none");
      expect(container.style.zIndex).toBe("2147483647");
    });

    it("should remove the container via removeSetOfMarks", async () => {
      setupDOM(`<html><body>
        <button data-pilo-ref="E1">Click</button>
      </body></html>`);

      const { applySetOfMarks, removeSetOfMarks } =
        await import("../../../src/browser/ariaTree/ariaSnapshot.js");

      applySetOfMarks();
      expect(document.getElementById("__pilo-som-container")).not.toBeNull();

      removeSetOfMarks();
      expect(document.getElementById("__pilo-som-container")).toBeNull();
    });

    it("should be safe to call removeSetOfMarks when no marks exist", async () => {
      setupDOM(`<html><body><button>Click</button></body></html>`);

      const { removeSetOfMarks } = await import("../../../src/browser/ariaTree/ariaSnapshot.js");

      // Should not throw
      expect(() => removeSetOfMarks()).not.toThrow();
    });

    it("should detect contenteditable elements as interactive", async () => {
      setupDOM(`<html><body>
        <div contenteditable="true" data-pilo-ref="E1">Editable</div>
        <div contenteditable="" data-pilo-ref="E2">Also editable</div>
        <div data-pilo-ref="E3">Not editable</div>
      </body></html>`);

      const { isInteractiveElement } =
        await import("../../../src/browser/ariaTree/ariaSnapshot.js");

      const els = document.querySelectorAll("[data-pilo-ref]");
      expect(isInteractiveElement(els[0])).toBe(true); // contenteditable="true"
      expect(isInteractiveElement(els[1])).toBe(true); // contenteditable=""
      expect(isInteractiveElement(els[2])).toBe(false); // plain div
    });

    it("should handle multi-value role attributes", async () => {
      setupDOM(`<html><body>
        <div role="switch checkbox" data-pilo-ref="E1">Toggle</div>
        <div role="presentation button" data-pilo-ref="E2">Fallback</div>
        <div role="presentation none" data-pilo-ref="E3">Non-interactive</div>
      </body></html>`);

      const { isInteractiveElement } =
        await import("../../../src/browser/ariaTree/ariaSnapshot.js");

      const els = document.querySelectorAll("[data-pilo-ref]");
      expect(isInteractiveElement(els[0])).toBe(true); // switch and checkbox both match
      expect(isInteractiveElement(els[1])).toBe(true); // button matches
      expect(isInteractiveElement(els[2])).toBe(false); // neither matches
    });

    it("should detect elements with tabindex >= 0 as interactive", async () => {
      setupDOM(`<html><body>
        <div tabindex="0" data-pilo-ref="E1">Focusable</div>
        <div tabindex="-1" data-pilo-ref="E2">Not focusable</div>
        <div tabindex="0" role="button" data-pilo-role="button" data-pilo-ref="E3">Already has role</div>
        <div data-pilo-ref="E4">No tabindex</div>
      </body></html>`);

      const { isInteractiveElement } =
        await import("../../../src/browser/ariaTree/ariaSnapshot.js");

      const els = document.querySelectorAll("[data-pilo-ref]");
      expect(isInteractiveElement(els[0])).toBe(true); // tabindex=0, no role
      expect(isInteractiveElement(els[1])).toBe(false); // tabindex=-1
      expect(isInteractiveElement(els[2])).toBe(true); // has button role (matched by role check)
      expect(isInteractiveElement(els[3])).toBe(false); // no tabindex, no role
    });

    it("should use data-pilo-role for computed role detection", async () => {
      setupDOM(`<html><body>
        <table><tr>
          <td data-pilo-role="gridcell" data-pilo-ref="E1">Cell</td>
          <th data-pilo-role="columnheader" data-pilo-ref="E2">Header</th>
        </tr></table>
        <div data-pilo-role="generic" data-pilo-ref="E3">Generic</div>
      </body></html>`);

      const { isInteractiveElement } =
        await import("../../../src/browser/ariaTree/ariaSnapshot.js");

      const els = document.querySelectorAll("[data-pilo-ref]");
      expect(isInteractiveElement(els[0])).toBe(true); // gridcell
      expect(isInteractiveElement(els[1])).toBe(true); // columnheader
      expect(isInteractiveElement(els[2])).toBe(false); // generic
    });

    it("should not mark DETAILS as interactive (only SUMMARY)", async () => {
      setupDOM(`<html><body>
        <details data-pilo-ref="E1"><summary data-pilo-ref="E2">Toggle</summary>Content</details>
      </body></html>`);

      const { isInteractiveElement } =
        await import("../../../src/browser/ariaTree/ariaSnapshot.js");

      const els = document.querySelectorAll("[data-pilo-ref]");
      expect(isInteractiveElement(els[0])).toBe(false); // details
      expect(isInteractiveElement(els[1])).toBe(true); // summary
    });

    it("should only create marks for elements with data-pilo-ref attributes", async () => {
      setupDOM(`<html><body>
        <button data-pilo-ref="E1">Has ref</button>
        <button>No ref</button>
      </body></html>`);

      const { applySetOfMarks } = await import("../../../src/browser/ariaTree/ariaSnapshot.js");

      applySetOfMarks();

      const container = document.getElementById("__pilo-som-container")!;
      // In jsdom, getBoundingClientRect returns 0x0, so no marks will be rendered
      // for any elements. This is expected behavior - marks are skipped for
      // invisible elements. The test verifies the container still gets created.
      expect(container).not.toBeNull();
    });
  });
});
