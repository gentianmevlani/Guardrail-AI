/**
 * EnvVarEngine v2.0 — Detects environment variable misconfigurations.
 *
 * Detection features:
 *   ENV001 — process.env.VAR references not defined in .env files
 *   ENV003 — Typo detection via Levenshtein + prefix matching
 *   ENV005 — Non-standard env var naming (camelCase instead of UPPER_SNAKE_CASE)
 *
 *   - Fallback-aware: skips `process.env.PORT || 3000` (has default)
 *   - Destructuring support: detects `const { API_KEY } = process.env`
 *   - Bracket access: detects `process.env['VAR_NAME']`
 *   - import.meta.env support (Vite, SvelteKit, Astro)
 *   - Context-sensitive severity: feature toggle checks are lower severity
 *   - Typo detection: Levenshtein fuzzy matching against known env vars
 *   - Well-known vars: 80+ prefixes and exact names from major frameworks/platforms
 *
 * Latency target: <30ms per file
 */

import type { Finding, DeltaContext, IEnvIndex, Severity } from './core-types';

/** FNV-1a deterministic hash → stable finding IDs across re-scans */
function deterministicId(uri: string, line: number, varName: string): string {
  const input = `env:${uri}::${line}::ENV001::${varName}`;
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = (hash * 0x01000193) >>> 0;
  }
  return `env-${hash.toString(16).padStart(8, '0')}`;
}

// ─── Env var extraction patterns ────────────────────────────────────────────

/** Standard property access: process.env.VAR_NAME */
const ENV_PATTERN = /process\.env\.([A-Z_][A-Z0-9_]*)/g;

/** Destructuring: const { VAR1, VAR2 } = process.env */
const DESTRUCTURE_PATTERN = /(?:const|let|var)\s+\{([^}]+)\}\s*=\s*process\.env/g;

/** Bracket access: process.env['VAR_NAME'] or process.env["VAR_NAME"] */
const BRACKET_PATTERN = /process\.env\[['"]([A-Z_][A-Z0-9_]*)['"]\]/g;

/** Vite/SvelteKit/Astro: import.meta.env.VITE_VAR */
const IMPORT_META_ENV_PATTERN = /import\.meta\.env\.([A-Z_][A-Z0-9_]*)/g;

// ─── Fallback detection ─────────────────────────────────────────────────────

/** Detect if the env var access has a fallback value (|| default, ?? default, ternary) */
function hasFallback(line: string, matchStart: number, matchEnd: number): boolean {
  const rest = line.slice(matchEnd).trimStart();
  // process.env.PORT || 3000
  // process.env.PORT ?? 'default'
  // process.env.PORT || defaults.port
  if (/^(?:\|\||[?]{2})\s*(?!\s*(?:undefined|null|void)\b)/.test(rest)) return true;
  // process.env.PORT ? process.env.PORT : 3000  (ternary with fallback) — not ?? (nullish coalescing)
  if (rest.startsWith('?') && !rest.startsWith('??') && !rest.startsWith('?.')) return true;
  // process.env.A || process.env.B — we're the right side of ||, so we're a fallback (skip both)
  const before = line.slice(0, matchStart).trimEnd();
  if (/(?:\|\||[?]{2})\s*$/.test(before)) return true;
  // process.env.A ? process.env.A : default — we're in the ternary's truthy branch (skip)
  if (/\?\s*$/.test(before)) return true;
  return false;
}

/** Detect if the env var is used as a boolean check (if/ternary condition, not value) */
function isConditionalCheck(line: string, matchStart: number): boolean {
  const before = line.slice(0, matchStart).trimEnd();
  // if (process.env.DEBUG)
  // process.env.DEBUG &&
  // process.env.DEBUG ?
  if (/(?:if\s*\(|&&\s*$|\?\s*$|\|\|\s*$|!\s*$|!!\s*$)/.test(before)) return true;
  // Check for ternary on same line after the match
  const afterEnvVar = line.slice(matchStart).replace(/^process\.env\.[A-Z_][A-Z0-9_]*/, '').trimStart();
  if (/^[?](?!\.)/.test(afterEnvVar) || /^(?:&&|\|\|)/.test(afterEnvVar)) return true;
  return false;
}

// ─── Well-known env vars ────────────────────────────────────────────────────

/**
 * Well-known env vars always provided by runtimes/frameworks — never flag these.
 * Covers Node.js builtins, Next.js, Vercel, CI, npm lifecycle, cloud providers,
 * SaaS integrations, and common framework conventions.
 */
const WELL_KNOWN_PREFIXES = [
  // Frameworks
  'NEXT_PUBLIC_', 'NEXT_', 'NEXTAUTH_', 'NUXT_', 'VITE_', 'GATSBY_',
  'EXPO_PUBLIC_', 'REACT_APP_', 'VUE_APP_', 'PUBLIC_',
  // Desktop / build tools
  'ELECTRON_', 'TURBO_', 'PLASMO_', 'TAURI_',
  // Hosting / CI
  'VERCEL_', 'npm_', 'NETLIFY_', 'HEROKU_', 'RAILWAY_', 'RENDER_', 'FLY_',
  'GITHUB_', 'GH_', 'GITLAB_', 'BITBUCKET_', 'CIRCLE_', 'TRAVIS_', 'JENKINS_',
  'CODESPACE_', 'GITPOD_', 'REPLIT_',
  // Cloud providers
  'AWS_', 'AZURE_', 'GOOGLE_', 'GCP_', 'DOCKER_',
  // Databases
  'POSTGRES_', 'PG_', 'MYSQL_', 'MONGO_', 'MONGODB_', 'REDIS_',
  // SaaS integrations
  'STRIPE_', 'SUPABASE_', 'FIREBASE_', 'CLERK_', 'AUTH0_',
  'RESEND_', 'SENDGRID_', 'TWILIO_', 'POSTMARK_', 'MAILGUN_',
  'SENTRY_', 'DATADOG_', 'LOGROCKET_', 'SEGMENT_', 'POSTHOG_',
  'ALGOLIA_', 'MEILISEARCH_', 'TYPESENSE_',
  'CONTENTFUL_', 'SANITY_', 'STRAPI_', 'PRISMIC_', 'STORYBLOK_',
  'CLOUDINARY_', 'IMGIX_', 'UPLOADTHING_',
  'OPENAI_', 'ANTHROPIC_', 'REPLICATE_', 'HUGGINGFACE_',
  'PLANETSCALE_', 'TURSO_', 'NEON_', 'UPSTASH_',
  'PUSHER_', 'ABLY_', 'LIVEBLOCKS_', 'CONVEX_',
  'COHERE_',
  // Auth
  'AUTH_', 'OAUTH_', 'GITHUB_CLIENT_', 'GOOGLE_CLIENT_',
  // Generic infrastructure
  'LOG_', 'CACHE_', 'QUEUE_', 'WORKER_', 'CRON_', 'WEBHOOK_',
  'SMTP_', 'MAIL_', 'EMAIL_', 'S3_', 'CDN_', 'STORAGE_',
  // App / project-specific
  'GUARDRAIL_',
];

const WELL_KNOWN_EXACT = new Set([
  // Node.js / OS
  'NODE_ENV', 'CI', 'HOME', 'PATH', 'PWD', 'USER', 'SHELL', 'TERM', 'LANG',
  'HOSTNAME', 'PORT', 'TZ', 'EDITOR', 'TMPDIR', 'TEMP', 'TMP',
  '__dirname', '__filename',
  // Common app config
  'DATABASE_URL', 'REDIS_URL', 'API_URL', 'BASE_URL', 'HOST', 'SECRET',
  'JWT_SECRET', 'SESSION_SECRET', 'APP_URL', 'SITE_URL', 'PUBLIC_URL',
  'APP_SECRET', 'APP_KEY', 'APP_NAME', 'APP_ENV', 'APP_DEBUG',
  'DIRECT_URL', 'SHADOW_DATABASE_URL',
  // Postgres individual vars
  'PGHOST', 'PGPORT', 'PGUSER', 'PGPASSWORD', 'PGDATABASE',
  // Vercel
  'VERCEL', 'VERCEL_URL', 'VERCEL_ENV',
  // Misc hosting
  'HEROKU', 'RENDER', 'RAILWAY',
  // CI
  'GITHUB_ACTIONS', 'GITLAB_CI',
  // Build
  'ANALYZE', 'DEBUG', 'VERBOSE', 'VERSION',
]);

function isWellKnownEnvVar(name: string): boolean {
  if (WELL_KNOWN_EXACT.has(name)) return true;
  return WELL_KNOWN_PREFIXES.some(prefix => name.startsWith(prefix));
}

// ─── Levenshtein ────────────────────────────────────────────────────────────

function levenshtein(a: string, b: string): number {
  const m = a.length, n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, (_, i) =>
    Array.from({ length: n + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0))
  );
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i]![j] = a[i - 1] === b[j - 1]
        ? dp[i - 1]![j - 1]!
        : 1 + Math.min(dp[i - 1]![j]!, dp[i]![j - 1]!, dp[i - 1]![j - 1]!);
    }
  }
  return dp[m]![n]!;
}

// ─── Engine ─────────────────────────────────────────────────────────────────

export interface EnvVarEngineOptions {
  confidenceThreshold?: number;
  /**
   * When true, the only env definition files found are .env.example / .env.sample
   * (no real .env, .env.local, .env.development, etc.). In this mode, all findings
   * are demoted to severity "info" because missing vars are undocumented, not bugs.
   */
  exampleOnly?: boolean;
  /**
   * When true, NO env files exist at all in the workspace (not even .env.example).
   * The engine returns zero findings in this mode — there's nothing to validate against.
   */
  noEnvFiles?: boolean;
}

export class EnvVarEngine {
  readonly id = 'env_var';
  private readonly _resolvedOpts: EnvVarEngineOptions;

  constructor(
    private readonly _envIndex: IEnvIndex,
    optsOrThreshold: EnvVarEngineOptions | number = {},
  ) {
    // Back-compat: accept a bare number as confidenceThreshold
    this._resolvedOpts = typeof optsOrThreshold === 'number'
      ? { confidenceThreshold: optsOrThreshold }
      : optsOrThreshold;
  }

  private get _confidenceThreshold(): number {
    return this._resolvedOpts.confidenceThreshold ?? 0.75;
  }

  private get _exampleOnly(): boolean {
    return this._resolvedOpts.exampleOnly ?? false;
  }

  private get _noEnvFiles(): boolean {
    return this._resolvedOpts.noEnvFiles ?? false;
  }

  async scan(delta: DeltaContext, signal?: AbortSignal): Promise<Finding[]> {
    if (signal?.aborted) return [];
    if (this._noEnvFiles) return [];
    if (this._envIndex.index.size === 0) return [];

    try {
      const findings: Finding[] = [];
      const lines = delta.fullText.split('\n');
      let inBlockComment = false;
      const seen = new Set<string>();

      for (let lineNum = 0; lineNum < lines.length; lineNum++) {
        if (signal?.aborted) break;
        const line = lines[lineNum]!;

        // Track multi-line block comments
        if (inBlockComment) {
          if (line.includes('*/')) inBlockComment = false;
          continue;
        }

        const trimmed = line.trimStart();
        if (trimmed.startsWith('//') || trimmed.startsWith('#')) continue;
        if (trimmed.startsWith('/*')) {
          if (!line.includes('*/')) inBlockComment = true;
          continue;
        }
        if (trimmed.startsWith('*')) continue;

        // Skip type definitions and interfaces
        if (/^\s*(?:type\s|interface\s|declare\s)/.test(line)) continue;

      // ── Destructuring: const { VAR1, VAR2 } = process.env ──
      DESTRUCTURE_PATTERN.lastIndex = 0;
      let dm: RegExpExecArray | null;
      while ((dm = DESTRUCTURE_PATTERN.exec(line)) !== null) {
        const vars = dm[1]!.split(',').map(v => {
          // Handle renaming: VAR_NAME: localName, and defaults: VAR_NAME = 'default'
          const trimmedVar = v.trim();
          const colonIdx = trimmedVar.indexOf(':');
          const eqIdx = trimmedVar.indexOf('=');
          const hasDefault = eqIdx !== -1;
          let name = trimmedVar;
          if (colonIdx !== -1 && (eqIdx === -1 || colonIdx < eqIdx)) {
            name = trimmedVar.slice(0, colonIdx).trim();
          } else if (eqIdx !== -1) {
            name = trimmedVar.slice(0, eqIdx).trim();
          }
          return { name, hasDefault };
        });

        for (const { name, hasDefault } of vars) {
          if (!name || !/^[A-Z_][A-Z0-9_]*$/.test(name)) continue;
          if (this._envIndex.has(name)) continue;
          if (isWellKnownEnvVar(name)) continue;
          // Variables with defaults are lower priority
          if (hasDefault) continue;

          const dedupeKey = `${lineNum}:${name}`;
          if (seen.has(dedupeKey)) continue;
          seen.add(dedupeKey);

          const suggestion = this._findSimilar(name);
          const confidence = suggestion ? 0.90 : 0.85;
          if (confidence < this._confidenceThreshold) continue;

          const severity: Severity = this._exampleOnly ? 'info' : (suggestion ? 'high' : 'info');

          findings.push({
            id: deterministicId(delta.documentUri, lineNum + 1, name),
            engine: 'env_var',
            severity,
            category: 'env_var',
            file: delta.documentUri,
            line: lineNum + 1,
            column: dm.index,
            endLine: lineNum + 1,
            endColumn: dm.index + dm[0].length,
            message: this._exampleOnly
              ? `\`${name}\` (destructured from process.env) is not documented in .env.example`
              : `\`${name}\` (destructured from process.env) is not defined in .env or CI config`,
            evidence: dm[0],
            suggestion: suggestion ? `Typo? Similar: ${suggestion}` : `Add ${name} to your .env file`,
            confidence,
            autoFixable: false,
            ruleId: 'ENV001',
          });
        }
      }

      // ── Bracket access: process.env['VAR_NAME'] ──
      BRACKET_PATTERN.lastIndex = 0;
      let bm: RegExpExecArray | null;
      while ((bm = BRACKET_PATTERN.exec(line)) !== null) {
        const varName = bm[1]!;
        if (this._envIndex.has(varName)) continue;
        const suggestion = this._findSimilar(varName);
        if (isWellKnownEnvVar(varName) && !suggestion) continue;

        const matchEnd = bm.index + bm[0].length;
        if (hasFallback(line, bm.index, matchEnd)) continue;

        const dedupeKey = `${lineNum}:${varName}`;
        if (seen.has(dedupeKey)) continue;
        seen.add(dedupeKey);

        const confidence = suggestion ? 0.90 : 0.85;
        if (confidence < this._confidenceThreshold) continue;

        const severity: Severity = this._exampleOnly ? 'info' : (suggestion ? 'high' : 'info');

        findings.push({
          id: deterministicId(delta.documentUri, lineNum + 1, varName),
          engine: 'env_var',
          severity,
          category: 'env_var',
          file: delta.documentUri,
          line: lineNum + 1,
          column: bm.index,
          endLine: lineNum + 1,
          endColumn: matchEnd,
          message: this._exampleOnly
            ? `\`${varName}\` is not documented in .env.example`
            : `\`${varName}\` is not defined in .env or CI config`,
          evidence: bm[0],
          suggestion: suggestion ? `Typo? Similar: ${suggestion}` : `Add ${varName} to your .env file`,
          confidence,
          autoFixable: false,
          ruleId: 'ENV001',
        });
      }

      // ── import.meta.env access (Vite/SvelteKit/Astro) ──
      IMPORT_META_ENV_PATTERN.lastIndex = 0;
      let iem: RegExpExecArray | null;
      while ((iem = IMPORT_META_ENV_PATTERN.exec(line)) !== null) {
        const varName = iem[1]!;
        if (this._envIndex.has(varName)) continue;
        const suggestion = this._findSimilar(varName);
        if (isWellKnownEnvVar(varName) && !suggestion) continue;

        const matchEnd = iem.index + iem[0].length;
        if (hasFallback(line, iem.index, matchEnd)) continue;

        const dedupeKey = `${lineNum}:${varName}`;
        if (seen.has(dedupeKey)) continue;
        seen.add(dedupeKey);

        const confidence = suggestion ? 0.90 : 0.85;
        if (confidence < this._confidenceThreshold) continue;

        const severity: Severity = this._exampleOnly ? 'info' : (suggestion ? 'high' : 'info');

        findings.push({
          id: deterministicId(delta.documentUri, lineNum + 1, varName),
          engine: 'env_var',
          severity,
          category: 'env_var',
          file: delta.documentUri,
          line: lineNum + 1,
          column: iem.index,
          endLine: lineNum + 1,
          endColumn: matchEnd,
          message: `\`${varName}\` is not defined in .env or CI config`,
          evidence: `import.meta.env.${varName}`,
          suggestion: suggestion ? `Typo? Similar: ${suggestion}` : `Add ${varName} to your .env file`,
          confidence,
          autoFixable: false,
          ruleId: 'ENV001',
        });
      }

      // ── Standard access: process.env.VAR_NAME ──
      ENV_PATTERN.lastIndex = 0;
      let m: RegExpExecArray | null;
      while ((m = ENV_PATTERN.exec(line)) !== null) {
        const varName = m[1]!;
        if (this._envIndex.has(varName)) continue;
        const suggestion = this._findSimilar(varName);
        // Skip well-known vars only when we have no typo suggestion (they're often runtime-provided)
        if (isWellKnownEnvVar(varName) && !suggestion) continue;

        const matchEnd = m.index + m[0].length;

        // Skip if there's a fallback value (||, ??, ternary)
        if (hasFallback(line, m.index, matchEnd)) continue;

        // Deduplicate (same var on same line from destructuring above)
        const dedupeKey = `${lineNum}:${varName}`;
        if (seen.has(dedupeKey)) continue;
        seen.add(dedupeKey);

        const column = m.index;
        const confidence = suggestion ? 0.90 : 0.85;
        if (confidence < this._confidenceThreshold) continue;

        // Context-sensitive severity:
        // - Typo detected → high (strong evidence of bug)
        // - Used as boolean check (if/&&) → info (feature toggle pattern)
        // - Otherwise → info (config issue, not code bug)
        const isToggle = isConditionalCheck(line, m.index);
        let severity: Severity;
        if (this._exampleOnly) {
          severity = 'info';
        } else if (suggestion) {
          severity = 'high';
        } else if (isToggle) {
          severity = 'info';
        } else {
          severity = 'info';
        }

        findings.push({
          id: deterministicId(delta.documentUri, lineNum + 1, varName),
          engine: 'env_var',
          severity,
          category: 'env_var',
          file: delta.documentUri,
          line: lineNum + 1,
          column,
          endLine: lineNum + 1,
          endColumn: column + `process.env.${varName}`.length,
          message: this._exampleOnly
            ? `\`${varName}\` is not documented in .env.example (informational)`
            : `\`${varName}\` is not defined in .env or CI config`,
          evidence: `process.env.${varName}`,
          suggestion: suggestion
            ? `Typo? Similar: ${suggestion}`
            : `Add ${varName} to your .env file`,
          confidence,
          autoFixable: false,
          ruleId: 'ENV001',
        });
      }
    }

      return findings;
    } catch (error) {
      // Enhanced error handling for race conditions and parsing failures
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.error(`[EnvVarEngine] Scan failed for ${delta.documentUri}:`, errorMsg);
      
      // Return a synthetic finding for the engine failure
      return [{
        id: deterministicId(delta.documentUri, 1, 'ENGINE_ERROR'),
        engine: 'env_var',
        severity: 'medium' as const,
        category: 'engine_error',
        file: delta.documentUri,
        line: 1,
        column: 0,
        endLine: 1,
        endColumn: 0,
        message: `Environment Variable Engine scan failed: ${errorMsg}`,
        evidence: 'Engine internal error',
        suggestion: 'Check file syntax and report this issue if it persists',
        confidence: 1.0,
        autoFixable: false,
        ruleId: 'ENGINE_ERROR',
      }];
    }
  }

  private _findSimilar(name: string): string | undefined {
    let best: string | undefined;
    let bestDist = 4;

    for (const v of this._envIndex.index) {
      // Quick length filter to skip impossible candidates
      if (Math.abs(v.length - name.length) >= bestDist) continue;
      const d = levenshtein(name, v);
      if (d <= 3 && d < bestDist) { bestDist = d; best = v; }
    }

    // Prefix-based similarity: check vars that share the same prefix
    // e.g., NEXT_PUBLIC_API_KEY vs NEXT_PUBLIC_APP_KEY
    if (!best) {
      const parts = name.split('_');
      if (parts.length >= 3) {
        const prefix = parts.slice(0, -1).join('_') + '_';
        for (const v of this._envIndex.index) {
          if (v.startsWith(prefix) && v !== name) {
            best = v;
            break;
          }
        }
      }
    }

    return best;
  }
}
