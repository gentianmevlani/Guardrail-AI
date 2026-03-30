#!/usr/bin/env node

/**
 * Batch Validation CLI
 * 
 * Validate multiple projects or files at once
 */

const { batchValidator } = require('../src/lib/batch-validator');
const path = require('path');
const fs = require('fs');

async function main() {
  const args = process.argv.slice(2);
  const command = args[0];
  const paths = args.slice(1);

  console.log(`
╔══════════════════════════════════════════════════════════════╗
║                                                              ║
║            📊 guardrail Batch Validation                     ║
║                                                              ║
║  Validate multiple projects or files in parallel            ║
║                                                              ║
╚══════════════════════════════════════════════════════════════╝
`);

  try {
    if (command === 'projects' && paths.length > 0) {
      console.log(`Validating ${paths.length} project(s)...\n`);
      const report = await batchValidator.validateProjects(paths, {
        parallel: true,
        maxConcurrency: 5,
      });

      printReport(report);
    } else if (command === 'files' && paths.length > 0) {
      const projectPath = process.cwd();
      console.log(`Validating ${paths.length} file(s)...\n`);
      const report = await batchValidator.validateFiles(paths, projectPath, {
        parallel: true,
        maxConcurrency: 10,
      });

      printReport(report);
    } else {
      console.error('Usage:');
      console.error('  npm run batch-validate projects <path1> <path2> ...');
      console.error('  npm run batch-validate files <file1> <file2> ...');
      process.exit(1);
    }
  } catch (error) {
    console.error(`❌ Error: ${error.message}`);
    process.exit(1);
  }
}

function printReport(report) {
  console.log('\n📊 VALIDATION REPORT\n');
  console.log(`Total: ${report.total}`);
  console.log(`✅ Valid: ${report.valid}`);
  console.log(`❌ Invalid: ${report.invalid}`);
  console.log(`\nSummary:`);
  console.log(`  Total Errors: ${report.summary.totalErrors}`);
  console.log(`  Total Warnings: ${report.summary.totalWarnings}`);
  console.log(`  Avg Duration: ${report.summary.avgDuration.toFixed(2)}ms`);

  if (report.invalid > 0) {
    console.log(`\n❌ Invalid Results:\n`);
    report.results
      .filter(r => !r.valid)
      .forEach(result => {
        if (result.project) {
          console.log(`  Project: ${result.project}`);
        }
        if (result.file) {
          console.log(`  File: ${result.file}`);
        }
        if (result.errors.length > 0) {
          result.errors.forEach(err => {
            console.log(`    ❌ ${err.rule}: ${err.message}`);
          });
        }
        if (result.warnings.length > 0) {
          result.warnings.forEach(warn => {
            console.log(`    ⚠️  ${warn.rule}: ${warn.message}`);
          });
        }
        console.log(`    Duration: ${result.duration}ms\n`);
      });
  }

  console.log('\n✅ Batch validation complete!\n');
}

main();

