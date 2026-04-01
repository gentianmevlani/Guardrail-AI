#!/usr/bin/env node

/**
 * Build Codebase Knowledge
 * 
 * Creates deep understanding of your codebase
 */

const { codebaseKnowledgeBase } = require('../src/lib/codebase-knowledge');
const path = require('path');

async function main() {
  console.log(`
╔══════════════════════════════════════════════════════════════╗
║                                                              ║
║            🧠 Building Codebase Knowledge                    ║
║                                                              ║
║  Creating deep understanding of your codebase...            ║
║                                                              ║
╚══════════════════════════════════════════════════════════════╝
`);

  const projectPath = process.argv[2] || process.cwd();
  console.log(`Project: ${projectPath}\n`);

  try {
    console.log('🔍 Analyzing codebase structure...');
    console.log('📊 Detecting patterns...');
    console.log('🔗 Mapping relationships...');
    console.log('💭 Building context memory...\n');

    const knowledge = await codebaseKnowledgeBase.buildKnowledge(projectPath);

    console.log('✅ Knowledge base built!\n');
    console.log('📊 Summary:\n');
    console.log(`   Architecture: ${knowledge.architecture.structure.type}`);
    console.log(`   Frontend: ${knowledge.architecture.techStack.frontend.join(', ') || 'None'}`);
    console.log(`   Backend: ${knowledge.architecture.techStack.backend.join(', ') || 'None'}`);
    console.log(`   Patterns detected: ${knowledge.patterns.length}`);
    console.log(`   Decisions tracked: ${knowledge.decisions.length}`);
    console.log(`   Files analyzed: ${knowledge.relationships.imports.size}`);
    console.log(`   Active features: ${knowledge.context.activeFeatures.length}\n`);

    console.log('💡 This knowledge base enables:');
    console.log('   • Context-aware AI assistance');
    console.log('   • Pattern recognition');
    console.log('   • Convention enforcement');
    console.log('   • Architecture understanding\n');

    console.log('✅ Knowledge saved to .codebase-knowledge.json\n');

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

main();

