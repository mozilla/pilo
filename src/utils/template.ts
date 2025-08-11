import { Liquid, Template } from "liquidjs";

const engine = new Liquid({
  cache: false, // Disable caching since we're managing parsing ourselves
});

/**
 * Creates a Liquid template function that parses once and can be reused
 * LiquidJS is CSP-safe and doesn't use eval/new Function
 */
export function buildPromptTemplate(templateSource: string): (context: any) => string {
  // Parse the template once when buildPromptTemplate is called
  const parsedTemplate: Template[] = engine.parse(templateSource);

  // Return a function that renders the pre-parsed template
  return (context: any) => {
    return engine.renderSync(parsedTemplate, context);
  };
}
