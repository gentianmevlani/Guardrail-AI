import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtempSync, writeFileSync, rmSync, mkdirSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { PhantomDepEngine } from './PhantomDepEngine.js';

describe('PhantomDepEngine', () => {
  let tmpDir: string;

  beforeAll(() => {
    tmpDir = mkdtempSync(join(tmpdir(), 'phantom-dep-test-'));
    writeFileSync(
      join(tmpDir, 'package.json'),
      JSON.stringify({
        name: 'test-app',
        dependencies: { react: '^18.0.0' },
      }),
      'utf-8'
    );
    mkdirSync(join(tmpDir, 'src'), { recursive: true });
    writeFileSync(
      join(tmpDir, 'src', 'app.ts'),
      `import { AuthProvider } from 'react-auth-provider';
export const App = () => <AuthProvider />;
`,
      'utf-8'
    );
  });

  afterAll(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it('detects known fake package react-auth-provider', async () => {
    const engine = new PhantomDepEngine(tmpDir, { confidenceThreshold: 0.5 });
    const filePath = join(tmpDir, 'src', 'app.ts');
    const delta = {
      documentUri: `file://${filePath}`,
      documentLanguage: 'typescript',
      fullText: `import { AuthProvider } from 'react-auth-provider';
export const App = () => <AuthProvider />;
`,
      changedRanges: [],
      changedText: '',
    };
    const findings = await engine.scan(delta, new AbortController().signal);
    expect(findings.length).toBeGreaterThanOrEqual(1);
    expect(findings.some((f) => f.evidence?.includes('react-auth-provider'))).toBe(true);
  });
});
