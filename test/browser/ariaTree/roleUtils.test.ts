import { describe, it, expect } from "vitest";
import { JSDOM, VirtualConsole } from "jsdom";

let dom: JSDOM;
let document: Document;

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
  (globalThis as any).HTMLButtonElement = dom.window.HTMLButtonElement;
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

describe("roleUtils", () => {
  describe("getAriaRole", () => {
    it("should return button role for button element", async () => {
      setupDOM("<html><body><button>Click</button></body></html>");
      const { getAriaRole, beginAriaCaches, endAriaCaches } =
        await import("../../../src/browser/ariaTree/roleUtils.js");

      beginAriaCaches();
      try {
        const button = document.querySelector("button")!;
        expect(getAriaRole(button)).toBe("button");
      } finally {
        endAriaCaches();
      }
    });

    it("should return link role for anchor with href", async () => {
      setupDOM('<html><body><a href="/page">Link</a></body></html>');
      const { getAriaRole, beginAriaCaches, endAriaCaches } =
        await import("../../../src/browser/ariaTree/roleUtils.js");

      beginAriaCaches();
      try {
        const link = document.querySelector("a")!;
        expect(getAriaRole(link)).toBe("link");
      } finally {
        endAriaCaches();
      }
    });

    it("should return null for anchor without href", async () => {
      setupDOM("<html><body><a>Not a link</a></body></html>");
      const { getAriaRole, beginAriaCaches, endAriaCaches } =
        await import("../../../src/browser/ariaTree/roleUtils.js");

      beginAriaCaches();
      try {
        const anchor = document.querySelector("a")!;
        expect(getAriaRole(anchor)).toBe(null);
      } finally {
        endAriaCaches();
      }
    });

    it("should return heading role for h1-h6", async () => {
      setupDOM("<html><body><h1>Title</h1><h2>Subtitle</h2></body></html>");
      const { getAriaRole, beginAriaCaches, endAriaCaches } =
        await import("../../../src/browser/ariaTree/roleUtils.js");

      beginAriaCaches();
      try {
        const h1 = document.querySelector("h1")!;
        const h2 = document.querySelector("h2")!;
        expect(getAriaRole(h1)).toBe("heading");
        expect(getAriaRole(h2)).toBe("heading");
      } finally {
        endAriaCaches();
      }
    });

    it("should return textbox role for text input", async () => {
      setupDOM('<html><body><input type="text" /></body></html>');
      const { getAriaRole, beginAriaCaches, endAriaCaches } =
        await import("../../../src/browser/ariaTree/roleUtils.js");

      beginAriaCaches();
      try {
        const input = document.querySelector("input")!;
        expect(getAriaRole(input)).toBe("textbox");
      } finally {
        endAriaCaches();
      }
    });

    it("should return checkbox role for checkbox input", async () => {
      setupDOM('<html><body><input type="checkbox" /></body></html>');
      const { getAriaRole, beginAriaCaches, endAriaCaches } =
        await import("../../../src/browser/ariaTree/roleUtils.js");

      beginAriaCaches();
      try {
        const input = document.querySelector("input")!;
        expect(getAriaRole(input)).toBe("checkbox");
      } finally {
        endAriaCaches();
      }
    });

    it("should return radio role for radio input", async () => {
      setupDOM('<html><body><input type="radio" /></body></html>');
      const { getAriaRole, beginAriaCaches, endAriaCaches } =
        await import("../../../src/browser/ariaTree/roleUtils.js");

      beginAriaCaches();
      try {
        const input = document.querySelector("input")!;
        expect(getAriaRole(input)).toBe("radio");
      } finally {
        endAriaCaches();
      }
    });

    it("should respect explicit role attribute", async () => {
      setupDOM('<html><body><div role="button">Fake button</div></body></html>');
      const { getAriaRole, beginAriaCaches, endAriaCaches } =
        await import("../../../src/browser/ariaTree/roleUtils.js");

      beginAriaCaches();
      try {
        const div = document.querySelector("div")!;
        expect(getAriaRole(div)).toBe("button");
      } finally {
        endAriaCaches();
      }
    });

    it("should return presentation role for role=presentation", async () => {
      // getAriaRole returns the role, presentation/none handling is elsewhere
      setupDOM('<html><body><img role="presentation" src="x.png" /></body></html>');
      const { getAriaRole, beginAriaCaches, endAriaCaches } =
        await import("../../../src/browser/ariaTree/roleUtils.js");

      beginAriaCaches();
      try {
        const img = document.querySelector("img")!;
        expect(getAriaRole(img)).toBe("presentation");
      } finally {
        endAriaCaches();
      }
    });

    it("should return img role for image with alt", async () => {
      setupDOM('<html><body><img alt="Photo" src="x.png" /></body></html>');
      const { getAriaRole, beginAriaCaches, endAriaCaches } =
        await import("../../../src/browser/ariaTree/roleUtils.js");

      beginAriaCaches();
      try {
        const img = document.querySelector("img")!;
        expect(getAriaRole(img)).toBe("img");
      } finally {
        endAriaCaches();
      }
    });
  });

  describe("getElementAccessibleName", () => {
    it("should get name from aria-label", async () => {
      setupDOM('<html><body><button aria-label="Submit form">Go</button></body></html>');
      const { getElementAccessibleName, beginAriaCaches, endAriaCaches } =
        await import("../../../src/browser/ariaTree/roleUtils.js");

      beginAriaCaches();
      try {
        const button = document.querySelector("button")!;
        expect(getElementAccessibleName(button, false)).toBe("Submit form");
      } finally {
        endAriaCaches();
      }
    });

    it("should get name from text content", async () => {
      setupDOM("<html><body><button>Click Me</button></body></html>");
      const { getElementAccessibleName, beginAriaCaches, endAriaCaches } =
        await import("../../../src/browser/ariaTree/roleUtils.js");

      beginAriaCaches();
      try {
        const button = document.querySelector("button")!;
        expect(getElementAccessibleName(button, false)).toBe("Click Me");
      } finally {
        endAriaCaches();
      }
    });

    it("should get name from aria-labelledby", async () => {
      setupDOM(`<html><body>
        <span id="label">Search</span>
        <input aria-labelledby="label" type="text" />
      </body></html>`);
      const { getElementAccessibleName, beginAriaCaches, endAriaCaches } =
        await import("../../../src/browser/ariaTree/roleUtils.js");

      beginAriaCaches();
      try {
        const input = document.querySelector("input")!;
        expect(getElementAccessibleName(input, false)).toBe("Search");
      } finally {
        endAriaCaches();
      }
    });

    it("should get name from label element", async () => {
      setupDOM(`<html><body>
        <label for="email">Email Address</label>
        <input id="email" type="text" />
      </body></html>`);
      const { getElementAccessibleName, beginAriaCaches, endAriaCaches } =
        await import("../../../src/browser/ariaTree/roleUtils.js");

      beginAriaCaches();
      try {
        const input = document.querySelector("input")!;
        expect(getElementAccessibleName(input, false)).toBe("Email Address");
      } finally {
        endAriaCaches();
      }
    });

    it("should get name from title attribute when no other name source", async () => {
      // Title is used for elements without other name sources (like img without alt)
      setupDOM('<html><body><img title="Tooltip text" src="x.png" /></body></html>');
      const { getElementAccessibleName, beginAriaCaches, endAriaCaches } =
        await import("../../../src/browser/ariaTree/roleUtils.js");

      beginAriaCaches();
      try {
        const img = document.querySelector("img")!;
        expect(getElementAccessibleName(img, false)).toBe("Tooltip text");
      } finally {
        endAriaCaches();
      }
    });

    it("should prefer text content over title for buttons", async () => {
      setupDOM('<html><body><button title="Tooltip text">Click Me</button></body></html>');
      const { getElementAccessibleName, beginAriaCaches, endAriaCaches } =
        await import("../../../src/browser/ariaTree/roleUtils.js");

      beginAriaCaches();
      try {
        const button = document.querySelector("button")!;
        expect(getElementAccessibleName(button, false)).toBe("Click Me");
      } finally {
        endAriaCaches();
      }
    });

    it("should get name from alt attribute on img", async () => {
      setupDOM('<html><body><img alt="Company logo" src="logo.png" /></body></html>');
      const { getElementAccessibleName, beginAriaCaches, endAriaCaches } =
        await import("../../../src/browser/ariaTree/roleUtils.js");

      beginAriaCaches();
      try {
        const img = document.querySelector("img")!;
        expect(getElementAccessibleName(img, false)).toBe("Company logo");
      } finally {
        endAriaCaches();
      }
    });

    it("should get name from placeholder on input", async () => {
      setupDOM('<html><body><input placeholder="Enter your name" /></body></html>');
      const { getElementAccessibleName, beginAriaCaches, endAriaCaches } =
        await import("../../../src/browser/ariaTree/roleUtils.js");

      beginAriaCaches();
      try {
        const input = document.querySelector("input")!;
        expect(getElementAccessibleName(input, false)).toBe("Enter your name");
      } finally {
        endAriaCaches();
      }
    });
  });

  describe("isElementHiddenForAria", () => {
    it("should return true for aria-hidden=true", async () => {
      setupDOM('<html><body><div aria-hidden="true">Hidden</div></body></html>');
      const { isElementHiddenForAria, beginAriaCaches, endAriaCaches } =
        await import("../../../src/browser/ariaTree/roleUtils.js");

      beginAriaCaches();
      try {
        const div = document.querySelector("div")!;
        expect(isElementHiddenForAria(div)).toBe(true);
      } finally {
        endAriaCaches();
      }
    });

    it("should return false for visible elements", async () => {
      setupDOM("<html><body><div>Visible</div></body></html>");
      const { isElementHiddenForAria, beginAriaCaches, endAriaCaches } =
        await import("../../../src/browser/ariaTree/roleUtils.js");

      beginAriaCaches();
      try {
        const div = document.querySelector("div")!;
        expect(isElementHiddenForAria(div)).toBe(false);
      } finally {
        endAriaCaches();
      }
    });

    it("should return true for script elements", async () => {
      setupDOM("<html><body><script>code</script></body></html>");
      const { isElementHiddenForAria, beginAriaCaches, endAriaCaches } =
        await import("../../../src/browser/ariaTree/roleUtils.js");

      beginAriaCaches();
      try {
        const script = document.querySelector("script")!;
        expect(isElementHiddenForAria(script)).toBe(true);
      } finally {
        endAriaCaches();
      }
    });

    it("should return true for style elements", async () => {
      setupDOM("<html><body><style>.x{}</style></body></html>");
      const { isElementHiddenForAria, beginAriaCaches, endAriaCaches } =
        await import("../../../src/browser/ariaTree/roleUtils.js");

      beginAriaCaches();
      try {
        const style = document.querySelector("style")!;
        expect(isElementHiddenForAria(style)).toBe(true);
      } finally {
        endAriaCaches();
      }
    });
  });

  describe("getAriaChecked", () => {
    it("should return true for checked checkbox", async () => {
      setupDOM('<html><body><input type="checkbox" checked /></body></html>');
      const { getAriaChecked, beginAriaCaches, endAriaCaches } =
        await import("../../../src/browser/ariaTree/roleUtils.js");

      beginAriaCaches();
      try {
        const input = document.querySelector("input")!;
        expect(getAriaChecked(input)).toBe(true);
      } finally {
        endAriaCaches();
      }
    });

    it("should return false for unchecked checkbox", async () => {
      setupDOM('<html><body><input type="checkbox" /></body></html>');
      const { getAriaChecked, beginAriaCaches, endAriaCaches } =
        await import("../../../src/browser/ariaTree/roleUtils.js");

      beginAriaCaches();
      try {
        const input = document.querySelector("input")!;
        expect(getAriaChecked(input)).toBe(false);
      } finally {
        endAriaCaches();
      }
    });

    it("should return mixed for aria-checked=mixed", async () => {
      setupDOM('<html><body><div role="checkbox" aria-checked="mixed">X</div></body></html>');
      const { getAriaChecked, beginAriaCaches, endAriaCaches } =
        await import("../../../src/browser/ariaTree/roleUtils.js");

      beginAriaCaches();
      try {
        const div = document.querySelector("div")!;
        expect(getAriaChecked(div)).toBe("mixed");
      } finally {
        endAriaCaches();
      }
    });

    it("should return true for indeterminate checkbox", async () => {
      setupDOM('<html><body><input type="checkbox" /></body></html>');
      const { getAriaChecked, beginAriaCaches, endAriaCaches } =
        await import("../../../src/browser/ariaTree/roleUtils.js");

      beginAriaCaches();
      try {
        const input = document.querySelector("input")! as HTMLInputElement;
        input.indeterminate = true;
        expect(getAriaChecked(input)).toBe("mixed");
      } finally {
        endAriaCaches();
      }
    });
  });

  describe("getAriaDisabled", () => {
    it("should return true for disabled button", async () => {
      setupDOM("<html><body><button disabled>Click</button></body></html>");
      const { getAriaDisabled, beginAriaCaches, endAriaCaches } =
        await import("../../../src/browser/ariaTree/roleUtils.js");

      beginAriaCaches();
      try {
        const button = document.querySelector("button")!;
        expect(getAriaDisabled(button)).toBe(true);
      } finally {
        endAriaCaches();
      }
    });

    it("should return true for aria-disabled=true on element with role", async () => {
      // aria-disabled only works on elements with supported roles
      setupDOM('<html><body><div role="button" aria-disabled="true">Disabled</div></body></html>');
      const { getAriaDisabled, beginAriaCaches, endAriaCaches } =
        await import("../../../src/browser/ariaTree/roleUtils.js");

      beginAriaCaches();
      try {
        const div = document.querySelector("div")!;
        expect(getAriaDisabled(div)).toBe(true);
      } finally {
        endAriaCaches();
      }
    });

    it("should return false for enabled elements", async () => {
      setupDOM("<html><body><button>Click</button></body></html>");
      const { getAriaDisabled, beginAriaCaches, endAriaCaches } =
        await import("../../../src/browser/ariaTree/roleUtils.js");

      beginAriaCaches();
      try {
        const button = document.querySelector("button")!;
        expect(getAriaDisabled(button)).toBe(false);
      } finally {
        endAriaCaches();
      }
    });

    it("should return false for aria-disabled on element without supported role", async () => {
      // Plain div without role doesn't support aria-disabled
      setupDOM('<html><body><div aria-disabled="true">Disabled</div></body></html>');
      const { getAriaDisabled, beginAriaCaches, endAriaCaches } =
        await import("../../../src/browser/ariaTree/roleUtils.js");

      beginAriaCaches();
      try {
        const div = document.querySelector("div")!;
        expect(getAriaDisabled(div)).toBe(false);
      } finally {
        endAriaCaches();
      }
    });
  });

  describe("getAriaExpanded", () => {
    it("should return true for aria-expanded=true", async () => {
      setupDOM('<html><body><button aria-expanded="true">Menu</button></body></html>');
      const { getAriaExpanded, beginAriaCaches, endAriaCaches } =
        await import("../../../src/browser/ariaTree/roleUtils.js");

      beginAriaCaches();
      try {
        const button = document.querySelector("button")!;
        expect(getAriaExpanded(button)).toBe(true);
      } finally {
        endAriaCaches();
      }
    });

    it("should return false for aria-expanded=false", async () => {
      setupDOM('<html><body><button aria-expanded="false">Menu</button></body></html>');
      const { getAriaExpanded, beginAriaCaches, endAriaCaches } =
        await import("../../../src/browser/ariaTree/roleUtils.js");

      beginAriaCaches();
      try {
        const button = document.querySelector("button")!;
        expect(getAriaExpanded(button)).toBe(false);
      } finally {
        endAriaCaches();
      }
    });

    it("should return true for open details element", async () => {
      setupDOM(
        "<html><body><details open><summary>Toggle</summary>Content</details></body></html>",
      );
      const { getAriaExpanded, beginAriaCaches, endAriaCaches } =
        await import("../../../src/browser/ariaTree/roleUtils.js");

      beginAriaCaches();
      try {
        const details = document.querySelector("details")!;
        expect(getAriaExpanded(details)).toBe(true);
      } finally {
        endAriaCaches();
      }
    });

    it("should return false for closed details element", async () => {
      setupDOM("<html><body><details><summary>Toggle</summary>Content</details></body></html>");
      const { getAriaExpanded, beginAriaCaches, endAriaCaches } =
        await import("../../../src/browser/ariaTree/roleUtils.js");

      beginAriaCaches();
      try {
        const details = document.querySelector("details")!;
        expect(getAriaExpanded(details)).toBe(false);
      } finally {
        endAriaCaches();
      }
    });
  });

  describe("getAriaLevel", () => {
    it("should return level for h1-h6", async () => {
      setupDOM("<html><body><h1>Title</h1><h2>Subtitle</h2><h3>Section</h3></body></html>");
      const { getAriaLevel, beginAriaCaches, endAriaCaches } =
        await import("../../../src/browser/ariaTree/roleUtils.js");

      beginAriaCaches();
      try {
        expect(getAriaLevel(document.querySelector("h1")!)).toBe(1);
        expect(getAriaLevel(document.querySelector("h2")!)).toBe(2);
        expect(getAriaLevel(document.querySelector("h3")!)).toBe(3);
      } finally {
        endAriaCaches();
      }
    });

    it("should return aria-level attribute value", async () => {
      setupDOM('<html><body><div role="heading" aria-level="4">Custom</div></body></html>');
      const { getAriaLevel, beginAriaCaches, endAriaCaches } =
        await import("../../../src/browser/ariaTree/roleUtils.js");

      beginAriaCaches();
      try {
        const div = document.querySelector("div")!;
        expect(getAriaLevel(div)).toBe(4);
      } finally {
        endAriaCaches();
      }
    });
  });

  describe("getAriaSelected", () => {
    it("should return true for selected option", async () => {
      setupDOM(`<html><body>
        <select><option selected>Chosen</option></select>
      </body></html>`);
      const { getAriaSelected, beginAriaCaches, endAriaCaches } =
        await import("../../../src/browser/ariaTree/roleUtils.js");

      beginAriaCaches();
      try {
        const option = document.querySelector("option")!;
        expect(getAriaSelected(option)).toBe(true);
      } finally {
        endAriaCaches();
      }
    });

    it("should return true for aria-selected=true", async () => {
      setupDOM('<html><body><div role="option" aria-selected="true">Selected</div></body></html>');
      const { getAriaSelected, beginAriaCaches, endAriaCaches } =
        await import("../../../src/browser/ariaTree/roleUtils.js");

      beginAriaCaches();
      try {
        const div = document.querySelector("div")!;
        expect(getAriaSelected(div)).toBe(true);
      } finally {
        endAriaCaches();
      }
    });
  });
});
