/**
 * License Manager
 * 
 * Manages user licenses, feature access, and usage limits
 */

export type LicenseTier = 'free' | 'starter' | 'professional' | 'enterprise';

export interface License {
  tier: LicenseTier;
  userId: string;
  projectId: string;
  expiresAt?: Date;
  features: string[];
  limits: {
    projects: number;
    apiEndpoints: number;
    validationsPerMonth: number;
    teamMembers: number;
    supportLevel: 'community' | 'email' | 'priority' | 'dedicated';
  };
}

export interface UsageStats {
  validations: number;
  apiEndpoints: number;
  projects: number;
  lastValidation: Date;
  errorsCaught: number;
  issuesFixed: number;
}

class LicenseManager {
  private licenses: Map<string, License> = new Map();
  private usage: Map<string, UsageStats> = new Map();

  /**
   * Initialize license from environment or config
   */
  initialize(projectId: string): License {
    const licenseKey = process.env.AI_GUARDRAILS_LICENSE_KEY;
    
    if (licenseKey) {
      return this.validateLicense(licenseKey, projectId);
    }

    // Default to free tier
    return this.getFreeLicense(projectId);
  }

  /**
   * Get free tier license
   */
  getFreeLicense(projectId: string): License {
    return {
      tier: 'free',
      userId: 'anonymous',
      projectId,
      features: ['basic-validation', 'eslint', 'typescript-check'],
      limits: {
        projects: 1,
        apiEndpoints: 10,
        validationsPerMonth: 100,
        teamMembers: 1,
        supportLevel: 'community',
      },
    };
  }

  /**
   * Validate license key
   */
  validateLicense(licenseKey: string, projectId: string): License {
    // In production, this would validate against a license server
    // For now, we'll decode from the key format
    
    try {
      // License key format: tier-userId-projectId-signature
      const parts = licenseKey.split('-');
      
      if (parts.length < 3) {
        throw new Error('Invalid license key format');
      }

      const tier = parts[0] as LicenseTier;
      const userId = parts[1];
      
      // Get license based on tier
      const license = this.getLicenseByTier(tier, userId, projectId);
      
      // Store license
      this.licenses.set(projectId, license);
      
      return license;
    } catch (error) {
      console.warn('License validation failed, using free tier:', error);
      return this.getFreeLicense(projectId);
    }
  }

  /**
   * Get license by tier
   */
  private getLicenseByTier(
    tier: LicenseTier,
    userId: string,
    projectId: string
  ): License {
    const baseLicense: License = {
      tier,
      userId,
      projectId,
      features: [],
      limits: {
        projects: 1,
        apiEndpoints: 10,
        validationsPerMonth: 100,
        teamMembers: 1,
        supportLevel: 'community',
      },
    };

    switch (tier) {
      case 'starter':
        return {
          ...baseLicense,
          features: [
            'basic-validation',
            'eslint',
            'typescript-check',
            'api-validation',
            'mock-data-detection',
            'email-support',
          ],
          limits: {
            projects: 3,
            apiEndpoints: 50,
            validationsPerMonth: 1000,
            teamMembers: 3,
            supportLevel: 'email',
          },
        };

      case 'professional':
        return {
          ...baseLicense,
          features: [
            'basic-validation',
            'eslint',
            'typescript-check',
            'api-validation',
            'mock-data-detection',
            'project-health-scoring',
            'automated-reports',
            'priority-support',
            'custom-rules',
            'ci-cd-integration',
          ],
          limits: {
            projects: 10,
            apiEndpoints: 200,
            validationsPerMonth: 10000,
            teamMembers: 10,
            supportLevel: 'priority',
          },
        };

      case 'enterprise':
        return {
          ...baseLicense,
          features: [
            'basic-validation',
            'eslint',
            'typescript-check',
            'api-validation',
            'mock-data-detection',
            'project-health-scoring',
            'automated-reports',
            'dedicated-support',
            'custom-rules',
            'ci-cd-integration',
            'sso',
            'audit-logs',
            'custom-integrations',
            'on-premise',
          ],
          limits: {
            projects: -1, // Unlimited
            apiEndpoints: -1, // Unlimited
            validationsPerMonth: -1, // Unlimited
            teamMembers: -1, // Unlimited
            supportLevel: 'dedicated',
          },
        };

      default:
        return this.getFreeLicense(projectId);
    }
  }

  /**
   * Check if feature is available
   */
  hasFeature(projectId: string, feature: string): boolean {
    const license = this.licenses.get(projectId) || this.getFreeLicense(projectId);
    return license.features.includes(feature);
  }

  /**
   * Check if usage is within limits
   */
  checkLimit(projectId: string, limitType: keyof License['limits']): boolean {
    const license = this.licenses.get(projectId) || this.getFreeLicense(projectId);
    const limit = license.limits[limitType];
    
    // Unlimited
    if (limit === -1) {
      return true;
    }

    const usage = this.getUsage(projectId);
    
    switch (limitType) {
      case 'validationsPerMonth':
        return usage.validations < limit;
      case 'apiEndpoints':
        return usage.apiEndpoints < limit;
      case 'projects':
        return usage.projects < limit;
      case 'teamMembers':
        return usage.projects < limit; // Simplified
      default:
        return true;
    }
  }

  /**
   * Track usage
   */
  trackUsage(projectId: string, type: keyof UsageStats, increment: number = 1): void {
    const usage = this.getUsage(projectId);
    usage[type] = (usage[type] as number) + increment;
    usage.lastValidation = new Date();
    this.usage.set(projectId, usage);
  }

  /**
   * Get usage statistics
   */
  getUsage(projectId: string): UsageStats {
    if (!this.usage.has(projectId)) {
      this.usage.set(projectId, {
        validations: 0,
        apiEndpoints: 0,
        projects: 1,
        lastValidation: new Date(),
        errorsCaught: 0,
        issuesFixed: 0,
      });
    }
    return this.usage.get(projectId)!;
  }

  /**
   * Get current license
   */
  getLicense(projectId: string): License {
    return this.licenses.get(projectId) || this.getFreeLicense(projectId);
  }

  /**
   * Upgrade license
   */
  upgradeLicense(projectId: string, newTier: LicenseTier): License {
    const currentLicense = this.getLicense(projectId);
    const newLicense = this.getLicenseByTier(
      newTier,
      currentLicense.userId,
      projectId
    );
    this.licenses.set(projectId, newLicense);
    return newLicense;
  }
}

export const licenseManager = new LicenseManager();

