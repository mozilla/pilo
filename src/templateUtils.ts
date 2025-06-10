import Handlebars from "handlebars";

/**
 * Creates a Handlebars template with HTML escaping disabled
 * since we're generating prompts, not HTML content
 */
export function buildPromptTemplate(templateSource: string): HandlebarsTemplateDelegate {
  return Handlebars.compile(templateSource, { noEscape: true });
}