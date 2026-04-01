/**
 * MCP Server Tool: MDC Generator
 * 
 * Provides Model Context Protocol (MCP) tool for generating
 * Markdown Context (MDC) files from codebase analysis.
 */

import { spawn } from 'child_process';
import { existsSync } from 'fs';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Generate MDC documentation for a codebase
 */
async function generateMDC(projectPath, options = {}) {
  const scriptPath = path.join(__dirname, '../scripts/generate-mdc.ts');
  
  if (!existsSync(scriptPath)) {
    throw new Error('MDC generator script not found');
  }

  // Build arguments for the npm script (will be passed after '--')
  const scriptArgs = [];
  
  // Add project path if different from cwd
  if (projectPath !== process.cwd()) {
    scriptArgs.push('--project', projectPath);
  }
  
  if (options.output) {
    scriptArgs.push('--output', options.output);
  }
  
  if (options.categories) {
    // Handle comma-separated categories by splitting and adding multiple --category flags
    const categoryList = typeof options.categories === 'string' 
      ? options.categories.split(',').map(c => c.trim())
      : Array.isArray(options.categories) 
        ? options.categories
        : [options.categories];
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
  
  if (options.includeExamples === false) {
    scriptArgs.push('--no-examples');
  }
  
  if (options.useASTParsing === false) {
    scriptArgs.push('--no-ast');
  }
  
  if (options.semanticAnalysis === false) {
    scriptArgs.push('--no-semantic');
  }

  return new Promise((resolve, reject) => {
    // Use npm script which has fallback chain for better compatibility
    const npmArgs = ['run', 'generate-mdc', '--', ...scriptArgs];
    const child = spawn('npm', npmArgs, {
      stdio: ['pipe', 'pipe', 'pipe'],
      cwd: process.cwd(),
      env: { ...process.env },
      shell: true // Use shell on Windows for better compatibility
    });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    child.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    child.on('close', (code) => {
      if (code === 0) {
        resolve({
          success: true,
          stdout: stdout,
          stderr: stderr,
          exitCode: code
        });
      } else {
        reject(new Error(`MDC generation failed with exit code ${code}: ${stderr}`));
      }
    });

    child.on('error', (error) => {
      reject(new Error(`Failed to run MDC generator: ${error.message}`));
    });
  });
}

/**
 * Read generated MDC specifications
 */
async function readMDCSpecifications(outputDir) {
  const indexPath = path.join(outputDir, 'specifications.json');
  
  if (!existsSync(indexPath)) {
    throw new Error('Specifications index not found');
  }

  try {
    const indexContent = await fs.readFile(indexPath, 'utf8');
    const specifications = JSON.parse(indexContent);
    
    // Read individual MDC files
    const mdcFiles = {};
    for (const spec of specifications) {
      const filePath = path.join(outputDir, spec.fileName);
      if (existsSync(filePath)) {
        const content = await fs.readFile(filePath, 'utf8');
        mdcFiles[spec.fileName] = {
          ...spec,
          content: content
        };
      }
    }

    return {
      specifications,
      mdcFiles,
      totalCount: specifications.length
    };
  } catch (error) {
    throw new Error(`Failed to read MDC specifications: ${error.message}`);
  }
}

/**
 * MCP Tool Definition
 */
const mdcGeneratorTool = {
  name: 'generate_mdc',
  description: 'Generate comprehensive Markdown Context (MDC) documentation for a codebase',
  inputSchema: {
    type: 'object',
    properties: {
      projectPath: {
        type: 'string',
        description: 'Path to the project directory to analyze (default: current directory)'
      },
      outputDir: {
        type: 'string',
        description: 'Output directory for MDC files (default: .specs)',
        default: '.specs'
      },
      categories: {
        type: 'string',
        description: 'Comma-separated categories to generate (architecture,security,data-flow,design-system,integration,algorithm,utility)'
      },
      minImportance: {
        type: 'number',
        description: 'Minimum importance score threshold (0-100)',
        default: 70,
        minimum: 0,
        maximum: 100
      },
      depth: {
        type: 'string',
        enum: ['shallow', 'medium', 'deep'],
        description: 'Analysis depth level',
        default: 'medium'
      },
      includeExamples: {
        type: 'boolean',
        description: 'Include code examples in documentation',
        default: true
      },
      useASTParsing: {
        type: 'boolean',
        description: 'Use TypeScript AST parsing for analysis',
        default: true
      },
      semanticAnalysis: {
        type: 'boolean',
        description: 'Enable semantic analysis',
        default: true
      },
      readResults: {
        type: 'boolean',
        description: 'Read and return generated MDC files',
        default: false
      }
    },
    required: []
  }
};

/**
 * MCP Tool Handler
 */
async function handleMDCGeneration(args) {
  const {
    projectPath = process.cwd(),
    outputDir = '.specs',
    categories,
    minImportance = 70,
    depth = 'medium',
    includeExamples = true,
    useASTParsing = true,
    semanticAnalysis = true,
    readResults = false
  } = args;

  try {
    // Validate project path
    if (!existsSync(projectPath)) {
      throw new Error(`Project path does not exist: ${projectPath}`);
    }

    // Generate MDC files
    const result = await generateMDC(projectPath, {
      output: outputDir,
      categories,
      minImportance,
      depth,
      includeExamples,
      useASTParsing,
      semanticAnalysis
    });

    let response = {
      success: true,
      message: 'MDC generation completed successfully',
      projectPath,
      outputDir,
      stdout: result.stdout,
      stderr: result.stderr
    };

    // Read generated files if requested
    if (readResults) {
      try {
        const specifications = await readMDCSpecifications(outputDir);
        response.specifications = specifications;
      } catch (error) {
        response.readError = error.message;
      }
    }

    return response;
  } catch (error) {
    return {
      success: false,
      error: error.message,
      projectPath,
      outputDir
    };
  }
}

/**
 * Register MCP tool
 */
function registerMDCGeneratorTool(server) {
  server.setRequestHandler('tools/list', async () => {
    return {
      tools: [mdcGeneratorTool]
    };
  });

  server.setRequestHandler('tools/call', async (request) => {
    const { name, arguments: args } = request.params;

    if (name === 'generate_mdc') {
      return await handleMDCGeneration(args);
    }

    throw new Error(`Unknown tool: ${name}`);
  });
}

export {
  mdcGeneratorTool,
  handleMDCGeneration,
  registerMDCGeneratorTool,
  generateMDC,
  readMDCSpecifications
};
