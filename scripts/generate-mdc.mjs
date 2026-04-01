#!/usr/bin/env node
/**
 * CLI Script for Advanced MDC Generation (ES Module version - Fallback)
 * 
 * Usage:
 *   npm run generate-mdc [options]
 * 
 * This is a fallback script that runs when tsx is not available.
 */

import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const require = createRequire(import.meta.url);

// Use dynamic import with tsx to load TypeScript module
async function loadGenerator() {
  try {
    // Try using tsx/esm loader
    const { register } = await import('tsx/esm/api');
    register();
    
    // Now import the TypeScript module
    const module = await import('../src/lib/mdc-generator/mdc-generator.ts');
    return module;
  } catch (tsxError) {
    try {
      // Alternative: try tsx default export
      const tsxModule = await import('tsx');
      if (tsxModule.register) {
        tsxModule.register();
      } else if (tsxModule.default?.register) {
        tsxModule.default.register();
      }
      const module = await import('../src/lib/mdc-generator/mdc-generator.ts');
      return module;
    } catch (error2) {
      throw new Error(`Failed to load TypeScript module. Please run: npm install tsx && npx tsx scripts/generate-mdc.ts\nOriginal error: ${tsxError.message}`);
    }
  }
}

const args = process.argv.slice(2);

function parseArgs() {
  const options = {
    projectPath: process.cwd(),
    outputDir: path.join(process.cwd(), '.specs'),
    includeExamples: true,
    minImportanceScore: 70,
    depth: 'medium',
    categories: [],
    useASTParsing: true,
    semanticAnalysis: true,
  };

  let i = 0;
  while (i < args.length) {
    const arg = args[i];
    
    switch (arg) {
      case '--output':
      case '-o':
        options.outputDir = args[++i];
        break;
      case '--project':
      case '-p':
        options.projectPath = args[++i];
        break;
      case '--category':
      case '-c':
        if (!options.categories) options.categories = [];
        options.categories.push(args[++i]);
        break;
      case '--min-score':
        options.minImportanceScore = parseInt(args[++i]) || 70;
        break;
      case '--depth':
        options.depth = args[++i];
        break;
      case '--no-examples':
        options.includeExamples = false;
        break;
      case '--no-ast':
        options.useASTParsing = false;
        break;
      case '--no-semantic':
        options.semanticAnalysis = false;
        break;
      case '--help':
      case '-h':
        console.log(`
Advanced MDC Generator - Enhanced Codebase Documentation System

Usage:
  npm run generate-mdc [options]

Options:
  -p, --project <path>      Project root path (default: current directory)
  -o, --output <path>       Output directory (default: ./.specs)
  -c, --category <name>     Filter by category (architecture, algorithm, data-flow, etc.)
  --min-score <number>      Minimum importance score (default: 70)
  --depth <level>           Analysis depth: shallow, medium, deep (default: medium)
  --no-examples             Don't include code examples
  --no-ast                  Disable AST parsing (use regex fallback)
  --no-semantic             Disable semantic analysis
  -h, --help                Show this help message
        `);
        process.exit(0);
        break;
    }
    i++;
  }

  return options;
}

async function main() {
  try {
    console.log('🚀 Advanced MDC Generator\n');
    console.log('📦 Loading generator module...\n');
    
    const generatorModule = await loadGenerator();
    
    // Handle different export formats
    const AdvancedMDCGenerator = generatorModule.AdvancedMDCGenerator || generatorModule.default?.AdvancedMDCGenerator || generatorModule.default;
    
    if (!AdvancedMDCGenerator) {
      throw new Error('AdvancedMDCGenerator not found in module. Exports: ' + Object.keys(generatorModule).join(', '));
    }
    
    if (typeof AdvancedMDCGenerator !== 'function') {
      throw new Error('AdvancedMDCGenerator is not a constructor. Type: ' + typeof AdvancedMDCGenerator);
    }
    
    const options = parseArgs();
    
    const generator = new AdvancedMDCGenerator(options);
    const specs = await generator.generateAll();
    
    console.log('\n✅ Generation complete!');
    console.log(`📊 Generated ${specs.length} specification files`);
    console.log(`📁 Output: ${options.outputDir}`);
    
    if (specs.length > 0) {
      console.log('\n📋 Generated Specifications:');
      specs.forEach(spec => {
        console.log(`   • ${spec.fileName} (${spec.category}, score: ${spec.importanceScore})`);
      });
    }
    
  } catch (error) {
    console.error('❌ Error:', error instanceof Error ? error.message : error);
    if (error instanceof Error && error.stack) {
      console.error('\nStack trace:');
      console.error(error.stack);
    }
    console.error('\n💡 Tip: Make sure TypeScript dependencies are installed: npm install');
    console.error('   Or try: npm install -g tsx && tsx scripts/generate-mdc.ts\n');
    process.exit(1);
  }
}

main();
