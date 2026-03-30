#!/usr/bin/env node
/**
 * Verified Autofix Command - PRO+ Feature
 * 
 * This is the core monetization feature that provides:
 * - Strict Build Mode prompts requiring JSON output with unified diff
 * - Validation of strict output protocol
 * - Temp workspace application with full verification pipeline
 * - Auto-reprompt on failure with tight failure context
 * - Apply patch only if verification passes
 * 
 * PRICING: PRO+ only. Prompts alone are free. Paid value = prompts + strict diff + verification.
 */

"use strict";

const path = require("path");
const fs = require("fs");
const { entitlements, TIER_CONFIG, trackUsage, getCurrentTier } = require("./lib/entitlements");

// ============================================================================
// FIX PACK DEFINITIONS
// ============================================================================

const FIX_PACKS = {
  "route-integrity": {
    name: "Route Integrity",
    description: "Fix dead links and orphan routes",
    requiredTier: "pro",
  },
  "placeholders": {
    name: "Placeholder Removal",
    description: "Remove lorem ipsum, mock data, and placeholder content",
    requiredTier: "pro",
  },
  "type-errors": {
    name: "Type Error Fix",
    description: "Fix TypeScript type errors",
    requiredTier: "pro",
  },
  "build-blockers": {
    name: "Build Blockers",
    description: "Fix issues preventing successful builds",
    requiredTier: "pro",
  },
  "test-failures": {
    name: "Test Failures",
    description: "Fix failing tests",
    requiredTier: "pro",
  },
};

// ============================================================================
// TERMINAL UTILITIES
// ============================================================================

const colors = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  dim: "\x1b[2m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  magenta: "\x1b[35m",
  cyan: "\x1b[36m",
  white: "\x1b[37m",
  bgRed: "\x1b[41m",
  bgGreen: "\x1b[42m",
  bgYellow: "\x1b[43m",
  bgBlue: "\x1b[44m",
};

function printBanner() {
  console.log(`
${colors.cyan}${colors.bold}
   ██████╗ ██╗   ██╗ █████╗ ██████╗ ██████╗ ██████╗  █████╗ ██╗██╗
  ██╔════╝ ██║   ██║██╔══██╗██╔══██╗██╔══██╗██╔══██╗██╔══██╗██║██║
  ██║  ███╗██║   ██║███████║██████╔╝██║  ██║██████╔╝███████║██║██║
  ██║   ██║██║   ██║██╔══██║██╔══██╗██║  ██║██╔══██╗██╔══██║██║██║
  ╚██████╔╝╚██████╔╝██║  ██║██║  ██║██████╔╝██║  ██║██║  ██║██║███████╗
   ╚═════╝  ╚═════╝ ╚═╝  ╚═╝╚═╝  ╚═╝╚═════╝ ╚═╝  ╚═╝╚═╝  ╚═╝╚═╝╚══════╝
${colors.reset}
  ${colors.dim}┌─────────────────────────────────────────────────────────────────────┐${colors.reset}
  ${colors.dim}│${colors.reset}  ${colors.magenta}Verified Autofix${colors.reset} • PRO+ Feature • AI-Powered Code Fixes    ${colors.dim}│${colors.reset}
  ${colors.dim}└─────────────────────────────────────────────────────────────────────┘${colors.reset}
`);
}

function printUsage() {
  console.log(`
${colors.bold}USAGE${colors.reset}
  guardrail fix <fix-pack> [options]

${colors.bold}FIX PACKS${colors.reset}
  route-integrity    Fix dead links and orphan routes
  placeholders       Remove lorem ipsum, mock data, placeholder content
  type-errors        Fix TypeScript type errors
  build-blockers     Fix issues preventing successful builds
  test-failures      Fix failing tests

${colors.bold}OPTIONS${colors.reset}
  --dry-run          Show diff without applying changes
  --verbose          Show detailed progress
  --max-attempts N   Maximum fix attempts (default: 3)
  --path <dir>       Project path (default: current directory)
  --format json      Output as JSON

${colors.bold}EXAMPLES${colors.reset}
  guardrail fix route-integrity
  guardrail fix type-errors --dry-run
  guardrail fix build-blockers --max-attempts 5

${colors.bold}TIER REQUIREMENT${colors.reset}
  This command requires PRO tier or higher.
  Upgrade: ${colors.cyan}guardrail upgrade${colors.reset} or https://guardrail.dev/pricing
`);
}

function printTierInfo(tier, config) {
  const remaining = config.limits.aiAgentRunsPerMonth === -1 
    ? "unlimited" 
    : `${config.limits.aiAgentRunsPerMonth} runs`;
  
  console.log(`
  ${colors.dim}─────────────────────────────────────────────────────────────────────${colors.reset}
  ${colors.bold}Tier:${colors.reset} ${colors.cyan}${config.name}${colors.reset} ($${config.price}/month)
  ${colors.bold}AI Agent Runs:${colors.reset} ${remaining}/month
  ${colors.dim}─────────────────────────────────────────────────────────────────────${colors.reset}
`);
}

function printUpgradeRequired(currentTier, requiredTier) {
  const current = TIER_CONFIG[currentTier];
  const required = TIER_CONFIG[requiredTier];
  
  console.log(`
  ${colors.bgRed}${colors.white}${colors.bold} UPGRADE REQUIRED ${colors.reset}

  ${colors.bold}Feature:${colors.reset} Verified Autofix
  ${colors.bold}Your tier:${colors.reset} ${current.name} ($${current.price}/month)
  ${colors.bold}Required:${colors.reset} ${required.name} ($${required.price}/month)

  ${colors.dim}─────────────────────────────────────────────────────────────────────${colors.reset}

  ${colors.bold}What you get with ${required.name}:${colors.reset}

  ${colors.green}✓${colors.reset} AI Agent autonomous testing
  ${colors.green}✓${colors.reset} Verified autofix with generated prompts
  ${colors.green}✓${colors.reset} Autopilot continuous protection
  ${colors.green}✓${colors.reset} MCP plugin for IDE integration
  ${colors.green}✓${colors.reset} ${required.limits.realityRunsPerMonth} Reality runs/month
  ${colors.green}✓${colors.reset} ${required.limits.aiAgentRunsPerMonth} AI Agent runs/month

  ${colors.dim}─────────────────────────────────────────────────────────────────────${colors.reset}

  ${colors.cyan}→ guardrail upgrade${colors.reset}
  ${colors.cyan}→ https://guardrail.dev/pricing${colors.reset}
`);
}

function printQuotaExceeded(usage, limit) {
  console.log(`
  ${colors.bgYellow}${colors.bold} QUOTA EXCEEDED ${colors.reset}

  ${colors.bold}AI Agent Runs:${colors.reset} ${usage}/${limit} used this month

  ${colors.dim}─────────────────────────────────────────────────────────────────────${colors.reset}

  Your monthly AI Agent quota has been reached.
  
  Options:
  • Wait until next billing cycle for quota reset
  • Upgrade to a higher tier for more runs

  ${colors.cyan}→ guardrail upgrade${colors.reset}
  ${colors.cyan}→ https://guardrail.dev/pricing${colors.reset}
`);
}

// ============================================================================
// MAIN COMMAND
// ============================================================================

async function runFix(args) {
  const startTime = Date.now();
  
  // Parse arguments
  const options = {
    fixPack: null,
    dryRun: false,
    verbose: false,
    maxAttempts: 3,
    projectPath: process.cwd(),
    format: "text",
    help: false,
  };
  
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    
    if (arg === "--help" || arg === "-h") {
      options.help = true;
    } else if (arg === "--dry-run") {
      options.dryRun = true;
    } else if (arg === "--verbose" || arg === "-v") {
      options.verbose = true;
    } else if (arg === "--max-attempts" && args[i + 1]) {
      options.maxAttempts = parseInt(args[++i], 10) || 3;
    } else if ((arg === "--path" || arg === "-p") && args[i + 1]) {
      options.projectPath = path.resolve(args[++i]);
    } else if (arg === "--format" && args[i + 1]) {
      options.format = args[++i];
    } else if (!arg.startsWith("-") && !options.fixPack) {
      options.fixPack = arg;
    }
  }
  
  // Show help
  if (options.help || !options.fixPack) {
    printBanner();
    printUsage();
    return options.help ? 0 : 1;
  }
  
  // Validate fix pack
  if (!FIX_PACKS[options.fixPack]) {
    console.error(`${colors.red}Error: Unknown fix pack '${options.fixPack}'${colors.reset}`);
    console.error(`Valid fix packs: ${Object.keys(FIX_PACKS).join(", ")}`);
    return 1;
  }
  
  printBanner();
  
  // ============================================================================
  // TIER CHECK - PRO+ REQUIRED
  // ============================================================================
  
  let tier;
  try {
    tier = await getCurrentTier();
  } catch (error) {
    console.warn(`${colors.yellow}Warning: Could not connect to guardrail API, using offline mode${colors.reset}\n`);
    tier = "free";
  }
  
  const config = TIER_CONFIG[tier];
  const fixPack = FIX_PACKS[options.fixPack];
  
  // Check tier access
  const tierOrder = ["free", "starter", "pro", "compliance", "enterprise", "unlimited"];
  const currentTierIndex = tierOrder.indexOf(tier);
  const requiredTierIndex = tierOrder.indexOf(fixPack.requiredTier);
  
  if (currentTierIndex < requiredTierIndex) {
    printUpgradeRequired(tier, fixPack.requiredTier);
    
    if (options.format === "json") {
      console.log(JSON.stringify({
        success: false,
        error: "TIER_REQUIRED",
        currentTier: tier,
        requiredTier: fixPack.requiredTier,
        upgradeUrl: "https://guardrail.dev/pricing",
      }, null, 2));
    }
    
    return 1;
  }
  
  // Check quota
  try {
    const limitCheck = await entitlements.checkLimit("aiAgentRuns");
    if (!limitCheck.allowed) {
      printQuotaExceeded(limitCheck.usage, limitCheck.limit);
      
      if (options.format === "json") {
        console.log(JSON.stringify({
          success: false,
          error: "QUOTA_EXCEEDED",
          usage: limitCheck.usage,
          limit: limitCheck.limit,
        }, null, 2));
      }
      
      return 1;
    }
  } catch (error) {
    // Offline mode - allow with warning
    console.warn(`${colors.yellow}Warning: Running in offline mode. Usage will be synced when online.${colors.reset}\n`);
  }
  
  printTierInfo(tier, config);
  
  // ============================================================================
  // RUN VERIFIED AUTOFIX
  // ============================================================================
  
  console.log(`  ${colors.bold}Fix Pack:${colors.reset} ${fixPack.name}`);
  console.log(`  ${colors.bold}Project:${colors.reset} ${options.projectPath}`);
  console.log(`  ${colors.bold}Mode:${colors.reset} ${options.dryRun ? "Dry Run (preview only)" : "Apply Changes"}`);
  console.log(`  ${colors.bold}Max Attempts:${colors.reset} ${options.maxAttempts}`);
  console.log();
  
  // Track usage
  try {
    await trackUsage("aiAgentRuns", 1);
  } catch {
    // Ignore tracking errors
  }
  
  const result = {
    success: false,
    fixPack: options.fixPack,
    attempts: 0,
    maxAttempts: options.maxAttempts,
    duration: 0,
    verification: null,
    appliedDiffs: 0,
    filesModified: [],
    errors: [],
    dryRun: options.dryRun,
  };
  
  try {
    // Load verified autofix module
    let verifiedAutofix;
    try {
      const corePath = path.join(__dirname, "../../packages/core/dist/verified-autofix.js");
      if (fs.existsSync(corePath)) {
        verifiedAutofix = require(corePath);
      } else {
        // Try src path during development
        const srcPath = path.join(__dirname, "../../packages/core/src/verified-autofix.ts");
        if (fs.existsSync(srcPath)) {
          console.log(`  ${colors.yellow}Note: Using TypeScript source. Run 'pnpm build' for production.${colors.reset}\n`);
        }
        throw new Error("Verified autofix module not found. Run 'pnpm build' first.");
      }
    } catch (loadError) {
      result.errors.push(loadError.message);
      console.error(`  ${colors.red}Error loading verified autofix module:${colors.reset} ${loadError.message}`);
      console.log(`  ${colors.dim}Run 'pnpm build' in packages/core to compile.${colors.reset}\n`);
      
      if (options.format === "json") {
        console.log(JSON.stringify(result, null, 2));
      }
      return 1;
    }
    
    // Run the autofix
    console.log(`  ${colors.cyan}Starting verified autofix...${colors.reset}\n`);
    
    const autofixResult = await verifiedAutofix.runVerifiedAutofix({
      projectPath: options.projectPath,
      fixPack: options.fixPack,
      dryRun: options.dryRun,
      verbose: options.verbose,
      maxAttempts: options.maxAttempts,
      onProgress: (stage, message) => {
        if (options.verbose) {
          console.log(`  ${colors.dim}[${stage}]${colors.reset} ${message}`);
        }
      },
    });
    
    result.success = autofixResult.success;
    result.attempts = autofixResult.attempts;
    result.verification = autofixResult.verification;
    result.appliedDiffs = autofixResult.appliedDiffs;
    result.filesModified = autofixResult.filesModified;
    result.errors = autofixResult.errors;
    result.duration = autofixResult.duration;
    
  } catch (error) {
    result.errors.push(error.message);
    result.duration = Date.now() - startTime;
  }
  
  // ============================================================================
  // OUTPUT RESULTS
  // ============================================================================
  
  if (options.format === "json") {
    console.log(JSON.stringify(result, null, 2));
    return result.success ? 0 : 1;
  }
  
  console.log(`
  ${colors.dim}═══════════════════════════════════════════════════════════════════${colors.reset}
`);
  
  if (result.success) {
    console.log(`  ${colors.bgGreen}${colors.bold} ✓ AUTOFIX SUCCESSFUL ${colors.reset}
`);
    console.log(`  ${colors.bold}Attempts:${colors.reset} ${result.attempts}/${result.maxAttempts}`);
    console.log(`  ${colors.bold}Files Modified:${colors.reset} ${result.filesModified.length}`);
    
    if (result.filesModified.length > 0) {
      console.log();
      for (const file of result.filesModified.slice(0, 10)) {
        console.log(`    ${colors.green}✓${colors.reset} ${file}`);
      }
      if (result.filesModified.length > 10) {
        console.log(`    ${colors.dim}... and ${result.filesModified.length - 10} more${colors.reset}`);
      }
    }
    
    if (options.dryRun) {
      console.log(`
  ${colors.yellow}Note: This was a dry run. No changes were applied.${colors.reset}
  Run without --dry-run to apply changes.`);
    }
    
  } else {
    console.log(`  ${colors.bgRed}${colors.bold} ✗ AUTOFIX FAILED ${colors.reset}
`);
    console.log(`  ${colors.bold}Attempts:${colors.reset} ${result.attempts}/${result.maxAttempts}`);
    
    if (result.errors.length > 0) {
      console.log(`
  ${colors.bold}Errors:${colors.reset}`);
      for (const error of result.errors.slice(0, 5)) {
        console.log(`    ${colors.red}•${colors.reset} ${error}`);
      }
    }
    
    if (result.verification && result.verification.blockers.length > 0) {
      console.log(`
  ${colors.bold}Verification Blockers:${colors.reset}`);
      for (const blocker of result.verification.blockers.slice(0, 5)) {
        console.log(`    ${colors.red}•${colors.reset} ${blocker}`);
      }
    }
  }
  
  console.log(`
  ${colors.dim}Duration: ${result.duration}ms${colors.reset}
`);
  
  return result.success ? 0 : 1;
}

module.exports = { runFix };

// Run if called directly
if (require.main === module) {
  runFix(process.argv.slice(2))
    .then((code) => process.exit(code))
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
