/**
 * Centralized logging utility for the Pilo extension
 * Provides consistent logging across all components
 */

type LogLevel = "debug" | "info" | "warn" | "error";

interface LogContext {
  component?: string;
  tabId?: number;
  url?: string;
  [key: string]: any;
}

class Logger {
  private isDevelopment = process.env.NODE_ENV === "development";

  private formatMessage(level: LogLevel, message: string, context?: LogContext): string {
    const timestamp = new Date().toISOString();
    const component = context?.component ? `[${context.component}]` : "";
    const tabInfo = context?.tabId ? `[Tab:${context.tabId}]` : "";

    return `[${timestamp}] ${level.toUpperCase()} ${component}${tabInfo} ${message}`;
  }

  private log(level: LogLevel, message: string, context?: LogContext, ...args: any[]) {
    if (!this.isDevelopment && level === "debug") {
      return; // Skip debug logs in production
    }

    const formattedMessage = this.formatMessage(level, message, context);

    switch (level) {
      case "debug":
        console.debug(formattedMessage, ...args);
        break;
      case "info":
        console.info(formattedMessage, ...args);
        break;
      case "warn":
        console.warn(formattedMessage, ...args);
        break;
      case "error":
        console.error(formattedMessage, ...args);
        break;
    }
  }

  debug(message: string, context?: LogContext, ...args: any[]) {
    this.log("debug", message, context, ...args);
  }

  info(message: string, context?: LogContext, ...args: any[]) {
    this.log("info", message, context, ...args);
  }

  warn(message: string, context?: LogContext, ...args: any[]) {
    this.log("warn", message, context, ...args);
  }

  error(message: string, context?: LogContext, ...args: any[]) {
    this.log("error", message, context, ...args);
  }
}

export const logger = new Logger();

/**
 * Create a logger instance with a specific component context
 */
export function createLogger(component: string) {
  return {
    debug: (message: string, context?: Omit<LogContext, "component">, ...args: any[]) =>
      logger.debug(message, { component, ...context }, ...args),
    info: (message: string, context?: Omit<LogContext, "component">, ...args: any[]) =>
      logger.info(message, { component, ...context }, ...args),
    warn: (message: string, context?: Omit<LogContext, "component">, ...args: any[]) =>
      logger.warn(message, { component, ...context }, ...args),
    error: (message: string, context?: Omit<LogContext, "component">, ...args: any[]) =>
      logger.error(message, { component, ...context }, ...args),
  };
}
