#!/usr/bin/env node

/**
 * Migration Assistant CLI
 */

const { migrationAssistant } = require('../src/lib/migration-assistant');
const { cliUtils } = require('../src/lib/cli-utils');
const path = require('path');

async function main() {
  const projectPath = process.argv[2] || process.cwd();
  const from = process.argv[3];
  const to = process.argv[4];

  if (!from || !to) {
    cliUtils.error('Usage: plan-migration [project-path] <from> <to>');
    cliUtils.info('Example: plan-migration ./my-project react@17 react@18');
    process.exit(1);
  }

  cliUtils.section('🔄 Migration Assistant');

  try {
    cliUtils.info(`Planning migration: ${from} → ${to}`);
    cliUtils.info(`Project: ${projectPath}\n`);

    const plan = await migrationAssistant.planMigration(projectPath, from, to);

    cliUtils.section('Migration Plan');
    console.log(`From: ${plan.from}`);
    console.log(`To: ${plan.to}`);
    console.log(`Risk: ${plan.risk.toUpperCase()}`);
    console.log(`Total Time: ${plan.totalTime} minutes (${(plan.totalTime / 60).toFixed(1)} hours)`);
    console.log(`Steps: ${plan.steps.length}\n`);

    for (const step of plan.steps) {
      const automated = step.automated ? '🤖 Automated' : '✋ Manual';
      const difficulty = step.difficulty === 'easy' ? '🟢' :
                        step.difficulty === 'medium' ? '🟡' : '🔴';
      console.log(`\n${difficulty} ${step.type.toUpperCase()}: ${step.description}`);
      console.log(`  ${automated}`);
      console.log(`  Time: ${step.estimatedTime} minutes`);
      if (step.file) {
        console.log(`  File: ${step.file}`);
      }
      console.log(`  Current: ${step.current}`);
      console.log(`  Target: ${step.target}`);
    }

    if (plan.recommendations.length > 0) {
      cliUtils.section('Recommendations');
      plan.recommendations.forEach(rec => {
        console.log(`  • ${rec}`);
      });
    }

    cliUtils.success('\nMigration plan generated!');

  } catch (error) {
    cliUtils.error(`Error: ${error.message}`);
    process.exit(1);
  }
}

main();

