import * as fs from "node:fs/promises";
import { EventEmitter } from "node:events";
import * as path from "node:path";
import TurndownService from "turndown";
import {
  AriaBrowser,
  PageAction,
  LoadState,
  TemporaryTab,
  SCROLL_DIRECTIONS,
  type ScrollDirection,
  type FieldMetadata,
  type FormSubmissionContext,
  type FormSubmissionTrigger,
  type FileUploadConfig,
} from "./ariaBrowser.js";
import { BiDiConnection } from "./bidiConnection.js";
import { ARIA_TREE_SCRIPT } from "./ariaTree/bundle.js";
import { BrowserActionException, InvalidRefException } from "../errors.js";
import { withSpan, SpanStatusCode, SpanName } from "../telemetry/tracing.js";

const PAGE_SETTLE_TIME_MS = 1000;
const NETWORKIDLE_DELAY_MS = 500;
const SCROLL_SETTLE_TIMEOUT_MS = 1000;

export interface BiDiBrowserOptions {
  /** WebDriver BiDi WebSocket URL (can be provided later in start()) */
  bidiUrl?: string;
  /** Timeout for browser actions in milliseconds (default: 30000) */
  actionTimeoutMs?: number;
  /** File-upload allowlist. `false` (default) disables uploads. */
  allowFileUpload?: false | FileUploadConfig;
  /** Resource types to abort via native network interception. Default: none blocked. */
  blockResources?: Array<"image" | "stylesheet" | "font" | "media" | "manifest">;
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
  protected inFlightRequests = 0;
  protected loadEvents = new EventEmitter();

  private readonly actionTimeoutMs: number;
  private bidiUrl: string | undefined;
  protected turndown: TurndownService;
  private readonly allowFileUpload: false | FileUploadConfig;
  private readonly blockResources: string[];

  constructor(options: BiDiBrowserOptions = {}) {
    this.bidiUrl = options.bidiUrl;
    this.actionTimeoutMs = options.actionTimeoutMs ?? 30_000;
    this.allowFileUpload = options.allowFileUpload ?? false;
    this.blockResources = options.blockResources ?? [];
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

    // BiDiConnection.close() does not remove listeners registered on the
    // connection's EventEmitter, so a fresh start() on the same instance
    // (Foxcloud park/resume reconnects without constructing a new browser)
    // would otherwise stack up duplicate "event" listeners and leave
    // inFlightRequests carrying over from the prior session. Reset both here
    // so start() is safe to call more than once.
    this.connection.removeAllListeners("event");
    this.inFlightRequests = 0;

    this.connection.on("event", (msg: { method: string; params: Record<string, unknown> }) =>
      this.onBiDiEvent(msg),
    );

    if (this.blockResources.length > 0) {
      await this.connection.sendCommand("network.addIntercept", {
        phases: ["beforeRequestSent"],
      });
    }

    await this.subscribe([
      "browsingContext.load",
      "browsingContext.domContentLoaded",
      "network.beforeRequestSent",
      "network.responseCompleted",
      "network.fetchError",
    ]);
  }

  /** Sends session.subscribe for the given BiDi event names. */
  protected async subscribe(events: string[]): Promise<void> {
    await this.connection.sendCommand("session.subscribe", { events });
  }

  /**
   * Maps Pilo's `blockResources` entries to Fetch `destination` values, which
   * is how a native-intercepted `network.beforeRequestSent` classifies the
   * resource (per the Fetch spec's request destination enum).
   */
  private blockedDestinations(): Set<string> {
    const map: Record<string, string[]> = {
      image: ["image"],
      stylesheet: ["style"],
      font: ["font"],
      media: ["audio", "video"],
      manifest: ["manifest"],
    };
    return new Set(this.blockResources.flatMap((r) => map[r] ?? []));
  }

  /**
   * Routes id-less BiDi events emitted by the connection: tracks in-flight
   * network requests and re-emits per-context load signals on `loadEvents`.
   */
  protected onBiDiEvent(msg: { method: string; params: Record<string, unknown> }): void {
    const ctx = msg.params?.context as string | undefined;
    switch (msg.method) {
      case "network.beforeRequestSent": {
        this.inFlightRequests++;
        // ASSUMED, unverified against a real Firefox (Task 5 Step 1 was
        // skipped — no live Firefox available in this environment): the
        // request id lives at params.request.request, the resource
        // classifier is the Fetch destination at params.request.destination,
        // and a paused/intercepted request has params.isBlocked === true.
        // Confirm these field names via the Task 7 smoke script before
        // relying on this in production.
        const req = (msg.params?.request ?? {}) as { request?: string; destination?: string };
        if (msg.params?.isBlocked === true && req.request) {
          const blocked = this.blockedDestinations().has(String(req.destination));
          const cmd = blocked ? "network.failRequest" : "network.continueRequest";
          // Fire-and-forget: the interception must be resolved so the page
          // proceeds, but a resolution failure here shouldn't crash the router.
          void this.connection.sendCommand(cmd, { request: req.request }).catch(() => {});
        }
        break;
      }
      case "network.responseCompleted":
      case "network.fetchError":
        this.inFlightRequests = Math.max(0, this.inFlightRequests - 1);
        break;
      case "browsingContext.load":
        if (ctx) this.loadEvents.emit(`load:${ctx}`);
        break;
      case "browsingContext.domContentLoaded":
        if (ctx) this.loadEvents.emit(`domcontentloaded:${ctx}`);
        break;
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

  // Action-firewall introspection. Ports PlaywrightBrowser's in-page
  // field/form classification logic to `script.evaluate`. Both methods are
  // deliberately fail-safe, never fail-open: on element-not-found or any
  // eval/parse error, getFieldMetadata falls back to a generic freeform text
  // input (the firewall then classifies the fill as non-operational and
  // blocks it on untrusted pages), and getFormSubmissionContext falls back to
  // null (no submitter context is produced).
  async getFieldMetadata(ref: string): Promise<FieldMetadata> {
    const fallback: FieldMetadata = {
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
    if (!this.currentContext) return fallback;
    try {
      const jsRef = JSON.stringify(ref);
      const raw = unwrapBiDiValue(
        await this.evaluate(`
          (() => {
            const refMap = globalThis.__piloRefMap;
            let el = refMap?.get(${jsRef});
            if (el && !el.isConnected) el = null;
            if (!el) el = document.querySelector('[data-pilo-ref=' + ${jsRef} + ']');
            if (!el) return null;

            const getElementForm = (node) =>
              (node instanceof HTMLInputElement || node instanceof HTMLTextAreaElement ||
               node instanceof HTMLSelectElement || node instanceof HTMLButtonElement)
                ? node.form : node.closest('form');
            const getElementName = (node) =>
              (node instanceof HTMLInputElement || node instanceof HTMLTextAreaElement ||
               node instanceof HTMLSelectElement || node instanceof HTMLButtonElement)
                ? (node.name || null) : node.getAttribute('name');
            const getElementLabel = (node) => {
              const ariaLabel = node.getAttribute('aria-label');
              if (ariaLabel && ariaLabel.trim()) return ariaLabel.trim();
              const labelledBy = node.getAttribute('aria-labelledby');
              if (labelledBy) {
                const text = labelledBy.split(/\\s+/)
                  .map((id) => node.ownerDocument.getElementById(id)?.textContent?.trim() || '')
                  .filter(Boolean).join(' ');
                if (text) return text;
              }
              if ('labels' in node) {
                const text = Array.from(node.labels || [])
                  .map((l) => l.textContent?.trim() || '').filter(Boolean).join(' ');
                if (text) return text;
              }
              return null;
            };
            const getElementPlaceholder = (node) =>
              (node instanceof HTMLInputElement || node instanceof HTMLTextAreaElement)
                ? (node.placeholder || null) : null;
            const getElementAutocomplete = (node) =>
              (node instanceof HTMLInputElement || node instanceof HTMLTextAreaElement ||
               node instanceof HTMLSelectElement) ? (node.autocomplete || null) : null;

            const input = el instanceof HTMLInputElement ? el : null;
            const form = getElementForm(el);
            return JSON.stringify({
              ref: ${jsRef},
              tagName: el.tagName.toLowerCase(),
              inputType: input?.type?.toLowerCase() ?? null,
              role: el.getAttribute('role'),
              name: getElementName(el),
              label: getElementLabel(el),
              placeholder: getElementPlaceholder(el),
              autocomplete: getElementAutocomplete(el),
              isContentEditable: el.isContentEditable,
              formId: form?.id || null,
              formAction: form?.action || null,
              formMethod: form?.method?.toLowerCase() || null,
            });
          })()
        `),
      );
      if (typeof raw !== "string") return fallback;
      return JSON.parse(raw) as FieldMetadata;
    } catch {
      return fallback;
    }
  }

  async getFormSubmissionContext(
    ref: string,
    trigger: FormSubmissionTrigger = "click",
  ): Promise<FormSubmissionContext | null> {
    if (!this.currentContext) return null;
    try {
      const jsRef = JSON.stringify(ref);
      const jsTrigger = JSON.stringify(trigger);
      const raw = unwrapBiDiValue(
        await this.evaluate(`
          (() => {
            const refMap = globalThis.__piloRefMap;
            let el = refMap?.get(${jsRef});
            if (el && !el.isConnected) el = null;
            if (!el) el = document.querySelector('[data-pilo-ref=' + ${jsRef} + ']');
            if (!el) return null;
            const trigger = ${jsTrigger};

            const canSubmitForm = (node, t) => {
              if (t === 'click') {
                if (node instanceof HTMLButtonElement) return node.type === 'submit';
                if (node instanceof HTMLInputElement) return node.type === 'submit' || node.type === 'image';
                return false;
              }
              if (node instanceof HTMLTextAreaElement || node instanceof HTMLSelectElement) return false;
              if (!(node instanceof HTMLInputElement)) return false;
              return !['button','checkbox','color','file','hidden','radio','range','reset','submit'].includes(node.type);
            };
            const getSubmissionForm = (node) =>
              (node instanceof HTMLButtonElement || node instanceof HTMLInputElement ||
               node instanceof HTMLTextAreaElement || node instanceof HTMLSelectElement)
                ? node.form : node.closest('form');

            if (!canSubmitForm(el, trigger)) return null;
            const form = getSubmissionForm(el);
            if (!form) return null;

            const fields = Array.from(form.elements)
              .filter((f) => f instanceof HTMLInputElement || f instanceof HTMLTextAreaElement || f instanceof HTMLSelectElement)
              .filter((f) => !f.disabled)
              .map((f) => ({
                ref: f.getAttribute('data-pilo-ref'),
                name: f.name || null,
                tagName: f.tagName.toLowerCase(),
                inputType: f instanceof HTMLInputElement ? f.type.toLowerCase() : null,
                autocomplete: 'autocomplete' in f ? (f.autocomplete || null) : null,
              }));

            const submitterActionUrl = (() => {
              if (!(el instanceof HTMLButtonElement) && !(el instanceof HTMLInputElement)) return null;
              if (el instanceof HTMLInputElement && el.type !== 'submit' && el.type !== 'image') return null;
              if (el instanceof HTMLButtonElement && el.type !== 'submit') return null;
              if (!el.hasAttribute('formaction')) return null;
              return el.formAction || null;
            })();

            return JSON.stringify({
              submitterRef: ${jsRef},
              formId: form.id || null,
              actionUrl: form.action || null,
              submitterActionUrl,
              method: form.method?.toLowerCase() || null,
              fields,
            });
          })()
        `),
      );
      if (typeof raw !== "string") return null;
      return JSON.parse(raw) as FormSubmissionContext;
    } catch {
      return null;
    }
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
      case PageAction.Scroll: {
        if (!value) {
          throw new BrowserActionException("scroll", "PageAction.Scroll requires a direction");
        }
        if (!SCROLL_DIRECTIONS.includes(value as ScrollDirection)) {
          throw new BrowserActionException("scroll", `Unsupported scroll direction: ${value}`);
        }
        const jsDir = JSON.stringify(value);
        await this.evaluate(`
          (() => {
            switch (${jsDir}) {
              case "down":
                window.scrollBy({ left: 0, top: window.innerHeight, behavior: "instant" });
                return;
              case "up":
                window.scrollBy({ left: 0, top: -window.innerHeight, behavior: "instant" });
                return;
              case "top":
                window.scrollTo({ left: 0, top: 0, behavior: "instant" });
                return;
              case "bottom":
                window.scrollTo({ left: 0, top: document.documentElement.scrollHeight, behavior: "instant" });
                return;
              default:
                throw new Error("Unsupported scroll direction: " + ${jsDir});
            }
          })()
        `);
        // Best-effort settle for lazy-loaded content (mirrors PlaywrightBrowser).
        // Timeout must exceed NETWORKIDLE_DELAY_MS so the settle can resolve instead of
        // always timing out; Task 6 will make NetworkIdle event-driven, turning this into
        // a real bounded network-idle wait.
        await this.waitForLoadState(LoadState.NetworkIdle, {
          timeout: SCROLL_SETTLE_TIMEOUT_MS,
        }).catch(() => {});
        return;
      }
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

    // UploadFile resolves its own file-input node via a dedicated script.evaluate
    // (with resultOwnership: "root") and dispatches the native input.setFiles command.
    // It runs after the generic found-check above so a bad/stale ref still throws
    // InvalidRefException like every other element action.
    if (action === PageAction.UploadFile) {
      await this.uploadFile(ref, value);
      return;
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

  private async resolveAllowedUploadPath(inputPath: string): Promise<string> {
    if (!this.allowFileUpload || this.allowFileUpload.allowedPaths.length === 0) {
      throw new BrowserActionException("upload_file", "upload_disabled");
    }
    const resolvedPath = path.resolve(inputPath);
    let stat;
    try {
      stat = await fs.stat(resolvedPath);
    } catch {
      throw new BrowserActionException("upload_file", "upload_path_not_file");
    }
    if (!stat.isFile()) {
      throw new BrowserActionException("upload_file", "upload_path_not_file");
    }
    const realPath = await fs.realpath(resolvedPath);
    for (const allowedRoot of this.allowFileUpload.allowedPaths) {
      try {
        const realRoot = await fs.realpath(path.resolve(allowedRoot));
        const relative = path.relative(realRoot, realPath);
        if (relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative))) {
          return realPath;
        }
      } catch {
        // Missing/unreadable allowlist root cannot match.
      }
    }
    throw new BrowserActionException("upload_file", "upload_path_not_allowed");
  }

  private async resolveFileInputSharedId(ref: string): Promise<string | null> {
    const jsRef = JSON.stringify(ref);
    const raw = (await this.connection.sendCommand("script.evaluate", {
      expression: `
        (() => {
          const refMap = globalThis.__piloRefMap;
          let el = refMap?.get(${jsRef});
          if (el && !el.isConnected) el = null;
          if (!el) el = document.querySelector('[data-pilo-ref=' + ${jsRef} + ']');
          if (!el) return null;
          if (el instanceof HTMLInputElement && el.type.toLowerCase() === 'file') return el;
          return el.querySelector('input[type=file]') || null;
        })()
      `,
      target: { context: this.requireContext() },
      awaitPromise: true,
      resultOwnership: "root",
    })) as { result?: { type?: string; sharedId?: string } };
    const node = raw?.result;
    if (node && node.type === "node" && typeof node.sharedId === "string") {
      return node.sharedId;
    }
    return null;
  }

  private async uploadFile(ref: string, value?: string): Promise<void> {
    if (!value) {
      throw new BrowserActionException("upload_file", "upload_path_required");
    }
    const uploadPath = await this.resolveAllowedUploadPath(value);
    const sharedId = await this.resolveFileInputSharedId(ref);
    if (!sharedId) {
      throw new BrowserActionException("upload_file", "upload_target_not_file_input");
    }
    await this.connection.sendCommand("input.setFiles", {
      context: this.requireContext(),
      element: { sharedId },
      files: [uploadPath],
    });
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

    if (state === LoadState.DOMContentLoaded || state === LoadState.Load) {
      const readyState = String(
        unwrapBiDiValue(await this.evaluate(`document.readyState`, context)) ?? "",
      );

      if (
        state === LoadState.DOMContentLoaded &&
        (readyState === "interactive" || readyState === "complete")
      ) {
        return;
      }
      if (state === LoadState.Load && readyState === "complete") {
        return;
      }

      const eventName =
        state === LoadState.Load ? `load:${context}` : `domcontentloaded:${context}`;

      return new Promise<void>((resolve, reject) => {
        const listener = () => {
          clearTimeout(timer);
          resolve();
        };
        const timer = setTimeout(() => {
          this.loadEvents.off(eventName, listener);
          reject(new Error(`Timeout waiting for ${state} after ${timeout}ms`));
        }, timeout);
        this.loadEvents.once(eventName, listener);
      });
    }

    // NetworkIdle: wait for the in-flight counter to stay at 0 for a quiet window.
    // NOTE: inFlightRequests is instance-wide, not scoped to `context`, so a
    // NetworkIdle wait here couples to traffic across all contexts (e.g. a
    // temporary tab would wait on the main tab's requests too). Acceptable
    // today because no temp-tab NetworkIdle path exists (see runInTemporaryTab).
    return new Promise<void>((resolve, reject) => {
      let cancelled = false;
      let pollTimer: ReturnType<typeof setTimeout> | undefined;

      const timer = setTimeout(() => {
        cancelled = true;
        if (pollTimer) clearTimeout(pollTimer);
        reject(new Error(`Timeout waiting for ${state} after ${timeout}ms`));
      }, timeout);

      const finish = () => {
        cancelled = true;
        clearTimeout(timer);
        if (pollTimer) clearTimeout(pollTimer);
        resolve();
      };

      const poll = () => {
        if (!cancelled) pollTimer = setTimeout(check, 50);
      };

      const check = () => {
        if (cancelled) return;
        if (this.inFlightRequests === 0) {
          pollTimer = setTimeout(() => {
            if (cancelled) return;
            if (this.inFlightRequests === 0) finish();
            else poll();
          }, NETWORKIDLE_DELAY_MS);
        } else {
          poll();
        }
      };

      check();
    });
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
