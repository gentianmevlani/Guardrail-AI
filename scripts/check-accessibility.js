#!/usr/bin/env node

/**
 * Accessibility Checker CLI
 */

const { accessibilityChecker } = require('../src/lib/accessibility-checker');
const { cliUtils } = require('../src/lib/cli-utils');
const path = require('path');

async function main() {
  const projectPath = process.argv[2] || process.cwd();

  cliUtils.section('♿ Accessibility Check');

  try {
    cliUtils.info(`Checking accessibility in: ${projectPath}\n`);

    const report = await accessibilityChecker.checkProject(projectPath);

    // Summary
    cliUtils.section('Accessibility Report');
    console.log(`Score: ${report.score}/100`);
    console.log(`Total Issues: ${report.totalIssues}`);
    console.log(`Critical: ${report.critical}`);
    console.log(`High: ${report.high}`);
    console.log(`Medium: ${report.medium}`);
    console.log(`Low: ${report.low}\n`);

    if (report.issues.length === 0) {
      cliUtils.success('No accessibility issues found!');
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
        if (issue.wcag) {
          console.log(`  WCAG: ${issue.wcag}`);
        }
        console.log(`  💡 ${issue.suggestion}`);
      }
    }

    console.log('\n');
    cliUtils.info('For WCAG compliance, address all critical and high severity issues.');

  } catch (error) {
    cliUtils.error(`Error: ${error.message}`);
    process.exit(1);
  }
}

main();

