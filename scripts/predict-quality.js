#!/usr/bin/env node

/**
 * Predictive Quality CLI
 */

const { predictiveQuality } = require('../src/lib/predictive-quality');
const { cliUtils } = require('../src/lib/cli-utils');
const path = require('path');

async function main() {
  const projectPath = process.argv[2] || process.cwd();

  cliUtils.section('🔮 Predictive Quality Analysis');

  try {
    cliUtils.info(`Analyzing project: ${projectPath}\n`);
    cliUtils.info('Predicting future code quality issues...\n');

    const report = await predictiveQuality.predict(projectPath);

    cliUtils.section('Predictions Summary');
    console.log(`Risk Score: ${report.riskScore}/100`);
    console.log(`Total Predictions: ${report.predictions.length}`);
    console.log(`High Risk: ${report.highRisk}\n`);

    if (report.predictions.length === 0) {
      cliUtils.success('No quality issues predicted!');
      return;
    }

    // Group by type
    const byType = new Map<string, typeof report.predictions>();
    for (const pred of report.predictions) {
      if (!byType.has(pred.type)) {
        byType.set(pred.type, []);
      }
      byType.get(pred.type)!.push(pred);
    }

    // Show predictions
    for (const [type, preds] of byType.entries()) {
      cliUtils.section(`${type.toUpperCase()} Predictions (${preds.length})`);

      for (const pred of preds) {
        const color = pred.severity === 'high' ? 'red' : 'yellow';
        console.log(cliUtils.colorize(`\n${pred.predictedIssue}`, color));
        console.log(`  Confidence: ${(pred.confidence * 100).toFixed(0)}%`);
        console.log(`  Timeline: ${pred.timeline}`);
        if (pred.file) {
          console.log(`  File: ${pred.file}${pred.line ? `:${pred.line}` : ''}`);
        }
        console.log(`  Prevention:`);
        pred.prevention.forEach(p => console.log(`    • ${p}`));
        if (pred.evidence.length > 0) {
          console.log(`  Evidence:`);
          pred.evidence.forEach(e => console.log(`    • ${e}`));
        }
      }
    }

    if (report.recommendations.length > 0) {
      cliUtils.section('Recommendations');
      report.recommendations.forEach(rec => {
        console.log(`  • ${rec}`);
      });
    }

    console.log('\n');
    cliUtils.info('Address predicted issues proactively to prevent future problems.');

  } catch (error) {
    cliUtils.error(`Error: ${error.message}`);
    process.exit(1);
  }
}

main();

