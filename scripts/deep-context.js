#!/usr/bin/env node

/**
 * Deep Context Agent
 * 
 * Get project-specific context for AI assistance
 */

const { deepContextAgent } = require('../src/lib/deep-context-agent');
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
║            🧠 Deep Context Agent                             ║
║                                                              ║
║  Project-specific AI with deeper codebase understanding     ║
║                                                              ║
╚══════════════════════════════════════════════════════════════╝
`);

  const projectPath = process.argv[2] || process.cwd();
  const query = process.argv[3];

  if (!query) {
    console.log('Usage: npm run deep-context "<your question>"\n');
    console.log('Example: npm run deep-context "How do I add a new API endpoint?"\n');
    rl.close();
    return;
  }

  try {
    console.log(`Query: ${query}\n`);
    console.log('🧠 Building context...\n');

    await deepContextAgent.initialize(projectPath);
    const response = await deepContextAgent.getContext(query, projectPath);

    console.log('📊 UNDERSTANDING\n');
    console.log(response.understanding.architecture);
    console.log(`\nPatterns: ${response.understanding.patterns.join(', ')}`);
    if (response.understanding.conventions.length > 0) {
      console.log(`Conventions: ${response.understanding.conventions.join(', ')}`);
    }
    console.log('');

    if (response.recommendations.length > 0) {
      console.log('💡 RECOMMENDATIONS\n');
      response.recommendations.forEach((rec, i) => {
        const icon = {
          pattern: '🔷',
          convention: '📋',
          improvement: '✨',
          warning: '⚠️',
        }[rec.type] || '•';
        console.log(`   ${i + 1}. ${icon} ${rec.message}`);
        console.log(`      ${rec.context}`);
        if (rec.files && rec.files.length > 0) {
          console.log(`      Files: ${rec.files.slice(0, 3).join(', ')}`);
        }
        console.log('');
      });
    }

    if (response.suggestions.length > 0) {
      console.log('✨ SUGGESTIONS\n');
      response.suggestions.forEach((suggestion, i) => {
        console.log(`   ${i + 1}. ${suggestion}`);
      });
      console.log('');
    }

    console.log('📝 CONTEXT FOR AI\n');
    console.log('---');
    console.log(response.context);
    console.log('---\n');

    console.log('💡 Use this context when asking AI assistants for better, project-specific answers!\n');

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }

  rl.close();
}

main();

