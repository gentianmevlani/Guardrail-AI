/**
 * Core API utilities and types
 *
 * This module provides:
 * - Standardized API response types
 * - Resilient fetch with retry logic
 * - Token refresh mechanism
 * - API health monitoring
 */
import { logger } from "../logger";

// ============ Response Types ============

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  code?: string;
}

export interface ApiError {
  message: string;
  code?: string;
  status: number;
  details?: Record<string, unknown>;
}

export class ApiRequestError extends Error {
  status: number;
  code?: string;
  details?: Record<string, unknown>;

  constructor(
    message: string,
    status: number,
    code?: string,
    details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "ApiRequestError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

const getApiBase = () => {
  // In Next.js, NEXT_PUBLIC_* environment variables are available in the browser
  // Use empty string for same-origin requests (Next.js rewrites will handle proxying)
  // Or use the full URL if API is on a different origin
  return process.env.NEXT_PUBLIC_API_URL || "";
};

export const API_BASE = getApiBase();

// ============ Token Management ============

let accessToken: string | null = null;
let tokenRefreshPromise: Promise<string | null> | null = null;

export function setAccessToken(token: string | null): void {
  accessToken = token;
}

export function getAccessToken(): string | null {
  return accessToken;
}

/**
 * Refresh the access token using the refresh token cookie
 * Returns the new access token or null if refresh failed
 */
export async function refreshAccessToken(): Promise<string | null> {
  // Prevent multiple simultaneous refresh attempts
  if (tokenRefreshPromise) {
    return tokenRefreshPromise;
  }

  tokenRefreshPromise = (async () => {
    try {
      const res = await fetch(`${API_BASE}/api/auth/refresh`, {
        method: "POST",
        credentials: "include",
      });

      if (res.ok) {
        const data = await res.json();
        const newToken = data.data?.accessToken || data.accessToken;
        if (newToken) {
          accessToken = newToken;
          return newToken;
        }
      }

      // Refresh failed, clear token
      accessToken = null;
      return null;
    } catch (error) {
      logger.debug("Token refresh failed:", error);
      accessToken = null;
      return null;
    } finally {
      tokenRefreshPromise = null;
    }
  })();

  return tokenRefreshPromise;
}

// API availability state
let apiAvailable = true;
let lastHealthCheck = 0;
const HEALTH_CHECK_INTERVAL = 30000; // 30 seconds

/**
 * Check if API is available (cached)
 */
export async function checkApiHealth(): Promise<boolean> {
  const now = Date.now();
  if (now - lastHealthCheck < HEALTH_CHECK_INTERVAL) {
    return apiAvailable;
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    const res = await fetch(`${API_BASE}/health/live`, {
      signal: controller.signal,
      credentials: "include",
    });
    clearTimeout(timeoutId);

    apiAvailable = res.ok;
    lastHealthCheck = now;
    return apiAvailable;
  } catch (error) {
    // Log health check failures in development
    if (process.env.NODE_ENV === "development") {
      logger.debug("Health check failed:", error);
    }
    apiAvailable = false;
    lastHealthCheck = now;
    return false;
  }
}

export interface FetchConfig {
  retries?: number;
  retryDelay?: number;
  timeout?: number;
  fallback?: unknown;
  requireAuth?: boolean;
  skipTokenRefresh?: boolean;
}

export interface FetchResult<T> {
  data: T | null;
  error?: string;
  status?: number;
  success: boolean;
}

/**
 * Resilient fetch with retry logic, timeout, and automatic token refresh
 */
export async function resilientFetch<T>(
  url: string,
  options: RequestInit = {},
  config: FetchConfig = {},
): Promise<FetchResult<T>> {
  const {
    retries = 2,
    retryDelay = 1000,
    timeout = 10000,
    fallback = null,
    requireAuth = false,
    skipTokenRefresh = false,
  } = config;

  let lastError: string | undefined;
  let lastStatus: number | undefined;

  // Add auth header if we have a token
  const getHeaders = (): HeadersInit => {
    const headers: HeadersInit = {
      ...((options.headers as Record<string, string>) || {}),
    };
    if (accessToken && requireAuth) {
      headers["Authorization"] = `Bearer ${accessToken}`;
    }
    return headers;
  };

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      const res = await fetch(url, {
        ...options,
        headers: getHeaders(),
        signal: controller.signal,
        credentials: options.credentials || "include",
      });
      clearTimeout(timeoutId);

      lastStatus = res.status;

      // Handle 401 - try token refresh
      if (res.status === 401 && !skipTokenRefresh && attempt === 0) {
        const newToken = await refreshAccessToken();
        if (newToken) {
          // Retry with new token
          continue;
        }
        // Refresh failed, return auth error
        return {
          data: fallback as T,
          error: "Authentication required. Please log in again.",
          status: 401,
          success: false,
        };
      }

      if (res.ok) {
        const json = await res.json();
        return {
          data: json.data ?? json,
          status: res.status,
          success: true,
        };
      }

      // Don't retry on client errors (4xx)
      if (res.status >= 400 && res.status < 500) {
        const errorJson = await res.json().catch(() => ({}));
        const errorMessage =
          errorJson.error ||
          errorJson.message ||
          `Request failed with status ${res.status}`;
        return {
          data: fallback as T,
          error: errorMessage,
          status: res.status,
          success: false,
        };
      }

      lastError = `Server error: ${res.status}`;
    } catch (err: unknown) {
      const error = err as Error;
      if (error.name === "AbortError") {
        lastError = "Request timeout";
      } else {
        lastError = error.message || "Network error";
      }
    }

    // Wait before retry (exponential backoff)
    if (attempt < retries) {
      await new Promise((resolve) =>
        setTimeout(resolve, retryDelay * Math.pow(2, attempt)),
      );
    }
  }

  return {
    data: fallback as T,
    error: lastError || "Request failed after retries",
    status: lastStatus,
    success: false,
  };
}

/**
 * Typed API request helper with full error information
 */
export async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {},
  config: FetchConfig = {},
): Promise<FetchResult<T>> {
  const url = endpoint.startsWith("http") ? endpoint : `${API_BASE}${endpoint}`;
  return resilientFetch<T>(url, options, config);
}

/**
 * GET request helper
 */
export async function apiGet<T>(
  endpoint: string,
  config: FetchConfig = {},
): Promise<FetchResult<T>> {
  return apiRequest<T>(endpoint, { method: "GET" }, config);
}

/**
 * POST request helper
 */
export async function apiPost<T>(
  endpoint: string,
  body?: unknown,
  config: FetchConfig = {},
): Promise<FetchResult<T>> {
  return apiRequest<T>(
    endpoint,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: body ? JSON.stringify(body) : undefined,
    },
    config,
  );
}

/**
 * PUT request helper
 */
export async function apiPut<T>(
  endpoint: string,
  body?: unknown,
  config: FetchConfig = {},
): Promise<FetchResult<T>> {
  return apiRequest<T>(
    endpoint,
    {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: body ? JSON.stringify(body) : undefined,
    },
    config,
  );
}

/**
 * DELETE request helper
 */
export async function apiDelete<T>(
  endpoint: string,
  config: FetchConfig = {},
): Promise<FetchResult<T>> {
  return apiRequest<T>(endpoint, { method: "DELETE" }, config);
}

/**
 * PATCH request helper
 */
export async function apiPatch<T>(
  endpoint: string,
  body?: unknown,
  config: FetchConfig = {},
): Promise<FetchResult<T>> {
  return apiRequest<T>(
    endpoint,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: body ? JSON.stringify(body) : undefined,
    },
    config,
  );
}

/**
 * Get API status for UI display
 */
export function getApiStatus(): { available: boolean; lastCheck: number } {
  return { available: apiAvailable, lastCheck: lastHealthCheck };
}

// Re-export logger for use in other API modules
export { logger };
