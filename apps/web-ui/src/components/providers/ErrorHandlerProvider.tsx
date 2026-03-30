"use client";

/**
 * ErrorHandlerProvider
 *
 * Sets up global error handlers for unhandled rejections and errors.
 * Must be placed in the root layout to catch all errors.
 */

import {
  configureErrorHandlers,
  setupGlobalErrorHandlers,
} from "@/lib/error-handlers";
import { logger } from "@/lib/logger";
import { useEffect } from "react";

interface ErrorHandlerProviderProps {
  children: React.ReactNode;
}

export function ErrorHandlerProvider({ children }: ErrorHandlerProviderProps) {
  useEffect(() => {
    // Configure error handler callbacks
    configureErrorHandlers({
      onNetworkError: () => {
        logger.warn("Network error detected — consider showing a toast");
      },
      onAuthError: () => {
        logger.warn("Auth error detected");
      },
      onGenericError: (message) => {
        logger.warn("Error", { message });
      },
    });

    // Setup global handlers and get cleanup function
    const cleanup = setupGlobalErrorHandlers();

    return cleanup;
  }, []);

  return <>{children}</>;
}

export default ErrorHandlerProvider;
