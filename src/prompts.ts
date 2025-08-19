import { buildPromptTemplate } from "./utils/template.js";

/**
 * Centralized tool descriptions and schema definitions.
 * Organized by tool category for better maintainability.
 */
export const TOOL_STRINGS = {
  /**
   * Web action tools - browser automation actions
   */
  webActions: {
    /** Common parameter descriptions used across multiple tools */
    common: {
      elementRefExample: "e###",
      elementRef: "Element reference from page snapshot (e.g., e###)",
      textValue: "Text to enter into the field",
    },
    /** Individual tool descriptions */
    click: {
      description: "Click on an element on the page",
    },
    fill: {
      description: "Fill text into an input field",
    },
    select: {
      description: "Select an option from a dropdown",
      value: "Option to select",
    },
    hover: {
      description: "Hover over an element",
    },
    check: {
      description: "Check a checkbox",
    },
    uncheck: {
      description: "Uncheck a checkbox",
    },
    focus: {
      description: "Focus on an element",
    },
    enter: {
      description: "Press Enter key on an element (useful for form submission)",
    },
    fill_and_enter: {
      description: "Fill text into an input field and press Enter (useful for search boxes)",
    },
    wait: {
      description: "Wait for a specified number of seconds",
      seconds: "Number of seconds to wait (0-30)",
    },
    goto: {
      description: "Navigate to a URL that was previously seen in the conversation",
      url: "URL to navigate to (must be previously seen)",
    },
    back: {
      description: "Go back to the previous page",
    },
    forward: {
      description: "Go forward to the next page",
    },
    extract: {
      description: "Extract specific data from the current page for later reference",
      dataDescription: "Precise description of the data to extract. DO NOT use `ref` values.",
    },
    done: {
      description:
        "Mark the entire task as complete with final results that directly address ALL parts of the original task",
      result:
        "A summary of the steps you took to complete the task and the final results that directly address ALL parts of the original task",
    },
    abort: {
      description:
        "Abort the task when it cannot be completed due to site issues, blocking, or missing data",
      reason:
        "A description of what has been attempted so far and why the task cannot be completed (e.g., site is down, access blocked, required data unavailable)",
    },
  },

  /**
   * Planning tools - task planning and URL determination
   */
  planning: {
    /** Common parameter descriptions */
    common: {
      explanation: "Task explanation in agent's own words",
      plan: "Step-by-step plan for the task",
    },
    /** Individual tool descriptions */
    create_plan: {
      description: "Create a step-by-step plan for completing the task",
    },
    create_plan_with_url: {
      description: "Create a step-by-step plan and determine the best starting URL",
      url: "Starting URL for the task",
    },
  },

  /**
   * Validation tools - task completion quality assessment
   */
  validation: {
    /** Individual tool descriptions */
    validate_task: {
      description: "Validate if the task has been completed successfully",
      taskAssessment: "Brief assessment of how well the task was completed",
      completionQuality:
        "Quality of task completion: failed (not done), partial (incomplete), complete (done adequately), excellent (done very well)",
      feedback: "Specific feedback on what needs improvement (if not complete/excellent)",
    },
  },
} as const;

/** Base AI persona for web automation tasks. */
const youArePrompt = `
You are an expert at completing tasks using a web browser.
You have deep knowledge of the web and use only the highest quality sources.
You focus on the task at hand and complete one step at a time.
You adapt to situations and find creative ways to complete tasks without getting stuck.

IMPORTANT:
- You can see the entire page content through the accessibility tree snapshot.
- You do not need to scroll or click links to navigate within a page - all content is visible to you.
- Focus on the elements you need to interact with directly.
`.trim();

/** Available browser action tools with JSON syntax examples. */
const toolExamples = `
- click({"ref": "${TOOL_STRINGS.webActions.common.elementRefExample}"}) - ${TOOL_STRINGS.webActions.click.description}
- fill({"ref": "${TOOL_STRINGS.webActions.common.elementRefExample}", "value": "text"}) - ${TOOL_STRINGS.webActions.fill.description}
- fill_and_enter({"ref": "${TOOL_STRINGS.webActions.common.elementRefExample}", "value": "text"}) - ${TOOL_STRINGS.webActions.fill_and_enter.description}
- select({"ref": "${TOOL_STRINGS.webActions.common.elementRefExample}", "value": "option"}) - ${TOOL_STRINGS.webActions.select.description}
- hover({"ref": "${TOOL_STRINGS.webActions.common.elementRefExample}"}) - ${TOOL_STRINGS.webActions.hover.description}
- check({"ref": "${TOOL_STRINGS.webActions.common.elementRefExample}"}) - ${TOOL_STRINGS.webActions.check.description}
- uncheck({"ref": "${TOOL_STRINGS.webActions.common.elementRefExample}"}) - ${TOOL_STRINGS.webActions.uncheck.description}
- focus({"ref": "${TOOL_STRINGS.webActions.common.elementRefExample}"}) - ${TOOL_STRINGS.webActions.focus.description}
- enter({"ref": "${TOOL_STRINGS.webActions.common.elementRefExample}"}) - ${TOOL_STRINGS.webActions.enter.description}
- wait({"seconds": 3}) - ${TOOL_STRINGS.webActions.wait.description}
- goto({"url": "https://example.com"}) - ${TOOL_STRINGS.webActions.goto.description}
- back() - ${TOOL_STRINGS.webActions.back.description}
- forward() - ${TOOL_STRINGS.webActions.forward.description}
- extract({"description": "data to extract"}) - ${TOOL_STRINGS.webActions.extract.description}
- done({"result": "your final answer"}) - ${TOOL_STRINGS.webActions.done.description}
- abort({"reason": "what was tried and why it failed"}) - ${TOOL_STRINGS.webActions.abort.description}
`.trim();

/** Standard tool calling instruction. */
const toolCallInstruction = `
You MUST use exactly one tool with the required parameters.
Use valid JSON format for all arguments.
CRITICAL: Use each tool exactly ONCE. Do not repeat or duplicate the same tool call multiple times.
`.trim();

/**
 * Planning prompt - converts tasks into structured execution plans.
 * Generates: create_plan_with_url() or create_plan() tool calls.
 * Used by: planTask() in WebAgent during planning phase.
 */
const planPromptTemplate = buildPromptTemplate(
  `
${youArePrompt}
Create a plan for this web navigation task.
Provide a clear explanation{% if includeUrl %}, step-by-step plan, and starting URL{% else %} and step-by-step plan{% endif %}.
Focus on general steps and goals rather than specific page features or UI elements.

Today's Date: {{ currentDate }}
Task: {{ task }}
{% if startingUrl %}Starting URL: {{ startingUrl }}{% endif %}
{% if guardrails %}Guardrails: {{ guardrails }}{% endif %}

Best Practices:
- When explaining the task, make sure to expand all dates to include the year.
- For booking tasks, all dates must be in the future.
- Avoid assumptions about specific UI layouts that may change.
{% if startingUrl %}- Use the provided starting URL as your starting point for the task.{% endif %}
{% if guardrails %}- Consider the guardrails when creating your plan to ensure all steps comply with the given limitations.{% endif %}

{% if includeUrl %}
Call create_plan_with_url() with:
- explanation: ${TOOL_STRINGS.planning.common.explanation}
- plan: ${TOOL_STRINGS.planning.common.plan}
- url: ${TOOL_STRINGS.planning.create_plan_with_url.url}
{% else %}
Call create_plan() with:
- explanation: ${TOOL_STRINGS.planning.common.explanation}
- plan: ${TOOL_STRINGS.planning.common.plan}
{% endif %}

${toolCallInstruction}
`.trim(),
);

export const buildPlanAndUrlPrompt = (task: string, guardrails?: string | null) =>
  planPromptTemplate({
    task,
    currentDate: getCurrentFormattedDate(),
    includeUrl: true,
    guardrails,
  });

export const buildPlanPrompt = (task: string, startingUrl?: string, guardrails?: string | null) =>
  planPromptTemplate({
    task,
    currentDate: getCurrentFormattedDate(),
    includeUrl: false,
    startingUrl,
    guardrails,
  });

/**
 * Action system prompt - guides AI browser interactions during execution.
 * Generates: All web action tool calls (click, fill, done, abort, etc.).
 * Used by: initializeConversation() as the system message.
 */
const actionLoopSystemPromptTemplate = buildPromptTemplate(
  `
${youArePrompt}

Analyze the current page state and determine your next action based on previous outcomes.

**Available Tools:**
{{ toolExamples }}

**Core Rules:**
1. Use element refs from page snapshot. They are found in square brackets: [${TOOL_STRINGS.webActions.common.elementRefExample}].
2. Execute EXACTLY ONE tool per turn
3. Complete ALL planned steps before using done()
4. done() indicates ENTIRE task completion with comprehensive results
5. goto() only accepts URLs from earlier in conversation
6. Use wait() for page loads, animations, or dynamic content
{% if hasGuardrails %}7. ALL actions MUST comply with provided guardrails{% endif %}

**CRITICAL:** You MUST use exactly ONE tool with valid arguments EVERY turn. Choose:
- done(result) if task is complete
- abort(reason) if task cannot be completed due to site issues, blocking, or missing data
- Appropriate action tool if work remains
- extract() if you need more information

**Best Practices:**
- Full page content is visible - no scrolling needed
- Clear obstructing modals/popups first
- Prefer click() over goto() for page navigation
- Submit forms via enter() or submit button after filling
- Find alternative elements if primary ones aren't available
- Adapt your approach based on what's actually available
- Use abort() only when you have exhausted reasonable alternatives and the task truly cannot be completed (site down, access blocked, required data unavailable)
- For research: Use extract() immediately when finding relevant data
{% if hasGuardrails %}- Verify guardrail compliance before each action{% endif %}

**When using done():**
Your result should:
- Summarize completed steps
- Confirm careful adherence to user's request
- Include all requested information thoroughly
- Reference specific criteria met (if applicable)

{% if hasGuardrails %}
🚨 **GUARDRAIL COMPLIANCE:** Any action violating the provided guardrails is FORBIDDEN.
{% endif %}

${toolCallInstruction}
`.trim(),
);

/** Build action system prompt with optional guardrails. */
const buildActionLoopSystemPrompt = (hasGuardrails: boolean) =>
  actionLoopSystemPromptTemplate({
    hasGuardrails,
    toolExamples,
  });

export const actionLoopSystemPrompt = buildActionLoopSystemPrompt(false);
export { buildActionLoopSystemPrompt };

/**
 * Task context prompt - provides task, plan, and data to AI.
 * Used by: initializeConversation() as the first user message.
 */
const taskAndPlanTemplate = buildPromptTemplate(
  `
Task: {{ task }}
Explanation: {{ explanation }}
Plan: {{ plan }}
Today's Date: {{ currentDate }}
{% if data %}
Input Data:
\`\`\`json
{{ data }}
\`\`\`
{% endif %}
{% if guardrails %}

**MANDATORY GUARDRAILS**
{{ guardrails }}

These guardrails are ABSOLUTE REQUIREMENTS that you MUST follow at all times. Any action that violates these guardrails is STRICTLY FORBIDDEN.
{% endif %}
`.trim(),
);

export const buildTaskAndPlanPrompt = (
  task: string,
  explanation: string,
  plan: string,
  data?: any,
  guardrails?: string | null,
) =>
  taskAndPlanTemplate({
    task,
    explanation,
    plan,
    currentDate: getCurrentFormattedDate(),
    data: data ? JSON.stringify(data, null, 2) : null,
    guardrails,
  });

/**
 * Page snapshot prompt - shows current page state to AI.
 * Used by: updateConversation() before each action generation.
 * Includes: Accessibility tree, title, URL, optional screenshot.
 */
const pageSnapshotTemplate = buildPromptTemplate(
  `
Title: {{ title }}
URL: {{ url }}

\`\`\`
{{ snapshot }}
\`\`\`

This accessibility tree shows the complete current page content.{% if hasScreenshot %} A screenshot is included for visual context.{% endif %}

**Your task:**
- Analyze the current state and select your next action
- Target the most relevant elements for your objective
- If an action fails, adapt immediately—don't repeat failed attempts
- Find alternative approaches when planned steps aren't viable
{% if hasScreenshot %}- Use the screenshot to understand layout and identify elements missed in the text{% endif %}
- Follow all guardrails

${toolCallInstruction}
`.trim(),
);

export const buildPageSnapshotPrompt = (
  title: string,
  url: string,
  snapshot: string,
  hasScreenshot: boolean = false,
) =>
  pageSnapshotTemplate({
    title,
    url,
    snapshot,
    hasScreenshot,
  });

/**
 * Error feedback prompt - informs AI when actions fail.
 * Used by: Validator.giveFeedback() after failures.
 */
const stepErrorFeedbackTemplate = buildPromptTemplate(
  `
# Error Occurred
{{ error }}

{% if hasGuardrails %}
CRITICAL: ALL TOOL CALLS MUST COMPLY WITH THE PROVIDED GUARDRAILS
{% endif %}

${toolCallInstruction}
`.trim(),
);

export const buildStepErrorFeedbackPrompt = (error: string, hasGuardrails: boolean = false) =>
  stepErrorFeedbackTemplate({
    error,
    hasGuardrails,
    toolExamples,
  });

/**
 * Task validation prompt - evaluates completion quality.
 * Generates: validate_task() tool call.
 * Used by: validateCompletion() when AI calls done().
 * Returns: Quality rating (failed/partial/complete/excellent) and feedback.
 */
const taskValidationTemplate = buildPromptTemplate(
  `
Evaluate how well the task result accomplishes what the user requested. Focus on task completion, not process.
Be concise in your response.

Task: {{ task }}
Result: {{ finalAnswer }}

Evaluation criteria:
- **failed**: Task not completed or result doesn't accomplish what was requested
- **partial**: Task partially completed but result is missing key elements
- **complete**: Task fully completed and result accomplishes what was requested
- **excellent**: Task completed exceptionally well with valuable additional elements

Only use 'failed' or 'partial' when the result genuinely fails to accomplish the task. The process doesn't matter if the task is completed successfully.

Call validate_task() with:
- taskAssessment: ${TOOL_STRINGS.validation.validate_task.taskAssessment}
- completionQuality: ${TOOL_STRINGS.validation.validate_task.completionQuality}
- feedback: ${TOOL_STRINGS.validation.validate_task.feedback}

${toolCallInstruction}
`.trim(),
);

export const buildTaskValidationPrompt = (
  task: string,
  finalAnswer: string,
  conversationHistory: string,
): string =>
  taskValidationTemplate({
    task,
    finalAnswer,
    conversationHistory,
  });

/**
 * Validation feedback prompt - sent when task completion is insufficient.
 * Used by: validateTaskCompletion() when validation fails.
 */
const taskValidationFeedbackTemplate = buildPromptTemplate(
  `
## Task Incomplete - Attempt {{ attemptNumber }}

{{ taskAssessment }}

**Feedback:** {{ feedback }}

Do not repeat your previous answer. Address the issues identified above.
`.trim(),
);

export const buildValidationFeedbackPrompt = (
  attemptNumber: number,
  taskAssessment: string,
  feedback: string | null,
): string =>
  taskValidationFeedbackTemplate({
    attemptNumber,
    taskAssessment,
    feedback: feedback || "Please review the task requirements and provide a more complete answer.",
  });

/**
 * Data extraction prompt - extracts specific data from pages.
 * Used by: executeAction() when AI calls extract() tool.
 * Input: Page markdown content and extraction description.
 */
const extractionPromptTemplate = buildPromptTemplate(
  `
Extract this data from the page content:
{{ extractionDescription }}

Page Content (Markdown):
{{ markdown }}

Instructions:
- Include all relevant details that match the extraction request
- Present the data in well-structured markdown format

Return only the extracted data – no other text or commentary.
`.trim(),
);

export const buildExtractionPrompt = (extractionDescription: string, markdown: string): string =>
  extractionPromptTemplate({
    extractionDescription,
    markdown,
  });

/** Get current date in "MMM D, YYYY" format. */
function getCurrentFormattedDate() {
  const date = new Date();
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}
