import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createWebActionTools } from "../../src/tools/webActionTools.js";
import { AriaBrowser, PageAction } from "../../src/browser/ariaBrowser.js";
import { WebAgentEventEmitter, WebAgentEventType } from "../../src/events.js";
import { LanguageModel, generateText } from "ai";
import { z } from "zod";
import { InvalidRefException, BrowserActionException } from "../../src/errors.js";

// Mock the ai module
vi.mock("ai", () => ({
  tool: vi.fn((config: any) => ({
    ...config,
    description: config.description,
    inputSchema: config.inputSchema,
    execute: config.execute,
  })),
  generateText: vi.fn(),
}));

const mockGenerateText = vi.mocked(generateText);

// Mock browser implementation
class MockBrowser implements AriaBrowser {
  browserName = "mock-browser";
  public url = "https://example.com";
  public title = "Example Page";

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

  async waitForLoadState(): Promise<void> {}
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
    };

    tools = createWebActionTools(context);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("Tool Structure", () => {
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
      expect(tools.fill_and_enter).toBeDefined();
      expect(tools.wait).toBeDefined();
      expect(tools.goto).toBeDefined();
      expect(tools.back).toBeDefined();
      expect(tools.forward).toBeDefined();
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
      expect(tools.fill_and_enter.description).toBe(
        "Fill text into an input field and press Enter (useful for search boxes)",
      );
      expect(tools.wait.description).toBe("Wait for a specified number of seconds");
      expect(tools.goto.description).toBe(
        "Navigate to a URL that was previously seen in the conversation",
      );
      expect(tools.back.description).toBe("Go back to the previous page");
      expect(tools.forward.description).toBe("Go forward to the next page");
      expect(tools.extract.description).toBe(
        "Extract specific data from the current page for later reference",
      );
      expect(tools.done.description).toContain("Mark the entire task as complete");
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

    it("should re-throw non-browser errors", async () => {
      vi.spyOn(mockBrowser, "performAction").mockRejectedValueOnce(new Error("Network error"));

      await expect(tools.click.execute({ ref: "btn1" })).rejects.toThrow("Network error");
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

  describe("Fill and Enter Action", () => {
    it("should execute fill and enter action successfully", async () => {
      const performActionSpy = vi.spyOn(mockBrowser, "performAction");

      const result = await tools.fill_and_enter.execute({ ref: "search1", value: "query" });

      expect(performActionSpy).toHaveBeenCalledTimes(1);
      expect(performActionSpy).toHaveBeenCalledWith("search1", PageAction.FillAndEnter, "query");
      expect(result).toEqual({
        success: true,
        action: "fill_and_enter",
        ref: "search1",
        value: "query",
      });
    });

    it("should emit browser action events", async () => {
      const emitSpy = vi.spyOn(eventEmitter, "emit");

      await tools.fill_and_enter.execute({ ref: "search1", value: "query" });

      expect(emitSpy).toHaveBeenCalledWith(WebAgentEventType.AGENT_ACTION, {
        action: "fill_and_enter",
        ref: "search1",
        value: "query",
      });
      expect(emitSpy).toHaveBeenCalledWith(WebAgentEventType.BROWSER_ACTION_STARTED, {
        action: "fill_and_enter",
        ref: "search1",
        value: "query",
      });
      expect(emitSpy).toHaveBeenCalledWith(WebAgentEventType.BROWSER_ACTION_COMPLETED, {
        success: true,
        action: "fill_and_enter",
      });
    });
  });

  describe("Wait Action", () => {
    it("should execute wait action successfully", async () => {
      const performActionSpy = vi.spyOn(mockBrowser, "performAction");
      const emitSpy = vi.spyOn(eventEmitter, "emit");

      const result = await tools.wait.execute({ seconds: 2 });

      expect(performActionSpy).toHaveBeenCalledWith("", PageAction.Wait, "2");
      expect(emitSpy).toHaveBeenCalledWith(WebAgentEventType.AGENT_WAITING, { seconds: 2 });
      expect(result).toEqual({
        success: true,
        action: "wait",
        value: "2", // performActionWithValidation adds value field
      });
    });

    it("should validate wait time constraints", () => {
      const schema = tools.wait.inputSchema;

      const valid = schema.safeParse({ seconds: 5 });
      expect(valid.success).toBe(true);

      const tooShort = schema.safeParse({ seconds: -1 });
      expect(tooShort.success).toBe(false);

      const tooLong = schema.safeParse({ seconds: 31 });
      expect(tooLong.success).toBe(false);
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

      mockGenerateText.mockResolvedValueOnce({
        text: "Extracted data: Important info",
      } as any);

      const result = await tools.extract.execute({ description: "Get important info" });

      expect(getMarkdownSpy).toHaveBeenCalled();
      expect(mockGenerateText).toHaveBeenCalledWith({
        model: { specificationVersion: "v1" }, // providerConfig.model
        prompt: expect.stringContaining("Get important info"),
        maxOutputTokens: 5000,
        abortSignal: undefined,
      });
      expect(emitSpy).toHaveBeenCalledWith(WebAgentEventType.AGENT_ACTION, {
        action: "extract",
        ref: undefined,
        value: "Get important info",
      });
      expect(emitSpy).toHaveBeenCalledWith(WebAgentEventType.AGENT_EXTRACTED, {
        extractedData: "Extracted data: Important info",
      });
      expect(result).toEqual({
        success: true,
        action: "extract",
        description: "Get important info",
        extractedData: "Extracted data: Important info",
      });
    });

    it("should handle abort signal in extract", async () => {
      const controller = new AbortController();
      const contextWithAbort = { ...context, abortSignal: controller.signal };
      const toolsWithAbort = createWebActionTools(contextWithAbort);

      mockGenerateText.mockResolvedValueOnce({
        text: "Extracted",
      } as any);

      if (toolsWithAbort.extract.execute) {
        await toolsWithAbort.extract.execute({ description: "Test" }, {} as any);
      }

      expect(mockGenerateText).toHaveBeenCalledWith(
        expect.objectContaining({
          abortSignal: controller.signal,
        }),
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
        description: "Site is down, cannot proceed",
      });

      expect(emitSpy).toHaveBeenCalledWith(WebAgentEventType.AGENT_ACTION, {
        action: "abort",
        ref: undefined,
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

      const valid = schema.safeParse({ description: "Cannot continue" });
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
      mockGenerateText.mockRejectedValueOnce(new Error("AI service unavailable"));

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
});
