/**
 * GhostRouteEngine v3.0 — Detects API route calls with no corresponding handler.
 *
 * Architecture:
 *   ┌──────────────────────────────────────────────────────────────────────┐
 *   │  Scan Pipeline                                                       │
 *   │                                                                      │
 *   │  1. Framework Detection                                              │
 *   │     → Auto-detect: Next.js, Nuxt, SvelteKit, Remix, Express         │
 *   │     → Reads package.json dependencies                                │
 *   │     → Determines route directory conventions per framework            │
 *   │                                                                      │
 *   │  2. Route Index (built once, invalidated by file watcher)            │
 *   │     → Async recursive walk of route directories                      │
 *   │     → Parses filesystem into normalized route patterns               │
 *   │     → Handles dynamic segments: [id], [...slug], [[...optional]]     │
 *   │     → Handles route groups: (group)/api/...                          │
 *   │     → Cached per workspace root                                      │
 *   │                                                                      │
 *   │  3. Route Call Extraction                                            │
 *   │     → fetch(), axios, ky, got, ofetch/$fetch, superagent             │
 *   │     → Detects template literal interpolation → reduced confidence    │
 *   │     → Comment/string region skipping (reuses shared lexer)           │
 *   │     → URL constructor: new URL('/api/...')                           │
 *   │     → Variable-based URLs detected → skipped (can't resolve)        │
 *   │                                                                      │
 *   │  4. Route Matching                                                   │
 *   │     → Exact match against route index                                │
 *   │     → Dynamic segment matching: /api/users/123 → /api/users/[id]    │
 *   │     → Catch-all matching: /api/docs/a/b → /api/docs/[...slug]       │
 *   │     → Fuzzy suggestion for near-misses (Levenshtein)                 │
 *   │                                                                      │
 *   │  5. Safe-path filtering                                              │
 *   │     → Known framework routes (NextAuth, tRPC, Clerk, Supabase)       │
 *   │     → External API detection (absolute URLs → skip)                  │
 *   │     → Configurable ignore patterns                                   │
 *   │                                                                      │
 *   │  → Deterministic finding IDs                                         │
 *   │  → ScanEngine interface for orchestrator compatibility               │
 *   └──────────────────────────────────────────────────────────────────────┘
 *
 * Latency target: <50ms (filesystem cached after first index build)
 * Rule: GHO001
 */

import * as path from 'path';
import * as fs from 'fs';
import * as fsp from 'fs/promises';
import type { Finding, DeltaContext, ScanEngine } from './core-types';
import type { TruthpackRouteEntry } from './truthpack-loader.js';

// ─── Types ───────────────────────────────────────────────────────────────────

type Framework = 'nextjs' | 'nuxt' | 'sveltekit' | 'remix' | 'express' | 'truthpack' | 'unknown';

interface RouteEntry {
  /** Filesystem-derived route pattern, e.g. '/api/users/[id]'. */
  pattern: string;
  /** Regex compiled from the pattern for matching calls. */
  regex: RegExp;
  /** Whether this route contains dynamic segments. */
  isDynamic: boolean;
  /** Whether this is a catch-all route. */
  isCatchAll: boolean;
  /** The handler file path on disk. */
  filePath: string;
  /** HTTP methods exported (if detectable). */
  methods?: string[];
}

interface RouteCall {
  /** Normalized path starting with /api/. */
  apiPath: string;
  /** 1-indexed line number. */
  line: number;
  /** 0-indexed column. */
  column: number;
  /** End column of the full match. */
  endColumn: number;
  /** The matched source text. */
  evidence: string;
  /** HTTP client library that made the call. */
  client: string;
  /** Whether the URL contains template literal interpolation. */
  hasInterpolation: boolean;
}

interface EngineStats {
  filesScanned: number;
  filesSkipped: number;
  routeCallsDetected: number;
  ghostRoutesFound: number;
  routeIndexSize: number;
  avgScanMs: number;
}

// ─── Route Call Patterns ─────────────────────────────────────────────────────

interface CallPattern {
  regex: RegExp;
  client: string;
  /** Capture group index for the URL path. */
  pathGroup: number;
}

const CALL_PATTERNS: CallPattern[] = [
  // fetch('/api/...') or fetch("/api/...") or fetch(`/api/...`)
  {
    regex: /\bfetch\s*\(\s*[`'"](\/?api\/[^`'"?#\s]+)[`'"]/g,
    client: 'fetch',
    pathGroup: 1,
  },
  // axios.get|post|put|delete|patch|head|options('/api/...')
  {
    regex: /\baxios\.(?:get|post|put|delete|patch|head|options|request)\s*\(\s*[`'"](\/?api\/[^`'"?#\s]+)[`'"]/g,
    client: 'axios',
    pathGroup: 1,
  },
  // axios('/api/...') — shorthand
  {
    regex: /\baxios\s*\(\s*[`'"](\/?api\/[^`'"?#\s]+)[`'"]/g,
    client: 'axios',
    pathGroup: 1,
  },
  // ky.get|post|put|delete|patch('/api/...')
  {
    regex: /\bky\s*\.\s*(?:get|post|put|delete|patch)\s*\(\s*[`'"](\/?api\/[^`'"?#\s]+)[`'"]/g,
    client: 'ky',
    pathGroup: 1,
  },
  // got.get|post|put|delete|patch('/api/...')
  {
    regex: /\bgot\s*\.\s*(?:get|post|put|delete|patch)\s*\(\s*[`'"](\/?api\/[^`'"?#\s]+)[`'"]/g,
    client: 'got',
    pathGroup: 1,
  },
  // $fetch('/api/...') — Nuxt/ofetch
  {
    regex: /\b\$?fetch\s*\(\s*[`'"](\/?api\/[^`'"?#\s]+)[`'"]/g,
    client: '$fetch',
    pathGroup: 1,
  },
  // ofetch('/api/...')
  {
    regex: /\bofetch\s*\(\s*[`'"](\/?api\/[^`'"?#\s]+)[`'"]/g,
    client: 'ofetch',
    pathGroup: 1,
  },
  // superagent: request.get('/api/...')
  {
    regex: /\brequest\s*\.\s*(?:get|post|put|del|delete|patch)\s*\(\s*[`'"](\/?api\/[^`'"?#\s]+)[`'"]/g,
    client: 'superagent',
    pathGroup: 1,
  },
  // new URL('/api/...', base)
  {
    regex: /new\s+URL\s*\(\s*[`'"](\/?api\/[^`'"?#\s]+)[`'"]/g,
    client: 'URL',
    pathGroup: 1,
  },
];

// Detect template literal interpolation: fetch(`/api/users/${id}`)
const INTERPOLATION_RE = /\$\{[^}]+\}/;

// ─── Safe Path Patterns ──────────────────────────────────────────────────────

const SAFE_PREFIXES = new Set([
  '/api/auth',          // NextAuth.js / Auth.js
  '/api/_next',         // Next.js internals
  '/api/trpc',          // tRPC router
  '/api/clerk',         // Clerk auth
  '/api/supabase',      // Supabase auth helpers
  '/api/uploadthing',   // UploadThing
  '/api/inngest',       // Inngest event handler
  '/api/sentry',        // Sentry tunnel
  '/api/stripe/webhook', // Common Stripe webhook path
  '/api/graphql',       // GraphQL endpoint (handled by schema, not file-per-route)
  '/api/health',        // Health check endpoints (often middleware)
  '/api/ping',          // Ping/health
  '/api/webhooks',      // Generic webhook handlers
  '/api/callback',      // OAuth/auth callback endpoints
  '/api/oauth',         // OAuth flow endpoints
  '/api/cron',          // Vercel/Next.js cron handlers
  '/api/revalidate',    // Next.js ISR revalidation
]);

function isSafePath(apiPath: string): boolean {
  for (const prefix of SAFE_PREFIXES) {
    if (apiPath === prefix || apiPath.startsWith(prefix + '/')) return true;
  }
  return false;
}

// ─── Comment / String Region Tracking ────────────────────────────────────────

interface LineRegion {
  inComment: boolean;
  /** When set, only scan from this index (code after block comment end on same line) */
  codeStart?: number;
  stringRanges: Array<{ start: number; end: number }>;
}

function buildLineRegions(lines: string[]): LineRegion[] {
  const regions: LineRegion[] = [];
  let inBlock = false;

  for (const line of lines) {
    if (inBlock) {
      const closeIdx = line.indexOf('*/');
      if (closeIdx === -1) {
        regions.push({ inComment: true, stringRanges: [] });
        continue;
      }
      inBlock = false;
      regions.push({ inComment: false, codeStart: closeIdx + 2, stringRanges: extractStringRanges(line, closeIdx + 2) });
      continue;
    }

    const trimmed = line.trimStart();
    if (trimmed.startsWith('//') || trimmed.startsWith('#')) {
      regions.push({ inComment: true, stringRanges: [] });
      continue;
    }

    const blockStart = line.indexOf('/*');
    if (blockStart !== -1) {
      const blockEnd = line.indexOf('*/', blockStart + 2);
      if (blockEnd === -1) {
        inBlock = true;
        const isFullComment = line.slice(0, blockStart).trim() === '';
        regions.push({ inComment: isFullComment, stringRanges: [] });
        continue;
      }
      // Both /* and */ on same line — only scan code after */
      regions.push({ inComment: false, codeStart: blockEnd + 2, stringRanges: extractStringRanges(line, blockEnd + 2) });
      continue;
    }

    regions.push({ inComment: false, stringRanges: extractStringRanges(line) });
  }

  return regions;
}

function extractStringRanges(line: string, from = 0): Array<{ start: number; end: number }> {
  const ranges: Array<{ start: number; end: number }> = [];
  let i = from;
  let inStr: string | null = null;
  let strStart = 0;

  while (i < line.length) {
    const ch = line[i]!;
    if (inStr) {
      if (ch === '\\') { i += 2; continue; }
      if (ch === inStr) {
        ranges.push({ start: strStart, end: i });
        inStr = null;
      }
      i++;
      continue;
    }
    // We actually WANT to match inside strings/template literals for API paths
    // So this is used only to skip comments, not strings
    i++;
  }
  return ranges;
}

// ─── Deterministic Finding IDs ───────────────────────────────────────────────

function deterministicId(uri: string, line: number, col: number, apiPath: string): string {
  const input = `${uri}::${line}::${col}::ghost::${apiPath}`;
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = (hash * 0x01000193) >>> 0;
  }
  return `ghost-route-${hash.toString(16).padStart(8, '0')}`;
}

// ─── Levenshtein (single-row) ────────────────────────────────────────────────

function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;
  if (a.length > b.length) [a, b] = [b, a];
  const m = a.length;
  const n = b.length;
  const row = new Uint16Array(m + 1);
  for (let i = 0; i <= m; i++) row[i] = i;
  for (let j = 1; j <= n; j++) {
    let prev = row[0]!;
    row[0] = j;
    for (let i = 1; i <= m; i++) {
      const temp = row[i]!;
      row[i] = a[i - 1] === b[j - 1] ? prev : 1 + Math.min(prev, row[i]!, row[i - 1]!);
      prev = temp;
    }
  }
  return row[m]!;
}

// ─── Route Pattern Compilation ───────────────────────────────────────────────

/**
 * Convert a filesystem route path to a regex pattern.
 * Examples:
 *   /api/users          → /^\/api\/users$/
 *   /api/users/[id]     → /^\/api\/users\/[^/]+$/
 *   /api/docs/[...slug] → /^\/api\/docs\/.*$/
 *   /api/[[...optional]] → /^\/api(?:\/.*)?$/
 */
function compileRoutePattern(routePath: string): { regex: RegExp; isDynamic: boolean; isCatchAll: boolean } {
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
    });

  // Escape remaining forward slashes
  pattern = pattern.replace(/\//g, '\\/');

  // Fix double-escaped slashes from the replacements above
  pattern = pattern.replace(/\\\\\//g, '\\/');

  return {
    regex: new RegExp(`^${pattern}$`),
    isDynamic,
    isCatchAll,
  };
}

// ─── Route Index Builder ─────────────────────────────────────────────────────

const ROUTE_EXTS = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs']);

/** Next.js route file names that define handlers. */
const NEXTJS_ROUTE_FILES = new Set(['route', 'index']);
/** Pages router: any file in pages/api/ is a route. */
const isPageRouterFile = (name: string) => ROUTE_EXTS.has(path.extname(name));

interface RouteIndex {
  routes: RouteEntry[];
  framework: Framework | 'truthpack';
  builtAt: number;
}

async function buildRouteIndex(workspaceRoot: string, framework: Framework): Promise<RouteIndex> {
  const routes: RouteEntry[] = [];
  const routeDirs = getRouteDirs(workspaceRoot, framework);

  for (const { dir, style } of routeDirs) {
    if (!fs.existsSync(dir)) continue;
    await walkRouteDir(dir, dir, style, routes);
  }

  return { routes, framework, builtAt: Date.now() };
}

interface RouteDir {
  dir: string;
  style: 'pages' | 'app' | 'nuxt-server' | 'sveltekit' | 'remix';
}

function getRouteDirs(root: string, framework: Framework): RouteDir[] {
  const dirs: RouteDir[] = [];

  if (framework === 'nextjs' || framework === 'unknown') {
    // Pages Router
    dirs.push({ dir: path.join(root, 'pages', 'api'), style: 'pages' });
    dirs.push({ dir: path.join(root, 'src', 'pages', 'api'), style: 'pages' });
    // App Router
    dirs.push({ dir: path.join(root, 'app', 'api'), style: 'app' });
    dirs.push({ dir: path.join(root, 'src', 'app', 'api'), style: 'app' });
  }

  if (framework === 'nuxt') {
    dirs.push({ dir: path.join(root, 'server', 'api'), style: 'nuxt-server' });
    dirs.push({ dir: path.join(root, 'server', 'routes'), style: 'nuxt-server' });
  }

  if (framework === 'sveltekit') {
    dirs.push({ dir: path.join(root, 'src', 'routes', 'api'), style: 'sveltekit' });
  }

  if (framework === 'remix') {
    dirs.push({ dir: path.join(root, 'app', 'routes'), style: 'remix' });
  }

  return dirs;
}

async function walkRouteDir(
  baseDir: string,
  currentDir: string,
  style: RouteDir['style'],
  routes: RouteEntry[]
): Promise<void> {
  let entries: fs.Dirent[];
  try {
    entries = await fsp.readdir(currentDir, { withFileTypes: true });
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code !== 'ENOENT' && process.env.NODE_ENV !== 'test') {
      console.warn(`[guardrail:ghost-route] Cannot read route dir ${currentDir}: ${code ?? (err as Error).message}`);
    }
    return;
  }

  for (const entry of entries) {
    const full = path.join(currentDir, entry.name);

    if (entry.isDirectory()) {
      // Skip route groups in App Router: (group)/
      if (entry.name.startsWith('(') && entry.name.endsWith(')')) {
        await walkRouteDir(baseDir, full, style, routes);
        continue;
      }
      // Skip private folders: _private/
      if (entry.name.startsWith('_')) continue;
      await walkRouteDir(baseDir, full, style, routes);
      continue;
    }

    if (!entry.isFile()) continue;
    const ext = path.extname(entry.name);
    if (!ROUTE_EXTS.has(ext)) continue;
    const baseName = path.basename(entry.name, ext);

    let routePath: string;

    if (style === 'app' || style === 'sveltekit') {
      // App Router: only route.ts files define routes
      if (!NEXTJS_ROUTE_FILES.has(baseName) && baseName !== '+server') continue;
      // Route path = directory relative to baseDir
      const relDir = path.relative(baseDir, currentDir).replace(/\\/g, '/');
      routePath = '/api' + (relDir ? `/${relDir}` : '');
    } else if (style === 'pages' || style === 'nuxt-server') {
      // Pages Router: file path maps to route
      const relFile = path.relative(baseDir, full).replace(/\\/g, '/');
      const withoutExt = relFile.replace(/\.[^.]+$/, '');
      // Remove trailing /index
      const cleaned = withoutExt.replace(/\/index$/, '') || '';
      routePath = '/api' + (cleaned ? `/${cleaned}` : '');
    } else if (style === 'remix') {
      // Remix: dots in filename = path segments, $ = dynamic
      const relFile = path.relative(baseDir, full).replace(/\\/g, '/');
      const withoutExt = relFile.replace(/\.[^.]+$/, '');
      const remixPath = withoutExt
        .replace(/\./g, '/')
        .replace(/\$/g, '[param]')
        .replace(/\/index$/, '');
      if (!remixPath.startsWith('api')) continue;
      routePath = `/${remixPath}`;
    } else {
      continue;
    }

    // Strip route groups from path: (auth)/api/... → /api/...
    routePath = routePath.replace(/\/\([^)]+\)/g, '');

    const compiled = compileRoutePattern(routePath);

    routes.push({
      pattern: routePath,
      regex: compiled.regex,
      isDynamic: compiled.isDynamic,
      isCatchAll: compiled.isCatchAll,
      filePath: full,
    });
  }
}

// ─── Framework Detection ─────────────────────────────────────────────────────

function detectFramework(workspaceRoot: string): Framework {
  try {
    const raw = fs.readFileSync(path.join(workspaceRoot, 'package.json'), 'utf-8');
    const pkg = JSON.parse(raw);
    const allDeps = { ...pkg.dependencies, ...pkg.devDependencies };

    if (allDeps['next'])         return 'nextjs';
    if (allDeps['nuxt'])         return 'nuxt';
    if (allDeps['@sveltejs/kit']) return 'sveltekit';
    if (allDeps['@remix-run/node'] || allDeps['@remix-run/react']) return 'remix';
    if (allDeps['express'])      return 'express';
  } catch (err) {
    if (process.env.GUARDRAIL_DEBUG) {
      console.warn('[ghost_route] detectFramework failed:', err instanceof Error ? err.message : err);
    }
  }

  return 'unknown';
}

// ─── Engine ──────────────────────────────────────────────────────────────────

export class GhostRouteEngine implements ScanEngine {
  readonly id = 'ghost_route';

  private readonly _workspaceRoot: string;
  private readonly _confidenceThreshold: number;

  private _framework: Framework = 'unknown';
  private _routeIndex: RouteIndex | null = null;
  private _indexBuilding: Promise<RouteIndex> | null = null;

  /** Additional path prefixes to never flag. */
  private readonly _extraSafePrefixes: string[];

  // Stats
  private _stats: EngineStats = {
    filesScanned: 0,
    filesSkipped: 0,
    routeCallsDetected: 0,
    ghostRoutesFound: 0,
    routeIndexSize: 0,
    avgScanMs: 0,
  };
  private _totalScanMs = 0;

  constructor(
    workspaceRoot: string,
    confidenceThreshold: number = 0.75,
    extraSafePrefixes: string[] = [],
    /** Pre-built route index from truthpack; when provided, skips filesystem scan */
    truthpackRouteIndex?: { routes: TruthpackRouteEntry[] }
  ) {
    this._workspaceRoot = workspaceRoot;
    this._confidenceThreshold = confidenceThreshold;
    this._extraSafePrefixes = extraSafePrefixes;
    if (truthpackRouteIndex) {
      this._routeIndex = {
        routes: truthpackRouteIndex.routes as RouteEntry[],
        framework: 'truthpack',
        builtAt: Date.now(),
      };
      this._stats.routeIndexSize = truthpackRouteIndex.routes.length;
    }
  }

  get stats(): Readonly<EngineStats> {
    return { ...this._stats };
  }

  get framework(): Framework {
    return this._framework;
  }

  // ── Lifecycle ────────────────────────────────────────────────────────────

  async activate(): Promise<void> {
    this._framework = detectFramework(this._workspaceRoot);
    await this._ensureIndex();
  }

  /** Rebuild route index. Call after file creation/deletion. */
  async refresh(): Promise<void> {
    this._framework = detectFramework(this._workspaceRoot);
    this._routeIndex = null;
    this._indexBuilding = null;
    await this._ensureIndex();
  }

  private async _ensureIndex(): Promise<RouteIndex> {
    if (this._routeIndex) return this._routeIndex;
    if (this._indexBuilding) return this._indexBuilding;

    this._indexBuilding = buildRouteIndex(this._workspaceRoot, this._framework)
      .then(index => {
        this._routeIndex = index;
        this._stats.routeIndexSize = index.routes.length;
        this._indexBuilding = null;
        return index;
      });

    return this._indexBuilding;
  }

  // ── Main Scan ────────────────────────────────────────────────────────────

  async scan(delta: DeltaContext, signal?: AbortSignal): Promise<Finding[]> {
    if (signal?.aborted) return [];
    const t0 = performance.now();

    // Skip if not a recognized framework project
    if (this._framework === 'unknown') {
      // Re-check in case package.json was added
      this._framework = detectFramework(this._workspaceRoot);
      if (this._framework === 'unknown') {
        this._stats.filesSkipped++;
        return [];
      }
    }

    // Quick pre-check: does the file even contain API route calls?
    if (!containsRouteCall(delta.fullText)) {
      this._stats.filesSkipped++;
      return [];
    }

    this._stats.filesScanned++;

    // Ensure route index is built
    const index = await this._ensureIndex();
    if (signal?.aborted) return [];

    // Extract route calls
    const lines = delta.fullText.split('\n');
    const regions = buildLineRegions(lines);
    const calls = this._extractRouteCalls(lines, regions, signal);

    this._stats.routeCallsDetected += calls.length;

    // Check each call against the route index
    const findings: Finding[] = [];
    const seen = new Set<string>();

    for (const call of calls) {
      if (signal?.aborted) break;

      // Dedup by path within a single file
      if (seen.has(call.apiPath)) continue;
      seen.add(call.apiPath);

      // Safe-path filtering
      if (isSafePath(call.apiPath)) continue;
      if (this._extraSafePrefixes.some(p => call.apiPath.startsWith(p))) continue;

      // Check if route exists in index
      if (this._matchesRoute(index, call.apiPath)) continue;

      // Determine confidence
      let confidence = 0.85;
      if (call.hasInterpolation) confidence = 0.65; // template literals are uncertain
      if (confidence < this._confidenceThreshold) continue;

      // Find closest route for suggestion
      const suggestion = this._findClosestRoute(index, call.apiPath);
      const sub = call.apiPath.replace(/^\/api\//, '');

      this._stats.ghostRoutesFound++;

      findings.push({
        id: deterministicId(delta.documentUri, call.line, call.column, call.apiPath),
        engine: this.id,
        severity: 'high',
        category: 'ghost_route',
        file: delta.documentUri,
        line: call.line,
        column: call.column,
        endLine: call.line,
        endColumn: call.endColumn,
        message: `Route \`${call.apiPath}\` has no handler file in this ${this._frameworkLabel()} project`,
        evidence: call.evidence,
        suggestion: suggestion
          ? `Did you mean \`${suggestion}\`? Or create \`${this._suggestFilePath(sub)}\``
          : `Create \`${this._suggestFilePath(sub)}\``,
        confidence,
        autoFixable: false,
        ruleId: 'GHO001',
      });
    }

    // Update stats
    const elapsed = performance.now() - t0;
    this._totalScanMs += elapsed;
    this._stats.avgScanMs = this._stats.filesScanned > 0
      ? Math.round(this._totalScanMs / this._stats.filesScanned)
      : 0;

    return findings;
  }

  // ── Route Call Extraction ────────────────────────────────────────────────

  private _extractRouteCalls(
    lines: string[],
    regions: LineRegion[],
    signal?: AbortSignal
  ): RouteCall[] {
    const results: RouteCall[] = [];

    for (let i = 0; i < lines.length; i++) {
      if (signal?.aborted) break;

      const region = regions[i]!;
      if (region.inComment) continue;

      const line = lines[i]!;
      const codeStart = region.codeStart ?? 0;
      const scanLine = codeStart > 0 ? line.slice(codeStart) : line;

      for (const pattern of CALL_PATTERNS) {
        pattern.regex.lastIndex = 0;
        let m: RegExpExecArray | null;

        while ((m = pattern.regex.exec(scanLine)) !== null) {
          const rawPath = m[pattern.pathGroup]!;

          // Normalize: ensure leading slash
          const apiPath = rawPath.startsWith('/') ? rawPath : `/${rawPath}`;

          // Skip absolute URLs (external APIs)
          if (/^https?:\/\//.test(rawPath)) continue;

          // Detect template literal interpolation
          const hasInterpolation = INTERPOLATION_RE.test(m[0]);

          results.push({
            apiPath: normalizeApiPath(apiPath),
            line: i + 1,
            column: codeStart + m.index,
            endColumn: codeStart + m.index + m[0].length,
            evidence: m[0],
            client: pattern.client,
            hasInterpolation,
          });
        }
      }
    }

    return results;
  }

  // ── Route Matching ───────────────────────────────────────────────────────

  private _matchesRoute(index: RouteIndex, apiPath: string): boolean {
    for (const route of index.routes) {
      // Exact match (static routes)
      if (route.pattern === apiPath) return true;

      // Regex match (dynamic routes)
      if (route.isDynamic && route.regex.test(apiPath)) return true;
    }

    return false;
  }

  /** Find the closest existing route by Levenshtein distance. */
  private _findClosestRoute(index: RouteIndex, apiPath: string): string | null {
    let best: string | null = null;
    let bestDist = 5; // max distance threshold

    for (const route of index.routes) {
      if (route.isDynamic) continue; // only suggest static routes
      const d = levenshtein(apiPath, route.pattern);
      if (d > 0 && d < bestDist) {
        bestDist = d;
        best = route.pattern;
      }
    }

    return best;
  }

  // ── Suggestion Helpers ───────────────────────────────────────────────────

  private _suggestFilePath(sub: string): string {
    switch (this._framework) {
      case 'nextjs':
        // Prefer App Router for new projects
        return `app/api/${sub}/route.ts`;
      case 'nuxt':
        return `server/api/${sub}.ts`;
      case 'sveltekit':
        return `src/routes/api/${sub}/+server.ts`;
      case 'remix':
        return `app/routes/api.${sub.replace(/\//g, '.')}.ts`;
      default:
        return `app/api/${sub}/route.ts`;
    }
  }

  private _frameworkLabel(): string {
    switch (this._framework) {
      case 'nextjs': return 'Next.js';
      case 'nuxt': return 'Nuxt';
      case 'sveltekit': return 'SvelteKit';
      case 'remix': return 'Remix';
      case 'express': return 'Express';
      case 'truthpack': return 'truthpack';
      default: return '';
    }
  }

  // ── Lifecycle ────────────────────────────────────────────────────────────

  dispose(): void {
    this._routeIndex = null;
    this._indexBuilding = null;
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Quick pre-check to bail early on files with no API route calls. */
function containsRouteCall(text: string): boolean {
  return (
    text.includes('/api/') ||
    text.includes("'api/") ||
    text.includes('"api/') ||
    text.includes('`/api') ||        // template literal routes
    text.includes('fetch(') ||        // any fetch call may hit an API
    text.includes('axios.') ||        // axios method calls
    text.includes('$fetch(') ||       // Nuxt $fetch
    text.includes('.get(') ||         // HTTP client .get/.post/.put/.delete
    text.includes('.post(') ||
    text.includes('/v1/') ||          // versioned API paths (v1, v2)
    text.includes('/v2/')
  );
}

/** Normalize an API path: strip trailing slashes, collapse double slashes. */
function normalizeApiPath(p: string): string {
  return p
    .replace(/\/+/g, '/')     // collapse double slashes
    .replace(/\/$/, '')         // strip trailing slash
    || '/api';
}