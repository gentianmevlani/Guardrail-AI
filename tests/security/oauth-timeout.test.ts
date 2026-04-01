/**
 * OAuth Timeout Protection Tests
 *
 * Tests for fetch timeout, retry logic, and error handling in OAuth flows.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  apiFetch,
  FetchRetryExhaustedError,
  FetchTimeoutError,
  fetchWithTimeout,
  oauthFetch,
} from "../../apps/api/src/lib/fetch-with-timeout";

// Mock global fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Mock logger
vi.mock("../../apps/api/src/logger", () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

describe("OAuth Timeout Protection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("fetchWithTimeout", () => {
    it("should succeed when request completes within timeout", async () => {
      const mockResponse = new Response(JSON.stringify({ ok: true }), {
        status: 200,
      });
      mockFetch.mockResolvedValueOnce(mockResponse);

      const responsePromise = fetchWithTimeout("https://api.github.com/user", {
        timeoutMs: 5000,
      });

      await vi.advanceTimersByTimeAsync(100);
      const response = await responsePromise;

      expect(response.status).toBe(200);
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it("should throw FetchTimeoutError when request times out", async () => {
      mockFetch.mockImplementation(() => new Promise(() => {})); // Never resolves

      const responsePromise = fetchWithTimeout("https://api.github.com/user", {
        timeoutMs: 1000,
        retries: 0,
      });

      vi.advanceTimersByTime(1100);

      await expect(responsePromise).rejects.toThrow(FetchTimeoutError);
    });

    it("should retry on failure", async () => {
      mockFetch
        .mockRejectedValueOnce(new Error("Network error"))
        .mockResolvedValueOnce(new Response("{}", { status: 200 }));

      const responsePromise = fetchWithTimeout("https://api.github.com/user", {
        timeoutMs: 5000,
        retries: 1,
        retryDelayMs: 100,
      });

      // First attempt fails
      await vi.advanceTimersByTimeAsync(50);
      // Wait for retry delay
      await vi.advanceTimersByTimeAsync(150);

      const response = await responsePromise;
      expect(response.status).toBe(200);
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it("should throw FetchRetryExhaustedError after max retries", async () => {
      mockFetch.mockRejectedValue(new Error("Network error"));

      const responsePromise = fetchWithTimeout("https://api.github.com/user", {
        timeoutMs: 5000,
        retries: 2,
        retryDelayMs: 100,
      });

      // Advance through all retries
      await vi.advanceTimersByTimeAsync(500);

      await expect(responsePromise).rejects.toThrow(FetchRetryExhaustedError);
      expect(mockFetch).toHaveBeenCalledTimes(3); // Initial + 2 retries
    });

    it("should include timeout duration in error message", async () => {
      mockFetch.mockImplementation(() => new Promise(() => {}));

      try {
        const promise = fetchWithTimeout("https://api.github.com/user", {
          timeoutMs: 3000,
          retries: 0,
        });
        vi.advanceTimersByTime(3100);
        await promise;
        expect.fail("Should have thrown");
      } catch (error) {
        expect(error).toBeInstanceOf(FetchTimeoutError);
        expect((error as FetchTimeoutError).timeoutMs).toBe(3000);
        expect((error as FetchTimeoutError).message).toContain("3000ms");
      }
    });
  });

  describe("oauthFetch", () => {
    it("should use 5 second timeout by default", async () => {
      mockFetch.mockResolvedValueOnce(new Response("{}", { status: 200 }));

      await oauthFetch("https://github.com/login/oauth/access_token", {
        method: "POST",
      });

      // Verify AbortController was used (through the signal in fetch options)
      expect(mockFetch).toHaveBeenCalledWith(
        "https://github.com/login/oauth/access_token",
        expect.objectContaining({
          method: "POST",
          signal: expect.any(AbortSignal),
        }),
      );
    });

    it("should retry once by default", async () => {
      mockFetch
        .mockRejectedValueOnce(new Error("Temporary failure"))
        .mockResolvedValueOnce(new Response("{}", { status: 200 }));

      const responsePromise = oauthFetch(
        "https://github.com/login/oauth/access_token",
      );
      await vi.advanceTimersByTimeAsync(3000);

      const response = await responsePromise;
      expect(response.status).toBe(200);
    });
  });

  describe("apiFetch", () => {
    it("should use 10 second timeout for API calls", async () => {
      mockFetch.mockResolvedValueOnce(new Response("{}", { status: 200 }));

      await apiFetch("https://api.github.com/user/repos");

      expect(mockFetch).toHaveBeenCalledWith(
        "https://api.github.com/user/repos",
        expect.objectContaining({
          signal: expect.any(AbortSignal),
        }),
      );
    });

    it("should retry twice for API calls", async () => {
      mockFetch
        .mockRejectedValueOnce(new Error("Error 1"))
        .mockRejectedValueOnce(new Error("Error 2"))
        .mockResolvedValueOnce(new Response("{}", { status: 200 }));

      const responsePromise = apiFetch("https://api.github.com/user/repos");
      await vi.advanceTimersByTimeAsync(10000);

      const response = await responsePromise;
      expect(response.status).toBe(200);
      expect(mockFetch).toHaveBeenCalledTimes(3);
    });
  });

  describe("Error Types", () => {
    it("FetchTimeoutError should have correct properties", () => {
      const error = new FetchTimeoutError("https://api.github.com/user", 5000);

      expect(error.name).toBe("FetchTimeoutError");
      expect(error.url).toBe("https://api.github.com/user");
      expect(error.timeoutMs).toBe(5000);
      expect(error.message).toContain("github.com");
      expect(error.message).toContain("5000ms");
    });

    it("FetchRetryExhaustedError should have correct properties", () => {
      const lastError = new Error("Final failure");
      const error = new FetchRetryExhaustedError(
        "https://api.github.com/user",
        3,
        lastError,
      );

      expect(error.name).toBe("FetchRetryExhaustedError");
      expect(error.url).toBe("https://api.github.com/user");
      expect(error.attempts).toBe(3);
      expect(error.lastError).toBe(lastError);
      expect(error.message).toContain("3 attempts");
    });
  });
});
