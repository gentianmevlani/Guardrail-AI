/**
 * Usage Analytics
 * 
 * Tracks usage patterns and provides insights
 */

export interface UsageEvent {
  type: 'command' | 'feature' | 'error' | 'setup';
  name: string;
  timestamp: string;
  duration?: number;
  success: boolean;
  metadata?: Record<string, any>;
}

export interface UsageInsights {
  totalCommands: number;
  mostUsedCommands: Array<{ command: string; count: number }>;
  featureAdoption: Record<string, number>;
  errorRate: number;
  averageSessionDuration: number;
  recommendations: string[];
}

class UsageAnalytics {
  private events: UsageEvent[] = [];
  private readonly maxEvents = 5000;
  private sessionStart: number = Date.now();

  /**
   * Track event
   */
  trackEvent(
    type: UsageEvent['type'],
    name: string,
    success: boolean = true,
    metadata?: Record<string, any>
  ): void {
    const event: UsageEvent = {
      type,
      name,
      timestamp: new Date().toISOString(),
      success,
      metadata,
    };

    this.events.push(event);

    // Keep only last N events
    if (this.events.length > this.maxEvents) {
      this.events.shift();
    }
  }

  /**
   * Track command
   */
  trackCommand(command: string, duration: number, success: boolean): void {
    this.trackEvent('command', command, success, { duration });
  }

  /**
   * Get insights
   */
  getInsights(): UsageInsights {
    const commands = this.events.filter(e => e.type === 'command');
    const errors = this.events.filter(e => !e.success);
    const features = this.events.filter(e => e.type === 'feature');

    // Most used commands
    const commandCounts = new Map<string, number>();
    for (const cmd of commands) {
      commandCounts.set(cmd.name, (commandCounts.get(cmd.name) || 0) + 1);
    }

    const mostUsedCommands = Array.from(commandCounts.entries())
      .map(([command, count]) => ({ command, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    // Feature adoption
    const featureCounts: Record<string, number> = {};
    for (const feature of features) {
      featureCounts[feature.name] = (featureCounts[feature.name] || 0) + 1;
    }

    // Error rate
    const errorRate = this.events.length > 0 
      ? (errors.length / this.events.length) * 100 
      : 0;

    // Session duration
    const sessionDuration = (Date.now() - this.sessionStart) / 1000 / 60; // minutes

    // Recommendations
    const recommendations = this.generateRecommendations(
      mostUsedCommands,
      featureCounts,
      errorRate
    );

    return {
      totalCommands: commands.length,
      mostUsedCommands,
      featureAdoption: featureCounts,
      errorRate,
      averageSessionDuration: sessionDuration,
      recommendations,
    };
  }

  /**
   * Generate recommendations
   */
  private generateRecommendations(
    mostUsedCommands: Array<{ command: string; count: number }>,
    featureCounts: Record<string, number>,
    errorRate: number
  ): string[] {
    const recommendations: string[] = [];

    // Suggest underused features
    const allFeatures = ['context', 'polish', 'vibecoder-check', 'orchestrate'];
    const unusedFeatures = allFeatures.filter(f => !featureCounts[f]);
    if (unusedFeatures.length > 0) {
      recommendations.push(
        `Try these features: ${unusedFeatures.slice(0, 3).join(', ')}`
      );
    }

    // High error rate
    if (errorRate > 10) {
      recommendations.push('Error rate is high - consider running "guardrail setup"');
    }

    // Suggest optimization
    if (mostUsedCommands.length > 0) {
      const topCommand = mostUsedCommands[0];
      if (topCommand.count > 10) {
        recommendations.push(
          `You use "${topCommand.command}" frequently - consider automating it`
        );
      }
    }

    return recommendations;
  }

  /**
   * Reset session
   */
  resetSession(): void {
    this.sessionStart = Date.now();
  }

  /**
   * Clear analytics
   */
  clear(): void {
    this.events = [];
    this.sessionStart = Date.now();
  }
}

export const usageAnalytics = new UsageAnalytics();

