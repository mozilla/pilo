const youArePrompt = `
You are an expert at completing tasks using a web browser.
You have deep knowledge of the web and use only the highest quality sources.
You focus on the task at hand and complete one step at a time.
You adapt to situations and find creative ways to complete tasks without getting stuck.
`.trim();

import { buildPromptTemplate } from "./templateUtils.js";

const planPromptTemplate = buildPromptTemplate(
  `
{{youArePrompt}}
Create a plan for this web navigation task.
Provide a clear explanation{{#if includeUrl}}, step-by-step plan, and starting URL{{else}} and step-by-step plan{{/if}}.
Focus on general steps and goals rather than specific page features or UI elements.

Today's Date: {{currentDate}}
Task: {{task}}
{{#if startingUrl}}Starting URL: {{startingUrl}}{{/if}}
{{#if guardrails}}Guardrails: {{guardrails}}{{/if}}

Best Practices:
- When explaining the task, make sure to expand all dates to include the year.
- For booking tasks, all dates must be in the future.
- Avoid assumptions about specific UI layouts that may change.
{{#if startingUrl}}- Use the provided starting URL as your starting point for the task.{{/if}}
{{#if guardrails}}- Consider the guardrails when creating your plan to ensure all steps comply with the given limitations.{{/if}}

Respond with a JSON object matching this structure:
\`\`\`json
{
  "explanation": "Restate the task concisely in your own words, focusing on the core objective.",
  "plan": "Create a high-level, numbered list plan for this web navigation task, with each step on its own line. Focus on general steps without assuming specific page features."{{#if includeUrl}},
  "url": "Must be a real top-level domain with no path OR a web search: https://duckduckgo.com/?q=search+query"{{/if}}
}
\`\`\`
`.trim(),
);

export const buildPlanAndUrlPrompt = (task: string, guardrails?: string | null) =>
  planPromptTemplate({
    youArePrompt,
    task,
    currentDate: getCurrentFormattedDate(),
    includeUrl: true,
    guardrails,
  });

export const buildPlanPrompt = (task: string, startingUrl?: string, guardrails?: string | null) =>
  planPromptTemplate({
    youArePrompt,
    task,
    currentDate: getCurrentFormattedDate(),
    includeUrl: false,
    startingUrl,
    guardrails,
  });

const actionLoopResponseFormatTemplate = buildPromptTemplate(`{
  "currentStep": "Status (Starting/Working on/Completing) Step #: [exact step text from plan]",
  "observation": "Brief assessment of previous step's outcome. Was it a success or failure? Note the type of data you should extract from the page to complete the task.",
  "observationStatusMessage": "REQUIRED: Short, friendly message (3-8 words) about what you observed. Examples: 'Found search form', 'Page loaded successfully', 'Login required first', 'Checking page content'.",
  "extractedData": "OPTIONAL: Only extract important data from the page that is needed to complete the task. This shouldn't include any element refs. Use markdown to structure this data clearly. Omit this field if no relevant data needs extraction.",
  "extractedDataStatusMessage": "CONDITIONAL: Required if extractedData is present. Short, friendly message (3-8 words) about what data was found. Examples: 'Flight options noted', 'Product details saved', 'Search results ready'",
  "thought": "Reasoning for your next action.{{#if hasGuardrails}} Your actions MUST COMPLY with the provided guardrails.{{/if}} If the previous action failed, retry once then try an alternative approach.",
  "action": {
    "action": "REQUIRED: One of these exact values: click, hover, fill, focus, check, uncheck, select, wait, goto, back, forward, done",
    "ref": "CONDITIONAL: Required for click/hover/fill/focus/check/uncheck/select actions. Format: s1e23 (not needed for wait/goto/back/forward/done)",
    "value": "CONDITIONAL: Required for fill/select/goto/wait/done actions. Text for fill/select, URL for goto, seconds for wait, final result for done"
  },
  "actionStatusMessage": "REQUIRED: A short, friendly status update (3-8 words) for the user about what action you're taking. Examples: 'Clicking search button', 'Filling departure city', 'Selecting flight option'"
}`);

const buildActionLoopPrompt = (hasGuardrails: boolean) =>
  `
${youArePrompt}
For each step, assess the current state and decide on the next action to take.
Consider the outcome of previous actions and explain your reasoning.
${hasGuardrails ? "\n🚨 CRITICAL: Your actions MUST COMPLY with the provided guardrails. Any action that violates the guardrails is FORBIDDEN." : ""}

Actions:
- "select": Select option from dropdown (ref=element reference, value=option)
- "fill": Enter text into field (ref=element reference, value=text)
- "click": Click element (ref=element reference)
- "hover": Hover over element (ref=element reference)
- "check": Check checkbox (ref=element reference)
- "uncheck": Uncheck checkbox (ref=element reference)
- "wait": Wait for specified time (value=seconds)
- "goto": Navigate to a PREVIOUSLY SEEN URL (value=URL)
- "back": Go to previous page
- "forward": Go to next page
- "done": Task is complete (value=final result)

Rules:
1. Use refs from page snapshot (e.g., [ref=s1e33])
2. Perform only one action per step
3. After each action, you'll receive an updated page snapshot
4. For "done", include the final result in value
5. Use "wait" for page loads, animations, or dynamic content
6. The "goto" action can ONLY be used with a URL that has already appeared in the conversation history (either the starting URL or a URL visited during the task). Do NOT invent new URLs.
${hasGuardrails ? "7. ALL ACTIONS MUST BE CHECKED AGAINST THE GUARDRAILS BEFORE EXECUTION" : ""}

Best Practices:
- Use click instead of goto whenever possible, especially for navigation elements on the page.
- For forms, click the submit button after filling all fields
- If an element isn't found, try looking for alternative elements
${hasGuardrails ? "- Before taking any action, verify it does not violate the guardrails" : ""}

Respond with a JSON object matching this structure:
\`\`\`json
${actionLoopResponseFormatTemplate({ hasGuardrails })}
\`\`\`
`.trim();

export const actionLoopPrompt = buildActionLoopPrompt(false);
export { buildActionLoopPrompt };

const taskAndPlanTemplate = buildPromptTemplate(
  `
Task: {{task}}
Explanation: {{explanation}}
Plan: {{plan}}
Today's Date: {{currentDate}}
{{#if data}}
Input Data:
\`\`\`json
{{data}}
\`\`\`
{{/if}}
{{#if guardrails}}

**MANDATORY GUARDRAILS**
{{guardrails}}

These guardrails are ABSOLUTE REQUIREMENTS that you MUST follow at all times. Any action that violates these guardrails is STRICTLY FORBIDDEN.
{{/if}}
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
This is a text snapshot of the current page in the browser.

Title: {{title}}
URL: {{url}}

\`\`\`
{{snapshot}}
\`\`\`

Assess the current state and choose your next action.
Focus on the most relevant elements that help complete your task.
If content appears dynamic or paginated, consider waiting or exploring navigation options.
If an action has failed twice, try something else or move on.
`.trim(),
);

export const buildPageSnapshotPrompt = (title: string, url: string, snapshot: string) =>
  pageSnapshotTemplate({
    title,
    url,
    snapshot,
  });

const validationFeedbackTemplate = buildPromptTemplate(
  `
Your previous response did not match the required format. Here are the validation errors:

{{validationErrors}}

Please correct your response to match this exact format:
\`\`\`json
{{actionLoopResponseFormat}}
\`\`\`

Remember:
- "actionStatusMessage" is REQUIRED and must be a short, user friendly status update (3-8 words)
- "observationStatusMessage" is REQUIRED and must be a short, user friendly status update (3-8 words)
- "extractedDataStatusMessage" is REQUIRED if "extractedData" is present
- For "select", "fill", "click", "hover", "check", "uncheck" actions, you MUST provide a "ref"
- For "fill", "select", "goto" actions, you MUST provide a "value"
- For "wait" action, you MUST provide a "value" with the number of seconds
- For "done" action, you MUST provide a "value" with the final result
- For "back" and "forward" actions, you must NOT provide a "ref" or "value"
- "extractedData" is optional - only include if there's relevant data to extract
{{#if hasGuardrails}}
- ALL ACTIONS MUST COMPLY WITH THE PROVIDED GUARDRAILS
{{/if}}
`.trim(),
);

export const buildValidationFeedbackPrompt = (
  validationErrors: string,
  hasGuardrails: boolean = false,
) =>
  validationFeedbackTemplate({
    validationErrors,
    actionLoopResponseFormat: actionLoopResponseFormatTemplate({ hasGuardrails }),
    hasGuardrails,
  });

const taskValidationTemplate = buildPromptTemplate(
  `
Review the task completion and determine if it was successful by analyzing both the final answer and the conversation that led to it.

Task: {{task}}
Final Answer: {{finalAnswer}}

Conversation History:
{{conversationHistory}}

Analyze the task completion using these quality levels:
- **failed**: Task not completed or completed incorrectly
- **partial**: Some objectives met but task incomplete or has significant issues  
- **complete**: Task fully completed as requested with acceptable approach
- **excellent**: Task completed efficiently with optimal approach and high quality result

Evaluation criteria:
1. Does the final answer directly address the task?
2. Is the answer complete and specific enough?
3. Did the agent perform the requested action or provide the requested information?
4. Was the approach reasonable and efficient?
5. Are there any significant errors or omissions?

Respond with a JSON object matching this structure:
\`\`\`json
{
  "observation": "Analyze how the agent approached the task: sequence of actions taken, appropriateness of actions, reasoning quality, and whether the agent worked efficiently toward the goal or got sidetracked.",
  "completionQuality": "failed|partial|complete|excellent",
  "feedback": "If quality is not 'complete' or 'excellent', provide specific, actionable guidance on what needs to be improved. Focus on what the agent should do differently next time. If quality is 'complete' or 'excellent', this field is optional."
}
\`\`\`
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

function getCurrentFormattedDate() {
  const date = new Date();
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}
