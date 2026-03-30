import { describe, it, expect } from 'vitest';
import { EnvVarEngine } from './EnvVarEngine.js';
import type { IEnvIndex } from './core-types';

function createEnvIndex(vars: string[]): IEnvIndex {
  const index = new Set(vars);
  return {
    index,
    has(name: string) {
      return index.has(name);
    },
  };
}

describe('EnvVarEngine', () => {
  it('detects process.env.MISSING_VAR when not in index', async () => {
    const index = createEnvIndex(['DATABASE_URL', 'API_KEY']);
    const engine = new EnvVarEngine(index);
    const delta = {
      documentUri: 'file:///project/src/config.ts',
      documentLanguage: 'typescript',
      fullText: `export const config = {
  db: process.env.MISSING_VAR,
};
`,
      changedRanges: [],
      changedText: '',
    };
    const findings = await engine.scan(delta);
    expect(findings.length).toBeGreaterThanOrEqual(1);
    expect(findings.some((f) => f.message.includes('MISSING_VAR') || f.evidence?.includes('MISSING_VAR'))).toBe(true);
  });

  it('does not flag process.env.VAR when VAR is in index', async () => {
    const index = createEnvIndex(['DATABASE_URL']);
    const engine = new EnvVarEngine(index);
    const delta = {
      documentUri: 'file:///project/src/config.ts',
      documentLanguage: 'typescript',
      fullText: `export const db = process.env.DATABASE_URL;
`,
      changedRanges: [],
      changedText: '',
    };
    const findings = await engine.scan(delta);
    expect(findings.filter((f) => f.evidence?.includes('DATABASE_URL'))).toHaveLength(0);
  });

  it('returns empty when env index is empty (no env files)', async () => {
    const index = createEnvIndex([]);
    const engine = new EnvVarEngine(index);
    const delta = {
      documentUri: 'file:///project/src/config.ts',
      documentLanguage: 'typescript',
      fullText: `const x = process.env.MISSING_VAR;
`,
      changedRanges: [],
      changedText: '',
    };
    const findings = await engine.scan(delta);
    expect(findings).toHaveLength(0);
  });
});
