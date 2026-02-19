import { describe, it, expect } from "vitest";
import { SnapshotCompressor } from "../src/snapshotCompressor.js";

describe("SnapshotCompressor", () => {
  describe("compress", () => {
    it("should transform listitem to li", () => {
      const compressor = new SnapshotCompressor();
      const result = compressor.compress('- listitem "Item 1"');
      expect(result).toBe('li "Item 1"');
    });

    it("should transform link to a", () => {
      const compressor = new SnapshotCompressor();
      const result = compressor.compress('- link "Home"');
      expect(result).toBe('a "Home"');
    });

    it("should transform text nodes to quoted strings", () => {
      const compressor = new SnapshotCompressor();
      const result = compressor.compress("- text: Hello world");
      expect(result).toBe('"Hello world"');
    });

    it("should transform headings to h1/h2 format", () => {
      const compressor = new SnapshotCompressor();
      const result = compressor.compress('- heading "Title" [level=1]');
      expect(result).toBe('h1 "Title"');
    });

    it("should filter out /url: prefixed lines", () => {
      const compressor = new SnapshotCompressor();
      const snapshot = `- link "Home"
  /url: https://example.com
- link "About"`;
      const result = compressor.compress(snapshot);
      expect(result).not.toContain("/url:");
      expect(result).toContain('a "Home"');
      expect(result).toContain('a "About"');
    });

    it("should preserve ref= prefix in refs", () => {
      const compressor = new SnapshotCompressor();
      const snapshot = '- button "Click" [ref=E1] [cursor=pointer]';
      const result = compressor.compress(snapshot);
      expect(result).toContain("[ref=E1]");
      expect(result).toContain("[cursor=pointer]");
    });

    it("should preserve ref= in multiple refs across lines", () => {
      const compressor = new SnapshotCompressor();
      const snapshot = `- button "Submit" [ref=E1]
- button "Cancel" [ref=E2]
- link "Help" [ref=E3]`;
      const result = compressor.compress(snapshot);
      expect(result).toContain("[ref=E1]");
      expect(result).toContain("[ref=E2]");
      expect(result).toContain("[ref=E3]");
    });

    it("should deduplicate consecutive identical quoted text", () => {
      const compressor = new SnapshotCompressor();
      const snapshot = `- link "Repeated"
- link "Repeated"
- link "Different"`;
      const result = compressor.compress(snapshot);
      expect(result).toContain('a "Repeated"');
      expect(result).toContain("[same as above]");
      expect(result).toContain('a "Different"');
    });

    it("should not deduplicate non-consecutive identical text", () => {
      const compressor = new SnapshotCompressor();
      const snapshot = `- link "Alpha"
- link "Beta"
- link "Alpha"`;
      const result = compressor.compress(snapshot);
      const lines = result.split("\n");
      // Both Alpha lines should be preserved (not consecutive)
      expect(lines.filter((l) => l.includes('"Alpha"')).length).toBe(2);
    });

    it("should remove empty lines", () => {
      const compressor = new SnapshotCompressor();
      const snapshot = `- button "A"

- button "B"`;
      const result = compressor.compress(snapshot);
      expect(result).not.toContain("\n\n");
    });

    it("should strip leading - from lines", () => {
      const compressor = new SnapshotCompressor();
      const result = compressor.compress('- button "Go"');
      expect(result).toBe('button "Go"');
    });

    it("should handle empty input", () => {
      const compressor = new SnapshotCompressor();
      const result = compressor.compress("");
      expect(result).toBe("");
    });
  });

  describe("compressWithMetrics", () => {
    it("should return compression metrics", () => {
      const compressor = new SnapshotCompressor();
      const snapshot = `- link "Home"
  /url: https://example.com
- link "About"`;
      const result = compressor.compressWithMetrics(snapshot);
      expect(result.originalSize).toBe(snapshot.length);
      expect(result.compressedSize).toBeLessThan(result.originalSize);
      expect(result.compressionRatio).toBeGreaterThan(0);
      expect(result.stats?.linesRemoved).toBeGreaterThan(0);
    });

    it("should count deduplicated lines", () => {
      const compressor = new SnapshotCompressor();
      const snapshot = `- link "Same"
- link "Same"
- link "Same"`;
      const result = compressor.compressWithMetrics(snapshot);
      expect(result.stats?.duplicatesRemoved).toBe(2);
    });
  });

  describe("configuration", () => {
    it("should allow disabling deduplication", () => {
      const compressor = new SnapshotCompressor({ enableDeduplication: false });
      const snapshot = `- link "Same"
- link "Same"`;
      const result = compressor.compress(snapshot);
      expect(result).not.toContain("[same as above]");
    });

    it("should allow custom transformations", () => {
      const compressor = new SnapshotCompressor({
        transformations: [{ pattern: /^button/g, replacement: "btn" }],
      });
      const result = compressor.compress('- button "Go"');
      expect(result).toBe('btn "Go"');
    });

    it("should allow custom filtered prefixes", () => {
      const compressor = new SnapshotCompressor({
        filteredPrefixes: ["/custom:"],
      });
      const snapshot = `- button "A"
/custom: data
- button "B"`;
      const result = compressor.compress(snapshot);
      expect(result).not.toContain("/custom:");
    });

    it("should return config via getConfig", () => {
      const compressor = new SnapshotCompressor();
      const config = compressor.getConfig();
      expect(config.transformations).toHaveLength(4);
      expect(config.filteredPrefixes).toEqual(["/url:"]);
      expect(config.enableDeduplication).toBe(true);
    });

    it("should allow adding transformations at runtime", () => {
      const compressor = new SnapshotCompressor();
      compressor.addTransformation(/^navigation/g, "nav");
      const result = compressor.compress('- navigation "Main"');
      expect(result).toBe('nav "Main"');
    });

    it("should allow adding filtered prefixes at runtime", () => {
      const compressor = new SnapshotCompressor();
      compressor.addFilteredPrefix("/extra:");
      const snapshot = `/extra: something
- button "A"`;
      const result = compressor.compress(snapshot);
      expect(result).not.toContain("/extra:");
      expect(result).toContain('button "A"');
    });
  });
});
