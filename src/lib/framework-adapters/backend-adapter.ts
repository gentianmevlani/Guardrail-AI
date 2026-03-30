/**
 * Backend Framework Adapter (Express, Fastify, NestJS)
 * 
 * Framework-specific optimizations for backend frameworks
 */

import * as fs from 'fs';
import * as path from 'path';

export interface BackendAnalysis {
  framework: 'express' | 'fastify' | 'nest' | 'unknown';
  routes: Array<{
    path: string;
    method: string;
    handler: string;
    middleware: string[];
  }>;
  middleware: string[];
  controllers: string[];
  services: string[];
  models: string[];
  patterns: Array<{
    type: string;
    description: string;
  }>;
}

class BackendAdapter {
  /**
   * Analyze backend codebase
   */
  async analyze(projectPath: string): Promise<BackendAnalysis> {
    // Detect framework
    const framework = await this.detectFramework(projectPath);

    const routes: BackendAnalysis['routes'] = [];
    const middleware: string[] = [];
    const controllers: string[] = [];
    const services: string[] = [];
    const models: string[] = [];

    if (framework === 'express') {
      const expressAnalysis = await this.analyzeExpress(projectPath);
      routes.push(...expressAnalysis.routes);
      middleware.push(...expressAnalysis.middleware);
    } else if (framework === 'nest') {
      const nestAnalysis = await this.analyzeNest(projectPath);
      controllers.push(...nestAnalysis.controllers);
      services.push(...nestAnalysis.services);
    }

    // Find models
    const modelFiles = await this.findModelFiles(projectPath);
    for (const file of modelFiles) {
      const modelName = path.basename(file, path.extname(file));
      models.push(modelName);
    }

    return {
      framework,
      routes,
      middleware,
      controllers,
      services,
      models,
      patterns: this.extractPatterns(routes, middleware),
    };
  }

  /**
   * Generate backend-specific context
   */
  async generateContext(projectPath: string): Promise<string> {
    const analysis = await this.analyze(projectPath);

    return `# Backend Project Context

## Framework
- ${analysis.framework.toUpperCase()}

## API Endpoints
${analysis.routes.map(r => `- ${r.method} ${r.path}`).join('\n')}

## Middleware
${analysis.middleware.map(m => `- ${m}`).join('\n')}

## Controllers
${analysis.controllers.map(c => `- ${c}`).join('\n')}

## Services
${analysis.services.map(s => `- ${s}`).join('\n')}

## Models
${analysis.models.map(m => `- ${m}`).join('\n')}
`;
  }

  /**
   * Detect framework
   */
  private async detectFramework(projectPath: string): Promise<BackendAnalysis['framework']> {
    const pkgPath = path.join(projectPath, 'package.json');
    if (await this.pathExists(pkgPath)) {
      try {
        const pkg = JSON.parse(await fs.promises.readFile(pkgPath, 'utf8'));
        const deps = { ...pkg.dependencies, ...pkg.devDependencies };

        if (deps['@nestjs/core']) return 'nest';
        if (deps.fastify) return 'fastify';
        if (deps.express) return 'express';
      } catch {
        // Error reading package.json
      }
    }

    return 'unknown';
  }

  /**
   * Analyze Express
   */
  private async analyzeExpress(projectPath: string): Promise<{
    routes: BackendAnalysis['routes'];
    middleware: string[];
  }> {
    const routes: BackendAnalysis['routes'] = [];
    const middleware: string[] = [];

    const files = await this.findJavaScriptFiles(projectPath);

    for (const file of files) {
      try {
        const content = await fs.promises.readFile(file, 'utf8');

        // Extract routes
        const routePatterns = [
          { regex: /\.(get|post|put|delete|patch)\s*\(['"]([^'"]+)['"]/g, method: 'GET' },
          { regex: /router\.(get|post|put|delete|patch)\s*\(['"]([^'"]+)['"]/g, method: 'GET' },
        ];

        for (const pattern of routePatterns) {
          let match;
          while ((match = pattern.regex.exec(content)) !== null) {
            routes.push({
              path: match[2] || match[1],
              method: match[1]?.toUpperCase() || pattern.method,
              handler: 'handler',
              middleware: [],
            });
          }
        }

        // Extract middleware
        const middlewarePattern = /app\.use\(|router\.use\(/g;
        if (middlewarePattern.test(content)) {
          middleware.push(path.basename(file));
        }
      } catch {
        // Error reading file
      }
    }

    return { routes, middleware };
  }

  /**
   * Analyze NestJS
   */
  private async analyzeNest(projectPath: string): Promise<{
    controllers: string[];
    services: string[];
  }> {
    const controllers: string[] = [];
    const services: string[] = [];

    const files = await this.findTypeScriptFiles(projectPath);

    for (const file of files) {
      try {
        const content = await fs.promises.readFile(file, 'utf8');

        if (/@Controller/.test(content)) {
          const match = content.match(/export\s+class\s+(\w+Controller)/);
          if (match) {
            controllers.push(match[1]);
          }
        }

        if (/@Injectable/.test(content)) {
          const match = content.match(/export\s+class\s+(\w+Service)/);
          if (match) {
            services.push(match[1]);
          }
        }
      } catch {
        // Error reading file
      }
    }

    return { controllers, services };
  }

  private extractPatterns(
    routes: BackendAnalysis['routes'],
    middleware: string[]
  ): BackendAnalysis['patterns'] {
    const patterns: BackendAnalysis['patterns'] = [];

    if (middleware.length > 0) {
      patterns.push({
        type: 'middleware',
        description: 'Uses middleware pattern',
      });
    }

    if (routes.length > 10) {
      patterns.push({
        type: 'routing',
        description: 'Uses routing pattern',
      });
    }

    return patterns;
  }

  private async findModelFiles(dir: string): Promise<string[]> {
    const files: string[] = [];
    try {
      const items = await fs.promises.readdir(dir, { withFileTypes: true });
      for (const item of items) {
        const fullPath = path.join(dir, item.name);
        if (item.isDirectory() && !this.shouldIgnore(item.name)) {
          files.push(...await this.findModelFiles(fullPath));
        } else if (item.isFile() && /(?:model|schema|entity)\.(ts|js)$/i.test(item.name)) {
          files.push(fullPath);
        }
      }
    } catch {
      // Error reading directory
    }
    return files;
  }

  private async findJavaScriptFiles(dir: string): Promise<string[]> {
    const files: string[] = [];
    try {
      const items = await fs.promises.readdir(dir, { withFileTypes: true });
      for (const item of items) {
        const fullPath = path.join(dir, item.name);
        if (item.isDirectory() && !this.shouldIgnore(item.name)) {
          files.push(...await this.findJavaScriptFiles(fullPath));
        } else if (item.isFile() && /\.(js|ts)$/.test(item.name)) {
          files.push(fullPath);
        }
      }
    } catch {
      // Error reading directory
    }
    return files;
  }

  private async findTypeScriptFiles(dir: string): Promise<string[]> {
    const files: string[] = [];
    try {
      const items = await fs.promises.readdir(dir, { withFileTypes: true });
      for (const item of items) {
        const fullPath = path.join(dir, item.name);
        if (item.isDirectory() && !this.shouldIgnore(item.name)) {
          files.push(...await this.findTypeScriptFiles(fullPath));
        } else if (item.isFile() && /\.ts$/.test(item.name)) {
          files.push(fullPath);
        }
      }
    } catch {
      // Error reading directory
    }
    return files;
  }

  private shouldIgnore(name: string): boolean {
    return ['node_modules', '.git', 'dist', 'build', 'coverage'].includes(name);
  }

  private async pathExists(p: string): Promise<boolean> {
    try {
      await fs.promises.access(p);
      return true;
    } catch {
      return false;
    }
  }
}

export const backendAdapter = new BackendAdapter();

