/**
 * Real Chromium + real AI SDK tools; only the language model is scripted.
 *
 * Install: pnpm --filter pilo-core exec playwright install chromium
 * Run: PILO_REPETITION_INTEGRATION=1 pnpm --filter pilo-core exec vitest run test/integration/actionRepetition.integration.test.ts
 * PILO_CHROMIUM_EXECUTABLE optionally selects an existing Chromium executable.
 */
// @vitest-environment node
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { fileURLToPath } from "node:url";
import { simulateReadableStream } from "ai";
import { MockLanguageModelV4 } from "ai/test";
import { WebAgent } from "../../src/webAgent.js";
import { PlaywrightBrowser } from "../../src/browser/playwrightBrowser.js";
import { serveFixtures } from "./support/firefoxHarness.js";

const usage = {
  inputTokens: { total: 0, noCache: 0, cacheRead: 0, cacheWrite: 0 },
  outputTokens: { total: 0, text: 0, reasoning: 0 },
};
const finishReason = { unified: "tool-calls", raw: "tool_calls" } as const;

function toolCall(toolName: string, input: Record<string, unknown>) {
  return {
    type: "tool-call" as const,
    toolCallId: toolName,
    toolName,
    input: JSON.stringify(input),
  };
}

describe.skipIf(process.env.PILO_REPETITION_INTEGRATION !== "1")(
  "progress-aware repetition (real Chromium)",
  () => {
    let site: Awaited<ReturnType<typeof serveFixtures>>;
    beforeAll(async () => {
      site = await serveFixtures(fileURLToPath(new URL("./fixtures", import.meta.url)));
    });
    afterAll(async () => {
      await site?.stop();
    });

    async function runCalendar(mode: "advance" | "stalled" | "cycle") {
      const browser = new PlaywrightBrowser({
        browser: "chromium",
        headless: true,
        blockAds: false,
        executablePath: process.env.PILO_CHROMIUM_EXECUTABLE,
      });
      let clicks = 0;
      const model = new MockLanguageModelV4({
        doGenerate: async ({ tools }) => ({
          content: [
            tools?.some((t) => t.name === "create_plan")
              ? toolCall("create_plan", {
                  successCriteria: "Reach February 2027",
                  plan: "Click Next month five times",
                })
              : toolCall("validate_task", {
                  taskAssessment: "The calendar reached February",
                  completionQuality: "complete",
                }),
          ],
          finishReason,
          usage,
          warnings: [],
        }),
        doStream: async () => {
          let call;
          if (clicks < (mode === "advance" ? 5 : 10)) {
            const snapshot = await browser.getTreeWithRefs();
            const ref = snapshot.match(/button "Next month"[^\n]*\[ref=([^\]]+)\]/)?.[1];
            if (!ref) throw new Error("Calendar button missing from browser snapshot");
            call = toolCall("click", { ref });
            clicks++;
          } else {
            call = toolCall("done", { result: "Reached February 2027" });
          }
          return {
            stream: simulateReadableStream({
              chunks: [
                { type: "stream-start" as const, warnings: [] },
                call,
                { type: "finish" as const, finishReason, usage },
              ],
              initialDelayInMs: null,
              chunkDelayInMs: null,
            }),
          };
        },
      });
      const agent = new WebAgent(browser, {
        providerConfig: { model },
        maxIterations: 15,
        vision: false,
        debug: false,
      });
      try {
        const result = await agent.execute("Advance the calendar five months", {
          startingUrl: `${site.baseUrl}/repetition-calendar.html?mode=${mode}`,
        });
        const snapshot = await browser.getTreeWithRefs();
        return { result, snapshot, clicks };
      } finally {
        await agent.close();
      }
    }

    it("finishes five real calendar clicks without a repetition abort", async () => {
      const { result, snapshot, clicks } = await runCalendar("advance");
      expect(result.finalAnswer).not.toContain("Excessive repetition");
      expect(result.success).toBe(true);
      expect(snapshot).toContain("February 2027");
      expect(clicks).toBe(5);
    }, 30_000);

    it.each(["stalled", "cycle"] as const)(
      "stops a %s calendar despite a changing timer",
      async (mode) => {
        const { result, clicks } = await runCalendar(mode);
        expect(result.finalAnswer).toContain("Aborted: Excessive repetition");
        expect(clicks).toBeLessThan(10);
      },
      30_000,
    );
  },
);
