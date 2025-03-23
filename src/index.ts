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
const DEBUG = true;

// Setup the LLM
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
  // Filter out previous snapshot messages in place
  for (let i = messages.length - 1; i >= 0; i--) {
    if (
      messages[i].role === "user" &&
      messages[i].content.includes("snapshot")
    ) {
      messages.splice(i, 1);
    }
  }

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
      actions: z.array(
        z.object({
          action: z.enum(["select", "fill", "click", "done", "wait"]),
          target: z.number().optional(),
          value: z.string().optional(),
        })
      ),
    }),
    messages,
  });

  return response.object;
}

function addContextToMessages(messages: any, pageSnapshot: string) {
  messages.push({
    role: "user",
    content: pageSnapshot,
  });
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

// Create and plan and determine the starting URL
const { plan, url } = await createPlan(task);

console.log(chalk.magenta.bold("\n📋 Plan:"));
console.log(chalk.whiteBright(plan));
console.log(chalk.blue.bold("🌐 Starting URL: "), chalk.blue.underline(url));

// Start the browser
const browser = await firefox.launch({ headless: false });
const context = await browser.newContext(devices["Desktop Firefox"]);
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
    console.log(chalk.green.bold("\n📸 Page Snapshot:"));
    console.log(chalk.gray(pageSnapshot));
  }

  console.log(chalk.cyan.bold("\n🤔 Thinking..."));

  // Call LLM with the page snapshot
  const result = await getNextActions(messages, pageSnapshot);

  console.log(chalk.yellow.bold("👁  Observation:"));
  console.log(chalk.whiteBright("   " + result.observation));

  console.log(chalk.yellow.bold("\n💭 Thought:"));
  console.log(chalk.whiteBright("   " + result.thought));

  console.log(chalk.yellow.bold("\n🎯 Actions:"));
  result.actions.forEach((action, index) => {
    console.log(
      chalk.whiteBright(`   ${index + 1}. ${action.action.toUpperCase()}`),
      action.target ? chalk.cyan(`target: ${action.target}`) : "",
      action.value ? chalk.green(`value: "${action.value}"`) : ""
    );
  });

  // Check for the final answer
  const doneAction = result.actions.find((action) => action.action === "done");
  if (doneAction) {
    finalAnswer = doneAction.value;
    break;
  }

  // Run the actions
  for (const action of result.actions) {
    if (action.action === "done") continue;

    if (action.action === "wait") {
      const seconds = parseInt(action.value || "1", 10);
      console.log(
        chalk.yellow.bold(
          `⏳ Waiting for ${seconds} second${seconds !== 1 ? "s" : ""}...`
        )
      );
      await wait(seconds);
      continue;
    }

    // Execute the action using DOMSimplifier
    const success = await domSimplifier.interactWithElement(
      action.target!,
      action.action,
      action.value
    );

    if (!success) {
      console.error(
        chalk.red.bold(`❌ Failed to execute action: `),
        chalk.whiteBright(JSON.stringify(action))
      );
      // Add the failure to the messages for context
      messages.push({
        role: "assistant",
        content: `Failed to execute action: ${JSON.stringify(action)}`,
      });
      break;
    }
  }

  // Wait for network idle after all actions are complete
  if (
    result.actions.some((action) =>
      ["click", "select", "fill"].includes(action.action)
    )
  ) {
    console.log(chalk.gray("   🌐 Waiting for network activity to settle..."));
    try {
      // Wait for both network idle and DOM to be stable
      await Promise.all([
        page.waitForLoadState("networkidle", { timeout: 2000 }),
        page.waitForLoadState("domcontentloaded", { timeout: 2000 }),
      ]);
    } catch (e) {
      // If timeout occurs, just continue - some actions might not trigger network activity
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
