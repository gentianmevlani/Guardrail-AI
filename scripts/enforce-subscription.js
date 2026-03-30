#!/usr/bin/env node

/**
 * Enforce Subscription Limits
 * 
 * Enforces subscription limits before operations
 */

const { usageTracker } = require('../src/lib/usage-tracker');
const path = require('path');

async function main() {
  const tier = (process.argv[2] || 'free').toLowerCase();

  try {
    await usageTracker.enforceLimits(tier);
    console.log('✅ Usage is within limits');
    process.exit(0);
  } catch (error) {
    console.error('❌', error.message);
    process.exit(1);
  }
}

main();

