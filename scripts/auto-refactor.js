#!/usr/bin/env node

/**
 * Refactoring Automation CLI
 */

const { refactoringAutomation } = require('../src/lib/refactoring-automation');
const { cliUtils } = require('../src/lib/cli-utils');
const path = require('path');

async function main() {
  const projectPath = process.argv[2] || process.cwd();
  const safety = process.argv[3] || 'moderate';
  const autoApply = process.argv.includes('--apply');
  const backup = process.argv.includes('--backup');

  cliUtils.section('🔧 Refactoring Automation');

  try {
    cliUtils.info(`Analyzing: ${projectPath}`);
    cliUtils.info(`Safety: ${safety}`);
    cliUtils.info(`Auto-apply: ${autoApply ? 'Yes' : 'No (dry run)'}\n`);

    const result = await refactoringAutomation.refactor(projectPath, {
      safety: safety as any,
      autoApply,
      backup,
    });

    cliUtils.section('Refactoring Results');
    console.log(`Actions Found: ${result.actions.length}`);
    console.log(`Applied: ${result.applied}`);
    console.log(`Skipped: ${result.skipped}`);
    console.log(`Errors: ${result.errors}`);
    console.log(`\nImprovements:`);
    console.log(`  Complexity: ${result.improvements.complexity > 0 ? '+' : ''}${result.improvements.complexity}`);
    console.log(`  Maintainability: +${result.improvements.maintainability}`);
    console.log(`  Lines: ${result.improvements.lines > 0 ? '+' : ''}${result.improvements.lines}\n`);

    if (result.actions.length === 0) {
      cliUtils.success('✅ No refactoring actions needed!');
      return;
    }

    // Show actions
    cliUtils.section('Refactoring Actions');
    for (const action of result.actions) {
      const status = action.safe ? '✅ Safe' : '⚠️  Review';
      const applied = result.applied > 0 && action.safe ? ' [APPLIED]' : '';
      console.log(`\n${status}${applied} ${action.type.toUpperCase()}: ${action.description}`);
      console.log(`  File: ${action.file}:${action.line}`);
      console.log(`  Confidence: ${(action.confidence * 100).toFixed(0)}%`);
      if (!autoApply) {
        console.log(`  Before: ${action.before.substring(0, 60)}...`);
        console.log(`  After: ${action.after.substring(0, 60)}...`);
      }
    }

    if (!autoApply) {
      cliUtils.info('\nUse --apply to automatically apply safe refactorings');
      if (backup) {
        cliUtils.info('Use --backup to create backups before applying');
      }
    } else {
      cliUtils.success('\n✅ Refactoring complete!');
    }

  } catch (error) {
    cliUtils.error(`Error: ${error.message}`);
    process.exit(1);
  }
}

main();

