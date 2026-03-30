import { describe, it, expect } from 'vitest';
import { CredentialsEngine } from '../CredentialsEngine.js';
import type { DeltaContext, Finding } from '../core-types';
import {
  PK_LIVE_PREFIX,
  STRIPE_LIVE_PREFIX,
  STRIPE_TEST_PREFIX,
} from './stripe-placeholder-prefix.js';
import {
  FAKE_SLACK_XOXB_PREFIX,
  GHP_MASK_PREFIX,
  HF_MASK_PREFIX,
  SG_MASK_PREFIX,
  fakeDiscordBotTokenBody,
  fakeGithubPatBody,
  fakeHuggingFaceTokenBody,
  fakeSendGridKeyBody,
  fakeSlackBotTokenBody,
  fakeTwilioApiKeyBody,
} from './fake-credential-samples.js';

const fakeSkLive = (): string => STRIPE_LIVE_PREFIX + 'a'.repeat(30);
const fakeSkTest = (): string => STRIPE_TEST_PREFIX + 'a'.repeat(30);
const fakePkLive = (): string => PK_LIVE_PREFIX + 'a'.repeat(30);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeDelta(code: string, uri = '/src/app.ts'): DeltaContext {
  return {
    documentUri: uri,
    documentLanguage: 'typescript',
    fullText: code,
    changedRanges: [{ start: 0, end: code.length }],
    changedText: code,
  };
}

async function scan(code: string, uri?: string): Promise<Finding[]> {
  const engine = new CredentialsEngine();
  return engine.scan(makeDelta(code, uri));
}

async function expectDetection(code: string, opts?: { patternName?: string; uri?: string }): Promise<Finding> {
  const findings = await scan(code, opts?.uri);
  expect(findings.length).toBeGreaterThanOrEqual(1);
  if (opts?.patternName) {
    const f = findings.find((f) => f.message.toLowerCase().includes(opts.patternName!.toLowerCase()));
    expect(f, `Expected finding matching "${opts.patternName}"`).toBeDefined();
    return f!;
  }
  return findings[0]!;
}

async function expectNoDetection(code: string, uri?: string): Promise<void> {
  const findings = await scan(code, uri);
  expect(findings, `Expected no findings but got ${findings.length}: ${findings.map((f) => f.message).join(', ')}`).toHaveLength(0);
}

// ---------------------------------------------------------------------------
// Engine identity
// ---------------------------------------------------------------------------

describe('CredentialsEngine', () => {
  it('has id "credentials"', () => {
    const engine = new CredentialsEngine();
    expect(engine.id).toBe('credentials');
  });

  it('returns empty array for clean code', async () => {
    const findings = await scan('const x = 1;\nconsole.log("hello");');
    expect(findings).toEqual([]);
  });

  // =========================================================================
  // TRUE POSITIVES — every pattern type
  // =========================================================================

  describe('true positives', () => {
    // ── Stripe ──
    it('detects Stripe live secret key', async () => {
      const f = await expectDetection(
        `const key = "${fakeSkLive()}";`,
      );
      expect(f.severity).toBe('critical');
      expect(f.engine).toBe('credentials');
      expect(f.ruleId).toBe('CRED001');
    });

    it('detects Stripe live publishable key', async () => {
      const f = await expectDetection(
        `const pk = "${fakePkLive()}";`,
      );
      expect(f.severity).toBe('high');
    });

    it('detects Stripe test secret key', async () => {
      await expectDetection(
        `const testKey = "${fakeSkTest()}";`,
      );
    });

    // ── AWS ──
    it('detects AWS access key ID', async () => {
      const f = await expectDetection(
        `const aws = "AKIAIOSFODNN7EXAMPLE";`,
      );
      expect(f.severity).toBe('critical');
      expect(f.confidence).toBe(0.99);
    });

    it('detects AWS secret access key', async () => {
      const f = await expectDetection(
        `aws_secret_access_key = "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY";`,
      );
      expect(f.severity).toBe('critical');
    });

    // ── AI providers ──
    it('detects OpenAI API key', async () => {
      const f = await expectDetection(
        `const openai = "sk-proj1234567890abcdefghijklmnopqrstuv";`,
      );
      expect(f.severity).toBe('critical');
    });

    it('detects Anthropic API key', async () => {
      const f = await expectDetection(
        `const anthropic = "sk-ant-api03-abcdefghijklmnopqrstuvwxyz";`,
      );
      expect(f.severity).toBe('critical');
    });

    // ── GitHub ──
    it('detects GitHub personal access token', async () => {
      const f = await expectDetection(
        `const ghToken = "${fakeGithubPatBody()}";`,
      );
      expect(f.severity).toBe('critical');
      expect(f.confidence).toBe(0.99);
    });

    it('detects GitHub OAuth token', async () => {
      await expectDetection(
        `const token = "gho_ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmn";`,
      );
    });

    // ── Google ──
    it('detects Google API key', async () => {
      await expectDetection(
        `const gKey = "AIzaSyA1234567890abcdefghijklmnopqrstu_v";`,
      );
    });

    // ── JWT secret ──
    it('detects hardcoded JWT secret', async () => {
      const f = await expectDetection(
        `JWT_SECRET = "Rk9PQkFSXzEyMzQ1Njc4OTBhYmNkZWY=";`,
      );
      expect(f.ruleId).toBe('CRED003');
      expect(f.severity).toBe('critical');
    });

    // ── Generic password ──
    it('detects hardcoded password', async () => {
      const f = await expectDetection(
        `const password = "s3cUr3P@ssw0rd!!";`,
      );
      expect(f.ruleId).toBe('CRED002');
    });

    // ── Generic secret ──
    it('detects hardcoded generic secret', async () => {
      const f = await expectDetection(
        `const api_key = "a8f4b2c1d9e7f3a5b6c8d0e2f4a7b9c1";`,
      );
      expect(f.ruleId).toBe('CRED002');
    });

    // ── PEM private key ──
    it('detects PEM private key', async () => {
      const f = await expectDetection(
        `const key = \`-----BEGIN RSA PRIVATE KEY-----\nMIIBogIBAAJBALRiM...\n-----END RSA PRIVATE KEY-----\`;`,
      );
      expect(f.severity).toBe('critical');
      expect(f.ruleId).toBe('CRED004');
    });

    it('detects generic private key header', async () => {
      await expectDetection(
        `-----BEGIN PRIVATE KEY-----`,
      );
    });

    it('detects EC private key', async () => {
      await expectDetection(
        `-----BEGIN EC PRIVATE KEY-----`,
      );
    });

    // ── Connection strings ──
    it('detects postgres connection string', async () => {
      const f = await expectDetection(
        `const db = "postgresql://admin:s3cret@db.example.com:5432/mydb";`,
      );
      expect(f.severity).toBe('critical');
      expect(f.ruleId).toBe('CRED005');
    });

    it('detects mongodb connection string', async () => {
      await expectDetection(
        `const mongo = "mongodb+srv://user:p4ssw0rd@cluster0.abc123.mongodb.net/app";`,
      );
    });

    it('detects redis connection string', async () => {
      await expectDetection(
        `const redis = "redis://default:mypassw0rd@redis-12345.c1.us-east.ec2.cloud.redislabs.com:12345";`,
      );
    });

    // ── SaaS tokens ──
    it('detects Slack bot token', async () => {
      const f = await expectDetection(
        `const slack = "${fakeSlackBotTokenBody()}";`,
      );
      expect(f.severity).toBe('critical');
    });

    it('detects SendGrid API key', async () => {
      await expectDetection(
        `const sg = "${fakeSendGridKeyBody()}";`,
      );
    });

    it('detects Twilio API key', async () => {
      await expectDetection(
        `const twilio = "${fakeTwilioApiKeyBody()}";`,
      );
    });

    it('detects npm token', async () => {
      await expectDetection(
        `const npm = "npm_AbCdEfGhIjKlMnOpQrStUvWxYz0123456789ab";`,
      );
    });

    it('detects HuggingFace token', async () => {
      await expectDetection(
        `const hf = "${fakeHuggingFaceTokenBody()}";`,
      );
    });

    // ── Additional SaaS ──
    it('detects Supabase service role key (JWT)', async () => {
      await expectDetection(
        `const supabase = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRlc3RpbmciLCJyb2xlIjoic2VydmljZV9yb2xlIiwiaWF0IjoxNjQwMDAwMDAwLCJleHAiOjE5NTU2MDAwMDB9.AbCdEfGhIjKlMnOpQrStUv";`,
      );
    });

    it('detects Clerk secret key', async () => {
      // Clerk uses Stripe-style secret key prefixes (overlaps stripe-live-secret pattern)
      await expectDetection(
        `const clerk = "${fakeSkLive()}";`,
      );
    });

    it('detects Discord bot token', async () => {
      await expectDetection(
        `const discord = "${fakeDiscordBotTokenBody()}";`,
      );
    });

    it('detects Linear API key', async () => {
      await expectDetection(
        `const linear = "lin_api_AbCdEfGhIjKlMnOpQrStUvWxYz012345";`,
      );
    });

    it('detects Resend API key', async () => {
      await expectDetection(
        `const resend = "re_AbCdEfGhIjKlMnOpQrStUv";`,
      );
    });

    // ── URL-embedded credentials ──
    it('detects URL-embedded credentials (http)', async () => {
      await expectDetection(
        `const url = "https://admin:s3cret@api.example.com/v1";`,
      );
    });
  });

  // =========================================================================
  // TRUE NEGATIVES — false positive prevention
  // =========================================================================

  describe('true negatives (false positive prevention)', () => {
    // ── Fake / placeholder values ──
    it('skips placeholder "test" values in password', async () => {
      await expectNoDetection(`const password = "test_password_here";`);
    });

    it('skips placeholder "example" values', async () => {
      await expectNoDetection(`const api_key = "example-api-key-value";`);
    });

    it('skips placeholder "changeme" values', async () => {
      await expectNoDetection(`const secret = "changeme_please_update";`);
    });

    it('skips placeholder "xxxx" values', async () => {
      await expectNoDetection(`const api_key = "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx";`);
    });

    it('skips "your-" prefixed values', async () => {
      await expectNoDetection(`const secret = "your-secret-key-here";`);
    });

    it('skips "replace-me" values', async () => {
      await expectNoDetection(`const secret = "replace-me-with-real-key";`);
    });

    it('skips short password values (< 6 chars)', async () => {
      await expectNoDetection(`const password = "abc";`);
    });

    // ── Type definitions and interfaces ──
    it('skips type definitions', async () => {
      await expectNoDetection(`type Config = { secret: "my_very_real_secret_value_123" };`);
    });

    it('skips interface declarations', async () => {
      await expectNoDetection(`interface AuthConfig { jwt_secret: "my_very_real_secret_value_123" };`);
    });

    it('skips zod schema definitions', async () => {
      await expectNoDetection(`const schema = z.object({ secret: "my_very_real_secret_value_123" });`);
    });

    // ── process.env references ──
    it('skips process.env references', async () => {
      await expectNoDetection(`const secret = process.env.JWT_SECRET;`);
    });

    it('skips import.meta.env references', async () => {
      await expectNoDetection(`const key = import.meta.env.VITE_API_KEY;`);
    });

    // ── Test files should not flag non-critical patterns ──
    it('does not flag generic password in test files', async () => {
      await expectNoDetection(
        `const password = "s3cUr3P@ssw0rd!!";`,
        '/src/__tests__/auth.test.ts',
      );
    });

    it('does not flag generic secret in test files', async () => {
      await expectNoDetection(
        `const api_key = "a8f4b2c1d9e7f3a5b6c8d0e2f4a7b9c1";`,
        '/src/tests/helper.test.ts',
      );
    });

    it('does not flag JWT secret in test files', async () => {
      await expectNoDetection(
        `JWT_SECRET = "Rk9PQkFSXzEyMzQ1Njc4OTBhYmNkZWY=";`,
        '/tests/auth.spec.ts',
      );
    });

    it('does not flag connection strings in test files', async () => {
      await expectNoDetection(
        `const db = "postgresql://admin:s3cret@db.example.com:5432/mydb";`,
        '/src/__tests__/db.test.ts',
      );
    });

    it('does not flag URL-embedded credentials in test files', async () => {
      await expectNoDetection(
        `const url = "https://admin:s3cret@api.example.com/v1";`,
        '/e2e/api.test.ts',
      );
    });

    // ── Example files should skip patterns with skipInExamples ──
    it('skips Stripe publishable key in example files', async () => {
      await expectNoDetection(
        `const key = "${fakePkLive()}";`,
        '/config.example.ts',
      );
    });

    it('skips generic password in example files', async () => {
      await expectNoDetection(
        `const password = "s3cUr3P@ssw0rd!!";`,
        '/app.sample.ts',
      );
    });

    it('skips connection strings in .env.example files', async () => {
      await expectNoDetection(
        `const db = "postgresql://admin:s3cret@db.example.com:5432/mydb";`,
        '/.env.example',
      );
    });

    // ── Comments should be skipped ──
    it('skips single-line // comments', async () => {
      await expectNoDetection(`// const key = "${fakeSkLive()}";`);
    });

    it('skips * comment lines (doc comments)', async () => {
      await expectNoDetection(`* password = "${fakeSkLive()}";`);
    });

    it('skips # comment lines', async () => {
      await expectNoDetection(`# API_KEY = "${fakeSkLive()}";`);
    });

    // ── Clean env usage ──
    it('does not flag env var assignment patterns', async () => {
      await expectNoDetection(
        `const dbUrl = process.env.DATABASE_URL ?? "default";`,
      );
    });

    // ── Values that are all lowercase short config-style ──
    it('skips short all-lowercase config-style values for generic secret', async () => {
      await expectNoDetection(`const api_key = "my-config-key";`);
    });
  });

  // =========================================================================
  // EVIDENCE MASKING
  // =========================================================================

  describe('evidence masking', () => {
    it('masks Stripe live secret key in evidence', async () => {
      const f = await expectDetection(
        `const key = "${fakeSkLive()}";`,
      );
      expect(f.evidence).toContain(`${STRIPE_LIVE_PREFIX}****`);
      expect(f.evidence).not.toContain(fakeSkLive());
    });

    it('masks AWS access key in evidence', async () => {
      const f = await expectDetection(
        `const aws = "AKIAIOSFODNN7EXAMPLE";`,
      );
      expect(f.evidence).toContain('AKIA****');
      expect(f.evidence).not.toContain('AKIAIOSFODNN7EXAMPLE');
    });

    it('masks OpenAI key in evidence', async () => {
      const f = await expectDetection(
        `const key = "sk-proj1234567890abcdefghijklmnopqrstuv";`,
      );
      expect(f.evidence).toContain('sk-****');
      expect(f.evidence).not.toContain('sk-proj1234567890abcdefghijklmnopqrstuv');
    });

    it('masks Anthropic key in evidence', async () => {
      const f = await expectDetection(
        `const key = "sk-ant-api03-abcdefghijklmnopqrstuvwxyz";`,
      );
      expect(f.evidence).toContain('sk-ant-****');
      expect(f.evidence).not.toContain('sk-ant-api03-abcdefghijklmnopqrstuvwxyz');
    });

    it('masks GitHub PAT in evidence', async () => {
      const pat = fakeGithubPatBody();
      const f = await expectDetection(
        `const token = "${pat}";`,
      );
      expect(f.evidence).toContain(`${GHP_MASK_PREFIX}****`);
      expect(f.evidence).not.toContain(pat);
    });

    it('masks Slack token in evidence', async () => {
      const tok = fakeSlackBotTokenBody();
      const f = await expectDetection(
        `const slack = "${tok}";`,
      );
      expect(f.evidence).toContain(`${FAKE_SLACK_XOXB_PREFIX}****`);
      expect(f.evidence).not.toContain(tok);
    });

    it('masks SendGrid key in evidence', async () => {
      const sgKey = fakeSendGridKeyBody();
      const f = await expectDetection(
        `const sg = "${sgKey}";`,
      );
      expect(f.evidence).toContain(`${SG_MASK_PREFIX}****`);
      expect(f.evidence).not.toContain(sgKey);
    });

    it('masks npm token in evidence', async () => {
      const f = await expectDetection(
        `const npm = "npm_AbCdEfGhIjKlMnOpQrStUvWxYz0123456789ab";`,
      );
      expect(f.evidence).toContain('npm_****');
      expect(f.evidence).not.toContain('npm_AbCdEfGhIjKlMnOpQrStUvWxYz');
    });

    it('masks HuggingFace token in evidence', async () => {
      const hfTok = fakeHuggingFaceTokenBody();
      const f = await expectDetection(
        `const hf = "${hfTok}";`,
      );
      expect(f.evidence).toContain(`${HF_MASK_PREFIX}****`);
      expect(f.evidence).not.toContain(hfTok);
    });

    it('masks password in connection string evidence', async () => {
      const f = await expectDetection(
        `const db = "postgresql://admin:s3cretP4ss@db.example.com:5432/mydb";`,
      );
      expect(f.evidence).toContain('://admin:****@');
      expect(f.evidence).not.toContain('s3cretP4ss');
    });

    it('masks Google API key in evidence', async () => {
      const f = await expectDetection(
        `const gKey = "AIzaSyA1234567890abcdefghijklmnopqrstu_v";`,
      );
      expect(f.evidence).toContain('AIza****');
      expect(f.evidence).not.toContain('AIzaSyA1234567890');
    });
  });

  // =========================================================================
  // DETERMINISTIC IDS
  // =========================================================================

  describe('deterministic IDs', () => {
    it('produces the same ID for the same input across re-scans', async () => {
      const code = `const key = "${fakeSkLive()}";`;
      const [first] = await scan(code);
      const [second] = await scan(code);
      expect(first!.id).toBe(second!.id);
    });

    it('produces different IDs for different files', async () => {
      const code = `const key = "${fakeSkLive()}";`;
      const [a] = await scan(code, '/src/a.ts');
      const [b] = await scan(code, '/src/b.ts');
      expect(a!.id).not.toBe(b!.id);
    });

    it('produces different IDs for different line positions', async () => {
      const codeA = `const key = "${fakeSkLive()}";`;
      const codeB = `// comment\nconst key = "${fakeSkLive()}";`;
      const [a] = await scan(codeA);
      const [b] = await scan(codeB);
      // Line 1 vs line 2
      expect(a!.id).not.toBe(b!.id);
    });

    it('ID has "cred-" prefix followed by 8 hex chars', async () => {
      const [f] = await scan(`const key = "${fakeSkLive()}";`);
      expect(f!.id).toMatch(/^cred-[0-9a-f]{8}$/);
    });
  });

  // =========================================================================
  // SEVERITY ESCALATION
  // =========================================================================

  describe('severity escalation for critical paths', () => {
    it('escalates high to critical in /api/ path', async () => {
      const f = await expectDetection(
        `const password = "s3cUr3P@ssw0rd!!";`,
        { uri: '/src/api/auth/login.ts' },
      );
      expect(f.severity).toBe('critical');
    });

    it('escalates high to critical in /auth/ path', async () => {
      const f = await expectDetection(
        `const password = "s3cUr3P@ssw0rd!!";`,
        { uri: '/src/auth/session.ts' },
      );
      expect(f.severity).toBe('critical');
    });

    it('escalates in middleware files', async () => {
      const f = await expectDetection(
        `const password = "s3cUr3P@ssw0rd!!";`,
        { uri: '/src/middleware.ts' },
      );
      expect(f.severity).toBe('critical');
    });

    it('escalates in /payment/ paths', async () => {
      const f = await expectDetection(
        `const password = "s3cUr3P@ssw0rd!!";`,
        { uri: '/src/payment/stripe.ts' },
      );
      expect(f.severity).toBe('critical');
    });

    it('escalates in /lib/auth paths', async () => {
      const f = await expectDetection(
        `const password = "s3cUr3P@ssw0rd!!";`,
        { uri: '/src/lib/auth/verify.ts' },
      );
      expect(f.severity).toBe('critical');
    });

    it('escalates in /webhook/ paths', async () => {
      const f = await expectDetection(
        `const password = "s3cUr3P@ssw0rd!!";`,
        { uri: '/src/webhook/handler.ts' },
      );
      expect(f.severity).toBe('critical');
    });

    it('does NOT escalate on non-critical paths', async () => {
      const f = await expectDetection(
        `const password = "s3cUr3P@ssw0rd!!";`,
        { uri: '/src/utils/format.ts' },
      );
      expect(f.severity).toBe('high');
    });

    it('already-critical stays critical (no overflow)', async () => {
      // Stripe live key is already critical; critical path shouldn't break anything
      const f = await expectDetection(
        `const key = "${fakeSkLive()}";`,
        { uri: '/src/api/payments.ts' },
      );
      expect(f.severity).toBe('critical');
    });
  });

  // =========================================================================
  // LOW ENTROPY FILTERING
  // =========================================================================

  describe('low entropy filtering', () => {
    it('filters out all-x repeated chars in generic secret', async () => {
      await expectNoDetection(`const api_key = "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx";`);
    });

    it('filters out all-zero repeated chars', async () => {
      await expectNoDetection(`const secret = "00000000000000000000000000000000";`);
    });

    it('filters out all-a repeated chars', async () => {
      await expectNoDetection(`const secret = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";`);
    });

    it('does NOT filter high-entropy values', async () => {
      // This has high character diversity
      await expectDetection(
        `const api_key = "a8f4b2c1d9e7f3a5b6c8d0e2f4a7b9c1";`,
      );
    });
  });

  // =========================================================================
  // FINDING STRUCTURE
  // =========================================================================

  describe('finding structure', () => {
    it('includes all required Finding fields', async () => {
      const [f] = await scan(`const key = "${fakeSkLive()}";`);
      expect(f).toBeDefined();
      expect(f!.id).toBeDefined();
      expect(f!.engine).toBe('credentials');
      expect(f!.severity).toBeDefined();
      expect(f!.category).toBe('credentials');
      expect(f!.file).toBe('/src/app.ts');
      expect(f!.line).toBe(1);
      expect(typeof f!.column).toBe('number');
      expect(f!.message).toBeDefined();
      expect(f!.evidence).toBeDefined();
      expect(f!.suggestion).toBeDefined();
      expect(typeof f!.confidence).toBe('number');
      expect(f!.confidence).toBeGreaterThan(0);
      expect(f!.confidence).toBeLessThanOrEqual(1);
      expect(f!.autoFixable).toBe(false);
      expect(f!.ruleId).toBeDefined();
    });

    it('reports correct line number for multi-line file', async () => {
      const code = [
        'const a = 1;',
        'const b = 2;',
        'const c = 3;',
        `const key = "${fakeSkLive()}";`,
        'const d = 4;',
      ].join('\n');
      const [f] = await scan(code);
      expect(f!.line).toBe(4);
    });

    it('detects multiple findings in one file', async () => {
      const code = [
        `const stripe = "${fakeSkLive()}";`,
        'const aws = "AKIAIOSFODNN7EXAMPLE";',
        '-----BEGIN RSA PRIVATE KEY-----',
      ].join('\n');
      const findings = await scan(code);
      expect(findings.length).toBeGreaterThanOrEqual(3);
    });
  });

  // =========================================================================
  // ABORT SIGNAL (basic)
  // =========================================================================

  describe('abort signal', () => {
    it('accepts an AbortSignal without error', async () => {
      const engine = new CredentialsEngine();
      const controller = new AbortController();
      const findings = await engine.scan(
        makeDelta(`const key = "${fakeSkLive()}";`),
        controller.signal,
      );
      expect(findings.length).toBeGreaterThanOrEqual(1);
    });
  });

  // =========================================================================
  // TEST FILE + flagInTests interaction
  // =========================================================================

  describe('flagInTests patterns still fire in test files', () => {
    it('flags Stripe live secret key even in test files', async () => {
      await expectDetection(
        `const key = "${fakeSkLive()}";`,
        { uri: '/src/__tests__/integration.test.ts' },
      );
    });

    it('flags AWS access key even in test files', async () => {
      await expectDetection(
        `const aws = "AKIAIOSFODNN7EXAMPLE";`,
        { uri: '/tests/aws.spec.ts' },
      );
    });

    it('flags PEM private key even in test files', async () => {
      await expectDetection(
        `-----BEGIN PRIVATE KEY-----`,
        { uri: '/src/fixtures/keys.test.ts' },
      );
    });

    it('flags GitHub PAT even in test files', async () => {
      await expectDetection(
        `const t = "${fakeGithubPatBody()}";`,
        { uri: '/tests/github.test.ts' },
      );
    });

    it('flags Slack token even in test files', async () => {
      await expectDetection(
        `const s = "${fakeSlackBotTokenBody()}";`,
        { uri: '/src/__tests__/slack.test.ts' },
      );
    });
  });

  // =========================================================================
  // EXAMPLE FILE — non-skipInExamples patterns still fire
  // =========================================================================

  describe('example files: non-skipInExamples patterns still fire', () => {
    it('flags Stripe live secret in example files (skipInExamples=false)', async () => {
      await expectDetection(
        `const key = "${fakeSkLive()}";`,
        { uri: '/config.example.ts' },
      );
    });

    it('flags AWS access key in example files', async () => {
      await expectDetection(
        `const aws = "AKIAIOSFODNN7EXAMPLE";`,
        { uri: '/.env.sample' },
      );
    });

    it('flags PEM key in example files', async () => {
      await expectDetection(
        `-----BEGIN RSA PRIVATE KEY-----`,
        { uri: '/keys.template.ts' },
      );
    });
  });

  // =========================================================================
  // EDGE CASES
  // =========================================================================

  describe('edge cases', () => {
    it('handles empty input', async () => {
      const findings = await scan('');
      expect(findings).toEqual([]);
    });

    it('handles input with only comments', async () => {
      const code = [
        `// ${fakeSkLive()}`,
        '# AKIAIOSFODNN7EXAMPLE',
        '* password = "secret"',
      ].join('\n');
      await expectNoDetection(code);
    });

    it('handles inline code after comment prefix gracefully', async () => {
      // Lines starting with // are skipped entirely
      await expectNoDetection(`// const key = "${fakeSkLive()}";`);
    });

    it('Stripe key without quotes is still detected (space-delimited)', async () => {
      // The stripe live secret regex has a branch for non-quoted values
      const findings = await scan(`STRIPE_KEY= ${fakeSkLive()}`);
      expect(findings.length).toBeGreaterThanOrEqual(1);
    });

    it('handles whitespace-only input', async () => {
      const findings = await scan('   \n  \n\t\t\n');
      expect(findings).toEqual([]);
    });

    it('detects secrets in single-quoted strings', async () => {
      const findings = await scan(`const key = '${fakeSkLive()}';`);
      expect(findings.length).toBeGreaterThanOrEqual(1);
      expect(findings[0]!.message).toContain('Stripe live secret');
    });

    it('detects secrets in backtick template literals', async () => {
      const findings = await scan(`const key = \`${fakeSkLive()}\`;`);
      expect(findings.length).toBeGreaterThanOrEqual(1);
      expect(findings[0]!.message).toContain('Stripe live secret');
    });
  });

  // =========================================================================
  // ADDITIONAL PEM KEY VARIANTS
  // =========================================================================

  describe('PEM private key variants', () => {
    it('detects DSA private key', async () => {
      const f = await expectDetection(`-----BEGIN DSA PRIVATE KEY-----`);
      expect(f.ruleId).toBe('CRED004');
    });

    it('detects OPENSSH private key', async () => {
      const f = await expectDetection(`-----BEGIN OPENSSH PRIVATE KEY-----`);
      expect(f.ruleId).toBe('CRED004');
    });

    it('detects EC private key within multi-line block', async () => {
      const code = [
        'const cert = `',
        '-----BEGIN EC PRIVATE KEY-----',
        'MHQCAQEEIODg5FKo...truncated',
        '-----END EC PRIVATE KEY-----',
        '`;',
      ].join('\n');
      const findings = await scan(code);
      expect(findings.some((f) => f.ruleId === 'CRED004')).toBe(true);
    });
  });

  // =========================================================================
  // ADDITIONAL CONNECTION STRING VARIANTS
  // =========================================================================

  describe('additional connection string variants', () => {
    it('detects mysql connection string', async () => {
      const f = await expectDetection(
        `const db = "mysql://root:p4ssw0rd@mysql.host.com:3306/production_db";`,
      );
      expect(f.ruleId).toBe('CRED005');
    });

    it('detects amqp connection string', async () => {
      const f = await expectDetection(
        `const amqp = "amqp://guest:guestpass@rabbit.host.com:5672/myqueue";`,
      );
      expect(f.ruleId).toBe('CRED005');
    });

    it('detects mongodb+srv connection string', async () => {
      const f = await expectDetection(
        `const mongo = "mongodb+srv://admin:Str0ngP4ss@cluster0.abc123.mongodb.net/app?retryWrites=true";`,
      );
      expect(f.ruleId).toBe('CRED005');
    });
  });

  // =========================================================================
  // ADDITIONAL SLACK TOKEN VARIANTS
  // =========================================================================

  describe('Slack token variants', () => {
    it('detects xoxp- (user) token', async () => {
      const f = await expectDetection(
        `const token = "xoxp-123456789012-1234567890-AbCdEfGhIjKlMnOpQrStUv";`,
      );
      expect(f.message).toContain('Slack token');
    });

    it('detects xoxa- (app) token', async () => {
      const f = await expectDetection(
        `const token = "xoxa-123456789012-1234567890123-AbCdEfGhIjKlMnOpQrStUvWx";`,
      );
      expect(f.message).toContain('Slack token');
    });

    it('detects xoxs- (session) token', async () => {
      const f = await expectDetection(
        `const token = "xoxs-123456789012-1234567890123-AbCdEfGhIjKlMnOpQrStUvWx";`,
      );
      expect(f.message).toContain('Slack token');
    });
  });

  // =========================================================================
  // EXTENDED TEST FILE PATH PATTERNS
  // =========================================================================

  describe('test file path pattern recognition', () => {
    const paths = [
      '/src/auth.test.ts',
      '/src/auth.spec.tsx',
      '/src/auth.Test.JS',
      '/src/__tests__/auth.ts',
      '/src/__mocks__/config.ts',
      '/tests/integration/setup.ts',
      '/test/helper.ts',
      '/e2e/stripe.ts',
      '/spec/unit/auth.ts',
      '/cypress/support/commands.ts',
      '/playwright/fixtures/auth.ts',
      '/src/__snapshots__/foo.ts',
      '/src/__fixtures__/seed.ts',
      '/src/stubs/api.ts',
      '/src/mocks/stripe.ts',
      '/src/test-data/users.ts',
      '/src/test-helpers/setup.ts',
      '/src/test-utils/db.ts',
      '/src/test_data/fixtures.ts',
      '/src/test_helpers/auth.ts',
      '/src/test_utils/mocks.ts',
      '/src/utils.mock.ts',
      '/src/utils.fixture.ts',
      '/src/utils.stub.ts',
    ];

    for (const p of paths) {
      it(`recognizes "${p}" as a test file and skips non-flagInTests patterns`, async () => {
        // generic-password has flagInTests=false — should be skipped
        await expectNoDetection(`const password = "s3cUr3P@ssw0rd!!";`, p);
      });
    }
  });

  // =========================================================================
  // EXTENDED EXAMPLE FILE PATH PATTERNS
  // =========================================================================

  describe('example file path pattern recognition', () => {
    it('recognizes .template files', async () => {
      // jwt-secret has skipInExamples=true
      await expectNoDetection(
        `JWT_SECRET = "Rk9PQkFSXzEyMzQ1Njc4OTBhYmNkZWY=";`,
        '/config.template.ts',
      );
    });

    it('recognizes .sample files', async () => {
      await expectNoDetection(
        `const db = "postgresql://admin:s3cret@db.example.com:5432/mydb";`,
        '/db.sample.yaml',
      );
    });

    it('recognizes .env.sample', async () => {
      await expectNoDetection(
        `JWT_SECRET = "Rk9PQkFSXzEyMzQ1Njc4OTBhYmNkZWY=";`,
        '/.env.sample',
      );
    });
  });

  // =========================================================================
  // EXTENDED FAKE VALUE PATTERNS
  // =========================================================================

  describe('extended fake value detection', () => {
    it('skips "dummy" values', async () => {
      await expectNoDetection(`const secret = "dummy_secret_placeholder_value";`);
    });

    it('skips "fake" values', async () => {
      await expectNoDetection(`const api_key = "fake_api_key_for_testing_value";`);
    });

    it('skips "placeholder" values', async () => {
      await expectNoDetection(`const secret = "placeholder_secret_key_here";`);
    });

    it('skips "mock" values', async () => {
      await expectNoDetection(`const api_key = "mock_api_key_for_unit_tests";`);
    });

    it('skips "fixture" values', async () => {
      await expectNoDetection(`const secret = "fixture_secret_key_value_here";`);
    });

    it('skips "insert-here" values', async () => {
      await expectNoDetection(`const api_key = "insert-here-your-real-key-abc";`);
    });

    it('skips "fill-in" values', async () => {
      await expectNoDetection(`const secret = "fill-in-your-secret-key-value";`);
    });

    it('skips "update-me" values', async () => {
      await expectNoDetection(`const api_key = "update-me-with-your-real-key1";`);
    });

    it('skips "demo" values', async () => {
      await expectNoDetection(`const secret = "demo_secret_key_for_development";`);
    });

    it('skips "default" values', async () => {
      await expectNoDetection(`const api_key = "default_api_key_please_change";`);
    });

    it('skips "temp" values', async () => {
      await expectNoDetection(`const secret = "temp_secret_key_value_replace";`);
    });

    it('skips "foobar" values', async () => {
      await expectNoDetection(`const api_key = "foobar_test_placeholder_key_1";`);
    });

    it('skips "lorem" values', async () => {
      await expectNoDetection(`const secret = "lorem_ipsum_dolor_sit_amet_value";`);
    });

    it('skips "add-your" values', async () => {
      await expectNoDetection(`const api_key = "add-your-api-key-here-please";`);
    });

    it('skips "enter-your" values', async () => {
      await expectNoDetection(`const secret = "enter-your-secret-key-here-abc";`);
    });

    it('skips "change-this" values', async () => {
      await expectNoDetection(`const api_key = "change-this-to-your-real-key-1";`);
    });

    it('skips "put-here" values', async () => {
      await expectNoDetection(`const secret = "put-here-your-real-secret-key1";`);
    });
  });

  // =========================================================================
  // EXTENDED LOW ENTROPY TESTS
  // =========================================================================

  describe('extended low entropy filtering', () => {
    it('filters "abababababababababababababababab" (2 unique chars)', async () => {
      await expectNoDetection(`const secret = "abababababababababababababababab";`);
    });

    it('filters "111111111111111111111111" (1 unique char)', async () => {
      await expectNoDetection(`const api_key = "111111111111111111111111";`);
    });

    it('does NOT filter "aB3$fGh!jK9mNpQrStUvWx" (high entropy)', async () => {
      await expectDetection(`const api_key = "aB3fGh8jK9mNpQrStUvWxYz";`);
    });
  });

  // =========================================================================
  // EXTENDED SCHEMA / TYPE EXCLUSIONS FOR CRED002/CRED003
  // =========================================================================

  describe('extended schema/type exclusion for CRED002/CRED003', () => {
    it('skips yup schema definitions', async () => {
      await expectNoDetection(
        `const schema = yup.object({ password: "R3alP@ssw0rdValue!" });`,
      );
    });

    it('skips joi schema definitions', async () => {
      await expectNoDetection(
        `const schema = joi.string().default({ api_key: "realApiKeyValue12345678" });`,
      );
    });

    it('skips @type JSDoc annotations', async () => {
      await expectNoDetection(
        `/** @type {string} */ const secret = "mySuperSecretValue12345678";`,
      );
    });

    it('skips PropTypes lines', async () => {
      await expectNoDetection(
        `password: PropTypes.string, secret = "defaultSecretValue12345678";`,
      );
    });

    it('skips Schema keyword lines', async () => {
      await expectNoDetection(
        `const UserSchema = { password: "R3alDefaultP@ssw0rd" };`,
      );
    });

    it('does NOT skip CRED001 patterns on type/interface lines', async () => {
      // Provider-specific keys (CRED001) should still fire on schema lines
      const findings = await scan(
        `type Config = { key: "${fakeSkLive()}" };`,
      );
      expect(findings.some((f) => f.ruleId === 'CRED001')).toBe(true);
    });

    it('does NOT skip CRED004 (PEM key) on schema lines', async () => {
      const findings = await scan(
        `interface Keys { priv: "-----BEGIN RSA PRIVATE KEY-----" };`,
      );
      expect(findings.some((f) => f.ruleId === 'CRED004')).toBe(true);
    });
  });

  // =========================================================================
  // EXTENDED process.env / import.meta.env TESTS
  // =========================================================================

  describe('extended process.env exclusion', () => {
    it('skips process.env fallback for CRED002 password', async () => {
      await expectNoDetection(
        `const pwd = process.env.DB_PASSWORD || "fallbackPassw0rd!";`,
      );
    });

    it('skips process.env fallback for CRED003 jwt_secret', async () => {
      await expectNoDetection(
        `const jwt_secret = process.env.JWT_SECRET ?? "devJwtFallbackSecret2024!";`,
      );
    });

    it('skips import.meta.env fallback for CRED002 secret', async () => {
      await expectNoDetection(
        `const secret = import.meta.env.VITE_SECRET || "devSecretFallback12345";`,
      );
    });

    it('does NOT skip CRED001 patterns with process.env on the same line', async () => {
      const findings = await scan(
        `const key = process.env.KEY || "${fakeSkLive()}";`,
      );
      expect(findings.some((f) => f.ruleId === 'CRED001')).toBe(true);
    });

    it('does NOT skip CRED004 patterns with process.env on the same line', async () => {
      const findings = await scan(
        `const key = process.env.PRIVATE_KEY || "-----BEGIN RSA PRIVATE KEY-----";`,
      );
      expect(findings.some((f) => f.ruleId === 'CRED004')).toBe(true);
    });
  });

  // =========================================================================
  // EXTENDED SEVERITY ESCALATION PATHS
  // =========================================================================

  describe('extended severity escalation paths', () => {
    it('escalates in /billing/ paths', async () => {
      const f = await expectDetection(
        `const password = "s3cUr3P@ssw0rd!!";`,
        { uri: '/src/billing/invoice.ts' },
      );
      expect(f.severity).toBe('critical');
    });

    it('escalates in /admin/ paths', async () => {
      const f = await expectDetection(
        `const password = "s3cUr3P@ssw0rd!!";`,
        { uri: '/src/admin/users.ts' },
      );
      expect(f.severity).toBe('critical');
    });

    it('escalates in /checkout/ paths', async () => {
      const f = await expectDetection(
        `const password = "s3cUr3P@ssw0rd!!";`,
        { uri: '/src/checkout/complete.ts' },
      );
      expect(f.severity).toBe('critical');
    });

    it('escalates in /security/ paths', async () => {
      const f = await expectDetection(
        `const password = "s3cUr3P@ssw0rd!!";`,
        { uri: '/src/security/validate.ts' },
      );
      expect(f.severity).toBe('critical');
    });

    it('escalates in /lib/db/ paths', async () => {
      const f = await expectDetection(
        `const password = "s3cUr3P@ssw0rd!!";`,
        { uri: '/src/lib/db/client.ts' },
      );
      expect(f.severity).toBe('critical');
    });

    it('escalates in /lib/stripe/ paths', async () => {
      const f = await expectDetection(
        `const password = "s3cUr3P@ssw0rd!!";`,
        { uri: '/src/lib/stripe/webhooks.ts' },
      );
      expect(f.severity).toBe('critical');
    });
  });

  // =========================================================================
  // ADDITIONAL EVIDENCE MASKING TESTS
  // =========================================================================

  describe('additional evidence masking', () => {
    it('masks Anthropic key in evidence', async () => {
      const f = await expectDetection(
        `const key = "sk-ant-api03-abcdefghijklmnopqrstuvwxyz";`,
      );
      expect(f.evidence).toContain('sk-ant-****');
      expect(f.evidence).not.toContain('sk-ant-api03-abcdefghijklmnopqrstuvwxyz');
    });

    it('masks GitHub OAuth token in evidence', async () => {
      const f = await expectDetection(
        `const token = "gho_ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmn";`,
      );
      expect(f.evidence).toContain('gho_****');
      expect(f.evidence).not.toContain('gho_ABCDEFGHIJKLMNOP');
    });

    it('masks Stripe live publishable keys in evidence', async () => {
      const f = await expectDetection(
        `const pk = "${fakePkLive()}";`,
      );
      expect(f.evidence).toContain(PK_LIVE_PREFIX + '****');
      expect(f.evidence).not.toContain(fakePkLive());
    });

    it('masks URL-embedded credentials in evidence', async () => {
      const f = await expectDetection(
        `const url = "https://admin:s3cretP4ss@api.example.com/v1";`,
      );
      expect(f.evidence).toContain('://admin:****@');
      expect(f.evidence).not.toContain('s3cretP4ss');
    });
  });

  // =========================================================================
  // UNIQUE IDS ACROSS MULTIPLE FINDINGS
  // =========================================================================

  describe('unique IDs across multiple findings in one file', () => {
    it('each finding in a multi-finding file has a unique ID', async () => {
      const code = [
        `const stripe = "${fakeSkLive()}";`,
        'const aws = "AKIAIOSFODNN7EXAMPLE";',
        '-----BEGIN RSA PRIVATE KEY-----',
        `const github = "${fakeGithubPatBody()}";`,
        'const openai = "sk-proj1234567890abcdefghijklmnopqrstuv";',
      ].join('\n');
      const findings = await scan(code);
      expect(findings.length).toBeGreaterThanOrEqual(4);
      const ids = findings.map((f) => f.id);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(ids.length);
    });

    it('all finding IDs match the cred-XXXXXXXX format', async () => {
      const code = [
        `const stripe = "${fakeSkLive()}";`,
        'const aws = "AKIAIOSFODNN7EXAMPLE";',
        '-----BEGIN PRIVATE KEY-----',
      ].join('\n');
      const findings = await scan(code);
      for (const f of findings) {
        expect(f.id).toMatch(/^cred-[0-9a-f]{8}$/);
      }
    });
  });

  // =========================================================================
  // GENERIC-SECRET ADDITIONAL GUARD: all-alpha config-like values
  // =========================================================================

  describe('generic-secret additional guards', () => {
    it('skips all-lowercase/underscore values for generic-secret (api_key pattern)', async () => {
      // Pattern: /^[a-z_]+$/i test on captured value
      await expectNoDetection(`const api_key = "some_config_value_name";`);
    });

    it('flags mixed-case alphanumeric values that look like real secrets', async () => {
      await expectDetection(
        `const api_key = "a8f4b2c1d9e7f3a5b6c8d0e2f4a7b9c1";`,
      );
    });
  });

  // =========================================================================
  // GENERIC-PASSWORD LENGTH GUARD
  // =========================================================================

  describe('generic-password length guard', () => {
    it('skips password with val.length < 6', async () => {
      await expectNoDetection(`const password = "ab1X";`);
    });

    it('skips password with val.length === 5', async () => {
      await expectNoDetection(`const password = "aB1!x";`);
    });

    it('detects password with val.length >= 6 and non-fake value', async () => {
      await expectDetection(
        `const password = "s3cUr3P@ssw0rd!!";`,
      );
    });
  });
});
