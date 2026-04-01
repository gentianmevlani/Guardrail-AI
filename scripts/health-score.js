#!/usr/bin/env node

/**
 * Code Health Score CLI
 */

const { codeHealthScore } = require('../src/lib/code-health-score');
const { cliUtils } = require('../src/lib/cli-utils');
const path = require('path');

async function main() {
  const projectPath = process.argv[2] || process.cwd();

  cliUtils.section('🏥 Code Health Score');

  try {
    cliUtils.info(`Analyzing health for: ${projectPath}\n`);

    const health = await codeHealthScore.calculateHealth(projectPath);

    // Overall Score
    const scoreColor = health.overall >= 80 ? 'green' : health.overall >= 60 ? 'yellow' : 'red';
    cliUtils.section('Overall Health Score');
    console.log(cliUtils.colorize(`\n${health.overall.toFixed(1)}/100`, scoreColor));
    console.log(`\nStatus: ${health.overall >= 80 ? '✅ Healthy' : health.overall >= 60 ? '⚠️  Needs Attention' : '🔴 Critical'}`);

    // Breakdown
    cliUtils.section('Category Breakdown');
    health.breakdown.forEach((metric) => {
      const trendIcon = metric.trend === 'improving' ? '📈' : metric.trend === 'declining' ? '📉' : '➡️';
      console.log(`\n${metric.category.toUpperCase()}`);
      console.log(`  Score: ${metric.score.toFixed(1)}/100 ${trendIcon}`);
      console.log(`  Issues: ${metric.issues}`);
      console.log(`  Prediction: ${metric.prediction.futureScore.toFixed(1)} in ${metric.prediction.timeframe} (${(metric.prediction.confidence * 100).toFixed(0)}% confidence)`);
      if (metric.recommendations.length > 0) {
        console.log(`  Recommendations:`);
        metric.recommendations.forEach(rec => console.log(`    • ${rec}`));
      }
    });

    // Predictions
    cliUtils.section('Future Predictions');
    console.log(`Next Week: ${health.predictions.nextWeek.toFixed(1)}`);
    console.log(`Next Month: ${health.predictions.nextMonth.toFixed(1)}`);
    console.log(`Next Quarter: ${health.predictions.nextQuarter.toFixed(1)}`);

    // Risk Factors
    if (health.riskFactors.length > 0) {
      cliUtils.section('Risk Factors');
      health.riskFactors.forEach((factor, i) => {
        console.log(`\n${i + 1}. ${factor.factor}`);
        console.log(`   Impact: ${factor.impact.toUpperCase()}`);
        console.log(`   Probability: ${(factor.probability * 100).toFixed(0)}%`);
      });
    }

    // Action Plan
    if (health.actionPlan.length > 0) {
      cliUtils.section('Action Plan');
      health.actionPlan.forEach((action, i) => {
        const priorityColor = action.priority === 'critical' ? 'red' :
                             action.priority === 'high' ? 'yellow' : 'blue';
        console.log(`\n${i + 1}. ${cliUtils.colorize(`[${action.priority.toUpperCase()}]`, priorityColor)} ${action.action}`);
        console.log(`   Impact: ${action.impact}`);
        console.log(`   Effort: ${action.effort}`);
      });
    }

    cliUtils.success('\nHealth analysis complete!');

  } catch (error) {
    cliUtils.error(`Error: ${error.message}`);
    process.exit(1);
  }
}

main();

