import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import yaml from 'js-yaml';
import Ajv, { type ErrorObject } from 'ajv';
import addFormats from 'ajv-formats';
import { ConfigValidationError } from './errors.js';

export interface LlmGuardrailConfig {
  version: string;
  pipelineMode: 'fail-fast' | 'collect-all';
  engines: Record<string, { enabled: boolean; priority?: number; options?: Record<string, unknown> }>;
  server?: { host: string; port: number };
  topicFilter?: { blockedTopics: string[] };
  contentPolicy?: { blockedTerms: string[] };
}

const DEFAULT_CONFIG: LlmGuardrailConfig = {
  version: '1',
  pipelineMode: 'collect-all',
  engines: {},
  server: { host: '0.0.0.0', port: 8787 },
};

function emptyConfig(): LlmGuardrailConfig {
  return JSON.parse(JSON.stringify(DEFAULT_CONFIG)) as LlmGuardrailConfig;
}

function configSchema(): object {
  return {
    type: 'object',
    required: ['version'],
    properties: {
      version: { type: 'string' },
      pipelineMode: { enum: ['fail-fast', 'collect-all'] },
      engines: {
        type: 'object',
        additionalProperties: {
          type: 'object',
          properties: {
            enabled: { type: 'boolean' },
            priority: { type: 'number' },
            options: { type: 'object' },
          },
        },
      },
      server: {
        type: 'object',
        properties: {
          host: { type: 'string' },
          port: { type: 'number' },
        },
      },
      topicFilter: {
        type: 'object',
        properties: { blockedTopics: { type: 'array', items: { type: 'string' } } },
      },
      contentPolicy: {
        type: 'object',
        properties: { blockedTerms: { type: 'array', items: { type: 'string' } } },
      },
    },
  };
}

function formatAjvErrors(errors: ErrorObject[] | null | undefined): string[] {
  if (!errors?.length) return ['Unknown validation error'];
  return errors.map((e) => `${e.instancePath || '/'} ${e.message ?? ''}`.trim());
}

/**
 * Path to the YAML shipped in `packages/llm-safety/config/default.yaml`
 * (resolved from this module — works from both `src/` and `dist/`).
 */
export function bundledDefaultConfigPath(): string {
  const here = dirname(fileURLToPath(import.meta.url));
  return join(here, '..', '..', 'config', 'default.yaml');
}

function loadConfigFromFile(path: string): LlmGuardrailConfig {
  const ajv = new Ajv({ allErrors: true, strict: false });
  addFormats(ajv);
  const validate = ajv.compile(configSchema());

  const raw = readFileSync(path, 'utf8');
  const data = yaml.load(raw) as unknown;
  if (!validate(data)) {
    throw new ConfigValidationError('Invalid guardrail config', formatAjvErrors(validate.errors));
  }
  const base = emptyConfig();
  const merged = data as LlmGuardrailConfig;
  return {
    ...base,
    ...merged,
    engines: { ...base.engines, ...merged.engines },
  };
}

/**
 * Load YAML config. If `path` is omitted, uses the bundled `config/default.yaml`
 * when that file exists on disk; otherwise falls back to in-memory defaults.
 */
export function loadConfig(path?: string): LlmGuardrailConfig {
  const resolved =
    path ?? (existsSync(bundledDefaultConfigPath()) ? bundledDefaultConfigPath() : undefined);
  if (!resolved) {
    return emptyConfig();
  }
  return loadConfigFromFile(resolved);
}

/** @deprecated Use `bundledDefaultConfigPath()` */
export function defaultConfigPath(): string {
  return bundledDefaultConfigPath();
}
