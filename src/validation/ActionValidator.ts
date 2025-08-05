import { PageAction } from "../browser/ariaBrowser.js";
import { Action } from "../schemas.js";

/**
 * Handles validation of actions and their parameters
 */
export class ActionValidator {
  private currentPageSnapshot: string = "";

  /**
   * Updates the current page snapshot for reference validation
   */
  updatePageSnapshot(snapshot: string): void {
    this.currentPageSnapshot = snapshot;
  }

  /**
   * Validates that a required string field exists and is non-empty
   */
  private validateRequiredStringField(obj: any, fieldName: string, errors: string[]): void {
    const value = obj?.[fieldName];
    if (typeof value !== "string" || !value.trim()) {
      errors.push(`Missing or empty required field "${fieldName}"`);
    }
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
   * Validates the complete action response structure
   */
  validateActionResponse(response: any): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    this.validateRequiredStringField(response, "observation", errors);
    this.validateRequiredStringField(response, "observationStatusMessage", errors);
    this.validateRequiredStringField(response, "actionStatusMessage", errors);

    if (!response.action || typeof response.action !== "object") {
      errors.push('Missing or invalid "action" field - must be an object');
      return { isValid: false, errors };
    }

    const actionErrors = this.validateActionObject(response.action);
    errors.push(...actionErrors);

    return {
      isValid: errors.length === 0,
      errors,
    };
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
}
