#!/usr/bin/env node

/**
 * Code Relationship Visualizer CLI
 */

const { codeRelationshipVisualizer } = require('../src/lib/code-relationship-visualizer');
const { cliUtils } = require('../src/lib/cli-utils');
const path = require('path');
const fs = require('fs');

async function main() {
  const projectPath = process.argv[2] || process.cwd();
  const format = process.argv[3] || 'json';
  const output = process.argv[4];

  cliUtils.section('🕸️  Code Relationship Visualization');

  try {
    cliUtils.info(`Generating relationship graph for: ${projectPath}\n`);

    const graph = await codeRelationshipVisualizer.generateGraph(projectPath, {
      depth: 2,
      includeTypes: ['file', 'function', 'class'],
      minConnections: 1,
    });

    cliUtils.success(`Generated graph with ${graph.nodes.length} nodes and ${graph.edges.length} edges`);

    // Detect circular dependencies
    const cycles = codeRelationshipVisualizer.detectCircularDependencies(graph);
    if (cycles.length > 0) {
      cliUtils.warning(`Found ${cycles.length} circular dependency(ies):`);
      cycles.forEach((cycle, i) => {
        console.log(`  ${i + 1}. ${cycle.join(' → ')}`);
      });
    }

    // Find hubs
    const hubs = codeRelationshipVisualizer.findHubs(graph, 5);
    if (hubs.length > 0) {
      cliUtils.info(`Most connected files (hubs):`);
      hubs.forEach((hub, i) => {
        console.log(`  ${i + 1}. ${hub.label} (${hub.metadata?.imports || 0} connections)`);
      });
    }

    // Export graph
    const exported = await codeRelationshipVisualizer.exportGraph(graph, format);
    
    if (output) {
      await fs.promises.writeFile(output, exported);
      cliUtils.success(`Graph exported to: ${output}`);
    } else {
      console.log('\n' + exported);
    }

  } catch (error) {
    cliUtils.error(`Error: ${error.message}`);
    process.exit(1);
  }
}

main();

