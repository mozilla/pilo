/**
 * RepetitionValidator - Handles AI repetition/looping issues in function calls
 *
 * Common issue where AI generates the same JSON object multiple times:
 * {"foo":"bar"}{"foo":"bar"}{"foo":"bar"} instead of {"foo":"bar"}
 *
 * This validator detects and recovers from such repetition by extracting
 * the first valid JSON object and discarding the duplicates.
 */

export interface RepetitionValidationResult {
  isValid: boolean;
  cleanedResponse: any;
  wasRepeated: boolean;
  feedbackMessage?: string;
}

export class RepetitionValidator {
  /**
   * Validates and cleans AI responses that may contain repeated JSON
   * Works at the tool call level before JSON parsing occurs
   */
  validateAndCleanToolCalls(response: any): RepetitionValidationResult {
    if (!response.toolCalls || response.toolCalls.length === 0) {
      return {
        isValid: true,
        cleanedResponse: response,
        wasRepeated: false,
      };
    }

    let wasRepeated = false;
    const cleanedToolCalls = response.toolCalls.map((toolCall: any) => {
      if (typeof toolCall.args === "string") {
        const cleanResult = this.cleanRepeatedJsonString(toolCall.args);
        if (cleanResult.wasRepeated) {
          wasRepeated = true;
          return { ...toolCall, args: cleanResult.cleanedJson };
        }
      }
      return toolCall;
    });

    return {
      isValid: true,
      cleanedResponse: { ...response, toolCalls: cleanedToolCalls },
      wasRepeated,
      feedbackMessage: wasRepeated
        ? "⚠️ You repeated the same function call multiple times. Call each function exactly once with proper JSON arguments."
        : undefined,
    };
  }

  /**
   * Detects and extracts the first valid JSON object from a repeated JSON string
   * Example: {"a":1}{"a":1}{"a":1} -> {"a":1}
   */
  cleanRepeatedJsonString(jsonString: string): { cleanedJson: string; wasRepeated: boolean } {
    // Check for signs of repetition
    if (!jsonString.includes('}{"') && !jsonString.includes("}{")) {
      return { cleanedJson: jsonString, wasRepeated: false };
    }

    console.warn("🔄 Detected repeated JSON, attempting recovery");

    // Find the first complete JSON object using brace counting
    let braceCount = 0;
    let firstObjectEnd = -1;

    for (let i = 0; i < jsonString.length; i++) {
      if (jsonString[i] === "{") braceCount++;
      else if (jsonString[i] === "}") {
        braceCount--;
        if (braceCount === 0) {
          firstObjectEnd = i + 1;
          break;
        }
      }
    }

    if (firstObjectEnd > 0) {
      const firstObject = jsonString.substring(0, firstObjectEnd);
      try {
        JSON.parse(firstObject); // Validate it's valid JSON
        console.warn(
          `✅ Successfully recovered from repeated JSON (${jsonString.length} -> ${firstObject.length} chars)`,
        );
        return { cleanedJson: firstObject, wasRepeated: true };
      } catch (error) {
        console.warn("❌ Could not parse extracted JSON object");
      }
    }

    // If we can't recover, return original
    console.warn("❌ Could not recover from repeated JSON");
    return { cleanedJson: jsonString, wasRepeated: false };
  }
}
