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
  tool: vi.fn((schema: any) => ({
    description: schema.description,
    parameters: schema.parameters,
  })),
}));

const mockGenerateText = vi.mocked(generateText);

// Minimal mock browser for integration tests
class TestBrowser implements AriaBrowser {
  browserName = "test-browser";
  async start(): Promise<void> {}
  async shutdown(): Promise<void> {}
  async goto(_url: string): Promise<void> {}
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

  it.skip("should handle complete flow with malformed responses and recovery", async () => {
    const agent = new WebAgent(browser, {
      provider: { specificationVersion: "v1" } as any,
      eventEmitter,
    });

    // 1. Planning phase - normal response with proper tool result structure
    mockGenerateText.mockResolvedValueOnce({
      text: "I'll complete this task",
      toolResults: [
        {
          type: "tool-result",
          toolCallId: "plan_1",
          toolName: "create_plan",
          input: {
            explanation: "Test task",
            plan: "1. Click button\n2. Extract result",
          },
          output: {
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
      toolResults: [
        {
          type: "tool-result",
          toolCallId: "click_1",
          toolName: "click",
          input: { ref: "btn1" },
          output: {
            action: "click",
            ref: "btn1",
            isTerminal: false,
          },
        },
      ],
      response: {
        messages: [
          {
            role: "assistant",
            content: "Clicking the button",
          },
          {
            role: "tool",
            content: [
              {
                type: "tool-result",
                toolCallId: "click_1",
                toolName: "click",
                output: { action: "click", ref: "btn1" },
              },
            ],
          },
        ],
      },
      finishReason: "stop",
      usage: { promptTokens: 150, completionTokens: 30 },
    } as any);

    // 5. Model responds without tool calls
    mockGenerateText.mockResolvedValueOnce({
      text: "Let me think about this",
      toolResults: [],
      response: {
        messages: [
          {
            role: "assistant",
            content: "Let me think about this",
          },
        ],
      },
      finishReason: "stop",
      usage: { promptTokens: 200, completionTokens: 20 },
    } as any);

    // 6. Extract action
    mockGenerateText.mockResolvedValueOnce({
      text: "Extracting data",
      toolResults: [
        {
          type: "tool-result",
          toolCallId: "extract_1",
          toolName: "extract",
          input: { description: "Get result text" },
          output: {
            action: "extract",
            description: "Get result text",
            isTerminal: false,
          },
        },
      ],
      response: {
        messages: [
          {
            role: "assistant",
            content: "Extracting data",
          },
          {
            role: "tool",
            content: [
              {
                type: "tool-result",
                toolCallId: "extract_1",
                toolName: "extract",
                output: { action: "extract", description: "Get result text" },
              },
            ],
          },
        ],
      },
    } as any);

    // 7. Done action (terminal action)
    mockGenerateText.mockResolvedValueOnce({
      text: "Task complete",
      toolResults: [
        {
          type: "tool-result",
          toolCallId: "done_1",
          toolName: "done",
          input: { result: "Successfully clicked button and extracted result" },
          output: {
            action: "done",
            result: "Successfully clicked button and extracted result",
            isTerminal: true,
          },
        },
      ],
      response: {
        messages: [
          {
            role: "assistant",
            content: "Task complete",
          },
          {
            role: "tool",
            content: [
              {
                type: "tool-result",
                toolCallId: "done_1",
                toolName: "done",
                output: {
                  action: "done",
                  result: "Successfully clicked button and extracted result",
                  isTerminal: true,
                },
              },
            ],
          },
        ],
      },
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

  it.skip("should track LLM usage even when models don't support tools", async () => {
    const agent = new WebAgent(browser, {
      provider: { specificationVersion: "v1" } as any,
      eventEmitter,
    });

    // Planning fails - model doesn't support tools
    mockGenerateText.mockRejectedValueOnce(
      new Error("Invalid arguments for unavailable tool 'invalid_action'"),
    );

    // Fallback planning succeeds
    mockGenerateText.mockResolvedValueOnce({
      text: "Planning",
      toolResults: [
        {
          type: "tool-result",
          toolCallId: "plan_1",
          toolName: "create_plan_with_url",
          input: {
            explanation: "Test",
            plan: "1. Test",
            url: "https://test.com",
          },
          output: {
            explanation: "Test",
            plan: "1. Test",
            url: "https://test.com",
          },
        },
      ],
    } as any);

    // Action attempt fails
    mockGenerateText.mockRejectedValueOnce(new Error("Bad Request: Model error"));

    // Recovery succeeds with done action
    mockGenerateText.mockResolvedValueOnce({
      text: "Done",
      toolResults: [
        {
          type: "tool-result",
          toolCallId: "done_1",
          toolName: "done",
          input: { result: "Complete" },
          output: {
            action: "done",
            result: "Complete",
            isTerminal: true,
          },
        },
      ],
      response: {
        messages: [
          {
            role: "assistant",
            content: "Done",
          },
          {
            role: "tool",
            content: [
              {
                type: "tool-result",
                toolCallId: "done_1",
                toolName: "done",
                output: { action: "done", result: "Complete", isTerminal: true },
              },
            ],
          },
        ],
      },
    } as any);

    const result = await agent.execute("Test task");

    // Should fail since we hit an error during planning
    expect(result.success).toBe(false);
    expect(result.finalAnswer).toContain("Failed to generate plan");

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
