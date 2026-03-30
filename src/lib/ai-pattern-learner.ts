/**
 * AI Pattern Learner
 * 
 * Learns from user corrections and adapts rules automatically
 * Unique: Self-improving guardrails based on user behavior
 */

import * as fs from 'fs';
import * as path from 'path';
import { GuardrailRule } from './universal-guardrails';
import { universalGuardrails } from './universal-guardrails';

export interface LearningEvent {
  id: string;
  type: 'correction' | 'acceptance' | 'rejection' | 'override';
  ruleId: string;
  file: string;
  context: string;
  userAction: 'fixed' | 'ignored' | 'accepted' | 'rejected';
  timestamp: string;
  metadata?: Record<string, any>;
}

export interface LearnedPattern {
  id: string;
  ruleId: string;
  pattern: string;
  confidence: number;
  occurrences: number;
  context: string[];
  userFeedback: {
    positive: number;
    negative: number;
  };
}

export interface LearningReport {
  totalEvents: number;
  learnedPatterns: LearnedPattern[];
  ruleImprovements: Array<{
    ruleId: string;
    improvement: string;
    confidence: number;
  }>;
  accuracy: number;
}

class AIPatternLearner {
  private learningHistory: LearningEvent[] = [];
  private learnedPatterns: Map<string, LearnedPattern> = new Map();
  private learningFile = '.guardrail-learning.json';

  constructor() {
    this.loadLearningHistory();
  }

  /**
   * Record a learning event
   */
  async recordEvent(event: Omit<LearningEvent, 'id' | 'timestamp'>): Promise<void> {
    const fullEvent: LearningEvent = {
      ...event,
      id: `event-${Date.now()}-${Math.random()}`,
      timestamp: new Date().toISOString(),
    };

    this.learningHistory.push(fullEvent);
    await this.saveLearningHistory();

    // Process learning
    await this.processLearning(fullEvent);
  }

  /**
   * Process learning from event
   */
  private async processLearning(event: LearningEvent): Promise<void> {
    // Analyze user action
    if (event.userAction === 'fixed') {
      // User fixed the issue - rule was correct
      await this.positiveFeedback(event);
    } else if (event.userAction === 'ignored' || event.userAction === 'rejected') {
      // User ignored/rejected - rule may be too strict or incorrect
      await this.negativeFeedback(event);
    }

    // Detect patterns
    await this.detectPatterns(event);
  }

  /**
   * Positive feedback - rule was correct
   */
  private async positiveFeedback(event: LearningEvent): Promise<void> {
    const pattern = this.learnedPatterns.get(event.ruleId);
    if (pattern) {
      pattern.userFeedback.positive++;
      pattern.confidence = Math.min(1.0, pattern.confidence + 0.1);
    } else {
      this.learnedPatterns.set(event.ruleId, {
        id: event.ruleId,
        ruleId: event.ruleId,
        pattern: event.context,
        confidence: 0.6,
        occurrences: 1,
        context: [event.context],
        userFeedback: {
          positive: 1,
          negative: 0,
        },
      });
    }
  }

  /**
   * Negative feedback - rule needs adjustment
   */
  private async negativeFeedback(event: LearningEvent): Promise<void> {
    const pattern = this.learnedPatterns.get(event.ruleId);
    if (pattern) {
      pattern.userFeedback.negative++;
      pattern.confidence = Math.max(0.1, pattern.confidence - 0.1);

      // If confidence drops too low, suggest rule modification
      if (pattern.confidence < 0.3) {
        await this.suggestRuleModification(event.ruleId, pattern);
      }
    }
  }

  /**
   * Detect patterns from events
   */
  private async detectPatterns(event: LearningEvent): Promise<void> {
    // Group similar events
    const similarEvents = this.learningHistory.filter(e =>
      e.ruleId === event.ruleId &&
      e.userAction === event.userAction &&
      this.similarContext(e.context, event.context)
    );

    if (similarEvents.length >= 3) {
      // Pattern detected
      const pattern = this.learnedPatterns.get(event.ruleId);
      if (pattern) {
        pattern.occurrences = similarEvents.length;
        pattern.context.push(event.context);
      }
    }
  }

  /**
   * Suggest rule modification
   */
  private async suggestRuleModification(
    ruleId: string,
    pattern: LearnedPattern
  ): Promise<void> {
    const rule = universalGuardrails.getAllRules().find(r => r.id === ruleId);
    if (!rule) return;

    // Generate suggestion based on negative feedback
    const suggestion = {
      ruleId,
      currentRule: rule,
      suggestedChange: `Rule ${rule.name} has low confidence (${pattern.confidence.toFixed(2)}). Consider making it less strict or adding exceptions.`,
      evidence: {
        negativeFeedback: pattern.userFeedback.negative,
        positiveFeedback: pattern.userFeedback.positive,
        contexts: pattern.context.slice(0, 5),
      },
    };

    // Save suggestion
    await this.saveSuggestion(suggestion);
  }

  /**
   * Generate learning report
   */
  async generateReport(): Promise<LearningReport> {
    const totalEvents = this.learningHistory.length;
    const learnedPatterns = Array.from(this.learnedPatterns.values());

    // Calculate accuracy
    let correct = 0;
    let total = 0;
    for (const event of this.learningHistory) {
      if (event.userAction === 'fixed' || event.userAction === 'accepted') {
        correct++;
      }
      total++;
    }
    const accuracy = total > 0 ? (correct / total) * 100 : 0;

    // Generate rule improvements
    const ruleImprovements = learnedPatterns
      .filter(p => p.confidence < 0.5)
      .map(p => ({
        ruleId: p.ruleId,
        improvement: `Rule needs adjustment based on ${p.userFeedback.negative} negative feedback`,
        confidence: p.confidence,
      }));

    return {
      totalEvents,
      learnedPatterns,
      ruleImprovements,
      accuracy,
    };
  }

  /**
   * Apply learned patterns to improve rules
   */
  async applyLearning(): Promise<void> {
    const report = await this.generateReport();

    for (const improvement of report.ruleImprovements) {
      const rule = universalGuardrails.getAllRules().find(r => r.id === improvement.ruleId);
      if (rule && improvement.confidence < 0.3) {
        // Auto-adjust rule severity if confidence is very low
        if (rule.severity === 'error') {
          // Could change to warning
          console.log(`Suggesting to change ${rule.name} from error to warning`);
        }
      }
    }
  }

  /**
   * Get learned patterns for a rule
   */
  getLearnedPatterns(ruleId: string): LearnedPattern | undefined {
    return this.learnedPatterns.get(ruleId);
  }

  private similarContext(a: string, b: string): boolean {
    // Simple similarity check
    const wordsA = a.toLowerCase().split(/\s+/);
    const wordsB = b.toLowerCase().split(/\s+/);
    const common = wordsA.filter(w => wordsB.includes(w));
    return common.length / Math.max(wordsA.length, wordsB.length) > 0.5;
  }

  private async saveLearningHistory(): Promise<void> {
    try {
      await fs.promises.writeFile(
        this.learningFile,
        JSON.stringify({
          events: this.learningHistory,
          patterns: Array.from(this.learnedPatterns.values()),
        }, null, 2)
      );
    } catch {
      // Error saving
    }
  }

  private async loadLearningHistory(): Promise<void> {
    try {
      if (await this.pathExists(this.learningFile)) {
        const content = await fs.promises.readFile(this.learningFile, 'utf8');
        const data = JSON.parse(content);
        this.learningHistory = data.events || [];
        if (data.patterns) {
          for (const pattern of data.patterns) {
            this.learnedPatterns.set(pattern.id, pattern);
          }
        }
      }
    } catch {
      // Error loading
    }
  }

  private async saveSuggestion(suggestion: PatternSuggestion): Promise<void> {
    const suggestionsFile = '.guardrail-suggestions.json';
    let suggestions: PatternSuggestion[] = [];
    
    try {
      if (await this.pathExists(suggestionsFile)) {
        const content = await fs.promises.readFile(suggestionsFile, 'utf8');
        suggestions = JSON.parse(content);
      }
    } catch {
      // File doesn't exist
    }

    suggestions.push(suggestion);
    await fs.promises.writeFile(suggestionsFile, JSON.stringify(suggestions, null, 2));
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

export const aiPatternLearner = new AIPatternLearner();

