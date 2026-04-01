#!/usr/bin/env node
// bin/runners/runMdc.ts

import { spawn } from "child_process";
import { existsSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Simple chalk replacement since we can't import it in CommonJS context
const colors = {
  cyan: (text: string) => `\x1b[36m${text}\x1b[0m`,
  green: (text: string) => `\x1b[32m${text}\x1b[0m`,
  yellow: (text: string) => `\x1b[33m${text}\x1b[0m`,
  red: (text: string) => `\x1b[31m${text}\x1b[0m`,
};

interface MDCOptions {
  projectPath?: string;
  output?: string;
  categories?: string;
  minImportance?: number;
  depth?: 'shallow' | 'medium' | 'deep';
  examples?: boolean;
  ast?: boolean;
  semantic?: boolean;
  help?: boolean;
  v3?: boolean; // Use v3 generator
  baseRef?: string; // Git base ref for change-aware mode
  noRealityScan?: boolean; // Skip reality scan
}

function parseArgs(args: string[]): MDCOptions {
  const options: MDCOptions = {};
  
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    const nextArg = args[i + 1];
    
    switch (arg) {
      case '--output':
      case '-o':
        options.output = nextArg;
        i++;
        break;
      case '--categories':
      case '-c':
        options.categories = nextArg;
        i++;
        break;
      case '--min-importance':
      case '-m':
        options.minImportance = parseInt(nextArg) || 70;
        i++;
        break;
      case '--depth':
      case '-d':
        options.depth = nextArg as 'shallow' | 'medium' | 'deep';
        i++;
        break;
      case '--no-examples':
        options.examples = false;
        break;
      case '--no-ast':
        options.ast = false;
        break;
      case '--no-semantic':
        options.semantic = false;
        break;
      case '--v3':
        options.v3 = true;
        break;
      case '--base-ref':
        options.baseRef = nextArg;
        i++;
        break;
      case '--no-reality-scan':
        options.noRealityScan = true;
        break;
      case '--help':
      case '-h':
        options.help = true;
        break;
      default:
        if (!arg.startsWith('-') && !options.projectPath) {
          options.projectPath = arg;
        }
    }
  }
  
  return options;
}

function showHelp() {
  console.log(`
🚀 guardrail MDC Generator - Advanced Codebase Documentation

Usage: guardrail mdc [path] [options]

Arguments:
  path                    Project path to analyze (default: current directory)

Options:
  -o, --output <dir>      Output directory for MDC files (default: .specs)
  -c, --categories <list>  Comma-separated categories to generate
                          (architecture,security,data-flow,design-system,
                           integration,algorithm,utility)
  -m, --min-importance <n> Minimum importance score (default: 70)
  -d, --depth <level>      Analysis depth: shallow|medium|deep (default: medium)
  --no-examples           Skip code examples
  --no-ast                Disable AST parsing (use regex only)
  --no-semantic           Disable semantic analysis
  --v3                    Use MDC Generator v3 (change-aware, lane-based packs)
  --base-ref <ref>        Git base ref for change-aware mode (default: main/master)
  --no-reality-scan       Skip reality scan in v3 mode
  -h, --help              Show this help message

Examples:
  guardrail mdc                          # Analyze current directory
  guardrail mdc ./src                    # Analyze src directory
  guardrail mdc --output docs/specs     # Custom output directory
  guardrail mdc --categories architecture,security  # Specific categories
  guardrail mdc --min-importance 80     # Higher importance threshold
  guardrail mdc --depth deep            # Deep analysis
  guardrail mdc --v3                     # Use v3 generator (change-aware, lane-based)
  guardrail mdc --v3 --base-ref main    # v3 with custom base ref

Output:
  • Generates .mdc files with comprehensive documentation
  • Creates specifications.json index
  • Includes component analysis, patterns, relationships
  • Source-anchored with line numbers and verification

Categories:
  architecture     System architecture and structural components
  security         Authentication, authorization, security mechanisms
  data-flow        Data processing and flow components
  design-system    UI components and design tokens
  integration      API integrations and external services
  algorithm        Core algorithms and processing logic
  utility          Helper functions and utilities

${colors.cyan('Learn more:')} https://docs.guardrail.io/mdc-generator
`);
}

async function runMDCGenerator(projectPath: string, options: MDCOptions): Promise<number> {
  // If v3 mode, use v3 generator directly
  if (options.v3) {
    try {
      const { MDCGeneratorV3 } = await import('../../src/lib/mdc-generator/v3/mdc-generator-v3');
      const generator = new MDCGeneratorV3({
        projectPath,
        outputDir: options.output,
        baseRef: options.baseRef,
        runRealityScan: !options.noRealityScan,
      });
      
      const result = await generator.generate();
      
      console.log('\n✅ MDC v3 generation completed!');
      console.log(`📦 Generated ${result.packs.length} pack(s):`);
      result.packs.forEach(pack => {
        console.log(`   • ${pack.fileName} (${pack.lane})`);
      });
      
      if (result.realityScanResult) {
        console.log(`\n🔬 Reality Scan: ${result.realityScanResult.verdict}`);
        console.log(`   Findings: ${result.realityScanResult.findings}, Blockers: ${result.realityScanResult.blockers}`);
      }
      
      return 0;
    } catch (error: any) {
      console.error('❌ MDC v3 generation failed:', error.message);
      if (error.stack) {
        console.error(error.stack);
      }
      return 1;
    }
  }

  // Build arguments for the npm script (will be passed after '--')
  const scriptArgs: string[] = [];
  
  // Add project path if different from cwd
  if (projectPath !== process.cwd()) {
    scriptArgs.push('--project', projectPath);
  }
  
  if (options.output) {
    scriptArgs.push('--output', options.output);
  }
  
  if (options.categories) {
    // Handle comma-separated categories by splitting and adding multiple --category flags
    const categoryList = options.categories.split(',').map(c => c.trim());
    categoryList.forEach(cat => {
      scriptArgs.push('--category', cat);
    });
  }
  
  if (options.minImportance) {
    scriptArgs.push('--min-score', options.minImportance.toString());
  }
  
  if (options.depth) {
    scriptArgs.push('--depth', options.depth);
  }
  
  if (options.examples === false) {
    scriptArgs.push('--no-examples');
  }
  
  if (options.ast === false) {
    scriptArgs.push('--no-ast');
  }
  
  if (options.semantic === false) {
    scriptArgs.push('--no-semantic');
  }

  return new Promise((resolve) => {
    // Use npm script which has fallback chain: pnpm exec tsx || npx -y tsx || node .mjs
    // Pass arguments after '--' to the script
    const npmArgs = ['run', 'generate-mdc', '--', ...scriptArgs];
    const child = spawn('npm', npmArgs, {
      stdio: 'inherit',
      cwd: process.cwd(),
      env: { ...process.env },
      shell: true // Use shell on Windows for better compatibility
    });

    child.on('close', (code) => {
      resolve(code || 0);
    });

    child.on('error', (error) => {
      console.error('❌ Failed to run MDC generator:', error.message);
      resolve(1);
    });
  });
}

export async function runMdc(args: string[]): Promise<number> {
  const options = parseArgs(args);
  
  if (options.help) {
    showHelp();
    return 0;
  }

  const projectPath = options.projectPath || process.cwd();
  
  if (!existsSync(projectPath)) {
    console.error(`❌ Project path does not exist: ${projectPath}`);
    return 1;
  }

  console.log(`🚀 Generating MDC documentation for: ${projectPath}`);
  
  try {
    const exitCode = await runMDCGenerator(projectPath, options);
    
    if (exitCode === 0) {
      console.log('\n✅ MDC generation completed successfully!');
      
      const outputDir = options.output || path.join(projectPath, '.specs');
      console.log(`📁 Output directory: ${outputDir}`);
      console.log('\n💡 Next steps:');
      console.log('   • Review generated .mdc files');
      console.log('   • Check specifications.json index');
      console.log('   • Use files in AI context for enhanced understanding');
    } else {
      console.error('\n❌ MDC generation failed');
    }
    
    return exitCode;
  } catch (error) {
    console.error('❌ Error running MDC generator:', error);
    return 1;
  }
}

// CLI execution
if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2);
  runMdc(args)
    .then((code) => process.exit(code))
    .catch((error) => {
      console.error('❌ Unhandled error:', error);
      process.exit(1);
    });
}
