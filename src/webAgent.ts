import { firefox, devices, Browser, BrowserContext, Page } from "playwright";
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

export class WebAgent {
  private plan: string = "";
  private url: string = "";
  private browser: Browser | null = null;
  private context: BrowserContext | null = null;
  private page: Page | null = null;
  private messages: any[] = [];
  private llm = openai("gpt-4o");
  private DEBUG = false;

  constructor(debug: boolean = false) {
    this.DEBUG = debug;
  }

  async createPlan(task: string) {
    const response = await generateObject({
      model: this.llm,
      schema: z.object({
        plan: z.string(),
        url: z.string(),
      }),
      prompt: buildPlanPrompt(task),
    });

    this.plan = response.object.plan;
    this.url = response.object.url;

    return { plan: this.plan, url: this.url };
  }

  setupMessages(task: string) {
    this.messages = [
      {
        role: "system",
        content: actionLoopPrompt,
      },
      {
        role: "user",
        content: buildTaskAndPlanPrompt(task, this.plan),
      },
    ];
    return this.messages;
  }

  async getNextActions(pageSnapshot: string) {
    // Replace all previous snapshot messages with placeholders
    this.messages.forEach((msg: any) => {
      if (
        msg.role === "user" &&
        msg.content.includes("Current page snapshot")
      ) {
        msg.content = "[Previous snapshot removed]";
      }
    });

    // Add the new snapshot message
    this.messages.push({
      role: "user",
      content: buildPageSnapshotPrompt(pageSnapshot),
    });

    const response = await generateObject({
      model: this.llm,
      schema: z.object({
        observation: z.string(),
        thought: z.string(),
        action: z.object({
          action: z.enum([
            "select",
            "fill",
            "click",
            "done",
            "wait",
            "goto",
            "back",
          ]),
          target: z.number().optional(),
          value: z.string().optional(),
        }),
      }),
      messages: this.messages,
      temperature: 0,
    });

    return response.object;
  }

  // Helper function to wait for a specified number of seconds
  async wait(seconds: number) {
    return new Promise((resolve) => setTimeout(resolve, seconds * 1000));
  }

  async initBrowser() {
    if (!this.browser) {
      this.browser = await firefox.launch({ headless: false });
      this.context = await this.browser.newContext({
        ...devices["Desktop Firefox"],
        bypassCSP: true,
      });
      this.page = await this.context.newPage();
    }
    return this.page;
  }

  logTaskInfo(task: string) {
    console.log(chalk.cyan.bold("\n🎯 Task: "), chalk.whiteBright(task));
    console.log(chalk.magenta.bold("\n📋 Plan:"));
    console.log(chalk.whiteBright(this.plan));
    console.log(
      chalk.blue.bold("🌐 Starting URL: "),
      chalk.blue.underline(this.url)
    );
  }

  // Reset the state for a new task
  resetState() {
    this.plan = "";
    this.url = "";
    this.messages = [];
  }

  async execute(task: string) {
    if (!task) {
      console.error(chalk.red.bold("❌ No task provided."));
      return null;
    }

    // Reset state for new task
    this.resetState();

    // Create plan and determine the starting URL
    await this.createPlan(task);
    this.logTaskInfo(task);

    // Start the browser if not already started
    await this.initBrowser();
    if (!this.page) {
      console.error(chalk.red.bold("❌ Failed to initialize browser page."));
      return null;
    }

    // Go to the starting URL
    await this.page.goto(this.url);

    // Setup messages
    this.setupMessages(task);
    let finalAnswer = null;

    // Start the loop
    while (!finalAnswer) {
      // Get the page snapshot
      const adapter = new PlaywrightAdapter(this.page);
      const domSimplifier = new DOMSimplifier(adapter);
      const domResult = await domSimplifier.transform("body");
      const pageSnapshot = domResult.text;

      if (this.DEBUG) {
        console.log(chalk.cyan.bold("\n🤔 Messages:"));
        console.log(chalk.gray(JSON.stringify(this.messages, null, 2)));
      }

      console.log(chalk.cyan.bold("\n🤔 Thinking..."));

      // Call LLM with the page snapshot
      const result = await this.getNextActions(pageSnapshot);

      console.log(chalk.yellow.bold("👁  Observation:"));
      console.log(chalk.whiteBright("   " + result.observation));

      console.log(chalk.yellow.bold("\n💭 Thought:"));
      console.log(chalk.whiteBright("   " + result.thought));

      console.log(chalk.yellow.bold("\n🎯 Actions:"));
      console.log(
        chalk.whiteBright(`   1. ${result.action.action.toUpperCase()}`),
        result.action.target
          ? chalk.cyan(`target: ${result.action.target}`)
          : "",
        result.action.value
          ? chalk.green(`value: "${result.action.value}"`)
          : ""
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
        result.action.target
          ? chalk.cyan(`target: ${result.action.target}`)
          : "",
        result.action.value
          ? chalk.green(`value: "${result.action.value}"`)
          : ""
      );

      if (result.action.action === "wait") {
        const seconds = parseInt(result.action.value || "1", 10);
        console.log(
          chalk.yellow.bold(
            `⏳ Waiting for ${seconds} second${seconds !== 1 ? "s" : ""}...`
          )
        );
        await this.wait(seconds);
      } else if (result.action.action === "goto") {
        if (result.action.value) {
          console.log(
            chalk.blue.bold(`🌐 Navigating to: ${result.action.value}`)
          );
          await this.page.goto(result.action.value);
        } else {
          console.error(
            chalk.red.bold(`❌ Failed to execute goto: missing URL`)
          );
        }
      } else if (result.action.action === "back") {
        console.log(chalk.blue.bold(`◀️ Going back to the previous page`));
        await this.page.goBack();
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
          this.messages.push({
            role: "assistant",
            content: `Failed to execute action: ${JSON.stringify(
              result.action
            )}`,
          });
        }
      }

      // Wait for network idle after interactive actions
      if (
        ["click", "select", "fill", "goto", "back"].includes(
          result.action.action
        )
      ) {
        console.log(
          chalk.gray("   🌐 Waiting for network activity to settle...")
        );
        try {
          // Wait for both network idle and DOM to be stable
          await Promise.all([
            this.page.waitForLoadState("networkidle", { timeout: 2000 }),
            this.page.waitForLoadState("domcontentloaded", { timeout: 2000 }),
          ]);
        } catch (e) {
          // If timeout occurs, just continue
          console.log(
            chalk.gray("   ⚠️  Network wait timed out, continuing...")
          );
        }
      }

      // Add the result to messages for context
      this.messages.push({
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

    return finalAnswer;
  }

  async close() {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
      this.context = null;
      this.page = null;
    }
  }
}
