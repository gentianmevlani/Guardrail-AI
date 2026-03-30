/**
 * Global Error Handlers
 *
 * Handles unhandled promise rejections and errors in the frontend.
 * Logs to Sentry (if available) and shows user-friendly toasts.
 */

import { logger } from '@/lib/logger';

// Sentry interface for optional logging
interface SentryLike {
  captureException: (error: Error, context?: object) => void;
  captureMessage: (message: string, context?: object) => void;
}

// Dynamic Sentry import - works whether or not Sentry is installed
let Sentry: SentryLike | null = null;
try {
  Sentry = require("@sentry/nextjs");
} catch {
  // Sentry not installed; errors fall through to logger below
}

// Track reported errors to prevent double-logging
const reportedErrors = new WeakSet<Error>();

export interface ErrorHandlerConfig {
  onNetworkError?: () => void;
  onAuthError?: () => void;
  onGenericError?: (message: string) => void;
}

let config: ErrorHandlerConfig = {};

/**
 * Configure error handlers with custom callbacks
 */
export function configureErrorHandlers(newConfig: ErrorHandlerConfig): void {
  config = { ...config, ...newConfig };
}

/**
 * Check if error was already reported
 */
function wasReported(error: unknown): boolean {
  if (error instanceof Error) {
    if (reportedErrors.has(error)) {
      return true;
    }
    reportedErrors.add(error);
  }
  return false;
}

/**
 * Categorize error for user-friendly messaging
 */
function categorizeError(
  error: unknown,
): "network" | "auth" | "timeout" | "generic" {
  if (!(error instanceof Error)) {
    return "generic";
  }

  const message = error.message.toLowerCase();
  const name = error.name.toLowerCase();

  // Network errors
  if (
    message.includes("networkerror") ||
    message.includes("network error") ||
    message.includes("failed to fetch") ||
    (message.includes("fetch") && message.includes("fail")) ||
    (name === "typeerror" && message.includes("fetch"))
  ) {
    return "network";
  }

  // Auth errors
  if (
    message.includes("401") ||
    message.includes("unauthorized") ||
    message.includes("authentication") ||
    (error as any).status === 401
  ) {
    return "auth";
  }

  // Timeout errors
  if (
    message.includes("timeout") ||
    message.includes("timed out") ||
    name === "aborterror"
  ) {
    return "timeout";
  }

  return "generic";
}

/**
 * Handle an error with appropriate logging and user feedback
 */
export function handleError(
  error: unknown,
  context: { handler: string; extra?: Record<string, unknown> } = {
    handler: "unknown",
  },
): void {
  // Skip if already reported
  if (wasReported(error)) {
    return;
  }

  // Log to Sentry or console
  if (Sentry) {
    if (error instanceof Error) {
      Sentry.captureException(error, {
        tags: { handler: context.handler },
        extra: context.extra,
      });
    } else {
      Sentry.captureMessage(String(error), {
        level: "error",
        tags: { handler: context.handler },
        extra: { ...context.extra, rawError: error },
      });
    }
  } else {
    logger.logUnknownError(`[${context.handler}]`, error, {
      handler: context.handler,
      ...context.extra,
    });
  }

  // Categorize and handle
  const category = categorizeError(error);

  switch (category) {
    case "network":
      config.onNetworkError?.();
      break;
    case "auth":
      // Don't show toast for auth errors - redirect will happen
      config.onAuthError?.();
      break;
    case "timeout":
      config.onGenericError?.("Request timed out. Please try again.");
      break;
    default:
      config.onGenericError?.("Something went wrong. Please try again.");
  }
}

/**
 * Handle unhandled promise rejection
 */
function handleUnhandledRejection(event: PromiseRejectionEvent): void {
  const error = event.reason;

  handleError(error, {
    handler: "unhandledrejection",
    extra: { promise: String(event.promise) },
  });

  // Prevent default browser error logging
  event.preventDefault();
}

/**
 * Handle uncaught errors
 */
function handleWindowError(event: ErrorEvent): void {
  handleError(event.error || new Error(event.message), {
    handler: "window.error",
    extra: {
      filename: event.filename,
      lineno: event.lineno,
      colno: event.colno,
    },
  });
}

/**
 * Setup global error handlers
 * Call this once in your app's root component
 */
export function setupGlobalErrorHandlers(): () => void {
  if (typeof window === "undefined") {
    return () => {};
  }

  // Add listeners
  window.addEventListener("unhandledrejection", handleUnhandledRejection);
  window.addEventListener("error", handleWindowError);

  // Return cleanup function
  return () => {
    window.removeEventListener("unhandledrejection", handleUnhandledRejection);
    window.removeEventListener("error", handleWindowError);
  };
}

/**
 * Wrap an async function with error handling
 */
export function withErrorHandling<T extends (...args: any[]) => Promise<any>>(
  fn: T,
  context: string,
): T {
  return (async (...args: Parameters<T>): Promise<ReturnType<T>> => {
    try {
      return await fn(...args);
    } catch (error) {
      handleError(error, { handler: context });
      throw error;
    }
  }) as T;
}

/**
 * React Error Boundary fallback props
 */
export interface ErrorFallbackProps {
  error: Error;
  resetErrorBoundary: () => void;
}

/**
 * Log error from React Error Boundary
 */
export function logErrorBoundary(
  error: Error,
  errorInfo: { componentStack: string },
): void {
  handleError(error, {
    handler: "ErrorBoundary",
    extra: { componentStack: errorInfo.componentStack },
  });
}
