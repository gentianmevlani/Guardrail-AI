/**
 * Global Error Handler Tests
 *
 * Tests for unhandled rejection handling, error categorization, and logging.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Mock Sentry
vi.mock("@sentry/nextjs", () => ({
  captureException: vi.fn(),
  captureMessage: vi.fn(),
}));

import {
  configureErrorHandlers,
  handleError,
  logErrorBoundary,
  setupGlobalErrorHandlers,
  withErrorHandling,
} from "../../apps/web-ui/src/lib/error-handlers";

describe("Global Error Handlers", () => {
  let consoleSpy: ReturnType<typeof vi.spyOn>;
  let mockCallbacks: {
    onNetworkError: ReturnType<typeof vi.fn>;
    onAuthError: ReturnType<typeof vi.fn>;
    onGenericError: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    vi.clearAllMocks();
    consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    mockCallbacks = {
      onNetworkError: vi.fn(),
      onAuthError: vi.fn(),
      onGenericError: vi.fn(),
    };

    configureErrorHandlers(mockCallbacks);
  });

  afterEach(() => {
    consoleSpy.mockRestore();
  });

  describe("handleError", () => {
    it("should categorize network errors correctly", () => {
      const networkError = new Error("NetworkError: Failed to fetch");
      handleError(networkError, { handler: "test" });

      expect(mockCallbacks.onNetworkError).toHaveBeenCalled();
      expect(mockCallbacks.onGenericError).not.toHaveBeenCalled();
    });

    it("should categorize fetch failures as network errors", () => {
      const fetchError = new TypeError("Failed to fetch");
      handleError(fetchError, { handler: "test" });

      expect(mockCallbacks.onNetworkError).toHaveBeenCalled();
    });

    it("should categorize 401 errors as auth errors", () => {
      const authError = new Error("401 Unauthorized");
      handleError(authError, { handler: "test" });

      expect(mockCallbacks.onAuthError).toHaveBeenCalled();
      expect(mockCallbacks.onGenericError).not.toHaveBeenCalled();
    });

    it("should categorize timeout errors correctly", () => {
      const timeoutError = new Error("Request timed out");
      handleError(timeoutError, { handler: "test" });

      expect(mockCallbacks.onGenericError).toHaveBeenCalledWith(
        "Request timed out. Please try again.",
      );
    });

    it("should handle AbortError as timeout", () => {
      const abortError = new DOMException("Aborted", "AbortError");
      handleError(abortError, { handler: "test" });

      expect(mockCallbacks.onGenericError).toHaveBeenCalledWith(
        "Request timed out. Please try again.",
      );
    });

    it("should handle generic errors", () => {
      const genericError = new Error("Something unexpected");
      handleError(genericError, { handler: "test" });

      expect(mockCallbacks.onGenericError).toHaveBeenCalledWith(
        "Something went wrong. Please try again.",
      );
    });

    it("should not double-report the same error", () => {
      const error = new Error("Test error");

      handleError(error, { handler: "test1" });
      handleError(error, { handler: "test2" });

      // Callbacks should only be called once
      expect(mockCallbacks.onGenericError).toHaveBeenCalledTimes(1);
    });

    it("should log to console when Sentry is not available", () => {
      const error = new Error("Console test");
      handleError(error, { handler: "test-handler", extra: { foo: "bar" } });

      expect(consoleSpy).toHaveBeenCalledWith("[test-handler]", error, {
        foo: "bar",
      });
    });
  });

  describe("setupGlobalErrorHandlers", () => {
    it("should return cleanup function", () => {
      const cleanup = setupGlobalErrorHandlers();
      expect(typeof cleanup).toBe("function");
      cleanup();
    });

    it("should return no-op on server side", () => {
      const originalWindow = global.window;
      // @ts-ignore
      delete global.window;

      const cleanup = setupGlobalErrorHandlers();
      expect(cleanup.toString()).toBe("() => {}");

      // @ts-ignore
      global.window = originalWindow;
    });
  });

  describe("withErrorHandling", () => {
    it("should wrap async functions with error handling", async () => {
      const error = new Error("Async error");
      const asyncFn = async () => {
        throw error;
      };

      const wrapped = withErrorHandling(asyncFn, "test-context");

      await expect(wrapped()).rejects.toThrow("Async error");
      expect(mockCallbacks.onGenericError).toHaveBeenCalled();
    });

    it("should pass through successful results", async () => {
      const asyncFn = async (x: number) => x * 2;
      const wrapped = withErrorHandling(asyncFn, "test");

      const result = await wrapped(5);
      expect(result).toBe(10);
    });
  });

  describe("logErrorBoundary", () => {
    it("should log errors with component stack", () => {
      const error = new Error("Render error");
      const errorInfo = { componentStack: "<App>\n  <MyComponent>" };

      logErrorBoundary(error, errorInfo);

      expect(consoleSpy).toHaveBeenCalledWith(
        "[ErrorBoundary]",
        error,
        expect.objectContaining({
          componentStack: "<App>\n  <MyComponent>",
        }),
      );
    });
  });

  describe("Error Categorization Edge Cases", () => {
    it("should handle non-Error objects", () => {
      handleError("string error", { handler: "test" });
      expect(mockCallbacks.onGenericError).toHaveBeenCalled();
    });

    it("should handle null/undefined", () => {
      handleError(null, { handler: "test" });
      handleError(undefined, { handler: "test" });
      expect(mockCallbacks.onGenericError).toHaveBeenCalledTimes(2);
    });

    it("should handle errors with status property", () => {
      const errorWithStatus = new Error("Auth failed");
      (errorWithStatus as any).status = 401;

      handleError(errorWithStatus, { handler: "test" });
      expect(mockCallbacks.onAuthError).toHaveBeenCalled();
    });
  });
});
