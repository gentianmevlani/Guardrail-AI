import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.SENTRY_DSN,

  // Environment configuration
  environment: process.env.NODE_ENV,
  release: process.env.SENTRY_RELEASE || process.env.VERCEL_GIT_COMMIT_SHA,

  // Performance Monitoring - lower sample rate for server
  tracesSampleRate: process.env.NODE_ENV === "production" ? 0.05 : 1.0,

  // Debug mode in development
  debug: process.env.NODE_ENV === "development",

  // Filter errors
  ignoreErrors: ["ECONNREFUSED", "ENOTFOUND", "ETIMEDOUT"],

  beforeSend(event) {
    // Scrub sensitive headers
    if (event.request?.headers) {
      delete event.request.headers["authorization"];
      delete event.request.headers["cookie"];
      delete event.request.headers["x-api-key"];
    }

    // Don't send in development
    if (process.env.NODE_ENV === "development") {
      console.log(
        "[Sentry Server] Would send event:",
        event.message || event.exception,
      );
      return null;
    }

    return event;
  },
});
