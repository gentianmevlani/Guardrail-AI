import path from "node:path";
import { readJsonSync, truthPackExists, scanVulnerabilities, checkPackageVulnerability } from "@guardrail-context/engine";
import type { VulnerabilityReport } from "@guardrail-context/engine";

const UPGRADE_HINT =
  "Upgrade for full CVE titles, package versions, and fix guidance: https://guardrail.dev/billing";

function mcpShouldRedactIssueDetails(): boolean {
  const t = (process.env.GUARDRAIL_TIER || process.env.GUARDRAIL_PLAN || "free").trim().toLowerCase();
  return t === "free" || t === "";
}

export async function vulnerabilitiesScanTool(repoRoot: string) {
  if (!truthPackExists(repoRoot)) {
    return { error: "Truth Pack not found. Run 'guardrail-context index' first." };
  }

  const report = await scanVulnerabilities(repoRoot);

  if (report.vulnerabilities.length === 0) {
    return {
      safe: true,
      summary: report.summary,
      message: "✅ No known vulnerabilities found in dependencies."
    };
  }

  if (mcpShouldRedactIssueDetails()) {
    return {
      safe: false,
      summary: report.summary,
      issueDetailsRedacted: true,
      upgradeHint: UPGRADE_HINT,
      message:
        report.summary.critical > 0
          ? `🚨 CRITICAL: ${report.summary.critical} critical (and other) vulnerabilities found. ${UPGRADE_HINT}`
          : `⚠️ WARNING: ${report.summary.high} high-severity (and other) vulnerabilities found. ${UPGRADE_HINT}`
    };
  }

  return {
    safe: false,
    summary: report.summary,
    critical: report.vulnerabilities.filter(v => v.severity === "critical").map(v => ({
      package: v.package,
      version: v.version,
      title: v.title,
      fix: v.recommendation
    })),
    high: report.vulnerabilities.filter(v => v.severity === "high").map(v => ({
      package: v.package,
      version: v.version,
      title: v.title,
      fix: v.recommendation
    })),
    message: report.summary.critical > 0 
      ? `🚨 CRITICAL: ${report.summary.critical} critical vulnerabilities found! Fix immediately.`
      : `⚠️ WARNING: ${report.summary.high} high-severity vulnerabilities found.`
  };
}

export async function vulnerabilityCheckTool(repoRoot: string, packageName: string) {
  const result = await checkPackageVulnerability(repoRoot, packageName);

  if (!result.vulnerable) {
    return {
      package: packageName,
      vulnerable: false,
      message: `✅ ${packageName} has no known vulnerabilities.`
    };
  }

  if (mcpShouldRedactIssueDetails()) {
    const bySev = { critical: 0, high: 0, medium: 0, low: 0 };
    for (const v of result.vulnerabilities) {
      const s = (v.severity || "low").toLowerCase();
      if (s in bySev) bySev[s as keyof typeof bySev]++;
    }
    return {
      package: packageName,
      vulnerable: true,
      issueDetailsRedacted: true,
      upgradeHint: UPGRADE_HINT,
      countsBySeverity: bySev,
      message: `🚨 ${packageName} has ${result.vulnerabilities.length} known vulnerabilities. ${UPGRADE_HINT}`
    };
  }

  return {
    package: packageName,
    vulnerable: true,
    vulnerabilities: result.vulnerabilities.map(v => ({
      severity: v.severity,
      title: v.title,
      fix: v.recommendation
    })),
    message: `🚨 ${packageName} has ${result.vulnerabilities.length} known vulnerabilities! ${result.vulnerabilities[0]?.recommendation}`
  };
}
