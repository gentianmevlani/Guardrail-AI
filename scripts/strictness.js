#!/usr/bin/env node

/**
 * Strictness Configuration CLI
 * 
 * Configure AI agent strictness levels
 */

const { strictnessManager } = require('../src/lib/strictness-config.js');
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

async function main() {
  console.log(`
╔══════════════════════════════════════════════════════════════╗
║                                                              ║
║         🛡️  guardrail AI - Strictness Settings              ║
║                                                              ║
║  Control how strict your AI agent and build should be       ║
║                                                              ║
╚══════════════════════════════════════════════════════════════╝
`);

  const command = process.argv[2];

  if (command === 'set') {
    await setStrictness();
  } else if (command === 'show') {
    await showStrictness();
  } else if (command === 'test') {
    await testBuild();
  } else {
    console.log('Usage:');
    console.log('  guardrail strictness set   - Set strictness level');
    console.log('  guardrail strictness show  - Show current settings');
    console.log('  guardrail strictness test  - Test build with current settings');
    console.log('');
    console.log('Levels: relaxed, moderate, strict, maximum');
  }

  rl.close();
}

async function setStrictness() {
  const level = process.argv[3];

  if (!level || !['relaxed', 'moderate', 'strict', 'maximum'].includes(level)) {
    console.log('\n📋 Available levels:\n');
    console.log('  relaxed  - Build passes with warnings');
    console.log('  moderate - Blocks errors, allows warnings');
    console.log('  strict   - Blocks errors and warnings');
    console.log('  maximum  - Everything must be perfect\n');
    return;
  }

  strictnessManager.setLevel(level);
  console.log(`\n✅ Strictness level set to: ${level}\n`);
  
  const config = strictnessManager.getConfig();
  console.log('📋 Active rules:');
  Object.entries(config.rules).forEach(([key, value]) => {
    if (value) {
      console.log(`   ✅ ${key}`);
    }
  });
  console.log('');
}

async function showStrictness() {
  const config = strictnessManager.getConfig();
  
  console.log(`\n📊 Current Strictness: ${config.level.toUpperCase()}\n`);
  
  console.log('🔨 Build Rules:');
  console.log(`   Block on errors: ${config.rules.buildBlocksOnErrors ? '✅' : '❌'}`);
  console.log(`   Block on warnings: ${config.rules.buildBlocksOnWarnings ? '✅' : '❌'}`);
  console.log(`   Block on lint errors: ${config.rules.buildBlocksOnLintErrors ? '✅' : '❌'}`);
  console.log(`   Block on type errors: ${config.rules.buildBlocksOnTypeErrors ? '✅' : '❌'}`);
  
  console.log('\n📝 Code Quality:');
  console.log(`   Require tests: ${config.rules.requireTests ? '✅' : '❌'}`);
  console.log(`   Require documentation: ${config.rules.requireDocumentation ? '✅' : '❌'}`);
  console.log(`   Block "any" types: ${config.rules.blockAnyTypes ? '✅' : '❌'}`);
  
  console.log('\n🔒 Pre-Commit:');
  console.log(`   Block commits: ${config.rules.preCommitBlocks ? '✅' : '❌'}`);
  console.log(`   Require tests: ${config.rules.preCommitRequiresTests ? '✅' : '❌'}`);
  console.log(`   Require lint: ${config.rules.preCommitRequiresLint ? '✅' : '❌'}`);
  console.log('');
}

async function testBuild() {
  console.log('\n🧪 Testing build with current strictness settings...\n');
  
  const { buildEnforcer } = require('../src/lib/build-enforcer.js');
  const result = await buildEnforcer.enforceBuild();

  if (result.blocked) {
    console.log(`❌ Build would be BLOCKED\n`);
    console.log(`Reason: ${result.reason}\n`);
    console.log(`Issues found:`);
    if (result.lintErrors > 0) console.log(`   • ${result.lintErrors} ESLint error(s)`);
    if (result.typeErrors > 0) console.log(`   • ${result.typeErrors} TypeScript error(s)`);
    if (result.warnings > 0) console.log(`   • ${result.warnings} warning(s)`);
    console.log('');
  } else {
    console.log(`✅ Build would PASS\n`);
    console.log(`No blocking issues found.\n`);
  }
}

main();

