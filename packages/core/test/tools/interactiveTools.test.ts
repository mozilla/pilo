import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  createInteractiveTools,
  ApprovedRefs,
  FILL_GATE_ERROR,
} from "../../src/tools/interactiveTools.js";
import { WebAgentEventEmitter, WebAgentEventType } from "../../src/events.js";
import type { AriaBrowser } from "../../src/browser/ariaBrowser.js";
import type { UserDataCallback, UserDataResponse } from "../../src/types/interactive.js";

// Mock the ai module (same pattern as other tool tests)
vi.mock("ai", () => ({
  tool: vi.fn((config: unknown) => {
    const typedConfig = config as {
      description: string;
      inputSchema: unknown;
      execute: (args: unknown, options?: unknown) => Promise<unknown>;
    };
    return {
      ...typedConfig,
      description: typedConfig.description,
      inputSchema: typedConfig.inputSchema,
      execute: typedConfig.execute,
    };
  }),
}));

function createMockBrowser(): AriaBrowser {
  return {
    getUrl: vi.fn().mockResolvedValue("https://example.com/signup"),
    getTitle: vi.fn().mockResolvedValue("Sign Up - Example"),
    performAction: vi.fn().mockResolvedValue(undefined),
  } as unknown as AriaBrowser;
}

const toolCallOptions = { toolCallId: "test", messages: [] } as any;

describe("InteractiveTools", () => {
  let mockBrowser: AriaBrowser;
  let eventEmitter: WebAgentEventEmitter;
  let mockCallback: ReturnType<typeof vi.fn<UserDataCallback>>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockBrowser = createMockBrowser();
    eventEmitter = new WebAgentEventEmitter();
    mockCallback = vi.fn<UserDataCallback>();
  });

  describe("Tool Structure", () => {
    it("should create request_user_data tool", () => {
      const { tools } = createInteractiveTools({
        callback: mockCallback,
        browser: mockBrowser,
        eventEmitter,
      });
      expect(tools.request_user_data).toBeDefined();
      expect(tools.request_user_data.description).toContain("personal");
    });

    it("should return an ApprovedRefs instance", () => {
      const { approvedRefs } = createInteractiveTools({
        callback: mockCallback,
        browser: mockBrowser,
        eventEmitter,
      });
      expect(approvedRefs).toBeInstanceOf(ApprovedRefs);
    });
  });

  describe("request_user_data", () => {
    it("should call callback with correct request shape", async () => {
      const response: UserDataResponse = {
        requestId: "any",
        fields: [{ ref: "E42", value: "test@example.com" }],
      };
      mockCallback.mockResolvedValue(response);

      const { tools } = createInteractiveTools({
        callback: mockCallback,
        browser: mockBrowser,
        eventEmitter,
      });

      await tools.request_user_data.execute!(
        {
          reason: "initial",
          formDescription: "Signup form",
          fields: [{ ref: "E42", label: "Email", fieldType: "email", required: true }],
        },
        toolCallOptions,
      );

      expect(mockCallback).toHaveBeenCalledOnce();
      const request = mockCallback.mock.calls[0][0];
      expect(request.pageUrl).toBe("https://example.com/signup");
      expect(request.pageTitle).toBe("Sign Up - Example");
      expect(request.formDescription).toBe("Signup form");
      // reason is not on the request payload (it drives event selection instead)
      expect(request.fields).toHaveLength(1);
      expect(request.fields[0].ref).toBe("E42");
      expect(request.requestId).toBeTruthy();
    });

    it("should pass validation_error reason through to callback", async () => {
      mockCallback.mockResolvedValue({
        requestId: "any",
        fields: [{ ref: "E42", value: "valid@example.com" }],
      });

      const { tools } = createInteractiveTools({
        callback: mockCallback,
        browser: mockBrowser,
        eventEmitter,
      });

      await tools.request_user_data.execute!(
        {
          reason: "validation_error",
          formDescription: "Signup form",
          fields: [
            {
              ref: "E42",
              label: "Email",
              fieldType: "email",
              required: true,
              description: "Invalid email address",
            },
          ],
        },
        toolCallOptions,
      );

      const request = mockCallback.mock.calls[0][0];
      // reason is not on the request payload
      expect(request.fields[0].description).toBe("Invalid email address");
    });

    it("should fill fields directly via browser on success", async () => {
      mockCallback.mockResolvedValue({
        requestId: "any",
        fields: [
          { ref: "E42", value: "test@example.com" },
          { ref: "E43", value: "John" },
        ],
      });

      const { tools } = createInteractiveTools({
        callback: mockCallback,
        browser: mockBrowser,
        eventEmitter,
      });

      const result = (await tools.request_user_data.execute!(
        {
          reason: "initial",
          formDescription: "Signup form",
          fields: [
            { ref: "E42", label: "Email", fieldType: "email", required: true },
            { ref: "E43", label: "Name", fieldType: "text", required: true },
          ],
        },
        toolCallOptions,
      )) as any;

      expect(result.success).toBe(true);
      expect(result.filledCount).toBe(2);
      // Values should NOT be in the result (privacy)
      expect(result.fieldValues).toBeUndefined();

      // Browser should have been called directly
      const performAction = vi.mocked(mockBrowser.performAction!);
      expect(performAction).toHaveBeenCalledTimes(2);
      expect(performAction).toHaveBeenCalledWith("E42", "fill", "test@example.com");
      expect(performAction).toHaveBeenCalledWith("E43", "fill", "John");
    });

    it("should use correct action for select fields", async () => {
      mockCallback.mockResolvedValue({
        requestId: "any",
        fields: [{ ref: "E50", value: "premium" }],
      });

      const { tools } = createInteractiveTools({
        callback: mockCallback,
        browser: mockBrowser,
        eventEmitter,
      });

      await tools.request_user_data.execute!(
        {
          reason: "initial",
          formDescription: "Plan selection",
          fields: [
            {
              ref: "E50",
              label: "Plan",
              fieldType: "select",
              required: true,
              options: ["free", "premium"],
            },
          ],
        },
        toolCallOptions,
      );

      const performAction = vi.mocked(mockBrowser.performAction!);
      expect(performAction).toHaveBeenCalledWith("E50", "select", "premium");
    });

    it("should use check action for checkbox fields", async () => {
      mockCallback.mockResolvedValue({
        requestId: "any",
        fields: [{ ref: "E55", value: "true" }],
      });

      const { tools } = createInteractiveTools({
        callback: mockCallback,
        browser: mockBrowser,
        eventEmitter,
      });

      await tools.request_user_data.execute!(
        {
          reason: "initial",
          formDescription: "Terms agreement",
          fields: [{ ref: "E55", label: "I agree", fieldType: "checkbox", required: true }],
        },
        toolCallOptions,
      );

      const performAction = vi.mocked(mockBrowser.performAction!);
      expect(performAction).toHaveBeenCalledWith("E55", "check", "true");
    });

    it("should return cancellation result when cancelled", async () => {
      mockCallback.mockResolvedValue({
        requestId: "any",
        fields: [],
        cancelled: true,
      });

      const { tools } = createInteractiveTools({
        callback: mockCallback,
        browser: mockBrowser,
        eventEmitter,
      });

      const result = (await tools.request_user_data.execute!(
        {
          reason: "initial",
          formDescription: "Signup form",
          fields: [{ ref: "E42", label: "Email", fieldType: "email", required: true }],
        },
        toolCallOptions,
      )) as any;

      expect(result.success).toBe(false);
      expect(result.cancelled).toBe(true);
      expect(result.message).toContain("abort");
    });

    it("should track approved refs after successful response", async () => {
      mockCallback.mockResolvedValue({
        requestId: "any",
        fields: [
          { ref: "E42", value: "test@example.com" },
          { ref: "E43", value: "John" },
        ],
      });

      const { tools, approvedRefs } = createInteractiveTools({
        callback: mockCallback,
        browser: mockBrowser,
        eventEmitter,
      });

      expect(approvedRefs.has("E42")).toBe(false);
      expect(approvedRefs.has("E43")).toBe(false);

      await tools.request_user_data.execute!(
        {
          reason: "initial",
          formDescription: "Signup form",
          fields: [
            { ref: "E42", label: "Email", fieldType: "email", required: true },
            { ref: "E43", label: "Name", fieldType: "text", required: true },
          ],
        },
        toolCallOptions,
      );

      expect(approvedRefs.has("E42")).toBe(true);
      expect(approvedRefs.has("E43")).toBe(true);
    });

    it("should NOT track refs when cancelled", async () => {
      mockCallback.mockResolvedValue({
        requestId: "any",
        fields: [],
        cancelled: true,
      });

      const { tools, approvedRefs } = createInteractiveTools({
        callback: mockCallback,
        browser: mockBrowser,
        eventEmitter,
      });

      await tools.request_user_data.execute!(
        {
          reason: "initial",
          formDescription: "Signup form",
          fields: [{ ref: "E42", label: "Email", fieldType: "email", required: true }],
        },
        toolCallOptions,
      );

      expect(approvedRefs.has("E42")).toBe(false);
    });

    it("should emit INTERACTIVE_FORM_DATA_REQUEST event", async () => {
      mockCallback.mockResolvedValue({
        requestId: "any",
        fields: [{ ref: "E42", value: "test@example.com" }],
      });

      const eventSpy = vi.fn();
      eventEmitter.on(WebAgentEventType.INTERACTIVE_FORM_DATA_REQUEST, eventSpy);

      const { tools } = createInteractiveTools({
        callback: mockCallback,
        browser: mockBrowser,
        eventEmitter,
      });

      await tools.request_user_data.execute!(
        {
          reason: "initial",
          formDescription: "Signup form",
          fields: [{ ref: "E42", label: "Email", fieldType: "email", required: true }],
        },
        toolCallOptions,
      );

      expect(eventSpy).toHaveBeenCalledOnce();
      const eventData = eventSpy.mock.calls[0][0];
      expect(eventData.pageUrl).toBe("https://example.com/signup");
      expect(eventData.formDescription).toBe("Signup form");
      expect(eventData.fields).toHaveLength(1);
      expect(eventData.fields[0].ref).toBe("E42");
    });

    it("should emit INTERACTIVE_FORM_DATA_ERROR when callback throws", async () => {
      mockCallback.mockRejectedValue(new Error("Connection lost"));

      const eventSpy = vi.fn();
      eventEmitter.on(WebAgentEventType.INTERACTIVE_FORM_DATA_ERROR, eventSpy);

      const { tools } = createInteractiveTools({
        callback: mockCallback,
        browser: mockBrowser,
        eventEmitter,
      });

      await expect(
        tools.request_user_data.execute!(
          {
            reason: "initial",
            formDescription: "Signup form",
            fields: [{ ref: "E42", label: "Email", fieldType: "email", required: true }],
          },
          toolCallOptions,
        ),
      ).rejects.toThrow("Connection lost");

      expect(eventSpy).toHaveBeenCalledOnce();
      const eventData = eventSpy.mock.calls[0][0];
      expect(eventData.fieldErrors._callback).toBe("Connection lost");
      expect(eventData.formDescription).toBe("Signup form");
    });

    it("should emit INTERACTIVE_FORM_DATA_ERROR for validation_error reason", async () => {
      mockCallback.mockResolvedValue({
        requestId: "any",
        fields: [{ ref: "E42", value: "valid@example.com" }],
      });

      const eventSpy = vi.fn();
      eventEmitter.on(WebAgentEventType.INTERACTIVE_FORM_DATA_ERROR, eventSpy);

      const { tools } = createInteractiveTools({
        callback: mockCallback,
        browser: mockBrowser,
        eventEmitter,
      });

      await tools.request_user_data.execute!(
        {
          reason: "validation_error",
          formDescription: "Signup form",
          fields: [
            {
              ref: "E42",
              label: "Email",
              fieldType: "email",
              required: true,
              description: "Invalid email address",
            },
          ],
        },
        toolCallOptions,
      );

      expect(eventSpy).toHaveBeenCalledOnce();
      const eventData = eventSpy.mock.calls[0][0];
      expect(eventData.fieldErrors).toEqual({ E42: "Invalid email address" });
      expect(eventData.fields).toHaveLength(1);
      expect(eventData.fields[0].ref).toBe("E42");
    });
  });
});

describe("ApprovedRefs", () => {
  it("should track added refs", () => {
    const refs = new ApprovedRefs();
    expect(refs.has("E1")).toBe(false);
    refs.add("E1");
    expect(refs.has("E1")).toBe(true);
  });

  it("should clear all refs", () => {
    const refs = new ApprovedRefs();
    refs.add("E1");
    refs.add("E2");
    refs.clear();
    expect(refs.has("E1")).toBe(false);
    expect(refs.has("E2")).toBe(false);
  });
});

describe("FILL_GATE_ERROR", () => {
  it("should mention request_user_data", () => {
    expect(FILL_GATE_ERROR).toContain("request_user_data");
  });

  it("should mention navigation/search as escape hatch", () => {
    expect(FILL_GATE_ERROR).toContain("navigation/search");
  });
});
