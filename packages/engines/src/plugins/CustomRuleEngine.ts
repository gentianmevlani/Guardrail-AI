/**
 * CustomRuleEngine — Wraps user-defined plugin rules into a ScanEngine.
 * Runs all enabled rules from loaded plugins against each file.
 * Integrates with EngineRegistry like any built-in engine.
 */

import * as path from 'path';
import { BaseEngine } from '../base-engine.js';
import type { Finding, DeltaContext } from '../core-types';
import type { ResolvedRule, RuleContext, RuleFinding, LANGUAGE_EXTENSIONS } from './types';
import { PluginLoader } from './plugin-loader.js';
import type { GuardrailPluginConfig, LoadedPlugin } from './types';

/** Map file extensions to language IDs. */
const EXT_TO_LANGUAGE: Record<string, string> = {
  '.ts': 'typescript', '.tsx': 'typescript', '.mts': 'typescript', '.cts': 'typescript',
  '.js': 'javascript', '.jsx': 'javascript', '.mjs': 'javascript', '.cjs': 'javascript',
  '.py': 'python', '.pyi': 'python',
  '.go': 'go',
  '.rs': 'rust',
  '.java': 'java',
  '.rb': 'ruby',
  '.php': 'php',
};

const LANGUAGE_TO_EXTS: Record<string, Set<string>> = {
  typescript: new Set(['.ts', '.tsx', '.mts', '.cts']),
  javascript: new Set(['.js', '.jsx', '.mjs', '.cjs']),
  python: new Set(['.py', '.pyi']),
  go: new Set(['.go']),
  rust: new Set(['.rs']),
  java: new Set(['.java']),
  ruby: new Set(['.rb']),
  php: new Set(['.php']),
};

export class CustomRuleEngine extends BaseEngine {
  readonly id = 'custom-rules';
  readonly name = 'Custom Rule Engine';
  readonly version = '1.0.0';
  readonly supportedExtensions = null; // Accepts all — we filter per-rule

  private _rules: ResolvedRule[] = [];
  private _loader: PluginLoader;
  private _config: GuardrailPluginConfig;

  constructor(projectRoot: string, config: GuardrailPluginConfig) {
    super();
    this._loader = new PluginLoader(projectRoot);
    this._config = config;
  }

  /** Load plugins and collect active rules. Call before scanning. */
  async activate(): Promise<void> {
    const plugins = await this._loader.loadAll(this._config);
    this._rules = plugins.flatMap((p) => p.activeRules.filter((r) => r.enabled));
  }

  /** Get all loaded plugins. */
  getPlugins(): LoadedPlugin[] {
    return this._loader.getLoaded();
  }

  /** Get all active rules. */
  getRules(): ResolvedRule[] {
    return this._rules;
  }

  async scan(delta: DeltaContext, signal: AbortSignal): Promise<Finding[]> {
    if (this._rules.length === 0) return [];

    const findings: Finding[] = [];
    const uri = delta.documentUri.replace(/^file:\/\//, '');
    const ext = path.extname(uri).toLowerCase();
    const language = delta.documentLanguage || EXT_TO_LANGUAGE[ext] || 'unknown';
    const lines = delta.fullText.split('\n');

    // Filter rules: must be enabled and applicable to this file's language
    const applicableRules = this._rules.filter((rule) => {
      if (!rule.enabled) return false;
      const langs = rule.definition.languages;
      if (!langs || langs.length === 0 || langs.includes('any')) return true;
      return langs.some((lang) => {
        const exts = LANGUAGE_TO_EXTS[lang];
        return exts ? exts.has(ext) : false;
      });
    });

    if (applicableRules.length === 0) return [];

    for (const rule of applicableRules) {
      this.checkAbort(signal);

      const ruleFindings: RuleFinding[] = [];

      const ctx: RuleContext = {
        source: delta.fullText,
        lines,
        filePath: uri,
        uri: delta.documentUri,
        language,
        extension: ext,
        report: (finding: RuleFinding) => {
          ruleFindings.push(finding);
        },
      };

      try {
        const result = rule.definition.check(ctx);
        // Support async rules
        if (result && typeof (result as Promise<void>).then === 'function') {
          await result;
        }
      } catch (err) {
        // Rule threw — record as a single finding so the user knows
        findings.push(
          this.createFinding({
            id: this.deterministicId(uri, 0, 0, rule.definition.id, 'rule-error'),
            ruleId: rule.definition.id,
            file: uri,
            line: 0,
            column: 0,
            message: `Rule ${rule.definition.id} threw an error: ${err instanceof Error ? err.message : String(err)}`,
            evidence: '',
            severity: 'info',
            category: 'plugin-error',
            engine: 'custom-rules' as any,
            autoFixable: false,
            confidence: 1,
          })
        );
        continue;
      }

      // Convert rule findings to engine findings
      for (const rf of ruleFindings) {
        findings.push(
          this.createFinding({
            id: this.deterministicId(
              uri,
              rf.line,
              rf.column ?? 0,
              rule.definition.id,
              rf.evidence ?? rf.message
            ),
            ruleId: rule.definition.id,
            file: uri,
            line: rf.line,
            column: rf.column ?? 0,
            endLine: rf.endLine,
            endColumn: rf.endColumn,
            message: rf.message,
            evidence: rf.evidence ?? '',
            suggestion: rf.suggestion ?? rule.definition.description,
            severity: rf.severity ?? rule.effectiveSeverity,
            category: rule.definition.category ?? 'custom-rule',
            engine: 'custom-rules' as any,
            autoFixable: rf.autoFixable ?? false,
            confidence: rf.confidence ?? 0.85,
          })
        );
      }
    }

    return findings;
  }

  override getStats(): Record<string, unknown> {
    return {
      totalRules: this._rules.length,
      plugins: this._loader.getLoaded().map((p) => ({
        name: p.manifest.name,
        version: p.manifest.version,
        ruleCount: p.activeRules.length,
        enabledCount: p.activeRules.filter((r) => r.enabled).length,
      })),
    };
  }
}
