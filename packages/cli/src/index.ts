<<<<<<< HEAD
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
=======
#!/usr/bin/env node
/**
 * guardrail CLI — thin entry: delegates to bootstrap (command registration + main).
 */
import './bootstrap';

export { printLogo } from './ui/cli-terminal';
export { styles, icons } from './ui/cli-styles';
>>>>>>> 64774cf6f8ffd3a30c44ac65801f229995aeb6e7
