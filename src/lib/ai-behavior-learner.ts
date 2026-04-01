/**
 * AI Behavior Learner
 * 
 * Learns from user corrections and adapts AI agent behavior automatically
 * Unique: Self-improving AI that learns from every interaction
 */

import * as fs from 'fs';
import * as path from 'path';
import { aiPatternLearner } from './ai-pattern-learner';

export interface AIBehavior {
  agentId: string;
  agentName: string;
  personality: {
    creativity: number; // 0-1
    strictness: number; // 0-1
    verbosity: number; // 0-1
    patternPreference: string[];
  };
  learnedRules: Array<{
    pattern: string;
    action: 'prefer' | 'avoid' | 'modify';
    confidence: number;
    context: string;
    examples: string[];
  }>;
  performance: {
    acceptanceRate: number; // 0-1
    correctionRate: number; // 0-1
    satisfactionScore: number; // 0-1
  };
  adaptations: Array<{
    timestamp: string;
    change: string;
    reason: string;
    impact: 'positive' | 'negative' | 'neutral';
  }>;
}

export interface LearningEvent {
  agentId: string;
  type: 'correction' | 'acceptance' | 'rejection' | 'modification';
  originalCode: string;
  userChange: string;
  context: string;
  timestamp: string;
  reason?: string;
}

class AIBehaviorLearner {
  private behaviors: Map<string, AIBehavior> = new Map();
  private learningFile = '.guardrail-ai-behaviors.json';

  constructor() {
    this.loadBehaviors();
  }

  /**
   * Record a learning event
   */
  async recordEvent(event: LearningEvent): Promise<void> {
    const behavior = this.getOrCreateBehavior(event.agentId);

    // Analyze the correction
    const analysis = this.analyzeCorrection(event);

    // Update behavior based on correction
    this.adaptBehavior(behavior, event, analysis);

    // Record in pattern learner
    await aiPatternLearner.recordEvent({
      type: event.type === 'correction' ? 'correction' : 'acceptance',
      ruleId: analysis.patternId,
      file: event.context,
      context: event.originalCode,
      userAction: event.type === 'correction' ? 'fixed' : 'accepted',
    });

    // Save behaviors
    await this.saveBehaviors();
  }

  /**
   * Get behavior profile for an agent
   */
  getBehavior(agentId: string): AIBehavior | null {
    return this.behaviors.get(agentId) || null;
  }

  /**
   * Get recommendations for agent
   */
  getRecommendations(agentId: string): Array<{
    type: 'personality' | 'pattern' | 'rule';
    recommendation: string;
    confidence: number;
    impact: string;
  }> {
    const behavior = this.behaviors.get(agentId);
    if (!behavior) return [];

    const recommendations: Array<{
      type: 'personality' | 'pattern' | 'rule';
      recommendation: string;
      confidence: number;
      impact: string;
    }> = [];

    // Analyze performance
    if (behavior.performance.correctionRate > 0.3) {
      recommendations.push({
        type: 'personality',
        recommendation: `Increase strictness from ${behavior.personality.strictness.toFixed(2)} to ${Math.min(1, behavior.personality.strictness + 0.2).toFixed(2)}`,
        confidence: 0.8,
        impact: 'Should reduce correction rate by ~20%',
      });
    }

    if (behavior.performance.acceptanceRate < 0.5) {
      recommendations.push({
        type: 'personality',
        recommendation: `Reduce verbosity from ${behavior.personality.verbosity.toFixed(2)} to ${Math.max(0, behavior.personality.verbosity - 0.2).toFixed(2)}`,
        confidence: 0.7,
        impact: 'Should improve acceptance rate',
      });
    }

    // Analyze learned rules
    const lowConfidenceRules = behavior.learnedRules.filter(r => r.confidence < 0.5);
    for (const rule of lowConfidenceRules) {
      recommendations.push({
        type: 'rule',
        recommendation: `Review rule for pattern "${rule.pattern}" - low confidence (${rule.confidence.toFixed(2)})`,
        confidence: 0.6,
        impact: 'May need more examples or removal',
      });
    }

    return recommendations;
  }

  /**
   * Apply learned behavior to new code generation
   */
  applyBehavior(agentId: string, context: string): {
    preferences: string[];
    avoidances: string[];
    modifications: Array<{ pattern: string; change: string }>;
  } {
    const behavior = this.behaviors.get(agentId);
    if (!behavior) {
      return { preferences: [], avoidances: [], modifications: [] };
    }

    const preferences: string[] = [];
    const avoidances: string[] = [];
    const modifications: Array<{ pattern: string; change: string }> = [];

    for (const rule of behavior.learnedRules) {
      if (this.matchesContext(rule.context, context)) {
        if (rule.action === 'prefer' && rule.confidence > 0.7) {
          preferences.push(rule.pattern);
        } else if (rule.action === 'avoid' && rule.confidence > 0.7) {
          avoidances.push(rule.pattern);
        } else if (rule.action === 'modify' && rule.confidence > 0.6) {
          modifications.push({
            pattern: rule.pattern,
            change: rule.examples[0] || '',
          });
        }
      }
    }

    return { preferences, avoidances, modifications };
  }

  /**
   * Analyze correction to extract learning
   */
  private analyzeCorrection(event: LearningEvent): {
    patternId: string;
    pattern: string;
    change: string;
    confidence: number;
  } {
    // Extract pattern from code difference
    const diff = this.computeDiff(event.originalCode, event.userChange);
    const pattern = this.extractPattern(diff);

    return {
      patternId: `pattern-${Date.now()}`,
      pattern,
      change: diff,
      confidence: 0.7, // Initial confidence
    };
  }

  /**
   * Adapt behavior based on event
   */
  private adaptBehavior(
    behavior: AIBehavior,
    event: LearningEvent,
    analysis: ReturnType<typeof this.analyzeCorrection>
  ): void {
    // Update performance metrics
    if (event.type === 'correction') {
      behavior.performance.correctionRate = 
        (behavior.performance.correctionRate * 0.9) + (0.1 * 1);
      behavior.performance.satisfactionScore = 
        Math.max(0, behavior.performance.satisfactionScore - 0.05);
    } else if (event.type === 'acceptance') {
      behavior.performance.acceptanceRate = 
        (behavior.performance.acceptanceRate * 0.9) + (0.1 * 1);
      behavior.performance.satisfactionScore = 
        Math.min(1, behavior.performance.satisfactionScore + 0.05);
    }

    // Update or create learned rule
    const existingRule = behavior.learnedRules.find(r => r.pattern === analysis.pattern);
    if (existingRule) {
      // Update confidence
      if (event.type === 'correction') {
        existingRule.confidence = Math.min(1, existingRule.confidence + 0.1);
        existingRule.action = 'avoid';
      } else {
        existingRule.confidence = Math.max(0, existingRule.confidence - 0.1);
      }
      existingRule.examples.push(event.userChange);
    } else {
      // Create new rule
      behavior.learnedRules.push({
        pattern: analysis.pattern,
        action: event.type === 'correction' ? 'avoid' : 'prefer',
        confidence: 0.6,
        context: event.context,
        examples: [event.userChange],
      });
    }

    // Record adaptation
    behavior.adaptations.push({
      timestamp: new Date().toISOString(),
      change: `Learned to ${event.type === 'correction' ? 'avoid' : 'prefer'} pattern: ${analysis.pattern}`,
      reason: event.reason || 'User correction',
      impact: event.type === 'correction' ? 'positive' : 'neutral',
    });
  }

  /**
   * Get or create behavior for agent
   */
  private getOrCreateBehavior(agentId: string): AIBehavior {
    if (!this.behaviors.has(agentId)) {
      this.behaviors.set(agentId, {
        agentId,
        agentName: agentId,
        personality: {
          creativity: 0.5,
          strictness: 0.5,
          verbosity: 0.5,
          patternPreference: [],
        },
        learnedRules: [],
        performance: {
          acceptanceRate: 0.5,
          correctionRate: 0.0,
          satisfactionScore: 0.5,
        },
        adaptations: [],
      });
    }
    return this.behaviors.get(agentId)!;
  }

  private computeDiff(original: string, changed: string): string {
    // Simplified diff - in production use proper diff algorithm
    return changed;
  }

  private extractPattern(diff: string): string {
    // Extract pattern from diff
    return diff.substring(0, 50);
  }

  private matchesContext(ruleContext: string, context: string): boolean {
    return context.includes(ruleContext) || ruleContext.includes(context);
  }

  private async saveBehaviors(): Promise<void> {
    const data = Array.from(this.behaviors.values());
    await fs.promises.writeFile(
      this.learningFile,
      JSON.stringify(data, null, 2)
    );
  }

  private async loadBehaviors(): Promise<void> {
    try {
      if (await this.pathExists(this.learningFile)) {
        const content = await fs.promises.readFile(this.learningFile, 'utf8');
        const data = JSON.parse(content);
        for (const behavior of data) {
          this.behaviors.set(behavior.agentId, behavior);
        }
      }
    } catch {
      // Error loading
    }
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

export const aiBehaviorLearner = new AIBehaviorLearner();

