import TurndownService from "turndown";
import {
  AriaBrowser,
  PageAction,
  LoadState,
  TemporaryTab,
  SearchPageOptions,
  SearchPageResult,
  SearchPageMatch,
  FindElementsOptions,
  FindElementsResult,
  FindElementsMatch,
  type FieldMetadata,
  type FormSubmissionContext,
  type FormSubmissionTrigger,
} from "./ariaBrowser.js";
import { BiDiConnection } from "./bidiConnection.js";
import { ARIA_TREE_SCRIPT } from "./ariaTree/bundle.js";
import { BrowserActionException, InvalidRefException } from "../errors.js";
import { withSpan, SpanStatusCode, SpanName } from "../telemetry/tracing.js";

const PAGE_SETTLE_TIME_MS = 1000;
const NETWORKIDLE_DELAY_MS = 500;

export interface BiDiBrowserOptions {
  /** WebDriver BiDi WebSocket URL (can be provided later in start()) */
  bidiUrl?: string;
  /** Timeout for browser actions in milliseconds (default: 30000) */
  actionTimeoutMs?: number;
}

/**
 * Unwraps a WebDriver BiDi typed value to its JavaScript equivalent.
 * e.g. {type: "string", value: "hello"} → "hello"
 */
export function unwrapBiDiValue(val: unknown): unknown {
  if (typeof val !== "object" || val === null) return val;
  const typed = val as Record<string, unknown>;
  switch (typed.type) {
    case "string":
    case "number":
    case "boolean":
      return typed.value;
    case "null":
      return null;
    case "undefined":
      return undefined;
    default:
      return val;
  }
}

/**
 * BiDiBrowser — AriaBrowser implementation using WebDriver BiDi protocol.
 */
export class BiDiBrowser implements AriaBrowser {
  public readonly browserName: string = "bidi";

  protected connection: BiDiConnection;
  protected currentContext: string | null = null;

  private readonly actionTimeoutMs: number;
  private bidiUrl: string | undefined;
  protected turndown: TurndownService;

  constructor(options: BiDiBrowserOptions = {}) {
    this.bidiUrl = options.bidiUrl;
    this.actionTimeoutMs = options.actionTimeoutMs ?? 30_000;
    this.turndown = new TurndownService({
      headingStyle: "atx",
      codeBlockStyle: "fenced",
      emDelimiter: "_",
      strongDelimiter: "**",
    });
    // BiDiConnection requires a URL at construction time; we may not have it yet.
    // We construct it with a placeholder and call setUrl() in start() if needed.
    this.connection = new BiDiConnection(this.bidiUrl ?? "", this.actionTimeoutMs);
  }

  async start(bidiUrl?: string): Promise<void> {
    // Accept a URL override (used by FoxcloudBrowser which sets URL after session creation)
    if (bidiUrl) {
      this.bidiUrl = bidiUrl;
      this.connection.setUrl(bidiUrl);
    }

    if (!this.bidiUrl) {
      throw new Error("BiDiBrowser: bidiUrl must be provided at construction or in start()");
    }

    await this.connection.connect();
    await this.connection.sendCommand("session.new", { capabilities: {} });

    const treeResult = (await this.connection.sendCommand("browsingContext.getTree", {})) as {
      contexts: Array<{ context: string; url: string; children: unknown[] }>;
    };

    if (treeResult?.contexts?.length > 0) {
      this.currentContext = treeResult.contexts[0].context;
    } else {
      throw new Error("BiDiBrowser: no browsing contexts available after session.new");
    }
  }

  async shutdown(): Promise<void> {
    // End the BiDi session before closing the WebSocket.
    // Without this, Firefox keeps the session alive and blocks new ones.
    try {
      await this.connection.sendCommand("session.end", {});
    } catch {
      // Best effort — connection may already be closed
    }
    this.connection.close();
    this.currentContext = null;
  }

  async goto(url: string): Promise<void> {
    return withSpan(
      SpanName.BROWSER_NAVIGATE,
      { attributes: { "pilo.browser.url": url, "pilo.browser.backend": "bidi" } },
      async (span) => {
        try {
          const context = this.requireContext();
          await this.connection.sendCommand("browsingContext.navigate", {
            context,
            url,
            wait: "complete",
          });
          await this.ensureOptimizedPageLoad();
        } catch (error) {
          span.setStatus({
            code: SpanStatusCode.ERROR,
            message: error instanceof Error ? error.message : String(error),
          });
          span.recordException(error instanceof Error ? error : new Error(String(error)));
          throw error;
        }
      },
    );
  }

  async goBack(): Promise<void> {
    const context = this.requireContext();
    await this.connection.sendCommand("browsingContext.traverseHistory", {
      context,
      delta: -1,
    });
    await this.ensureOptimizedPageLoad();
  }

  async goForward(): Promise<void> {
    const context = this.requireContext();
    await this.connection.sendCommand("browsingContext.traverseHistory", {
      context,
      delta: 1,
    });
    await this.ensureOptimizedPageLoad();
  }

  async getUrl(): Promise<string> {
    const result = await this.evaluate("document.location.href");
    return unwrapBiDiValue(result) as string;
  }

  async getTitle(): Promise<string> {
    const result = await this.evaluate("document.title");
    return unwrapBiDiValue(result) as string;
  }

  async getTreeWithRefs(): Promise<string> {
    return withSpan(SpanName.BROWSER_SNAPSHOT, {}, async (span) => {
      try {
        this.requireContext();

        const result = await this.evaluate(`
          (() => {
            const win = window;
            if (!win.__piloAriaTree) {
              const fn = new Function(${JSON.stringify(ARIA_TREE_SCRIPT)});
              fn();
              win.__piloAriaTree = globalThis.__piloAriaTree;
            }
            if (typeof win.__piloAriaTree?.generateAndRenderAriaTree !== 'function') {
              throw new Error('ARIA tree script not available');
            }
            return win.__piloAriaTree.generateAndRenderAriaTree(document.body);
          })()
        `);

        const yaml = unwrapBiDiValue(result);
        if (typeof yaml !== "string") {
          throw new BrowserActionException(
            "getTreeWithRefs",
            `ARIA tree generation did not return a string (got ${typeof yaml}: ${JSON.stringify(result).substring(0, 200)})`,
          );
        }
        return yaml;
      } catch (error) {
        span.setStatus({
          code: SpanStatusCode.ERROR,
          message: error instanceof Error ? error.message : String(error),
        });
        span.recordException(error instanceof Error ? error : new Error(String(error)));
        throw error;
      }
    });
  }

  async getMarkdown(): Promise<string> {
    this.requireContext();

    const result = await this.evaluate(`
      (() => {
        const clone = (document.body || document.documentElement).cloneNode(true);
        clone.querySelectorAll('head, script, style, noscript').forEach(el => el.remove());
        return clone.innerHTML;
      })()
    `);

    const html = unwrapBiDiValue(result);
    if (typeof html !== "string") {
      return "";
    }
    return this.turndown.turndown(html);
  }

  async getScreenshot(options?: { withMarks?: boolean }): Promise<Buffer> {
    return withSpan(SpanName.BROWSER_SCREENSHOT, {}, async (span) => {
      try {
        this.requireContext();

        if (options?.withMarks) {
          try {
            await this.evaluate(`
              (() => {
                const win = window;
                win.__piloAriaTree?.applySetOfMarks?.();
              })()
            `);
          } catch {
            // Non-fatal
          }
        }

        try {
          const result = (await this.connection.sendCommand("browsingContext.captureScreenshot", {
            context: this.currentContext,
          })) as { data?: string };

          if (!result.data) {
            throw new BrowserActionException("getScreenshot", "captureScreenshot returned no data");
          }

          return Buffer.from(result.data, "base64");
        } finally {
          if (options?.withMarks) {
            try {
              await this.evaluate(`
                (() => {
                  const win = window;
                  win.__piloAriaTree?.removeSetOfMarks?.();
                })()
              `);
            } catch {
              // Non-fatal
            }
          }
        }
      } catch (error) {
        span.setStatus({
          code: SpanStatusCode.ERROR,
          message: error instanceof Error ? error.message : String(error),
        });
        span.recordException(error instanceof Error ? error : new Error(String(error)));
        throw error;
      }
    });
  }

  // Action-firewall introspection. NOT yet implemented for the BiDi backend —
  // porting PlaywrightBrowser's in-page field/form logic is a follow-up and is
  // untestable without a live BiDi session. Until then these are deliberately
  // fail-safe, never fail-open:
  //   - getFieldMetadata reports a generic freeform text input, so the firewall
  //     classifies every BiDi-driven fill as non-operational and blocks it on
  //     untrusted pages (it is allowed on caller-trusted hosts, where the
  //     firewall bypasses field classification anyway).
  //   - getFormSubmissionContext returns null, so no submitter context is
  //     produced. This cannot weaken protection because no agent-filled freeform
  //     value reaches a field on an untrusted page in the first place.
  async getFieldMetadata(ref: string): Promise<FieldMetadata> {
    return {
      ref,
      tagName: "input",
      inputType: "text",
      role: null,
      name: null,
      label: null,
      placeholder: null,
      autocomplete: null,
      isContentEditable: false,
      formId: null,
      formAction: null,
      formMethod: null,
    };
  }

  async getFormSubmissionContext(
    _ref: string,
    _trigger?: FormSubmissionTrigger,
  ): Promise<FormSubmissionContext | null> {
    return null;
  }

  async performAction(ref: string, action: PageAction, value?: string): Promise<void> {
    return withSpan(
      SpanName.BROWSER_PERFORM,
      {
        attributes: {
          "pilo.browser.action_type": String(action),
          ...(ref && { "pilo.browser.element_ref": ref }),
        },
      },
      async (span) => {
        try {
          await this.performActionImpl(ref, action, value);
        } catch (error) {
          span.setStatus({
            code: SpanStatusCode.ERROR,
            message: error instanceof Error ? error.message : String(error),
          });
          span.recordException(error instanceof Error ? error : new Error(String(error)));
          throw error;
        }
      },
    );
  }

  private async performActionImpl(ref: string, action: PageAction, value?: string): Promise<void> {
    // Non-element actions
    switch (action) {
      case PageAction.Wait: {
        if (value == null) {
          throw new BrowserActionException("wait", "PageAction.Wait requires a number of seconds");
        }
        const seconds = parseFloat(value);
        if (!Number.isFinite(seconds) || seconds <= 0) {
          throw new BrowserActionException(
            "wait",
            `PageAction.Wait requires a positive number of seconds, got "${value}"`,
          );
        }
        await this.evaluate(`new Promise(resolve => setTimeout(resolve, ${seconds * 1000}))`);
        return;
      }
      case PageAction.Goto: {
        const trimmedUrl = value?.trim();
        if (!trimmedUrl) {
          throw new BrowserActionException("goto", "PageAction.Goto requires a non-empty URL");
        }
        await this.goto(trimmedUrl);
        return;
      }
      case PageAction.Back:
        await this.goBack();
        return;
      case PageAction.Forward:
        await this.goForward();
        return;
      case PageAction.Done:
      case PageAction.Abort:
      case PageAction.Extract:
        return; // Handled by agent layer
    }

    // Element actions — resolve the element first, then dispatch the specific action.
    const jsRef = JSON.stringify(ref);
    const jsValue = JSON.stringify(value ?? "");

    // Find element using ref map (survives DOM re-renders) with attribute fallback
    const found = unwrapBiDiValue(
      await this.evaluate(`
        (() => {
          const refMap = globalThis.__piloRefMap;
          let el = refMap?.get(${jsRef});
          // Verify the ref map element is still in the document
          if (el && !el.isConnected) el = null;
          // Fallback to attribute selector
          if (!el) el = document.querySelector('[data-pilo-ref=' + ${jsRef} + ']');
          if (!el) return false;
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
          return true;
        })()
      `),
    );
    if (found !== true) {
      throw new InvalidRefException(ref);
    }

    // Build the action-specific JS to run on the already-located element.
    // Uses the same ref map → attribute fallback strategy.
    const elQuery = `(globalThis.__piloRefMap?.get(${jsRef}) ?? document.querySelector('[data-pilo-ref=' + ${jsRef} + ']'))`;
    const actionScripts: Record<string, string> = {
      [PageAction.Click]: `${elQuery}.click()`,
      [PageAction.Hover]: `${elQuery}.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }))`,
      [PageAction.Fill]: `(() => {
        const el = ${elQuery};
        if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
          el.value = ${jsValue};
        } else {
          el.textContent = ${jsValue};
        }
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
      })()`,
      [PageAction.Focus]: `${elQuery}.focus()`,
      [PageAction.Check]: `(() => {
        const el = ${elQuery};
        if (el instanceof HTMLInputElement) { el.checked = true; el.dispatchEvent(new Event('change', { bubbles: true })); }
      })()`,
      [PageAction.Uncheck]: `(() => {
        const el = ${elQuery};
        if (el instanceof HTMLInputElement) { el.checked = false; el.dispatchEvent(new Event('change', { bubbles: true })); }
      })()`,
      [PageAction.Select]: `(() => {
        const el = ${elQuery};
        if (el instanceof HTMLSelectElement) { el.value = ${jsValue}; el.dispatchEvent(new Event('change', { bubbles: true })); }
      })()`,
      [PageAction.Enter]: `(() => {
        const el = ${elQuery};
        el.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', bubbles: true }));
        el.dispatchEvent(new KeyboardEvent('keyup', { key: 'Enter', code: 'Enter', bubbles: true }));
      })()`,
    };

    const script = actionScripts[action];
    if (!script) {
      throw new BrowserActionException(action, `Unknown element action: ${action}`);
    }

    await this.evaluate(script);

    // Post-action page load for interactive actions
    if (
      action === PageAction.Click ||
      action === PageAction.Select ||
      action === PageAction.Enter
    ) {
      await this.ensureOptimizedPageLoad();
    }
  }

  async getRefIdentity(ref: string): Promise<{ role: string; name: string } | null> {
    if (!this.currentContext) return null;
    try {
      const jsRef = JSON.stringify(ref);
      const raw = unwrapBiDiValue(
        await this.evaluate(`
          (() => {
            const entry = globalThis.__piloIdentityMap?.get(${jsRef});
            return entry ? JSON.stringify({ role: entry.role, name: entry.name }) : null;
          })()
        `),
      );
      if (typeof raw !== "string") return null;
      const parsed = JSON.parse(raw) as { role?: unknown; name?: unknown };
      if (typeof parsed.role === "string" && typeof parsed.name === "string") {
        return { role: parsed.role, name: parsed.name };
      }
      return null;
    } catch {
      // The page may have navigated or torn down the identity map. Identity
      // is advisory for repetition detection — log nothing, just bail out.
      return null;
    }
  }

  async waitForLoadState(state: LoadState, options?: { timeout?: number }): Promise<void> {
    this.requireContext();
    await this.waitForLoadStateInContext(state, this.currentContext!, options);
  }

  /**
   * Shared waitForLoadState logic that accepts an explicit context.
   * Used by both the main waitForLoadState and runInTemporaryTab.
   */
  private async waitForLoadStateInContext(
    state: LoadState,
    context: string,
    options?: { timeout?: number },
  ): Promise<void> {
    const timeout = options?.timeout ?? this.actionTimeoutMs;

    await this.evaluate(
      `
      new Promise((resolve, reject) => {
        const timeoutId = setTimeout(() => reject(new Error('Timeout waiting for ${state} after ${timeout}ms')), ${timeout});
        const finish = () => { clearTimeout(timeoutId); resolve(true); };

        ${
          state === LoadState.DOMContentLoaded
            ? `
          if (document.readyState === 'interactive' || document.readyState === 'complete') {
            finish();
          } else {
            document.addEventListener('DOMContentLoaded', finish, { once: true });
          }`
            : state === LoadState.Load
              ? `
          if (document.readyState === 'complete') {
            finish();
          } else {
            window.addEventListener('load', finish, { once: true });
          }`
              : /* NetworkIdle */ `
          if (document.readyState === 'complete') {
            setTimeout(finish, ${NETWORKIDLE_DELAY_MS});
          } else {
            window.addEventListener('load', () => setTimeout(finish, ${NETWORKIDLE_DELAY_MS}), { once: true });
          }`
        }
      })
    `,
      context,
    );
  }

  async runInTemporaryTab<T>(fn: (tab: TemporaryTab) => Promise<T>): Promise<T> {
    this.requireContext();

    const createResult = (await this.connection.sendCommand("browsingContext.create", {
      type: "tab",
    })) as { context: string };

    const tempContext = createResult.context;

    try {
      const tab: TemporaryTab = {
        goto: async (url: string) => {
          await this.connection.sendCommand("browsingContext.navigate", {
            context: tempContext,
            url,
            wait: "complete",
          });
        },
        getMarkdown: async () => {
          const result = await this.evaluate(
            `(() => {
              const clone = (document.body || document.documentElement).cloneNode(true);
              clone.querySelectorAll('head, script, style, noscript').forEach(el => el.remove());
              return clone.innerHTML;
            })()`,
            tempContext,
          );
          const html = unwrapBiDiValue(result);
          return typeof html === "string" ? this.turndown.turndown(html) : "";
        },
        waitForLoadState: async (state: LoadState, options?: { timeout?: number }) => {
          await this.waitForLoadStateInContext(state, tempContext, options);
        },
      };

      return await fn(tab);
    } finally {
      try {
        await this.connection.sendCommand("browsingContext.close", {
          context: tempContext,
        });
      } catch {
        // Ignore close errors
      }
    }
  }

  async searchPage(opts: SearchPageOptions): Promise<SearchPageResult> {
    this.requireContext();

    const evalOpts = {
      pattern: opts.pattern,
      regex: opts.regex ?? false,
      caseSensitive: opts.caseSensitive ?? false,
      contextChars: opts.contextChars ?? 80,
      maxResults: opts.maxResults ?? 10,
    };

    const raw = unwrapBiDiValue(
      await this.evaluate(`
        (() => {
          const params = ${JSON.stringify(evalOpts)};
          const flags = params.caseSensitive ? "g" : "gi";
          const re = params.regex
            ? new RegExp(params.pattern, flags)
            : new RegExp(params.pattern.replace(/[.*+?^\${}()|[\\]\\\\]/g, "\\\\$&"), flags);

          const matches = [];
          let totalMatches = 0;

          if (!document.body) {
            return JSON.stringify({ totalMatches, matches });
          }

          const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
            acceptNode(node) {
              const p = node.parentElement;
              if (!p) return NodeFilter.FILTER_REJECT;
              const tag = p.tagName;
              if (tag === "SCRIPT" || tag === "STYLE" || tag === "NOSCRIPT") {
                return NodeFilter.FILTER_REJECT;
              }
              return NodeFilter.FILTER_ACCEPT;
            },
          });

          let node;
          while ((node = walker.nextNode())) {
            const text = node.data;
            re.lastIndex = 0;
            let m;
            while ((m = re.exec(text)) !== null) {
              totalMatches++;
              if (matches.length < params.maxResults) {
                const start = Math.max(0, m.index - params.contextChars);
                const end = Math.min(text.length, m.index + m[0].length + params.contextChars);
                const parentEl = node.parentElement;
                const refEl = parentEl && parentEl.closest("[data-pilo-ref]");
                matches.push({
                  match: m[0],
                  contextBefore: text.slice(start, m.index),
                  contextAfter: text.slice(m.index + m[0].length, end),
                  nearestRef: refEl ? refEl.getAttribute("data-pilo-ref") : undefined,
                });
              }
              if (m.index === re.lastIndex) re.lastIndex++;
            }
          }

          return JSON.stringify({ totalMatches, matches });
        })()
      `),
    );

    if (typeof raw !== "string") {
      throw new BrowserActionException(
        "searchPage",
        `search_page returned non-string (got ${typeof raw})`,
      );
    }

    const parsed = JSON.parse(raw) as {
      totalMatches: number;
      matches: Array<Omit<SearchPageMatch, "frameUrl">>;
    };

    const aggregated: SearchPageMatch[] = parsed.matches.map((m) => ({
      ...m,
      frameUrl: undefined,
    }));

    return {
      totalMatches: parsed.totalMatches,
      truncated: parsed.totalMatches > aggregated.length,
      matches: aggregated,
    };
  }

  async findElements(opts: FindElementsOptions): Promise<FindElementsResult> {
    this.requireContext();

    const evalOpts = {
      selector: opts.selector,
      withinRef: opts.withinRef ?? null,
      attributes: opts.attributes ?? null,
      maxResults: opts.maxResults ?? 20,
      includeText: opts.includeText ?? true,
    };

    const raw = unwrapBiDiValue(
      await this.evaluate(`
        (() => {
          const params = ${JSON.stringify(evalOpts)};

          let root = document;
          if (params.withinRef !== null) {
            const r = document.querySelector('[data-pilo-ref="' + CSS.escape(params.withinRef) + '"]');
            if (!r) {
              return JSON.stringify({
                error: 'withinRef "' + params.withinRef + '" not found in this frame',
                kind: "within-ref-miss",
              });
            }
            root = r;
          }

          let nodeList;
          try {
            nodeList = root.querySelectorAll(params.selector);
          } catch (e) {
            return JSON.stringify({
              error: e instanceof Error ? e.message : String(e),
              kind: "bad-selector",
            });
          }

          const totalMatches = nodeList.length;
          const matches = [];
          for (let i = 0; i < nodeList.length && matches.length < params.maxResults; i++) {
            const el = nodeList[i];
            let attrs;
            if (params.attributes && params.attributes.length > 0) {
              attrs = {};
              for (const name of params.attributes) {
                const v = el.getAttribute(name);
                if (v !== null) attrs[name] = v;
              }
            }
            const href = el.href;
            const src = el.src;
            if (typeof href === "string" && href) { attrs = attrs || {}; attrs["href"] = href; }
            if (typeof src === "string" && src) { attrs = attrs || {}; attrs["src"] = src; }

            const refEl = el.closest("[data-pilo-ref]");
            matches.push({
              tag: el.tagName.toLowerCase(),
              text: params.includeText ? (el.textContent || "").trim().slice(0, 500) : undefined,
              attributes: attrs && Object.keys(attrs).length > 0 ? attrs : undefined,
              nearestRef: refEl ? refEl.getAttribute("data-pilo-ref") : undefined,
            });
          }
          return JSON.stringify({ totalMatches, matches });
        })()
      `),
    );

    if (typeof raw !== "string") {
      throw new BrowserActionException(
        "findElements",
        `find_elements returned non-string (got ${typeof raw})`,
      );
    }

    const outcome = JSON.parse(raw) as
      | {
          totalMatches: number;
          matches: Array<Omit<FindElementsMatch, "frameUrl">>;
        }
      | { error: string; kind: "bad-selector" | "within-ref-miss" };

    if ("error" in outcome) {
      throw new BrowserActionException("findElements", `find_elements failed: ${outcome.error}`);
    }

    const aggregated: FindElementsMatch[] = outcome.matches.map((m) => ({
      ...m,
      frameUrl: undefined,
    }));

    return {
      totalMatches: outcome.totalMatches,
      truncated: outcome.totalMatches > aggregated.length,
      elements: aggregated,
    };
  }

  /**
   * Evaluates a JavaScript expression in the given browsing context (defaults to current context).
   */
  protected async evaluate(expression: string, context?: string): Promise<unknown> {
    const targetContext = context ?? this.requireContext();
    const result = (await this.connection.sendCommand("script.evaluate", {
      expression,
      target: { context: targetContext },
      awaitPromise: true,
    })) as { result: unknown };
    return result?.result;
  }

  /**
   * Returns the current browsing context ID, throwing if none is set.
   */
  protected requireContext(): string {
    if (!this.currentContext) {
      throw new Error("BiDiBrowser: no active browsing context");
    }
    return this.currentContext;
  }

  /**
   * Waits for the page to settle after navigation.
   */
  protected async ensureOptimizedPageLoad(): Promise<void> {
    try {
      await this.waitForLoadState(LoadState.DOMContentLoaded, {
        timeout: this.actionTimeoutMs,
      });
    } catch {
      // Continue anyway
    }
    try {
      await this.waitForLoadState(LoadState.Load, {
        timeout: this.actionTimeoutMs,
      });
    } catch {
      // Continue anyway
    }
    await new Promise((resolve) => setTimeout(resolve, PAGE_SETTLE_TIME_MS));
  }
}
