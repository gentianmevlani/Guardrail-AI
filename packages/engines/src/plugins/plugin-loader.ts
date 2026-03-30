/**
 * PluginLoader — Discovers, loads, and validates Guardrail plugins.
 *
 * Supports three sources:
 * 1. npm packages: `guardrail-plugin-nextjs` or `@scope/guardrail-plugin-express`
 * 2. Local paths: `./my-rules` or `../shared-rules`
 * 3. Builtin packs: `@guardrail/rules-nextjs` (shipped with Guardrail)
 */

import * as path from 'path';
import * as fs from 'fs';
import type {
  PluginManifest,
  PluginModule,
  LoadedPlugin,
  ResolvedRule,
  GuardrailPluginConfig,
  RuleConfig,
  RuleSeverityConfig,
} from './types';
import type { Severity } from '../core-types';

const VALID_SEVERITIES: Set<string> = new Set(['critical', 'high', 'medium', 'low', 'info']);

export class PluginLoader {
  private readonly _projectRoot: string;
  private readonly _loaded = new Map<string, LoadedPlugin>();

  constructor(projectRoot: string) {
    this._projectRoot = projectRoot;
  }

  /**
   * Load all plugins specified in the config.
   * Returns loaded plugins with rules resolved against config overrides.
   */
  async loadAll(config: GuardrailPluginConfig): Promise<LoadedPlugin[]> {
    const plugins: LoadedPlugin[] = [];

    for (const ref of config.plugins ?? []) {
      if (this._loaded.has(ref)) {
        plugins.push(this._loaded.get(ref)!);
        continue;
      }

      const loaded = await this._loadPlugin(ref, config);
      this._loaded.set(ref, loaded);
      plugins.push(loaded);
    }

    return plugins;
  }

  /** Get all loaded plugins. */
  getLoaded(): LoadedPlugin[] {
    return [...this._loaded.values()];
  }

  /** Get a specific loaded plugin by name. */
  get(name: string): LoadedPlugin | undefined {
    return this._loaded.get(name);
  }

  private async _loadPlugin(
    ref: string,
    config: GuardrailPluginConfig
  ): Promise<LoadedPlugin> {
    const isLocal = ref.startsWith('.') || ref.startsWith('/');
    const resolvedPath = isLocal
      ? path.resolve(this._projectRoot, ref)
      : this._resolveNpmPlugin(ref);

    const manifest = await this._loadManifest(resolvedPath, ref);
    this._validateManifest(manifest, ref);

    const activeRules = this._resolveRules(manifest, config);

    return {
      manifest,
      source: isLocal ? 'local' : manifest.name.startsWith('@guardrail/') ? 'builtin' : 'npm',
      resolvedPath,
      activeRules,
    };
  }

  private _resolveNpmPlugin(ref: string): string {
    // Try to resolve from node_modules
    const candidates = [
      path.join(this._projectRoot, 'node_modules', ref),
      path.join(this._projectRoot, 'node_modules', `guardrail-plugin-${ref}`),
      path.join(this._projectRoot, 'node_modules', `@guardrail/rules-${ref}`),
    ];

    for (const candidate of candidates) {
      if (fs.existsSync(candidate)) {
        return candidate;
      }
    }

    // If nothing found in node_modules, return the direct ref for require() resolution
    return ref;
  }

  private async _loadManifest(
    resolvedPath: string,
    ref: string
  ): Promise<PluginManifest> {
    // Try multiple entry points
    const candidates = [
      resolvedPath,
      path.join(resolvedPath, 'index.ts'),
      path.join(resolvedPath, 'index.js'),
      path.join(resolvedPath, 'index.mjs'),
      path.join(resolvedPath, 'plugin.ts'),
      path.join(resolvedPath, 'plugin.js'),
    ];

    for (const candidate of candidates) {
      if (!fs.existsSync(candidate)) continue;
      const stat = fs.statSync(candidate);
      if (stat.isDirectory()) continue;

      try {
        // Dynamic import for ESM/CJS interop
        const mod = await import(candidate);
        const manifest: PluginManifest | undefined =
          mod.plugin ?? mod.default?.plugin ?? mod.default;

        if (manifest && typeof manifest === 'object' && Array.isArray(manifest.rules)) {
          return manifest;
        }
      } catch {
        // Try next candidate
      }
    }

    // Try loading as a guardrail.plugin.ts/js config file
    const configCandidates = [
      path.join(resolvedPath, 'guardrail.plugin.ts'),
      path.join(resolvedPath, 'guardrail.plugin.js'),
    ];

    for (const candidate of configCandidates) {
      if (!fs.existsSync(candidate)) continue;
      try {
        const mod = await import(candidate);
        const manifest = mod.plugin ?? mod.default?.plugin ?? mod.default;
        if (manifest && typeof manifest === 'object' && Array.isArray(manifest.rules)) {
          return manifest;
        }
      } catch {
        // Try next candidate
      }
    }

    throw new Error(
      `Failed to load plugin "${ref}": no valid plugin manifest found at ${resolvedPath}. ` +
        `Plugin must export { plugin: PluginManifest } from index.ts/js or guardrail.plugin.ts/js.`
    );
  }

  private _validateManifest(manifest: PluginManifest, ref: string): void {
    if (!manifest.name || typeof manifest.name !== 'string') {
      throw new Error(`Plugin "${ref}" has invalid manifest: missing or invalid "name".`);
    }
    if (!manifest.version || typeof manifest.version !== 'string') {
      throw new Error(`Plugin "${ref}" has invalid manifest: missing or invalid "version".`);
    }
    if (!Array.isArray(manifest.rules)) {
      throw new Error(`Plugin "${ref}" has invalid manifest: "rules" must be an array.`);
    }

    for (const rule of manifest.rules) {
      if (!rule.id || typeof rule.id !== 'string') {
        throw new Error(`Plugin "${ref}" has a rule with missing or invalid "id".`);
      }
      if (typeof rule.check !== 'function') {
        throw new Error(
          `Plugin "${ref}" rule "${rule.id}" has invalid "check": must be a function.`
        );
      }
      if (!VALID_SEVERITIES.has(rule.severity)) {
        throw new Error(
          `Plugin "${ref}" rule "${rule.id}" has invalid severity "${rule.severity}". ` +
            `Must be one of: ${[...VALID_SEVERITIES].join(', ')}.`
        );
      }
    }
  }

  private _resolveRules(
    manifest: PluginManifest,
    config: GuardrailPluginConfig
  ): ResolvedRule[] {
    return manifest.rules.map((definition) => {
      const ruleConfig = config.rules?.[definition.id];
      const { severity, enabled } = this._parseRuleConfig(ruleConfig, definition.severity);

      return {
        definition,
        effectiveSeverity: severity,
        enabled,
        pluginName: manifest.name,
      };
    });
  }

  private _parseRuleConfig(
    config: RuleConfig | undefined,
    defaultSeverity: Severity
  ): { severity: Severity; enabled: boolean } {
    if (config === undefined) {
      return { severity: defaultSeverity, enabled: true };
    }

    if (config === 'off') {
      return { severity: defaultSeverity, enabled: false };
    }

    if (typeof config === 'string') {
      if (!VALID_SEVERITIES.has(config)) {
        return { severity: defaultSeverity, enabled: true };
      }
      return { severity: config as Severity, enabled: true };
    }

    if (Array.isArray(config)) {
      const [sev] = config;
      if (sev === 'off') {
        return { severity: defaultSeverity, enabled: false };
      }
      return {
        severity: VALID_SEVERITIES.has(sev) ? (sev as Severity) : defaultSeverity,
        enabled: true,
      };
    }

    return { severity: defaultSeverity, enabled: true };
  }
}
