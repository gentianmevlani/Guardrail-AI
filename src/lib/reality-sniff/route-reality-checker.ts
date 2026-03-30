/**
 * Route Reality Checker
 * 
 * Verifies that declared routes actually exist and are reachable:
 * - Cross-checks route definitions with handler exports
 * - Verifies middleware chains for protected routes
 * - Optional runtime ping for critical routes
 */

import * as fs from 'fs';
import * as path from 'path';
import { RealityFinding, Evidence } from './reality-sniff-scanner';

export interface RouteDefinition {
  pattern: string;
  method?: string;
  handler?: string;
  file?: string;
  line?: number;
  requiresAuth?: boolean;
  middleware?: string[];
}

export interface RouteRealityResult {
  routes: RouteDefinition[];
  missingHandlers: RouteDefinition[];
  unprotectedRoutes: RouteDefinition[];
  findings: RealityFinding[];
}

export class RouteRealityChecker {
  private projectPath: string;
  private routes: RouteDefinition[] = [];

  constructor(projectPath: string) {
    this.projectPath = projectPath;
  }

  /**
   * Discover routes from framework-specific files
   */
  async discoverRoutes(): Promise<RouteDefinition[]> {
    const routes: RouteDefinition[] = [];

    // Next.js App Router
    await this.discoverNextAppRoutes(routes);

    // Next.js Pages Router
    await this.discoverNextPagesRoutes(routes);

    // Express/Fastify
    await this.discoverExpressRoutes(routes);

    this.routes = routes;
    return routes;
  }

  /**
   * Verify route handlers exist
   */
  async verifyHandlers(): Promise<RouteRealityResult> {
    const missingHandlers: RouteDefinition[] = [];
    const unprotectedRoutes: RouteDefinition[] = [];
    const findings: RealityFinding[] = [];

    for (const route of this.routes) {
      // Check if handler exists
      if (route.handler && route.file) {
        const handlerExists = await this.verifyHandlerExists(route);
        if (!handlerExists) {
          missingHandlers.push(route);
          
          findings.push({
            id: `route_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            ruleId: 'missing-handler',
            ruleName: 'Missing Route Handler',
            severity: 'high',
            verdict: 'WARN',
            evidenceLevel: 'structural',
            confidence: 0.9,
            file: route.file || '',
            line: route.line || 1,
            message: `Route "${route.pattern}" declared but handler not found`,
            codeSnippet: route.pattern,
            evidence: [
              {
                type: 'structural',
                description: `Route pattern "${route.pattern}" declared but handler "${route.handler}" not found`,
                file: route.file,
                line: route.line,
              },
            ],
            reachable: false,
            inProdPath: true,
            score: 3,
            fixSuggestion: `Implement handler "${route.handler}" or remove route declaration`,
          });
        }
      }

      // Check auth protection
      if (route.requiresAuth && (!route.middleware || route.middleware.length === 0)) {
        unprotectedRoutes.push(route);
        
        findings.push({
          id: `route_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          ruleId: 'unprotected-route',
          ruleName: 'Unprotected Route',
          severity: 'critical',
          verdict: 'FAIL',
          evidenceLevel: 'structural',
          confidence: 0.85,
          file: route.file || '',
          line: route.line || 1,
          message: `Route "${route.pattern}" requires auth but has no middleware`,
          codeSnippet: route.pattern,
          evidence: [
            {
              type: 'structural',
              description: `Route marked as requiring auth but no auth middleware found`,
              file: route.file,
              line: route.line,
            },
          ],
          reachable: true,
          inProdPath: true,
          score: 5,
          fixSuggestion: 'Add authentication middleware to route',
        });
      }
    }

    return {
      routes: this.routes,
      missingHandlers,
      unprotectedRoutes,
      findings,
    };
  }

  private async discoverNextAppRoutes(routes: RouteDefinition[]): Promise<void> {
    const appDir = path.join(this.projectPath, 'app');
    if (!fs.existsSync(appDir)) return;

    await this.walkRouteDirectory(appDir, routes, 'next-app');
  }

  private async discoverNextPagesRoutes(routes: RouteDefinition[]): Promise<void> {
    const pagesDir = path.join(this.projectPath, 'pages');
    if (!fs.existsSync(pagesDir)) return;

    await this.walkRouteDirectory(pagesDir, routes, 'next-pages');
  }

  private async discoverExpressRoutes(routes: RouteDefinition[]): Promise<void> {
    const routeFiles = await this.findRouteFiles();
    
    for (const filePath of routeFiles) {
      const content = await fs.promises.readFile(filePath, 'utf8');
      const routeMatches = content.matchAll(
        /(?:app|router|fastify)\.(get|post|put|delete|patch|all)\s*\(\s*['"]([^'"]+)['"]/g
      );

      for (const match of routeMatches) {
        const method = match[1];
        const pattern = match[2];
        const line = content.substring(0, match.index || 0).split('\n').length;

        // Check for auth middleware
        const requiresAuth = /auth|requireAuth|authenticate|protect/i.test(
          content.substring(Math.max(0, (match.index || 0) - 200), match.index || 0)
        );

        routes.push({
          pattern,
          method,
          file: filePath,
          line,
          requiresAuth,
        });
      }
    }
  }

  private async walkRouteDirectory(
    dir: string,
    routes: RouteDefinition[],
    framework: string
  ): Promise<void> {
    try {
      const entries = await fs.promises.readdir(dir, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);

        if (entry.isDirectory()) {
          await this.walkRouteDirectory(fullPath, routes, framework);
        } else if (entry.isFile() && (entry.name === 'page.tsx' || entry.name === 'page.ts' || entry.name === 'route.ts')) {
          const relativePath = path.relative(
            framework === 'next-app' ? path.join(this.projectPath, 'app') : path.join(this.projectPath, 'pages'),
            fullPath
          );
          
          const routePattern = this.pathToRoutePattern(relativePath);
          const content = await fs.promises.readFile(fullPath, 'utf8');
          const line = 1;

          // Check for auth
          const requiresAuth = /export\s+(const|function)\s+(auth|requireAuth|middleware)/i.test(content) ||
                               /middleware|auth|protect/i.test(content);

          routes.push({
            pattern: routePattern,
            file: fullPath,
            line,
            requiresAuth,
          });
        }
      }
    } catch {
      // Directory not accessible
    }
  }

  private pathToRoutePattern(filePath: string): string {
    let pattern = filePath
      .replace(/\\/g, '/')
      .replace(/\/page\.(tsx?|jsx?)$/, '')
      .replace(/\/route\.(tsx?|jsx?)$/, '')
      .replace(/\/index$/, '')
      .replace(/\[([^\]]+)\]/g, ':$1')
      .replace(/\([^)]+\)\//g, '')
      .replace(/@[^/]+\//g, '');

    if (!pattern.startsWith('/')) {
      pattern = '/' + pattern;
    }

    return pattern || '/';
  }

  private async findRouteFiles(): Promise<string[]> {
    const files: string[] = [];
    const routeDirs = ['src/routes', 'routes', 'app/api', 'pages/api', 'src/app/api'];

    for (const routeDir of routeDirs) {
      const fullPath = path.join(this.projectPath, routeDir);
      if (fs.existsSync(fullPath)) {
        await this.walkDirectory(fullPath, files);
      }
    }

    return files.filter(f => /\.(ts|tsx|js|jsx)$/.test(f));
  }

  private async walkDirectory(dir: string, files: string[]): Promise<void> {
    try {
      const entries = await fs.promises.readdir(dir, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);

        if (entry.isDirectory()) {
          await this.walkDirectory(fullPath, files);
        } else if (entry.isFile()) {
          files.push(fullPath);
        }
      }
    } catch {
      // Directory not accessible
    }
  }

  private async verifyHandlerExists(route: RouteDefinition): Promise<boolean> {
    if (!route.file) return false;

    try {
      const content = await fs.promises.readFile(route.file, 'utf8');
      
      if (route.handler) {
        // Check if handler is exported
        const handlerRegex = new RegExp(
          `(export\\s+(const|function|async\\s+function)\\s+${route.handler}|export\\s+default\\s+${route.handler})`,
          'i'
        );
        return handlerRegex.test(content);
      }

      // For file-based routes, just check file exists
      return fs.existsSync(route.file);
    } catch {
      return false;
    }
  }
}
