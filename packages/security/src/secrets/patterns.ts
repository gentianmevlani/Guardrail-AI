/* patterns.ts
 * Enterprise-grade secret patterns & false-positive controls
 */

import { STRIPE_LIVE_PREFIX } from './stripe-placeholder-prefix';

export enum SecretType {
  API_KEY = 'api_key',
  PASSWORD = 'password',
  TOKEN = 'token',
  CERTIFICATE = 'certificate',
  PRIVATE_KEY = 'private_key',
  DATABASE_URL = 'database_url',
  JWT_SECRET = 'jwt_secret',

  AWS_ACCESS_KEY = 'aws_access_key',
  AWS_SECRET_KEY = 'aws_secret_key',

  GITHUB_TOKEN = 'github_token',
  GOOGLE_API_KEY = 'google_api_key',
  STRIPE_KEY = 'stripe_key',
  SLACK_TOKEN = 'slack_token',

  JWT_TOKEN = 'jwt_token',
  API_KEY_GENERIC = 'api_key_generic',
  PASSWORD_GENERIC = 'password_generic',

  OTHER = 'other',
}

export type RiskLevel = 'high' | 'medium' | 'low';

export interface SecretPattern {
  type: SecretType;
  name: string;

  /**
   * IMPORTANT:
   * - Store patterns WITHOUT the `g` flag (we clone to global during scanning).
   * - Keep needed flags like `i` on this regex; the scanner preserves them.
   */
  pattern: RegExp;

  /**
   * Which capture group contains the actual secret value.
   * If omitted, scanner will use group 1 if present, else group 0.
   */
  valueGroup?: number;

  /**
   * Entropy threshold (Shannon). Used to reduce false positives.
   */
  minEntropy?: number;

  /**
   * Risk drives recommendations & severity.
   */
  risk: RiskLevel;

  description: string;
  examples: string[];

  /**
   * Optional custom redaction for display (safe logging/UI).
   * If omitted, the scanner uses a default masking strategy.
   */
  redact?: (value: string, match: RegExpMatchArray) => string;
}

/**
 * Comprehensive secret detection patterns
 * Notes:
 * - Examples are clearly fake.
 * - Patterns are designed to be high-signal; add more vendors as needed.
 */
export const SECRET_PATTERNS: ReadonlyArray<SecretPattern> = [
  // ---------- AWS ----------
  {
    type: SecretType.AWS_ACCESS_KEY,
    name: 'AWS Access Key ID',
    pattern: /\b(AKIA|ASIA)[0-9A-Z]{16}\b/,
    valueGroup: 0,
    minEntropy: 3.5,
    risk: 'high',
    description: 'AWS Access Key ID (AKIA/ASIA + 16 chars)',
    examples: ['AKIAIOSFODNN7EXAMPLE', 'ASIAIOSFODNN7EXAMPLE'],
  },
  {
    type: SecretType.AWS_SECRET_KEY,
    name: 'AWS Secret Access Key',
    pattern:
      /\baws[_\s-]*secret[_\s-]*access[_\s-]*key\b\s*[=:]\s*['"]?([A-Za-z0-9/+=]{40})['"]?/i,
    valueGroup: 1,
    minEntropy: 4.5,
    risk: 'high',
    description: 'AWS Secret Access Key assigned in config (40 chars)',
    examples: ['aws_secret_access_key = wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY'],
  },

  // ---------- GitHub ----------
  {
    type: SecretType.GITHUB_TOKEN,
    name: 'GitHub Token',
    pattern: /\b(ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9]{36}\b/,
    valueGroup: 0,
    risk: 'high',
    description: 'GitHub personal/app tokens (ghp_/gho_/...)',
    examples: ['ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx'],
  },

  // ---------- Google ----------
  {
    type: SecretType.GOOGLE_API_KEY,
    name: 'Google API Key',
    pattern: /\bAIza[0-9A-Za-z\-_]{35}\b/,
    valueGroup: 0,
    risk: 'medium',
    description: 'Google API Key (AIzA...)',
    examples: ['AIzaSyDaGmWKa4JsXZ-HjGw7ISLn_3namBGewQe'],
  },

  // ---------- Stripe ----------
  {
    type: SecretType.STRIPE_KEY,
    name: 'Stripe Live Secret/Public/Restricted Key',
    pattern: /\b(sk_live|pk_live|rk_live)_[0-9A-Za-z]{24,}\b/,
    valueGroup: 0,
    risk: 'high',
    description: 'Stripe live keys (sk_live / pk_live / rk_live)',
    examples: [STRIPE_LIVE_PREFIX + '0'.repeat(24)],
  },

  // ---------- Slack ----------
  {
    type: SecretType.SLACK_TOKEN,
    name: 'Slack Token',
    pattern: /\b(xox[pboa]-\d{10,13}-\d{10,13}-\d{10,13}-[a-z0-9]{32})\b/,
    valueGroup: 1,
    risk: 'high',
    description: 'Slack bot/user/app tokens (xoxb/xoxp/xoxa/xoxo)',
    examples: ['xoxb-0000000000-0000000000-0000000000-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx'],
  },

  // ---------- JWT ----------
  {
    type: SecretType.JWT_TOKEN,
    name: 'JWT Token',
    pattern: /\b(eyJ[0-9A-Za-z_-]*\.[0-9A-Za-z_-]*\.[0-9A-Za-z_-]+)\b/,
    valueGroup: 1,
    minEntropy: 4.0,
    risk: 'medium',
    description: 'JSON Web Token (header.payload.signature)',
    examples: [
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U',
    ],
  },

  // ---------- Private keys / certs ----------
  {
    type: SecretType.PRIVATE_KEY,
    name: 'Private Key Block',
    pattern:
      /(-----BEGIN (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----[\s\S]*?-----END (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----)/,
    valueGroup: 1,
    risk: 'high',
    description: 'PEM private key blocks (RSA/EC/OpenSSH/DSA)',
    examples: ['-----BEGIN PRIVATE KEY-----\\nMIIEvQIBADANBgk...\\n-----END PRIVATE KEY-----'],
  },

  // ---------- Database URLs (credentials embedded) ----------
  {
    type: SecretType.DATABASE_URL,
    name: 'Database URL with Embedded Credentials',
    pattern:
      /\b(postgres(?:ql)?|mysql|mongodb(?:\+srv)?|redis):\/\/([^:\s\/]+):([^@\s\/]+)@([A-Za-z0-9.-]+)(?::(\d{2,5}))?(\/[^\s'"]*)?/i,
    valueGroup: 0,
    risk: 'high',
    description: 'Connection string contains username:password@host',
    examples: ['postgresql://user:password123@localhost:5432/dbname'],
    redact: (_value, match) => {
      const scheme = match[1] ?? 'db';
      const host = match[4] ?? 'host';
      const port = match[5] ? `:${match[5]}` : '';
      return `${scheme}://***:***@${host}${port}/***`;
    },
  },

  // ---------- Generic high-entropy API keys ----------
  {
    type: SecretType.API_KEY_GENERIC,
    name: 'Generic API Key / Token Assignment',
    pattern:
      /\b(?:api[_\s-]?key|apikey|access[_\s-]?token|auth[_\s-]?token|secret[_\s-]?key)\b[_\s]*[=:]\s*['"]?([A-Za-z0-9_\-]{32,})['"]?/i,
    valueGroup: 1,
    minEntropy: 4.0,
    risk: 'medium',
    description: 'Generic API key/token (assignment + long value)',
    examples: ['api_key = abcdef1234567890abcdef1234567890'],
  },

  // ---------- Generic password assignment ----------
  {
    type: SecretType.PASSWORD_GENERIC,
    name: 'Generic Password Assignment',
    pattern: /\b(?:password|passwd|pwd)\b\s*[=:]\s*['"]([^'"]{8,128})['"]/i,
    valueGroup: 1,
    minEntropy: 3.5,
    risk: 'medium',
    description: 'Password-like assignment (quoted, 8–128 chars)',
    examples: ['password = "MySecretP@ssw0rd"'],
  },
];

/**
 * Test/example value patterns (used for down-weighting confidence, optional exclusion).
 */
export const TEST_PATTERNS: ReadonlyArray<RegExp> = [
  /test/i,
  /example/i,
  /sample/i,
  /demo/i,
  /fake/i,
  /dummy/i,
  /placeholder/i,
  /changeme/i,
  /your[_-]?key/i,
  /your[_-]?secret/i,
  /password123/i,
];

/**
 * Context patterns that are strongly associated with false positives (schemas/validators/etc).
 * Scanner uses these to skip matches in certain code lines.
 */
export const CONTEXT_EXCLUSION_PATTERNS: ReadonlyArray<RegExp> = [
  /\.min\s*\(/i,
  /\.max\s*\(/i,
  /\.length\b/i,
  /\bschema\b/i,
  /\bvalidation\b/i,
  /\bvalidator\b/i,
  /\.string\s*\(/i,
  /\.required\b/i,
  /\.optional\b/i,
  /\bzod\./i,
  /\byup\./i,
  /\bjoi\./i,

  /__tests__/i,
  /__mocks__/i,
  /\bmock\b/i,
  /\bstub\b/i,
  /\bfixture\b/i,

  /\bprocess\.env\b/i,
  /\benv\./i,
  /\bconfig\./i,
  /\bsettings\./i,
  /\boptions\./i,
  /\bparams\./i,
  /\bprops\./i,
];

/**
 * Common false positive literal values
 */
export const FALSE_POSITIVE_VALUES = new Set<string>([
  'example',
  'test',
  'sample',
  'demo',
  'placeholder',
  'your_key_here',
  'your_secret_here',
  'xxx',
  'yyy',
  'zzz',
  '***',
  '000000000000',
  '111111111111',
  'abcdefghijklmnopqrstuvwxyz',
  'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
  '1234567890',
]);
