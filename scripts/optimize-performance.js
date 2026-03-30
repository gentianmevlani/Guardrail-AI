#!/usr/bin/env node

/**
 * Performance Optimizer CLI
 */

const { performanceOptimizer } = require('../src/lib/performance-optimizer');
const { cliUtils } = require('../src/lib/cli-utils');
const path = require('path');

async function main() {
  const projectPath = process.argv[2] || process.cwd();
  const focus = process.argv[3] || 'all';
  const autoFix = process.argv.includes('--fix');

  cliUtils.section('⚡ Performance Optimizer');

  try {
    cliUtils.info(`Analyzing: ${projectPath}`);
    cliUtils.info(`Focus: ${focus}\n`);

    const report = await performanceOptimizer.optimize(projectPath, {
      focus: focus as any,
      autoFix,
    });

    cliUtils.section('Performance Analysis');
    console.log(`Total Issues: ${report.issues.length}`);
    console.log(`Overall Improvement: ${report.totalImprovement.toFixed(1)}%`);
    console.log(`\nEstimated Savings:`);
    console.log(`  Bundle Size: ${(report.estimatedSavings.bundleSize / 1024).toFixed(2)} KB`);
    console.log(`  Load Time: ${report.estimatedSavings.loadTime}ms`);
    console.log(`  Render Time: ${report.estimatedSavings.renderTime}ms\n`);

    if (report.issues.length === 0) {
      cliUtils.success('✅ No performance issues found!');
      return;
    }

    // Group by type
    const byType = new Map<string, typeof report.issues>();
    for (const issue of report.issues) {
      if (!byType.has(issue.type)) {
        byType.set(issue.type, []);
      }
      byType.get(issue.type)!.push(issue);
    }

    // Show issues
    for (const [type, issues] of byType.entries()) {
      cliUtils.section(`${type.toUpperCase()} (${issues.length})`);

      for (const issue of issues) {
        const color = issue.severity === 'critical' ? 'red' :
                     issue.severity === 'high' ? 'yellow' : 'blue';
        console.log(`\n${cliUtils.colorize(`[${issue.severity.toUpperCase()}]`, color)} ${issue.file}${issue.line ? `:${issue.line}` : ''}`);
        console.log(`  Issue: ${issue.issue}`);
        console.log(`  Impact: ${issue.impact}`);
        console.log(`  Improvement: ${issue.improvement}%`);
        console.log(`  Current: ${issue.current}`);
        console.log(`  Optimized: ${issue.optimized}`);
      }
    }

    if (report.recommendations.length > 0) {
      cliUtils.section('Recommendations');
      report.recommendations.forEach(rec => {
        console.log(`  • ${rec}`);
      });
    }

    if (autoFix) {
      cliUtils.success('\n✅ Auto-fixes applied!');
    }

    cliUtils.success('\nOptimization analysis complete!');

  } catch (error) {
    cliUtils.error(`Error: ${error.message}`);
    process.exit(1);
  }
}

main();

