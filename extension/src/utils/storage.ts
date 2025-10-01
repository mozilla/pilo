/**
 * JSON.parse reviver function that converts ISO date strings to Date objects for 'timestamp' keys.
 *
 * This function is designed to work with JSON.parse and Zustand's createJSONStorage.
 * While it accepts `unknown`, it will only receive valid JSON values at runtime:
 * string, number, boolean, null, objects, or arrays.
 *
 * @param key - The key being parsed
 * @param value - The value associated with the key (will be a valid JSON value at runtime)
 * @returns A Date object if the key is 'timestamp' and value is not null/undefined, otherwise the original value
 */
export function reviver(key: string, value: unknown): unknown {
  if (
    key === "timestamp" &&
    value != null &&
    (typeof value === "string" || typeof value === "number")
  ) {
    // At runtime, value will be string or number from JSON
    //
    // XXX There is still code in the codebase that uses numbers for
    // timestamps. We should either refactor all code to use ISO date
    // strings for timestamps (more readable), or standardize on using
    // numbers everywhere (more performant).
    const date = new Date(value as string | number);
    if (!isNaN(date.getTime())) {
      return date;
    }
    // If invalid, return the original value
    return value;
  }
  return value;
}
