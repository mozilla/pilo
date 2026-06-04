import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createWebActionTools } from "../../src/tools/webActionTools.js";
import {
  AriaBrowser,
  FieldMetadata,
  FormSubmissionTrigger,
  FormSubmissionContext,
  PageAction,
} from "../../src/browser/ariaBrowser.js";
import { WebAgentEventEmitter, WebAgentEventType } from "../../src/events.js";
import { LanguageModel } from "ai";
import { z } from "zod";
import { InvalidRefException, BrowserActionException } from "../../src/errors.js";
import { generateTextWithRetry, generateObjectWithRetry } from "../../src/utils/retry.js";
import {
  wrapExternalContentWithWarning,
  ExternalContentLabel,
} from "../../src/utils/promptSecurity.js";

// Mock the ai module
vi.mock("ai", () => ({
  tool: vi.fn((config: any) => ({
    ...config,
    description: config.description,
    inputSchema: config.inputSchema,
    execute: config.execute,
  })),
  generateText: vi.fn(),
  generateObject: vi.fn(),
  // jsonSchema() is called inline in webActionTools to wrap the user's schema;
  // return a marker we can identify in test assertions.
  jsonSchema: vi.fn((schema: any) => ({ __jsonSchema: true, schema })),
}));

// Mock the retry module to bypass retry logic in tests
vi.mock("../../src/utils/retry.js", () => ({
  generateTextWithRetry: vi.fn(),
  generateObjectWithRetry: vi.fn(),
}));

const mockGenerateTextWithRetry = vi.mocked(generateTextWithRetry);
const mockGenerateObjectWithRetry = vi.mocked(generateObjectWithRetry);

// Mock browser implementation
class MockBrowser implements AriaBrowser {
  browserName = "mock-browser";
  public url = "https://example.com";
  public title = "Example Page";
  public fieldMetadata = new Map<string, FieldMetadata>();
  public formSubmissionContexts = new Map<string, FormSubmissionContext | null>();

  async start(): Promise<void> {}
  async shutdown(): Promise<void> {}

  async goto(newUrl: string): Promise<void> {
    this.url = newUrl;
    this.title = `Page at ${newUrl}`;
  }

  async goBack(): Promise<void> {
    this.url = "https://previous.com";
    this.title = "Previous Page";
  }

  async goForward(): Promise<void> {
    this.url = "https://next.com";
    this.title = "Next Page";
  }

  async getUrl(): Promise<string> {
    return this.url;
  }

  async getTitle(): Promise<string> {
    return this.title;
  }

  async getTreeWithRefs(): Promise<string> {
    return "<div>[ref=btn1]Button</div>";
  }

  async getMarkdown(): Promise<string> {
    return "# Page Content\nThis is the page content.";
  }

  async getScreenshot(): Promise<Buffer> {
    return Buffer.from("mock-screenshot");
  }

  async performAction(_ref: string, _action: PageAction, _value?: string): Promise<void> {
    // Mock implementation - can be configured to throw errors for testing
  }

  async getFieldMetadata(ref: string): Promise<FieldMetadata> {
    return (
      this.fieldMetadata.get(ref) ?? {
        ref,
        tagName: "input",
        inputType: "search",
        role: "searchbox",
        name: "q",
        label: "Search",
        placeholder: "Search",
        autocomplete: null,
        isContentEditable: false,
        formId: "search-form",
        formAction: "https://example.com/search",
        formMethod: "get",
      }
    );
  }

  async getFormSubmissionContext(
    ref: string,
    _trigger?: FormSubmissionTrigger,
  ): Promise<FormSubmissionContext | null> {
    return this.formSubmissionContexts.get(ref) ?? null;
  }

  async getRefIdentity(_ref: string): Promise<{ role: string; name: string } | null> {
    return null;
  }

  async waitForLoadState(): Promise<void> {}

  async runInTemporaryTab<T>(fn: (tab: any) => Promise<T>): Promise<T> {
    const mockTab = {
      goto: async () => {},
      waitForLoadState: async () => {},
      getMarkdown: async () => "# Mock Results",
    };
    return fn(mockTab);
  }

  async searchPage(): Promise<{
    totalMatches: number;
    truncated: boolean;
    matches: any[];
  }> {
    return { totalMatches: 0, truncated: false, matches: [] };
  }

  async findElements(): Promise<{
    totalMatches: number;
    truncated: boolean;
    elements: any[];
  }> {
    return { totalMatches: 0, truncated: false, elements: [] };
  }
}

describe("Web Action Tools", () => {
  let mockBrowser: MockBrowser;
  let eventEmitter: WebAgentEventEmitter;
  let mockProvider: LanguageModel;
  let context: any;
  let tools: any;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();

    mockBrowser = new MockBrowser();
    eventEmitter = new WebAgentEventEmitter();
    mockProvider = { specificationVersion: "v1" } as unknown as LanguageModel;

    context = {
      browser: mockBrowser,
      eventEmitter,
      providerConfig: { model: mockProvider },
      abortSignal: undefined,
      agentFilledRefs: new Set<string>(),
      operationalRefs: new Set<string>(),
      firewall: { trustedHostnames: new Set<string>(), unsafeMode: false },
      interactive: false,
    };

    tools = createWebActionTools(context);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("Tool Structure", () => {
    it("should require provenance tracking sets", () => {
      expect(() =>
        createWebActionTools({
          browser: mockBrowser,
          eventEmitter,
          providerConfig: { model: mockProvider },
        } as any),
      ).toThrow("Web action provenance tracking sets are required");
    });

    it("should create all expected tools", () => {
      expect(tools).toBeDefined();
      expect(tools.click).toBeDefined();
      expect(tools.fill).toBeDefined();
      expect(tools.select).toBeDefined();
      expect(tools.hover).toBeDefined();
      expect(tools.check).toBeDefined();
      expect(tools.uncheck).toBeDefined();
      expect(tools.focus).toBeDefined();
      expect(tools.enter).toBeDefined();
      expect(tools.wait).toBeDefined();
      expect(tools.goto).toBeDefined();
      expect(tools.back).toBeDefined();
      expect(tools.forward).toBeDefined();
      expect(tools.scroll).toBeDefined();
      expect(tools.extract).toBeDefined();
      expect(tools.done).toBeDefined();
      expect(tools.abort).toBeDefined();
    });

    it("should have correct descriptions", () => {
      expect(tools.click.description).toBe("Click on an element on the page");
      expect(tools.fill.description).toBe("Fill text into an input field");
      expect(tools.select.description).toBe("Select an option from a dropdown");
      expect(tools.hover.description).toBe("Hover over an element");
      expect(tools.check.description).toBe("Check a checkbox");
      expect(tools.uncheck.description).toBe("Uncheck a checkbox");
      expect(tools.focus.description).toBe("Focus on an element");
      expect(tools.enter.description).toBe(
        "Press Enter key on an element (useful for form submission)",
      );
      expect(tools.wait.description).toBe(
        "Wait for a specified number of seconds (up to 120 for slow-loading pages)",
      );
      expect(tools.goto.description).toBe(
        "Navigate to a URL that was previously seen in the conversation",
      );
      expect(tools.back.description).toBe("Go back to the previous page");
      expect(tools.forward.description).toBe("Go forward to the next page");
      expect(tools.scroll.description).toContain("Scroll the page");
      expect(tools.extract.description).toMatch(/Extract data from the current page/);
      expect(tools.extract.description).toMatch(/outputSchema/);
      expect(tools.done.description).toBe("Complete the task with your final answer");
      expect(tools.abort.description).toContain("Abort the task when it cannot be completed");
    });
  });

  describe("Click Action", () => {
    it("should execute click action successfully", async () => {
      const performActionSpy = vi.spyOn(mockBrowser, "performAction");

      const result = await tools.click.execute({ ref: "btn1" });

      expect(performActionSpy).toHaveBeenCalledWith("btn1", PageAction.Click, undefined);
      expect(result).toEqual({
        success: true,
        action: "click",
        ref: "btn1",
      });
    });

    it("should emit browser action events", async () => {
      const emitSpy = vi.spyOn(eventEmitter, "emit");

      await tools.click.execute({ ref: "btn1" });

      // Should emit AGENT_ACTION first
      expect(emitSpy).toHaveBeenCalledWith(WebAgentEventType.AGENT_ACTION, {
        action: "click",
        ref: "btn1",
        value: undefined,
      });
      // Then BROWSER_ACTION_STARTED
      expect(emitSpy).toHaveBeenCalledWith(WebAgentEventType.BROWSER_ACTION_STARTED, {
        action: "click",
        ref: "btn1",
        value: undefined,
      });
      // Finally BROWSER_ACTION_COMPLETED after the action
      expect(emitSpy).toHaveBeenCalledWith(WebAgentEventType.BROWSER_ACTION_COMPLETED, {
        success: true,
        action: "click",
      });
    });

    it("should validate input schema", () => {
      const schema = tools.click.inputSchema;

      const valid = schema.safeParse({ ref: "btn1" });
      expect(valid.success).toBe(true);

      const invalid = schema.safeParse({});
      expect(invalid.success).toBe(false);
    });

    it("should handle InvalidRefException and return recoverable error", async () => {
      vi.spyOn(mockBrowser, "performAction").mockRejectedValueOnce(new InvalidRefException("btn1"));

      const result = await tools.click.execute({ ref: "btn1" });

      expect(result.success).toBe(false);
      expect(result.error).toContain("Invalid element reference 'btn1'");
      expect(result.isRecoverable).toBe(true);
      expect(result.ref).toBe("btn1");
    });

    it("should handle BrowserActionException and return recoverable error", async () => {
      vi.spyOn(mockBrowser, "performAction").mockRejectedValueOnce(
        new BrowserActionException("click", "Element is disabled"),
      );

      const result = await tools.click.execute({ ref: "btn1" });

      expect(result.success).toBe(false);
      expect(result.error).toBe("Element is disabled");
      expect(result.isRecoverable).toBe(true);
    });

    it("should emit BROWSER_ACTION_COMPLETED with isRecoverable and error on browser exception", async () => {
      const emitSpy = vi.spyOn(eventEmitter, "emit");
      vi.spyOn(mockBrowser, "performAction").mockRejectedValueOnce(
        new BrowserActionException("click", "Element is not clickable"),
      );

      await tools.click.execute({ ref: "btn1" });

      // Should emit BROWSER_ACTION_COMPLETED with error details
      expect(emitSpy).toHaveBeenCalledWith(WebAgentEventType.BROWSER_ACTION_COMPLETED, {
        success: false,
        action: "click",
        error: "Element is not clickable",
        isRecoverable: true,
      });
    });

    it("should re-throw non-browser errors", async () => {
      vi.spyOn(mockBrowser, "performAction").mockRejectedValueOnce(new Error("Network error"));

      await expect(tools.click.execute({ ref: "btn1" })).rejects.toThrow("Network error");
    });

    it("should capture target identity from the browser and include it in the result", async () => {
      vi.spyOn(mockBrowser, "getRefIdentity").mockResolvedValueOnce({
        role: "button",
        name: "Submit",
      });

      const result = await tools.click.execute({ ref: "btn1" });

      expect(result).toEqual({
        success: true,
        action: "click",
        ref: "btn1",
        targetIdentity: { role: "button", name: "Submit" },
      });
    });

    it("should omit targetIdentity when the browser returns null", async () => {
      vi.spyOn(mockBrowser, "getRefIdentity").mockResolvedValueOnce(null);

      const result = await tools.click.execute({ ref: "btn1" });

      expect(result).toEqual({
        success: true,
        action: "click",
        ref: "btn1",
      });
    });
  });

  describe("Fill Action", () => {
    it("should execute fill action successfully", async () => {
      const performActionSpy = vi.spyOn(mockBrowser, "performAction");

      const result = await tools.fill.execute({ ref: "input1", value: "test text" });

      expect(performActionSpy).toHaveBeenCalledWith("input1", PageAction.Fill, "test text");
      expect(result).toEqual({
        success: true,
        action: "fill",
        ref: "input1",
        value: "test text",
      });
    });

    it("should block agent fill of freeform submittable fields", async () => {
      mockBrowser.fieldMetadata.set("input1", {
        ref: "input1",
        tagName: "textarea",
        inputType: null,
        role: null,
        name: "message",
        label: "Message",
        placeholder: "Message",
        autocomplete: null,
        isContentEditable: false,
        formId: "contact",
        formAction: "https://example.com/contact",
        formMethod: "post",
      });
      const performActionSpy = vi.spyOn(mockBrowser, "performAction");

      const result = await tools.fill.execute({ ref: "input1", value: "generated payload" });

      expect(performActionSpy).not.toHaveBeenCalled();
      expect(result).toEqual({
        success: false,
        action: "fill",
        ref: "input1",
        error: "Security policy blocked filling a submittable form field without user approval",
        isRecoverable: true,
      });
      expect(result.value).toBeUndefined();
    });

    it("should allow approved freeform field fills", async () => {
      const performActionSpy = vi.spyOn(mockBrowser, "performAction");
      mockBrowser.fieldMetadata.set("input1", {
        ref: "input1",
        tagName: "textarea",
        inputType: null,
        role: null,
        name: "message",
        label: "Message",
        placeholder: "Message",
        autocomplete: null,
        isContentEditable: false,
        formId: "contact",
        formAction: "https://example.com/contact",
        formMethod: "post",
      });
      context.approvedRefs = new Set(["input1"]);
      tools = createWebActionTools(context);

      const result = await tools.fill.execute({ ref: "input1", value: "user-provided value" });

      expect(performActionSpy).toHaveBeenCalledWith(
        "input1",
        PageAction.Fill,
        "user-provided value",
      );
      expect(result.success).toBe(true);
    });

    it("should track agent-filled operational refs", async () => {
      context.agentFilledRefs = new Set<string>();
      context.operationalRefs = new Set<string>();
      tools = createWebActionTools(context);

      await tools.fill.execute({ ref: "input1", value: "pilo" });

      expect(context.agentFilledRefs.has("input1")).toBe(true);
      expect(context.operationalRefs.has("input1")).toBe(true);
    });

    it("should emit browser action events", async () => {
      const emitSpy = vi.spyOn(eventEmitter, "emit");

      await tools.fill.execute({ ref: "input1", value: "test text" });

      expect(emitSpy).toHaveBeenCalledWith(WebAgentEventType.AGENT_ACTION, {
        action: "fill",
        ref: "input1",
        value: "test text",
      });
      expect(emitSpy).toHaveBeenCalledWith(WebAgentEventType.BROWSER_ACTION_STARTED, {
        action: "fill",
        ref: "input1",
        value: "test text",
      });
      expect(emitSpy).toHaveBeenCalledWith(WebAgentEventType.BROWSER_ACTION_COMPLETED, {
        success: true,
        action: "fill",
      });
    });

    it("should validate input schema", () => {
      const schema = tools.fill.inputSchema;

      const valid = schema.safeParse({ ref: "input1", value: "text" });
      expect(valid.success).toBe(true);

      const invalid = schema.safeParse({ ref: "input1" }); // missing value
      expect(invalid.success).toBe(false);
    });
  });

  describe("Select Action", () => {
    it("should execute select action successfully", async () => {
      const performActionSpy = vi.spyOn(mockBrowser, "performAction");

      const result = await tools.select.execute({ ref: "dropdown1", value: "option2" });

      expect(performActionSpy).toHaveBeenCalledWith("dropdown1", PageAction.Select, "option2");
      expect(result).toEqual({
        success: true,
        action: "select",
        ref: "dropdown1",
        value: "option2",
      });
    });
  });

  describe("Hover Action", () => {
    it("should execute hover action successfully", async () => {
      const performActionSpy = vi.spyOn(mockBrowser, "performAction");

      const result = await tools.hover.execute({ ref: "menu1" });

      expect(performActionSpy).toHaveBeenCalledWith("menu1", PageAction.Hover, undefined);
      expect(result).toEqual({
        success: true,
        action: "hover",
        ref: "menu1",
      });
    });
  });

  describe("Check/Uncheck Actions", () => {
    it("should execute check action successfully", async () => {
      const performActionSpy = vi.spyOn(mockBrowser, "performAction");

      const result = await tools.check.execute({ ref: "checkbox1" });

      expect(performActionSpy).toHaveBeenCalledWith("checkbox1", PageAction.Check, undefined);
      expect(result).toEqual({
        success: true,
        action: "check",
        ref: "checkbox1",
      });
    });

    it("should execute uncheck action successfully", async () => {
      const performActionSpy = vi.spyOn(mockBrowser, "performAction");

      const result = await tools.uncheck.execute({ ref: "checkbox1" });

      expect(performActionSpy).toHaveBeenCalledWith("checkbox1", PageAction.Uncheck, undefined);
      expect(result).toEqual({
        success: true,
        action: "uncheck",
        ref: "checkbox1",
      });
    });
  });

  describe("Focus Action", () => {
    it("should execute focus action successfully", async () => {
      const performActionSpy = vi.spyOn(mockBrowser, "performAction");

      const result = await tools.focus.execute({ ref: "input1" });

      expect(performActionSpy).toHaveBeenCalledWith("input1", PageAction.Focus, undefined);
      expect(result).toEqual({
        success: true,
        action: "focus",
        ref: "input1",
      });
    });
  });

  describe("Enter Action", () => {
    it("should execute enter action successfully", async () => {
      const performActionSpy = vi.spyOn(mockBrowser, "performAction");

      const result = await tools.enter.execute({ ref: "form1" });

      expect(performActionSpy).toHaveBeenCalledWith("form1", PageAction.Enter, undefined);
      expect(result).toEqual({
        success: true,
        action: "enter",
        ref: "form1",
      });
    });
  });

  describe("Wait Action", () => {
    it("should execute wait action successfully", async () => {
      // wait no longer goes through browser.performAction — it sleeps directly
      // in the tool so the abort signal can interrupt it.
      const performActionSpy = vi.spyOn(mockBrowser, "performAction");
      const emitSpy = vi.spyOn(eventEmitter, "emit");

      const promise = tools.wait.execute({ seconds: 2 });
      await vi.advanceTimersByTimeAsync(2000);
      const result = await promise;

      expect(performActionSpy).not.toHaveBeenCalled();
      expect(emitSpy).toHaveBeenCalledWith(WebAgentEventType.AGENT_WAITING, { seconds: 2 });
      expect(result).toEqual({
        success: true,
        action: "wait",
        value: "2",
      });
    });

    it("should abort wait when abort signal fires", async () => {
      const controller = new AbortController();
      context.abortSignal = controller.signal;
      tools = createWebActionTools(context);

      const promise = tools.wait.execute({ seconds: 60 });
      // Attach a rejection handler before triggering abort so vitest's
      // fake-timer scheduler doesn't see an unhandled rejection.
      const settled = promise.catch((err: unknown) => err);

      controller.abort();
      // Advance past one poll interval (500ms) so the loop notices the abort.
      await vi.advanceTimersByTimeAsync(500);

      const err = await settled;
      expect(err).toBeInstanceOf(Error);
      expect((err as Error).message).toContain("Wait cancelled by abort signal");
    });

    it("should validate wait time constraints", () => {
      const schema = tools.wait.inputSchema;

      const valid = schema.safeParse({ seconds: 5 });
      expect(valid.success).toBe(true);

      const tooShort = schema.safeParse({ seconds: -1 });
      expect(tooShort.success).toBe(false);

      const validLong = schema.safeParse({ seconds: 120 });
      expect(validLong.success).toBe(true);

      const tooLong = schema.safeParse({ seconds: 121 });
      expect(tooLong.success).toBe(false);
    });
  });

  describe("Scroll Action", () => {
    it("should dispatch scroll action with the requested direction", async () => {
      const performActionSpy = vi.spyOn(mockBrowser, "performAction");

      const result = await tools.scroll.execute({ direction: "down" });

      expect(performActionSpy).toHaveBeenCalledWith("", PageAction.Scroll, "down");
      expect(result).toEqual({
        success: true,
        action: "scroll",
        value: "down",
      });
    });

    it("should accept all four directions", () => {
      const schema = tools.scroll.inputSchema;
      for (const direction of ["up", "down", "top", "bottom"]) {
        expect(schema.safeParse({ direction }).success).toBe(true);
      }
    });

    it("should reject unknown directions", () => {
      const schema = tools.scroll.inputSchema;
      expect(schema.safeParse({ direction: "left" }).success).toBe(false);
      expect(schema.safeParse({ direction: "" }).success).toBe(false);
      expect(schema.safeParse({}).success).toBe(false);
    });
  });

  describe("Navigation Actions", () => {
    it("should execute goto action successfully", async () => {
      const performActionSpy = vi.spyOn(mockBrowser, "performAction");
      const emitSpy = vi.spyOn(eventEmitter, "emit");

      const result = await tools.goto.execute({ url: "https://newsite.com" });

      expect(performActionSpy).toHaveBeenCalledWith("", PageAction.Goto, "https://newsite.com");
      expect(emitSpy).toHaveBeenCalledWith(WebAgentEventType.BROWSER_NAVIGATED, {
        title: expect.any(String),
        url: expect.any(String),
      });
      expect(result).toEqual({
        success: true,
        action: "goto",
        title: expect.any(String),
        value: "https://newsite.com", // performActionWithValidation adds value field
      });
    });

    it("should validate URL format for goto", () => {
      const schema = tools.goto.inputSchema;

      const valid = schema.safeParse({ url: "https://example.com" });
      expect(valid.success).toBe(true);

      const invalid = schema.safeParse({ url: "not-a-url" });
      expect(invalid.success).toBe(false);
    });

    it("should block click submit when form contains unauthorized agent-filled values", async () => {
      const performActionSpy = vi.spyOn(mockBrowser, "performAction");
      context.agentFilledRefs = new Set(["message"]);
      context.operationalRefs = new Set<string>();
      context.approvedRefs = new Set<string>();
      mockBrowser.formSubmissionContexts.set("submit1", {
        submitterRef: "submit1",
        formId: "contact",
        actionUrl: "https://example.com/contact",
        submitterActionUrl: null,
        method: "post",
        fields: [
          {
            ref: "message",
            name: "message",
            tagName: "textarea",
            inputType: null,
            autocomplete: null,
          },
        ],
      });
      tools = createWebActionTools(context);

      const result = await tools.click.execute({ ref: "submit1" });

      expect(performActionSpy).not.toHaveBeenCalled();
      expect(result.success).toBe(false);
      expect(result.error).toBe(
        "Security policy blocked submitting a form containing unauthorized agent-filled data",
      );
      expect(JSON.stringify(result)).not.toContain("generated payload");
    });

    it("should allow click submit when form fields are approved or operational", async () => {
      const performActionSpy = vi.spyOn(mockBrowser, "performAction");
      context.agentFilledRefs = new Set(["query", "email"]);
      context.operationalRefs = new Set(["query"]);
      context.approvedRefs = new Set(["email"]);
      mockBrowser.formSubmissionContexts.set("submit1", {
        submitterRef: "submit1",
        formId: "search",
        actionUrl: "https://example.com/search",
        submitterActionUrl: null,
        method: "get",
        fields: [
          {
            ref: "query",
            name: "q",
            tagName: "input",
            inputType: "search",
            autocomplete: null,
          },
          {
            ref: "email",
            name: "email",
            tagName: "input",
            inputType: "email",
            autocomplete: "email",
          },
        ],
      });
      tools = createWebActionTools(context);

      const result = await tools.click.execute({ ref: "submit1" });

      expect(performActionSpy).toHaveBeenCalledWith("submit1", PageAction.Click, undefined);
      expect(result.success).toBe(true);
    });

    it("should block click submit when an operational field posts to a cross-site action", async () => {
      // The reported bypass: an attacker page labels its collector field as a
      // search box (operational) and points the form action at its own host.
      const performActionSpy = vi.spyOn(mockBrowser, "performAction");
      mockBrowser.url = "https://example.com/search";
      context.agentFilledRefs = new Set(["query"]);
      context.operationalRefs = new Set(["query"]);
      context.approvedRefs = new Set<string>();
      mockBrowser.formSubmissionContexts.set("submit1", {
        submitterRef: "submit1",
        formId: "search",
        actionUrl: "https://attacker.example/collect",
        submitterActionUrl: null,
        method: "get",
        fields: [
          {
            ref: "query",
            name: "q",
            tagName: "input",
            inputType: "search",
            autocomplete: null,
          },
        ],
      });
      tools = createWebActionTools(context);

      const result = await tools.click.execute({ ref: "submit1" });

      expect(performActionSpy).not.toHaveBeenCalled();
      expect(result.success).toBe(false);
      expect(result.error).toBe(
        "Security policy blocked submitting operational field data to a site other than the current page",
      );
    });

    it("should block enter submit when form contains unauthorized agent-filled fields", async () => {
      const formContextSpy = vi.spyOn(mockBrowser, "getFormSubmissionContext");
      const performActionSpy = vi.spyOn(mockBrowser, "performAction");
      context.agentFilledRefs = new Set(["message"]);
      context.operationalRefs = new Set<string>();
      context.approvedRefs = new Set<string>();
      mockBrowser.formSubmissionContexts.set("input1", {
        submitterRef: "input1",
        formId: "contact",
        actionUrl: "https://example.com/contact",
        submitterActionUrl: null,
        method: "post",
        fields: [
          {
            ref: "message",
            name: "message",
            tagName: "textarea",
            inputType: null,
            autocomplete: null,
          },
        ],
      });
      tools = createWebActionTools(context);

      const result = await tools.enter.execute({ ref: "input1" });

      expect(formContextSpy).toHaveBeenCalledWith("input1", "enter");
      expect(performActionSpy).not.toHaveBeenCalled();
      expect(result.success).toBe(false);
      expect(result.error).toBe(
        "Security policy blocked submitting a form containing unauthorized agent-filled data",
      );
    });

    it("should execute back action successfully", async () => {
      const performActionSpy = vi.spyOn(mockBrowser, "performAction");

      // Manually set the mock browser state since goBack is called within performAction
      mockBrowser.url = "https://previous.com";
      mockBrowser.title = "Previous Page";

      const emitSpy = vi.spyOn(eventEmitter, "emit");

      const result = await tools.back.execute({});

      expect(performActionSpy).toHaveBeenCalledWith("", PageAction.Back, undefined);

      // Find the BROWSER_NAVIGATED event call
      const navigatedCall = emitSpy.mock.calls.find(
        (call) => call[0] === WebAgentEventType.BROWSER_NAVIGATED,
      );
      expect(navigatedCall).toBeDefined();
      expect(navigatedCall![1]).toEqual({
        title: "Previous Page",
        url: "https://previous.com",
      });

      expect(result).toEqual({
        success: true,
        action: "back",
      });
    });

    it("should execute forward action successfully", async () => {
      const performActionSpy = vi.spyOn(mockBrowser, "performAction");

      // Manually set the mock browser state since goForward is called within performAction
      mockBrowser.url = "https://next.com";
      mockBrowser.title = "Next Page";

      const emitSpy = vi.spyOn(eventEmitter, "emit");

      const result = await tools.forward.execute({});

      expect(performActionSpy).toHaveBeenCalledWith("", PageAction.Forward, undefined);

      // Find the BROWSER_NAVIGATED event call
      const navigatedCall = emitSpy.mock.calls.find(
        (call) => call[0] === WebAgentEventType.BROWSER_NAVIGATED,
      );
      expect(navigatedCall).toBeDefined();
      expect(navigatedCall![1]).toEqual({
        title: "Next Page",
        url: "https://next.com",
      });

      expect(result).toEqual({
        success: true,
        action: "forward",
      });
    });
  });

  describe("Extract Action", () => {
    it("should execute extract action successfully", async () => {
      const getMarkdownSpy = vi.spyOn(mockBrowser, "getMarkdown");
      const emitSpy = vi.spyOn(eventEmitter, "emit");

      mockGenerateTextWithRetry.mockResolvedValueOnce({
        text: "Extracted data: Important info",
      } as any);

      const result = await tools.extract.execute({ description: "Get important info" });

      expect(getMarkdownSpy).toHaveBeenCalled();
      expect(mockGenerateTextWithRetry).toHaveBeenCalledWith(
        {
          model: { specificationVersion: "v1" }, // providerConfig.model
          prompt: expect.stringContaining("Get important info"),
          maxOutputTokens: 5000,
          abortSignal: undefined,
        },
        expect.objectContaining({
          maxAttempts: 3,
        }),
      );
      expect(emitSpy).toHaveBeenCalledWith(WebAgentEventType.AGENT_ACTION, {
        action: "extract",
        ref: undefined,
        value: "Get important info",
      });
      expect(emitSpy).toHaveBeenCalledWith(WebAgentEventType.AGENT_EXTRACTED, {
        extractedData: "Extracted data: Important info",
      });
      expect(result.success).toBe(true);
      expect((result as any).action).toBe("extract");
      expect((result as any).description).toBe("Get important info");
      expect((result as any).extractedData).toContain("Extracted data: Important info");
    });

    it('wraps extractedData in <EXTERNAL-CONTENT label="extract-result"> with safety warning', async () => {
      mockGenerateTextWithRetry.mockResolvedValueOnce({
        text: "Hello from the page",
      } as any);

      const result = await tools.extract.execute({ description: "what's on the page?" });

      // Wrapper structure present
      const extracted = (result as any).extractedData as string;
      expect(extracted).toMatch(
        /<EXTERNAL-CONTENT label="extract-result">[\s\S]*<\/EXTERNAL-CONTENT>/,
      );
      // Payload preserved (inside the wrap)
      expect(extracted).toContain("Hello from the page");
      // Warning appears AFTER the closing tag, not just anywhere in the string.
      const closeIdx = extracted.indexOf("</EXTERNAL-CONTENT>");
      const warnIdx = extracted.indexOf("**IMPORTANT:**", closeIdx);
      expect(warnIdx).toBeGreaterThan(closeIdx);
    });

    it("should handle abort signal in extract", async () => {
      const controller = new AbortController();
      const contextWithAbort = { ...context, abortSignal: controller.signal };
      const toolsWithAbort = createWebActionTools(contextWithAbort);

      mockGenerateTextWithRetry.mockResolvedValueOnce({
        text: "Extracted",
      } as any);

      if (toolsWithAbort.extract.execute) {
        await toolsWithAbort.extract.execute({ description: "Test" }, {} as any);
      }

      expect(mockGenerateTextWithRetry).toHaveBeenCalledWith(
        expect.objectContaining({
          abortSignal: controller.signal,
        }),
        expect.any(Object),
      );
    });

    it("should route through generateObject when outputSchema is provided", async () => {
      const getMarkdownSpy = vi.spyOn(mockBrowser, "getMarkdown");
      const emitSpy = vi.spyOn(eventEmitter, "emit");

      const extracted = { title: "Hello", price: 9.99 };
      mockGenerateObjectWithRetry.mockResolvedValueOnce({
        object: extracted,
      } as any);

      const userSchema = {
        type: "object",
        properties: {
          title: { type: "string" },
          price: { type: "number" },
        },
        required: ["title", "price"],
      };

      const result = await tools.extract.execute({
        description: "product details",
        outputSchema: userSchema,
      });

      expect(getMarkdownSpy).toHaveBeenCalled();
      // generateTextWithRetry should NOT have been called in the structured branch
      expect(mockGenerateTextWithRetry).not.toHaveBeenCalled();
      // generateObjectWithRetry should be called with the wrapped schema (marker from
      // the jsonSchema() mock) and the provider/prompt/abort settings.
      expect(mockGenerateObjectWithRetry).toHaveBeenCalledWith(
        {
          model: { specificationVersion: "v1" },
          prompt: expect.stringContaining("product details"),
          schema: { __jsonSchema: true, schema: userSchema },
          maxOutputTokens: 5000,
          abortSignal: undefined,
        },
        expect.objectContaining({
          maxAttempts: 3,
          onRetry: expect.any(Function),
        }),
      );

      expect(emitSpy).toHaveBeenCalledWith(WebAgentEventType.AGENT_ACTION, {
        action: "extract",
        ref: undefined,
        value: "product details",
      });
      expect(emitSpy).toHaveBeenCalledWith(WebAgentEventType.AGENT_EXTRACTED, {
        extractedData: JSON.stringify(extracted),
      });

      expect(result).toEqual({
        success: true,
        action: "extract",
        description: "product details",
        data: extracted,
      });
      // The structured branch returns `data`, not `extractedData`.
      expect((result as any).extractedData).toBeUndefined();
    });

    it("should silently downgrade empty outputSchema {} to the markdown branch", async () => {
      const getMarkdownSpy = vi.spyOn(mockBrowser, "getMarkdown");
      const emitSpy = vi.spyOn(eventEmitter, "emit");
      mockGenerateTextWithRetry.mockResolvedValueOnce({
        text: "markdown extracted",
      } as any);

      const result = await tools.extract.execute({
        description: "product details",
        outputSchema: {},
      });

      // generateObjectWithRetry should NOT be called — empty schema falls through.
      expect(mockGenerateObjectWithRetry).not.toHaveBeenCalled();
      // generateTextWithRetry IS called (markdown branch took over).
      expect(mockGenerateTextWithRetry).toHaveBeenCalledTimes(1);
      // getMarkdown is also called as part of the normal markdown path.
      expect(getMarkdownSpy).toHaveBeenCalled();

      // A status event should explain the silent downgrade.
      expect(emitSpy).toHaveBeenCalledWith(
        WebAgentEventType.AGENT_STATUS,
        expect.objectContaining({
          message: expect.stringMatching(/outputSchema was empty.*markdown/i),
        }),
      );

      // Result shape matches the markdown branch (extractedData, not data).
      expect(result).toEqual({
        success: true,
        action: "extract",
        description: "product details",
        extractedData: wrapExternalContentWithWarning(
          "markdown extracted",
          ExternalContentLabel.ExtractResult,
        ),
      });
      expect((result as any).data).toBeUndefined();
    });

    it("should still use generateText (markdown branch) when outputSchema is omitted", async () => {
      mockGenerateTextWithRetry.mockResolvedValueOnce({
        text: "markdown extracted",
      } as any);

      const result = await tools.extract.execute({ description: "Get info" });

      // generateObjectWithRetry should NOT be called in the markdown branch
      expect(mockGenerateObjectWithRetry).not.toHaveBeenCalled();
      expect(mockGenerateTextWithRetry).toHaveBeenCalledTimes(1);

      expect(result).toEqual({
        success: true,
        action: "extract",
        description: "Get info",
        extractedData: wrapExternalContentWithWarning(
          "markdown extracted",
          ExternalContentLabel.ExtractResult,
        ),
      });
      // The markdown branch returns `extractedData`, not `data`.
      expect((result as any).data).toBeUndefined();
    });

    it("should validate extract inputSchema with optional outputSchema", () => {
      const schema = tools.extract.inputSchema;

      // Just a description is valid
      const validMinimal = schema.safeParse({ description: "data" });
      expect(validMinimal.success).toBe(true);

      // Description + outputSchema is valid
      const validWithSchema = schema.safeParse({
        description: "data",
        outputSchema: { type: "object", properties: { title: { type: "string" } } },
      });
      expect(validWithSchema.success).toBe(true);

      // Missing description is invalid
      const invalid = schema.safeParse({
        outputSchema: { type: "object" },
      });
      expect(invalid.success).toBe(false);
    });

    it("passes abort signal and configured timeout to extract generation", async () => {
      const controller = new AbortController();
      context.abortSignal = controller.signal;
      context.llmProviderTimeoutMs = 45000;
      tools = createWebActionTools(context);

      mockGenerateTextWithRetry.mockResolvedValueOnce({
        text: "extracted",
      } as any);

      await tools.extract.execute({ description: "Extract page data" });

      expect(mockGenerateTextWithRetry).toHaveBeenCalledWith(
        expect.objectContaining({
          abortSignal: controller.signal,
          timeout: 45000,
        }),
        expect.any(Object),
      );
    });
  });

  describe("Terminal Actions", () => {
    it("should execute done action with terminal flag", async () => {
      const emitSpy = vi.spyOn(eventEmitter, "emit");

      const result = await tools.done.execute({
        result: "Task completed successfully",
      });

      expect(emitSpy).toHaveBeenCalledWith(WebAgentEventType.AGENT_ACTION, {
        action: "done",
        ref: undefined,
        value: "Task completed successfully",
      });
      expect(result).toEqual({
        success: true,
        action: "done",
        result: "Task completed successfully",
        isTerminal: true,
      });
    });

    it("should execute abort action with terminal flag", async () => {
      const emitSpy = vi.spyOn(eventEmitter, "emit");

      const result = await tools.abort.execute({
        reason: "Site is down, cannot proceed",
      });

      expect(emitSpy).toHaveBeenCalledWith(WebAgentEventType.AGENT_ACTION, {
        action: "abort",
        value: "Site is down, cannot proceed",
      });
      expect(result).toEqual({
        success: true,
        action: "abort",
        reason: "Site is down, cannot proceed",
        isTerminal: true,
      });
    });

    it("should validate done action input", () => {
      const schema = tools.done.inputSchema;

      const valid = schema.safeParse({ result: "Complete" });
      expect(valid.success).toBe(true);

      const invalid = schema.safeParse({});
      expect(invalid.success).toBe(false);
    });

    it("should validate abort action input", () => {
      const schema = tools.abort.inputSchema;

      const valid = schema.safeParse({ reason: "Cannot continue" });
      expect(valid.success).toBe(true);

      const invalid = schema.safeParse({});
      expect(invalid.success).toBe(false);
    });
  });

  describe("Error Handling", () => {
    it("should handle InvalidRefException with recoverable error", async () => {
      vi.spyOn(mockBrowser, "performAction").mockRejectedValueOnce(
        new InvalidRefException("missing_btn"),
      );

      const result = await tools.click.execute({ ref: "missing_btn" });

      expect(result.success).toBe(false);
      expect(result.error).toContain("Invalid element reference 'missing_btn'");
      expect(result.isRecoverable).toBe(true);
    });

    it("should handle BrowserActionException with recoverable error", async () => {
      vi.spyOn(mockBrowser, "performAction").mockRejectedValueOnce(
        new BrowserActionException("hover", "Element not visible"),
      );

      const result = await tools.hover.execute({ ref: "hidden_el" });

      expect(result.success).toBe(false);
      expect(result.error).toBe("Element not visible");
      expect(result.isRecoverable).toBe(true);
    });

    it("should preserve original error for non-browser exceptions", async () => {
      const originalError = new Error("Browser crashed");
      vi.spyOn(mockBrowser, "performAction").mockRejectedValueOnce(originalError);

      await expect(tools.fill.execute({ ref: "input1", value: "test" })).rejects.toThrow(
        "Browser crashed",
      );
    });

    it("should handle errors in navigation actions", async () => {
      vi.spyOn(mockBrowser, "performAction").mockRejectedValueOnce(
        new BrowserActionException("goto", "Navigation failed"),
      );

      const result = await tools.goto.execute({ url: "https://bad-site.com" });

      expect(result.success).toBe(false);
      expect(result.error).toBe("Navigation failed");
      expect(result.isRecoverable).toBe(true);
    });

    it("should handle errors in extract action", async () => {
      mockGenerateTextWithRetry.mockRejectedValueOnce(new Error("AI service unavailable"));

      await expect(tools.extract.execute({ description: "Get data" })).rejects.toThrow(
        "AI service unavailable",
      );
    });
  });

  describe("Schema Validation", () => {
    it("should validate all tool schemas", () => {
      // Test each tool has valid schema
      Object.entries(tools).forEach(([_name, tool]) => {
        expect((tool as any).inputSchema).toBeDefined();
        expect((tool as any).inputSchema instanceof z.ZodType).toBe(true);
      });
    });

    it("should handle empty strings in fill action", async () => {
      const performActionSpy = vi.spyOn(mockBrowser, "performAction");

      const result = await tools.fill.execute({ ref: "input1", value: "" });

      expect(performActionSpy).toHaveBeenCalledWith("input1", PageAction.Fill, "");
      expect(result.value).toBe("");
    });

    it("should handle special characters in values", async () => {
      const performActionSpy = vi.spyOn(mockBrowser, "performAction");
      const specialValue = "Test <>&\"'`\n\t value";

      const result = await tools.fill.execute({ ref: "input1", value: specialValue });

      expect(performActionSpy).toHaveBeenCalledWith("input1", PageAction.Fill, specialValue);
      expect(result.value).toBe(specialValue);
    });

    it("should handle very long text in fill action", async () => {
      const performActionSpy = vi.spyOn(mockBrowser, "performAction");
      const longText = "a".repeat(10000);

      const result = await tools.fill.execute({ ref: "input1", value: longText });

      expect(performActionSpy).toHaveBeenCalledWith("input1", PageAction.Fill, longText);
      expect(result.value).toBe(longText);
    });
  });

  describe("firewall bypass and remediation", () => {
    it("trustedHostnames allows freeform fill on a trusted page", async () => {
      mockBrowser.url = "https://example.com/page";
      mockBrowser.fieldMetadata.set("ref-1", {
        ref: "ref-1",
        tagName: "textarea",
        inputType: null,
        role: null,
        name: "comment",
        label: "Comment",
        placeholder: null,
        autocomplete: null,
        isContentEditable: false,
        formId: null,
        formAction: null,
        formMethod: null,
      });
      const performSpy = vi.spyOn(mockBrowser, "performAction");
      const trustedContext = {
        ...context,
        firewall: { trustedHostnames: new Set(["example.com"]), unsafeMode: false },
      };
      const trustedTools: any = createWebActionTools(trustedContext);

      const result = await trustedTools.fill.execute({ ref: "ref-1", value: "hi" });
      expect(result.success).toBe(true);
      expect(performSpy).toHaveBeenCalled();
    });

    it("unsafeMode allows fill of any field on any page", async () => {
      mockBrowser.url = "https://attacker.com/";
      mockBrowser.fieldMetadata.set("ref-1", {
        ref: "ref-1",
        tagName: "textarea",
        inputType: null,
        role: null,
        name: "comment",
        label: "Comment",
        placeholder: null,
        autocomplete: null,
        isContentEditable: false,
        formId: null,
        formAction: null,
        formMethod: null,
      });
      const performSpy = vi.spyOn(mockBrowser, "performAction");
      const unsafeContext = {
        ...context,
        firewall: { trustedHostnames: new Set<string>(), unsafeMode: true },
      };
      const unsafeTools: any = createWebActionTools(unsafeContext);

      const result = await unsafeTools.fill.execute({ ref: "ref-1", value: "hi" });
      expect(result.success).toBe(true);
      expect(performSpy).toHaveBeenCalled();
    });

    it("emits FIREWALL_BLOCKED_NON_INTERACTIVE on fill block when interactive=false", async () => {
      mockBrowser.url = "https://untrusted.com/";
      mockBrowser.fieldMetadata.set("ref-1", {
        ref: "ref-1",
        tagName: "textarea",
        inputType: null,
        role: null,
        name: "comment",
        label: "Comment",
        placeholder: null,
        autocomplete: null,
        isContentEditable: false,
        formId: null,
        formAction: null,
        formMethod: null,
      });
      const performSpy = vi.spyOn(mockBrowser, "performAction");
      const events: unknown[] = [];
      eventEmitter.on(WebAgentEventType.FIREWALL_BLOCKED_NON_INTERACTIVE, (data) =>
        events.push(data),
      );

      const result = await tools.fill.execute({ ref: "ref-1", value: "hi" });
      expect(result.success).toBe(false);
      expect(performSpy).not.toHaveBeenCalled();
      expect(events).toHaveLength(1);
      const data = events[0] as {
        kind: string;
        pageHostname: string | null;
        formActionHostnames: string[];
        reason: string;
        timestamp: number;
        remediations: Array<{ kind: string; hostnames?: string[]; description: string }>;
      };
      expect(data.kind).toBe("freeform-fill");
      expect(data.pageHostname).toBe("untrusted.com");
      expect(data.formActionHostnames).toEqual([]);
      expect(typeof data.reason).toBe("string");
      expect(data.reason.length).toBeGreaterThan(0);
      expect(typeof data.timestamp).toBe("number");
      expect(data.remediations.map((r) => r.kind).sort()).toEqual(
        ["add-trusted-hostnames", "enable-interactive-mode", "enable-unsafe-mode"].sort(),
      );
      const trusted = data.remediations.find((r) => r.kind === "add-trusted-hostnames");
      expect(trusted?.hostnames).toEqual(["untrusted.com"]);
    });

    it("does NOT emit FIREWALL_BLOCKED_NON_INTERACTIVE when interactive=true", async () => {
      mockBrowser.url = "https://untrusted.com/";
      mockBrowser.fieldMetadata.set("ref-1", {
        ref: "ref-1",
        tagName: "textarea",
        inputType: null,
        role: null,
        name: "comment",
        label: "Comment",
        placeholder: null,
        autocomplete: null,
        isContentEditable: false,
        formId: null,
        formAction: null,
        formMethod: null,
      });
      const events: unknown[] = [];
      eventEmitter.on(WebAgentEventType.FIREWALL_BLOCKED_NON_INTERACTIVE, (data) =>
        events.push(data),
      );
      const interactiveContext = { ...context, interactive: true };
      const interactiveTools: any = createWebActionTools(interactiveContext);

      const result = await interactiveTools.fill.execute({ ref: "ref-1", value: "hi" });
      expect(result.success).toBe(false);
      expect(events).toHaveLength(0);
    });

    it("model-visible error string does not include unsafe_mode or trusted_hostnames", async () => {
      mockBrowser.url = "https://untrusted.com/";
      mockBrowser.fieldMetadata.set("ref-1", {
        ref: "ref-1",
        tagName: "textarea",
        inputType: null,
        role: null,
        name: "comment",
        label: "Comment",
        placeholder: null,
        autocomplete: null,
        isContentEditable: false,
        formId: null,
        formAction: null,
        formMethod: null,
      });
      const result = await tools.fill.execute({ ref: "ref-1", value: "hi" });
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.error).not.toMatch(/unsafe_mode|trusted_hostnames|untrusted\.com/);
    });
  });
});
