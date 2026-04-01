/**
 * Runner: guardrail vibe-check
 *
 * Detects what AI app builders forget — the gap between
 * "looks good" and "actually works in production".
 * Wraps the VibecoderDetector for CLI usage.
 */

const path = require("path");

// ANSI colors
const c = {
  reset: "\x1b[0m",
  dim: "\x1b[2m",
  cyan: "\x1b[36m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  red: "\x1b[31m",
  magenta: "\x1b[35m",
  bold: "\x1b[1m",
};

function printHelp() {
  console.log(`
${c.cyan}guardrail vibe-check${c.reset} — Shipping readiness analysis for AI-built apps

${c.bold}USAGE${c.reset}

  guardrail vibe-check [path] [options]

${c.bold}ARGUMENTS${c.reset}

  path                  Project directory to analyze (default: .)

${c.bold}OPTIONS${c.reset}

  --json                Output as JSON
  --fix                 Show auto-fix suggestions with template commands
  --strict              Fail (exit 1) if score < 80
  --threshold <n>       Custom pass/fail threshold (default: 80)
  -h, --help            Show this help

${c.bold}EXAMPLES${c.reset}

  guardrail vibe-check                    ${c.dim}# Check current project${c.reset}
  guardrail vibe-check ./my-app           ${c.dim}# Check specific directory${c.reset}
  guardrail vibe-check --json             ${c.dim}# Machine-readable output${c.reset}
  guardrail vibe-check --strict           ${c.dim}# Fail CI if not ready${c.reset}
  guardrail vibe-check --fix              ${c.dim}# Show fix commands${c.reset}

${c.bold}WHAT IT CHECKS${c.reset}

  ${c.red}🚨 Critical${c.reset}     Auth, error handling, env validation, input validation
  ${c.yellow}⚠️  Essential${c.reset}    Loading states, empty states, 404 pages, responsive design
  ${c.cyan}💡 Important${c.reset}     Rate limiting, logging, caching, search, pagination
  ${c.dim}✨ Polish${c.reset}        Animations, breadcrumbs, dark mode, keyboard shortcuts
`);
}

async function runVibeCheck(args = []) {
  if (args.includes("--help") || args.includes("-h")) {
    printHelp();
    return 0;
  }

  const jsonOutput = args.includes("--json");
  const showFix = args.includes("--fix");
  const strict = args.includes("--strict");
  const thresholdIdx = args.indexOf("--threshold");
  const threshold =
    thresholdIdx !== -1 ? parseInt(args[thresholdIdx + 1], 10) || 80 : 80;

  /** First positional path (skips --threshold value and other flags). */
  const usedIndices = new Set();
  if (thresholdIdx !== -1 && args[thresholdIdx + 1] !== undefined) {
    usedIndices.add(thresholdIdx + 1);
  }
  let projectPath = process.cwd();
  for (let i = 0; i < args.length; i++) {
    if (usedIndices.has(i)) continue;
    const a = args[i];
    if (a.startsWith("-")) continue;
    projectPath = path.resolve(a);
    break;
  }

  let vibecoderDetector;
  try {
    ({ vibecoderDetector } = require("../../src/lib/vibecoder-detector"));
  } catch (err) {
    // Fallback: try compiled dist
    try {
      ({ vibecoderDetector } = require("../../dist/lib/vibecoder-detector"));
    } catch {
      console.error(
        `${c.red}✗${c.reset} Could not load vibecoder-detector: ${err.message}`
      );
      return 1;
    }
  }

  if (!jsonOutput) {
    console.log(
      `\n${c.cyan}🎯 Vibe Check${c.reset} — Shipping readiness analysis\n`
    );
    console.log(`${c.dim}Analyzing: ${projectPath}${c.reset}\n`);
  }

  try {
    const report = await vibecoderDetector.analyze(projectPath);

    // ── JSON mode ──────────────────────────────────────────────────
    if (jsonOutput) {
      const output = {
        score: report.score,
        canShip: report.canShip,
        missingCritical: report.missingCritical,
        missingEssential: report.missingEssential,
        missingImportant: report.missingImportant,
        recommendations: report.recommendations,
        estimatedTimeToShip: report.estimatedTimeToShip,
      };
      process.stdout.write(JSON.stringify(output, null, 2) + "\n");
      return strict && report.score < threshold ? 1 : 0;
    }

    // ── Score ──────────────────────────────────────────────────────
    const scoreColor =
      report.score >= 80 ? c.green : report.score >= 60 ? c.yellow : c.red;
    const scoreIcon =
      report.score >= 80 ? "🟢" : report.score >= 60 ? "🟡" : "🔴";
    const bar = renderBar(report.score);

    console.log(`${c.bold}📊 SHIPPING READINESS${c.reset}\n`);
    console.log(`   ${scoreIcon} ${scoreColor}${report.score}/100${c.reset}  ${bar}\n`);

    if (report.canShip) {
      console.log(`   ${c.green}✅ Ready to ship!${c.reset}\n`);
    } else {
      console.log(
        `   ${c.red}❌ Not ready — critical features missing${c.reset}\n`
      );
    }

    // ── Critical ───────────────────────────────────────────────────
    if (report.missingCritical.length > 0) {
      console.log(`${c.red}${c.bold}🚨 CRITICAL — Blocks Shipping${c.reset}\n`);
      report.missingCritical.forEach((f, i) => {
        console.log(`   ${i + 1}. ${c.bold}${f.feature}${c.reset}`);
        console.log(`      ${f.description}`);
        console.log(
          `      ${c.dim}Why: ${f.whyItMatters}${c.reset}`
        );
        if (showFix && f.fix) {
          console.log(`      ${c.cyan}Fix: ${f.fix}${c.reset}`);
        }
        console.log("");
      });
    }

    // ── Essential ──────────────────────────────────────────────────
    if (report.missingEssential.length > 0) {
      console.log(
        `${c.yellow}${c.bold}⚠️  ESSENTIAL — Poor UX Without These${c.reset}\n`
      );
      report.missingEssential.forEach((f, i) => {
        console.log(`   ${i + 1}. ${c.bold}${f.feature}${c.reset}`);
        console.log(`      ${f.description}`);
        console.log(
          `      ${c.dim}Why: ${f.whyItMatters}${c.reset}`
        );
        if (showFix && f.fix) {
          console.log(`      ${c.cyan}Fix: ${f.fix}${c.reset}`);
        }
        console.log("");
      });
    }

    // ── Important ──────────────────────────────────────────────────
    if (report.missingImportant.length > 0) {
      console.log(
        `${c.cyan}${c.bold}💡 IMPORTANT — Scalability & Security${c.reset}\n`
      );
      report.missingImportant.forEach((f, i) => {
        console.log(`   ${i + 1}. ${c.bold}${f.feature}${c.reset}`);
        console.log(`      ${f.description}`);
        if (showFix && f.fix) {
          console.log(`      ${c.cyan}Fix: ${f.fix}${c.reset}`);
        }
        console.log("");
      });
    }

    // ── Recommendations ────────────────────────────────────────────
    if (report.recommendations.length > 0) {
      console.log(`${c.magenta}${c.bold}💡 RECOMMENDATIONS${c.reset}\n`);
      report.recommendations.forEach((rec, i) => {
        console.log(`   ${i + 1}. ${rec}`);
      });
      console.log("");
    }

    // ── Summary ────────────────────────────────────────────────────
    console.log(
      `${c.dim}⏱️  Estimated time to ship-ready: ${report.estimatedTimeToShip}${c.reset}\n`
    );

    if (!report.canShip) {
      console.log(`${c.bold}Next steps:${c.reset}`);
      console.log(`   1. Fix critical features first`);
      console.log(`   2. Add essential features for better UX`);
      console.log(
        `   3. Run ${c.cyan}guardrail ship --fix${c.reset} to auto-fix what's possible`
      );
      console.log("");
    }

    // ── Strict mode exit code ──────────────────────────────────────
    if (strict && report.score < threshold) {
      console.log(
        `${c.red}✗ Score ${report.score} is below threshold ${threshold}${c.reset}\n`
      );
      return 1;
    }

    return 0;
  } catch (error) {
    if (jsonOutput) {
      process.stdout.write(
        JSON.stringify({ error: error.message }, null, 2) + "\n"
      );
    } else {
      console.error(`${c.red}✗ Error:${c.reset} ${error.message}`);
    }
    return 1;
  }
}

function renderBar(score) {
  const width = 20;
  const filled = Math.round((score / 100) * width);
  const empty = width - filled;
  const color = score >= 80 ? c.green : score >= 60 ? c.yellow : c.red;
  return `${color}${"█".repeat(filled)}${c.dim}${"░".repeat(empty)}${c.reset}`;
}

module.exports = { runVibeCheck };
