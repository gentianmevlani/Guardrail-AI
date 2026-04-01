#!/usr/bin/env node

/**
 * Get Enhanced Context for Code Generation
 * 
 * Generates comprehensive context to reduce hallucinations
 */

const { advancedContextManager } = require('../src/lib/advanced-context-manager');
const { cliUtils } = require('../src/lib/cli-utils');
const path = require('path');

async function main() {
  const projectPath = process.argv[2] || process.cwd();
  const file = process.argv[3];
  const purpose = process.argv[4] || 'code generation';

  cliUtils.section('🧠 Advanced Context Manager');

  try {
    cliUtils.info(`Generating context for: ${projectPath}`);
    if (file) {
      cliUtils.info(`File: ${file}`);
    }
    cliUtils.info(`Purpose: ${purpose}\n`);

    const prompt = await advancedContextManager.generatePrompt(projectPath, {
      file,
      purpose,
      maxLayers: 20,
    });

    cliUtils.section('Generated Context Prompt');
    console.log(prompt);

    cliUtils.success('\nContext generated! Use this prompt with your AI assistant.');

  } catch (error) {
    cliUtils.error(`Error: ${error.message}`);
    process.exit(1);
  }
}

main();

