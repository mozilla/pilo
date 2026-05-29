/**
 * Interface for browser automation focused on accessibility tree interaction
 */

/**
 * Available actions that can be performed on a page
 */
export enum PageAction {
  // Element interactions
  Click = "click",
  Hover = "hover",
  Fill = "fill",
  Focus = "focus",
  Check = "check",
  Uncheck = "uncheck",
  Select = "select",
  Enter = "enter",

  // Navigation and workflow
  Wait = "wait",
  Goto = "goto",
  Back = "back",
  Forward = "forward",
  Scroll = "scroll",
  Extract = "extract",
  Done = "done",
  Abort = "abort",
}

/**
 * Scroll directions supported by {@link PageAction.Scroll}.
 * - `up` / `down`: scroll one viewport in that direction
 * - `top` / `bottom`: scroll all the way to the top/bottom of the document
 */
export type ScrollDirection = "up" | "down" | "top" | "bottom";
export const SCROLL_DIRECTIONS: ScrollDirection[] = ["up", "down", "top", "bottom"];

/**
 * Page load states to wait for
 */
export enum LoadState {
  NetworkIdle = "networkidle",
  DOMContentLoaded = "domcontentloaded",
  Load = "load",
}

/**
 * Limited interface for temporary tab operations.
 * Used for "side quest" operations like search that shouldn't affect main page state.
 */
export interface TemporaryTab {
  /** Navigates to the specified URL */
  goto(url: string): Promise<void>;
  /** Returns the page content as clean markdown */
  getMarkdown(): Promise<string>;
  /** Waits for a specific load state */
  waitForLoadState(state: LoadState, options?: { timeout?: number }): Promise<void>;
}

export interface FieldMetadata {
  ref: string;
  tagName: string;
  inputType: string | null;
  role: string | null;
  name: string | null;
  label: string | null;
  placeholder: string | null;
  autocomplete: string | null;
  isContentEditable: boolean;
  formId: string | null;
  formAction: string | null;
  formMethod: string | null;
}

export interface FormFieldState {
  ref: string | null;
  name: string | null;
  tagName: string;
  inputType: string | null;
  autocomplete: string | null;
}

export interface FormSubmissionContext {
  submitterRef: string;
  formId: string | null;
  actionUrl: string | null;
  submitterActionUrl: string | null;
  method: string | null;
  fields: FormFieldState[];
}

export type FormSubmissionTrigger = "click" | "enter";

export interface AriaBrowser {
  /** The name of the browser being used */
  browserName: string;

  /** Starts the browser instance */
  start(): Promise<void>;

  /** Shuts down the browser instance */
  shutdown(): Promise<void>;

  /** Navigates to the specified URL */
  goto(url: string): Promise<void>;

  /** Navigates back in the browser history */
  goBack(): Promise<void>;

  /** Navigates forward in the browser history */
  goForward(): Promise<void>;

  /** Returns the current page URL */
  getUrl(): Promise<string>;

  /** Returns the title of the current page */
  getTitle(): Promise<string>;

  /** Returns the accessible tree with refs as YAML string */
  getTreeWithRefs(): Promise<string>;

  /** Returns the page content as clean markdown */
  getMarkdown(): Promise<string>;

  /** Captures and returns a screenshot of the current page */
  getScreenshot(options?: { withMarks?: boolean }): Promise<Buffer>;

  /**
   * Performs an action on an element in the accessibility tree.
   * @param ref A reference baked into the accessibility tree (from getText output)
   * @param action The action to perform
   * @param value Optional value for actions like typing
   */
  performAction(ref: string, action: PageAction, value?: string): Promise<void>;

  /** Returns structural metadata for an element ref used in form/action policy checks. */
  getFieldMetadata(ref: string): Promise<FieldMetadata>;

  /** Returns the form that would be submitted by activating this ref, if any. */
  getFormSubmissionContext(
    ref: string,
    trigger?: FormSubmissionTrigger,
  ): Promise<FormSubmissionContext | null>;

  /**
   * Look up element identity (role + accessible name) for a ref from the
   * most recent ariaTree snapshot. Returns null if the ref is unknown.
   * Used by the repetition detector to distinguish logical targets when
   * the ref string itself churns between snapshots.
   */
  getRefIdentity(ref: string): Promise<{ role: string; name: string } | null>;

  /**
   * Waits for a specific load state of the page
   * @param state The load state to wait for
   * @param options Additional options like timeout
   */
  waitForLoadState(state: LoadState, options?: { timeout?: number }): Promise<void>;

  /**
   * Runs a function in an temporary tab, then closes it.
   * Main page state is preserved. Useful for "side quest" operations like search.
   * @param fn Function to execute in the temporary tab
   * @returns The result of the function
   */
  runInTemporaryTab<T>(fn: (tab: TemporaryTab) => Promise<T>): Promise<T>;
}
