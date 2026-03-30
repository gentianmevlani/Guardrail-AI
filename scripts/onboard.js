#!/usr/bin/env node

/**
 * Interactive Onboarding
 * 
 * Friendly, step-by-step setup guide
 */

const { interactiveOnboarding } = require('../src/lib/interactive-onboarding');

async function main() {
  const projectPath = process.argv[2] || process.cwd();
  await interactiveOnboarding.startOnboarding(projectPath);
}

main();

