/**
 * Exit codes - consistent across all commands
 * 0 = success/pass
 * 1 = violations/failures
 * 2 = configuration/connection issues
 * 3 = payment gate (feature locked)
 */

export const EXIT = {
  SUCCESS: 0,
  VIOLATIONS: 1,
  CONFIG_ERROR: 2,
  PAYMENT_REQUIRED: 3,
} as const;

export type ExitCode = typeof EXIT[keyof typeof EXIT];

export function exit(code: ExitCode): never {
  process.exit(code);
}

export function setExitCode(code: ExitCode): void {
  process.exitCode = code;
}
