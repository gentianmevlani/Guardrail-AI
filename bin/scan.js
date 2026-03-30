#!/usr/bin/env node

/**
 * guardrail Scan - Free Tier CLI
 *
 * One-command scan with no login required.
 * Delivers instant value: integrity score, blockers, and polished HTML report.
 *
 * Usage: npx guardrail scan [path]
 */

const fs = require("fs");
const path = require("path");

// Colors for terminal output
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
};

const c = colors;

// Free tier limits
const FREE_LIMITS = {
  scansPerDay: 3,
  issuesShownPerCategory: 25,
  reposAllowed: 1,
};

/**
 * Get scan history for rate limiting
 */
function getScanHistory(projectPath) {
  const historyFile = path.join(projectPath, ".guardrail", "scan-history.json");
  try {
    if (fs.existsSync(historyFile)) {
      return JSON.parse(fs.readFileSync(historyFile, "utf8"));
    }
  } catch (e) {}
  return { scans: [], lastScore: null };
}

/**
 * Save scan to history
 */
function saveScanHistory(projectPath, result) {
  const guardrailDir = path.join(projectPath, ".guardrail");
  if (!fs.existsSync(guardrailDir)) {
    fs.mkdirSync(guardrailDir, { recursive: true });
  }

  const historyFile = path.join(guardrailDir, "scan-history.json");
  const history = getScanHistory(projectPath);

  // Keep only today's scans for rate limiting
  const today = new Date().toDateString();
  history.scans = history.scans.filter(
    (s) => new Date(s.timestamp).toDateString() === today,
  );

  // Add new scan
  history.scans.push({
    timestamp: new Date().toISOString(),
    score: result.score,
    grade: result.grade,
    blockers: result.totalBlockers,
  });

  history.lastScore = result.score;
  history.lastScan = new Date().toISOString();

  fs.writeFileSync(historyFile, JSON.stringify(history, null, 2));
  return history;
}

/**
 * Check rate limit
 */
function checkRateLimit(projectPath) {
  const history = getScanHistory(projectPath);
  const today = new Date().toDateString();
  const todayScans = history.scans.filter(
    (s) => new Date(s.timestamp).toDateString() === today,
  );

  return {
    allowed: todayScans.length < FREE_LIMITS.scansPerDay,
    remaining: FREE_LIMITS.scansPerDay - todayScans.length,
    lastScore: history.lastScore,
  };
}

/**
 * Print the header
 */
function printHeader() {
  console.log();
  console.log(`${c.magenta}${c.bold}  🔮 guardrail SCAN${c.reset}`);
  console.log(`${c.dim}  "Where Your Code Lies To You"${c.reset}`);
  console.log();
}

/**
 * Print score box
 */
function printScoreBox(score, grade, canShip) {
  const getColor = (s) => {
    if (s >= 80) return c.green;
    if (s >= 60) return c.blue;
    if (s >= 40) return c.yellow;
    return c.red;
  };

  const scoreColor = getColor(score);
  const verdict = canShip
    ? `${c.bgGreen}${c.bold} ✓ CLEAR TO SHIP ${c.reset}`
    : `${c.bgRed}${c.bold} ✗ NOT READY ${c.reset}`;

  console.log(`  ┌${"─".repeat(44)}┐`);
  console.log(`  │${" ".repeat(44)}│`);
  console.log(
    `  │     ${c.bold}INTEGRITY SCORE:${c.reset} ${scoreColor}${c.bold}${String(score).padStart(3)}${c.reset}${c.dim}/100${c.reset}${" ".repeat(14)}│`,
  );
  console.log(
    `  │     ${c.bold}GRADE:${c.reset} ${scoreColor}${c.bold}${grade.padEnd(2)}${c.reset}${" ".repeat(29)}│`,
  );
  console.log(`  │${" ".repeat(44)}│`);
  console.log(
    `  │     ${verdict}${" ".repeat(Math.max(0, 20 - (canShip ? 16 : 12)))}│`,
  );
  console.log(`  │${" ".repeat(44)}│`);
  console.log(`  └${"─".repeat(44)}┘`);
  console.log();
}

/**
 * Print category summary
 */
function printCategorySummary(counts) {
  console.log(`  ${c.bold}📊 CATEGORY BREAKDOWN${c.reset}`);
  console.log();

  const categories = [
    {
      key: "api",
      label: "API Wiring",
      icon: "🔗",
      getValue: (c) => `${c.missing} missing`,
    },
    {
      key: "auth",
      label: "Auth Coverage",
      icon: "🔐",
      getValue: (c) => `${c.exposed} exposed`,
    },
    {
      key: "secrets",
      label: "Secrets",
      icon: "🔑",
      getValue: (c) => `${c.critical} critical`,
    },
    {
      key: "routes",
      label: "Route Integrity",
      icon: "🗺️",
      getValue: (c) => `${c.deadLinks} dead links`,
    },
    {
      key: "mocks",
      label: "Mock Blocker",
      icon: "🧪",
      getValue: (c) => `${c.critical + c.high} blocking`,
    },
  ];

  for (const cat of categories) {
    const data = counts[cat.key];
    const value = cat.getValue(data);
    const isGood =
      !value.match(/^0 /) &&
      value !== "0 missing" &&
      value !== "0 exposed" &&
      value !== "0 critical" &&
      value !== "0 dead links" &&
      value !== "0 blocking";
    const numValue = parseInt(value);
    const status =
      numValue === 0 ? `${c.green}✓${c.reset}` : `${c.red}✗${c.reset}`;
    const valueColor = numValue === 0 ? c.green : c.red;

    console.log(
      `  ${status} ${cat.icon} ${cat.label.padEnd(16)} ${valueColor}${value}${c.reset}`,
    );
  }
  console.log();
}

/**
 * Print top blockers
 */
function printTopBlockers(findings, limit = 10) {
  const blockers = [];

  // Collect all blockers with priority
  if (findings.hardcodedSecrets?.length) {
    findings.hardcodedSecrets.slice(0, 5).forEach((s) => {
      blockers.push({
        priority: "P0",
        type: "🔑 Secret",
        detail: s.type,
        file: `${s.file}:${s.line}`,
      });
    });
  }

  if (findings.mockCode?.filter((m) => m.severity === "critical").length) {
    findings.mockCode
      .filter((m) => m.severity === "critical")
      .slice(0, 5)
      .forEach((m) => {
        blockers.push({
          priority: "P0",
          type: "🧪 Mock",
          detail: m.name,
          file: m.file,
        });
      });
  }

  if (findings.exposedEndpoints?.length) {
    findings.exposedEndpoints.slice(0, 3).forEach((e) => {
      blockers.push({
        priority: "P0",
        type: "🔐 Auth",
        detail: `${e.method} ${e.path}`,
        file: e.file,
      });
    });
  }

  if (findings.missingApis?.length) {
    findings.missingApis.slice(0, 5).forEach((a) => {
      blockers.push({
        priority: "P1",
        type: "🔗 API",
        detail: `${a.method} ${a.path}`,
        file: a.file,
      });
    });
  }

  if (findings.deadLinks?.length) {
    findings.deadLinks.slice(0, 3).forEach((l) => {
      blockers.push({
        priority: "P2",
        type: "🗺️ Link",
        detail: l.href,
        file: `${l.count} refs`,
      });
    });
  }

  if (blockers.length === 0) {
    console.log(`  ${c.green}${c.bold}✓ No ship blockers detected!${c.reset}`);
    console.log();
    return;
  }

  console.log(
    `  ${c.bold}🚨 TOP SHIP BLOCKERS${c.reset} ${c.dim}(${blockers.length} total)${c.reset}`,
  );
  console.log();

  const shown = blockers.slice(0, limit);
  for (const b of shown) {
    const prioColor =
      b.priority === "P0" ? c.red : b.priority === "P1" ? c.yellow : c.blue;
    console.log(
      `  ${prioColor}${b.priority}${c.reset} ${b.type.padEnd(10)} ${c.dim}${b.detail.substring(0, 30).padEnd(30)}${c.reset} ${c.cyan}${b.file}${c.reset}`,
    );
  }

  if (blockers.length > limit) {
    console.log(
      `  ${c.dim}... and ${blockers.length - limit} more (see report for full list)${c.reset}`,
    );
  }
  console.log();
}

/**
 * Print regression comparison
 */
function printRegression(currentScore, lastScore) {
  if (lastScore === null) return;

  const diff = currentScore - lastScore;
  if (diff === 0) {
    console.log(`  ${c.dim}📈 Score unchanged from last scan${c.reset}`);
  } else if (diff > 0) {
    console.log(
      `  ${c.green}📈 Score improved ${c.bold}+${diff}${c.reset}${c.green} since last scan!${c.reset}`,
    );
  } else {
    console.log(
      `  ${c.red}📉 Score dropped ${c.bold}${diff}${c.reset}${c.red} since last scan${c.reset}`,
    );
  }
  console.log();
}

/**
 * Print upgrade nudge
 */
function printUpgradeNudge(hasBlockers) {
  console.log(`  ${"─".repeat(50)}`);
  console.log();

  if (hasBlockers) {
    console.log(
      `  ${c.yellow}${c.bold}⚡ Want to block merges with these issues?${c.reset}`,
    );
    console.log(
      `  ${c.dim}   Enable CI Gate to fail builds on 🔴 blockers${c.reset}`,
    );
    console.log(
      `  ${c.cyan}   → guardrail gate --help${c.reset} ${c.dim}(Pro required)${c.reset}`,
    );
  } else {
    console.log(`  ${c.green}${c.bold}✓ Looking good!${c.reset}`);
    console.log(
      `  ${c.dim}   Add the guardrail badge to your README:${c.reset}`,
    );
    console.log(`  ${c.cyan}   → guardrail badge${c.reset}`);
  }
  console.log();
}

/**
 * Print report location
 */
function printReportLocation(reportPath) {
  console.log(`  ${c.bold}📄 FULL REPORT${c.reset}`);
  console.log(`  ${c.cyan}${reportPath}${c.reset}`);
  console.log();
  console.log(
    `  ${c.dim}Share: Copy the report or run ${c.reset}${c.cyan}guardrail share${c.reset}`,
  );
  console.log();
}

/**
 * Generate the polished HTML report
 */
function generateHtmlReport(projectPath, result, findings) {
  const {
    generatePdfHtml,
  } = require("../scripts/generate-reality-check-pdf.js");

  // Enhance the HTML for free tier
  let html = generatePdfHtml({
    projectPath,
    result: {
      score: result.score,
      grade: result.grade,
      canShip: result.canShip,
      counts: result.counts,
      deductions: result.deductions,
    },
    findings,
    timestamp: new Date().toISOString(),
  });

  // Add share functionality and badge
  const shareScript = `
<script>
function copyShareSnippet() {
  const snippet = \`## 🔮 guardrail Reality Check

**Integrity Score:** ${result.score}/100 (${result.grade})
**Status:** ${result.canShip ? "✅ Clear to Ship" : "🚫 Not Ready"}

### Top Issues
${
  findings.hardcodedSecrets
    ?.slice(0, 3)
    .map((s) => `- 🔑 ${s.type} in \`${s.file}\``)
    .join("\\n") || "- None"
}

---
*Generated by [guardrail](https://guardrail.dev)*\`;
  
  navigator.clipboard.writeText(snippet);
  alert('Share snippet copied to clipboard!');
}

function copyBadge() {
  const badge = \`[![guardrail Score](https://img.shields.io/badge/guardrail-${result.score}%2F100-${result.score >= 70 ? "green" : result.score >= 40 ? "yellow" : "red"})](https://guardrail.dev)\`;
  navigator.clipboard.writeText(badge);
  alert('Badge markdown copied to clipboard!');
}
</script>

<style>
.share-buttons {
  position: fixed;
  bottom: 20px;
  right: 20px;
  display: flex;
  gap: 10px;
}
.share-btn {
  padding: 12px 20px;
  border: none;
  border-radius: 8px;
  font-weight: 600;
  cursor: pointer;
  transition: transform 0.2s;
}
.share-btn:hover { transform: scale(1.05); }
.share-btn.primary {
  background: linear-gradient(135deg, #a855f7, #ec4899);
  color: white;
}
.share-btn.secondary {
  background: rgba(255,255,255,0.1);
  color: white;
  border: 1px solid rgba(255,255,255,0.2);
}
</style>

<div class="share-buttons">
  <button class="share-btn secondary" onclick="copyBadge()">📛 Copy Badge</button>
  <button class="share-btn primary" onclick="copyShareSnippet()">📤 Share Summary</button>
</div>
`;

  // Insert before </body>
  html = html.replace("</body>", shareScript + "</body>");

  // Add free tier notice
  const freeNotice = `
<div style="background: linear-gradient(135deg, rgba(168, 85, 247, 0.1), rgba(236, 72, 153, 0.1)); border: 1px solid rgba(168, 85, 247, 0.3); border-radius: 12px; padding: 16px; margin-top: 24px; text-align: center;">
  <p style="margin: 0; color: #a855f7; font-weight: 600;">🚀 Free Tier</p>
  <p style="margin: 8px 0 0; color: #9ca3af; font-size: 13px;">
    Enable <strong>CI Gate</strong> to fail builds on blockers • 
    Get <strong>PR Comments</strong> for your team • 
    Track <strong>History & Trends</strong>
  </p>
  <a href="https://guardrail.dev/pricing" style="display: inline-block; margin-top: 12px; padding: 8px 16px; background: linear-gradient(135deg, #a855f7, #ec4899); color: white; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 13px;">Upgrade to Pro →</a>
</div>
`;

  html = html.replace(
    "</div>\n  </div>\n</body>",
    freeNotice + "</div>\n  </div>\n</body>",
  );

  return html;
}

/**
 * Main scan function
 */
async function runScan(projectPath) {
  printHeader();

  // Check rate limit
  const rateLimit = checkRateLimit(projectPath);
  if (!rateLimit.allowed) {
    console.log(
      `  ${c.yellow}⚠ Free tier limit reached (${FREE_LIMITS.scansPerDay} scans/day)${c.reset}`,
    );
    console.log(`  ${c.dim}Upgrade to Pro for unlimited scans${c.reset}`);
    console.log(`  ${c.cyan}→ https://guardrail.dev/pricing${c.reset}`);
    console.log();
    process.exit(0);
  }

  console.log(`  ${c.dim}Scanning ${projectPath}...${c.reset}`);
  console.log(
    `  ${c.dim}(${rateLimit.remaining} free scans remaining today)${c.reset}`,
  );
  console.log();

  try {
    // Run the production integrity audit
    const scriptsDir = path.join(__dirname, "..", "scripts");
    const { auditProductionIntegrity } = require(
      path.join(scriptsDir, "audit-production-integrity.js"),
    );

    const { results, integrity } = await auditProductionIntegrity(projectPath);

    // Build result summary
    const result = {
      score: integrity.score,
      grade: integrity.grade,
      canShip: integrity.canShip,
      counts: {
        api: {
          connected: results.api?.summary?.connected || 0,
          missing: results.api?.summary?.missingBackend || 0,
        },
        auth: {
          protected: results.auth?.analysis?.protected?.length || 0,
          exposed:
            (results.auth?.analysis?.adminExposed?.length || 0) +
            (results.auth?.analysis?.sensitiveUnprotected?.length || 0),
        },
        secrets: {
          critical:
            results.env?.secrets?.filter((s) => s.severity === "critical")
              .length || 0,
        },
        routes: {
          deadLinks: results.routes?.integrity?.deadLinks?.length || 0,
        },
        mocks: {
          critical: (results.mocks?.issues || []).filter(
            (i) => i.severity === "critical",
          ).length,
          high: (results.mocks?.issues || []).filter(
            (i) => i.severity === "high",
          ).length,
        },
      },
      deductions: integrity.deductions,
      totalBlockers:
        (results.env?.secrets?.filter((s) => s.severity === "critical")
          .length || 0) +
        (results.mocks?.issues || []).filter((i) => i.severity === "critical")
          .length +
        (results.auth?.analysis?.adminExposed?.length || 0),
    };

    // Build findings (limited for free tier)
    const findings = {
      missingApis: (results.api?.missing || []).slice(
        0,
        FREE_LIMITS.issuesShownPerCategory,
      ),
      exposedEndpoints: [
        ...(results.auth?.analysis?.adminExposed || []),
        ...(results.auth?.analysis?.sensitiveUnprotected || []),
      ].slice(0, FREE_LIMITS.issuesShownPerCategory),
      hardcodedSecrets: (results.env?.secrets || [])
        .filter((s) => s.severity === "critical" || s.severity === "high")
        .slice(0, FREE_LIMITS.issuesShownPerCategory),
      deadLinks: Object.entries(
        (results.routes?.integrity?.deadLinks || []).reduce((acc, link) => {
          if (!acc[link.href]) acc[link.href] = 0;
          acc[link.href]++;
          return acc;
        }, {}),
      )
        .map(([href, count]) => ({ href, count }))
        .slice(0, FREE_LIMITS.issuesShownPerCategory),
      mockCode: [
        ...(results.mocks?.issues || []),
        ...(results.mocks?.packageIssues || []),
      ]
        .filter((i) => i.severity === "critical" || i.severity === "high")
        .slice(0, FREE_LIMITS.issuesShownPerCategory),
    };

    // Save to history
    const history = saveScanHistory(projectPath, result);

    // Print results
    printScoreBox(result.score, result.grade, result.canShip);
    printRegression(result.score, rateLimit.lastScore);
    printCategorySummary(result.counts);
    printTopBlockers(findings, 10);

    // Generate HTML report
    const guardrailDir = path.join(projectPath, ".guardrail");
    if (!fs.existsSync(guardrailDir)) {
      fs.mkdirSync(guardrailDir, { recursive: true });
    }

    const reportPath = path.join(guardrailDir, "report.html");
    const html = generateHtmlReport(projectPath, result, findings);
    fs.writeFileSync(reportPath, html);

    printReportLocation(reportPath);
    printUpgradeNudge(result.totalBlockers > 0);

    // Exit with appropriate code
    process.exit(result.canShip ? 0 : 1);
  } catch (error) {
    console.log(`  ${c.red}✗ Scan failed: ${error.message}${c.reset}`);
    console.log();
    process.exit(1);
  }
}

// CLI entry point
const projectPath = process.argv[2] || process.cwd();
runScan(path.resolve(projectPath));
