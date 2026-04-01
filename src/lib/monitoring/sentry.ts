import * as Sentry from "@sentry/nextjs";

/**
 * Sentry Error Tracking Configuration
 *
 * Setup instructions:
 * 1. Create a Sentry account at https://sentry.io
 * 2. Create a new project (Next.js)
 * 3. Copy DSN to SENTRY_DSN environment variable
 * 4. Set SENTRY_AUTH_TOKEN for source map uploads
 */

interface SentryConfig {
  dsn: string;
  environment: string;
  release?: string;
  tracesSampleRate?: number;
  replaysSessionSampleRate?: number;
  replaysOnErrorSampleRate?: number;
}

export function initSentry(config?: Partial<SentryConfig>) {
  const dsn =
    config?.dsn || process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN;

  if (!dsn) {
    // Sentry disabled silently - no warnings in production
    return;
  }

  Sentry.init({
    dsn,
    environment: config?.environment || process.env.NODE_ENV || "development",
    release:
      config?.release ||
      process.env.SENTRY_RELEASE ||
      process.env.VERCEL_GIT_COMMIT_SHA,

    // Performance Monitoring
    tracesSampleRate:
      config?.tracesSampleRate ??
      (process.env.NODE_ENV === "production" ? 0.1 : 1.0),

    // Session Replay (client-side only)
    replaysSessionSampleRate: config?.replaysSessionSampleRate ?? 0.1,
    replaysOnErrorSampleRate: config?.replaysOnErrorSampleRate ?? 1.0,

    // Filter out common noise
    ignoreErrors: [
      "ResizeObserver loop limit exceeded",
      "ResizeObserver loop completed with undelivered notifications",
      "Non-Error promise rejection captured",
      /^Network request failed$/,
      /^Load failed$/,
      /^Script error\.?$/,
      /^ChunkLoadError/,
    ],

    // Don't send PII
    beforeSend(event) {
      // Scrub sensitive data
      if (event.request?.headers) {
        delete event.request.headers["Authorization"];
        delete event.request.headers["Cookie"];
      }

      // Filter out development errors
      if (process.env.NODE_ENV === "development") {
        return null;
      }

      return event;
    },

    // Breadcrumb filtering
    beforeBreadcrumb(breadcrumb) {
      // Filter out noisy breadcrumbs
      if (breadcrumb.category === "console" && breadcrumb.level === "debug") {
        return null;
      }
      return breadcrumb;
    },

    integrations: [
      // Add performance monitoring integrations
      Sentry.browserTracingIntegration({
        tracePropagationTargets: [
          "localhost",
          /^https:\/\/api\.guardrail\.app/,
          /^https:\/\/guardrail\.app/,
        ],
      }),
    ],
  });
}

/**
 * Capture an exception with additional context
 */
export function captureException(
  error: Error | unknown,
  context?: {
    tags?: Record<string, string>;
    extra?: Record<string, unknown>;
    user?: { id?: string; email?: string };
    level?: Sentry.SeverityLevel;
  },
) {
  Sentry.withScope((scope) => {
    if (context?.tags) {
      Object.entries(context.tags).forEach(([key, value]) => {
        scope.setTag(key, value);
      });
    }

    if (context?.extra) {
      Object.entries(context.extra).forEach(([key, value]) => {
        scope.setExtra(key, value);
      });
    }

    if (context?.user) {
      scope.setUser(context.user);
    }

    if (context?.level) {
      scope.setLevel(context.level);
    }

    Sentry.captureException(error);
  });
}

/**
 * Capture a message with severity level
 */
export function captureMessage(
  message: string,
  level: Sentry.SeverityLevel = "info",
  extra?: Record<string, unknown>,
) {
  Sentry.withScope((scope) => {
    if (extra) {
      Object.entries(extra).forEach(([key, value]) => {
        scope.setExtra(key, value);
      });
    }
    Sentry.captureMessage(message, level);
  });
}

/**
 * Set user context for all subsequent events
 */
export function setUser(
  user: { id: string; email?: string; name?: string } | null,
) {
  if (user) {
    Sentry.setUser({
      id: user.id,
      email: user.email,
      username: user.name,
    });
  } else {
    Sentry.setUser(null);
  }
}

/**
 * Add breadcrumb for debugging
 */
export function addBreadcrumb(breadcrumb: Sentry.Breadcrumb) {
  Sentry.addBreadcrumb(breadcrumb);
}

/**
 * Create a performance transaction
 */
export function startTransaction(
  name: string,
  op: string,
  data?: Record<string, unknown>,
) {
  return Sentry.startSpan({ name, op, attributes: data }, () => {});
}

/**
 * Wrap an async function with error tracking
 */
export function withErrorTracking<T extends (...args: any[]) => Promise<any>>(
  fn: T,
  context?: { name?: string; tags?: Record<string, string> },
): T {
  return (async (...args: Parameters<T>) => {
    try {
      return await fn(...args);
    } catch (error) {
      captureException(error, {
        tags: {
          ...context?.tags,
          function: context?.name || fn.name,
        },
        extra: {
          arguments: args,
        },
      });
      throw error;
    }
  }) as T;
}

export { Sentry };
