/* secrets-guardian.ts
 * Enterprise-grade secrets scanning with:
 * - Correct regex flag handling (keeps i/m/s and adds g)
 * - Fix index=0 bug
 * - Binary + size guards
 * - Optional persistence via injected store (no prisma=null)
 * - Fingerprints/value hashes for dedupe
 * - Concurrency controls
 */

import { readFileSync, statSync } from 'fs';
import globCb from 'glob';
import type { IOptions as GlobOptions } from 'glob';
import { join } from 'path';
import { promisify } from 'util';
import { createHash } from 'crypto';

/** Typed wrapper — `util.promisify` loses generics for glob's callback overloads. */
const globAsync = promisify(globCb) as (pattern: string, options: GlobOptions) => Promise<string[]>;

import {
  SECRET_PATTERNS,
  TEST_PATTERNS,
  CONTEXT_EXCLUSION_PATTERNS,
  FALSE_POSITIVE_VALUES,
  SecretPattern,
  SecretType,
  RiskLevel,
} from './patterns';
import { STRIPE_LIVE_PREFIX } from './stripe-placeholder-prefix';
import { loadCustomPatterns, ConfigValidationError } from './config-loader';
import { Allowlist } from './allowlist';
import { adjustRiskByContext } from './contextual-risk';

export interface SecretDetection {
  id?: string;

  projectId: string;
  filePath: string;

  secretType: SecretType;
  risk: RiskLevel;

  /** Safe for logs/UI */
  maskedValue: string;

  /** Hash of the raw value (never store raw secrets) */
  valueHash: string;

  /** Stable key for dedupe across runs */
  fingerprint: string;

  location: {
    line: number;
    column: number;
    snippet: string;
  };

  confidence: number;
  entropy: number;

  isTest: boolean;

  /** For future integrations (revocation checks) */
  isRevoked: boolean;

  recommendation: {
    action: 'remove' | 'move_to_env' | 'use_vault' | 'revoke_and_rotate';
    reason: string;
    remediation: string;
  };
}

export interface ScanOptions {
  excludeTests?: boolean;
  minConfidence?: number;

  /** Additional glob excludes */
  excludePatterns?: string[];

  /** Safety/perf */
  maxFileSizeBytes?: number; // default 2MB
  concurrency?: number; // default 8
  skipBinaryFiles?: boolean; // default true

  /** Custom patterns and allowlist */
  useCustomPatterns?: boolean; // default true
  useAllowlist?: boolean; // default true
  useContextualRisk?: boolean; // default true
}

export interface ProjectScanReport {
  projectId: string;
  totalFiles: number;
  scannedFiles: number;
  skippedFiles: number;
  detections: SecretDetection[];
  summary: {
    totalSecrets: number;
    byType: Record<string, number>;
    byRisk: { high: number; medium: number; low: number };
  };
  performance: {
    skippedLarge: number;
    skippedBinary: number;
    allowlistSuppressed: number;
    customPatternsLoaded: number;
  };
}

export interface Logger {
  debug(msg: string, meta?: Record<string, unknown>): void;
  info(msg: string, meta?: Record<string, unknown>): void;
  warn(msg: string, meta?: Record<string, unknown>): void;
  error(msg: string, meta?: Record<string, unknown>): void;
}

const noopLogger: Logger = {
  debug: () => undefined,
  info: () => undefined,
  warn: () => undefined,
  error: () => undefined,
};

/**
 * Optional persistence contract (enterprise-grade).
 * Implement with Prisma, SQL, or ship no-op in OSS/free tier.
 */
export interface SecretStore {
  saveDetections(projectId: string, detections: SecretDetection[]): Promise<void>;
  listDetections(projectId: string): Promise<SecretDetection[]>;
}

export class NoopSecretStore implements SecretStore {
  async saveDetections(): Promise<void> {
    return;
  }
  async listDetections(): Promise<SecretDetection[]> {
    return [];
  }
}

/**
 * Minimal Prisma adapter (safe: stores hashes + masked only).
 * NOTE: adjust model/table/columns to match your schema.
 */
export class PrismaSecretStore implements SecretStore {
  constructor(private readonly prisma: any) {}

  async saveDetections(projectId: string, detections: SecretDetection[]): Promise<void> {
    if (!this.prisma) return;

    // Best effort: if table/model doesn't exist, caller should not crash.
    try {
      // Upsert-ish by fingerprint (recommended).
      // If you don't have unique(fingerprint), switch to createMany w/ skipDuplicates.
      for (const d of detections) {
        // @ts-ignore
        await this.prisma.secretDetection.upsert({
          where: { fingerprint: d.fingerprint },
          update: {
            confidence: d.confidence,
            entropy: d.entropy,
            isTest: d.isTest,
            risk: d.risk,
            maskedValue: d.maskedValue,
            valueHash: d.valueHash,
            location: d.location,
            recommendation: d.recommendation,
            secretType: d.secretType,
            filePath: d.filePath,
            projectId,
          },
          create: {
            fingerprint: d.fingerprint,
            projectId,
            filePath: d.filePath,
            secretType: d.secretType,
            risk: d.risk,
            maskedValue: d.maskedValue,
            valueHash: d.valueHash,
            location: d.location,
            confidence: d.confidence,
            entropy: d.entropy,
            isTest: d.isTest,
            isRevoked: d.isRevoked,
            recommendation: d.recommendation,
          },
        });
      }
    } catch {
      // swallow (enterprise: you can log/telemetry this)
    }
  }

  async listDetections(projectId: string): Promise<SecretDetection[]> {
    if (!this.prisma) return [];
    try {
      // @ts-ignore
      const rows = await this.prisma.secretDetection.findMany({
        where: { projectId },
        orderBy: { createdAt: 'desc' },
      });

      return rows.map((r: any) => ({
        id: r.id,
        projectId: r.projectId,
        filePath: r.filePath,
        secretType: r.secretType as SecretType,
        risk: (r.risk ?? 'medium') as RiskLevel,
        maskedValue: r.maskedValue,
        valueHash: r.valueHash,
        fingerprint: r.fingerprint,
        location: r.location,
        confidence: r.confidence,
        entropy: r.entropy,
        isTest: r.isTest,
        isRevoked: r.isRevoked ?? false,
        recommendation: r.recommendation,
      }));
    } catch {
      return [];
    }
  }
}

/**
 * Secrets & Credential Guardian
 */
export class SecretsGuardian {
  private readonly store: SecretStore;
  private readonly logger: Logger;

  private compiledPatterns: Array<{
    meta: SecretPattern;
    regex: RegExp; // guaranteed global
  }>;

  private customPatternsCount = 0;

  constructor(opts?: { store?: SecretStore; logger?: Logger }) {
    this.store = opts?.store ?? new NoopSecretStore();
    this.logger = opts?.logger ?? noopLogger;

    this.compiledPatterns = SECRET_PATTERNS.map((p) => ({
      meta: p,
      regex: toGlobalRegex(p.pattern),
    }));
  }

  /**
   * Load custom patterns from project config
   */
  loadCustomPatterns(projectPath: string): void {
    try {
      const customPatterns = loadCustomPatterns(projectPath);
      if (customPatterns.length > 0) {
        const compiled = customPatterns.map((p) => ({
          meta: p,
          regex: toGlobalRegex(p.pattern),
        }));
        this.compiledPatterns = [...this.compiledPatterns, ...compiled];
        this.customPatternsCount = customPatterns.length;
        this.logger.info(`Loaded ${customPatterns.length} custom patterns`);
      }
    } catch (err) {
      if (err instanceof ConfigValidationError) {
        this.logger.error('Custom patterns validation failed', {
          message: err.message,
          details: err.details,
        });
        throw err;
      }
      this.logger.warn('Failed to load custom patterns', { error: String(err) });
    }
  }

  /**
   * Scan content for secrets
   */
  async scanContent(
    content: string,
    filePath: string,
    projectId: string,
    options: ScanOptions = {},
    allowlist?: Allowlist
  ): Promise<SecretDetection[]> {
    const detections: SecretDetection[] = [];
    const lines = content.split('\n');
    const lineStarts = computeLineStarts(content);

    const isTestPath = pathLooksLikeTest(filePath);
    
    // Track seen values at each line to prevent duplicates from multiple patterns
    const seenAtLine = new Set<string>();

    for (const { meta, regex } of this.compiledPatterns) {
      for (const match of content.matchAll(regex)) {
        if (match.index === undefined) continue; // FIX: don't drop index 0

        const rawCandidate = extractCandidate(match, meta);
        const value = normalizeCandidate(rawCandidate);

        if (!value) continue;

        // Position
        const pos = positionFromIndex(lineStarts, match.index);
        const snippet = (lines[pos.line - 1] ?? '').trim();

        // Context exclusions (schema/validator/etc)
        if (isExcludedByContext(snippet)) continue;

        // Test/example classification
        const isTest = isTestPath || isTestValue(value, snippet);

        // Known false positives
        if (isFalsePositiveValue(value)) continue;

        // Skip documented examples
        if (isExamplePattern(value, filePath)) continue;

        // Entropy
        const entropy = calculateEntropy(value);

        if (meta.minEntropy && entropy < meta.minEntropy) continue;

        // Confidence
        const confidence = calculateConfidence({
          value,
          meta,
          entropy,
          isTest,
          snippet,
        });

        if (options.minConfidence !== undefined && confidence < options.minConfidence) continue;
        if (options.excludeTests && isTest) continue;

        const maskedValue = meta.redact ? meta.redact(value, match) : maskSensitiveValue(value);
        const valueHash = sha256(value);

        // Dedupe: skip if same value already detected on same line
        const lineKey = `${pos.line}:${valueHash}`;
        if (seenAtLine.has(lineKey)) continue;
        seenAtLine.add(lineKey);

        const fingerprint = sha256(
          [
            projectId,
            filePath,
            meta.type,
            valueHash,
            String(pos.line),
            String(pos.column),
          ].join('|')
        );

        // Check allowlist
        if (allowlist && allowlist.isAllowlisted(fingerprint)) {
          continue;
        }

        // Adjust risk by context if enabled
        let adjustedRisk = meta.risk;
        if (options.useContextualRisk !== false) {
          adjustedRisk = adjustRiskByContext({
            filePath,
            entropy,
            originalRisk: meta.risk,
          });
        }

        const detection: SecretDetection = {
          projectId,
          filePath,
          secretType: meta.type,
          risk: adjustedRisk,
          maskedValue,
          valueHash,
          fingerprint,
          location: {
            line: pos.line,
            column: pos.column,
            snippet,
          },
          confidence,
          entropy,
          isTest,
          isRevoked: false,
          recommendation: generateRecommendation(meta.type, adjustedRisk, isTest),
        };

        detections.push(detection);
      }
    }

    return detections;
  }

  /**
   * Scan an entire project directory
   */
  async scanProject(
    projectPath: string,
    projectId: string,
    options: ScanOptions = {}
  ): Promise<ProjectScanReport> {
    // Load custom patterns if enabled
    if (options.useCustomPatterns !== false) {
      this.loadCustomPatterns(projectPath);
    }

    // Load allowlist if enabled
    let allowlist: Allowlist | undefined;
    if (options.useAllowlist !== false) {
      allowlist = new Allowlist(projectPath);
    }
    const excludePatterns = [
      '**/node_modules/**',
      '**/.git/**',
      '**/dist/**',
      '**/build/**',
      '**/coverage/**',
      '**/.next/**',
      '**/*.min.js',
      '**/*.map',
      ...(options.excludePatterns ?? []),
    ];

    const files = await globAsync('**/*', {
      cwd: projectPath,
      ignore: excludePatterns,
      nodir: true,
      dot: true,
      follow: false,
    });

    const maxFileSizeBytes = options.maxFileSizeBytes ?? 2 * 1024 * 1024; // 2MB default
    const concurrency = Math.max(1, Math.min(64, options.concurrency ?? 8));
    const skipBinaryFiles = options.skipBinaryFiles ?? true;

    const allDetections: SecretDetection[] = [];
    let scannedFiles = 0;
    let skippedLarge = 0;
    let skippedBinary = 0;
    const initialDetectionCount = 0;

    await runWithConcurrency(files, concurrency, async (file) => {
      const fullPath = join(projectPath, file);

      try {
        const st = statSync(fullPath);
        if (!st.isFile()) return;

        if (st.size > maxFileSizeBytes) {
          this.logger.debug('Skipping large file', { file, size: st.size });
          skippedLarge++;
          return;
        }

        const buf = readFileSync(fullPath);
        if (skipBinaryFiles && looksBinary(buf)) {
          this.logger.debug('Skipping binary file', { file });
          skippedBinary++;
          return;
        }

        const content = buf.toString('utf-8');

        const detections = await this.scanContent(content, file, projectId, options, allowlist);
        if (detections.length) allDetections.push(...detections);

        scannedFiles++;
      } catch (err) {
        this.logger.debug('Skipping unreadable file', { file, err: String(err) });
      }
    });

    // Persist (best effort)
    await this.store.saveDetections(projectId, allDetections);

    // Summary
    const byType: Record<string, number> = {};
    const byRisk = { high: 0, medium: 0, low: 0 };

    for (const d of allDetections) {
      byType[d.secretType] = (byType[d.secretType] ?? 0) + 1;
      byRisk[d.risk]++;
    }

    const allowlistSuppressed = allowlist ? (initialDetectionCount - allDetections.length) : 0;

    return {
      projectId,
      totalFiles: files.length,
      scannedFiles,
      skippedFiles: skippedLarge + skippedBinary,
      detections: allDetections,
      summary: {
        totalSecrets: allDetections.length,
        byType,
        byRisk,
      },
      performance: {
        skippedLarge,
        skippedBinary,
        allowlistSuppressed,
        customPatternsLoaded: this.customPatternsCount,
      },
    };
  }

  /**
   * Retrieve detections from store
   */
  async getProjectReport(projectId: string): Promise<SecretDetection[]> {
    return this.store.listDetections(projectId);
  }
}

/** Singleton (uses Noop store unless you wire it) */
export const secretsGuardian = new SecretsGuardian();

/* ------------------------------ helpers ------------------------------ */

function toGlobalRegex(re: RegExp): RegExp {
  // Preserve existing flags (i/m/s/u/y) and add g if missing.
  const flags = re.flags.includes('g') ? re.flags : re.flags + 'g';
  return new RegExp(re.source, flags);
}

function extractCandidate(match: RegExpMatchArray, meta: SecretPattern): string {
  const group =
    meta.valueGroup !== undefined
      ? meta.valueGroup
      : match.length > 1
        ? 1
        : 0;

  const v = match[group] ?? match[0] ?? '';
  return String(v);
}

function normalizeCandidate(v: string): string {
  return v
    .trim()
    .replace(/^['"`]/, '')
    .replace(/['"`]$/, '')
    .replace(/[;,)\]]+$/, '')
    .trim();
}

function sha256(input: string): string {
  return createHash('sha256').update(input, 'utf8').digest('hex');
}

function calculateEntropy(str: string): number {
  const len = str.length;
  if (len === 0) return 0;

  const counts: Record<string, number> = {};
  for (const ch of str) counts[ch] = (counts[ch] ?? 0) + 1;

  let entropy = 0;
  for (const n of Object.values(counts)) {
    const p = n / len;
    entropy -= p * Math.log2(p);
  }
  return entropy;
}

function maskSensitiveValue(value: string): string {
  const v = value.trim();
  if (v.length <= 12) return '***';
  return `${v.slice(0, 4)}...${v.slice(-4)}`;
}

function computeLineStarts(content: string): number[] {
  const starts = [0];
  for (let i = 0; i < content.length; i++) {
    if (content.charCodeAt(i) === 10 /* \n */) starts.push(i + 1);
  }
  return starts;
}

function positionFromIndex(lineStarts: number[], index: number): { line: number; column: number } {
  // Binary search for rightmost line start <= index
  let lo = 0;
  let hi = lineStarts.length - 1;

  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if ((lineStarts[mid] ?? 0) <= index) lo = mid + 1;
    else hi = mid - 1;
  }

  const line = Math.max(1, hi + 1);
  const column = index - (lineStarts[hi] ?? 0) + 1;
  return { line, column };
}

function looksBinary(buf: Buffer): boolean {
  // quick heuristic: null byte presence or high non-text ratio
  const len = Math.min(buf.length, 8000);
  if (len === 0) return false;

  let suspicious = 0;
  for (let i = 0; i < len; i++) {
    const b = buf[i] ?? 0;
    if (b === 0) return true; // null byte
    // allow common whitespace + UTF-8 bytes; count control chars
    if (b < 9 || (b > 13 && b < 32)) suspicious++;
  }
  return suspicious / len > 0.15;
}

function pathLooksLikeTest(filePath: string): boolean {
  const p = filePath.toLowerCase();
  return (
    p.includes('/__tests__/') ||
    p.includes('\\__tests__\\') ||
    p.includes('/__mocks__/') ||
    p.includes('\\__mocks__\\') ||
    p.includes('/test/') ||
    p.includes('\\test\\') ||
    p.endsWith('.spec.ts') ||
    p.endsWith('.spec.tsx') ||
    p.endsWith('.test.ts') ||
    p.endsWith('.test.tsx')
  );
}

function isTestValue(value: string, contextLine: string): boolean {
  const v = value.toLowerCase();
  const c = contextLine.toLowerCase();

  for (const re of TEST_PATTERNS) {
    if (re.test(v) || re.test(c)) return true;
  }

  // Super-common placeholders
  if (/(^x{6,}$|^0{6,}$|^1{6,}$|^a{6,}$)/i.test(value)) return true;
  if (/(.)\1{10,}/.test(value)) return true;

  return false;
}

function isExcludedByContext(contextLine: string): boolean {
  const c = contextLine.toLowerCase();
  return CONTEXT_EXCLUSION_PATTERNS.some((re) => re.test(c));
}

function isExamplePattern(value: string, filePath: string): boolean {
  const lower = value.toLowerCase();
  const pathLower = filePath.toLowerCase();
  
  // Skip patterns.ts examples (documented examples)
  if (pathLower.includes('patterns.ts') || pathLower.includes('patterns.js')) {
    return true;
  }
  
  // Common example values
  const exampleValues = [
    'akiaiosfodnn7example',
    'asiaiosfodnn7example',
    'wjalrxutnfemi/k7mdeng/bpxrficyexamplekey',
    'aizasydagmwka4jsxz-hjgw7isln_3nambgewqe',
    STRIPE_LIVE_PREFIX + '0'.repeat(24),
    'xoxb-0000000000-0000000000-0000000000',
    'ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
  ];
  
  for (const ex of exampleValues) {
    if (lower.includes(ex) || ex.includes(lower)) return true;
  }
  
  // "EXAMPLE" in the value
  if (lower.includes('example')) return true;
  
  return false;
}

function isFalsePositiveValue(value: string): boolean {
  const lower = value.toLowerCase();

  if (FALSE_POSITIVE_VALUES.has(lower)) return true;

  // obvious placeholders
  if (/^(x+|0+|1+|a+)$/i.test(value)) return true;
  if (/(.)\1{10,}/.test(value)) return true;

  // extremely low variety in a long string
  if (value.length >= 24) {
    const unique = new Set(value).size;
    if (unique <= 3) return true;
  }

  return false;
}

function decodeBase64Url(segment: string): string {
  // base64url -> base64
  const b64 = segment.replace(/-/g, '+').replace(/_/g, '/');
  const pad = b64.length % 4 === 0 ? '' : '='.repeat(4 - (b64.length % 4));
  return Buffer.from(b64 + pad, 'base64').toString('utf8');
}

function calculateConfidence(args: {
  value: string;
  meta: SecretPattern;
  entropy: number;
  isTest: boolean;
  snippet: string;
}): number {
  const { value, meta, entropy, isTest } = args;

  // Base by risk: conservative defaults
  let confidence = meta.risk === 'high' ? 0.8 : meta.risk === 'medium' ? 0.7 : 0.6;

  // Entropy boosts (generic)
  if (entropy >= 4.8) confidence += 0.15;
  else if (entropy >= 4.2) confidence += 0.1;
  else if (entropy >= 3.6) confidence += 0.05;

  // Pattern-specific sanity checks
  if (meta.type === SecretType.AWS_ACCESS_KEY && /^(AKIA|ASIA)/.test(value)) confidence += 0.1;
  if (meta.type === SecretType.GITHUB_TOKEN && /^(ghp|gho|ghu|ghs|ghr)_/.test(value)) confidence += 0.1;

  // JWT: validate structure to reduce false positives
  if (meta.type === SecretType.JWT_TOKEN) {
    const parts = value.split('.');
    if (parts.length !== 3) confidence -= 0.25;
    else {
      try {
        const payload = decodeBase64Url(parts[1] ?? '');
        // If it doesn't look like JSON, down-weight
        if (!payload.includes('{') || payload.length < 20) confidence -= 0.2;
      } catch {
        confidence -= 0.3;
      }
    }
  }

  // Down-weight test/example
  if (isTest) confidence -= 0.3;

  return clamp01(confidence);
}

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}

function generateRecommendation(
  type: SecretType,
  risk: RiskLevel,
  isTest: boolean
): SecretDetection['recommendation'] {
  if (isTest) {
    return {
      action: 'remove',
      reason: 'Test/example credential detected in codebase',
      remediation:
        'Remove the credential from the repo. Use environment variables for local dev, and use mocks/fixtures that do not contain real secrets.',
    };
  }

  // Always rotate on these types
  const rotateTypes = new Set<SecretType>([
    SecretType.PRIVATE_KEY,
    SecretType.AWS_SECRET_KEY,
    SecretType.GITHUB_TOKEN,
    SecretType.STRIPE_KEY,
    SecretType.DATABASE_URL,
  ]);

  if (rotateTypes.has(type) || risk === 'high') {
    return {
      action: 'revoke_and_rotate',
      reason: 'High-risk credential exposure',
      remediation:
        'Immediately revoke/rotate the credential. Audit usage, invalidate sessions if applicable, and re-issue via a secrets manager (AWS Secrets Manager / GCP Secret Manager / HashiCorp Vault).',
    };
  }

  if (risk === 'medium') {
    return {
      action: 'move_to_env',
      reason: 'Credential should not be hardcoded',
      remediation:
        'Move the value to environment variables (or a secrets manager) and reference it at runtime. Ensure CI/CD injects it securely.',
    };
  }

  return {
    action: 'use_vault',
    reason: 'Sensitive value detected',
    remediation:
      'Store in a secrets manager and load via runtime injection. Consider tightening repo protections and adding pre-commit scanning.',
  };
}

async function runWithConcurrency<T>(
  items: T[],
  concurrency: number,
  worker: (item: T) => Promise<void>
): Promise<void> {
  let i = 0;

  const runners = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (true) {
      const idx = i++;
      if (idx >= items.length) return;
      const item = items[idx];
      if (item === undefined) continue;
      await worker(item);
    }
  });

  await Promise.all(runners);
}
