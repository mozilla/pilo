import { config } from "dotenv";
import { firefox, devices } from "playwright";
import { generateObject } from "ai";
import { openai } from "@ai-sdk/openai";
import { z } from "zod";
import chalk from "chalk";
import {
  actionLoopPrompt,
  buildPlanPrompt,
  buildTaskAndPlanPrompt,
  buildPageSnapshotPrompt,
} from "./prompts.js";
import { DOMSimplifier, PlaywrightAdapter } from "./domSimplifier.js";

// Load environment variables from .env file
config();

// Debug flag - set to true to see page snapshots
const DEBUG = false;

// Setup LLM
const llm = openai("gpt-4o");

async function createPlan(task: string) {
  const response = await generateObject({
    model: llm,
    schema: z.object({
      plan: z.string(),
      url: z.string(),
    }),
    prompt: buildPlanPrompt(task),
  });

  return response.object;
}

function setupMessages(task: string, plan: string) {
  return [
    {
      role: "system",
      content: actionLoopPrompt,
    },
    {
      role: "user",
      content: buildTaskAndPlanPrompt(task, plan),
    },
  ];
}

async function getNextActions(messages: any, pageSnapshot: string) {
  // Replace all previous snapshot messages with placeholders
  messages.forEach((msg: any) => {
    if (
      msg.role === "user" &&
      msg.content.includes("This is a plain text snapshot")
    ) {
      msg.content = "[Previous snapshot removed]";
    }
  });

  // Add the new snapshot message
  messages.push({
    role: "user",
    content: buildPageSnapshotPrompt(pageSnapshot),
  });

  const response = await generateObject({
    model: llm,
    schema: z.object({
      observation: z.string(),
      thought: z.string(),
      action: z.object({
        action: z.enum(["select", "fill", "click", "done", "wait"]),
        target: z.number().optional(),
        value: z.string().optional(),
      }),
    }),
    messages,
    temperature: 0,
  });

  return response.object;
}

// Helper function to wait for a specified number of seconds
async function wait(seconds: number) {
  return new Promise((resolve) => setTimeout(resolve, seconds * 1000));
}

// Get the task from the args
const task = process.argv[2];

if (!task) {
  console.error(chalk.red.bold("❌ Please provide a task to complete."));
  process.exit(1);
}

// Log task info
console.log(chalk.cyan.bold("\n🎯 Task: "), chalk.whiteBright(task));

// Main execution
(async () => {
  // Create plan and determine the starting URL
  const { plan, url } = await createPlan(task);

  console.log(chalk.magenta.bold("\n📋 Plan:"));
  console.log(chalk.whiteBright(plan));
  console.log(chalk.blue.bold("🌐 Starting URL: "), chalk.blue.underline(url));

  // Start the browser
  const browser = await firefox.launch({ headless: false });
  const context = await browser.newContext({
    ...devices["Desktop Firefox"],
    bypassCSP: true,
  });
  const page = await context.newPage();

  // Go to the starting URL
  await page.goto(url);

  // Setup messages
  const messages = setupMessages(task, plan);
  let finalAnswer = null;

  // Start the loop
  while (!finalAnswer) {
    // Get the page snapshot
    const adapter = new PlaywrightAdapter(page);
    const domSimplifier = new DOMSimplifier(adapter);
    const domResult = await domSimplifier.transform("body");
    const pageSnapshot = domResult.text;

    if (DEBUG) {
      // console.log(chalk.green.bold("\n📸 Page Snapshot:"));
      // console.log(chalk.gray(pageSnapshot));

      console.log(chalk.cyan.bold("\n🤔 Messages:"));
      console.log(chalk.gray(JSON.stringify(messages, null, 2)));
    }

    console.log(chalk.cyan.bold("\n🤔 Thinking..."));

    // Call LLM with the page snapshot
    const result = await getNextActions(messages, pageSnapshot);

    console.log(chalk.yellow.bold("👁  Observation:"));
    console.log(chalk.whiteBright("   " + result.observation));

    console.log(chalk.yellow.bold("\n💭 Thought:"));
    console.log(chalk.whiteBright("   " + result.thought));

    console.log(chalk.yellow.bold("\n🎯 Actions:"));
    console.log(
      chalk.whiteBright(`   1. ${result.action.action.toUpperCase()}`),
      result.action.target ? chalk.cyan(`target: ${result.action.target}`) : "",
      result.action.value ? chalk.green(`value: "${result.action.value}"`) : ""
    );

    // Check for the final answer
    if (result.action.action === "done") {
      finalAnswer = result.action.value;
      break;
    }

    // Execute the single action
    console.log(
      chalk.cyan.bold("\n▶️ Executing action:"),
      chalk.whiteBright(result.action.action.toUpperCase()),
      result.action.target ? chalk.cyan(`target: ${result.action.target}`) : "",
      result.action.value ? chalk.green(`value: "${result.action.value}"`) : ""
    );

    if (result.action.action === "wait") {
      const seconds = parseInt(result.action.value || "1", 10);
      console.log(
        chalk.yellow.bold(
          `⏳ Waiting for ${seconds} second${seconds !== 1 ? "s" : ""}...`
        )
      );
      await wait(seconds);
    } else {
      // Execute the action using DOMSimplifier
      const success = await domSimplifier.interactWithElement(
        result.action.target!,
        result.action.action,
        result.action.value
      );

      if (!success) {
        console.error(
          chalk.red.bold(`❌ Failed to execute action: `),
          chalk.whiteBright(JSON.stringify(result.action))
        );
        // Add the failure to the messages for context
        messages.push({
          role: "assistant",
          content: `Failed to execute action: ${JSON.stringify(result.action)}`,
        });
      }
    }

    // Wait for network idle after interactive actions
    if (["click", "select", "fill"].includes(result.action.action)) {
      console.log(
        chalk.gray("   🌐 Waiting for network activity to settle...")
      );
      try {
        // Wait for both network idle and DOM to be stable
        await Promise.all([
          page.waitForLoadState("networkidle", { timeout: 2000 }),
          page.waitForLoadState("domcontentloaded", { timeout: 2000 }),
        ]);
      } catch (e) {
        // If timeout occurs, just continue
        console.log(chalk.gray("   ⚠️  Network wait timed out, continuing..."));
      }
    }

    // Add the result to messages for context
    messages.push({
      role: "assistant",
      content: JSON.stringify(result),
    });
  }

  if (finalAnswer) {
    console.log(
      chalk.green.bold("\n✨ Final Answer:"),
      chalk.whiteBright(finalAnswer)
    );
  }

  // Teardown
  await context.close();
  await browser.close();
})();
