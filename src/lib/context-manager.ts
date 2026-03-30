/**
 * Full-Codebase Context Manager
 * 
 * Reads entire codebase and builds comprehensive project map
 * Generates context files for AI assistants to prevent hallucinations
 */

import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';

export interface ProjectMap {
  architecture: ArchitectureMap;
  endpoints: EndpointMap[];
  dataStructures: DataStructureMap[];
  dependencies: DependencyMap;
  connections: ConnectionMap[];
  patterns: PatternMap[];
  conventions: ConventionMap;
  metadata: {
    scannedAt: string;
    totalFiles: number;
    totalLines: number;
    languages: string[];
    framework?: string;
    version: string;
  };
}

export interface ArchitectureMap {
  type: 'monolith' | 'microservices' | 'serverless' | 'spa' | 'fullstack';
  layers: string[];
  entryPoints: string[];
  buildSystem: string;
  deployment: string[];
}

export interface EndpointMap {
  path: string;
  method: string;
  handler: string;
  params: string[];
  queryParams: string[];
  bodySchema?: Record<string, unknown>;
  responseType?: string;
  auth?: boolean;
  rateLimit?: boolean;
}

export interface DataStructureMap {
  name: string;
  type: 'model' | 'interface' | 'type' | 'class' | 'schema';
  file: string;
  fields: Array<{
    name: string;
    type: string;
    required: boolean;
    description?: string;
  }>;
  relationships?: Array<{
    target: string;
    type: 'hasMany' | 'hasOne' | 'belongsTo' | 'manyToMany';
  }>;
}

export interface DependencyMap {
  runtime: Record<string, string>;
  dev: Record<string, string>;
  peer: Record<string, string>;
  internal: string[];
}

export interface ConnectionMap {
  from: string;
  to: string;
  type: 'import' | 'export' | 'dependency' | 'api-call' | 'database';
  description?: string;
}

export interface PatternMap {
  name: string;
  type: 'component' | 'hook' | 'util' | 'service' | 'middleware';
  examples: string[];
  conventions: string[];
}

export interface ConventionMap {
  naming: {
    files: string; // kebab-case, camelCase, etc.
    components: string;
    functions: string;
    variables: string;
  };
  structure: {
    components: string;
    pages: string;
    utils: string;
    services: string;
  };
  imports: string[];
  exports: string[];
}

class FullCodebaseContextManager {
  private projectPath: string;
  private cache: Map<string, any> = new Map();

  constructor(projectPath: string) {
    this.projectPath = projectPath;
  }

  /**
   * Scan entire codebase and build project map
   */
  async scanCodebase(): Promise<ProjectMap> {
    console.log('🔍 Scanning entire codebase...');

    const files = await this.findAllCodeFiles(this.projectPath);
    console.log(`   Found ${files.length} files`);

    // Parallel scanning
    const [
      architecture,
      endpoints,
      dataStructures,
      dependencies,
      connections,
      patterns,
      conventions,
    ] = await Promise.all([
      this.scanArchitecture(files),
      this.scanEndpoints(files),
      this.scanDataStructures(files),
      this.scanDependencies(),
      this.scanConnections(files),
      this.scanPatterns(files),
      this.scanConventions(files),
    ]);

    const metadata = await this.scanMetadata(files);

    return {
      architecture,
      endpoints,
      dataStructures,
      dependencies,
      connections,
      patterns,
      conventions,
      metadata,
    };
  }

  /**
   * Scan architecture
   */
  private async scanArchitecture(files: string[]): Promise<ArchitectureMap> {
    const packageJson = await this.readPackageJson();
    const framework = this.detectFramework(packageJson, files);
    const buildSystem = this.detectBuildSystem(packageJson, files);
    
    const entryPoints = await this.findEntryPoints(files);
    const layers = await this.detectLayers(files);
    const deployment = await this.detectDeployment(files);

    const type = this.determineArchitectureType(files, framework);

    return {
      type,
      layers,
      entryPoints,
      buildSystem,
      deployment,
    };
  }

  /**
   * Scan API endpoints
   */
  private async scanEndpoints(files: string[]): Promise<EndpointMap[]> {
    const endpoints: EndpointMap[] = [];

    for (const file of files) {
      if (this.isApiFile(file)) {
        const content = await fs.promises.readFile(file, 'utf8');
        const fileEndpoints = this.extractEndpoints(content, file);
        endpoints.push(...fileEndpoints);
      }
    }

    return endpoints;
  }

  /**
   * Scan data structures (models, interfaces, types)
   */
  private async scanDataStructures(files: string[]): Promise<DataStructureMap[]> {
    const structures: DataStructureMap[] = [];

    for (const file of files) {
      const content = await fs.promises.readFile(file, 'utf8');
      const fileStructures = this.extractDataStructures(content, file);
      structures.push(...fileStructures);
    }

    return structures;
  }

  /**
   * Scan dependencies
   */
  private async scanDependencies(): Promise<DependencyMap> {
    const packageJson = await this.readPackageJson();
    
    return {
      runtime: packageJson.dependencies || {},
      dev: packageJson.devDependencies || {},
      peer: packageJson.peerDependencies || {},
      internal: await this.findInternalModules(),
    };
  }

  /**
   * Scan connections between files
   */
  private async scanConnections(files: string[]): Promise<ConnectionMap[]> {
    const connections: ConnectionMap[] = [];

    for (const file of files) {
      const content = await fs.promises.readFile(file, 'utf8');
      const fileConnections = this.extractConnections(content, file, files);
      connections.push(...fileConnections);
    }

    return connections;
  }

  /**
   * Scan patterns
   */
  private async scanPatterns(files: string[]): Promise<PatternMap[]> {
    const patterns: PatternMap[] = [];

    // Component patterns
    const componentFiles = files.filter(f => this.isComponentFile(f));
    if (componentFiles.length > 0) {
      patterns.push({
        name: 'Component Pattern',
        type: 'component',
        examples: componentFiles.slice(0, 3),
        conventions: this.extractComponentConventions(componentFiles),
      });
    }

    // Hook patterns
    const hookFiles = files.filter(f => this.isHookFile(f));
    if (hookFiles.length > 0) {
      patterns.push({
        name: 'Hook Pattern',
        type: 'hook',
        examples: hookFiles.slice(0, 3),
        conventions: this.extractHookConventions(hookFiles),
      });
    }

    // Service patterns
    const serviceFiles = files.filter(f => this.isServiceFile(f));
    if (serviceFiles.length > 0) {
      patterns.push({
        name: 'Service Pattern',
        type: 'service',
        examples: serviceFiles.slice(0, 3),
        conventions: this.extractServiceConventions(serviceFiles),
      });
    }

    return patterns;
  }

  /**
   * Scan conventions
   */
  private async scanConventions(files: string[]): Promise<ConventionMap> {
    return {
      naming: {
        files: this.detectNamingConvention(files, 'file'),
        components: this.detectNamingConvention(files, 'component'),
        functions: this.detectNamingConvention(files, 'function'),
        variables: this.detectNamingConvention(files, 'variable'),
      },
      structure: {
        components: this.detectStructure(files, 'components'),
        pages: this.detectStructure(files, 'pages'),
        utils: this.detectStructure(files, 'utils'),
        services: this.detectStructure(files, 'services'),
      },
      imports: this.extractImportConventions(files),
      exports: this.extractExportConventions(files),
    };
  }

  /**
   * Scan metadata
   */
  private async scanMetadata(files: string[]): Promise<ProjectMap['metadata']> {
    const languages = new Set<string>();
    let totalLines = 0;

    for (const file of files) {
      const ext = path.extname(file);
      if (ext === '.ts' || ext === '.tsx') languages.add('TypeScript');
      if (ext === '.js' || ext === '.jsx') languages.add('JavaScript');
      if (ext === '.py') languages.add('Python');
      if (ext === '.go') languages.add('Go');
      if (ext === '.rs') languages.add('Rust');

      try {
        const content = await fs.promises.readFile(file, 'utf8');
        totalLines += content.split('\n').length;
      } catch (error) {
        // Failed to process - continue with other operations
      }
    }

    const packageJson = await this.readPackageJson();
    const framework = this.detectFramework(packageJson, files);

    return {
      scannedAt: new Date().toISOString(),
      totalFiles: files.length,
      totalLines,
      languages: Array.from(languages),
      framework,
      version: packageJson.version || '1.0.0',
    };
  }

  /**
   * Generate context rules file for AI assistants
   */
  async generateContextRules(projectMap: ProjectMap): Promise<string> {
    const rules: string[] = [];

    // Architecture rules
    rules.push(`# Project Architecture\n`);
    rules.push(`Type: ${projectMap.architecture.type}`);
    rules.push(`Framework: ${projectMap.metadata.framework || 'Unknown'}`);
    rules.push(`Build System: ${projectMap.architecture.buildSystem}`);
    rules.push(`Layers: ${projectMap.architecture.layers.join(', ')}\n`);

    // Endpoint rules
    if (projectMap.endpoints.length > 0) {
      rules.push(`# API Endpoints\n`);
      rules.push(`Total: ${projectMap.endpoints.length}\n`);
      projectMap.endpoints.slice(0, 10).forEach(ep => {
        rules.push(`- ${ep.method} ${ep.path} → ${ep.handler}`);
        if (ep.params.length > 0) {
          rules.push(`  Params: ${ep.params.join(', ')}`);
        }
        if (ep.auth) {
          rules.push(`  Auth: Required`);
        }
      });
      rules.push('');
    }

    // Data structure rules
    if (projectMap.dataStructures.length > 0) {
      rules.push(`# Data Structures\n`);
      rules.push(`Total: ${projectMap.dataStructures.length}\n`);
      projectMap.dataStructures.slice(0, 10).forEach(ds => {
        rules.push(`- ${ds.name} (${ds.type})`);
        rules.push(`  Fields: ${ds.fields.map(f => `${f.name}: ${f.type}`).join(', ')}`);
      });
      rules.push('');
    }

    // Pattern rules
    if (projectMap.patterns.length > 0) {
      rules.push(`# Code Patterns\n`);
      projectMap.patterns.forEach(pattern => {
        rules.push(`## ${pattern.name}`);
        rules.push(`Type: ${pattern.type}`);
        if (pattern.conventions.length > 0) {
          rules.push(`Conventions:`);
          pattern.conventions.forEach(c => rules.push(`  - ${c}`));
        }
        rules.push('');
      });
    }

    // Convention rules
    rules.push(`# Naming Conventions\n`);
    rules.push(`Files: ${projectMap.conventions.naming.files}`);
    rules.push(`Components: ${projectMap.conventions.naming.components}`);
    rules.push(`Functions: ${projectMap.conventions.naming.functions}`);
    rules.push(`Variables: ${projectMap.conventions.naming.variables}\n`);

    // Structure rules
    rules.push(`# Project Structure\n`);
    rules.push(`Components: ${projectMap.conventions.structure.components}`);
    rules.push(`Pages: ${projectMap.conventions.structure.pages}`);
    rules.push(`Utils: ${projectMap.conventions.structure.utils}`);
    rules.push(`Services: ${projectMap.conventions.structure.services}\n`);

    // Import/Export rules
    if (projectMap.conventions.imports.length > 0) {
      rules.push(`# Import Conventions\n`);
      projectMap.conventions.imports.forEach(imp => {
        rules.push(`- ${imp}`);
      });
      rules.push('');
    }

    // Critical rules
    rules.push(`# Critical Rules\n`);
    rules.push(`1. Always follow the established naming conventions`);
    rules.push(`2. Use existing patterns when creating new code`);
    rules.push(`3. Match the project's architecture type (${projectMap.architecture.type})`);
    rules.push(`4. Follow the established file structure`);
    rules.push(`5. Use registered API endpoints only`);
    rules.push(`6. Match existing data structure patterns`);
    rules.push(`7. Follow import/export conventions`);

    return rules.join('\n');
  }

  /**
   * Generate AI assistant context file
   */
  async generateAIContextFile(projectMap: ProjectMap): Promise<string> {
    const context = {
      project: {
        name: path.basename(this.projectPath),
        type: projectMap.architecture.type,
        framework: projectMap.metadata.framework,
        version: projectMap.metadata.version,
      },
      architecture: projectMap.architecture,
      endpoints: projectMap.endpoints.map(ep => ({
        path: ep.path,
        method: ep.method,
        handler: ep.handler,
        auth: ep.auth,
      })),
      dataStructures: projectMap.dataStructures.map(ds => ({
        name: ds.name,
        type: ds.type,
        fields: ds.fields.map(f => ({
          name: f.name,
          type: f.type,
          required: f.required,
        })),
      })),
      patterns: projectMap.patterns,
      conventions: projectMap.conventions,
      dependencies: {
        runtime: Object.keys(projectMap.dependencies.runtime),
        dev: Object.keys(projectMap.dependencies.dev),
      },
    };

    return JSON.stringify(context, null, 2);
  }

  // Helper methods (simplified implementations)
  private async findAllCodeFiles(dir: string): Promise<string[]> {
    const files: string[] = [];
    const ignoreDirs = ['node_modules', '.git', 'dist', 'build', '.next', 'coverage', '.cache'];

    async function walk(currentDir: string) {
      try {
        const items = await fs.promises.readdir(currentDir, { withFileTypes: true });
        for (const item of items) {
          const fullPath = path.join(currentDir, item.name);
          if (item.isDirectory() && !ignoreDirs.includes(item.name)) {
            await walk(fullPath);
          } else if (item.isFile() && /\.(ts|tsx|js|jsx|py|go|rs)$/.test(item.name)) {
            files.push(fullPath);
          }
        }
      } catch (error) {
        // Failed to process - continue with other operations
      }
    }

    await walk(dir);
    return files;
  }

  private async readPackageJson(): Promise<Record<string, unknown>> {
    const packagePath = path.join(this.projectPath, 'package.json');
    try {
      const content = await fs.promises.readFile(packagePath, 'utf8');
      return JSON.parse(content);
    } catch {
      return {};
    }
  }

  private detectFramework(packageJson: Record<string, unknown>, files: string[]): string | undefined {
    if (packageJson.dependencies?.next) return 'Next.js';
    if (packageJson.dependencies?.react) return 'React';
    if (packageJson.dependencies?.vue) return 'Vue';
    if (packageJson.dependencies?.express) return 'Express';
    if (files.some(f => f.includes('app.py'))) return 'Flask';
    return undefined;
  }

  private detectBuildSystem(packageJson: Record<string, unknown>, files: string[]): string {
    if (files.some(f => f.includes('webpack.config'))) return 'Webpack';
    if (files.some(f => f.includes('vite.config'))) return 'Vite';
    if (files.some(f => f.includes('rollup.config'))) return 'Rollup';
    if (packageJson.scripts?.build) return 'npm scripts';
    return 'Unknown';
  }

  private async findEntryPoints(files: string[]): Promise<string[]> {
    const entryPoints: string[] = [];
    const patterns = ['index.ts', 'index.js', 'main.ts', 'main.js', 'app.tsx', 'app.jsx'];
    
    for (const file of files) {
      const basename = path.basename(file);
      if (patterns.includes(basename)) {
        entryPoints.push(file);
      }
    }
    
    return entryPoints;
  }

  private async detectLayers(files: string[]): Promise<string[]> {
    const layers: string[] = [];
    const dirs = new Set<string>();

    for (const file of files) {
      const parts = path.dirname(file).split(path.sep);
      if (parts.length > 0) {
        dirs.add(parts[parts.length - 1]);
      }
    }

    if (dirs.has('components')) layers.push('components');
    if (dirs.has('pages')) layers.push('pages');
    if (dirs.has('api')) layers.push('api');
    if (dirs.has('services')) layers.push('services');
    if (dirs.has('utils')) layers.push('utils');
    if (dirs.has('hooks')) layers.push('hooks');

    return layers;
  }

  private async detectDeployment(files: string[]): Promise<string[]> {
    const deployment: string[] = [];
    if (files.some(f => f.includes('vercel.json'))) deployment.push('Vercel');
    if (files.some(f => f.includes('netlify.toml'))) deployment.push('Netlify');
    if (files.some(f => f.includes('dockerfile'))) deployment.push('Docker');
    if (files.some(f => f.includes('railway.json'))) deployment.push('Railway');
    return deployment;
  }

  private determineArchitectureType(files: string[], framework?: string): ArchitectureMap['type'] {
    if (files.some(f => f.includes('serverless'))) return 'serverless';
    if (files.some(f => f.includes('microservice'))) return 'microservices';
    if (framework === 'Next.js' || framework === 'React') return 'spa';
    if (files.some(f => f.includes('api')) && files.some(f => f.includes('components'))) return 'fullstack';
    return 'monolith';
  }

  private isApiFile(file: string): boolean {
    return file.includes('api') || file.includes('route') || file.includes('endpoint');
  }

  private extractEndpoints(content: string, file: string): EndpointMap[] {
    const endpoints: EndpointMap[] = [];
    
    // Express routes
    const expressPattern = /(?:app|router)\.(get|post|put|delete|patch)\(['"]([^'"]+)['"]/g;
    let match;
    while ((match = expressPattern.exec(content)) !== null) {
      endpoints.push({
        path: match[2],
        method: match[1].toUpperCase(),
        handler: file,
        params: [],
        queryParams: [],
      });
    }

    // Next.js API routes
    const nextPattern = /export\s+(?:default\s+)?(?:async\s+)?function\s+(GET|POST|PUT|DELETE|PATCH)/i;
    if (nextPattern.test(content)) {
      const method = content.match(nextPattern)?.[1]?.toUpperCase() || 'GET';
      const routePath = file.replace(/.*\/api\//, '/api/').replace(/\/route\.(ts|tsx|js|jsx)$/, '');
      endpoints.push({
        path: routePath,
        method,
        handler: file,
        params: [],
        queryParams: [],
      });
    }

    return endpoints;
  }

  private extractDataStructures(content: string, file: string): DataStructureMap[] {
    const structures: DataStructureMap[] = [];

    // TypeScript interfaces
    const interfacePattern = /(?:export\s+)?interface\s+(\w+)\s*\{([^}]+)\}/g;
    let match;
    while ((match = interfacePattern.exec(content)) !== null) {
      const fields = this.extractFields(match[2]);
      structures.push({
        name: match[1],
        type: 'interface',
        file,
        fields,
      });
    }

    // TypeScript types
    const typePattern = /(?:export\s+)?type\s+(\w+)\s*=\s*\{([^}]+)\}/g;
    while ((match = typePattern.exec(content)) !== null) {
      const fields = this.extractFields(match[2]);
      structures.push({
        name: match[1],
        type: 'type',
        file,
        fields,
      });
    }

    // Classes
    const classPattern = /(?:export\s+)?class\s+(\w+)/g;
    while ((match = classPattern.exec(content)) !== null) {
      structures.push({
        name: match[1],
        type: 'class',
        file,
        fields: [],
      });
    }

    return structures;
  }

  private extractFields(content: string): DataStructureMap['fields'] {
    const fields: DataStructureMap['fields'] = [];
    const fieldPattern = /(\w+)(\??):\s*([^;,\n]+)/g;
    let match;
    while ((match = fieldPattern.exec(content)) !== null) {
      fields.push({
        name: match[1],
        type: match[3].trim(),
        required: !match[2],
      });
    }
    return fields;
  }

  private async findInternalModules(): Promise<string[]> {
    const files = await this.findAllCodeFiles(this.projectPath);
    return files
      .filter(f => !f.includes('node_modules'))
      .map(f => path.relative(this.projectPath, f));
  }

  private extractConnections(content: string, file: string, allFiles: string[]): ConnectionMap[] {
    const connections: ConnectionMap[] = [];
    
    // Import statements
    const importPattern = /import\s+(?:.*\s+from\s+)?['"]([^'"]+)['"]/g;
    let match;
    while ((match = importPattern.exec(content)) !== null) {
      const importPath = match[1];
      if (!importPath.startsWith('.') && !importPath.startsWith('/')) {
        continue; // Skip node_modules
      }
      
      connections.push({
        from: file,
        to: importPath,
        type: 'import',
      });
    }

    return connections;
  }

  private isComponentFile(file: string): boolean {
    return file.includes('component') || /\.(tsx|jsx)$/.test(file);
  }

  private isHookFile(file: string): boolean {
    return file.includes('hook') || file.includes('use');
  }

  private isServiceFile(file: string): boolean {
    return file.includes('service') || file.includes('api');
  }

  private extractComponentConventions(files: string[]): string[] {
    // Simplified - would analyze actual component code
    return ['Functional components', 'Props interface', 'Export default'];
  }

  private extractHookConventions(files: string[]): string[] {
    return ['Custom hooks', 'use prefix', 'Return object'];
  }

  private extractServiceConventions(files: string[]): string[] {
    return ['Class-based', 'Async methods', 'Error handling'];
  }

  private detectNamingConvention(files: string[], type: string): string {
    // Simplified detection
    const sample = files.slice(0, 10);
    const hasKebab = sample.some(f => /[a-z]+-[a-z]+/.test(path.basename(f)));
    const hasCamel = sample.some(f => /[a-z][A-Z]/.test(path.basename(f)));
    
    if (hasKebab) return 'kebab-case';
    if (hasCamel) return 'camelCase';
    return 'unknown';
  }

  private detectStructure(files: string[], type: string): string {
    const dirs = files
      .map(f => path.dirname(f))
      .filter(d => d.includes(type))
      .map(d => d.split(path.sep).pop() || '');
    
    return dirs[0] || 'unknown';
  }

  private extractImportConventions(files: string[]): string[] {
    // Simplified
    return ['Named imports', 'Absolute paths', 'Type imports'];
  }

  private extractExportConventions(files: string[]): string[] {
    return ['Named exports', 'Default exports', 'Barrel exports'];
  }
}

export const contextManager = new FullCodebaseContextManager(process.cwd());

