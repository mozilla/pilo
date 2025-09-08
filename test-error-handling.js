#!/usr/bin/env node
/**
 * Test script to verify error handling when model doesn't return tool calls
 */

import { WebAgent } from "./dist/webAgent.js";
import { AriaBrowser } from "./dist/browser/ariaBrowser.js";

// Mock provider that returns text instead of tool calls on first attempt
const mockProvider = {
  modelId: "test-model",
  provider: "test",

  // This will be called by generateText
  doGenerate: async ({ messages, tools }) => {
    // Count how many messages we have to determine if this is a retry
    const messageCount = messages.length;

    // First attempt: return text instead of tool call (error case)
    if (messageCount <= 3) {
      return {
        text: "The HomePod mini is available in White, Blue, Orange, Yellow, and Midnight colors.",
        toolCalls: [],
        toolResults: [],
        finishReason: "stop",
        usage: { promptTokens: 100, completionTokens: 20 },
        response: {
          messages: [
            {
              role: "assistant",
              content:
                "The HomePod mini is available in White, Blue, Orange, Yellow, and Midnight colors.",
            },
          ],
        },
      };
    }

    // Second attempt (after error feedback): return proper tool call
    return {
      text: "",
      toolCalls: [
        {
          toolCallId: "test-1",
          toolName: "done",
          args: {
            result:
              "The HomePod mini is available in 5 colors: White, Blue, Orange, Yellow, and Midnight.",
          },
        },
      ],
      toolResults: [
        {
          type: "tool-result",
          toolCallId: "test-1",
          toolName: "done",
          output: {
            success: true,
            action: "done",
            result:
              "The HomePod mini is available in 5 colors: White, Blue, Orange, Yellow, and Midnight.",
            isTerminal: true,
          },
        },
      ],
      finishReason: "tool-calls",
      usage: { promptTokens: 120, completionTokens: 30 },
      response: {
        messages: [
          {
            role: "assistant",
            content: "",
            toolCalls: [
              {
                toolCallId: "test-1",
                toolName: "done",
                args: {
                  result:
                    "The HomePod mini is available in 5 colors: White, Blue, Orange, Yellow, and Midnight.",
                },
              },
            ],
          },
          {
            role: "tool",
            content: [
              {
                type: "tool-result",
                toolCallId: "test-1",
                toolName: "done",
                output: {
                  success: true,
                  action: "done",
                  result:
                    "The HomePod mini is available in 5 colors: White, Blue, Orange, Yellow, and Midnight.",
                  isTerminal: true,
                },
              },
            ],
          },
        ],
      },
    };
  },
};

async function testErrorHandling() {
  console.log("Testing error handling when model returns text instead of tool call...\n");

  const browser = new AriaBrowser();
  const agent = new WebAgent(browser, {
    provider: mockProvider,
    debug: true,
    maxIterations: 5,
  });

  // Set up event listeners to see what's happening
  agent.eventEmitter.on("ai-generation-error", (data) => {
    console.log("❌ AI Generation Error:", data.error);
  });

  agent.eventEmitter.on("agent-observed", (data) => {
    console.log("👁️ Agent observed:", data.observation);
  });

  agent.eventEmitter.on("task-completed", (data) => {
    console.log("✅ Task completed:", data);
  });

  try {
    const result = await agent.execute("Find HomePod mini colors", {
      startingUrl: "https://example.com",
    });

    console.log("\nFinal result:", result);

    if (result.success) {
      console.log("✅ Test PASSED: Error was recovered and task completed");
    } else {
      console.log("❌ Test FAILED: Task did not complete successfully");
    }
  } catch (error) {
    console.error("Test error:", error);
  } finally {
    await agent.close();
  }
}

// Run the test
testErrorHandling().catch(console.error);
