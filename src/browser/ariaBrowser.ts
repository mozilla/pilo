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
  Extract = "extract",
  Done = "done",
  Abort = "abort",
}

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
