/**
 * Subscription Tiers and Limits
 * 
 * Tiered subscription system based on codebase size
 */

import { SizeLimits } from './codebase-size';

export type SubscriptionTier = 'free' | 'starter' | 'pro' | 'enterprise' | 'unlimited';

export interface TierLimits extends SizeLimits {
  maxProjects: number;
  maxTeamMembers: number;
  features: string[];
  price: number; // monthly price in USD
  annualPrice: number; // annual price in USD (with discount)
}

export interface SubscriptionConfig {
  tier: SubscriptionTier;
  limits: TierLimits;
  currentUsage: {
    files: number;
    lines: number;
    size: number;
    projects: number;
    teamMembers: number;
  };
}

class SubscriptionTierManager {
  private tiers: Record<SubscriptionTier, TierLimits> = {
    free: {
      maxFiles: 500,
      maxLines: 10000,
      maxSize: 5 * 1024 * 1024, // 5MB
      maxProjects: 1,
      maxTeamMembers: 1,
      features: [
        'Basic guardrails',
        'Error boundary',
        '404 page',
        'Basic templates',
      ],
      price: 0,
      annualPrice: 0,
    },
    starter: {
      maxFiles: 2000,
      maxLines: 50000,
      maxSize: 25 * 1024 * 1024, // 25MB
      maxProjects: 3,
      maxTeamMembers: 3,
      features: [
        'All free features',
        'Breadcrumbs',
        'Loading states',
        'Empty states',
        'Backend middleware',
        'Email support',
      ],
      price: 19,
      annualPrice: 190, // ~17% discount
    },
    pro: {
      maxFiles: 10000,
      maxLines: 250000,
      maxSize: 100 * 1024 * 1024, // 100MB
      maxProjects: 10,
      maxTeamMembers: 10,
      features: [
        'All starter features',
        'Advanced guardrails',
        'Custom rules',
        'Priority support',
        'Analytics dashboard',
        'API access',
      ],
      price: 49,
      annualPrice: 490, // ~17% discount
    },
    enterprise: {
      maxFiles: 50000,
      maxLines: 1000000,
      maxSize: 500 * 1024 * 1024, // 500MB
      maxProjects: 50,
      maxTeamMembers: 50,
      features: [
        'All pro features',
        'Unlimited custom rules',
        'Dedicated support',
        'SLA guarantee',
        'Custom integrations',
        'On-premise option',
      ],
      price: 199,
      annualPrice: 1990, // ~17% discount
    },
    unlimited: {
      maxFiles: Infinity,
      maxLines: Infinity,
      maxSize: Infinity,
      maxProjects: Infinity,
      maxTeamMembers: Infinity,
      features: [
        'Everything',
        'Custom pricing',
        'White-label option',
        'Dedicated account manager',
      ],
      price: 0, // Custom pricing
      annualPrice: 0,
    },
  };

  /**
   * Get limits for tier
   */
  getLimits(tier: SubscriptionTier): TierLimits {
    return this.tiers[tier];
  }

  /**
   * Get all tiers
   */
  getAllTiers(): Record<SubscriptionTier, TierLimits> {
    return this.tiers;
  }

  /**
   * Determine recommended tier based on codebase size
   */
  getRecommendedTier(metrics: {
    files: number;
    lines: number;
    size: number;
  }): SubscriptionTier {
    // Check from highest to lowest
    if (this.tiers.enterprise.maxFiles >= metrics.files &&
        this.tiers.enterprise.maxLines >= metrics.lines &&
        this.tiers.enterprise.maxSize >= metrics.size) {
      return 'enterprise';
    }

    if (this.tiers.pro.maxFiles >= metrics.files &&
        this.tiers.pro.maxLines >= metrics.lines &&
        this.tiers.pro.maxSize >= metrics.size) {
      return 'pro';
    }

    if (this.tiers.starter.maxFiles >= metrics.files &&
        this.tiers.starter.maxLines >= metrics.lines &&
        this.tiers.starter.maxSize >= metrics.size) {
      return 'starter';
    }

    if (this.tiers.free.maxFiles >= metrics.files &&
        this.tiers.free.maxLines >= metrics.lines &&
        this.tiers.free.maxSize >= metrics.size) {
      return 'free';
    }

    return 'unlimited';
  }

  /**
   * Check if usage exceeds tier limits
   */
  checkUsage(usage: {
    files: number;
    lines: number;
    size: number;
    projects: number;
    teamMembers: number;
  }, tier: SubscriptionTier): {
    withinLimits: boolean;
    exceeded: {
      files?: boolean;
      lines?: boolean;
      size?: boolean;
      projects?: boolean;
      teamMembers?: boolean;
    };
    recommendedTier?: SubscriptionTier;
  } {
    const limits = this.getLimits(tier);

    const exceeded = {
      files: usage.files > limits.maxFiles,
      lines: usage.lines > limits.maxLines,
      size: usage.size > limits.maxSize,
      projects: usage.projects > limits.maxProjects,
      teamMembers: usage.teamMembers > limits.maxTeamMembers,
    };

    const withinLimits = !Object.values(exceeded).some((v) => v);

    let recommendedTier: SubscriptionTier | undefined;
    if (!withinLimits) {
      recommendedTier = this.getRecommendedTier({
        files: usage.files,
        lines: usage.lines,
        size: usage.size,
      });
    }

    return {
      withinLimits,
      exceeded,
      recommendedTier,
    };
  }

  /**
   * Get upgrade message
   */
  getUpgradeMessage(
    currentTier: SubscriptionTier,
    recommendedTier: SubscriptionTier
  ): string {
    if (currentTier === recommendedTier) {
      return 'Your current tier is appropriate for your codebase size.';
    }

    const currentLimits = this.getLimits(currentTier);
    const recommendedLimits = this.getLimits(recommendedTier);

    return `Your codebase exceeds ${currentTier} tier limits. Upgrade to ${recommendedTier} ($${recommendedLimits.price}/month) to continue.`;
  }
}

export const subscriptionTierManager = new SubscriptionTierManager();

