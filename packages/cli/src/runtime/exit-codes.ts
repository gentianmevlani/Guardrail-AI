/**
 * Enterprise Exit Codes
 * Consistent, meaningful exit codes for CI/CD integration
 * 
 * Usage:
 *   process.exit(ExitCode.POLICY_FAIL)
 *   exitWith(ExitCode.AUTH_FAILURE, 'Invalid API key')
 */

export enum ExitCode {
  /** Scan passed, no policy violations */
  SUCCESS = 0,
  
  /** Findings above threshold (policy fail) - actionable by user */
  POLICY_FAIL = 1,
  
  /** User error: invalid args, bad config, missing required options */
  USER_ERROR = 2,
  
  /** Invalid input: malformed data, validation failures */
  INVALID_INPUT = 2,
  
  /** System error: crash, filesystem issues, unexpected exceptions */
  SYSTEM_ERROR = 3,
  
  /** Auth/entitlement failure: invalid key, expired token, insufficient tier */
  AUTH_FAILURE = 4,
  
  /** Network/backend failure: API unreachable, timeout */
  NETWORK_FAILURE = 5,
}

export const EXIT_CODE_DESCRIPTIONS: Record<ExitCode, string> = {
  [ExitCode.SUCCESS]: 'Scan completed successfully with no policy violations',
  [ExitCode.POLICY_FAIL]: 'Findings exceed configured thresholds',
  [ExitCode.USER_ERROR]: 'Invalid arguments or configuration',
  [ExitCode.SYSTEM_ERROR]: 'Internal error or filesystem issue',
  [ExitCode.AUTH_FAILURE]: 'Authentication or authorization failed',
  [ExitCode.NETWORK_FAILURE]: 'Network or API communication failed',
};

/**
 * Exit with code and optional message
 * Logs the exit reason for debugging
 */
export function exitWith(code: ExitCode, message?: string): never {
  if (message) {
    if (code === ExitCode.SUCCESS) {
      console.log(message);
    } else {
      console.error(`[exit:${code}] ${message}`);
    }
  }
  process.exit(code);
}

/**
 * Map error types to exit codes
 */
export function getExitCodeForError(err: Error): ExitCode {
  const msg = err.message.toLowerCase();
  
  if (msg.includes('enoent') || msg.includes('permission denied') || msg.includes('eacces')) {
    return ExitCode.SYSTEM_ERROR;
  }
  if (msg.includes('network') || msg.includes('timeout') || msg.includes('fetch')) {
    return ExitCode.NETWORK_FAILURE;
  }
  if (msg.includes('auth') || msg.includes('unauthorized') || msg.includes('forbidden')) {
    return ExitCode.AUTH_FAILURE;
  }
  if (msg.includes('invalid') || msg.includes('missing') || msg.includes('required')) {
    return ExitCode.USER_ERROR;
  }
  
  return ExitCode.SYSTEM_ERROR;
}

/**
 * Determine exit code based on scan results and policy
 */
export function getExitCodeForFindings(findings: {
  critical?: number;
  high?: number;
  medium?: number;
  low?: number;
}, policy: {
  failOnCritical?: boolean;
  failOnHigh?: boolean;
  failOnMedium?: boolean;
  failOnAny?: boolean;
}): ExitCode {
  const { critical = 0, high = 0, medium = 0, low = 0 } = findings;
  
  if (policy.failOnAny && (critical + high + medium + low) > 0) {
    return ExitCode.POLICY_FAIL;
  }
  if (policy.failOnCritical && critical > 0) {
    return ExitCode.POLICY_FAIL;
  }
  if (policy.failOnHigh && (critical + high) > 0) {
    return ExitCode.POLICY_FAIL;
  }
  if (policy.failOnMedium && (critical + high + medium) > 0) {
    return ExitCode.POLICY_FAIL;
  }
  
  return ExitCode.SUCCESS;
}
