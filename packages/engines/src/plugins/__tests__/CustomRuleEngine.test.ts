/**
 * Tests for CustomRuleEngine and plugin system.
 */

import { describe, it, expect, vi } from 'vitest';
import { CustomRuleEngine } from '../CustomRuleEngine';
import type { DeltaContext } from '../../core-types';
import type { GuardrailPluginConfig, PluginManifest, RuleContext } from '../types';

// Mock a simple plugin manifest
const mockPlugin: PluginManifest = {
  name: 'guardrail-plugin-test',
  version: '1.0.0',
  description: 'Test plugin',
  rules: [
    {
      id: 'TEST-001',
      name: 'no-console-log',
      description: 'Detects console.log statements',
      severity: 'medium',
      languages: ['typescript', 'javascript'],
      category: 'code-quality',
      check(ctx: RuleContext) {
        for (let i = 0; i < ctx.lines.length; i++) {
          if (ctx.lines[i]!.includes('console.log')) {
            ctx.report({
              message: 'Remove console.log before shipping',
              line: i + 1,
              evidence: ctx.lines[i]!.trim(),
            });
          }
        }
      },
    },
    {
      id: 'TEST-002',
      name: 'no-todo-comments',
      description: 'Detects TODO comments',
      severity: 'low',
      languages: ['any'],
      category: 'code-quality',
      check(ctx: RuleContext) {
        for (let i = 0; i < ctx.lines.length; i++) {
          if (/\/\/\s*TODO/i.test(ctx.lines[i]!)) {
            ctx.report({
              message: 'Unresolved TODO comment',
              line: i + 1,
              severity: 'info',
              evidence: ctx.lines[i]!.trim(),
            });
          }
        }
      },
    },
  ],
};

function makeDelta(source: string, filePath = 'src/app.ts'): DeltaContext {
  return {
    documentUri: `file://${filePath}`,
    documentLanguage: 'typescript',
    fullText: source,
    changedRanges: [{ start: 0, end: source.length }],
    changedText: source,
  };
}

describe('CustomRuleEngine', () => {
  it('should run rules and report findings', async () => {
    const config: GuardrailPluginConfig = { plugins: [], rules: {} };
    const engine = new CustomRuleEngine('/tmp/test', config);

    // Manually inject rules (bypassing plugin loader for unit test)
    (engine as any)._rules = mockPlugin.rules.map((r) => ({
      definition: r,
      effectiveSeverity: r.severity,
      enabled: true,
      pluginName: 'guardrail-plugin-test',
    }));

    const source = `
      const x = 1;
      console.log(x);
      // TODO: fix this
      const y = 2;
    `;

    const findings = await engine.scan(makeDelta(source), new AbortController().signal);

    expect(findings.length).toBe(2);
    expect(findings[0]!.ruleId).toBe('TEST-001');
    expect(findings[0]!.message).toContain('console.log');
    expect(findings[1]!.ruleId).toBe('TEST-002');
    expect(findings[1]!.message).toContain('TODO');
  });

  it('should skip disabled rules', async () => {
    const config: GuardrailPluginConfig = { plugins: [], rules: {} };
    const engine = new CustomRuleEngine('/tmp/test', config);

    (engine as any)._rules = [
      {
        definition: mockPlugin.rules[0],
        effectiveSeverity: 'medium',
        enabled: true,
        pluginName: 'test',
      },
      {
        definition: mockPlugin.rules[1],
        effectiveSeverity: 'low',
        enabled: false, // Disabled
        pluginName: 'test',
      },
    ];

    const source = `console.log('hi'); // TODO: remove`;
    const findings = await engine.scan(makeDelta(source), new AbortController().signal);

    expect(findings.length).toBe(1);
    expect(findings[0]!.ruleId).toBe('TEST-001');
  });

  it('should filter rules by language', async () => {
    const config: GuardrailPluginConfig = { plugins: [], rules: {} };
    const engine = new CustomRuleEngine('/tmp/test', config);

    const pythonOnlyRule = {
      definition: {
        id: 'PY-TEST',
        name: 'python-only',
        description: 'Only for Python',
        severity: 'medium' as const,
        languages: ['python' as const],
        check(ctx: RuleContext) {
          ctx.report({ message: 'Found in Python', line: 1 });
        },
      },
      effectiveSeverity: 'medium' as const,
      enabled: true,
      pluginName: 'test',
    };

    (engine as any)._rules = [pythonOnlyRule];

    // Scan a TypeScript file — should skip
    const findings = await engine.scan(
      makeDelta('some code', 'src/app.ts'),
      new AbortController().signal
    );
    expect(findings.length).toBe(0);

    // Scan a Python file — should match
    const pyFindings = await engine.scan(
      makeDelta('some code', 'src/app.py'),
      new AbortController().signal
    );
    expect(pyFindings.length).toBe(1);
  });

  it('should handle rules that throw errors gracefully', async () => {
    const config: GuardrailPluginConfig = { plugins: [], rules: {} };
    const engine = new CustomRuleEngine('/tmp/test', config);

    (engine as any)._rules = [
      {
        definition: {
          id: 'BROKEN-001',
          name: 'broken-rule',
          description: 'This rule throws',
          severity: 'medium' as const,
          languages: ['any' as const],
          check() {
            throw new Error('Rule is broken!');
          },
        },
        effectiveSeverity: 'medium' as const,
        enabled: true,
        pluginName: 'broken-plugin',
      },
    ];

    const findings = await engine.scan(makeDelta('code'), new AbortController().signal);

    expect(findings.length).toBe(1);
    expect(findings[0]!.message).toContain('threw an error');
    expect(findings[0]!.severity).toBe('info');
  });

  it('should respect severity overrides', async () => {
    const config: GuardrailPluginConfig = { plugins: [], rules: {} };
    const engine = new CustomRuleEngine('/tmp/test', config);

    (engine as any)._rules = [
      {
        definition: mockPlugin.rules[0],
        effectiveSeverity: 'critical', // Overridden from 'medium' to 'critical'
        enabled: true,
        pluginName: 'test',
      },
    ];

    const findings = await engine.scan(
      makeDelta('console.log("test")'),
      new AbortController().signal
    );

    expect(findings.length).toBe(1);
    // The finding uses the rule's own report severity or falls back to effectiveSeverity
    expect(findings[0]!.severity).toBe('critical');
  });

  it('should return stats with plugin info', () => {
    const config: GuardrailPluginConfig = { plugins: [], rules: {} };
    const engine = new CustomRuleEngine('/tmp/test', config);

    (engine as any)._rules = mockPlugin.rules.map((r) => ({
      definition: r,
      effectiveSeverity: r.severity,
      enabled: true,
      pluginName: 'test',
    }));

    const stats = engine.getStats();
    expect(stats.totalRules).toBe(2);
  });
});
