/**
 * TruthpackLoader — Load pre-generated truthpack and adapt for engines.
 *
 * When .guardrail/truthpack/ exists, Ghost Route and Env Var engines can use
 * it instead of building their own indexes. Reduces latency and aligns with
 * Contract Drift Engine.
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import type { IEnvIndex } from './core-types';

const TRUTHPACK_DIR = '.guardrail/truthpack';

export interface TruthpackRoutes {
  path: string;
  method?: string;
  file?: string;
}

export interface TruthpackEnvVar {
  name: string;
}

export interface LoadedTruthpack {
  routes: TruthpackRoutes[];
  env: TruthpackEnvVar[];
}

/**
 * Load truthpack from disk if it exists.
 */
export async function loadTruthpack(workspaceRoot: string): Promise<LoadedTruthpack | null> {
  const dir = path.join(workspaceRoot, TRUTHPACK_DIR);
  try {
    await fs.access(dir);
  } catch {
    return null;
  }

  try {
    const [routesData, envData] = await Promise.all([
      fs.readFile(path.join(dir, 'routes.json'), 'utf-8').catch(() => '{"routes":[]}'),
      fs.readFile(path.join(dir, 'env.json'), 'utf-8').catch(() => '{"variables":[]}'),
    ]);

    const routesJson = JSON.parse(routesData) as { routes?: TruthpackRoutes[] };
    const envJson = JSON.parse(envData) as { variables?: TruthpackEnvVar[] };

    return {
      routes: routesJson.routes ?? [],
      env: envJson.variables ?? [],
    };
  } catch {
    return null;
  }
}

/**
 * IEnvIndex adapter from truthpack env variables.
 */
export class TruthpackEnvIndex implements IEnvIndex {
  private readonly _index: Set<string>;

  constructor(envVars: TruthpackEnvVar[], allowlistEnvVars?: string[]) {
    this._index = new Set(envVars.map((v) => v.name));
    if (Array.isArray(allowlistEnvVars)) {
      for (const v of allowlistEnvVars) {
        if (typeof v === 'string' && /^[A-Z_][A-Z0-9_]*$/.test(v)) this._index.add(v);
      }
    }
  }

  get index(): Set<string> {
    return this._index;
  }

  has(name: string): boolean {
    return this._index.has(name);
  }
}

/**
 * Route entry format compatible with GhostRouteEngine's internal index.
 */
export interface TruthpackRouteEntry {
  pattern: string;
  regex: RegExp;
  isDynamic: boolean;
  isCatchAll: boolean;
  filePath: string;
}

/**
 * Compile a route pattern to regex (matches GhostRouteEngine's compileRoutePattern).
 */
function compileRoutePattern(
  routePath: string
): { regex: RegExp; isDynamic: boolean; isCatchAll: boolean } {
  let isDynamic = false;
  let isCatchAll = false;

  let pattern = routePath
    .replace(/\[\[\.\.\.(\w+)\]\]/g, () => {
      isDynamic = true;
      isCatchAll = true;
      return '(?:\\/.*)?';
    })
    .replace(/\[\.\.\.(\w+)\]/g, () => {
      isDynamic = true;
      isCatchAll = true;
      return '\\/.*';
    })
    .replace(/\[(\w+)\]/g, () => {
      isDynamic = true;
      return '\\/[^/]+';
    })
    .replace(/:\w+/g, () => {
      isDynamic = true;
      return '\\/[^/]+';
    });

  pattern = pattern.replace(/\//g, '\\/').replace(/\\\\\//g, '\\/');

  return {
    regex: new RegExp(`^${pattern}$`),
    isDynamic,
    isCatchAll,
  };
}

/**
 * Convert truthpack routes to GhostRouteEngine-compatible RouteIndex format.
 */
export function truthpackToRouteIndex(
  routes: TruthpackRoutes[],
  workspaceRoot: string
): { routes: TruthpackRouteEntry[]; framework: string; builtAt: number } {
  const entries: TruthpackRouteEntry[] = [];
  const seen = new Set<string>();

  for (const r of routes) {
    const pathStr = r.path ?? '';
    if (!pathStr.startsWith('/')) continue;

    // Normalize: ensure /api prefix for API routes we care about
    const pattern = pathStr.startsWith('/api') ? pathStr : pathStr;
    const key = `${pattern}:${r.method ?? 'GET'}`;
    if (seen.has(key)) continue;
    seen.add(key);

    const compiled = compileRoutePattern(pattern);
    entries.push({
      pattern,
      regex: compiled.regex,
      isDynamic: compiled.isDynamic,
      isCatchAll: compiled.isCatchAll,
      filePath: r.file ? path.resolve(workspaceRoot, r.file) : '',
    });
  }

  return {
    routes: entries,
    framework: 'truthpack',
    builtAt: Date.now(),
  };
}
