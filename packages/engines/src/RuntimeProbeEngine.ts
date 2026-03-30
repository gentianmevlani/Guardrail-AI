/**
 * RuntimeProbeEngine — Optional HTTP verification of routes from truthpack.
 *
 * Probes routes at runtime (HTTP GET) to detect ghost routes (404s).
 * Requires:
 *   - .guardrail/truthpack/routes.json with route definitions
 *   - Running dev server at baseUrl (default http://localhost:3000)
 *
 * Disabled by default. Enable via config or --runtime flag.
 * Skips gracefully if server unreachable or truthpack missing.
 *
 * Optional: Playwright for SPA routes (usePlaywright: true).
 * Uses fetch by default for CI compatibility.
 */

import * as path from 'path';
import { existsSync } from 'fs';
import type { Finding, DeltaContext, ScanEngine } from './core-types';
import { loadTruthpack } from './truthpack-loader.js';

/** FNV-1a deterministic hash → stable finding IDs across re-scans (includes workspace for dedup) */
function deterministicId(workspaceRoot: string, routePath: string, status: number): string {
  const input = `rtprobe:${workspaceRoot}::${routePath}::${status}::VRD007`;
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = (hash * 0x01000193) >>> 0;
  }
  return `rtprobe-${hash.toString(16).padStart(8, '0')}`;
}

// ─── Config ─────────────────────────────────────────────────────────────────

export interface RuntimeProbeConfig {
  baseUrl: string;
  enabled: boolean;
  timeout: number;
  skipRoutes: string[];
}

const DEFAULT_CONFIG: RuntimeProbeConfig = {
  baseUrl: 'http://localhost:3000',
  enabled: false,
  timeout: 5000,
  skipRoutes: ['/api/internal/*', '/api/admin/*', '/_next/*', '/__nextjs*'],
};

// Track probed workspaces — only run once per workspace per scan; return [] for subsequent files
const probedWorkspaces = new Set<string>();

function getWorkspaceRoot(filePath: string): string {
  let dir = path.dirname(filePath);
  const root = path.parse(dir).root;
  while (dir !== root) {
    try {
      const pkg = path.join(dir, 'package.json');
      if (existsSync(pkg)) return dir;
    } catch (err) {
      if (process.env.GUARDRAIL_DEBUG) {
        console.warn('[runtime_probe] getWorkspaceRoot check failed:', err instanceof Error ? err.message : err);
      }
    }
    dir = path.dirname(dir);
  }
  return path.dirname(filePath);
}

function matchGlob(routePath: string, pattern: string): boolean {
  const regex = pattern
    .replace(/\*\*/g, '{{GLOBSTAR}}')
    .replace(/\*/g, '[^/]*')
    .replace(/{{GLOBSTAR}}/g, '.*')
    .replace(/\?/g, '.');
  return new RegExp(`^${regex}$`).test(routePath);
}

async function checkReachable(baseUrl: string, timeout: number): Promise<boolean> {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), timeout);
    const res = await fetch(baseUrl, { method: 'HEAD', signal: ctrl.signal });
    clearTimeout(t);
    return res.status > 0;
  } catch {
    return false;
  }
}

async function probeRoute(
  baseUrl: string,
  routePath: string,
  timeout: number,
  signal: AbortSignal
): Promise<{ status: number; ok: boolean }> {
  const url = `${baseUrl.replace(/\/$/, '')}${routePath.startsWith('/') ? routePath : `/${routePath}`}`;
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), timeout);
    const combined = signal?.aborted ? ctrl.signal : signal;
    const res = await fetch(url, { method: 'GET', signal: combined });
    clearTimeout(t);
    return { status: res.status, ok: res.ok };
  } catch {
    return { status: 0, ok: false };
  }
}

async function runProbe(
  workspaceRoot: string,
  config: RuntimeProbeConfig,
  signal: AbortSignal
): Promise<Finding[]> {
  const truthpack = await loadTruthpack(workspaceRoot);
  if (!truthpack || truthpack.routes.length === 0) return [];

  const routes = truthpack.routes.filter((r) => {
    if (config.skipRoutes.some((p) => matchGlob(r.path, p))) return false;
    if (/\$\{/.test(r.path)) return false;
    return true;
  });
  if (routes.length === 0) return [];

  const reachable = await checkReachable(config.baseUrl, config.timeout);
  if (!reachable) return [];

  const findings: Finding[] = [];
  for (const route of routes) {
    if (signal?.aborted) break;
    const { status, ok } = await probeRoute(config.baseUrl, route.path, config.timeout, signal);
    if (!ok && (status === 404 || status === 500 || status === 0)) {
      findings.push({
        id: deterministicId(workspaceRoot, route.path, status),
        engine: 'runtime_probe',
        severity: status === 404 ? 'high' : 'medium',
        category: 'ghost_route',
        file: route.file ?? workspaceRoot,
        line: 0,
        column: 0,
        message: `Route ${route.path} returns ${status || 'unreachable'}`,
        evidence: `HTTP ${status || 'ERR'}`,
        suggestion: 'Verify the route handler exists and the dev server is running.',
        confidence: 0.9,
        autoFixable: false,
        ruleId: 'VRD007',
      });
    }
  }
  return findings;
}

// ─── Engine ─────────────────────────────────────────────────────────────────

export class RuntimeProbeEngine implements ScanEngine {
  readonly id = 'runtime_probe';
  private readonly config: RuntimeProbeConfig;

  constructor(config: Partial<RuntimeProbeConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  async scan(delta: DeltaContext, signal: AbortSignal): Promise<Finding[]> {
    if (!this.config.enabled) return [];

    const workspaceRoot = getWorkspaceRoot(delta.documentUri);
    if (probedWorkspaces.has(workspaceRoot)) return [];

    probedWorkspaces.add(workspaceRoot);
    return runProbe(workspaceRoot, this.config, signal);
  }
}
