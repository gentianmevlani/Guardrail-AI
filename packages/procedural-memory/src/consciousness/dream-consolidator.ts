/**
 * Dream Consolidator
 * ==================
 * Offline memory consolidation — the "sleep" between sessions.
 *
 * During human sleep, the brain replays the day's events, strengthens
 * important connections, prunes weak ones, and sometimes makes novel
 * connections that lead to "aha!" moments upon waking.
 *
 * This module does the same for the strategy index:
 * - Merges near-duplicate strategies (they're really the same insight)
 * - Prunes stale/contradicted strategies (they've decayed or been disproven)
 * - Strengthens strategies with fresh evidence
 * - Discovers novel cross-pattern connections ("dreaming")
 * - Generates emergent hypotheses from pattern recombination
 * - Reports on memory health
 */

import type { Strategy, StrategyIndex, AntiPattern } from '../types/decision-graph';
import type { DreamConsolidation, DreamFragment } from '../types/consciousness';

// ─── Strategy Similarity ────────────────────────────────────────────────────

/**
 * Compute similarity between two strategies based on trigger overlap.
 */
function strategySimilarity(a: Strategy, b: Strategy): number {
  // File pattern overlap
  const filesA = new Set(a.triggerPattern.filePatterns.map(f => f.toLowerCase()));
  const filesB = new Set(b.triggerPattern.filePatterns.map(f => f.toLowerCase()));
  const fileOverlap = [...filesA].filter(f => filesB.has(f)).length;
  const fileUnion = new Set([...filesA, ...filesB]).size;
  const fileJaccard = fileUnion > 0 ? fileOverlap / fileUnion : 0;

  // Module area overlap
  const modsA = new Set(a.triggerPattern.moduleAreas.map(m => m.toLowerCase()));
  const modsB = new Set(b.triggerPattern.moduleAreas.map(m => m.toLowerCase()));
  const modOverlap = [...modsA].filter(m => modsB.has(m)).length;
  const modUnion = new Set([...modsA, ...modsB]).size;
  const modJaccard = modUnion > 0 ? modOverlap / modUnion : 0;

  // Keyword overlap
  const kwA = new Set(a.triggerPattern.promptKeywords);
  const kwB = new Set(b.triggerPattern.promptKeywords);
  const kwOverlap = [...kwA].filter(k => kwB.has(k)).length;
  const kwUnion = new Set([...kwA, ...kwB]).size;
  const kwJaccard = kwUnion > 0 ? kwOverlap / kwUnion : 0;

  // Tag overlap
  const tagsA = new Set(a.tags);
  const tagsB = new Set(b.tags);
  const tagOverlap = [...tagsA].filter(t => tagsB.has(t)).length;
  const tagUnion = new Set([...tagsA, ...tagsB]).size;
  const tagJaccard = tagUnion > 0 ? tagOverlap / tagUnion : 0;

  return fileJaccard * 0.35 + modJaccard * 0.3 + kwJaccard * 0.2 + tagJaccard * 0.15;
}

// ─── Merge Detection ────────────────────────────────────────────────────────

function findMergeCandidates(
  strategies: Strategy[],
  threshold: number = 0.6
): Array<{ kept: Strategy; absorbed: Strategy[] }> {
  const merged = new Set<string>();
  const groups: Array<{ kept: Strategy; absorbed: Strategy[] }> = [];

  // Sort by confidence (keep highest confidence version)
  const sorted = [...strategies].sort((a, b) => b.confidence - a.confidence);

  for (const strategy of sorted) {
    if (merged.has(strategy.id)) continue;

    const similar: Strategy[] = [];

    for (const other of sorted) {
      if (other.id === strategy.id || merged.has(other.id)) continue;
      const sim = strategySimilarity(strategy, other);
      if (sim >= threshold) {
        similar.push(other);
        merged.add(other.id);
      }
    }

    if (similar.length > 0) {
      groups.push({ kept: strategy, absorbed: similar });
    }
  }

  return groups;
}

// ─── Prune Detection ────────────────────────────────────────────────────────

function findPruneCandidates(
  strategies: Strategy[],
  now: Date
): Array<{ strategy: Strategy; reason: string }> {
  const candidates: Array<{ strategy: Strategy; reason: string }> = [];

  for (const s of strategies) {
    // Stale: not validated in a long time with decayed confidence
    const daysSinceValidation = (now.getTime() - new Date(s.lastValidated).getTime()) / (1000 * 60 * 60 * 24);

    if (s.confidence < 0.2) {
      candidates.push({
        strategy: s,
        reason: `Confidence decayed to ${Math.round(s.confidence * 100)}% — below viability threshold`,
      });
      continue;
    }

    if (daysSinceValidation > 90 && s.confidence < 0.4) {
      candidates.push({
        strategy: s,
        reason: `Not validated in ${Math.round(daysSinceValidation)} days and confidence is ${Math.round(s.confidence * 100)}%`,
      });
      continue;
    }

    // Contradicted: injected many times but rarely succeeded
    if (s.injectionCount >= 5 && s.successCount / s.injectionCount < 0.2) {
      candidates.push({
        strategy: s,
        reason: `Low success rate: ${s.successCount}/${s.injectionCount} (${Math.round(s.successCount / s.injectionCount * 100)}%) after significant use`,
      });
    }
  }

  return candidates;
}

// ─── Strengthening ──────────────────────────────────────────────────────────

function findStrengthenCandidates(
  strategies: Strategy[],
  now: Date
): Array<{ strategy: Strategy; newConfidence: number; reason: string }> {
  const candidates: Array<{ strategy: Strategy; newConfidence: number; reason: string }> = [];

  for (const s of strategies) {
    // Recently validated with good success rate
    const daysSinceValidation = (now.getTime() - new Date(s.lastValidated).getTime()) / (1000 * 60 * 60 * 24);

    if (daysSinceValidation < 7 && s.injectionCount > 0 && s.successCount / s.injectionCount > 0.6) {
      const boost = Math.min(0.95, s.confidence + 0.05);
      if (boost > s.confidence) {
        candidates.push({
          strategy: s,
          newConfidence: boost,
          reason: `Recently validated with ${Math.round(s.successCount / s.injectionCount * 100)}% success rate`,
        });
      }
    }

    // Many supporting evidence sessions
    if (s.supportingEvidence.length >= 5 && s.confidence < 0.9) {
      const boost = Math.min(0.9, s.confidence + s.supportingEvidence.length * 0.01);
      if (boost > s.confidence) {
        candidates.push({
          strategy: s,
          newConfidence: boost,
          reason: `Strong evidence base: ${s.supportingEvidence.length} supporting sessions`,
        });
      }
    }
  }

  return candidates;
}

// ─── Dream Fragments (Novel Connections) ────────────────────────────────────

function generateDreamFragments(
  strategies: Strategy[],
  antiPatterns: AntiPattern[]
): DreamFragment[] {
  const fragments: DreamFragment[] = [];

  // Look for strategies that share module areas but have different trigger patterns
  // These might be different aspects of the same underlying issue
  for (let i = 0; i < strategies.length; i++) {
    for (let j = i + 1; j < strategies.length; j++) {
      const a = strategies[i];
      const b = strategies[j];

      // Check module overlap but different tags (different perspectives on same area)
      const moduleOverlap = a.triggerPattern.moduleAreas.some(ma =>
        b.triggerPattern.moduleAreas.some(mb =>
          ma.toLowerCase() === mb.toLowerCase()
        )
      );
      const differentTags = !a.tags.some(ta => b.tags.includes(ta));

      if (moduleOverlap && differentTags) {
        fragments.push({
          connectionA: `[${a.tags.join(',')}] ${a.content.split('\n')[0].slice(0, 80)}`,
          connectionB: `[${b.tags.join(',')}] ${b.content.split('\n')[0].slice(0, 80)}`,
          insight: `These two strategies target the same module area from different angles. They might be symptoms of a deeper architectural issue in ${a.triggerPattern.moduleAreas[0]}.`,
          novelty: 0.6,
          utility: 0.5,
          sourceSessions: [
            ...a.supportingEvidence.map(e => e.sessionId).slice(0, 2),
            ...b.supportingEvidence.map(e => e.sessionId).slice(0, 2),
          ],
        });
      }
    }
  }

  // Look for anti-patterns that share incorrect files with strategy trigger patterns
  for (const ap of antiPatterns) {
    for (const s of strategies) {
      if (s.tags.includes('anti-pattern')) continue; // Already linked

      const incorrectFiles = ap.incorrectApproach.match(/[\w./]+\.\w+/g) || [];
      const strategyFiles = s.triggerPattern.filePatterns;

      const overlap = incorrectFiles.some(f =>
        strategyFiles.some(sf => sf.includes(f) || f.includes(sf))
      );

      if (overlap) {
        fragments.push({
          connectionA: `Anti-pattern: ${ap.triggerDescription.slice(0, 80)}`,
          connectionB: `Strategy: ${s.content.split('\n')[0].slice(0, 80)}`,
          insight: `This anti-pattern's false lead overlaps with a convergence strategy's trigger files. The strategy might be partially reinforcing the anti-pattern by drawing attention to those files.`,
          novelty: 0.8,
          utility: 0.7,
          sourceSessions: ap.occurrences.map(o => o.sessionId).slice(0, 3),
        });
      }
    }
  }

  return fragments
    .sort((a, b) => (b.novelty * b.utility) - (a.novelty * a.utility))
    .slice(0, 10);
}

// ─── Emergent Hypotheses ────────────────────────────────────────────────────

function generateEmergentHypotheses(
  strategies: Strategy[],
  fragments: DreamFragment[]
): DreamConsolidation['emergentHypotheses'] {
  const hypotheses: DreamConsolidation['emergentHypotheses'] = [];

  // From high-novelty dream fragments, generate hypotheses
  for (const fragment of fragments.filter(f => f.novelty > 0.5)) {
    hypotheses.push({
      hypothesis: fragment.insight,
      confidence: fragment.novelty * fragment.utility * 0.5,
      basedOn: fragment.sourceSessions,
    });
  }

  // Look for recurring module areas across many strategies
  const moduleFreq = new Map<string, number>();
  for (const s of strategies) {
    for (const mod of s.triggerPattern.moduleAreas) {
      moduleFreq.set(mod, (moduleFreq.get(mod) || 0) + 1);
    }
  }

  const hotspots = [...moduleFreq.entries()]
    .filter(([, count]) => count >= 3)
    .sort((a, b) => b[1] - a[1]);

  for (const [mod, count] of hotspots.slice(0, 3)) {
    hypotheses.push({
      hypothesis: `Module "${mod}" appears in ${count} strategies — this may be an architectural hotspot that would benefit from refactoring or better documentation`,
      confidence: Math.min(0.7, count * 0.1),
      basedOn: strategies
        .filter(s => s.triggerPattern.moduleAreas.includes(mod))
        .flatMap(s => s.supportingEvidence.map(e => e.sessionId))
        .slice(0, 5),
    });
  }

  return hypotheses.slice(0, 5);
}

// ─── Memory Health Assessment ───────────────────────────────────────────────

function assessMemoryHealth(
  index: StrategyIndex,
  pruneCandidates: number,
  mergeCandidates: number,
  now: Date
): DreamConsolidation['health'] {
  const stale = index.strategies.filter(s => {
    const days = (now.getTime() - new Date(s.lastValidated).getTime()) / (1000 * 60 * 60 * 24);
    return days > 30;
  }).length;

  // Contradictions: strategies with overlapping triggers but different advice
  let contradictions = 0;
  for (let i = 0; i < index.strategies.length; i++) {
    for (let j = i + 1; j < index.strategies.length; j++) {
      const sim = strategySimilarity(index.strategies[i], index.strategies[j]);
      if (sim > 0.4 && sim < 0.6) {
        // Similar but not identical — might be contradictory
        contradictions++;
      }
    }
  }

  // Coverage gaps: module areas that appear in anti-patterns but have no strategies
  const coveredAreas = new Set(
    index.strategies.flatMap(s => s.triggerPattern.moduleAreas)
  );
  const problemAreas = new Set(
    index.antiPatterns.flatMap(ap => {
      const areas = ap.incorrectApproach.match(/(?:src|lib|app|components|services|utils|middleware|routes|api)\/[\w-]+/g);
      return areas || [];
    })
  );
  const gaps = [...problemAreas].filter(area => !coveredAreas.has(area));

  return {
    totalStrategies: index.strategies.length,
    activeStrategies: index.strategies.filter(s => s.confidence >= 0.3).length,
    staleStrategies: stale,
    contradictions,
    redundancies: mergeCandidates,
    coverageGaps: gaps,
  };
}

// ─── Main Entry Point ───────────────────────────────────────────────────────

/**
 * Run a dream consolidation cycle on the strategy index.
 * This is the "sleep" that strengthens memories.
 *
 * Returns the consolidation results and a MODIFIED strategy index.
 */
export function consolidate(
  index: StrategyIndex
): { dream: DreamConsolidation; updatedIndex: StrategyIndex } {
  const now = new Date();
  const strategies = [...index.strategies];

  // Phase 1: Find merge candidates
  const mergeGroups = findMergeCandidates(strategies);
  const mergedStrategies: DreamConsolidation['mergedStrategies'] = mergeGroups.map(g => ({
    keptId: g.kept.id,
    absorbedIds: g.absorbed.map(a => a.id),
    reason: `${g.absorbed.length} near-duplicate strategies merged (similarity > 60%)`,
  }));

  // Apply merges: absorb evidence into kept strategy
  const absorbedIds = new Set(mergeGroups.flatMap(g => g.absorbed.map(a => a.id)));
  for (const group of mergeGroups) {
    const kept = strategies.find(s => s.id === group.kept.id);
    if (kept) {
      for (const absorbed of group.absorbed) {
        kept.supportingEvidence.push(...absorbed.supportingEvidence);
        kept.confidence = Math.min(0.95, kept.confidence + 0.03);
        kept.injectionCount += absorbed.injectionCount;
        kept.successCount += absorbed.successCount;
      }
    }
  }

  // Phase 2: Find prune candidates
  const pruneCandidates = findPruneCandidates(strategies, now);
  const prunedIds = new Set(pruneCandidates.map(p => p.strategy.id));
  const prunedStrategies: DreamConsolidation['prunedStrategies'] = pruneCandidates.map(p => ({
    strategyId: p.strategy.id,
    reason: p.reason,
  }));

  // Phase 3: Find strengthen candidates
  const strengthenCandidates = findStrengthenCandidates(strategies, now);
  const strengthenedStrategies: DreamConsolidation['strengthenedStrategies'] = strengthenCandidates.map(c => ({
    strategyId: c.strategy.id,
    oldConfidence: c.strategy.confidence,
    newConfidence: c.newConfidence,
    reason: c.reason,
  }));

  // Apply strengthening
  for (const c of strengthenCandidates) {
    const s = strategies.find(st => st.id === c.strategy.id);
    if (s) s.confidence = c.newConfidence;
  }

  // Phase 4: Dream — find novel connections
  const dreamFragments = generateDreamFragments(
    strategies.filter(s => !absorbedIds.has(s.id) && !prunedIds.has(s.id)),
    index.antiPatterns
  );

  // Phase 5: Generate emergent hypotheses
  const emergentHypotheses = generateEmergentHypotheses(strategies, dreamFragments);

  // Phase 6: Assess memory health
  const health = assessMemoryHealth(index, pruneCandidates.length, mergeGroups.length, now);

  // Build updated index (remove pruned and absorbed)
  const removedIds = new Set([...absorbedIds, ...prunedIds]);
  const updatedStrategies = strategies
    .filter(s => !removedIds.has(s.id))
    .sort((a, b) => b.confidence - a.confidence);

  const dream: DreamConsolidation = {
    performedAt: now.toISOString(),
    sessionsProcessed: index.sessionsAnalyzed,
    mergedStrategies,
    prunedStrategies,
    strengthenedStrategies,
    dreamFragments,
    emergentHypotheses,
    health,
  };

  const updatedIndex: StrategyIndex = {
    ...index,
    strategies: updatedStrategies,
    lastConsolidated: now.toISOString(),
  };

  return { dream, updatedIndex };
}
