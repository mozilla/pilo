/**
 * Integration test for TAB-952: WebAgent planning recovers when the model
 * first returns text instead of a tool call.
 *
 * Unlike webAgent.test.ts, this file does NOT mock the retry module so the
 * real `generateTextWithRetry` augmentation runs against a mocked AI SDK.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { WebAgent, type WebAgentOptions } from "../src/webAgent.js";
import { AriaBrowser, PageAction } from "../src/browser/ariaBrowser.js";
import { WebAgentEventEmitter, WebAgentEventType } from "../src/events.js";
import { generateText, streamText, type LanguageModel } from "ai";
import { Logger } from "../src/loggers/types.js";

vi.mock("ai", () => ({
  generateText: vi.fn(),
  streamText: vi.fn(),
  tool: vi.fn((schema: any) => ({
    description: schema.description,
    parameters: schema.parameters,
  })),
}));

vi.mock("../src/search/searchService.js", () => ({
  SearchService: {
    create: vi.fn().mockResolvedValue({
      search: vi.fn().mockResolvedValue("# Mock Results"),
    }),
  },
}));

const mockGenerateText = vi.mocked(generateText);
const mockStreamText = vi.mocked(streamText);

function makePlanningSuccess() {
  return {
    text: "",
    finishReason: "tool-calls",
    toolResults: [
      {
        type: "tool-result",
        toolCallId: "plan_1",
        toolName: "create_plan",
        input: {
          successCriteria: "Recovered",
          plan: "1. Do the thing\n2. Done",
        },
        output: {
          successCriteria: "Recovered",
          plan: "1. Do the thing\n2. Done",
        },
      },
    ],
  } as any;
}

function makePlanningTextOnly() {
  return {
    text: "I'll outline a plan: first navigate to the site, then click around.",
    finishReason: "stop",
    toolResults: [],
  } as any;
}

function makeValidationSuccess() {
  return {
    text: "",
    finishReason: "tool-calls",
    toolResults: [
      {
        type: "tool-result",
        toolCallId: "validate_1",
        toolName: "validate_task",
        input: {
          taskAssessment: "Task completed",
          completionQuality: "complete",
        },
        output: {
          taskAssessment: "Task completed",
          completionQuality: "complete",
        },
      },
    ],
  } as any;
}

function makeDoneStream() {
  const fullStream = {
    async *[Symbol.asyncIterator]() {
      yield { type: "start" };
      yield { type: "start-step" };
      yield { type: "tool-call", toolName: "done" };
      yield { type: "tool-result", toolName: "done" };
      yield { type: "finish-step" };
      yield { type: "finish" };
    },
  };
  const emptyAsyncIterator = { [Symbol.asyncIterator]: async function* () {} };

  return {
    fullStream,
    text: Promise.resolve("done"),
    reasoning: Promise.resolve([]),
    toolResults: Promise.resolve([
      {
        type: "tool-result",
        toolCallId: "done_1",
        toolName: "done",
        input: { result: "Task complete" },
        output: { action: "done", result: "Task complete", isTerminal: true },
      },
    ]),
    response: Promise.resolve({
      messages: [
        { role: "assistant", content: "done" },
        {
          role: "tool",
          content: [
            {
              type: "tool-result",
              toolCallId: "done_1",
              toolName: "done",
              output: { action: "done", result: "Task complete", isTerminal: true },
            },
          ],
        },
      ],
    }),
    finishReason: Promise.resolve("tool-calls"),
    usage: Promise.resolve({}),
    warnings: Promise.resolve([]),
    providerMetadata: Promise.resolve({}),
    content: Promise.resolve([]),
    reasoningText: Promise.resolve(""),
    files: Promise.resolve([]),
    sources: Promise.resolve([]),
    toolCalls: Promise.resolve([]),
    request: Promise.resolve({}),
    totalUsage: Promise.resolve({}),
    steps: Promise.resolve([]),
    experimental_output: Promise.resolve(undefined),
    contentStream: emptyAsyncIterator,
    textStream: emptyAsyncIterator,
    reasoningStream: emptyAsyncIterator,
    fileStream: emptyAsyncIterator,
    sourceStream: emptyAsyncIterator,
    toDataStreamResponse: () => new Response(),
    toUIMessageStreamResponse: () => new Response(),
    toTextStreamResponse: () => new Response(),
    pipeDataStreamToResponse: () => {},
    pipeUIMessageStreamToResponse: () => {},
    pipeTextStreamToResponse: () => {},
  } as any;
}

class MockBrowser implements AriaBrowser {
  browserName = "mock-browser";
  private url = "about:blank";
  private title = "Mock Page";
  private pageSnapshot = `<div><button [ref=btn1]>Click</button></div>`;

  async start(): Promise<void> {}
  async shutdown(): Promise<void> {}
  async goto(newUrl: string): Promise<void> {
    this.url = newUrl;
  }
  async goBack(): Promise<void> {}
  async goForward(): Promise<void> {}
  async getUrl(): Promise<string> {
    return this.url;
  }
  async getTitle(): Promise<string> {
    return this.title;
  }
  async getTreeWithRefs(): Promise<string> {
    return this.pageSnapshot;
  }
  async getMarkdown(): Promise<string> {
    return "# Mock";
  }
  async getScreenshot(): Promise<Buffer> {
    return Buffer.from("mock");
  }
  async performAction(_ref: string, _action: PageAction, _value?: string): Promise<void> {}
  async waitForLoadState(): Promise<void> {}
  async runInTemporaryTab<T>(fn: (tab: any) => Promise<T>): Promise<T> {
    return fn({
      goto: async () => {},
      waitForLoadState: async () => {},
      getMarkdown: async () => "# Mock",
    });
  }
}

class MockLogger implements Logger {
  events: Array<{ type: string; data: any }> = [];
  initialize(emitter: WebAgentEventEmitter): void {
    Object.values(WebAgentEventType).forEach((eventType) => {
      emitter.on(eventType, (data) => {
        this.events.push({ type: eventType, data });
      });
    });
  }
  dispose(): void {
    this.events = [];
  }
  getEvents(): Array<{ type: string; data: any }> {
    return this.events;
  }
}

describe("WebAgent — planning retry recovery (TAB-952)", () => {
  let mockBrowser: MockBrowser;
  let mockLogger: MockLogger;
  let eventEmitter: WebAgentEventEmitter;
  let webAgent: WebAgent;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();

    mockBrowser = new MockBrowser();
    mockLogger = new MockLogger();
    eventEmitter = new WebAgentEventEmitter();

    const options: WebAgentOptions = {
      providerConfig: { model: { specificationVersion: "v1" } as unknown as LanguageModel },
      debug: false,
      vision: false,
      maxIterations: 5,
      maxConsecutiveErrors: 3,
      maxTotalErrors: 10,
      guardrails: null,
      eventEmitter,
      logger: mockLogger,
    };

    webAgent = new WebAgent(mockBrowser, options);
  });

  afterEach(async () => {
    await webAgent.close();
    vi.useRealTimers();
  });

  it("recovers when first planning call returns text instead of a tool call", async () => {
    mockGenerateText
      .mockResolvedValueOnce(makePlanningTextOnly())
      .mockResolvedValueOnce(makePlanningSuccess())
      .mockResolvedValueOnce(makeValidationSuccess());

    mockStreamText.mockReturnValueOnce(makeDoneStream());

    const execPromise = webAgent.execute("Click the button", {
      startingUrl: "https://example.com",
    });

    await vi.runAllTimersAsync();
    const result = await execPromise;

    expect(result.success).toBe(true);
    expect(mockGenerateText).toHaveBeenCalledTimes(3);

    const firstPlanCall = mockGenerateText.mock.calls[0][0] as any;
    const secondPlanCall = mockGenerateText.mock.calls[1][0] as any;

    expect(firstPlanCall.prompt).not.toMatch(/MUST respond by invoking one of the provided tools/);
    expect(secondPlanCall.prompt).toMatch(/MUST respond by invoking one of the provided tools/);
    expect(secondPlanCall.prompt.startsWith(firstPlanCall.prompt)).toBe(true);

    const statusEvent = mockLogger.events.find(
      (e) =>
        e.type === WebAgentEventType.AGENT_STATUS &&
        typeof e.data?.message === "string" &&
        e.data.message.includes("Planning retry attempt"),
    );
    expect(statusEvent).toBeDefined();
  });
});
