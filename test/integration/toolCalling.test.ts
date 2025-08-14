/**
 * Integration tests for tool calling improvements
 *
 * Tests the complete flow of:
 * - Tool call preservation in message history
 * - Invalid tool call recovery
 * - JSON parsing for malformed responses
 * - LLM usage tracking for all calls
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { WebAgent } from "../../src/webAgent.js";
import { AriaBrowser } from "../../src/browser/ariaBrowser.js";
import { WebAgentEventEmitter, WebAgentEventType } from "../../src/events.js";
import { generateText } from "ai";

// Mock the AI module
vi.mock("ai", () => ({
  generateText: vi.fn(),
}));

const mockGenerateText = vi.mocked(generateText);

// Minimal mock browser for integration tests
class TestBrowser implements AriaBrowser {
  browserName = "test-browser";
  async start(): Promise<void> {}
  async shutdown(): Promise<void> {}
  async goto(url: string): Promise<void> {}
  async goBack(): Promise<void> {}
  async goForward(): Promise<void> {}
  async getUrl(): Promise<string> {
    return "https://test.com";
  }
  async getTitle(): Promise<string> {
    return "Test Page";
  }
  async getTreeWithRefs(): Promise<string> {
    return "[ref=btn1] Button";
  }
  async getMarkdown(): Promise<string> {
    return "# Test";
  }
  async getScreenshot(): Promise<Buffer> {
    return Buffer.from("");
  }
  async performAction(): Promise<void> {}
  async waitForLoadState(): Promise<void> {}
}

describe("Tool Calling Integration", () => {
  let browser: TestBrowser;
  let eventEmitter: WebAgentEventEmitter;
  let events: Array<{ type: string; data: any }>;

  beforeEach(() => {
    vi.clearAllMocks();
    browser = new TestBrowser();
    eventEmitter = new WebAgentEventEmitter();
    events = [];

    // Capture all events
    Object.values(WebAgentEventType).forEach((eventType) => {
      eventEmitter.on(eventType, (data) => {
        events.push({ type: eventType, data });
      });
    });
  });

  it("should handle complete flow with malformed responses and recovery", async () => {
    const agent = new WebAgent(browser, {
      provider: { specificationVersion: "v1" } as any,
      eventEmitter,
    });

    // 1. Planning phase - normal response
    mockGenerateText.mockResolvedValueOnce({
      text: "I'll complete this task",
      toolCalls: [
        {
          toolCallId: "plan_1",
          toolName: "create_plan",
          args: {
            explanation: "Test task",
            plan: "1. Click button\n2. Extract result",
          },
        },
      ],
      finishReason: "stop",
      usage: { promptTokens: 100, completionTokens: 50 },
    } as any);

    // 2. First action - invalid tool name (will be rejected by SDK)
    mockGenerateText.mockRejectedValueOnce(
      new Error("Invalid arguments for unavailable tool 'invalid_action'"),
    );

    // 3. Retry with valid tool but malformed response (repeated JSON)
    mockGenerateText.mockImplementationOnce(async () => {
      // Simulate a model that repeats JSON
      throw new Error(`Invalid arguments for tool click: Text: {"ref": "btn1"}{"ref": "btn1"}`);
    });

    // 4. Third attempt succeeds
    mockGenerateText.mockResolvedValueOnce({
      text: "Clicking the button",
      toolCalls: [
        {
          toolCallId: "click_1",
          toolName: "click",
          args: { ref: "btn1" },
        },
      ],
      finishReason: "stop",
      usage: { promptTokens: 150, completionTokens: 30 },
    } as any);

    // 5. Model responds without tool calls
    mockGenerateText.mockResolvedValueOnce({
      text: "Let me think about this",
      toolCalls: [],
      finishReason: "stop",
      usage: { promptTokens: 200, completionTokens: 20 },
    } as any);

    // 6. Extract action
    mockGenerateText.mockResolvedValueOnce({
      text: "Extracting data",
      toolCalls: [
        {
          toolCallId: "extract_1",
          toolName: "extract",
          args: { description: "Get result text" },
        },
      ],
    } as any);

    // 7. Extraction result
    mockGenerateText.mockResolvedValueOnce({
      text: "Success! Task completed",
    } as any);

    // 8. Done action
    mockGenerateText.mockResolvedValueOnce({
      text: "Task complete",
      toolCalls: [
        {
          toolCallId: "done_1",
          toolName: "done",
          args: { result: "Successfully clicked button and extracted result" },
        },
      ],
    } as any);

    // 9. Validation with malformed response
    mockGenerateText.mockImplementationOnce(async () => {
      // Simulate repeated JSON in validation
      throw new Error(
        `Invalid arguments for tool validate_task: Text: {"completionQuality": "complete", "taskAssessment": "Good"}{"completionQuality": "complete", "taskAssessment": "Good"}`,
      );
    });

    // 10. Validation retry succeeds
    mockGenerateText.mockResolvedValueOnce({
      text: "Valid",
      toolCalls: [
        {
          toolCallId: "validate_1",
          toolName: "validate_task",
          args: {
            completionQuality: "complete",
            taskAssessment: "Task completed successfully",
          },
        },
      ],
    } as any);

    // Execute the task
    const result = await agent.execute("Click button and extract result", {
      startingUrl: "https://test.com",
    });

    // Verify successful completion
    expect(result.success).toBe(true);
    expect(result.finalAnswer).toBe("Successfully clicked button and extracted result");

    // Verify AI_GENERATION events were emitted for ALL attempts
    const aiGenEvents = events.filter((e) => e.type === WebAgentEventType.AI_GENERATION);

    // Should have events for:
    // - Failed invalid tool attempt
    // - Successful actions
    expect(aiGenEvents.length).toBeGreaterThanOrEqual(4);

    // Check that failed attempts have error info
    const failedEvent = aiGenEvents.find((e) => e.data.error);
    expect(failedEvent).toBeDefined();
    expect(failedEvent?.data.object).toBeNull();
    expect(failedEvent?.data.finishReason).toBe("error");

    // Check that successful attempts have tool call info
    const successEvents = aiGenEvents.filter((e) => e.data.object);
    expect(successEvents.length).toBeGreaterThan(0);
    expect(successEvents[0].data.object.toolName).toBeDefined();

    // Verify proper message structure was maintained
    const lastCall = mockGenerateText.mock.calls[mockGenerateText.mock.calls.length - 1];
    if (lastCall && lastCall[0].messages) {
      const messages = lastCall[0].messages;

      // Should have tool results linking back to tool calls
      const toolMessages = messages.filter((m: any) => m.role === "tool");
      const assistantMessages = messages.filter((m: any) => m.role === "assistant");

      // Each tool message should reference a tool call
      toolMessages.forEach((toolMsg: any) => {
        expect(toolMsg.content[0].type).toBe("tool-result");
        expect(toolMsg.content[0].toolCallId).toBeDefined();
        expect(toolMsg.content[0].toolName).toBeDefined();
      });

      // Assistant messages with tool calls should preserve them
      const assistantWithTools = assistantMessages.filter((m: any) => m.toolCalls);
      assistantWithTools.forEach((msg: any) => {
        expect(Array.isArray(msg.toolCalls)).toBe(true);
        expect(msg.toolCalls[0].toolCallId).toBeDefined();
      });
    }

    // Verify extraction was handled properly
    const extractEvent = events.find(
      (e) => e.type === WebAgentEventType.AGENT_ACTION && e.data.action === "extract",
    );
    expect(extractEvent).toBeDefined();

    // Verify the agent observed reasoning text
    const observedEvents = events.filter((e) => e.type === WebAgentEventType.AGENT_OBSERVED);
    expect(observedEvents.length).toBeGreaterThan(0);

    await agent.close();
  });

  it("should track LLM usage even when models don't support tools", async () => {
    const agent = new WebAgent(browser, {
      provider: { specificationVersion: "v1" } as any,
      eventEmitter,
    });

    // Planning fails - model doesn't support tools
    mockGenerateText.mockRejectedValueOnce(
      new Error("Bad Request: This model doesn't support tool calling"),
    );

    // Fallback planning succeeds
    mockGenerateText.mockResolvedValueOnce({
      text: "Planning",
      toolCalls: [
        {
          toolCallId: "plan_1",
          toolName: "create_plan_with_url",
          args: {
            explanation: "Test",
            plan: "1. Test",
            url: "https://test.com",
          },
        },
      ],
    } as any);

    // Action attempt fails
    mockGenerateText.mockRejectedValueOnce(new Error("Bad Request: Model error"));

    // Recovery succeeds
    mockGenerateText.mockResolvedValueOnce({
      text: "Done",
      toolCalls: [
        {
          toolCallId: "done_1",
          toolName: "done",
          args: { result: "Complete" },
        },
      ],
    } as any);

    // Validation
    mockGenerateText.mockResolvedValueOnce({
      text: "Valid",
      toolCalls: [
        {
          toolCallId: "validate_1",
          toolName: "validate_task",
          args: {
            completionQuality: "complete",
            taskAssessment: "Done",
          },
        },
      ],
    } as any);

    const result = await agent.execute("Test task");

    // Should complete successfully despite errors
    expect(result.success).toBe(true);

    // Verify AI_GENERATION events for failed attempts
    const aiGenEvents = events.filter((e) => e.type === WebAgentEventType.AI_GENERATION);
    const failedEvents = aiGenEvents.filter((e) => e.data.error);

    // Should have tracked the failed attempts
    expect(failedEvents.length).toBeGreaterThanOrEqual(2);
    failedEvents.forEach((event) => {
      expect(event.data.usage).toBeNull();
      expect(event.data.object).toBeNull();
      expect(event.data.finishReason).toBe("error");
    });

    await agent.close();
  });
});
