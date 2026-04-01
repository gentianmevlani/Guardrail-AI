/**
 * User Model (Theory of Mind)
 * ===========================
 * Models the human collaborator — their expertise, communication style,
 * patience, preferences, and correction patterns.
 *
 * Theory of Mind is the ability to model another agent's mental state.
 * Humans do this automatically: "She seems frustrated, I should slow down."
 * "He's an expert, I can skip the basics." "They prefer concise answers."
 *
 * This module builds a user model from observed interaction patterns:
 * - How detailed are their prompts?
 * - How do they correct? Gentle? Direct? Frustrated?
 * - How often do they intervene vs let the agent work?
 * - What do they approve of? What do they reject?
 * - How patient are they with exploration?
 *
 * The model lets the agent ADAPT its behavior to the human, not just
 * to the code. A beginner user gets more explanation. An expert gets
 * more concise output. A frustrated user gets fewer exploratory tangents.
 */

import type { DecisionGraph, DecisionNode } from '../types/decision-graph';
import type { UserModel, CommunicationStyle } from '../types/consciousness';

// ─── Signal Extraction ──────────────────────────────────────────────────────

/**
 * Extract user message characteristics from a graph.
 */
function extractUserMessages(graph: DecisionGraph): Array<{
  text: string;
  isCorrection: boolean;
  length: number;
  hasQuestion: boolean;
  hasTechnicalTerms: boolean;
}> {
  return graph.nodes
    .filter(n => n.type === 'user_request' || n.type === 'correction' || n.type === 'escalation')
    .map(n => ({
      text: n.reasoning,
      isCorrection: n.type === 'correction',
      length: n.reasoning.length,
      hasQuestion: n.reasoning.includes('?'),
      hasTechnicalTerms: /\b(function|class|interface|type|module|component|hook|middleware|endpoint|schema|migration|index|query|mutation|resolver|controller|service|repository|factory|singleton|observer|decorator|proxy|adapter)\b/i.test(n.reasoning),
    }));
}

// ─── Communication Style Assessment ─────────────────────────────────────────

function assessCommunicationStyle(
  graphs: DecisionGraph[]
): CommunicationStyle {
  const allMessages: Array<{ text: string; isCorrection: boolean; length: number }> = [];

  for (const g of graphs) {
    allMessages.push(...extractUserMessages(g));
  }

  if (allMessages.length === 0) {
    return {
      promptDetail: 'moderate',
      correctionStyle: 'neutral',
      explanatoryDepth: 'some-context',
      interventionFrequency: 'occasional',
      preferredResponseLength: 'moderate',
    };
  }

  // Prompt detail: based on average message length
  const avgLength = allMessages.reduce((s, m) => s + m.length, 0) / allMessages.length;
  const promptDetail: CommunicationStyle['promptDetail'] =
    avgLength < 50 ? 'terse' : avgLength > 200 ? 'verbose' : 'moderate';

  // Correction style: analyze correction messages
  const corrections = allMessages.filter(m => m.isCorrection);
  let correctionStyle: CommunicationStyle['correctionStyle'] = 'neutral';

  if (corrections.length > 0) {
    const frustrationSignals = corrections.filter(m =>
      /\b(no!|wrong|stop|ugh|come on|not again|I said|already told)\b/i.test(m.text)
    ).length;
    const gentleSignals = corrections.filter(m =>
      /\b(maybe|could you|instead|perhaps|try|actually|hmm)\b/i.test(m.text)
    ).length;

    if (frustrationSignals > corrections.length * 0.3) correctionStyle = 'frustrated';
    else if (gentleSignals > corrections.length * 0.5) correctionStyle = 'gentle';
    else correctionStyle = 'direct';
  }

  // Explanatory depth: do corrections/prompts include "because" / reasoning?
  const withReasoning = allMessages.filter(m =>
    /\b(because|since|reason|so that|in order to|the issue is|the problem is|this is because)\b/i.test(m.text)
  ).length;
  const explanatoryDepth: CommunicationStyle['explanatoryDepth'] =
    withReasoning > allMessages.length * 0.4 ? 'full-rationale'
    : withReasoning > allMessages.length * 0.15 ? 'some-context'
    : 'just-what';

  // Intervention frequency: user messages per session
  const avgMessagesPerSession = allMessages.length / Math.max(graphs.length, 1);
  const interventionFrequency: CommunicationStyle['interventionFrequency'] =
    avgMessagesPerSession <= 1.5 ? 'hands-off'
    : avgMessagesPerSession <= 3 ? 'occasional'
    : avgMessagesPerSession <= 6 ? 'frequent'
    : 'micromanaging';

  // Preferred response length: inferred from prompt detail (terse users want terse responses)
  const preferredResponseLength: CommunicationStyle['preferredResponseLength'] =
    promptDetail === 'terse' ? 'concise'
    : promptDetail === 'verbose' ? 'detailed'
    : 'moderate';

  return {
    promptDetail,
    correctionStyle,
    explanatoryDepth,
    interventionFrequency,
    preferredResponseLength,
  };
}

// ─── Expertise Assessment ───────────────────────────────────────────────────

function assessExpertise(
  graphs: DecisionGraph[]
): { level: UserModel['expertiseLevel']; domains: string[]; learningDomains: string[] } {
  const allMessages = graphs.flatMap(g => extractUserMessages(g));

  // Technical term density
  const techMessages = allMessages.filter(m => m.hasTechnicalTerms).length;
  const techDensity = allMessages.length > 0 ? techMessages / allMessages.length : 0;

  // Prompt specificity: experts give specific instructions
  const specificSignals = allMessages.filter(m =>
    /\b(in file|at line|the function|the class|the hook|the endpoint|the middleware|refactor.*to|change.*from.*to)\b/i.test(m.text)
  ).length;
  const specificity = allMessages.length > 0 ? specificSignals / allMessages.length : 0;

  // Correction quality: experts give precise corrections
  const corrections = allMessages.filter(m => m.isCorrection);
  const preciseCorrectionRate = corrections.length > 0
    ? corrections.filter(m => m.length > 50 && m.hasTechnicalTerms).length / corrections.length
    : 0;

  const expertiseScore = techDensity * 0.3 + specificity * 0.4 + preciseCorrectionRate * 0.3;

  // Thresholds are deliberately low because:
  // 1. User messages in JSONL are truncated to 500 chars
  // 2. Claude Code wraps/formats many user messages
  // 3. Even moderately technical users hit 0.1+ on these signals
  const level: UserModel['expertiseLevel'] =
    expertiseScore > 0.4 ? 'expert'
    : expertiseScore > 0.25 ? 'advanced'
    : expertiseScore > 0.1 ? 'intermediate'
    : 'beginner';

  // Extract expertise domains: domains where user gives confident, precise instructions
  const expertiseDomains: string[] = [];
  const learningDomains: string[] = [];

  // Simple heuristic: domains where user corrections have technical detail
  const domainMentions = new Map<string, { total: number; technical: number }>();
  const domainPatterns: Array<{ domain: string; pattern: RegExp }> = [
    { domain: 'frontend', pattern: /\b(component|react|vue|angular|css|style|dom|render|hook|state)\b/i },
    { domain: 'backend', pattern: /\b(api|endpoint|route|middleware|controller|handler|server|express|fastify)\b/i },
    { domain: 'database', pattern: /\b(query|schema|migration|model|table|column|index|sql|prisma|orm)\b/i },
    { domain: 'devops', pattern: /\b(docker|ci|cd|deploy|pipeline|kubernetes|k8s|terraform|config)\b/i },
    { domain: 'testing', pattern: /\b(test|spec|mock|stub|fixture|assert|expect|coverage)\b/i },
    { domain: 'auth', pattern: /\b(auth|login|token|session|oauth|jwt|permission|role)\b/i },
  ];

  for (const msg of allMessages) {
    for (const { domain, pattern } of domainPatterns) {
      if (pattern.test(msg.text)) {
        if (!domainMentions.has(domain)) domainMentions.set(domain, { total: 0, technical: 0 });
        const entry = domainMentions.get(domain)!;
        entry.total++;
        if (msg.hasTechnicalTerms && msg.length > 30) entry.technical++;
      }
    }
  }

  for (const [domain, counts] of domainMentions) {
    if (counts.total >= 2 && counts.technical / counts.total > 0.5) {
      expertiseDomains.push(domain);
    } else if (counts.total >= 2 && counts.technical / counts.total < 0.3) {
      learningDomains.push(domain);
    }
  }

  return { level, domains: expertiseDomains, learningDomains };
}

// ─── Patience & Preferences ─────────────────────────────────────────────────

function assessPatience(graphs: DecisionGraph[]): {
  patience: UserModel['patience'];
  correctionThreshold: number;
} {
  // Look at how many corrections before the user seems frustrated
  const sessionsWithCorrections = graphs.filter(g => g.metrics.userCorrectionCount > 0);

  if (sessionsWithCorrections.length === 0) {
    return { patience: 'high', correctionThreshold: 5 };
  }

  const avgCorrections = sessionsWithCorrections.reduce(
    (s, g) => s + g.metrics.userCorrectionCount, 0
  ) / sessionsWithCorrections.length;

  // Check for frustration signals in correction messages
  let frustrationCount = 0;
  for (const g of sessionsWithCorrections) {
    const correctionNodes = g.nodes.filter(n => n.type === 'correction');
    for (const n of correctionNodes) {
      if (/\b(no!|wrong|stop|ugh|come on|not again|I said|already told|just do|seriously)\b/i.test(n.reasoning)) {
        frustrationCount++;
      }
    }
  }

  const frustrationRate = frustrationCount / Math.max(sessionsWithCorrections.length, 1);

  const patience: UserModel['patience'] =
    frustrationRate > 0.3 || avgCorrections < 1.5 ? 'low'
    : frustrationRate > 0.1 || avgCorrections < 3 ? 'moderate'
    : 'high';

  return {
    patience,
    correctionThreshold: Math.max(1, Math.round(avgCorrections)),
  };
}

function extractPreferences(
  graphs: DecisionGraph[]
): { approved: string[]; rejected: string[] } {
  const approved: string[] = [];
  const rejected: string[] = [];

  for (const g of graphs) {
    for (let i = 0; i < g.nodes.length; i++) {
      const node = g.nodes[i];

      if (node.type === 'correction') {
        // The action before a correction was implicitly rejected
        const prevAction = g.nodes.slice(0, i).reverse().find(n => n.type === 'action');
        if (prevAction?.toolCall) {
          const files = prevAction.filesTouched
            .map(f => f.replace(/^\/Users\/[^/]+\/(?:Desktop\/)?/, '').replace(/^\/home\/[^/]+\//, ''))
            .join(', ') || 'unknown';
          rejected.push(`Using ${prevAction.toolCall.name} on ${files}`);
        }

        // The correction text often contains what IS wanted
        if (node.reasoning.length > 10) {
          approved.push(node.reasoning.slice(0, 100));
        }
      }
    }
  }

  // Deduplicate
  return {
    approved: [...new Set(approved)].slice(0, 10),
    rejected: [...new Set(rejected)].slice(0, 10),
  };
}

// ─── Collaboration Health ───────────────────────────────────────────────────

function assessCollaborationHealth(
  graphs: DecisionGraph[]
): { health: number; trend: UserModel['collaborationTrend'] } {
  if (graphs.length === 0) return { health: 0.5, trend: 'stable' };

  // Health = weighted average of success rate and correction rate
  const sorted = [...graphs].sort(
    (a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime()
  );

  const healthScores = sorted.map(g => {
    const successFactor = g.metrics.apparentSuccess ? 1.0 : 0.3;
    const correctionFactor = Math.max(0, 1 - g.metrics.userCorrectionCount * 0.2);
    return successFactor * 0.6 + correctionFactor * 0.4;
  });

  const overallHealth = healthScores.reduce((s, h) => s + h, 0) / healthScores.length;

  // Trend: compare first half to second half
  let trend: UserModel['collaborationTrend'] = 'stable';
  if (healthScores.length >= 4) {
    const mid = Math.floor(healthScores.length / 2);
    const firstHalf = healthScores.slice(0, mid).reduce((s, h) => s + h, 0) / mid;
    const secondHalf = healthScores.slice(mid).reduce((s, h) => s + h, 0) / (healthScores.length - mid);

    if (secondHalf > firstHalf + 0.1) trend = 'improving';
    else if (secondHalf < firstHalf - 0.1) trend = 'declining';
  }

  return { health: Math.round(overallHealth * 100) / 100, trend };
}

// ─── Main Entry Point ───────────────────────────────────────────────────────

/**
 * Build or update the user model from session data.
 * This is Theory of Mind: modeling the human collaborator.
 */
export function buildUserModel(
  graphs: DecisionGraph[],
  existing?: UserModel
): UserModel {
  const style = assessCommunicationStyle(graphs);
  const expertise = assessExpertise(graphs);
  const patience = assessPatience(graphs);
  const preferences = extractPreferences(graphs);
  const collaboration = assessCollaborationHealth(graphs);

  // Extract recurring themes from user messages
  const allUserText = graphs.flatMap(g =>
    g.nodes.filter(n => n.type === 'user_request').map(n => n.reasoning)
  ).join(' ');

  const themePatterns = [
    { theme: 'performance', pattern: /\b(slow|fast|performance|optimize|speed)\b/gi },
    { theme: 'testing', pattern: /\b(test|spec|coverage|mock)\b/gi },
    { theme: 'refactoring', pattern: /\b(refactor|clean|reorganize|simplify)\b/gi },
    { theme: 'bugs', pattern: /\b(bug|fix|broken|error|issue)\b/gi },
    { theme: 'features', pattern: /\b(add|create|implement|new|build)\b/gi },
    { theme: 'security', pattern: /\b(security|auth|vulnerability|permission)\b/gi },
  ];

  const themeCounts = themePatterns.map(({ theme, pattern }) => ({
    theme,
    count: (allUserText.match(pattern) || []).length,
  }));

  const recurringThemes = themeCounts
    .filter(t => t.count >= 3)
    .sort((a, b) => b.count - a.count)
    .map(t => t.theme);

  // Merge with existing approved/rejected behaviors
  const mergedApproved = existing
    ? [...new Set([...existing.approvedBehaviors, ...preferences.approved])].slice(0, 15)
    : preferences.approved;
  const mergedRejected = existing
    ? [...new Set([...existing.rejectedBehaviors, ...preferences.rejected])].slice(0, 15)
    : preferences.rejected;

  return {
    updatedAt: new Date().toISOString(),
    totalInteractions: graphs.reduce((s, g) => s + g.metrics.userPromptCount, 0),
    expertiseLevel: expertise.level,
    expertiseDomains: expertise.domains,
    learningDomains: expertise.learningDomains,
    style,
    patience: patience.patience,
    correctionThreshold: patience.correctionThreshold,
    approvedBehaviors: mergedApproved,
    rejectedBehaviors: mergedRejected,
    recurringThemes,
    collaborationHealth: collaboration.health,
    collaborationTrend: collaboration.trend,
  };
}
