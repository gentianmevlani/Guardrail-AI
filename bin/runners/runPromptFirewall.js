/**
 * Prompt Firewall Runner
 * 
 * Processes prompts through the advanced firewall with:
 * - Task breakdown
 * - Verification
 * - Version control integration
 * - Immediate fixes
 * - Future planning
 */

const path = require("path");
const readline = require("readline");
const { withErrorHandling } = require("./lib/error-handler");

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
};

async function runPromptFirewall(args) {
  const wrapped = withErrorHandling(async () => {
    const opts = parseFirewallArgs(args);
    if (opts.help) {
      console.log(`
${c.cyan}guardrail prompt-firewall / firewall${c.reset}

${c.dim}Usage:${c.reset}
  guardrail firewall "your prompt"
  guardrail firewall --prompt "your prompt" [--json] [--path <dir>]

${c.dim}Options:${c.reset}
  --prompt <text>   Prompt to analyze
  --json              JSON output
  --path <dir>        Project root
  --auto-fix          Apply fixes when offered
  --help, -h          Show this message
`);
      return 0;
    }
    const projectPath = opts.path || process.cwd();
    const json = opts.json || false;
    const prompt = opts.prompt;
    const autoFix = opts["auto-fix"] === true;
    const includeVersionControl = opts["version-control"] !== false;
    const generatePlan = opts.plan !== false;

    if (!prompt) {
      console.error(`${c.red}Error: Prompt is required${c.reset}`);
      console.error(`Usage: guardrail prompt-firewall "your prompt here"`);
      console.error(`   or: guardrail prompt-firewall --prompt "your prompt here"`);
      return 2;
    }

    // Try to load prompt firewall
    let createPromptFirewall;
    try {
      const modulePath = path.resolve(__dirname, "../../packages/ai-guardrails/dist/firewall/advanced-prompt-firewall.js");
      createPromptFirewall = require(modulePath).createPromptFirewall;
    } catch {
      try {
        const tsModulePath = path.resolve(__dirname, "../../packages/ai-guardrails/src/firewall/advanced-prompt-firewall.ts");
        require("ts-node/register");
        createPromptFirewall = require(tsModulePath).createPromptFirewall;
      } catch {
        console.error(`${c.red}Error: Prompt firewall not available.${c.reset}`);
        console.error(`Please run: pnpm build in packages/ai-guardrails`);
        return 3;
      }
    }

    if (!json) {
      console.log(`${c.cyan}${c.bold}━━━ Prompt Firewall Analysis ━━━${c.reset}\n`);
      console.log(`Prompt: ${c.dim}${prompt}${c.reset}\n`);
      console.log(`Project: ${path.relative(process.cwd(), projectPath)}\n`);
    }

    // Create firewall instance
    const firewall = createPromptFirewall(projectPath);

    // Process prompt
    const result = await firewall.process(prompt, {
      autoBreakdown: true,
      autoVerify: true,
      autoFix: autoFix,
      includeVersionControl: includeVersionControl,
      generatePlan: generatePlan,
    });

    // Output results
    if (json) {
      console.log(JSON.stringify(result, null, 2));
      return result.verification.passed ? 0 : 1;
    }

    // Print formatted report
    printFirewallReport(result);

    // Ask to apply fixes if available
    if (result.immediateFixes.length > 0 && !autoFix) {
      const shouldApply = await askToApplyFixes(result.immediateFixes.length);
      if (shouldApply) {
        console.log(`\n${c.cyan}Applying fixes...${c.reset}\n`);
        for (const fix of result.immediateFixes) {
          const applyResult = await firewall.applyFix(fix);
          if (applyResult.success) {
            console.log(`${c.green}✅${c.reset} ${applyResult.message}`);
          } else {
            console.log(`${c.red}❌${c.reset} ${applyResult.message}`);
          }
        }
      }
    }

    return result.verification.passed ? 0 : 1;
  });
  return wrapped();
}

function parseFirewallArgs(args) {
  const opts = {
    path: process.cwd(),
    json: false,
    prompt: null,
    help: false,
    "auto-fix": false,
    "version-control": true,
    plan: true,
  };
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === "--help" || a === "-h") { opts.help = true; }
    else if (a === "--json") { opts.json = true; }
    else if (a === "--auto-fix") { opts["auto-fix"] = true; }
    else if (a === "--no-version-control") { opts["version-control"] = false; }
    else if (a === "--no-plan") { opts.plan = false; }
    else if (a === "--path" && args[i + 1]) { opts.path = args[++i]; }
    else if (a === "--prompt" && args[i + 1]) { opts.prompt = args[++i]; }
    else if (!a.startsWith("-") && !opts.prompt) { opts.prompt = a; }
  }
  return opts;
}

function printFirewallReport(result) {
  // Verification status
  const statusColor = result.verification.passed ? c.green : c.red;
  const statusIcon = result.verification.passed ? "✅" : "❌";

  console.log(`${statusColor}${c.bold}${statusIcon} VERIFICATION: ${result.verification.passed ? "PASSED" : "FAILED"}${c.reset}`);
  console.log(`   Score: ${result.verification.score}/100`);
  console.log();

  // Verification checks
  console.log(`${c.cyan}${c.bold}🔍 VERIFICATION CHECKS:${c.reset}`);
  for (const check of result.verification.checks) {
    const icon = check.status === "pass" ? "✅" :
                 check.status === "fail" ? "❌" : "⚠️";
    const checkColor = check.status === "pass" ? c.green :
                       check.status === "fail" ? c.red : c.yellow;
    console.log(`   ${icon} ${check.name}: ${checkColor}${check.status.toUpperCase()}${c.reset}`);
    console.log(`      ${c.dim}${check.message}${c.reset}`);
    if (check.evidence) {
      console.log(`      Evidence: ${c.dim}${check.evidence}${c.reset}`);
    }
  }
  console.log();

  // Task breakdown
  if (result.taskBreakdown.length > 0) {
    console.log(`${c.cyan}${c.bold}📋 TASK BREAKDOWN:${c.reset}`);
    for (const task of result.taskBreakdown) {
      const priorityColor = task.priority === "critical" ? c.red :
                            task.priority === "high" ? c.yellow :
                            task.priority === "medium" ? c.blue : c.dim;
      console.log(`   ${priorityColor}[${task.priority.toUpperCase()}]${c.reset} ${task.title}`);
      console.log(`      ${c.dim}${task.description}${c.reset}`);
      console.log(`      Estimated time: ${task.estimatedTime.toFixed(0)} minutes`);
      if (task.dependencies.length > 0) {
        console.log(`      Depends on: ${task.dependencies.join(", ")}`);
      }
    }
    console.log();
  }

  // Version control info
  if (result.versionControl && result.versionControl.branch !== "unknown") {
    console.log(`${c.cyan}${c.bold}🔀 VERSION CONTROL:${c.reset}`);
    console.log(`   Branch: ${result.versionControl.branch}`);
    console.log(`   Commit: ${result.versionControl.commit.substring(0, 8)}`);
    console.log(`   Changes: ${result.versionControl.changes.length} file(s)`);
    if (result.versionControl.conflicts.length > 0) {
      console.log(`   ${c.red}Conflicts: ${result.versionControl.conflicts.length}${c.reset}`);
    }
    console.log();
  }

  // Immediate fixes
  if (result.immediateFixes.length > 0) {
    console.log(`${c.yellow}${c.bold}🔧 IMMEDIATE FIXES AVAILABLE:${c.reset}`);
    for (const fix of result.immediateFixes) {
      console.log(`   • ${fix.description}`);
      console.log(`     File: ${fix.file}`);
      console.log(`     Confidence: ${(fix.confidence * 100).toFixed(0)}%`);
    }
    console.log();
  }

  // Future plan
  if (result.futurePlan && result.futurePlan.tasks.length > 0) {
    console.log(`${c.cyan}${c.bold}📅 FUTURE PLAN:${c.reset}`);
    console.log(`   Phase: ${result.futurePlan.phase}`);
    console.log(`   Tasks: ${result.futurePlan.tasks.length}`);
    console.log(`   Milestones: ${result.futurePlan.milestones.length}`);
    if (result.futurePlan.risks.length > 0) {
      console.log(`   ${c.yellow}Risks: ${result.futurePlan.risks.length}${c.reset}`);
    }
    console.log();
  }

  // Recommendations
  if (result.recommendations.length > 0) {
    console.log(`${c.cyan}${c.bold}💡 RECOMMENDATIONS:${c.reset}`);
    for (const rec of result.recommendations) {
      console.log(`   • ${rec}`);
    }
    console.log();
  }
}

function askToApplyFixes(fixCount) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    rl.question(`${c.yellow}Apply ${fixCount} immediate fix(es)? (y/n): ${c.reset}`, (answer) => {
      rl.close();
      resolve(answer.toLowerCase() === "y" || answer.toLowerCase() === "yes");
    });
  });
}

module.exports = { runPromptFirewall };
