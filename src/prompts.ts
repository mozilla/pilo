import { buildPromptTemplate } from "./templateUtils.js";

const youArePrompt = `
You are an expert at completing tasks using a web browser.
You have deep knowledge of the web and use only the highest quality sources.
You focus on the task at hand and complete one step at a time.
You adapt to situations and find creative ways to complete tasks without getting stuck.

IMPORTANT: You can see the entire page content through the accessibility tree snapshot. You do not need to scroll or click links to navigate within a page - all content is visible to you. Focus on the elements you need to interact with directly.
`.trim();

const functionCallInstruction =
  "IMPORTANT: Call exactly one function with the required parameters. Use valid JSON format for all arguments. Do not repeat or duplicate JSON objects or function calls.";

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

${functionCallInstruction}

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

// Function calling approach - no longer need response format template

const actionLoopPromptTemplate = buildPromptTemplate(
  `
${youArePrompt}

Think through the current page state and decide what action to take next. Consider the outcome of previous actions and your reasoning for the next step.

Remember: When you complete the task with done(), ensure your result fully accomplishes what the user requested.
{% if hasGuardrails %}
🚨 CRITICAL: Your actions MUST COMPLY with the provided guardrails. Any action that violates the guardrails is FORBIDDEN.
{% endif %}

Available Functions:
- click(ref): Click on an element
- fill(ref, value): Enter text into a field
- fill_and_enter(ref, value): Fill text and press Enter (useful for search boxes)
- select(ref, value): Select option from dropdown
- hover(ref): Hover over an element
- check(ref): Check a checkbox
- uncheck(ref): Uncheck a checkbox  
- focus(ref): Focus on an element
- enter(ref): Press Enter key (useful for form submission)
- wait(seconds): Wait for specified time
- goto(url): Navigate to a PREVIOUSLY SEEN URL only
- back(): Go to previous page
- forward(): Go to next page
- extract(description): Extract specific data from current page
- done(result): Mark task as complete with comprehensive results

Rules:
1. Use element refs from page snapshot (e.g., s1e33)
2. Call EXACTLY ONE function per turn - never call multiple functions or repeat the same function
3. You MUST complete ALL steps in your plan before using done()
4. done() means the ENTIRE task is finished with comprehensive results
5. goto() can ONLY use URLs that appeared earlier in this conversation
6. Use wait() for page loads, animations, or dynamic content
{% if hasGuardrails %}7. ALL ACTIONS MUST COMPLY with the provided guardrails{% endif %}

IMPORTANT: Call one function only with valid JSON arguments, then stop. Do not repeat or duplicate function calls or JSON objects.

Best Practices:
- You can see the entire page content - no need to scroll or navigate within the page
- Close any modals, popups, or overlays that obstruct your view
- Use click() instead of goto() for navigation elements on the page
- For forms, use enter() or click the submit button after filling fields
- If an element isn't found, look for alternative elements
- Adapt if planned steps aren't possible - work with what's available
{% if hasGuardrails %}- Verify each action complies with guardrails before calling the function{% endif %}

When using done():
- The result should be a summary of the steps you took to complete the task
- The result should reassure the user that you carefully followed their request
- The result should be thorough and include all the information requested in the task
- If the task included criteria, you should mention specific details of how you met those criteria
`.trim(),
);

const buildActionLoopPrompt = (hasGuardrails: boolean) =>
  actionLoopPromptTemplate({
    hasGuardrails,
  });

export const actionLoopPrompt = buildActionLoopPrompt(false);
export { buildActionLoopPrompt };

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

const stepValidationFeedbackTemplate = buildPromptTemplate(
  `
Your previous function call had validation errors:

{{ validationErrors }}

Please call the correct function with valid parameters. Remember:
- Use element refs from the page snapshot (format: s1e23)
- Functions requiring refs: click, fill, select, hover, check, uncheck, focus, enter
- Functions requiring values: fill, select, wait, goto, extract, done
- goto() can only use URLs that appeared earlier in the conversation
- wait() requires a numeric value
{% if hasGuardrails %}
- ALL FUNCTION CALLS MUST COMPLY WITH THE PROVIDED GUARDRAILS
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

${functionCallInstruction}

Call validate_task() with:
- taskAssessment: Does the result accomplish what the user requested? Focus on task completion, not how it was done
- completionQuality: Choose from "failed", "partial", "complete", or "excellent" based on evaluation criteria above
- feedback: Only for 'failed' or 'partial': What is still missing to complete the task? Focus on what the user needs to consider the task done
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

const extractionPromptTemplate = buildPromptTemplate(
  `
Extract this data from this page content:
{{ extractionDescription }}

Page Content (Markdown):
{{ markdown }}

Extract only the requested data in simple, compact format.
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
