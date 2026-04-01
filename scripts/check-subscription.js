#!/usr/bin/env node

/**
 * Check Subscription Status
 * 
 * Checks codebase size and subscription tier limits
 */

const { subscriptionTierManager } = require('../src/lib/subscription-tiers');
const { codebaseSizeTracker } = require('../src/lib/codebase-size');
const { usageTracker } = require('../src/lib/usage-tracker');
const path = require('path');

async function main() {
  const projectPath = process.argv[2] || process.cwd();
  const tier = (process.argv[3] || 'free').toLowerCase();

  console.log(`
╔══════════════════════════════════════════════════════════════╗
║                                                              ║
║            📊 Subscription Status Check                      ║
║                                                              ║
╚══════════════════════════════════════════════════════════════╝
`);

  console.log(`Project: ${projectPath}`);
  console.log(`Tier: ${tier}\n`);

  try {
    // Calculate codebase size
    console.log('📏 Calculating codebase size...\n');
    const metrics = await codebaseSizeTracker.calculateSize(projectPath);

    console.log('📊 Codebase Metrics:');
    console.log(`   Files: ${metrics.totalFiles.toLocaleString()}`);
    console.log(`   Lines: ${metrics.totalLines.toLocaleString()}`);
    console.log(`   Size: ${codebaseSizeTracker.formatSize(metrics.totalSize)}\n`);

    // Get tier limits
    const limits = subscriptionTierManager.getLimits(tier);
    console.log(`📋 ${tier.toUpperCase()} Tier Limits:`);
    console.log(`   Max Files: ${limits.maxFiles === Infinity ? 'Unlimited' : limits.maxFiles.toLocaleString()}`);
    console.log(`   Max Lines: ${limits.maxLines === Infinity ? 'Unlimited' : limits.maxLines.toLocaleString()}`);
    console.log(`   Max Size: ${limits.maxSize === Infinity ? 'Unlimited' : codebaseSizeTracker.formatSize(limits.maxSize)}`);
    console.log(`   Max Projects: ${limits.maxProjects === Infinity ? 'Unlimited' : limits.maxProjects}`);
    console.log(`   Price: $${limits.price}/month ($${limits.annualPrice}/year)\n`);

    // Check limits
    const check = await usageTracker.checkLimits(tier);

    if (check.withinLimits) {
      console.log('✅ Usage is within limits!\n');
    } else {
      console.log('❌ Usage exceeds limits:\n');
      if (check.exceeded.files) {
        console.log(`   ⚠️  Files: ${check.summary.totalFiles} > ${limits.maxFiles}`);
      }
      if (check.exceeded.lines) {
        console.log(`   ⚠️  Lines: ${check.summary.totalLines} > ${limits.maxLines}`);
      }
      if (check.exceeded.size) {
        console.log(`   ⚠️  Size: ${codebaseSizeTracker.formatSize(check.summary.totalSize)} > ${codebaseSizeTracker.formatSize(limits.maxSize)}`);
      }
      console.log(`\n💡 ${check.message}\n`);

      if (check.recommendedTier) {
        const recommendedLimits = subscriptionTierManager.getLimits(check.recommendedTier);
        console.log(`📈 Recommended Tier: ${check.recommendedTier.toUpperCase()}`);
        console.log(`   Price: $${recommendedLimits.price}/month ($${recommendedLimits.annualPrice}/year)\n`);
      }
    }

    // Show features
    console.log('✨ Features included:');
    limits.features.forEach((feature) => {
      console.log(`   • ${feature}`);
    });
    console.log('');

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

main();

