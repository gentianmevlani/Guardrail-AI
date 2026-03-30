#!/usr/bin/env tsx
/**
 * Canonical Route Normalization (0.2)
 * 
 * The "truth function" - everything matches through this.
 * 
 * Normalize every path by applying:
 * - remove query + hash (/a?x=1#y → /a)
 * - normalize trailing slash (config-driven)
 * - apply basePath (Next) and i18n prefix rules
 * - case normalization (usually preserve case but compare normalized)
 * - treat / consistently
 * - represent dynamic segments consistently:
 *   [id] → :param
 *   [...slug] → :param+
 *   [[...slug]] → :param*
 * - treat Next "app router" special segments correctly:
 *   ignore route groups (group)
 *   ignore parallel segments @slot (not URL)
 *   model intercepting routes (.) (..) (...) properly (not URL segments)
 */

export interface NormalizationConfig {
  basePath?: string;
  i18n?: {
    locales: string[];
    defaultLocale: string;
  };
  trailingSlash?: boolean;
  caseSensitive?: boolean;
}

export interface NormalizedRoute {
  original: string;
  normalized: string;
  pattern: string; // With :param placeholders
  segments: string[];
  isDynamic: boolean;
  isCatchAll: boolean;
  isOptionalCatchAll: boolean;
}

/**
 * Normalize a route path to canonical form
 */
export function normalizeRoute(
  route: string,
  config: NormalizationConfig = {}
): NormalizedRoute {
  let normalized = route;
  
  // Remove query string and hash
  const url = new URL(route, 'http://localhost');
  normalized = url.pathname;
  
  // Remove basePath if present
  if (config.basePath && normalized.startsWith(config.basePath)) {
    normalized = normalized.slice(config.basePath.length);
  }
  
  // Remove i18n locale prefix
  if (config.i18n) {
    for (const locale of config.i18n.locales) {
      if (normalized.startsWith(`/${locale}/`) || normalized === `/${locale}`) {
        normalized = normalized.slice(locale.length + 1);
        break;
      }
    }
  }
  
  // Ensure leading slash
  if (!normalized.startsWith('/')) {
    normalized = '/' + normalized;
  }
  
  // Handle trailing slash
  if (config.trailingSlash === false) {
    normalized = normalized.replace(/\/$/, '') || '/';
  } else if (config.trailingSlash === true && normalized !== '/') {
    normalized = normalized.replace(/\/$/, '') + '/';
  }
  
  // Case normalization (preserve for display, normalize for comparison)
  const comparisonNormalized = config.caseSensitive ? normalized : normalized.toLowerCase();
  
  // Parse segments
  const segments = normalized.split('/').filter(Boolean);
  
  // Convert Next.js dynamic segments to pattern
  let pattern = normalized;
  let isDynamic = false;
  let isCatchAll = false;
  let isOptionalCatchAll = false;
  
  // [id] → :param
  pattern = pattern.replace(/\[([^\]]+)\]/g, (match, param) => {
    isDynamic = true;
    return `:${param}`;
  });
  
  // [...slug] → :param+
  pattern = pattern.replace(/\[\.\.\.([^\]]+)\]/g, (match, param) => {
    isDynamic = true;
    isCatchAll = true;
    return `:${param}+`;
  });
  
  // [[...slug]] → :param*
  pattern = pattern.replace(/\[\[\.\.\.([^\]]+)\]\]/g, (match, param) => {
    isDynamic = true;
    isCatchAll = true;
    isOptionalCatchAll = true;
    return `:${param}*`;
  });
  
  // Remove Next.js route groups (parentheses) - not part of URL
  pattern = pattern.replace(/\([^)]+\)/g, '');
  
  // Remove Next.js parallel segments (@slot) - not part of URL
  pattern = pattern.replace(/@[^/]+/g, '');
  
  // Handle intercepting routes - these are not URL segments
  // (.) intercepts same level
  // (..) intercepts one level up
  // (...) intercepts root
  // These are already handled by removing parentheses above
  
  // Clean up double slashes
  pattern = pattern.replace(/\/+/g, '/');
  
  return {
    original: route,
    normalized: comparisonNormalized,
    pattern,
    segments,
    isDynamic,
    isCatchAll,
    isOptionalCatchAll,
  };
}

/**
 * Match a concrete path against a route pattern
 */
export function matchRoute(
  concretePath: string,
  routePattern: string,
  config: NormalizationConfig = {}
): boolean {
  const normalizedConcrete = normalizeRoute(concretePath, config);
  const normalizedPattern = normalizeRoute(routePattern, config);
  
  // Exact match
  if (normalizedConcrete.normalized === normalizedPattern.normalized) {
    return true;
  }
  
  // Pattern matching with dynamic segments
  const patternParts = normalizedPattern.pattern.split('/').filter(Boolean);
  const concreteParts = normalizedConcrete.segments;
  
  if (patternParts.length !== concreteParts.length && !normalizedPattern.isCatchAll) {
    return false;
  }
  
  for (let i = 0; i < patternParts.length; i++) {
    const patternPart = patternParts[i];
    const concretePart = concreteParts[i];
    
    // Dynamic segment matches anything
    if (patternPart.startsWith(':')) {
      continue;
    }
    
    // Catch-all matches remaining
    if (patternPart.endsWith('+') || patternPart.endsWith('*')) {
      return true;
    }
    
    // Exact match required
    const patternNormalized = config.caseSensitive ? patternPart : patternPart.toLowerCase();
    const concreteNormalized = config.caseSensitive ? concretePart : concretePart.toLowerCase();
    
    if (patternNormalized !== concreteNormalized) {
      return false;
    }
  }
  
  return true;
}

/**
 * Extract all route patterns from a path string
 * Handles Next.js app router special syntax
 */
export function extractRoutePatterns(filePath: string): string[] {
  const patterns: string[] = [];
  
  // Remove file extension
  let routePath = filePath.replace(/\.(tsx?|jsx?)$/, '');
  
  // Remove route groups (parentheses)
  routePath = routePath.replace(/\([^)]+\)/g, '');
  
  // Remove parallel segments (@slot)
  routePath = routePath.replace(/@[^/]+/g, '');
  
  // Remove intercepting route markers
  routePath = routePath.replace(/^\(\.\)/, '');
  routePath = routePath.replace(/^\(\.\.\)/, '');
  routePath = routePath.replace(/^\(\.\.\.\)/, '');
  
  // Remove special Next.js files
  routePath = routePath.replace(/\/page$/, '');
  routePath = routePath.replace(/\/layout$/, '');
  routePath = routePath.replace(/\/loading$/, '');
  routePath = routePath.replace(/\/error$/, '');
  routePath = routePath.replace(/\/not-found$/, '');
  routePath = routePath.replace(/\/route$/, '');
  
  // Convert to URL path
  if (!routePath.startsWith('/')) {
    routePath = '/' + routePath;
  }
  
  // Clean up
  routePath = routePath.replace(/\/+/g, '/');
  if (routePath === '') {
    routePath = '/';
  }
  
  patterns.push(routePath);
  
  return patterns;
}

