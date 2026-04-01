/**
 * Truth Pack Generator — Context Engine (Layer 1)
 *
 * Writes the same **Truth Pack** as the standalone `@guardrail/context` (guardrail-context) CLI:
 * everything lands under **`.guardrail-context/`** (symbols, routes, deps, graph, risk, …).
 * Use `guardrail scan` with `--with-context` to refresh it, or `guardrail-context index` in
 * projects that only install the Context Engine package — one directory, one story.
 */

import { existsSync, mkdirSync, writeFileSync, readFileSync, readdirSync, statSync } from 'fs';
import { join, resolve, extname } from 'path';
import { execSync } from 'child_process';

export interface TruthPack {
  version: string;
  generatedAt: string;
  projectPath: string;
  stack: {
    framework: string;
    language: string;
    packageManager: string;
    runtime?: string;
  };
  metadata: {
    fileCount: number;
    lineCount: number;
    totalSize: number;
  };
}

export interface Symbol {
  name: string;
  type: 'function' | 'class' | 'interface' | 'type' | 'variable' | 'constant' | 'enum';
  file: string;
  line: number;
  column?: number;
  exported: boolean;
  signature?: string;
  doc?: string;
}

export interface Dependency {
  name: string;
  version: string;
  type: 'production' | 'dev' | 'peer' | 'optional';
  registry: string;
  license?: string;
}

export interface Route {
  path: string;
  method: string;
  file: string;
  line: number;
  handler: string;
  auth?: boolean;
  middleware?: string[];
  params?: string[];
}

export interface RiskTag {
  file: string;
  line: number;
  category: 'auth' | 'payment' | 'database' | 'security' | 'sensitive';
  severity: 'critical' | 'high' | 'medium' | 'low';
  description: string;
}

export interface Pattern {
  name: string;
  type: 'golden' | 'antipattern';
  file: string;
  line: number;
  description: string;
  example?: string;
}

/** Canonical output dir for Truth Pack / Context Engine (shared with guardrail-context). */
export const TRUTH_PACK_DIR = '.guardrail-context';

export class TruthPackGenerator {
  private projectPath: string;
  private truthPackPath: string;

  constructor(projectPath: string) {
    this.projectPath = resolve(projectPath);
    this.truthPackPath = join(this.projectPath, TRUTH_PACK_DIR);
  }

  /**
   * Generate complete Truth Pack
   */
  async generate(): Promise<TruthPack> {
    // Ensure directory exists
    if (!existsSync(this.truthPackPath)) {
      mkdirSync(this.truthPackPath, { recursive: true });
    }

    // Detect stack
    const stack = this.detectStack();

    // Generate all components
    const [symbols, deps, graph, routes, risk, importance, patterns, antipatterns, vulnerabilities] = await Promise.all([
      this.generateSymbols(),
      this.generateDependencies(),
      this.generateImportGraph(),
      this.generateRoutes(),
      this.generateRiskTags(),
      this.generateImportance(),
      this.generatePatterns(),
      this.generateAntipatterns(),
      this.generateVulnerabilities(),
    ]);

    // Generate metadata
    const metadata = this.generateMetadata();

    // Create Truth Pack
    const truthPack: TruthPack = {
      version: '1.0.0',
      generatedAt: new Date().toISOString(),
      projectPath: this.projectPath,
      stack,
      metadata,
    };

    // Write all files
    writeFileSync(join(this.truthPackPath, 'truthpack.json'), JSON.stringify(truthPack, null, 2));
    writeFileSync(join(this.truthPackPath, 'symbols.json'), JSON.stringify(symbols, null, 2));
    writeFileSync(join(this.truthPackPath, 'deps.json'), JSON.stringify(deps, null, 2));
    writeFileSync(join(this.truthPackPath, 'graph.json'), JSON.stringify(graph, null, 2));
    writeFileSync(join(this.truthPackPath, 'routes.json'), JSON.stringify(routes, null, 2));
    writeFileSync(join(this.truthPackPath, 'risk.json'), JSON.stringify(risk, null, 2));
    writeFileSync(join(this.truthPackPath, 'importance.json'), JSON.stringify(importance, null, 2));
    writeFileSync(join(this.truthPackPath, 'patterns.json'), JSON.stringify(patterns, null, 2));
    writeFileSync(join(this.truthPackPath, 'antipatterns.json'), JSON.stringify(antipatterns, null, 2));
    writeFileSync(join(this.truthPackPath, 'vulnerabilities.json'), JSON.stringify(vulnerabilities, null, 2));

    return truthPack;
  }

  /**
   * Check if Truth Pack exists and is fresh
   */
  isFresh(maxAgeHours: number = 24): boolean {
    const truthPackFile = join(this.truthPackPath, 'truthpack.json');
    if (!existsSync(truthPackFile)) {
      return false;
    }

    try {
      const content = JSON.parse(readFileSync(truthPackFile, 'utf-8'));
      const generatedAt = new Date(content.generatedAt);
      const ageHours = (Date.now() - generatedAt.getTime()) / (1000 * 60 * 60);
      return ageHours < maxAgeHours;
    } catch {
      return false;
    }
  }

  /**
   * Get Truth Pack path
   */
  getPath(): string {
    return this.truthPackPath;
  }

  private detectStack(): TruthPack['stack'] {
    const packageJsonPath = join(this.projectPath, 'package.json');
    const hasPackageJson = existsSync(packageJsonPath);
    
    let framework = 'unknown';
    let language = 'unknown';
    let packageManager = 'unknown';
    let runtime: string | undefined;

    if (hasPackageJson) {
      try {
        const pkg = JSON.parse(readFileSync(packageJsonPath, 'utf-8'));
        
        // Detect framework
        if (pkg.dependencies?.['next']) framework = 'nextjs';
        else if (pkg.dependencies?.['react']) framework = 'react';
        else if (pkg.dependencies?.['vue']) framework = 'vue';
        else if (pkg.dependencies?.['@nestjs/core']) framework = 'nestjs';
        else if (pkg.dependencies?.['express']) framework = 'express';
        else if (pkg.dependencies?.['fastify']) framework = 'fastify';
        else if (pkg.dependencies?.['@angular/core']) framework = 'angular';
        
        // Detect package manager
        if (existsSync(join(this.projectPath, 'pnpm-lock.yaml'))) packageManager = 'pnpm';
        else if (existsSync(join(this.projectPath, 'yarn.lock'))) packageManager = 'yarn';
        else if (existsSync(join(this.projectPath, 'package-lock.json'))) packageManager = 'npm';
        
        // Detect runtime
        if (pkg.engines?.node) runtime = `node ${pkg.engines.node}`;
      } catch {
        // Ignore
      }
    }

    // Detect language from files
    const tsConfigPath = join(this.projectPath, 'tsconfig.json');
    if (existsSync(tsConfigPath)) {
      language = 'typescript';
    } else {
      // Check for .js files
      try {
        const result = execSync('find . -name "*.js" -type f | head -1', { cwd: this.projectPath, encoding: 'utf-8' });
        if (result.trim()) language = 'javascript';
      } catch {
        // Ignore
      }
    }

    return { framework, language, packageManager, runtime };
  }

  private async generateSymbols(): Promise<Symbol[]> {
    const symbols: Symbol[] = [];
    const codeFiles = await this.findCodeFiles(['.ts', '.tsx', '.js', '.jsx']);

    for (const file of codeFiles) {
      try {
        const content = readFileSync(file, 'utf-8');
        const relativePath = file.replace(this.projectPath + '/', '');

        // Extract exports using regex (fallback if TypeScript API not available)
        const exportPatterns = [
          /export\s+(?:async\s+)?function\s+(\w+)/g,
          /export\s+(?:default\s+)?class\s+(\w+)/g,
          /export\s+(?:default\s+)?(?:const|let|var)\s+(\w+)/g,
          /export\s+interface\s+(\w+)/g,
          /export\s+type\s+(\w+)/g,
          /export\s+enum\s+(\w+)/g,
        ];

        const lines = content.split('\n');
        lines.forEach((line, index) => {
          for (const pattern of exportPatterns) {
            const match = pattern.exec(line);
            if (match) {
              const name = match[1];
              if (name === undefined) continue;
              let type: Symbol['type'] = 'function';
              if (line.includes('class')) type = 'class';
              else if (line.includes('interface')) type = 'interface';
              else if (line.includes('type')) type = 'type';
              else if (line.includes('enum')) type = 'enum';
              else if (line.includes('const') || line.includes('let') || line.includes('var')) type = 'variable';

              symbols.push({
                name,
                type,
                file: relativePath,
                line: index + 1,
                exported: true,
                signature: this.extractSignature(line, content, index),
                doc: this.extractDoc(content, index),
              });
            }
          }
        });
      } catch {
        // Ignore files we can't read
      }
    }

    return symbols;
  }

  private extractSignature(line: string, content: string, lineIndex: number): string | undefined {
    // Extract function/class signature
    const lines = content.split('\n');
    let signature = line.trim();
    
    // If line ends with {, get more lines
    if (signature.endsWith('{') || signature.includes('=>')) {
      let i = lineIndex;
      while (i < lines.length - 1 && !signature.includes('{') && !signature.includes('=>')) {
        i++;
        signature += ' ' + (lines[i]?.trim() ?? '');
        if (signature.length > 200) break; // Limit length
      }
    }
    
    return signature.length > 200 ? signature.substring(0, 200) + '...' : signature;
  }

  private extractDoc(content: string, lineIndex: number): string | undefined {
    const lines = content.split('\n');
    const docLines: string[] = [];
    
    // Look backwards for JSDoc comments
    for (let i = lineIndex - 1; i >= 0 && i >= lineIndex - 10; i--) {
      const line = lines[i]?.trim() ?? '';
      if (line.startsWith('*') || line.startsWith('/**') || line.startsWith('//')) {
        docLines.unshift(line.replace(/^\s*[*\/]+\s*/, ''));
      } else if (line.length > 0 && !line.startsWith('*')) {
        break;
      }
    }
    
    return docLines.length > 0 ? docLines.join(' ').substring(0, 200) : undefined;
  }

  private async findCodeFiles(extensions: string[]): Promise<string[]> {
    const files: string[] = [];
    const exclude = ['node_modules', '.git', 'dist', 'build', '.next'];
    
    const walk = (dir: string, depth: number = 0): void => {
      if (depth > 10) return; // Limit depth
      
      try {
        const entries = readdirSync(dir);
        for (const entry of entries) {
          const fullPath = join(dir, entry);
          const stat = statSync(fullPath);
          
          if (stat.isDirectory()) {
            if (!exclude.some(e => entry.includes(e))) {
              walk(fullPath, depth + 1);
            }
          } else if (stat.isFile()) {
            const ext = extname(entry);
            if (extensions.includes(ext)) {
              files.push(fullPath);
            }
          }
        }
      } catch {
        // Ignore errors
      }
    };
    
    walk(this.projectPath);
    return files;
  }

  private async generateDependencies(): Promise<Dependency[]> {
    const packageJsonPath = join(this.projectPath, 'package.json');
    if (!existsSync(packageJsonPath)) {
      return [];
    }

    try {
      const pkg = JSON.parse(readFileSync(packageJsonPath, 'utf-8'));
      const deps: Dependency[] = [];

      // Production dependencies
      if (pkg.dependencies) {
        for (const [name, version] of Object.entries(pkg.dependencies)) {
          deps.push({
            name,
            version: version as string,
            type: 'production',
            registry: 'npm',
          });
        }
      }

      // Dev dependencies
      if (pkg.devDependencies) {
        for (const [name, version] of Object.entries(pkg.devDependencies)) {
          deps.push({
            name,
            version: version as string,
            type: 'dev',
            registry: 'npm',
          });
        }
      }

      return deps;
    } catch {
      return [];
    }
  }

  private async generateImportGraph(): Promise<Record<string, string[]>> {
    const graph: Record<string, string[]> = {};
    const codeFiles = await this.findCodeFiles(['.ts', '.tsx', '.js', '.jsx']);

    for (const file of codeFiles) {
      try {
        const content = readFileSync(file, 'utf-8');
        const relativePath = file.replace(this.projectPath + '/', '');
        const imports: string[] = [];

        // Extract imports
        const importPatterns = [
          /import\s+.*?\s+from\s+['"]([^'"]+)['"]/g,
          /require\s*\(['"]([^'"]+)['"]\)/g,
        ];

        for (const pattern of importPatterns) {
          let match;
          while ((match = pattern.exec(content)) !== null) {
            const importPath = match[1];
            if (importPath === undefined) continue;
            // Only track internal imports (relative paths)
            if (importPath.startsWith('.') || importPath.startsWith('/')) {
              imports.push(importPath);
            }
          }
        }

        if (imports.length > 0) {
          graph[relativePath] = imports;
        }
      } catch {
        // Ignore files we can't read
      }
    }

    return graph;
  }

  private async generateRoutes(): Promise<Route[]> {
    const routes: Route[] = [];
    const codeFiles = await this.findCodeFiles(['.ts', '.tsx', '.js', '.jsx']);

    for (const file of codeFiles) {
      try {
        const content = readFileSync(file, 'utf-8');
        const relativePath = file.replace(this.projectPath + '/', '');
        const lines = content.split('\n');

        // Express/Fastify routes: app.get('/path', handler) or fastify.get('/path', handler)
        const expressPattern = /(?:app|router|fastify)\.(get|post|put|delete|patch|options|head)\s*\(\s*['"`]([^'"`]+)['"`]/gi;
        let match;
        while ((match = expressPattern.exec(content)) !== null) {
          const method = match[1];
          const routePath = match[2];
          if (method === undefined || routePath === undefined) continue;
          const lineNum = content.substring(0, match.index).split('\n').length;
          routes.push({
            path: routePath,
            method: method.toUpperCase(),
            file: relativePath,
            line: lineNum,
            handler: this.extractHandlerName(content, match.index),
            auth: this.hasAuth(content, lineNum),
            middleware: this.extractMiddleware(content, lineNum),
            params: this.extractParams(routePath),
          });
        }

        // Next.js API routes: export async function GET/POST/etc
        if (file.includes('/api/') || file.includes('/route.')) {
          const nextPattern = /export\s+(?:async\s+)?function\s+(GET|POST|PUT|DELETE|PATCH|OPTIONS|HEAD)\s*\(/gi;
          while ((match = nextPattern.exec(content)) !== null) {
            const verb = match[1];
            if (verb === undefined) continue;
            const lineNum = content.substring(0, match.index).split('\n').length;
            const routePath = this.extractNextJSRoutePath(file);
            routes.push({
              path: routePath,
              method: match[1],
              file: relativePath,
              line: lineNum,
              handler: match[1],
              auth: this.hasAuth(content, lineNum),
              middleware: [],
              params: this.extractParams(routePath),
            });
          }
        }
      } catch {
        // Ignore files we can't read
      }
    }

    return routes;
  }

  private extractHandlerName(content: string, index: number): string {
    // Extract handler function name from route definition
    const afterMatch = content.substring(index);
    const handlerMatch = afterMatch.match(/,\s*(\w+)\s*\)/);
    const name = handlerMatch?.[1];
    return name !== undefined ? name : 'anonymous';
  }

  private hasAuth(content: string, lineNum: number): boolean {
    const lines = content.split('\n');
    const context = lines.slice(Math.max(0, lineNum - 10), lineNum + 5).join('\n');
    return /auth|authenticate|requireAuth|isAuthenticated|middleware.*auth/i.test(context);
  }

  private extractMiddleware(content: string, lineNum: number): string[] {
    const lines = content.split('\n');
    const context = lines.slice(Math.max(0, lineNum - 10), lineNum + 5).join('\n');
    const middleware: string[] = [];
    
    if (/cors/i.test(context)) middleware.push('cors');
    if (/helmet/i.test(context)) middleware.push('helmet');
    if (/rateLimit/i.test(context)) middleware.push('rateLimit');
    if (/validate|zod/i.test(context)) middleware.push('validation');
    
    return middleware;
  }

  private extractParams(path: string): string[] {
    // Extract path parameters like :id or [id]
    const params: string[] = [];
    const paramPattern = /[:[](\w+)[\]}]/g;
    let match;
    while ((match = paramPattern.exec(path)) !== null) {
      const p = match[1];
      if (p !== undefined) params.push(p);
    }
    return params;
  }

  private extractNextJSRoutePath(filePath: string): string {
    // Convert /app/api/users/route.ts to /api/users
    const apiMatch = filePath.match(/\/api\/(.+?)\/route\.(ts|tsx|js|jsx)$/);
    if (apiMatch) {
      return `/api/${apiMatch[1]}`;
    }
    // Convert /pages/api/users.ts to /api/users
    const pagesMatch = filePath.match(/\/pages\/api\/(.+?)\.(ts|tsx|js|jsx)$/);
    if (pagesMatch) {
      return `/api/${pagesMatch[1]}`;
    }
    return '/api/unknown';
  }

  private async generateRiskTags(): Promise<RiskTag[]> {
    const riskTags: RiskTag[] = [];
    const codeFiles = await this.findCodeFiles(['.ts', '.tsx', '.js', '.jsx']);

    for (const file of codeFiles) {
      try {
        const content = readFileSync(file, 'utf-8');
        const relativePath = file.replace(this.projectPath + '/', '');
        const lines = content.split('\n');

        lines.forEach((line, index) => {
          const lineNum = index + 1;

          // Auth risk
          if (/password|token|jwt|session|auth|login|signin/i.test(line) && 
              /process\.env|hardcoded|secret|key/i.test(line)) {
            riskTags.push({
              file: relativePath,
              line: lineNum,
              category: 'auth',
              severity: 'critical',
              description: 'Potential auth credential exposure',
            });
          }

          // Payment risk
          if (/stripe|payment|billing|charge|subscription|card|credit/i.test(line) &&
              !line.includes('//') && !line.includes('test')) {
            riskTags.push({
              file: relativePath,
              line: lineNum,
              category: 'payment',
              severity: 'high',
              description: 'Payment processing detected',
            });
          }

          // Database risk
          if (/sql|query|database|db\.|prisma\.|mongoose\.|sequelize/i.test(line) &&
              /SELECT|INSERT|UPDATE|DELETE|DROP/i.test(line.toUpperCase())) {
            riskTags.push({
              file: relativePath,
              line: lineNum,
              category: 'database',
              severity: 'high',
              description: 'Database operation detected',
            });
          }

          // Security risk
          if (/eval|exec|dangerouslySetInnerHTML|innerHTML|document\.write/i.test(line)) {
            riskTags.push({
              file: relativePath,
              line: lineNum,
              category: 'security',
              severity: 'critical',
              description: 'Potentially dangerous operation',
            });
          }

          // Sensitive data
          if (/ssn|social.*security|credit.*card|bank.*account|routing/i.test(line)) {
            riskTags.push({
              file: relativePath,
              line: lineNum,
              category: 'sensitive',
              severity: 'critical',
              description: 'Sensitive data handling detected',
            });
          }
        });
      } catch {
        // Ignore files we can't read
      }
    }

    return riskTags;
  }

  private async generateImportance(): Promise<Record<string, number>> {
    const importance: Record<string, number> = {};
    
    // Get risk tags and import graph
    const [riskTags, importGraph] = await Promise.all([
      this.generateRiskTags(),
      this.generateImportGraph(),
    ]);

    // Calculate centrality (how many files import this file)
    const centrality: Record<string, number> = {};
    for (const [file, imports] of Object.entries(importGraph)) {
      centrality[file] = imports.length;
    }

    // Count how many files import each file
    for (const imports of Object.values(importGraph)) {
      for (const imp of imports) {
        // Resolve import path to actual file
        const resolvedFile = this.resolveImportPath(imp);
        if (resolvedFile) {
          centrality[resolvedFile] = (centrality[resolvedFile] || 0) + 1;
        }
      }
    }

    // Calculate importance = risk score × centrality
    const riskByFile: Record<string, number> = {};
    riskTags.forEach(tag => {
      const riskScore = tag.severity === 'critical' ? 10 : tag.severity === 'high' ? 5 : tag.severity === 'medium' ? 2 : 1;
      riskByFile[tag.file] = (riskByFile[tag.file] || 0) + riskScore;
    });

    // Combine risk and centrality
    const allFiles = new Set([...Object.keys(centrality), ...Object.keys(riskByFile)]);
    allFiles.forEach(file => {
      const risk = riskByFile[file] || 1;
      const cent = centrality[file] || 1;
      importance[file] = risk * Math.log(cent + 1); // Log scale for centrality
    });

    return importance;
  }

  private resolveImportPath(importPath: string): string | null {
    // Simple resolution - in production, would need proper module resolution
    if (importPath.startsWith('.')) {
      // Relative import - would need to resolve from importing file
      return null;
    }
    return null; // External imports don't count
  }

  private async generatePatterns(): Promise<Pattern[]> {
    const patterns: Pattern[] = [];
    const codeFiles = await this.findCodeFiles(['.ts', '.tsx', '.js', '.jsx']);

    // Look for common patterns (error handling, API structure, etc.)
    for (const file of codeFiles) {
      try {
        const content = readFileSync(file, 'utf-8');
        const relativePath = file.replace(this.projectPath + '/', '');

        // Error handling pattern
        if (/try\s*\{[\s\S]*catch\s*\([\s\S]*\)\s*\{[\s\S]*\}/.test(content) &&
            !content.includes('catch () {}') && // Not empty catch
            content.includes('throw') || content.includes('error')) {
          patterns.push({
            name: 'Proper Error Handling',
            type: 'golden',
            file: relativePath,
            line: 1,
            description: 'Uses try-catch with proper error propagation',
          });
        }

        // Type safety pattern
        if (file.endsWith('.ts') && /:\s*\w+[\[\]<>]/.test(content)) {
          patterns.push({
            name: 'Type Safety',
            type: 'golden',
            file: relativePath,
            line: 1,
            description: 'Uses TypeScript type annotations',
          });
        }
      } catch {
        // Ignore
      }
    }

    return patterns;
  }

  private async generateAntipatterns(): Promise<Pattern[]> {
    const antipatterns: Pattern[] = [];
    const codeFiles = await this.findCodeFiles(['.ts', '.tsx', '.js', '.jsx']);

    for (const file of codeFiles) {
      try {
        const content = readFileSync(file, 'utf-8');
        const relativePath = file.replace(this.projectPath + '/', '');
        const lines = content.split('\n');

        lines.forEach((line, index) => {
          // Empty catch
          if (/catch\s*\([^)]*\)\s*\{\s*\}/.test(line)) {
            antipatterns.push({
              name: 'Empty Catch Block',
              type: 'antipattern',
              file: relativePath,
              line: index + 1,
              description: 'Swallows errors silently',
            });
          }

          // Console.log in production
          if (/console\.(log|error|warn)/.test(line) && !file.includes('test')) {
            antipatterns.push({
              name: 'Console in Production',
              type: 'antipattern',
              file: relativePath,
              line: index + 1,
              description: 'Console statements should use proper logging',
            });
          }

          // Any types
          if (/: any/.test(line)) {
            antipatterns.push({
              name: 'Any Type Usage',
              type: 'antipattern',
              file: relativePath,
              line: index + 1,
              description: 'Avoid any types for type safety',
            });
          }
        });
      } catch {
        // Ignore
      }
    }

    return antipatterns;
  }

  private async generateVulnerabilities(): Promise<any[]> {
    const vulnerabilities: any[] = [];
    
    // Check dependencies for known vulnerabilities
    const deps = await this.generateDependencies();
    
    // TODO: Integrate with OSV API or vulnerability database
    // For now, check for known vulnerable packages
    const knownVulnerable = [
      'lodash@4.17.20', // Example
    ];

    deps.forEach(dep => {
      const depKey = `${dep.name}@${dep.version}`;
      if (knownVulnerable.some(v => depKey.includes(v))) {
        vulnerabilities.push({
          package: dep.name,
          version: dep.version,
          severity: 'high',
          description: 'Known vulnerability',
        });
      }
    });

    return vulnerabilities;
  }

  private generateMetadata(): TruthPack['metadata'] {
    let fileCount = 0;
    let lineCount = 0;
    let totalSize = 0;

    const countFiles = (dir: string, depth: number = 0): void => {
      if (depth > 10) return;

      try {
        const entries = readdirSync(dir);
        for (const entry of entries) {
          const fullPath = join(dir, entry);
          const stat = statSync(fullPath);

          if (stat.isDirectory()) {
            if (!['node_modules', '.git', 'dist', 'build', '.next'].some(e => entry.includes(e))) {
              countFiles(fullPath, depth + 1);
            }
          } else if (stat.isFile()) {
            fileCount++;
            totalSize += stat.size;
            
            // Count lines for code files
            if (['.ts', '.tsx', '.js', '.jsx', '.py', '.java'].includes(extname(entry))) {
              try {
                const content = readFileSync(fullPath, 'utf-8');
                lineCount += content.split('\n').length;
              } catch {
                // Ignore
              }
            }
          }
        }
      } catch {
        // Ignore errors
      }
    };

    countFiles(this.projectPath);

    return {
      fileCount,
      lineCount,
      totalSize,
    };
  }
}
