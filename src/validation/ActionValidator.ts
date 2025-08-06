import { PageAction } from "../browser/ariaBrowser.js";
import { Action } from "../schemas.js";
import { buildFunctionCallErrorPrompt } from "../prompts.js";
import { RepetitionValidator } from "./RepetitionValidator.js";

/**
 * Response structure from AI function calling
 */
type ToolCallResponse = {
  toolCalls?: Array<{ toolName: string; args: Record<string, any> }>;
  text?: string;
  reasoning?: string;
  finishReason?: string;
  usage?: any;
  warnings?: any;
  providerMetadata?: any;
};

/**
 * Result from validating and parsing a ToolCallResponse
 */
export interface FunctionCallValidationResult {
  isValid: boolean;
  errors: string[];
  action?: Action;
  feedbackMessage?: string;
}

/**
 * Handles validation of actions and their parameters
 */
export class ActionValidator {
  private currentPageSnapshot: string = "";
  private repetitionValidator: RepetitionValidator;

  constructor() {
    this.repetitionValidator = new RepetitionValidator();
  }

  /**
   * Updates the current page snapshot for reference validation
   */
  updatePageSnapshot(snapshot: string): void {
    this.currentPageSnapshot = snapshot;
  }

  /**
   * Validates aria reference by checking if it exists in the current page snapshot
   */
  validateAriaRef(ref: string): { isValid: boolean; error?: string } {
    if (!ref?.trim()) {
      return { isValid: false, error: "Aria ref cannot be empty" };
    }

    const trimmedRef = ref.trim();

    if (!this.currentPageSnapshot) {
      return { isValid: false, error: "Cannot validate ref: no page snapshot available" };
    }

    const refExists = this.currentPageSnapshot.includes(`[ref=${trimmedRef}]`);

    if (refExists) {
      return { isValid: true };
    }

    return {
      isValid: false,
      error: `Reference "${trimmedRef}" not found on current page. Please use a valid ref from the page snapshot.`,
    };
  }

  /**
   * Validates the action object structure and requirements
   */
  private validateActionObject(action: any): string[] {
    const errors: string[] = [];

    if (!action.action?.trim()) {
      errors.push('Missing or empty "action.action" field');
      return errors;
    }

    const actionType = action.action;

    const validActions = Object.values(PageAction);
    if (!validActions.includes(actionType)) {
      errors.push(`Invalid action type "${actionType}". Valid actions: ${validActions.join(", ")}`);
      return errors;
    }

    const actionsRequiringRef = [
      PageAction.Click,
      PageAction.Hover,
      PageAction.Fill,
      PageAction.Focus,
      PageAction.Check,
      PageAction.Uncheck,
      PageAction.Select,
      PageAction.Enter,
      PageAction.FillAndEnter,
    ];
    const actionsRequiringValue = [
      PageAction.Fill,
      PageAction.FillAndEnter,
      PageAction.Select,
      PageAction.Wait,
      PageAction.Done,
      PageAction.Goto,
      PageAction.Extract,
    ];
    const actionsProhibitingRefAndValue = [PageAction.Back, PageAction.Forward];

    if (actionsRequiringRef.includes(actionType)) {
      if (!action.ref || typeof action.ref !== "string") {
        errors.push(`Action "${actionType}" requires a "ref" field`);
      } else {
        const { isValid, error } = this.validateAriaRef(action.ref);
        if (!isValid && error) {
          errors.push(`Invalid ref for "${actionType}" action: ${error}`);
        }
      }
    }

    if (actionsRequiringValue.includes(actionType)) {
      if (actionType === PageAction.Wait) {
        if (
          action.value === undefined ||
          action.value === null ||
          action.value === "" ||
          isNaN(Number(action.value))
        ) {
          errors.push('Action "wait" requires a numeric "value" field (seconds to wait)');
        }
      } else {
        if (!action.value?.trim()) {
          errors.push(`Action "${actionType}" requires a non-empty "value" field`);
        }
      }
    }

    if (actionsProhibitingRefAndValue.includes(actionType)) {
      const hasRef = action.ref !== undefined && action.ref !== null && action.ref !== "";
      const hasValue = action.value !== undefined && action.value !== null && action.value !== "";
      if (hasRef || hasValue) {
        errors.push(`Action "${actionType}" should not have "ref" or "value" fields`);
      }
    }

    return errors;
  }

  /**
   * Validates function call action for basic requirements
   */
  validateFunctionCallAction(action: Action): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!action.action?.action) {
      errors.push("Missing action");
      return { isValid: false, errors };
    }

    const actionErrors = this.validateActionObject(action.action);
    errors.push(...actionErrors);

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  /**
   * Detects and handles AI repetition/looping in tool call arguments using RepetitionValidator
   * Returns the cleaned arguments and whether repetition was detected
   */
  private handleRepeatedToolCallArguments(toolArgs: any): {
    args: any;
    wasRepeated: boolean;
    feedbackMessage?: string;
  } {
    if (typeof toolArgs === "string") {
      const cleanResult = this.repetitionValidator.cleanRepeatedJsonString(toolArgs);
      if (cleanResult.wasRepeated) {
        try {
          const args = JSON.parse(cleanResult.cleanedJson);
          return {
            args,
            wasRepeated: true,
            feedbackMessage:
              "⚠️ You repeated the same function call multiple times. Call each function exactly once with proper JSON arguments.",
          };
        } catch (parseError) {
          // Could not parse cleaned JSON, return original
          return { args: toolArgs, wasRepeated: false };
        }
      }
    }

    return { args: toolArgs, wasRepeated: false };
  }

  /**
   * Validates and parses a ToolCallResponse into an Action
   * Handles all function call validation logic in one place
   */
  validateAndParseToolCallResponse(response: ToolCallResponse): FunctionCallValidationResult {
    // Check if any function calls were provided
    if (!response.toolCalls || response.toolCalls.length === 0) {
      const reasoningText = response.text || response.reasoning || "No reasoning provided";
      return {
        isValid: false,
        errors: ["No function call found in response"],
        feedbackMessage: buildFunctionCallErrorPrompt(reasoningText),
      };
    }

    // Warn about multiple function calls but use the first one
    if (response.toolCalls.length > 1) {
      console.warn(
        `⚠️  Multiple tool calls detected (${response.toolCalls.length}), using only the first one`,
      );
    }

    // Parse the function call into an Action
    const toolCall = response.toolCalls[0];

    // Handle potential repetition in tool call arguments
    const { args: cleanedArgs, feedbackMessage } = this.handleRepeatedToolCallArguments(
      toolCall.args,
    );
    const cleanedToolCall = { ...toolCall, args: cleanedArgs };

    try {
      const action = this.parseFunctionCallToAction(cleanedToolCall, response);

      // If repetition was detected, include feedback message
      let resultFeedbackMessage = feedbackMessage;

      // Validate the parsed action
      const validationResult = this.validateFunctionCallAction(action);

      if (!validationResult.isValid) {
        return {
          isValid: false,
          errors: validationResult.errors,
          action,
          feedbackMessage: resultFeedbackMessage,
        };
      }

      return {
        isValid: true,
        errors: [],
        action,
        feedbackMessage: resultFeedbackMessage,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        isValid: false,
        errors: [errorMessage],
      };
    }
  }

  /**
   * Parses a function call into an Action object
   * Handles the mapping from function call arguments to Action format
   */
  private parseFunctionCallToAction(
    toolCall: { toolName: string; args: Record<string, any> },
    response: ToolCallResponse,
  ): Action {
    const functionName = toolCall.toolName;
    const action = functionName as PageAction;

    // Convert arguments to the expected format based on function type
    let ref: string | undefined;
    let value: string | undefined;

    switch (functionName) {
      case "click":
      case "hover":
      case "check":
      case "uncheck":
      case "focus":
      case "enter":
        ref = (toolCall.args as { ref: string }).ref;
        break;
      case "fill":
      case "fill_and_enter":
      case "select":
        ref = (toolCall.args as { ref: string; value: string }).ref;
        value = (toolCall.args as { ref: string; value: string }).value;
        break;
      case "wait":
        value = String((toolCall.args as { seconds: number }).seconds);
        break;
      case "goto":
        value = (toolCall.args as { url: string }).url;
        break;
      case "extract":
        value = (toolCall.args as { description: string }).description;
        break;
      case "done":
        value = (toolCall.args as { result: string }).result;
        break;
      case "back":
      case "forward":
        // No args needed
        break;
      default:
        throw new Error(`Unhandled function: ${functionName}`);
    }

    // Use the reasoning text if available, otherwise fall back to regular text
    const thinkingText = response.reasoning ?? response.text ?? "Function call executed";

    return {
      observation: thinkingText,
      observationStatusMessage: "Action planned",
      action: {
        action,
        ref,
        value,
      },
      actionStatusMessage: "Executing action",
    };
  }
}
