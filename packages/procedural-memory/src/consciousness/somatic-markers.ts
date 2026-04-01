/**
 * Somatic Markers
 * ===============
 * Fast "gut feeling" heuristics that fire before full analysis.
 *
 * Named after Antonio Damasio's somatic marker hypothesis: the idea
 * that emotions serve as rapid decision-making signals. Before you
 * consciously analyze a situation, your body already "knows" — a pit
 * in your stomach says "danger," a spark of excitement says "opportunity."
 *
 * For an AI agent, somatic markers are:
 * - Fast: they fire on pattern match, not analysis
 * - Emotional: they carry a valence (danger/opportunity)
 * - Adaptive: they get refined by outcomes over time
 * - Precognitive: they arrive before the full strategy engine runs
 *
 * The markers are injected as the FIRST thing in the session briefing,
 * before strategies. "Gut check: this file pattern triggers a DANGER
 * marker based on 5 past sessions where similar patterns led to
 * wrong-file-first failures."
 */

import type { DecisionGraph } from '../types/decision-graph';
import type { SessionIntent, CognitiveFingerprint } from '../types/metacognition';
import type { SomaticMarker, SomaticSignal } from '../types/consciousness';
import { classifySessionIntent } from '../classifier/classifier';

// ─── Marker Generation ──────────────────────────────────────────────────────

/**
 * Generate somatic markers from historical session data.
 * Each marker is a fast heuristic learned from repeated outcomes.
 */
export function generateSomaticMarkers(
  graphs: DecisionGraph[],
  existing: SomaticMarker[] = []
): SomaticMarker[] {
  const markers: SomaticMarker[] = [...existing];
  const existingTriggers = new Set(existing.map(m => m.id));

  // ─── Danger: files that are consistently false leads ──────────────────

  const fileFailures = new Map<string, { failures: number; successes: number; sessions: string[] }>();

  for (const g of graphs) {
    for (const f of g.metrics.filesInvestigatedNotResolution) {
      if (!fileFailures.has(f)) fileFailures.set(f, { failures: 0, successes: 0, sessions: [] });
      fileFailures.get(f)!.failures++;
      fileFailures.get(f)!.sessions.push(g.sessionId);
    }
    for (const f of g.metrics.filesModifiedAsResolution) {
      if (!fileFailures.has(f)) fileFailures.set(f, { failures: 0, successes: 0, sessions: [] });
      fileFailures.get(f)!.successes++;
    }
  }

  for (const [file, stats] of fileFailures) {
    const total = stats.failures + stats.successes;
    if (total < 3) continue;

    const failRate = stats.failures / total;
    if (failRate > 0.6) {
      const id = `somatic_danger_file_${hashString(file)}`;
      if (!existingTriggers.has(id)) {
        markers.push({
          id,
          trigger: {
            filePatterns: [file],
            errorPatterns: [],
            keywords: [],
            taskTypes: [],
          },
          signal: 'danger',
          intensity: Math.min(0.9, failRate),
          meaning: `File "${file}" is a false lead ${Math.round(failRate * 100)}% of the time — investigated but not part of resolution`,
          impulse: 'Skip this file and look for the actual resolution file first',
          correctFirings: stats.failures,
          falseFirings: stats.successes,
          precision: round(stats.failures / total, 2),
          createdAt: new Date().toISOString(),
        });
      }
    }

    // Confidence marker for files that are usually the resolution
    if (stats.successes / total > 0.7 && stats.successes >= 3) {
      const id = `somatic_confidence_file_${hashString(file)}`;
      if (!existingTriggers.has(id)) {
        markers.push({
          id,
          trigger: {
            filePatterns: [file],
            errorPatterns: [],
            keywords: [],
            taskTypes: [],
          },
          signal: 'confidence',
          intensity: Math.min(0.9, stats.successes / total),
          meaning: `File "${file}" is the resolution target ${Math.round(stats.successes / total * 100)}% of the time`,
          impulse: 'Prioritize this file — high probability it contains the fix',
          correctFirings: stats.successes,
          falseFirings: stats.failures,
          precision: round(stats.successes / total, 2),
          createdAt: new Date().toISOString(),
        });
      }
    }
  }

  // ─── Caution: task types with high correction rates ───────────────────

  const taskCorrections = new Map<string, { corrections: number; sessions: number }>();

  for (const g of graphs) {
    const intent = classifySessionIntent(g);
    const key = intent.taskType;
    if (!taskCorrections.has(key)) taskCorrections.set(key, { corrections: 0, sessions: 0 });
    const entry = taskCorrections.get(key)!;
    entry.corrections += g.metrics.userCorrectionCount;
    entry.sessions++;
  }

  for (const [taskType, stats] of taskCorrections) {
    if (stats.sessions < 3) continue;
    const avgCorrections = stats.corrections / stats.sessions;

    if (avgCorrections > 2) {
      const id = `somatic_caution_task_${taskType}`;
      if (!existingTriggers.has(id)) {
        markers.push({
          id,
          trigger: {
            filePatterns: [],
            errorPatterns: [],
            keywords: [],
            taskTypes: [taskType as any],
          },
          signal: 'caution',
          intensity: Math.min(0.8, avgCorrections * 0.15),
          meaning: `${taskType} tasks have a high correction rate (avg ${round(avgCorrections, 1)}/session) — slow down and verify approach`,
          impulse: 'Explain your approach to the user before executing. Ask if the direction is right.',
          correctFirings: stats.corrections,
          falseFirings: 0,
          precision: 0.7,
          createdAt: new Date().toISOString(),
        });
      }
    }
  }

  // ─── Opportunity: tool patterns that consistently lead to success ─────

  const toolSuccessMap = new Map<string, { success: number; total: number }>();

  for (const g of graphs) {
    if (!g.metrics.apparentSuccess) continue;
    const firstTool = g.nodes.find(n => n.type === 'action' && n.toolCall)?.toolCall?.name;
    if (firstTool) {
      if (!toolSuccessMap.has(firstTool)) toolSuccessMap.set(firstTool, { success: 0, total: 0 });
      toolSuccessMap.get(firstTool)!.success++;
    }
  }
  for (const g of graphs) {
    const firstTool = g.nodes.find(n => n.type === 'action' && n.toolCall)?.toolCall?.name;
    if (firstTool) {
      if (!toolSuccessMap.has(firstTool)) toolSuccessMap.set(firstTool, { success: 0, total: 0 });
      toolSuccessMap.get(firstTool)!.total++;
    }
  }

  for (const [tool, stats] of toolSuccessMap) {
    if (stats.total < 5) continue;
    const successRate = stats.success / stats.total;

    if (successRate > 0.8) {
      const id = `somatic_opportunity_tool_${tool}`;
      if (!existingTriggers.has(id)) {
        markers.push({
          id,
          trigger: {
            filePatterns: [],
            errorPatterns: [],
            keywords: [],
            taskTypes: [],
          },
          signal: 'opportunity',
          intensity: Math.min(0.7, successRate * 0.7),
          meaning: `Sessions that start with ${tool} have an ${Math.round(successRate * 100)}% success rate`,
          impulse: `Consider starting with ${tool} as your first action`,
          correctFirings: stats.success,
          falseFirings: stats.total - stats.success,
          precision: round(successRate, 2),
          createdAt: new Date().toISOString(),
        });
      }
    }
  }

  // Cap markers and sort by precision
  return markers
    .sort((a, b) => b.precision - a.precision)
    .slice(0, 50);
}

/**
 * Fire somatic markers against a session context.
 * Returns the markers that would trigger, sorted by intensity.
 */
export function fireSomaticMarkers(
  markers: SomaticMarker[],
  intent: SessionIntent,
  activeFiles: string[]
): Array<{ marker: SomaticMarker; reason: string }> {
  const fired: Array<{ marker: SomaticMarker; reason: string }> = [];

  for (const marker of markers) {
    let matched = false;
    let reason = '';

    // Check file patterns
    for (const pattern of marker.trigger.filePatterns) {
      const patLower = pattern.toLowerCase();
      for (const file of activeFiles) {
        if (file.toLowerCase().includes(patLower) || patLower.includes(file.toLowerCase())) {
          matched = true;
          reason = `File "${file}" matches marker trigger "${pattern}"`;
          break;
        }
      }
      if (matched) break;
    }

    // Check task types
    if (!matched && marker.trigger.taskTypes.length > 0) {
      if (marker.trigger.taskTypes.includes(intent.taskType)) {
        matched = true;
        reason = `Task type "${intent.taskType}" matches marker trigger`;
      }
    }

    // Check keywords
    if (!matched && marker.trigger.keywords.length > 0) {
      for (const kw of marker.trigger.keywords) {
        if (intent.signals.some(s => s.toLowerCase().includes(kw.toLowerCase()))) {
          matched = true;
          reason = `Keyword "${kw}" found in session signals`;
          break;
        }
      }
    }

    if (matched) {
      fired.push({ marker, reason });
    }
  }

  return fired.sort((a, b) => b.marker.intensity - a.marker.intensity);
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function hashString(s: string): string {
  let hash = 0;
  for (let i = 0; i < s.length; i++) {
    const char = s.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0;
  }
  return Math.abs(hash).toString(36).slice(0, 8);
}

function round(n: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.round(n * factor) / factor;
}
