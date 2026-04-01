/**
 * Standardized JSON Output Schema
 * 
 * All CLI commands with --json flag use this unified schema
 * Version: 1.0
 */

export interface GuardrailJsonOutput {
  version: string;
  schema: string;
  timestamp: string;
  command: string;
  success: boolean;
  exitCode: number;
  data?: any;
  error?: {
    code: string;
    message: string;
    nextSteps?: string[];
  };
  metadata?: {
    [key: string]: any;
  };
}

/**
 * Create standardized JSON output
 */
export function createJsonOutput(
  command: string,
  success: boolean,
  exitCode: number,
  data?: any,
  error?: {
    code: string;
    message: string;
    nextSteps?: string[];
  },
  metadata?: { [key: string]: any }
): GuardrailJsonOutput {
  return {
    version: '1.0',
    schema: 'guardrail/v1',
    timestamp: new Date().toISOString(),
    command,
    success,
    exitCode,
    ...(data && { data }),
    ...(error && { error }),
    ...(metadata && { metadata }),
  };
}

/**
 * Format scan results for JSON output
 */
export function formatScanResults(results: any): any {
  return {
    summary: {
      critical: results?.summary?.critical ?? 0,
      high: results?.summary?.high ?? 0,
      medium: results?.summary?.medium ?? 0,
      low: results?.summary?.low ?? 0,
      info: results?.summary?.info ?? 0,
      total: results?.summary?.total ?? 0,
    },
    findings: results?.findings || [],
    score: results?.score ?? 0,
    verdict: results?.verdict || 'unknown',
    filesScanned: results?.filesScanned ?? 0,
    linesScanned: results?.linesScanned ?? 0,
    duration: results?.duration ?? 0,
  };
}

/**
 * Format gate results for JSON output
 */
export function formatGateResults(exitCode: number, verdict: string): any {
  return {
    verdict: exitCode === 0 ? 'pass' : 'fail',
    gateResult: exitCode === 0 ? 'GATE_PASSED' : 'GATE_FAILED',
    exitCode,
  };
}
