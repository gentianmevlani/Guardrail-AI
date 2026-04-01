/**
 * Phase 2.1: Next.js Build Truth Adapter
 * 
 * Ingests Next.js build manifests when .next/ exists:
 * - routes-manifest.json (rewrites/redirects/basePath/i18n/trailingSlash)
 * - pages-manifest.json (pages router)
 * - app-paths-manifest.json (app router)
 * - prerender-manifest.json (concrete prerendered paths)
 */

import * as fs from 'fs';
import * as path from 'path';
import {
  BuildManifest,
  ManifestRoute,
  RewriteRule,
  RedirectRule,
  I18nConfig,
  FrameworkType,
  NormalizationConfig,
} from '../../types';

interface NextRoutesManifest {
  version: number;
  basePath: string;
  redirects: NextRedirect[];
  rewrites: {
    beforeFiles?: NextRewrite[];
    afterFiles?: NextRewrite[];
    fallback?: NextRewrite[];
  } | NextRewrite[];
  headers: unknown[];
  staticRoutes: NextStaticRoute[];
  dynamicRoutes: NextDynamicRoute[];
  dataRoutes?: NextDataRoute[];
  i18n?: {
    locales: string[];
    defaultLocale: string;
    localeDetection?: boolean;
  };
}

interface NextRedirect {
  source: string;
  destination: string;
  statusCode?: number;
  permanent?: boolean;
  basePath?: boolean;
  locale?: boolean;
}

interface NextRewrite {
  source: string;
  destination: string;
  basePath?: boolean;
  locale?: boolean;
}

interface NextStaticRoute {
  page: string;
  regex: string;
  namedRegex?: string;
  routeKeys?: Record<string, string>;
}

interface NextDynamicRoute {
  page: string;
  regex: string;
  namedRegex?: string;
  routeKeys?: Record<string, string>;
}

interface NextDataRoute {
  page: string;
  dataRouteRegex: string;
  namedDataRouteRegex?: string;
  routeKeys?: Record<string, string>;
}

interface NextPagesManifest {
  [page: string]: string;
}

interface NextAppPathsManifest {
  [route: string]: string;
}

interface NextPrerenderManifest {
  version: number;
  routes: Record<string, PrerenderRoute>;
  dynamicRoutes: Record<string, DynamicPrerenderRoute>;
  preview?: unknown;
}

interface PrerenderRoute {
  initialRevalidateSeconds: number | false;
  srcRoute: string | null;
  dataRoute: string;
}

interface DynamicPrerenderRoute {
  routeRegex: string;
  dataRoute: string;
  dataRouteRegex: string;
  fallback: string | false | null;
}

export class NextJsAdapter {
  private buildDir: string;
  private routesManifest: NextRoutesManifest | null = null;
  private pagesManifest: NextPagesManifest | null = null;
  private appPathsManifest: NextAppPathsManifest | null = null;
  private prerenderManifest: NextPrerenderManifest | null = null;

  constructor(private projectRoot: string) {
    this.buildDir = path.join(projectRoot, '.next');
  }

  hasBuildOutput(): boolean {
    return fs.existsSync(this.buildDir);
  }

  async loadManifests(): Promise<boolean> {
    if (!this.hasBuildOutput()) {
      return false;
    }

    try {
      this.routesManifest = await this.loadJson('routes-manifest.json');
      this.pagesManifest = await this.loadJson('server/pages-manifest.json');
      this.appPathsManifest = await this.loadJson('server/app-paths-manifest.json');
      this.prerenderManifest = await this.loadJson('prerender-manifest.json');
      return true;
    } catch {
      return false;
    }
  }

  private async loadJson<T>(relativePath: string): Promise<T | null> {
    const fullPath = path.join(this.buildDir, relativePath);
    try {
      const content = await fs.promises.readFile(fullPath, 'utf8');
      return JSON.parse(content);
    } catch {
      return null;
    }
  }

  getBuildManifest(): BuildManifest {
    const routes = this.extractRoutes();
    const rewrites = this.extractRewrites();
    const redirects = this.extractRedirects();
    const i18n = this.extractI18n();

    return {
      framework: this.getFrameworkType(),
      routes,
      rewrites,
      redirects,
      basePath: this.routesManifest?.basePath || '',
      i18n,
      trailingSlash: this.detectTrailingSlash(),
      buildTime: new Date().toISOString(),
    };
  }

  getNormalizationConfig(): Partial<NormalizationConfig> {
    return {
      basePath: this.routesManifest?.basePath || '',
      trailingSlash: this.detectTrailingSlash() ? 'always' : 'never',
      i18nLocales: this.routesManifest?.i18n?.locales || [],
      defaultLocale: this.routesManifest?.i18n?.defaultLocale || null,
    };
  }

  private getFrameworkType(): FrameworkType {
    const hasAppRouter = this.appPathsManifest !== null && 
                         Object.keys(this.appPathsManifest).length > 0;
    const hasPagesRouter = this.pagesManifest !== null &&
                           Object.keys(this.pagesManifest).length > 0;

    if (hasAppRouter && hasPagesRouter) {
      return 'next';
    } else if (hasAppRouter) {
      return 'next-app';
    } else if (hasPagesRouter) {
      return 'next-pages';
    }
    return 'next';
  }

  private extractRoutes(): ManifestRoute[] {
    const routes: ManifestRoute[] = [];

    if (this.routesManifest?.staticRoutes) {
      for (const route of this.routesManifest.staticRoutes) {
        routes.push({
          pattern: route.page,
          page: route.page,
          isStatic: true,
          isDynamic: false,
          prerenderedPaths: this.getPrerenderedPaths(route.page),
          dataRoute: this.getDataRoute(route.page),
        });
      }
    }

    if (this.routesManifest?.dynamicRoutes) {
      for (const route of this.routesManifest.dynamicRoutes) {
        routes.push({
          pattern: this.convertNextPatternToStandard(route.page),
          page: route.page,
          isStatic: false,
          isDynamic: true,
          prerenderedPaths: this.getPrerenderedPaths(route.page),
          dataRoute: this.getDataRoute(route.page),
        });
      }
    }

    if (this.pagesManifest) {
      for (const page of Object.keys(this.pagesManifest)) {
        if (page.startsWith('/_') || page.startsWith('/api/')) {
          continue;
        }
        
        const exists = routes.some(r => r.page === page);
        if (!exists) {
          routes.push({
            pattern: this.convertNextPatternToStandard(page),
            page,
            isStatic: !this.isDynamicPage(page),
            isDynamic: this.isDynamicPage(page),
            prerenderedPaths: this.getPrerenderedPaths(page),
            dataRoute: this.getDataRoute(page),
          });
        }
      }
    }

    if (this.appPathsManifest) {
      for (const route of Object.keys(this.appPathsManifest)) {
        if (route.includes('/api/') || route.endsWith('/route')) {
          continue;
        }

        const cleanRoute = route.replace(/\/page$/, '').replace(/\([^)]+\)\//g, '');
        const exists = routes.some(r => r.page === cleanRoute || r.pattern === cleanRoute);
        
        if (!exists && cleanRoute) {
          routes.push({
            pattern: this.convertNextPatternToStandard(cleanRoute),
            page: cleanRoute || '/',
            isStatic: !this.isDynamicPage(cleanRoute),
            isDynamic: this.isDynamicPage(cleanRoute),
            prerenderedPaths: this.getPrerenderedPaths(cleanRoute),
            dataRoute: null,
          });
        }
      }
    }

    return routes;
  }

  private extractRewrites(): RewriteRule[] {
    const rewrites: RewriteRule[] = [];

    if (!this.routesManifest?.rewrites) {
      return rewrites;
    }

    const rewriteArrays = Array.isArray(this.routesManifest.rewrites)
      ? [this.routesManifest.rewrites]
      : [
          this.routesManifest.rewrites.beforeFiles || [],
          this.routesManifest.rewrites.afterFiles || [],
          this.routesManifest.rewrites.fallback || [],
        ];

    for (const rewriteArray of rewriteArrays) {
      for (const rewrite of rewriteArray) {
        rewrites.push({
          source: rewrite.source,
          destination: rewrite.destination,
          permanent: false,
          basePath: rewrite.basePath !== false,
          locale: rewrite.locale !== false,
        });
      }
    }

    return rewrites;
  }

  private extractRedirects(): RedirectRule[] {
    const redirects: RedirectRule[] = [];

    if (!this.routesManifest?.redirects) {
      return redirects;
    }

    for (const redirect of this.routesManifest.redirects) {
      if (redirect.source.includes('/:nextInternalLocale')) {
        continue;
      }

      redirects.push({
        source: redirect.source,
        destination: redirect.destination,
        permanent: redirect.permanent ?? false,
        statusCode: redirect.statusCode ?? (redirect.permanent ? 308 : 307),
      });
    }

    return redirects;
  }

  private extractI18n(): I18nConfig | null {
    if (!this.routesManifest?.i18n) {
      return null;
    }

    return {
      locales: this.routesManifest.i18n.locales,
      defaultLocale: this.routesManifest.i18n.defaultLocale,
      localeDetection: this.routesManifest.i18n.localeDetection ?? true,
    };
  }

  private getPrerenderedPaths(page: string): string[] {
    const paths: string[] = [];

    if (this.prerenderManifest?.routes) {
      for (const [route, info] of Object.entries(this.prerenderManifest.routes)) {
        if (info.srcRoute === page || route === page) {
          paths.push(route);
        }
      }
    }

    return paths;
  }

  private getDataRoute(page: string): string | null {
    if (this.routesManifest?.dataRoutes) {
      const dataRoute = this.routesManifest.dataRoutes.find(dr => dr.page === page);
      if (dataRoute) {
        return dataRoute.dataRouteRegex;
      }
    }
    return null;
  }

  private isDynamicPage(page: string): boolean {
    return /\[[^\]]+\]/.test(page);
  }

  private convertNextPatternToStandard(pattern: string): string {
    return pattern
      .replace(/\[\[\.\.\.([^\]]+)\]\]/g, ':$1*')
      .replace(/\[\.\.\.([^\]]+)\]/g, ':$1+')
      .replace(/\[([^\]]+)\]/g, ':$1')
      .replace(/\([^)]+\)\//g, '')
      .replace(/\([^)]+\)/g, '');
  }

  private detectTrailingSlash(): boolean {
    if (this.routesManifest?.staticRoutes) {
      for (const route of this.routesManifest.staticRoutes) {
        if (route.page !== '/' && route.page.endsWith('/')) {
          return true;
        }
      }
    }
    return false;
  }

  getApiRoutes(): ManifestRoute[] {
    const apiRoutes: ManifestRoute[] = [];

    if (this.pagesManifest) {
      for (const page of Object.keys(this.pagesManifest)) {
        if (page.startsWith('/api/')) {
          apiRoutes.push({
            pattern: this.convertNextPatternToStandard(page),
            page,
            isStatic: false,
            isDynamic: this.isDynamicPage(page),
            prerenderedPaths: [],
            dataRoute: null,
          });
        }
      }
    }

    if (this.appPathsManifest) {
      for (const route of Object.keys(this.appPathsManifest)) {
        if (route.endsWith('/route')) {
          const cleanRoute = route.replace(/\/route$/, '');
          apiRoutes.push({
            pattern: this.convertNextPatternToStandard(cleanRoute),
            page: cleanRoute,
            isStatic: false,
            isDynamic: this.isDynamicPage(cleanRoute),
            prerenderedPaths: [],
            dataRoute: null,
          });
        }
      }
    }

    return apiRoutes;
  }

  getAllRoutePatterns(): string[] {
    const patterns: string[] = [];
    const manifest = this.getBuildManifest();

    for (const route of manifest.routes) {
      patterns.push(route.pattern);
      patterns.push(...route.prerenderedPaths);
    }

    return Array.from(new Set(patterns));
  }

  matchesRoute(href: string): { matches: boolean; route: ManifestRoute | null; viaRewrite: boolean } {
    const manifest = this.getBuildManifest();

    for (const route of manifest.routes) {
      if (this.patternMatches(route.pattern, href)) {
        return { matches: true, route, viaRewrite: false };
      }

      for (const prerendered of route.prerenderedPaths) {
        if (prerendered === href) {
          return { matches: true, route, viaRewrite: false };
        }
      }
    }

    for (const rewrite of manifest.rewrites) {
      if (this.patternMatches(rewrite.source, href)) {
        const destMatch = this.matchesRoute(rewrite.destination);
        if (destMatch.matches) {
          return { matches: true, route: destMatch.route, viaRewrite: true };
        }
      }
    }

    return { matches: false, route: null, viaRewrite: false };
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

      if (patternPart.endsWith('+')) {
        return ppi < pathParts.length;
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

    if (pi < patternParts.length) {
      const remaining = patternParts[pi];
      return remaining.endsWith('*');
    }

    return ppi === pathParts.length;
  }
}

export function createNextAdapter(projectRoot: string): NextJsAdapter {
  return new NextJsAdapter(projectRoot);
}

export async function loadNextBuildManifest(projectRoot: string): Promise<BuildManifest | null> {
  const adapter = new NextJsAdapter(projectRoot);
  const loaded = await adapter.loadManifests();
  if (!loaded) return null;
  return adapter.getBuildManifest();
}
