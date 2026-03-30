#!/usr/bin/env node

/**
 * Framework Integration CLI
 */

const { frameworkIntegrationManager } = require('../src/lib/framework-integration-manager');
const { cliUtils } = require('../src/lib/cli-utils');
const path = require('path');
const fs = require('fs');

async function main() {
  const projectPath = process.argv[2] || process.cwd();
  const output = process.argv[3];

  cliUtils.section('🔗 Framework Integration Manager');

  try {
    cliUtils.info(`Integrating with frameworks in: ${projectPath}\n`);

    const integration = await frameworkIntegrationManager.integrate(projectPath);

    cliUtils.section('Detected Frameworks');
    for (const detected of integration.detected) {
      console.log(`\n${detected.framework}${detected.version ? ` v${detected.version}` : ''}`);
      console.log(`  Type: ${detected.type}`);
      console.log(`  Confidence: ${(detected.confidence * 100).toFixed(0)}%`);
    }

    cliUtils.section('Framework Integrations');
    for (const integrationItem of integration.integrations) {
      console.log(`\n${integrationItem.framework}:`);
      console.log(`  Optimizations: ${integrationItem.optimizations.length}`);
      console.log(`  Patterns: ${integrationItem.patterns.length}`);
      
      if (integrationItem.optimizations.length > 0) {
        console.log(`  Available Optimizations:`);
        integrationItem.optimizations.forEach(opt => {
          console.log(`    • ${opt.type}: ${opt.description}`);
        });
      }
    }

    if (integration.recommendations.length > 0) {
      cliUtils.section('Recommendations');
      integration.recommendations.forEach(rec => {
        console.log(`  • ${rec}`);
      });
    }

    if (output) {
      await fs.promises.writeFile(output, integration.context, 'utf8');
      cliUtils.success(`\nContext written to: ${output}`);
    } else {
      cliUtils.info('\nUse output path to save context');
    }

    cliUtils.success('\nIntegration complete!');

  } catch (error) {
    cliUtils.error(`Error: ${error.message}`);
    process.exit(1);
  }
}

main();

