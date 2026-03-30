#!/usr/bin/env node

/**
 * Train ML Model
 * 
 * Trains the deep learning model on your codebase
 */

const { codebaseMLModel } = require('../src/lib/ml-model');
const path = require('path');

async function main() {
  console.log(`
╔══════════════════════════════════════════════════════════════╗
║                                                              ║
║         🧠 ML Model Training                                 ║
║                                                              ║
║  Trains deep learning model on your codebase patterns       ║
║                                                              ║
╚══════════════════════════════════════════════════════════════╝
`);

  const projectPath = process.argv[2] || process.cwd();
  console.log(`Project: ${projectPath}\n`);

  try {
    console.log('📊 Collecting training data...');
    console.log('🔍 Analyzing codebase patterns...');
    console.log('🧠 Training model...\n');

    await codebaseMLModel.train(projectPath);

    console.log('✅ Model trained successfully!\n');
    console.log('💡 The model has learned:');
    console.log('   • Your code patterns');
    console.log('   • Your conventions');
    console.log('   • Your architectural decisions');
    console.log('   • Your coding style\n');
    console.log('📁 Model saved to .ml-model/\n');

  } catch (error) {
    console.error('❌ Error:', error.message);
    if (error.message.includes('Knowledge base')) {
      console.log('\n💡 Run "npm run build-knowledge" first\n');
    }
    process.exit(1);
  }
}

main();

