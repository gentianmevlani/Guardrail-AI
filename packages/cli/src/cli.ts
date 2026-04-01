#!/usr/bin/env node

/**
 * Guardrail CLI entry point.
 * Parses args and dispatches to scan/guard/score commands.
 */

import path from 'node:path';
import { pathToFileURL } from 'node:url';

import { ScanCommand } from './commands/scan.js';
import { GuardCommand } from './commands/guard.js';

const VERSION = '1.0.0';

const HELP = `
  ┌─────────────────────────────────────────────┐
  │  GUARDRAIL — Enterprise AI Code Safety      │
  │  Powered by VibeCheck engines               │
  └─────────────────────────────────────────────┘

  Usage:
    guardrail scan <path> [options]     Scan files with all 20 engines
    guardrail guard <path> [options]    Scan + enforce policy (block on violations)
    guardrail score <path>              Compute trust score
    guardrail status                    Show engine status
    guardrail audit                     Show recent audit log
    guardrail --version                 Show version
    guardrail --help                    Show this help

  Options:
    --min-severity <level>    Minimum severity to report (critical|high|medium|low|info)
    --engines <ids>           Comma-separated engine IDs to run
    --format <fmt>            Output format (text|json|sarif)
    --block-threshold <n>     Block if critical+high findings >= n (guard mode)
    --policy <file>           Path to scan policy JSON
    --quiet                   Suppress non-essential output
`;

export async function runCLI(args: string[] = process.argv.slice(2)): Promise<void> {
  const command = args[0];

  if (!command || command === '--help' || command === '-h') {
    console.log(HELP);
    return;
  }

  if (command === '--version' || command === '-v') {
    console.log(`guardrail v${VERSION}`);
    return;
  }

  const targetPath = args[1] || '.';
  const options = parseOptions(args.slice(2));

  switch (command) {
    case 'scan': {
      const cmd = new ScanCommand();
      await cmd.execute(targetPath, options);
      break;
    }
    case 'guard': {
      const cmd = new GuardCommand();
      const exitCode = await cmd.execute(targetPath, options);
      if (exitCode !== 0) process.exit(exitCode);
      break;
    }
    case 'score': {
      const cmd = new ScanCommand();
      await cmd.execute(targetPath, { ...options, scoreOnly: true });
      break;
    }
    case 'status': {
      const cmd = new ScanCommand();
      cmd.showStatus();
      break;
    }
    case 'audit': {
      const cmd = new ScanCommand();
      cmd.showAuditLog();
      break;
    }
    default:
      console.error(`Unknown command: ${command}`);
      console.log(HELP);
      process.exit(1);
  }
}

function parseOptions(args: string[]): Record<string, string | boolean> {
  const options: Record<string, string | boolean> = {};
  for (let i = 0; i < args.length; i++) {
    const arg = args[i]!;
    if (arg.startsWith('--')) {
      const key = arg.replace(/^--/, '');
      const next = args[i + 1];
      if (next && !next.startsWith('--')) {
        options[key] = next;
        i++;
      } else {
        options[key] = true;
      }
    }
  }
  return options;
}

/** Run only when `node dist/cli.js` is the entrypoint — not when `bin/guardrail.js` imports this file (that launcher calls `runCLI()` itself). */
function isMainModule(): boolean {
  const entry = process.argv[1];
  if (!entry) return false;
  try {
    return import.meta.url === pathToFileURL(path.resolve(entry)).href;
  } catch {
    return false;
  }
}

if (isMainModule()) {
  runCLI().catch((err) => {
    console.error('Fatal error:', err);
    process.exit(1);
  });
}
