#!/usr/bin/env node
// bin/runners/runMdc.js

const { spawn, execSync } = require("child_process");
const { existsSync } = require("fs");
const path = require("path");

// Simple chalk replacement
const colors = {
  cyan: (text) => `\x1b[36m${text}\x1b[0m`,
  green: (text) => `\x1b[32m${text}\x1b[0m`,
  yellow: (text) => `\x1b[33m${text}\x1b[0m`,
  red: (text) => `\x1b[31m${text}\x1b[0m`,
};

function parseArgs(args) {
  const options = {};
  
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
      case '--min-score':
      case '-m':
        const scoreValue = parseInt(nextArg);
        options.minImportance = isNaN(scoreValue) ? 70 : scoreValue;
        console.log(`🔢 CLI: Set min importance to ${options.minImportance} from "${nextArg}"`);
        i++;
        break;
      case '--depth':
      case '-d':
        options.depth = nextArg;
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
  -h, --help              Show this help message

Examples:
  guardrail mdc                          # Analyze current directory
  guardrail mdc ./src                    # Analyze src directory
  guardrail mdc --output docs/specs     # Custom output directory
  guardrail mdc --categories architecture,security  # Specific categories
  guardrail mdc --min-importance 80     # Higher importance threshold
  guardrail mdc --depth deep            # Deep analysis

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

async function runMDCGenerator(projectPath, options) {
  try {
    console.log('🚀 Generating MDC documentation for:', projectPath);
    
    // Build npm script arguments
    const npmArgs = ['run', 'generate-mdc', '--', projectPath];
    
    if (options.output) {
      npmArgs.push('--output', options.output);
    }
    
    if (options.categories) {
      npmArgs.push('--category', options.categories);
    }
    
    if (options.minImportance !== undefined) {
      npmArgs.push('--min-score', options.minImportance.toString());
    }
    
    if (options.depth) {
      npmArgs.push('--depth', options.depth);
    }
    
    if (options.examples === false) {
      npmArgs.push('--no-examples');
    }
    
    if (options.ast === false) {
      npmArgs.push('--no-ast');
    }
    
    if (options.semantic === false) {
      npmArgs.push('--no-semantic');
    }

    // Use execSync for simpler execution
    const command = `npm ${npmArgs.join(' ')}`;
    console.log('Running:', command);
    
    execSync(command, {
      stdio: 'inherit',
      cwd: process.cwd(),
      env: { ...process.env }
    });
    
    return 0;
  } catch (error) {
    console.error('❌ Failed to run MDC generator:', error.message);
    return 1;
  }
}

async function runMdc(args) {
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

module.exports = { runMdc };

// CLI execution
if (require.main === module) {
  const args = process.argv.slice(2);
  runMdc(args)
    .then((code) => process.exit(code))
    .catch((error) => {
      console.error('❌ Unhandled error:', error);
      process.exit(1);
    });
}
