/**
 * Skill cache end-to-end integration test.
 *
 * Unlike webAgent.test.ts (which mocks SkillStore and extractSkill at module
 * level), this file exercises the real skill-cache code paths:
 *   - real SkillStore reads/writes against a real temp directory
 *   - real injector formatting
 *   - real extractor (with its real prompt building) calling a mocked LLM
 *
 * Only the outermost seams are mocked: the AI SDK (streamText) and our
 * provider-agnostic retry helper (generateTextWithRetry), plus SearchService
 * to keep the search provider out of the picture.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mkdtempSync, rmSync, existsSync, readFileSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { streamText, type LanguageModel } from "ai";
import { WebAgent, type WebAgentOptions } from "../../src/webAgent.js";
import { AriaBrowser, PageAction } from "../../src/browser/ariaBrowser.js";
import { WebAgentEventEmitter } from "../../src/events.js";
import { generateTextWithRetry } from "../../src/utils/retry.js";
import { SkillStore } from "../../src/skills/store.js";

vi.mock("ai", () => ({
  streamText: vi.fn(),
  tool: vi.fn((schema: any) => ({
    description: schema.description,
    parameters: schema.parameters,
  })),
}));

vi.mock("../../src/utils/retry.js", () => ({
  generateTextWithRetry: vi.fn(),
}));

// Defensive mock: with default `search_provider: "none"` SearchService.create
// is never called by these tests, but keep it stubbed in case the default
// changes so the search provider stays out of the picture.
vi.mock("../../src/search/searchService.js", () => ({
  SearchService: {
    create: vi.fn().mockResolvedValue({
      search: vi.fn().mockResolvedValue("# Mock Results"),
    }),
  },
}));

const mockStreamText = vi.mocked(streamText);
const mockGenerateTextWithRetry = vi.mocked(generateTextWithRetry);

// Minimal mock browser that returns example.com as its URL so resolveHost()
// produces a stable host filename across runs.
class MockBrowser implements AriaBrowser {
  browserName = "mock-browser";
  private url = "https://example.com/";
  private title = "Example";
  private pageSnapshot = "<div><button [ref=btn1]>Click me</button></div>";
  private markdown = "# Example";

  async start(): Promise<void> {}
  async shutdown(): Promise<void> {}

  async goto(newUrl: string): Promise<void> {
    this.url = newUrl;
    this.title = `Page at ${newUrl}`;
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
    return this.markdown;
  }

  async getScreenshot(): Promise<Buffer> {
    return Buffer.from("mock-screenshot");
  }

  async performAction(_ref: string, _action: PageAction, _value?: string): Promise<void> {}

  async waitForLoadState(): Promise<void> {}

  async runInTemporaryTab<T>(fn: (tab: any) => Promise<T>): Promise<T> {
    const mockTab = {
      goto: async () => {},
      waitForLoadState: async () => {},
      getMarkdown: async () => "# Mock",
    };
    return fn(mockTab);
  }
}

// Mimics the AI SDK's streamText response shape just enough for WebAgent.
function createMockStreamResponse(response: any): any {
  const fullStream = {
    async *[Symbol.asyncIterator]() {
      yield { type: "start" };
      yield { type: "start-step" };
      if (response.toolResults) {
        for (const r of response.toolResults) {
          yield { type: "tool-call", toolName: r.toolName };
          yield { type: "tool-result", toolName: r.toolName };
        }
      }
      yield { type: "finish-step" };
      yield { type: "finish" };
    },
  };
  const emptyAsyncIterator = { [Symbol.asyncIterator]: async function* () {} };
  return {
    fullStream,
    text: Promise.resolve(response.text || ""),
    reasoning: Promise.resolve(response.reasoning || []),
    toolResults: Promise.resolve(response.toolResults || []),
    response: Promise.resolve(response.response || { messages: [] }),
    finishReason: Promise.resolve(response.finishReason || "stop"),
    usage: Promise.resolve(response.usage || {}),
    warnings: Promise.resolve(response.warnings || []),
    providerMetadata: Promise.resolve(response.providerMetadata || {}),
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
  };
}

function planningResponse(): any {
  return {
    text: "Planning",
    toolResults: [
      {
        type: "tool-result",
        toolCallId: "plan_1",
        toolName: "create_plan",
        input: { successCriteria: "Done", plan: "1. Done" },
        output: { successCriteria: "Done", plan: "1. Done" },
      },
    ],
  };
}

function doneStreamResponse(): any {
  return createMockStreamResponse({
    text: "Done",
    toolResults: [
      {
        type: "tool-result",
        toolCallId: "done_1",
        toolName: "done",
        input: { result: "ok" },
        output: { action: "done", result: "ok", isTerminal: true },
      },
    ],
    response: {
      messages: [
        { role: "assistant", content: "Done" },
        {
          role: "tool",
          content: [
            {
              type: "tool-result",
              toolCallId: "done_1",
              toolName: "done",
              output: { action: "done", result: "ok" },
            },
          ],
        },
      ],
    },
  });
}

function validationResponse(
  quality: "failed" | "partial" | "complete" | "excellent" = "excellent",
): any {
  return {
    text: "Validation",
    toolResults: [
      {
        type: "tool-result",
        toolCallId: "validate_1",
        toolName: "validate_task",
        input: {
          taskAssessment: "Task completed successfully",
          completionQuality: quality,
        },
        output: {
          taskAssessment: "Task completed successfully",
          completionQuality: quality,
        },
      },
    ],
  };
}

/** Wire one full successful agent cycle: planning -> done -> validation -> extraction. */
function wireRunWithExtraction(extractionText: string, quality: "excellent" = "excellent"): void {
  mockGenerateTextWithRetry.mockResolvedValueOnce(planningResponse());
  mockStreamText.mockReturnValueOnce(doneStreamResponse());
  mockGenerateTextWithRetry.mockResolvedValueOnce(validationResponse(quality));
  // The extractor calls generateTextWithRetry with prompt + reads response.text.
  mockGenerateTextWithRetry.mockResolvedValueOnce({ text: extractionText } as any);
}

function buildAgent(cacheDir: string | undefined, opts: Partial<WebAgentOptions> = {}): WebAgent {
  const browser = new MockBrowser();
  const mockProvider = { specificationVersion: "v1" } as unknown as LanguageModel;
  // Construct a real SkillStore against the temp cacheDir when one is
  // provided. Passing `cacheDir: undefined` mirrors the production "feature
  // off" path: no skillStore option, so all reads/writes are inert.
  const options: WebAgentOptions = {
    providerConfig: { model: mockProvider },
    eventEmitter: new WebAgentEventEmitter(),
    debug: false,
    vision: false,
    maxIterations: 10,
    maxConsecutiveErrors: 5,
    maxTotalErrors: 15,
    guardrails: null,
    ...(cacheDir !== undefined ? { skillStore: new SkillStore({ cacheDir }) } : {}),
    ...opts,
  };
  return new WebAgent(browser, options);
}

describe("skill cache end-to-end", () => {
  let cacheDir: string;

  beforeEach(() => {
    vi.clearAllMocks();
    // Reset queued `mockResolvedValueOnce` / `mockReturnValueOnce` implementations
    // so unused mocks from a previous test don't leak into the next one.
    mockGenerateTextWithRetry.mockReset();
    mockStreamText.mockReset();
    cacheDir = mkdtempSync(join(tmpdir(), "pilo-skills-integration-"));
  });

  afterEach(() => {
    rmSync(cacheDir, { recursive: true, force: true });
  });

  it("first run on a host writes a skill; second run reads it back into the prompt", async () => {
    // --- Run 1: empty cache -> task succeeds at "excellent" -> extractor writes a hint ---
    const RUN1_HINT =
      "On example.com, the buy button is in the top-right corner of every product page.";
    wireRunWithExtraction(RUN1_HINT);

    const agent1 = buildAgent(cacheDir);
    try {
      const result1 = await agent1.execute("first task", {
        startingUrl: "https://example.com",
      });
      expect(result1.success).toBe(true);
    } finally {
      await agent1.close();
    }

    // The host file should now exist with the extractor's hint baked in.
    const hostFile = join(cacheDir, "example.com.md");
    expect(existsSync(hostFile)).toBe(true);
    const stored = readFileSync(hostFile, "utf-8");
    expect(stored).toContain(RUN1_HINT);
    expect(stored).toContain("first task");

    // --- Run 2: cache populated -> retrieval injects the run-1 hint into the system prompt ---
    vi.clearAllMocks();
    wireRunWithExtraction("Second-run hint that doesn't matter for this assertion.");

    const agent2 = buildAgent(cacheDir);
    try {
      const result2 = await agent2.execute("second task", {
        startingUrl: "https://example.com",
      });
      expect(result2.success).toBe(true);
    } finally {
      await agent2.close();
    }

    // The action-loop streamText call's system prompt should carry the run-1 hint.
    const actionCall = mockStreamText.mock.calls[0]?.[0];
    expect(actionCall).toBeDefined();
    const systemPrompt = String(actionCall!.system);
    expect(systemPrompt).toContain("<!-- NOTES FROM PRIOR RUNS ON THIS SITE -->");
    expect(systemPrompt).toContain("<!-- END NOTES -->");
    expect(systemPrompt).toContain(RUN1_HINT);
  });

  it("disabled cache neither writes nor reads", async () => {
    // Wire a successful "excellent" run — the path that would normally trigger
    // extraction. The only thing preventing a host file write here is the
    // absence of a `skillStore` on WebAgentOptions. If extraction ran anyway,
    // the host file would appear; if it doesn't, that proves the missing
    // store is the gate.
    wireRunWithExtraction("Hint that should never be written because skills are disabled.");

    // No cacheDir / no skillStore means the agent should never touch disk.
    const agent = buildAgent(undefined);
    try {
      const result = await agent.execute("task", { startingUrl: "https://example.com" });
      expect(result.success).toBe(true);
    } finally {
      await agent.close();
    }

    // Cache dir should be untouched. Quality was "excellent", so the ONLY
    // reason no file exists is that no `skillStore` was passed and the
    // extractor was therefore never called.
    expect(existsSync(join(cacheDir, "example.com.md"))).toBe(false);

    // Stronger: confirm the extractor was never invoked. The extractor would
    // be a 3rd generateTextWithRetry call (after planning + validation). If
    // the disable path leaked, we'd see 3 calls and the queued extraction
    // mock would have been consumed.
    expect(mockGenerateTextWithRetry).toHaveBeenCalledTimes(2);

    // The system prompt should not contain the skills framing block, proving
    // retrieval also no-ops when skills are disabled.
    const actionCall = mockStreamText.mock.calls[0]?.[0];
    expect(actionCall).toBeDefined();
    const systemPrompt = String(actionCall!.system);
    expect(systemPrompt).not.toContain("<!-- NOTES FROM PRIOR RUNS ON THIS SITE -->");
    expect(systemPrompt).not.toContain("<!-- END NOTES -->");
  });

  it("survives a corrupted host file without failing the task", async () => {
    // Pre-populate the host file with malformed content (no section headers).
    writeFileSync(
      join(cacheDir, "example.com.md"),
      "this is not well-formed skill markdown\njust some junk\n",
      "utf-8",
    );

    const NEW_HINT = "Fresh extraction text written on top of the corrupted file.";
    wireRunWithExtraction(NEW_HINT);

    const agent = buildAgent(cacheDir);
    try {
      const result = await agent.execute("task on corrupted cache", {
        startingUrl: "https://example.com",
      });
      // Task must still succeed — the corrupted file should not poison the agent.
      expect(result.success).toBe(true);
    } finally {
      await agent.close();
    }

    // The new hint should be appended to whatever was there.
    const after = readFileSync(join(cacheDir, "example.com.md"), "utf-8");
    expect(after).toContain(NEW_HINT);
  });
});
