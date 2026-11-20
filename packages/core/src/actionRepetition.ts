/** Exclude automatically changing ARIA regions and per-snapshot element refs. */
function normalizeSnapshot(snapshot: string): string {
  const lines: string[] = [];
  let ignoredIndent: number | undefined;
  for (const line of snapshot.split("\n")) {
    if (!line.trim()) continue;
    const indent = line.length - line.trimStart().length;
    if (ignoredIndent !== undefined) {
      if (indent > ignoredIndent) continue;
      ignoredIndent = undefined;
    }
    // These roles describe autonomous updates, not progress caused by a click.
    if (/^\s*-\s*['"]?(?:timer|marquee)(?=\s|:|['"]?$)/.test(line)) {
      ignoredIndent = indent;
      continue;
    }
    lines.push(line.replace(/ \[ref=[^\]\r\n]+\]/g, "").trimEnd());
  }
  return lines.join("\n");
}

/** Tracks repeated actions against the page states already visited by that action. */
export class ActionRepetitionTracker {
  private action?: string;
  private pageState?: string;
  private visitedStates = new Set<string>();
  private repeats = 0;

  recordSnapshot(url: string, snapshot: string): void {
    // Refs are regenerated on every snapshot; they do not describe page progress.
    const normalized = normalizeSnapshot(snapshot);
    // Two small independent accumulators avoid retaining entire snapshots.
    // This is a progress heuristic, not a security digest.
    const state = `${url}\n${normalized}`;
    let first = 2166136261;
    let second = 5381;
    for (let i = 0; i < state.length; i++) {
      const code = state.charCodeAt(i);
      first = Math.imul(first ^ code, 16777619);
      second = Math.imul(second, 33) ^ code;
    }
    this.pageState = `${state.length}:${first >>> 0}:${second >>> 0}`;
  }

  observe(action: string, allowPageProgress: boolean): number {
    if (this.action !== action) {
      this.action = action;
      this.visitedStates.clear();
      this.repeats = 0;
    } else if (
      allowPageProgress &&
      this.pageState !== undefined &&
      !this.visitedStates.has(this.pageState)
    ) {
      // A newly observed state is progress; revisiting an old state is not.
      this.repeats = 0;
    } else {
      this.repeats++;
    }
    if (allowPageProgress && this.pageState !== undefined) this.visitedStates.add(this.pageState);
    return this.repeats;
  }

  reset(): void {
    this.action = undefined;
    this.pageState = undefined;
    this.visitedStates.clear();
    this.repeats = 0;
  }
}
