/**
 * Session Intent Classifier
 * =========================
 * Classifies WHAT type of task a session is attempting.
 *
 * This runs on a DecisionGraph and determines:
 * - Task type (bug-fix, feature, refactor, debug, etc.)
 * - Complexity estimate
 * - Domain areas (auth, database, UI, API, etc.)
 * - Expected file scope
 *
 * Why this matters: the same codebase knowledge is not equally useful
 * for a bug fix vs a feature. A refactor session needs different strategies
 * than a debugging session. By classifying intent, we can predict
 * which strategies will actually be relevant.
 */

import type { DecisionGraph, DecisionNode } from '../types/decision-graph';
import type { SessionIntent, TaskType, TaskComplexity } from '../types/metacognition';

// ─── Task Type Signal Patterns ──────────────────────────────────────────────

interface TaskSignal {
  type: TaskType;
  patterns: RegExp[];
  weight: number;
}

const TASK_SIGNALS: TaskSignal[] = [
  {
    type: 'bug-fix',
    patterns: [
      /\b(fix|bug|broken|issue|error|crash|regression|failing|wrong|incorrect)\b/i,
      /\b(doesn't|doesn't|does not|isn't|is not) (work|behave|return|render|show)\b/i,
      /\b(unexpected|unintended) (behavior|result|output|error)\b/i,
      /\bhotfix\b/i,
    ],
    weight: 1.0,
  },
  {
    type: 'feature',
    patterns: [
      /\b(add|create|implement|build|new|introduce|integrate)\b/i,
      /\b(feature|functionality|capability|support for)\b/i,
      /\b(allow|enable|make it possible)\b/i,
      /\bwant (to|it to)\b/i,
    ],
    weight: 0.9,
  },
  {
    type: 'refactor',
    patterns: [
      /\b(refactor|restructure|reorganize|clean ?up|simplify|rename|extract|move|split|consolidate)\b/i,
      /\b(technical debt|code quality|maintainability)\b/i,
      /\bDRY\b/,
      /\b(without changing|preserve) (behavior|functionality|output)\b/i,
    ],
    weight: 1.0,
  },
  {
    type: 'debug',
    patterns: [
      /\b(debug|investigate|figure out|what's (happening|going on|wrong)|trace|diagnose)\b/i,
      /\b(why (is|does|did|isn't))\b/i,
      /\b(not sure|don't understand|confused)\b/i,
      /\b(log|inspect|print|trace) .* (to see|what|where|when)\b/i,
    ],
    weight: 0.8,
  },
  {
    type: 'config',
    patterns: [
      /\b(config|configure|setup|install|env|environment|docker|ci|cd|deploy|build)\b/i,
      /\b(tsconfig|eslint|prettier|webpack|vite|package\.json|\.env)\b/i,
      /\b(dependency|dependencies|upgrade|update|version)\b/i,
    ],
    weight: 0.7,
  },
  {
    type: 'test',
    patterns: [
      /\b(test|spec|coverage|assertion|mock|stub|fixture|e2e|unit test|integration test)\b/i,
      /\b(write|add|fix|update) .* tests?\b/i,
      /\b(testing|test suite|test case|test file)\b/i,
    ],
    weight: 0.9,
  },
  {
    type: 'docs',
    patterns: [
      /\b(document|documentation|readme|jsdoc|comment|docstring|explain|describe)\b/i,
      /\b(api docs?|usage|examples?|tutorial)\b/i,
      /\.md\b/i,
    ],
    weight: 0.6,
  },
  {
    type: 'migration',
    patterns: [
      /\b(migrat|schema change|database|alter table|add column|migration file)\b/i,
      /\b(upgrade|downgrade|rollback|version bump)\b/i,
      /\b(breaking change|deprecat)\b/i,
    ],
    weight: 0.9,
  },
  {
    type: 'performance',
    patterns: [
      /\b(performance|optimize|speed|slow|fast|latency|throughput|cache|memo|lazy)\b/i,
      /\b(bundle size|load time|render|memory|leak|bottleneck|profil)\b/i,
      /\bO\(n\b/i,
    ],
    weight: 0.8,
  },
  {
    type: 'security',
    patterns: [
      /\b(security|vulnerabilit|xss|csrf|injection|auth|sanitiz|escap|encrypt|hash|token)\b/i,
      /\b(owasp|cve|audit|penetration|exploit)\b/i,
      /\b(cors|csp|helmet|rate limit)\b/i,
    ],
    weight: 0.9,
  },
  {
    type: 'exploration',
    patterns: [
      /\b(understand|explore|how does|what does|walk me through|explain|read|look at|show me)\b/i,
      /\b(architecture|structure|overview|codebase)\b/i,
      /\b(where is|find|locate|search for)\b/i,
    ],
    weight: 0.5,
  },
];

// ─── Domain Signal Patterns ─────────────────────────────────────────────────

interface DomainSignal {
  domain: string;
  filePatterns: RegExp[];
  textPatterns: RegExp[];
}

const DOMAIN_SIGNALS: DomainSignal[] = [
  {
    domain: 'auth',
    filePatterns: [/auth/, /login/, /session/, /token/, /oauth/, /jwt/, /passport/],
    textPatterns: [/\b(auth\w*|login|logout|session|token|jwt|oauth|password|credential)\b/i],
  },
  {
    domain: 'database',
    filePatterns: [/model/, /schema/, /migrat/, /prisma/, /drizzle/, /knex/, /sequelize/, /\.sql$/],
    textPatterns: [/\b(database|db|query|table|column|row|index|sql|prisma|migration)\b/i],
  },
  {
    domain: 'api',
    filePatterns: [/route/, /controller/, /handler/, /endpoint/, /middleware/, /api\//],
    textPatterns: [/\b(api|endpoint|route|request|response|middleware|rest|graphql|grpc)\b/i],
  },
  {
    domain: 'ui',
    filePatterns: [/component/, /page/, /view/, /layout/, /\.css/, /\.scss/, /\.tsx$/, /\.jsx$/],
    textPatterns: [/\b(component|render|ui|ux|style|css|layout|responsive|button|form|modal)\b/i],
  },
  {
    domain: 'testing',
    filePatterns: [/\.test\./, /\.spec\./, /__tests__/, /fixture/, /mock/],
    textPatterns: [/\b(test|spec|assert|expect|mock|stub|fixture|jest|vitest|mocha)\b/i],
  },
  {
    domain: 'infra',
    filePatterns: [/docker/, /\.yml$/, /\.yaml$/, /terraform/, /k8s/, /helm/, /ci/, /deploy/],
    textPatterns: [/\b(docker|kubernetes|k8s|terraform|ci|cd|deploy|pipeline|container|helm)\b/i],
  },
  {
    domain: 'state',
    filePatterns: [/store/, /reducer/, /context/, /state/, /atom/, /signal/],
    textPatterns: [/\b(state|store|reducer|context|redux|zustand|jotai|recoil|signal)\b/i],
  },
];

// ─── Classification Logic ───────────────────────────────────────────────────

/**
 * Extract all text content from a graph (user messages + agent reasoning)
 */
function extractSessionText(graph: DecisionGraph): string {
  const texts: string[] = [];

  // User request nodes have the clearest intent signal
  for (const n of graph.nodes) {
    if (n.type === 'user_request' || n.type === 'correction') {
      texts.push(n.reasoning);
    }
  }

  // Agent hypothesis and resolution nodes provide secondary signal
  for (const n of graph.nodes) {
    if (n.type === 'hypothesis' || n.type === 'resolution') {
      texts.push(n.reasoning);
    }
  }

  // Summary if available
  if (graph.summary) {
    texts.push(graph.summary);
  }

  return texts.join('\n');
}

/**
 * Extract all file paths touched in a session
 */
function extractAllFiles(graph: DecisionGraph): string[] {
  const files = new Set<string>();
  for (const n of graph.nodes) {
    for (const f of n.filesTouched) {
      files.add(f);
    }
  }
  return [...files];
}

/**
 * Score each task type against the session signals
 */
function scoreTaskTypes(text: string, graph: DecisionGraph): Map<TaskType, number> {
  const scores = new Map<TaskType, number>();

  for (const signal of TASK_SIGNALS) {
    let matchCount = 0;
    for (const pattern of signal.patterns) {
      const matches = text.match(new RegExp(pattern.source, 'gi'));
      if (matches) matchCount += matches.length;
    }
    if (matchCount > 0) {
      const score = Math.min(1.0, matchCount * 0.2) * signal.weight;
      scores.set(signal.type, (scores.get(signal.type) || 0) + score);
    }
  }

  // Behavioral signals (independent of text)
  const hasWrites = graph.nodes.some(n =>
    n.toolCall && ['Write', 'Edit', 'MultiEdit'].includes(n.toolCall.name)
  );
  const hasOnlyReads = !hasWrites && graph.nodes.some(n =>
    n.toolCall?.name === 'Read'
  );

  if (hasOnlyReads) {
    scores.set('exploration', (scores.get('exploration') || 0) + 0.5);
  }

  // Test file touchedness
  const files = extractAllFiles(graph);
  const testFiles = files.filter(f => /\.(test|spec)\.(ts|js|tsx|jsx)$/.test(f));
  if (testFiles.length > 0 && testFiles.length >= files.length * 0.5) {
    scores.set('test', (scores.get('test') || 0) + 0.4);
  }

  return scores;
}

/**
 * Detect domains from file paths and text content
 */
function detectDomains(text: string, files: string[]): string[] {
  const domainScores = new Map<string, number>();

  for (const signal of DOMAIN_SIGNALS) {
    let score = 0;

    for (const pattern of signal.filePatterns) {
      const matches = files.filter(f => pattern.test(f));
      score += matches.length * 0.3;
    }

    for (const pattern of signal.textPatterns) {
      const matches = text.match(new RegExp(pattern.source, 'gi'));
      if (matches) score += matches.length * 0.15;
    }

    if (score > 0.1) {
      domainScores.set(signal.domain, score);
    }
  }

  return [...domainScores.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([domain]) => domain);
}

/**
 * Estimate task complexity from session signals
 */
function estimateComplexity(graph: DecisionGraph): TaskComplexity {
  const { metrics } = graph;
  const fileCount = metrics.filesModifiedAsResolution.length + metrics.filesInvestigatedNotResolution.length;

  // Composite complexity score
  const score =
    (metrics.totalToolCalls / 50) * 0.3 +           // Tool call volume
    (fileCount / 20) * 0.25 +                         // File scope
    (metrics.durationSeconds / 3600) * 0.2 +          // Duration
    (metrics.backtrackCount / 5) * 0.15 +              // Difficulty
    (metrics.userCorrectionCount / 3) * 0.1;           // User involvement

  if (score < 0.1) return 'trivial';
  if (score < 0.3) return 'simple';
  if (score < 0.6) return 'moderate';
  if (score < 1.0) return 'complex';
  return 'epic';
}

/**
 * Estimate file scope
 */
function estimateFileScope(graph: DecisionGraph): SessionIntent['estimatedFileScope'] {
  const fileCount = graph.metrics.filesModifiedAsResolution.length;
  const allFiles = [...graph.metrics.filesModifiedAsResolution, ...graph.metrics.filesInvestigatedNotResolution];

  // Check how many different directories are involved
  const dirs = new Set(allFiles.map(f => {
    const parts = f.split('/').filter(Boolean);
    return parts.length >= 2 ? parts.slice(0, 2).join('/') : parts[0] || '';
  }));

  if (fileCount <= 1) return 'single-file';
  if (dirs.size <= 1) return 'module';
  if (dirs.size <= 3) return 'cross-module';
  return 'system-wide';
}

// ─── Main Entry Point ───────────────────────────────────────────────────────

/**
 * Classify the intent of a session from its decision graph.
 * This is the "what are you trying to do?" detector.
 */
export function classifySessionIntent(graph: DecisionGraph): SessionIntent {
  const text = extractSessionText(graph);
  const files = extractAllFiles(graph);
  const taskScores = scoreTaskTypes(text, graph);

  // Primary type = highest scoring
  const sorted = [...taskScores.entries()].sort((a, b) => b[1] - a[1]);
  const primaryType = sorted.length > 0 ? sorted[0][0] : 'unknown' as TaskType;
  const primaryScore = sorted.length > 0 ? sorted[0][1] : 0;

  // Secondary types = anything with >50% of primary score
  const threshold = primaryScore * 0.5;
  const secondaryTypes = sorted
    .slice(1)
    .filter(([, score]) => score >= threshold && score > 0.2)
    .map(([type]) => type);

  // If multiple strong types, might be multi-task
  const effectiveType = secondaryTypes.length >= 2 ? 'multi-task' as TaskType : primaryType;

  // Collect signal evidence
  const signals: string[] = [];
  for (const signal of TASK_SIGNALS) {
    for (const pattern of signal.patterns) {
      const matches = text.match(new RegExp(pattern.source, 'gi'));
      if (matches) {
        signals.push(...matches.slice(0, 2));
      }
    }
  }

  return {
    taskType: effectiveType,
    secondaryTypes,
    complexity: estimateComplexity(graph),
    confidence: Math.min(0.95, primaryScore > 0 ? Math.min(1.0, primaryScore / 2) : 0.1),
    signals: [...new Set(signals)].slice(0, 10),
    domains: detectDomains(text, files),
    estimatedFileScope: estimateFileScope(graph),
  };
}

/**
 * Classify intent from just a user prompt (before the session starts).
 * Used for predictive strategy loading.
 */
export function classifyPromptIntent(promptText: string): SessionIntent {
  const scores = new Map<TaskType, number>();

  for (const signal of TASK_SIGNALS) {
    let matchCount = 0;
    for (const pattern of signal.patterns) {
      const matches = promptText.match(new RegExp(pattern.source, 'gi'));
      if (matches) matchCount += matches.length;
    }
    if (matchCount > 0) {
      const score = Math.min(1.0, matchCount * 0.25) * signal.weight;
      scores.set(signal.type, (scores.get(signal.type) || 0) + score);
    }
  }

  const sorted = [...scores.entries()].sort((a, b) => b[1] - a[1]);
  const primaryType = sorted.length > 0 ? sorted[0][0] : 'unknown' as TaskType;
  const primaryScore = sorted.length > 0 ? sorted[0][1] : 0;

  const signals: string[] = [];
  for (const signal of TASK_SIGNALS) {
    for (const pattern of signal.patterns) {
      const matches = promptText.match(new RegExp(pattern.source, 'gi'));
      if (matches) signals.push(...matches.slice(0, 2));
    }
  }

  const domains = detectDomains(promptText, []);

  return {
    taskType: primaryType,
    secondaryTypes: sorted.slice(1).filter(([, s]) => s > primaryScore * 0.5 && s > 0.2).map(([t]) => t),
    complexity: 'unknown' as TaskComplexity, // Can't estimate without session data
    confidence: Math.min(0.8, primaryScore > 0 ? primaryScore / 2 : 0.1),
    signals: [...new Set(signals)].slice(0, 10),
    domains,
    estimatedFileScope: 'cross-module', // Default guess
  };
}
