/**
 * Request Timeout Middleware
 *
 * Ensures requests don't hang indefinitely and provides
 * consistent timeout behavior across all endpoints.
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { logger } from "../logger";

export interface TimeoutOptions {
  defaultTimeoutMs?: number;
  longRunningTimeoutMs?: number;
  longRunningPaths?: string[];
}

const DEFAULT_TIMEOUT_MS = 30000; // 30 seconds
const LONG_RUNNING_TIMEOUT_MS = 120000; // 2 minutes

const defaultLongRunningPaths = [
  "/api/ship",
  "/api/scan",
  "/api/reality-check",
  "/api/compliance",
  "/api/security",
  "/api/audit",
];

export async function registerRequestTimeout(
  fastify: FastifyInstance,
  options: TimeoutOptions = {}
): Promise<void> {
  const {
    defaultTimeoutMs = DEFAULT_TIMEOUT_MS,
    longRunningTimeoutMs = LONG_RUNNING_TIMEOUT_MS,
    longRunningPaths = defaultLongRunningPaths,
  } = options;

  fastify.addHook("onRequest", async (request: FastifyRequest, reply: FastifyReply) => {
    // Determine timeout based on path
    const isLongRunning = longRunningPaths.some(path => 
      request.url.startsWith(path)
    );
    const timeoutMs = isLongRunning ? longRunningTimeoutMs : defaultTimeoutMs;

    // Set up timeout
    const timeoutId = setTimeout(() => {
      if (!reply.sent) {
        logger.warn({ url: request.url, method: request.method, timeoutMs, component: 'request-timeout' }, 'Request timeout exceeded');

        reply.status(504).send({
          success: false,
          error: "Request timeout",
          code: "REQUEST_TIMEOUT",
          message: `Request exceeded ${timeoutMs}ms timeout`,
        });
      }
    }, timeoutMs);

    // Store timeout ID for cleanup
    (request as any).timeoutId = timeoutId;
  });

  // Clean up timeout on response
  fastify.addHook("onResponse", async (request: FastifyRequest) => {
    const timeoutId = (request as any).timeoutId;
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  });

  // Clean up timeout on error
  fastify.addHook("onError", async (request: FastifyRequest) => {
    const timeoutId = (request as any).timeoutId;
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  });
}
