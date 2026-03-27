import { wrapExternalContentWithWarning, ExternalContentLabel } from "./utils/promptSecurity.js";
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
      elementRefExample: "E###",
      elementRef: "Element reference from page snapshot (e.g., E###)",
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
        "The complete, standalone deliverable in VALID Markdown format. NEVER use raw JSON - format ALL data as VALID Markdown.",
    },
    abort: {
      description:
        "Abort the task when it cannot be completed due to site issues, blocking, or missing data",
      reason:
        "A description of what has been attempted so far and why the task cannot be completed (e.g., site is down, access blocked, required data unavailable)",
    },
    requestUserData: {
      description:
        "Request personal or business data from the user and fill the form fields directly. The user's values are filled exactly as provided. Use ONLY for fields requiring the user's own data (name, email, address, phone, payment info, credentials, etc.). NEVER for search boxes, filters, or fields you fill as part of task navigation.",
      reason:
        'Why data is being requested: "initial" for first-time requests, "validation_error" when re-requesting after form validation failed',
      formDescription:
        "Brief description of the form and its purpose (e.g., 'Shipping address form', 'Account registration')",
    },
    webSearch: {
      description:
        "Search the web for information. Returns the search results page as markdown. Use when you need to find websites or information but don't know the URL.",
      query: "The search query to execute",
    },
  },

  /**
   * Planning tools - task planning and optional URL determination
   */
  planning: {
    /** Common parameter descriptions */
    common: {
      successCriteria: "What would make a great response - key information and detail level needed",
      plan: "Step-by-step plan for the task, MUST be formatted as VALID Markdown",
      actionItems:
        "Array of 3-6 word action titles (e.g., ['Search for recipes', 'Filter results'])",
    },
    /** Individual tool descriptions */
    create_plan: {
      description:
        "Create a step-by-step plan for completing the task, MUST be formatted as VALID Markdown",
      url: "The best starting URL for the task",
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
  /**
   * Tabstack tools - cloud-based extraction and generation via Tabstack API
   */
  tabstack: {
    tabstack_extract_markdown: {
      description:
        "Extract clean markdown content from a URL (web page or PDF). Especially useful for PDFs, which browsers cannot read directly. Returns the page content as markdown with metadata (title, description, author, etc.).",
      url: "The URL to extract content from (web page or PDF URL)",
    },
    tabstack_extract_json: {
      description:
        "Extract structured JSON data from a URL according to a JSON Schema you provide. The schema defines the exact shape of the data you want extracted from the page.",
      url: "The URL to extract data from",
      json_schema:
        "A JSON Schema object defining the desired output structure. Must include type, properties, and optionally required fields. Use description fields on properties to guide extraction.",
    },
    tabstack_generate_json: {
      description:
        "Fetch a URL and transform its content into structured JSON using AI, guided by your natural language instructions and a JSON Schema for the output format.",
      url: "The URL to process",
      json_schema: "A JSON Schema object defining the desired output structure",
      instructions:
        "Natural language instructions describing how to transform or generate the data from the page content",
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
- The accessibility tree shows all currently loaded page elements. On dynamic pages, some content may only appear after scrolling or interaction — if expected data isn't visible, try scrolling or interacting to trigger loading.
- Focus on the elements you need to interact with directly.
`.trim();

/** Build available browser action tools with JSON syntax examples. */
function buildToolExamples(
  hasWebSearch: boolean,
  hasTabstack: boolean = false,
  hasInteractive: boolean = false,
): string {
  const lines = [
    `- click({"ref": "${TOOL_STRINGS.webActions.common.elementRefExample}"}) - ${TOOL_STRINGS.webActions.click.description}`,
    `- fill({"ref": "${TOOL_STRINGS.webActions.common.elementRefExample}", "value": "text"}) - ${TOOL_STRINGS.webActions.fill.description}`,
    `- select({"ref": "${TOOL_STRINGS.webActions.common.elementRefExample}", "value": "option"}) - ${TOOL_STRINGS.webActions.select.description}`,
    `- hover({"ref": "${TOOL_STRINGS.webActions.common.elementRefExample}"}) - ${TOOL_STRINGS.webActions.hover.description}`,
    `- check({"ref": "${TOOL_STRINGS.webActions.common.elementRefExample}"}) - ${TOOL_STRINGS.webActions.check.description}`,
    `- uncheck({"ref": "${TOOL_STRINGS.webActions.common.elementRefExample}"}) - ${TOOL_STRINGS.webActions.uncheck.description}`,
    `- focus({"ref": "${TOOL_STRINGS.webActions.common.elementRefExample}"}) - ${TOOL_STRINGS.webActions.focus.description}`,
    `- enter({"ref": "${TOOL_STRINGS.webActions.common.elementRefExample}"}) - ${TOOL_STRINGS.webActions.enter.description}`,
    `- wait({"seconds": 3}) - ${TOOL_STRINGS.webActions.wait.description}`,
    `- goto({"url": "https://example.com"}) - ${TOOL_STRINGS.webActions.goto.description}`,
    `- back() - ${TOOL_STRINGS.webActions.back.description}`,
    `- forward() - ${TOOL_STRINGS.webActions.forward.description}`,
    `- extract({"description": "data to extract"}) - ${TOOL_STRINGS.webActions.extract.description}`,
  ];

  if (hasWebSearch) {
    lines.push(
      `- webSearch({"query": "search terms"}) - ${TOOL_STRINGS.webActions.webSearch.description}`,
    );
  }

  if (hasTabstack) {
    lines.push(
      `- tabstack_extract_markdown({"url": "https://example.com"}) - ${TOOL_STRINGS.tabstack.tabstack_extract_markdown.description}`,
      `- tabstack_extract_json({"url": "https://example.com", "json_schema": {"type": "object", "properties": {"field": {"type": "string"}}}}) - ${TOOL_STRINGS.tabstack.tabstack_extract_json.description}`,
      `- tabstack_generate_json({"url": "https://example.com", "json_schema": {"type": "object", "properties": {"field": {"type": "string"}}}, "instructions": "..."}) - ${TOOL_STRINGS.tabstack.tabstack_generate_json.description}`,
    );
  }

  if (hasInteractive) {
    lines.push(
      `- request_user_data({"reason": "initial", "formDescription": "Account signup form", "fields": [{"ref": "E42", "label": "Email", "fieldType": "email", "required": true}]}) - ${TOOL_STRINGS.webActions.requestUserData.description}`,
    );
  }

  lines.push(
    `- done({"result": "your final answer"}) - ${TOOL_STRINGS.webActions.done.description}`,
    `- abort({"reason": "what was tried and why it failed"}) - ${TOOL_STRINGS.webActions.abort.description}`,
  );

  return lines.join("\n");
}

/** Standard tool calling instruction. */
const toolCallInstruction = `
You MUST use exactly one tool with the required parameters.
Use valid JSON format for all arguments.
CRITICAL: Use each tool exactly ONCE. Do not repeat or duplicate the same tool call multiple times.
`.trim();

/**
 * Base planning prompt content - shared across all planning prompt variants.
 * Contains the core planning instructions without tool-specific sections.
 */
const planningBaseContent = `
${youArePrompt}
Create a plan for this web navigation task.
First, briefly identify what the user needs from this task.
Then provide a step-by-step plan.
Keep plans concise and high-level, focusing on goals not specific UI elements.

Today's Date: {{ currentDate }}
Task: {{ task }}
{% if startingUrl %}Starting URL: {{ startingUrl }}{% endif %}
{% if guardrails %}Guardrails: {{ guardrails }}{% endif %}

PART 1: SUCCESS CRITERIA
What does the user need? Describe what a great response would include - the key information and level of detail that would fully satisfy their request.

PART 2: NAVIGATION PLAN
Provide a strategic plan for accomplishing the task.

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
`.trim();

/**
 * Planning prompt — single template for all scenarios.
 * - startingUrl provided: URL shown in prompt, no url param needed.
 * - No startingUrl, no webSearch: planner must provide a url.
 * - No startingUrl, webSearch enabled: planner doesn't need a url (agent uses webSearch).
 */
const planPromptTemplate = buildPromptTemplate(
  `
${planningBaseContent}

Call create_plan() with:
- successCriteria: ${TOOL_STRINGS.planning.common.successCriteria}
- plan: ${TOOL_STRINGS.planning.common.plan}
- actionItems: ${TOOL_STRINGS.planning.common.actionItems}
{% if not startingUrl and not webSearchEnabled %}- url: ${TOOL_STRINGS.planning.create_plan.url}{% endif %}
{% if not startingUrl and webSearchEnabled %}- url (optional): ${TOOL_STRINGS.planning.create_plan.url}. You do not need to provide a starting URL — the agent has web search available and will find the right sites during execution.{% endif %}

${toolCallInstruction}
`.trim(),
);

/**
 * Builds the planning prompt.
 *
 * @param task - The task to plan
 * @param startingUrl - Optional URL to start from
 * @param guardrails - Optional constraints/guardrails
 * @param webSearchEnabled - Whether the agent has web search available
 */
export const buildPlanPrompt = (
  task: string,
  startingUrl?: string,
  guardrails?: string | null,
  webSearchEnabled?: boolean,
) =>
  planPromptTemplate({
    task,
    currentDate: getCurrentFormattedDate(),
    startingUrl,
    guardrails,
    webSearchEnabled,
  });

/**
 * Action system prompt - guides AI browser interactions during execution.
 * Generates: All web action tool calls (click, fill, done, abort, etc.).
 * Used by: initializeConversation() as the system message.
 */
const actionLoopSystemPromptTemplate = buildPromptTemplate(
  `
${youArePrompt}

Today's Date: {{ currentDate }}

Analyze the current page state and determine your next action based on previous outcomes.

**Available Tools:**
{{ toolExamples }}

**Core Rules:**
1. Use element refs from page snapshot. They are found in square brackets: [ref=${TOOL_STRINGS.webActions.common.elementRefExample}].
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
- The accessibility tree shows currently loaded elements; dynamic pages may load more content on scroll
- Clear obstructing modals/popups first
- Prefer click() over goto() for page navigation
- Submit forms via enter() or submit button after filling
- Find alternative elements if primary ones aren't available
- When click() fails due to element interception, try focus() first, then keyboard navigation (Tab, Enter, arrow keys), or press Escape to dismiss overlapping overlays
- For autocomplete/combobox search fields (e.g., flight origin/destination, location pickers): after fill(), use focus() on a visible suggestion in the dropdown followed by enter() to select it — click() on autocomplete suggestions often times out
- For date pickers and calendar widgets: prefer typing dates directly into the date input field using fill() rather than clicking through calendar months; if the field doesn't respond to fill(), try focus() on it first; avoid repeated calendar navigation clicks — if clicking "next month" fails twice, try filling the date field directly or using keyboard input
- When you receive an 'Invalid element reference' error, the page DOM has changed — read the updated page snapshot on your next turn and use the new element refs; do not retry old ref IDs
- Adapt your approach based on what's actually available
- If you don't find relevant links or buttons, and the site has a search form, prioritize using it for navigation
- If you have found the core information requested but cannot access supplementary details due to site limitations, use done() with what you have — only use abort() when the core task cannot be completed at all
- For research: Use extract() immediately when finding relevant data
- For academic papers or documents that require reading, counting, or extracting content (e.g., counting figures/tables, reading body text): PDFs are often unscrollable and unreadable{% if hasTabstack %} — use tabstack_extract_markdown to read PDF content directly{% endif %}{% if not hasTabstack %} — use webSearch to find an HTML version (e.g., ACL Anthology, Semantic Scholar) or the abstract page before attempting the PDF{% endif %}
{% if hasWebSearch %}- If you need to search the web, use webSearch({query}) directly rather than filling in a browser search engine (DuckDuckGo, Google, Bing, etc.) — webSearch avoids CAPTCHA and bot detection that will block browser-based searches{% endif %}
{% if hasTabstack %}- **Tabstack cloud tools are available — prefer them over manual browsing when they fit:**
  - tabstack_extract_markdown: Use this for PDFs (browsers render PDFs in a viewer you cannot read) and whenever you need clean text from a page without navigating to it
  - tabstack_extract_json: Use when you need structured data from a page and can define the desired shape as a JSON Schema
  - tabstack_generate_json: Use when you need AI-transformed content (summaries, categorization, restructured data){% endif %}
{% if hasStartingUrl and hasWebSearch %}- A starting URL was provided — **focus on that site first**. Use webSearch only if you need supplementary information beyond what the site provides{% endif %}
{% if hasGuardrails %}- Verify guardrail compliance before each action{% endif %}

**When using done():**
Provide your final answer:
- Think of this as a final deliverable, not part of a conversation
- Match the depth to the task (brief for simple queries, detailed for research)
- Write naturally and informatively
- Include all requested information
- Format results as VALID Markdown
- NEVER return raw JSON - ALWAYS format structured data as VALID Markdown
- If the task required finding content that meets specific criteria (minimum rating, review count, price range, ingredient count, etc.), explicitly confirm each criterion was met in your answer

{% if hasGuardrails %}
🚨 **GUARDRAIL COMPLIANCE:** Any action violating the provided guardrails is FORBIDDEN.
{% endif %}

{% if hasInteractive %}
🔒 **INTERACTIVE MODE (MANDATORY):**
You MUST use request_user_data() for any form field that requires the user's personal or business data. This tool collects the data AND fills the fields directly. Do NOT use fill/select/check on these fields afterward. Generating, guessing, or fabricating personal data is a **privacy violation** and is strictly forbidden.

**You MUST use request_user_data for:**
- Name, email, phone, address, date of birth
- Passwords, usernames, account credentials
- Payment information (card numbers, billing address)
- Any field asking for the user's personal or business information

**You MUST NOT use request_user_data for:**
- Search boxes you use to find information
- Sort/filter controls
- Navigation inputs (URL bars, page numbers)
- Any field where YOU decide what to enter as part of completing the task

**After request_user_data succeeds:**
- The fields are already filled. Do NOT re-fill them.
- Proceed with form submission (click submit button or press enter) or the next step.

**After form submission, check for validation errors:**
After clicking submit, look at the NEXT PAGE SNAPSHOT (accessibility tree) for validation errors. Do NOT use extract() to look for errors. Validation errors will appear directly in the accessibility tree as text elements near the affected fields. If you see validation errors, call request_user_data again immediately with reason "validation_error" for the affected fields only. Include the error message in each field's description so the user knows what went wrong.
{% endif %}

${toolCallInstruction}
`.trim(),
);

/** Build action system prompt with optional guardrails, web search, Tabstack, and interactive tools. */
const buildActionLoopSystemPrompt = (
  hasGuardrails: boolean,
  hasWebSearch: boolean = false,
  hasTabstack: boolean = false,
  hasStartingUrl: boolean = false,
  hasInteractive: boolean = false,
) =>
  actionLoopSystemPromptTemplate({
    hasGuardrails,
    hasWebSearch,
    hasTabstack,
    hasStartingUrl,
    hasInteractive,
    toolExamples: buildToolExamples(hasWebSearch, hasTabstack, hasInteractive),
    currentDate: getCurrentFormattedDate(),
  });

export const actionLoopSystemPrompt = buildActionLoopSystemPrompt(false, false);
export { buildActionLoopSystemPrompt };

/**
 * Task context prompt - provides task, plan, and data to AI.
 * Used by: initializeConversation() as the first user message.
 */
const taskAndPlanTemplate = buildPromptTemplate(
  `
Today's Date: {{ currentDate }}
Task: {{ task }}
Success Criteria: {{ successCriteria }}
Plan: {{ plan }}
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
{{ wrappedPageSnapshot }}

Today's Date: {{ currentDate }}

The above accessibility tree shows page elements in a hierarchical text format. Each line represents an element with:
- Element type (button, link, textbox, generic, etc.)
- Text content in quotes or description
- Reference ID in brackets like [ref=E###] - use these exact IDs when interacting with elements
- Properties like [cursor=pointer] or [disabled]
Example: button "Submit Form" [ref=E455] [cursor=pointer]

This shows the complete current page content.{% if hasScreenshot %} A labeled screenshot is included. The screenshot marks interactive elements (links, buttons, inputs) with colored badges showing their ref IDs (E1, E2, etc.). The tree above includes refs on all visible elements for structural context — only the interactive ones are labeled in the screenshot.{% endif %}

**Your task:**
- Analyze the current state and select your next action
- Target the most relevant elements for your objective
- If an action fails, adapt immediately—don't repeat failed attempts
- Find alternative approaches when planned steps aren't viable
{% if hasScreenshot %}- Use the labeled screenshot to visually locate interactive elements and match them to [ref=E###] IDs in the tree{% endif %}
- Follow all guardrails

${toolCallInstruction}
`.trim(),
);

export const buildPageSnapshotPrompt = (
  title: string,
  url: string,
  snapshot: string,
  hasScreenshot: boolean = false,
) => {
  const pageContent = `Title: ${title}\nURL: ${url}\n\n${snapshot}`;
  return pageSnapshotTemplate({
    wrappedPageSnapshot: wrapExternalContentWithWarning(
      pageContent,
      ExternalContentLabel.PageSnapshot,
    ),
    hasScreenshot,
    currentDate: getCurrentFormattedDate(),
  });
};

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

**Recovery guidance:**
- If the error mentions "Invalid element reference" or "does not exist on the current page": the page DOM has changed and your cached ref IDs are stale. Do NOT retry the same ref. Wait for the next page snapshot (it will arrive automatically) and use only the new ref IDs shown there.
- If an action keeps failing after 2 attempts, try a different approach: use a different element, navigate differently, or use extract() to re-read the current state.
- Do NOT repeat the same action with the same arguments.

**Available Tools:**
{{ toolExamples }}

${toolCallInstruction}
`.trim(),
);

export const buildStepErrorFeedbackPrompt = (
  error: string,
  hasGuardrails: boolean = false,
  hasWebSearch: boolean = false,
  hasTabstack: boolean = false,
) =>
  stepErrorFeedbackTemplate({
    error,
    hasGuardrails,
    toolExamples: buildToolExamples(hasWebSearch, hasTabstack),
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

Today's Date: {{ currentDate }}
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
    currentDate: getCurrentFormattedDate(),
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
If you cannot address the feedback due to genuine site limitations (disabled UI, inaccessible content), call done() with the best answer available rather than aborting.
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
{{ wrappedMarkdown }}

Today's Date: {{ currentDate }}

Extract this data from the page content above:
{{ extractionDescription }}

Instructions:
- Include all relevant details that match the extraction request
- Present the data in well-structured markdown format

Return only the extracted data – no other text or commentary.
`.trim(),
);

export const buildExtractionPrompt = (extractionDescription: string, markdown: string): string =>
  extractionPromptTemplate({
    extractionDescription,
    wrappedMarkdown: wrapExternalContentWithWarning(markdown, ExternalContentLabel.PageMarkdown),
    currentDate: getCurrentFormattedDate(),
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
