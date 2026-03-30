#!/usr/bin/env node

/**
 * Status Check
 * 
 * Shows system health and status
 */

const { healthChecker } = require('../src/lib/health-checker.js');
const { performanceMonitor } = require('../src/lib/performance-monitor.js');
const { usageAnalytics } = require('../src/lib/usage-analytics.js');
const { errorRecovery } = require('../src/lib/error-recovery.js');

async function main() {
  console.log(`
╔══════════════════════════════════════════════════════════════╗
║                                                              ║
║         📊 guardrail AI - System Status                     ║
║                                                              ║
╚══════════════════════════════════════════════════════════════╝
`);

  // Health check
  console.log('🏥 Health Status\n');
  const health = await healthChecker.checkHealth();
  const healthIcon = health.status === 'healthy' ? '✅' : health.status === 'degraded' ? '⚠️' : '❌';
  console.log(`   ${healthIcon} Overall: ${health.status.toUpperCase()}\n`);

  for (const check of health.checks) {
    const icon = check.status === 'pass' ? '✅' : check.status === 'warn' ? '⚠️' : '❌';
    console.log(`   ${icon} ${check.name}: ${check.message}`);
  }

  // Performance
  console.log('\n⚡ Performance\n');
  const perfSummary = performanceMonitor.getSummary();
  console.log(`   Total Commands: ${perfSummary.totalCommands}`);
  console.log(`   Successful: ${perfSummary.successful}`);
  console.log(`   Failed: ${perfSummary.failed}`);
  console.log(`   Average Duration: ${perfSummary.averageDuration.toFixed(0)}ms`);

  const insights = performanceMonitor.getInsights();
  if (insights.recommendations.length > 0) {
    console.log('\n   💡 Recommendations:');
    insights.recommendations.forEach(rec => {
      console.log(`      • ${rec}`);
    });
  }

  // Usage
  console.log('\n📈 Usage Insights\n');
  const usage = usageAnalytics.getInsights();
  console.log(`   Total Commands: ${usage.totalCommands}`);
  console.log(`   Error Rate: ${usage.errorRate.toFixed(1)}%`);
  console.log(`   Session Duration: ${usage.averageSessionDuration.toFixed(1)} minutes`);

  if (usage.mostUsedCommands.length > 0) {
    console.log('\n   Most Used Commands:');
    usage.mostUsedCommands.slice(0, 5).forEach(cmd => {
      console.log(`      • ${cmd.command}: ${cmd.count} times`);
    });
  }

  if (usage.recommendations.length > 0) {
    console.log('\n   💡 Suggestions:');
    usage.recommendations.forEach(rec => {
      console.log(`      • ${rec}`);
    });
  }

  // Errors
  console.log('\n🔍 Recent Errors\n');
  const recentErrors = errorRecovery.getErrorHistory(5);
  if (recentErrors.length === 0) {
    console.log('   ✅ No recent errors!');
  } else {
    recentErrors.forEach(err => {
      console.log(`   ❌ ${err.command}: ${err.error.message}`);
      if (err.recovery && err.recovery.length > 0) {
        console.log(`      💡 ${err.recovery[0].description}`);
      }
    });
  }

  console.log('\n');
}

main();

