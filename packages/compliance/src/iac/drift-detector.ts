import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

export interface TerraformState {
  version: number;
  terraform_version: string;
  resources: StateResource[];
}

export interface StateResource {
  type: string;
  name: string;
  provider: string;
  instances: Array<{
    attributes: Record<string, any>;
  }>;
}

export interface ActualState {
  [key: string]: any;
}

export interface Difference {
  resourceType: string;
  resourceName: string;
  attribute: string;
  expected: any;
  actual: any;
  severity: 'critical' | 'high' | 'medium' | 'low';
}

export interface DriftReport {
  totalResources: number;
  driftedResources: number;
  differences: Difference[];
  summary: {
    critical: number;
    high: number;
    medium: number;
    low: number;
  };
}

export class DriftDetector {
  /**
   * Get Terraform state from .tfstate file
   */
  async getTerraformState(projectPath: string): Promise<TerraformState | null> {
    const statePath = join(projectPath, 'terraform.tfstate');

    if (!existsSync(statePath)) {
      return null;
    }

    try {
      const stateContent = readFileSync(statePath, 'utf-8');
      return JSON.parse(stateContent);
    } catch (error) {
      console.error('Error reading Terraform state:', error);
      return null;
    }
  }

  /**
   * Get actual resource state from cloud provider
   * In production, this would use AWS/GCP/Azure SDKs
   */
  async getActualResourceState(_resource: StateResource): Promise<ActualState | null> {
    // Simulate actual state - in production, would query cloud provider APIs
    // This is a placeholder for demonstration
    return null;
  }

  /**
   * Compare expected (Terraform state) vs actual (cloud) state
   */
  compareStates(expected: any, actual: any, resourceType: string, resourceName: string): Difference[] {
    const differences: Difference[] = [];

    // Critical attributes to check based on resource type
    const criticalAttributes = this.getCriticalAttributes(resourceType);

    for (const attr of criticalAttributes) {
      if (expected[attr] !== actual[attr]) {
        differences.push({
          resourceType,
          resourceName,
          attribute: attr,
          expected: expected[attr],
          actual: actual[attr],
          severity: this.getSeverity(resourceType, attr)
        });
      }
    }

    return differences;
  }

  /**
   * Detect drift for entire project
   */
  async detectDrift(projectPath: string): Promise<DriftReport> {
    const state = await this.getTerraformState(projectPath);

    if (!state) {
      return {
        totalResources: 0,
        driftedResources: 0,
        differences: [],
        summary: { critical: 0, high: 0, medium: 0, low: 0 }
      };
    }

    const allDifferences: Difference[] = [];
    const driftedResourcesSet = new Set<string>();

    for (const resource of state.resources) {
      // In production, get actual state from cloud provider
      const actualState = await this.getActualResourceState(resource);

      if (actualState) {
        const expectedState = resource.instances[0]?.attributes || {};
        const diffs = this.compareStates(
          expectedState,
          actualState,
          resource.type,
          resource.name
        );

        if (diffs.length > 0) {
          driftedResourcesSet.add(`${resource.type}.${resource.name}`);
          allDifferences.push(...diffs);
        }
      }
    }

    const summary = {
      critical: allDifferences.filter(d => d.severity === 'critical').length,
      high: allDifferences.filter(d => d.severity === 'high').length,
      medium: allDifferences.filter(d => d.severity === 'medium').length,
      low: allDifferences.filter(d => d.severity === 'low').length
    };

    return {
      totalResources: state.resources.length,
      driftedResources: driftedResourcesSet.size,
      differences: allDifferences,
      summary
    };
  }

  /**
   * Get critical attributes for each resource type
   */
  private getCriticalAttributes(resourceType: string): string[] {
    const attributeMap: Record<string, string[]> = {
      'aws_s3_bucket': ['acl', 'versioning', 'server_side_encryption_configuration'],
      'aws_security_group': ['ingress', 'egress'],
      'aws_db_instance': ['publicly_accessible', 'storage_encrypted', 'backup_retention_period'],
      'aws_iam_policy': ['policy'],
      'aws_ebs_volume': ['encrypted'],
      'google_storage_bucket': ['iam_binding'],
      'google_compute_firewall': ['source_ranges', 'allowed'],
      'azurerm_storage_account': ['allow_blob_public_access'],
      'azurerm_network_security_rule': ['source_address_prefix', 'destination_port_range']
    };

    return attributeMap[resourceType] || [];
  }

  /**
   * Determine severity of drift based on resource type and attribute
   */
  private getSeverity(_resourceType: string, attribute: string): 'critical' | 'high' | 'medium' | 'low' {
    // Security-critical attributes
    const criticalAttrs = ['acl', 'publicly_accessible', 'allow_blob_public_access', 'source_address_prefix'];
    if (criticalAttrs.includes(attribute)) {
      return 'critical';
    }

    // High-importance attributes
    const highAttrs = ['storage_encrypted', 'encrypted', 'server_side_encryption_configuration', 'ingress'];
    if (highAttrs.includes(attribute)) {
      return 'high';
    }

    // Medium-importance attributes
    const mediumAttrs = ['versioning', 'backup_retention_period', 'egress'];
    if (mediumAttrs.includes(attribute)) {
      return 'medium';
    }

    return 'low';
  }
}

export const driftDetector = new DriftDetector();
