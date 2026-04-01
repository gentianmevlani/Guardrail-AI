/**
 * @guardrail/engines/plugins — Plugin system for custom rules and framework packs.
 *
 * Usage:
 *   import { CustomRuleEngine, loadGuardrailConfig, detectFramework } from '@guardrail/engines/plugins';
 *
 *   const config = await loadGuardrailConfig(projectRoot);
 *   const engine = new CustomRuleEngine(projectRoot, config);
 *   await engine.activate();
 *   registry.register(engine, { priority: 200, timeoutMs: 500 });
 */

// Core plugin types
export type {
  RuleDefinition,
  RuleContext,
  RuleFinding,
  RuleLanguage,
  PluginManifest,
  PluginModule,
  GuardrailPluginConfig,
  RuleConfig,
  RuleSeverityConfig,
  PluginRef,
  LoadedPlugin,
  ResolvedRule,
} from './types';

export { LANGUAGE_EXTENSIONS } from './types';

// Plugin infrastructure
export { PluginLoader } from './plugin-loader';
export { CustomRuleEngine } from './CustomRuleEngine';
export { loadGuardrailConfig, detectFramework } from './config-loader';

// Built-in framework packs
export {
  nextjsPack,
  expressPack,
  pythonPack,
  BUILTIN_PACKS,
  getBuiltinPack,
  listBuiltinPacks,
} from './packs/index';
