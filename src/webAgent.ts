import { generateObject } from "ai";
import { openai } from "@ai-sdk/openai";
import chalk from "chalk";
import {
  actionLoopPrompt,
  buildPlanPrompt,
  buildTaskAndPlanPrompt,
  buildPageSnapshotPrompt,
} from "./prompts.js";
import { AriaBrowser } from "./browser/ariaBrowser.js";
import { planSchema, actionSchema, Plan, Action } from "./schemas.js";

export class WebAgent {
  private plan: string = "";
  private url: string = "";
  private messages: any[] = [];
  private llm = openai("gpt-4o");
  private DEBUG = false;
  private taskExplanation: string = "";
  private readonly FILTERED_PREFIXES = ["/url:"];
  private readonly ARIA_TRANSFORMATIONS: Array<[RegExp, string]> = [
    [/^listitem/g, "li"],
    [/(?<=\[)ref=/g, ""],
    [/^link/g, "a"],
    [/^text: (.*?)$/g, '"$1"'],
    [/^heading "([^"]+)" \[level=(\d+)\]/g, 'h$2 "$1"'],
  ];

  constructor(private browser: AriaBrowser, debug: boolean = false) {
    this.DEBUG = debug;
  }

  async createPlan(task: string) {
    const response = await generateObject({
      model: this.llm,
      schema: planSchema,
      prompt: buildPlanPrompt(task),
      temperature: 0,
    });

    this.taskExplanation = response.object.explanation;
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
        content: buildTaskAndPlanPrompt(task, this.taskExplanation, this.plan),
      },
    ];
    return this.messages;
  }

  async getNextActions(pageSnapshot: string) {
    // Compress the snapshot before using it
    const compressedSnapshot = this.compressSnapshot(pageSnapshot);

    // Get current page title and URL
    const [title, url] = await Promise.all([
      this.browser.getTitle(),
      this.browser.getUrl(),
    ]);

    if (this.DEBUG) {
      const originalSize = pageSnapshot.length;
      const compressedSize = compressedSnapshot.length;
      const compressionPercent = Math.round(
        (1 - compressedSize / originalSize) * 100
      );

      console.log(
        chalk.gray("\n📝 Compression:"),
        chalk.green(`${compressionPercent}%`),
        chalk.gray(`(${originalSize} → ${compressedSize} chars)`)
      );
    }

    // Replace all previous snapshot messages with placeholders
    this.messages.forEach((msg: any) => {
      if (
        msg.role === "user" &&
        msg.content.includes("snapshot") &&
        msg.content.includes("```")
      ) {
        msg.content = msg.content.replace(
          /```[\s\S]*$/g,
          "```[snapshot clipped for length]```"
        );
      }
    });

    // Add the new snapshot message with compressed snapshot
    this.messages.push({
      role: "user",
      content: buildPageSnapshotPrompt(title, url, compressedSnapshot),
    });

    const response = await generateObject({
      model: this.llm,
      schema: actionSchema,
      messages: this.messages,
      temperature: 0,
    });

    return response.object;
  }

  // Helper function to wait for a specified number of seconds
  async wait(seconds: number) {
    return new Promise((resolve) => setTimeout(resolve, seconds * 1000));
  }

  logTaskInfo(task: string) {
    console.log(chalk.cyan.bold("\n🎯 Task: "), chalk.whiteBright(task));
    console.log(chalk.yellow.bold("\n💡 Explanation:"));
    console.log(chalk.whiteBright(this.taskExplanation));
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

    // Run plan creation and browser launch concurrently
    await Promise.all([this.createPlan(task), this.browser.start()]);

    this.logTaskInfo(task);

    // Go to the starting URL
    await this.browser.goto(this.url);

    // Setup messages
    this.setupMessages(task);
    let finalAnswer = null;

    // Start the loop
    while (!finalAnswer) {
      // Get the page snapshot directly from the browser
      const pageSnapshot = await this.browser.getText();

      if (this.DEBUG) {
        console.log(chalk.cyan.bold("\n🤔 Messages:"));
        console.log(chalk.gray(JSON.stringify(this.messages, null, 2)));
      }

      console.log(chalk.cyan.bold("\n🤔 Thinking..."));

      // Call LLM with the page snapshot
      const result = await this.getNextActions(pageSnapshot);

      console.log(chalk.yellow.bold("🔭 Observation:"));
      console.log(chalk.whiteBright("   " + result.observation));

      console.log(chalk.yellow.bold("\n💭 Thought:"));
      console.log(chalk.whiteBright("   " + result.thought));

      console.log(chalk.yellow.bold("\n🎯 Actions:"));
      console.log(
        chalk.whiteBright(`   1. ${result.action.action.toUpperCase()}`),
        result.action.ref ? chalk.cyan(`ref: ${result.action.ref}`) : "",
        result.action.value
          ? chalk.green(`value: "${result.action.value}"`)
          : ""
      );

      // Check for the final answer
      if (result.action.action === "done") {
        finalAnswer = result.action.value;
        break;
      }

      // Execute the action
      console.log(
        chalk.cyan.bold("\n▶️ Executing action:"),
        chalk.whiteBright(result.action.action.toUpperCase()),
        result.action.ref ? chalk.cyan(`ref: ${result.action.ref}`) : "",
        result.action.value
          ? chalk.green(`value: "${result.action.value}"`)
          : ""
      );

      try {
        switch (result.action.action) {
          case "wait":
            const seconds = parseInt(result.action.value || "1", 10);
            console.log(
              chalk.yellow.bold(
                `⏳ Waiting for ${seconds} second${seconds !== 1 ? "s" : ""}...`
              )
            );
            await this.wait(seconds);
            break;

          case "goto":
            if (result.action.value) {
              console.log(
                chalk.blue.bold(`🌐 Navigating to: ${result.action.value}`)
              );
              await this.browser.goto(result.action.value);
            } else {
              throw new Error("Missing URL for goto action");
            }
            break;

          case "back":
            console.log(chalk.blue.bold(`◀️ Going back to the previous page`));
            await this.browser.goBack();
            break;

          case "forward":
            console.log(chalk.blue.bold(`▶️ Going forward to the next page`));
            await this.browser.goForward();
            break;

          default:
            if (!result.action.ref) {
              throw new Error("Missing ref for action");
            }
            await this.browser.performAction(
              result.action.ref,
              result.action.action,
              result.action.value
            );
        }

        // For interactive actions, wait for the page to settle
        if (
          [
            "click",
            "select",
            "fill",
            "hover",
            "check",
            "uncheck",
            "goto",
            "back",
            "forward",
          ].includes(result.action.action)
        ) {
          console.log(
            chalk.gray("   🌐 Waiting for network activity to settle...")
          );
          try {
            // Wait for both network idle and DOM to be stable
            await this.browser.waitForLoadState("networkidle", {
              timeout: 2000,
            });
            await this.browser.waitForLoadState("domcontentloaded", {
              timeout: 2000,
            });
          } catch (e) {
            // If timeout occurs, just continue
            console.log(
              chalk.gray("   ⚠️  Network wait timed out, continuing...")
            );
          }
        }

        // Add the successful result to messages for context
        this.messages.push({
          role: "assistant",
          content: JSON.stringify(result),
        });
      } catch (error) {
        console.error(
          chalk.red.bold(`❌ Failed to execute action: `),
          chalk.whiteBright(
            error instanceof Error ? error.message : String(error)
          )
        );
        // Add the failure to the messages for context
        this.messages.push({
          role: "assistant",
          content: `Failed to execute action: ${
            error instanceof Error ? error.message : String(error)
          }`,
        });
      }
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
    await this.browser.shutdown();
  }

  /**
   * Compresses the aria tree snapshot to reduce token usage while maintaining essential information
   */
  private compressSnapshot(snapshot: string): string {
    // First apply all our normal transformations
    const transformed = snapshot
      .split("\n")
      .map((line) => line.trim())
      .map((line) => line.replace(/^- /, ""))
      .filter(
        (line) =>
          !this.FILTERED_PREFIXES.some((start) => line.startsWith(start))
      )
      .map((line) => {
        return this.ARIA_TRANSFORMATIONS.reduce(
          (processed, [pattern, replacement]) =>
            processed.replace(pattern, replacement),
          line
        );
      })
      .filter(Boolean);

    // Then deduplicate repeated text strings by checking previous line
    let lastQuotedText = "";
    const deduped = transformed.map((line) => {
      const match = line.match(/^([^"]*)"([^"]+)"(.*)$/);
      if (!match) return line;

      const [, prefix, quotedText, suffix] = match;
      if (quotedText === lastQuotedText) {
        return `${prefix}[same as above]${suffix}`;
      }

      lastQuotedText = quotedText;
      return line;
    });

    return deduped.join("\n");
  }
}
