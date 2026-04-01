/**
 * Tests for template configuration and Zod schema validation
 */

import {
  getTemplate,
  validateConfig,
  mergeWithFrameworkDefaults,
  getTemplateChoices,
  GuardrailConfigSchema,
  type GuardrailConfig,
  type TemplateType,
} from '../init/templates';

describe('Template Configuration', () => {
  describe('getTemplate', () => {
    it('should return startup template with correct defaults', () => {
      const template = getTemplate('startup');

      expect(template.name).toBe('Startup');
      expect(template.config.template).toBe('startup');
      expect(template.config.scans.secrets.enabled).toBe(true);
      expect(template.config.scans.secrets.threshold).toBe('high');
      expect(template.config.scans.compliance.enabled).toBe(false);
      expect(template.config.gating.blockOnCritical).toBe(true);
      expect(template.config.gating.blockOnHigh).toBe(false);
      expect(template.config.noise?.suppressTestFiles).toBe(true);
      expect(template.config.output.format).toBe('table');
    });

    it('should return enterprise template with strict defaults', () => {
      const template = getTemplate('enterprise');

      expect(template.name).toBe('Enterprise');
      expect(template.config.template).toBe('enterprise');
      expect(template.config.scans.secrets.enabled).toBe(true);
      expect(template.config.scans.secrets.threshold).toBe('low');
      expect(template.config.scans.compliance.enabled).toBe(true);
      expect(template.config.scans.compliance.frameworks).toContain('soc2');
      expect(template.config.scans.sbom?.enabled).toBe(true);
      expect(template.config.gating.blockOnCritical).toBe(true);
      expect(template.config.gating.blockOnHigh).toBe(true);
      expect(template.config.gating.baselineEnabled).toBe(true);
      expect(template.config.gating.allowlistEnabled).toBe(true);
      expect(template.config.output.format).toBe('sarif');
      expect(template.config.output.sarifUpload).toBe(true);
    });

    it('should return oss template with supply chain focus', () => {
      const template = getTemplate('oss');

      expect(template.name).toBe('OSS');
      expect(template.config.template).toBe('oss');
      expect(template.config.scans.secrets.enabled).toBe(true);
      expect(template.config.scans.vulnerabilities.enabled).toBe(true);
      expect(template.config.scans.compliance.enabled).toBe(false);
      expect(template.config.scans.sbom?.enabled).toBe(true);
      expect(template.config.gating.baselineEnabled).toBe(true);
      expect(template.config.gating.allowlistEnabled).toBe(true);
      expect(template.config.output.format).toBe('markdown');
      expect(template.config.noise?.suppressTestFiles).toBe(true);
    });

    it('should have valid version in all templates', () => {
      const templates: TemplateType[] = ['startup', 'enterprise', 'oss'];

      for (const t of templates) {
        const template = getTemplate(t);
        expect(template.config.version).toBe('1.0.0');
      }
    });
  });

  describe('validateConfig', () => {
    it('should validate a correct startup config', () => {
      const template = getTemplate('startup');
      const result = validateConfig(template.config);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.version).toBe('1.0.0');
      }
    });

    it('should validate a correct enterprise config', () => {
      const template = getTemplate('enterprise');
      const result = validateConfig(template.config);

      expect(result.success).toBe(true);
    });

    it('should validate a correct oss config', () => {
      const template = getTemplate('oss');
      const result = validateConfig(template.config);

      expect(result.success).toBe(true);
    });

    it('should fail validation for missing required fields', () => {
      const invalidConfig = {
        version: '1.0.0',
      };

      const result = validateConfig(invalidConfig);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.errors.length).toBeGreaterThan(0);
      }
    });

    it('should fail validation for invalid threshold value', () => {
      const invalidConfig = {
        version: '1.0.0',
        scans: {
          secrets: { enabled: true, threshold: 'invalid' },
          vulnerabilities: { enabled: true },
          compliance: { enabled: false },
        },
        gating: { enabled: true },
        output: { format: 'table' },
      };

      const result = validateConfig(invalidConfig);

      expect(result.success).toBe(false);
    });

    it('should fail validation for invalid output format', () => {
      const invalidConfig = {
        version: '1.0.0',
        scans: {
          secrets: { enabled: true },
          vulnerabilities: { enabled: true },
          compliance: { enabled: false },
        },
        gating: { enabled: true },
        output: { format: 'invalid-format' },
      };

      const result = validateConfig(invalidConfig);

      expect(result.success).toBe(false);
    });

    it('should accept valid compliance frameworks', () => {
      const validConfig: GuardrailConfig = {
        version: '1.0.0',
        scans: {
          secrets: { enabled: true },
          vulnerabilities: { enabled: true },
          compliance: {
            enabled: true,
            frameworks: ['soc2', 'gdpr', 'hipaa', 'pci'],
          },
        },
        gating: { enabled: true },
        output: { format: 'json' },
      };

      const result = validateConfig(validConfig);

      expect(result.success).toBe(true);
    });

    it('should fail for invalid compliance framework', () => {
      const invalidConfig = {
        version: '1.0.0',
        scans: {
          secrets: { enabled: true },
          vulnerabilities: { enabled: true },
          compliance: {
            enabled: true,
            frameworks: ['invalid-framework'],
          },
        },
        gating: { enabled: true },
        output: { format: 'json' },
      };

      const result = validateConfig(invalidConfig);

      expect(result.success).toBe(false);
    });
  });

  describe('mergeWithFrameworkDefaults', () => {
    it('should add framework field to config', () => {
      const template = getTemplate('startup');
      const merged = mergeWithFrameworkDefaults(template.config, 'nextjs', ['secrets', 'vuln']);

      expect(merged.framework).toBe('nextjs');
    });

    it('should enable compliance when recommended for API frameworks', () => {
      const template = getTemplate('startup');
      expect(template.config.scans.compliance.enabled).toBe(false);

      const merged = mergeWithFrameworkDefaults(template.config, 'express', ['secrets', 'compliance']);

      expect(merged.scans.compliance.enabled).toBe(true);
      expect(merged.scans.compliance.frameworks).toContain('soc2');
    });

    it('should preserve existing config values', () => {
      const template = getTemplate('enterprise');
      const merged = mergeWithFrameworkDefaults(template.config, 'nestjs', ['secrets', 'vuln']);

      expect(merged.scans.secrets.threshold).toBe('low');
      expect(merged.gating.baselineEnabled).toBe(true);
      expect(merged.output.format).toBe('sarif');
    });

    it('should handle reality scan recommendation', () => {
      const template = getTemplate('startup');
      const merged = mergeWithFrameworkDefaults(template.config, 'nextjs', ['secrets', 'reality']);

      expect(merged.framework).toBe('nextjs');
      expect(merged.scans.secrets.enabled).toBe(true);
    });
  });

  describe('getTemplateChoices', () => {
    it('should return all three template choices', () => {
      const choices = getTemplateChoices();

      expect(choices).toHaveLength(3);
      expect(choices.map(c => c.value)).toEqual(['startup', 'enterprise', 'oss']);
    });

    it('should include descriptions for all choices', () => {
      const choices = getTemplateChoices();

      for (const choice of choices) {
        expect(choice.name).toBeDefined();
        expect(choice.description).toBeDefined();
        expect(choice.description.length).toBeGreaterThan(0);
      }
    });

    it('should have startup as first option', () => {
      const choices = getTemplateChoices();

      expect(choices[0]!.value).toBe('startup');
      expect(choices[0]!.name).toBe('Startup');
    });
  });

  describe('GuardrailConfigSchema', () => {
    it('should parse minimal valid config', () => {
      const minimalConfig = {
        version: '1.0.0',
        scans: {
          secrets: { enabled: true },
          vulnerabilities: { enabled: true },
          compliance: { enabled: false },
        },
        gating: { enabled: false },
        output: { format: 'table' },
      };

      const result = GuardrailConfigSchema.safeParse(minimalConfig);

      expect(result.success).toBe(true);
    });

    it('should parse full config with all optional fields', () => {
      const fullConfig = {
        version: '2.0.0',
        template: 'enterprise',
        framework: 'nextjs',
        scans: {
          secrets: {
            enabled: true,
            threshold: 'low',
            excludePatterns: ['**/*.test.ts'],
          },
          vulnerabilities: {
            enabled: true,
            threshold: 'medium',
          },
          compliance: {
            enabled: true,
            frameworks: ['soc2', 'gdpr'],
            autoEvidence: true,
          },
          sbom: { enabled: true },
        },
        gating: {
          enabled: true,
          blockOnCritical: true,
          blockOnHigh: true,
          baselineEnabled: true,
          allowlistEnabled: true,
        },
        output: {
          format: 'sarif',
          sarifUpload: true,
          badgeGeneration: true,
        },
        ci: {
          enabled: true,
          provider: 'github',
          runOnPush: true,
          runOnPR: true,
          sarifUpload: true,
        },
        hooks: {
          enabled: true,
          runner: 'husky',
          preCommit: true,
          prePush: true,
        },
        noise: {
          suppressTestFiles: true,
          suppressLowConfidence: true,
          minEntropy: 3.5,
        },
      };

      const result = GuardrailConfigSchema.safeParse(fullConfig);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.ci?.provider).toBe('github');
        expect(result.data.hooks?.runner).toBe('husky');
        expect(result.data.noise?.minEntropy).toBe(3.5);
      }
    });

    it('should accept all valid output formats', () => {
      const formats = ['table', 'json', 'sarif', 'markdown'];

      for (const format of formats) {
        const config = {
          version: '1.0.0',
          scans: {
            secrets: { enabled: true },
            vulnerabilities: { enabled: true },
            compliance: { enabled: false },
          },
          gating: { enabled: false },
          output: { format },
        };

        const result = GuardrailConfigSchema.safeParse(config);
        expect(result.success).toBe(true);
      }
    });

    it('should accept all valid hook runners', () => {
      const runners = ['husky', 'lefthook'];

      for (const runner of runners) {
        const config = {
          version: '1.0.0',
          scans: {
            secrets: { enabled: true },
            vulnerabilities: { enabled: true },
            compliance: { enabled: false },
          },
          gating: { enabled: false },
          output: { format: 'table' },
          hooks: { enabled: true, runner },
        };

        const result = GuardrailConfigSchema.safeParse(config);
        expect(result.success).toBe(true);
      }
    });

    it('should accept all valid CI providers', () => {
      const providers = ['github', 'gitlab', 'azure', 'bitbucket'];

      for (const provider of providers) {
        const config = {
          version: '1.0.0',
          scans: {
            secrets: { enabled: true },
            vulnerabilities: { enabled: true },
            compliance: { enabled: false },
          },
          gating: { enabled: false },
          output: { format: 'table' },
          ci: { enabled: true, provider },
        };

        const result = GuardrailConfigSchema.safeParse(config);
        expect(result.success).toBe(true);
      }
    });
  });
});
