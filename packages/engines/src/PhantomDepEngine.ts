/**
 * PhantomDepEngine v2 — World-class phantom/hallucinated dependency detection.
 *
 * ┌─────────────────────────────────────────────────────────────┐
 * │  DETECTION LAYERS                                          │
 * │                                                            │
 * │  0. Path alias / internal  — instant, 0ms (FP prevention)  │
 * │  1. Known-fake list        — instant, 0ms                  │
 * │  2. Known-malicious list   — instant, 0ms                  │
 * │  3. Lockfile presence      — cached FS, <1ms               │
 * │  4. package.json deps      — cached FS, <2ms               │
 * │  5. node_modules existence — cached FS, <5ms               │
 * │  6. Typosquat distance     — CPU, <5ms                     │
 * │  7. Dependency confusion   — cached + async, <10ms cached  │
 * │  8. npm registry HEAD      — async batch, network          │
 * │                                                            │
 * │  LATENCY: <15ms cached · async for uncached registry       │
 * │  CACHING: TTL-based LRU with file-watcher invalidation     │
 * │  EVENTS:  Typed EventEmitter for progress/findings stream  │
 * └─────────────────────────────────────────────────────────────┘
 */

import { existsSync, readFileSync, readdirSync, statSync, watchFile, unwatchFile, mkdirSync, writeFileSync } from 'fs';
import { join, dirname, resolve } from 'path';
import { EventEmitter } from 'events';
import type { Finding, DeltaContext } from './core-types';
import { EngineError, withEngineErrorHandling, createContext } from './EngineError.js';

/** FNV-1a deterministic hash → stable finding IDs across re-scans */
function deterministicId(uri: string, line: number, col: number, category: string, pkg: string): string {
  const input = `phantom:${uri}::${line}::${col}::${category}::${pkg}`;
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = (hash * 0x01000193) >>> 0;
  }
  return `phantom-${hash.toString(16).padStart(8, '0')}`;
}

// ─── Types ──────────────────────────────────────────────────────────────────

export type PhantomSeverity = 'critical' | 'high' | 'medium' | 'low' | 'info';

export type DetectionCategory =
  | 'phantom_dep'       // Package doesn't exist at all
  | 'typosquat'         // Suspiciously close to a real popular package
  | 'dep_confusion'     // Private scope name exists on public registry
  | 'known_malicious'   // Known supply-chain attack package
  | 'undeclared_dep'    // Exists on npm but missing from package.json
  | 'hallucinated_api'; // Package exists but imported export doesn't

export interface PhantomFinding extends Finding {
  category: DetectionCategory;
  ruleId: string;
  /** Signals that contributed to the confidence score */
  signals: ConfidenceSignal[];
  /** If typosquat, the real package it's confusable with */
  similarTo?: string;
  /** Levenshtein distance for typosquat detections */
  editDistance?: number;
}

export interface ConfidenceSignal {
  source: string;
  weight: number;
  detail: string;
}

export interface EngineStats {
  scansCompleted: number;
  findingsTotal: number;
  cacheHitRate: number;
  avgScanMs: number;
  registryChecks: number;
  registryCacheSize: number;
}

export interface EngineConfig {
  /** Minimum confidence to report (0–1). Default 0.70 */
  confidenceThreshold: number;
  /** Max concurrent registry HEAD requests. Default 6 */
  registryConcurrency: number;
  /** Registry request timeout in ms. Default 3000 */
  registryTimeoutMs: number;
  /** TTL for positive registry cache entries in ms. Default 3600000 (1hr) */
  registryCacheTtlMs: number;
  /** TTL for negative (not found) registry cache entries in ms. Default 86400000 (24hr) */
  registryNegativeTtlMs: number;
  /** TTL for filesystem cache (package.json, node_modules) in ms. Default 30000 */
  fsCacheTtlMs: number;
  /** Enable typosquat detection. Default true */
  enableTyposquatDetection: boolean;
  /** Max Levenshtein distance for typosquat alerts. Default 2 */
  typosquatMaxDistance: number;
  /** Enable dependency confusion detection. Default true */
  enableDepConfusionDetection: boolean;
  /** Enable lockfile analysis. Default true */
  enableLockfileAnalysis: boolean;
  /** Enable file watchers for automatic cache invalidation. Default false */
  enableFileWatchers: boolean;
  /** Custom registries to check (e.g. private npm). Default [] */
  customRegistries: string[];
  /** Additional known-safe packages beyond auto-detected deps */
  additionalSafePackages: string[];
  /** Optional path to persist registry cache across runs (e.g. .guardrail/registry-cache.json) */
  registryCachePath?: string;
}

type EngineEvent =
  | { type: 'scan:start'; fileUri: string }
  | { type: 'scan:complete'; fileUri: string; findingsCount: number; durationMs: number }
  | { type: 'finding'; finding: PhantomFinding }
  | { type: 'registry:check'; pkg: string }
  | { type: 'registry:result'; pkg: string; exists: boolean }
  | { type: 'cache:invalidate'; reason: string };

// ─── Constants ──────────────────────────────────────────────────────────────

/**
 * Packages commonly hallucinated by AI coding assistants.
 * Curated from npm 404 analysis and LLM output surveys.
 * Grouped by domain for maintainability.
 */
const KNOWN_FAKE_PACKAGES = new Set([
  // Auth
  'react-auth-provider', 'react-secure-auth', 'next-auth-helpers',
  'react-auth-kit-v2', 'auth-provider-react', 'next-auth-provider',
  'next-auth-client', 'vercel-auth', 'vercel-auth-helpers',
  'supabase-auth-helpers', 'supabase-auth-utils', 'firebase-auth-helpers',
  'clerk-auth-utils', 'auth0-helpers', 'passport-auth-helpers',
  // Payments
  'stripe-auth-helper', 'stripe-payment-helper', 'stripe-checkout-helper',
  'stripe-webhook-utils', 'stripe-utils', 'paypal-checkout-helper',
  // Utilities
  'string-utils-pro', 'array-helpers-ts', 'object-deep-merge',
  'config-loader-pro', 'api-response-handler', 'env-loader-utils',
  'lodash-helpers', 'ramda-utils', 'underscore-helpers',
  // AI / ML
  'openai-helpers', 'openai-utils', 'anthropic-helpers', 'claude-helpers',
  'langchain-helpers', 'langchain-utils', 'ai-sdk-helpers',
  // Next.js
  'next-seo-helper', 'next-middleware-helper', 'next-api-handler',
  'next-server-utils', 'next-router-helpers', 'next-image-utils',
  // React ecosystem
  'react-query-helpers', 'react-store-helpers', 'react-form-validator',
  'react-hook-form-validator', 'react-state-manager', 'react-context-utils',
  'react-router-helpers', 'react-animation-utils', 'react-modal-helper',
  // Database / ORM
  'prisma-helpers', 'prisma-utils', 'drizzle-helpers', 'drizzle-utils',
  'mongoose-helpers', 'sequelize-helpers', 'typeorm-utils',
  // Server
  'express-middleware-helper', 'express-validator-pro', 'fastify-helpers',
  'koa-helpers', 'hono-utils',
  // Misc
  'jwt-handler', 'crypto-helpers', 'form-validation-utils',
  'tailwind-merge-utils', 'clsx-merge', 'date-fns-utils', 'dayjs-helpers',
  'zod-helpers', 'yup-utils', 'joi-helpers', 'ajv-utils',
  'docker-helpers', 'kubernetes-utils', 'terraform-helpers',
  'graphql-helpers', 'apollo-utils', 'trpc-helpers',
  'socket-io-helpers', 'websocket-utils',
  'redis-helpers', 'kafka-utils', 'rabbitmq-helpers',
  'aws-sdk-helpers', 'gcp-utils', 'azure-helpers',
  'testing-utils-pro', 'jest-helpers', 'vitest-utils',
  'playwright-helpers', 'cypress-utils',
]);

/**
 * Known malicious packages from npm security advisories.
 * These have been confirmed as supply-chain attacks, typosquats,
 * or packages with intentional malicious payloads.
 *
 * Sources: npm security advisories, Snyk, Socket.dev, Phylum
 */
const KNOWN_MALICIOUS_PACKAGES = new Set([
  'event-stream',  // Compromised in 2018 — flatmap-stream injection
  'ua-parser-js',  // Compromised versions 0.7.29, 0.8.0, 1.0.0
  'coa',           // Hijacked Nov 2021
  'rc',            // Hijacked Nov 2021
  'colors',        // Sabotaged by maintainer Jan 2022
  'faker',         // Sabotaged by maintainer Jan 2022
  'node-ipc',      // Protestware (peacenotwar) Mar 2022
  'es5-ext',       // Protestware
  'crossenv',      // Typosquat of cross-env
  'mongose',       // Typosquat of mongoose
  'babelcli',      // Typosquat of babel-cli
  'eslint-scope',  // Compromised Jul 2018
  'flatmap-stream', // Malicious — injected into event-stream
  'getcookies',    // Malicious backdoor
  'mailparser',    // Typosquat versions
  'http-proxy.js', // Typosquat of http-proxy
  'discordi.js',   // Typosquat of discord.js
  'discord.jss',
  'twilio-npm',    // Typosquat
  'loadyaml',      // Malicious
  'lodashs',       // Typosquat of lodash
  'lodahs',
  '@aspect-build/rules_js',  // Dependency confusion PoC
]);

/**
 * Popular packages for typosquat distance comparison.
 * Top ~200 by weekly downloads, covering major ecosystems.
 */
const POPULAR_PACKAGES: readonly string[] = [
  // Core utilities
  'lodash', 'underscore', 'ramda', 'date-fns', 'dayjs', 'moment',
  'uuid', 'nanoid', 'chalk', 'debug', 'dotenv', 'cross-env', 'rimraf',
  'glob', 'minimatch', 'semver', 'yargs', 'commander', 'inquirer',
  // Type checking / validation
  'zod', 'yup', 'joi', 'ajv', 'io-ts', 'superstruct', 'typebox',
  // React
  'react', 'react-dom', 'react-router', 'react-router-dom',
  'react-hook-form', 'react-query', '@tanstack/react-query',
  'react-select', 'react-modal', 'react-table', 'react-spring',
  'framer-motion', 'react-icons', 'react-toastify', 'react-dropzone',
  // State management
  'redux', 'zustand', 'jotai', 'recoil', 'mobx', 'valtio', 'immer',
  // Next.js
  'next', 'next-auth', '@next/font', '@next/image', 'next-seo',
  // Styling
  'tailwindcss', 'postcss', 'autoprefixer', 'sass', 'styled-components',
  '@emotion/react', '@emotion/styled', 'clsx', 'classnames', 'tailwind-merge',
  // Build / bundling
  'webpack', 'vite', 'esbuild', 'rollup', 'turbo', 'tsup', 'unbuild',
  'typescript', 'babel', '@babel/core',
  // Testing
  'jest', 'vitest', 'mocha', 'chai', 'sinon', 'cypress', 'playwright',
  '@testing-library/react', '@testing-library/jest-dom',
  // Server
  'express', 'fastify', 'koa', 'hono', 'h3', 'cors', 'helmet',
  'body-parser', 'cookie-parser', 'morgan', 'compression',
  // Database / ORM
  'prisma', '@prisma/client', 'drizzle-orm', 'mongoose', 'sequelize',
  'typeorm', 'knex', 'pg', 'mysql2', 'better-sqlite3', 'redis', 'ioredis',
  // Auth
  'passport', 'jsonwebtoken', 'bcrypt', 'bcryptjs', 'argon2',
  // HTTP
  'axios', 'node-fetch', 'got', 'ky', 'superagent', 'undici',
  // Linting
  'eslint', 'prettier', 'stylelint', 'oxlint', 'biome',
  // AI / ML
  'openai', '@anthropic-ai/sdk', 'langchain', '@langchain/core', 'ai',
  // Payments
  'stripe', '@stripe/stripe-js',
  // Cloud
  'aws-sdk', '@aws-sdk/client-s3', 'firebase', '@google-cloud/storage',
  // Misc popular
  'sharp', 'jimp', 'puppeteer', 'cheerio', 'pdf-lib', 'xlsx',
  'nodemailer', 'bull', 'bullmq', 'socket.io', 'ws',
  'graphql', '@apollo/client', '@apollo/server', '@trpc/server', '@trpc/client',
  'pino', 'winston', 'bunyan',
  'p-limit', 'p-queue', 'p-retry', 'execa', 'zx',
  'msw', 'nock', 'supertest',
  'docker-compose', 'dockerode',
] as const;

const NODE_BUILTINS = new Set([
  'assert', 'assert/strict', 'async_hooks', 'buffer', 'child_process',
  'cluster', 'console', 'constants', 'crypto', 'dgram', 'diagnostics_channel',
  'dns', 'dns/promises', 'domain', 'events', 'fs', 'fs/promises',
  'http', 'http2', 'https', 'inspector', 'inspector/promises', 'module',
  'net', 'os', 'path', 'path/posix', 'path/win32', 'perf_hooks',
  'process', 'punycode', 'querystring', 'readline', 'readline/promises',
  'repl', 'stream', 'stream/consumers', 'stream/promises', 'stream/web',
  'string_decoder', 'sys', 'test', 'timers', 'timers/promises',
  'tls', 'trace_events', 'tty', 'url', 'util', 'util/types',
  'v8', 'vm', 'wasi', 'worker_threads', 'zlib',
]);

/** Modules provided by host runtime, not from npm */
const PROVIDED_MODULES = new Set(['vscode', 'electron', 'deno']);

const DEFAULT_CONFIG: EngineConfig = {
  confidenceThreshold: 0.70,
  registryConcurrency: 6,
  registryTimeoutMs: 3000,
  registryCacheTtlMs: 3_600_000,      // 1 hour
  registryNegativeTtlMs: 86_400_000,  // 24 hours
  fsCacheTtlMs: 30_000,               // 30 seconds
  enableTyposquatDetection: true,
  typosquatMaxDistance: 2,
  enableDepConfusionDetection: true,
  enableLockfileAnalysis: true,
  enableFileWatchers: false,
  customRegistries: [],
  additionalSafePackages: [],
};

// ─── LRU Cache ──────────────────────────────────────────────────────────────

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

class LRUCache<T> {
  private readonly _map = new Map<string, CacheEntry<T>>();

  constructor(
    private readonly _maxSize: number = 2048,
    private readonly _defaultTtlMs: number = 60_000,
  ) {}

  get(key: string): T | undefined {
    const entry = this._map.get(key);
    if (!entry) return undefined;
    if (Date.now() > entry.expiresAt) {
      this._map.delete(key);
      return undefined;
    }
    // Move to end (most recently used)
    this._map.delete(key);
    this._map.set(key, entry);
    return entry.value;
  }

  set(key: string, value: T, ttlMs?: number): void {
    if (this._map.has(key)) this._map.delete(key);
    if (this._map.size >= this._maxSize) {
      // Evict oldest (first key)
      const oldest = this._map.keys().next().value;
      if (oldest !== undefined) this._map.delete(oldest);
    }
    this._map.set(key, {
      value,
      expiresAt: Date.now() + (ttlMs ?? this._defaultTtlMs),
    });
  }

  has(key: string): boolean {
    return this.get(key) !== undefined;
  }

  delete(key: string): void {
    this._map.delete(key);
  }

  clear(): void {
    this._map.clear();
  }

  get size(): number {
    return this._map.size;
  }

  /** Snapshot for persistence: [key, { value, expiresAt }][] */
  entries(): Array<[string, { value: T; expiresAt: number }]> {
    const now = Date.now();
    return Array.from(this._map.entries())
      .filter(([, e]) => now <= e.expiresAt)
      .map(([k, e]) => [k, { value: e.value, expiresAt: e.expiresAt }]);
  }

  /** Evict all expired entries */
  prune(): number {
    const now = Date.now();
    let evicted = 0;
    for (const [key, entry] of this._map) {
      if (now > entry.expiresAt) {
        this._map.delete(key);
        evicted++;
      }
    }
    return evicted;
  }
}

// ─── Import Extraction ──────────────────────────────────────────────────────

interface ExtractedImport {
  specifier: string;    // Full import specifier
  packageName: string;  // Resolved package name (scope/name)
  subpath?: string;     // Subpath import if any
  line: number;
  column: number;
  code: string;
  importKind: 'value' | 'type' | 'side-effect' | 'dynamic';
}

// Patterns ordered by frequency for early-match optimization
const IMPORT_PATTERNS: readonly RegExp[] = [
  // Static value imports:  import { x } from 'pkg'  /  import x from 'pkg'
  /import\s+(?:\{[^}]*\}|\*\s+as\s+\w+|\w+(?:\s*,\s*(?:\{[^}]*\}|\*\s+as\s+\w+))?)[\s]*from\s+['"]([^'"]+)['"]/g,
  // Type-only imports:  import type { X } from 'pkg'
  /import\s+type\s+(?:\{[^}]*\}|\*\s+as\s+\w+|\w+)\s+from\s+['"]([^'"]+)['"]/g,
  // Side-effect imports:  import 'pkg'  /  import 'pkg/style.css'
  /^[\s]*import\s+['"]([^'"]+)['"]/gm,
  // Dynamic imports:  import('pkg')  /  await import('pkg')
  /import\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
  // Require:  require('pkg')
  /require\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
  // Re-exports:  export { x } from 'pkg'  /  export * from 'pkg'
  /export\s+(?:\{[^}]*\}|\*(?:\s+as\s+\w+)?)\s+from\s+['"]([^'"]+)['"]/g,
];

function extractPackageName(specifier: string): { pkg: string; subpath?: string } {
  let rest = specifier;
  let pkg: string;

  if (rest.startsWith('@')) {
    const parts = rest.split('/');
    pkg = parts.length >= 2 ? `${parts[0]}/${parts[1]}` : rest;
    rest = parts.slice(2).join('/');
  } else {
    const slash = rest.indexOf('/');
    pkg = slash === -1 ? rest : rest.slice(0, slash);
    rest = slash === -1 ? '' : rest.slice(slash + 1);
  }

  return { pkg, subpath: rest || undefined };
}

/**
 * Layer 0 — Path alias / internal import detection.
 *
 * Returns true for specifiers that are NOT npm packages and should be
 * skipped entirely. This prevents false positives from:
 * - Relative/absolute paths (./foo, /foo)
 * - Node.js subpath imports (#foo) from package.json "imports"
 * - Framework path aliases (@/, ~/, $lib/, $app/, $env/, etc.)
 * - Single-character specifiers (e.g. bare `~`)
 */
function isRelativeOrAlias(spec: string): boolean {
  // Relative or absolute paths
  if (spec.startsWith('.') || spec.startsWith('/')) return true;

  // Node.js subpath imports (#imports, #components, #app, etc.)
  if (spec.startsWith('#')) return true;

  // Bare tilde or tilde-slash path aliases (~/utils, ~/components)
  if (spec === '~' || spec.startsWith('~/')) return true;

  // Dollar-prefix aliases: $lib/, $app/, $env/ (SvelteKit), $/ (generic)
  if (spec.startsWith('$')) return true;

  // @/ path alias (Next.js, Nuxt, Vite, etc.) — distinct from @scope/ packages.
  // Real scoped packages: @babel/core, @types/node (scope is >=2 chars)
  // Path alias: @/components, @/utils (scope part is empty — just "@/")
  if (spec.startsWith('@/')) return true;

  // Single-character specifiers can't be real npm packages
  if (spec.length <= 1) return true;

  // URL / protocol imports — not npm packages
  // Covers: https://..., http://..., jsr:@supabase/..., data:..., node:..., bun:...
  if (/^(?:https?|jsr|npm|data|node|bun|file|blob|wasm):/.test(spec)) return true;

  return false;
}

/**
 * Common monorepo directory names that are used as bare specifier path aliases.
 * When `import from "test/utils"` resolves to a local directory, it's not an npm package.
 */
const MONOREPO_DIR_ALIASES = new Set([
  'test', 'tests', 'src', 'lib', 'app', 'server', 'client',
  'shared', 'common', 'utils', 'config', 'scripts', 'build',
  'docs', 'helpers', 'fixtures', 'mocks', 'stubs', 'support',
  'tools', 'internal', 'core', 'api', 'models', 'views',
  'controllers', 'middleware', 'routes', 'schemas', 'types',
  'components', 'pages', 'layouts', 'styles', 'assets', 'public',
  'static', 'vendor', 'plugins', 'modules', 'features',
]);

function isNodeBuiltin(spec: string): boolean {
  const name = spec.replace(/^node:/, '');
  return NODE_BUILTINS.has(name);
}

/**
 * High-performance import extraction.
 * Uses a single pass through lines with pattern matching.
 * Deduplicates by package name, keeping the first occurrence.
 */
function extractImports(source: string): ExtractedImport[] {
  const results: ExtractedImport[] = [];
  const seen = new Set<string>();
  const lines = source.split('\n');

  for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
    const line = lines[lineIdx]!;
    const trimmed = line.trimStart();

    // Skip empty lines and comments
    if (!trimmed) continue;
    if (trimmed.startsWith('//') || trimmed.startsWith('/*') || trimmed.startsWith('*')) continue;

    for (const pattern of IMPORT_PATTERNS) {
      pattern.lastIndex = 0;
      let match: RegExpExecArray | null;

      while ((match = pattern.exec(line)) !== null) {
        const specifier = match[1]!;

        if (isRelativeOrAlias(specifier) || isNodeBuiltin(specifier)) continue;

        const { pkg, subpath } = extractPackageName(specifier);

        if (seen.has(pkg)) continue;
        seen.add(pkg);

        // Determine import kind from the pattern source
        const patternSource = pattern.source;
        let importKind: ExtractedImport['importKind'] = 'value';
        if (patternSource.includes('type\\s+')) importKind = 'type';
        else if (patternSource.startsWith('^[\\s]*import\\s+[\'"]')) importKind = 'side-effect';
        else if (patternSource.includes('import\\s*\\(')) importKind = 'dynamic';

        results.push({
          specifier,
          packageName: pkg,
          subpath,
          line: lineIdx + 1,
          column: match.index,
          code: trimmed,
          importKind,
        });
      }
    }
  }

  return results;
}

// ─── Typosquat Detection ────────────────────────────────────────────────────

/**
 * Optimized Damerau-Levenshtein distance with early termination.
 * Supports transpositions (common in typos: "lod*ah*s" → "lod*ha*s").
 */
function damerauLevenshtein(a: string, b: string, maxDist: number): number {
  const m = a.length;
  const n = b.length;

  // Quick bounds check
  if (Math.abs(m - n) > maxDist) return maxDist + 1;
  if (a === b) return 0;
  if (m === 0) return n;
  if (n === 0) return m;

  // Single character difference shortcuts
  if (m === 1 && n === 1) return a === b ? 0 : 1;

  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));

  for (let i = 0; i <= m; i++) dp[i]![0] = i;
  for (let j = 0; j <= n; j++) dp[0]![j] = j;

  for (let i = 1; i <= m; i++) {
    let rowMin = Infinity;
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i]![j] = Math.min(
        dp[i - 1]![j]! + 1,      // deletion
        dp[i]![j - 1]! + 1,      // insertion
        dp[i - 1]![j - 1]! + cost, // substitution
      );

      // Transposition
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        dp[i]![j] = Math.min(dp[i]![j]!, dp[i - 2]![j - 2]! + cost);
      }

      rowMin = Math.min(rowMin, dp[i]![j]!);
    }
    // Early termination: if entire row exceeds max, no need to continue
    if (rowMin > maxDist) return maxDist + 1;
  }

  return dp[m]![n]!;
}

/**
 * Additional heuristic checks beyond edit distance:
 * - Character swaps (monoose → mongoose)
 * - Missing/added hyphens (react-dom → reactdom)
 * - Scope confusion (@my-scope/pkg vs @their-scope/pkg)
 * - Common char substitutions (0↔o, 1↔l, rn↔m)
 */
function isVisuallyConfusable(candidate: string, real: string): boolean {
  // Normalize: strip hyphens, underscores, dots
  const norm = (s: string) => s.replace(/[-_.]/g, '').toLowerCase();
  if (norm(candidate) === norm(real) && candidate !== real) return true;

  // Common homoglyph substitutions
  const homoglyphs: [string, string][] = [
    ['0', 'o'], ['1', 'l'], ['1', 'i'], ['rn', 'm'],
    ['vv', 'w'], ['cl', 'd'], ['nn', 'm'],
  ];

  let normed = candidate.toLowerCase();
  for (const [from, to] of homoglyphs) {
    normed = normed.replaceAll(from, to);
  }
  if (normed === real.toLowerCase()) return true;

  return false;
}

interface TyposquatMatch {
  realPackage: string;
  distance: number;
  visuallyConfusable: boolean;
}

function isNpmLikePackageName(pkg: string): boolean {
  // Valid npm package names: lowercase, may contain -, _, ., start with a letter or @scope/
  // Reject specifiers that are clearly not npm packages
  if (pkg.startsWith('@')) {
    // Scoped: must be @scope/name where scope is >=2 chars
    return /^@[a-z][a-z0-9._-]+\/[a-z]/.test(pkg);
  }
  // Unscoped: must start with a letter or digit, only contain valid chars
  return /^[a-z0-9][a-z0-9._-]*$/.test(pkg);
}

function findTyposquatMatch(pkg: string, maxDistance: number): TyposquatMatch | null {
  // ── Guard: skip specifiers that can't be real npm packages ──

  // Too short — single/double char specifiers produce nonsense matches (e.g. "~" → "h3")
  if (pkg.length < 3) return null;

  // Contains path separator — subpath imports, not bare package names
  if (pkg.includes('/') && !pkg.startsWith('@')) return null;

  // Not shaped like an npm package name
  if (!isNpmLikePackageName(pkg)) return null;

  // Don't check scoped packages against unscoped (too many false positives)
  const isScoped = pkg.startsWith('@');
  let bestMatch: TyposquatMatch | null = null;

  for (const real of POPULAR_PACKAGES) {
    if (pkg === real) return null; // Exact match = not a typosquat

    const realIsScoped = real.startsWith('@');
    if (isScoped !== realIsScoped) continue;

    // Quick length filter
    if (Math.abs(pkg.length - real.length) > maxDistance) continue;

    const dist = damerauLevenshtein(pkg, real, maxDistance);
    const visual = isVisuallyConfusable(pkg, real);

    if (dist <= maxDistance || visual) {
      const effective = visual ? Math.min(dist, 1) : dist;
      if (!bestMatch || effective < bestMatch.distance) {
        bestMatch = {
          realPackage: real,
          distance: dist,
          visuallyConfusable: visual,
        };
      }
    }
  }

  return bestMatch;
}

// ─── Lockfile Analysis ──────────────────────────────────────────────────────

type LockfileType = 'npm' | 'yarn-classic' | 'yarn-berry' | 'pnpm' | 'bun';

interface LockfileInfo {
  type: LockfileType;
  path: string;
  packages: Set<string>;
  mtime: number;
}

function detectLockfileType(workspaceRoot: string): LockfileInfo | null {
  const checks: { file: string; type: LockfileType }[] = [
    { file: 'pnpm-lock.yaml', type: 'pnpm' },
    { file: 'bun.lockb', type: 'bun' },
    { file: 'yarn.lock', type: 'yarn-classic' },    // or berry — distinguished by content
    { file: 'package-lock.json', type: 'npm' },
  ];

  for (const { file, type } of checks) {
    const filePath = join(workspaceRoot, file);
    if (existsSync(filePath)) {
      try {
        const stat = statSync(filePath);
        return { type, path: filePath, packages: new Set(), mtime: stat.mtimeMs };
      } catch (err) {
        if (process.env.GUARDRAIL_DEBUG) {
          console.warn(`[phantom_dep] statSync failed for ${filePath}:`, err instanceof Error ? err.message : err);
        }
        continue;
      }
    }
  }
  return null;
}

/**
 * Extract package names from lockfiles.
 * Fast path: only reads the top-level keys, doesn't parse the full graph.
 */
function parseLockfilePackages(info: LockfileInfo): Set<string> {
  const packages = new Set<string>();

  try {
    const content = readFileSync(info.path, 'utf-8');

    switch (info.type) {
      case 'npm': {
        // package-lock.json: read packages object keys
        const lock = JSON.parse(content);
        const pkgs = (typeof lock === 'object' && lock !== null)
          ? (lock.packages ?? lock.dependencies ?? {})
          : {};
        if (typeof pkgs !== 'object' || pkgs === null) break;
        for (const key of Object.keys(pkgs)) {
          // Keys are like "node_modules/lodash" or "" (root)
          const name = key.replace(/^node_modules\//, '');
          if (name && !name.includes('node_modules/')) {
            packages.add(name);
          }
        }
        break;
      }

      case 'yarn-classic':
      case 'yarn-berry': {
        // yarn.lock: lines like `"lodash@^4.17.0":`  or  `lodash@^4.17.0:`
        const lineRe = /^"?(@?[^@\s"]+)@/gm;
        let m: RegExpExecArray | null;
        while ((m = lineRe.exec(content)) !== null) {
          const name = m[1]!;
          if (name && !name.startsWith('__')) packages.add(name);
        }
        break;
      }

      case 'pnpm': {
        // pnpm-lock.yaml: extract package names from multiple format variants.
        // pnpm v6–v8 use different lockfile formats:
        //   v6: '/lodash/4.17.21':
        //   v7+: '/lodash@4.17.21':
        //   v9+: 'lodash@4.17.21':  (no leading slash)
        //   Scoped: '/@babel/core@7.24.0':  or  /@babel/core/7.24.0:
        const lineRe = /^\s+\/?(@?[^@/\s:]+(?:\/[^@/\s:]+)?)[@/]\d/gm;
        let m: RegExpExecArray | null;
        while ((m = lineRe.exec(content)) !== null) {
          if (m[1]) packages.add(m[1]);
        }

        // Also check importers/dependencies sections (v9 format with deeper indentation)
        const depRe = /^\s{2,8}(@?[\w][\w./-]*?):\s/gm;
        while ((m = depRe.exec(content)) !== null) {
          const name = m[1]!;
          // Filter out YAML keys that aren't package names
          if (name && !name.startsWith('//') && name.includes('/') || /^@?[a-z]/.test(name)) {
            packages.add(name);
          }
        }
        break;
      }

      case 'bun': {
        // bun.lockb is binary — can't parse directly, fall through
        break;
      }
    }
  } catch {
    // Lockfile may be malformed or in transition
  }

  return packages;
}

// ─── Workspace Resolution ───────────────────────────────────────────────────

interface WorkspaceInfo {
  root: string;
  packageDirs: string[];
  allPackageNames: Set<string>;
  allDeps: Set<string>;
  lockfile: LockfileInfo | null;
  tsconfigAliases: Set<string>;
  /** Workspace protocol packages (workspace:*) */
  workspaceProtocol: Set<string>;
  /** Subpath import patterns from package.json "imports" field (e.g. "#db", "#utils/*") */
  packageJsonImports: Set<string>;
}

function resolveWorkspaceGlobs(root: string, globs: string[]): string[] {
  const dirs: string[] = [];
  for (const glob of globs) {
    // Simple glob expansion: "packages/*" → list dirs in packages/
    // "apps/**" → recursively list
    const clean = glob.replace(/\/?\*\*?$/, '');
    const base = join(root, clean);
    if (!existsSync(base)) continue;

    try {
      const entries = readdirSync(base, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules') {
          const pkgPath = join(base, entry.name, 'package.json');
          if (existsSync(pkgPath)) {
            dirs.push(join(base, entry.name));
          }
        }
      }
    } catch { /* skip */ }
  }
  return dirs;
}

function loadWorkspaceInfo(root: string): WorkspaceInfo {
  const info: WorkspaceInfo = {
    root,
    packageDirs: [],
    allPackageNames: new Set(),
    allDeps: new Set(),
    lockfile: null,
    tsconfigAliases: new Set(),
    workspaceProtocol: new Set(),
    packageJsonImports: new Set(),
  };

  // 1. Detect workspace config from root package.json
  const rootPkgPath = join(root, 'package.json');
  if (existsSync(rootPkgPath)) {
    try {
      const rootPkg = JSON.parse(readFileSync(rootPkgPath, 'utf-8'));

      // npm/yarn workspaces
      const workspaces = rootPkg.workspaces;
      const globs = Array.isArray(workspaces)
        ? workspaces
        : Array.isArray(workspaces?.packages)
          ? workspaces.packages
          : null;

      if (globs) {
        info.packageDirs = resolveWorkspaceGlobs(root, globs);
      }

      // Root deps
      collectDeps(rootPkg, info.allDeps, info.workspaceProtocol);

      // Root package.json "imports" field (Node.js subpath imports)
      collectPackageJsonImports(rootPkg, info.packageJsonImports);
    } catch { /* skip */ }
  }

  // 2. Check pnpm-workspace.yaml
  const pnpmWs = join(root, 'pnpm-workspace.yaml');
  if (existsSync(pnpmWs) && info.packageDirs.length === 0) {
    try {
      const content = readFileSync(pnpmWs, 'utf-8');
      // Simple YAML list extraction
      const globs: string[] = [];
      const re = /^\s*-\s+['"]?([^'"#\n]+)/gm;
      let m: RegExpExecArray | null;
      while ((m = re.exec(content)) !== null) {
        globs.push(m[1]!.trim());
      }
      info.packageDirs = resolveWorkspaceGlobs(root, globs);
    } catch { /* skip */ }
  }

  // 3. Fallback: check common dirs
  if (info.packageDirs.length === 0) {
    for (const subdir of ['packages', 'apps', 'libs', 'modules', 'services', 'tools']) {
      const dir = join(root, subdir);
      if (existsSync(dir)) {
        try {
          for (const entry of readdirSync(dir, { withFileTypes: true })) {
            if (entry.isDirectory() && existsSync(join(dir, entry.name, 'package.json'))) {
              info.packageDirs.push(join(dir, entry.name));
            }
          }
        } catch { /* skip */ }
      }
    }
  }

  // 4. Collect workspace package names and their deps
  for (const dir of info.packageDirs) {
    const pkgPath = join(dir, 'package.json');
    try {
      const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));
      if (pkg.name) info.allPackageNames.add(pkg.name);
      collectDeps(pkg, info.allDeps, info.workspaceProtocol);
      collectPackageJsonImports(pkg, info.packageJsonImports);
    } catch { /* skip */ }
  }

  // 5. Lockfile
  info.lockfile = detectLockfileType(root);
  if (info.lockfile) {
    const lockPkgs = parseLockfilePackages(info.lockfile);
    lockPkgs.forEach(p => info.allDeps.add(p));
    info.lockfile.packages = lockPkgs;
  }

  // 6. TSConfig aliases
  info.tsconfigAliases = loadTsconfigPaths(root);

  return info;
}

function collectDeps(pkg: Record<string, any>, deps: Set<string>, wsProtocol: Set<string>): void {
  for (const section of ['dependencies', 'devDependencies', 'peerDependencies', 'optionalDependencies']) {
    const sectionDeps = pkg[section];
    if (!sectionDeps || typeof sectionDeps !== 'object') continue;
    for (const [name, version] of Object.entries(sectionDeps)) {
      deps.add(name);
      if (typeof version === 'string' && version.startsWith('workspace:')) {
        wsProtocol.add(name);
      }
    }
  }
}

/**
 * Collect subpath import patterns from package.json "imports" field.
 * These are bare specifiers starting with # that map to local files.
 * e.g. { "#db": "./src/db.ts", "#utils/*": "./src/utils/*" }
 */
function collectPackageJsonImports(pkg: Record<string, any>, imports: Set<string>): void {
  const importsField = pkg.imports;
  if (!importsField || typeof importsField !== 'object') return;
  for (const key of Object.keys(importsField)) {
    // Strip trailing /* glob, store the prefix
    const alias = key.replace(/\/?\*$/, '');
    if (alias) imports.add(alias);
  }
}

function loadTsconfigPaths(root: string, visited: Set<string> = new Set()): Set<string> {
  const aliases = new Set<string>();

  // Check tsconfig.json, then tsconfig.base.json, then jsconfig.json
  for (const file of ['tsconfig.json', 'tsconfig.base.json', 'jsconfig.json']) {
    const filePath = join(root, file);
    if (!existsSync(filePath)) continue;

    // Cycle detection: resolve to absolute path and check if already visited
    const resolvedPath = resolve(filePath);
    if (visited.has(resolvedPath)) break;
    visited.add(resolvedPath);

    try {
      let content = readFileSync(filePath, 'utf-8');
      // Strip comments (JSON5-ish)
      content = content.replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
      // Strip trailing commas
      content = content.replace(/,\s*([\]}])/g, '$1');

      const config = JSON.parse(content);

      // Direct paths
      const paths = config.compilerOptions?.paths ?? {};
      for (const pattern of Object.keys(paths)) {
        // '@/components/*' → '@/'
        // '@guardrail/*' → '@guardrail/'
        const alias = pattern.replace(/\/?\*$/, '');
        if (alias) aliases.add(alias);
      }

      // Check if extends another config (with cycle-safe recursion)
      if (config.extends) {
        const extPath = resolve(root, config.extends);
        if (existsSync(extPath)) {
          const extAliases = loadTsconfigPaths(dirname(extPath), visited);
          extAliases.forEach(a => aliases.add(a));
        }
      }
    } catch { /* skip */ }

    break; // Use first found config
  }

  return aliases;
}

// ─── Registry Client ────────────────────────────────────────────────────────

interface RegistryResult {
  exists: boolean;
  checkedAt: number;
  fromCache: boolean;
}

class RegistryClient {
  private readonly _cache: LRUCache<boolean>;
  private readonly _inflightRequests = new Map<string, Promise<boolean>>();
  private readonly _queue: string[] = [];
  private _activeRequests = 0;
  private _persistTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(private readonly _config: EngineConfig) {
    this._cache = new LRUCache<boolean>(4096, _config.registryCacheTtlMs);
    if (this._config.registryCachePath) {
      this._loadFromDisk();
    }
  }

  private _loadFromDisk(): void {
    const p = this._config.registryCachePath!;
    if (!existsSync(p)) return;
    try {
      const raw = readFileSync(p, 'utf-8');
      const data = JSON.parse(raw) as Record<string, { exists: boolean; expiresAt: number }>;
      const now = Date.now();
      for (const [pkg, entry] of Object.entries(data)) {
        if (entry.expiresAt > now) {
          const ttl = entry.expiresAt - now;
          this._cache.set(pkg, entry.exists, ttl);
        }
      }
    } catch {
      /* ignore corrupt or missing cache */
    }
  }

  private _schedulePersist(): void {
    if (!this._config.registryCachePath) return;
    if (this._persistTimer) return;
    this._persistTimer = setTimeout(() => {
      this._persistTimer = null;
      this._persistToDisk();
    }, 500);
  }

  private _persistToDisk(): void {
    const p = this._config.registryCachePath!;
    try {
      const entries = this._cache.entries();
      const data: Record<string, { exists: boolean; expiresAt: number }> = {};
      for (const [k, e] of entries) {
        data[k] = { exists: e.value, expiresAt: e.expiresAt };
      }
      const dir = dirname(p);
      if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
      writeFileSync(p, JSON.stringify(data), 'utf-8');
    } catch {
      /* ignore write errors */
    }
  }

  /** Wait for all in-flight registry requests and queue to drain. */
  async waitForIdle(): Promise<void> {
    while (this._queue.length > 0 || this._inflightRequests.size > 0) {
      const promises = Array.from(this._inflightRequests.values());
      if (promises.length > 0) {
        await Promise.all(promises);
      } else {
        await new Promise((r) => setTimeout(r, 5));
      }
    }
  }

  /** Flush pending persist immediately (e.g. on engine dispose). */
  flushPersist(): void {
    if (this._persistTimer) {
      clearTimeout(this._persistTimer);
      this._persistTimer = null;
    }
    if (this._config.registryCachePath) this._persistToDisk();
  }

  /**
   * Check if a package exists on the registry.
   * Returns immediately if cached; otherwise queues an async check.
   */
  check(pkg: string): RegistryResult | null {
    const cached = this._cache.get(pkg);
    if (cached !== undefined) {
      return { exists: cached, checkedAt: Date.now(), fromCache: true };
    }
    this._enqueue(pkg);
    return null; // Result will be available next scan
  }

  /**
   * Await a definitive answer for a specific package.
   */
  async checkAsync(pkg: string): Promise<RegistryResult> {
    const cached = this._cache.get(pkg);
    if (cached !== undefined) {
      return { exists: cached, checkedAt: Date.now(), fromCache: true };
    }

    const exists = await this._fetchSingle(pkg);
    return { exists, checkedAt: Date.now(), fromCache: false };
  }

  /**
   * Batch check — resolves when all packages are checked.
   * Deduplicates concurrent requests for the same package via _inflightRequests.
   */
  async batchCheck(packages: string[]): Promise<Map<string, boolean>> {
    const results = new Map<string, boolean>();
    const uncached: string[] = [];

    for (const pkg of packages) {
      const cached = this._cache.get(pkg);
      if (cached !== undefined) {
        results.set(pkg, cached);
      } else if (this._inflightRequests.has(pkg)) {
        const exists = await this._inflightRequests.get(pkg)!;
        results.set(pkg, exists);
      } else {
        uncached.push(pkg);
      }
    }

    if (uncached.length === 0) return results;

    // Process in concurrency-limited batches; register inflight before fetch to prevent duplicate requests
    const batches: string[][] = [];
    for (let i = 0; i < uncached.length; i += this._config.registryConcurrency) {
      batches.push(uncached.slice(i, i + this._config.registryConcurrency));
    }

    for (const batch of batches) {
      const batchResults = await Promise.allSettled(
        batch.map(async pkg => {
          const promise = this._fetchSingle(pkg).finally(() => {
            this._inflightRequests.delete(pkg);
          });
          this._inflightRequests.set(pkg, promise);
          const exists = await promise;
          return { pkg, exists };
        }),
      );

      for (const result of batchResults) {
        if (result.status === 'fulfilled') {
          results.set(result.value.pkg, result.value.exists);
        }
      }
    }

    return results;
  }

  private _enqueue(pkg: string): void {
    if (this._inflightRequests.has(pkg)) return;
    this._queue.push(pkg);
    this._processQueue();
  }

  private _processQueue(): void {
    while (this._queue.length > 0 && this._activeRequests < this._config.registryConcurrency) {
      const pkg = this._queue.shift()!;
      if (this._cache.has(pkg) || this._inflightRequests.has(pkg)) continue;

      this._activeRequests++;
      const promise = this._fetchSingle(pkg).finally(() => {
        this._activeRequests--;
        this._inflightRequests.delete(pkg);
        this._processQueue();
      });
      this._inflightRequests.set(pkg, promise);
    }
  }

  private async _fetchSingle(pkg: string): Promise<boolean> {
    const registries = ['https://registry.npmjs.org', ...this._config.customRegistries];

    for (const registry of registries) {
      try {
        const exists = await this._fetchWithRetry(pkg, registry);
        const ttl = exists ? this._config.registryCacheTtlMs : this._config.registryNegativeTtlMs;
        this._cache.set(pkg, exists, ttl);
        this._schedulePersist();
        return exists;
      } catch {
        // Network failure — assume exists to avoid false positives
        this._cache.set(pkg, true, 60_000); // Short TTL for network errors
        this._schedulePersist();
        return true;
      }
    }

    return true; // Fail-safe
  }

  private async _fetchWithRetry(pkg: string, registry: string): Promise<boolean> {
    const maxRetries = 3;
    const baseDelay = 1000; // 1 second base delay
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const url = `${registry}/${pkg.startsWith('@') ? pkg : encodeURIComponent(pkg)}`;
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), this._config.registryTimeoutMs);

        const response = await fetch(url, {
          method: 'HEAD',
          signal: controller.signal,
          headers: { Accept: 'application/vnd.npm.install-v1+json' },
        });

        clearTimeout(timer);
        return response.status === 200;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        
        // Don't retry on abort (timeout) or 4xx errors
        if (lastError.name === 'AbortError' || 
            (lastError instanceof TypeError && lastError.message.includes('fetch'))) {
          throw lastError;
        }

        // If this is the last attempt, throw the error
        if (attempt === maxRetries) {
          throw lastError;
        }

        // Exponential backoff with jitter
        const delay = baseDelay * Math.pow(2, attempt - 1) + Math.random() * 500;
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    // Should never reach here, but TypeScript needs this
    throw lastError || new Error('Max retries exceeded');
  }

  get cacheSize(): number {
    return this._cache.size;
  }

  clearCache(): void {
    this._cache.clear();
  }
}

// ─── Confidence Scoring ─────────────────────────────────────────────────────

interface ScoringContext {
  pkg: string;
  import: ExtractedImport;
  inKnownFakeList: boolean;
  inMaliciousList: boolean;
  inPackageJson: boolean;
  inNodeModules: boolean;
  inLockfile: boolean;
  registryExists: boolean | null; // null = unchecked
  typosquatMatch: TyposquatMatch | null;
  isScopedPackage: boolean;
  hasPrivateScope: boolean;
}

function computeConfidence(ctx: ScoringContext): { score: number; signals: ConfidenceSignal[] } {
  const signals: ConfidenceSignal[] = [];
  let score = 0;

  // ── Positive evidence (package IS phantom) ──

  if (ctx.inKnownFakeList) {
    signals.push({ source: 'known_fake_list', weight: 0.50, detail: 'Package is in the known-hallucinated-packages database' });
    score += 0.50;
  }

  if (ctx.inMaliciousList) {
    signals.push({ source: 'known_malicious', weight: 0.55, detail: 'Package is in the known-malicious-packages database' });
    score += 0.55;
  }

  if (ctx.registryExists === false) {
    signals.push({ source: 'registry_404', weight: 0.45, detail: 'npm registry returned 404 — package not found' });
    score += 0.45;
  }

  if (ctx.typosquatMatch) {
    const typoWeight = ctx.typosquatMatch.visuallyConfusable ? 0.30 : 0.20;
    signals.push({
      source: 'typosquat',
      weight: typoWeight,
      detail: `Edit distance ${ctx.typosquatMatch.distance} from "${ctx.typosquatMatch.realPackage}"${ctx.typosquatMatch.visuallyConfusable ? ' (visually confusable)' : ''}`,
    });
    score += typoWeight;
  }

  if (!ctx.inPackageJson) {
    signals.push({ source: 'not_in_package_json', weight: 0.15, detail: 'Not declared in any package.json' });
    score += 0.15;
  }

  if (!ctx.inNodeModules) {
    signals.push({ source: 'not_in_node_modules', weight: 0.10, detail: 'Not found in node_modules' });
    score += 0.10;
  }

  if (!ctx.inLockfile) {
    signals.push({ source: 'not_in_lockfile', weight: 0.10, detail: 'Not present in lockfile' });
    score += 0.10;
  }

  // ── Negative evidence (package is probably real) ──

  if (ctx.inPackageJson) {
    signals.push({ source: 'in_package_json', weight: -0.40, detail: 'Declared in package.json' });
    score -= 0.40;
  }

  if (ctx.inNodeModules) {
    signals.push({ source: 'in_node_modules', weight: -0.35, detail: 'Found in node_modules' });
    score -= 0.35;
  }

  if (ctx.inLockfile) {
    signals.push({ source: 'in_lockfile', weight: -0.30, detail: 'Present in lockfile' });
    score -= 0.30;
  }

  if (ctx.registryExists === true && !ctx.inKnownFakeList && !ctx.inMaliciousList) {
    signals.push({ source: 'registry_200', weight: -0.45, detail: 'npm registry confirms package exists' });
    score -= 0.45;
  }

  // Clamp
  return { score: Math.max(0, Math.min(1, score)), signals };
}

function classifyCategory(ctx: ScoringContext): DetectionCategory {
  if (ctx.inMaliciousList) return 'known_malicious';
  if (ctx.typosquatMatch && ctx.registryExists === false) return 'typosquat';
  if (ctx.isScopedPackage && ctx.hasPrivateScope && ctx.registryExists === true) return 'dep_confusion';
  if (ctx.registryExists === true && !ctx.inPackageJson) return 'undeclared_dep';
  return 'phantom_dep';
}

function classifySeverity(category: DetectionCategory, confidence: number): PhantomSeverity {
  if (category === 'known_malicious') return 'critical';
  if (category === 'phantom_dep' && confidence >= 0.90) return 'critical';
  if (category === 'typosquat') return 'high';
  if (category === 'dep_confusion') return 'high';
  if (category === 'phantom_dep' && confidence >= 0.75) return 'high';
  if (category === 'undeclared_dep') return 'medium';
  return 'low';
}

function ruleIdFor(category: DetectionCategory): string {
  switch (category) {
    case 'phantom_dep':       return 'PHANTOM-001';
    case 'typosquat':         return 'TYPO-001';
    case 'dep_confusion':     return 'DEPCONF-001';
    case 'known_malicious':   return 'MALWARE-001';
    case 'undeclared_dep':    return 'UNDECL-001';
    case 'hallucinated_api':  return 'HALAPI-001';
    default:                  return 'UNKNOWN-001';
  }
}

function messageFor(category: DetectionCategory, pkg: string, typoMatch?: TyposquatMatch): string {
  switch (category) {
    case 'phantom_dep':
      return `\`${pkg}\` is a hallucinated package — does not exist on npm. Likely invented by an AI coding assistant.`;
    case 'typosquat':
      return `\`${pkg}\` appears to be a typosquat of \`${typoMatch?.realPackage}\` (edit distance: ${typoMatch?.distance}). Did you mean \`${typoMatch?.realPackage}\`?`;
    case 'dep_confusion':
      return `\`${pkg}\` uses a private scope but a package with this name exists on the public npm registry. Potential dependency confusion attack vector.`;
    case 'known_malicious':
      return `\`${pkg}\` is a known malicious package. Remove it immediately and audit your lockfile for compromised versions.`;
    case 'undeclared_dep':
      return `\`${pkg}\` exists on npm but is not declared in package.json. This import relies on phantom hoisting and will break in strict package managers (pnpm).`;
    case 'hallucinated_api':
      return `\`${pkg}\` exists but the imported API does not match its exports. The import may have been hallucinated by an AI coding assistant.`;
    default:
      return `\`${pkg}\` — unclassified dependency issue.`;
  }
}

function suggestionFor(category: DetectionCategory, pkg: string, typoMatch?: TyposquatMatch): string {
  switch (category) {
    case 'phantom_dep':
      return `Verify this package exists at https://www.npmjs.com/package/${pkg}. This name is commonly hallucinated by AI tools — search npm for the real equivalent.`;
    case 'typosquat':
      return `Replace with the correct package: \`${typoMatch?.realPackage}\`. Run: npm install ${typoMatch?.realPackage}`;
    case 'dep_confusion':
      return `Configure your .npmrc to scope this package to your private registry. Add: @${pkg.split('/')[0]?.slice(1)}:registry=https://your-private-registry.com`;
    case 'known_malicious':
      return `Run: npm uninstall ${pkg} && npm audit. Check https://socket.dev/npm/package/${pkg} for the security advisory.`;
    case 'undeclared_dep':
      return `Add to package.json: npm install ${pkg}. Undeclared deps fail in pnpm/yarn PnP strict mode.`;
    case 'hallucinated_api':
      return `Check the package README for correct import syntax: https://www.npmjs.com/package/${pkg}`;
    default:
      return `Review this dependency.`;
  }
}

// ─── Engine ─────────────────────────────────────────────────────────────────

export class PhantomDepEngine {
  readonly id = 'phantom_dep';

  private _config: EngineConfig;
  private _workspace: WorkspaceInfo | null = null;
  private _registry: RegistryClient;
  private _fsCache: LRUCache<Set<string>>;
  private _watchedFiles = new Set<string>();
  private _stats: EngineStats = {
    scansCompleted: 0,
    findingsTotal: 0,
    cacheHitRate: 0,
    avgScanMs: 0,
    registryChecks: 0,
    registryCacheSize: 0,
  };
  private _eventEmitter = new EventEmitter();
  private _cacheHits = 0;
  private _cacheMisses = 0;
  private _scanTimesMs: number[] = [];

  constructor(
    private _workspaceRoot: string,
    configOrThreshold: Partial<EngineConfig> | number = {},
  ) {
    const config: Partial<EngineConfig> =
      typeof configOrThreshold === 'number'
        ? { confidenceThreshold: configOrThreshold }
        : configOrThreshold;
    this._config = { ...DEFAULT_CONFIG, ...config };
    this._registry = new RegistryClient(this._config);
    this._fsCache = new LRUCache<Set<string>>(512, this._config.fsCacheTtlMs);
    this._loadWorkspace();
  }

  // ── Public API ──

  /**
   * Scan for phantom dependencies with standardized error handling
   */
  async scan(delta: DeltaContext, signal: AbortSignal): Promise<Finding[]> {
    return withEngineErrorHandling(
      () => this._scanInternal(delta, signal),
      createContext(this.id, delta.documentUri)
    );
  }

  private async _scanInternal(delta: DeltaContext, signal: AbortSignal): Promise<Finding[]> {
    if (signal?.aborted) return [];

    const startMs = performance.now();
    const fileUri = delta.documentUri;
    const filePath = fileUri.replace(/^file:\/\//, '');

    this._eventEmitter.emit('scan:start', { fileUri });

    const imports = extractImports(delta.fullText);
    const findings: PhantomFinding[] = [];

    // Load file-local deps (package.json closest to this file)
    const localDeps = this._loadFileDeps(filePath);

    for (const imp of imports) {
      if (signal?.aborted) break;

      const pkg = imp.packageName;

      // ── Fast-path safe checks ──
      if (PROVIDED_MODULES.has(pkg)) continue;
      if (pkg.startsWith('@types/')) continue;
      if (this._config.additionalSafePackages.includes(pkg)) continue;

      // Check tsconfig aliases
      if (this._isAlias(pkg)) continue;

      // Check all dep sources
      const inPackageJson = localDeps.has(pkg) || (this._workspace?.allDeps.has(pkg) ?? false);
      const inWorkspace = this._workspace?.allPackageNames.has(pkg) ?? false;
      const inLockfile = this._workspace?.lockfile?.packages.has(pkg) ?? false;
      const inNodeModules = this._checkNodeModules(pkg);

      if (inPackageJson || inWorkspace) continue;
      if (inLockfile && inNodeModules) continue;

      // ── Detection layers ──

      const inKnownFakeList = KNOWN_FAKE_PACKAGES.has(pkg);
      const inMaliciousList = KNOWN_MALICIOUS_PACKAGES.has(pkg);

      // Registry check (may return null if uncached)
      const registryResult = this._registry.check(pkg);
      const registryExists = registryResult?.exists ?? null;

      // Typosquat detection
      const typosquatMatch = this._config.enableTyposquatDetection
        ? findTyposquatMatch(pkg, this._config.typosquatMaxDistance)
        : null;

      // Build scoring context
      const scoringCtx: ScoringContext = {
        pkg,
        import: imp,
        inKnownFakeList,
        inMaliciousList,
        inPackageJson,
        inNodeModules,
        inLockfile,
        registryExists,
        typosquatMatch,
        isScopedPackage: pkg.startsWith('@'),
        hasPrivateScope: false, // TODO: detect from .npmrc / org config
      };

      // Compute confidence
      const { score: confidence, signals } = computeConfidence(scoringCtx);

      if (confidence < this._config.confidenceThreshold) continue;

      // Classify
      const category = classifyCategory(scoringCtx);
      const severity = classifySeverity(category, confidence);

      const finding: PhantomFinding = {
        id: deterministicId(fileUri, imp.line, imp.column, category, pkg),
        engine: 'phantom_dep',
        severity,
        category,
        file: fileUri,
        line: imp.line,
        column: imp.column,
        message: messageFor(category, pkg, typosquatMatch ?? undefined),
        evidence: imp.code,
        suggestion: suggestionFor(category, pkg, typosquatMatch ?? undefined),
        confidence,
        autoFixable: category === 'typosquat' || category === 'undeclared_dep',
        ruleId: ruleIdFor(category),
        signals,
        similarTo: typosquatMatch?.realPackage,
        editDistance: typosquatMatch?.distance,
      };

      findings.push(finding);
      this._eventEmitter.emit('finding', finding);
    }

    const durationMs = performance.now() - startMs;
    this._recordScan(findings.length, durationMs);
    this._eventEmitter.emit('scan:complete', { fileUri, findingsCount: findings.length, durationMs });

    return findings;
  }

  /**
   * Deep async scan — waits for all registry checks to resolve.
   * Use for CI/CD pipelines where latency is acceptable.
   */
  async deepScan(delta: DeltaContext, signal?: AbortSignal): Promise<PhantomFinding[]> {
    if (signal?.aborted) return [];

    const startMs = performance.now();
    const fileUri = delta.documentUri;
    const filePath = fileUri.replace(/^file:\/\//, '');

    this._eventEmitter.emit('scan:start', { fileUri });

    const imports = extractImports(delta.fullText);
    const findings: PhantomFinding[] = [];

    const localDeps = this._loadFileDeps(filePath);

    // Collect packages that need registry verification
    const toCheck: ExtractedImport[] = [];

    for (const imp of imports) {
      const pkg = imp.packageName;
      if (PROVIDED_MODULES.has(pkg) || pkg.startsWith('@types/')) continue;
      if (this._config.additionalSafePackages.includes(pkg)) continue;
      if (this._isAlias(pkg)) continue;

      const inPackageJson = localDeps.has(pkg) || (this._workspace?.allDeps.has(pkg) ?? false);
      const inWorkspace = this._workspace?.allPackageNames.has(pkg) ?? false;

      if (inPackageJson || inWorkspace) continue;

      toCheck.push(imp);
    }

    // Batch registry check
    const registryResults = await this._registry.batchCheck(
      toCheck.map(i => i.packageName),
    );

    for (const imp of toCheck) {
      if (signal?.aborted) break;

      const pkg = imp.packageName;
      const inNodeModules = this._checkNodeModules(pkg);
      const inLockfile = this._workspace?.lockfile?.packages.has(pkg) ?? false;
      const registryExists = registryResults.get(pkg) ?? null;
      const inKnownFakeList = KNOWN_FAKE_PACKAGES.has(pkg);
      const inMaliciousList = KNOWN_MALICIOUS_PACKAGES.has(pkg);

      const typosquatMatch = this._config.enableTyposquatDetection
        ? findTyposquatMatch(pkg, this._config.typosquatMaxDistance)
        : null;

      const scoringCtx: ScoringContext = {
        pkg,
        import: imp,
        inKnownFakeList,
        inMaliciousList,
        inPackageJson: false,
        inNodeModules,
        inLockfile,
        registryExists,
        typosquatMatch,
        isScopedPackage: pkg.startsWith('@'),
        hasPrivateScope: false,
      };

      const { score: confidence, signals } = computeConfidence(scoringCtx);
      if (confidence < this._config.confidenceThreshold) continue;

      const category = classifyCategory(scoringCtx);
      const severity = classifySeverity(category, confidence);

      const finding: PhantomFinding = {
        id: deterministicId(fileUri, imp.line, imp.column, category, pkg),
        engine: 'phantom_dep',
        severity,
        category,
        file: fileUri,
        line: imp.line,
        column: imp.column,
        message: messageFor(category, pkg, typosquatMatch ?? undefined),
        evidence: imp.code,
        suggestion: suggestionFor(category, pkg, typosquatMatch ?? undefined),
        confidence,
        autoFixable: category === 'typosquat' || category === 'undeclared_dep',
        ruleId: ruleIdFor(category),
        signals,
        similarTo: typosquatMatch?.realPackage,
        editDistance: typosquatMatch?.distance,
      };

      findings.push(finding);
      this._eventEmitter.emit('finding', finding);
    }

    const durationMs = performance.now() - startMs;
    this._recordScan(findings.length, durationMs);
    this._eventEmitter.emit('scan:complete', { fileUri, findingsCount: findings.length, durationMs });

    return findings;
  }

  /** Refresh all caches and re-read workspace info */
  refresh(): void {
    this._fsCache.clear();
    this._loadWorkspace();
    this._eventEmitter.emit('cache:invalidate', { reason: 'manual refresh' });
  }

  /** Update engine configuration at runtime */
  updateConfig(config: Partial<EngineConfig>): void {
    this._config = { ...this._config, ...config };
    if (config.registryConcurrency || config.registryTimeoutMs || config.customRegistries) {
      this._registry = new RegistryClient(this._config);
    }
  }

  /** Get engine performance stats */
  getStats(): EngineStats {
    return {
      ...this._stats,
      cacheHitRate: this._cacheHits + this._cacheMisses > 0
        ? this._cacheHits / (this._cacheHits + this._cacheMisses)
        : 0,
      avgScanMs: this._scanTimesMs.length > 0
        ? this._scanTimesMs.reduce((a, b) => a + b, 0) / this._scanTimesMs.length
        : 0,
      registryCacheSize: this._registry.cacheSize,
    };
  }

  /** Cleanup watchers and caches */
  async prepareDispose(): Promise<void> {
    await this._registry.waitForIdle();
    this._registry.flushPersist();
  }

  dispose(): void {
    this._registry.flushPersist();
    for (const file of this._watchedFiles) {
      try { unwatchFile(file); } catch { /* ignore */ }
    }
    this._watchedFiles.clear();
    this._fsCache.clear();
    this._registry.clearCache();
    this._eventEmitter.removeAllListeners();
  }

  // ── Private ──

  private _loadWorkspace(): void {
    this._workspace = loadWorkspaceInfo(this._workspaceRoot);

    if (this._config.enableFileWatchers) {
      this._setupFileWatchers();
    }
  }

  private _setupFileWatchers(): void {
    // Watch root package.json
    const rootPkg = join(this._workspaceRoot, 'package.json');
    if (existsSync(rootPkg)) {
      this._watch(rootPkg);
    }

    // Watch lockfiles
    if (this._workspace?.lockfile) {
      this._watch(this._workspace.lockfile.path);
    }

    // Watch workspace package.jsons
    for (const dir of this._workspace?.packageDirs ?? []) {
      const pkgPath = join(dir, 'package.json');
      if (existsSync(pkgPath)) {
        this._watch(pkgPath);
      }
    }
  }

  private _watch(filePath: string): void {
    if (this._watchedFiles.has(filePath)) return;
    this._watchedFiles.add(filePath);
    watchFile(filePath, { interval: 5000 }, () => {
      this._fsCache.clear();
      this._loadWorkspace();
      this._emit({ type: 'cache:invalidate', reason: `${filePath} changed` });
    });
  }

  private _loadFileDeps(filePath: string): Set<string> {
    // Walk up from the file to find the closest package.json
    let dir = dirname(filePath);
    for (let depth = 0; depth < 10; depth++) {
      const pkgPath = join(dir, 'package.json');
      const cacheKey = `deps:${pkgPath}`;
      const cached = this._fsCache.get(cacheKey);
      if (cached) {
        this._cacheHits++;
        return cached;
      }

      if (existsSync(pkgPath)) {
        this._cacheMisses++;
        const deps = new Set<string>();
        try {
          const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));
          collectDeps(pkg, deps, new Set());
        } catch (err) {
          if (process.env.GUARDRAIL_DEBUG) {
            console.warn(`[phantom_dep] readFileSync package.json failed for ${pkgPath}:`, err instanceof Error ? err.message : err);
          }
        }
        this._fsCache.set(cacheKey, deps);
        return deps;
      }

      const parent = dirname(dir);
      if (parent === dir) break;
      dir = parent;
    }

    return new Set();
  }

  private _checkNodeModules(pkg: string): boolean {
    const cacheKey = `nm:${pkg}`;
    const cached = this._fsCache.get(cacheKey);
    if (cached !== undefined) {
      this._cacheHits++;
      return cached.size > 0;
    }

    this._cacheMisses++;
    let dir = this._workspaceRoot;
    for (let depth = 0; depth < 6; depth++) {
      if (existsSync(join(dir, 'node_modules', pkg))) {
        this._fsCache.set(cacheKey, new Set(['found']));
        return true;
      }
      const parent = dirname(dir);
      if (parent === dir) break;
      dir = parent;
    }

    this._fsCache.set(cacheKey, new Set());
    return false;
  }

  private _isAlias(pkg: string): boolean {
    if (!this._workspace) return false;

    // Check tsconfig paths (e.g. "@components", "@utils/")
    for (const alias of this._workspace.tsconfigAliases) {
      if (pkg === alias || pkg.startsWith(alias + '/') || pkg.startsWith(alias)) return true;
    }

    // Check package.json "imports" field (e.g. "#db", "#utils/helpers")
    for (const imp of this._workspace.packageJsonImports) {
      if (pkg === imp || pkg.startsWith(imp + '/')) return true;
    }

    // Check workspace protocol
    if (this._workspace.workspaceProtocol.has(pkg)) return true;

    // ── Workspace package name check ──
    // Scoped packages like @shared/schema, @platform/shared-types may be workspace
    // packages. Check allPackageNames (populated from workspace package.json "name" fields).
    if (this._workspace.allPackageNames.has(pkg)) return true;

    // ── Monorepo directory alias detection ──
    // Bare specifiers like "test/utils", "shared/config" that resolve to local directories.
    // Extract the root segment (e.g. "test" from "test/utils") and check:
    // 1. Is it a common monorepo directory name? (fast check from static set)
    // 2. Does that directory actually exist at the workspace root? (FS check)
    const rootSegment = pkg.includes('/') && !pkg.startsWith('@')
      ? pkg.split('/')[0]!
      : pkg;

    if (MONOREPO_DIR_ALIASES.has(rootSegment)) {
      // Verify the directory actually exists to avoid masking real npm packages.
      // Check workspace root AND all known workspace package directories.
      try {
        const dirPath = join(this._workspaceRoot, rootSegment);
        if (existsSync(dirPath) && statSync(dirPath).isDirectory()) return true;
      } catch { /* skip */ }

      // Also check inside workspace sub-packages (e.g. packages/foo/test/)
      if (this._workspace) {
        for (const pkgDir of this._workspace.packageDirs) {
          try {
            const subDirPath = join(pkgDir, rootSegment);
            if (existsSync(subDirPath) && statSync(subDirPath).isDirectory()) return true;
          } catch { /* skip */ }
        }
      }
    }

    // ── Scoped package scope-match ──
    // If the scope of a scoped package matches ANY workspace package's scope,
    // it's likely a workspace package that just wasn't declared as a dep.
    // e.g. @shared/schema when @shared/types is a known workspace package.
    if (pkg.startsWith('@')) {
      const scope = pkg.split('/')[0]!; // "@shared"
      for (const wsName of this._workspace.allPackageNames) {
        if (wsName.startsWith(scope + '/')) return true;
      }
    }

    return false;
  }

  private _emit(event: EngineEvent): void {
    this._eventEmitter.emit(event.type, event);
  }

  private _recordScan(findings: number, durationMs: number): void {
    this._stats.scansCompleted++;
    this._stats.findingsTotal += findings;
    this._scanTimesMs.push(durationMs);
    // Keep only last 100 timings for rolling average
    if (this._scanTimesMs.length > 100) {
      this._scanTimesMs = this._scanTimesMs.slice(-100);
    }
  }
}

// ─── Exports for Testing ────────────────────────────────────────────────────

export const _internals = {
  extractImports,
  extractPackageName,
  isRelativeOrAlias,
  isNpmLikePackageName,
  damerauLevenshtein,
  findTyposquatMatch,
  isVisuallyConfusable,
  computeConfidence,
  classifyCategory,
  parseLockfilePackages,
  loadWorkspaceInfo,
  collectPackageJsonImports,
  KNOWN_FAKE_PACKAGES,
  KNOWN_MALICIOUS_PACKAGES,
  POPULAR_PACKAGES,
  MONOREPO_DIR_ALIASES,
};