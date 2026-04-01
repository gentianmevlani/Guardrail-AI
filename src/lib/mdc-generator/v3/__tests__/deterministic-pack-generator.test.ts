/**
 * Tests for Deterministic Pack Generator
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { DeterministicPackGenerator, PackContent, PackMetadata } from '../deterministic-pack-generator';
import { TruthIndex } from '../truth-index-extractor';
import { CriticalInvariant } from '../critical-invariants';
import { join } from 'path';
import { tmpdir } from 'os';
import { mkdirSync, writeFileSync } from 'fs';

describe('DeterministicPackGenerator', () => {
  let testProjectPath: string;
  let generator: DeterministicPackGenerator;

  beforeEach(() => {
    testProjectPath = join(tmpdir(), `guardrail-test-${Date.now()}`);
    mkdirSync(testProjectPath, { recursive: true });
    generator = new DeterministicPackGenerator(testProjectPath);
  });

  it('should generate pack with metadata', () => {
    const metadata: PackMetadata = {
      version: '3.0.0',
      timestamp: '2024-01-01T00:00:00.000Z',
      gitCommit: 'abc123def456',
      lane: 'cli-mcp',
      filesIncluded: 5,
      symbolsIncluded: 10,
    };

    const content: PackContent = {
      metadata,
      changedFiles: [],
      dependencyClosure: {
        changedFiles: 0,
        dependentFiles: 0,
        relatedSymbols: 0,
      },
      truthIndex: {
        commands: [],
        tools: [],
        routes: [],
        envVars: [],
        dbModels: [],
        integrations: [],
        schemas: [],
      },
      criticalInvariants: [],
    };

    const pack = generator.generatePack('cli-mcp', content);

    expect(pack).toContain('MDC_PACK_VERSION: 3.0.0');
    expect(pack).toContain('TIMESTAMP: 2024-01-01T00:00:00.000Z');
    expect(pack).toContain('GIT_COMMIT: abc123def456');
    expect(pack).toContain('LANE: CLI_MCP');
  });

  it('should include changed files summary', () => {
    const metadata: PackMetadata = {
      version: '3.0.0',
      timestamp: '2024-01-01T00:00:00.000Z',
      gitCommit: 'abc123',
      lane: 'cli-mcp',
      filesIncluded: 2,
      symbolsIncluded: 0,
    };

    const content: PackContent = {
      metadata,
      changedFiles: [
        { path: 'src/file1.ts', status: 'modified', summary: 'Changed' },
        { path: 'src/file2.ts', status: 'added', summary: 'New file' },
      ],
      dependencyClosure: {
        changedFiles: 2,
        dependentFiles: 0,
        relatedSymbols: 0,
      },
      truthIndex: {
        commands: [],
        tools: [],
        routes: [],
        envVars: [],
        dbModels: [],
        integrations: [],
        schemas: [],
      },
      criticalInvariants: [],
    };

    const pack = generator.generatePack('cli-mcp', content);

    expect(pack).toContain('## Changed Files Summary');
    expect(pack).toContain('src/file1.ts');
    expect(pack).toContain('src/file2.ts');
    expect(pack).toContain('modified');
    expect(pack).toContain('added');
  });

  it('should include truth index', () => {
    const metadata: PackMetadata = {
      version: '3.0.0',
      timestamp: '2024-01-01T00:00:00.000Z',
      gitCommit: 'abc123',
      lane: 'cli-mcp',
      filesIncluded: 0,
      symbolsIncluded: 2,
    };

    const truthIndex: TruthIndex = {
      commands: [
        {
          name: 'scan',
          file: 'packages/cli/src/index.ts',
          line: 100,
          description: 'Run security scan',
        },
      ],
      tools: [
        {
          name: 'guardrail.scan',
          file: 'mcp-server/index.js',
          line: 50,
          mcpServer: 'guardrail',
        },
      ],
      routes: [],
      envVars: [],
      dbModels: [],
      integrations: [],
      schemas: [],
    };

    const content: PackContent = {
      metadata,
      changedFiles: [],
      dependencyClosure: {
        changedFiles: 0,
        dependentFiles: 0,
        relatedSymbols: 0,
      },
      truthIndex,
      criticalInvariants: [],
    };

    const pack = generator.generatePack('cli-mcp', content);

    expect(pack).toContain('## Truth Index');
    expect(pack).toContain('### Commands');
    expect(pack).toContain('scan');
    expect(pack).toContain('### MCP Tools');
    expect(pack).toContain('guardrail.scan');
  });

  it('should include critical invariants', () => {
    const { CRITICAL_INVARIANTS } = require('../critical-invariants');
    const invariants = CRITICAL_INVARIANTS.slice(0, 2);

    const metadata: PackMetadata = {
      version: '3.0.0',
      timestamp: '2024-01-01T00:00:00.000Z',
      gitCommit: 'abc123',
      lane: 'cli-mcp',
      filesIncluded: 0,
      symbolsIncluded: 0,
    };

    const content: PackContent = {
      metadata,
      changedFiles: [],
      dependencyClosure: {
        changedFiles: 0,
        dependentFiles: 0,
        relatedSymbols: 0,
      },
      truthIndex: {
        commands: [],
        tools: [],
        routes: [],
        envVars: [],
        dbModels: [],
        integrations: [],
        schemas: [],
      },
      criticalInvariants: invariants,
    };

    const pack = generator.generatePack('cli-mcp', content);

    expect(pack).toContain('## Critical Invariants');
    invariants.forEach(inv => {
      expect(pack).toContain(inv.id);
    });
  });

  it('should produce deterministic output', () => {
    const metadata: PackMetadata = {
      version: '3.0.0',
      timestamp: '2024-01-01T00:00:00.000Z',
      gitCommit: 'abc123',
      lane: 'cli-mcp',
      filesIncluded: 2,
      symbolsIncluded: 0,
    };

    const content: PackContent = {
      metadata,
      changedFiles: [
        { path: 'src/file2.ts', status: 'added', summary: 'New' },
        { path: 'src/file1.ts', status: 'modified', summary: 'Changed' },
      ],
      dependencyClosure: {
        changedFiles: 2,
        dependentFiles: 0,
        relatedSymbols: 0,
      },
      truthIndex: {
        commands: [],
        tools: [],
        routes: [],
        envVars: [],
        dbModels: [],
        integrations: [],
        schemas: [],
      },
      criticalInvariants: [],
    };

    const pack1 = generator.generatePack('cli-mcp', content);
    const pack2 = generator.generatePack('cli-mcp', content);

    // Remove timestamps for comparison (they're deterministic in this test, but in real usage they differ)
    const normalize = (s: string) => s.replace(/TIMESTAMP: .+/g, 'TIMESTAMP: XXX');
    expect(normalize(pack1)).toBe(normalize(pack2));
  });

  it('should sort changed files deterministically', () => {
    const metadata: PackMetadata = {
      version: '3.0.0',
      timestamp: '2024-01-01T00:00:00.000Z',
      gitCommit: 'abc123',
      lane: 'cli-mcp',
      filesIncluded: 3,
      symbolsIncluded: 0,
    };

    // Files in non-alphabetical order
    const content: PackContent = {
      metadata,
      changedFiles: [
        { path: 'src/file3.ts', status: 'added', summary: 'New' },
        { path: 'src/file1.ts', status: 'modified', summary: 'Changed' },
        { path: 'src/file2.ts', status: 'modified', summary: 'Changed' },
      ],
      dependencyClosure: {
        changedFiles: 3,
        dependentFiles: 0,
        relatedSymbols: 0,
      },
      truthIndex: {
        commands: [],
        tools: [],
        routes: [],
        envVars: [],
        dbModels: [],
        integrations: [],
        schemas: [],
      },
      criticalInvariants: [],
    };

    const pack = generator.generatePack('cli-mcp', content);

    // Should be sorted alphabetically
    const file1Index = pack.indexOf('src/file1.ts');
    const file2Index = pack.indexOf('src/file2.ts');
    const file3Index = pack.indexOf('src/file3.ts');

    expect(file1Index).toBeLessThan(file2Index);
    expect(file2Index).toBeLessThan(file3Index);
  });
});
