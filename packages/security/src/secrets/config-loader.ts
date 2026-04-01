/**
 * config-loader.ts
 * Load and validate custom secret patterns from .guardrail/secrets.yaml
 */

import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { parse as parseYaml } from 'yaml';
import { SecretPattern, SecretType, RiskLevel } from './patterns';

export interface CustomPatternConfig {
  name: string;
  type: string;
  regex: string;
  minEntropy?: number;
  description?: string;
  risk?: RiskLevel;
}

export interface SecretsConfigFile {
  patterns?: CustomPatternConfig[];
}

export class ConfigValidationError extends Error {
  constructor(message: string, public readonly details?: string[]) {
    super(message);
    this.name = 'ConfigValidationError';
  }
}

/**
 * Load and validate custom patterns from .guardrail/secrets.yaml
 */
export function loadCustomPatterns(projectPath: string): SecretPattern[] {
  const configPath = join(projectPath, '.guardrail', 'secrets.yaml');
  
  if (!existsSync(configPath)) {
    return [];
  }

  let rawContent: string;
  try {
    rawContent = readFileSync(configPath, 'utf-8');
  } catch (err) {
    throw new ConfigValidationError(
      `Failed to read secrets config: ${configPath}`,
      [(err as Error).message]
    );
  }

  let parsed: any;
  try {
    parsed = parseYaml(rawContent);
  } catch (err) {
    throw new ConfigValidationError(
      'Invalid YAML syntax in secrets.yaml',
      [(err as Error).message]
    );
  }

  if (!parsed || typeof parsed !== 'object') {
    throw new ConfigValidationError('secrets.yaml must contain an object at root');
  }

  const config = parsed as SecretsConfigFile;
  
  if (!config.patterns) {
    return [];
  }

  if (!Array.isArray(config.patterns)) {
    throw new ConfigValidationError('patterns must be an array');
  }

  const errors: string[] = [];
  const customPatterns: SecretPattern[] = [];

  config.patterns.forEach((pattern, idx) => {
    const prefix = `patterns[${idx}]`;

    // Validate required fields
    if (!pattern.name || typeof pattern.name !== 'string') {
      errors.push(`${prefix}.name is required and must be a string`);
    }
    if (!pattern.type || typeof pattern.type !== 'string') {
      errors.push(`${prefix}.type is required and must be a string`);
    }
    if (!pattern.regex || typeof pattern.regex !== 'string') {
      errors.push(`${prefix}.regex is required and must be a string`);
    }

    // Validate optional fields
    if (pattern.minEntropy !== undefined) {
      if (typeof pattern.minEntropy !== 'number' || pattern.minEntropy < 0 || pattern.minEntropy > 8) {
        errors.push(`${prefix}.minEntropy must be a number between 0 and 8`);
      }
    }

    if (pattern.risk !== undefined) {
      if (!['high', 'medium', 'low'].includes(pattern.risk)) {
        errors.push(`${prefix}.risk must be one of: high, medium, low`);
      }
    }

    // Try to compile regex
    let regex: RegExp;
    try {
      regex = new RegExp(pattern.regex);
    } catch (err) {
      errors.push(`${prefix}.regex is invalid: ${(err as Error).message}`);
      return;
    }

    if (errors.length === 0) {
      customPatterns.push({
        type: pattern.type as SecretType,
        name: pattern.name,
        pattern: regex,
        minEntropy: pattern.minEntropy,
        risk: pattern.risk || 'medium',
        description: pattern.description || pattern.name,
        examples: [],
      });
    }
  });

  if (errors.length > 0) {
    throw new ConfigValidationError(
      'Invalid custom patterns in secrets.yaml',
      errors
    );
  }

  return customPatterns;
}
