/**
 * Tests for built-in framework rule packs.
 */

import { describe, it, expect } from 'vitest';
import { nextjsPack } from '../packs/nextjs';
import { expressPack } from '../packs/express';
import { pythonPack } from '../packs/python';
import { listBuiltinPacks, getBuiltinPack } from '../packs/index';
import type { RuleContext, RuleFinding } from '../types';

function makeContext(source: string, filePath: string, language = 'typescript'): { ctx: RuleContext; findings: RuleFinding[] } {
  const findings: RuleFinding[] = [];
  const ext = filePath.match(/\.[^.]+$/)?.[0] ?? '.ts';
  return {
    findings,
    ctx: {
      source,
      lines: source.split('\n'),
      filePath,
      uri: `file://${filePath}`,
      language,
      extension: ext,
      report: (f) => findings.push(f),
    },
  };
}

describe('Next.js Pack', () => {
  it('has valid manifest', () => {
    expect(nextjsPack.name).toBe('@guardrail/rules-nextjs');
    expect(nextjsPack.rules.length).toBeGreaterThanOrEqual(8);
    for (const rule of nextjsPack.rules) {
      expect(rule.id).toMatch(/^NEXT-\d{3}$/);
      expect(typeof rule.check).toBe('function');
    }
  });

  it('NEXT-001: detects getServerSideProps in app router', () => {
    const { ctx, findings } = makeContext(
      `export async function getServerSideProps() { return { props: {} } }`,
      'src/app/page.tsx'
    );
    nextjsPack.rules.find((r) => r.id === 'NEXT-001')!.check(ctx);
    expect(findings.length).toBe(1);
    expect(findings[0]!.message).toContain('Pages Router');
  });

  it('NEXT-001: ignores getServerSideProps in pages router', () => {
    const { ctx, findings } = makeContext(
      `export async function getServerSideProps() { return { props: {} } }`,
      'pages/index.tsx'
    );
    nextjsPack.rules.find((r) => r.id === 'NEXT-001')!.check(ctx);
    expect(findings.length).toBe(0);
  });

  it('NEXT-002: detects server imports in client component', () => {
    const { ctx, findings } = makeContext(
      `"use client"\nimport { headers } from 'next/headers'`,
      'src/app/components/Header.tsx'
    );
    nextjsPack.rules.find((r) => r.id === 'NEXT-002')!.check(ctx);
    expect(findings.length).toBe(1);
    expect(findings[0]!.severity).toBe('critical');
  });

  it('NEXT-006: detects useRouter in server component', () => {
    const { ctx, findings } = makeContext(
      `import { useRouter } from 'next/navigation';\nconst router = useRouter()`,
      'src/app/dashboard/page.tsx'
    );
    nextjsPack.rules.find((r) => r.id === 'NEXT-006')!.check(ctx);
    expect(findings.length).toBe(1);
  });
});

describe('Express Pack', () => {
  it('has valid manifest', () => {
    expect(expressPack.name).toBe('@guardrail/rules-express');
    expect(expressPack.rules.length).toBeGreaterThanOrEqual(7);
    for (const rule of expressPack.rules) {
      expect(rule.id).toMatch(/^EXPR-\d{3}$/);
      expect(typeof rule.check).toBe('function');
    }
  });

  it('EXPR-004: detects sync fs in handlers', () => {
    const { ctx, findings } = makeContext(
      `app.get('/data', (req, res) => { const data = fs.readFileSync('data.json'); res.json(data) })`,
      'src/routes/data.ts'
    );
    expressPack.rules.find((r) => r.id === 'EXPR-004')!.check(ctx);
    expect(findings.length).toBe(1);
    expect(findings[0]!.message).toContain('readFileSync');
  });

  it('EXPR-006: detects hardcoded port', () => {
    const { ctx, findings } = makeContext(
      `app.listen(3000, () => console.log('ready'))`,
      'src/server.ts'
    );
    expressPack.rules.find((r) => r.id === 'EXPR-006')!.check(ctx);
    expect(findings.length).toBe(1);
  });

  it('EXPR-006: allows process.env.PORT', () => {
    const { ctx, findings } = makeContext(
      `const port = process.env.PORT || 3000;\napp.listen(port)`,
      'src/server.ts'
    );
    expressPack.rules.find((r) => r.id === 'EXPR-006')!.check(ctx);
    expect(findings.length).toBe(0);
  });
});

describe('Python Pack', () => {
  it('has valid manifest', () => {
    expect(pythonPack.name).toBe('@guardrail/rules-python');
    expect(pythonPack.rules.length).toBeGreaterThanOrEqual(9);
    for (const rule of pythonPack.rules) {
      expect(rule.id).toMatch(/^PY-\d{3}$/);
      expect(typeof rule.check).toBe('function');
    }
  });

  it('PY-001: detects SQL f-string injection', () => {
    const { ctx, findings } = makeContext(
      `cursor.execute(f"SELECT * FROM users WHERE id = {user_id}")`,
      'app/db.py',
      'python'
    );
    pythonPack.rules.find((r) => r.id === 'PY-001')!.check(ctx);
    expect(findings.length).toBe(1);
    expect(findings[0]!.severity).toBe('critical');
  });

  it('PY-006: detects bare except', () => {
    const { ctx, findings } = makeContext(
      `try:\n    do_something()\nexcept:\n    pass`,
      'app/utils.py',
      'python'
    );
    pythonPack.rules.find((r) => r.id === 'PY-006')!.check(ctx);
    expect(findings.length).toBe(1);
  });

  it('PY-007: detects mutable default args', () => {
    const { ctx, findings } = makeContext(
      `def process_items(items=[]):\n    items.append("new")`,
      'app/service.py',
      'python'
    );
    pythonPack.rules.find((r) => r.id === 'PY-007')!.check(ctx);
    expect(findings.length).toBe(1);
  });

  it('PY-009: detects DEBUG=True', () => {
    const { ctx, findings } = makeContext(
      `DEBUG = True\nSECRET_KEY = os.environ.get("SECRET_KEY")`,
      'settings.py',
      'python'
    );
    pythonPack.rules.find((r) => r.id === 'PY-009')!.check(ctx);
    expect(findings.length).toBe(1);
  });
});

describe('Pack Registry', () => {
  it('lists all builtin packs without duplicates', () => {
    const packs = listBuiltinPacks();
    expect(packs.length).toBeGreaterThanOrEqual(3);
    const names = packs.map((p) => p.manifest.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it('resolves framework to pack', () => {
    expect(getBuiltinPack('nextjs')).toBe(nextjsPack);
    expect(getBuiltinPack('express')).toBe(expressPack);
    expect(getBuiltinPack('fastapi')).toBe(pythonPack);
    expect(getBuiltinPack('django')).toBe(pythonPack);
    expect(getBuiltinPack('nonexistent')).toBeNull();
  });
});
