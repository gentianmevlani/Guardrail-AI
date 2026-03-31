import {
  ConversationBoundary,
  BoundaryCheckResult,
} from '@guardrail/core';

/**
 * Conversation Boundary Enforcer — Behavioral Guardrail
 *
 * Constrains conversation scope: topic adherence, turn limits,
 * context length limits, blocked topics, and response type restrictions.
 * Prevents agents from drifting off-topic or exceeding conversation bounds.
 */
export class ConversationBoundaryEnforcer {
  private boundaries: Map<string, ConversationBoundary> = new Map();
  private turnCounters: Map<string, number> = new Map();
  private conversationHistory: Map<string, ConversationTurn[]> = new Map();

  /**
   * Check if a message is within conversation boundaries
   */
  async check(
    agentId: string,
    message: string,
    options?: {
      responseType?: 'text' | 'code' | 'data' | 'image';
      sessionId?: string;
    }
  ): Promise<BoundaryCheckResult> {
    const boundary = this.boundaries.get(agentId);
    if (!boundary) {
      return {
        withinBounds: true,
        violations: [],
        currentTurn: 0,
        topicAdherenceScore: 1.0,
      };
    }

    const sessionKey = options?.sessionId ? `${agentId}:${options.sessionId}` : agentId;
    const violations: BoundaryCheckResult['violations'] = [];

    // Track turn
    const currentTurn = (this.turnCounters.get(sessionKey) || 0) + 1;
    this.turnCounters.set(sessionKey, currentTurn);

    // Check turn limit
    if (currentTurn > boundary.maxTurns) {
      violations.push({
        type: 'turn_limit',
        description: `Conversation has exceeded the maximum turn limit (${currentTurn}/${boundary.maxTurns})`,
        severity: 'error',
      });
    }

    // Check context length
    const history = this.conversationHistory.get(sessionKey) || [];
    const totalContextLength = history.reduce((sum, turn) => sum + turn.content.length, 0) + message.length;
    if (totalContextLength > boundary.maxContextLength) {
      violations.push({
        type: 'context_overflow',
        description: `Context length (${totalContextLength}) exceeds maximum (${boundary.maxContextLength})`,
        severity: 'error',
      });
    }

    // Check blocked topics
    const blockedTopicHits = this.checkBlockedTopics(message, boundary.blockedTopics);
    for (const hit of blockedTopicHits) {
      violations.push({
        type: 'blocked_topic',
        description: `Message touches blocked topic: "${hit}"`,
        severity: 'error',
      });
    }

    // Check response type
    if (options?.responseType && boundary.allowedResponseTypes.length > 0) {
      if (!boundary.allowedResponseTypes.includes(options.responseType)) {
        violations.push({
          type: 'response_type',
          description: `Response type "${options.responseType}" is not allowed. Allowed: ${boundary.allowedResponseTypes.join(', ')}`,
          severity: 'error',
        });
      }
    }

    // Check topic adherence
    let topicAdherenceScore = 1.0;
    if (boundary.requireTopicAdherence && boundary.allowedTopics.length > 0) {
      topicAdherenceScore = this.calculateTopicAdherence(message, boundary.allowedTopics);

      if (topicAdherenceScore < boundary.topicDriftThreshold) {
        violations.push({
          type: 'topic_drift',
          description: `Topic adherence score (${topicAdherenceScore.toFixed(2)}) is below threshold (${boundary.topicDriftThreshold})`,
          severity: topicAdherenceScore < boundary.topicDriftThreshold * 0.5 ? 'error' : 'warning',
        });
      }
    }

    // Record turn in history
    history.push({
      turn: currentTurn,
      content: message,
      timestamp: Date.now(),
      topicScore: topicAdherenceScore,
    });
    this.conversationHistory.set(sessionKey, history);

    return {
      withinBounds: violations.filter((v) => v.severity === 'error').length === 0,
      violations,
      currentTurn,
      topicAdherenceScore,
    };
  }

  /**
   * Set conversation boundary for an agent
   */
  setBoundary(agentId: string, boundary: ConversationBoundary): void {
    this.boundaries.set(agentId, boundary);
  }

  /**
   * Get boundary for an agent
   */
  getBoundary(agentId: string): ConversationBoundary | undefined {
    return this.boundaries.get(agentId);
  }

  /**
   * Reset conversation state for a session
   */
  resetSession(agentId: string, sessionId?: string): void {
    const key = sessionId ? `${agentId}:${sessionId}` : agentId;
    this.turnCounters.delete(key);
    this.conversationHistory.delete(key);
  }

  /**
   * Get conversation history for a session
   */
  getHistory(agentId: string, sessionId?: string): ConversationTurn[] {
    const key = sessionId ? `${agentId}:${sessionId}` : agentId;
    return this.conversationHistory.get(key) || [];
  }

  /**
   * Get current turn count
   */
  getCurrentTurn(agentId: string, sessionId?: string): number {
    const key = sessionId ? `${agentId}:${sessionId}` : agentId;
    return this.turnCounters.get(key) || 0;
  }

  private checkBlockedTopics(message: string, blockedTopics: string[]): string[] {
    const hits: string[] = [];
    const lowerMessage = message.toLowerCase();

    for (const topic of blockedTopics) {
      const topicTokens = topic.toLowerCase().split(/\s+/);

      // Check for exact topic match
      if (lowerMessage.includes(topic.toLowerCase())) {
        hits.push(topic);
        continue;
      }

      // Check for partial token overlap (at least 70% of topic tokens present)
      const matchCount = topicTokens.filter((t) => lowerMessage.includes(t)).length;
      if (topicTokens.length > 1 && matchCount / topicTokens.length >= 0.7) {
        hits.push(topic);
      }
    }

    return hits;
  }

  private calculateTopicAdherence(message: string, allowedTopics: string[]): number {
    if (allowedTopics.length === 0) return 1.0;

    const messageTokens = this.tokenize(message);
    if (messageTokens.length === 0) return 1.0;

    let bestScore = 0;

    for (const topic of allowedTopics) {
      const topicTokens = new Set(this.tokenize(topic));
      if (topicTokens.size === 0) continue;

      // Calculate bidirectional token overlap
      let overlapCount = 0;
      for (const token of messageTokens) {
        if (topicTokens.has(token)) overlapCount++;
      }

      // Also check for semantic proximity via keyword expansion
      const expandedTopicTokens = this.expandTopic(topic);
      for (const token of messageTokens) {
        if (expandedTopicTokens.has(token)) overlapCount += 0.5;
      }

      const score = Math.min(1.0, overlapCount / Math.max(3, messageTokens.length * 0.3));
      if (score > bestScore) bestScore = score;
    }

    return bestScore;
  }

  private expandTopic(topic: string): Set<string> {
    // Simple keyword expansion for common topic domains
    const expansions: Record<string, string[]> = {
      'code': ['programming', 'software', 'function', 'class', 'variable', 'bug', 'debug', 'compile', 'runtime'],
      'security': ['vulnerability', 'exploit', 'authentication', 'authorization', 'encryption', 'firewall', 'threat'],
      'database': ['sql', 'query', 'table', 'index', 'migration', 'schema', 'orm', 'record'],
      'api': ['endpoint', 'rest', 'graphql', 'request', 'response', 'route', 'controller', 'middleware'],
      'testing': ['test', 'spec', 'assert', 'mock', 'stub', 'coverage', 'unit', 'integration', 'e2e'],
      'deployment': ['deploy', 'ci', 'cd', 'pipeline', 'docker', 'container', 'kubernetes', 'infrastructure'],
      'frontend': ['ui', 'ux', 'component', 'react', 'css', 'html', 'dom', 'render', 'style'],
      'backend': ['server', 'api', 'database', 'middleware', 'route', 'controller', 'service'],
    };

    const tokens = new Set<string>();
    const topicLower = topic.toLowerCase();

    for (const [key, values] of Object.entries(expansions)) {
      if (topicLower.includes(key)) {
        for (const v of values) tokens.add(v);
      }
    }

    return tokens;
  }

  private tokenize(text: string): string[] {
    return text
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter((t) => t.length > 2);
  }
}

interface ConversationTurn {
  turn: number;
  content: string;
  timestamp: number;
  topicScore: number;
}

export const conversationBoundaryEnforcer = new ConversationBoundaryEnforcer();
