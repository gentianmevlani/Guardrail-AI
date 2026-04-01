import type { TopicScopeConfig, TopicScopeResult } from '@guardrail/core';

/**
 * Topic / scope filter — lightweight domain gate before the main LLM.
 * Blocklist wins first; allowlist optional (strict vs lenient).
 */
export class TopicScopeFilter {
  evaluate(content: string, config: TopicScopeConfig): TopicScopeResult {
    const start = Date.now();
    const lower = content.toLowerCase();

    for (const blocked of config.blockedTopics) {
      const b = blocked.trim();
      if (!b) continue;
      if (lower.includes(b.toLowerCase())) {
        return {
          inScope: false,
          mode: config.mode,
          matchedBlocked: b,
          reason: `Request matches blocked domain topic: "${b}"`,
          processingTimeMs: Date.now() - start,
        };
      }
    }

    if (config.allowedTopics.length === 0) {
      return {
        inScope: true,
        mode: config.mode,
        reason: 'No allowlist configured — only blocklist enforced',
        processingTimeMs: Date.now() - start,
      };
    }

    for (const allowed of config.allowedTopics) {
      const a = allowed.trim();
      if (!a) continue;
      if (lower.includes(a.toLowerCase())) {
        return {
          inScope: true,
          mode: config.mode,
          matchedAllowed: a,
          reason: `Matched allowed topic: "${a}"`,
          processingTimeMs: Date.now() - start,
        };
      }
    }

    if (config.mode === 'strict') {
      return {
        inScope: false,
        mode: config.mode,
        reason: 'Strict allowlist: input did not match any allowed topic',
        processingTimeMs: Date.now() - start,
      };
    }

    return {
      inScope: true,
      mode: config.mode,
      reason: 'Lenient mode: no allowlist match, but not blocked',
      processingTimeMs: Date.now() - start,
    };
  }
}

export const topicScopeFilter = new TopicScopeFilter();
