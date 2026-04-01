/**
 * Golden Tests for MDC Generator v3
 * 
 * Ensures deterministic output - same inputs should produce same output
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { DeterministicPackGenerator, PackContent, PackMetadata } from '../deterministic-pack-generator';
import { join } from 'path';
import { tmpdir } from 'os';
import { mkdirSync } from 'fs';

describe('MDC Generator v3 - Golden Tests', () => {
  let testProjectPath: string;
  let generator: DeterministicPackGenerator;

  beforeEach(() => {
    testProjectPath = join(tmpdir(), `guardrail-test-${Date.now()}`);
    mkdirSync(testProjectPath, { recursive: true });
    generator = new DeterministicPackGenerator(testProjectPath);
  });

  it('should produce stable pack structure', () => {
    const metadata: PackMetadata = {
      version: '3.0.0',
      timestamp: '2024-01-01T00:00:00.000Z',
      gitCommit: 'abc123def456789',
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
      criticalInvariants: [],
    };

    const pack = generator.generatePack('cli-mcp', content);

    // Verify structure (sections should always appear in order)
    const sections = [
      'MDC_PACK_VERSION:',
      'TIMESTAMP:',
      'GIT_COMMIT:',
      'LANE:',
      '# CLI/MCP Context Pack',
      '## Changed Files Summary',
      '## Dependency Closure',
      '## Truth Index',
      '## Critical Invariants',
    ];

    let lastIndex = -1;
    for (const section of sections) {
      const index = pack.indexOf(section);
      expect(index).toBeGreaterThan(lastIndex);
      lastIndex = index;
    }
  });

  it('should normalize whitespace and formatting', () => {
    const metadata: PackMetadata = {
      version: '3.0.0',
      timestamp: '2024-01-01T00:00:00.000Z',
      gitCommit: 'abc123',
      lane: 'dashboard',
      filesIncluded: 1,
      symbolsIncluded: 0,
    };

    const content: PackContent = {
      metadata,
      changedFiles: [
        { path: 'apps/web-ui/src/app/page.tsx', status: 'modified', summary: 'Updated' },
      ],
      dependencyClosure: {
        changedFiles: 1,
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

    const pack = generator.generatePack('dashboard', content);

    // Verify consistent formatting
    expect(pack).toMatch(/^---\n/); // Starts with YAML frontmatter
    expect(pack).toContain('\n---\n'); // Frontmatter ends properly
    expect(pack).not.toMatch(/\n\n\n\n/); // No excessive blank lines
    expect(pack).not.toMatch(/[ \t]+$/m); // No trailing whitespace on lines
  });

  it('should handle empty content gracefully', () => {
    const metadata: PackMetadata = {
      version: '3.0.0',
      timestamp: '2024-01-01T00:00:00.000Z',
      gitCommit: 'abc123',
      lane: 'shared',
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
      criticalInvariants: [],
    };

    const pack = generator.generatePack('shared', content);

    // Should still generate valid pack
    expect(pack).toContain('MDC_PACK_VERSION');
    expect(pack).toContain('# Shared Context Pack');
    expect(pack.length).toBeGreaterThan(100); // Should have some content
  });

  it('should maintain stable ordering of truth index entries', () => {
    const metadata: PackMetadata = {
      version: '3.0.0',
      timestamp: '2024-01-01T00:00:00.000Z',
      gitCommit: 'abc123',
      lane: 'cli-mcp',
      filesIncluded: 0,
      symbolsIncluded: 3,
    };

    const truthIndex = {
      commands: [
        { name: 'scan', file: 'cli.ts', line: 1, description: 'Scan' },
        { name: 'fix', file: 'cli.ts', line: 2, description: 'Fix' },
        { name: 'certify', file: 'cli.ts', line: 3, description: 'Certify' },
      ],
      tools: [],
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
        relatedSymbols: 3,
      },
      truthIndex,
      criticalInvariants: [],
    };

    const pack = generator.generatePack('cli-mcp', content);

    // Commands should be sorted alphabetically
    const certIndex = pack.indexOf('certify');
    const fixIndex = pack.indexOf('fix');
    const scanIndex = pack.indexOf('scan');

    expect(certIndex).toBeLessThan(fixIndex);
    expect(fixIndex).toBeLessThan(scanIndex);
  });
});
