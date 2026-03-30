/**
 * Framework Adapters Index
 * 
 * Exports all framework adapters and provides a unified interface
 * for loading build manifests from any supported framework.
 */

import * as path from 'path';
import * as fs from 'fs';
import {
  BuildManifest,
  FrameworkType,
  PackageInfo,
} from '../../types';
import { NextJsAdapter, createNextAdapter } from './next-adapter';
import { ReactRouterAdapter, createReactRouterAdapter } from './react-router-adapter';

export { NextJsAdapter, createNextAdapter } from './next-adapter';
export { ReactRouterAdapter, createReactRouterAdapter } from './react-router-adapter';

export interface FrameworkAdapter {
  getBuildManifest(): BuildManifest;
  getAllRoutePatterns(): string[];
  matchesRoute(href: string): { matches: boolean; route: unknown; viaRewrite?: boolean };
}

export async function loadBuildManifest(
  packageInfo: PackageInfo
): Promise<BuildManifest | null> {
  const framework = packageInfo.frameworkType;

  switch (framework) {
    case 'next':
    case 'next-app':
    case 'next-pages': {
      const adapter = createNextAdapter(packageInfo.rootDir);
      const loaded = await adapter.loadManifests();
      if (loaded) {
        return adapter.getBuildManifest();
      }
      return createFileBasedManifest(packageInfo);
    }

    case 'react-router':
    case 'tanstack-router': {
      const adapter = createReactRouterAdapter(packageInfo.rootDir);
      await adapter.findRouteFiles();
      const parsed = await adapter.parseRoutes();
      if (parsed) {
        return adapter.getBuildManifest();
      }
      return null;
    }

    case 'remix': {
      return loadRemixManifest(packageInfo);
    }

    case 'vite-spa': {
      return createSpaManifest(packageInfo);
    }

    case 'gatsby': {
      return loadGatsbyManifest(packageInfo);
    }

    case 'astro': {
      return loadAstroManifest(packageInfo);
    }

    case 'nuxt': {
      return loadNuxtManifest(packageInfo);
    }

    case 'sveltekit': {
      return loadSvelteKitManifest(packageInfo);
    }

    default:
      return createFileBasedManifest(packageInfo);
  }
}

async function createFileBasedManifest(packageInfo: PackageInfo): Promise<BuildManifest> {
  const routes = await discoverFileRoutes(packageInfo);

  return {
    framework: packageInfo.frameworkType,
    routes,
    rewrites: [],
    redirects: [],
    basePath: '',
    i18n: null,
    trailingSlash: false,
    buildTime: new Date().toISOString(),
  };
}

async function discoverFileRoutes(packageInfo: PackageInfo): Promise<BuildManifest['routes']> {
  const routes: BuildManifest['routes'] = [];
  const routeDirs = ['app', 'pages', 'src/app', 'src/pages', 'src/routes'];

  for (const dir of routeDirs) {
    const fullPath = path.join(packageInfo.rootDir, dir);
    if (fs.existsSync(fullPath)) {
      const discovered = await scanRouteDirectory(fullPath, '');
      routes.push(...discovered);
    }
  }

  return routes;
}

async function scanRouteDirectory(
  dir: string,
  prefix: string
): Promise<BuildManifest['routes']> {
  const routes: BuildManifest['routes'] = [];

  try {
    const entries = await fs.promises.readdir(dir, { withFileTypes: true });

    for (const entry of entries) {
      if (entry.name.startsWith('_') || entry.name.startsWith('.')) {
        continue;
      }

      const fullPath = path.join(dir, entry.name);

      if (entry.isDirectory()) {
        if (entry.name.startsWith('(') && entry.name.endsWith(')')) {
          const childRoutes = await scanRouteDirectory(fullPath, prefix);
          routes.push(...childRoutes);
        } else if (entry.name.startsWith('@')) {
          continue;
        } else {
          const segment = convertFileNameToSegment(entry.name);
          const childRoutes = await scanRouteDirectory(fullPath, `${prefix}/${segment}`);
          routes.push(...childRoutes);
        }
      } else if (entry.isFile()) {
        const routePattern = extractRouteFromFile(entry.name, prefix);
        if (routePattern) {
          routes.push({
            pattern: routePattern.pattern,
            page: routePattern.page,
            isStatic: !routePattern.isDynamic,
            isDynamic: routePattern.isDynamic,
            prerenderedPaths: [],
            dataRoute: null,
          });
        }
      }
    }
  } catch {
    // Directory not accessible
  }

  return routes;
}

function convertFileNameToSegment(name: string): string {
  if (name.startsWith('[...') && name.endsWith(']')) {
    const param = name.slice(4, -1);
    return `:${param}+`;
  }
  if (name.startsWith('[[...') && name.endsWith(']]')) {
    const param = name.slice(5, -2);
    return `:${param}*`;
  }
  if (name.startsWith('[') && name.endsWith(']')) {
    const param = name.slice(1, -1);
    return `:${param}`;
  }
  if (name.startsWith('$')) {
    return `:${name.slice(1)}`;
  }
  return name;
}

function extractRouteFromFile(
  fileName: string,
  prefix: string
): { pattern: string; page: string; isDynamic: boolean } | null {
  const routeFiles = ['page.tsx', 'page.ts', 'page.jsx', 'page.js', 'route.tsx', 'route.ts'];
  const indexFiles = ['index.tsx', 'index.ts', 'index.jsx', 'index.js'];

  const ext = path.extname(fileName);
  const baseName = path.basename(fileName, ext);

  if (routeFiles.includes(fileName)) {
    const pattern = prefix || '/';
    return {
      pattern,
      page: pattern,
      isDynamic: pattern.includes(':'),
    };
  }

  if (indexFiles.includes(fileName)) {
    const pattern = prefix || '/';
    return {
      pattern,
      page: pattern,
      isDynamic: pattern.includes(':'),
    };
  }

  if (['.tsx', '.ts', '.jsx', '.js'].includes(ext)) {
    if (baseName.startsWith('_') || baseName === 'layout' || baseName === 'error' ||
        baseName === 'loading' || baseName === 'not-found' || baseName === 'template') {
      return null;
    }

    const segment = convertFileNameToSegment(baseName);
    const pattern = `${prefix}/${segment}`.replace(/\/+/g, '/');
    return {
      pattern,
      page: pattern,
      isDynamic: pattern.includes(':'),
    };
  }

  return null;
}

async function loadRemixManifest(packageInfo: PackageInfo): Promise<BuildManifest | null> {
  const buildPath = path.join(packageInfo.rootDir, 'build', 'routes.json');
  
  try {
    if (fs.existsSync(buildPath)) {
      const content = await fs.promises.readFile(buildPath, 'utf8');
      const data = JSON.parse(content);
      // Convert Remix routes to standard format
      return {
        framework: 'remix',
        routes: Object.values(data).map((route: any) => ({
          pattern: route.path || '/',
          page: route.file,
          isStatic: !route.path?.includes(':'),
          isDynamic: route.path?.includes(':') || false,
          prerenderedPaths: [],
          dataRoute: null,
        })),
        rewrites: [],
        redirects: [],
        basePath: '',
        i18n: null,
        trailingSlash: false,
        buildTime: new Date().toISOString(),
      };
    }
  } catch {
    // Fall through to file-based discovery
  }

  return createFileBasedManifest(packageInfo);
}

function createSpaManifest(packageInfo: PackageInfo): BuildManifest {
  return {
    framework: 'vite-spa',
    routes: [{
      pattern: '/',
      page: '/index.html',
      isStatic: true,
      isDynamic: false,
      prerenderedPaths: ['/'],
      dataRoute: null,
    }],
    rewrites: [{
      source: '/:path*',
      destination: '/index.html',
      permanent: false,
      basePath: true,
      locale: false,
    }],
    redirects: [],
    basePath: '',
    i18n: null,
    trailingSlash: false,
    buildTime: new Date().toISOString(),
  };
}

async function loadGatsbyManifest(packageInfo: PackageInfo): Promise<BuildManifest | null> {
  return createFileBasedManifest(packageInfo);
}

async function loadAstroManifest(packageInfo: PackageInfo): Promise<BuildManifest | null> {
  return createFileBasedManifest(packageInfo);
}

async function loadNuxtManifest(packageInfo: PackageInfo): Promise<BuildManifest | null> {
  return createFileBasedManifest(packageInfo);
}

async function loadSvelteKitManifest(packageInfo: PackageInfo): Promise<BuildManifest | null> {
  return createFileBasedManifest(packageInfo);
}

export function getAdapter(packageInfo: PackageInfo): FrameworkAdapter | null {
  switch (packageInfo.frameworkType) {
    case 'next':
    case 'next-app':
    case 'next-pages':
      return createNextAdapter(packageInfo.rootDir);
    case 'react-router':
    case 'tanstack-router':
      return createReactRouterAdapter(packageInfo.rootDir);
    default:
      return null;
  }
}
