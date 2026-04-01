/**
 * Epistemic Map
 * =============
 * Models what the agent KNOWS and DOESN'T KNOW — and how certain it is.
 *
 * Socrates said wisdom is knowing that you know nothing. This module
 * gives the agent Socratic awareness: it maps its own knowledge boundaries.
 *
 * Why this matters: an agent that doesn't know what it doesn't know will
 * confidently stumble into unfamiliar territory without seeking help.
 * An agent WITH an epistemic map will:
 * - Slow down in unfamiliar domains
 * - Ask for clarification when certainty is low
 * - Leverage deep knowledge where certainty is high
 * - Track knowledge decay (domains get stale over time)
 * - Identify cross-domain connections
 */

import type { DecisionGraph } from '../types/decision-graph';
import type { SessionIntent } from '../types/metacognition';
import type { EpistemicMap, EpistemicDomain } from '../types/consciousness';
import { classifySessionIntent } from '../classifier/classifier';

// ─── Domain Certainty Computation ───────────────────────────────────────────

/**
 * Compute certainty for a domain based on session outcomes.
 * High certainty = many sessions, high success, few corrections.
 * Low certainty = few sessions, low success, many corrections.
 */
function computeCertainty(sessions: DecisionGraph[]): number {
  if (sessions.length === 0) return 0;

  const successRate = sessions.filter(g => g.metrics.apparentSuccess).length / sessions.length;
  const avgCorrections = sessions.reduce((s, g) => s + g.metrics.userCorrectionCount, 0) / sessions.length;
  const avgBacktracks = sessions.reduce((s, g) => s + g.metrics.backtrackCount, 0) / sessions.length;

  // Exposure factor: more sessions = higher base certainty
  const exposureFactor = Math.min(1.0, sessions.length / 15); // Caps at 15 sessions

  // Performance factor
  const perfFactor = successRate * (1 - Math.min(1, avgCorrections / 5));

  // Stability factor: fewer backtracks = more stable knowledge
  const stabilityFactor = 1 - Math.min(1, avgBacktracks / 10);

  return Math.min(0.95, exposureFactor * 0.3 + perfFactor * 0.45 + stabilityFactor * 0.25);
}

/**
 * Assess depth of knowledge in a domain.
 */
function assessDepth(sessions: DecisionGraph[]): EpistemicDomain['depth'] {
  if (sessions.length <= 2) return 'surface';
  if (sessions.length <= 6) return 'working';

  const successRate = sessions.filter(g => g.metrics.apparentSuccess).length / sessions.length;
  const avgCorrections = sessions.reduce((s, g) => s + g.metrics.userCorrectionCount, 0) / sessions.length;
  const totalUniqueFiles = new Set(
    sessions.flatMap(g => [
      ...g.metrics.filesModifiedAsResolution,
      ...g.metrics.filesInvestigatedNotResolution,
    ])
  ).size;

  // "expert" is a HIGH bar: many sessions, high success, low corrections, broad file coverage
  if (
    sessions.length > 20 &&
    totalUniqueFiles > 30 &&
    successRate > 0.85 &&
    avgCorrections < 0.5
  ) return 'expert';

  if (totalUniqueFiles > 15 && sessions.length > 10 && successRate > 0.7 && avgCorrections < 1.5) return 'deep';
  return 'working';
}

/**
 * Extract known facts from sessions — what concrete things does the agent know?
 */
function extractKnownFacts(sessions: DecisionGraph[], domain: string): string[] {
  const facts: string[] = [];

  // Files that were successfully resolved in this domain
  const resolutionFiles = new Set(
    sessions
      .filter(g => g.metrics.apparentSuccess)
      .flatMap(g => g.metrics.filesModifiedAsResolution)
  );

  if (resolutionFiles.size > 0) {
    facts.push(`Key files in ${domain}: ${[...resolutionFiles].slice(0, 5).join(', ')}`);
  }

  // Common tools used successfully
  const toolFreq = new Map<string, number>();
  for (const g of sessions.filter(g => g.metrics.apparentSuccess)) {
    for (const tool of g.metrics.toolsUsed) {
      toolFreq.set(tool, (toolFreq.get(tool) || 0) + 1);
    }
  }
  const topTools = [...toolFreq.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([t]) => t);

  if (topTools.length > 0) {
    facts.push(`Effective tools for ${domain}: ${topTools.join(', ')}`);
  }

  return facts;
}

/**
 * Identify known unknowns — things the agent explicitly doesn't know.
 */
function identifyKnownUnknowns(sessions: DecisionGraph[], domain: string): string[] {
  const unknowns: string[] = [];

  // Files that were investigated but NOT part of resolution (false leads)
  const falseLeads = new Set(
    sessions.flatMap(g => g.metrics.filesInvestigatedNotResolution)
  );

  // If the same false leads recur, we KNOW we don't understand the file map
  const falseLeadFreq = new Map<string, number>();
  for (const g of sessions) {
    for (const f of g.metrics.filesInvestigatedNotResolution) {
      falseLeadFreq.set(f, (falseLeadFreq.get(f) || 0) + 1);
    }
  }

  const repeatedFalseLeads = [...falseLeadFreq.entries()]
    .filter(([, count]) => count >= 2)
    .map(([file]) => file);

  if (repeatedFalseLeads.length > 0) {
    unknowns.push(
      `Repeatedly misidentifying ${repeatedFalseLeads.slice(0, 3).join(', ')} as relevant — file relationship map in ${domain} is incomplete`
    );
  }

  // If there are many corrections in this domain
  const corrections = sessions.reduce((s, g) => s + g.metrics.userCorrectionCount, 0);
  if (corrections >= 3) {
    unknowns.push(
      `User corrects approach in ${domain} frequently (${corrections} total corrections) — fundamental misunderstanding of domain conventions may exist`
    );
  }

  // If backtrack rate is high, understanding is incomplete
  const avgBacktracks = sessions.reduce((s, g) => s + g.metrics.backtrackCount, 0) / sessions.length;
  if (avgBacktracks > 3) {
    unknowns.push(
      `High backtrack rate in ${domain} (avg ${round(avgBacktracks, 1)}/session) — problem decomposition in this area needs work`
    );
  }

  return unknowns;
}

// ─── Cross-Domain Connections ───────────────────────────────────────────────

function detectConnections(
  domainSessions: Map<string, DecisionGraph[]>
): EpistemicMap['connections'] {
  const connections: EpistemicMap['connections'] = [];
  const domains = [...domainSessions.keys()];

  for (let i = 0; i < domains.length; i++) {
    for (let j = i + 1; j < domains.length; j++) {
      const sessionsA = domainSessions.get(domains[i])!;
      const sessionsB = domainSessions.get(domains[j])!;

      // Check file overlap between domains
      const filesA = new Set(sessionsA.flatMap(g => [
        ...g.metrics.filesModifiedAsResolution,
        ...g.metrics.filesInvestigatedNotResolution,
      ]));
      const filesB = new Set(sessionsB.flatMap(g => [
        ...g.metrics.filesModifiedAsResolution,
        ...g.metrics.filesInvestigatedNotResolution,
      ]));

      const overlap = [...filesA].filter(f => filesB.has(f)).length;
      const union = new Set([...filesA, ...filesB]).size;
      const jaccardSimilarity = union > 0 ? overlap / union : 0;

      // Check if sessions in one domain also touch the other
      const coOccurrence = sessionsA.filter(ga =>
        sessionsB.some(gb => ga.sessionId === gb.sessionId)
      ).length;

      const strength = jaccardSimilarity * 0.6 + (coOccurrence > 0 ? 0.4 : 0);

      if (strength > 0.1) {
        connections.push({
          domainA: domains[i],
          domainB: domains[j],
          strength: round(strength, 2),
          description: overlap > 0
            ? `${overlap} shared files between ${domains[i]} and ${domains[j]}`
            : `Co-occurring in ${coOccurrence} session(s)`,
        });
      }
    }
  }

  return connections.sort((a, b) => b.strength - a.strength);
}

// ─── Calibration ────────────────────────────────────────────────────────────

function computeCalibration(
  domains: EpistemicDomain[],
  graphs: DecisionGraph[],
  domainSessionMap: Map<string, DecisionGraph[]>
): EpistemicMap['calibration'] {
  let highCertaintyCorrect = 0;
  let highCertaintyTotal = 0;
  let lowCertaintyMistakes = 0;
  let lowCertaintyTotal = 0;

  for (const domain of domains) {
    const sessions = domainSessionMap.get(domain.domain) || [];
    const successRate = sessions.length > 0
      ? sessions.filter(g => g.metrics.apparentSuccess).length / sessions.length
      : 0;

    if (domain.certainty > 0.7) {
      highCertaintyTotal++;
      if (successRate > 0.7) highCertaintyCorrect++;
    }

    if (domain.certainty < 0.3) {
      lowCertaintyTotal++;
      if (successRate < 0.5) lowCertaintyMistakes++;
    }
  }

  return {
    highCertaintyAccuracy: highCertaintyTotal > 0
      ? round(highCertaintyCorrect / highCertaintyTotal, 2)
      : 0,
    lowCertaintyMistakeRate: lowCertaintyTotal > 0
      ? round(lowCertaintyMistakes / lowCertaintyTotal, 2)
      : 0,
    sampleSize: domains.length,
  };
}

// ─── Main Entry Point ───────────────────────────────────────────────────────

/**
 * Build the epistemic map — a topography of what the agent knows.
 */
export function buildEpistemicMap(
  graphs: DecisionGraph[],
  existing?: EpistemicMap
): EpistemicMap {
  // Group sessions by domain
  const domainSessions = new Map<string, DecisionGraph[]>();

  for (const g of graphs) {
    const intent = classifySessionIntent(g);
    for (const domain of intent.domains) {
      if (!domainSessions.has(domain)) domainSessions.set(domain, []);
      domainSessions.get(domain)!.push(g);
    }
    // Skip task-type as pseudo-domain — it inflates the map with non-domain entries
    // like "bug-fix" and "feature" which aren't knowledge domains
  }

  // Build domain profiles
  const now = new Date();
  const domains: EpistemicDomain[] = [];

  for (const [domain, sessions] of domainSessions) {
    const lastSession = sessions
      .sort((a, b) => new Date(b.endTime).getTime() - new Date(a.endTime).getTime())[0];

    const lastEncountered = lastSession?.endTime || now.toISOString();
    const daysSince = (now.getTime() - new Date(lastEncountered).getTime()) / (1000 * 60 * 60 * 24);

    // Apply decay based on time since last encounter
    const rawCertainty = computeCertainty(sessions);
    const decayRate = 0.01; // 1% per day
    const decayedCertainty = Math.max(0.05, rawCertainty - (decayRate * daysSince));

    domains.push({
      domain,
      exposure: sessions.length,
      certainty: round(decayedCertainty, 2),
      lastEncountered,
      decayRate,
      knownFacts: extractKnownFacts(sessions, domain),
      knownUnknowns: identifyKnownUnknowns(sessions, domain),
      depth: assessDepth(sessions),
    });
  }

  // Merge with existing domains that weren't in this batch
  if (existing) {
    const currentDomainNames = new Set(domains.map(d => d.domain));
    for (const existingDomain of existing.domains) {
      if (!currentDomainNames.has(existingDomain.domain)) {
        // Apply decay
        const daysSince = (now.getTime() - new Date(existingDomain.lastEncountered).getTime()) / (1000 * 60 * 60 * 24);
        existingDomain.certainty = Math.max(0.05,
          existingDomain.certainty - (existingDomain.decayRate * daysSince)
        );
        domains.push(existingDomain);
      }
    }
  }

  // Sort by certainty (highest first)
  domains.sort((a, b) => b.certainty - a.certainty);

  // Detect cross-domain connections
  const connections = detectConnections(domainSessions);

  // Compute calibration
  const calibration = computeCalibration(domains, graphs, domainSessions);

  // Identify active frontier (domains with recent activity but low certainty)
  const activeFrontier = domains
    .filter(d => {
      const daysSince = (now.getTime() - new Date(d.lastEncountered).getTime()) / (1000 * 60 * 60 * 24);
      return daysSince < 7 && d.certainty < 0.5;
    })
    .map(d => d.domain);

  return {
    updatedAt: now.toISOString(),
    domains,
    connections,
    calibration,
    activeFrontier,
  };
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function round(n: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.round(n * factor) / factor;
}
