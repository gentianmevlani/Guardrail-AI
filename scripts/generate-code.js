#!/usr/bin/env node

/**
 * Context-Aware Code Generation
 * 
 * Generates code that follows your project's patterns
 */

const { codeGenerator } = require('../src/lib/code-generator');
const path = require('path');
const fs = require('fs');

async function main() {
  const task = process.argv[2];
  const projectPath = process.argv[3] || process.cwd();

  if (!task) {
    console.log('Usage: npm run generate-code "<task>" [project-path]\n');
    console.log('Example: npm run generate-code "Create a user authentication hook"\n');
    process.exit(1);
  }

  console.log(`
╔══════════════════════════════════════════════════════════════╗
║                                                              ║
║            ✨ Context-Aware Code Generation                  ║
║                                                              ║
╚══════════════════════════════════════════════════════════════╝
`);

  console.log(`Task: ${task}\n`);

  try {
    console.log('🧠 Building context...\n');
    const prompt = await codeGenerator.generatePrompt(task, projectPath);

    console.log('📝 GENERATION PROMPT\n');
    console.log('---');
    console.log(prompt);
    console.log('---\n');

    console.log('💡 Use this prompt with your AI assistant for code that matches your project!\n');
    console.log('💾 Save to file? (y/n): ');

    // For now, just output the prompt
    // In production, could integrate with AI API directly

  } catch (error) {
    console.error('❌ Error:', error.message);
    if (error.message.includes('Knowledge base')) {
      console.log('\n💡 Run "npm run build-knowledge" first\n');
    }
    process.exit(1);
  }
}

main();

