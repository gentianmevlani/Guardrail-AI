/**
 * Init Module - Enterprise-grade project initialization
 */

export { detectFramework, formatFrameworkName, type DetectedFramework, type FrameworkDetectionResult } from './detect-framework';
export { 
  getTemplate, 
  validateConfig, 
  mergeWithFrameworkDefaults,
  getTemplateChoices,
  GuardrailConfigSchema,
  type GuardrailConfig,
  type TemplateType,
  type TemplateDefinition,
} from './templates';
export { generateCIWorkflow, getCIProviderFromProject, type CIGeneratorOptions, type CIGeneratorResult } from './ci-generator';
export { installHooks, getRecommendedRunner, type HooksInstallerOptions, type HooksInstallerResult, type HookRunner } from './hooks-installer';
