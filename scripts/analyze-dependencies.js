#!/usr/bin/env node

/**
 * Dependency Analyzer CLI
 */

const { dependencyAnalyzer } = require('../src/lib/dependency-analyzer');
const { cliUtils } = require('../src/lib/cli-utils');
const path = require('path');

async function main() {
  const projectPath = process.argv[2] || process.cwd();

  cliUtils.section('📦 Dependency Analysis');

  try {
    cliUtils.info(`Analyzing dependencies in: ${projectPath}\n`);

    const report = await dependencyAnalyzer.analyze(projectPath);

    // Summary
    cliUtils.section('Dependency Report');
    console.log(`Score: ${report.score}/100`);
    console.log(`Total Dependencies: ${report.totalDependencies}`);
    console.log(`Outdated: ${report.outdated}`);
    console.log(`Vulnerable: ${report.vulnerable}`);
    console.log(`Unused: ${report.unused}`);
    console.log(`Duplicate: ${report.duplicate}\n`);

    if (report.issues.length === 0) {
      cliUtils.success('All dependencies are healthy!');
      return;
    }

    // Group by type
    const byType = {
      vulnerable: report.issues.filter(i => i.type === 'vulnerable'),
      outdated: report.issues.filter(i => i.type === 'outdated'),
      unused: report.issues.filter(i => i.type === 'unused'),
      duplicate: report.issues.filter(i => i.type === 'duplicate'),
    };

    // Show issues
    for (const [type, issues] of Object.entries(byType)) {
      if (issues.length === 0) continue;

      cliUtils.section(`${type.toUpperCase()} (${issues.length})`);

      for (const issue of issues) {
        console.log(`\n${cliUtils.colorize(issue.package, 'yellow')}`);
        console.log(`  Version: ${issue.currentVersion}`);
        if (issue.latestVersion) {
          console.log(`  Latest: ${issue.latestVersion}`);
        }
        console.log(`  ${issue.description}`);
        console.log(`  💡 ${issue.suggestion}`);
      }
    }

    console.log('\n');
    cliUtils.info('Run "npm audit" for detailed vulnerability information.');
    cliUtils.info('Run "npm outdated" to see all outdated packages.');

  } catch (error) {
    cliUtils.error(`Error: ${error.message}`);
    process.exit(1);
  }
}

main();

