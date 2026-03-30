/**
 * Configuration Loader
 * 
 * Loads project-specific configuration from .guardrailrc
 */

import * as fs from 'fs';
import * as path from 'path';

export interface GuardrailConfig {
  rules?: {
    enabled?: string[];
    disabled?: string[];
    custom?: Array<{
      id: string;
      name: string;
      description: string;
      severity: 'error' | 'warning' | 'info';
      pattern?: string;
      check: string; // Path to check function
    }>;
  };
  paths?: {
    components?: string;
    features?: string;
    lib?: string;
    hooks?: string;
  };
  api?: {
    autoRegister?: boolean;
    endpointFile?: string;
  };
  validation?: {
    strict?: boolean;
    autoFix?: boolean;
    watch?: boolean;
  };
  team?: {
    workspaceId?: string;
    syncEnabled?: boolean;
  };
  extends?: string; // Path to parent config
}

class ConfigLoader {
  private configCache: Map<string, GuardrailConfig> = new Map();

  /**
   * Load configuration from .guardrailrc
   */
  async loadConfig(projectPath: string): Promise<GuardrailConfig> {
    // Check cache
    if (this.configCache.has(projectPath)) {
      return this.configCache.get(projectPath)!;
    }

    const configPath = path.join(projectPath, '.guardrailrc');
    const configPathJson = path.join(projectPath, '.guardrailrc.json');
    const configPathJs = path.join(projectPath, '.guardrailrc.js');
    const configPathTs = path.join(projectPath, '.guardrailrc.ts');

    let config: GuardrailConfig = {};

    // Try JSON first
    if (await this.pathExists(configPathJson)) {
      const content = await fs.promises.readFile(configPathJson, 'utf8');
      config = JSON.parse(content);
    }
    // Try .guardrailrc (JSON)
    else if (await this.pathExists(configPath)) {
      const content = await fs.promises.readFile(configPath, 'utf8');
      config = JSON.parse(content);
    }
    // Try JS/TS (would need dynamic import)
    else if (await this.pathExists(configPathJs)) {
      // In production, use dynamic import
      config = require(configPathJs);
    }

    // Handle extends
    if (config.extends) {
      const parentPath = path.isAbsolute(config.extends)
        ? config.extends
        : path.join(projectPath, config.extends);
      const parentConfig = await this.loadConfig(parentPath);
      config = this.mergeConfigs(parentConfig, config);
    }

    // Cache config
    this.configCache.set(projectPath, config);

    return config;
  }

  /**
   * Save configuration
   */
  async saveConfig(projectPath: string, config: GuardrailConfig): Promise<void> {
    const configPath = path.join(projectPath, '.guardrailrc.json');
    await fs.promises.writeFile(
      configPath,
      JSON.stringify(config, null, 2)
    );
    this.configCache.set(projectPath, config);
  }

  /**
   * Get default configuration
   */
  getDefaultConfig(): GuardrailConfig {
    return {
      validation: {
        strict: true,
        autoFix: false,
        watch: false,
      },
      paths: {
        components: 'src/components',
        features: 'src/features',
        lib: 'src/lib',
        hooks: 'src/hooks',
      },
      api: {
        autoRegister: false,
        endpointFile: 'src/config/api-endpoints.ts',
      },
    };
  }

  /**
   * Merge two configurations
   */
  private mergeConfigs(
    parent: GuardrailConfig,
    child: GuardrailConfig
  ): GuardrailConfig {
    return {
      ...parent,
      ...child,
      rules: {
        ...parent.rules,
        ...child.rules,
        enabled: [...(parent.rules?.enabled || []), ...(child.rules?.enabled || [])],
        disabled: [...(parent.rules?.disabled || []), ...(child.rules?.disabled || [])],
        custom: [...(parent.rules?.custom || []), ...(child.rules?.custom || [])],
      },
      paths: {
        ...parent.paths,
        ...child.paths,
      },
      validation: {
        ...parent.validation,
        ...child.validation,
      },
    };
  }

  private async pathExists(p: string): Promise<boolean> {
    try {
      await fs.promises.access(p);
      return true;
    } catch {
      return false;
    }
  }
}

export const configLoader = new ConfigLoader();

