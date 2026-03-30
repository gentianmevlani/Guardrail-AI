/**
 * Python Framework Adapter (Django, Flask, FastAPI)
 * 
 * Framework-specific optimizations for Python frameworks
 */

import * as fs from 'fs';
import * as path from 'path';

export interface PythonAnalysis {
  framework: 'django' | 'flask' | 'fastapi' | 'unknown';
  apps: string[]; // Django apps
  views: string[];
  models: string[];
  routes: Array<{
    path: string;
    method: string;
    handler: string;
  }>;
  patterns: Array<{
    type: string;
    description: string;
  }>;
}

class PythonAdapter {
  /**
   * Analyze Python codebase
   */
  async analyze(projectPath: string): Promise<PythonAnalysis> {
    const framework = await this.detectFramework(projectPath);

    const apps: string[] = [];
    const views: string[] = [];
    const models: string[] = [];
    const routes: PythonAnalysis['routes'] = [];

    if (framework === 'django') {
      const djangoAnalysis = await this.analyzeDjango(projectPath);
      apps.push(...djangoAnalysis.apps);
      views.push(...djangoAnalysis.views);
      models.push(...djangoAnalysis.models);
    } else if (framework === 'flask') {
      const flaskAnalysis = await this.analyzeFlask(projectPath);
      routes.push(...flaskAnalysis.routes);
    } else if (framework === 'fastapi') {
      const fastapiAnalysis = await this.analyzeFastAPI(projectPath);
      routes.push(...fastapiAnalysis.routes);
    }

    return {
      framework,
      apps,
      views,
      models,
      routes,
      patterns: this.extractPatterns(framework, apps, views, models, routes),
    };
  }

  /**
   * Generate Python-specific context
   */
  async generateContext(projectPath: string): Promise<string> {
    const analysis = await this.analyze(projectPath);

    return `# Python/${analysis.framework.toUpperCase()} Project Context

## Framework
- ${analysis.framework.toUpperCase()}

## Django Apps
${analysis.apps.map(a => `- ${a}`).join('\n')}

## Views
${analysis.views.map(v => `- ${v}`).join('\n')}

## Models
${analysis.models.map(m => `- ${m}`).join('\n')}

## Routes
${analysis.routes.map(r => `- ${r.method} ${r.path}`).join('\n')}
`;
  }

  /**
   * Detect framework
   */
  private async detectFramework(projectPath: string): Promise<PythonAnalysis['framework']> {
    if (await this.pathExists(path.join(projectPath, 'manage.py'))) {
      return 'django';
    }

    const requirementsPath = path.join(projectPath, 'requirements.txt');
    if (await this.pathExists(requirementsPath)) {
      try {
        const content = await fs.promises.readFile(requirementsPath, 'utf8');
        if (content.includes('fastapi')) return 'fastapi';
        if (content.includes('flask')) return 'flask';
        if (content.includes('django')) return 'django';
      } catch {
        // Error reading requirements.txt
      }
    }

    return 'unknown';
  }

  /**
   * Analyze Django
   */
  private async analyzeDjango(projectPath: string): Promise<{
    apps: string[];
    views: string[];
    models: string[];
  }> {
    const apps: string[] = [];
    const views: string[] = [];
    const models: string[] = [];

    // Find Django apps
    const appsDir = path.join(projectPath, 'apps');
    if (await this.pathExists(appsDir)) {
      const items = await fs.promises.readdir(appsDir, { withFileTypes: true });
      for (const item of items) {
        if (item.isDirectory()) {
          apps.push(item.name);
        }
      }
    }

    // Find views
    const viewFiles = await this.findPythonFiles(projectPath, /views\.py$/);
    for (const file of viewFiles) {
      try {
        const content = await fs.promises.readFile(file, 'utf8');
        const viewMatches = content.match(/def\s+(\w+)\s*\(/g);
        if (viewMatches) {
          views.push(...viewMatches.map(m => m.match(/\w+/)![0]));
        }
      } catch {
        // Error reading file
      }
    }

    // Find models
    const modelFiles = await this.findPythonFiles(projectPath, /models\.py$/);
    for (const file of modelFiles) {
      try {
        const content = await fs.promises.readFile(file, 'utf8');
        const modelMatches = content.match(/class\s+(\w+)\s*\(.*Model\)/g);
        if (modelMatches) {
          models.push(...modelMatches.map(m => m.match(/\w+/)![0]));
        }
      } catch {
        // Error reading file
      }
    }

    return { apps, views, models };
  }

  /**
   * Analyze Flask
   */
  private async analyzeFlask(projectPath: string): Promise<{
    routes: PythonAnalysis['routes'];
  }> {
    const routes: PythonAnalysis['routes'] = [];

    const files = await this.findPythonFiles(projectPath, /\.py$/);
    for (const file of files) {
      try {
        const content = await fs.promises.readFile(file, 'utf8');

        // Extract Flask routes
        const routePattern = /@app\.route\(['"]([^'"]+)['"],\s*methods=\[['"]([^'"]+)['"]\]\)/g;
        let match;
        while ((match = routePattern.exec(content)) !== null) {
          routes.push({
            path: match[1],
            method: match[2],
            handler: 'handler',
          });
        }
      } catch {
        // Error reading file
      }
    }

    return { routes };
  }

  /**
   * Analyze FastAPI
   */
  private async analyzeFastAPI(projectPath: string): Promise<{
    routes: PythonAnalysis['routes'];
  }> {
    const routes: PythonAnalysis['routes'] = [];

    const files = await this.findPythonFiles(projectPath, /\.py$/);
    for (const file of files) {
      try {
        const content = await fs.promises.readFile(file, 'utf8');

        // Extract FastAPI routes
        const routePatterns = [
          { regex: /@app\.(get|post|put|delete|patch)\s*\(['"]([^'"]+)['"]\)/g, method: 'GET' },
          { regex: /@router\.(get|post|put|delete|patch)\s*\(['"]([^'"]+)['"]\)/g, method: 'GET' },
        ];

        for (const pattern of routePatterns) {
          let match;
          while ((match = pattern.regex.exec(content)) !== null) {
            routes.push({
              path: match[2],
              method: match[1]?.toUpperCase() || pattern.method,
              handler: 'handler',
            });
          }
        }
      } catch {
        // Error reading file
      }
    }

    return { routes };
  }

  private extractPatterns(
    framework: PythonAnalysis['framework'],
    apps: string[],
    views: string[],
    models: string[],
    routes: PythonAnalysis['routes']
  ): PythonAnalysis['patterns'] {
    const patterns: PythonAnalysis['patterns'] = [];

    if (framework === 'django') {
      if (apps.length > 0) {
        patterns.push({
          type: 'django-apps',
          description: 'Uses Django app structure',
        });
      }
    }

    if (routes.length > 0) {
      patterns.push({
        type: 'routing',
        description: 'Uses routing pattern',
      });
    }

    return patterns;
  }

  private async findPythonFiles(dir: string, pattern?: RegExp): Promise<string[]> {
    const files: string[] = [];
    try {
      const items = await fs.promises.readdir(dir, { withFileTypes: true });
      for (const item of items) {
        const fullPath = path.join(dir, item.name);
        if (item.isDirectory() && !this.shouldIgnore(item.name)) {
          files.push(...await this.findPythonFiles(fullPath, pattern));
        } else if (item.isFile() && /\.py$/.test(item.name)) {
          if (!pattern || pattern.test(item.name)) {
            files.push(fullPath);
          }
        }
      }
    } catch {
      // Error reading directory
    }
    return files;
  }

  private shouldIgnore(name: string): boolean {
    return ['node_modules', '.git', '__pycache__', 'venv', '.venv', 'env', '.env'].includes(name);
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

export const pythonAdapter = new PythonAdapter();

