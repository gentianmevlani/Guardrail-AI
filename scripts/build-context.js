#!/usr/bin/env node

/**
 * Build Full-Codebase Context
 * 
 * Scans entire codebase and generates context files for AI assistants
 */

const { contextManager } = require('../src/lib/context-manager.js');
const { contextGenerator } = require('../src/lib/context-generator.js');
const path = require('path');

async function main() {
  console.log(`
╔══════════════════════════════════════════════════════════════╗
║                                                              ║
║         🧠 GUARDRAIL AI - Context Builder                  ║
║                                                              ║
║  Building full-codebase context for AI assistants           ║
║                                                              ║
╚══════════════════════════════════════════════════════════════╝
`);

  const projectPath = process.argv[2] || process.cwd();
  console.log(`Project: ${projectPath}\n`);

  try {
    // Scan codebase
    console.log('📊 Step 1: Scanning entire codebase...');
    const projectMap = await contextManager.scanCodebase();
    console.log(`   ✅ Scanned ${projectMap.metadata.totalFiles} files`);
    console.log(`   ✅ Found ${projectMap.endpoints.length} endpoints`);
    console.log(`   ✅ Found ${projectMap.dataStructures.length} data structures`);
    console.log(`   ✅ Detected ${projectMap.patterns.length} patterns\n`);

    // Generate context files
    console.log('📝 Step 2: Generating context files...');
    const contextFiles = await contextGenerator.generateAll(projectMap);
    console.log(`   ✅ Generated ${contextFiles.length} context files:`);
    contextFiles.forEach(file => {
      console.log(`      • ${file.name} (${file.target})`);
    });

    // Generate IDE integration
    console.log('\n🔌 Step 3: Setting up IDE integration...');
    await contextGenerator.generateIDEIntegration();
    console.log('   ✅ IDE integration configured\n');

    // Summary
    console.log('✨ Context build complete!\n');
    console.log('📋 Generated files:');
    console.log('   • .GUARDRAIL/context.json - Universal context');
    console.log('   • .GUARDRAIL/.cursorrules - Cursor context');
    console.log('   • .GUARDRAIL/copilot-context.md - Copilot context');
    console.log('   • .GUARDRAIL/claude-context.json - Claude context');
    console.log('   • .GUARDRAIL/rules.md - Project rules');
    console.log('   • .GUARDRAIL/project-map.json - Full project map\n');

    console.log('💡 Next steps:');
    console.log('   1. The context files are ready for your AI assistant');
    console.log('   2. Cursor will automatically use .cursorrules');
    console.log('   3. Run "GUARDRAIL context" again when codebase changes');
    console.log('   4. Your AI assistant now has full project awareness!\n');

    console.log('📊 Project Summary:');
    console.log(`   Architecture: ${projectMap.architecture.type}`);
    console.log(`   Framework: ${projectMap.metadata.framework || 'Unknown'}`);
    console.log(`   Languages: ${projectMap.metadata.languages.join(', ')}`);
    console.log(`   Total Lines: ${projectMap.metadata.totalLines.toLocaleString()}\n`);

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

main();

