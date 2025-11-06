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
      dataDescription:
        "Describe what information to extract. Focus on content, not element references.",
    },
    done: {
      description: "Complete the task with your final answer",
      result:
        "The complete, standalone deliverable in Markdown format. NEVER use raw JSON - format all data as Markdown.",
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
      successCriteria: "What would make a great response - key information and detail level needed",
      plan: "Step-by-step plan for the task, formatted as Markdown",
    },
    /** Individual tool descriptions */
    create_plan: {
      description: "Create a step-by-step plan for completing the task, formatted as Markdown",
    },
    create_plan_with_url: {
      description:
        "Create a step-by-step plan formatted as Markdown and determine the best starting URL",
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
First, briefly identify what the user needs from this task.
Then provide a{% if includeUrl %} step-by-step plan and starting URL{% else %} step-by-step plan{% endif %}.
Keep plans concise and high-level, focusing on goals not specific UI elements.

Today's Date: {{ currentDate }}
Task: {{ task }}
{% if startingUrl %}Starting URL: {{ startingUrl }}{% endif %}
{% if guardrails %}Guardrails: {{ guardrails }}{% endif %}

PART 1: SUCCESS CRITERIA
What does the user need? Describe what a great response would include - the key information and level of detail that would fully satisfy their request.

PART 2: NAVIGATION PLAN
{% if includeUrl %}Provide a strategic plan starting from the given URL.{% else %}Provide a strategic plan for accomplishing the task.{% endif %}

Your plan should:

1. **Start with Overall Strategy**
- Define the general approach before listing individual steps
- Identify whether this is a search, comparison, booking, research, or verification task
- Note if you'll need to gather information from multiple sources

2. **Focus on Information Goals**
- Write steps that describe what information to find, not specific UI elements
- Keep steps general enough to work even if page layouts change

3. **Be Clear and Sequential**
- List concrete steps in logical order
- Indicate what information to gather at each major step
- Note when to compare multiple options or dig deeper

4. **Follow Constraints**
{% if startingUrl %}- Begin from the provided URL{% endif %}
{% if guardrails %}- Ensure every step complies with the stated limitations{% endif %}
- All dates must include the year
- Booking dates must be in the future

{% if includeUrl %}
Call create_plan_with_url() with:
- successCriteria: ${TOOL_STRINGS.planning.common.successCriteria}
- plan: ${TOOL_STRINGS.planning.common.plan}
- url: ${TOOL_STRINGS.planning.create_plan_with_url.url}
{% else %}
Call create_plan() with:
- successCriteria: ${TOOL_STRINGS.planning.common.successCriteria}
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
3. Complete planned steps before using done()
4. done() provides your final answer to the user
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
- Use abort() only after trying reasonable alternatives (site down, access blocked, required data unavailable)
- For research: Use extract() immediately when finding relevant data
{% if hasGuardrails %}- Verify guardrail compliance before each action{% endif %}

**When using done():**
Provide your final answer:
- Think of this as a final deliverable, not part of a conversation
- Match the depth to the task (brief for simple queries, detailed for research)
- Write naturally and informatively
- Include all requested information
- Format results as readable Markdown
- NEVER return raw JSON - always format structured data as Markdown

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
Success Criteria: {{ successCriteria }}
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
  successCriteria: string,
  plan: string,
  data?: any,
  guardrails?: string | null,
) =>
  taskAndPlanTemplate({
    task,
    successCriteria,
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

The above accessibility tree shows page elements in a hierarchical text format. Each line represents an element with:
- Element type (button, link, textbox, generic, etc.)
- Text content in quotes or description
- Reference ID in brackets like [e###] - use these exact IDs when interacting with elements
- Properties like [cursor=pointer] or [disabled]
Example: button "Submit Form" [e455] [cursor=pointer]

This shows the complete current page content.{% if hasScreenshot %} A screenshot is included for visual context.{% endif %}

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
Evaluate if the task result gives the user what they requested.
Be concise in your response.

Task: {{ task }}
Success Criteria: {{ successCriteria }}
Result: {{ finalAnswer }}

Evaluation approach:
1. Compare the result against the success criteria defined above
2. Check if all required information is included
3. Verify the answer meets the specified format and detail level
4. Assess if key requirements are satisfied

Quality ratings:
- **failed**: Task not completed or result doesn't address the request
- **partial**: Some requirements met but missing key elements
- **complete**: Task accomplished with all requested information
- **excellent**: Goes beyond requirements with particularly useful additions

Focus on whether the user received what they needed in a clear, usable format.

Call validate_task() with:
- taskAssessment: ${TOOL_STRINGS.validation.validate_task.taskAssessment}
- completionQuality: ${TOOL_STRINGS.validation.validate_task.completionQuality}
- feedback: ${TOOL_STRINGS.validation.validate_task.feedback}

${toolCallInstruction}
`.trim(),
);

export const buildTaskValidationPrompt = (
  task: string,
  successCriteria: string,
  finalAnswer: string,
  conversationHistory: string,
): string =>
  taskValidationTemplate({
    task,
    successCriteria,
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
