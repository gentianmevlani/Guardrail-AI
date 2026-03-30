import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  // Environment configuration
  environment: process.env.NODE_ENV,
  release: process.env.SENTRY_RELEASE || process.env.VERCEL_GIT_COMMIT_SHA,

  // Performance Monitoring
  tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,

  // Session Replay
  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1.0,

  // Debug mode in development
  debug: process.env.NODE_ENV === "development",

  integrations: [
    Sentry.replayIntegration({
      maskAllText: true,
      blockAllMedia: true,
    }),
    Sentry.browserTracingIntegration({
      tracePropagationTargets: [
        "localhost",
        /^https:\/\/api\.guardrail\.app/,
        /^https:\/\/guardrail\.app/,
      ],
    }),
  ],

  // Filter errors
  ignoreErrors: [
    "ResizeObserver loop limit exceeded",
    "ResizeObserver loop completed with undelivered notifications",
    /^Network request failed$/,
    /^Load failed$/,
    /^Script error\.?$/,
    /^ChunkLoadError/,
  ],

  beforeSend(event) {
    // Don't send events in development
    if (process.env.NODE_ENV === "development") {
      console.log("[Sentry] Would send event:", event);
      return null;
    }
    return event;
  },
});
