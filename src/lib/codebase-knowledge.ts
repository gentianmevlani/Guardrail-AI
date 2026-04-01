/**
 * Codebase Knowledge Base
 * 
 * Deep understanding of a specific codebase - more context than general AI agents
 * Builds and maintains project-specific knowledge over time
 */

import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';

export interface CodebaseKnowledge {
  projectId: string;
  projectPath: string;
  architecture: ArchitectureKnowledge;
  patterns: PatternKnowledge[];
  decisions: DecisionKnowledge[];
  relationships: RelationshipKnowledge;
  context: ContextMemory;
  lastUpdated: string;
}

export interface ArchitectureKnowledge {
  structure: {
    type: 'monolith' | 'microservices' | 'modular' | 'unknown';
    layers: string[];
    entryPoints: string[];
    mainModules: string[];
  };
  techStack: {
    frontend: string[];
    backend: string[];
    database: string[];
    tools: string[];
  };
  conventions: {
    naming: Record<string, string>;
    fileOrganization: string[];
    importPatterns: string[];
  };
}

export interface PatternKnowledge {
  id: string;
  name: string;
  description: string;
  examples: string[];
  frequency: number;
  category: 'component' | 'hook' | 'utility' | 'api' | 'state' | 'routing';
}

export interface DecisionKnowledge {
  id: string;
  question: string;
  decision: string;
  rationale: string;
  date: string;
  files: string[];
  context: string;
}

export interface RelationshipKnowledge {
  dependencies: Map<string, string[]>; // file -> dependencies
  dependents: Map<string, string[]>; // file -> dependents
  imports: Map<string, string[]>; // file -> imports
  exports: Map<string, string[]>; // file -> exports
}

export interface ContextMemory {
  recentChanges: Array<{
    file: string;
    change: string;
    date: string;
  }>;
  activeFeatures: string[];
  currentFocus: string[];
  painPoints: string[];
  improvements: string[];
}

export class CodebaseKnowledgeBase {
  private knowledgeFile = '.codebase-knowledge.json';

  /**
   * Build deep knowledge of codebase
   * 
   * Analyzes the entire codebase and builds comprehensive knowledge including
   * architecture, patterns, decisions, and relationships.
   * 
   * @param projectPath - Path to the project root directory
   * @returns Complete codebase knowledge
   * 
   * @example
   * ```typescript
   * const knowledge = await codebaseKnowledgeBase.buildKnowledge('./my-project');
   * 
   * // Use the knowledge
   * console.log(`Project type: ${knowledge.architecture.structure.type}`);
   * console.log(`Patterns found: ${knowledge.patterns.length}`);
   * ```
   */
  async buildKnowledge(projectPath: string): Promise<CodebaseKnowledge> {
    console.log('🧠 Building deep codebase knowledge...');

    const knowledge: CodebaseKnowledge = {
      projectId: this.getProjectId(projectPath),
      projectPath,
      architecture: await this.analyzeArchitecture(projectPath),
      patterns: await this.detectPatterns(projectPath),
      decisions: await this.loadDecisions(projectPath),
      relationships: await this.mapRelationships(projectPath),
      context: await this.buildContext(projectPath),
      lastUpdated: new Date().toISOString(),
    };

    await this.saveKnowledge(projectPath, knowledge);
    return knowledge;
  }

  /**
   * Analyze architecture
   */
  public async analyzeArchitecture(projectPath: string): Promise<ArchitectureKnowledge> {
    const structure = await this.detectStructure(projectPath);
    const techStack = await this.detectTechStack(projectPath);
    const conventions = await this.detectConventions(projectPath);

    return {
      structure,
      techStack,
      conventions,
    };
  }

  /**
   * Detect project structure
   */
  private async detectStructure(projectPath: string): Promise<ArchitectureKnowledge['structure']> {
    const srcPath = path.join(projectPath, 'src');
    const hasSrc = await this.pathExists(srcPath);

    // Detect type
    let type: ArchitectureKnowledge['structure']['type'] = 'unknown';
    const hasMicroservices = await this.findFile(projectPath, /service|microservice/i);
    const hasModules = await this.findFile(projectPath, /modules|features/i);
    
    if (hasMicroservices) {
      type = 'microservices';
    } else if (hasModules) {
      type = 'modular';
    } else if (hasSrc) {
      type = 'monolith';
    }

    // Detect layers
    const layers: string[] = [];
    if (await this.pathExists(path.join(projectPath, 'src', 'components'))) layers.push('components');
    if (await this.pathExists(path.join(projectPath, 'src', 'pages'))) layers.push('pages');
    if (await this.pathExists(path.join(projectPath, 'src', 'services'))) layers.push('services');
    if (await this.pathExists(path.join(projectPath, 'src', 'hooks'))) layers.push('hooks');
    if (await this.pathExists(path.join(projectPath, 'src', 'utils'))) layers.push('utils');

    // Detect entry points
    const entryPoints: string[] = [];
    const packageJson = path.join(projectPath, 'package.json');
    if (await this.pathExists(packageJson)) {
      const pkg = JSON.parse(await fs.promises.readFile(packageJson, 'utf8'));
      if (pkg.main) entryPoints.push(pkg.main);
      if (pkg.bin) {
        const binEntries = typeof pkg.bin === 'string' ? [pkg.bin] : Object.values(pkg.bin || {});
      binEntries.forEach((entry) => {
        if (typeof entry === 'string') {
          entryPoints.push(entry);
        }
      });
      }
    }

    // Detect main modules
    const mainModules: string[] = [];
    if (hasSrc) {
      const items = await fs.promises.readdir(srcPath, { withFileTypes: true });
      for (const item of items) {
        if (item.isDirectory()) {
          mainModules.push(item.name);
        }
      }
    }

    return {
      type,
      layers,
      entryPoints,
      mainModules,
    };
  }

  /**
   * Detect tech stack
   */
  private async detectTechStack(projectPath: string): Promise<ArchitectureKnowledge['techStack']> {
    const packageJson = path.join(projectPath, 'package.json');
    if (!await this.pathExists(packageJson)) {
      return { frontend: [], backend: [], database: [], tools: [] };
    }

    const pkg = JSON.parse(await fs.promises.readFile(packageJson, 'utf8'));
    const deps = { ...pkg.dependencies, ...pkg.devDependencies };

    const frontend: string[] = [];
    const backend: string[] = [];
    const database: string[] = [];
    const tools: string[] = [];

    // Frontend
    if (deps['react']) frontend.push('react');
    if (deps['vue']) frontend.push('vue');
    if (deps['angular']) frontend.push('angular');
    if (deps['next']) frontend.push('next');
    if (deps['svelte']) frontend.push('svelte');
    if (deps['tailwindcss']) frontend.push('tailwindcss');

    // Backend
    if (deps['express']) backend.push('express');
    if (deps['fastify']) backend.push('fastify');
    if (deps['nestjs']) backend.push('nestjs');
    if (deps['koa']) backend.push('koa');

    // Database
    if (deps['pg'] || deps['postgres']) database.push('postgresql');
    if (deps['mysql2']) database.push('mysql');
    if (deps['mongodb']) database.push('mongodb');
    if (deps['prisma']) database.push('prisma');

    // Tools
    if (deps['typescript']) tools.push('typescript');
    if (deps['eslint']) tools.push('eslint');
    if (deps['prettier']) tools.push('prettier');

    return { frontend, backend, database, tools };
  }

  /**
   * Detect conventions
   */
  private async detectConventions(projectPath: string): Promise<ArchitectureKnowledge['conventions']> {
    const conventions: ArchitectureKnowledge['conventions'] = {
      naming: {},
      fileOrganization: [],
      importPatterns: [],
    };

    // Analyze file naming
    const files = await this.findCodeFiles(projectPath);
    const namingPatterns = new Map<string, number>();
    
    for (const file of files.slice(0, 50)) {
      const name = path.basename(file);
      const ext = path.extname(name);
      const base = name.replace(ext, '');
      
      // Detect naming convention
      if (base.includes('-')) {
        namingPatterns.set('kebab-case', (namingPatterns.get('kebab-case') || 0) + 1);
      } else if (base.includes('_')) {
        namingPatterns.set('snake_case', (namingPatterns.get('snake_case') || 0) + 1);
      } else if (base && base.length > 0 && base[0]!.toUpperCase() === base[0]) {
        namingPatterns.set('PascalCase', (namingPatterns.get('PascalCase') || 0) + 1);
      } else {
        namingPatterns.set('camelCase', (namingPatterns.get('camelCase') || 0) + 1);
      }
    }

    const mostCommon = Array.from(namingPatterns.entries())
      .sort((a, b) => b[1] - a[1])[0];
    if (mostCommon) {
      conventions.naming['files'] = mostCommon[0];
    }

    // Detect import patterns
    const importPatterns = new Set<string>();
    for (const file of files.slice(0, 20)) {
      try {
        const content = await fs.promises.readFile(file, 'utf8');
        const imports = content.match(/import\s+.*from\s+['"]([^'"]+)['"]/g) || [];
        imports.forEach(imp => {
          if (imp.includes('@/')) importPatterns.add('path-aliases');
          if (imp.includes('../')) importPatterns.add('relative');
          if (imp.startsWith('import') && !imp.includes('./') && !imp.includes('@/')) {
            importPatterns.add('absolute');
          }
        });
      } catch (error) {
        // Failed to process - continue with other operations
      }
    }
    conventions.importPatterns = Array.from(importPatterns);

    return conventions;
  }

  /**
   * Detect patterns in codebase
   */
  public async detectPatterns(projectPath: string): Promise<PatternKnowledge[]> {
    const patterns: PatternKnowledge[] = [];
    const files = await this.findCodeFiles(projectPath);

    // Component patterns
    const componentFiles = files.filter(f => 
      f.includes('components') && (f.endsWith('.tsx') || f.endsWith('.jsx'))
    );
    if (componentFiles.length > 0) {
      patterns.push({
        id: 'component-pattern',
        name: 'Component Pattern',
        description: 'React/Vue components organized in components directory',
        examples: componentFiles.slice(0, 5),
        frequency: componentFiles.length,
        category: 'component',
      });
    }

    // Hook patterns
    const hookFiles = files.filter(f => 
      (f.includes('hooks') || f.includes('use')) && f.endsWith('.ts')
    );
    if (hookFiles.length > 0) {
      patterns.push({
        id: 'hook-pattern',
        name: 'Custom Hooks Pattern',
        description: 'Custom hooks for reusable logic',
        examples: hookFiles.slice(0, 5),
        frequency: hookFiles.length,
        category: 'hook',
      });
    }

    // API patterns
    const apiFiles = files.filter(f => 
      f.includes('api') || f.includes('routes') || f.includes('endpoints')
    );
    if (apiFiles.length > 0) {
      patterns.push({
        id: 'api-pattern',
        name: 'API Pattern',
        description: 'API routes organized in dedicated files',
        examples: apiFiles.slice(0, 5),
        frequency: apiFiles.length,
        category: 'api',
      });
    }

    return patterns;
  }

  /**
   * Map file relationships
   */
  public async mapRelationships(projectPath: string): Promise<RelationshipKnowledge> {
    const relationships: RelationshipKnowledge = {
      dependencies: new Map(),
      dependents: new Map(),
      imports: new Map(),
      exports: new Map(),
    };

    const files = await this.findCodeFiles(projectPath);

    for (const file of files) {
      try {
        const content = await fs.promises.readFile(file, 'utf8');
        const relativePath = path.relative(projectPath, file);

        // Extract imports
        const imports: string[] = [];
        const importRegex = /import\s+.*from\s+['"]([^'"]+)['"]/g;
        let match;
        while ((match = importRegex.exec(content)) !== null) {
          imports.push(match[1] || '');
        }
        relationships.imports.set(relativePath, imports);

        // Extract exports
        const exports: string[] = [];
        const exportRegex = /export\s+(?:const|function|class|default|interface|type)\s+(\w+)/g;
        while ((match = exportRegex.exec(content)) !== null) {
          exports.push(match[1] || '');
        }
        relationships.exports.set(relativePath, exports);

        // Build dependency graph
        const fileDependencies: string[] = [];
        for (const importPath of imports) {
          // Convert relative import to file path
          if (importPath.startsWith('.')) {
            const absoluteImport = path.resolve(path.dirname(relativePath), importPath);
            // Add common extensions
            const possibleFiles = [
              absoluteImport + '.ts',
              absoluteImport + '.tsx',
              absoluteImport + '.js',
              absoluteImport + '.jsx',
              path.join(absoluteImport, 'index.ts'),
              path.join(absoluteImport, 'index.tsx')
            ];
            
            for (const possibleFile of possibleFiles) {
              if (files.includes(possibleFile)) {
                fileDependencies.push(possibleFile);
                break;
              }
            }
          }
        }
        
        if (fileDependencies.length > 0) {
          relationships.dependencies.set(relativePath, fileDependencies);
          
          // Update dependents
          for (const dep of fileDependencies) {
            if (!relationships.dependents.has(dep)) {
              relationships.dependents.set(dep, []);
            }
            relationships.dependents.get(dep)!.push(relativePath);
          }
        }
      } catch (error) {
        // Failed to process - continue with other operations
      }
    }

    return relationships;
  }

  /**
   * Build context memory
   */
  private async buildContext(projectPath: string): Promise<ContextMemory> {
    // Get recent git changes
    const recentChanges = await this.getRecentChanges(projectPath);

    // Detect active features
    const activeFeatures = await this.detectActiveFeatures(projectPath);

    return {
      recentChanges,
      activeFeatures,
      currentFocus: [],
      painPoints: [],
      improvements: [],
    };
  }

  /**
   * Get recent changes from git
   */
  private async getRecentChanges(projectPath: string): Promise<ContextMemory['recentChanges']> {
    try {
      const result = execSync('git log --oneline --name-only -10', {
        cwd: projectPath,
        encoding: 'utf8',
      });

      const changes: ContextMemory['recentChanges'] = [];
      const lines = result.split('\n');
      let currentCommit = '';

      for (const line of lines) {
        if (line && !line.startsWith(' ')) {
          currentCommit = line;
        } else if (line.trim()) {
          changes.push({
            file: line.trim(),
            change: currentCommit,
            date: new Date().toISOString(), // Would parse from git log
          });
        }
      }

      return changes.slice(0, 10);
    } catch {
      return [];
    }
  }

  /**
   * Detect active features
   */
  private async detectActiveFeatures(projectPath: string): Promise<string[]> {
    const features: string[] = [];
    const srcPath = path.join(projectPath, 'src');

    if (await this.pathExists(srcPath)) {
      const items = await fs.promises.readdir(srcPath, { withFileTypes: true });
      for (const item of items) {
        if (item.isDirectory() && (item.name === 'features' || item.name === 'modules')) {
          const featurePath = path.join(srcPath, item.name);
          const featureDirs = await fs.promises.readdir(featurePath, { withFileTypes: true });
          for (const feature of featureDirs) {
            if (feature.isDirectory()) {
              features.push(feature.name);
            }
          }
        }
      }
    }

    return features;
  }

  /**
   * Load decisions from knowledge base
   */
  public async loadDecisions(projectPath: string): Promise<DecisionKnowledge[]> {
    const knowledgePath = path.join(projectPath, this.knowledgeFile);
    if (!await this.pathExists(knowledgePath)) {
      return [];
    }

    try {
      const knowledge = JSON.parse(await fs.promises.readFile(knowledgePath, 'utf8'));
      return knowledge.decisions || [];
    } catch {
      return [];
    }
  }

  /**
   * Save knowledge base
   */
  public async saveKnowledge(projectPath: string, knowledge: CodebaseKnowledge): Promise<void> {
    const knowledgePath = path.join(projectPath, this.knowledgeFile);
    await fs.promises.writeFile(
      knowledgePath,
      JSON.stringify(knowledge, null, 2)
    );
  }

  /**
   * Get knowledge for project
   */
  public async loadKnowledge(projectPath: string): Promise<CodebaseKnowledge | null> {
    const knowledgePath = path.join(projectPath, this.knowledgeFile);
    if (!await this.pathExists(knowledgePath)) {
      return null;
    }

    try {
      return JSON.parse(await fs.promises.readFile(knowledgePath, 'utf8'));
    } catch {
      return null;
    }
  }

  /**
   * Add decision to knowledge base
   */
  async addDecision(
    projectPath: string,
    decision: Omit<DecisionKnowledge, 'id' | 'date'>
  ): Promise<void> {
    const knowledge = await this.loadKnowledge(projectPath) || await this.buildKnowledge(projectPath);
    
    knowledge.decisions.push({
      ...decision,
      id: `decision-${Date.now()}`,
      date: new Date().toISOString(),
    });

    await this.saveKnowledge(projectPath, knowledge);
  }

  /**
   * Update context memory
   */
  async updateContext(
    projectPath: string,
    updates: Partial<ContextMemory>
  ): Promise<void> {
    const knowledge = await this.loadKnowledge(projectPath) || await this.buildKnowledge(projectPath);
    
    knowledge.context = {
      ...knowledge.context,
      ...updates,
    };

    await this.saveKnowledge(projectPath, knowledge);
  }

  /**
   * Search knowledge base
   */
  async searchKnowledge(
    projectPath: string,
    query: string
  ): Promise<{
    patterns: PatternKnowledge[];
    decisions: DecisionKnowledge[];
    files: string[];
  }> {
    const knowledge = await this.loadKnowledge(projectPath);
    if (!knowledge) {
      return { patterns: [], decisions: [], files: [] };
    }

    const lowerQuery = query.toLowerCase();
    
    const matchingPatterns = knowledge.patterns.filter((p: PatternKnowledge) =>
      p.name.toLowerCase().includes(lowerQuery) ||
      p.description.toLowerCase().includes(lowerQuery)
    );

    const matchingDecisions = knowledge.decisions.filter((d: DecisionKnowledge) =>
      d.question.toLowerCase().includes(lowerQuery) ||
      d.decision.toLowerCase().includes(lowerQuery) ||
      d.rationale.toLowerCase().includes(lowerQuery)
    );

    // Find relevant files
    const files: string[] = [];
    Array.from(knowledge.relationships.imports.entries()).forEach(([file, _imports]) => {
      if (file.toLowerCase().includes(lowerQuery)) {
        files.push(file);
      }
    });

    return {
      patterns: matchingPatterns,
      decisions: matchingDecisions,
      files,
    };
  }

  // Helper methods
  private async pathExists(p: string): Promise<boolean> {
    try {
      await fs.promises.access(p);
      return true;
    } catch {
      return false;
    }
  }

  private async findFile(dir: string, pattern: RegExp): Promise<boolean> {
    try {
      const items = await fs.promises.readdir(dir, { withFileTypes: true });
      for (const item of items) {
        const fullPath = path.join(dir, item.name);
        if (item.isDirectory() && !this.shouldIgnore(item.name)) {
          if (await this.findFile(fullPath, pattern)) return true;
        } else if (item.isFile() && pattern.test(item.name)) {
          return true;
        }
      }
    } catch (error) {
      // Failed to process - continue with other operations
    }
    return false;
  }

  public async findCodeFiles(dir: string): Promise<string[]> {
    const files: string[] = [];
    try {
      const items = await fs.promises.readdir(dir, { withFileTypes: true });
      for (const item of items) {
        const fullPath = path.join(dir, item.name);
        if (item.isDirectory() && !this.shouldIgnore(item.name)) {
          files.push(...await this.findCodeFiles(fullPath));
        } else if (item.isFile() && /\.(ts|tsx|js|jsx)$/.test(item.name)) {
          files.push(fullPath);
        }
      }
    } catch (error) {
      // Failed to process - continue with other operations
    }
    return files;
  }

  private shouldIgnore(name: string): boolean {
    return ['node_modules', '.git', 'dist', 'build', '.next', 'coverage'].includes(name);
  }

  private getProjectId(projectPath: string): string {
    return Buffer.from(projectPath).toString('base64').substring(0, 16);
  }
}

export const codebaseKnowledgeBase = new CodebaseKnowledgeBase();

