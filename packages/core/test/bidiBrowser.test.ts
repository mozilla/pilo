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

  describe("searchPage", () => {
    let browser: BiDiBrowser;
    let conn: ReturnType<typeof getMockConnection>;

    beforeEach(async () => {
      browser = new BiDiBrowser({ bidiUrl: "ws://localhost:9222" });
      await startBrowser(browser);
      conn = getMockConnection(browser);
    });

    it("forwards pattern through evaluate and parses JSON result", async () => {
      conn.sendCommand.mockResolvedValueOnce({
        result: {
          type: "string",
          value: JSON.stringify({
            totalMatches: 2,
            matches: [
              { match: "hello", contextBefore: "", contextAfter: "", nearestRef: "E5" },
              { match: "hello", contextBefore: "say ", contextAfter: "", nearestRef: undefined },
            ],
          }),
        },
      });

      const result = await browser.searchPage({ pattern: "hello" });

      expect(result.totalMatches).toBe(2);
      expect(result.matches).toHaveLength(2);
      expect(result.matches[0].nearestRef).toBe("E5");
      expect(result.truncated).toBe(false);

      const call = conn.sendCommand.mock.calls.find((c: any[]) => c[0] === "script.evaluate");
      expect(call).toBeDefined();
      expect(call[1].expression).toContain('"pattern":"hello"');
    });

    it("marks truncated when totalMatches exceeds returned matches", async () => {
      conn.sendCommand.mockResolvedValueOnce({
        result: {
          type: "string",
          value: JSON.stringify({
            totalMatches: 50,
            matches: [{ match: "x", contextBefore: "", contextAfter: "", nearestRef: undefined }],
          }),
        },
      });

      const result = await browser.searchPage({ pattern: "x", maxResults: 1 });
      expect(result.truncated).toBe(true);
    });
  });

  describe("findElements", () => {
    let browser: BiDiBrowser;
    let conn: ReturnType<typeof getMockConnection>;

    beforeEach(async () => {
      browser = new BiDiBrowser({ bidiUrl: "ws://localhost:9222" });
      await startBrowser(browser);
      conn = getMockConnection(browser);
    });

    it("returns parsed elements on success", async () => {
      conn.sendCommand.mockResolvedValueOnce({
        result: {
          type: "string",
          value: JSON.stringify({
            totalMatches: 1,
            matches: [{ tag: "a", text: "Click", attributes: { href: "/x" }, nearestRef: "E1" }],
          }),
        },
      });

      const result = await browser.findElements({ selector: "a" });
      expect(result.totalMatches).toBe(1);
      expect(result.elements[0].tag).toBe("a");
      expect(result.elements[0].attributes?.href).toBe("/x");
    });

    it("throws when the in-page script reports a bad selector", async () => {
      conn.sendCommand.mockResolvedValueOnce({
        result: {
          type: "string",
          value: JSON.stringify({ error: "Invalid selector", kind: "bad-selector" }),
        },
      });

      await expect(browser.findElements({ selector: ":::invalid" })).rejects.toThrow(
        /find_elements failed: Invalid selector/,
      );
    });

    it("throws when withinRef cannot be resolved in the frame", async () => {
      conn.sendCommand.mockResolvedValueOnce({
        result: {
          type: "string",
          value: JSON.stringify({
            error: 'withinRef "E99" not found in this frame',
            kind: "within-ref-miss",
          }),
        },
      });

      await expect(browser.findElements({ selector: "a", withinRef: "E99" })).rejects.toThrow(
        /within.*not found/i,
      );
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
