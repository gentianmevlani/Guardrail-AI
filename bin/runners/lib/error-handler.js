/**
 * Standardized error handling for CLI runners
 * 
 * Design principles:
 * - Every error has a human-readable message
 * - Every error suggests a next step
 * - Exit codes are consistent and documented
 */

const colors = {
  reset: "\x1b[0m",
  red: "\x1b[31m",
  yellow: "\x1b[33m",
  cyan: "\x1b[36m",
  green: "\x1b[32m",
  bold: "\x1b[1m",
};

const c = {
  error: (text) => `${colors.red}${colors.bold}${text}${colors.reset}`,
  warning: (text) => `${colors.yellow}${text}${colors.reset}`,
  info: (text) => `${colors.cyan}${text}${colors.reset}`,
  success: (text) => `${colors.green}${text}${colors.reset}`,
  dim: (text) => `\x1b[2m${text}${colors.reset}`,
};

// Standard exit codes for CI/CD integration
// Unified with packages/cli/src/runtime/exit-codes.ts
// IMPORTANT: These codes are part of the CLI contract - do not change without migration guide
const EXIT_CODES = {
  SUCCESS: 0,           // Scan passed, no policy violations
  POLICY_FAIL: 1,       // Findings above threshold (policy fail) - actionable by user
  USER_ERROR: 2,        // User error: invalid args, bad config, missing required options
  SYSTEM_ERROR: 3,      // System error: crash, filesystem issues, unexpected exceptions
  AUTH_FAILURE: 4,      // Auth/entitlement failure: invalid key, expired token, insufficient tier
  NETWORK_FAILURE: 5,   // Network/backend failure: API unreachable, timeout
};

// Error-specific guidance
const ERROR_GUIDANCE = {
  ENOENT: {
    title: "File or directory not found",
    nextSteps: [
      "Verify the path exists and is spelled correctly",
      "Run from the project root directory",
      "Check if the file was deleted or moved",
    ],
  },
  EACCES: {
    title: "Permission denied",
    nextSteps: [
      "Check file/directory permissions",
      "Try running with appropriate permissions",
      "Ensure you own the files or have read access",
    ],
  },
  ECONNREFUSED: {
    title: "Connection refused",
    nextSteps: [
      "Check if the API server is running",
      "Verify GUARDRAIL_API_URL is correct",
      "Check firewall/network settings",
    ],
  },
  ETIMEDOUT: {
    title: "Connection timed out",
    nextSteps: [
      "Check your internet connection",
      "The server may be overloaded, try again later",
      "Increase timeout with --timeout flag if available",
    ],
  },
  INVALID_API_KEY: {
    title: "Invalid API key",
    nextSteps: [
      'Run "guardrail login" to authenticate',
      "Get a new API key at https://guardrail.dev/settings/keys",
      "Check GUARDRAIL_API_KEY environment variable",
    ],
  },
  PLAN_REQUIRED: {
    title: "Feature requires a paid plan",
    nextSteps: [
      "Upgrade at https://guardrail.dev/pricing",
      'Run "guardrail upgrade" to manage your subscription',
      "Some features have free tier limits",
    ],
  },
  RATE_LIMITED: {
    title: "Rate limit exceeded",
    nextSteps: [
      "Wait a moment and try again",
      "Upgrade your plan for higher limits",
      "Batch operations to reduce API calls",
    ],
  },
};

/**
 * Get guidance for an error
 */
function getErrorGuidance(error) {
  const code = error.code || error.name;
  
  // Check for known error types
  if (ERROR_GUIDANCE[code]) {
    return ERROR_GUIDANCE[code];
  }
  
  // Infer from error message
  if (error.message?.includes("API key")) {
    return ERROR_GUIDANCE.INVALID_API_KEY;
  }
  if (error.message?.includes("rate limit")) {
    return ERROR_GUIDANCE.RATE_LIMITED;
  }
  if (error.message?.includes("plan") || error.message?.includes("upgrade")) {
    return ERROR_GUIDANCE.PLAN_REQUIRED;
  }
  
  return null;
}

/**
 * Handle CLI errors with consistent formatting and guidance
 * @param {Error|string} error - The error to handle
 * @param {string} context - Additional context (command name, file path, etc.)
 * @param {Object} metadata - Additional metadata (command, file, line, receipt, verifyCommand, etc.)
 */
function handleError(error, context = "", metadata = {}) {
  // Ensure error is an Error object
  const err = error instanceof Error ? error : new Error(String(error));

  // Build receipt string (file:line or evidence)
  let receipt = "";
  if (metadata.file && metadata.line) {
    receipt = `${metadata.file}:${metadata.line}`;
  } else if (metadata.file) {
    receipt = metadata.file;
  } else if (metadata.receipt) {
    receipt = metadata.receipt;
  }

  // Build enriched context message
  const contextParts = [context];
  if (receipt) contextParts.push(`Receipt: ${receipt}`);
  if (metadata.command && !context.includes(metadata.command)) contextParts.push(`Command: ${metadata.command}`);
  const enrichedContext = contextParts.filter(Boolean).join(' | ');

  // Add context to error message if provided
  const message = enrichedContext ? `${enrichedContext}: ${err.message}` : err.message;

  // Get specific guidance
  const guidance = getErrorGuidance(err);
  
  // Print error header
  if (guidance) {
    console.error(`\n${c.error("✗")} ${c.error(guidance.title)}`);
    console.error(`  ${message}`);
    
    // Print next steps
    console.error(`\n${c.info("Next steps:")}`);
    for (const step of guidance.nextSteps) {
      console.error(`  ${c.dim("•")} ${step}`);
    }
  } else {
    // Generic error handling with specific type detection
    if (err.code === "ENOENT") {
      console.error(`\n${c.error("✗")} File or directory not found`);
      console.error(`  ${err.path || message}`);
      // Print receipt if available
      if (receipt) {
        console.error(`\n${c.dim("Receipt:")} ${receipt}`);
      }
      console.error(`\n${c.info("Next steps:")}`);
      console.error(`  ${c.dim("•")} Verify the path exists`);
      console.error(`  ${c.dim("•")} Run from the correct directory`);
      if (metadata.verifyCommand) {
        console.error(`\n${c.info("Verify it's fixed:")}`);
        console.error(`  ${c.dim("•")} ${metadata.verifyCommand}`);
      }
    } else if (err.code === "EACCES") {
      console.error(`\n${c.error("✗")} Permission denied`);
      console.error(`  ${message}`);
      // Print receipt if available
      if (receipt) {
        console.error(`\n${c.dim("Receipt:")} ${receipt}`);
      }
      console.error(`\n${c.info("Next steps:")}`);
      console.error(`  ${c.dim("•")} Check file permissions`);
      if (metadata.verifyCommand) {
        console.error(`\n${c.info("Verify it's fixed:")}`);
        console.error(`  ${c.dim("•")} ${metadata.verifyCommand}`);
      }
    } else if (err.name === "AuthenticationError") {
      console.error(`\n${c.error("✗")} Authentication required`);
      console.error(`  ${message}`);
      console.error(`\n${c.info("Next steps:")}`);
      console.error(`  ${c.dim("•")} Run "guardrail login" to authenticate`);
      console.error(`  ${c.dim("•")} Get your API key at https://guardrail.dev/settings/keys`);
    } else if (err.name === "NetworkError" || err.code === "ECONNREFUSED" || err.code === "ETIMEDOUT") {
      console.error(`\n${c.error("✗")} Network error`);
      console.error(`  ${message}`);
      console.error(`\n${c.info("Next steps:")}`);
      console.error(`  ${c.dim("•")} Check your internet connection`);
      console.error(`  ${c.dim("•")} Verify GUARDRAIL_API_URL is correct`);
    } else {
      // Generic error
      console.error(`\n${c.error("✗")} Error`);
      console.error(`  ${message}`);
      // Print receipt if available
      if (receipt) {
        console.error(`\n${c.dim("Receipt:")} ${receipt}`);
      }
      console.error(`\n${c.info("Need help?")}`);
      console.error(`  ${c.dim("•")} Run "guardrail doctor" for diagnostics`);
      console.error(`  ${c.dim("•")} Visit https://docs.guardrail.dev/troubleshooting`);
      if (metadata.verifyCommand) {
        console.error(`\n${c.info("Verify it's fixed:")}`);
        console.error(`  ${c.dim("•")} ${metadata.verifyCommand}`);
      }
    }
  }

  // Show stack trace in debug mode
  if (process.env.DEBUG || process.env.GUARDRAIL_DEBUG) {
    console.error(`\n${c.dim("Stack trace:")}`);
    console.error(c.dim(err.stack));
  }
  
  console.error(""); // Empty line for readability
}

/**
 * Wrap an async function with error handling
 */
function withErrorHandling(fn, context = "") {
  return async (...args) => {
    try {
      return await fn(...args);
    } catch (error) {
      handleError(error, context);
      return 1; // Return error exit code
    }
  };
}

/**
 * Create a user-friendly error for specific scenarios
 */
function createUserError(message, type = "Error") {
  const error = new Error(message);
  error.name = type;
  error.isUserError = true;
  return error;
}

/**
 * Check if an error should be retried
 */
function shouldRetry(error) {
  // Retry on network errors
  if (
    error.code === "ECONNRESET" ||
    error.code === "ECONNREFUSED" ||
    error.code === "ETIMEDOUT" ||
    error.name === "NetworkError"
  ) {
    return true;
  }

  // Don't retry on user errors
  if (
    error.isUserError ||
    error.name === "ValidationError" ||
    error.name === "AuthenticationError"
  ) {
    return false;
  }

  // Default: don't retry
  return false;
}

/**
 * Retry a function with exponential backoff
 */
async function retry(fn, maxAttempts = 3, context = "") {
  let lastError;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      if (!shouldRetry(error) || attempt === maxAttempts) {
        break;
      }

      const delay = Math.pow(2, attempt) * 1000; // Exponential backoff
      console.warn(
        c.warning(`Attempt ${attempt} failed, retrying in ${delay / 1000}s...`),
      );
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  throw lastError;
}

module.exports = {
  handleError,
  withErrorHandling,
  createUserError,
  shouldRetry,
  retry,
  EXIT_CODES,
  getErrorGuidance,
};
