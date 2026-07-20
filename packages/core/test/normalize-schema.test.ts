import { describe, expect, it } from "vitest";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
// The script is a .cjs CLI that also exports its pure transform.
const { normalizeSchema } = require("../scripts/normalize-schema.cjs") as {
  normalizeSchema: (schema: unknown) => unknown;
};

/**
 * ts-json-schema-generator emits internal alias definition names derived from
 * source *position* (e.g. `alias-1623388915-2282-2347-1623388915-0-228060`).
 * Two mutually-recursive aliases here mimic the AI SDK's JSONValue type.
 * Building a schema with a given position-hash lets us prove normalization
 * is stable when the hash churns on unrelated dependency bumps.
 */
function buildSchema(hash: string, offset: string) {
  const valueAlias = `alias-${hash}-2027-2282-${hash}-0-${offset}133205725`;
  const objectAlias = `alias-${hash}-2282-2347-${hash}-0-${offset}`;
  return {
    $ref: `#/definitions/${objectAlias}`,
    definitions: {
      [valueAlias]: {
        description: "A JSON value.",
        anyOf: [
          { type: "null" },
          { type: "string" },
          { $ref: `#/definitions/${objectAlias}` },
          { type: "array", items: { $ref: `#/definitions/${valueAlias}` } },
        ],
      },
      [objectAlias]: {
        additionalProperties: { $ref: `#/definitions/${valueAlias}` },
        type: "object",
      },
    },
  };
}

describe("normalizeSchema", () => {
  it("converts deprecated string annotations to boolean + description", () => {
    const result = normalizeSchema({
      type: "object",
      properties: {
        old: { type: "string", deprecated: "use new instead" },
      },
    }) as any;
    expect(result.properties.old.deprecated).toBe(true);
    expect(result.properties.old.description).toContain("use new instead");
  });

  it("produces identical output when only the generator's position-hash changes", () => {
    // Same logical schema, different volatile position hashes.
    const a = normalizeSchema(buildSchema("1623388915", "228060"));
    const b = normalizeSchema(buildSchema("1270300533", "234984"));
    expect(JSON.stringify(a)).toEqual(JSON.stringify(b));
  });

  it("renames volatile alias names to stable content-derived names", () => {
    const result = normalizeSchema(buildSchema("1623388915", "228060")) as any;
    const names = Object.keys(result.definitions);
    // No volatile multi-segment numeric alias names should remain.
    expect(names.some((n) => /^alias-\d+(-\d+)+$/.test(n))).toBe(false);
    // Every $ref must resolve to a defined name (no dangling refs after rename).
    const refs = JSON.stringify(result).match(/#\/definitions\/([^"]+)/g) ?? [];
    for (const ref of refs) {
      const name = ref.replace("#/definitions/", "");
      expect(names).toContain(name);
    }
  });

  it("keeps distinct alias shapes as distinct definitions", () => {
    const result = normalizeSchema(buildSchema("1623388915", "228060")) as any;
    expect(Object.keys(result.definitions)).toHaveLength(2);
  });
});
