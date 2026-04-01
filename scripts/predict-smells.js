#!/usr/bin/env node

/**
 * Code Smell Predictor CLI
 */

const { codeSmellPredictor } = require('../src/lib/code-smell-predictor');
const { cliUtils } = require('../src/lib/cli-utils');
const path = require('path');

async function main() {
  const projectPath = process.argv[2] || process.cwd();

  cliUtils.section('👃 Code Smell & Technical Debt Predictor');

  try {
    cliUtils.info(`Analyzing technical debt in: ${projectPath}\n`);

    const report = await codeSmellPredictor.predict(projectPath);

    cliUtils.section('Technical Debt Report');
    console.log(`Total Smells: ${report.totalSmells}`);
    console.log(`Critical: ${report.critical}`);
    console.log(`Estimated Debt: ${report.estimatedDebt} hours\n`);

    if (report.smells.length === 0) {
      cliUtils.success('No code smells detected!');
      return;
    }

    // Group by type
    const byType = new Map();
    for (const smell of report.smells) {
      if (!byType.has(smell.type)) {
        byType.set(smell.type, []);
      }
      byType.get(smell.type).push(smell);
    }

    // Show smells
    for (const [type, smells] of byType.entries()) {
      cliUtils.section(`${type.toUpperCase()} (${smells.length})`);

      for (const smell of smells) {
        const color = smell.severity === 'critical' ? 'red' : 
                     smell.severity === 'high' ? 'yellow' : 'blue';
        console.log(cliUtils.colorize(`\n${smell.description}`, color));
        console.log(`  Current: ${smell.metrics.current} (threshold: ${smell.metrics.threshold})`);
        console.log(`  Prediction: ${smell.prediction.when} - ${smell.prediction.impact}`);
        console.log(`  Cost: ${smell.prediction.cost} (${smell.prediction.cost === 'high' ? '8+' : smell.prediction.cost === 'medium' ? '4-8' : '1-4'} hours)`);
        if (smell.file) {
          console.log(`  File: ${smell.file}${smell.line ? `:${smell.line}` : ''}`);
        }
        console.log(`  Recommendations:`);
        smell.recommendation.forEach(rec => console.log(`    • ${rec}`));
      }
    }

    if (report.trends.length > 0) {
      cliUtils.section('Trends');
      report.trends.forEach(trend => {
        console.log(`  ${trend.type}: ${trend.trend} (${trend.change > 0 ? '+' : ''}${trend.change})`);
      });
    }

    console.log('\n');
    cliUtils.warning(`Total technical debt: ${report.estimatedDebt} hours`);

  } catch (error) {
    cliUtils.error(`Error: ${error.message}`);
    process.exit(1);
  }
}

main();

