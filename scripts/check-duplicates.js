#!/usr/bin/env node

/**
 * Check Duplicates
 * 
 * Find duplicate and unnecessary files
 */

const { duplicateDetector } = require('../src/lib/duplicate-detector.js');

async function main() {
  console.log(`
╔══════════════════════════════════════════════════════════════╗
║                                                              ║
║         🔍 guardrail AI - Duplicate Detector                ║
║                                                              ║
║  Finding duplicate and unnecessary files                    ║
║                                                              ║
╚══════════════════════════════════════════════════════════════╝
`);

  const projectPath = process.argv[2] || process.cwd();
  const report = duplicateDetector.scan(projectPath);

  // Show duplicates
  if (report.duplicates.length > 0) {
    console.log(`\n📋 Found ${report.duplicates.length} duplicate(s):\n`);
    report.duplicates.forEach(dup => {
      console.log(`   ${dup.reason === 'exact' ? '🔴' : '🟡'} ${dup.file}`);
      dup.duplicates.forEach(duplicate => {
        console.log(`      └─ ${duplicate}`);
      });
    });
  } else {
    console.log('\n✅ No duplicates found!\n');
  }

  // Show unused files
  if (report.unused.length > 0) {
    console.log(`\n📋 Found ${report.unused.length} unused file(s):\n`);
    report.unused.slice(0, 10).forEach(file => {
      console.log(`   ⚠️  ${file}`);
    });
    if (report.unused.length > 10) {
      console.log(`   ... and ${report.unused.length - 10} more`);
    }
  } else {
    console.log('\n✅ No unused files found!\n');
  }

  // Show suggestions
  if (report.suggestions.length > 0) {
    console.log(`\n💡 Suggestions:\n`);
    report.suggestions.slice(0, 5).forEach(suggestion => {
      console.log(`   • ${suggestion.suggestion}`);
      console.log(`     File: ${suggestion.file}`);
      console.log(`     Reason: ${suggestion.reason}\n`);
    });
  }
}

main();

