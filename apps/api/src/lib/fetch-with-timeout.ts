/**
 * Fetch with Timeout and Retry
 *
 * Provides timeout protection and retry logic for external HTTP calls.
 * Used for OAuth, API calls, and other external service communications.
 */

import { logger } from "../logger";
import { toErrorMessage, getErrorStack } from "../utils/toErrorMessage";
export interface FetchWithTimeoutOptions extends RequestInit {
  timeoutMs?: number;
  retries?: number;
  retryDelayMs?: number;
  logPrefix?: string;
}

export class FetchTimeoutError extends Error {
  constructor(
    public url: string,
    public timeoutMs: number,
  ) {
    super(`Request to ${new URL(url).hostname} timed out after ${timeoutMs}ms`);
    this.name = "FetchTimeoutError";
  }
}

export class FetchRetryExhaustedError extends Error {
  constructor(
    public url: string,
    public attempts: number,
    public lastError: Error,
  ) {
    super(
      `Request to ${new URL(url).hostname} failed after ${attempts} attempts: ${lastError.message}`,
    );
    this.name = "FetchRetryExhaustedError";
  }
}

/**
 * Fetch with timeout protection
 */
export async function fetchWithTimeout(
  url: string,
  options: FetchWithTimeoutOptions = {},
): Promise<Response> {
  const {
    timeoutMs = 5000,
    retries = 1,
    retryDelayMs = 2000,
    logPrefix = "fetch",
    ...fetchOptions
  } = options;

  let lastError: Error | null = null;
  let attempts = 0;

  while (attempts <= retries) {
    attempts++;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const startTime = Date.now();

      const response = await fetch(url, {
        ...fetchOptions,
        signal: controller.signal,
      });

      const duration = Date.now() - startTime;

      // Log successful requests
      logger.debug({
        msg: `${logPrefix} completed`,
        url: new URL(url).hostname,
        status: response.status,
        duration,
        attempt: attempts,
      });

      return response;
    } catch (error: unknown) {
      clearTimeout(timeoutId);

      if (error instanceof Error && error.name === "AbortError") {
        lastError = new FetchTimeoutError(url, timeoutMs);
        logger.warn({
          msg: `${logPrefix} timeout`,
          url: new URL(url).hostname,
          timeoutMs,
          attempt: attempts,
          maxAttempts: retries + 1,
        });
      } else {
        lastError = error instanceof Error ? error : new Error(toErrorMessage(error));
        logger.warn({
          msg: `${logPrefix} failed`,
          url: new URL(url).hostname,
          error: toErrorMessage(error),
          attempt: attempts,
          maxAttempts: retries + 1,
        });
      }

      // Retry if we have attempts left
      if (attempts <= retries) {
        logger.info({
          msg: `${logPrefix} retrying`,
          url: new URL(url).hostname,
          delayMs: retryDelayMs,
          nextAttempt: attempts + 1,
        });
        await new Promise((resolve) => setTimeout(resolve, retryDelayMs));
      }
    } finally {
      clearTimeout(timeoutId);
    }
  }

  // All retries exhausted
  throw new FetchRetryExhaustedError(url, attempts, lastError!);
}

/**
 * Fetch JSON with timeout - convenience wrapper
 */
export async function fetchJsonWithTimeout<T = any>(
  url: string,
  options: FetchWithTimeoutOptions = {},
): Promise<{ response: Response; data: T }> {
  const response = await fetchWithTimeout(url, options);
  const data = (await response.json()) as T;
  return { response, data };
}

/**
 * OAuth-specific fetch with appropriate defaults
 */
export async function oauthFetch(
  url: string,
  options: FetchWithTimeoutOptions = {},
): Promise<Response> {
  return fetchWithTimeout(url, {
    timeoutMs: 5000,
    retries: 1,
    retryDelayMs: 2000,
    logPrefix: "oauth",
    ...options,
  });
}

/**
 * API fetch with longer timeout for data-heavy operations
 */
export async function apiFetch(
  url: string,
  options: FetchWithTimeoutOptions = {},
): Promise<Response> {
  return fetchWithTimeout(url, {
    timeoutMs: 10000,
    retries: 2,
    retryDelayMs: 3000,
    logPrefix: "api",
    ...options,
  });
}
