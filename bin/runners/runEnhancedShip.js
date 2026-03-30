/**
 * Enhanced Ship Decision Runner
 * 
 * Uses the enhanced ship decision engine with:
 * - Multi-criteria evaluation
 * - Confidence scores
 * - Drift detection
 * - Actionable blockers
 */

const path = require("path");
const { withErrorHandling, EXIT_CODES } = require("./lib/error-handler");

// ANSI colors
const c = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  dim: "\x1b[2m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  magenta: "\x1b[35m",
  cyan: "\x1b[36m",
  bgRed: "\x1b[41m",
  bgGreen: "\x1b[42m",
  bgYellow: "\x1b[43m",
};

async function runEnhancedShip(args) {
  return withErrorHandling(async () => {
    const projectPath = args.path || process.cwd();
    const json = args.json || false;
    const checkDrift = args["check-drift"] !== false;
    const includeSecurity = args.security !== false;
    const includePerformance = args.performance !== false;
    const includeReality = args.reality !== false;

    // Try to load enhanced ship decision engine
    let enhancedShipDecisionEngine;
    try {
      // Try TypeScript compiled version first
      const modulePath = path.resolve(__dirname, "../../packages/core/dist/ship/enhanced-ship-decision.js");
      enhancedShipDecisionEngine = require(modulePath).enhancedShipDecisionEngine;
    } catch {
      try {
        // Try source TypeScript (if ts-node is available)
        const tsModulePath = path.resolve(__dirname, "../../packages/core/src/ship/enhanced-ship-decision.ts");
        require("ts-node/register");
        enhancedShipDecisionEngine = require(tsModulePath).enhancedShipDecisionEngine;
      } catch (err) {
        console.error(`${c.red}Error: Enhanced ship decision engine not available.${c.reset}`);
        console.error(`Please run: pnpm build in packages/core`);
        console.error(`${c.dim}Location: ${__filename}${c.reset}`);
        throw new Error(`Enhanced ship decision engine not available: ${err.message}`);
      }
    }

    if (!json) {
      console.log(`${c.cyan}${c.bold}━━━ Enhanced Ship Decision ━━━${c.reset}\n`);
      console.log(`Project: ${path.relative(process.cwd(), projectPath)}\n`);
    }

    // Run enhanced ship decision
    const decision = await enhancedShipDecisionEngine.decide(projectPath, {
      includeReality,
      includeSecurity,
      includePerformance,
      checkDrift,
    });

    // Output results
    if (json) {
      console.log(JSON.stringify(decision, null, 2));
      return decision.verdict === "SHIP" ? 0 : 1;
    }

    // Print formatted report
    printDecisionReport(decision);

    // Print drift warning if detected
    if (decision.driftDetected && decision.driftDetails) {
      console.log(`\n${c.yellow}${c.bold}⚠️  DRIFT DETECTED${c.reset}`);
      console.log(`   Score change: ${decision.driftDetails.score.toFixed(1)} points`);
      console.log(`   Affected areas: ${decision.driftDetails.areas.join(", ")}`);
      console.log(`\n   ${c.dim}${decision.driftDetails.overallRecommendation}${c.reset}\n`);
    }

    // Print recommendations
    if (decision.recommendations.immediate.length > 0) {
      console.log(`${c.cyan}${c.bold}🔧 IMMEDIATE ACTIONS:${c.reset}`);
      for (const rec of decision.recommendations.immediate.slice(0, 5)) {
        console.log(`   • ${rec}`);
      }
      console.log();
    }

    // Exit code based on verdict
    return decision.verdict === "SHIP" ? 0 : decision.verdict === "REVIEW" ? 2 : 1;
  });
}

function printDecisionReport(decision) {
  // Verdict banner
  const verdictColor = decision.verdict === "SHIP" ? c.green : 
                       decision.verdict === "NO_SHIP" ? c.red : c.yellow;
  const verdictIcon = decision.verdict === "SHIP" ? "✅" : 
                      decision.verdict === "NO_SHIP" ? "❌" : "⚠️";

  console.log(`${verdictColor}${c.bold}${verdictIcon} VERDICT: ${decision.verdict}${c.reset}`);
  console.log(`   Score: ${decision.score}/100`);
  console.log(`   Confidence: ${(decision.confidence * 100).toFixed(0)}%`);
  console.log();

  // Criteria breakdown
  console.log(`${c.cyan}${c.bold}📊 CRITERIA BREAKDOWN:${c.reset}`);
  for (const criterion of decision.criteria) {
    const icon = criterion.status === "pass" ? "✅" :
                 criterion.status === "fail" ? "❌" :
                 criterion.status === "warning" ? "⚠️" : "⏭️";
    const statusColor = criterion.status === "pass" ? c.green :
                        criterion.status === "fail" ? c.red :
                        criterion.status === "warning" ? c.yellow : c.dim;
    
    console.log(`   ${icon} ${criterion.name}`);
    console.log(`      ${statusColor}Status: ${criterion.status.toUpperCase()}${c.reset}`);
    console.log(`      Score: ${criterion.score}/100 (${(criterion.confidence * 100).toFixed(0)}% confidence)`);
    
    if (criterion.blockers.length > 0) {
      console.log(`      ${c.red}Blockers:${c.reset}`);
      for (const blocker of criterion.blockers.slice(0, 2)) {
        console.log(`         • ${blocker}`);
      }
    }
    console.log();
  }

  // Blockers
  if (decision.blockers.length > 0) {
    console.log(`${c.red}${c.bold}🚫 BLOCKERS:${c.reset}`);
    for (const blocker of decision.blockers.slice(0, 10)) {
      const severityColor = blocker.severity === "critical" ? c.red :
                            blocker.severity === "high" ? c.yellow : c.dim;
      console.log(`   [${severityColor}${blocker.severity.toUpperCase()}${c.reset}] ${blocker.message}`);
      if (blocker.fixSteps && blocker.fixSteps.length > 0) {
        console.log(`      Fix: ${blocker.fixSteps[0]}`);
      }
    }
    console.log();
  }
}

module.exports = { runEnhancedShip };
