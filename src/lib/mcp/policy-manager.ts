/**
 * Policy Manager
 * 
 * Manages .guardrailrc policy file operations with atomic updates and diff previews.
 * Supports allowlisting, rule downgrades, and path ignores.
 */

import * as fs from 'fs';
import * as path from 'path';

export interface PolicyConfig {
  version: string;
  rules: {
    [ruleId: string]: {
      severity: 'error' | 'warn' | 'off';
      auditNote?: string;
      updatedAt?: string;
      updatedBy?: string;
    };
  };
  allowlist: {
    domains: string[];
    packages: string[];
    paths: string[];
    patterns: string[];
  };
  ignore: {
    paths: string[];
    files: string[];
  };
  profiles: {
    [name: string]: {
      extends?: string;
      rules?: Record<string, string>;
      flows?: string[];
    };
  };
}

export interface PolicyPatch {
  action: 'allowlist_domain' | 'allowlist_package' | 'allowlist_path' | 'ignore_path' | 'downgrade_rule' | 'disable_rule';
  target: string;
  value?: string;
  auditNote?: string;
}

export interface PolicyDiff {
  patch: PolicyPatch;
  preview: string;
  before: string;
  after: string;
}

const DEFAULT_POLICY: PolicyConfig = {
  version: '1.0.0',
  rules: {},
  allowlist: {
    domains: [],
    packages: [],
    paths: [],
    patterns: [],
  },
  ignore: {
    paths: ['node_modules', '__tests__', '*.test.*', '*.spec.*'],
    files: [],
  },
  profiles: {
    default: {
      flows: ['auth', 'checkout', 'dashboard'],
    },
    strict: {
      extends: 'default',
      rules: {
        'fake-api-domain': 'error',
        'demo-response-data': 'error',
        'simulated-billing': 'error',
      },
    },
    ci: {
      extends: 'strict',
    },
  },
};

class PolicyManager {
  private configPath: string = '';
  private config: PolicyConfig = { ...DEFAULT_POLICY };

  async initialize(projectPath: string): Promise<void> {
    this.configPath = path.join(projectPath, '.guardrailrc');
    await this.load();
  }

  async load(): Promise<PolicyConfig> {
    try {
      if (fs.existsSync(this.configPath)) {
        const content = await fs.promises.readFile(this.configPath, 'utf-8');
        this.config = { ...DEFAULT_POLICY, ...JSON.parse(content) };
      } else {
        this.config = { ...DEFAULT_POLICY };
      }
    } catch (error) {
      this.config = { ...DEFAULT_POLICY };
    }
    return this.config;
  }

  async save(): Promise<void> {
    await fs.promises.writeFile(this.configPath, JSON.stringify(this.config, null, 2));
  }

  async exists(): Promise<boolean> {
    return fs.existsSync(this.configPath);
  }

  async create(): Promise<void> {
    this.config = { ...DEFAULT_POLICY };
    await this.save();
  }

  getConfig(): PolicyConfig {
    return this.config;
  }

  generateDiffPreview(patch: PolicyPatch): PolicyDiff {
    let preview = '';
    let before = '';
    let after = '';

    switch (patch.action) {
      case 'allowlist_domain':
        before = `allowlist.domains: [${this.config.allowlist.domains.map(d => `"${d}"`).join(', ')}]`;
        after = `allowlist.domains: [${[...this.config.allowlist.domains, patch.target].map(d => `"${d}"`).join(', ')}]`;
        preview = `You are adding: allowlist.domains += "${patch.target}"`;
        break;

      case 'allowlist_package':
        before = `allowlist.packages: [${this.config.allowlist.packages.map(p => `"${p}"`).join(', ')}]`;
        after = `allowlist.packages: [${[...this.config.allowlist.packages, patch.target].map(p => `"${p}"`).join(', ')}]`;
        preview = `You are adding: allowlist.packages += "${patch.target}"`;
        break;

      case 'allowlist_path':
        before = `allowlist.paths: [${this.config.allowlist.paths.map(p => `"${p}"`).join(', ')}]`;
        after = `allowlist.paths: [${[...this.config.allowlist.paths, patch.target].map(p => `"${p}"`).join(', ')}]`;
        preview = `You are adding: allowlist.paths += "${patch.target}"`;
        break;

      case 'ignore_path':
        before = `ignore.paths: [${this.config.ignore.paths.map(p => `"${p}"`).join(', ')}]`;
        after = `ignore.paths: [${[...this.config.ignore.paths, patch.target].map(p => `"${p}"`).join(', ')}]`;
        preview = `You are adding: ignore.paths += "${patch.target}"`;
        break;

      case 'downgrade_rule':
        const currentSeverity = this.config.rules[patch.target]?.severity || 'error';
        before = `rules.${patch.target}: { severity: "${currentSeverity}" }`;
        after = `rules.${patch.target}: { severity: "warn", auditNote: "${patch.auditNote || 'Downgraded by user'}" }`;
        preview = `You are changing: rules.${patch.target}.severity = "error" → "warn"`;
        if (patch.auditNote) {
          preview += `\nAudit note: "${patch.auditNote}"`;
        }
        break;

      case 'disable_rule':
        before = `rules.${patch.target}: { severity: "${this.config.rules[patch.target]?.severity || 'error'}" }`;
        after = `rules.${patch.target}: { severity: "off", auditNote: "${patch.auditNote || 'Disabled by user'}" }`;
        preview = `You are disabling: rules.${patch.target}`;
        if (patch.auditNote) {
          preview += `\nAudit note: "${patch.auditNote}"`;
        }
        break;
    }

    return { patch, preview, before, after };
  }

  async applyPatch(patch: PolicyPatch): Promise<PolicyDiff> {
    const diff = this.generateDiffPreview(patch);
    const timestamp = new Date().toISOString();

    switch (patch.action) {
      case 'allowlist_domain':
        if (!this.config.allowlist.domains.includes(patch.target)) {
          this.config.allowlist.domains.push(patch.target);
        }
        break;

      case 'allowlist_package':
        if (!this.config.allowlist.packages.includes(patch.target)) {
          this.config.allowlist.packages.push(patch.target);
        }
        break;

      case 'allowlist_path':
        if (!this.config.allowlist.paths.includes(patch.target)) {
          this.config.allowlist.paths.push(patch.target);
        }
        break;

      case 'ignore_path':
        if (!this.config.ignore.paths.includes(patch.target)) {
          this.config.ignore.paths.push(patch.target);
        }
        break;

      case 'downgrade_rule':
        this.config.rules[patch.target] = {
          severity: 'warn',
          auditNote: patch.auditNote || 'Downgraded by user',
          updatedAt: timestamp,
        };
        break;

      case 'disable_rule':
        this.config.rules[patch.target] = {
          severity: 'off',
          auditNote: patch.auditNote || 'Disabled by user',
          updatedAt: timestamp,
        };
        break;
    }

    await this.save();
    return diff;
  }

  async applyPatches(patches: PolicyPatch[]): Promise<PolicyDiff[]> {
    const diffs: PolicyDiff[] = [];
    for (const patch of patches) {
      diffs.push(await this.applyPatch(patch));
    }
    return diffs;
  }

  isAllowlisted(type: 'domain' | 'package' | 'path', value: string): boolean {
    switch (type) {
      case 'domain':
        return this.config.allowlist.domains.some(d => 
          value.includes(d) || new RegExp(d.replace(/\*/g, '.*')).test(value)
        );
      case 'package':
        return this.config.allowlist.packages.includes(value);
      case 'path':
        return this.config.allowlist.paths.some(p => 
          value.includes(p) || new RegExp(p.replace(/\*/g, '.*')).test(value)
        );
    }
  }

  isIgnored(filePath: string): boolean {
    return this.config.ignore.paths.some(p => 
      filePath.includes(p) || new RegExp(p.replace(/\*/g, '.*')).test(filePath)
    ) || this.config.ignore.files.some(f => 
      filePath.endsWith(f) || new RegExp(f.replace(/\*/g, '.*')).test(filePath)
    );
  }

  getRuleSeverity(ruleId: string): 'error' | 'warn' | 'off' {
    return this.config.rules[ruleId]?.severity || 'error';
  }

  getProfile(name: string): PolicyConfig['profiles'][string] | null {
    return this.config.profiles[name] || null;
  }

  getAvailableProfiles(): string[] {
    return Object.keys(this.config.profiles);
  }
}

export const policyManager = new PolicyManager();
