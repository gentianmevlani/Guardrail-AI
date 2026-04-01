/**
 * LLM-Powered Deep Extraction
 * ============================
 * Uses Claude (via API) to analyze decision graphs and find patterns
 * that heuristic extraction misses.
 *
 * This is the optional "Phase 2" extractor — runs after heuristic
 * extraction to catch nuanced cross-session patterns.
 *
 * Requires: ANTHROPIC_API_KEY environment variable
 */

import type { DecisionGraph, Strategy, AntiPattern } from '../types/decision-graph';

// ─── Prompt Templates ────────────────────────────────────────────────────────

/**
 * System prompt for the pattern analysis task.
 */
export const ANALYSIS_SYSTEM_PROMPT = `You are an expert at analyzing LLM agent session traces to extract procedural heuristics.

You will receive a batch of "decision graphs" from Claude Code sessions on the same codebase. Each graph represents one coding session, showing:
- What the agent hypothesized
- What actions it took (tool calls, file reads/writes)
- Where it backtracked or got corrected by the user
- What files were part of the final resolution vs investigated but irrelevant

Your job is to identify PATTERNS across sessions — recurring behaviors (good or bad) that could inform future sessions.

CRITICAL: Output ONLY valid JSON matching the schema below. No markdown, no preamble, no explanation outside the JSON.`;

/**
 * Build the analysis prompt for a batch of decision graphs.
 */
export function buildAnalysisPrompt(graphs: DecisionGraph[]): string {
  // Compress graphs to essential signal to stay within context
  const compressed = graphs.map(g => ({
    sessionId: g.sessionId.slice(0, 8),
    summary: g.summary || 'no summary',
    duration: `${Math.round(g.metrics.durationSeconds / 60)}m`,
    toolCalls: g.metrics.totalToolCalls,
    backtracks: g.metrics.backtrackCount,
    corrections: g.metrics.userCorrectionCount,
    resolutionFiles: g.metrics.filesModifiedAsResolution,
    falseLeads: g.metrics.filesInvestigatedNotResolution,
    success: g.metrics.apparentSuccess,
    // Include correction and backtrack nodes with context
    pivotPoints: g.nodes
      .filter(n => n.type === 'correction' || n.type === 'backtrack')
      .map(n => ({
        type: n.type,
        reasoning: n.reasoning.slice(0, 200),
        filesTouched: n.filesTouched,
      })),
    // Include the resolution node
    resolution: g.nodes
      .filter(n => n.type === 'resolution')
      .map(n => ({
        reasoning: n.reasoning.slice(0, 200),
        filesTouched: n.filesTouched,
      }))[0],
  }));

  return `Analyze these ${graphs.length} Claude Code session decision graphs from the same codebase.

<session_graphs>
${JSON.stringify(compressed, null, 2)}
</session_graphs>

Identify:

1. RECURRING FAILURE PATTERNS: Where did the agent repeatedly take wrong paths? What files/modules were false leads, and what was the actual resolution?

2. OPTIMAL PATH INSIGHTS: For sessions with high waste (many backtracks/corrections), what should the agent have done differently? What knowledge would have prevented the wrong turns?

3. MODULE-SPECIFIC HEURISTICS: For specific directories or file groups, what consistent patterns do you see? ("When touching module X, always check Y first")

4. CROSS-SESSION LEARNING: Are there lessons from one session that would have helped in another? Patterns that generalize across sessions?

Respond with ONLY this JSON structure:
{
  "antiPatterns": [
    {
      "description": "What goes wrong",
      "incorrectApproach": "What the agent tries that fails",
      "correctApproach": "What actually works",
      "confidence": 0.0-1.0,
      "sessionEvidence": ["session_id1", "session_id2"],
      "avgWastedSteps": 0
    }
  ],
  "strategies": [
    {
      "triggerDescription": "When this situation arises...",
      "content": "The agent should know/do this...",
      "scope": "project|framework|toolchain|universal",
      "confidence": 0.0-1.0,
      "sessionEvidence": ["session_id1", "session_id2"],
      "moduleAreas": ["src/module1", "src/module2"],
      "filePatterns": ["*.ts", "specific-file.ts"]
    }
  ],
  "insights": [
    "Free-form observation about cross-session patterns"
  ]
}`;
}

/**
 * Parse the LLM response into structured types.
 */
export function parseAnalysisResponse(responseText: string): {
  antiPatterns: AntiPattern[];
  strategies: Strategy[];
  insights: string[];
} {
  // Clean potential markdown wrapping
  const cleaned = responseText
    .replace(/```json\s*/g, '')
    .replace(/```\s*/g, '')
    .trim();

  const parsed = JSON.parse(cleaned);
  const now = new Date().toISOString();

  const antiPatterns: AntiPattern[] = (parsed.antiPatterns || []).map(
    (ap: Record<string, unknown>, i: number) => ({
      id: `ap_llm_${i}`,
      triggerDescription: String(ap.description || ''),
      incorrectApproach: String(ap.incorrectApproach || ''),
      correctApproach: String(ap.correctApproach || ''),
      avgWastedSteps: Number(ap.avgWastedSteps || 0),
      occurrences: ((ap.sessionEvidence || []) as string[]).map(sid => ({
        sessionId: sid,
        wastedSteps: Number(ap.avgWastedSteps || 0),
        correctionSource: 'self' as const,
      })),
    })
  );

  const strategies: Strategy[] = (parsed.strategies || []).map(
    (s: Record<string, unknown>, i: number) => ({
      id: `strat_llm_${i}`,
      triggerPattern: {
        filePatterns: (s.filePatterns || []) as string[],
        errorPatterns: [],
        moduleAreas: (s.moduleAreas || []) as string[],
        promptKeywords: String(s.triggerDescription || '')
          .toLowerCase()
          .split(/\s+/)
          .filter((w: string) => w.length > 3)
          .slice(0, 10),
      },
      content: String(s.content || ''),
      scope: (s.scope || 'project') as 'project' | 'framework' | 'toolchain' | 'universal',
      confidence: Number(s.confidence || 0.5),
      supportingEvidence: ((s.sessionEvidence || []) as string[]).map(sid => ({
        sessionId: sid,
        timestamp: now,
        outcome: 'confirmed' as const,
        summary: 'LLM-extracted pattern',
      })),
      createdAt: now,
      lastValidated: now,
      decayRatePerDay: 0.002,
      injectionCount: 0,
      successCount: 0,
      tags: ['llm-extracted'],
    })
  );

  return {
    antiPatterns,
    strategies,
    insights: (parsed.insights || []) as string[],
  };
}

// ─── API Call (bring your own key) ───────────────────────────────────────────

/**
 * Run the LLM-powered deep extraction.
 * Requires ANTHROPIC_API_KEY environment variable.
 */
export async function runDeepExtraction(
  graphs: DecisionGraph[],
  options: {
    apiKey?: string;
    model?: string;
    batchSize?: number;
  } = {}
): Promise<{
  antiPatterns: AntiPattern[];
  strategies: Strategy[];
  insights: string[];
}> {
  const apiKey = options.apiKey || process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error(
      'ANTHROPIC_API_KEY not set. Deep extraction requires an API key.\n' +
      'Set it with: export ANTHROPIC_API_KEY=your-key\n' +
      'Or use heuristic extraction only (engram extract without --deep).'
    );
  }

  const model = options.model || 'claude-sonnet-4-20250514';
  const batchSize = options.batchSize || 15; // Process 15 sessions at a time

  const allAntiPatterns: AntiPattern[] = [];
  const allStrategies: Strategy[] = [];
  const allInsights: string[] = [];

  // Process in batches to stay within context limits
  for (let i = 0; i < graphs.length; i += batchSize) {
    const batch = graphs.slice(i, i + batchSize);
    const prompt = buildAnalysisPrompt(batch);

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model,
        max_tokens: 4096,
        system: ANALYSIS_SYSTEM_PROMPT,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`API call failed (${response.status}): ${error}`);
    }

    const data = await response.json() as {
      content: Array<{ type: string; text?: string }>;
    };
    const text = data.content
      .filter(c => c.type === 'text')
      .map(c => c.text || '')
      .join('');

    try {
      const result = parseAnalysisResponse(text);
      allAntiPatterns.push(...result.antiPatterns);
      allStrategies.push(...result.strategies);
      allInsights.push(...result.insights);
    } catch (err) {
      console.error(`  ⚠ Failed to parse LLM response for batch ${i / batchSize + 1}:`, err);
      continue;
    }
  }

  return {
    antiPatterns: allAntiPatterns,
    strategies: allStrategies,
    insights: allInsights,
  };
}
