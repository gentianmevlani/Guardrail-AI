#!/usr/bin/env node

/**
 * Security Scanner CLI
 */

const { securityScanner } = require('../src/lib/security-scanner');
const { cliUtils } = require('../src/lib/cli-utils');
const path = require('path');

async function main() {
  const projectPath = process.argv[2] || process.cwd();

  cliUtils.section('🔒 Security Scan');

  try {
    cliUtils.info(`Scanning project: ${projectPath}\n`);

    const report = await securityScanner.scanProject(projectPath);

    // Summary
    cliUtils.section('Security Report Summary');
    console.log(`Score: ${report.score}/100`);
    console.log(`Total Issues: ${report.totalIssues}`);
    console.log(`Critical: ${report.critical}`);
    console.log(`High: ${report.high}`);
    console.log(`Medium: ${report.medium}`);
    console.log(`Low: ${report.low}\n`);

    if (report.issues.length === 0) {
      cliUtils.success('No security issues found!');
      return;
    }

    // Group by severity
    const bySeverity = {
      critical: report.issues.filter(i => i.severity === 'critical'),
      high: report.issues.filter(i => i.severity === 'high'),
      medium: report.issues.filter(i => i.severity === 'medium'),
      low: report.issues.filter(i => i.severity === 'low'),
    };

    // Show issues
    for (const [severity, issues] of Object.entries(bySeverity)) {
      if (issues.length === 0) continue;

      cliUtils.section(`${severity.toUpperCase()} Issues (${issues.length})`);

      for (const issue of issues) {
        const color = severity === 'critical' ? 'red' : 
                     severity === 'high' ? 'yellow' : 'blue';
        console.log(cliUtils.colorize(`\n${issue.title}`, color));
        console.log(`  ${issue.description}`);
        if (issue.file) {
          console.log(`  File: ${issue.file}${issue.line ? `:${issue.line}` : ''}`);
        }
        if (issue.cwe) {
          console.log(`  CWE: ${issue.cwe}`);
        }
        console.log(`  💡 ${issue.suggestion}`);
      }
    }

    console.log('\n');
    cliUtils.warning('Please review and fix security issues before deploying to production.');

  } catch (error) {
    cliUtils.error(`Error: ${error.message}`);
    process.exit(1);
  }
}

main();

