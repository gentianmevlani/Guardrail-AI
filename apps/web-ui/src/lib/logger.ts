/**
 * Client-side structured logger
 * Provides consistent logging with context in browser environments
 */
/* eslint-disable no-console */

const isDev = process.env.NODE_ENV === 'development';

interface LogContext {
  component?: string;
  userId?: string;
  error?: string;
  stack?: string;
  [key: string]: any;
}

// Helper to convert unknown to LogContext
function toLogContext(value: unknown): LogContext | undefined {
  if (!value) return undefined;
  if (value instanceof Error) {
    return {
      error: value.message,
      stack: value.stack,
    };
  }
  if (typeof value === 'object') {
    return value as LogContext;
  }
  return { error: String(value) };
}

class ClientLogger {
  private formatMessage(level: string, message: string, context?: LogContext | unknown): void {
    const logContext = context ? toLogContext(context) : undefined;
    const timestamp = new Date().toISOString();
    const logData = {
      timestamp,
      level,
      message,
      environment: process.env.NODE_ENV,
      ...logContext,
    };

    // In development, use pretty formatting
    if (isDev) {
      const prefix = `[${timestamp}] [${level.toUpperCase()}]`;
      const contextStr = logContext ? ` ${JSON.stringify(logContext)}` : '';

      switch (level) {
        case 'debug':
          console.log(`${prefix} ${message}${contextStr}`);
          break;
        case 'info':
          console.info(`${prefix} ${message}${contextStr}`);
          break;
        case 'warn':
          console.warn(`${prefix} ${message}${contextStr}`);
          break;
        case 'error':
          console.error(`${prefix} ${message}${contextStr}`);
          break;
      }
    } else {
      // In production, use structured JSON logging
      // This can be sent to log aggregation services
      const logStr = JSON.stringify(logData);

      switch (level) {
        case 'error':
          console.error(logStr);
          break;
        case 'warn':
          console.warn(logStr);
          break;
        default:
          console.log(logStr);
      }

      // TODO(#23): Send to external logging service (e.g., Sentry, LogRocket)
      // this.sendToExternalLogger(logData);
    }
  }

  debug(message: string, context?: LogContext | unknown): void {
    if (isDev) {
      this.formatMessage('debug', message, context);
    }
  }

  info(message: string, context?: LogContext | unknown): void {
    this.formatMessage('info', message, context);
  }

  warn(message: string, context?: LogContext | unknown): void {
    this.formatMessage('warn', message, context);
  }

  error(message: string, context?: LogContext | unknown): void {
    this.formatMessage('error', message, context);
  }

  // Helper to log errors with stack traces
  logError(error: Error, context?: LogContext): void {
    this.error(error.message, {
      ...context,
      error: error.message,
      stack: error.stack,
    });
  }

  // Helper to log unknown errors (from catch blocks)
  logUnknownError(message: string, error: unknown, context?: LogContext): void {
    const errorContext: LogContext = {
      ...context,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    };
    this.error(message, errorContext);
  }

  // Helper to create child logger with default context
  child(defaultContext: LogContext): ClientLogger {
    const childLogger = new ClientLogger();
    const originalFormat = childLogger.formatMessage.bind(childLogger);

    childLogger.formatMessage = (level: string, message: string, context?: LogContext) => {
      originalFormat(level, message, { ...defaultContext, ...context });
    };

    return childLogger;
  }
}

export const logger = new ClientLogger();
