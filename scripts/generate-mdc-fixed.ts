#!/usr/bin/env node
/**
 * Fixed CLI Script for Advanced MDC Generation
 */

import * as path from 'path';
import * as fs from 'fs/promises';
import { AdvancedMDCGenerator, MDCGenerationOptions } from '../src/lib/mdc-generator/mdc-generator';

const args = process.argv.slice(2);

function parseArgs(): MDCGenerationOptions {
  console.log('🔍 Raw arguments:', args);
  
  const options: MDCGenerationOptions = {
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
    
    // Handle positional argument (project path)
    if (!arg.startsWith('-') && i === 0) {
      options.projectPath = path.resolve(arg);
      console.log(`📁 Project path set to: ${options.projectPath}`);
      i++;
      continue;
    }
    
    // Handle flags
    switch (arg) {
      case '--output':
      case '-o':
        options.outputDir = args[++i];
        break;
        
      case '--project':
      case '-p':
        options.projectPath = path.resolve(args[++i]);
        break;
        
      case '--category':
      case '-c':
        if (!options.categories) options.categories = [];
        options.categories.push(args[++i]);
        break;
        
      case '--min-score':
        options.minImportanceScore = parseInt(args[++i]) || 70;
        console.log(`🔢 Set min importance score to: ${options.minImportanceScore}`);
        break;
        
      case '--depth':
        options.depth = args[++i] as 'shallow' | 'medium' | 'deep';
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
        printHelp();
        process.exit(0);
        break;
    }
    i++;
  }
  
  console.log('📋 Parsed options:', JSON.stringify(options, null, 2));
  return options;
}

function printHelp() {
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

Examples:
  npm run generate-mdc
  npm run generate-mdc -- --category architecture --category security
  npm run generate-mdc -- --min-score 80 --depth deep
  npm run generate-mdc -- --output ./docs/specs
`);
}

async function main() {
  try {
    const options = parseArgs();
    
    // Verify project path exists
    try {
      await fs.access(options.projectPath);
    } catch {
      console.error(`❌ Project path does not exist: ${options.projectPath}`);
      process.exit(1);
    }
    
    console.log('\n🚀 Advanced MDC Generator\n');
    
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
    process.exit(1);
  }
}

main();
