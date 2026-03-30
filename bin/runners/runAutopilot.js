/**
 * guardrail autopilot - Continuous Protection for Vibe Coders
 *
 * Usage:
 *   guardrail autopilot              Show status and setup wizard
 *   guardrail autopilot enable       Enable autopilot for current repo
 *   guardrail autopilot disable      Disable autopilot
 *   guardrail autopilot status       Show current status
 *   guardrail autopilot digest       Preview weekly digest
 */

const path = require("path");
const fs = require("fs");
const { execSync } = require("child_process");
const { withErrorHandling } = require("./lib/error-handler");
const { checkEntitlement } = require("./lib/auth");
const { generateFixPacksFromScan, loadCachedFixPacks } = require("./runFixPacks");
const { emitAutopilotAction } = require("./lib/audit-bridge");

/**
 * Parse command line args
 */
function parseArgs(args) {
  const opts = {
    subcommand: args[0] || "status",
    path: ".",
    slackWebhook: null,
    email: null,
    noAutoFix: false,
    noDeployBlock: false,
    noDigest: false,
    showPlan: false,
  };

  for (let i = 1; i < args.length; i++) {
    const a = args[i];
    if (a.startsWith("--path=")) opts.path = a.split("=")[1];
    if (a === "--path" || a === "-p") opts.path = args[++i];
    if (a.startsWith("--slack=")) opts.slackWebhook = a.split("=")[1];
    if (a === "--slack") opts.slackWebhook = args[++i];
    if (a.startsWith("--email=")) opts.email = a.split("=")[1];
    if (a === "--email") opts.email = args[++i];
    if (a === "--no-auto-fix") opts.noAutoFix = true;
    if (a === "--no-deploy-block") opts.noDeployBlock = true;
    if (a === "--no-digest") opts.noDigest = true;
    if (a === "--plan" || a === "--show-plan") opts.showPlan = true;
    if (a === "--help" || a === "-h") opts.subcommand = "help";
  }

  return opts;
}

/**
 * Get repo info from git
 */
function getRepoInfo(projectPath) {
  try {
    const remoteUrl = execSync("git remote get-url origin", {
      cwd: projectPath,
      encoding: "utf8",
      stdio: ["pipe", "pipe", "pipe"],
    }).trim();

    // Extract owner/repo from URL
    let match = remoteUrl.match(/github\.com[:/]([^/]+)\/([^/.]+)/);
    if (match) {
      return {
        owner: match[1],
        repo: match[2],
        fullName: `${match[1]}/${match[2]}`,
        remoteUrl,
      };
    }
    return { remoteUrl, fullName: remoteUrl };
  } catch (e) {
    return null;
  }
}

/**
 * Load autopilot config from local file
 */
function loadLocalConfig(projectPath) {
  const configPath = path.join(projectPath, ".guardrail", "autopilot.json");
  if (fs.existsSync(configPath)) {
    try {
      return JSON.parse(fs.readFileSync(configPath, "utf8"));
    } catch (e) {
      return null;
    }
  }
  return null;
}

/**
 * Save autopilot config locally
 */
function saveLocalConfig(projectPath, config) {
  const guardrailDir = path.join(projectPath, ".guardrail");
  if (!fs.existsSync(guardrailDir)) {
    fs.mkdirSync(guardrailDir, { recursive: true });
  }
  fs.writeFileSync(
    path.join(guardrailDir, "autopilot.json"),
    JSON.stringify(config, null, 2),
  );
}

/**
 * Print autopilot status
 */
function printStatus(repoInfo, config) {
  console.log("");
  console.log("  🤖 guardrail AUTOPILOT");
  console.log("");

  if (!repoInfo) {
    console.log("  ⚠️  Not a git repository");
    console.log("  Run this command from a git repository.");
    return;
  }

  console.log(`  📦 Repository: ${repoInfo.fullName}`);
  console.log("");

  if (!config || !config.enabled) {
    console.log("  ⚪ Status: Not enabled");
    console.log("");
    console.log("  Autopilot is not enabled for this repository.");
    console.log("  When enabled, guardrail will:");
    console.log("");
    console.log("    ✅ Watch your repo continuously");
    console.log("    🔧 Auto-fix safe issues (secrets, simple bugs)");
    console.log("    📝 Create PRs for complex issues");
    console.log("    🚫 Block deploys that would break production");
    console.log("    📬 Send weekly reports in plain English");
    console.log("");
    console.log("  To enable: guardrail autopilot enable");
  } else {
    const emoji =
      config.lastScore >= 80 ? "🟢" : config.lastScore >= 50 ? "🟡" : "🔴";
    console.log(`  ${emoji} Status: Enabled`);
    console.log("");
    console.log(
      "  ┌─────────────────────────────────────────────────────────────┐",
    );
    console.log(
      `  │  Health Score: ${config.lastScore || "?"}/100                                   │`,
    );
    console.log(
      `  │  Last Scan: ${config.lastScan ? new Date(config.lastScan).toLocaleDateString() : "Never"}                                      │`,
    );
    console.log(
      "  └─────────────────────────────────────────────────────────────┘",
    );
    console.log("");
    console.log("  Features:");
    console.log(
      `    ${config.autoFixEnabled ? "✅" : "❌"} Auto-fix safe issues`,
    );
    console.log(
      `    ${config.autoPrEnabled ? "✅" : "❌"} Create PRs for fixes`,
    );
    console.log(
      `    ${config.deployBlockingEnabled ? "✅" : "❌"} Block risky deploys`,
    );
    console.log(
      `    ${config.weeklyDigestEnabled ? "✅" : "❌"} Weekly digest emails`,
    );

    if (config.slackWebhookUrl) {
      console.log(`    ✅ Slack notifications enabled`);
    }
    if (config.notificationEmail) {
      console.log(`    ✅ Email: ${config.notificationEmail}`);
    }

    if (config.recentActivity?.length > 0) {
      console.log("");
      console.log("  Recent Activity:");
      for (const activity of config.recentActivity.slice(0, 5)) {
        console.log(`    • ${activity.plainEnglish || activity.type}`);
      }
    }
  }

  console.log("");
}

/**
 * Enable autopilot
 */
async function enableAutopilot(projectPath, opts) {
  const repoInfo = getRepoInfo(projectPath);

  if (!repoInfo) {
    console.log("");
    console.log("  ❌ Not a git repository");
    console.log("  Autopilot requires a git repository with a remote.");
    return 1;
  }

  // Check entitlement
  const ent = await checkEntitlement("autopilot:enable");
  if (!ent.allowed) {
    console.log("");
    console.log(`  🚫 Access Denied: ${ent.reason}`);
    console.log(
      '  Autopilot is a premium feature. Run "guardrail login" or upgrade your plan.',
    );
    console.log("");
    return 2;
  }

  console.log("");
  console.log("  🤖 ENABLING guardrail AUTOPILOT");
  console.log("");
  console.log(`  Repository: ${repoInfo.fullName}`);
  console.log("");

  const config = {
    enabled: true,
    enabledAt: new Date().toISOString(),
    repositoryUrl: repoInfo.remoteUrl,
    fullName: repoInfo.fullName,
    autoFixEnabled: !opts.noAutoFix,
    autoPrEnabled: true,
    deployBlockingEnabled: !opts.noDeployBlock,
    weeklyDigestEnabled: !opts.noDigest,
    slackWebhookUrl: opts.slackWebhook || null,
    notificationEmail: opts.email || null,
  };

  // Save local config
  saveLocalConfig(projectPath, config);

  console.log("  ✅ Autopilot enabled!");
  console.log("");
  console.log("  What happens now:");
  console.log("    1. We'll scan your repo immediately");
  console.log("    2. Safe issues will be auto-fixed");
  console.log("    3. You'll get a PR if we find issues needing review");
  console.log("    4. Deploys will be blocked if they'd break production");
  console.log("    5. You'll get a weekly report every Monday");
  console.log("");

  if (!opts.slackWebhook && !opts.email) {
    console.log("  💡 Tip: Add notifications:");
    console.log("    guardrail autopilot enable --slack=<webhook-url>");
    console.log("    guardrail autopilot enable --email=you@example.com");
    console.log("");
  }

  // Run initial scan and generate fix packs
  console.log("  🔍 Running initial scan...");
  try {
    const { runShip } = require("./runShip");
    await runShip(["--path", projectPath]);
  } catch (e) {
    console.log("  ⚠️  Initial scan completed with warnings");
  }

  // Generate fix packs for autopilot plan
  console.log("  📦 Generating fix packs...");
  try {
    const fixPackData = await generateFixPacksFromScan(projectPath, false);
    if (fixPackData.packs.length > 0) {
      config.fixPacks = fixPackData.packs.map(p => ({
        id: p.id,
        title: p.title,
        severity: p.severity,
        category: p.category,
        findingCount: p.findings.length,
        strategy: p.strategy,
      }));
      saveLocalConfig(projectPath, config);
      console.log(`  ✅ Generated ${fixPackData.packs.length} fix pack(s)`);
    }
  } catch (e) {
    console.log("  ⚠️  Fix pack generation skipped");
  }

  return 0;
}

/**
 * Disable autopilot
 */
async function disableAutopilot(projectPath) {
  const config = loadLocalConfig(projectPath);

  if (!config || !config.enabled) {
    console.log("");
    console.log("  ⚠️  Autopilot is not enabled for this repository.");
    return 0;
  }

  config.enabled = false;
  config.disabledAt = new Date().toISOString();
  saveLocalConfig(projectPath, config);

  console.log("");
  console.log("  🤖 AUTOPILOT DISABLED");
  console.log("");
  console.log("  Your repository will no longer be automatically monitored.");
  console.log("");
  console.log("  You can still run manual scans with: guardrail ship");
  console.log("  Re-enable anytime with: guardrail autopilot enable");
  console.log("");

  return 0;
}

/**
 * Show weekly digest preview
 */
async function showDigest(projectPath) {
  const repoInfo = getRepoInfo(projectPath);
  const config = loadLocalConfig(projectPath);

  console.log("");
  console.log("  📬 WEEKLY DIGEST PREVIEW");
  console.log("");

  if (!repoInfo) {
    console.log("  Not a git repository.");
    return 1;
  }

  console.log(`  Repository: ${repoInfo.fullName}`);
  console.log("");

  // Generate mock digest for preview
  const healthScore = config?.lastScore || 75;
  const emoji = healthScore >= 80 ? "🟢" : healthScore >= 50 ? "🟡" : "🔴";

  console.log(
    "  ┌─────────────────────────────────────────────────────────────┐",
  );
  console.log(
    `  │  ${emoji} Weekly guardrail Report                              │`,
  );
  console.log(
    "  │                                                             │",
  );
  console.log(
    `  │  Health Score: ${healthScore}/100                                      │`,
  );
  console.log(
    "  │                                                             │",
  );
  console.log(
    "  │  This week:                                                 │",
  );
  console.log(
    "  │    • Blocked 0 risky deploys                                │",
  );
  console.log(
    "  │    • Auto-fixed 0 issues                                    │",
  );
  console.log(
    "  │    • 0 issues need your review                              │",
  );
  console.log(
    "  │                                                             │",
  );
  console.log(
    "  │  Action needed:                                             │",
  );
  console.log(
    "  │    (Run 'guardrail ship' to find issues)                    │",
  );
  console.log(
    "  └─────────────────────────────────────────────────────────────┘",
  );
  console.log("");
  console.log(
    "  This preview shows what your weekly digest email will look like.",
  );
  console.log("  Digests are sent every Monday to your configured email.");
  console.log("");

  return 0;
}

/**
 * Show fix pack execution plan
 */
async function showPlan(projectPath) {
  console.log("");
  console.log("  📋 AUTOPILOT EXECUTION PLAN");
  console.log("");

  // Try to load cached fix packs first
  let fixPackData = loadCachedFixPacks(projectPath);
  
  if (!fixPackData) {
    console.log("  Generating fix packs...");
    try {
      fixPackData = await generateFixPacksFromScan(projectPath, false);
    } catch (e) {
      console.log("  ⚠️  Could not generate fix packs");
      console.log("  Run 'guardrail scan' first to identify issues.");
      return 1;
    }
  }

  if (!fixPackData.packs || fixPackData.packs.length === 0) {
    console.log("  ✅ No issues found - nothing to fix!");
    console.log("");
    return 0;
  }

  const SEVERITY_ICONS = {
    critical: "🔴",
    high: "🟠",
    medium: "🟡",
    low: "🔵",
    info: "⚪",
  };

  // Sort packs by severity (highest first) for execution order
  const sortedPacks = [...fixPackData.packs].sort((a, b) => {
    const order = { critical: 0, high: 1, medium: 2, low: 3, info: 4 };
    return order[a.severity] - order[b.severity];
  });

  console.log(`  Execution order (${sortedPacks.length} pack(s)):`);
  console.log("  ─────────────────────────────────────────────────────────────");
  console.log("");

  let step = 1;
  for (const pack of sortedPacks) {
    const icon = SEVERITY_ICONS[pack.severity] || "⚪";
    const autoLabel = pack.strategy === "auto" ? " [AUTO]" : "";
    const reviewLabel = pack.requiresHumanReview ? " [REVIEW]" : "";
    
    console.log(`  ${step}. ${icon} ${pack.id}${autoLabel}${reviewLabel}`);
    console.log(`     ${pack.title}`);
    console.log(`     Strategy: ${pack.strategy} | Files: ${pack.files?.length || 0} | ~${pack.estimatedImpact?.timeEstimateMinutes || 5}min`);
    console.log("");
    step++;
  }

  console.log("  ─────────────────────────────────────────────────────────────");
  console.log("");
  console.log("  Autopilot will execute packs in this order:");
  console.log("    1. Critical → High → Medium → Low severity");
  console.log("    2. Auto-fixable packs first, then guided/manual");
  console.log("    3. Human review required packs last");
  console.log("");
  console.log("  Run 'guardrail fix <pack-id>' to apply a specific pack");
  console.log("  Run 'guardrail fixpacks show <pack-id>' for pack details");
  console.log("");

  return 0;
}

/**
 * Print help
 */
function printHelp() {
  console.log(
    `
guardrail autopilot - Continuous protection for your codebase

Usage:
  guardrail autopilot              Show status and setup info
  guardrail autopilot enable       Enable autopilot for this repo
  guardrail autopilot disable      Disable autopilot
  guardrail autopilot status       Show current status
  guardrail autopilot plan         Show fix pack execution plan
  guardrail autopilot digest       Preview weekly digest

Options:
  --slack=<url>        Slack webhook URL for notifications
  --email=<email>      Email for weekly digest
  --no-auto-fix        Disable auto-fixing of safe issues
  --no-deploy-block    Disable deploy blocking
  --no-digest          Disable weekly digest emails
  --plan               Show fix pack execution plan
  --help, -h           Show this help

What Autopilot Does:
  ✅ Watches your repo continuously
  🔧 Auto-fixes safe issues (exposed secrets, simple bugs)
  📝 Creates PRs for complex issues with AI-generated fixes
  🚫 Blocks deploys that would break production
  📬 Sends weekly reports in plain English

Examples:
  guardrail autopilot enable
  guardrail autopilot enable --slack=https://hooks.slack.com/services/...
  guardrail autopilot enable --email=you@example.com
  guardrail autopilot disable
`.trim(),
  );
}

/**
 * Main autopilot command
 */
async function runAutopilot(args) {
  const opts = parseArgs(args);
  const projectPath = path.resolve(opts.path);

  if (opts.subcommand === "help") {
    printHelp();
    return 0;
  }

  const repoInfo = getRepoInfo(projectPath);
  const config = loadLocalConfig(projectPath);

  switch (opts.subcommand) {
    case "enable":
      return await enableAutopilot(projectPath, opts);

    case "disable":
      return await disableAutopilot(projectPath);

    case "digest":
      return await showDigest(projectPath);

    case "plan":
      return await showPlan(projectPath);

    case "status":
    default:
      if (opts.showPlan) {
        return await showPlan(projectPath);
      }
      printStatus(repoInfo, config);
      return 0;
  }
}

module.exports = {
  runAutopilot: withErrorHandling(runAutopilot, "Autopilot command failed"),
};
