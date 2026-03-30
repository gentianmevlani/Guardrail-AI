/**
 * Phase 0.2: Canonical Route Normalization (the "truth function")
 * 
 * This is the critical normalization layer that everything matches through.
 * Normalizes every path by applying:
 * - remove query + hash
 * - normalize trailing slash (config-driven)
 * - apply basePath and i18n prefix rules
 * - case normalization
 * - dynamic segment standardization
 * - Next.js App Router special segment handling
 */

import {
  NormalizationConfig,
  NormalizedRoute,
  RouteSegment,
} from '../types';

const DEFAULT_CONFIG: NormalizationConfig = {
  trailingSlash: 'never',
  caseSensitive: true,
  basePath: '',
  i18nLocales: [],
  defaultLocale: null,
};

export class RouteNormalizer {
  private config: NormalizationConfig;

  constructor(config: Partial<NormalizationConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  normalize(rawPath: string): NormalizedRoute {
    let path = rawPath;

    path = this.removeQueryAndHash(path);
    path = this.removeBasePath(path);
    path = this.removeI18nPrefix(path);
    path = this.normalizeTrailingSlash(path);
    path = this.normalizeCase(path);

    const segments = this.parseSegments(path);
    const pattern = this.buildPattern(segments);

    return {
      raw: rawPath,
      normalized: path,
      pattern,
      segments,
      hasParams: segments.some(s => s.type !== 'static'),
      hasCatchAll: segments.some(s => s.type === 'catch-all'),
      hasOptionalCatchAll: segments.some(s => s.type === 'optional-catch-all'),
      isIntercepting: this.isInterceptingRoute(rawPath),
      routeGroup: this.extractRouteGroup(rawPath),
    };
  }

  normalizeFileSystemPath(fsPath: string): NormalizedRoute {
    let path = fsPath;

    path = path.replace(/\\/g, '/');

    const routeExtensions = [
      '/page.tsx', '/page.ts', '/page.jsx', '/page.js',
      '/route.tsx', '/route.ts', '/route.jsx', '/route.js',
      '.tsx', '.ts', '.jsx', '.js',
    ];

    for (const ext of routeExtensions) {
      if (path.endsWith(ext)) {
        path = path.slice(0, -ext.length);
        break;
      }
    }

    if (path.endsWith('/index')) {
      path = path.slice(0, -6) || '/';
    }

    path = this.removeRouteGroups(path);
    path = this.removeParallelSegments(path);
    path = this.handleInterceptingRoutes(path);

    if (!path.startsWith('/')) {
      path = '/' + path;
    }

    return this.normalize(path);
  }

  matches(path1: string, path2: string): boolean {
    const norm1 = this.normalize(path1);
    const norm2 = this.normalize(path2);

    if (norm1.normalized === norm2.normalized) {
      return true;
    }

    if (norm1.hasParams || norm2.hasParams) {
      return this.patternMatches(norm1.pattern, norm2.normalized) ||
             this.patternMatches(norm2.pattern, norm1.normalized);
    }

    return false;
  }

  patternMatches(pattern: string, concretePath: string): boolean {
    const patternParts = pattern.split('/').filter(Boolean);
    const pathParts = concretePath.split('/').filter(Boolean);

    let patternIdx = 0;
    let pathIdx = 0;

    while (patternIdx < patternParts.length && pathIdx < pathParts.length) {
      const patternPart = patternParts[patternIdx];
      const pathPart = pathParts[pathIdx];

      if (patternPart.endsWith('*')) {
        return true;
      }

      if (patternPart.endsWith('+')) {
        if (pathIdx >= pathParts.length) {
          return false;
        }
        return true;
      }

      if (patternPart.startsWith(':')) {
        patternIdx++;
        pathIdx++;
        continue;
      }

      if (patternPart !== pathPart) {
        return false;
      }

      patternIdx++;
      pathIdx++;
    }

    if (patternIdx < patternParts.length) {
      const remaining = patternParts[patternIdx];
      if (remaining.endsWith('*')) {
        return true;
      }
      return false;
    }

    return pathIdx === pathParts.length;
  }

  buildPattern(segments: RouteSegment[]): string {
    if (segments.length === 0) {
      return '/';
    }

    const parts = segments.map(seg => {
      switch (seg.type) {
        case 'param':
          return `:${seg.paramName}`;
        case 'catch-all':
          return `:${seg.paramName}+`;
        case 'optional-catch-all':
          return `:${seg.paramName}*`;
        default:
          return seg.normalized;
      }
    });

    return '/' + parts.join('/');
  }

  private removeQueryAndHash(path: string): string {
    const queryIndex = path.indexOf('?');
    const hashIndex = path.indexOf('#');

    let endIndex = path.length;
    if (queryIndex !== -1) {
      endIndex = Math.min(endIndex, queryIndex);
    }
    if (hashIndex !== -1) {
      endIndex = Math.min(endIndex, hashIndex);
    }

    return path.slice(0, endIndex);
  }

  private removeBasePath(path: string): string {
    if (this.config.basePath && path.startsWith(this.config.basePath)) {
      return path.slice(this.config.basePath.length) || '/';
    }
    return path;
  }

  private removeI18nPrefix(path: string): string {
    if (this.config.i18nLocales.length === 0) {
      return path;
    }

    const parts = path.split('/').filter(Boolean);
    if (parts.length > 0 && this.config.i18nLocales.includes(parts[0])) {
      return '/' + parts.slice(1).join('/') || '/';
    }

    return path;
  }

  private normalizeTrailingSlash(path: string): string {
    if (path === '/') {
      return '/';
    }

    switch (this.config.trailingSlash) {
      case 'always':
        return path.endsWith('/') ? path : path + '/';
      case 'never':
        return path.endsWith('/') ? path.slice(0, -1) : path;
      case 'preserve':
      default:
        return path;
    }
  }

  private normalizeCase(path: string): string {
    if (this.config.caseSensitive) {
      return path;
    }
    return path.toLowerCase();
  }

  private parseSegments(path: string): RouteSegment[] {
    const parts = path.split('/').filter(Boolean);
    return parts.map(part => this.parseSegment(part));
  }

  private parseSegment(segment: string): RouteSegment {
    if (segment.startsWith('[[...') && segment.endsWith(']]')) {
      const paramName = segment.slice(5, -2);
      return {
        raw: segment,
        normalized: `:${paramName}*`,
        type: 'optional-catch-all',
        paramName,
        isOptional: true,
      };
    }

    if (segment.startsWith('[...') && segment.endsWith(']')) {
      const paramName = segment.slice(4, -1);
      return {
        raw: segment,
        normalized: `:${paramName}+`,
        type: 'catch-all',
        paramName,
        isOptional: false,
      };
    }

    if (segment.startsWith('[') && segment.endsWith(']')) {
      const paramName = segment.slice(1, -1);
      return {
        raw: segment,
        normalized: `:${paramName}`,
        type: 'param',
        paramName,
        isOptional: false,
      };
    }

    if (segment.startsWith(':')) {
      let paramName = segment.slice(1);
      let type: RouteSegment['type'] = 'param';
      let isOptional = false;

      if (paramName.endsWith('*')) {
        paramName = paramName.slice(0, -1);
        type = 'optional-catch-all';
        isOptional = true;
      } else if (paramName.endsWith('+')) {
        paramName = paramName.slice(0, -1);
        type = 'catch-all';
      } else if (paramName.endsWith('?')) {
        paramName = paramName.slice(0, -1);
        isOptional = true;
      }

      return {
        raw: segment,
        normalized: segment,
        type,
        paramName,
        isOptional,
      };
    }

    if (segment.startsWith('$')) {
      const paramName = segment.slice(1);
      return {
        raw: segment,
        normalized: `:${paramName}`,
        type: 'param',
        paramName,
        isOptional: false,
      };
    }

    return {
      raw: segment,
      normalized: segment,
      type: 'static',
      paramName: null,
      isOptional: false,
    };
  }

  private removeRouteGroups(path: string): string {
    return path.replace(/\/\([^)]+\)/g, '');
  }

  private removeParallelSegments(path: string): string {
    return path.replace(/\/@[^/]+/g, '');
  }

  private handleInterceptingRoutes(path: string): string {
    return path
      .replace(/\/\(\.\.\.\)/g, '')
      .replace(/\/\(\.\.\)/g, '')
      .replace(/\/\(\.\)/g, '');
  }

  private isInterceptingRoute(path: string): boolean {
    return /\/\(\.+\)/.test(path);
  }

  private extractRouteGroup(path: string): string | null {
    const match = path.match(/\/\(([^)]+)\)/);
    return match ? match[1] : null;
  }

  updateConfig(config: Partial<NormalizationConfig>): void {
    this.config = { ...this.config, ...config };
  }

  getConfig(): NormalizationConfig {
    return { ...this.config };
  }
}

export function createNormalizer(config?: Partial<NormalizationConfig>): RouteNormalizer {
  return new RouteNormalizer(config);
}

export function normalizeRoute(path: string, config?: Partial<NormalizationConfig>): NormalizedRoute {
  const normalizer = new RouteNormalizer(config);
  return normalizer.normalize(path);
}

export function normalizeFileRoute(fsPath: string, config?: Partial<NormalizationConfig>): NormalizedRoute {
  const normalizer = new RouteNormalizer(config);
  return normalizer.normalizeFileSystemPath(fsPath);
}

export function routesMatch(
  path1: string,
  path2: string,
  config?: Partial<NormalizationConfig>
): boolean {
  const normalizer = new RouteNormalizer(config);
  return normalizer.matches(path1, path2);
}
