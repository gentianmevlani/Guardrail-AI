/**
 * Template Configuration Module
 * Defines startup/enterprise/oss templates with Zod schema validation
 */

import { z } from 'zod';

export const TemplateType = z.enum(['startup', 'enterprise', 'oss']);
export type TemplateType = z.infer<typeof TemplateType>;

export const ScanConfigSchema = z.object({
  enabled: z.boolean(),
  threshold: z.enum(['critical', 'high', 'medium', 'low']).optional(),
  excludePatterns: z.array(z.string()).optional(),
});

export const ComplianceConfigSchema = z.object({
  enabled: z.boolean(),
  frameworks: z.array(z.enum(['soc2', 'gdpr', 'hipaa', 'pci', 'iso27001', 'nist'])).optional(),
  autoEvidence: z.boolean().optional(),
});

export const GatingConfigSchema = z.object({
  enabled: z.boolean(),
  blockOnCritical: z.boolean().optional(),
  blockOnHigh: z.boolean().optional(),
  baselineEnabled: z.boolean().optional(),
  allowlistEnabled: z.boolean().optional(),
});

export const OutputConfigSchema = z.object({
  format: z.enum(['table', 'json', 'sarif', 'markdown']),
  sarifUpload: z.boolean().optional(),
  badgeGeneration: z.boolean().optional(),
});

export const CIConfigSchema = z.object({
  enabled: z.boolean(),
  provider: z.enum(['github', 'gitlab', 'azure', 'bitbucket']).optional(),
  runOnPush: z.boolean().optional(),
  runOnPR: z.boolean().optional(),
  sarifUpload: z.boolean().optional(),
});

export const HooksConfigSchema = z.object({
  enabled: z.boolean(),
  runner: z.enum(['husky', 'lefthook']).optional(),
  preCommit: z.boolean().optional(),
  prePush: z.boolean().optional(),
});

export const GuardrailConfigSchema = z.object({
  version: z.string(),
  template: TemplateType.optional(),
  framework: z.string().optional(),
  scans: z.object({
    secrets: ScanConfigSchema,
    vulnerabilities: ScanConfigSchema,
    compliance: ComplianceConfigSchema,
    sbom: z.object({ enabled: z.boolean() }).optional(),
  }),
  gating: GatingConfigSchema,
  output: OutputConfigSchema,
  ci: CIConfigSchema.optional(),
  hooks: HooksConfigSchema.optional(),
  noise: z.object({
    suppressTestFiles: z.boolean().optional(),
    suppressLowConfidence: z.boolean().optional(),
    minEntropy: z.number().optional(),
  }).optional(),
});

export type GuardrailConfig = z.infer<typeof GuardrailConfigSchema>;

export interface TemplateDefinition {
  name: string;
  description: string;
  config: GuardrailConfig;
}

const STARTUP_TEMPLATE: TemplateDefinition = {
  name: 'Startup',
  description: 'Fast scans, minimal compliance, friendly noise thresholds - ideal for early-stage teams',
  config: {
    version: '1.0.0',
    template: 'startup',
    scans: {
      secrets: {
        enabled: true,
        threshold: 'high',
        excludePatterns: ['**/*.test.*', '**/*.spec.*', '**/fixtures/**'],
      },
      vulnerabilities: {
        enabled: true,
        threshold: 'high',
      },
      compliance: {
        enabled: false,
      },
    },
    gating: {
      enabled: true,
      blockOnCritical: true,
      blockOnHigh: false,
      baselineEnabled: false,
      allowlistEnabled: false,
    },
    output: {
      format: 'table',
      badgeGeneration: true,
    },
    noise: {
      suppressTestFiles: true,
      suppressLowConfidence: true,
      minEntropy: 3.5,
    },
  },
};

const ENTERPRISE_TEMPLATE: TemplateDefinition = {
  name: 'Enterprise',
  description: 'Strict gating, baseline/allowlist enabled, compliance on by default, SARIF output for CI',
  config: {
    version: '1.0.0',
    template: 'enterprise',
    scans: {
      secrets: {
        enabled: true,
        threshold: 'low',
      },
      vulnerabilities: {
        enabled: true,
        threshold: 'medium',
      },
      compliance: {
        enabled: true,
        frameworks: ['soc2'],
        autoEvidence: true,
      },
      sbom: {
        enabled: true,
      },
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
    noise: {
      suppressTestFiles: false,
      suppressLowConfidence: false,
    },
  },
};

const OSS_TEMPLATE: TemplateDefinition = {
  name: 'OSS',
  description: 'Focus on supply chain (SBOM, vulns), permissive gating, contributor-friendly output',
  config: {
    version: '1.0.0',
    template: 'oss',
    scans: {
      secrets: {
        enabled: true,
        threshold: 'high',
        excludePatterns: ['**/*.example.*', '**/examples/**', '**/docs/**'],
      },
      vulnerabilities: {
        enabled: true,
        threshold: 'medium',
      },
      compliance: {
        enabled: false,
      },
      sbom: {
        enabled: true,
      },
    },
    gating: {
      enabled: true,
      blockOnCritical: true,
      blockOnHigh: false,
      baselineEnabled: true,
      allowlistEnabled: true,
    },
    output: {
      format: 'markdown',
      badgeGeneration: true,
    },
    noise: {
      suppressTestFiles: true,
      suppressLowConfidence: true,
      minEntropy: 3.0,
    },
  },
};

export const TEMPLATES: Record<TemplateType, TemplateDefinition> = {
  startup: STARTUP_TEMPLATE,
  enterprise: ENTERPRISE_TEMPLATE,
  oss: OSS_TEMPLATE,
};

export function getTemplate(templateType: TemplateType): TemplateDefinition {
  return TEMPLATES[templateType];
}

export function validateConfig(config: unknown): { success: true; data: GuardrailConfig } | { success: false; error: z.ZodError } {
  const result = GuardrailConfigSchema.safeParse(config);
  if (result.success) {
    return { success: true, data: result.data };
  }
  return { success: false, error: result.error };
}

export function mergeWithFrameworkDefaults(
  config: GuardrailConfig,
  framework: string,
  recommendedScans: string[]
): GuardrailConfig {
  const merged = { ...config, framework };

  if (recommendedScans.includes('reality')) {
    merged.scans = {
      ...merged.scans,
    };
  }

  if (recommendedScans.includes('compliance') && !merged.scans.compliance.enabled) {
    merged.scans.compliance = {
      ...merged.scans.compliance,
      enabled: true,
      frameworks: ['soc2'],
    };
  }

  return merged;
}

export function getTemplateChoices(): Array<{ name: string; value: TemplateType; description: string }> {
  return [
    {
      name: 'Startup',
      value: 'startup',
      description: STARTUP_TEMPLATE.description,
    },
    {
      name: 'Enterprise',
      value: 'enterprise',
      description: ENTERPRISE_TEMPLATE.description,
    },
    {
      name: 'OSS',
      value: 'oss',
      description: OSS_TEMPLATE.description,
    },
  ];
}
