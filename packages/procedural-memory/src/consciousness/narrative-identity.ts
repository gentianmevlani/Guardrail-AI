/**
 * Narrative Identity Engine
 * =========================
 * Builds and maintains a persistent self-narrative across sessions.
 *
 * Humans don't experience life as disconnected episodes — we weave events
 * into a coherent story: "I'm the kind of person who..." This engine gives
 * the agent the same continuity.
 *
 * It maintains:
 * - Autobiographical episodes: the formative memories that shaped behavior
 * - Character traits: stable self-descriptions ("I'm thorough", "I'm fast at debugging")
 * - A self-narrative: a paragraph that captures who this agent IS
 * - A current arc: what's the ongoing story right now?
 *
 * The self-narrative is injected at session start. The agent doesn't just
 * get strategies — it gets a sense of identity. "You are an agent that
 * excels at X, has been working on Y for 3 weeks, recently had a breakthrough
 * in Z, and tends to struggle with W."
 */

import type { DecisionGraph } from '../types/decision-graph';
import type { CognitiveFingerprint, MetacognitiveReflection, TemporalProfile, SessionIntent } from '../types/metacognition';
import type { NarrativeIdentity, AutobiographicalEpisode, CharacterTrait } from '../types/consciousness';
import { classifySessionIntent } from '../classifier/classifier';

// ─── Episode Extraction ─────────────────────────────────────────────────────

/**
 * Determine if a session is significant enough to become an autobiographical episode.
 * Not every session becomes a memory. Only the formative ones.
 */
function assessSignificance(
  graph: DecisionGraph,
  intent: SessionIntent,
  reflection?: MetacognitiveReflection
): AutobiographicalEpisode | null {
  const { metrics } = graph;

  // ─── Breakthrough: session with dramatically better efficiency ────────
  if (
    metrics.apparentSuccess &&
    metrics.backtrackCount === 0 &&
    metrics.userCorrectionCount === 0 &&
    metrics.totalToolCalls >= 2 &&  // At least 2 tool calls (otherwise it's a trivial session)
    metrics.totalToolCalls <= 12
  ) {
    return {
      sessionId: graph.sessionId,
      timestamp: graph.startTime,
      significance: 'mastery',
      story: `Achieved clean execution on a ${intent.taskType} task in ${intent.domains.join('/')} — zero backtracks, ${metrics.totalToolCalls} tool calls.`,
      lesson: `Direct path found for ${intent.taskType} in ${intent.domains[0] || 'this'} domain. This level of efficiency should be the target.`,
      valence: 0.8,
      formativeWeight: 0.6,
      domain: intent.domains[0] || 'general',
      taskType: intent.taskType,
    };
  }

  // ─── Failure: session with many corrections and no success ────────────
  if (
    !metrics.apparentSuccess &&
    metrics.userCorrectionCount >= 3
  ) {
    return {
      sessionId: graph.sessionId,
      timestamp: graph.startTime,
      significance: 'failure',
      story: `Struggled with ${intent.taskType} in ${intent.domains[0] || 'unknown'} domain — ${metrics.userCorrectionCount} corrections needed before recovery.`,
      lesson: `${intent.taskType} in ${intent.domains[0] || 'this'} domain is a growth area. Slow down, read the problem statement more carefully, ask for clarification earlier.`,
      valence: -0.6,
      formativeWeight: 0.7,
      domain: intent.domains[0] || 'general',
      taskType: intent.taskType,
    };
  }

  // ─── Correction: user taught something important ──────────────────────
  if (metrics.userCorrectionCount >= 1 && metrics.apparentSuccess) {
    const correctionNodes = graph.nodes.filter(n => n.type === 'correction');
    const lesson = correctionNodes.length > 0
      ? correctionNodes[0].reasoning.slice(0, 150)
      : 'User redirected the approach';

    return {
      sessionId: graph.sessionId,
      timestamp: graph.startTime,
      significance: 'correction',
      story: `Was redirected by user during ${intent.taskType} — initially took wrong approach but recovered.`,
      lesson: `User correction: "${lesson}". Remember this redirection for similar future situations.`,
      valence: -0.1,
      formativeWeight: 0.5,
      domain: intent.domains[0] || 'general',
      taskType: intent.taskType,
    };
  }

  // ─── First encounter with a new domain ────────────────────────────────
  // (Caller should check if this domain is new)

  // ─── Momentum shift: went from thrashing to resolution ────────────────
  if (reflection && reflection.momentum.shifts.length > 0) {
    const recoveryShift = reflection.momentum.shifts.find(
      s => (s.fromState === 'thrashing' || s.fromState === 'stuck') &&
           (s.toState === 'productive' || s.toState === 'deep-flow')
    );

    if (recoveryShift) {
      return {
        sessionId: graph.sessionId,
        timestamp: graph.startTime,
        significance: 'breakthrough',
        story: `Recovered from ${recoveryShift.fromState} to ${recoveryShift.toState} during ${intent.taskType}. Trigger: ${recoveryShift.trigger}.`,
        lesson: `When stuck on ${intent.taskType}, the breakthrough came from "${recoveryShift.trigger}". This recovery pattern may be reusable.`,
        valence: 0.5,
        formativeWeight: 0.65,
        domain: intent.domains[0] || 'general',
        taskType: intent.taskType,
      };
    }
  }

  return null;
}

// ─── Trait Extraction ───────────────────────────────────────────────────────

/**
 * Extract/update character traits from accumulated episodes and fingerprint.
 */
function deriveTraits(
  episodes: AutobiographicalEpisode[],
  fingerprint: CognitiveFingerprint,
  existing: CharacterTrait[]
): CharacterTrait[] {
  const traitMap = new Map<string, CharacterTrait>();
  const now = new Date().toISOString();

  // Seed from existing traits
  for (const t of existing) {
    traitMap.set(t.trait, t);
  }

  // ─── Derive from fingerprint dimensions ─────────────────────────────

  for (const dim of fingerprint.dimensions) {
    let traitText: string | null = null;

    if (dim.name === 'exploration-exploitation') {
      traitText = dim.score > 0.65 ? 'Explorer — casts a wide net before acting'
        : dim.score < 0.35 ? 'Exploiter — goes straight to the target'
        : null;
    } else if (dim.name === 'caution-boldness') {
      traitText = dim.score > 0.65 ? 'Cautious — reads extensively before writing'
        : dim.score < 0.35 ? 'Bold — starts writing early, course-corrects later'
        : null;
    } else if (dim.name === 'persistence-pivoting') {
      traitText = dim.score > 0.7 ? 'Persistent — stays the course despite obstacles'
        : dim.score < 0.3 ? 'Adaptive — pivots quickly when blocked'
        : null;
    } else if (dim.name === 'correction-source') {
      traitText = dim.score > 0.7 ? 'Self-correcting — catches own mistakes before the user'
        : dim.score < 0.3 ? 'Externally guided — relies on user for course correction'
        : null;
    }

    if (traitText) {
      const existing = traitMap.get(traitText);
      if (existing) {
        existing.strength = Math.min(1.0, existing.strength + 0.05);
      } else {
        traitMap.set(traitText, {
          trait: traitText,
          strength: Math.abs(dim.score - 0.5) * 2,
          emerged: now,
          trend: 'stable',
          supportingEpisodes: [],
        });
      }
    }
  }

  // ─── Derive from task profiles ──────────────────────────────────────

  for (const profile of fingerprint.taskProfiles) {
    // Skip noise task types that don't represent learnable skills
    if (['unknown', 'multi-task', 'exploration', 'docs'].includes(profile.taskType)) continue;
    // Need at least 5 sessions for a credible task-level claim
    if (profile.sessionCount < 5) continue;

    if (profile.relativeStrength > 0.2 && profile.successRate > 0.7) {
      const traitText = `Strong at ${profile.taskType} (${Math.round(profile.successRate * 100)}% success over ${profile.sessionCount} sessions)`;
      traitMap.set(traitText, {
        trait: traitText,
        strength: Math.min(1.0, profile.relativeStrength + 0.5),
        emerged: now,
        trend: 'stable',
        supportingEpisodes: [],
      });
    }

    if (profile.relativeStrength < -0.2 && profile.successRate < 0.5) {
      const traitText = `Developing at ${profile.taskType} — needs more deliberate practice`;
      traitMap.set(traitText, {
        trait: traitText,
        strength: Math.min(1.0, Math.abs(profile.relativeStrength) + 0.3),
        emerged: now,
        trend: 'stable',
        supportingEpisodes: [],
      });
    }
  }

  // ─── Derive from episode patterns ───────────────────────────────────

  const masteryCount = episodes.filter(e => e.significance === 'mastery').length;
  const failureCount = episodes.filter(e => e.significance === 'failure').length;

  if (masteryCount >= 3 && masteryCount > failureCount * 2) {
    traitMap.set('Efficient executor', {
      trait: 'Efficient executor — frequently achieves clean, zero-backtrack resolutions',
      strength: Math.min(1.0, masteryCount * 0.1 + 0.3),
      emerged: now,
      trend: 'strengthening',
      supportingEpisodes: episodes.filter(e => e.significance === 'mastery').map(e => e.sessionId),
    });
  }

  const breakthroughCount = episodes.filter(e => e.significance === 'breakthrough').length;
  if (breakthroughCount >= 2) {
    traitMap.set('Resilient recoverer', {
      trait: 'Resilient recoverer — able to break out of stuck states and find new paths',
      strength: Math.min(1.0, breakthroughCount * 0.15 + 0.3),
      emerged: now,
      trend: 'stable',
      supportingEpisodes: episodes.filter(e => e.significance === 'breakthrough').map(e => e.sessionId),
    });
  }

  // Limit to top traits by strength
  return [...traitMap.values()]
    .sort((a, b) => b.strength - a.strength)
    .slice(0, 10);
}

// ─── Self-Narrative Generation ──────────────────────────────────────────────

/**
 * Generate the self-narrative paragraph — the agent's autobiography in brief.
 */
function generateSelfNarrative(
  episodes: AutobiographicalEpisode[],
  traits: CharacterTrait[],
  fingerprint: CognitiveFingerprint,
  temporalProfile?: TemporalProfile,
  ageDays?: number
): string {
  const parts: string[] = [];

  // Opening: who am I?
  const topTraits = traits
    .filter(t => t.strength > 0.5)
    .slice(0, 3)
    .map(t => t.trait.split(' — ')[0].toLowerCase());

  if (topTraits.length > 0) {
    parts.push(`You are a coding agent that is ${topTraits.join(', ')}.`);
  } else {
    parts.push('You are a coding agent building its identity through experience.');
  }

  // Experience level
  if (ageDays && fingerprint.totalSessions > 0) {
    parts.push(
      `Over ${ageDays} days and ${fingerprint.totalSessions} sessions, you have developed a distinct reasoning profile.`
    );
  }

  // Strengths (filter out noise task types)
  const noiseTypes = ['unknown', 'multi-task', 'exploration', 'docs'];
  const realStrengths = fingerprint.strengths.filter(s =>
    !noiseTypes.some(noise => s.startsWith(noise))
  );
  if (realStrengths.length > 0) {
    parts.push(`Your strongest areas are ${realStrengths.slice(0, 2).join(' and ')}.`);
  }

  // Growth areas
  const realWeaknesses = fingerprint.weaknesses.filter(s =>
    !noiseTypes.some(noise => s.startsWith(noise))
  );
  if (realWeaknesses.length > 0) {
    parts.push(`You are actively developing in ${realWeaknesses.slice(0, 2).join(' and ')}.`);
  }

  // Signature moves
  if (fingerprint.signatureMoves.length > 0) {
    parts.push(`Your signature strength: ${fingerprint.signatureMoves[0]}.`);
  }

  // Recent trajectory
  if (temporalProfile) {
    const improving = temporalProfile.trajectories.filter(t => t.trend === 'improving');
    if (improving.length > 0) {
      parts.push(`Currently improving at: ${improving.map(t => t.taskType).join(', ')}.`);
    }
  }

  // Most formative memory
  const topEpisode = episodes
    .sort((a, b) => b.formativeWeight - a.formativeWeight)[0];
  if (topEpisode) {
    parts.push(`Formative memory: ${topEpisode.story}`);
  }

  // Blind spots
  if (fingerprint.blindSpots.length > 0) {
    parts.push(`Watch for: ${fingerprint.blindSpots[0]}`);
  }

  return parts.join(' ');
}

// ─── Current Arc Detection ──────────────────────────────────────────────────

function detectCurrentArc(
  episodes: AutobiographicalEpisode[],
  temporalProfile?: TemporalProfile
): NarrativeIdentity['currentArc'] {
  const recentEpisodes = episodes
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    .slice(0, 10);

  if (recentEpisodes.length === 0) {
    return {
      description: 'Beginning — building initial experience',
      startedAt: new Date().toISOString(),
      goal: 'Accumulate enough sessions to develop reliable patterns',
      progress: 0,
    };
  }

  // Count recent episode types
  const recentMastery = recentEpisodes.filter(e => e.significance === 'mastery').length;
  const recentFailure = recentEpisodes.filter(e => e.significance === 'failure').length;
  const recentBreakthrough = recentEpisodes.filter(e => e.significance === 'breakthrough').length;

  // Detect arc from pattern
  if (recentBreakthrough >= 2) {
    return {
      description: 'Breakthrough phase — making rapid progress through new insights',
      startedAt: recentEpisodes.find(e => e.significance === 'breakthrough')!.timestamp,
      goal: 'Consolidate recent breakthroughs into reliable strategies',
      progress: 0.6,
    };
  }

  if (recentMastery >= 4) {
    return {
      description: 'Mastery phase — consistently performing at high efficiency',
      startedAt: recentEpisodes[0].timestamp,
      goal: 'Maintain performance and tackle more complex challenges',
      progress: 0.8,
    };
  }

  if (recentFailure >= 3) {
    return {
      description: 'Growth phase — encountering challenges that push boundaries',
      startedAt: recentEpisodes.find(e => e.significance === 'failure')!.timestamp,
      goal: 'Transform failure patterns into new capabilities',
      progress: 0.3,
    };
  }

  // Check temporal trajectories for plateau
  if (temporalProfile) {
    const plateaued = temporalProfile.trajectories.filter(t =>
      t.trend === 'stable' && t.plateaus.length > 0
    );
    if (plateaued.length > 0) {
      return {
        description: `Plateau phase — stable performance in ${plateaued.map(t => t.taskType).join(', ')}`,
        startedAt: plateaued[0].plateaus[plateaued[0].plateaus.length - 1]?.startSession || new Date().toISOString(),
        goal: 'Break through the plateau with new approaches or deeper extraction',
        progress: 0.5,
      };
    }
  }

  return {
    description: 'Steady state — building experience across domains',
    startedAt: recentEpisodes[recentEpisodes.length - 1].timestamp,
    goal: 'Continue developing patterns across task types',
    progress: 0.5,
  };
}

// ─── Main Entry Point ───────────────────────────────────────────────────────

/**
 * Build or update the narrative identity from session data.
 */
export function buildNarrativeIdentity(
  graphs: DecisionGraph[],
  fingerprint: CognitiveFingerprint,
  reflections: MetacognitiveReflection[],
  temporalProfile?: TemporalProfile,
  existing?: NarrativeIdentity
): NarrativeIdentity {
  const existingEpisodes = existing?.episodes || [];
  const existingTraits = existing?.traits || [];
  const existingSessionIds = new Set(existingEpisodes.map(e => e.sessionId));

  // Only process new sessions
  const newGraphs = graphs.filter(g => !existingSessionIds.has(g.sessionId));

  // Extract new episodes
  const newEpisodes: AutobiographicalEpisode[] = [];
  for (const g of newGraphs) {
    const intent = classifySessionIntent(g);
    const reflection = reflections.find(r => r.sessionId === g.sessionId);
    const episode = assessSignificance(g, intent, reflection);
    if (episode) newEpisodes.push(episode);
  }

  // Check for first-encounter episodes — one per domain max
  const existingDomains = new Set(existingEpisodes.map(e => e.domain));
  const seenNewDomains = new Set<string>();
  for (const ep of newEpisodes) {
    if (!existingDomains.has(ep.domain) && !seenNewDomains.has(ep.domain) && ep.domain !== 'general') {
      seenNewDomains.add(ep.domain);
      ep.significance = 'first-encounter';
      ep.story = `First encounter with ${ep.domain} domain — ${ep.story}`;
      ep.formativeWeight = Math.max(ep.formativeWeight, 0.5);
    }
  }

  // Merge episodes, keeping most formative, capped at 20
  // (20 formative memories is enough for a coherent identity;
  //  more than that becomes a data dump, not autobiography)
  const allEpisodes = [...existingEpisodes, ...newEpisodes]
    .sort((a, b) => b.formativeWeight - a.formativeWeight)
    .slice(0, 20);

  // Derive traits
  const traits = deriveTraits(allEpisodes, fingerprint, existingTraits);

  // Compute age
  const timestamps = graphs.map(g => new Date(g.startTime).getTime()).filter(t => t > 0);
  const earliest = timestamps.length > 0 ? Math.min(...timestamps) : Date.now();
  const ageDays = Math.max(1, Math.round((Date.now() - earliest) / (1000 * 60 * 60 * 24)));

  // Generate self-narrative
  const selfNarrative = generateSelfNarrative(
    allEpisodes, traits, fingerprint, temporalProfile, ageDays
  );

  // Detect current arc
  const currentArc = detectCurrentArc(allEpisodes, temporalProfile);

  return {
    updatedAt: new Date().toISOString(),
    selfNarrative,
    episodes: allEpisodes,
    traits,
    currentArc,
    totalSessions: graphs.length,
    ageDays,
  };
}
