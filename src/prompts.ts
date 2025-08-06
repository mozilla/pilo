import { buildPromptTemplate } from "./templateUtils.js";

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

// Available tools with proper JSON syntax
const toolExamples = `
- click({"ref": "s1e33"}) - Click on an element
- fill({"ref": "s1e33", "value": "text"}) - Enter text into a field
- fill_and_enter({"ref": "s1e33", "value": "text"}) - Fill and press Enter
- select({"ref": "s1e33", "value": "option"}) - Select from dropdown
- hover({"ref": "s1e33"}) - Hover over element
- check({"ref": "s1e33"}) - Check checkbox
- uncheck({"ref": "s1e33"}) - Uncheck checkbox
- focus({"ref": "s1e33"}) - Focus on element
- enter({"ref": "s1e33"}) - Press Enter key
- wait({"seconds": 3}) - Wait for specified time
- goto({"url": "https://example.com"}) - Navigate to URL (only previously seen URLs)
- back() - Go to previous page
- forward() - Go to next page
- extract({"description": "data to extract"}) - Extract data from current page
- done({"result": "your final answer"}) - Complete the task
`.trim();

const toolCallInstruction = `
You MUST use exactly one tool with the required parameters.
Use valid JSON format for all arguments.
CRITICAL: Use each tool exactly ONCE. Do not repeat or duplicate the same tool call multiple times.
`.trim();

/**
 * Planning Prompt Template
 *
 * Used by WebAgent during the PLANNING PHASE to generate task execution plans.
 * Called from generatePlanWithUrl() and generatePlan() methods.
 *
 * Purpose:
 * - Converts natural language tasks into structured step-by-step plans
 * - Determines optimal starting URLs when not provided by user
 * - Incorporates guardrails and contextual data into planning
 *
 * Usage in WebAgent:
 * 1. generatePlanWithUrl() - When no starting URL provided, AI chooses best site
 * 2. generatePlan() - When starting URL is provided, plan is tailored to that site
 *
 * Tool calls generated:
 * - create_plan_with_url(): Returns explanation, plan, and starting URL
 * - create_plan(): Returns explanation and plan (URL already known)
 *
 * The plan and explanation are stored in WebAgent state for use throughout execution.
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
- explanation: Restate the task concisely in your own words, focusing on the core objective
- plan: Create a high-level, numbered list plan for this web navigation task, with each step on its own line. Focus on general steps without assuming specific page features
- url: Must be a real top-level domain with no path OR a web search: https://duckduckgo.com/?q=search+query
{% else %}
Call create_plan() with:
- explanation: Restate the task concisely in your own words, focusing on the core objective
- plan: Create a high-level, numbered list plan for this web navigation task, with each step on its own line. Focus on general steps without assuming specific page features
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

// Tool calling approach - no longer need response format template

/**
 * Action Loop Prompt Template
 *
 * Used by WebAgent during the EXECUTION PHASE as the system prompt for action generation.
 * Called from initializeConversation() to set up the conversation context.
 *
 * Purpose:
 * - Provides the AI with instructions on how to interact with web pages
 * - Lists all available browser actions (click, fill, navigate, etc.)
 * - Establishes rules for tool calling and task completion
 * - Integrates guardrails when provided to constrain AI behavior
 *
 * Usage in WebAgent:
 * - Set as the system message in initializeConversation()
 * - Remains constant throughout the action execution loop
 * - Works with generateNextAction() to produce appropriate browser actions
 *
 * Tool calls generated:
 * - All web action tools: click, fill, select, hover, check, uncheck, focus, enter,
 *   fill_and_enter, wait, goto, back, forward, extract, done
 *
 * This prompt is the core instruction set that guides the AI's decision-making
 * throughout the entire task execution process.
 */
const actionLoopPromptTemplate = buildPromptTemplate(
  `
${youArePrompt}

Think through the current page state and decide what action to take next. Consider the outcome of previous actions and your reasoning for the next step.

Remember: When you complete the task with done(), ensure your result fully accomplishes what the user requested.
{% if hasGuardrails %}
🚨 CRITICAL: Your actions MUST COMPLY with the provided guardrails. Any action that violates the guardrails is FORBIDDEN.
{% endif %}

Available Tools:
{{ toolExamples }}

Rules:
1. Use element refs from page snapshot (e.g., s1e33)
2. Use EXACTLY ONE tool per turn - never use multiple tools or repeat the same tool
3. You MUST complete ALL steps in your plan before using done()
4. done() means the ENTIRE task is finished with comprehensive results
5. goto() can ONLY use URLs that appeared earlier in this conversation
6. Use wait() for page loads, animations, or dynamic content
{% if hasGuardrails %}7. ALL ACTIONS MUST COMPLY with the provided guardrails{% endif %}

**CRITICAL: You MUST use exactly ONE tool with valid arguments on EVERY turn. Never provide text-only responses.**
- If you think the task is complete, you must use done(result)
- If you need to take an action, use the appropriate tool
- If you're unsure, use extract() to gather more information

Best Practices:
- You can see the entire page content - no need to scroll or navigate within the page
- Close any modals, popups, or overlays that obstruct your view
- Use click() instead of goto() for navigation elements on the page
- For forms, use enter() or click the submit button after filling fields
- If an element isn't found, look for alternative elements
- Adapt if planned steps isn't possible - work with what's available
- For research tasks: Use extract() to capture data from relevant pages as you discover it - don't wait until the end
{% if hasGuardrails %}- Verify each action complies with guardrails before using the tool{% endif %}

When using done():
- The result should be a summary of the steps you took to complete the task
- The result should reassure the user that you carefully followed their request
- The result should be thorough and include all the information requested in the task
- If the task included criteria, you should mention specific details of how you met those criteria

Think carefully, then use exactly one appropriate tool. Failure to do so will result in an error.
${toolCallInstruction}
`.trim(),
);

const buildActionLoopPrompt = (hasGuardrails: boolean) =>
  actionLoopPromptTemplate({
    hasGuardrails,
    toolExamples,
  });

export const actionLoopPrompt = buildActionLoopPrompt(false);
export { buildActionLoopPrompt };

/**
 * Task and Plan Context Template
 *
 * Used by WebAgent to provide task context to the AI during action execution.
 * Called from initializeConversation() as the initial user message.
 *
 * Purpose:
 * - Gives the AI the original task description and generated plan
 * - Provides current date context for time-sensitive tasks
 * - Includes any input data provided by the user (JSON format)
 * - Reinforces guardrails as mandatory requirements
 *
 * Usage in WebAgent:
 * - Added as the first user message in initializeConversation()
 * - Contains the plan generated during the planning phase
 * - Includes taskExplanation, plan, data, and guardrails from WebAgent state
 *
 * This template connects the planning phase to the execution phase by providing
 * the AI with all the context it needs to execute the planned actions.
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
 * Page Snapshot Context Template
 *
 * Used by WebAgent to provide current page state to the AI for action decisions.
 * Called from updateMessagesWithSnapshot() during each iteration.
 *
 * Purpose:
 * - Shows the AI the current page content via accessibility tree snapshot
 * - Provides page title and URL for context
 * - Includes screenshot when vision mode is enabled
 * - Guides the AI to focus on actionable elements
 *
 * Usage in WebAgent:
 * - Added as user message before each generateNextAction() call
 * - Contains compressed page snapshot from compressSnapshot()
 * - Page snapshots from previous iterations are truncated to save tokens
 * - Screenshot is included when vision=true in WebAgent options
 *
 * This is the primary way the AI "sees" the current state of the web page
 * and determines what action to take next based on available elements.
 */
const pageSnapshotTemplate = buildPromptTemplate(
  `
This is a complete accessibility tree snapshot of the current page in the browser showing ALL page content.{% if hasScreenshot %} A screenshot is also provided to help you understand the visual layout.{% endif %}

Title: {{ title }}
URL: {{ url }}

\`\`\`
{{ snapshot }}
\`\`\`

The snapshot above contains the entire page content - you can see everything without scrolling or navigating within the page.
Assess the current state and choose your next action.
Focus on the most relevant elements that help complete your task.
If content appears dynamic or paginated, consider waiting or exploring navigation options.
If an action has failed or a planned step isn't possible, adapt your approach and work with what's actually available on the page. Do not keep trying the same action repeatedly - be flexible and find alternative ways to accomplish your goal.
{% if hasScreenshot %}Use the screenshot to better understand the page layout and identify elements that may not be fully captured in the text snapshot.{% endif %}
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
 * Step Validation Feedback Template
 *
 * Used by WebAgent to provide error feedback when AI generates invalid actions.
 * Called from addValidationErrorFeedback() when action validation fails.
 *
 * Purpose:
 * - Informs the AI about specific validation errors in its tool calls
 * - Provides reminders about correct tool call formats and requirements
 * - Guides the AI to retry with corrected parameters
 * - Reinforces guardrails compliance when applicable
 *
 * Usage in WebAgent:
 * - Triggered when validateToolCallAction() detects errors
 * - Added as user message after the failed assistant response
 * - Followed by retry attempt with generateNextAction()
 * - Used in the retry loop (up to MAX_RETRY_ATTEMPTS)
 *
 * Tool calls expected after this prompt:
 * - Corrected version of the previously failed tool call
 *
 * This prompt is critical for the AI's learning loop - it helps the AI
 * understand what went wrong and how to fix it on subsequent attempts.
 */
const stepValidationFeedbackTemplate = buildPromptTemplate(
  `
Your previous tool call had validation errors:

{{ validationErrors }}

Please use the correct tool with valid parameters. Remember:
- Use element refs from the page snapshot (format: s1e23)
- Tools requiring refs: click, fill, select, hover, check, uncheck, focus, enter
- Tools requiring values: fill, select, wait, goto, extract, done
- goto() can only use URLs that appeared earlier in the conversation
- wait() requires a numeric value
{% if hasGuardrails %}
- ALL TOOL CALLS MUST COMPLY WITH THE PROVIDED GUARDRAILS
{% endif %}

`.trim(),
);

export const buildStepValidationFeedbackPrompt = (
  validationErrors: string,
  hasGuardrails: boolean = false,
) =>
  stepValidationFeedbackTemplate({
    validationErrors,
    hasGuardrails,
  });

/**
 * Tool Call Error Correction Template
 *
 * Used by WebAgent when AI provides reasoning but fails to call any tool.
 * Called from convertToolCallToAction() when no tool calls are detected.
 *
 * Purpose:
 * - Shows the AI what they said vs what they should do
 * - Lists all available tools with proper JSON syntax
 * - Provides specific guidance based on their reasoning text
 * - Reinforces the requirement to use exactly one tool per turn
 *
 * Usage in WebAgent:
 * - Triggered when response.toolCalls is empty
 * - Includes the AI's reasoning text for context
 * - Followed by retry attempt in generateNextAction()
 * - Used in the retry loop before fatal error
 */
const toolCallErrorTemplate = buildPromptTemplate(
  `
TOOL CALL ERROR: You provided reasoning but no tool call.

Your reasoning: {{ reasoningText }}

You MUST use exactly one tool on every turn. Based on your reasoning, choose the appropriate tool:

Available Tools:
{{ toolExamples }}

Use the tool that best matches your reasoning.

${toolCallInstruction}
`.trim(),
);

export const buildToolCallErrorPrompt = (reasoningText: string) =>
  toolCallErrorTemplate({
    reasoningText,
    toolExamples,
  });

/**
 * Task Validation Template
 *
 * Used by WebAgent to validate task completion quality after AI calls done().
 * Called from validateTaskCompletion() during the VALIDATION PHASE.
 *
 * Purpose:
 * - Evaluates whether the AI's final result actually accomplishes the user's task
 * - Provides objective assessment of completion quality (failed/partial/complete/excellent)
 * - Generates feedback for improvement when task is incomplete
 * - Prevents premature task completion when work remains
 *
 * Usage in WebAgent:
 * - Triggered when AI calls done() tool
 * - Uses conversation history and final answer for evaluation context
 * - Result determines if task execution should continue or complete
 * - Up to maxValidationAttempts retries allowed for improvement
 *
 * Tool calls generated:
 * - validate_task(): Returns taskAssessment, completionQuality, and feedback
 *
 * Validation results guide the main execution loop:
 * - "complete"/"excellent": Task execution completes successfully
 * - "failed"/"partial": AI receives feedback and continues working
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
- taskAssessment: Does the result accomplish what the user requested? Focus on task completion, not how it was done
- completionQuality: Choose from "failed", "partial", "complete", or "excellent" based on evaluation criteria above
- feedback: Only for 'failed' or 'partial': What is still missing to complete the task? Focus on what the user needs to consider the task done

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
 * Data Extraction Template
 *
 * Used by WebAgent to extract specific data from web pages when extract() action is called.
 * Called from extractDataFromPage() during action execution.
 *
 * Purpose:
 * - Extracts specific information from page content based on AI's request
 * - Uses clean markdown representation instead of raw HTML for better accuracy
 * - Provides focused data extraction without navigating away from current page
 * - Returns extracted data in simple, compact format for easy consumption
 *
 * Usage in WebAgent:
 * - Triggered when AI calls extract(description) tool
 * - Uses browser.getMarkdown() for clean page content representation
 * - Uses simple text generation (not tool calling) for extraction
 * - Result is added to conversation history for AI context
 *
 * This prompt enables the AI to gather information from the current page
 * without changing the page state, useful for collecting data mid-task.
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

Provide the extracted data:
`.trim(),
);

export const buildExtractionPrompt = (extractionDescription: string, markdown: string): string =>
  extractionPromptTemplate({
    extractionDescription,
    markdown,
  });

function getCurrentFormattedDate() {
  const date = new Date();
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}
