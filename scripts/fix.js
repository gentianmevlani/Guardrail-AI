#!/usr/bin/env node

/**
 * Auto-Fix CLI
 * 
 * Automatically fixes common issues
 */

const { autoFixer } = require('../src/lib/auto-fixer');
const { polishService } = require('../src/lib/polish-service');
const path = require('path');

async function main() {
  const projectPath = process.argv[2] || process.cwd();
  const fixAll = process.argv.includes('--all');

  console.log(`
╔══════════════════════════════════════════════════════════════╗
║                                                              ║
║            🔧 guardrail Auto-Fix                             ║
║                                                              ║
║  Automatically fixing common code issues...                  ║
║                                                              ║
╚══════════════════════════════════════════════════════════════╝
`);

  try {
    console.log(`Analyzing project: ${projectPath}\n`);
    const report = await polishService.analyzeProject(projectPath);

    const autoFixable = report.issues.filter(i => i.autoFixable);
    
    if (autoFixable.length === 0) {
      console.log('✅ No auto-fixable issues found!\n');
      return;
    }

    console.log(`Found ${autoFixable.length} auto-fixable issue(s)\n`);

    if (!fixAll) {
      console.log('Issues that can be auto-fixed:');
      autoFixable.forEach((issue, i) => {
        console.log(`\n${i + 1}. ${issue.title}`);
        console.log(`   ${issue.description}`);
        if (issue.file) {
          console.log(`   File: ${issue.file}`);
        }
      });

      const readline = require('readline');
      const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
      });

      const answer = await new Promise(resolve => {
        rl.question('\nFix all issues? (yes/no): ', resolve);
      });
      rl.close();

      if (answer.toLowerCase() !== 'yes' && answer.toLowerCase() !== 'y') {
        console.log('\nCancelled.\n');
        return;
      }
    }

    console.log('\n🔧 Fixing issues...\n');
    const fixReport = await autoFixer.fixAll(autoFixable, projectPath);

    console.log(`\n✅ Fixed ${fixReport.totalFixed} issue(s)`);
    if (fixReport.totalFailed > 0) {
      console.log(`⚠️  ${fixReport.totalFailed} issue(s) failed to fix\n`);
    }

    // Show details
    for (const result of fixReport.results) {
      if (result.success) {
        console.log(`\n✅ ${result.file}`);
        result.changes.forEach(change => {
          console.log(`   • ${change}`);
        });
      } else if (result.errors && result.errors.length > 0) {
        console.log(`\n❌ ${result.file}`);
        result.errors.forEach(error => {
          console.log(`   • ${error}`);
        });
      }
    }

    console.log('\n✅ Auto-fix complete!\n');
  } catch (error) {
    console.error(`❌ Error: ${error.message}`);
    process.exit(1);
  }
}

main();

