/**
 * Interactive Mode Types
 *
 * Defines the contract between the agent and callers for requesting
 * user data during form interactions. The agent sends structured field
 * requests via a callback and blocks until the caller responds.
 */

/** A single form field the agent needs data for. */
export interface FormFieldRequest {
  /** Element ref from the accessibility tree (e.g., "E_a3f2") */
  ref: string;
  /** The field's visible label */
  label: string;
  /** Semantic field type */
  fieldType:
    | "text"
    | "email"
    | "phone"
    | "date"
    | "number"
    | "select"
    | "checkbox"
    | "radio"
    | "textarea"
    | "password"
    | "other";
  /** Whether this field must be filled */
  required: boolean;
  /** Available options for select/radio fields */
  options?: string[];
  /** Current value if already partially filled */
  currentValue?: string;
  /** Additional context (e.g., validation error message on re-request) */
  description?: string;
}

/** The request payload sent to the caller. */
export interface UserDataRequest {
  /** Unique ID for correlation */
  requestId: string;
  /** URL of the page containing the form */
  pageUrl: string;
  /** Title of the page */
  pageTitle: string;
  /** Human-readable description of the form's purpose */
  formDescription: string;
  /** The fields the agent needs data for */
  fields: FormFieldRequest[];
}

/** A single field value in the response. */
export interface FormFieldResponse {
  /** The ref from the request (for correlation) */
  ref: string;
  /** The value to fill */
  value: string;
}

/** The response payload from the caller. */
export interface UserDataResponse {
  /** Matches the requestId from the request */
  requestId: string;
  /** The field values provided by the user */
  fields: FormFieldResponse[];
  /** If true, the user wants to cancel/abort the task */
  cancelled?: boolean;
}

/** Callback function invoked when the agent needs user data for a form. */
export type UserDataCallback = (request: UserDataRequest) => Promise<UserDataResponse>;
