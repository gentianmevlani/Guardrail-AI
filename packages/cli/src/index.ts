/**
 * @guardrail/cli — Enterprise AI Code Safety Scanner
 * Powered by VibeCheck engines.
 *
 * Usage:
 *   guardrail scan <path>          Scan files for issues (all 20 engines)
 *   guardrail guard <path>         Scan + block on policy violations
 *   guardrail score <path>         Compute trust score
 *   guardrail audit                Show audit log
 *   guardrail status               Show engine status
 */

export { runCLI } from './cli.js';
export { ScanCommand } from './commands/scan.js';
export { GuardCommand } from './commands/guard.js';
