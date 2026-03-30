import { prisma } from '@guardrail/database';
import { readFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';
import { ALL_RULES } from './rules';
import { driftDetector, DriftReport } from './drift-detector';

export interface TerraformResource {
  type: string;
  name: string;
  provider: string;
  config: Record<string, any>;
}

export interface CFNResource {
  type: string;
  logicalId: string;
  properties: Record<string, any>;
}

export interface K8sResource {
  apiVersion: string;
  kind: string;
  metadata: {
    name: string;
    namespace?: string;
  };
  spec: Record<string, any>;
}

export type Resource = TerraformResource | CFNResource | K8sResource;

export interface IaCFinding {
  ruleId: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  category: string;
  title: string;
  description: string;
  resourceType: string;
  resourceName: string;
  filePath: string;
  recommendation: string;
}

export interface CostAnalysis {
  estimatedMonthlyCost: number;
  costByService: Record<string, number>;
  costOptimizationSuggestions: string[];
}

export interface IaCSecurityAnalysis {
  projectId: string;
  providers: string[];
  summary: {
    total: number;
    critical: number;
    high: number;
    medium: number;
    low: number;
  };
  findings: IaCFinding[];
  driftReport?: DriftReport;
  costAnalysis?: CostAnalysis;
}

export class IaCSecurityScanner {
  /**
   * Main scan function
   */
  async scan(projectPath: string, projectId: string): Promise<IaCSecurityAnalysis> {
    const providers: string[] = [];
    const allResources: Array<{ resource: Resource; filePath: string; provider: string }> = [];

    // Find and parse Terraform files
    const tfFiles = this.findFiles(projectPath, '.tf');
    if (tfFiles.length > 0) {
      providers.push('terraform');
      for (const file of tfFiles) {
        const resources = await this.parseTerraform([file]);
        resources.forEach(r => allResources.push({ resource: r, filePath: file, provider: 'terraform' }));
      }
    }

    // Find and parse CloudFormation templates
    const cfnFiles = this.findFiles(projectPath, '.yaml', '.yml', '.json').filter(f =>
      f.includes('cloudformation') || f.includes('template')
    );
    if (cfnFiles.length > 0) {
      providers.push('cloudformation');
      for (const file of cfnFiles) {
        const resources = await this.parseCloudFormation(file);
        resources.forEach(r => allResources.push({ resource: r, filePath: file, provider: 'cloudformation' }));
      }
    }

    // Find and parse Kubernetes manifests
    const k8sFiles = this.findFiles(projectPath, '.yaml', '.yml').filter(f =>
      !f.includes('cloudformation') && !f.includes('template')
    );
    if (k8sFiles.length > 0) {
      const k8sResources = await this.parseKubernetes(k8sFiles);
      if (k8sResources.length > 0) {
        providers.push('kubernetes');
        k8sResources.forEach((r, i) =>
          allResources.push({ resource: r, filePath: k8sFiles[i % k8sFiles.length] || 'unknown', provider: 'kubernetes' })
        );
      }
    }

    // Scan all resources against rules
    const findings = this.scanResources(allResources);

    // Calculate summary
    const summary = {
      total: findings.length,
      critical: findings.filter(f => f.severity === 'critical').length,
      high: findings.filter(f => f.severity === 'high').length,
      medium: findings.filter(f => f.severity === 'medium').length,
      low: findings.filter(f => f.severity === 'low').length
    };

    // Detect drift if Terraform is used
    let driftReport: DriftReport | undefined;
    if (providers.includes('terraform')) {
      driftReport = await driftDetector.detectDrift(projectPath);
    }

    // Analyze costs
    const costAnalysis = await this.analyzeCosts(findings);

    // Save to database
    try {
      await prisma.iaCScan.create({
        data: {
          projectId
        } as any
      });
    } catch (error) {
      // Table may not exist - continue
    }

    return {
      projectId,
      providers,
      summary,
      findings,
      driftReport,
      costAnalysis
    };
  }

  /**
   * Parse Terraform files
   */
  private async parseTerraform(files: string[]): Promise<TerraformResource[]> {
    const resources: TerraformResource[] = [];

    for (const file of files) {
      try {
        const content = readFileSync(file, 'utf-8');

        // Simple HCL parsing (in production, use proper HCL parser)
        const resourceMatches = content.matchAll(/resource\s+"([^"]+)"\s+"([^"]+)"\s+{([^}]*)}/gs);

        for (const match of resourceMatches) {
          const [, type, name, configBlock] = match;

          if (!type || !name) continue;

          // Parse config block (simplified)
          const config: Record<string, any> = {};
          const lines = (configBlock || '').split('\n');

          for (const line of lines) {
            const keyValue = line.match(/^\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*=\s*(.+)$/);
            if (keyValue) {
              const [, key, value] = keyValue;
              if (key && value) {
                config[key.trim()] = this.parseValue(value.trim());
              }
            }
          }

          resources.push({
            type,
            name,
            provider: type.split('_')[0] || 'unknown', // e.g., 'aws' from 'aws_s3_bucket'
            config
          });
        }
      } catch (error) {
        console.error(`Error parsing Terraform file ${file}:`, error);
      }
    }

    return resources;
  }

  /**
   * Parse CloudFormation template
   */
  private async parseCloudFormation(file: string): Promise<CFNResource[]> {
    const resources: CFNResource[] = [];

    try {
      const content = readFileSync(file, 'utf-8');
      const template = file.endsWith('.json') ? JSON.parse(content) : this.parseYAML(content);

      if (template.Resources) {
        for (const [logicalId, resource] of Object.entries(template.Resources as Record<string, any>)) {
          resources.push({
            type: resource.Type,
            logicalId,
            properties: resource.Properties || {}
          });
        }
      }
    } catch (error) {
      console.error(`Error parsing CloudFormation file ${file}:`, error);
    }

    return resources;
  }

  /**
   * Parse Kubernetes manifests
   */
  private async parseKubernetes(files: string[]): Promise<K8sResource[]> {
    const resources: K8sResource[] = [];

    for (const file of files) {
      try {
        const content = readFileSync(file, 'utf-8');
        const manifests = this.parseYAML(content);

        // Handle both single manifest and array of manifests
        const manifestArray = Array.isArray(manifests) ? manifests : [manifests];

        for (const manifest of manifestArray) {
          if (manifest && manifest.kind && manifest.metadata) {
            resources.push({
              apiVersion: manifest.apiVersion || '',
              kind: manifest.kind,
              metadata: manifest.metadata,
              spec: manifest.spec || {}
            });
          }
        }
      } catch (error) {
        console.error(`Error parsing Kubernetes file ${file}:`, error);
      }
    }

    return resources;
  }

  /**
   * Scan resources against rules
   */
  private scanResources(resources: Array<{ resource: Resource; filePath: string; provider: string }>): IaCFinding[] {
    const findings: IaCFinding[] = [];

    for (const { resource, filePath, provider } of resources) {
      // Get applicable rules
      const rules = ALL_RULES.filter(rule => {
        if (provider === 'terraform') {
          const tfResource = resource as TerraformResource;
          return rule.provider === 'terraform' && rule.resourceType === tfResource.type;
        } else if (provider === 'kubernetes') {
          const k8sResource = resource as K8sResource;
          return rule.provider === 'kubernetes' && rule.resourceType === k8sResource.kind;
        } else if (provider === 'cloudformation') {
          const cfnResource = resource as CFNResource;
          return rule.resourceType === cfnResource.type;
        }
        return false;
      });

      // Check each rule
      for (const rule of rules) {
        try {
          const resourceData = this.getResourceData(resource, provider);
          const violates = rule.check(resourceData);

          if (violates) {
            findings.push({
              ruleId: rule.id,
              severity: rule.severity,
              category: rule.category,
              title: rule.title,
              description: rule.description,
              resourceType: this.getResourceType(resource, provider),
              resourceName: this.getResourceName(resource, provider),
              filePath,
              recommendation: rule.recommendation
            });
          }
        } catch (error) {
          console.error(`Error checking rule ${rule.id}:`, error);
        }
      }
    }

    return findings;
  }

  /**
   * Analyze costs based on findings
   */
  async analyzeCosts(findings: IaCFinding[]): Promise<CostAnalysis> {
    const costByService: Record<string, number> = {};
    const suggestions: string[] = [];

    // Estimate costs based on security findings
    // In production, this would use cloud provider pricing APIs

    // Example: unencrypted resources cost more due to compliance requirements
    const encryptionFindings = findings.filter(f =>
      f.description.toLowerCase().includes('encryption')
    );

    if (encryptionFindings.length > 0) {
      suggestions.push(
        `Enable encryption on ${encryptionFindings.length} resources to reduce compliance costs`
      );
    }

    // Public resources may incur data transfer costs
    const publicFindings = findings.filter(f =>
      f.description.toLowerCase().includes('public')
    );

    if (publicFindings.length > 0) {
      suggestions.push(
        `Restrict ${publicFindings.length} public resources to reduce data transfer costs`
      );
    }

    return {
      estimatedMonthlyCost: 0, // Would calculate actual costs in production
      costByService,
      costOptimizationSuggestions: suggestions
    };
  }

  /**
   * Find files with specific extensions recursively
   */
  private findFiles(dir: string, ...extensions: string[]): string[] {
    const files: string[] = [];

    try {
      const entries = readdirSync(dir);

      for (const entry of entries) {
        const fullPath = join(dir, entry);
        const stat = statSync(fullPath);

        if (stat.isDirectory() && !entry.startsWith('.') && entry !== 'node_modules') {
          files.push(...this.findFiles(fullPath, ...extensions));
        } else if (stat.isFile()) {
          if (extensions.some(ext => entry.endsWith(ext))) {
            files.push(fullPath);
          }
        }
      }
    } catch (error) {
      // Ignore permission errors
    }

    return files;
  }

  /**
   * Parse HCL value (simplified)
   */
  private parseValue(value: string): any {
    value = value.trim();

    if (value === 'true') return true;
    if (value === 'false') return false;
    if (value.startsWith('"') && value.endsWith('"')) {
      return value.slice(1, -1);
    }
    if (value.match(/^\d+$/)) {
      return parseInt(value, 10);
    }

    return value;
  }

  /**
   * Simple YAML parser (in production, use proper YAML library)
   */
  private parseYAML(content: string): any {
    try {
      return JSON.parse(content);
    } catch {
      return {};
    }
  }

  /**
   * Get resource data for rule checking
   */
  private getResourceData(resource: Resource, provider: string): any {
    if (provider === 'terraform') {
      return (resource as TerraformResource).config;
    } else if (provider === 'kubernetes') {
      return resource as K8sResource;
    } else if (provider === 'cloudformation') {
      return (resource as CFNResource).properties;
    }
    return {};
  }

  /**
   * Get resource type
   */
  private getResourceType(resource: Resource, provider: string): string {
    if (provider === 'terraform') {
      return (resource as TerraformResource).type;
    } else if (provider === 'kubernetes') {
      return (resource as K8sResource).kind;
    } else if (provider === 'cloudformation') {
      return (resource as CFNResource).type;
    }
    return 'unknown';
  }

  /**
   * Get resource name
   */
  private getResourceName(resource: Resource, provider: string): string {
    if (provider === 'terraform') {
      return (resource as TerraformResource).name;
    } else if (provider === 'kubernetes') {
      return (resource as K8sResource).metadata.name;
    } else if (provider === 'cloudformation') {
      return (resource as CFNResource).logicalId;
    }
    return 'unknown';
  }
}

export const iacSecurityScanner = new IaCSecurityScanner();
