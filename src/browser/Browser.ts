import { SimplifierConfig, SimplifierResult, ActionResult } from "../types";

/**
 * Browser interface that abstracts browser interactions
 * for both WebAgent and DOM simplification
 */
export interface Browser {
  // Browser initialization and management
  launch(options?: any): Promise<void>;
  close(): Promise<void>;

  // Basic page operations
  goto(url: string): Promise<void>;
  evaluate<T>(fn: Function, ...args: any[]): Promise<T>;
  addScriptTag(options: { content?: string }): Promise<void>;
  waitForLoadState(state: string, options?: any): Promise<void>;
  goBack(): Promise<void>;
  getCurrentUrl(): Promise<string>;
  waitForSelector(selector: string, options?: any): Promise<void>;

  // DOM simplifier functionality
  simplifyDOM(
    selector: string,
    config?: Partial<SimplifierConfig>
  ): Promise<SimplifierResult>;
  performAction(
    selector: string,
    action: string,
    value?: string
  ): Promise<ActionResult>;
}
