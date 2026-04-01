import { describe, it, expect, afterEach } from 'vitest';
import { writeFileSync, mkdirSync, rmSync, existsSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { loadProcmemConfig } from '../src/lib/config';

describe('loadProcmemConfig', () => {
  let dir: string;

  afterEach(() => {
    if (dir && existsSync(dir)) rmSync(dir, { recursive: true, force: true });
  });

  it('reads deepModel and reportSplitDate from config.yaml in cwd', () => {
    dir = join(tmpdir(), `engram-yaml-${Date.now()}`);
    mkdirSync(dir, { recursive: true });
    writeFileSync(
      join(dir, 'config.yaml'),
      'deepModel: claude-test-model\nreportSplitDate: "2026-02-01T12:00:00Z"\n'
    );
    const c = loadProcmemConfig(dir);
    expect(c.deepModel).toBe('claude-test-model');
    expect(c.reportSplitDate).toBe('2026-02-01T12:00:00Z');
  });
});
