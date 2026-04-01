#!/usr/bin/env node

/**
 * Complete Setup Script
 * 
 * One command to set up everything
 */

const { execSync } = require('child_process');
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
║         🚀 Complete AI Agent Guardrails Setup               ║
║                                                              ║
║  One command to set up everything you need!                  ║
║                                                              ║
╚══════════════════════════════════════════════════════════════╝
`);

  const projectPath = process.cwd();
  console.log(`Project: ${projectPath}\n`);

  try {
    // Step 1: Basic setup
    console.log('📦 Step 1: Basic setup...\n');
    try {
      execSync('npm run setup', { stdio: 'inherit', cwd: projectPath });
    } catch (error) {
      console.log('⚠️  Setup already done or skipped\n');
    }

    // Step 2: Build knowledge base
    console.log('🧠 Step 2: Building knowledge base...\n');
    const buildKnowledge = await question('Build codebase knowledge base? (yes/no, default: yes): ');
    if (buildKnowledge.toLowerCase() !== 'no') {
      try {
        execSync('npm run build-knowledge', { stdio: 'inherit', cwd: projectPath });
      } catch (error) {
        console.log('⚠️  Knowledge base build had issues, continuing...\n');
      }
    }

    // Step 3: Sync decisions
    console.log('📝 Step 3: Syncing decisions...\n');
    const syncDecisions = await question('Extract decisions from git and comments? (yes/no, default: yes): ');
    if (syncDecisions.toLowerCase() !== 'no') {
      try {
        execSync('npm run sync-decisions', { stdio: 'inherit', cwd: projectPath });
      } catch (error) {
        console.log('⚠️  Decision sync had issues, continuing...\n');
      }
    }

    // Step 4: Architect agent
    console.log('🏗️  Step 4: Architect agent analysis...\n');
    const runArchitect = await question('Run architect agent to set up templates? (yes/no, default: yes): ');
    if (runArchitect.toLowerCase() !== 'no') {
      try {
        execSync('npm run architect', { stdio: 'inherit', cwd: projectPath });
      } catch (error) {
        console.log('⚠️  Architect agent had issues, continuing...\n');
      }
    }

    // Step 5: Polish check
    console.log('✨ Step 5: Polish check...\n');
    const runPolish = await question('Run polish service to find missing details? (yes/no, default: yes): ');
    if (runPolish.toLowerCase() !== 'no') {
      try {
        execSync('npm run polish', { stdio: 'inherit', cwd: projectPath });
      } catch (error) {
        console.log('⚠️  Polish check had issues, continuing...\n');
      }
    }

    // Summary
    console.log('\n✅ Setup Complete!\n');
    console.log('📚 Next steps:');
    console.log('   1. Review applied templates');
    console.log('   2. Customize as needed');
    console.log('   3. Start building!\n');
    console.log('💡 Useful commands:');
    console.log('   • npm run deep-context "your question"');
    console.log('   • npm run semantic-search "what you need"');
    console.log('   • npm run analyze-impact file.ts');
    console.log('   • npm run generate-code "task description"\n');

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }

  rl.close();
}

main();

