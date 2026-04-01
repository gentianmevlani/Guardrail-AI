#!/usr/bin/env node

/**
 * Framework Detector CLI
 */

const { frameworkDetector } = require('../src/lib/framework-detector');
const { cliUtils } = require('../src/lib/cli-utils');
const path = require('path');

async function main() {
  const projectPath = process.argv[2] || process.cwd();

  cliUtils.section('🔍 Framework Detector');

  try {
    cliUtils.info(`Detecting frameworks in: ${projectPath}\n`);

    const structure = await frameworkDetector.detect(projectPath);

    cliUtils.section('Detected Frameworks');
    for (const framework of structure.frameworks.filter(f => f.detected)) {
      console.log(`\n${framework.name}${framework.version ? ` v${framework.version}` : ''}`);
      console.log(`  Type: ${framework.type}`);
      console.log(`  Confidence: ${(framework.confidence * 100).toFixed(0)}%`);
      if (framework.patterns.length > 0) {
        console.log(`  Patterns: ${framework.patterns.join(', ')}`);
      }
      if (framework.configFiles.length > 0) {
        console.log(`  Config: ${framework.configFiles.join(', ')}`);
      }
    }

    cliUtils.section('Project Structure');
    console.log(`Architecture: ${structure.architecture}`);
    console.log(`Languages: ${structure.languages.join(', ')}`);
    console.log(`Build Tools: ${structure.buildTools.join(', ')}`);
    console.log(`Test Frameworks: ${structure.testFrameworks.join(', ')}`);
    console.log(`Package Managers: ${structure.packageManagers.join(', ')}`);

    cliUtils.success('\nFramework detection complete!');

  } catch (error) {
    cliUtils.error(`Error: ${error.message}`);
    process.exit(1);
  }
}

main();

