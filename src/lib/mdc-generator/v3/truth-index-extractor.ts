/**
 * Truth Index Extractor
 * 
 * Extracts ground truth from codebase to prevent hallucinations:
 * - Commands/tools list + where defined
 * - Routes/endpoints + handlers + middleware chain
 * - Env var dependencies + defaults + danger flags
 * - Prisma/DB models + relations + key indexes
 * - Integration touchpoints (webhooks, signature verification, retry logic)
 * 
 * All entries include file paths and symbol names.
 */

import { readFileSync, existsSync, readdirSync } from 'fs';
import { join, relative, dirname } from 'path';
import * as ts from 'typescript';
import * as path from 'path';

export interface TruthIndex {
  commands: CommandEntry[];
  tools: ToolEntry[];
  routes: RouteEntry[];
  envVars: EnvVarEntry[];
  dbModels: DBModelEntry[];
  integrations: IntegrationEntry[];
  schemas: SchemaEntry[];
}

export interface CommandEntry {
  name: string;
  file: string;
  line: number;
  description?: string;
  options?: Array<{ name: string; description?: string; required?: boolean }>;
  exitCodes?: Record<string, number>;
}

export interface ToolEntry {
  name: string;
  file: string;
  line: number;
  description?: string;
  parameters?: Array<{ name: string; type?: string; required?: boolean }>;
  mcpServer?: string;
}

export interface RouteEntry {
  method: string;
  path: string;
  file: string;
  line: number;
  handler: string;
  middleware?: string[];
  authRequired?: boolean;
  rateLimit?: boolean;
}

export interface EnvVarEntry {
  name: string;
  file: string;
  line: number;
  defaultValue?: string;
  required: boolean;
  dangerous?: boolean; // e.g., process.env.X || ''
  description?: string;
}

export interface DBModelEntry {
  name: string;
  file: string;
  line: number;
  fields: Array<{ name: string; type: string; required?: boolean }>;
  relations?: Array<{ name: string; type: string; model: string }>;
  indexes?: string[];
}

export interface IntegrationEntry {
  type: 'webhook' | 'api' | 'oauth' | 'mcp';
  name: string;
  file: string;
  line: number;
  signatureVerification?: boolean;
  idempotent?: boolean;
  retryLogic?: boolean;
  audited?: boolean;
}

export interface SchemaEntry {
  name: string;
  file: string;
  type: 'zod' | 'json' | 'typescript' | 'prisma';
  fields?: Array<{ name: string; type: string }>;
}

export interface TruthIndexOptions {
  projectPath: string;
  program?: ts.Program;
  checker?: ts.TypeChecker;
  includePatterns?: string[];
  excludePatterns?: string[];
}

export class TruthIndexExtractor {
  private options: TruthIndexOptions;
  private index: TruthIndex;

  constructor(options: TruthIndexOptions) {
    this.options = options;
    this.index = {
      commands: [],
      tools: [],
      routes: [],
      envVars: [],
      dbModels: [],
      integrations: [],
      schemas: [],
    };
  }

  /**
   * Extract complete truth index
   */
  async extract(): Promise<TruthIndex> {
    // Reset index
    this.index = {
      commands: [],
      tools: [],
      routes: [],
      envVars: [],
      dbModels: [],
      integrations: [],
      schemas: [],
    };

    // Extract from different sources
    await this.extractCommands();
    await this.extractTools();
    await this.extractRoutes();
    await this.extractEnvVars();
    await this.extractDBModels();
    await this.extractIntegrations();
    await this.extractSchemas();

    return this.index;
  }

  /**
   * Extract CLI commands
   */
  private async extractCommands(): Promise<void> {
    // Look for commander.js patterns or custom command registrations
    const commandFiles = this.findFilesMatching(/command|cli|program/i);
    
    for (const file of commandFiles) {
      const content = readFileSync(file, 'utf8');
      const relativePath = relative(this.options.projectPath, file);
      
      // Pattern: program.command('name', ...)
      const commandRegex = /\.command\(['"]([^'"]+)['"]/g;
      let match;
      let lineNum = 1;
      
      const lines = content.split('\n');
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (commandRegex.test(line)) {
          const commandMatch = line.match(/\.command\(['"]([^'"]+)['"]/);
          if (commandMatch) {
            // Try to find description
            let description: string | undefined;
            for (let j = i + 1; j < Math.min(i + 10, lines.length); j++) {
              const descMatch = lines[j].match(/\.description\(['"]([^'"]+)['"]/);
              if (descMatch) {
                description = descMatch[1];
                break;
              }
            }

            this.index.commands.push({
              name: commandMatch[1],
              file: relativePath,
              line: i + 1,
              description,
            });
          }
        }
      }
    }
  }

  /**
   * Extract MCP tools
   */
  private async extractTools(): Promise<void> {
    // Look for MCP tool definitions
    const toolFiles = this.findFilesMatching(/mcp|tool|guardrail-tools/i);
    
    for (const file of toolFiles) {
      const content = readFileSync(file, 'utf8');
      const relativePath = relative(this.options.projectPath, file);
      
      // Pattern: handleGuardrailTool('name', ...) or tool definitions
      const toolRegex = /(?:handle|register|define)(?:guardrail)?Tool\(['"]([^'"]+)['"]/gi;
      const lines = content.split('\n');
      
      for (let i = 0; i < lines.length; i++) {
        const match = toolRegex.exec(lines[i]);
        if (match) {
          this.index.tools.push({
            name: match[1],
            file: relativePath,
            line: i + 1,
            mcpServer: 'guardrail',
          });
        }
      }
    }
  }

  /**
   * Extract API routes
   */
  private async extractRoutes(): Promise<void> {
    // Look for route definitions (Fastify, Express, Next.js API routes)
    const routeFiles = this.findFilesMatching(/route|routes|api/i);
    
    for (const file of routeFiles) {
      const content = readFileSync(file, 'utf8');
      const relativePath = relative(this.options.projectPath, file);
      
      // Pattern: fastify.get('/path', ...) or app.get('/path', ...)
      const routeRegex = /(?:fastify|app|router)\.(get|post|put|patch|delete|options)\(['"]([^'"]+)['"]/g;
      const lines = content.split('\n');
      
      for (let i = 0; i < lines.length; i++) {
        const match = routeRegex.exec(lines[i]);
        if (match) {
          const method = match[1].toUpperCase();
          const path = match[2];
          
          // Check for auth middleware
          let authRequired = false;
          for (let j = Math.max(0, i - 5); j < i; j++) {
            if (lines[j].includes('requireAuth') || lines[j].includes('authenticate')) {
              authRequired = true;
              break;
            }
          }

          this.index.routes.push({
            method,
            path,
            file: relativePath,
            line: i + 1,
            handler: 'handler', // Would need AST to extract actual function name
            authRequired,
          });
        }
      }

      // Next.js API routes: export async function GET/POST/etc
      const nextRouteRegex = /export\s+(?:async\s+)?function\s+(GET|POST|PUT|PATCH|DELETE|OPTIONS)/g;
      for (let i = 0; i < lines.length; i++) {
        const match = nextRouteRegex.exec(lines[i]);
        if (match) {
          // Extract path from file path (Next.js convention)
          const pathMatch = relativePath.match(/\/api\/(.+?)(?:\/route)?\.tsx?$/);
          const routePath = pathMatch ? `/api/${pathMatch[1]}` : '/api';

          this.index.routes.push({
            method: match[1],
            path: routePath,
            file: relativePath,
            line: i + 1,
            handler: match[1],
          });
        }
      }
    }
  }

  /**
   * Extract environment variables
   */
  private async extractEnvVars(): Promise<void> {
    const sourceFiles = this.findAllSourceFiles();
    
    for (const file of sourceFiles) {
      const content = readFileSync(file, 'utf8');
      const relativePath = relative(this.options.projectPath, file);
      const lines = content.split('\n');
      
      // Pattern: process.env.VAR_NAME || 'default'
      const envRegex = /process\.env\.([A-Z0-9_]+)(?:\s*\|\||\s*\?\?)\s*(['"]([^'"]*)['"]|(\d+)|(true|false))?/g;
      
      for (let i = 0; i < lines.length; i++) {
        const match = envRegex.exec(lines[i]);
        if (match) {
          const varName = match[1];
          const defaultValue = match[3] || match[4] || match[5];
          const dangerous = !defaultValue || defaultValue === '' || defaultValue === 'test';
          
          // Check if already added
          if (!this.index.envVars.find(e => e.name === varName && e.file === relativePath)) {
            this.index.envVars.push({
              name: varName,
              file: relativePath,
              line: i + 1,
              defaultValue,
              required: !defaultValue,
              dangerous,
            });
          }
        }

        // Pattern: process.env.VAR_NAME (required)
        const requiredRegex = /process\.env\.([A-Z0-9_]+)(?!\s*\|\||\s*\?\?)/g;
        const requiredMatch = requiredRegex.exec(lines[i]);
        if (requiredMatch) {
          const varName = requiredMatch[1];
          if (!this.index.envVars.find(e => e.name === varName && e.file === relativePath)) {
            this.index.envVars.push({
              name: varName,
              file: relativePath,
              line: i + 1,
              required: true,
              dangerous: false,
            });
          }
        }
      }
    }
  }

  /**
   * Extract DB models (Prisma)
   */
  private async extractDBModels(): Promise<void> {
    const prismaFile = join(this.options.projectPath, 'prisma', 'schema.prisma');
    if (!existsSync(prismaFile)) return;

    const content = readFileSync(prismaFile, 'utf8');
    const lines = content.split('\n');
    let currentModel: DBModelEntry | null = null;
    let lineNum = 0;

    for (const line of lines) {
      lineNum++;
      
      // Model declaration
      const modelMatch = line.match(/^model\s+(\w+)\s*\{/);
      if (modelMatch) {
        if (currentModel) {
          this.index.dbModels.push(currentModel);
        }
        currentModel = {
          name: modelMatch[1],
          file: 'prisma/schema.prisma',
          line: lineNum,
          fields: [],
          relations: [],
          indexes: [],
        };
        continue;
      }

      if (currentModel) {
        // Field: name type [attributes]
        const fieldMatch = line.match(/^\s+(\w+)\s+(\w+)/);
        if (fieldMatch) {
          const fieldName = fieldMatch[1];
          const fieldType = fieldMatch[2];
          const required = !line.includes('?');
          
          currentModel.fields.push({
            name: fieldName,
            type: fieldType,
            required,
          });
        }

        // Relation: relationName ModelName
        const relationMatch = line.match(/^\s+(\w+)\s+(\w+)\s+@relation/);
        if (relationMatch) {
          currentModel.relations?.push({
            name: relationMatch[1],
            type: 'relation',
            model: relationMatch[2],
          });
        }

        // Index
        if (line.includes('@@index')) {
          const indexMatch = line.match(/@@index\(\[([^\]]+)\]/);
          if (indexMatch) {
            currentModel.indexes?.push(indexMatch[1].trim());
          }
        }

        // End of model
        if (line.trim() === '}') {
          this.index.dbModels.push(currentModel);
          currentModel = null;
        }
      }
    }

    if (currentModel) {
      this.index.dbModels.push(currentModel);
    }
  }

  /**
   * Extract integrations
   */
  private async extractIntegrations(): Promise<void> {
    const integrationFiles = this.findFilesMatching(/webhook|integration|oauth|stripe|github/i);
    
    for (const file of integrationFiles) {
      const content = readFileSync(file, 'utf8');
      const relativePath = relative(this.options.projectPath, file);
      const lines = content.split('\n');
      
      // Webhook handlers
      const webhookRegex = /(?:webhook|handleWebhook|processWebhook)/i;
      for (let i = 0; i < lines.length; i++) {
        if (webhookRegex.test(lines[i])) {
          const signatureVerified = content.includes('verifySignature') || content.includes('verifyWebhook');
          const idempotent = content.includes('idempotent') || content.includes('dedupe');
          const retryLogic = content.includes('retry') || content.includes('Retry');
          const audited = content.includes('audit') || content.includes('log');

          this.index.integrations.push({
            type: 'webhook',
            name: path.basename(file, path.extname(file)),
            file: relativePath,
            line: i + 1,
            signatureVerification: signatureVerified,
            idempotent,
            retryLogic,
            audited,
          });
          break; // One webhook per file assumption
        }
      }
    }
  }

  /**
   * Extract schemas (Zod, JSON Schema, TypeScript types)
   */
  private async extractSchemas(): Promise<void> {
    const schemaFiles = this.findFilesMatching(/schema|types|zod/i);
    
    for (const file of schemaFiles) {
      const content = readFileSync(file, 'utf8');
      const relativePath = relative(this.options.projectPath, file);
      
      // Zod schemas
      const zodRegex = /(?:export\s+)?(?:const|let)\s+(\w+)\s*=\s*z\./;
      if (zodRegex.test(content)) {
        const match = content.match(zodRegex);
        if (match) {
          this.index.schemas.push({
            name: match[1],
            file: relativePath,
            type: 'zod',
          });
        }
      }

      // TypeScript interfaces/types
      const tsRegex = /(?:export\s+)?(?:interface|type)\s+(\w+)/g;
      let tsMatch;
      while ((tsMatch = tsRegex.exec(content)) !== null) {
        this.index.schemas.push({
          name: tsMatch[1],
          file: relativePath,
          type: 'typescript',
        });
      }
    }
  }

  /**
   * Find files matching pattern
   */
  private findFilesMatching(pattern: RegExp): string[] {
    const files: string[] = [];
    const sourceFiles = this.findAllSourceFiles();
    
    for (const file of sourceFiles) {
      if (pattern.test(file)) {
        files.push(file);
      }
    }
    
    return files;
  }

  /**
   * Find all source files
   */
  private findAllSourceFiles(): string[] {
    const files: string[] = [];
    
    const walk = (dir: string) => {
      try {
        const entries = readdirSync(dir, { withFileTypes: true });
        
        for (const entry of entries) {
          const fullPath = join(dir, entry.name);
          const relativePath = relative(this.options.projectPath, fullPath);
          
          // Skip excluded
          if (this.isExcluded(relativePath)) continue;
          
          if (entry.isDirectory()) {
            walk(fullPath);
          } else if (entry.isFile()) {
            const ext = path.extname(entry.name);
            if (['.ts', '.tsx', '.js', '.jsx'].includes(ext)) {
              files.push(fullPath);
            }
          }
        }
      } catch {
        // Skip directories that can't be read
      }
    };
    
    walk(this.options.projectPath);
    return files;
  }

  /**
   * Check if path is excluded
   */
  private isExcluded(relativePath: string): boolean {
    const excludes = ['node_modules', 'dist', 'build', '.next', 'coverage'];
    return excludes.some(ex => relativePath.includes(ex));
  }
}
