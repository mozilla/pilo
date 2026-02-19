/**
 * SnapshotCompressor Module
 *
 * Dedicated service for compressing accessibility tree snapshots.
 * Reduces snapshot size by 60-80% through:
 * - Semantic transformations (aria to concise equivalents)
 * - Noise filtering (removing unnecessary prefixes)
 * - Content deduplication (replacing repeated text)
 *
 * This is a pure functional module with no side effects,
 * making it easy to test and optimize independently.
 */

export interface CompressionResult {
  compressed: string;
  originalSize: number;
  compressedSize: number;
  compressionRatio: number;
  stats?: {
    linesRemoved: number;
    transformationsApplied: number;
    duplicatesRemoved: number;
  };
}

export interface CompressionConfig {
  transformations?: Array<{ pattern: RegExp; replacement: string }>;
  filteredPrefixes?: string[];
  enableDeduplication?: boolean;
}

export class SnapshotCompressor {
  private readonly transformations: Array<{ pattern: RegExp; replacement: string }>;
  private readonly filteredPrefixes: string[];
  private readonly enableDeduplication: boolean;

  constructor(config: CompressionConfig = {}) {
    // Default transformations for aria tree compression
    this.transformations = config.transformations || [
      { pattern: /^listitem/g, replacement: "li" },
      { pattern: /^link/g, replacement: "a" },
      { pattern: /^text: (.*?)$/g, replacement: '"$1"' },
      { pattern: /^heading "([^"]+)" \[level=(\d+)\]/g, replacement: 'h$2 "$1"' },
    ];

    // Default prefixes to filter out
    this.filteredPrefixes = config.filteredPrefixes || ["/url:"];

    // Enable deduplication by default
    this.enableDeduplication = config.enableDeduplication ?? true;
  }

  /**
   * Compress an accessibility tree snapshot
   * @param snapshot - Raw snapshot from browser
   * @returns Compressed snapshot with metrics
   */
  compress(snapshot: string): string {
    const lines = snapshot.split("\n");

    // Step 1: Basic cleanup and filtering
    let processed = lines
      .map((line) => line.trim())
      .map((line) => line.replace(/^- /, ""))
      .filter((line) => !this.shouldFilterLine(line));

    // Step 2: Apply transformations
    processed = processed.map((line) => this.applyTransformations(line));

    // Step 3: Remove empty lines
    processed = processed.filter(Boolean);

    // Step 4: Deduplicate if enabled
    if (this.enableDeduplication) {
      const result = this.deduplicate(processed);
      processed = result.lines;
    }

    const compressed = processed.join("\n");
    return compressed;
  }

  /**
   * Get detailed compression metrics
   * @param snapshot - Raw snapshot from browser
   * @returns Compression result with detailed metrics
   */
  compressWithMetrics(snapshot: string): CompressionResult {
    const lines = snapshot.split("\n");
    const originalSize = snapshot.length;
    let duplicatesRemoved = 0;

    // Step 1: Basic cleanup and filtering
    let processed = lines
      .map((line) => line.trim())
      .map((line) => line.replace(/^- /, ""))
      .filter((line) => !this.shouldFilterLine(line));

    const linesRemoved = lines.length - processed.length;

    // Step 2: Apply transformations
    processed = processed.map((line) => this.applyTransformations(line));

    // Step 3: Remove empty lines
    processed = processed.filter(Boolean);

    // Step 4: Deduplicate if enabled
    if (this.enableDeduplication) {
      const result = this.deduplicate(processed);
      processed = result.lines;
      duplicatesRemoved = result.duplicateCount;
    }

    const compressed = processed.join("\n");
    const compressedSize = compressed.length;
    const compressionRatio = originalSize > 0 ? 1 - compressedSize / originalSize : 0;

    return {
      compressed,
      originalSize,
      compressedSize,
      compressionRatio,
      stats: {
        linesRemoved,
        transformationsApplied: this.transformations.length,
        duplicatesRemoved,
      },
    };
  }

  /**
   * Check if a line should be filtered out
   */
  private shouldFilterLine(line: string): boolean {
    return this.filteredPrefixes.some((prefix) => line.startsWith(prefix));
  }

  /**
   * Apply all transformations to a line
   */
  private applyTransformations(line: string): string {
    return this.transformations.reduce(
      (result, { pattern, replacement }) => result.replace(pattern, replacement),
      line,
    );
  }

  /**
   * Deduplicate repeated content
   */
  private deduplicate(lines: string[]): { lines: string[]; duplicateCount: number } {
    let lastQuotedText = "";
    let duplicateCount = 0;

    const dedupedLines = lines.map((line) => {
      const match = line.match(/^([^"]*)"([^"]+)"(.*)$/);
      if (!match) return line;

      const [, prefix, quotedText, suffix] = match;

      // If this text is identical to the previous line's text, replace with reference
      if (quotedText === lastQuotedText) {
        duplicateCount++;
        return `${prefix}[same as above]${suffix}`;
      }

      lastQuotedText = quotedText;
      return line;
    });

    return { lines: dedupedLines, duplicateCount };
  }

  /**
   * Add a custom transformation
   */
  addTransformation(pattern: RegExp, replacement: string): void {
    this.transformations.push({ pattern, replacement });
  }

  /**
   * Add a filtered prefix
   */
  addFilteredPrefix(prefix: string): void {
    this.filteredPrefixes.push(prefix);
  }

  /**
   * Get current configuration
   */
  getConfig(): CompressionConfig {
    return {
      transformations: [...this.transformations],
      filteredPrefixes: [...this.filteredPrefixes],
      enableDeduplication: this.enableDeduplication,
    };
  }
}
