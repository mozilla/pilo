/**
 * JSON.parse reviver function that converts ISO date strings to Date objects for 'timestamp' keys.
 *
 * @param key - The key being parsed
 * @param value - The value associated with the key
 * @returns A Date object if the key is 'timestamp' and value is not null/undefined, otherwise the original value
 */
export function reviver(key: string, value: unknown): unknown {
  if (key === "timestamp" && value != null) {
    const date = new Date(value);
    if (!isNaN(date.getTime())) {
      return date;
    }
    // If invalid, return the original value
    return value;
  }
  return value;
}
