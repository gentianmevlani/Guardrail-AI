/**
 * APITruthEngine v3.0 — "The AI Lied" detector, world-class edition.
 *
 * Architecture:
 *   ┌──────────────────────────────────────────────────────────────────────┐
 *   │  Scan Pipeline                                                       │
 *   │                                                                      │
 *   │  1. Import Analysis                                                  │
 *   │     Parse top-of-file imports → resolve which SDKs are in scope      │
 *   │     Skip file entirely if no known SDK is imported                   │
 *   │                                                                      │
 *   │  2. Lexer Pre-pass                                                   │
 *   │     Track comment/string regions → skip false positives in literals  │
 *   │                                                                      │
 *   │  3. Known Hallucination Trie  (Layer 1 — highest confidence)         │
 *   │     O(k) prefix-trie lookup against curated hallucination database   │
 *   │                                                                      │
 *   │  4. SDK Type Map Validation   (Layer 2 — high confidence)            │
 *   │     In-memory method maps loaded per SDK + detected version          │
 *   │     Optimized Levenshtein for "did you mean?" suggestions            │
 *   │                                                                      │
 *   │  5. Pattern Rules             (Layer 3 — medium-high confidence)     │
 *   │     Regex-based rules for model-level hallucinations, config keys    │
 *   │     Extensible at runtime via addPatternRule()                       │
 *   │                                                                      │
 *   │  → Deterministic finding IDs (stable across re-scans for dedup)     │
 *   │  → Structured engine metrics for telemetry                           │
 *   └──────────────────────────────────────────────────────────────────────┘
 *
 * SDK coverage: Stripe, OpenAI, Anthropic, Prisma, Supabase, Firebase
 * Latency target: <80ms (all in-memory, zero I/O in hot path)
 */

import * as path from 'path';
import * as fs from 'fs/promises';
import { existsSync, readFileSync } from 'fs';
import type { Finding, DeltaContext, ScanEngine } from './core-types';

// ─── Types ───────────────────────────────────────────────────────────────────

interface SdkMethodEntry {
  exists: boolean;
  deprecated?: boolean;
  replacement?: string;
  since?: string;
}

interface SdkMap {
  [methodPath: string]: SdkMethodEntry;
}

interface PatternRule {
  /** Unique rule identifier (e.g. 'HAL002'). */
  ruleId: string;
  /** Regex to test against each line. Must NOT use the `g` flag. */
  regex: RegExp;
  /** Human-readable message explaining the issue. */
  message: string;
  /** Suggested fix. */
  suggestion: string;
  /** Confidence score 0–1. */
  confidence: number;
  /** Finding severity. */
  severity?: Finding['severity'];
  /** Optional: only apply to these file extensions. */
  extensions?: Set<string>;
}

interface ImportInfo {
  /** Resolved SDK key (e.g. 'stripe', 'openai'). */
  sdk: string;
  /** The local binding name used in code (e.g. 'stripe', 'client', 'ai'). */
  localName: string;
  /** Line number of the import statement (0-indexed). */
  line: number;
}

interface EngineStats {
  filesScanned: number;
  filesSkipped: number;
  findingsEmitted: number;
  hallucationHits: number;
  sdkMapHits: number;
  patternRuleHits: number;
  avgScanMs: number;
}

// ─── Trie for O(k) Hallucination Lookup ──────────────────────────────────────

interface TrieNode {
  children: Map<string, TrieNode>;
  /** If this node terminates a known hallucination, stores the suggestion. */
  value?: string;
}

class HallucinationTrie {
  private readonly _root: TrieNode = { children: new Map() };
  private _size = 0;

  get size(): number { return this._size; }

  insert(hallucinatedPath: string, suggestion: string): void {
    let node = this._root;
    for (const char of hallucinatedPath) {
      let child = node.children.get(char);
      if (!child) {
        child = { children: new Map() };
        node.children.set(char, child);
      }
      node = child;
    }
    node.value = suggestion;
    this._size++;
  }

  /**
   * Look up an exact call path. Returns the suggestion if found, undefined otherwise.
   * O(k) where k = length of the call path string.
   */
  lookup(callPath: string): string | undefined {
    let node = this._root;
    for (const char of callPath) {
      const child = node.children.get(char);
      if (!child) return undefined;
      node = child;
    }
    return node.value;
  }

  /**
   * Check if any hallucination starts with the given prefix.
   * Useful for early-exit: if prefix doesn't match, skip deeper checks.
   */
  hasPrefix(prefix: string): boolean {
    let node = this._root;
    for (const char of prefix) {
      const child = node.children.get(char);
      if (!child) return false;
      node = child;
    }
    return true;
  }
}

// ─── SDK Call Regex ──────────────────────────────────────────────────────────

// Matches: stripe.paymentIntents.create( or openai.chat.completions.create(
// Captures: [1] = full object path, [2] = terminal method name
const SDK_CALL_RE = /(\w+(?:\.\w+)*)\.(\w+)\s*\(/g;

// ─── Import Detection ────────────────────────────────────────────────────────

// Covers:
//   import Stripe from 'stripe'
//   import { Stripe } from 'stripe'
//   const stripe = require('stripe')
//   const { OpenAI } = require('openai')
//   import OpenAI from 'openai'
//   import Anthropic from '@anthropic-ai/sdk'
const IMPORT_PATTERNS: Array<{
  regex: RegExp;
  packageIndex: number;
  nameIndex: number;
}> = [
  // ESM: import X from 'pkg'  /  import { X } from 'pkg'
  {
    regex: /import\s+(?:\{?\s*(\w+)\s*\}?)\s+from\s+['"]([^'"]+)['"]/g,
    nameIndex: 1,
    packageIndex: 2,
  },
  // CJS: const x = require('pkg')  /  const { X } = require('pkg')
  {
    regex: /(?:const|let|var)\s+(?:\{?\s*(\w+)\s*\}?)\s*=\s*require\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
    nameIndex: 1,
    packageIndex: 2,
  },
  // Dynamic import: const x = await import('pkg')
  {
    regex: /(?:const|let|var)\s+(?:\{?\s*(\w+)\s*\}?)\s*=\s*await\s+import\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
    nameIndex: 1,
    packageIndex: 2,
  },
];

/** Maps npm package names → SDK key. */
const PACKAGE_TO_SDK: Record<string, string> = {
  'stripe':                  'stripe',
  'openai':                  'openai',
  '@anthropic-ai/sdk':       'anthropic',
  'anthropic':               'anthropic',
  '@prisma/client':          'prisma',
  '@supabase/supabase-js':   'supabase',
  'firebase':                'firebase',
  'firebase-admin':          'firebase',
  'firebase/app':            'firebase',
  'resend':                  'resend',
  '@clerk/nextjs':           'clerk',
  '@clerk/express':          'clerk',
  '@clerk/backend':          'clerk',
  'ai':                      'ai',           // Vercel AI SDK
  '@ai-sdk/openai':          'ai',
  '@ai-sdk/anthropic':       'ai',
  'drizzle-orm':             'drizzle',
  '@trpc/server':            'trpc',
  '@trpc/client':            'trpc',
  'hono':                    'hono',
  'zod':                     'zod',
};

/** Fallback: resolve SDK from the local binding name when package can't be matched. */
const NAME_TO_SDK: Record<string, string> = {
  'stripe':      'stripe',
  'openai':      'openai',
  'anthropic':   'anthropic',
  'prisma':      'prisma',
  'supabase':    'supabase',
  'firebase':    'firebase',
  'resend':      'resend',
  'clerk':       'clerk',
  'ai':          'ai',
  'drizzle':     'drizzle',
  'trpc':        'trpc',
  'hono':        'hono',
  'zod':         'zod',
};

/** Relative/local import paths (not npm packages). */
function isRelativeOrLocalImport(pkg: string): boolean {
  return pkg.startsWith('.') || pkg.startsWith('@/') || pkg.includes('/db/') || pkg.includes('db/client');
}

function detectImports(text: string): ImportInfo[] {
  const results: ImportInfo[] = [];
  const seen = new Set<string>();

  // Only scan the first 80 lines for imports (perf optimization)
  const lines = text.split('\n');
  const importRegion = lines.slice(0, 80).join('\n');

  // First pass: collect all imports and detect which ORMs are in scope
  const rawImports: Array<{ localName: string; packageName: string; index: number }> = [];
  const packagesInFile = new Set<string>();

  for (const pattern of IMPORT_PATTERNS) {
    pattern.regex.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = pattern.regex.exec(importRegion)) !== null) {
      const localName = match[pattern.nameIndex]!;
      const packageName = match[pattern.packageIndex]!;
      rawImports.push({ localName, packageName, index: match.index });
      // Track known ORM packages for db resolution
      if (PACKAGE_TO_SDK[packageName]) {
        packagesInFile.add(packageName);
      }
    }
  }

  const hasDrizzle = packagesInFile.has('drizzle-orm');
  const hasPrisma = packagesInFile.has('@prisma/client');

  // Second pass: resolve SDK for each import
  for (const { localName, packageName, index } of rawImports) {
    if (seen.has(localName)) continue;

    let sdk: string | null =
      PACKAGE_TO_SDK[packageName] ??
      NAME_TO_SDK[localName.toLowerCase()] ?? null;

    // Special case: db from relative/local path — resolve from ORM context to avoid false positives
    if (localName.toLowerCase() === 'db' && isRelativeOrLocalImport(packageName)) {
      if (hasDrizzle && !hasPrisma) {
        sdk = 'drizzle';
      } else if (hasPrisma && !hasDrizzle) {
        sdk = 'prisma';
      } else if (!hasDrizzle && !hasPrisma) {
        // Ambiguous: file imports db from local module but no ORM in imports.
        // Skip to avoid false positives (db.execute, db.transaction are valid in Drizzle).
        sdk = null;
      }
      // If both present, prefer drizzle (common pattern: drizzle-orm for sql, db from client)
      else {
        sdk = 'drizzle';
      }
    }

    if (sdk) {
      seen.add(localName);
      const lineNum = importRegion.slice(0, index).split('\n').length - 1;
      results.push({ sdk, localName, line: lineNum });
    }
  }

  return results;
}

// ─── Lexer: Comment & String Region Tracking ─────────────────────────────────

interface CodeRegion {
  /** True if this line is inside a multi-line comment or is a single-line comment. */
  inComment: boolean;
  /** Ranges within the line that are inside string literals. */
  stringRanges: Array<{ start: number; end: number }>;
}

/**
 * Lightweight lexer that tracks comment and string regions per line.
 * This prevents false positives from SDK calls mentioned in comments or strings.
 *
 * Handles: // single-line, /* multi-line *​/, 'single', "double", `template`
 */
function buildCodeRegions(lines: string[]): CodeRegion[] {
  const regions: CodeRegion[] = [];
  let inBlockComment = false;

  for (const line of lines) {
    const stringRanges: Array<{ start: number; end: number }> = [];
    let isFullComment = inBlockComment;
    let i = 0;

    if (inBlockComment) {
      const closeIdx = line.indexOf('*/');
      if (closeIdx === -1) {
        // Entire line is in a block comment
        regions.push({ inComment: true, stringRanges: [] });
        continue;
      }
      i = closeIdx + 2;
      inBlockComment = false;
      // Line might have code after the comment close — don't mark full comment
      isFullComment = false;
    }

    let inString: string | null = null;
    let stringStart = 0;

    while (i < line.length) {
      const ch = line[i]!;
      const next = line[i + 1];

      if (inString) {
        if (ch === '\\') { i += 2; continue; } // skip escaped char
        if (ch === inString) {
          stringRanges.push({ start: stringStart, end: i });
          inString = null;
        }
        i++;
        continue;
      }

      // Not in a string
      if (ch === '/' && next === '/') {
        // Rest of line is comment
        if (i === 0 || line.slice(0, i).trim() === '') isFullComment = true;
        break;
      }
      if (ch === '/' && next === '*') {
        inBlockComment = true;
        const closeIdx = line.indexOf('*/', i + 2);
        if (closeIdx !== -1) {
          inBlockComment = false;
          i = closeIdx + 2;
          continue;
        }
        // Block comment continues to next line
        if (i === 0 || line.slice(0, i).trim() === '') isFullComment = true;
        break;
      }
      if (ch === "'" || ch === '"' || ch === '`') {
        inString = ch;
        stringStart = i;
        i++;
        continue;
      }
      i++;
    }

    regions.push({ inComment: isFullComment, stringRanges });
  }

  return regions;
}

/** Check if a column offset falls inside a string literal on this line. */
function isInString(region: CodeRegion, col: number): boolean {
  for (const r of region.stringRanges) {
    if (col >= r.start && col <= r.end) return true;
  }
  return false;
}

// ─── Levenshtein (single-row optimized) ──────────────────────────────────────

function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  // Single-row DP — O(min(m,n)) space
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
      row[i] = a[i - 1] === b[j - 1]
        ? prev
        : 1 + Math.min(prev, row[i]!, row[i - 1]!);
      prev = temp;
    }
  }

  return row[m]!;
}

function findClosestMatch(
  map: SdkMap,
  callPath: string,
  maxDist: number = 3
): string | undefined {
  let best: string | undefined;
  let bestDist = maxDist + 1;

  for (const key of Object.keys(map)) {
    const entry = map[key];
    if (!entry?.exists) continue;
    // Quick length check to skip impossible candidates
    if (Math.abs(key.length - callPath.length) >= bestDist) continue;
    const d = levenshtein(callPath, key);
    if (d < bestDist) {
      bestDist = d;
      best = key;
    }
  }

  return best;
}

// ─── Deterministic Finding IDs ───────────────────────────────────────────────

/**
 * Generate a stable ID from finding properties so identical findings across
 * re-scans produce the same ID. Critical for dedup in the orchestrator.
 */
function deterministicId(
  uri: string,
  line: number,
  col: number,
  ruleId: string,
  evidence: string
): string {
  // FNV-1a 32-bit hash for speed
  const input = `${uri}::${line}::${col}::${ruleId}::${evidence}`;
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = (hash * 0x01000193) >>> 0;
  }
  return `api-truth-${hash.toString(16).padStart(8, '0')}`;
}

// ─── Known Hallucination Database ────────────────────────────────────────────

const KNOWN_HALLUCINATIONS: ReadonlyArray<[hallucinated: string, correct: string]> = [
  // ── Stripe ─────────────────────────────────────────────────────────────
  ['stripe.confirmPayment',        'stripe.paymentIntents.confirm'],
  ['stripe.createPayment',         'stripe.paymentIntents.create'],
  ['stripe.createPaymentIntent',   'stripe.paymentIntents.create'],
  ['stripe.confirmPaymentIntent',  'stripe.paymentIntents.confirm'],
  ['stripe.cancelPaymentIntent',   'stripe.paymentIntents.cancel'],
  ['stripe.capturePaymentIntent',  'stripe.paymentIntents.capture'],
  ['stripe.getPaymentIntent',      'stripe.paymentIntents.retrieve'],
  ['stripe.listPaymentIntents',    'stripe.paymentIntents.list'],
  ['stripe.getSubscription',       'stripe.subscriptions.retrieve'],
  ['stripe.createSubscription',    'stripe.subscriptions.create'],
  ['stripe.cancelSubscription',    'stripe.subscriptions.cancel'],
  ['stripe.updateSubscription',    'stripe.subscriptions.update'],
  ['stripe.listSubscriptions',     'stripe.subscriptions.list'],
  ['stripe.createCustomer',        'stripe.customers.create'],
  ['stripe.getCustomer',           'stripe.customers.retrieve'],
  ['stripe.updateCustomer',        'stripe.customers.update'],
  ['stripe.deleteCustomer',        'stripe.customers.del'],
  ['stripe.listCustomers',         'stripe.customers.list'],
  ['stripe.createCheckoutSession', 'stripe.checkout.sessions.create'],
  ['stripe.getCheckoutSession',    'stripe.checkout.sessions.retrieve'],
  ['stripe.createRefund',          'stripe.refunds.create'],
  ['stripe.createInvoice',         'stripe.invoices.create'],
  ['stripe.payInvoice',            'stripe.invoices.pay'],
  ['stripe.finalizeInvoice',       'stripe.invoices.finalizeInvoice'],
  ['stripe.verify',                'stripe.webhooks.constructEvent'],
  ['stripe.constructWebhookEvent', 'stripe.webhooks.constructEvent'],
  ['stripe.verifyWebhook',         'stripe.webhooks.constructEvent'],
  ['stripe.createPrice',           'stripe.prices.create'],
  ['stripe.getPrice',              'stripe.prices.retrieve'],
  ['stripe.createProduct',         'stripe.products.create'],
  ['stripe.getProduct',            'stripe.products.retrieve'],
  ['stripe.createSetupIntent',     'stripe.setupIntents.create'],
  ['stripe.getSetupIntent',        'stripe.setupIntents.retrieve'],
  ['stripe.attachPaymentMethod',   'stripe.paymentMethods.attach'],
  ['stripe.detachPaymentMethod',   'stripe.paymentMethods.detach'],

  // ── OpenAI ─────────────────────────────────────────────────────────────
  ['openai.createCompletion',      'openai.completions.create'],
  ['openai.createChatCompletion',  'openai.chat.completions.create'],
  ['openai.createEmbedding',       'openai.embeddings.create'],
  ['openai.createEmbeddings',      'openai.embeddings.create'],
  ['openai.createImage',           'openai.images.generate'],
  ['openai.generateImage',         'openai.images.generate'],
  ['openai.editImage',             'openai.images.edit'],
  ['openai.getModels',             'openai.models.list'],
  ['openai.listModels',            'openai.models.list'],
  ['openai.complete',              'openai.chat.completions.create'],
  ['openai.generate',              'openai.chat.completions.create'],
  ['openai.chat',                  'openai.chat.completions.create'],
  ['openai.createTranscription',   'openai.audio.transcriptions.create'],
  ['openai.transcribe',            'openai.audio.transcriptions.create'],
  ['openai.createModeration',      'openai.moderations.create'],
  ['openai.moderate',              'openai.moderations.create'],
  ['openai.createFile',            'openai.files.create'],
  ['openai.uploadFile',            'openai.files.create'],
  ['openai.createFineTune',        'openai.fineTuning.jobs.create'],
  ['openai.createThread',          'openai.beta.threads.create'],
  ['openai.createAssistant',       'openai.beta.assistants.create'],
  ['openai.createRun',             'openai.beta.threads.runs.create'],
  ['openai.streamChat',            'openai.chat.completions.create({ stream: true })'],

  // ── Anthropic ──────────────────────────────────────────────────────────
  ['anthropic.complete',           'anthropic.messages.create'],
  ['anthropic.createCompletion',   'anthropic.messages.create'],
  ['anthropic.chat',               'anthropic.messages.create'],
  ['anthropic.sendMessage',        'anthropic.messages.create'],
  ['anthropic.createMessage',      'anthropic.messages.create'],
  ['anthropic.generate',           'anthropic.messages.create'],
  ['anthropic.stream',             'anthropic.messages.stream'],
  ['anthropic.streamMessage',      'anthropic.messages.stream'],
  ['anthropic.countTokens',        'anthropic.messages.count_tokens'],
  ['anthropic.createBatch',        'anthropic.messages.batches.create'],

  // ── Prisma ─────────────────────────────────────────────────────────────
  ['prisma.findAll',               'prisma.<model>.findMany'],
  ['prisma.getAll',                'prisma.<model>.findMany'],
  ['prisma.fetchAll',              'prisma.<model>.findMany'],
  ['prisma.getOne',                'prisma.<model>.findUnique'],
  ['prisma.fetchOne',              'prisma.<model>.findUnique'],
  ['prisma.getById',               'prisma.<model>.findUnique'],
  ['prisma.removeAll',             'prisma.<model>.deleteMany'],
  ['prisma.updateAll',             'prisma.<model>.updateMany'],
  ['prisma.createOrUpdate',        'prisma.<model>.upsert'],
  ['prisma.search',                'prisma.<model>.findMany({ where: ... })'],
  ['prisma.query',                 'prisma.$queryRaw'],
  ['prisma.raw',                   'prisma.$queryRaw'],
  ['prisma.execute',               'prisma.$executeRaw'],
  ['prisma.transaction',           'prisma.$transaction'],
  ['prisma.disconnect',            'prisma.$disconnect'],
  ['prisma.connect',               'prisma.$connect'],

  // ── Supabase ───────────────────────────────────────────────────────────
  ['supabase.query',               'supabase.from(table).select()'],
  ['supabase.fetch',               'supabase.from(table).select()'],
  ['supabase.getUser',             'supabase.auth.getUser()'],
  ['supabase.login',               'supabase.auth.signInWithPassword()'],
  ['supabase.signup',              'supabase.auth.signUp()'],
  ['supabase.signIn',              'supabase.auth.signInWithPassword()'],
  ['supabase.signOut',             'supabase.auth.signOut()'],
  ['supabase.logout',              'supabase.auth.signOut()'],
  ['supabase.upload',              'supabase.storage.from(bucket).upload()'],
  ['supabase.subscribe',           'supabase.channel(name).subscribe()'],

  // ── Firebase ───────────────────────────────────────────────────────────
  ['firebase.getDocument',         'getDoc(docRef)'],
  ['firebase.setDocument',         'setDoc(docRef, data)'],
  ['firebase.queryCollection',     'getDocs(query(collectionRef, ...))'],
  ['firebase.onAuth',              'onAuthStateChanged(auth, callback)'],
  ['firebase.login',               'signInWithEmailAndPassword(auth, ...)'],
  ['firebase.signup',              'createUserWithEmailAndPassword(auth, ...)'],
  ['firebase.signOut',             'signOut(auth)'],
  ['firebase.getCurrentUser',      'auth.currentUser or onAuthStateChanged()'],
  ['firebase.addDocument',         'addDoc(collectionRef, data)'],
  ['firebase.updateDocument',      'updateDoc(docRef, data)'],
  ['firebase.deleteDocument',      'deleteDoc(docRef)'],
  ['firebase.onSnapshot',         'onSnapshot(docRef, callback) — imported from firebase/firestore'],
  ['firebase.collection',          'collection(db, collectionName) — v9+ uses modular API'],
  ['firebase.doc',                 'doc(db, collection, id) — v9+ uses modular API'],

  // ── Resend ──────────────────────────────────────────────────────────────
  ['resend.send',                  'resend.emails.send'],
  ['resend.sendEmail',             'resend.emails.send'],
  ['resend.createEmail',           'resend.emails.send'],
  ['resend.sendBatch',             'resend.batch.send'],
  ['resend.getEmail',              'resend.emails.get'],
  ['resend.listEmails',            'resend.emails.list'],

  // ── Clerk ───────────────────────────────────────────────────────────────
  ['clerk.getUser',                'clerkClient.users.getUser(userId)'],
  ['clerk.createUser',             'clerkClient.users.createUser(params)'],
  ['clerk.updateUser',             'clerkClient.users.updateUser(userId, params)'],
  ['clerk.deleteUser',             'clerkClient.users.deleteUser(userId)'],
  ['clerk.listUsers',              'clerkClient.users.getUserList()'],
  ['clerk.verifyToken',            'clerkClient.verifyToken(token) or authenticateRequest()'],

  // ── Vercel AI SDK ───────────────────────────────────────────────────────
  ['ai.chat',                      'generateText({ model, prompt }) or streamText({ model, prompt })'],
  ['ai.complete',                  'generateText({ model, prompt })'],
  ['ai.generate',                  'generateText({ model, prompt })'],
  ['ai.stream',                    'streamText({ model, prompt })'],
  ['ai.createCompletion',          'generateText({ model, prompt })'],
  ['ai.embed',                     'embed({ model, value }) or embedMany({ model, values })'],

  // ── Drizzle ORM ─────────────────────────────────────────────────────────
  ['db.findMany',                  'db.select().from(table)'],
  ['db.findOne',                   'db.select().from(table).where(...).limit(1)'],
  ['db.findUnique',                'db.select().from(table).where(eq(table.id, id))'],
  ['db.findFirst',                 'db.select().from(table).where(...).limit(1)'],
  ['db.create',                    'db.insert(table).values(data)'],
  ['db.remove',                    'db.delete(table).where(...)'],
  ['db.destroy',                   'db.delete(table).where(...)'],

  // ── tRPC ────────────────────────────────────────────────────────────────
  ['trpc.query',                   'publicProcedure.query(({ ctx, input }) => ...)'],
  ['trpc.mutate',                  'publicProcedure.mutation(({ ctx, input }) => ...)'],
  ['trpc.procedure',               'publicProcedure or protectedProcedure (from your trpc setup)'],
  ['trpc.createClient',            'createTRPCClient<AppRouter>({ links: [...] })'],
  ['trpc.createRouter',            'router({ ... }) from initTRPC.create()'],

  // ── Hono ────────────────────────────────────────────────────────────────
  ['hono.listen',                  'serve(app) from @hono/node-server'],
  ['hono.start',                   'serve({ fetch: app.fetch, port })'],
  ['hono.register',                'app.route(path, subApp) or app.use(middleware)'],
  ['hono.sendJSON',                'c.json(data)'],

  // ── Zod ─────────────────────────────────────────────────────────────────
  ['zod.validate',                 'schema.parse(data) or schema.safeParse(data)'],
  ['zod.check',                    'schema.refine(fn) or schema.superRefine(fn)'],
  ['zod.assert',                   'schema.parse(data) — throws on failure'],
  ['zod.isValid',                  'schema.safeParse(data).success'],
  ['zod.create',                   'z.object({...}), z.string(), z.number(), etc.'],
  ['zod.schema',                   'z.object({...})'],

  // ── Stripe (additional) ─────────────────────────────────────────────────
  ['stripe.createPaymentLink',     'stripe.paymentLinks.create'],
  ['stripe.getPaymentLink',        'stripe.paymentLinks.retrieve'],
  ['stripe.listPaymentLinks',      'stripe.paymentLinks.list'],
  ['stripe.createCoupon',          'stripe.coupons.create'],
  ['stripe.createTaxRate',         'stripe.taxRates.create'],
  ['stripe.createQuote',           'stripe.quotes.create'],
  ['stripe.createBillingSession',  'stripe.billingPortal.sessions.create'],

  // ── OpenAI (additional) ─────────────────────────────────────────────────
  ['openai.createSpeech',          'openai.audio.speech.create'],
  ['openai.listFiles',             'openai.files.list'],
  ['openai.deleteFile',            'openai.files.del'],
  ['openai.createVectorStore',     'openai.beta.vectorStores.create'],
  ['openai.createBatch',           'openai.batches.create'],

  // ── Anthropic (additional) ──────────────────────────────────────────────
  ['anthropic.completion',         'anthropic.messages.create'],
  ['anthropic.chat',               'anthropic.messages.create'],
  ['anthropic.listModels',         'anthropic.models.list'],
  ['anthropic.getModel',           'anthropic.models.retrieve'],
  ['anthropic.createBatch',        'anthropic.messages.batches.create'],
  ['anthropic.getBatch',           'anthropic.messages.batches.retrieve'],
];

// ─── Default Pattern Rules ───────────────────────────────────────────────────

const DEFAULT_PATTERN_RULES: PatternRule[] = [
  // Prisma: hallucinated methods on any model
  {
    ruleId: 'HAL002',
    regex: /\bprisma\.\w+\.(?:getAll|fetchAll|search|getOne|fetchOne|removeAll|updateAll|createOrUpdate|getById|fetch|get|remove|save|insert)\s*\(/,
    message: 'Hallucinated Prisma method — this does not exist in any Prisma version',
    suggestion: 'Prisma model methods: findMany, findUnique, findFirst, create, update, delete, upsert, deleteMany, updateMany, count, aggregate, groupBy',
    confidence: 0.88,
  },
  // Express: hallucinated convenience methods
  {
    ruleId: 'HAL002',
    regex: /(?:app|router)\.(?:handle|serve|mount|register|bind|attach)\s*\(\s*['"`]\/\w/,
    message: 'Hallucinated Express/router method — this does not exist',
    suggestion: 'Express uses: .get(), .post(), .put(), .delete(), .patch(), .use(), .all(), .route()',
    confidence: 0.80,
  },
  // Next.js: hallucinated config options
  {
    ruleId: 'HAL004',
    regex: /(?:enableSSR|enableCSR|autoOptimize|smartBundling|lazyHydration|autoCache|enableSWC|enableTurbo|autoRouting|staticPaths|hybridMode)\s*:/,
    message: 'Hallucinated Next.js config option — this property does not exist',
    suggestion: 'Check the Next.js docs for valid next.config.js options: reactStrictMode, images, experimental, env, redirects, rewrites, headers, etc.',
    confidence: 0.82,
  },
  // React: hallucinated hooks
  {
    ruleId: 'HAL003',
    regex: /\b(?:useFormState|useAsyncEffect|usePromise|useRequest|useFetchData|useLocalStorage|useApi|useQuery)\s*\(/,
    message: 'This is not a built-in React hook — it may be hallucinated or require a third-party library',
    suggestion: 'Built-in React hooks: useState, useEffect, useContext, useReducer, useCallback, useMemo, useRef, useId, useDeferredValue, useTransition, useOptimistic, useActionState, use',
    confidence: 0.72,
    severity: 'medium',
    extensions: new Set(['.tsx', '.jsx']),
  },
  // Node.js: hallucinated fs methods
  {
    ruleId: 'HAL002',
    regex: /\bfs\.(?:readJSON|writeJSON|readDir|isFile|isDirectory|getSize|move|copy|create)\s*\(/,
    message: 'Hallucinated Node.js fs method — this does not exist',
    suggestion: 'Use: readFile/writeFile (with JSON.parse/stringify), readdir, stat, rename, copyFile, open',
    confidence: 0.85,
  },
  // Deprecated API detection (layer 3.5)
  {
    ruleId: 'HAL005',
    regex: /\bnew Buffer\s*\(/,
    message: 'Buffer() constructor is deprecated and unsafe',
    suggestion: 'Use Buffer.from(), Buffer.alloc(), or Buffer.allocUnsafe()',
    confidence: 0.95,
    severity: 'high',
  },
  // Placeholder URLs — AI often uses these instead of real config
  {
    ruleId: 'HAL007',
    regex: /(?:https?:\/\/)?(?:www\.)?(?:example\.com|your-site\.com|yourdomain\.com|placeholder\.com|example\.org)\b/i,
    message: 'Placeholder URL — replace with your actual domain or config',
    suggestion: 'Use environment variables for URLs: process.env.API_URL or NEXT_PUBLIC_APP_URL',
    confidence: 0.85,
    severity: 'medium',
  },
  // Fake test emails — common AI placeholder
  {
    ruleId: 'HAL008',
    regex: /['"`]?(?:test@example\.com|user@example\.com|admin@example\.com|email@example\.com|user@test\.com)['"`]?/,
    message: 'Placeholder test email — use a real test fixture or env var',
    suggestion: 'Use process.env.TEST_EMAIL or a dedicated test fixture (e.g. fixtures/users.ts)',
    confidence: 0.80,
    severity: 'low',
  },
  // localhost in production config — AI often leaves dev URLs in prod
  {
    ruleId: 'HAL009',
    regex: /(?:NEXT_PUBLIC_|VITE_|API_|BASE_)?(?:URL|HOST|ORIGIN)\s*[:=]\s*['"`]https?:\/\/localhost(?::\d+)?\/?['"`]/,
    message: 'localhost URL in config — will fail in production',
    suggestion: 'Use environment-specific URLs: process.env.API_URL or conditional based on NODE_ENV',
    confidence: 0.90,
    severity: 'high',
  },
  // Drizzle: hallucinated Prisma-style methods
  {
    ruleId: 'HAL002',
    regex: /\bdb\.(?:findMany|findUnique|findFirst|create|update|delete|upsert|createMany|deleteMany|updateMany)\s*\(/,
    message: 'Prisma method used with Drizzle ORM — Drizzle uses a different API',
    suggestion: 'Drizzle uses: db.select().from(table), db.insert(table).values(), db.update(table).set(), db.delete(table).where()',
    confidence: 0.82,
  },
  // tRPC: hallucinated Express-style route handlers
  {
    ruleId: 'HAL002',
    regex: /\btrpc\.(?:get|post|put|delete|patch|handler|endpoint)\s*\(/,
    message: 'Express-style route handler used with tRPC — tRPC uses procedures, not routes',
    suggestion: 'tRPC uses: publicProcedure.input(schema).query/mutation(({ input, ctx }) => ...)',
    confidence: 0.80,
  },
  // Hono: Express-style middleware patterns that don't exist
  {
    ruleId: 'HAL002',
    regex: /\bapp\.(?:use\(\s*express\.|bodyParser|cookieParser|cors\(\))\b/,
    message: 'Express middleware used with Hono — Hono has its own middleware',
    suggestion: 'Hono middleware: import { cors } from "hono/cors", import { logger } from "hono/logger"',
    confidence: 0.78,
    severity: 'medium',
  },
  // Vercel AI SDK: OpenAI-style API used instead of Vercel AI SDK patterns
  {
    ruleId: 'HAL002',
    regex: /\bai\.(?:chat|completions|embeddings|images)\./,
    message: 'OpenAI-style method chain used with Vercel AI SDK — different API',
    suggestion: 'Vercel AI SDK uses: generateText({ model, prompt }), streamText({ model, prompt }), embed({ model, value })',
    confidence: 0.80,
    severity: 'high',
  },
  // React Server Components: hallucinated hooks in server components
  {
    ruleId: 'HAL003',
    regex: /['"`]use server['"`]\s*;[\s\S]*\b(?:useState|useEffect|useCallback|useMemo|useRef|useReducer|useContext)\s*\(/,
    message: 'React hook used in a Server Component — hooks only work in Client Components',
    suggestion: 'Add "use client" directive at the top of the file, or move the hook to a Client Component.',
    confidence: 0.92,
    severity: 'critical',
    extensions: new Set(['.tsx', '.jsx']),
  },
];

// ─── Version Detection ───────────────────────────────────────────────────────

interface DetectedVersions {
  [sdkKey: string]: string;
}

/**
 * Read package.json (sync, cached per workspace) to detect installed SDK versions.
 * Falls back to known defaults if package.json is unavailable.
 */
function detectSdkVersions(workspaceRoot: string): DetectedVersions {
  const versions: DetectedVersions = {};
  const pkgPath = path.join(workspaceRoot, 'package.json');

  try {
    if (!existsSync(pkgPath)) return versions;
    const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));
    const deps = { ...pkg.dependencies, ...pkg.devDependencies };

    for (const [pkgName, sdkKey] of Object.entries(PACKAGE_TO_SDK)) {
      const ver = deps[pkgName];
      if (typeof ver === 'string') {
        // Extract major version from semver range: "^14.21.0" → "14"
        const major = ver.replace(/^[\^~>=<]*/, '').split('.')[0];
        if (major && /^\d+$/.test(major)) {
          versions[sdkKey] = major;
        }
      }
    }
  } catch { /* package.json read failure — non-fatal */ }

  return versions;
}

// ─── SDK Map Cache ───────────────────────────────────────────────────────────

class SdkMapCache {
  private readonly _cache = new Map<string, SdkMap>();
  private readonly _loading = new Map<string, Promise<SdkMap>>();

  constructor(private readonly _sdkMapsDir: string) {}

  /** Synchronous cache hit. Returns undefined on miss. */
  get(sdk: string, version: string): SdkMap | undefined {
    return this._cache.get(`${sdk}@${version}`);
  }

  /** Load a map from disk. Returns cached if already loaded. */
  async load(sdk: string, version: string): Promise<SdkMap> {
    const key = `${sdk}@${version}`;
    const cached = this._cache.get(key);
    if (cached) return cached;

    // Deduplicate concurrent loads for the same key
    const inflight = this._loading.get(key);
    if (inflight) return inflight;

    const promise = this._loadFromDisk(sdk, version, key);
    this._loading.set(key, promise);

    try {
      return await promise;
    } finally {
      this._loading.delete(key);
    }
  }

  private _warnedSdks = new Set<string>();

  private async _loadFromDisk(sdk: string, version: string, key: string): Promise<SdkMap> {
    try {
      const filePath = path.join(this._sdkMapsDir, sdk, `${version}.json`);
      const raw = await fs.readFile(filePath, 'utf-8');
      const map = JSON.parse(raw) as SdkMap;
      this._cache.set(key, map);
      return map;
    } catch {
      // Warn once per SDK — missing maps mean hallucinated API calls go undetected
      if (!this._warnedSdks.has(sdk)) {
        this._warnedSdks.add(sdk);
        console.warn(`[Guardrail] SDK map not found for ${sdk}@${version} — API validation skipped for this SDK`);
      }
      const empty: SdkMap = {};
      this._cache.set(key, empty);
      return empty;
    }
  }

  /** Pre-warm cache for known SDKs. Non-blocking. */
  async warmup(versions: DetectedVersions, defaults: Record<string, string>): Promise<void> {
    const tasks: Promise<SdkMap>[] = [];
    const allSdks = new Set([...Object.keys(versions), ...Object.keys(defaults)]);

    for (const sdk of allSdks) {
      const version = versions[sdk] ?? defaults[sdk];
      if (version) tasks.push(this.load(sdk, version));
    }

    await Promise.allSettled(tasks);
  }

  clear(): void {
    this._cache.clear();
    this._loading.clear();
  }
}

// ─── Engine ──────────────────────────────────────────────────────────────────

const DEFAULT_VERSIONS: Record<string, string> = {
  stripe: '14',
  openai: '4',
  anthropic: '0',
  prisma: '5',
  supabase: '2',
  firebase: '10',
  resend: '3',
  clerk: '5',
  ai: '3',
  drizzle: '0',
  trpc: '11',
  hono: '4',
  zod: '3',
};

export class APITruthEngine implements ScanEngine {
  readonly id = 'api_truth';

  private readonly _trie = new HallucinationTrie();
  private readonly _patternRules: PatternRule[];
  private readonly _sdkMapCache: SdkMapCache;
  private readonly _confidenceThreshold: number;
  private _sdkVersions: DetectedVersions = {};
  private _activated = false;

  // Stats
  private _stats: EngineStats = {
    filesScanned: 0,
    filesSkipped: 0,
    findingsEmitted: 0,
    hallucationHits: 0,
    sdkMapHits: 0,
    patternRuleHits: 0,
    avgScanMs: 0,
  };
  private _totalScanMs = 0;

  constructor(
    confidenceThreshold: number = 0.75,
    sdkMapsDir?: string,
    private readonly _workspaceRoot?: string
  ) {
    this._confidenceThreshold = confidenceThreshold;
    this._sdkMapCache = new SdkMapCache(
      sdkMapsDir ?? path.join(__dirname, 'sdk-maps')
    );
    this._patternRules = [...DEFAULT_PATTERN_RULES];

    // Build trie from hallucination database
    for (const [hallucinated, correct] of KNOWN_HALLUCINATIONS) {
      this._trie.insert(hallucinated, correct);
    }
  }

  /**
   * Async activation: detect versions from package.json, warm SDK map cache.
   * Call once after construction. Scans will still work without activation
   * (using defaults), but version-specific maps may not be loaded.
   */
  async activate(): Promise<void> {
    if (this._workspaceRoot) {
      this._sdkVersions = detectSdkVersions(this._workspaceRoot);
    }
    await this._sdkMapCache.warmup(this._sdkVersions, DEFAULT_VERSIONS);
    this._activated = true;
  }

  /** Add a custom pattern rule at runtime. */
  addPatternRule(rule: PatternRule): void {
    this._patternRules.push(rule);
  }

  /** Remove a pattern rule by ruleId. */
  removePatternRule(ruleId: string): void {
    const idx = this._patternRules.findIndex(r => r.ruleId === ruleId);
    if (idx !== -1) this._patternRules.splice(idx, 1);
  }

  /** Current engine stats. */
  get stats(): Readonly<EngineStats> {
    return { ...this._stats };
  }

  // ── Main Scan ────────────────────────────────────────────────────────────

  async scan(delta: DeltaContext, signal?: AbortSignal): Promise<Finding[]> {
    if (signal?.aborted) return [];
    const t0 = performance.now();

    try {
      // ── Step 1: Detect imports — skip file if no known SDK imported ───────
      const imports = detectImports(delta.fullText);
      if (imports.length === 0) {
        this._stats.filesSkipped++;
        return [];
      }

      this._stats.filesScanned++;

      // Build a map of localName → sdk for fast lookup during line scanning
      const localToSdk = new Map<string, string>();
      for (const imp of imports) {
        localToSdk.set(imp.localName, imp.sdk);
        // Also map lowercase variant for case-insensitive client names
        localToSdk.set(imp.localName.toLowerCase(), imp.sdk);
      }

      const lines = delta.fullText.split('\n');

      // ── Step 2: Build code regions (comment/string tracking) ─────────────
      const regions = buildCodeRegions(lines);

      // ── Step 3–5: Scan lines ─────────────────────────────────────────────
      const findings: Finding[] = [];

      for (let lineNum = 0; lineNum < lines.length; lineNum++) {
        if (signal?.aborted) break;

        const region = regions[lineNum]!;
        if (region.inComment) continue;

        const line = lines[lineNum]!;

        // ── Layer 1 + 2: SDK call pattern matching ─────────────────────────
        SDK_CALL_RE.lastIndex = 0;
        let m: RegExpExecArray | null;

        while ((m = SDK_CALL_RE.exec(line)) !== null) {
          if (isInString(region, m.index)) continue;

          const objPath = m[1]!;
          const method = m[2]!;;
        const callPath = `${objPath}.${method}`;
        const rootObj = objPath.split('.')[0]!;

        // Only check calls on imported SDK objects
        const sdk = localToSdk.get(rootObj) ?? localToSdk.get(rootObj.toLowerCase());
        if (!sdk) continue;

        // Normalize call path: replace local binding with canonical SDK name
        // e.g., if user wrote `const client = new OpenAI()`, client.chat → openai.chat
        const normalizedPath = callPath.replace(
          new RegExp(`^${rootObj}`, 'i'),
          sdk
        );

        // Layer 1: Trie lookup for known hallucinations
        const knownSuggestion = this._trie.lookup(normalizedPath);
        if (knownSuggestion !== undefined) {
          const confidence = 0.95;
          if (confidence >= this._confidenceThreshold) {
            this._stats.hallucationHits++;
            findings.push({
              id: deterministicId(delta.documentUri, lineNum + 1, m.index, 'HAL002', callPath),
              engine: this.id,
              severity: 'critical',
              category: 'api_truth',
              file: delta.documentUri,
              line: lineNum + 1,
              column: m.index,
              endLine: lineNum + 1,
              endColumn: m.index + callPath.length + 1,
              message: `\`${callPath}()\` does not exist — AI hallucinated this ${sdk} API call`,
              evidence: `${callPath}()`,
              suggestion: `Use: \`${knownSuggestion.replace(sdk, rootObj)}()\``,
              confidence,
              autoFixable: !knownSuggestion.includes('<model>'),
              ruleId: 'HAL002',
            });
          }
          continue; // Don't double-report via SDK map
        }

        // Layer 2: SDK type map validation
        const version = this._sdkVersions[sdk] ?? DEFAULT_VERSIONS[sdk];
        if (!version) continue;

        const map = this._sdkMapCache.get(sdk, version);
        if (!map || Object.keys(map).length === 0) continue;

        // Check if the method exists in the SDK map
        if (map[normalizedPath]?.exists) {
          // Valid call — but check for deprecation
          if (map[normalizedPath]!.deprecated) {
            const replacement = map[normalizedPath]!.replacement;
            findings.push({
              id: deterministicId(delta.documentUri, lineNum + 1, m.index, 'HAL006', callPath),
              engine: this.id,
              severity: 'low',
              category: 'api_truth',
              file: delta.documentUri,
              line: lineNum + 1,
              column: m.index,
              endLine: lineNum + 1,
              endColumn: m.index + callPath.length + 1,
              message: `\`${callPath}()\` is deprecated in ${sdk}@${version}.x`,
              evidence: `${callPath}()`,
              suggestion: replacement
                ? `Use: \`${replacement.replace(sdk, rootObj)}()\``
                : `Check the ${sdk} migration guide for the replacement.`,
              confidence: 0.90,
              autoFixable: !!replacement,
              ruleId: 'HAL006',
            });
          }
          continue;
        }

        // Method not found in SDK map — suggest closest match
        const closest = findClosestMatch(map, normalizedPath);
        const confidence = closest ? 0.84 : 0.78;
        if (confidence < this._confidenceThreshold) continue;

        this._stats.sdkMapHits++;
        findings.push({
          id: deterministicId(delta.documentUri, lineNum + 1, m.index, 'HAL002', callPath),
          engine: this.id,
          severity: 'critical',
          category: 'api_truth',
          file: delta.documentUri,
          line: lineNum + 1,
          column: m.index,
          endLine: lineNum + 1,
          endColumn: m.index + callPath.length + 1,
          message: `\`${callPath}()\` not found in ${sdk}@${version}.x API surface`,
          evidence: `${callPath}()`,
          suggestion: closest
            ? `Did you mean: \`${closest.replace(sdk, rootObj)}()\`?`
            : `Check the ${sdk}@${version}.x docs for the correct method.`,
          confidence,
          autoFixable: !!closest,
          ruleId: 'HAL002',
        });
      }

      // ── Layer 3: Pattern rules ─────────────────────────────────────────
      const fileExt = path.extname(delta.documentUri).toLowerCase();

      for (const rule of this._patternRules) {
        if (rule.confidence < this._confidenceThreshold) continue;
        if (rule.extensions && !rule.extensions.has(fileExt)) continue;

        rule.regex.lastIndex = 0;
        const pm = rule.regex.exec(line);
        if (!pm) continue;
        if (isInString(region, pm.index)) continue;

        this._stats.patternRuleHits++;
        findings.push({
          id: deterministicId(delta.documentUri, lineNum + 1, pm.index, rule.ruleId, pm[0]),
          engine: this.id,
          severity: rule.severity ?? 'high',
          category: 'api_truth',
          file: delta.documentUri,
          line: lineNum + 1,
          column: pm.index,
          endLine: lineNum + 1,
          endColumn: pm.index + pm[0].length,
          message: rule.message,
          evidence: pm[0],
          suggestion: rule.suggestion,
          confidence: rule.confidence,
          autoFixable: false,
          ruleId: rule.ruleId,
        });
      }
    }

    // Update stats
    const elapsed = performance.now() - t0;
    this._totalScanMs += elapsed;
    this._stats.findingsEmitted += findings.length;
    this._stats.avgScanMs = Math.round(this._totalScanMs / this._stats.filesScanned);

    return findings;
  } catch (error) {
    // Enhanced error handling - surface engine failures gracefully
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error(`[APITruthEngine] Scan failed for ${delta.documentUri}:`, errorMsg);
    
    // Return a synthetic finding for the engine failure
    return [{
      id: deterministicId(delta.documentUri, 1, 0, 'ENGINE_ERROR', 'scan_failure'),
      engine: this.id,
      severity: 'medium' as const,
      category: 'engine_error',
      file: delta.documentUri,
      line: 1,
      column: 0,
      endLine: 1,
      endColumn: 0,
      message: `API Truth Engine scan failed: ${errorMsg}`,
      evidence: 'Engine internal error',
      suggestion: 'Check file syntax and report this issue if it persists',
      confidence: 1.0,
      autoFixable: false,
      ruleId: 'ENGINE_ERROR',
    }];
  }
  }

  // ── Lifecycle ────────────────────────────────────────────────────────────

  /** Refresh SDK versions (e.g. after npm install or branch switch). */
  async refreshVersions(): Promise<void> {
    if (this._workspaceRoot) {
      this._sdkVersions = detectSdkVersions(this._workspaceRoot);
    }
    this._sdkMapCache.clear();
    await this._sdkMapCache.warmup(this._sdkVersions, DEFAULT_VERSIONS);
  }

  dispose(): void {
    this._sdkMapCache.clear();
  }
}