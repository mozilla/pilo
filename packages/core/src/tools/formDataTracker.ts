/**
 * FormDataTracker
 *
 * Tracks which form field refs have been sourced via requestFormData().
 * Used by fill/select/check/uncheck tools to enforce that form data
 * is sourced from the user before filling.
 *
 * Scoped per-page: call clear() on each new page load since refs
 * are only valid for the current page.
 */
export class FormDataTracker {
  private sourcedFields = new Map<string, string>();

  /** Record that a field ref has been sourced with a value from requestFormData */
  sourceField(ref: string, value: string): void {
    this.sourcedFields.set(ref, value);
  }

  /** Check if a field ref has been sourced via requestFormData */
  isFieldSourced(ref: string): boolean {
    return this.sourcedFields.has(ref);
  }

  /** Clear all sourced fields. Call on page navigation since refs become stale. */
  clear(): void {
    this.sourcedFields.clear();
  }
}
