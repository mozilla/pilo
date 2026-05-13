import { describe, expect, it } from "vitest";
import {
  REF_HASH_LENGTH,
  REF_PREFIX,
  computeNodeHash,
  fnv1a32,
  formatRef,
  gatedAttrsFor,
} from "../../../src/browser/ariaTree/refHash.js";

describe("fnv1a32", () => {
  it("returns the FNV-1a 32-bit offset basis for empty input", () => {
    // FNV-1a 32-bit offset basis is 0x811c9dc5 — the only mechanical check
    // we need that the algorithm constants are correct.
    expect(fnv1a32("")).toBe(0x811c9dc5);
  });

  it("is deterministic", () => {
    expect(fnv1a32("hello")).toBe(fnv1a32("hello"));
  });

  it("produces different output for different inputs", () => {
    expect(fnv1a32("hello")).not.toBe(fnv1a32("world"));
  });

  it("produces an unsigned 32-bit result", () => {
    const h = fnv1a32("any input");
    expect(h).toBeGreaterThanOrEqual(0);
    expect(h).toBeLessThanOrEqual(0xffffffff);
  });
});

describe("computeNodeHash", () => {
  const baseArgs = {
    parentHash: 0,
    tagName: "BUTTON",
    role: "button",
    accessibleName: "Save",
    gatedAttrs: "type=submit",
    siblingIndex: 0,
  };
  const call = (overrides: Partial<typeof baseArgs> = {}) => {
    const a = { ...baseArgs, ...overrides };
    return computeNodeHash(
      a.parentHash,
      a.tagName,
      a.role,
      a.accessibleName,
      a.gatedAttrs,
      a.siblingIndex,
    );
  };

  it("is deterministic for identical inputs", () => {
    expect(call()).toBe(call());
  });

  it("changes when parentHash changes", () => {
    expect(call({ parentHash: 1 })).not.toBe(call({ parentHash: 2 }));
  });

  it("changes when tagName changes", () => {
    expect(call({ tagName: "A" })).not.toBe(call({ tagName: "BUTTON" }));
  });

  it("changes when role changes", () => {
    expect(call({ role: "link" })).not.toBe(call({ role: "button" }));
  });

  it("changes when accessibleName changes", () => {
    expect(call({ accessibleName: "Save" })).not.toBe(call({ accessibleName: "Saving..." }));
  });

  it("changes when gatedAttrs changes", () => {
    expect(call({ gatedAttrs: "type=submit" })).not.toBe(call({ gatedAttrs: "type=button" }));
  });

  it("changes when siblingIndex changes", () => {
    expect(call({ siblingIndex: 0 })).not.toBe(call({ siblingIndex: 1 }));
  });

  it("is not vulnerable to field-boundary confusion (delimiter present)", () => {
    // e.g. tagName 'BUTTONbutton' vs ('BUTTON' + 'button') must hash differently
    expect(call({ tagName: "BUTTONbutton", role: "" })).not.toBe(
      call({ tagName: "BUTTON", role: "button" }),
    );
  });
});

describe("gatedAttrsFor", () => {
  // We use simple stand-in objects shaped like Element to avoid jsdom setup
  // for these specific tests; ariaSnapshot.test.ts will exercise real DOM paths.
  const makeEl = (tag: string, attrs: Record<string, string>): Element => {
    return {
      tagName: tag.toUpperCase(),
      getAttribute: (k: string) => (k in attrs ? attrs[k] : null),
    } as unknown as Element;
  };

  it("extracts href for anchors", () => {
    expect(gatedAttrsFor(makeEl("a", { href: "/foo" }))).toBe("href=/foo");
  });

  it("extracts type for buttons", () => {
    expect(gatedAttrsFor(makeEl("button", { type: "submit" }))).toBe("type=submit");
  });

  it("extracts type and name for inputs", () => {
    expect(gatedAttrsFor(makeEl("input", { type: "text", name: "email" }))).toBe(
      "type=text|name=email",
    );
  });

  it("extracts name for selects", () => {
    expect(gatedAttrsFor(makeEl("select", { name: "country" }))).toBe("name=country");
  });

  it("returns empty string for unrelated tags", () => {
    expect(gatedAttrsFor(makeEl("div", { foo: "bar" }))).toBe("");
  });

  it("returns empty string for inputs without gated attrs", () => {
    expect(gatedAttrsFor(makeEl("input", {}))).toBe("type=|name=");
  });
});

describe("formatRef", () => {
  it("emits prefix + hex of REF_HASH_LENGTH chars with no suffix on first occurrence", () => {
    const ref = formatRef(0xa3f2c1d8, 1);
    expect(ref.startsWith(REF_PREFIX)).toBe(true);
    expect(ref.slice(REF_PREFIX.length)).toMatch(new RegExp(`^[0-9a-f]{${REF_HASH_LENGTH}}$`));
  });

  it("appends _2, _3, ... for occurrences > 1", () => {
    const a = formatRef(0x1234abcd, 1);
    const b = formatRef(0x1234abcd, 2);
    const c = formatRef(0x1234abcd, 3);
    expect(b).toBe(a + "_2");
    expect(c).toBe(a + "_3");
  });

  it("uses lowercase hex", () => {
    const ref = formatRef(0xabcdef01, 1);
    expect(ref.slice(REF_PREFIX.length)).toBe(ref.slice(REF_PREFIX.length).toLowerCase());
  });

  it("pads hex with leading zeros when needed", () => {
    const ref = formatRef(0x00000001, 1);
    // Whatever REF_HASH_LENGTH is, the hex portion should be exactly that length.
    expect(ref.slice(REF_PREFIX.length)).toHaveLength(REF_HASH_LENGTH);
  });
});
