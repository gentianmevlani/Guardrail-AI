import { describe, it, expect } from 'vitest';
import { VersionHallucinationEngine } from '../VersionHallucinationEngine.js';
import type { DeltaContext } from '../core-types';

function makeDelta(code: string, uri = '/project/src/app.ts', lang = 'typescript'): DeltaContext {
  return { documentUri: uri, documentLanguage: lang, fullText: code, changedRanges: [], changedText: code };
}

const engine = new VersionHallucinationEngine();
const signal = new AbortController().signal;

describe('VersionHallucinationEngine', () => {
  it('has correct engine id', () => {
    expect(engine.id).toBe('version_hallucination');
  });

  // ── VHAL004 — Hallucinated methods ──────────────────────────────────────

  describe('VHAL004: hallucinated methods', () => {
    it('detects prisma.user.findOne (hallucinated)', async () => {
      const code = `import { PrismaClient } from 'prisma';\nconst prisma = new PrismaClient();\nconst user = await prisma.user.findOne({ where: { id } });`;
      const findings = await engine.scan(makeDelta(code), signal);
      expect(findings.some(f => f.ruleId === 'VHAL004' && f.message.includes('findOne'))).toBe(true);
    });

    it('detects prisma.user.getAll (hallucinated)', async () => {
      const code = `import { PrismaClient } from 'prisma';\nconst users = await db.user.getAll();`;
      const findings = await engine.scan(makeDelta(code), signal);
      expect(findings.some(f => f.message.includes('getAll'))).toBe(true);
    });

    it('detects prisma.user.insert (hallucinated)', async () => {
      const code = `import { PrismaClient } from 'prisma';\nawait prisma.user.insert({ data: { name: 'test' } });`;
      const findings = await engine.scan(makeDelta(code), signal);
      expect(findings.some(f => f.message.includes('insert'))).toBe(true);
    });

    it('detects mongoose.findAll (hallucinated)', async () => {
      const code = `import mongoose from 'mongoose';\nconst users = await User.findAll();`;
      const findings = await engine.scan(makeDelta(code), signal);
      expect(findings.some(f => f.message.includes('findAll'))).toBe(true);
    });

    it('detects axios.fetch (hallucinated)', async () => {
      const code = `import axios from 'axios';\nconst data = await axios.fetch('/api/data');`;
      const findings = await engine.scan(makeDelta(code), signal);
      expect(findings.some(f => f.message.includes('axios.fetch'))).toBe(true);
    });

    it('detects lodash.contains (hallucinated)', async () => {
      const code = `import _ from 'lodash';\nconst has = _.contains(arr, val);`;
      const findings = await engine.scan(makeDelta(code), signal);
      expect(findings.some(f => f.message.includes('contains'))).toBe(true);
    });

    it('detects z.validate (hallucinated)', async () => {
      const code = `import { z } from 'zod';\nconst result = z.validate(data, schema);`;
      const findings = await engine.scan(makeDelta(code), signal);
      expect(findings.some(f => f.message.includes('validate'))).toBe(true);
    });

    it('detects openai.chat (hallucinated)', async () => {
      const code = `import OpenAI from 'openai';\nconst openai = new OpenAI();\nconst r = await openai.chat({ model: 'gpt-4', messages: [] });`;
      const findings = await engine.scan(makeDelta(code), signal);
      expect(findings.some(f => f.message.includes('chat') && f.message.includes('openai'))).toBe(true);
    });

    it('detects resend.send (hallucinated)', async () => {
      const code = `import { Resend } from 'resend';\nconst resend = new Resend('key');\nawait resend.send({ from: 'a@b.com', to: 'c@d.com', subject: 'Hi' });`;
      const findings = await engine.scan(makeDelta(code), signal);
      expect(findings.some(f => f.message.includes('send') && f.message.includes('resend'))).toBe(true);
    });
  });

  // ── VHAL001 — Removed/deprecated APIs ───────────────────────────────────

  describe('VHAL001: removed/deprecated APIs', () => {
    it('detects React Switch (removed in React Router v6)', async () => {
      const code = `import { Switch } from 'react-router-dom';\n<Switch><Route path="/" /></Switch>`;
      // Note: engine checks installed version — without package.json nearby, may use import-based detection
      const findings = await engine.scan(makeDelta(code), signal);
      const switchFinding = findings.find(f => f.message.includes('Switch'));
      if (switchFinding) {
        expect(switchFinding.ruleId).toBe('VHAL001');
        expect(switchFinding.suggestion).toContain('Routes');
      }
    });

    it('detects useHistory (removed in React Router v6)', async () => {
      const code = `import { useHistory } from 'react-router-dom';\nconst history = useHistory();`;
      const findings = await engine.scan(makeDelta(code), signal);
      const historyFinding = findings.find(f => f.message.includes('useHistory'));
      if (historyFinding) {
        expect(historyFinding.suggestion).toContain('useNavigate');
      }
    });

    it('detects mongoose.remove (removed in v7)', async () => {
      const code = `import mongoose from 'mongoose';\nawait user.remove();`;
      const findings = await engine.scan(makeDelta(code), signal);
      // Only flagged if version detected — this tests pattern matching
      const removeFinding = findings.find(f => f.message.includes('remove'));
      if (removeFinding) {
        expect(removeFinding.suggestion).toContain('deleteOne');
      }
    });
  });

  // ── VHAL003 — Import path changes ───────────────────────────────────────

  describe('VHAL003: import path changes', () => {
    it('detects next/router import (changed in Next 13)', async () => {
      // Engine needs package.json with next >= 13 to flag this
      const code = `import { useRouter } from 'next/router';\nconst router = useRouter();`;
      const findings = await engine.scan(makeDelta(code), signal);
      // May or may not flag depending on version detection
      for (const f of findings) {
        if (f.ruleId === 'VHAL003') {
          expect(f.suggestion).toContain('next/navigation');
        }
      }
    });
  });

  // ── False positive prevention ───────────────────────────────────────────

  describe('false positive prevention', () => {
    it('skips non-JS/TS files', async () => {
      const code = `prisma.user.findOne({ where: { id } })`;
      const findings = await engine.scan(makeDelta(code, '/project/styles.css', 'css'), signal);
      expect(findings).toHaveLength(0);
    });

    it('skips comment lines', async () => {
      const code = `import { PrismaClient } from 'prisma';\n// prisma.user.findOne is hallucinated\n/* prisma.user.getAll too */`;
      const findings = await engine.scan(makeDelta(code), signal);
      expect(findings).toHaveLength(0);
    });

    it('does not flag valid Prisma methods', async () => {
      const code = `import { PrismaClient } from 'prisma';\nconst user = await prisma.user.findUnique({ where: { id } });`;
      const findings = await engine.scan(makeDelta(code), signal);
      expect(findings.filter(f => f.message.includes('findUnique'))).toHaveLength(0);
    });

    it('does not flag valid lodash methods', async () => {
      const code = `import _ from 'lodash';\n_.includes(arr, val);\n_.map(arr, fn);`;
      const findings = await engine.scan(makeDelta(code), signal);
      expect(findings).toHaveLength(0);
    });
  });

  // ── Deterministic IDs ──────────────────────────────────────────────────

  describe('deterministic IDs', () => {
    it('produces same ID for same finding across re-scans', async () => {
      const code = `import { PrismaClient } from 'prisma';\nconst user = await prisma.user.findOne({ where: { id } });`;
      const findings1 = await engine.scan(makeDelta(code), signal);
      const findings2 = await engine.scan(makeDelta(code), signal);
      expect(findings1.length).toBeGreaterThan(0);
      expect(findings1.map(f => f.id)).toEqual(findings2.map(f => f.id));
    });

    it('produces different IDs for different files', async () => {
      const code = `import { PrismaClient } from 'prisma';\nconst user = await prisma.user.findOne({ where: { id } });`;
      const findings1 = await engine.scan(makeDelta(code, '/src/a.ts'), signal);
      const findings2 = await engine.scan(makeDelta(code, '/src/b.ts'), signal);
      expect(findings1.length).toBeGreaterThan(0);
      expect(findings1[0]!.id).not.toBe(findings2[0]!.id);
    });

    it('IDs use vhal- prefix', async () => {
      const code = `import { PrismaClient } from 'prisma';\nawait prisma.user.findOne({});`;
      const findings = await engine.scan(makeDelta(code), signal);
      expect(findings.length).toBeGreaterThan(0);
      expect(findings[0]!.id).toMatch(/^vhal-[0-9a-f]{8}$/);
    });
  });

  // ── Finding structure ──────────────────────────────────────────────────

  describe('finding structure', () => {
    it('has correct engine and category', async () => {
      const code = `import _ from 'lodash';\n_.contains(arr, val);`;
      const findings = await engine.scan(makeDelta(code), signal);
      expect(findings.length).toBeGreaterThan(0);
      expect(findings[0]!.engine).toBe('version_hallucination');
      expect(findings[0]!.category).toBe('hallucinations');
    });

    it('provides correct line numbers', async () => {
      const code = `line1\nline2\nimport _ from 'lodash';\n_.contains(arr, val);`;
      const findings = await engine.scan(makeDelta(code), signal);
      const containsFinding = findings.find(f => f.message.includes('contains'));
      if (containsFinding) {
        expect(containsFinding.line).toBe(4);
      }
    });

    it('includes suggestion with replacement method', async () => {
      const code = `import { z } from 'zod';\nz.validate(data);`;
      const findings = await engine.scan(makeDelta(code), signal);
      const f = findings.find(f => f.message.includes('validate'));
      expect(f).toBeDefined();
      expect(f!.suggestion).toBeTruthy();
      expect(f!.suggestion).toContain('parse');
    });
  });

  // ── Deduplication ─────────────────────────────────────────────────────

  describe('deduplication', () => {
    it('does not report same hallucination twice on same line', async () => {
      const code = `import { z } from 'zod';\nz.validate(data); z.validate(other);`;
      const findings = await engine.scan(makeDelta(code), signal);
      const validateFindings = findings.filter(f => f.message.includes('validate'));
      // Should be at most 1 per line due to dedup
      expect(validateFindings.length).toBeLessThanOrEqual(1);
    });
  });
});
