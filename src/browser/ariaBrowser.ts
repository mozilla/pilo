/**
 * Interface for browser automation focused on accessibility tree interaction
 */
export interface AriaBrowser {
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

  /** Returns the accessible text content of the current page */
  getText(): Promise<string>;

  /** Captures and returns a screenshot of the current page */
  getScreenshot(): Promise<Buffer>;

  /**
   * Performs an action on an element in the accessibility tree.
   * @param ref A reference baked into the accessibility tree (from getText output)
   * @param action The action to perform (e.g., "click", "type")
   * @param value Optional value for actions like typing
   */
  performAction(ref: string, action: string, value?: string): Promise<void>;

  /**
   * Waits for a specific load state of the page
   * @param state The load state to wait for (e.g., "networkidle", "domcontentloaded")
   * @param options Additional options like timeout
   */
  waitForLoadState(
    state: "networkidle" | "domcontentloaded" | "load",
    options?: { timeout?: number }
  ): Promise<void>;
}
