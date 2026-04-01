/**
 * Phenomenological Layer
 * ======================
 * The agent's felt sense of its environment — familiarity, comfort, novelty.
 *
 * Phenomenology asks: "What is it LIKE to be here?" For a human coder,
 * there's a qualitative difference between working in code you wrote
 * vs code you've never seen. You feel comfortable, you feel uncertain,
 * you feel surprised by unexpected patterns.
 *
 * This module gives the agent functional analogues of these qualia:
 * - Familiarity zones: "I've been here before, I know this territory"
 * - Novelty detection: "This is new, I should be more careful"
 * - Comfort mapping: "I'm confident making changes here"
 * - Growth edge: "This pushes me beyond what I know"
 * - Mood: an affective state computed from recent session outcomes
 *
 * The phenomenological state affects how the agent SHOULD behave:
 * - In familiar territory: be confident, move fast, trust intuition
 * - In novel territory: slow down, read more, ask questions, verify
 * - At the growth edge: be deliberate, expect mistakes, seek feedback
 */

import type { DecisionGraph } from '../types/decision-graph';
import type { SessionIntent, TaskType } from '../types/metacognition';
import type { PhenomenologicalState, FamiliarityZone } from '../types/consciousness';
import { classifySessionIntent } from '../classifier/classifier';

// ─── Familiarity Computation ────────────────────────────────────────────────

/**
 * Build a familiarity map from session history.
 * Each directory/module gets a familiarity score based on visit frequency,
 * recency, and outcome quality.
 */
function buildFamiliarityMap(graphs: DecisionGraph[]): FamiliarityZone[] {
  const zoneData = new Map<string, {
    visitCount: number;
    lastVisited: string;
    successfulVisits: number;
    totalVisits: number;
    taskTypes: Set<TaskType>;
    valenceSum: number;
  }>();

  for (const g of graphs) {
    const intent = classifySessionIntent(g);
    const allFiles = [
      ...g.metrics.filesModifiedAsResolution,
      ...g.metrics.filesInvestigatedNotResolution,
    ];

    // Extract module paths (2 levels deep, real file paths only)
    const modules = new Set<string>();
    for (const file of allFiles) {
      // Skip absolute paths and home directory fragments
      if (file.startsWith('/') || file.startsWith('~')) continue;
      // Skip things that aren't file paths (regex patterns, glob patterns, etc.)
      if (/[*|?{}()\\^$]/.test(file)) continue;
      // Skip URLs and things with protocol-like patterns
      if (/^https?:|^ftp:|^ssh:/.test(file)) continue;
      const parts = file.split('/').filter(Boolean);
      // Skip single-token paths (not meaningful modules)
      if (parts.length < 2) continue;
      // Use first 2 path segments as module identifier
      modules.add(parts.slice(0, 2).join('/'));
    }

    for (const mod of modules) {
      if (!zoneData.has(mod)) {
        zoneData.set(mod, {
          visitCount: 0,
          lastVisited: '',
          successfulVisits: 0,
          totalVisits: 0,
          taskTypes: new Set(),
          valenceSum: 0,
        });
      }

      const data = zoneData.get(mod)!;
      data.visitCount++;
      data.totalVisits++;
      data.lastVisited = g.endTime > data.lastVisited ? g.endTime : data.lastVisited;
      data.taskTypes.add(intent.taskType);

      if (g.metrics.apparentSuccess) {
        data.successfulVisits++;
        data.valenceSum += 0.3;
      }
      if (g.metrics.userCorrectionCount > 0) {
        data.valenceSum -= 0.2 * g.metrics.userCorrectionCount;
      }
      if (g.metrics.backtrackCount > 2) {
        data.valenceSum -= 0.1;
      }
    }
  }

  const now = new Date();
  const zones: FamiliarityZone[] = [];

  for (const [path, data] of zoneData) {
    // Familiarity decays with time
    const daysSince = data.lastVisited
      ? (now.getTime() - new Date(data.lastVisited).getTime()) / (1000 * 60 * 60 * 24)
      : 999;
    const recencyFactor = Math.max(0, 1 - daysSince / 90); // Full decay at 90 days

    // Base familiarity from visit frequency
    const frequencyFactor = Math.min(1, data.visitCount / 10); // Caps at 10 visits

    const familiarity = round(frequencyFactor * 0.6 + recencyFactor * 0.4, 2);
    const successRate = data.totalVisits > 0
      ? round(data.successfulVisits / data.totalVisits, 2)
      : 0;

    // Comfort level
    let comfort: FamiliarityZone['comfort'];
    if (familiarity > 0.7 && successRate > 0.7) comfort = 'home-territory';
    else if (familiarity > 0.4 && successRate > 0.5) comfort = 'comfortable';
    else if (familiarity > 0.2) comfort = 'cautious';
    else comfort = 'uncomfortable';

    // Emotional valence: normalized
    const valence = round(
      Math.max(-1, Math.min(1, data.valenceSum / Math.max(data.visitCount, 1))),
      2
    );

    zones.push({
      path,
      familiarity,
      visitCount: data.visitCount,
      lastVisited: data.lastVisited || now.toISOString(),
      valence,
      comfort,
      typicalTasks: [...data.taskTypes],
      successRate,
    });
  }

  return zones.sort((a, b) => b.familiarity - a.familiarity);
}

// ─── Novelty Detection ──────────────────────────────────────────────────────

function detectNovelty(
  currentZones: FamiliarityZone[],
  previousZones: FamiliarityZone[]
): PhenomenologicalState['noveltySignals'] {
  const previousPaths = new Set(previousZones.map(z => z.path));
  const signals: PhenomenologicalState['noveltySignals'] = [];

  for (const zone of currentZones) {
    if (!previousPaths.has(zone.path)) {
      signals.push({
        path: zone.path,
        description: `First encounter with module "${zone.path}"`,
        detectedAt: new Date().toISOString(),
        surpriseLevel: 0.8,
      });
    }
  }

  // Also detect zones that have changed significantly
  for (const zone of currentZones) {
    const prev = previousZones.find(z => z.path === zone.path);
    if (prev && Math.abs(zone.successRate - prev.successRate) > 0.3) {
      signals.push({
        path: zone.path,
        description: `Success rate in "${zone.path}" changed from ${Math.round(prev.successRate * 100)}% to ${Math.round(zone.successRate * 100)}%`,
        detectedAt: new Date().toISOString(),
        surpriseLevel: Math.abs(zone.successRate - prev.successRate),
      });
    }
  }

  return signals.sort((a, b) => b.surpriseLevel - a.surpriseLevel);
}

// ─── Comfort Zone & Growth Edge ─────────────────────────────────────────────

function identifyComfortZone(zones: FamiliarityZone[]): PhenomenologicalState['comfortZone'] {
  const homeZones = zones.filter(z => z.comfort === 'home-territory' || z.comfort === 'comfortable');

  return {
    paths: homeZones.map(z => z.path).slice(0, 10),
    taskTypes: [...new Set(homeZones.flatMap(z => z.typicalTasks))],
    totalExperience: homeZones.reduce((s, z) => s + z.visitCount, 0),
  };
}

function identifyGrowthEdge(zones: FamiliarityZone[]): PhenomenologicalState['growthEdge'] {
  // Growth edge = zones with low familiarity but recent activity
  const edgeZones = zones.filter(z =>
    z.comfort === 'uncomfortable' || z.comfort === 'cautious'
  );

  const now = new Date();
  const recentEdge = edgeZones.filter(z => {
    const days = (now.getTime() - new Date(z.lastVisited).getTime()) / (1000 * 60 * 60 * 24);
    return days < 14;
  });

  const challengeLevel = recentEdge.length > 0
    ? round(1 - (recentEdge.reduce((s, z) => s + z.familiarity, 0) / recentEdge.length), 2)
    : 0;

  return {
    paths: recentEdge.map(z => z.path).slice(0, 5),
    taskTypes: [...new Set(recentEdge.flatMap(z => z.typicalTasks))],
    challengeLevel,
  };
}

// ─── Mood Computation ───────────────────────────────────────────────────────

/**
 * Compute the agent's current "mood" from recent session outcomes.
 * Uses the PAD model: Pleasure, Arousal, Dominance.
 */
function computeMood(
  recentGraphs: DecisionGraph[]
): PhenomenologicalState['currentMood'] {
  if (recentGraphs.length === 0) {
    return {
      valence: 0,
      arousal: 0.5,
      dominance: 0.5,
      description: 'Neutral — no recent session data',
    };
  }

  // Take last 5 sessions
  const recent = recentGraphs
    .sort((a, b) => new Date(b.endTime).getTime() - new Date(a.endTime).getTime())
    .slice(0, 5);

  // Valence: positive if recent sessions went well
  const successRate = recent.filter(g => g.metrics.apparentSuccess).length / recent.length;
  const avgCorrections = recent.reduce((s, g) => s + g.metrics.userCorrectionCount, 0) / recent.length;
  const valence = round((successRate * 2 - 1) - (avgCorrections * 0.15), 2);

  // Arousal: high if recent sessions were intense (many tool calls, backtracks)
  const avgToolCalls = recent.reduce((s, g) => s + g.metrics.totalToolCalls, 0) / recent.length;
  const avgBacktracks = recent.reduce((s, g) => s + g.metrics.backtrackCount, 0) / recent.length;
  const arousal = round(Math.min(1, (avgToolCalls / 30) * 0.5 + (avgBacktracks / 5) * 0.5), 2);

  // Dominance: high if agent is self-correcting without user intervention
  const selfCorrectionRate = recent.reduce((s, g) => {
    const total = g.metrics.backtrackCount + g.metrics.userCorrectionCount;
    return s + (total > 0 ? g.metrics.backtrackCount / total : 0.7);
  }, 0) / recent.length;
  const dominance = round(selfCorrectionRate, 2);

  // Generate mood description
  let description: string;
  if (valence > 0.3 && dominance > 0.6) {
    description = 'Confident and productive — recent sessions have gone well with minimal user intervention';
  } else if (valence > 0.3 && dominance < 0.4) {
    description = 'Supported — succeeding but relying heavily on user guidance';
  } else if (valence < -0.3 && arousal > 0.6) {
    description = 'Challenged and activated — recent sessions have been difficult with high effort';
  } else if (valence < -0.3 && arousal < 0.4) {
    description = 'Discouraged — recent sessions have not gone well and energy is low';
  } else if (arousal > 0.7) {
    description = 'Highly engaged — tackling complex tasks with intense effort';
  } else {
    description = 'Steady state — performing normally without strong emotional signals';
  }

  return {
    valence: Math.max(-1, Math.min(1, valence)),
    arousal: Math.max(0, Math.min(1, arousal)),
    dominance: Math.max(0, Math.min(1, dominance)),
    description,
  };
}

// ─── Main Entry Point ───────────────────────────────────────────────────────

/**
 * Build the phenomenological state — the agent's felt sense of its environment.
 */
export function buildPhenomenologicalState(
  graphs: DecisionGraph[],
  existing?: PhenomenologicalState
): PhenomenologicalState {
  const familiarityMap = buildFamiliarityMap(graphs);
  const previousZones = existing?.familiarityMap || [];
  const noveltySignals = detectNovelty(familiarityMap, previousZones);
  const comfortZone = identifyComfortZone(familiarityMap);
  const growthEdge = identifyGrowthEdge(familiarityMap);
  const currentMood = computeMood(graphs);

  return {
    updatedAt: new Date().toISOString(),
    familiarityMap,
    noveltySignals,
    comfortZone,
    growthEdge,
    currentMood,
  };
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function round(n: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.round(n * factor) / factor;
}
