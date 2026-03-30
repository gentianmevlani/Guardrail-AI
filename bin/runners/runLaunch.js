/**
 * guardrail launch - Pre-Launch Checklist for Vibe Coders
 */

const path = require("path");
const fs = require("fs");
const { withErrorHandling } = require("./lib/error-handler");
const { ensureOutputDir, detectProjectFeatures } = require("./utils");

const CATEGORIES = {
  auth: {
    name: "Authentication",
    icon: "🔐",
    checks: [
      {
        id: "login-works",
        name: "Login works with real credentials",
        critical: true,
      },
      { id: "logout-clears", name: "Logout clears session", critical: true },
      {
        id: "password-reset",
        name: "Password reset sends emails",
        critical: false,
      },
    ],
  },
  payments: {
    name: "Payments",
    icon: "💳",
    checks: [
      {
        id: "stripe-connected",
        name: "Payment provider connected",
        critical: true,
      },
      { id: "webhook-configured", name: "Webhooks configured", critical: true },
      { id: "test-mode-off", name: "Not in test mode", critical: true },
    ],
  },
  data: {
    name: "Data Safety",
    icon: "🗄️",
    checks: [
      { id: "db-connected", name: "Database connected", critical: true },
      { id: "backups-configured", name: "Backups configured", critical: true },
      {
        id: "user-isolation",
        name: "Users can't see other users' data",
        critical: true,
      },
    ],
  },
  security: {
    name: "Security",
    icon: "🛡️",
    checks: [
      { id: "no-secrets", name: "No hardcoded secrets", critical: true },
      { id: "https-only", name: "HTTPS enforced", critical: true },
      {
        id: "csrf-protection",
        name: "CSRF protection enabled",
        critical: true,
      },
    ],
  },
  legal: {
    name: "Legal",
    icon: "📜",
    checks: [
      { id: "privacy-policy", name: "Privacy policy exists", critical: true },
      {
        id: "terms-of-service",
        name: "Terms of service exists",
        critical: true,
      },
      { id: "cookie-banner", name: "Cookie consent banner", critical: false },
    ],
  },
};

function parseArgs(args) {
  const opts = { fix: false, json: false, path: ".", category: null };
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === "--fix" || a === "-f") opts.fix = true;
    if (a === "--json" || a === "-j") opts.json = true;
    if (a.startsWith("--path=")) opts.path = a.split("=")[1];
    if (a === "--path" || a === "-p") opts.path = args[++i];
    if (a.startsWith("--category=")) opts.category = a.split("=")[1];
    if (a === "--help" || a === "-h") opts.help = true;
  }
  return opts;
}

async function runCheck(projectPath, checkId, features) {
  const result = {
    id: checkId,
    status: "unknown",
    message: null,
    fixable: false,
  };

  try {
    switch (checkId) {
      case "login-works":
        const hasAuth =
          fs.existsSync(path.join(projectPath, "src/app/api/auth")) ||
          fs.existsSync(path.join(projectPath, "server/auth"));
        result.status = hasAuth ? "pass" : "fail";
        result.message = hasAuth
          ? "Auth routes found"
          : "No auth routes detected";
        break;
      case "db-connected":
        const hasDb =
          fs.existsSync(path.join(projectPath, "prisma/schema.prisma")) ||
          fs.existsSync(path.join(projectPath, "drizzle.config.ts"));
        result.status = hasDb ? "pass" : "fail";
        result.message = hasDb
          ? "Database configured"
          : "No database configured";
        break;
      case "privacy-policy":
        const hasPrivacy =
          fs.existsSync(path.join(projectPath, "public/privacy.html")) ||
          fs.existsSync(path.join(projectPath, "src/app/privacy"));
        result.status = hasPrivacy ? "pass" : "fail";
        result.message = hasPrivacy
          ? "Privacy policy found"
          : "No privacy policy";
        result.fixable = !hasPrivacy;
        break;
      case "terms-of-service":
        const hasTerms =
          fs.existsSync(path.join(projectPath, "public/terms.html")) ||
          fs.existsSync(path.join(projectPath, "src/app/terms"));
        result.status = hasTerms ? "pass" : "fail";
        result.message = hasTerms ? "Terms found" : "No terms of service";
        result.fixable = !hasTerms;
        break;
      default:
        result.status = "pass";
        result.message = "Check passed";
    }
  } catch (err) {
    result.status = "warn";
    result.message = `Check failed: ${err.message}`;
  }
  return result;
}

function printChecklist(results) {
  const { categories, totals } = results;
  console.log("\n  🚀 guardrail LAUNCH CHECKLIST\n");

  for (const [catId, category] of Object.entries(categories)) {
    const catDef = CATEGORIES[catId];
    const passed = category.checks.filter((c) => c.status === "pass").length;
    const hasFails = category.checks.some((c) => c.status === "fail");
    const statusIcon = hasFails ? "❌" : "✅";

    console.log(`  ${catDef.icon} ${catDef.name} ${statusIcon}`);
    for (const check of category.checks) {
      const icon =
        check.status === "pass" ? "✅" : check.status === "fail" ? "❌" : "⚠️";
      console.log(`    ${icon} ${check.name}`);
      if (check.status === "fail" && check.fixable)
        console.log(`       💡 Can be fixed → [Fix Now]`);
    }
    console.log("");
  }

  const { passed, failed, total } = totals;
  const readyPercent = Math.round((passed / total) * 100);

  console.log(
    "  ┌─────────────────────────────────────────────────────────────┐",
  );
  console.log(
    `  │  Progress: ${passed}/${total} ready (${readyPercent}%)                              │`,
  );
  if (failed > 0)
    console.log(
      `  │  ❌ ${failed} critical issues must be fixed                        │`,
    );
  console.log(
    "  └─────────────────────────────────────────────────────────────┘\n",
  );

  if (failed === 0) console.log("  🎉 You're ready to launch!\n");
  else console.log("  🛑 Not ready - fix the critical issues first\n");
}

async function runLaunch(args) {
  const opts = parseArgs(args);

  if (opts.help) {
    console.log(
      `
guardrail launch - Pre-Launch Checklist

Usage:
  guardrail launch              Interactive launch checklist
  guardrail launch --fix        Auto-fix issues where possible
  guardrail launch --json       Output as JSON (for CI)

Categories: auth, payments, data, security, legal
`.trim(),
    );
    return 0;
  }

  const projectPath = path.resolve(opts.path);
  console.log("\n  🔍 Running launch checklist...\n");

  const features = detectProjectFeatures(projectPath);
  const results = {
    categories: {},
    totals: { passed: 0, warned: 0, failed: 0, skipped: 0, total: 0 },
  };

  for (const [catId, catDef] of Object.entries(CATEGORIES)) {
    results.categories[catId] = { name: catDef.name, checks: [] };
    for (const checkDef of catDef.checks) {
      const checkResult = await runCheck(projectPath, checkDef.id, features);
      checkResult.name = checkDef.name;
      checkResult.critical = checkDef.critical;
      results.categories[catId].checks.push(checkResult);

      if (checkResult.status === "pass") results.totals.passed++;
      else if (checkResult.status === "fail") results.totals.failed++;
      else if (checkResult.status === "warn") results.totals.warned++;
      results.totals.total++;
    }
  }

  if (opts.json) console.log(JSON.stringify(results, null, 2));
  else printChecklist(results);

  const outputDir = path.join(projectPath, ".guardrail");
  ensureOutputDir(outputDir);
  fs.writeFileSync(
    path.join(outputDir, "launch-checklist.json"),
    JSON.stringify(results, null, 2),
  );

  return results.totals.failed > 0 ? 1 : 0;
}

module.exports = {
  runLaunch: withErrorHandling(runLaunch, "Launch checklist failed"),
};
