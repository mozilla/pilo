/**
 * Validator Module
 *
 * Handles CONTEXT validation - checking if actions make sense given the current page.
 * Schema validation (required fields, types) is handled by AI SDK via zod schemas.
 *
 * Context validation includes:
 * - Does the ref exist on the current page?
 * - Is the wait time reasonable?
 * - Is the task actually complete?
 *
 * Also includes simple feedback utility for adding error messages to conversation.
 */

import { generateText, LanguageModel } from "ai";
import { buildTaskValidationPrompt } from "./prompts.js";
import { validationTools } from "./schemas.js";
import { tryJSONParse } from "./utils/jsonParser.js";

export interface TaskCompletionCheck {
  isComplete: boolean;
  feedback?: string;
}

export class Validator {
  /**
   * Check if action is valid IN CONTEXT of current page
   * Schema validation already handled by AI SDK
   *
   * @param action - The action to validate
   * @param pageSnapshot - The current page snapshot
   * @returns Error message if invalid, null if valid
   */
  checkAction(action: any, pageSnapshot: string): string | null {
    // Only validate context, not schema
    // AI SDK already validated that required fields exist and have correct types

    // Check if ref exists on page (for actions that use refs)
    if (action.ref && !this.isRefValid(action.ref, pageSnapshot)) {
      return `Can't find ref "${action.ref}" on the page. Pick a valid ref from the snapshot.`;
    }

    // Special validations for specific action types
    switch (action.type) {
      case "wait":
        // Check if seconds is reasonable (context validation)
        const seconds = action.seconds || parseInt(action.value || "0");
        if (seconds > 30) {
          return "Wait time too long. Use a shorter wait time.";
        }
        break;
    }

    return null; // Context is valid
  }

  /**
   * Check if ref exists in snapshot
   * @param ref - The ref to check
   * @param snapshot - The page snapshot
   * @returns True if ref exists, false otherwise
   */
  private isRefValid(ref: string, snapshot: string): boolean {
    // Check for both [ref=xxx] and [xxx] formats
    return snapshot.includes(`[ref=${ref}]`) || snapshot.includes(`[${ref}]`);
  }

  /**
   * Check task completion via AI
   * @param task - The original task
   * @param result - The proposed result
   * @param provider - The language model to use
   * @returns Whether the task is complete and any feedback
   */
  async checkTaskComplete(
    task: string,
    result: string,
    provider: LanguageModel,
  ): Promise<TaskCompletionCheck> {
    let response;

    try {
      response = await generateText({
        model: provider,
        prompt: buildTaskValidationPrompt(task, result, ""),
        tools: validationTools,
        toolChoice: { type: "tool", toolName: "validate_task" },
        maxTokens: 1000,
      });
    } catch (error) {
      // If the error is due to malformed JSON from repeated responses, try to extract and parse
      if (error instanceof Error && error.message.includes("JSON")) {
        // Try to extract the JSON from the error message if it's included
        const errorText = error.message;
        const jsonMatch = errorText.match(/Text:\s*({.*})/s);

        if (jsonMatch) {
          const parsed = tryJSONParse(jsonMatch[1]);

          if (parsed) {
            // Single warning when we recover from malformed JSON
            console.warn("Corrected malformed validation response from error message");

            // Create a mock response with the parsed data
            response = {
              toolCalls: [
                {
                  toolCallId: "validate_task_recovery",
                  toolName: "validate_task",
                  args: parsed,
                },
              ],
            };
          }
        }
      }

      // If we couldn't recover, re-throw the error
      if (!response) {
        throw error;
      }
    }

    // Check for valid tool call
    if (!response.toolCalls || response.toolCalls.length === 0) {
      throw new Error("No valid tool call in validation response");
    }

    const validation = response.toolCalls[0].args as any;
    const isComplete =
      validation.completionQuality === "complete" || validation.completionQuality === "excellent";

    return {
      isComplete,
      feedback: !isComplete ? validation.feedback || undefined : undefined,
    };
  }

  /**
   * Add feedback message to conversation
   * Adds as tool result if responding to a tool call, otherwise as user message
   * @param messages - The conversation messages array
   * @param feedback - The feedback message to add
   */
  giveFeedback(messages: any[], feedback: string): void {
    // Check if the last message contains a tool call we need to respond to
    const lastMessage = messages[messages.length - 1];

    if (lastMessage?.role === "assistant" && lastMessage?.toolCalls?.length > 0) {
      // Add as tool result message for the most recent tool call
      const toolCall = lastMessage.toolCalls[0];
      messages.push({
        role: "tool",
        content: [
          {
            type: "tool-result",
            toolCallId: toolCall.toolCallId,
            toolName: toolCall.toolName,
            result: feedback,
          },
        ],
      });
    } else {
      // Fallback to user message if no tool call to respond to
      messages.push({
        role: "user",
        content: feedback,
      });
    }
  }
}
