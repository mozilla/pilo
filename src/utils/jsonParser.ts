/**
 * JSON Parser Utility
 *
 * Handles parsing JSON from AI model responses that may contain
 * repeated or malformed JSON objects (common with smaller models).
 */

/**
 * Try to parse JSON with fallback strategies
 *
 * Strategy 1: Direct JSON.parse
 * Strategy 2: Extract first JSON object by counting braces
 * Strategy 3: Return null if all strategies fail
 *
 * @param text - The text that may contain JSON
 * @returns Parsed JSON object or null if parsing fails
 */
export function tryJSONParse(text: string): any | null {
  if (!text || typeof text !== "string") {
    return null;
  }

  // Strategy 1: Try direct parsing
  try {
    const result = JSON.parse(text);
    return result;
  } catch (e) {
    // Continue to fallback strategies
  }

  // Strategy 2: Extract first JSON object by counting braces
  try {
    const extracted = extractFirstJSONObject(text);
    if (extracted) {
      const result = JSON.parse(extracted);
      // Log only when we successfully recover from malformed JSON
      console.warn("Corrected malformed JSON response by extracting first valid object");
      return result;
    }
  } catch (e) {
    // Continue to next strategy
  }

  // All strategies failed
  return null;
}

/**
 * Extract the first complete JSON object from a string
 * by counting opening and closing braces
 *
 * @param text - Text that may contain one or more JSON objects
 * @returns The first complete JSON object string, or null if none found
 */
function extractFirstJSONObject(text: string): string | null {
  // Find the first opening brace
  const startIndex = text.indexOf("{");
  if (startIndex === -1) {
    return null;
  }

  let braceCount = 0;
  let inString = false;
  let escapeNext = false;

  for (let i = startIndex; i < text.length; i++) {
    const char = text[i];

    // Handle escape sequences
    if (escapeNext) {
      escapeNext = false;
      continue;
    }

    if (char === "\\") {
      escapeNext = true;
      continue;
    }

    // Handle strings (where braces don't count)
    if (char === '"' && !escapeNext) {
      inString = !inString;
      continue;
    }

    // Only count braces outside of strings
    if (!inString) {
      if (char === "{") {
        braceCount++;
      } else if (char === "}") {
        braceCount--;

        // We've found a complete JSON object
        if (braceCount === 0) {
          return text.substring(startIndex, i + 1);
        }
      }
    }
  }

  // No complete JSON object found
  return null;
}

/**
 * Parse JSON from tool call arguments that may be malformed
 * Specifically handles cases where models repeat the JSON response
 *
 * @param toolCall - The tool call object from the AI SDK
 * @returns The parsed arguments or an empty object if parsing fails
 */
export function parseToolCallArgs(toolCall: any): any {
  const argsField = toolCall.input;

  // If already an object, return it
  if (argsField && typeof argsField === "object") {
    return argsField;
  }

  // If string, try to parse it
  if (argsField && typeof argsField === "string") {
    const parsed = tryJSONParse(argsField);
    return parsed || {};
  }

  // Check for raw input string in other properties
  if (toolCall.inputText) {
    const parsed = tryJSONParse(toolCall.inputText);
    return parsed || {};
  }

  return {};
}
