/**
 * Metacognitive Strategy Injector
 * ================================
 * Generates an enhanced CLAUDE_STRATEGIES.md that goes beyond pattern lists.
 *
 * The output includes:
 * 1. Cognitive self-portrait — who the agent is as a reasoner
 * 2. Predicted strategies — ranked by relevance to the CURRENT context
 * 3. Active adaptations — behavioral changes derived from reflections
 * 4. Temporal awareness — how the agent is improving or declining
 * 5. Transfer knowledge — lessons from other codebases
 *
 * This is what the agent reads at session start. It's not a manual —
 * it's a briefing. "Here's who you are, here's what you're about to face,
 * here's what went wrong last time, and here's how to be better."
 */

import type { StrategyIndex, Strategy } from '../types/decision-graph';
import type {
  CognitiveFingerprint,
  MetacognitiveReflection,
  TemporalProfile,
  TransferLearningIndex,
  StrategyPrediction,
  SessionIntent,
} from '../types/metacognition';
import type {
  PreMortem,
  SomaticMarker,
  EpistemicMap,
  UserModel,
  NarrativeIdentity,
  PhenomenologicalState,
} from '../types/consciousness';

// ─── Constants ──────────────────────────────────────────────────────────────

const MAX_TOKENS_APPROX = 5000; // Slightly larger budget for richer content
const CHARS_PER_TOKEN = 4;
const MAX_CHARS = MAX_TOKENS_APPROX * CHARS_PER_TOKEN;

// ─── Main Generator ─────────────────────────────────────────────────────────

export interface MetacognitiveInjectionContext {
  index: StrategyIndex;
  fingerprint: CognitiveFingerprint;
  recentReflections: MetacognitiveReflection[];
  temporalProfile: TemporalProfile;
  transferPatterns?: TransferLearningIndex;
  predictions?: StrategyPrediction[];
  /** The strategies selected for injection (already filtered by predictor) */
  selectedStrategies?: Strategy[];
  // ─── Consciousness layer (optional — enriches the briefing) ─────────
  preMortem?: PreMortem;
  firedSomaticMarkers?: Array<{ marker: SomaticMarker; reason: string }>;
  epistemicMap?: EpistemicMap;
  userModel?: UserModel;
  identity?: NarrativeIdentity;
  phenomenology?: PhenomenologicalState;
}

/**
 * Generate the enhanced CLAUDE_STRATEGIES.md with metacognitive + consciousness layers.
 *
 * Section order is deliberate — fast signals first, then context, then strategies:
 * 1. Gut checks (somatic markers) — fire before analysis
 * 2. Pre-mortem warnings — what will probably go wrong
 * 3. Self-portrait — who you are as a reasoner
 * 4. User awareness — adapt to your collaborator
 * 5. Epistemic boundaries — what you know vs don't
 * 6. Adaptations — behavioral changes from reflections
 * 7. Strategies — the ranked heuristics
 */
export function generateMetacognitiveMarkdown(ctx: MetacognitiveInjectionContext): string {
  const lines: string[] = [];
  let charBudget = MAX_CHARS;

  // ─── Header ─────────────────────────────────────────────────────────

  lines.push('# CLAUDE_STRATEGIES.md');
  lines.push('# Procedural Memory — Session Briefing');
  lines.push(`# Generated: ${new Date().toISOString().split('T')[0]}`);
  lines.push(`# Sessions analyzed: ${ctx.index.sessionsAnalyzed} | Strategies: ${ctx.index.strategies.length}`);
  if (ctx.identity) {
    lines.push(`# Identity: ${ctx.identity.currentArc.description}`);
  }
  lines.push('');

  // ─── 1. Somatic Markers — gut checks (fast, first) ──────────────────

  if (ctx.firedSomaticMarkers && ctx.firedSomaticMarkers.length > 0) {
    const somatic = renderSomaticMarkers(ctx.firedSomaticMarkers);
    if (somatic.join('\n').length < charBudget * 0.1) {
      lines.push(...somatic);
      charBudget -= somatic.join('\n').length;
    }
  }

  // ─── 2. Pre-mortem — predicted failure modes ─────────────────────────

  if (ctx.preMortem && ctx.preMortem.predictions.length > 0) {
    const premortem = renderPreMortem(ctx.preMortem);
    if (premortem.join('\n').length < charBudget * 0.12) {
      lines.push(...premortem);
      charBudget -= premortem.join('\n').length;
    }
  }

  // ─── 3. Cognitive Self-Portrait (compact) ────────────────────────────

  const portrait = renderCognitivePortrait(ctx.fingerprint);
  if (portrait.join('\n').length < charBudget * 0.15) {
    lines.push(...portrait);
    charBudget -= portrait.join('\n').length;
  }

  // ─── 4. User Model — adapt to your collaborator ─────────────────────

  if (ctx.userModel) {
    const user = renderUserModel(ctx.userModel);
    if (user.join('\n').length < charBudget * 0.08) {
      lines.push(...user);
      charBudget -= user.join('\n').length;
    }
  }

  // ─── 5. Epistemic Warnings — uncertainty awareness ───────────────────

  if (ctx.epistemicMap) {
    const epistemic = renderEpistemicWarnings(ctx.epistemicMap);
    if (epistemic.length > 0 && epistemic.join('\n').length < charBudget * 0.08) {
      lines.push(...epistemic);
      charBudget -= epistemic.join('\n').length;
    }
  }

  // ─── 6. Active Adaptations from Reflections ─────────────────────────

  const adaptations = renderAdaptations(ctx.recentReflections);
  if (adaptations.length > 0 && adaptations.join('\n').length < charBudget * 0.12) {
    lines.push(...adaptations);
    charBudget -= adaptations.join('\n').length;
  }

  // ─── 7. Strategies (the core — gets remaining budget) ────────────────

  const strategies = ctx.selectedStrategies || ctx.index.strategies;
  const strategyLines = renderStrategies(strategies, ctx.predictions, charBudget);
  lines.push(...strategyLines);
  charBudget -= strategyLines.join('\n').length;

  // ─── Transfer Knowledge (if budget remains) ──────────────────────────

  if (ctx.transferPatterns && charBudget > 500) {
    const transfer = renderTransferKnowledge(ctx.transferPatterns, charBudget);
    lines.push(...transfer);
  }

  return lines.join('\n');
}

// ─── Section Renderers ──────────────────────────────────────────────────────

function renderCognitivePortrait(fp: CognitiveFingerprint): string[] {
  if (fp.totalSessions === 0) return [];

  const lines: string[] = [];
  lines.push('## Self-Awareness Profile');
  lines.push('');
  lines.push('> Your cognitive fingerprint across ' + fp.totalSessions + ' sessions:');
  lines.push('');

  // Render dimensions as a compact spectrum
  for (const dim of fp.dimensions) {
    const position = Math.round(dim.score * 10);
    const bar = '░'.repeat(position) + '█' + '░'.repeat(10 - position);
    lines.push(`  ${dim.leftPole.padEnd(28)} ${bar} ${dim.rightPole}`);
  }
  lines.push('');

  // Strengths and weaknesses — the most actionable part
  if (fp.strengths.length > 0) {
    lines.push('**Strengths:** ' + fp.strengths.join(' | '));
  }
  if (fp.weaknesses.length > 0) {
    lines.push('**Growth areas:** ' + fp.weaknesses.join(' | '));
  }

  // Blind spots — critical warnings
  if (fp.blindSpots.length > 0) {
    lines.push('');
    lines.push('**⚠ Blind spots (compensate actively):**');
    for (const bs of fp.blindSpots.slice(0, 3)) {
      lines.push(`- ${bs}`);
    }
  }

  // Signature moves — positive reinforcement
  if (fp.signatureMoves.length > 0) {
    lines.push('');
    lines.push('**Signature strengths (keep doing):**');
    for (const sm of fp.signatureMoves.slice(0, 2)) {
      lines.push(`- ${sm}`);
    }
  }

  lines.push('');
  return lines;
}

function renderAdaptations(reflections: MetacognitiveReflection[]): string[] {
  // Collect unique adaptations from recent reflections
  const seen = new Set<string>();
  const adaptations: MetacognitiveReflection['adaptations'][0][] = [];

  for (const r of reflections.slice(-10)) {
    for (const a of r.adaptations) {
      const key = a.trigger + a.proposedBehavior;
      if (!seen.has(key)) {
        seen.add(key);
        adaptations.push(a);
      }
    }
  }

  if (adaptations.length === 0) return [];

  const lines: string[] = [];
  lines.push('## Active Behavioral Adaptations');
  lines.push('');
  lines.push('> Changes derived from session reflections. Apply these proactively:');
  lines.push('');

  for (const a of adaptations.slice(0, 5)) {
    lines.push(`- **When:** ${a.trigger}`);
    lines.push(`  **Instead of:** ${a.currentBehavior}`);
    lines.push(`  **Do:** ${a.proposedBehavior}`);
    lines.push('');
  }

  return lines;
}

function renderTemporalAwareness(profile: TemporalProfile): string[] {
  if (profile.trajectories.length === 0) return [];

  const lines: string[] = [];
  lines.push('## Performance Trajectory');
  lines.push('');

  // Compact trajectory summary
  const improving = profile.trajectories.filter(t => t.trend === 'improving');
  const declining = profile.trajectories.filter(t => t.trend === 'declining');
  const plateaued = profile.trajectories.filter(t =>
    t.trend === 'stable' && t.plateaus.length > 0
  );

  if (improving.length > 0) {
    lines.push(`📈 Improving: ${improving.map(t => `${t.taskType} (+${round(t.slopePerSession * 100, 1)}%/session)`).join(', ')}`);
  }
  if (declining.length > 0) {
    lines.push(`📉 Declining: ${declining.map(t => `${t.taskType} (${round(t.slopePerSession * 100, 1)}%/session)`).join(', ')}`);
  }
  if (plateaued.length > 0) {
    lines.push(`📊 Plateaued: ${plateaued.map(t => t.taskType).join(', ')} — try new approaches`);
  }

  if (profile.prediction) {
    lines.push('');
    lines.push(`> ${profile.prediction}`);
  }

  lines.push('');
  return lines;
}

function renderStrategies(
  strategies: Strategy[],
  predictions?: StrategyPrediction[],
  maxChars?: number
): string[] {
  const budget = maxChars || MAX_CHARS * 0.6;
  const lines: string[] = [];
  let usedChars = 0;

  lines.push('## Strategies');
  lines.push('');

  // Group by module area
  const grouped = new Map<string, Array<{ strategy: Strategy; prediction?: StrategyPrediction }>>();

  for (const s of strategies) {
    const module = s.triggerPattern.moduleAreas[0] || 'General';
    if (!grouped.has(module)) grouped.set(module, []);

    const pred = predictions?.find(p => p.strategyId === s.id);
    grouped.get(module)!.push({ strategy: s, prediction: pred });
  }

  for (const [module, items] of grouped) {
    if (usedChars > budget) break;

    lines.push(`### ${module}`);
    lines.push('');

    for (const { strategy, prediction } of items) {
      if (usedChars > budget) break;

      const conf = Math.round(strategy.confidence * 100);
      const evidence = strategy.supportingEvidence.length;
      const risk = prediction?.riskIfOmitted || 'low';

      // Compact format with prediction metadata
      let header = `**[${conf}%`;
      if (risk === 'high') header += ' ⚠ HIGH-RISK';
      else if (risk === 'medium') header += ' ◆';
      header += `]** (${evidence} sessions)`;

      if (prediction && prediction.relevanceProbability > 0.6) {
        header += ` — ${Math.round(prediction.relevanceProbability * 100)}% predicted relevance`;
      }

      lines.push(header);
      lines.push(strategy.content);
      lines.push('');

      usedChars += header.length + strategy.content.length + 2;
    }
  }

  return lines;
}

function renderTransferKnowledge(
  transferIndex: TransferLearningIndex,
  maxChars: number
): string[] {
  const universalPatterns = transferIndex.patterns.filter(p =>
    p.transferability === 'universal' || p.transferability === 'language-level'
  );

  if (universalPatterns.length === 0) return [];

  const lines: string[] = [];
  lines.push('## Cross-Project Insights');
  lines.push('');
  lines.push('> Patterns that transfer across codebases:');
  lines.push('');

  let chars = 0;
  for (const p of universalPatterns.slice(0, 5)) {
    const line = `- **[${p.transferability}]** ${p.underlyingPrinciple} (confidence: ${Math.round(p.confidence * 100)}%, validated in ${p.validatedIn.length} project(s))`;
    if (chars + line.length > maxChars - 100) break;
    lines.push(line);
    chars += line.length;
  }

  lines.push('');
  return lines;
}

// ─── Consciousness Section Renderers ────────────────────────────────────────

function renderSomaticMarkers(
  fired: Array<{ marker: SomaticMarker; reason: string }>
): string[] {
  const lines: string[] = [];
  lines.push('## Gut Check');
  lines.push('');

  const dangerMarkers = fired.filter(f => f.marker.signal === 'danger' || f.marker.signal === 'caution');
  const confMarkers = fired.filter(f => f.marker.signal === 'confidence' || f.marker.signal === 'opportunity');

  for (const { marker } of dangerMarkers.slice(0, 3)) {
    lines.push(`- ⚠ **${marker.signal.toUpperCase()}** (${Math.round(marker.precision * 100)}% accurate): ${marker.meaning}`);
    lines.push(`  → ${marker.impulse}`);
  }
  for (const { marker } of confMarkers.slice(0, 2)) {
    lines.push(`- ✓ **${marker.signal.toUpperCase()}**: ${marker.meaning}`);
  }

  lines.push('');
  return lines;
}

function renderPreMortem(preMortem: PreMortem): string[] {
  const lines: string[] = [];
  lines.push('## Pre-mortem: Predicted Risks');
  lines.push('');

  const topRisks = preMortem.predictions
    .filter(p => p.probability > 0.15)
    .slice(0, 3);

  for (const risk of topRisks) {
    const pct = Math.round(risk.probability * 100);
    lines.push(`- **${risk.mode}** (${pct}% likely, ~${risk.expectedCost} wasted steps): ${risk.earlyWarning}`);
    lines.push(`  Prevention: ${risk.prevention}`);
  }

  lines.push('');
  return lines;
}

function renderUserModel(userModel: UserModel): string[] {
  const lines: string[] = [];
  lines.push('## Collaborator Awareness');
  lines.push('');

  // Only include actionable guidance, not raw data
  const guidance: string[] = [];

  if (userModel.patience === 'low') {
    guidance.push('User has **low patience** for exploration — be direct, explain intent before acting');
  }
  if (userModel.style.correctionStyle === 'frustrated') {
    guidance.push('User correction style is **frustrated** — minimize trial-and-error, ask early if unsure');
  }
  if (userModel.style.preferredResponseLength === 'concise') {
    guidance.push('User prefers **concise** responses — lead with the action, skip the preamble');
  } else if (userModel.style.preferredResponseLength === 'detailed') {
    guidance.push('User prefers **detailed** responses — explain reasoning and alternatives');
  }
  if (userModel.expertiseLevel === 'expert') {
    guidance.push('User is a **domain expert** — skip basics, use precise technical language');
  } else if (userModel.expertiseLevel === 'beginner') {
    guidance.push('User is **learning** — explain context, link to docs, avoid jargon');
  }
  if (userModel.rejectedBehaviors.length > 0) {
    guidance.push(`User has rejected: ${userModel.rejectedBehaviors.slice(0, 2).join('; ')}`);
  }

  if (guidance.length === 0) return [];

  for (const g of guidance.slice(0, 4)) {
    lines.push(`- ${g}`);
  }

  lines.push('');
  return lines;
}

function renderEpistemicWarnings(epistemicMap: EpistemicMap): string[] {
  // Only render warnings for LOW-certainty domains that are on the active frontier
  const warnings = epistemicMap.domains
    .filter(d => d.certainty < 0.4 && epistemicMap.activeFrontier.includes(d.domain));

  if (warnings.length === 0) return [];

  const lines: string[] = [];
  lines.push('## Knowledge Boundaries');
  lines.push('');

  for (const d of warnings.slice(0, 3)) {
    lines.push(`- **${d.domain}** — certainty: ${Math.round(d.certainty * 100)}% (${d.depth}). ${d.knownUnknowns[0] || 'Proceed carefully in this domain.'}`);
  }

  lines.push('');
  return lines;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function round(n: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.round(n * factor) / factor;
}
