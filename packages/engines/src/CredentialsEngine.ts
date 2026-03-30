/**
 * CredentialsEngine v2.0 — Detects hardcoded API keys, secrets, passwords, tokens,
 * and connection strings in source code.
 *
 * 25+ patterns covering: Stripe, AWS, OpenAI, Anthropic, GitHub, Google,
 * HuggingFace, Slack, SendGrid, Twilio, npm, Supabase, Clerk, Vercel,
 * Discord, Linear + generic JWT/password/secret/PEM + URL-embedded credentials.
 *
 * Features:
 *   - Evidence masking: secrets are redacted in finding output (never echoed)
 *   - URL credential detection: mongodb://user:pass@host, redis://default:pass@host
 *   - Entropy-based filtering: placeholder values (xxxx, test, etc.) are skipped
 *   - Context-aware severity: critical paths (/api/, /auth/) escalate findings
 *   - Deduplication: deterministic FNV-1a finding IDs
 *
 * Latency target: <20ms per file
 */

import type { Finding, DeltaContext, ScanEngine } from './core-types';
import {
  stripePkLiveQuotedRegex20,
  stripeSkLiveRegex20MultiLine,
  stripeSkTestQuotedRegex20,
} from 'guardrail-security/secrets/stripe-placeholder-prefix';

/** FNV-1a deterministic hash → stable finding IDs across re-scans */
function deterministicId(uri: string, line: number, ruleId: string, patternName: string): string {
  const input = `cred:${uri}::${line}::${ruleId}::${patternName}`;
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = (hash * 0x01000193) >>> 0;
  }
  return `cred-${hash.toString(16).padStart(8, '0')}`;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function isTestFile(uri: string): boolean {
  return (
    /\.(test|spec)\.(ts|tsx|js|jsx)$/i.test(uri) ||
    /(?:^|\/)(?:__tests__|__mocks__|tests?|fixtures?|e2e|spec|cypress|playwright|__snapshots__|__fixtures__|stubs?|mocks?|test[-_]?data|test[-_]?helpers?|test[-_]?utils?)\//i.test(uri) ||
    /\.(?:mock|fixture|stub)\.[^/]*$/i.test(uri)
  );
}

function isExampleFile(uri: string): boolean {
  return /\.(?:example|sample|template)\b/.test(uri) || /\.env\.(?:example|sample)\b/.test(uri);
}

/** Values that are obviously fake / placeholder — not real credentials */
const FAKE_VALUE_PATTERNS = /(?:test|example|sample|dummy|fake|placeholder|xxx+|your[-_]|changeme|todo|mock|fixture|replace[-_]?me|insert[-_]?here|fill[-_]?in|update[-_]?me|secret|password|change[-_]?this|put[-_]?here|add[-_]?your|enter[-_]?your|sk[-_]test|pk[-_]test|demo|default|replace|temp|tmp|foobar|foo|bar|baz|qux|lorem|ipsum|abc|1234|0000)/i;

/** Entropy-based check: real secrets have high char diversity; placeholders don't */
function hasLowEntropy(value: string): boolean {
  const unique = new Set(value.toLowerCase()).size;
  // Very repetitive values like "xxxxxxxxxxxx" or "000000000" are clearly fake
  return unique <= 4 && value.length >= 8;
}

function isFakeCredentialValue(value: string): boolean {
  if (value.length < 8) return true;
  if (FAKE_VALUE_PATTERNS.test(value)) return true;
  if (hasLowEntropy(value)) return true;
  // All-lowercase or all-uppercase short values with simple structure are likely config keys, not secrets
  if (value.length < 16 && /^[a-z_-]+$/.test(value)) return true;
  return false;
}

function isCriticalPath(uri: string): boolean {
  return /\/api\/|\/auth\/|\/payment|\/billing|\/admin|\/checkout|\/webhook|\/security|middleware\.(ts|js)|\/lib\/auth|\/lib\/db|\/lib\/stripe/.test(uri);
}

function escalate(severity: Finding['severity'], critical: boolean): Finding['severity'] {
  if (!critical) return severity;
  const up: Record<string, Finding['severity']> = {
    low: 'medium',
    medium: 'high',
    high: 'critical',
    critical: 'critical',
  };
  return up[severity] ?? severity;
}

/** Mask secrets in evidence output — never echo real credentials in findings */
function maskEvidence(evidence: string): string {
  // Mask specific key formats
  return evidence
    // Stripe keys: mask live/test secret tails after sk_ + (live|test) + _
    .replace(/(sk_(?:live|test)_)[a-zA-Z0-9]{4,}/g, '$1****')
    .replace(/(pk_(?:live|test)_)[a-zA-Z0-9]{4,}/g, '$1****')
    // AWS keys: AKIA... → AKIA****
    .replace(/(AKIA)[0-9A-Z]{12,}/g, '$1****')
    // OpenAI/Anthropic: sk-... → sk-****
    .replace(/(sk-(?:ant-)?)[a-zA-Z0-9-]{8,}/g, '$1****')
    // GitHub tokens: ghp_xxxx → ghp_****
    .replace(/(gh[po]_)[a-zA-Z0-9]{4,}/g, '$1****')
    // Slack tokens: xoxb-... → xoxb-****
    .replace(/(xox[bpoas]-)[0-9a-zA-Z-]{4,}/g, '$1****')
    // SendGrid: SG.xxx.xxx → SG.****
    .replace(/(SG\.)[a-zA-Z0-9_-]{4,}/g, '$1****')
    // npm tokens: npm_xxxx → npm_****
    .replace(/(npm_)[a-zA-Z0-9]{4,}/g, '$1****')
    // HuggingFace: hf_xxxx → hf_****
    .replace(/(hf_)[a-zA-Z0-9]{4,}/g, '$1****')
    // Google: AIza... → AIza****
    .replace(/(AIza)[0-9A-Za-z_-]{4,}/g, '$1****')
    // PlanetScale: pscale_tkn_xxx → pscale_tkn_****
    .replace(/(pscale_(?:tkn|pw)_)[a-zA-Z0-9_]{4,}/g, '$1****')
    // Databricks: dapixxx → dapi****
    .replace(/(dapi)[a-f0-9]{4,}/g, '$1****')
    // Mailgun: key-xxx → key-****
    .replace(/(key-)[a-f0-9]{4,}/g, '$1****')
    // PostHog: phc_xxx → phc_****
    .replace(/(phc_)[a-zA-Z0-9]{4,}/g, '$1****')
    // Linear: lin_api_xxx → lin_api_****
    .replace(/(lin_api_)[a-zA-Z0-9]{4,}/g, '$1****')
    // Resend: re_xxx → re_****
    .replace(/(re_)[a-zA-Z0-9]{4,}/g, '$1****')
    // Discord: mask bot tokens
    .replace(/([MN][A-Za-z\d]{23,})\.[^'"` ]{6,}/g, '$1.****')
    // Connection strings: mask password in URLs
    .replace(/:\/\/([^:]+):([^@]{4,})@/g, '://$1:****@')
    // Generic long hex/base64 sequences (likely secrets)
    .replace(/['"`]([a-zA-Z0-9+/=_-]{32,})['"`]/g, (m, val) => m.replace(val, val.slice(0, 4) + '****'));
}

// ─── Pattern definition ───────────────────────────────────────────────────────

interface CredPattern {
  name: string;
  ruleId: string;
  regex: RegExp;
  severity: 'critical' | 'high' | 'medium' | 'low';
  message: string;
  suggestion: string;
  /** 0-100 */
  confidence: number;
  /** Flag even inside test files */
  flagInTests: boolean;
  /** Skip in .example / .sample / .template */
  skipInExamples: boolean;
}

const PATTERNS: CredPattern[] = [
  // ── Stripe ──
  {
    name: 'stripe-live-secret',
    ruleId: 'CRED001',
    regex: stripeSkLiveRegex20MultiLine(),
    severity: 'critical',
    message: 'Stripe live secret key hardcoded',
    suggestion: 'Move to process.env.STRIPE_SECRET_KEY and add to .env (gitignored).',
    confidence: 99,
    flagInTests: true,
    skipInExamples: false,
  },
  {
    name: 'stripe-live-publishable',
    ruleId: 'CRED001',
    regex: stripePkLiveQuotedRegex20(),
    severity: 'high',
    message: 'Stripe live publishable key hardcoded',
    suggestion: 'Use process.env.NEXT_PUBLIC_STRIPE_KEY',
    confidence: 95,
    flagInTests: false,
    skipInExamples: true,
  },
  {
    name: 'stripe-test-secret',
    ruleId: 'CRED001',
    regex: stripeSkTestQuotedRegex20(),
    severity: 'high',
    message: 'Stripe test secret key hardcoded — use env var even for test keys',
    suggestion: 'Use process.env.STRIPE_TEST_KEY',
    confidence: 90,
    flagInTests: false,
    skipInExamples: true,
  },

  // ── AWS ──
  {
    name: 'aws-access-key',
    ruleId: 'CRED001',
    regex: /['"`](AKIA[0-9A-Z]{16})['"`]/,
    severity: 'critical',
    message: 'AWS Access Key ID hardcoded',
    suggestion: 'Use AWS SDK credential chain or AWS_ACCESS_KEY_ID env var.',
    confidence: 99,
    flagInTests: true,
    skipInExamples: false,
  },
  {
    name: 'aws-secret-key',
    ruleId: 'CRED001',
    regex: /aws_secret_access_key\s*[:=]\s*['"`]([^'"`]{20,})['"`]/i,
    severity: 'critical',
    message: 'AWS Secret Access Key hardcoded',
    suggestion: 'Use AWS_SECRET_ACCESS_KEY environment variable.',
    confidence: 98,
    flagInTests: true,
    skipInExamples: false,
  },

  // ── AI providers ──
  {
    name: 'openai-key',
    ruleId: 'CRED001',
    regex: /['"`](sk-[a-zA-Z0-9]{32,})['"`]/,
    severity: 'critical',
    message: 'OpenAI API key hardcoded',
    suggestion: 'Use process.env.OPENAI_API_KEY',
    confidence: 92,
    flagInTests: true,
    skipInExamples: false,
  },
  {
    name: 'anthropic-key',
    ruleId: 'CRED001',
    regex: /['"`](sk-ant-[a-zA-Z0-9-]{20,})['"`]/,
    severity: 'critical',
    message: 'Anthropic API key hardcoded',
    suggestion: 'Use process.env.ANTHROPIC_API_KEY',
    confidence: 98,
    flagInTests: true,
    skipInExamples: false,
  },

  // ── GitHub ──
  {
    name: 'github-pat',
    ruleId: 'CRED001',
    regex: /['"`](ghp_[a-zA-Z0-9]{36,})['"`]/,
    severity: 'critical',
    message: 'GitHub personal access token hardcoded',
    suggestion: 'Use process.env.GITHUB_TOKEN',
    confidence: 99,
    flagInTests: true,
    skipInExamples: false,
  },
  {
    name: 'github-oauth',
    ruleId: 'CRED001',
    regex: /['"`](gho_[a-zA-Z0-9]{36,})['"`]/,
    severity: 'critical',
    message: 'GitHub OAuth token hardcoded',
    suggestion: 'Use process.env.GITHUB_OAUTH_TOKEN',
    confidence: 99,
    flagInTests: true,
    skipInExamples: false,
  },

  // ── Google ──
  {
    name: 'google-api-key',
    ruleId: 'CRED001',
    regex: /['"`](AIza[0-9A-Za-z_-]{35,})['"`]/,
    severity: 'high',
    message: 'Google API key hardcoded',
    suggestion: 'Use process.env.GOOGLE_API_KEY',
    confidence: 95,
    flagInTests: false,
    skipInExamples: false,
  },

  // ── Generic secrets ──
  {
    name: 'jwt-secret',
    ruleId: 'CRED003',
    regex: /(?:jwt[_-]?secret|JWT_SECRET)\s*[:=]\s*['"`]([^'"`]{8,})['"`]/i,
    severity: 'critical',
    message: 'JWT signing secret hardcoded — anyone with this can forge auth tokens',
    suggestion: 'Store in JWT_SECRET environment variable and rotate regularly.',
    confidence: 90,
    flagInTests: false,
    skipInExamples: true,
  },
  {
    name: 'generic-password',
    ruleId: 'CRED002',
    regex: /(?:password|passwd|pwd)\s*[:=]\s*['"`]([^'"`]{4,})['"`]/i,
    severity: 'high',
    message: 'Hardcoded password detected',
    suggestion: 'Use an environment variable or secrets manager (Vault, AWS Secrets Manager).',
    confidence: 75,
    flagInTests: false,
    skipInExamples: true,
  },
  {
    name: 'generic-secret',
    ruleId: 'CRED002',
    regex: /(?:secret|api[_-]?key|auth[_-]?token)\s*[:=]\s*['"`]([^'"`]{8,})['"`]/i,
    severity: 'high',
    message: 'Hardcoded secret / token detected',
    suggestion: 'Use an environment variable.',
    confidence: 70,
    flagInTests: false,
    skipInExamples: true,
  },
  {
    name: 'private-key-pem',
    ruleId: 'CRED004',
    regex: /-----BEGIN (?:RSA |EC |DSA |OPENSSH )?PRIVATE KEY-----/,
    severity: 'critical',
    message: 'Private key embedded in source code',
    suggestion: 'Store key in a file and reference its path via env var.',
    confidence: 99,
    flagInTests: true,
    skipInExamples: false,
  },
  {
    name: 'connection-string',
    ruleId: 'CRED005',
    regex: /['"`](?:mongodb(?:\+srv)?|postgres(?:ql)?|mysql|redis|amqp):\/\/[^'"`\s]{10,}['"`]/i,
    severity: 'critical',
    message: 'Database connection string with credentials in source',
    suggestion: 'Use DATABASE_URL environment variable.',
    confidence: 92,
    flagInTests: false,
    skipInExamples: true,
  },

  // ── SaaS tokens ──
  {
    name: 'slack-token',
    ruleId: 'CRED001',
    regex: /['"`](xox[bpoas]-[0-9a-zA-Z-]{10,})['"`]/,
    severity: 'critical',
    message: 'Slack token hardcoded',
    suggestion: 'Use process.env.SLACK_TOKEN',
    confidence: 97,
    flagInTests: true,
    skipInExamples: false,
  },
  {
    name: 'sendgrid-key',
    ruleId: 'CRED001',
    regex: /['"`](SG\.[a-zA-Z0-9_-]{22,}\.[a-zA-Z0-9_-]{43,})['"`]/,
    severity: 'critical',
    message: 'SendGrid API key hardcoded',
    suggestion: 'Use process.env.SENDGRID_API_KEY',
    confidence: 99,
    flagInTests: true,
    skipInExamples: false,
  },
  {
    name: 'twilio-key',
    ruleId: 'CRED001',
    regex: /['"`](SK[a-f0-9]{32})['"`]/,
    severity: 'high',
    message: 'Twilio API key hardcoded',
    suggestion: 'Use process.env.TWILIO_API_KEY',
    confidence: 85,
    flagInTests: false,
    skipInExamples: true,
  },
  {
    name: 'npm-token',
    ruleId: 'CRED001',
    regex: /['"`](npm_[a-zA-Z0-9]{36,})['"`]/,
    severity: 'critical',
    message: 'npm auth token hardcoded',
    suggestion: 'Use .npmrc with env var interpolation: //registry.npmjs.org/:_authToken=${NPM_TOKEN}',
    confidence: 98,
    flagInTests: true,
    skipInExamples: false,
  },
  {
    name: 'huggingface-token',
    ruleId: 'CRED001',
    regex: /['"`](hf_[a-zA-Z0-9]{30,})['"`]/,
    severity: 'critical',
    message: 'HuggingFace API token hardcoded',
    suggestion: 'Use process.env.HUGGINGFACE_TOKEN',
    confidence: 97,
    flagInTests: true,
    skipInExamples: false,
  },

  // ── Additional SaaS tokens ──
  {
    name: 'supabase-service-key',
    ruleId: 'CRED001',
    regex: /['"`](eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9\.[a-zA-Z0-9_-]{50,}\.[a-zA-Z0-9_-]{20,})['"`]/,
    severity: 'critical',
    message: 'Supabase service role key hardcoded — grants admin access to your database',
    suggestion: 'Use process.env.SUPABASE_SERVICE_ROLE_KEY. Never expose service role keys client-side.',
    confidence: 88,
    flagInTests: true,
    skipInExamples: false,
  },
  {
    name: 'clerk-secret-key',
    ruleId: 'CRED001',
    regex: /['"`](sk_(?:live|test)_[a-zA-Z0-9]{20,})['"`]/,
    severity: 'critical',
    message: 'Clerk secret key hardcoded',
    suggestion: 'Use process.env.CLERK_SECRET_KEY',
    confidence: 90,
    flagInTests: true,
    skipInExamples: false,
  },
  {
    name: 'vercel-token',
    ruleId: 'CRED001',
    regex: /['"`]([a-zA-Z0-9]{24})['"`](?=.*(?:vercel|VERCEL))/i,
    severity: 'high',
    message: 'Vercel API token hardcoded',
    suggestion: 'Use process.env.VERCEL_TOKEN',
    confidence: 80,
    flagInTests: false,
    skipInExamples: true,
  },
  {
    name: 'discord-bot-token',
    ruleId: 'CRED001',
    regex: /['"`]([MN][A-Za-z\d]{23,}\.[\w-]{6}\.[\w-]{27,})['"`]/,
    severity: 'critical',
    message: 'Discord bot token hardcoded',
    suggestion: 'Use process.env.DISCORD_BOT_TOKEN',
    confidence: 95,
    flagInTests: true,
    skipInExamples: false,
  },
  {
    name: 'linear-api-key',
    ruleId: 'CRED001',
    regex: /['"`](lin_api_[a-zA-Z0-9]{30,})['"`]/,
    severity: 'critical',
    message: 'Linear API key hardcoded',
    suggestion: 'Use process.env.LINEAR_API_KEY',
    confidence: 98,
    flagInTests: true,
    skipInExamples: false,
  },
  {
    name: 'resend-api-key',
    ruleId: 'CRED001',
    regex: /['"`](re_[a-zA-Z0-9]{20,})['"`]/,
    severity: 'critical',
    message: 'Resend API key hardcoded',
    suggestion: 'Use process.env.RESEND_API_KEY',
    confidence: 90,
    flagInTests: true,
    skipInExamples: false,
  },

  // ── Cloud Providers ──
  {
    name: 'gcp-service-account-key',
    ruleId: 'CRED001',
    regex: /['"`](\{[^'"`]*"type"\s*:\s*"service_account"[^'"`]*\})['"`]/,
    severity: 'critical',
    message: 'GCP service account key JSON hardcoded — grants full cloud access',
    suggestion: 'Use GOOGLE_APPLICATION_CREDENTIALS env var pointing to a key file outside the repo.',
    confidence: 98,
    flagInTests: true,
    skipInExamples: false,
  },
  {
    name: 'gcp-api-key',
    ruleId: 'CRED001',
    regex: /['"`](AIza[0-9A-Za-z_-]{35})['"`]/,
    severity: 'high',
    message: 'Google Cloud / Firebase API key hardcoded',
    suggestion: 'Use process.env.GOOGLE_API_KEY or restrict the key in GCP console.',
    confidence: 95,
    flagInTests: false,
    skipInExamples: true,
  },
  {
    name: 'azure-storage-key',
    ruleId: 'CRED001',
    regex: /(?:AccountKey|azure_storage_key|AZURE_STORAGE_KEY)\s*[:=]\s*['"`]([A-Za-z0-9+/=]{44,})['"`]/i,
    severity: 'critical',
    message: 'Azure Storage account key hardcoded',
    suggestion: 'Use process.env.AZURE_STORAGE_KEY or Managed Identity for authentication.',
    confidence: 90,
    flagInTests: true,
    skipInExamples: false,
  },
  {
    name: 'azure-connection-string',
    ruleId: 'CRED005',
    regex: /['"`]DefaultEndpointsProtocol=https?;AccountName=[^;]+;AccountKey=[^'"`]{20,}['"`]/,
    severity: 'critical',
    message: 'Azure connection string with credentials hardcoded',
    suggestion: 'Use process.env.AZURE_STORAGE_CONNECTION_STRING',
    confidence: 98,
    flagInTests: true,
    skipInExamples: false,
  },
  {
    name: 'cloudflare-api-token',
    ruleId: 'CRED001',
    regex: /['"`]([A-Za-z0-9_-]{40})['"`](?=.*(?:cloudflare|CLOUDFLARE|CF_))/i,
    severity: 'critical',
    message: 'Cloudflare API token hardcoded',
    suggestion: 'Use process.env.CLOUDFLARE_API_TOKEN',
    confidence: 82,
    flagInTests: true,
    skipInExamples: false,
  },
  {
    name: 'planetscale-token',
    ruleId: 'CRED001',
    regex: /['"`](pscale_tkn_[a-zA-Z0-9_]{20,})['"`]/,
    severity: 'critical',
    message: 'PlanetScale API token hardcoded',
    suggestion: 'Use process.env.PLANETSCALE_TOKEN',
    confidence: 98,
    flagInTests: true,
    skipInExamples: false,
  },
  {
    name: 'planetscale-password',
    ruleId: 'CRED001',
    regex: /['"`](pscale_pw_[a-zA-Z0-9_]{20,})['"`]/,
    severity: 'critical',
    message: 'PlanetScale database password hardcoded',
    suggestion: 'Use process.env.DATABASE_PASSWORD or PlanetScale connection string from env.',
    confidence: 98,
    flagInTests: true,
    skipInExamples: false,
  },
  {
    name: 'neon-connection-string',
    ruleId: 'CRED005',
    regex: /['"`]postgres(?:ql)?:\/\/[^'"`]*\.neon\.tech[^'"`]*['"`]/i,
    severity: 'critical',
    message: 'Neon database connection string hardcoded',
    suggestion: 'Use process.env.DATABASE_URL',
    confidence: 95,
    flagInTests: false,
    skipInExamples: true,
  },
  {
    name: 'turso-auth-token',
    ruleId: 'CRED001',
    regex: /(?:TURSO_AUTH_TOKEN|authToken)\s*[:=]\s*['"`](eyJ[a-zA-Z0-9_-]{20,}\.[a-zA-Z0-9_-]{20,})['"`]/i,
    severity: 'critical',
    message: 'Turso database auth token hardcoded',
    suggestion: 'Use process.env.TURSO_AUTH_TOKEN',
    confidence: 92,
    flagInTests: true,
    skipInExamples: false,
  },
  {
    name: 'upstash-redis-token',
    ruleId: 'CRED001',
    regex: /(?:UPSTASH_REDIS_REST_TOKEN|upstash.*token)\s*[:=]\s*['"`]([A-Za-z0-9]{20,})['"`]/i,
    severity: 'critical',
    message: 'Upstash Redis REST token hardcoded',
    suggestion: 'Use process.env.UPSTASH_REDIS_REST_TOKEN',
    confidence: 88,
    flagInTests: true,
    skipInExamples: false,
  },
  {
    name: 'databricks-token',
    ruleId: 'CRED001',
    regex: /['"`](dapi[a-f0-9]{32})['"`]/,
    severity: 'critical',
    message: 'Databricks API token hardcoded',
    suggestion: 'Use process.env.DATABRICKS_TOKEN',
    confidence: 96,
    flagInTests: true,
    skipInExamples: false,
  },
  {
    name: 'telegram-bot-token',
    ruleId: 'CRED001',
    regex: /['"`](\d{8,10}:[A-Za-z0-9_-]{35})['"`]/,
    severity: 'critical',
    message: 'Telegram bot token hardcoded',
    suggestion: 'Use process.env.TELEGRAM_BOT_TOKEN',
    confidence: 92,
    flagInTests: true,
    skipInExamples: false,
  },
  {
    name: 'postmark-server-token',
    ruleId: 'CRED001',
    regex: /['"`]([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})['"`](?=.*(?:postmark|POSTMARK))/i,
    severity: 'critical',
    message: 'Postmark server token hardcoded',
    suggestion: 'Use process.env.POSTMARK_SERVER_TOKEN',
    confidence: 85,
    flagInTests: true,
    skipInExamples: false,
  },
  {
    name: 'mailgun-api-key',
    ruleId: 'CRED001',
    regex: /['"`](key-[a-f0-9]{32})['"`]/,
    severity: 'critical',
    message: 'Mailgun API key hardcoded',
    suggestion: 'Use process.env.MAILGUN_API_KEY',
    confidence: 95,
    flagInTests: true,
    skipInExamples: false,
  },
  {
    name: 'algolia-admin-key',
    ruleId: 'CRED001',
    regex: /['"`]([a-f0-9]{32})['"`](?=.*(?:algolia|ALGOLIA).*(?:admin|ADMIN))/i,
    severity: 'critical',
    message: 'Algolia admin API key hardcoded',
    suggestion: 'Use process.env.ALGOLIA_ADMIN_API_KEY. Use search-only keys client-side.',
    confidence: 82,
    flagInTests: true,
    skipInExamples: false,
  },
  {
    name: 'sentry-dsn',
    ruleId: 'CRED001',
    regex: /['"`](https:\/\/[a-f0-9]{32}@[a-z0-9]+\.ingest\.sentry\.io\/\d+)['"`]/,
    severity: 'medium',
    message: 'Sentry DSN hardcoded — consider using env var for environment-specific DSNs',
    suggestion: 'Use process.env.SENTRY_DSN (or NEXT_PUBLIC_SENTRY_DSN for client-side).',
    confidence: 85,
    flagInTests: false,
    skipInExamples: true,
  },
  {
    name: 'posthog-api-key',
    ruleId: 'CRED001',
    regex: /['"`](phc_[a-zA-Z0-9]{20,})['"`]/,
    severity: 'medium',
    message: 'PostHog API key hardcoded — use env var for environment isolation',
    suggestion: 'Use process.env.NEXT_PUBLIC_POSTHOG_KEY',
    confidence: 90,
    flagInTests: false,
    skipInExamples: true,
  },

  // ── URL-embedded credentials ──
  {
    name: 'url-embedded-credentials',
    ruleId: 'CRED006',
    regex: /['"`]https?:\/\/[^'"`\s]*:[^'"`\s@]*@[^'"`\s]+['"`]/,
    severity: 'high',
    message: 'URL contains embedded credentials (user:password@host)',
    suggestion: 'Move credentials to environment variables. Use URL without auth: https://host/path',
    confidence: 85,
    flagInTests: false,
    skipInExamples: true,
  },
];

// ─── Engine ───────────────────────────────────────────────────────────────────

export class CredentialsEngine implements ScanEngine {
  readonly id = 'credentials' as const;

  async scan(delta: DeltaContext, signal?: AbortSignal): Promise<Finding[]> {
    if (signal?.aborted) return [];
    const uri = delta.documentUri;
    const isTest = isTestFile(uri);
    const isExample = isExampleFile(uri);
    const critical = isCriticalPath(uri);

    const findings: Finding[] = [];
    const lines = delta.fullText.split('\n');

    for (let i = 0; i < lines.length; i++) {
      if (signal?.aborted) break;
      const line = lines[i]!;
      const trimmed = line.trim();

      // Skip comment-only lines
      if (trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('#')) continue;

      for (const pattern of PATTERNS) {
        if (isTest && !pattern.flagInTests) continue;
        if (isExample && pattern.skipInExamples) continue;

        const match = pattern.regex.exec(line);
        if (!match) continue;

        // Extra FP guards for loose patterns (CRED002, CRED003)
        if (pattern.ruleId === 'CRED002' || pattern.ruleId === 'CRED003') {
          const val = match[1] ?? '';
          if (!val) continue;
          if (isFakeCredentialValue(val)) continue;
          // Skip type definitions, interfaces, and schema declarations
          if (/(?:type\s|interface\s|Schema|schema|zod\.|z\.|yup\.|joi\.|@param|@type|PropTypes)/.test(line)) continue;
          // Skip lines that are setting env vars (the whole point is to NOT hardcode)
          if (/process\.env\.|import\.meta\.env\./.test(line)) continue;
        }
        if (pattern.name === 'generic-password') {
          const val = match[1] ?? '';
          if (!val || val.length < 6) continue;
          if (isFakeCredentialValue(val)) continue;
        }
        if (pattern.name === 'generic-secret') {
          const val = match[1] ?? '';
          if (!val || /^[a-z_]+$/i.test(val)) continue;
          if (isFakeCredentialValue(val)) continue;
        }

        findings.push({
          id: deterministicId(uri, i + 1, pattern.ruleId, pattern.name),
          engine: 'credentials',
          severity: escalate(pattern.severity, critical),
          category: 'credentials',
          file: uri,
          line: i + 1,
          column: match.index ?? 0,
          message: pattern.message,
          evidence: maskEvidence(trimmed),
          suggestion: pattern.suggestion,
          confidence: pattern.confidence / 100,
          autoFixable: false,
          ruleId: pattern.ruleId,
        });
      }
    }

    return findings;
  }
}
