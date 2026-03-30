#!/usr/bin/env node

/**
 * Polish Project Script
 * 
 * Analyzes completed projects and finds all the small detailed things
 * users forgot - the polish that makes projects production-ready
 */

const { polishService } = require('../src/lib/polish-service');
const path = require('path');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function question(prompt) {
  return new Promise((resolve) => {
    rl.question(prompt, resolve);
  });
}

function formatScore(score) {
  if (score >= 90) return `🟢 ${score}/100 (Excellent)`;
  if (score >= 70) return `🟡 ${score}/100 (Good)`;
  if (score >= 50) return `🟠 ${score}/100 (Needs Work)`;
  return `🔴 ${score}/100 (Critical Issues)`;
}

function formatSeverity(severity) {
  const icons = {
    critical: '🔴',
    high: '🟠',
    medium: '🟡',
    low: '🔵',
  };
  return `${icons[severity] || '⚪'} ${severity.toUpperCase()}`;
}

async function main() {
  console.log(`
╔══════════════════════════════════════════════════════════════╗
║                                                              ║
║            ✨ Project Polish Service                        ║
║                                                              ║
║  Analyzes your project and finds all the small detailed     ║
║  things you forgot - the polish that makes projects          ║
║  production-ready!                                           ║
║                                                              ║
╚══════════════════════════════════════════════════════════════╝
`);

  const projectPath = process.argv[2] || process.cwd();
  console.log(`Analyzing project: ${projectPath}\n`);

  try {
    console.log('🔍 Scanning project for polish issues...\n');
    const report = await polishService.analyzeProject(projectPath);

    // Summary
    console.log('📊 POLISH REPORT SUMMARY\n');
    console.log(`   Score: ${formatScore(report.score)}`);
    console.log(`   Total Issues: ${report.totalIssues}`);
    console.log(`   Critical: ${report.critical}`);
    console.log(`   High: ${report.high}`);
    console.log(`   Medium: ${report.medium}`);
    console.log(`   Low: ${report.low}\n`);

    if (report.issues.length === 0) {
      console.log('✅ Perfect! No polish issues found. Your project is production-ready!\n');
      rl.close();
      return;
    }

    // Group by category
    const byCategory = {};
    for (const issue of report.issues) {
      if (!byCategory[issue.category]) {
        byCategory[issue.category] = [];
      }
      byCategory[issue.category].push(issue);
    }

    // Show issues by category
    console.log('📋 ISSUES BY CATEGORY\n');
    for (const [category, issues] of Object.entries(byCategory)) {
      console.log(`\n${category}:`);
      for (const issue of issues) {
        console.log(`\n   ${formatSeverity(issue.severity)} ${issue.title}`);
        console.log(`   ${issue.description}`);
        if (issue.file) {
          console.log(`   File: ${path.relative(projectPath, issue.file)}`);
        }
        console.log(`   💡 ${issue.suggestion}`);
        if (issue.autoFixable) {
          console.log(`   ✅ Auto-fixable`);
        }
      }
    }

    // Recommendations
    if (report.recommendations.length > 0) {
      console.log('\n\n💡 RECOMMENDATIONS\n');
      report.recommendations.forEach((rec, i) => {
        console.log(`   ${i + 1}. ${rec}`);
      });
    }

    // Auto-fix option
    const autoFixable = report.issues.filter(i => i.autoFixable);
    if (autoFixable.length > 0) {
      console.log(`\n\n🔧 AUTO-FIX AVAILABLE\n`);
      console.log(`   ${autoFixable.length} issue(s) can be auto-fixed.`);
      const shouldFix = await question('\n   Auto-fix these issues? (yes/no): ');
      
      if (shouldFix.toLowerCase() === 'yes' || shouldFix.toLowerCase() === 'y') {
        console.log('\n   🔧 Auto-fixing issues...\n');
        
        const { autoFixer } = require('../src/lib/auto-fixer');
        const fixReport = await autoFixer.fixAll(autoFixable, projectPath);
        
        console.log(`\n   ✅ ${fixReport.totalFixed} issue(s) fixed`);
        if (fixReport.totalFailed > 0) {
          console.log(`   ⚠️  ${fixReport.totalFailed} issue(s) failed to fix`);
        }
        
        // Show details
        for (const fixResult of fixReport.results) {
          if (fixResult.success) {
            console.log(`\n   ✅ Fixed: ${path.relative(projectPath, fixResult.file)}`);
            fixResult.changes.forEach(change => {
              console.log(`      • ${change}`);
            });
          } else if (fixResult.errors && fixResult.errors.length > 0) {
            console.log(`\n   ❌ Failed: ${path.relative(projectPath, fixResult.file)}`);
            fixResult.errors.forEach(error => {
              console.log(`      • ${error}`);
            });
          }
        }
        
        console.log('\n');
      }
    }

    console.log('\n✅ Analysis complete!\n');
    console.log('💡 Next steps:');
    console.log('   1. Fix critical and high severity issues first');
    console.log('   2. Address medium and low severity issues');
    console.log('   3. Re-run polish check to verify fixes\n');

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }

  rl.close();
}

main();

