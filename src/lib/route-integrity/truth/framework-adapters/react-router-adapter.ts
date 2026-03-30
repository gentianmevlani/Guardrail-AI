/**
 * Phase 2.2: React Router Build Truth Adapter
 * 
 * Parses route definitions from:
 * - createBrowserRouter configuration
 * - <Routes><Route ... /> JSX patterns
 * - Route configuration objects
 */

import * as ts from 'typescript';
import * as fs from 'fs';
import * as path from 'path';
import {
  BuildManifest,
  ManifestRoute,
  RewriteRule,
  RedirectRule,
  FrameworkType,
} from '../../types';

interface ParsedRoute {
  path: string;
  element?: string;
  children?: ParsedRoute[];
  index?: boolean;
  loader?: boolean;
  action?: boolean;
}

export class ReactRouterAdapter {
  private routes: ParsedRoute[] = [];
  private sourceFiles: string[] = [];

  constructor(private projectRoot: string) {}

  async findRouteFiles(): Promise<string[]> {
    const candidates = [
      'src/routes.tsx',
      'src/routes.ts',
      'src/router.tsx',
      'src/router.ts',
      'src/App.tsx',
      'src/App.jsx',
      'src/main.tsx',
      'src/main.jsx',
      'src/index.tsx',
      'src/index.jsx',
      'app/routes.tsx',
      'app/router.tsx',
    ];

    const found: string[] = [];
    for (const candidate of candidates) {
      const fullPath = path.join(this.projectRoot, candidate);
      if (fs.existsSync(fullPath)) {
        found.push(fullPath);
      }
    }

    this.sourceFiles = found;
    return found;
  }

  async parseRoutes(): Promise<boolean> {
    if (this.sourceFiles.length === 0) {
      await this.findRouteFiles();
    }

    for (const file of this.sourceFiles) {
      try {
        const content = await fs.promises.readFile(file, 'utf8');
        const routes = this.parseRouteFile(file, content);
        this.routes.push(...routes);
      } catch {
        // Skip files that can't be parsed
      }
    }

    return this.routes.length > 0;
  }

  private parseRouteFile(filePath: string, content: string): ParsedRoute[] {
    const routes: ParsedRoute[] = [];
    const sourceFile = ts.createSourceFile(
      filePath,
      content,
      ts.ScriptTarget.Latest,
      true,
      this.getScriptKind(filePath)
    );

    const visit = (node: ts.Node): void => {
      if (ts.isCallExpression(node)) {
        const routerRoutes = this.parseCreateBrowserRouter(node);
        if (routerRoutes.length > 0) {
          routes.push(...routerRoutes);
        }
      }

      if (ts.isJsxElement(node) || ts.isJsxSelfClosingElement(node)) {
        const jsxRoutes = this.parseRoutesJsx(node);
        if (jsxRoutes.length > 0) {
          routes.push(...jsxRoutes);
        }
      }

      if (ts.isArrayLiteralExpression(node)) {
        const arrayRoutes = this.parseRouteArray(node);
        if (arrayRoutes.length > 0) {
          routes.push(...arrayRoutes);
        }
      }

      ts.forEachChild(node, visit);
    };

    visit(sourceFile);
    return routes;
  }

  private parseCreateBrowserRouter(node: ts.CallExpression): ParsedRoute[] {
    const expr = node.expression;
    let funcName = '';

    if (ts.isIdentifier(expr)) {
      funcName = expr.text;
    } else if (ts.isPropertyAccessExpression(expr) && ts.isIdentifier(expr.name)) {
      funcName = expr.name.text;
    }

    const routerFunctions = [
      'createBrowserRouter',
      'createHashRouter',
      'createMemoryRouter',
      'createRoutesFromElements',
    ];

    if (!routerFunctions.includes(funcName)) {
      return [];
    }

    const firstArg = node.arguments[0];
    if (!firstArg) return [];

    if (ts.isArrayLiteralExpression(firstArg)) {
      return this.parseRouteArray(firstArg);
    }

    return [];
  }

  private parseRouteArray(node: ts.ArrayLiteralExpression): ParsedRoute[] {
    const routes: ParsedRoute[] = [];

    for (const element of node.elements) {
      if (ts.isObjectLiteralExpression(element)) {
        const route = this.parseRouteObject(element);
        if (route) {
          routes.push(route);
        }
      }
    }

    return routes;
  }

  private parseRouteObject(node: ts.ObjectLiteralExpression): ParsedRoute | null {
    const route: ParsedRoute = { path: '' };

    for (const prop of node.properties) {
      if (!ts.isPropertyAssignment(prop)) continue;
      
      const propName = ts.isIdentifier(prop.name) ? prop.name.text : '';

      switch (propName) {
        case 'path':
          if (ts.isStringLiteral(prop.initializer)) {
            route.path = prop.initializer.text;
          }
          break;

        case 'index':
          if (prop.initializer.kind === ts.SyntaxKind.TrueKeyword) {
            route.index = true;
          }
          break;

        case 'element':
        case 'Component':
          route.element = this.getElementName(prop.initializer);
          break;

        case 'loader':
          route.loader = true;
          break;

        case 'action':
          route.action = true;
          break;

        case 'children':
          if (ts.isArrayLiteralExpression(prop.initializer)) {
            route.children = this.parseRouteArray(prop.initializer);
          }
          break;
      }
    }

    if (!route.path && !route.index) {
      return null;
    }

    return route;
  }

  private parseRoutesJsx(node: ts.JsxElement | ts.JsxSelfClosingElement): ParsedRoute[] {
    const routes: ParsedRoute[] = [];
    const tagName = this.getJsxTagName(node);

    if (tagName === 'Routes') {
      if (ts.isJsxElement(node)) {
        for (const child of node.children) {
          if (ts.isJsxElement(child) || ts.isJsxSelfClosingElement(child)) {
            const childRoutes = this.parseRouteJsx(child);
            routes.push(...childRoutes);
          }
        }
      }
    }

    if (tagName === 'Route') {
      const routeData = this.parseRouteJsx(node);
      routes.push(...routeData);
    }

    return routes;
  }

  private parseRouteJsx(node: ts.JsxElement | ts.JsxSelfClosingElement): ParsedRoute[] {
    const tagName = this.getJsxTagName(node);
    if (tagName !== 'Route') {
      return [];
    }

    const route: ParsedRoute = { path: '' };
    const openingElement = ts.isJsxElement(node) ? node.openingElement : node;

    for (const attr of openingElement.attributes.properties) {
      if (!ts.isJsxAttribute(attr) || !attr.name || !ts.isIdentifier(attr.name)) {
        continue;
      }

      const attrName = attr.name.text;

      if (attrName === 'path' && attr.initializer) {
        if (ts.isStringLiteral(attr.initializer)) {
          route.path = attr.initializer.text;
        } else if (ts.isJsxExpression(attr.initializer) && attr.initializer.expression) {
          if (ts.isStringLiteral(attr.initializer.expression)) {
            route.path = attr.initializer.expression.text;
          }
        }
      }

      if (attrName === 'index') {
        route.index = true;
      }

      if (attrName === 'element' && attr.initializer) {
        if (ts.isJsxExpression(attr.initializer) && attr.initializer.expression) {
          route.element = this.getElementName(attr.initializer.expression);
        }
      }
    }

    if (ts.isJsxElement(node)) {
      const children: ParsedRoute[] = [];
      for (const child of node.children) {
        if (ts.isJsxElement(child) || ts.isJsxSelfClosingElement(child)) {
          const childRoutes = this.parseRouteJsx(child);
          children.push(...childRoutes);
        }
      }
      if (children.length > 0) {
        route.children = children;
      }
    }

    if (!route.path && !route.index) {
      return [];
    }

    return [route];
  }

  private getJsxTagName(node: ts.JsxElement | ts.JsxSelfClosingElement): string {
    const openingElement = ts.isJsxElement(node) ? node.openingElement : node;
    const tagName = openingElement.tagName;
    
    if (ts.isIdentifier(tagName)) {
      return tagName.text;
    }
    return '';
  }

  private getElementName(expr: ts.Expression): string {
    if (ts.isIdentifier(expr)) {
      return expr.text;
    }
    if (ts.isJsxElement(expr) || ts.isJsxSelfClosingElement(expr)) {
      return this.getJsxTagName(expr);
    }
    return 'Unknown';
  }

  private getScriptKind(filePath: string): ts.ScriptKind {
    const ext = path.extname(filePath).toLowerCase();
    switch (ext) {
      case '.tsx': return ts.ScriptKind.TSX;
      case '.ts': return ts.ScriptKind.TS;
      case '.jsx': return ts.ScriptKind.JSX;
      case '.js': return ts.ScriptKind.JS;
      default: return ts.ScriptKind.Unknown;
    }
  }

  getBuildManifest(): BuildManifest {
    const manifestRoutes = this.flattenRoutes(this.routes, '');

    return {
      framework: 'react-router' as FrameworkType,
      routes: manifestRoutes,
      rewrites: [],
      redirects: [],
      basePath: '',
      i18n: null,
      trailingSlash: false,
      buildTime: new Date().toISOString(),
    };
  }

  private flattenRoutes(routes: ParsedRoute[], parentPath: string): ManifestRoute[] {
    const result: ManifestRoute[] = [];

    for (const route of routes) {
      let fullPath = parentPath;

      if (route.index) {
        fullPath = parentPath || '/';
      } else if (route.path) {
        if (route.path.startsWith('/')) {
          fullPath = route.path;
        } else {
          fullPath = parentPath ? `${parentPath}/${route.path}` : `/${route.path}`;
        }
      }

      fullPath = fullPath.replace(/\/+/g, '/');
      if (fullPath !== '/' && fullPath.endsWith('/')) {
        fullPath = fullPath.slice(0, -1);
      }

      const pattern = this.convertToPattern(fullPath);

      result.push({
        pattern,
        page: fullPath,
        isStatic: !this.isDynamicPath(fullPath),
        isDynamic: this.isDynamicPath(fullPath),
        prerenderedPaths: [],
        dataRoute: null,
      });

      if (route.children) {
        const childRoutes = this.flattenRoutes(route.children, fullPath);
        result.push(...childRoutes);
      }
    }

    return result;
  }

  private convertToPattern(path: string): string {
    return path
      .replace(/:([^/]+)\*/g, ':$1*')
      .replace(/:([^/]+)\+/g, ':$1+')
      .replace(/:([^/]+)\?/g, ':$1?')
      .replace(/\*$/g, ':splat*');
  }

  private isDynamicPath(path: string): boolean {
    return /[:*]/.test(path);
  }

  getAllRoutePatterns(): string[] {
    const manifest = this.getBuildManifest();
    return manifest.routes.map(r => r.pattern);
  }

  matchesRoute(href: string): { matches: boolean; route: ManifestRoute | null } {
    const manifest = this.getBuildManifest();

    for (const route of manifest.routes) {
      if (this.patternMatches(route.pattern, href)) {
        return { matches: true, route };
      }
    }

    return { matches: false, route: null };
  }

  private patternMatches(pattern: string, path: string): boolean {
    if (pattern === path) return true;

    const patternParts = pattern.split('/').filter(Boolean);
    const pathParts = path.split('/').filter(Boolean);

    let pi = 0;
    let ppi = 0;

    while (pi < patternParts.length && ppi < pathParts.length) {
      const patternPart = patternParts[pi];

      if (patternPart.endsWith('*')) {
        return true;
      }

      if (patternPart.startsWith(':')) {
        pi++;
        ppi++;
        continue;
      }

      if (patternPart !== pathParts[ppi]) {
        return false;
      }

      pi++;
      ppi++;
    }

    return pi === patternParts.length && ppi === pathParts.length;
  }
}

export function createReactRouterAdapter(projectRoot: string): ReactRouterAdapter {
  return new ReactRouterAdapter(projectRoot);
}

export async function loadReactRouterManifest(projectRoot: string): Promise<BuildManifest | null> {
  const adapter = new ReactRouterAdapter(projectRoot);
  await adapter.findRouteFiles();
  const parsed = await adapter.parseRoutes();
  if (!parsed) return null;
  return adapter.getBuildManifest();
}
