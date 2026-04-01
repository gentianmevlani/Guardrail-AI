/**
 * Cross-Project Transfer Learning
 * ================================
 * Identifies which strategies generalize across codebases and which don't.
 *
 * The key insight: some patterns are universal ("always read the error
 * message before investigating"), some are language-specific ("TypeScript
 * type errors often point to the wrong file"), and some are project-specific
 * ("in THIS codebase, auth bugs are always in middleware/auth.ts").
 *
 * Transfer learning lets the system bootstrap new projects with strategies
 * from other projects, weighted by transferability. A strategy that worked
 * in 5 different React codebases is probably universal to React. A strategy
 * that only worked in one project is probably project-specific.
 */

import type { Strategy, StrategyIndex, DecisionGraph } from '../types/decision-graph';
import type {
  TransferablePattern,
  TransferLearningIndex,
  TransferabilityLevel,
} from '../types/metacognition';

// ─── Pattern Abstraction ────────────────────────────────────────────────────

/**
 * Strip project-specific details from a strategy to get its abstract form.
 * "In /Users/sam/myapp/src/auth/middleware.ts, check X" → "In auth middleware, check X"
 */
function abstractStrategy(strategy: Strategy): string {
  let content = strategy.content;

  // Remove absolute paths
  content = content.replace(/\/[\w/.-]+\/([\w.-]+)/g, '$1');

  // Remove specific line numbers
  content = content.replace(/\bline \d+/gi, 'the relevant line');

  // Generalize file paths to module names
  content = content.replace(/\b[\w-]+\.(ts|js|tsx|jsx|py|rs|go)\b/g, (match) => {
    // Keep the extension-less name as a concept
    return match.replace(/\.\w+$/, ' module');
  });

  // Remove session-specific references
  content = content.replace(/\b[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}\b/g, '[session]');

  return content.trim();
}

/**
 * Extract the underlying principle from a strategy.
 * "When touching auth/middleware.ts, always check auth/config.ts first"
 * → "When modifying middleware, check its configuration source first"
 */
function extractPrinciple(strategy: Strategy): string {
  const content = strategy.content.toLowerCase();

  // Pattern: anti-pattern strategies → "Don't do X, do Y instead"
  if (strategy.tags.includes('anti-pattern')) {
    const incorrect = content.match(/investigating[:\s]+(.+?)(?:but|resolution)/);
    const correct = content.match(/resolution[:\s]+(.+?)(?:\.|$)/);
    if (incorrect && correct) {
      return `Avoid investigating ${abstractCategory(incorrect[1])} when the resolution is typically in ${abstractCategory(correct[1])}`;
    }
    return 'Check resolution-likely files before false-lead files';
  }

  // Pattern: convergence strategies → "When in module X, preload Y"
  if (strategy.tags.includes('convergence') || strategy.tags.includes('module-checkpoint')) {
    return 'When entering a module, preload context on frequently co-modified files';
  }

  // Pattern: LLM-extracted → try to keep the key insight
  if (strategy.tags.includes('llm-extracted')) {
    // First sentence is usually the key insight
    const firstSentence = strategy.content.split('.')[0];
    return abstractStrategy({ ...strategy, content: firstSentence });
  }

  return abstractStrategy(strategy);
}

function abstractCategory(text: string): string {
  if (/test|spec|fixture/.test(text)) return 'test files';
  if (/config|env|setting/.test(text)) return 'configuration files';
  if (/route|handler|controller|endpoint/.test(text)) return 'route handlers';
  if (/model|schema|migrat/.test(text)) return 'data layer files';
  if (/component|view|page|layout/.test(text)) return 'UI components';
  if (/middleware|auth|session/.test(text)) return 'middleware';
  if (/util|helper|lib/.test(text)) return 'utility files';
  return text.slice(0, 50);
}

// ─── Transferability Assessment ─────────────────────────────────────────────

/**
 * Assess how transferable a strategy is based on its characteristics.
 */
function assessTransferability(
  strategy: Strategy,
  projectStrategies: Map<string, Strategy[]>
): { level: TransferabilityLevel; confidence: number } {
  // Check if this pattern appears across multiple projects
  const projectsWithSimilar = new Set<string>();
  const myAreas = strategy.triggerPattern.moduleAreas.map(a => a.toLowerCase());
  const myKeywords = strategy.triggerPattern.promptKeywords;

  for (const [project, strategies] of projectStrategies) {
    for (const other of strategies) {
      if (other.id === strategy.id) continue;

      // Check overlap in module areas or keywords
      const areaOverlap = other.triggerPattern.moduleAreas.some(a =>
        myAreas.some(ma => a.toLowerCase().includes(ma) || ma.includes(a.toLowerCase()))
      );
      const keywordOverlap = other.triggerPattern.promptKeywords.filter(k =>
        myKeywords.includes(k)
      ).length;

      if (areaOverlap || keywordOverlap >= 3) {
        projectsWithSimilar.add(project);
      }
    }
  }

  const projectCount = projectsWithSimilar.size;

  // Universal patterns: appear in 3+ very different projects
  if (projectCount >= 3 && strategy.scope === 'universal') {
    return { level: 'universal', confidence: Math.min(0.9, 0.5 + projectCount * 0.1) };
  }

  // Check for language/framework signals in trigger patterns
  const allPatterns = [
    ...strategy.triggerPattern.filePatterns,
    ...strategy.triggerPattern.moduleAreas,
    ...strategy.triggerPattern.promptKeywords,
  ].join(' ').toLowerCase();

  const frameworkSignals = [
    { pattern: /react|jsx|component|hook|useState|useEffect/, level: 'framework-level' as TransferabilityLevel },
    { pattern: /express|fastify|koa|middleware|route/, level: 'framework-level' as TransferabilityLevel },
    { pattern: /prisma|drizzle|sequelize|typeorm|knex/, level: 'framework-level' as TransferabilityLevel },
    { pattern: /next\.?js|nuxt|svelte|vue|angular/, level: 'framework-level' as TransferabilityLevel },
  ];

  for (const { pattern, level } of frameworkSignals) {
    if (pattern.test(allPatterns)) {
      return {
        level: projectCount >= 2 ? level : 'project-specific',
        confidence: Math.min(0.8, 0.4 + projectCount * 0.15),
      };
    }
  }

  const languageSignals = [
    { pattern: /\.ts$|typescript|type error|interface/, level: 'language-level' as TransferabilityLevel },
    { pattern: /\.py$|python|pip|virtualenv/, level: 'language-level' as TransferabilityLevel },
    { pattern: /\.rs$|rust|cargo|borrow/, level: 'language-level' as TransferabilityLevel },
    { pattern: /\.go$|golang|goroutine/, level: 'language-level' as TransferabilityLevel },
  ];

  for (const { pattern, level } of languageSignals) {
    if (pattern.test(allPatterns)) {
      return {
        level: projectCount >= 2 ? level : 'project-specific',
        confidence: Math.min(0.7, 0.3 + projectCount * 0.1),
      };
    }
  }

  // Domain signals
  const domainSignals = [
    { pattern: /auth|login|session|token|oauth/, level: 'domain-level' as TransferabilityLevel },
    { pattern: /database|sql|query|migration/, level: 'domain-level' as TransferabilityLevel },
    { pattern: /api|endpoint|rest|graphql/, level: 'domain-level' as TransferabilityLevel },
  ];

  for (const { pattern, level } of domainSignals) {
    if (pattern.test(allPatterns)) {
      return {
        level: projectCount >= 1 ? level : 'project-specific',
        confidence: Math.min(0.7, 0.3 + projectCount * 0.15),
      };
    }
  }

  // Default: project-specific
  if (strategy.supportingEvidence.length <= 1) {
    return { level: 'ephemeral', confidence: 0.3 };
  }

  return { level: 'project-specific', confidence: 0.4 };
}

// ─── Project Similarity ─────────────────────────────────────────────────────

/**
 * Compute similarity between two projects based on shared patterns,
 * tools used, file types, and domains.
 */
function computeProjectSimilarity(
  graphsA: DecisionGraph[],
  graphsB: DecisionGraph[]
): { similarity: number; sharedPatterns: string[] } {
  // Compare tool usage profiles
  const toolsA = new Set(graphsA.flatMap(g => g.metrics.toolsUsed));
  const toolsB = new Set(graphsB.flatMap(g => g.metrics.toolsUsed));
  const toolOverlap = [...toolsA].filter(t => toolsB.has(t)).length;
  const toolUnion = new Set([...toolsA, ...toolsB]).size;
  const toolSimilarity = toolUnion > 0 ? toolOverlap / toolUnion : 0;

  // Compare file extensions (proxy for language/framework)
  const extsA = new Set(graphsA.flatMap(g =>
    [...g.metrics.filesModifiedAsResolution, ...g.metrics.filesInvestigatedNotResolution]
      .map(f => f.match(/\.\w+$/)?.[0] || '')
      .filter(Boolean)
  ));
  const extsB = new Set(graphsB.flatMap(g =>
    [...g.metrics.filesModifiedAsResolution, ...g.metrics.filesInvestigatedNotResolution]
      .map(f => f.match(/\.\w+$/)?.[0] || '')
      .filter(Boolean)
  ));
  const extOverlap = [...extsA].filter(e => extsB.has(e)).length;
  const extUnion = new Set([...extsA, ...extsB]).size;
  const extSimilarity = extUnion > 0 ? extOverlap / extUnion : 0;

  // Compare module areas
  const modsA = new Set(graphsA.flatMap(g =>
    g.metrics.filesModifiedAsResolution.map(f => {
      const parts = f.split('/').filter(Boolean);
      return parts.length >= 2 ? parts.slice(0, 2).join('/') : parts[0] || '';
    })
  ));
  const modsB = new Set(graphsB.flatMap(g =>
    g.metrics.filesModifiedAsResolution.map(f => {
      const parts = f.split('/').filter(Boolean);
      return parts.length >= 2 ? parts.slice(0, 2).join('/') : parts[0] || '';
    })
  ));

  const sharedPatterns = [...modsA].filter(m => modsB.has(m));

  const similarity = toolSimilarity * 0.3 + extSimilarity * 0.5 + (sharedPatterns.length > 0 ? 0.2 : 0);

  return { similarity: Math.min(1.0, similarity), sharedPatterns };
}

// ─── Main Entry Point ───────────────────────────────────────────────────────

/**
 * Build the transfer learning index from all available strategy indices.
 * This identifies which patterns can be reused across projects.
 */
export function buildTransferIndex(
  indices: Array<{ project: string; index: StrategyIndex }>,
  allGraphs: DecisionGraph[]
): TransferLearningIndex {
  // Group strategies by project
  const projectStrategies = new Map<string, Strategy[]>();
  for (const { project, index } of indices) {
    projectStrategies.set(project, index.strategies);
  }

  // Assess each strategy's transferability
  const patterns: TransferablePattern[] = [];

  for (const { project, index } of indices) {
    for (const strategy of index.strategies) {
      const { level, confidence } = assessTransferability(strategy, projectStrategies);

      patterns.push({
        sourceStrategyId: strategy.id,
        sourceProject: project,
        abstractPattern: abstractStrategy(strategy),
        transferability: level,
        confidence,
        validatedIn: [project],
        failedIn: [],
        underlyingPrinciple: extractPrinciple(strategy),
        tags: [...strategy.tags, level],
      });
    }
  }

  // Compute project similarity matrix
  const projectGraphs = new Map<string, DecisionGraph[]>();
  for (const g of allGraphs) {
    if (!projectGraphs.has(g.project)) projectGraphs.set(g.project, []);
    projectGraphs.get(g.project)!.push(g);
  }

  const projectSimilarity: TransferLearningIndex['projectSimilarity'] = [];
  const projects = [...projectGraphs.keys()];
  for (let i = 0; i < projects.length; i++) {
    for (let j = i + 1; j < projects.length; j++) {
      const sim = computeProjectSimilarity(
        projectGraphs.get(projects[i])!,
        projectGraphs.get(projects[j])!
      );
      if (sim.similarity > 0.1) {
        projectSimilarity.push({
          projectA: projects[i],
          projectB: projects[j],
          similarity: Math.round(sim.similarity * 100) / 100,
          sharedPatterns: sim.sharedPatterns,
        });
      }
    }
  }

  return {
    computedAt: new Date().toISOString(),
    patterns: patterns.sort((a, b) => {
      // Sort by transferability level (most universal first), then confidence
      const levelOrder: Record<TransferabilityLevel, number> = {
        universal: 0, 'language-level': 1, 'framework-level': 2,
        'domain-level': 3, 'project-specific': 4, ephemeral: 5,
      };
      const diff = levelOrder[a.transferability] - levelOrder[b.transferability];
      return diff !== 0 ? diff : b.confidence - a.confidence;
    }),
    projectSimilarity: projectSimilarity.sort((a, b) => b.similarity - a.similarity),
  };
}

/**
 * Get transferable strategies for a new project, weighted by similarity
 * to existing projects.
 */
export function getTransferableStrategies(
  transferIndex: TransferLearningIndex,
  targetProject: string,
  options: {
    minTransferability?: TransferabilityLevel;
    maxStrategies?: number;
  } = {}
): TransferablePattern[] {
  const minLevel = options.minTransferability || 'domain-level';
  const maxStrategies = options.maxStrategies || 20;

  const levelOrder: Record<TransferabilityLevel, number> = {
    universal: 0, 'language-level': 1, 'framework-level': 2,
    'domain-level': 3, 'project-specific': 4, ephemeral: 5,
  };

  const minLevelNum = levelOrder[minLevel];

  // Find most similar projects
  const similarProjects = transferIndex.projectSimilarity
    .filter(s => s.projectA === targetProject || s.projectB === targetProject)
    .sort((a, b) => b.similarity - a.similarity);

  const similarProjectNames = new Set(
    similarProjects.flatMap(s => [s.projectA, s.projectB])
  );

  return transferIndex.patterns
    .filter(p => {
      // Must meet minimum transferability
      if (levelOrder[p.transferability] > minLevelNum) return false;
      // Prefer patterns from similar projects
      return true;
    })
    .map(p => ({
      ...p,
      // Boost confidence for patterns from similar projects
      confidence: similarProjectNames.has(p.sourceProject)
        ? Math.min(0.95, p.confidence * 1.2)
        : p.confidence,
    }))
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, maxStrategies);
}
