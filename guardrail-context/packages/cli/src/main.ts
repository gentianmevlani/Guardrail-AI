#!/usr/bin/env node
/**
 * guardrail Context Engine CLI
 * 4-command product: on, checkpoint, ship, stats
 */
import { cmdInit } from "./commands/init.js";
import { cmdIndex } from "./commands/index.js";
import { cmdOn } from "./commands/on.js";
import { cmdCheckpoint } from "./commands/checkpoint.js";
import { cmdShip } from "./commands/ship.js";
import { cmdStats } from "./commands/stats.js";
import { cmdVerify } from "./commands/verify.js";
import { cmdDoctor } from "./commands/doctor.js";
import { cmdMenu } from "./commands/menu.js";
import { cmdDashboard } from "./commands/dashboard.js";
import { login, logout, getAuthState } from "./auth/gate.js";
import { shouldUseUI } from "./ui/terminal.js";

const args = process.argv.slice(2);
const sub = args[0];

const ANSI = {
  reset: "\x1b[0m",
  dim: "\x1b[2m",
  bold: "\x1b[1m",
  cyan: "\x1b[36m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
};

function printHelp() {
  console.log(`
${ANSI.cyan}╔═══════════════════════════════════════════════════════════╗
║                    guardrail                               ║
║         AI doesn't know your codebase. Now it does.        ║
╚═══════════════════════════════════════════════════════════╝${ANSI.reset}

${ANSI.bold}USAGE:${ANSI.reset}
  guardrail <command> [options]

${ANSI.bold}COMMANDS:${ANSI.reset}
  ${ANSI.green}on${ANSI.reset}          Start Context Mode (watcher + MCP + telemetry)
  ${ANSI.green}checkpoint${ANSI.reset}  Fast verification on changed files
  ${ANSI.green}ship${ANSI.reset}        GO/WARN/NO-GO verdict before deploy
  ${ANSI.green}stats${ANSI.reset}       Show hallucinations blocked + value metrics
  ${ANSI.green}dashboard${ANSI.reset}   Launch Command Center (web UI)

${ANSI.dim}SETUP:${ANSI.reset}
  init        Install rules for Cursor, Windsurf, Copilot
  doctor      Diagnose issues with your setup

${ANSI.bold}OPTIONS:${ANSI.reset}
  --json      Output as JSON
  --details   Show expanded details
  --evidence  Show file:line receipts
  --report    Generate HTML report (ship)
  --http      Use HTTP mode (on)
  --port=N    Port for HTTP server (default: 3847)
  --since=Xd  Filter stats by time (24h, 7d, 30d)

${ANSI.bold}WORKFLOW:${ANSI.reset}
  1. ${ANSI.cyan}guardrail init${ANSI.reset}       # One-time setup
  2. ${ANSI.cyan}guardrail on${ANSI.reset}         # Start coding with AI protection
  3. ${ANSI.cyan}guardrail stats${ANSI.reset}      # See value: hallucinations blocked
  4. ${ANSI.cyan}guardrail ship${ANSI.reset}       # GO/NO-GO before deploy

${ANSI.dim}Your AI made fewer mistakes. That's what we do.${ANSI.reset}
`);
}

function parseFlag(flag: string): string | undefined {
  const arg = args.find(a => a.startsWith(`--${flag}=`));
  return arg ? arg.split("=")[1] : undefined;
}

function hasFlag(flag: string): boolean {
  return args.includes(`--${flag}`);
}

async function main() {
  // No args: launch interactive menu (if TTY) or show help
  if (!sub) {
    if (shouldUseUI()) {
      await cmdMenu(process.cwd());
      process.exit(0);
    } else {
      printHelp();
      process.exit(1);
    }
  }

  if (args.includes("--help") || args.includes("-h")) {
    printHelp();
    process.exit(0);
  }

  if (args.includes("--version") || args.includes("-v")) {
    console.log("guardrail 1.0.0");
    process.exit(0);
  }

  const cwd = process.cwd();

  try {
    switch (sub) {
      // Primary 4 commands
      case "on":
        await cmdOn(cwd, {
          http: hasFlag("http"),
          port: parseInt(parseFlag("port") || "3847"),
          verbose: hasFlag("verbose"),
        });
        break;

      case "checkpoint":
        await cmdCheckpoint(cwd, {
          json: hasFlag("json"),
          verbose: hasFlag("verbose"),
        });
        break;

      case "ship":
        await cmdShip(cwd, {
          json: hasFlag("json"),
          details: hasFlag("details"),
          evidence: hasFlag("evidence"),
          report: hasFlag("report"),
          fix: hasFlag("fix"),
        });
        break;

      case "stats":
        await cmdStats(cwd, {
          since: parseFlag("since"),
          json: hasFlag("json"),
          details: hasFlag("details"),
        });
        break;

      case "dashboard":
        await cmdDashboard(cwd, {
          apiOnly: hasFlag("api-only"),
          port: parseInt(parseFlag("port") || "3849"),
        });
        break;

      // Setup commands
      case "init":
        await cmdInit(cwd);
        break;

      case "doctor":
        await cmdDoctor(cwd);
        break;

      // Auth commands
      case "login":
        const apiKey = args[1] || parseFlag("key");
        if (!apiKey) {
          console.log(`Usage: guardrail login <api-key>`);
          console.log(`Get your key at: https://guardrail.dev/dashboard`);
          process.exit(1);
        }
        await login(apiKey);
        break;

      case "logout":
        logout();
        break;

      case "whoami":
        const state = getAuthState();
        if (state.authenticated) {
          console.log(`${ANSI.green}✓${ANSI.reset} Logged in as ${ANSI.bold}${state.tier}${ANSI.reset} tier`);
          if (state.email) console.log(`  Email: ${state.email}`);
        } else {
          console.log(`${ANSI.dim}Not logged in (free tier)${ANSI.reset}`);
          console.log(`Run: guardrail login <api-key>`);
        }
        break;

      // Advanced/internal commands
      case "index":
        await cmdIndex(cwd);
        break;

      case "verify":
        await cmdVerify(cwd);
        break;

      default:
        console.error(`Unknown command: ${sub}`);
        console.error(`Run 'guardrail --help' for usage.`);
        process.exit(1);
    }
  } catch (e: any) {
    console.error(`${ANSI.reset}Error: ${e.message}`);
    if (hasFlag("verbose")) {
      console.error(e.stack);
    }
    process.exit(1);
  }
}

main();
