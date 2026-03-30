/**
 * Error Reporting Setup
 * 
 * Sentry integration with correlation IDs
 */

import * as Sentry from '@sentry/node';
import { Request } from 'express';

/**
 * Initialize Sentry
 */
export function initErrorReporting() {
  if (!process.env.SENTRY_DSN) {
    console.warn('SENTRY_DSN not configured. Error reporting disabled.');
    return;
  }

  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV || 'development',
    release: process.env.RELEASE || 'unknown',
    tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0, // 10% in prod, 100% in dev
    integrations: [
      new Sentry.Integrations.Http({ tracing: true }),
    ],
  });
}

/**
 * Capture error with correlation ID
 */
export function captureError(
  error: Error,
  context?: {
    correlationId?: string;
    userId?: string;
    tags?: Record<string, string>;
    extra?: Record<string, any>;
  }
) {
  Sentry.withScope((scope) => {
    if (context?.correlationId) {
      scope.setTag('correlation_id', context.correlationId);
    }
    if (context?.userId) {
      scope.setUser({ id: context.userId });
    }
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
    Sentry.captureException(error);
  });
}

/**
 * Express error handler for Sentry
 */
export function sentryErrorHandler(
  err: Error,
  req: Request & { correlationId?: string },
  res: Response,
  next: NextFunction
) {
  captureError(err, {
    correlationId: req.correlationId,
    tags: {
      method: req.method,
      path: req.path,
    },
    extra: {
      query: req.query,
      body: req.body,
    },
  });
  next(err);
}

