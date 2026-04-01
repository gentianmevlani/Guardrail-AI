/**
 * Retry Logic with Exponential Backoff
 * 
 * Handles transient failures gracefully
 */

export interface RetryOptions {
  maxRetries?: number;
  initialDelay?: number;
  maxDelay?: number;
  backoffMultiplier?: number;
  retryable?: (error: any) => boolean;
}

/**
 * Sleep utility
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Retry function with exponential backoff
 */
export async function retry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const {
    maxRetries = 3,
    initialDelay = 1000,
    maxDelay = 10000,
    backoffMultiplier = 2,
    retryable = (error) => {
      // Retry on network errors, 5xx, and rate limits
      if (error?.code === 'ECONNREFUSED' || error?.code === 'ETIMEDOUT') return true;
      if (error?.response?.status >= 500) return true;
      if (error?.response?.status === 429) return true; // Rate limit
      return false;
    },
  } = options;

  let lastError: any;
  let delay = initialDelay;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error: any) {
      lastError = error;

      // Don't retry if not retryable or last attempt
      if (attempt === maxRetries || !retryable(error)) {
        throw error;
      }

      // Wait before retry with exponential backoff
      await sleep(Math.min(delay, maxDelay));
      delay *= backoffMultiplier;
    }
  }

  throw lastError;
}

/**
 * Axios retry interceptor
 */
export function setupAxiosRetry(axios: any, options?: RetryOptions) {
  axios.interceptors.response.use(
    (response: any) => response,
    async (error: any) => {
      const config = error.config;

      // Don't retry if already retried or retry disabled
      if (config.__retryCount >= (options?.maxRetries || 3)) {
        return Promise.reject(error);
      }

      config.__retryCount = config.__retryCount || 0;
      config.__retryCount += 1;

      // Check if error is retryable
      const isRetryable = options?.retryable || ((err: any) => {
        return err?.response?.status >= 500 || err?.response?.status === 429;
      });

      if (isRetryable(error)) {
        const delay = Math.min(
          (options?.initialDelay || 1000) * Math.pow(options?.backoffMultiplier || 2, config.__retryCount - 1),
          options?.maxDelay || 10000
        );

        await sleep(delay);
        return axios(config);
      }

      return Promise.reject(error);
    }
  );
}

