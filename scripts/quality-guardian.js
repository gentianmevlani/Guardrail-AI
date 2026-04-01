#!/usr/bin/env node

/**
 * Real-Time Code Quality Guardian CLI
 * Live monitoring with instant feedback
 */

const { realTimeCodeQualityGuardian } = require('../src/lib/realtime-quality-guardian');
const fs = require('fs').promises;
const path = require('path');

async function main() {
  const args = process.argv.slice(2);
  const command = args[0];

  if (!command || command === 'help') {
    showHelp();
    return;
  }

  try {
    switch (command) {
      case 'watch':
        const file = args[1];
        if (!file) {
          console.error('❌ Please provide a file path');
          process.exit(1);
        }
        await watchFile(file);
        break;

      case 'analyze':
        const analyzeFile = args[1];
        if (!analyzeFile) {
          console.error('❌ Please provide a file path');
          process.exit(1);
        }
        await analyzeFile(analyzeFile);
        break;

      case 'autofix':
        const fixFile = args[1];
        if (!fixFile) {
          console.error('❌ Please provide a file path');
          process.exit(1);
        }
        await autofixFile(fixFile);
        break;

      default:
        console.error(`❌ Unknown command: ${command}`);
        showHelp();
        process.exit(1);
    }
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

async function watchFile(file) {
  const fullPath = path.resolve(file);
  
  console.log(`👁️  Watching ${file} for changes...\n`);
  console.log('Press Ctrl+C to stop\n');

  let lastFeedback = null;

  await realTimeCodeQualityGuardian.startMonitoring(fullPath, (feedback) => {
    // Only update if score changed significantly
    if (!lastFeedback || Math.abs(lastFeedback.score - feedback.score) > 5) {
      console.clear();
      displayFeedback(feedback, file);
      lastFeedback = feedback;
    }
  });

  // Keep process alive
  await new Promise(() => {});
}

async function analyzeFile(file) {
  const fullPath = path.resolve(file);
  const code = await fs.readFile(fullPath, 'utf-8');

  console.log(`🔍 Analyzing ${file}...\n`);

  const feedback = await realTimeCodeQualityGuardian.analyzeInRealTime(code, fullPath);
  
  displayFeedback(feedback, file);
}

async function autofixFile(file) {
  const fullPath = path.resolve(file);
  const code = await fs.readFile(fullPath, 'utf-8');

  console.log(`🔧 Auto-fixing ${file}...\n`);

  const feedback = await realTimeCodeQualityGuardian.analyzeInRealTime(code, fullPath);
  
  const fixableIssues = feedback.issues.filter(i => i.autoFixAvailable);
  
  if (fixableIssues.length === 0) {
    console.log('✅ No auto-fixable issues found');
    return;
  }

  console.log(`Found ${fixableIssues.length} auto-fixable issues:\n`);
  
  fixableIssues.forEach((issue, idx) => {
    console.log(`${idx + 1}. Line ${issue.line}: ${issue.message}`);
  });

  console.log('\n🔧 Applying fixes...');

  const fixedCode = await realTimeCodeQualityGuardian.applyAllAutoFixes(code, fixableIssues);

  // Write back to file
  await fs.writeFile(fullPath, fixedCode);

  console.log('✅ Auto-fixes applied successfully');
}

function displayFeedback(feedback, file) {
  const scoreColor = feedback.score >= 80 ? '🟢' : feedback.score >= 60 ? '🟡' : '🔴';
  
  console.log(`📊 Quality Score: ${scoreColor} ${feedback.score}/100`);
  console.log(`📁 File: ${file}\n`);

  console.log('📈 Metrics:');
  console.log(`   Complexity: ${feedback.metrics.complexity}`);
  console.log(`   Maintainability: ${feedback.metrics.maintainability}/100`);
  console.log(`   Security: ${feedback.metrics.security}/100`);
  console.log(`   Performance: ${feedback.metrics.performance}/100\n`);

  if (feedback.issues.length > 0) {
    console.log(`⚠️  Issues (${feedback.issues.length}):\n`);

    const grouped = {
      critical: feedback.issues.filter(i => i.severity === 'critical'),
      error: feedback.issues.filter(i => i.severity === 'error'),
      warning: feedback.issues.filter(i => i.severity === 'warning'),
      info: feedback.issues.filter(i => i.severity === 'info'),
    };

    Object.entries(grouped).forEach(([severity, issues]) => {
      if (issues.length > 0) {
        const icon = {
          critical: '🔴',
          error: '🟠',
          warning: '🟡',
          info: '🔵',
        }[severity];

        console.log(`${icon} ${severity.toUpperCase()} (${issues.length}):`);
        issues.slice(0, 5).forEach(issue => {
          console.log(`   Line ${issue.line}: ${issue.message}`);
          console.log(`   💡 ${issue.suggestion}`);
          if (issue.autoFixAvailable) {
            console.log(`   🔧 Auto-fix available`);
          }
          console.log('');
        });
      }
    });
  } else {
    console.log('✅ No issues found!\n');
  }

  if (feedback.suggestions.length > 0) {
    console.log('💡 Suggestions:');
    feedback.suggestions.forEach(suggestion => {
      console.log(`   - ${suggestion}`);
    });
    console.log('');
  }

  if (feedback.preventionTips.length > 0) {
    console.log('🛡️  Prevention Tips:');
    feedback.preventionTips.forEach(tip => {
      console.log(`   - ${tip}`);
    });
  }
}

function showHelp() {
  console.log(`
👁️  Real-Time Code Quality Guardian

Live monitoring with instant feedback on quality, security, and best practices.

Commands:
  watch <file>      Watch a file for real-time quality feedback
  analyze <file>    Analyze a file once
  autofix <file>    Automatically fix issues
  help              Show this help message

Examples:
  npm run guardian watch src/api/users.ts
  npm run guardian analyze src/utils.ts
  npm run guardian autofix src/components/Button.tsx

Features:
  ✅ Real-time monitoring as you code
  ✅ Instant quality feedback
  ✅ Security vulnerability detection
  ✅ Performance issue warnings
  ✅ Auto-fix for common issues
  ✅ Prevention tips and suggestions

This is a UNIQUE feature - monitors quality LIVE as you type!
  `);
}

main().catch(console.error);
