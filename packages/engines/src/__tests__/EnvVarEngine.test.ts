import { describe, it, expect } from 'vitest';
import { EnvVarEngine } from '../EnvVarEngine.js';
import type { IEnvIndex, DeltaContext } from '../core-types';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeEnvIndex(vars: string[]): IEnvIndex {
  const index = new Set(vars);
  return { has: (name: string) => index.has(name), index };
}

function makeDelta(code: string, uri = '/src/config.ts'): DeltaContext {
  return {
    documentUri: uri,
    documentLanguage: 'typescript',
    fullText: code,
    changedRanges: [],
    changedText: code,
  };
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('EnvVarEngine', () => {
  // ── 1. Detects undefined process.env.CUSTOM_VAR when not in env index ─────

  describe('standard access detection', () => {
    it('flags process.env.MY_CUSTOM_VAR when not in env index', async () => {
      const engine = new EnvVarEngine(makeEnvIndex(['OTHER_VAR']), {});
      const findings = await engine.scan(makeDelta('const x = process.env.MY_CUSTOM_VAR;'));
      expect(findings).toHaveLength(1);
      expect(findings[0]!.evidence).toBe('process.env.MY_CUSTOM_VAR');
      expect(findings[0]!.ruleId).toBe('ENV001');
      expect(findings[0]!.engine).toBe('env_var');
    });

    it('reports correct line number (1-based) for the finding', async () => {
      const code = `const a = 1;\nconst b = process.env.MY_CUSTOM_VAR;\n`;
      const engine = new EnvVarEngine(makeEnvIndex(['OTHER_VAR']), {});
      const findings = await engine.scan(makeDelta(code));
      expect(findings).toHaveLength(1);
      expect(findings[0]!.line).toBe(2);
    });
  });

  // ── 2. Does NOT flag vars that are in the env index ───────────────────────

  describe('defined vars are not flagged', () => {
    it('does not flag a var that exists in the env index', async () => {
      const engine = new EnvVarEngine(makeEnvIndex(['MY_CUSTOM_VAR']), {});
      const findings = await engine.scan(makeDelta('const x = process.env.MY_CUSTOM_VAR;'));
      expect(findings).toHaveLength(0);
    });

    it('does not flag any var when all referenced vars are defined', async () => {
      const engine = new EnvVarEngine(makeEnvIndex(['DB_HOST', 'DB_PORT']));
      const code = `const host = process.env.DB_HOST;\nconst port = process.env.DB_PORT;\n`;
      const findings = await engine.scan(makeDelta(code));
      expect(findings).toHaveLength(0);
    });
  });

  // ── 3. Does NOT flag well-known env vars ──────────────────────────────────

  describe('well-known exact vars are not flagged', () => {
    it.each([
      'NODE_ENV', 'CI', 'HOME', 'PATH', 'PORT', 'TZ', 'HOSTNAME',
      'DATABASE_URL', 'REDIS_URL', 'DEBUG', 'SECRET', 'JWT_SECRET',
      'HOST', 'EDITOR', 'TMPDIR', 'VERCEL', 'VERSION', 'APP_ENV',
    ])('does not flag well-known exact var: %s', async (varName) => {
      const engine = new EnvVarEngine(makeEnvIndex(['SOME_OTHER_VAR']), {});
      const findings = await engine.scan(makeDelta(`const x = process.env.${varName};`));
      const relevant = findings.filter(f => f.evidence.includes(varName));
      expect(relevant).toHaveLength(0);
    });
  });

  // ── 4. Does NOT flag well-known prefixes ──────────────────────────────────

  describe('well-known prefixes are not flagged', () => {
    it.each([
      'NEXT_PUBLIC_FOO',
      'STRIPE_SECRET_KEY',
      'AWS_REGION',
      'VITE_APP_TITLE',
      'REACT_APP_API_URL',
      'VERCEL_URL',
      'GITHUB_TOKEN',
      'SENTRY_DSN',
      'SUPABASE_URL',
      'OPENAI_API_KEY',
      'ANTHROPIC_API_KEY',
      'CLERK_SECRET_KEY',
      'FIREBASE_PROJECT_ID',
      'DOCKER_HOST',
      'NETLIFY_SITE_ID',
      'EXPO_PUBLIC_API_URL',
      'HEROKU_APP_NAME',
      'RAILWAY_SERVICE_ID',
      'TURSO_DATABASE_URL',
      'POSTHOG_API_KEY',
    ])('does not flag well-known prefix var: %s', async (varName) => {
      const engine = new EnvVarEngine(makeEnvIndex(['SOME_OTHER_VAR']), {});
      const findings = await engine.scan(makeDelta(`const x = process.env.${varName};`));
      const relevant = findings.filter(f => f.evidence.includes(varName));
      expect(relevant).toHaveLength(0);
    });
  });

  // ── 5. Fallback detection: || ─────────────────────────────────────────────

  describe('fallback detection with ||', () => {
    it('does NOT flag process.env.MY_PORT || 3000', async () => {
      const engine = new EnvVarEngine(makeEnvIndex(['OTHER_VAR']), {});
      const findings = await engine.scan(makeDelta('const port = process.env.MY_PORT || 3000;'));
      expect(findings).toHaveLength(0);
    });

    it('does NOT flag process.env.MY_HOST || defaults.host', async () => {
      const engine = new EnvVarEngine(makeEnvIndex(['OTHER_VAR']), {});
      const findings = await engine.scan(
        makeDelta('const host = process.env.MY_HOST || defaults.host;'),
      );
      expect(findings).toHaveLength(0);
    });

    it('DOES flag process.env.MY_VAR || undefined (not a real fallback)', async () => {
      const engine = new EnvVarEngine(makeEnvIndex(['OTHER_VAR']), {});
      const findings = await engine.scan(
        makeDelta('const x = process.env.MY_VAR || undefined;'),
      );
      const flagged = findings.filter(f => f.evidence.includes('MY_VAR'));
      expect(flagged.length).toBeGreaterThanOrEqual(1);
    });

    it('DOES flag process.env.MY_VAR || null (not a real fallback)', async () => {
      const engine = new EnvVarEngine(makeEnvIndex(['OTHER_VAR']), {});
      const findings = await engine.scan(
        makeDelta('const x = process.env.MY_VAR || null;'),
      );
      const flagged = findings.filter(f => f.evidence.includes('MY_VAR'));
      expect(flagged.length).toBeGreaterThanOrEqual(1);
    });
  });

  // ── 6. Fallback detection: ?? ─────────────────────────────────────────────

  describe('fallback detection with ??', () => {
    it("does NOT flag process.env.MY_HOST ?? 'localhost'", async () => {
      const engine = new EnvVarEngine(makeEnvIndex(['OTHER_VAR']), {});
      const findings = await engine.scan(
        makeDelta("const host = process.env.MY_HOST ?? 'localhost';"),
      );
      expect(findings).toHaveLength(0);
    });

    it('does NOT flag process.env.MY_TIMEOUT ?? 5000', async () => {
      const engine = new EnvVarEngine(makeEnvIndex(['OTHER_VAR']), {});
      const findings = await engine.scan(
        makeDelta('const timeout = process.env.MY_TIMEOUT ?? 5000;'),
      );
      expect(findings).toHaveLength(0);
    });

    it('DOES flag process.env.MY_VAR ?? null (not a real fallback)', async () => {
      const engine = new EnvVarEngine(makeEnvIndex(['OTHER_VAR']), {});
      const findings = await engine.scan(
        makeDelta('const x = process.env.MY_VAR ?? null;'),
      );
      const flagged = findings.filter(f => f.evidence.includes('MY_VAR'));
      expect(flagged.length).toBeGreaterThanOrEqual(1);
    });
  });

  // ── 7. Ternary fallback ───────────────────────────────────────────────────

  describe('ternary fallback', () => {
    it('does NOT flag process.env.MY_FLAG ? true : false', async () => {
      const engine = new EnvVarEngine(makeEnvIndex(['OTHER_VAR']), {});
      const findings = await engine.scan(
        makeDelta('const flag = process.env.MY_FLAG ? true : false;'),
      );
      expect(findings).toHaveLength(0);
    });

    it('does NOT flag process.env.MY_VAR ? val : defaultVal', async () => {
      const engine = new EnvVarEngine(makeEnvIndex(['OTHER_VAR']), {});
      const findings = await engine.scan(
        makeDelta("const x = process.env.MY_VAR ? process.env.MY_VAR : 'fallback';"),
      );
      expect(findings).toHaveLength(0);
    });
  });

  // ── 8. Destructuring: flags missing vars ──────────────────────────────────

  describe('destructuring detection', () => {
    it('flags destructured var not in env index', async () => {
      const engine = new EnvVarEngine(makeEnvIndex(['OTHER_VAR']), {});
      const findings = await engine.scan(
        makeDelta('const { MY_MISSING_VAR } = process.env;'),
      );
      expect(findings.length).toBeGreaterThanOrEqual(1);
      expect(findings.some(f => f.message.includes('MY_MISSING_VAR'))).toBe(true);
    });

    it('flags multiple destructured vars not in index', async () => {
      const engine = new EnvVarEngine(makeEnvIndex(['OTHER_VAR']), {});
      const findings = await engine.scan(
        makeDelta('const { MY_API_KEY, MY_SECRET } = process.env;'),
      );
      expect(findings).toHaveLength(2);
      const names = findings.map(f => f.message);
      expect(names.some(m => m.includes('MY_API_KEY'))).toBe(true);
      expect(names.some(m => m.includes('MY_SECRET'))).toBe(true);
    });

    it('does not flag destructured vars that are in the env index', async () => {
      const engine = new EnvVarEngine(makeEnvIndex(['MY_API_KEY', 'MY_SECRET']), {});
      const findings = await engine.scan(
        makeDelta('const { MY_API_KEY, MY_SECRET } = process.env;'),
      );
      expect(findings).toHaveLength(0);
    });

    it('flags only the missing var in a mixed destructuring', async () => {
      const engine = new EnvVarEngine(makeEnvIndex(['MY_API_KEY']), {});
      const findings = await engine.scan(
        makeDelta('const { MY_API_KEY, MY_SECRET } = process.env;'),
      );
      expect(findings).toHaveLength(1);
      expect(findings[0]!.message).toContain('MY_SECRET');
    });

    it('handles let keyword', async () => {
      const engine = new EnvVarEngine(makeEnvIndex(['OTHER_VAR']), {});
      const findings = await engine.scan(
        makeDelta('let { MY_MISSING_LET } = process.env;'),
      );
      expect(findings.some(f => f.message.includes('MY_MISSING_LET'))).toBe(true);
    });

    it('handles var keyword', async () => {
      const engine = new EnvVarEngine(makeEnvIndex(['OTHER_VAR']), {});
      const findings = await engine.scan(
        makeDelta('var { MY_MISSING_VAR_KW } = process.env;'),
      );
      expect(findings.some(f => f.message.includes('MY_MISSING_VAR_KW'))).toBe(true);
    });
  });

  // ── 9. Destructuring with defaults: does NOT flag ─────────────────────────

  describe('destructuring with defaults', () => {
    it('does NOT flag destructured var with default value', async () => {
      const engine = new EnvVarEngine(makeEnvIndex(['OTHER_VAR']), {});
      const findings = await engine.scan(
        makeDelta("const { MY_API_KEY = 'default-key' } = process.env;"),
      );
      expect(findings).toHaveLength(0);
    });

    it('flags var without default but not var with default', async () => {
      const engine = new EnvVarEngine(makeEnvIndex(['OTHER_VAR']), {});
      const findings = await engine.scan(
        makeDelta("const { MY_API_KEY = 'default', MY_SECRET } = process.env;"),
      );
      expect(findings).toHaveLength(1);
      expect(findings[0]!.message).toContain('MY_SECRET');
    });
  });

  // ── 10. Bracket access: flags missing vars ────────────────────────────────

  describe('bracket access', () => {
    it("flags process.env['MY_VAR'] when not defined (single quotes)", async () => {
      const engine = new EnvVarEngine(makeEnvIndex(['OTHER_VAR']), {});
      const findings = await engine.scan(makeDelta("const x = process.env['MY_VAR'];"));
      expect(findings).toHaveLength(1);
      expect(findings[0]!.evidence).toContain('MY_VAR');
      expect(findings[0]!.ruleId).toBe('ENV001');
    });

    it('flags process.env["MY_VAR"] when not defined (double quotes)', async () => {
      const engine = new EnvVarEngine(makeEnvIndex(['OTHER_VAR']), {});
      const findings = await engine.scan(makeDelta('const x = process.env["MY_VAR"];'));
      expect(findings).toHaveLength(1);
      expect(findings[0]!.evidence).toContain('MY_VAR');
    });

    it('does not flag bracket access when var is in index', async () => {
      const engine = new EnvVarEngine(makeEnvIndex(['MY_VAR']), {});
      const findings = await engine.scan(makeDelta("const x = process.env['MY_VAR'];"));
      expect(findings).toHaveLength(0);
    });

    it("does NOT flag process.env['MY_PORT'] || 3000 (bracket + fallback)", async () => {
      const engine = new EnvVarEngine(makeEnvIndex(['OTHER_VAR']), {});
      const findings = await engine.scan(
        makeDelta("const port = process.env['MY_PORT'] || 3000;"),
      );
      expect(findings).toHaveLength(0);
    });

    it('does NOT flag process.env["MY_HOST"] ?? "localhost"', async () => {
      const engine = new EnvVarEngine(makeEnvIndex(['OTHER_VAR']), {});
      const findings = await engine.scan(
        makeDelta("const host = process.env['MY_HOST'] ?? 'localhost';"),
      );
      expect(findings).toHaveLength(0);
    });

    it('does NOT flag bracket access for well-known var', async () => {
      const engine = new EnvVarEngine(makeEnvIndex(['OTHER_VAR']), {});
      const findings = await engine.scan(makeDelta("const x = process.env['NODE_ENV'];"));
      expect(findings).toHaveLength(0);
    });
  });

  // ── 11. Typo detection via Levenshtein distance ───────────────────────────

  describe('typo detection', () => {
    it('detects DATABAS_URL as typo and suggests DATABASE_URL', async () => {
      const engine = new EnvVarEngine(makeEnvIndex(['DATABASE_URL']), {});
      const findings = await engine.scan(makeDelta('const db = process.env.DATABAS_URL;'));
      expect(findings).toHaveLength(1);
      expect(findings[0]!.severity).toBe('high');
      expect(findings[0]!.suggestion).toContain('DATABASE_URL');
      expect(findings[0]!.suggestion).toContain('Typo?');
      expect(findings[0]!.confidence).toBe(0.90);
    });

    it('detects prefix-based similarity (shared prefix, different suffix)', async () => {
      const engine = new EnvVarEngine(makeEnvIndex(['MYAPP_SERVICE_KEY']), {});
      const findings = await engine.scan(
        makeDelta('const k = process.env.MYAPP_SERVICE_URL;'),
      );
      expect(findings).toHaveLength(1);
      expect(findings[0]!.suggestion).toContain('MYAPP_SERVICE_KEY');
    });

    it('does not suggest when no similar var exists', async () => {
      const engine = new EnvVarEngine(makeEnvIndex(['TOTALLY_UNRELATED']), {});
      const findings = await engine.scan(makeDelta('const x = process.env.MY_CUSTOM_VAR;'));
      expect(findings).toHaveLength(1);
      expect(findings[0]!.suggestion).not.toContain('Typo?');
      expect(findings[0]!.suggestion).toContain('Add MY_CUSTOM_VAR');
    });

    it('picks the closest Levenshtein match', async () => {
      const engine = new EnvVarEngine(makeEnvIndex(['API_KEY', 'API_SECRET', 'API_TOKEN']), {});
      const findings = await engine.scan(makeDelta('const k = process.env.API_KYE;'));
      expect(findings).toHaveLength(1);
      expect(findings[0]!.suggestion).toContain('API_KEY');
    });
  });

  // ── 12. Comment lines should be skipped ───────────────────────────────────

  describe('comments are skipped', () => {
    it('does NOT flag vars in single-line // comments', async () => {
      const engine = new EnvVarEngine(makeEnvIndex(['OTHER_VAR']), {});
      const findings = await engine.scan(
        makeDelta('// const x = process.env.MY_SECRET_VAR;'),
      );
      expect(findings).toHaveLength(0);
    });

    it('does NOT flag vars in # comments', async () => {
      const engine = new EnvVarEngine(makeEnvIndex(['OTHER_VAR']), {});
      const findings = await engine.scan(makeDelta('# process.env.MY_SECRET_VAR'));
      expect(findings).toHaveLength(0);
    });

    it('does NOT flag vars in JSDoc-style lines starting with *', async () => {
      const engine = new EnvVarEngine(makeEnvIndex(['OTHER_VAR']), {});
      const code = `/**\n * Uses process.env.MY_SECRET_VAR\n */`;
      const findings = await engine.scan(makeDelta(code));
      expect(findings).toHaveLength(0);
    });
  });

  // ── 13. Type definitions should be skipped ────────────────────────────────

  describe('type definitions are skipped', () => {
    it('does NOT flag vars in type definitions', async () => {
      const engine = new EnvVarEngine(makeEnvIndex(['OTHER_VAR']), {});
      const findings = await engine.scan(
        makeDelta('type Config = { db: typeof process.env.MY_CUSTOM_VAR };'),
      );
      expect(findings).toHaveLength(0);
    });

    it('does NOT flag vars in interface definitions', async () => {
      const engine = new EnvVarEngine(makeEnvIndex(['OTHER_VAR']), {});
      const findings = await engine.scan(
        makeDelta('interface Config { db: typeof process.env.MY_CUSTOM_VAR; }'),
      );
      expect(findings).toHaveLength(0);
    });

    it('does NOT flag vars in declare statements', async () => {
      const engine = new EnvVarEngine(makeEnvIndex(['OTHER_VAR']), {});
      const findings = await engine.scan(
        makeDelta('declare const env: { MY_CUSTOM_VAR: string };'),
      );
      expect(findings).toHaveLength(0);
    });
  });

  // ── 14. Block comment lines should be skipped ─────────────────────────────

  describe('block comments are skipped', () => {
    it('does NOT flag vars in single-line block comment /* ... */', async () => {
      const engine = new EnvVarEngine(makeEnvIndex(['OTHER_VAR']), {});
      const findings = await engine.scan(
        makeDelta('/* const x = process.env.MY_SECRET_VAR; */'),
      );
      expect(findings).toHaveLength(0);
    });

    it('does NOT flag vars in multi-line block comments', async () => {
      const engine = new EnvVarEngine(makeEnvIndex(['OTHER_VAR']), {});
      const code = `/*\nconst x = process.env.MY_SECRET_VAR;\nconst y = process.env.MY_OTHER_VAR;\n*/`;
      const findings = await engine.scan(makeDelta(code));
      expect(findings).toHaveLength(0);
    });

    it('resumes scanning after block comment closes', async () => {
      const engine = new EnvVarEngine(makeEnvIndex(['OTHER_VAR']), {});
      const code = [
        '/* block comment',
        'process.env.IN_COMMENT',
        '*/',
        'const x = process.env.AFTER_COMMENT;',
      ].join('\n');
      const findings = await engine.scan(makeDelta(code));
      expect(findings.some(f => f.evidence.includes('IN_COMMENT'))).toBe(false);
      expect(findings.some(f => f.evidence.includes('AFTER_COMMENT'))).toBe(true);
    });
  });

  // ── 15. noEnvFiles option: returns empty findings ─────────────────────────

  describe('noEnvFiles mode', () => {
    it('returns empty findings when noEnvFiles is true', async () => {
      const engine = new EnvVarEngine(makeEnvIndex(['SOME_VAR']), { noEnvFiles: true });
      const findings = await engine.scan(makeDelta('const x = process.env.MY_CUSTOM_VAR;'));
      expect(findings).toHaveLength(0);
    });

    it('returns empty findings even with many undefined vars', async () => {
      const engine = new EnvVarEngine(makeEnvIndex(['SOME_VAR']), { noEnvFiles: true });
      const code = [
        'const a = process.env.MISSING_ONE;',
        'const b = process.env.MISSING_TWO;',
        'const c = process.env.MISSING_THREE;',
      ].join('\n');
      const findings = await engine.scan(makeDelta(code));
      expect(findings).toHaveLength(0);
    });
  });

  // ── 16. exampleOnly option: demotes severity to info ──────────────────────

  describe('exampleOnly mode', () => {
    it('demotes all findings to info severity', async () => {
      const engine = new EnvVarEngine(makeEnvIndex(['OTHER_VAR']), { exampleOnly: true });
      const findings = await engine.scan(makeDelta('const x = process.env.MY_CUSTOM_VAR;'));
      expect(findings).toHaveLength(1);
      expect(findings[0]!.severity).toBe('info');
    });

    it('demotes typo findings to info severity (not high)', async () => {
      const engine = new EnvVarEngine(makeEnvIndex(['DATABASE_URL']), { exampleOnly: true });
      const findings = await engine.scan(makeDelta('const db = process.env.DATABAS_URL;'));
      expect(findings).toHaveLength(1);
      expect(findings[0]!.severity).toBe('info');
      // Still includes the typo suggestion
      expect(findings[0]!.suggestion).toContain('Typo?');
    });

    it('uses .env.example-specific messaging', async () => {
      const engine = new EnvVarEngine(makeEnvIndex(['OTHER_VAR']), { exampleOnly: true });
      const findings = await engine.scan(makeDelta('const x = process.env.MY_CUSTOM_VAR;'));
      expect(findings[0]!.message).toContain('.env.example');
    });

    it('demotes destructuring findings to info', async () => {
      const engine = new EnvVarEngine(makeEnvIndex(['OTHER_VAR']), { exampleOnly: true });
      const findings = await engine.scan(
        makeDelta('const { MY_MISSING_KEY } = process.env;'),
      );
      expect(findings.length).toBeGreaterThanOrEqual(1);
      for (const f of findings) {
        expect(f.severity).toBe('info');
      }
    });

    it('demotes bracket access findings to info', async () => {
      const engine = new EnvVarEngine(makeEnvIndex(['OTHER_VAR']), { exampleOnly: true });
      const findings = await engine.scan(
        makeDelta("const x = process.env['MY_BRACKET_KEY'];"),
      );
      expect(findings.length).toBeGreaterThanOrEqual(1);
      expect(findings[0]!.severity).toBe('info');
    });
  });

  // ── 17. Conditional checks: if (process.env.DEBUG) → info ─────────────────

  describe('conditional checks', () => {
    it('flags if (process.env.MY_DEBUG) as info severity', async () => {
      const engine = new EnvVarEngine(makeEnvIndex(['OTHER_VAR']), {});
      const findings = await engine.scan(
        makeDelta('if (process.env.MY_DEBUG) { console.log("debug"); }'),
      );
      expect(findings.length).toBeGreaterThanOrEqual(1);
      const f = findings.find(f => f.evidence.includes('MY_DEBUG'));
      expect(f).toBeDefined();
      expect(f!.severity).toBe('info');
    });

    it('flags process.env.MY_FEATURE && doStuff() as info severity', async () => {
      const engine = new EnvVarEngine(makeEnvIndex(['OTHER_VAR']), {});
      const findings = await engine.scan(
        makeDelta('process.env.MY_FEATURE && doStuff();'),
      );
      expect(findings.length).toBeGreaterThanOrEqual(1);
      const f = findings.find(f => f.evidence.includes('MY_FEATURE'));
      expect(f).toBeDefined();
      expect(f!.severity).toBe('info');
    });
  });

  // ── 18. Deduplication: same var same line = one finding ───────────────────

  describe('deduplication', () => {
    it('deduplicates same var referenced twice on the same line (standard access)', async () => {
      const engine = new EnvVarEngine(makeEnvIndex(['OTHER_VAR']), {});
      const code = 'const x = process.env.MY_CUSTOM_VAR + process.env.MY_CUSTOM_VAR;';
      const findings = await engine.scan(makeDelta(code));
      const relevant = findings.filter(f => f.evidence.includes('MY_CUSTOM_VAR'));
      expect(relevant).toHaveLength(1);
    });

    it('reports same var on different lines as separate findings', async () => {
      const engine = new EnvVarEngine(makeEnvIndex(['OTHER_VAR']), {});
      const code = `const x = process.env.MY_CUSTOM_VAR;\nconst y = process.env.MY_CUSTOM_VAR;\n`;
      const findings = await engine.scan(makeDelta(code));
      expect(findings).toHaveLength(2);
      expect(findings[0]!.id).not.toBe(findings[1]!.id);
    });
  });

  // ── 19. Confidence threshold filtering ────────────────────────────────────

  describe('confidence threshold filtering', () => {
    it('filters out findings below the configured threshold', async () => {
      // Non-typo confidence is 0.85; threshold 0.95 should filter it
      const engine = new EnvVarEngine(makeEnvIndex(['OTHER_VAR']), { confidenceThreshold: 0.95 });
      const findings = await engine.scan(makeDelta('const x = process.env.MY_CUSTOM_VAR;'));
      expect(findings).toHaveLength(0);
    });

    it('includes findings at or above the threshold', async () => {
      const engine = new EnvVarEngine(makeEnvIndex(['OTHER_VAR']), { confidenceThreshold: 0.80 });
      const findings = await engine.scan(makeDelta('const x = process.env.MY_CUSTOM_VAR;'));
      expect(findings).toHaveLength(1);
    });

    it('typo findings (0.90) pass a 0.89 threshold', async () => {
      const engine = new EnvVarEngine(makeEnvIndex(['DATABASE_URL']), { confidenceThreshold: 0.89 });
      const findings = await engine.scan(makeDelta('const db = process.env.DATABAS_URL;'));
      expect(findings).toHaveLength(1);
    });

    it('typo findings (0.90) are filtered by a 0.95 threshold', async () => {
      const engine = new EnvVarEngine(makeEnvIndex(['DATABASE_URL']), { confidenceThreshold: 0.95 });
      const findings = await engine.scan(makeDelta('const db = process.env.DATABAS_URL;'));
      expect(findings).toHaveLength(0);
    });
  });

  // ── 20. Multiple vars on same line ────────────────────────────────────────

  describe('multiple vars on same line', () => {
    it('produces separate findings for each different var', async () => {
      const engine = new EnvVarEngine(makeEnvIndex(['OTHER_VAR']), {});
      const code = "const url = process.env.MY_PROTOCOL + '://' + process.env.MY_HOSTNAME;";
      const findings = await engine.scan(makeDelta(code));
      expect(findings).toHaveLength(2);
      const evidences = findings.map(f => f.evidence);
      expect(evidences).toContain('process.env.MY_PROTOCOL');
      expect(evidences).toContain('process.env.MY_HOSTNAME');
    });
  });

  // ── 21. Constructor backwards compat ──────────────────────────────────────

  describe('constructor backwards compatibility', () => {
    it('accepts a bare number as confidenceThreshold', async () => {
      const engine = new EnvVarEngine(makeEnvIndex(['OTHER_VAR']), 0.95);
      const findings = await engine.scan(makeDelta('const x = process.env.MY_CUSTOM_VAR;'));
      expect(findings).toHaveLength(0);
    });

    it('accepts a low bare-number threshold that lets findings through', async () => {
      const engine = new EnvVarEngine(makeEnvIndex(['OTHER_VAR']), 0.5);
      const findings = await engine.scan(makeDelta('const x = process.env.MY_CUSTOM_VAR;'));
      expect(findings).toHaveLength(1);
    });

    it('defaults confidenceThreshold to 0.75 when no options given', async () => {
      const engine = new EnvVarEngine(makeEnvIndex(['OTHER_VAR']));
      const findings = await engine.scan(makeDelta('const x = process.env.MY_CUSTOM_VAR;'));
      // 0.85 > 0.75 default threshold, so it should be included
      expect(findings).toHaveLength(1);
    });
  });

  // ── 22. import.meta.env support ───────────────────────────────────────────

  describe('import.meta.env support', () => {
    it('flags import.meta.env.MY_CUSTOM_VAR when not defined', async () => {
      const engine = new EnvVarEngine(makeEnvIndex(['OTHER_VAR']), {});
      const findings = await engine.scan(
        makeDelta('const apiUrl = import.meta.env.MY_CUSTOM_VAR;'),
      );
      expect(findings).toHaveLength(1);
      expect(findings[0]!.evidence).toContain('import.meta.env.MY_CUSTOM_VAR');
    });

    it('does not flag import.meta.env var when in index', async () => {
      const engine = new EnvVarEngine(makeEnvIndex(['MY_CUSTOM_VAR']), {});
      const findings = await engine.scan(
        makeDelta('const apiUrl = import.meta.env.MY_CUSTOM_VAR;'),
      );
      expect(findings).toHaveLength(0);
    });

    it('does not flag import.meta.env with well-known prefix', async () => {
      const engine = new EnvVarEngine(makeEnvIndex(['OTHER_VAR']), {});
      const findings = await engine.scan(
        makeDelta('const apiUrl = import.meta.env.VITE_API_URL;'),
      );
      expect(findings).toHaveLength(0);
    });

    it('does not flag import.meta.env with fallback', async () => {
      const engine = new EnvVarEngine(makeEnvIndex(['OTHER_VAR']), {});
      const findings = await engine.scan(
        makeDelta("const apiUrl = import.meta.env.MY_CUSTOM_VAR || 'http://localhost';"),
      );
      expect(findings).toHaveLength(0);
    });
  });

  // ── 23. Empty env index ───────────────────────────────────────────────────

  describe('empty env index returns no findings', () => {
    it('returns zero findings when env index is empty (size === 0)', async () => {
      const engine = new EnvVarEngine(makeEnvIndex([]), {});
      const findings = await engine.scan(makeDelta('const x = process.env.MY_CUSTOM_VAR;'));
      expect(findings).toHaveLength(0);
    });
  });

  // ── 24. Destructuring with renaming ───────────────────────────────────────

  describe('destructuring with renaming', () => {
    it('flags the original env var name, not the local alias', async () => {
      const engine = new EnvVarEngine(makeEnvIndex(['OTHER_VAR']), {});
      const findings = await engine.scan(
        makeDelta('const { MY_API_KEY: apiKey } = process.env;'),
      );
      expect(findings).toHaveLength(1);
      expect(findings[0]!.message).toContain('MY_API_KEY');
    });
  });

  // ── 25. Deterministic IDs ─────────────────────────────────────────────────

  describe('deterministic IDs', () => {
    it('produces the same finding ID for the same input across scans', async () => {
      const engine = new EnvVarEngine(makeEnvIndex(['OTHER_VAR']), {});
      const delta = makeDelta('const x = process.env.MY_CUSTOM_VAR;', '/src/app.ts');
      const findings1 = await engine.scan(delta);
      const findings2 = await engine.scan(delta);
      expect(findings1[0]!.id).toBe(findings2[0]!.id);
    });

    it('produces different IDs for different files', async () => {
      const engine = new EnvVarEngine(makeEnvIndex(['OTHER_VAR']), {});
      const code = 'const x = process.env.MY_CUSTOM_VAR;';
      const findings1 = await engine.scan(makeDelta(code, '/src/a.ts'));
      const findings2 = await engine.scan(makeDelta(code, '/src/b.ts'));
      expect(findings1[0]!.id).not.toBe(findings2[0]!.id);
    });

    it('ID matches env-XXXXXXXX format', async () => {
      const engine = new EnvVarEngine(makeEnvIndex(['OTHER_VAR']), {});
      const findings = await engine.scan(makeDelta('const x = process.env.MY_CUSTOM_VAR;'));
      expect(findings[0]!.id).toMatch(/^env-[0-9a-f]{8}$/);
    });
  });

  // ── 26. Finding structure ─────────────────────────────────────────────────

  describe('finding structure', () => {
    it('includes all required Finding fields', async () => {
      const engine = new EnvVarEngine(makeEnvIndex(['OTHER_VAR']), {});
      const findings = await engine.scan(makeDelta('const x = process.env.MY_CUSTOM_VAR;'));
      const f = findings[0]!;
      expect(f.id).toBeDefined();
      expect(f.engine).toBe('env_var');
      expect(f.severity).toBeDefined();
      expect(f.category).toBe('env_var');
      expect(f.file).toBe('/src/config.ts');
      expect(f.line).toBeGreaterThan(0);
      expect(typeof f.column).toBe('number');
      expect(f.endLine).toBeGreaterThan(0);
      expect(f.endColumn).toBeGreaterThan(0);
      expect(f.message).toBeDefined();
      expect(f.evidence).toBeDefined();
      expect(f.suggestion).toBeDefined();
      expect(typeof f.confidence).toBe('number');
      expect(f.autoFixable).toBe(false);
      expect(f.ruleId).toBe('ENV001');
    });
  });

  // ── 27. Confidence values ─────────────────────────────────────────────────

  describe('confidence values', () => {
    it('has 0.85 confidence for a non-typo finding', async () => {
      const engine = new EnvVarEngine(makeEnvIndex(['TOTALLY_UNRELATED']), {});
      const findings = await engine.scan(makeDelta('const x = process.env.MY_CUSTOM_VAR;'));
      expect(findings[0]!.confidence).toBe(0.85);
    });

    it('has 0.90 confidence for a typo finding', async () => {
      const engine = new EnvVarEngine(makeEnvIndex(['DATABASE_URL']), {});
      const findings = await engine.scan(makeDelta('const x = process.env.DATABAS_URL;'));
      expect(findings[0]!.confidence).toBe(0.90);
    });
  });

  // ── 28. Engine identity ───────────────────────────────────────────────────

  describe('engine identity', () => {
    it('has id "env_var"', () => {
      const engine = new EnvVarEngine(makeEnvIndex([]), {});
      expect(engine.id).toBe('env_var');
    });
  });

  // ── 29. Integration: mixed realistic scenario ─────────────────────────────

  describe('integration: mixed scenario', () => {
    it('correctly handles a realistic config file', async () => {
      const engine = new EnvVarEngine(
        makeEnvIndex(['DATABASE_URL', 'REDIS_HOST', 'APP_VERSION']),
        {},
      );
      const code = [
        '// Configuration file',
        "import { z } from 'zod';",
        '',
        'const config = {',
        '  db: process.env.DATABASE_URL,',              // defined — no finding
        '  redis: process.env.REDIS_HOST,',              // defined — no finding
        '  port: process.env.MY_CUSTOM_PORT || 3000,',   // fallback — no finding
        '  secret: process.env.MY_APP_SECRET,',           // missing — finding
        '  version: process.env.APP_VERSIOM,',            // typo of APP_VERSION — high
        '  debug: process.env.NODE_ENV,',                 // well-known — no finding
        '};',
        '',
        '// process.env.COMMENTED_OUT',                   // comment — no finding
        '',
        'const { MY_DESTRUCTURED_KEY } = process.env;',  // missing — finding
      ].join('\n');

      const findings = await engine.scan(makeDelta(code));

      // Expect 3 findings: MY_APP_SECRET, APP_VERSIOM (typo), MY_DESTRUCTURED_KEY
      expect(findings).toHaveLength(3);

      const messages = findings.map(f => f.message);

      // MY_APP_SECRET — missing
      expect(messages.some(m => m.includes('MY_APP_SECRET'))).toBe(true);

      // APP_VERSIOM — typo
      const typoFinding = findings.find(f => f.message.includes('APP_VERSIOM'))!;
      expect(typoFinding).toBeDefined();
      expect(typoFinding.severity).toBe('high');
      expect(typoFinding.suggestion).toContain('APP_VERSION');

      // MY_DESTRUCTURED_KEY — missing
      expect(messages.some(m => m.includes('MY_DESTRUCTURED_KEY'))).toBe(true);
    });
  });

  // ── 30. Mixed access patterns in one file ─────────────────────────────────

  describe('mixed access patterns', () => {
    it('detects standard, bracket, and destructuring in the same file', async () => {
      const engine = new EnvVarEngine(makeEnvIndex(['OTHER_VAR']), {});
      const code = [
        'const a = process.env.MY_STANDARD_VAR;',
        "const b = process.env['MY_BRACKET_VAR'];",
        'const { MY_DESTRUCT_VAR } = process.env;',
      ].join('\n');
      const findings = await engine.scan(makeDelta(code));
      const allText = findings.map(f => f.evidence + ' ' + f.message).join(' ');
      expect(allText).toContain('MY_STANDARD_VAR');
      expect(allText).toContain('MY_BRACKET_VAR');
      expect(allText).toContain('MY_DESTRUCT_VAR');
    });
  });

  // ── 31. AbortSignal parameter ─────────────────────────────────────────────

  describe('AbortSignal support', () => {
    it('accepts an optional AbortSignal without error', async () => {
      const engine = new EnvVarEngine(makeEnvIndex(['OTHER_VAR']), {});
      const signal = new AbortController().signal;
      const findings = await engine.scan(
        makeDelta('const x = process.env.MY_CUSTOM_VAR;'),
        signal,
      );
      expect(findings).toHaveLength(1);
    });
  });
});
