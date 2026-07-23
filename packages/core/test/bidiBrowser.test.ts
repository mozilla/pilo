import { isAbsolute } from "node:path";
import { describe, it, expect, beforeEach, vi } from "vitest";
import { BiDiBrowser, unwrapBiDiValue } from "../src/browser/bidiBrowser.js";
import { PageAction, LoadState } from "../src/browser/ariaBrowser.js";

vi.mock("../src/browser/bidiConnection.js", () => {
  const MockBiDiConnection = vi.fn(function (this: any) {
    this.connect = vi.fn().mockResolvedValue(undefined);
    this.close = vi.fn();
    this.sendCommand = vi.fn().mockResolvedValue(undefined);
    this.isConnected = true;
    this.setUrl = vi.fn();
    this.on = vi.fn();
    this.off = vi.fn();
    this.removeAllListeners = vi.fn();
  });
  return { BiDiConnection: MockBiDiConnection };
});

function getMockConnection(browser: BiDiBrowser) {
  return (browser as any).connection;
}

// Helper to start a browser with a mocked sendCommand that handles session.new and browsingContext.getTree
async function startBrowser(browser: BiDiBrowser) {
  const conn = getMockConnection(browser);
  conn.sendCommand.mockImplementation((method: string) => {
    if (method === "session.new") return Promise.resolve({});
    if (method === "browsingContext.getTree")
      return Promise.resolve({
        contexts: [{ context: "ctx-1", url: "about:blank", children: [] }],
      });
    return Promise.resolve(undefined);
  });
  await browser.start();
  conn.sendCommand.mockReset();
}

describe("BiDiBrowser", () => {
  describe("constructor", () => {
    it("sets browserName to 'bidi'", () => {
      const browser = new BiDiBrowser({ bidiUrl: "ws://localhost:9222" });
      expect(browser.browserName).toBe("bidi");
    });
  });

  describe("start", () => {
    it("connects and discovers browsing context", async () => {
      const browser = new BiDiBrowser({ bidiUrl: "ws://localhost:9222" });
      const conn = getMockConnection(browser);
      conn.sendCommand.mockImplementation((method: string) => {
        if (method === "session.new") return Promise.resolve({});
        if (method === "browsingContext.getTree")
          return Promise.resolve({
            contexts: [{ context: "ctx-1", url: "about:blank", children: [] }],
          });
        return Promise.resolve(undefined);
      });

      await browser.start();

      expect(conn.connect).toHaveBeenCalled();
      expect(conn.sendCommand).toHaveBeenCalledWith("session.new", { capabilities: {} });
      expect(conn.sendCommand).toHaveBeenCalledWith("browsingContext.getTree", {});
      expect((browser as any).currentContext).toBe("ctx-1");
    });

    it("accepts bidiUrl override in start()", async () => {
      const browser = new BiDiBrowser();
      const conn = getMockConnection(browser);
      conn.sendCommand.mockImplementation((method: string) => {
        if (method === "session.new") return Promise.resolve({});
        if (method === "browsingContext.getTree")
          return Promise.resolve({
            contexts: [{ context: "ctx-1", url: "about:blank", children: [] }],
          });
        return Promise.resolve(undefined);
      });

      await browser.start("ws://localhost:9222");

      expect(conn.setUrl).toHaveBeenCalledWith("ws://localhost:9222");
      expect(conn.connect).toHaveBeenCalled();
    });

    it("throws if no URL provided at construction or start()", async () => {
      const browser = new BiDiBrowser();
      await expect(browser.start()).rejects.toThrow();
    });
  });

  describe("navigation", () => {
    let browser: BiDiBrowser;

    beforeEach(async () => {
      browser = new BiDiBrowser({ bidiUrl: "ws://localhost:9222" });
      await startBrowser(browser);
    });

    it("goto sends browsingContext.navigate", async () => {
      const conn = getMockConnection(browser);
      conn.sendCommand.mockResolvedValue({});
      await browser.goto("https://example.com");
      expect(conn.sendCommand).toHaveBeenCalledWith(
        "browsingContext.navigate",
        expect.objectContaining({
          context: "ctx-1",
          url: "https://example.com",
          wait: "complete",
        }),
      );
    });

    it("getUrl evaluates document.location.href and returns string", async () => {
      const conn = getMockConnection(browser);
      conn.sendCommand.mockResolvedValue({
        result: { type: "string", value: "https://example.com/page" },
      });
      const url = await browser.getUrl();
      expect(url).toBe("https://example.com/page");
    });

    it("getTitle evaluates document.title and returns string", async () => {
      const conn = getMockConnection(browser);
      conn.sendCommand.mockResolvedValue({
        result: { type: "string", value: "Example Page" },
      });
      const title = await browser.getTitle();
      expect(title).toBe("Example Page");
    });

    it("goBack sends browsingContext.traverseHistory with delta -1", async () => {
      const conn = getMockConnection(browser);
      conn.sendCommand.mockResolvedValue({});
      await browser.goBack();
      expect(conn.sendCommand).toHaveBeenCalledWith(
        "browsingContext.traverseHistory",
        expect.objectContaining({
          context: "ctx-1",
          delta: -1,
        }),
      );
    });

    it("goForward sends browsingContext.traverseHistory with delta 1", async () => {
      const conn = getMockConnection(browser);
      conn.sendCommand.mockResolvedValue({});
      await browser.goForward();
      expect(conn.sendCommand).toHaveBeenCalledWith(
        "browsingContext.traverseHistory",
        expect.objectContaining({
          context: "ctx-1",
          delta: 1,
        }),
      );
    });
  });

  describe("getTreeWithRefs", () => {
    let browser: BiDiBrowser;
    let conn: ReturnType<typeof getMockConnection>;

    beforeEach(async () => {
      browser = new BiDiBrowser({ bidiUrl: "ws://localhost:9222" });
      await startBrowser(browser);
      conn = getMockConnection(browser);
    });

    it("injects ARIA tree script and returns YAML", async () => {
      conn.sendCommand.mockResolvedValue({
        result: {
          type: "string",
          value: "- heading E1: Hello World\n- button E2: Click me",
        },
      });

      const tree = await browser.getTreeWithRefs();
      expect(tree).toContain("heading E1");
      expect(tree).toContain("button E2");

      expect(conn.sendCommand).toHaveBeenCalledWith(
        "script.evaluate",
        expect.objectContaining({
          target: { context: "ctx-1" },
          awaitPromise: true,
        }),
      );
    });
  });

  describe("waitForLoadState", () => {
    let browser: BiDiBrowser;
    let conn: ReturnType<typeof getMockConnection>;

    beforeEach(async () => {
      browser = new BiDiBrowser({ bidiUrl: "ws://localhost:9222" });
      await startBrowser(browser);
      conn = getMockConnection(browser);
    });

    it("evaluates a load state check script", async () => {
      conn.sendCommand.mockResolvedValue({
        result: { type: "boolean", value: true },
      });

      await browser.waitForLoadState(LoadState.Load);

      expect(conn.sendCommand).toHaveBeenCalledWith(
        "script.evaluate",
        expect.objectContaining({
          target: { context: "ctx-1" },
          awaitPromise: true,
        }),
      );
    });
  });

  describe("getScreenshot", () => {
    let browser: BiDiBrowser;
    let conn: ReturnType<typeof getMockConnection>;

    beforeEach(async () => {
      browser = new BiDiBrowser({ bidiUrl: "ws://localhost:9222" });
      await startBrowser(browser);
      conn = getMockConnection(browser);
    });

    it("sends browsingContext.captureScreenshot and returns Buffer", async () => {
      const testData = Buffer.from("fake-png-data").toString("base64");
      conn.sendCommand.mockResolvedValue({ data: testData });

      const result = await browser.getScreenshot();

      expect(result).toBeInstanceOf(Buffer);
      expect(result.toString()).toBe("fake-png-data");
      expect(conn.sendCommand).toHaveBeenCalledWith(
        "browsingContext.captureScreenshot",
        expect.objectContaining({ context: "ctx-1" }),
      );
    });
  });

  describe("getMarkdown", () => {
    let browser: BiDiBrowser;
    let conn: ReturnType<typeof getMockConnection>;

    beforeEach(async () => {
      browser = new BiDiBrowser({ bidiUrl: "ws://localhost:9222" });
      await startBrowser(browser);
      conn = getMockConnection(browser);
    });

    it("extracts HTML via script and converts to markdown", async () => {
      conn.sendCommand.mockResolvedValue({
        result: {
          type: "string",
          value: "<h1>Hello</h1><p>World</p>",
        },
      });

      const md = await browser.getMarkdown();

      expect(md).toContain("Hello");
      expect(md).toContain("World");
    });
  });

  describe("performAction", () => {
    let browser: BiDiBrowser;
    let conn: ReturnType<typeof getMockConnection>;

    beforeEach(async () => {
      browser = new BiDiBrowser({ bidiUrl: "ws://localhost:9222" });
      await startBrowser(browser);
      conn = getMockConnection(browser);
    });

    it("click finds element then executes click script", async () => {
      // First evaluate: element lookup returns true
      conn.sendCommand.mockResolvedValueOnce({
        result: { type: "boolean", value: true },
      });
      // Second evaluate: click action
      conn.sendCommand.mockResolvedValueOnce({ result: { type: "undefined" } });

      await browser.performAction("E1", PageAction.Click);

      // Verify element lookup
      expect(conn.sendCommand).toHaveBeenCalledWith(
        "script.evaluate",
        expect.objectContaining({
          expression: expect.stringContaining("data-pilo-ref"),
        }),
      );
      // Verify click script was sent separately
      expect(conn.sendCommand).toHaveBeenCalledWith(
        "script.evaluate",
        expect.objectContaining({
          expression: expect.stringContaining(".click()"),
        }),
      );
    });

    it("fill finds element then executes fill script", async () => {
      // First evaluate: element lookup
      conn.sendCommand.mockResolvedValueOnce({
        result: { type: "boolean", value: true },
      });
      // Second evaluate: fill action
      conn.sendCommand.mockResolvedValueOnce({ result: { type: "undefined" } });

      await browser.performAction("E3", PageAction.Fill, "hello world");

      expect(conn.sendCommand).toHaveBeenCalledWith(
        "script.evaluate",
        expect.objectContaining({
          expression: expect.stringContaining("hello world"),
        }),
      );
    });

    it("throws InvalidRefException when element not found", async () => {
      conn.sendCommand.mockResolvedValueOnce({
        result: { type: "boolean", value: false },
      });

      await expect(browser.performAction("E99", PageAction.Click)).rejects.toThrow(
        "Invalid element reference",
      );
    });

    it("wait action uses setTimeout, not element lookup", async () => {
      conn.sendCommand.mockResolvedValue({
        result: { type: "boolean", value: true },
      });

      await browser.performAction("", PageAction.Wait, "1");

      expect(conn.sendCommand).toHaveBeenCalledWith(
        "script.evaluate",
        expect.objectContaining({
          expression: expect.stringContaining("setTimeout"),
        }),
      );
    });

    it("goto action delegates to this.goto()", async () => {
      conn.sendCommand.mockResolvedValue({
        url: "https://example.com",
        navigation: "nav-1",
      });

      await browser.performAction("", PageAction.Goto, "https://example.com");

      expect(conn.sendCommand).toHaveBeenCalledWith(
        "browsingContext.navigate",
        expect.objectContaining({ url: "https://example.com" }),
      );
    });
  });

  describe("performAction — Scroll", () => {
    it("scrolls the viewport down via script.evaluate", async () => {
      const browser = new BiDiBrowser({ bidiUrl: "ws://localhost:9222" });
      await startBrowser(browser);
      const conn = getMockConnection(browser);
      conn.sendCommand.mockImplementation((method: string) =>
        method === "script.evaluate"
          ? Promise.resolve({ result: { type: "undefined" } })
          : Promise.resolve(undefined),
      );

      await browser.performAction("", PageAction.Scroll, "down");

      const evalCall = conn.sendCommand.mock.calls.find(
        (c: unknown[]) => c[0] === "script.evaluate",
      );
      expect(evalCall).toBeDefined();
      const expression = String((evalCall![1] as { expression: string }).expression);
      expect(expression).toContain("window.scrollBy");
      expect(expression).toContain('switch ("down")');
    });

    it("scrolls to the top via script.evaluate", async () => {
      const browser = new BiDiBrowser({ bidiUrl: "ws://localhost:9222" });
      await startBrowser(browser);
      const conn = getMockConnection(browser);
      conn.sendCommand.mockImplementation((method: string) =>
        method === "script.evaluate"
          ? Promise.resolve({ result: { type: "undefined" } })
          : Promise.resolve(undefined),
      );

      await browser.performAction("", PageAction.Scroll, "top");

      const evalCall = conn.sendCommand.mock.calls.find(
        (c: unknown[]) => c[0] === "script.evaluate",
      );
      expect(evalCall).toBeDefined();
      const expression = String((evalCall![1] as { expression: string }).expression);
      expect(expression).toContain("window.scrollTo");
      expect(expression).toContain('switch ("top")');
    });

    it("throws when direction is missing", async () => {
      const browser = new BiDiBrowser({ bidiUrl: "ws://localhost:9222" });
      await startBrowser(browser);
      await expect(browser.performAction("", PageAction.Scroll)).rejects.toThrow(/direction/i);
    });

    it("throws on an unsupported direction (host-side validation)", async () => {
      const browser = new BiDiBrowser({ bidiUrl: "ws://localhost:9222" });
      await startBrowser(browser);
      // No script.evaluate should be needed — validation happens before dispatch.
      await expect(browser.performAction("", PageAction.Scroll, "sideways")).rejects.toThrow(
        /unsupported scroll direction/i,
      );
    });
  });

  describe("runInTemporaryTab", () => {
    let browser: BiDiBrowser;
    let conn: ReturnType<typeof getMockConnection>;

    beforeEach(async () => {
      browser = new BiDiBrowser({ bidiUrl: "ws://localhost:9222" });
      await startBrowser(browser);
      conn = getMockConnection(browser);
      conn.sendCommand.mockReset();
    });

    it("creates a new context, runs the function, then closes it", async () => {
      // browsingContext.create
      conn.sendCommand
        .mockResolvedValueOnce({ context: "temp-ctx-1" })
        // goto -> browsingContext.navigate
        .mockResolvedValue({
          result: { type: "string", value: "<p>content</p>" },
        });

      const result = await browser.runInTemporaryTab(async (tab) => {
        await tab.goto("https://example.com");
        return "done";
      });

      expect(result).toBe("done");

      expect(conn.sendCommand).toHaveBeenCalledWith(
        "browsingContext.create",
        expect.objectContaining({ type: "tab" }),
      );

      expect(conn.sendCommand).toHaveBeenCalledWith(
        "browsingContext.close",
        expect.objectContaining({ context: "temp-ctx-1" }),
      );
    });

    it("closes context even if function throws", async () => {
      conn.sendCommand.mockResolvedValueOnce({ context: "temp-ctx-2" });
      conn.sendCommand.mockResolvedValue({});

      await expect(
        browser.runInTemporaryTab(async () => {
          throw new Error("oops");
        }),
      ).rejects.toThrow("oops");

      expect(conn.sendCommand).toHaveBeenCalledWith(
        "browsingContext.close",
        expect.objectContaining({ context: "temp-ctx-2" }),
      );
    });
  });

  describe("performAction — UploadFile", () => {
    const NODE = { type: "node", sharedId: "node-file-1" };

    function mockUpload(browser: BiDiBrowser, node: unknown = NODE) {
      const conn = getMockConnection(browser);
      conn.sendCommand.mockImplementation(
        (method: string, params?: { resultOwnership?: string }) => {
          if (method === "script.evaluate") {
            // resolveFileInputSharedId requests resultOwnership: "root" and reads the node
            // from result; the generic element-found check omits it and expects a boolean.
            if (params?.resultOwnership === "root") {
              return Promise.resolve({ result: node });
            }
            return Promise.resolve({ result: { type: "boolean", value: true } });
          }
          if (method === "input.setFiles") return Promise.resolve({});
          return Promise.resolve(undefined);
        },
      );
      return conn;
    }

    it("sends input.setFiles with the resolved sharedId and absolute path", async () => {
      const browser = new BiDiBrowser({
        bidiUrl: "ws://localhost:9222",
        allowFileUpload: { allowedPaths: [process.cwd()] },
      });
      await startBrowser(browser);
      const conn = mockUpload(browser);

      // Use this very test file as a guaranteed-existing regular file under cwd.
      const target = "test/bidiBrowser.test.ts";
      await browser.performAction("file1", PageAction.UploadFile, target);

      const setFiles = conn.sendCommand.mock.calls.find(
        (c: unknown[]) => c[0] === "input.setFiles",
      );
      expect(setFiles).toBeDefined();
      const params = setFiles![1] as { element: { sharedId: string }; files: string[] };
      expect(params.element.sharedId).toBe("node-file-1");
      expect(isAbsolute(params.files[0])).toBe(true);
      expect(params.files[0].endsWith("bidiBrowser.test.ts")).toBe(true);
    });

    it("throws upload_path_required when value is missing", async () => {
      const browser = new BiDiBrowser({
        bidiUrl: "ws://localhost:9222",
        allowFileUpload: { allowedPaths: [process.cwd()] },
      });
      await startBrowser(browser);
      mockUpload(browser);
      await expect(browser.performAction("file1", PageAction.UploadFile)).rejects.toThrow(
        /upload_path_required/,
      );
    });

    it("throws upload_disabled when no allowlist is configured", async () => {
      const browser = new BiDiBrowser({ bidiUrl: "ws://localhost:9222" });
      await startBrowser(browser);
      mockUpload(browser);
      await expect(
        browser.performAction("file1", PageAction.UploadFile, "test/bidiBrowser.test.ts"),
      ).rejects.toThrow(/upload_disabled/);
    });

    it("throws upload_target_not_file_input when node resolution returns non-node", async () => {
      const browser = new BiDiBrowser({
        bidiUrl: "ws://localhost:9222",
        allowFileUpload: { allowedPaths: [process.cwd()] },
      });
      await startBrowser(browser);
      mockUpload(browser, { type: "null" });
      await expect(
        browser.performAction("file1", PageAction.UploadFile, "test/bidiBrowser.test.ts"),
      ).rejects.toThrow(/upload_target_not_file_input/);
    });

    it("throws InvalidRefException when the ref cannot be found (bad-ref parity)", async () => {
      const browser = new BiDiBrowser({
        bidiUrl: "ws://localhost:9222",
        allowFileUpload: { allowedPaths: [process.cwd()] },
      });
      await startBrowser(browser);
      const conn = getMockConnection(browser);
      conn.sendCommand.mockImplementation(
        (method: string, params?: { resultOwnership?: string }) => {
          if (method === "script.evaluate") {
            if (params?.resultOwnership === "root") {
              return Promise.resolve({ result: NODE });
            }
            // Generic element-found check reports the element as missing.
            return Promise.resolve({ result: { type: "boolean", value: false } });
          }
          return Promise.resolve(undefined);
        },
      );

      await expect(
        browser.performAction("missing-ref", PageAction.UploadFile, "test/bidiBrowser.test.ts"),
      ).rejects.toThrow("Invalid element reference");
    });
  });

  describe("getFieldMetadata (BiDi)", () => {
    it("returns page-derived metadata parsed from script.evaluate", async () => {
      const browser = new BiDiBrowser({ bidiUrl: "ws://localhost:9222" });
      await startBrowser(browser);
      const conn = getMockConnection(browser);
      const meta = {
        ref: "r1",
        tagName: "input",
        inputType: "email",
        role: null,
        name: "email",
        label: "Email",
        placeholder: null,
        autocomplete: "email",
        isContentEditable: false,
        formId: "login",
        formAction: "https://example.com/login",
        formMethod: "post",
      };
      conn.sendCommand.mockResolvedValue({
        result: { type: "string", value: JSON.stringify(meta) },
      });

      const result = await browser.getFieldMetadata("r1");
      expect(result).toEqual(meta);
    });

    it("falls back to the generic stub when the element is not found (null result)", async () => {
      const browser = new BiDiBrowser({ bidiUrl: "ws://localhost:9222" });
      await startBrowser(browser);
      const conn = getMockConnection(browser);
      conn.sendCommand.mockResolvedValue({ result: { type: "null" } });

      const result = await browser.getFieldMetadata("missing");
      expect(result.tagName).toBe("input");
      expect(result.inputType).toBe("text");
      expect(result.ref).toBe("missing");
    });
  });

  describe("getFormSubmissionContext (BiDi)", () => {
    it("returns parsed submission context", async () => {
      const browser = new BiDiBrowser({ bidiUrl: "ws://localhost:9222" });
      await startBrowser(browser);
      const conn = getMockConnection(browser);
      const ctx = {
        submitterRef: "btn1",
        formId: "login",
        actionUrl: "https://example.com/login",
        submitterActionUrl: null,
        method: "post",
        fields: [
          { ref: "r1", name: "email", tagName: "input", inputType: "email", autocomplete: "email" },
        ],
      };
      conn.sendCommand.mockResolvedValue({
        result: { type: "string", value: JSON.stringify(ctx) },
      });

      const result = await browser.getFormSubmissionContext("btn1", "click");
      expect(result).toEqual(ctx);
    });

    it("returns null when the script yields null (non-submitter)", async () => {
      const browser = new BiDiBrowser({ bidiUrl: "ws://localhost:9222" });
      await startBrowser(browser);
      const conn = getMockConnection(browser);
      conn.sendCommand.mockResolvedValue({ result: { type: "null" } });

      const result = await browser.getFormSubmissionContext("btn1", "click");
      expect(result).toBeNull();
    });
  });

  describe("event subscription + routing", () => {
    it("subscribe() sends session.subscribe with the event list", async () => {
      const browser = new BiDiBrowser({ bidiUrl: "ws://localhost:9222" });
      await startBrowser(browser);
      const conn = getMockConnection(browser);
      conn.sendCommand.mockResolvedValue(undefined);
      await (browser as any).subscribe(["browsingContext.load"]);
      expect(conn.sendCommand).toHaveBeenCalledWith("session.subscribe", {
        events: ["browsingContext.load"],
      });
    });

    it("router increments/decrements the in-flight counter", () => {
      const browser = new BiDiBrowser({ bidiUrl: "ws://localhost:9222" });
      const b = browser as any;
      expect(b.inFlightRequests).toBe(0);
      b.onBiDiEvent({ method: "network.beforeRequestSent", params: { context: "c1" } });
      b.onBiDiEvent({ method: "network.beforeRequestSent", params: { context: "c1" } });
      expect(b.inFlightRequests).toBe(2);
      b.onBiDiEvent({ method: "network.responseCompleted", params: { context: "c1" } });
      expect(b.inFlightRequests).toBe(1);
      b.onBiDiEvent({ method: "network.fetchError", params: { context: "c1" } });
      expect(b.inFlightRequests).toBe(0);
      // never goes negative
      b.onBiDiEvent({ method: "network.responseCompleted", params: { context: "c1" } });
      expect(b.inFlightRequests).toBe(0);
    });

    it("router re-emits load signals per context", () => {
      const browser = new BiDiBrowser({ bidiUrl: "ws://localhost:9222" });
      const b = browser as any;
      const seen: string[] = [];
      b.loadEvents.on("load:c1", () => seen.push("load"));
      b.onBiDiEvent({ method: "browsingContext.load", params: { context: "c1" } });
      expect(seen).toEqual(["load"]);
    });
  });

  describe("network resource blocking", () => {
    function makeBrowser() {
      return new BiDiBrowser({
        bidiUrl: "ws://localhost:9222",
        blockResources: ["image", "stylesheet"],
      });
    }

    it("registers an intercept in start()", async () => {
      const browser = makeBrowser();
      const conn = getMockConnection(browser);
      conn.sendCommand.mockImplementation((method: string) => {
        if (method === "session.new") return Promise.resolve({});
        if (method === "browsingContext.getTree")
          return Promise.resolve({
            contexts: [{ context: "ctx-1", url: "about:blank", children: [] }],
          });
        return Promise.resolve(undefined);
      });
      await browser.start();
      expect(conn.sendCommand).toHaveBeenCalledWith(
        "network.addIntercept",
        expect.objectContaining({ phases: ["beforeRequestSent"] }),
      );
    });

    it("does not register an intercept when blockResources is empty", async () => {
      const browser = new BiDiBrowser({ bidiUrl: "ws://localhost:9222", blockResources: [] });
      const conn = getMockConnection(browser);
      conn.sendCommand.mockImplementation((method: string) => {
        if (method === "session.new") return Promise.resolve({});
        if (method === "browsingContext.getTree")
          return Promise.resolve({
            contexts: [{ context: "ctx-1", url: "about:blank", children: [] }],
          });
        return Promise.resolve(undefined);
      });
      await browser.start();
      // No mockReset() here (unlike startBrowser()) — we need the real call
      // history from start() to make this assertion meaningful.
      expect(conn.sendCommand).not.toHaveBeenCalledWith("network.addIntercept", expect.anything());
    });

    it("fails a blocked resource type and continues others", async () => {
      const browser = makeBrowser();
      await startBrowser(browser);
      const conn = getMockConnection(browser);
      conn.sendCommand.mockResolvedValue(undefined);
      const b = browser as any;

      b.onBiDiEvent({
        method: "network.beforeRequestSent",
        params: {
          context: "c1",
          isBlocked: true,
          request: { request: "req-img", destination: "image" },
        },
      });
      b.onBiDiEvent({
        method: "network.beforeRequestSent",
        params: {
          context: "c1",
          isBlocked: true,
          request: { request: "req-doc", destination: "document" },
        },
      });

      expect(conn.sendCommand).toHaveBeenCalledWith("network.failRequest", { request: "req-img" });
      expect(conn.sendCommand).toHaveBeenCalledWith("network.continueRequest", {
        request: "req-doc",
      });
    });

    it("does not act on non-intercepted requests", () => {
      const browser = makeBrowser();
      const conn = getMockConnection(browser);
      conn.sendCommand.mockResolvedValue(undefined);
      const b = browser as any;

      b.onBiDiEvent({
        method: "network.beforeRequestSent",
        params: {
          context: "c1",
          request: { request: "req-img", destination: "image" },
        },
      });

      expect(conn.sendCommand).not.toHaveBeenCalledWith("network.failRequest", expect.anything());
      expect(conn.sendCommand).not.toHaveBeenCalledWith(
        "network.continueRequest",
        expect.anything(),
      );
    });
  });
});

describe("unwrapBiDiValue", () => {
  it("unwraps string typed values", () => {
    expect(unwrapBiDiValue({ type: "string", value: "hello" })).toBe("hello");
  });

  it("unwraps number typed values", () => {
    expect(unwrapBiDiValue({ type: "number", value: 42 })).toBe(42);
  });

  it("unwraps boolean typed values", () => {
    expect(unwrapBiDiValue({ type: "boolean", value: true })).toBe(true);
  });

  it("unwraps null typed values", () => {
    expect(unwrapBiDiValue({ type: "null" })).toBeNull();
  });

  it("unwraps undefined typed values", () => {
    expect(unwrapBiDiValue({ type: "undefined" })).toBeUndefined();
  });

  it("passes through unknown types", () => {
    const val = { type: "object", value: { foo: "bar" } };
    expect(unwrapBiDiValue(val)).toBe(val);
  });
});
