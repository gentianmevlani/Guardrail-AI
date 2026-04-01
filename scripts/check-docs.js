#!/usr/bin/env node

/**
 * Documentation Checker CLI
 */

const { documentationChecker } = require('../src/lib/documentation-checker');
const { cliUtils } = require('../src/lib/cli-utils');
const path = require('path');

async function main() {
  const projectPath = process.argv[2] || process.cwd();

  cliUtils.section('📚 Documentation Check');

  try {
    cliUtils.info(`Checking documentation in: ${projectPath}\n`);

    const report = await documentationChecker.checkProject(projectPath);

    // Summary
    cliUtils.section('Documentation Report');
    console.log(`Coverage: ${report.coverage}%`);
    console.log(`Total Issues: ${report.totalIssues}`);
    console.log(`High: ${report.high}`);
    console.log(`Medium: ${report.medium}`);
    console.log(`Low: ${report.low}\n`);

    if (report.issues.length === 0) {
      cliUtils.success('All code is properly documented!');
      return;
    }

    // Show issues by severity
    const bySeverity = {
      high: report.issues.filter(i => i.severity === 'high'),
      medium: report.issues.filter(i => i.severity === 'medium'),
      low: report.issues.filter(i => i.severity === 'low'),
    };

    for (const [severity, issues] of Object.entries(bySeverity)) {
      if (issues.length === 0) continue;

      cliUtils.section(`${severity.toUpperCase()} Priority (${issues.length})`);

      for (const issue of issues) {
        console.log(`\n${cliUtils.colorize(issue.title, 'yellow')}`);
        console.log(`  ${issue.description}`);
        console.log(`  File: ${issue.file}${issue.line ? `:${issue.line}` : ''}`);
        console.log(`  💡 ${issue.suggestion}`);
      }
    }

    console.log('\n');
    cliUtils.info(`Documentation coverage: ${report.coverage}%`);

  } catch (error) {
    cliUtils.error(`Error: ${error.message}`);
    process.exit(1);
  }
}

main();

