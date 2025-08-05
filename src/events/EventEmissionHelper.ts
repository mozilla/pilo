import { WebAgentEventType } from "../events.js";

/**
 * Helper class for common event emission patterns
 */
export class EventEmissionHelper {
  constructor(private emitEvent: (type: WebAgentEventType, data: any) => void) {}

  /**
   * Emits AI generation metadata after successful completion
   */
  emitAIGenerationMetadata(stream: any, schema: any, messages: any[], finalResult: any): void {
    this.emitEvent(WebAgentEventType.AI_GENERATION, {
      prompt: undefined,
      schema,
      messages,
      temperature: 0,
      object: finalResult,
      finishReason: (stream as any).finishReason,
      usage: (stream as any).usage,
      warnings: (stream as any).warnings,
      providerMetadata: (stream as any).providerMetadata,
    });
  }

  /**
   * Emits AI generation error event
   */
  emitAIGenerationError(
    error: string,
    context: {
      prompt?: string;
      schema?: any;
      messages?: any[];
    },
  ): void {
    this.emitEvent(WebAgentEventType.AI_GENERATION_ERROR, {
      error,
      prompt: context.prompt,
      schema: context.schema,
      messages: context.messages,
    });
  }

  /**
   * Emits task validation error with retry information
   */
  emitTaskValidationError(errors: string[], retryCount: number, rawResponse: any): void {
    this.emitEvent(WebAgentEventType.TASK_VALIDATION_ERROR, {
      errors,
      retryCount,
      rawResponse,
    });
  }

  /**
   * Emits browser action started event with proper parameter handling
   */
  emitBrowserActionStarted(action: string, ref?: string, value?: string | number): void {
    this.emitEvent(WebAgentEventType.BROWSER_ACTION_STARTED, {
      action,
      ref: ref ?? undefined,
      value: value ?? undefined,
    });
  }

  /**
   * Emits browser action completed event
   */
  emitBrowserActionCompleted(success: boolean, error?: string): void {
    this.emitEvent(WebAgentEventType.BROWSER_ACTION_COMPLETED, {
      success,
      ...(error && { error }),
    });
  }

  /**
   * Emits agent status message
   */
  emitAgentStatus(message: string): void {
    this.emitEvent(WebAgentEventType.AGENT_STATUS, { message });
  }

  /**
   * Emits agent observation
   */
  emitAgentObservation(observation: string): void {
    this.emitEvent(WebAgentEventType.AGENT_OBSERVED, { observation });
  }

  /**
   * Helper to emit processing start/end events around AI operations
   */
  async withProcessingEvents<T>(
    operation: string,
    task: () => Promise<T>,
    hasScreenshot?: boolean,
  ): Promise<T> {
    this.emitEvent(WebAgentEventType.AGENT_PROCESSING, {
      status: "start",
      operation,
      hasScreenshot,
    });
    try {
      const result = await task();
      this.emitEvent(WebAgentEventType.AGENT_PROCESSING, {
        status: "end",
        operation,
        hasScreenshot,
      });
      return result;
    } catch (error) {
      this.emitEvent(WebAgentEventType.AGENT_PROCESSING, {
        status: "end",
        operation,
        hasScreenshot,
      });
      throw error;
    }
  }
}
