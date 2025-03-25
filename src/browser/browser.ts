import { ActionResult } from "../pageCapture.js";

/**
 * Browser interface for web automation
 */
export interface Browser {
  /**
   * Launch the browser
   */
  launch(options?: any): Promise<void>;

  /**
   * Close the browser
   */
  close(): Promise<void>;

  /**
   * Navigate to a URL
   */
  goto(url: string): Promise<void>;

  /**
   * Evaluate a function in the browser context
   */
  evaluate<T>(fn: Function, ...args: any[]): Promise<T>;

  /**
   * Add a script tag to the page
   */
  addScriptTag(options: { content?: string }): Promise<void>;

  /**
   * Wait for a specific load state
   */
  waitForLoadState(state: string, options?: any): Promise<void>;

  /**
   * Navigate back to the previous page
   */
  goBack(): Promise<void>;

  /**
   * Get the current URL
   */
  getCurrentUrl(): Promise<string>;

  /**
   * Wait for a selector to be available
   */
  waitForSelector(selector: string, options?: any): Promise<void>;

  /**
   * Perform an action on an element
   */
  performAction(
    selector: string,
    action: string,
    value?: string
  ): Promise<ActionResult>;
}
