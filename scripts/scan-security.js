#!/usr/bin/env node

/**
 * Enhanced Security Scanner CLI
 */

const {
  enhancedSecurityScanner,
} = require("../src/lib/security-scanner-enhanced");
const { cliUtils } = require("../src/lib/cli-utils");
const path = require("path");

async function main() {
  const projectPath = process.argv[2] || process.cwd();
  const focus = process.argv[3] || "all";
  const strict = process.argv.includes("--strict");

  cliUtils.section("🔒 Enhanced Security Scanner");

  try {
    cliUtils.info(`Scanning: ${projectPath}`);
    cliUtils.info(`Focus: ${focus}\n`);

    const report = await enhancedSecurityScanner.scan(projectPath, {
      focus: focus,
      strict,
    });

    cliUtils.section("Security Report");
    console.log(`Risk Score: ${report.riskScore}/100`);
    console.log(`Critical: ${report.critical}`);
    console.log(`High: ${report.high}`);
    console.log(`Total: ${report.vulnerabilities.length}`);
    console.log(`\nCompliance:`);
    console.log(`  OWASP: ${report.compliance.owasp}/100`);
    console.log(`  CWE: ${report.compliance.cwe}/100\n`);

    if (report.vulnerabilities.length === 0) {
      cliUtils.success("✅ No vulnerabilities found!");
      return;
    }

    // Group by type
    const byType = new Map();
    for (const vuln of report.vulnerabilities) {
      if (!byType.has(vuln.type)) {
        byType.set(vuln.type, []);
      }
      byType.get(vuln.type).push(vuln);
    }

    // Show vulnerabilities
    for (const [type, vulns] of byType.entries()) {
      cliUtils.section(`${type.toUpperCase()} (${vulns.length})`);

      for (const vuln of vulns) {
        const color =
          vuln.severity === "critical"
            ? "red"
            : vuln.severity === "high"
              ? "yellow"
              : "blue";
        console.log(
          `\n${cliUtils.colorize(`[${vuln.severity.toUpperCase()}]`, color)} ${vuln.file}:${vuln.line}`,
        );
        console.log(`  Vulnerability: ${vuln.vulnerability}`);
        if (vuln.cwe) {
          console.log(`  CWE: ${vuln.cwe}`);
        }
        console.log(`  Description: ${vuln.description}`);
        console.log(`  Impact: ${vuln.impact}`);
        console.log(`  Fix: ${vuln.fix}`);
        if (vuln.example) {
          console.log(`  Example: ${vuln.example.substring(0, 80)}...`);
        }
      }
    }

    if (report.recommendations.length > 0) {
      cliUtils.section("Recommendations");
      report.recommendations.forEach((rec) => {
        console.log(`  • ${rec}`);
      });
    }

    cliUtils.warning(
      "\n⚠️  Security vulnerabilities found - review and fix immediately!",
    );
  } catch (error) {
    cliUtils.error(`Error: ${error.message}`);
    process.exit(1);
  }
}

main();
