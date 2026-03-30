/**
 * @guardrail/engines/plugins — Plugin system types.
 * Enables custom rules, framework packs, and community plugins.
 */

import type { Finding, DeltaContext, Severity } from '../core-types';

// ─── Rule Definition ─────────────────────────────────────────────────────────

/** The context passed to every rule's `check()` function. */
export interface RuleContext {
  /** Full source text of the file. */
  source: string;
  /** Source split into lines (0-indexed). */
  lines: string[];
  /** File path relative to project root. */
  filePath: string;
  /** Absolute file URI. */
  uri: string;
  /** Language ID (e.g. 'typescript', 'python', 'go'). */
  language: string;
  /** File extension including dot (e.g. '.ts', '.py'). */
  extension: string;
  /** Report a finding from this rule. */
  report(finding: RuleFinding): void;
}

/** A finding reported by a custom rule (simplified — engine fields are auto-filled). */
export interface RuleFinding {
  message: string;
  line: number;
  column?: number;
  endLine?: number;
  endColumn?: number;
  severity?: Severity;
  evidence?: string;
  suggestion?: string;
  autoFixable?: boolean;
  confidence?: number;
}

/** Supported languages for file extension matching. */
export type RuleLanguage =
  | 'typescript'
  | 'javascript'
  | 'python'
  | 'go'
  | 'rust'
  | 'java'
  | 'ruby'
  | 'php'
  | 'any';

/** Map from language to file extensions. */
export const LANGUAGE_EXTENSIONS: Record<RuleLanguage, string[]> = {
  typescript: ['.ts', '.tsx', '.mts', '.cts'],
  javascript: ['.js', '.jsx', '.mjs', '.cjs'],
  python: ['.py', '.pyi'],
  go: ['.go'],
  rust: ['.rs'],
  java: ['.java'],
  ruby: ['.rb'],
  php: ['.php'],
  any: [],
};

/** A single custom rule definition. */
export interface RuleDefinition {
  /** Unique rule ID. Convention: PLUGIN-NNN (e.g. 'NEXT-001', 'PY-001'). */
  id: string;
  /** Human-readable rule name. */
  name: string;
  /** What this rule checks for. */
  description: string;
  /** Default severity. Can be overridden in guardrail.config.ts. */
  severity: Severity;
  /** Languages this rule applies to. Empty array or ['any'] = all files. */
  languages: RuleLanguage[];
  /** Category for grouping in reports. */
  category?: string;
  /** URL to documentation for this rule. */
  docsUrl?: string;
  /** The check function. Receives context, calls context.report() for violations. */
  check(ctx: RuleContext): void | Promise<void>;
}

// ─── Plugin Manifest ─────────────────────────────────────────────────────────

/** Plugin manifest — describes a Guardrail plugin package. */
export interface PluginManifest {
  /** Plugin name. Convention: guardrail-plugin-* or @scope/guardrail-plugin-*. */
  name: string;
  /** Semantic version. */
  version: string;
  /** Short description shown in `guardrail plugin list`. */
  description: string;
  /** Author name or org. */
  author?: string;
  /** Plugin homepage or repo URL. */
  homepage?: string;
  /** License identifier. */
  license?: string;
  /** Keywords for marketplace search. */
  keywords?: string[];
  /** The rules this plugin exports. */
  rules: RuleDefinition[];
  /** Optional: framework this plugin targets (for auto-detection). */
  framework?: string;
  /** Optional: languages this plugin targets. */
  languages?: RuleLanguage[];
}

/** The shape a plugin module must export (default export or named `plugin`). */
export interface PluginModule {
  plugin: PluginManifest;
}

// ─── Config Types ────────────────────────────────────────────────────────────

/** Rule severity override or 'off' to disable. */
export type RuleSeverityConfig = Severity | 'off';

/** Per-rule configuration in guardrail.config.ts. */
export type RuleConfig = RuleSeverityConfig | [RuleSeverityConfig, Record<string, unknown>?];

/** Plugin reference in config — package name or local path. */
export type PluginRef = string;

/** The guardrail.config.ts shape for plugin/rule configuration. */
export interface GuardrailPluginConfig {
  /** Plugins to load. Can be npm package names or relative paths. */
  plugins?: PluginRef[];
  /** Per-rule overrides. Key = ruleId, value = severity or 'off'. */
  rules?: Record<string, RuleConfig>;
  /** Framework hint for auto-detecting relevant plugins. */
  framework?: string;
  /** Languages to scan (defaults to all installed plugin languages). */
  languages?: RuleLanguage[];
}

// ─── Loaded Plugin ───────────────────────────────────────────────────────────

/** A plugin after loading and validation. */
export interface LoadedPlugin {
  manifest: PluginManifest;
  /** Where the plugin was loaded from. */
  source: 'npm' | 'local' | 'builtin';
  /** Resolved path to the plugin. */
  resolvedPath: string;
  /** Active rules after applying config overrides. */
  activeRules: ResolvedRule[];
}

/** A rule after merging with config overrides. */
export interface ResolvedRule {
  definition: RuleDefinition;
  /** Effective severity after config override. */
  effectiveSeverity: Severity;
  /** Whether this rule is enabled. */
  enabled: boolean;
  /** Plugin that owns this rule. */
  pluginName: string;
}
