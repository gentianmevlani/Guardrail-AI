/**
 * Strategy Extractor
 * ==================
 * Takes N DecisionGraphs and extracts procedural heuristics.
 *
 * Two extraction modes:
 * 1. Heuristic extraction — fast, regex/stats-based, no API calls
 * 2. LLM-powered extraction — uses Claude to find deeper patterns
 *
 * The heuristic mode runs first and catches the obvious patterns.
 * LLM mode runs on top for nuanced cross-session pattern detection.
 */

import {
  type DecisionGraph,
  type DecisionNode,
  type Strategy,
  type AntiPattern,
  type OptimalPath,
  type StrategyIndex,
  type StrategyScope,
} from '../types/decision-graph';

// ─── Heuristic Pattern Extraction (no LLM needed) ───────────────────────────

/**
 * Extract anti-patterns: sequences where the agent took a wrong path,
 * got corrected (by user or self), and then found the right answer.
 */
export function extractAntiPatterns(graphs: DecisionGraph[]): AntiPattern[] {
  const patternMap = new Map<string, {
    incorrectFiles: string[];
    correctFiles: string[];
    occurrences: Array<{
      sessionId: string;
      wastedSteps: number;
      correctionSource: 'user' | 'self' | 'test_failure';
    }>;
  }>();

  for (const graph of graphs) {
    const { nodes, edges } = graph;

    // Find correction/backtrack nodes
    for (let i = 0; i < nodes.length; i++) {
      const node = nodes[i];
      if (node.type !== 'correction' && node.type !== 'backtrack') continue;

      // Look backwards: what files was the agent working on before the correction?
      const beforeCorrection: DecisionNode[] = [];
      for (let j = i - 1; j >= 0 && j >= i - 5; j--) {
        if (nodes[j].type === 'user_request' || nodes[j].type === 'correction') break;
        beforeCorrection.push(nodes[j]);
      }

      // Look forwards: what files were part of the resolution?
      const afterCorrection: DecisionNode[] = [];
      for (let j = i + 1; j < nodes.length && j <= i + 10; j++) {
        afterCorrection.push(nodes[j]);
      }

      const incorrectFiles = [...new Set(beforeCorrection.flatMap(n => n.filesTouched).map(normalizePath).filter(isUsefulPath))];
      const correctFiles = [...new Set(afterCorrection.flatMap(n => n.filesTouched).map(normalizePath).filter(isUsefulPath))];

      if (incorrectFiles.length === 0 && correctFiles.length === 0) continue;

      // Create a fingerprint for this pattern
      const fingerprint = `${incorrectFiles.sort().join(',')}→${correctFiles.sort().join(',')}`;

      if (!patternMap.has(fingerprint)) {
        patternMap.set(fingerprint, {
          incorrectFiles,
          correctFiles,
          occurrences: [],
        });
      }

      // Count wasted steps (actions between start of wrong path and correction)
      const wastedSteps = beforeCorrection.filter(n => n.type === 'action').length;

      patternMap.get(fingerprint)!.occurrences.push({
        sessionId: graph.sessionId,
        wastedSteps,
        correctionSource: node.type === 'correction' ? 'user' : 'self',
      });
    }
  }

  // Only keep patterns that occurred more than once
  const antiPatterns: AntiPattern[] = [];
  let apIndex = 0;

  for (const [, data] of patternMap) {
    if (data.occurrences.length < 2) continue;

    const avgWasted = data.occurrences.reduce((sum, o) => sum + o.wastedSteps, 0) / data.occurrences.length;

    antiPatterns.push({
      id: `ap_${apIndex++}`,
      triggerDescription: `Files investigated: ${data.incorrectFiles.join(', ')}`,
      incorrectApproach: `Agent investigated ${data.incorrectFiles.join(', ')} but resolution was elsewhere`,
      correctApproach: `Resolution files were: ${data.correctFiles.join(', ')}`,
      avgWastedSteps: Math.round(avgWasted * 10) / 10,
      occurrences: data.occurrences,
    });
  }

  return antiPatterns.sort((a, b) => b.occurrences.length - a.occurrences.length);
}

/**
 * Extract module-level convergence patterns:
 * "When working in directory X, the agent always ends up touching files Y and Z"
 */
export function extractConvergencePatterns(
  graphs: DecisionGraph[]
): Array<{ module: string; frequentFiles: Array<{ file: string; frequency: number }>; sessionCount: number }> {
  // Group sessions by which directories they touch
  const moduleSessionMap = new Map<string, Map<string, number>>();

  for (const graph of graphs) {
    const allFiles = [
      ...graph.metrics.filesModifiedAsResolution,
      ...graph.metrics.filesInvestigatedNotResolution,
    ].map(normalizePath).filter(isUsefulPath);

    // Extract directory modules (2 levels deep)
    const modules = new Set<string>();
    for (const file of allFiles) {
      const parts = file.split('/').filter(Boolean);
      if (parts.length >= 2) {
        modules.add(parts.slice(0, 2).join('/'));
      }
    }

    for (const mod of modules) {
      if (!moduleSessionMap.has(mod)) {
        moduleSessionMap.set(mod, new Map());
      }
      const fileMap = moduleSessionMap.get(mod)!;

      // Track which files were touched in this module area
      const moduleFiles = allFiles.filter(f => f.includes(mod));
      for (const file of moduleFiles) {
        fileMap.set(file, (fileMap.get(file) || 0) + 1);
      }
    }
  }

  const patterns: Array<{
    module: string;
    frequentFiles: Array<{ file: string; frequency: number }>;
    sessionCount: number;
  }> = [];

  for (const [module, fileMap] of moduleSessionMap) {
    // Skip modules that are user home dirs or noise
    if (/^Users\/|^home\/|^private\/|^tmp\//.test(module)) continue;
    const totalSessions = Math.max(...fileMap.values());
    if (totalSessions < 2) continue;

    const frequentFiles = [...fileMap.entries()]
      .map(([file, count]) => ({ file, frequency: count / totalSessions }))
      .filter(f => f.frequency >= 0.5) // File appears in 50%+ of sessions in this module
      .sort((a, b) => b.frequency - a.frequency);

    if (frequentFiles.length > 0) {
      patterns.push({ module, frequentFiles, sessionCount: totalSessions });
    }
  }

  return patterns;
}

/**
 * Reconstruct optimal paths: for each session, what's the minimum
 * number of steps if the agent knew the answer from the start?
 */
export function extractOptimalPaths(graphs: DecisionGraph[]): OptimalPath[] {
  return graphs
    .filter(g => g.metrics.totalToolCalls > 5) // Only analyze sessions with meaningful work
    .map(graph => {
      const { nodes, metrics } = graph;

      // Count "productive" actions: those touching files that ended up in resolution
      const productiveActions = nodes.filter(n =>
        n.type === 'action' &&
        n.filesTouched.some(f => metrics.filesModifiedAsResolution.includes(f))
      ).length;

      // Optimal path ≈ productive actions + 1 (for the initial read/investigation)
      const optimalSteps = Math.max(productiveActions, 1) + 1;
      const actualSteps = metrics.totalToolCalls;
      const efficiency = actualSteps > 0 ? optimalSteps / actualSteps : 1;

      // Find the "wrong turn" — first action that touches a false-lead file
      const wrongTurnNode = nodes.find(n =>
        n.type === 'action' &&
        n.filesTouched.some(f => metrics.filesInvestigatedNotResolution.includes(f)) &&
        !n.filesTouched.some(f => metrics.filesModifiedAsResolution.includes(f))
      );

      const keyInsight = wrongTurnNode
        ? `Agent investigated ${wrongTurnNode.filesTouched.join(', ')} but resolution was in ${metrics.filesModifiedAsResolution.join(', ')}`
        : `Session was relatively efficient`;

      return {
        sessionId: graph.sessionId,
        actualSteps,
        optimalSteps,
        efficiency: Math.round(efficiency * 100) / 100,
        keyInsight,
        wrongTurnNodeId: wrongTurnNode?.id,
        correctAlternative: `Should have gone directly to ${metrics.filesModifiedAsResolution.join(', ')}`,
      };
    })
    .filter(p => p.efficiency < 0.7); // Only keep sessions where significant waste occurred
}

/**
 * Convert anti-patterns and convergence patterns into actionable strategies.
 */
export function synthesizeStrategies(
  antiPatterns: AntiPattern[],
  convergencePatterns: ReturnType<typeof extractConvergencePatterns>,
  graphs: DecisionGraph[]
): Strategy[] {
  const strategies: Strategy[] = [];
  let stratIndex = 0;
  const now = new Date().toISOString();

  // Strategy from anti-patterns
  for (const ap of antiPatterns) {
    const confidence = Math.min(0.95, 0.5 + (ap.occurrences.length * 0.1));

    strategies.push({
      id: `strat_${stratIndex++}`,
      triggerPattern: {
        filePatterns: [...new Set([...ap.incorrectApproach.match(/[\w./]+\.\w+/g) || []])],
        errorPatterns: [],
        moduleAreas: extractModuleAreas(ap.incorrectApproach),
        promptKeywords: extractKeywords(ap.triggerDescription),
      },
      content: [
        `⚠️ Known anti-pattern (${ap.occurrences.length} occurrences, avg ${ap.avgWastedSteps} wasted steps):`,
        `When investigating: ${ap.incorrectApproach}`,
        `Resolution is typically: ${ap.correctApproach}`,
        `Check the resolution files first to save ~${Math.round(ap.avgWastedSteps)} steps.`,
      ].join('\n'),
      scope: 'project' as StrategyScope,
      confidence,
      supportingEvidence: ap.occurrences.map(o => ({
        sessionId: o.sessionId,
        timestamp: now,
        outcome: 'confirmed' as const,
        summary: `Wasted ${o.wastedSteps} steps, corrected by ${o.correctionSource}`,
      })),
      createdAt: now,
      lastValidated: now,
      decayRatePerDay: 0.002, // ~5% per month
      injectionCount: 0,
      successCount: 0,
      tags: ['anti-pattern', 'auto-extracted'],
    });
  }

  // Strategy from convergence patterns
  for (const cp of convergencePatterns) {
    const topFiles = cp.frequentFiles.slice(0, 5);
    // Skip single-file checkpoints — they're trivially obvious
    if (topFiles.length < 2) continue;
    const confidence = Math.min(0.9, 0.4 + (cp.sessionCount * 0.05));

    // Find actual sessions that touched this module for evidence
    const moduleSessions = graphs.filter(g => {
      const files = [...g.metrics.filesModifiedAsResolution, ...g.metrics.filesInvestigatedNotResolution]
        .map(normalizePath);
      return files.some(f => f.includes(cp.module));
    });

    strategies.push({
      id: `strat_${stratIndex++}`,
      triggerPattern: {
        filePatterns: topFiles.map(f => f.file),
        errorPatterns: [],
        moduleAreas: [cp.module],
        promptKeywords: cp.module.split('/').filter(p => p.length > 2),
      },
      content: [
        `📋 Module checkpoint for ${cp.module} (based on ${cp.sessionCount} sessions):`,
        `When entering this module, preload context on:`,
        ...topFiles.map(f => `  - ${f.file} (touched in ${Math.round(f.frequency * 100)}% of sessions)`),
      ].join('\n'),
      scope: 'project' as StrategyScope,
      confidence,
      supportingEvidence: moduleSessions.slice(0, 5).map(g => ({
        sessionId: g.sessionId,
        timestamp: g.startTime,
        outcome: 'confirmed' as const,
        summary: `Session touched ${cp.module} module`,
      })),
      createdAt: now,
      lastValidated: now,
      decayRatePerDay: 0.002,
      injectionCount: 0,
      successCount: 0,
      tags: ['convergence', 'module-checkpoint', 'auto-extracted'],
    });
  }

  return strategies;
}

// ─── Helper Functions ────────────────────────────────────────────────────────

/**
 * Normalize a file path to project-relative form.
 * Strips absolute prefixes, home dirs, and common non-informative prefixes.
 */
function normalizePath(filePath: string): string {
  let p = filePath;
  // Strip common absolute prefixes
  p = p.replace(/^\/Users\/[^/]+\//, '');
  p = p.replace(/^\/home\/[^/]+\//, '');
  p = p.replace(/^\/tmp\/[^/]+\//, '');
  p = p.replace(/^\/private\/var\/[^/]+\//, '');
  p = p.replace(/^~\//, '');
  // Strip Desktop/Documents/Projects prefixes to get to the repo root
  p = p.replace(/^(?:Desktop|Documents|Projects|repos|code)\/[^/]+\//, '');
  // If still absolute, take last 3 segments
  if (p.startsWith('/')) {
    const parts = p.split('/').filter(Boolean);
    p = parts.slice(-3).join('/');
  }
  return p;
}

/** Check if a path is meaningful for strategy content (not noise) */
function isUsefulPath(filePath: string): boolean {
  const p = normalizePath(filePath);
  // Filter out non-path strings (regex, globs with special chars)
  if (/[*|?{}()\\^$]/.test(p)) return false;
  // Filter out build artifacts, lock files, hidden dirs
  if (/\/(node_modules|dist|\.git|\.cache|\.next|\.turbo)\//.test(p)) return false;
  if (/^\./.test(p)) return false;
  // Must have at least one slash (a real path, not a bare filename)
  if (!p.includes('/')) return false;
  // Filter out paths that still look like user home dirs after normalization
  if (/^Users\/|^home\/|^private\//.test(p)) return false;
  // Filter out .claude internal files and plan files
  if (/\.claude\//.test(p)) return false;
  // Must start with a project-like directory (src, packages, lib, app, etc.)
  // or a recognizable code path
  if (!/^(src|lib|app|packages|components|services|utils|middleware|routes|api|tests|scripts|config|public|assets|views|controllers|models|schemas|prisma|drizzle|supabase|docker|\.github|code-extension|vscode-extension)\//i.test(p)) {
    // Allow other paths if they have a recognizable code extension
    if (!/\.(ts|js|tsx|jsx|py|rs|go|java|rb|php|css|scss|html|json|yaml|yml|toml|sql|prisma|graphql|proto)$/.test(p)) {
      return false;
    }
  }
  return true;
}

function extractModuleAreas(text: string): string[] {
  const dirMatches = text.match(/(?:src|lib|app|components|services|utils|middleware|routes|api|packages)\/[\w-]+/g);
  return [...new Set(dirMatches || [])];
}

function extractKeywords(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[\s,./]+/)
    .filter(w => w.length > 3 && !['the', 'and', 'for', 'was', 'were', 'that', 'this', 'with'].includes(w))
    .slice(0, 10);
}

// ─── Build Full Strategy Index ───────────────────────────────────────────────

/**
 * Run the complete extraction pipeline on a set of decision graphs.
 * This is the main entry point.
 */
export function buildStrategyIndex(
  graphs: DecisionGraph[],
  projectName: string,
  existingIndex?: StrategyIndex
): StrategyIndex {
  // Extract patterns
  const antiPatterns = extractAntiPatterns(graphs);
  const convergencePatterns = extractConvergencePatterns(graphs);
  const optimalPaths = extractOptimalPaths(graphs);
  const strategies = synthesizeStrategies(antiPatterns, convergencePatterns, graphs);

  // If existing index, merge strategies (keep existing, add new, update confidence)
  let mergedStrategies = strategies;
  if (existingIndex) {
    mergedStrategies = mergeStrategies(existingIndex.strategies, strategies);
  }

  // Apply confidence decay to all strategies
  const now = new Date();
  for (const s of mergedStrategies) {
    const daysSinceValidation = (now.getTime() - new Date(s.lastValidated).getTime()) / (1000 * 60 * 60 * 24);
    s.confidence = Math.max(0.1, s.confidence - (s.decayRatePerDay * daysSinceValidation));
  }

  return {
    project: projectName,
    lastConsolidated: now.toISOString(),
    sessionsAnalyzed: graphs.length,
    strategies: mergedStrategies.sort((a, b) => b.confidence - a.confidence),
    antiPatterns,
    optimalPaths,
    schemaVersion: 1,
  };
}

/**
 * Merge existing strategies with newly extracted ones.
 * Existing strategies with matching trigger patterns get their confidence reinforced.
 * New strategies that don't match any existing ones are added.
 */
function mergeStrategies(existing: Strategy[], incoming: Strategy[]): Strategy[] {
  const merged = [...existing];

  for (const newStrat of incoming) {
    // Check if this strategy already exists (by overlapping trigger patterns)
    const match = merged.find(e =>
      e.triggerPattern.moduleAreas.some(m =>
        newStrat.triggerPattern.moduleAreas.includes(m)
      ) &&
      e.triggerPattern.filePatterns.some(f =>
        newStrat.triggerPattern.filePatterns.includes(f)
      )
    );

    if (match) {
      // Reinforce existing strategy
      match.confidence = Math.min(0.95, match.confidence + 0.05);
      match.lastValidated = new Date().toISOString();
      match.supportingEvidence.push(...newStrat.supportingEvidence);
    } else {
      // Add as new strategy
      merged.push(newStrat);
    }
  }

  return merged;
}

/**
 * Merge LLM deep-extraction output into an existing heuristic index.
 */
export function mergeDeepExtractionIntoIndex(
  index: StrategyIndex,
  deep: { strategies: Strategy[]; antiPatterns: AntiPattern[] }
): StrategyIndex {
  return {
    ...index,
    strategies: mergeStrategies(index.strategies, deep.strategies),
    antiPatterns: [...index.antiPatterns, ...deep.antiPatterns],
  };
}
