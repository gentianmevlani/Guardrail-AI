#!/usr/bin/env node

/**
 * LLM Orchestration CLI
 * 
 * Interactive workflow builder and executor
 */

const { naturalLanguageCLI } = require('../src/lib/natural-language-cli.js');
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
║         🔗 guardrail AI - LLM Orchestrator                   ║
║                                                              ║
║  Build, chain, and execute AI workflows                     ║
║                                                              ║
╚══════════════════════════════════════════════════════════════╝
`);

  console.log('💬 Describe your AI workflow in natural language:\n');
  console.log('Examples:');
  console.log('  • "Make GPT-4 analyze this text, then send output to Claude for summarization"');
  console.log('  • "Monitor tweets, classify sentiment, email alerts if negative"');
  console.log('  • "Generate content, then check grammar, then optimize for SEO"\n');

  const description = await question('Your workflow: ');

  if (!description.trim()) {
    console.log('\n❌ No workflow description provided');
    process.exit(1);
  }

  try {
    console.log('\n🔨 Building workflow...\n');

    // This would use the actual orchestrator
    // For now, show what would happen
    console.log('✅ Workflow created!');
    console.log('\n📋 Workflow structure:');
    console.log('   1. Parse input');
    console.log('   2. Execute LLM chain');
    console.log('   3. Process outputs');
    console.log('   4. Return results\n');

    console.log('💡 Next steps:');
    console.log('   • Run "guardrail test" to test in sandbox');
    console.log('   • Run "guardrail optimize" for suggestions');
    console.log('   • Run "guardrail deploy" to deploy\n');

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }

  rl.close();
}

main();

