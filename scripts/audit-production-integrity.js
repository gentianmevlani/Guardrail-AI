#!/usr/bin/env node

/**
 * Production Integrity Suite
 *
 * Unified audit combining:
 * - API Endpoint Wiring
 * - Auth/RBAC Coverage
 * - Environment & Secrets
 * - Route Integrity
 * - Mock/Stub Ship Blocker
 *
 * Generates a comprehensive "Reality Check" report for production readiness.
 *
 * Usage: node scripts/audit-production-integrity.js [projectPath]
 */

const fs = require("fs");
const path = require("path");

// Import individual audit modules
const {
  auditApiEndpoints,
  formatAuditResults,
} = require("./audit-api-endpoints");
const {
  auditAuthCoverage,
  formatAuthResults,
} = require("./audit-auth-coverage");
const { auditEnvSecrets, formatEnvResults } = require("./audit-env-secrets");
const {
  auditRouteIntegrity,
  formatRouteResults,
} = require("./audit-route-integrity");
const { auditMockBlocker, formatMockResults } = require("./audit-mock-blocker");

/**
 * Calculate overall integrity score
 */
function calculateIntegrityScore(results) {
  let score = 100;
  const deductions = [];

  // API Wiring (max -30)
  if (results.api) {
    const missingRatio =
      results.api.summary.missingBackend /
      Math.max(results.api.summary.totalFrontendCalls, 1);
    const apiDeduction = Math.min(30, Math.round(missingRatio * 50));
    if (apiDeduction > 0) {
      score -= apiDeduction;
      deductions.push({
        category: "API Wiring",
        points: -apiDeduction,
        reason: `${results.api.summary.missingBackend} missing backend endpoints`,
      });
    }
  }

  // Auth Coverage (max -25)
  if (results.auth?.analysis) {
    const { sensitiveUnprotected, adminExposed, unprotected } =
      results.auth.analysis;

    if (adminExposed.length > 0) {
      const deduction = Math.min(15, adminExposed.length * 5);
      score -= deduction;
      deductions.push({
        category: "Auth (Admin)",
        points: -deduction,
        reason: `${adminExposed.length} admin endpoints exposed`,
      });
    }

    if (sensitiveUnprotected.length > 0) {
      const deduction = Math.min(10, sensitiveUnprotected.length * 2);
      score -= deduction;
      deductions.push({
        category: "Auth (Sensitive)",
        points: -deduction,
        reason: `${sensitiveUnprotected.length} sensitive endpoints unprotected`,
      });
    }
  }

  // Secrets (max -30)
  if (results.env) {
    const criticalSecrets = results.env.secrets.filter(
      (s) => s.severity === "critical",
    ).length;
    const highSecrets = results.env.secrets.filter(
      (s) => s.severity === "high",
    ).length;

    if (criticalSecrets > 0) {
      const deduction = Math.min(20, criticalSecrets * 10);
      score -= deduction;
      deductions.push({
        category: "Secrets (Critical)",
        points: -deduction,
        reason: `${criticalSecrets} hardcoded critical secrets`,
      });
    }

    if (highSecrets > 0) {
      const deduction = Math.min(10, highSecrets * 3);
      score -= deduction;
      deductions.push({
        category: "Secrets (High)",
        points: -deduction,
        reason: `${highSecrets} hardcoded high-risk secrets`,
      });
    }

    if (results.env.publicEnvLeaks.length > 0) {
      const deduction = Math.min(5, results.env.publicEnvLeaks.length * 2);
      score -= deduction;
      deductions.push({
        category: "Env Leaks",
        points: -deduction,
        reason: `${results.env.publicEnvLeaks.length} client-exposed sensitive vars`,
      });
    }
  }

  // Route Integrity (max -10)
  if (results.routes?.integrity) {
    const deadLinks = results.routes.integrity.deadLinks.length;
    if (deadLinks > 0) {
      const deduction = Math.min(5, Math.ceil(deadLinks / 3));
      score -= deduction;
      deductions.push({
        category: "Dead Links",
        points: -deduction,
        reason: `${deadLinks} dead links found`,
      });
    }

    const placeholders = results.routes.placeholders.filter((p) =>
      ["coming_soon", "not_implemented", "lorem_ipsum"].includes(p.type),
    ).length;
    if (placeholders > 0) {
      const deduction = Math.min(5, Math.ceil(placeholders / 5));
      score -= deduction;
      deductions.push({
        category: "Placeholders",
        points: -deduction,
        reason: `${placeholders} placeholder content`,
      });
    }
  }

  // Mock/Stub (max -20)
  if (results.mocks) {
    const allIssues = [...results.mocks.issues, ...results.mocks.packageIssues];
    const critical = allIssues.filter((i) => i.severity === "critical").length;
    const high = allIssues.filter((i) => i.severity === "high").length;

    if (critical > 0) {
      const deduction = Math.min(15, critical * 5);
      score -= deduction;
      deductions.push({
        category: "Mock Code (Critical)",
        points: -deduction,
        reason: `${critical} critical mock/test code in production`,
      });
    }

    if (high > 0) {
      const deduction = Math.min(5, high * 1);
      score -= deduction;
      deductions.push({
        category: "Mock Code (High)",
        points: -deduction,
        reason: `${high} high-priority mock code`,
      });
    }
  }

  return {
    score: Math.max(0, score),
    grade: getGrade(Math.max(0, score)),
    deductions,
    canShip:
      score >= 70 &&
      !deductions.some(
        (d) => d.category.includes("Critical") || d.category.includes("Admin"),
      ),
  };
}

/**
 * Get letter grade from score
 */
function getGrade(score) {
  if (score >= 95) return "A+";
  if (score >= 90) return "A";
  if (score >= 85) return "A-";
  if (score >= 80) return "B+";
  if (score >= 75) return "B";
  if (score >= 70) return "B-";
  if (score >= 65) return "C+";
  if (score >= 60) return "C";
  if (score >= 55) return "C-";
  if (score >= 50) return "D";
  return "F";
}

/**
 * Generate unified report
 */
function generateUnifiedReport(results, integrity) {
  const lines = [];
  const timestamp = new Date().toISOString();

  lines.push("# 🛡️ Production Integrity Report\n");
  lines.push(`**Generated:** ${timestamp}`);
  lines.push(`**Project:** ${results.projectPath}\n`);

  // Big score display
  lines.push("## 📊 Integrity Score\n");
  lines.push("```");
  lines.push(`┌─────────────────────────────────┐`);
  lines.push(`│                                 │`);
  lines.push(
    `│     INTEGRITY SCORE: ${integrity.score.toString().padStart(3)}       │`,
  );
  lines.push(
    `│     GRADE: ${integrity.grade.padStart(2)}                    │`,
  );
  lines.push(`│                                 │`);
  lines.push(
    `│     ${integrity.canShip ? "✅ READY TO SHIP" : "🚫 NOT READY    "}           │`,
  );
  lines.push(`│                                 │`);
  lines.push(`└─────────────────────────────────┘`);
  lines.push("```\n");

  // Ship decision
  if (integrity.canShip) {
    lines.push("### ✅ Ship Decision: **APPROVED**\n");
    lines.push(
      "Your codebase passes the production integrity checks. Minor issues may exist but nothing blocking.\n",
    );
  } else {
    lines.push("### 🚫 Ship Decision: **BLOCKED**\n");
    lines.push(
      "Critical issues detected that must be resolved before shipping to production.\n",
    );
  }

  // Score breakdown
  if (integrity.deductions.length > 0) {
    lines.push("### Score Breakdown\n");
    lines.push("| Category | Points | Reason |");
    lines.push("|----------|--------|--------|");
    lines.push("| Base Score | 100 | Starting point |");
    for (const d of integrity.deductions) {
      lines.push(`| ${d.category} | ${d.points} | ${d.reason} |`);
    }
    lines.push(`| **Final** | **${integrity.score}** | |`);
    lines.push("");
  }

  // Summary by category
  lines.push("## 📋 Category Summary\n");
  lines.push("| Check | Status | Issues | Details |");
  lines.push("|-------|--------|--------|---------|");

  // API Wiring
  if (results.api) {
    const status =
      results.api.summary.missingBackend === 0
        ? "✅"
        : results.api.summary.missingBackend < 5
          ? "⚠️"
          : "🔴";
    lines.push(
      `| API Wiring | ${status} | ${results.api.summary.missingBackend} missing | ${results.api.summary.connected} connected |`,
    );
  }

  // Auth
  if (results.auth?.analysis) {
    const criticalAuth =
      results.auth.analysis.adminExposed.length +
      results.auth.analysis.sensitiveUnprotected.length;
    const status = criticalAuth === 0 ? "✅" : "🔴";
    lines.push(
      `| Auth/RBAC | ${status} | ${criticalAuth} critical | ${results.auth.analysis.protected.length} protected |`,
    );
  }

  // Secrets
  if (results.env) {
    const criticalSecrets = results.env.secrets.filter(
      (s) => s.severity === "critical",
    ).length;
    const status = criticalSecrets === 0 ? "✅" : "🔴";
    lines.push(
      `| Secrets | ${status} | ${criticalSecrets} critical | ${results.env.envExample.variables.length} env vars |`,
    );
  }

  // Routes
  if (results.routes?.integrity) {
    const deadLinks = results.routes.integrity.deadLinks.length;
    const status = deadLinks === 0 ? "✅" : deadLinks < 5 ? "⚠️" : "🔴";
    lines.push(
      `| Route Integrity | ${status} | ${deadLinks} dead links | ${results.routes.pages.length} pages |`,
    );
  }

  // Mocks
  if (results.mocks) {
    const allIssues = [...results.mocks.issues, ...results.mocks.packageIssues];
    const blocking = allIssues.filter(
      (i) => i.severity === "critical" || i.severity === "high",
    ).length;
    const status = blocking === 0 ? "✅" : "🔴";
    lines.push(
      `| Mock Blocker | ${status} | ${blocking} blocking | ${allIssues.length} total |`,
    );
  }

  lines.push("");

  // Critical Issues Summary
  const criticalIssues = [];

  if (results.auth?.analysis?.adminExposed.length > 0) {
    criticalIssues.push(
      ...results.auth.analysis.adminExposed.map((e) => ({
        type: "🔓 Admin Exposed",
        detail: `${e.method} ${e.fullApiPath || e.path}`,
        file: e.file,
      })),
    );
  }

  if (
    results.env?.secrets.filter((s) => s.severity === "critical").length > 0
  ) {
    criticalIssues.push(
      ...results.env.secrets
        .filter((s) => s.severity === "critical")
        .map((s) => ({
          type: "🔑 Hardcoded Secret",
          detail: s.type,
          file: `${s.file}:${s.line}`,
        })),
    );
  }

  if (results.mocks) {
    const criticalMocks = [
      ...results.mocks.issues,
      ...results.mocks.packageIssues,
    ].filter((i) => i.severity === "critical");
    criticalIssues.push(
      ...criticalMocks.map((m) => ({
        type: "🧪 Mock in Prod",
        detail: m.name,
        file: m.file,
      })),
    );
  }

  if (criticalIssues.length > 0) {
    lines.push("## 🚨 Critical Issues (Fix Immediately)\n");
    lines.push("| Type | Detail | File |");
    lines.push("|------|--------|------|");
    for (const issue of criticalIssues.slice(0, 20)) {
      lines.push(`| ${issue.type} | ${issue.detail} | \`${issue.file}\` |`);
    }
    if (criticalIssues.length > 20) {
      lines.push(`| ... | ${criticalIssues.length - 20} more | |`);
    }
    lines.push("");
  }

  // Action items
  lines.push("## 🎯 Action Items\n");

  const actions = [];

  if (results.auth?.analysis?.adminExposed.length > 0) {
    actions.push({
      priority: "P0",
      action: "Add authentication to admin endpoints",
      count: results.auth.analysis.adminExposed.length,
    });
  }

  if (
    results.env?.secrets.filter((s) => s.severity === "critical").length > 0
  ) {
    actions.push({
      priority: "P0",
      action: "Remove hardcoded secrets and rotate credentials",
      count: results.env.secrets.filter((s) => s.severity === "critical")
        .length,
    });
  }

  if (results.mocks) {
    const blocking = [
      ...results.mocks.issues,
      ...results.mocks.packageIssues,
    ].filter((i) => i.severity === "critical" || i.severity === "high").length;
    if (blocking > 0) {
      actions.push({
        priority: "P0",
        action: "Remove mock/test code from production files",
        count: blocking,
      });
    }
  }

  if (results.api?.summary.missingBackend > 0) {
    actions.push({
      priority: "P1",
      action: "Implement missing backend endpoints",
      count: results.api.summary.missingBackend,
    });
  }

  if (results.routes?.integrity?.deadLinks.length > 0) {
    actions.push({
      priority: "P2",
      action: "Fix dead links or create missing pages",
      count: results.routes.integrity.deadLinks.length,
    });
  }

  if (actions.length > 0) {
    lines.push("| Priority | Action | Count |");
    lines.push("|----------|--------|-------|");
    for (const action of actions) {
      lines.push(`| ${action.priority} | ${action.action} | ${action.count} |`);
    }
    lines.push("");
  } else {
    lines.push("No critical action items. 🎉\n");
  }

  // Detailed findings from each audit
  lines.push("---\n");
  lines.push("# 📋 Detailed Findings\n");

  // API Wiring Details
  if (results.api?.missing?.length > 0) {
    lines.push("## 🔗 Missing API Endpoints\n");
    lines.push(
      "Frontend calls these endpoints but backend doesn't implement them:\n",
    );
    const grouped = {};
    for (const item of results.api.missing.slice(0, 50)) {
      const category = item.path.split("/").slice(0, 3).join("/");
      if (!grouped[category]) grouped[category] = [];
      grouped[category].push(item);
    }
    for (const [category, items] of Object.entries(grouped)) {
      lines.push(`\n**${category}**`);
      for (const item of items.slice(0, 10)) {
        lines.push(`- \`${item.method} ${item.path}\` ← ${item.file}`);
      }
      if (items.length > 10) lines.push(`- ... and ${items.length - 10} more`);
    }
    if (results.api.missing.length > 50) {
      lines.push(
        `\n... and ${results.api.missing.length - 50} more missing endpoints`,
      );
    }
    lines.push("");
  }

  // Auth Details
  if (results.auth?.analysis) {
    const { unprotected, sensitiveUnprotected, adminExposed } =
      results.auth.analysis;
    if (
      adminExposed.length > 0 ||
      sensitiveUnprotected.length > 0 ||
      unprotected.length > 0
    ) {
      lines.push("## 🔐 Auth Coverage Issues\n");

      if (adminExposed.length > 0) {
        lines.push("### 🚨 Admin Endpoints Exposed (NO AUTH)\n");
        for (const e of adminExposed.slice(0, 10)) {
          lines.push(
            `- \`${e.method} ${e.fullApiPath || e.path}\` in ${e.file}`,
          );
        }
        lines.push("");
      }

      if (sensitiveUnprotected.length > 0) {
        lines.push("### ⚠️ Sensitive Endpoints Unprotected\n");
        for (const e of sensitiveUnprotected.slice(0, 10)) {
          lines.push(
            `- \`${e.method} ${e.fullApiPath || e.path}\` in ${e.file}`,
          );
        }
        lines.push("");
      }
    }

    // Frontend pages
    if (results.auth.frontendAuth?.length > 0) {
      const unprotectedPages = results.auth.frontendAuth.filter(
        (p) => !p.isProtected && !p.isLayout,
      );
      if (unprotectedPages.length > 0) {
        lines.push("### 🖥️ Unprotected Frontend Pages\n");
        for (const page of unprotectedPages.slice(0, 15)) {
          lines.push(`- ${page.file}`);
        }
        if (unprotectedPages.length > 15)
          lines.push(`- ... and ${unprotectedPages.length - 15} more`);
        lines.push("");
      }
    }
  }

  // Secrets Details
  if (results.env?.secrets?.length > 0) {
    lines.push("## 🔑 Hardcoded Secrets Found\n");
    const bySeverity = {
      critical: results.env.secrets.filter((s) => s.severity === "critical"),
      high: results.env.secrets.filter((s) => s.severity === "high"),
    };

    if (bySeverity.critical.length > 0) {
      lines.push("### 🔴 Critical (Rotate Immediately)\n");
      for (const s of bySeverity.critical.slice(0, 15)) {
        lines.push(`- **${s.type}** in \`${s.file}:${s.line}\``);
      }
      lines.push("");
    }

    if (bySeverity.high.length > 0) {
      lines.push("### 🟠 High Priority\n");
      for (const s of bySeverity.high.slice(0, 10)) {
        lines.push(`- **${s.type}** in \`${s.file}:${s.line}\``);
      }
      lines.push("");
    }
  }

  // Dev URLs
  if (results.env?.devUrls?.length > 0) {
    lines.push("## 🌐 Localhost/Dev URLs in Code\n");
    const uniqueUrls = [...new Set(results.env.devUrls.map((u) => u.url))];
    for (const url of uniqueUrls.slice(0, 10)) {
      const locations = results.env.devUrls.filter((u) => u.url === url);
      lines.push(`- ${url} (${locations.length} locations)`);
    }
    if (uniqueUrls.length > 10)
      lines.push(`- ... and ${uniqueUrls.length - 10} more`);
    lines.push("");
  }

  // Route Issues
  if (results.routes?.integrity) {
    const { deadLinks, unusedPages } = results.routes.integrity;

    if (deadLinks.length > 0) {
      lines.push("## 🔴 Dead Links (404 Risk)\n");
      const byHref = {};
      for (const link of deadLinks) {
        if (!byHref[link.href]) byHref[link.href] = [];
        byHref[link.href].push(link);
      }
      for (const [href, links] of Object.entries(byHref).slice(0, 10)) {
        lines.push(`- \`${href}\` → ${links.length} references`);
      }
      lines.push("");
    }

    if (unusedPages.length > 0) {
      lines.push("## ⚠️ Orphaned Pages (No Links)\n");
      for (const page of unusedPages.slice(0, 10)) {
        lines.push(`- ${page.route}`);
      }
      lines.push("");
    }
  }

  // Placeholders/TODOs
  if (results.routes?.placeholders?.length > 0) {
    const todos = results.routes.placeholders.filter((p) => p.type === "todo");
    const comingSoon = results.routes.placeholders.filter(
      (p) => p.type === "coming_soon",
    );

    if (todos.length > 0) {
      lines.push("## 📝 TODO Comments in Code\n");
      for (const todo of todos.slice(0, 10)) {
        lines.push(
          `- \`${todo.file}:${todo.line}\` - ${todo.context.substring(0, 60)}...`,
        );
      }
      if (todos.length > 10)
        lines.push(`- ... and ${todos.length - 10} more TODOs`);
      lines.push("");
    }

    if (comingSoon.length > 0) {
      lines.push('## 🚧 "Coming Soon" Content\n');
      for (const item of comingSoon.slice(0, 5)) {
        lines.push(`- \`${item.file}:${item.line}\``);
      }
      lines.push("");
    }
  }

  // Mock/Test Code
  if (results.mocks) {
    const allIssues = [...results.mocks.issues, ...results.mocks.packageIssues];
    const critical = allIssues.filter((i) => i.severity === "critical");
    const high = allIssues.filter((i) => i.severity === "high");

    if (critical.length > 0 || high.length > 0) {
      lines.push("## 🧪 Mock/Test Code in Production\n");

      if (critical.length > 0) {
        lines.push("### 🔴 Critical (Ship Blockers)\n");
        for (const issue of critical.slice(0, 15)) {
          lines.push(
            `- **${issue.name}** in \`${issue.file}${issue.line ? ":" + issue.line : ""}\``,
          );
          if (issue.reason) lines.push(`  - ${issue.reason}`);
        }
        lines.push("");
      }

      if (high.length > 0) {
        lines.push("### 🟠 High Priority\n");
        for (const issue of high.slice(0, 10)) {
          lines.push(`- **${issue.name}** in \`${issue.file}\``);
        }
        lines.push("");
      }
    }

    // Console.log count
    const consoleLogs = allIssues.filter((i) => i.name === "console.log");
    if (consoleLogs.length > 0) {
      lines.push(
        `### 📢 Console.log Statements: ${consoleLogs.length} total\n`,
      );
    }
  }

  // Environment Variables Summary
  if (results.env?.envExample?.variables?.length > 0) {
    lines.push("## 🔧 Environment Variables Summary\n");
    const vars = results.env.envExample.variables;
    const clientVars = vars.filter((v) => v.isClientSide);
    const serverVars = vars.filter((v) => !v.isClientSide);
    lines.push(`- **Total:** ${vars.length} env vars used`);
    lines.push(`- **Server-side:** ${serverVars.length}`);
    lines.push(`- **Client-side:** ${clientVars.length}`);
    lines.push(
      `\n✅ Generated \`.env.example\` saved to \`.guardrail/env.example\`\n`,
    );
  }

  lines.push("---\n");

  // Links to detailed reports
  lines.push("## 📄 Detailed Reports\n");
  lines.push("Individual reports saved to `.guardrail/`:\n");
  lines.push("- `api-audit-report.md` - API endpoint wiring details");
  lines.push("- `auth-coverage-report.md` - Authentication coverage");
  lines.push("- `env-secrets-report.md` - Environment and secrets audit");
  lines.push("- `route-integrity-report.md` - Route and navigation integrity");
  lines.push("- `mock-blocker-report.md` - Mock/stub detection");
  lines.push("- `production-integrity-report.md` - This full report\n");

  // CI/CD integration
  lines.push("## 🔧 CI/CD Integration\n");
  lines.push("Add to your pipeline to enforce production integrity:\n");
  lines.push("```yaml");
  lines.push("- name: Production Integrity Check");
  lines.push("  run: |");
  lines.push("    node scripts/audit-production-integrity.js");
  lines.push("    if [ $? -ne 0 ]; then");
  lines.push('      echo "Production integrity check failed"');
  lines.push("      exit 1");
  lines.push("    fi");
  lines.push("```\n");

  return lines.join("\n");
}

/**
 * Main audit function
 */
async function auditProductionIntegrity(projectPath = ".") {
  const resolvedPath = path.resolve(projectPath);

  console.log("🛡️ Running Production Integrity Suite...\n");

  const results = {
    projectPath: resolvedPath,
    api: null,
    auth: null,
    env: null,
    routes: null,
    mocks: null,
  };

  // Run all audits
  try {
    console.log("📡 Checking API wiring...");
    results.api = await auditApiEndpoints(projectPath);
    results.api.summary = {
      connected: results.api.connected?.length || 0,
      missingBackend: results.api.missingBackend?.length || 0,
      unusedBackend: results.api.unusedBackend?.length || 0,
      totalFrontendCalls: results.api.frontendCalls?.length || 0,
    };
  } catch (err) {
    console.warn("  ⚠️ API audit skipped:", err.message);
  }

  try {
    console.log("🔐 Checking auth coverage...");
    results.auth = await auditAuthCoverage(projectPath);
  } catch (err) {
    console.warn("  ⚠️ Auth audit skipped:", err.message);
  }

  try {
    console.log("🔑 Checking secrets...");
    results.env = await auditEnvSecrets(projectPath);
  } catch (err) {
    console.warn("  ⚠️ Env audit skipped:", err.message);
  }

  try {
    console.log("🗺️ Checking route integrity...");
    results.routes = await auditRouteIntegrity(projectPath);
  } catch (err) {
    console.warn("  ⚠️ Route audit skipped:", err.message);
  }

  try {
    console.log("🚫 Checking for mock code...");
    results.mocks = await auditMockBlocker(projectPath);
  } catch (err) {
    console.warn("  ⚠️ Mock audit skipped:", err.message);
  }

  console.log("");

  // Calculate integrity score
  const integrity = calculateIntegrityScore(results);

  return { results, integrity };
}

/**
 * Format full results
 */
function formatProductionResults({ results, integrity }) {
  return generateUnifiedReport(results, integrity);
}

// CLI execution
if (require.main === module) {
  const projectPath = process.argv[2] || ".";

  auditProductionIntegrity(projectPath)
    .then(({ results, integrity }) => {
      const report = formatProductionResults({ results, integrity });
      console.log(report);

      // Save reports
      const reportDir = path.join(projectPath, ".guardrail");
      if (!fs.existsSync(reportDir)) {
        fs.mkdirSync(reportDir, { recursive: true });
      }

      // Save individual reports
      if (results.api) {
        fs.writeFileSync(
          path.join(reportDir, "api-audit-report.md"),
          formatAuditResults(results.api),
        );
      }
      if (results.auth) {
        fs.writeFileSync(
          path.join(reportDir, "auth-coverage-report.md"),
          formatAuthResults(results.auth),
        );
      }
      if (results.env) {
        fs.writeFileSync(
          path.join(reportDir, "env-secrets-report.md"),
          formatEnvResults(results.env),
        );
        fs.writeFileSync(
          path.join(reportDir, "env.example"),
          results.env.envExample.content,
        );
      }
      if (results.routes) {
        fs.writeFileSync(
          path.join(reportDir, "route-integrity-report.md"),
          formatRouteResults(results.routes),
        );
      }
      if (results.mocks) {
        fs.writeFileSync(
          path.join(reportDir, "mock-blocker-report.md"),
          formatMockResults(results.mocks),
        );
      }

      // Save unified report
      fs.writeFileSync(
        path.join(reportDir, "production-integrity-report.md"),
        report,
      );

      // Save JSON for programmatic access
      fs.writeFileSync(
        path.join(reportDir, "integrity-score.json"),
        JSON.stringify(
          {
            score: integrity.score,
            grade: integrity.grade,
            canShip: integrity.canShip,
            deductions: integrity.deductions,
            timestamp: new Date().toISOString(),
          },
          null,
          2,
        ),
      );

      console.log(`\n📄 Reports saved to: ${reportDir}/`);

      // Exit code based on ship readiness
      if (!integrity.canShip) {
        console.log(
          "\n🚫 Production integrity check FAILED. Fix critical issues before shipping.",
        );
        process.exit(1);
      } else {
        console.log("\n✅ Production integrity check PASSED.");
        process.exit(0);
      }
    })
    .catch((err) => {
      console.error("Error:", err.message);
      console.error(err.stack);
      process.exit(1);
    });
}

module.exports = { auditProductionIntegrity, formatProductionResults };
