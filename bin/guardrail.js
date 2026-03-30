#!/usr/bin/env node
// bin/guardrail.js
const readline = require("readline");
const path = require("path");
const fs = require("fs");
const { routeArgv } = require("./_router");
const { warnDeprecationOnce } = require("./_deprecations");
const {
  getApiKey,
  checkEntitlement,
  getEntitlements,
} = require("./runners/lib/auth");

// Read version from package.json
function getVersion() {
  try {
    const pkgPath = path.join(__dirname, "..", "package.json");
    const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf-8"));
    return pkg.version || "0.0.0";
  } catch {
    return "0.0.0";
  }
}

// Runners
const { runScan } = require("./runners/runScan");
const { runGate } = require("./runners/runGate");
const { runContext } = require("./runners/runContext");
const { runDashboard, runDemo } = require("./runners/runDashboard");
const { runFix } = require("./runners/runFix");
const { runShip } = require("./runners/runShip");
const { runLaunch } = require("./runners/runLaunch");
const { runAutopilot } = require("./runners/runAutopilot");
const { runProof } = require("./runners/runProof");
const { runReality } = require("./runners/runReality");
const { runRealitySniff } = require("./runners/runRealitySniff");
const { runValidate } = require("./runners/runValidate");
const { runDoctor } = require("./runners/runDoctor");
const { runInit } = require("./runners/runInit");
const { runMcp } = require("./runners/runMcp");
const { runLogin, runLogout, runWhoami } = require("./runners/runAuth");
const {
  runNaturalLanguage,
  isNaturalLanguageCommand,
} = require("./runners/runNaturalLanguage");
const { runAIAgent } = require("./runners/runAIAgent");
const { runBadge } = require("./runners/runBadge");
const { runUpgrade } = require("./runners/runUpgrade");
const { runCertify } = require("./runners/runCertify");
const { runVerifyAgentOutput } = require("./runners/runVerifyAgentOutput");
const { runFixPacks } = require("./runners/runFixPacks");
const { runAudit } = require("./runners/runAudit");
const { runMdc } = require("./runners/runMdc");
const { runEnhancedShip } = require("./runners/runEnhancedShip");
const { runPromptFirewall } = require("./runners/runPromptFirewall");

const VERSION = getVersion();

// ANSI colors
const c = {
  reset: "\x1b[0m",
  dim: "\x1b[2m",
  cyan: "\x1b[36m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  red: "\x1b[31m",
  blue: "\x1b[34m",
  magenta: "\x1b[35m",
};

// Detect CI/CD environment (non-interactive)
function isCI() {
  return !!(
    process.env.CI ||
    process.env.CONTINUOUS_INTEGRATION ||
    process.env.RAILWAY_ENVIRONMENT ||
    process.env.VERCEL ||
    process.env.NETLIFY ||
    process.env.GITHUB_ACTIONS ||
    process.env.GITLAB_CI ||
    process.env.CIRCLECI ||
    process.env.TRAVIS ||
    process.env.BUILDKITE ||
    process.env.RENDER ||
    process.env.HEROKU ||
    !process.stdin.isTTY
  );
}

// ============================================================================
// TIER-BASED COMMAND ACCESS
// ============================================================================
// FREE ($0) - No API key needed
const FREE_COMMANDS = [
  "help",
  "version",
  "doctor",
  "init",
  "login",
  "logout",
  "whoami",
  "scan", // Route integrity + security analysis
  "validate", // AI code validation
  "badge", // Generate badges
  "certify", // Certification badges (SEO fuel)
  "context", // AI rules generator
  "dashboard", // Real-time monitoring
  "demo", // Interactive demo
  "upgrade", // Subscription management
  "verify-agent-output", // Verify AI agent output
  "mdc", // MDC documentation generator
  "prompt-firewall", // Prompt firewall (free tier with limited features)
  "firewall", // Alias for prompt-firewall
];

// STARTER ($19/mo) - Requires API key with starter+ plan
const STARTER_COMMANDS = {
  ship: "ship:audit", // Plain English audit
  "enhanced-ship": "enhanced-ship:full", // Enhanced ship decision with all features
  gate: "gate:ci", // CI/CD gate
  reality: "reality:basic", // Browser testing
  launch: "launch:checklist", // Pre-launch wizard
};

// PRO ($49/mo) - Requires API key with pro+ plan
const PRO_COMMANDS = {
  "ai-test": "ai:agent", // AI Agent testing
  ai: "ai:agent",
  agent: "ai:agent",
  // fix: removed - handled specially to allow --plan-only on FREE tier
  autopilot: "autopilot:enable", // Continuous protection
};

// Commands with FREE tier read-only modes
const TIERED_COMMANDS = {
  fix: {
    freeArgs: ["--plan-only", "--help", "-h"], // Allow these args on FREE
    requiredScope: "fix:apply",
    tier: "pro",
  },
};

// Special: proof command has sub-modes with different tiers
const PROOF_COMMANDS = {
  mocks: "proof:mocks", // Starter+
  reality: "proof:reality", // Pro+
};

// Commands that always work (utilities)
const UTILITY_COMMANDS = ["mcp", "rules", "api", "deps", "sbom", "fixpacks"];

// Compliance tier commands
const COMPLIANCE_COMMANDS = {
  audit: "audit:full", // Full audit trail
};

async function prompt(question) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

async function showWelcomeAndPromptLogin() {
  console.log(`
${c.cyan}╔════════════════════════════════════════════════════════════╗
║  ${c.reset}🛡️  GUARDRAIL${c.cyan}                                              ║
╚════════════════════════════════════════════════════════════╝${c.reset}

${c.dim}Ship with confidence. Catch fake features before your users do.${c.reset}

`);

  const { key, source } = getApiKey();

  if (!key) {
    // In CI/CD environments, skip interactive prompts
    if (isCI()) {
      console.log(`${c.yellow}⚠ No API key found${c.reset}`);
      console.log(
        `${c.dim}Running in CI mode with FREE tier features.${c.reset}`,
      );
      console.log(
        `${c.dim}Set GUARDRAIL_API_KEY env var to unlock more features.${c.reset}\n`,
      );
      return { key: null, entitlements: null };
    }

    console.log(`${c.yellow}⚠ No API key found${c.reset}`);
    console.log(`
${c.dim}To unlock all features, you need a guardrail API key.${c.reset}

  ${c.green}FREE${c.reset}     scan, validate, badge, doctor, init
  ${c.cyan}STARTER${c.reset}  ship, gate, reality, launch, proof mocks  ${c.dim}($29/mo)${c.reset}
  ${c.magenta}PRO${c.reset}      ai-test, fix, autopilot, proof reality  ${c.dim}($99/mo)${c.reset}

${c.dim}Get your API key at: ${c.cyan}https://guardrail.dev/settings/keys${c.reset}
`);

    const answer = await prompt(
      `${c.cyan}?${c.reset} Do you have an API key? (y/N) `,
    );

    if (answer.toLowerCase() === "y") {
      const apiKey = await prompt(`${c.cyan}?${c.reset} Paste your API key: `);
      if (apiKey) {
        const { saveApiKey } = require("./runners/lib/auth");
        console.log(`\n${c.dim}Verifying...${c.reset}`);

        const entitlements = await getEntitlements(apiKey);
        if (entitlements) {
          saveApiKey(apiKey);
          console.log(
            `\n${c.green}✓${c.reset} Logged in as ${entitlements.user?.name || "User"}`,
          );
          console.log(
            `${c.dim}Plan: ${entitlements.plan?.toUpperCase() || "FREE"}${c.reset}\n`,
          );
          return { key: apiKey, entitlements };
        } else {
          console.log(`\n${c.red}✗${c.reset} Invalid API key\n`);
        }
      }
    }

    console.log(`
${c.dim}Continuing in FREE mode. Some features will be limited.${c.reset}
${c.dim}Run ${c.cyan}guardrail login${c.dim} anytime to upgrade.${c.reset}
`);
    return { key: null, entitlements: null };
  }

  // User has API key, get entitlements
  const entitlements = await getEntitlements(key);
  return { key, entitlements };
}

async function checkCommandAccess(cmd, entitlements, args = []) {
  // Free commands always work (no API key needed)
  if (FREE_COMMANDS.includes(cmd)) {
    return { allowed: true, tier: "free" };
  }

  // Utility commands always work
  if (UTILITY_COMMANDS.includes(cmd)) {
    return { allowed: true, tier: "utility" };
  }

  // Tiered commands with FREE read-only modes
  if (TIERED_COMMANDS[cmd]) {
    const config = TIERED_COMMANDS[cmd];
    // Check if using a FREE tier argument
    const hasFreeArg = args.some(arg => config.freeArgs.includes(arg));
    // Also allow if no fix pack specified (shows help)
    const hasNoFixPack = cmd === "fix" && !args.some(arg => !arg.startsWith("-"));
    
    if (hasFreeArg || hasNoFixPack) {
      return { allowed: true, tier: "free" };
    }
    
    // Requires paid tier
    if (!entitlements) {
      return {
        allowed: false,
        reason: `${c.yellow}${cmd}${c.reset} requires a ${c.magenta}PRO${c.reset} plan.\n\n  Run ${c.cyan}guardrail login${c.reset} to authenticate.\n  Get your API key at: ${c.cyan}https://guardrail.dev/settings/keys${c.reset}`,
      };
    }
    
    if (
      entitlements.scopes?.includes(config.requiredScope) ||
      entitlements.scopes?.includes("*")
    ) {
      return { allowed: true, tier: config.tier };
    }
    
    return {
      allowed: false,
      reason: `Your ${c.yellow}${entitlements.plan?.toUpperCase()}${c.reset} plan doesn't include this feature.\n\n  Required: ${config.requiredScope}\n  Upgrade to ${c.magenta}PRO${c.reset} at: ${c.cyan}https://guardrail.dev/pricing${c.reset}`,
    };
  }

  // Special handling for proof command (has sub-modes with different tiers)
  if (cmd === "proof") {
    const subMode = args[0]; // mocks or reality
    if (subMode === "mocks") {
      // Starter+ required
      if (!entitlements) {
        return {
          allowed: false,
          reason: `${c.yellow}proof mocks${c.reset} requires a ${c.cyan}STARTER${c.reset} plan or higher.\n\n  Run ${c.cyan}guardrail login${c.reset} to authenticate.\n  Get your API key at: ${c.cyan}https://guardrail.dev/settings/keys${c.reset}`,
        };
      }
      if (
        entitlements.scopes?.includes("proof:mocks") ||
        entitlements.scopes?.includes("*")
      ) {
        return { allowed: true, tier: "starter" };
      }
      return {
        allowed: false,
        reason: `Your ${c.yellow}${entitlements.plan?.toUpperCase()}${c.reset} plan doesn't include mock detection.\n\n  Upgrade to ${c.cyan}STARTER${c.reset} at: ${c.cyan}https://guardrail.dev/pricing${c.reset}`,
      };
    } else if (subMode === "reality") {
      // Pro+ required
      if (!entitlements) {
        return {
          allowed: false,
          reason: `${c.yellow}proof reality${c.reset} requires a ${c.magenta}PRO${c.reset} plan.\n\n  Run ${c.cyan}guardrail login${c.reset} to authenticate.\n  Get your API key at: ${c.cyan}https://guardrail.dev/settings/keys${c.reset}`,
        };
      }
      if (
        entitlements.scopes?.includes("proof:reality") ||
        entitlements.scopes?.includes("*")
      ) {
        return { allowed: true, tier: "pro" };
      }
      return {
        allowed: false,
        reason: `Your ${c.yellow}${entitlements.plan?.toUpperCase()}${c.reset} plan doesn't include runtime verification.\n\n  Upgrade to ${c.magenta}PRO${c.reset} at: ${c.cyan}https://guardrail.dev/pricing${c.reset}`,
      };
    }
    // No submode - show help
    return { allowed: true };
  }

  // STARTER tier commands
  if (STARTER_COMMANDS[cmd]) {
    const requiredScope = STARTER_COMMANDS[cmd];

    if (!entitlements) {
      return {
        allowed: false,
        reason: `${c.yellow}${cmd}${c.reset} requires a ${c.cyan}STARTER${c.reset} plan or higher.\n\n  Run ${c.cyan}guardrail login${c.reset} to authenticate.\n  Get your API key at: ${c.cyan}https://guardrail.dev/settings/keys${c.reset}`,
      };
    }

    if (
      entitlements.scopes?.includes(requiredScope) ||
      entitlements.scopes?.includes("*")
    ) {
      return { allowed: true, tier: "starter" };
    }

    return {
      allowed: false,
      reason: `Your ${c.yellow}${entitlements.plan?.toUpperCase()}${c.reset} plan doesn't include this feature.\n\n  Required: ${requiredScope}\n  Upgrade to ${c.cyan}STARTER${c.reset} at: ${c.cyan}https://guardrail.dev/pricing${c.reset}`,
    };
  }

  // PRO tier commands
  if (PRO_COMMANDS[cmd]) {
    const requiredScope = PRO_COMMANDS[cmd];

    if (!entitlements) {
      return {
        allowed: false,
        reason: `${c.yellow}${cmd}${c.reset} requires a ${c.magenta}PRO${c.reset} plan.\n\n  Run ${c.cyan}guardrail login${c.reset} to authenticate.\n  Get your API key at: ${c.cyan}https://guardrail.dev/settings/keys${c.reset}`,
      };
    }

    if (
      entitlements.scopes?.includes(requiredScope) ||
      entitlements.scopes?.includes("*")
    ) {
      return { allowed: true, tier: "pro" };
    }

    return {
      allowed: false,
      reason: `Your ${c.yellow}${entitlements.plan?.toUpperCase()}${c.reset} plan doesn't include this feature.\n\n  Required: ${requiredScope}\n  Upgrade to ${c.magenta}PRO${c.reset} at: ${c.cyan}https://guardrail.dev/pricing${c.reset}`,
    };
  }

  return { allowed: true };
}

function printHelp() {
  console.log(
    `
${c.cyan}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${c.reset}
${c.cyan}  GUARDRAIL${c.reset} - Ship with confidence
${c.cyan}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${c.reset}

${c.green}🚀 QUICK START${c.reset}

  ${c.cyan}ship${c.reset}              "Is my app ready?" - Plain English, traffic light score
  ${c.cyan}ship --fix${c.reset}        Same + auto-fix problems

${c.yellow}🧪 TESTING${c.reset} (each does something different!)

  ${c.cyan}scan${c.reset}              ${c.dim}Route Integrity${c.reset} - dead links, orphans, coverage, security 🗺️
  ${c.cyan}scan --truth${c.reset}      ${c.dim}+ Build manifest${c.reset} verification (CI/ship ready)
  ${c.cyan}scan --reality${c.reset}    ${c.dim}+ Playwright${c.reset} runtime proof (best-in-class)
  ${c.cyan}reality${c.reset}           ${c.dim}Browser testing${c.reset} - clicks buttons, fills forms, finds broken UI
  ${c.cyan}ai-test${c.reset}           ${c.dim}AI Agent${c.reset} - autonomous testing + generates fix prompts 🤖

${c.magenta}🚦 CI/CD & GATES${c.reset}

  ${c.cyan}gate${c.reset}              Block bad deploys - pass/fail for CI pipelines
  ${c.cyan}proof mocks${c.reset}       Block mock/demo code from reaching production
  ${c.cyan}proof reality${c.reset}     Runtime GO/NO-GO verification with Playwright

${c.blue}🔧 FIX & AUTOMATE${c.reset}

  ${c.cyan}fix${c.reset}               Auto-fix detected issues (--plan first, then --apply)
  ${c.cyan}autopilot${c.reset}         Continuous protection - weekly reports, auto-PRs
  ${c.cyan}badge${c.reset}             Generate Ship Badge for your README/PR
  ${c.cyan}certify${c.reset}           Generate guardrail Certified badge with verification link

${c.dim}📦 EXTRAS${c.reset}

  ${c.cyan}audit${c.reset}             View/export audit trail (Compliance+ tier)
  ${c.cyan}context${c.reset}           Generate AI rules files (.cursorrules, .windsurf/rules, etc.)
  ${c.cyan}dashboard${c.reset}         Real-time monitoring dashboard with live metrics
  ${c.cyan}demo${c.reset}              Interactive terminal features showcase
  ${c.cyan}launch${c.reset}            Pre-launch checklist wizard
  ${c.cyan}validate${c.reset}          Check AI-generated code for hallucinations
  ${c.cyan}init${c.reset}              Set up guardrail in your project
  ${c.cyan}doctor${c.reset}            Debug environment issues
  ${c.cyan}mcp${c.reset}               Start MCP server for AI editors

${c.dim}🔑 ACCOUNT${c.reset}

  ${c.cyan}login${c.reset}             Sign in with API key
  ${c.cyan}logout${c.reset}            Sign out
  ${c.cyan}whoami${c.reset}            Show current user & plan
  ${c.cyan}upgrade${c.reset}           Manage subscription & view usage

${c.cyan}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${c.reset}

${c.green}Examples:${c.reset}

  guardrail ship                      ${c.dim}# Quick health check${c.reset}
  guardrail scan                      ${c.dim}# Route integrity + security analysis${c.reset}
  guardrail scan --truth              ${c.dim}# + Build manifest verification${c.reset}
  guardrail scan --reality --url http://localhost:3000  ${c.dim}# Full proof${c.reset}
  guardrail reality --url https://... ${c.dim}# Test live app${c.reset}
  guardrail ai-test --url https://... ${c.dim}# AI explores your app${c.reset}
  guardrail gate                      ${c.dim}# Block bad deploy in CI${c.reset}
  guardrail badge                     ${c.dim}# Generate ship badge${c.reset}

${c.dim}Run 'guardrail <command> --help' for details.${c.reset}
`.trim(),
  );
}

(async function main() {
  const rawArgs = process.argv.slice(2);

  // Check if the first argument looks like a natural language command
  // Natural language commands are typically quoted strings or multi-word phrases
  const firstArg = rawArgs[0];
  if (firstArg && isNaturalLanguageCommand(firstArg)) {
    // Join all args as the natural language input
    const nlInput = rawArgs.join(" ");
    const exitCode = await runNaturalLanguage(nlInput);
    process.exit(exitCode);
  }

  const { legacyFrom, routed } = routeArgv(process.argv);

  const cmd = routed[0];
  const args = routed.slice(1);

  // Commands that skip auth check entirely
  const skipAuthCommands = [
    "help",
    "-h",
    "--help",
    "version",
    "login",
    "logout",
    "whoami",
    "doctor",
  ];

  if (!cmd || cmd === "-h" || cmd === "--help" || cmd === "help") {
    printHelp();
    process.exit(0);
  }

  // Check for first run (no API key) - only for non-skip commands
  let authInfo = { key: null, entitlements: null };

  if (!skipAuthCommands.includes(cmd)) {
    // Check if this is a free command or utility - if so, skip entitlement checks
    const isFreeCommand = FREE_COMMANDS.includes(cmd) || UTILITY_COMMANDS.includes(cmd);
    const isKnownCommand = isFreeCommand || 
      STARTER_COMMANDS[cmd] || 
      PRO_COMMANDS[cmd] || 
      TIERED_COMMANDS[cmd] || 
      PROOF_COMMANDS[cmd] ||
      COMPLIANCE_COMMANDS[cmd];
    
    // For unknown commands, skip auth and let them fail with "Unknown command" message
    if (!isKnownCommand) {
      // Skip authentication for unknown commands - they'll show help/error message
      authInfo = { key: null, entitlements: null };
    } else {
      const { key } = getApiKey();

      // First run without API key - show welcome and prompt
      if (!key && !process.env.GUARDRAIL_SKIP_AUTH) {
        authInfo = await showWelcomeAndPromptLogin();
      } else if (key && !isFreeCommand) {
        // Has API key and command requires auth - get entitlements silently
        // For free commands, we don't need to check entitlements
        try {
          const entitlements = await getEntitlements(key);
          authInfo = { key, entitlements };
        } catch (error) {
          // If API is unavailable, allow free commands to proceed
          // Paid commands will be blocked in checkCommandAccess
          if (isFreeCommand) {
            authInfo = { key, entitlements: null };
          } else {
            throw error;
          }
        }
      } else if (key && isFreeCommand) {
        // Free command with key - no need to fetch entitlements
        authInfo = { key, entitlements: null };
      }
    }

    // Check if user has access to this command (only for known commands)
    if (isKnownCommand) {
      const access = await checkCommandAccess(cmd, authInfo.entitlements, args);

      if (!access.allowed) {
        console.log(`\n${c.red}✗ Access Denied${c.reset}\n`);
        console.log(access.reason);
        console.log("");
        process.exit(1);
      }

      // Show tier info for paid features
      if (access.tier === "starter") {
        console.log(`${c.cyan}▸ STARTER${c.reset} ${c.dim}feature${c.reset}\n`);
      } else if (access.tier === "pro") {
        console.log(`${c.magenta}▸ PRO${c.reset} ${c.dim}feature${c.reset}\n`);
      }
    }
  }

  // Deprecation suggestions
  if (legacyFrom) {
    const suggestion = routed.slice(0, 2).join(" ");
    warnDeprecationOnce(legacyFrom, suggestion, VERSION);
  }

  try {
    let exitCode = 0;
    switch (cmd) {
      case "scan":
        exitCode = await runScan(args);
        break;
      case "gate":
        exitCode = await runGate(args);
        break;
      case "ship":
        exitCode = await runShip(args);
        break;
      case "enhanced-ship":
        exitCode = await runEnhancedShip(args);
        break;
      case "prompt-firewall":
      case "firewall":
        exitCode = await runPromptFirewall(args);
        break;
      case "launch":
        exitCode = await runLaunch(args);
        break;
      case "autopilot":
        exitCode = await runAutopilot(args);
        break;
      case "fix":
        exitCode = await runFix(args);
        break;
      case "proof":
        exitCode = await runProof(args);
        break;
      case "reality":
        exitCode = await runReality(args);
        break;
      case "reality-sniff":
      case "sniff":
        exitCode = await runRealitySniff(args);
        break;
      case "ai-test":
      case "ai":
      case "agent":
        exitCode = await runAIAgent(args);
        break;
      case "validate":
        exitCode = await runValidate(args);
        break;
      case "doctor":
        exitCode = runDoctor(args);
        break;
      case "init":
        exitCode = runInit(args);
        break;
      case "mcp":
        exitCode = runMcp(args);
        break;
      case "login":
        exitCode = await runLogin(args);
        break;
      case "logout":
        exitCode = await runLogout(args);
        break;
      case "whoami":
        exitCode = await runWhoami(args);
        break;
      case "badge":
        exitCode = await runBadge(args);
        break;
      case "context":
      case "rules":
        exitCode = await runContext(args);
        break;
      case "dashboard":
        exitCode = await runDashboard(args);
        break;
      case "demo":
        exitCode = await runDemo(args);
        break;
      case "upgrade":
        exitCode = await runUpgrade(args);
        break;
      case "certify":
        exitCode = await runCertify(args, process.cwd());
        break;
      case "verify-agent-output":
        exitCode = await runVerifyAgentOutput(args);
        break;
      case "fixpacks":
        exitCode = await runFixPacks(args);
        break;
      case "audit":
        exitCode = await runAudit(args);
        break;
      case "mdc":
        exitCode = await runMdc(args);
        break;
      case "version":
        console.log(`guardrail v${VERSION}`);
        break;
      default:
        // Try natural language parsing as fallback for unknown commands
        const nlInput = [cmd, ...args].join(" ");
        if (isNaturalLanguageCommand(nlInput)) {
          exitCode = await runNaturalLanguage(nlInput);
        } else {
          process.stderr.write(`Unknown command: ${cmd}\n\n`);
          printHelp();
          exitCode = 1;
        }
    }
    process.exit(exitCode);
  } catch (err) {
    process.stderr.write(
      err && err.stack ? err.stack + "\n" : String(err) + "\n",
    );
    process.exit(1);
  }
})();
