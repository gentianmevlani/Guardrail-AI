#!/usr/bin/env node

/**
 * Watch Mode CLI
 * 
 * Real-time file watching and validation
 */

const { watchValidator } = require('../src/lib/watch-validator');
const path = require('path');

async function main() {
  const projectPath = process.argv[2] || process.cwd();
  
  console.log(`
╔══════════════════════════════════════════════════════════════╗
║                                                              ║
║            👀 guardrail Watch Mode                           ║
║                                                              ║
║  Watching for file changes and validating in real-time...   ║
║                                                              ║
╚══════════════════════════════════════════════════════════════╝
`);

  console.log(`Watching: ${projectPath}\n`);
  console.log('Press Ctrl+C to stop\n');

  try {
    await watchValidator.watch({
      projectPath,
      onFileChange: (file, result) => {
        // Results are already logged by watchValidator
      },
      onError: (error) => {
        console.error(`❌ Error: ${error.message}`);
      },
    });

    // Keep process alive
    process.on('SIGINT', () => {
      console.log('\n\n👋 Stopping watch mode...');
      watchValidator.stop();
      process.exit(0);
    });
  } catch (error) {
    console.error(`❌ Failed to start watch mode: ${error.message}`);
    process.exit(1);
  }
}

main();

