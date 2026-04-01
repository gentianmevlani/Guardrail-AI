/**
 * Claude Code Stop hook handler — stdin JSON per hooks spec:
 * transcript_path, cwd, ...
 *
 * Full pipeline: parse → strategies → metacognition → consciousness → inject.
 * Every session end produces a CLAUDE_STRATEGIES.md enriched with:
 * - Somatic markers (gut checks)
 * - Pre-mortem warnings (predicted failures)
 * - User model adaptations
 * - Epistemic boundary warnings
 * - Metacognitive self-portrait + adaptations
 * - Ranked strategies
 */

import { existsSync, readFileSync, writeFileSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';

import { buildStrategyIndex } from './extractor/extract';
import {
  writeStrategyIndex as writeStrategiesJsonToProject,
} from './injector/inject';
import { generateMetacognitiveMarkdown } from './injector/metacognitive-inject';
import { parseSession } from './parser/parse';
import { loadProcmemConfig } from './lib/config';
import { projectPathFromTranscript } from './lib/claude-project';
import {
  filterGraphsByProject,
  loadGraphs,
  loadStrategyIndex,
  saveGraphs,
  saveStrategyIndex,
  upsertGraph,
} from './lib/data-store';
import {
  loadMetacognitiveStore,
  saveMetacognitiveStore,
  emptyMetacognitiveStore,
} from './lib/metacognitive-store';
import {
  loadConsciousnessStore,
  saveConsciousnessStore,
  emptyConsciousnessStore,
} from './lib/consciousness-store';
import { buildCognitiveFingerprint } from './fingerprint/fingerprint';
import { generateReflection } from './metacognition/reflection';
import { buildTemporalProfile } from './temporal/temporal';
import { classifySessionIntent } from './classifier/classifier';
import { predictStrategies, selectStrategiesForInjection } from './predictor/predictor';
// Consciousness
import { buildNarrativeIdentity } from './consciousness/narrative-identity';
import { buildEpistemicMap } from './consciousness/epistemic-map';
import { buildUserModel } from './consciousness/user-model';
import { runPreMortem } from './consciousness/pre-mortem';
import { generateSomaticMarkers, fireSomaticMarkers } from './consciousness/somatic-markers';
import { buildPhenomenologicalState } from './consciousness/phenomenology';

const MIN_CONFIDENCE = 0.3;

function expandPath(p: string): string {
  if (p.startsWith('~/')) return join(homedir(), p.slice(2));
  if (p === '~') return homedir();
  return p;
}

/**
 * @returns exit code (0 = ok)
 */
export function runStopHook(stdinJson: string): number {
  let payload: { transcript_path?: string; cwd?: string };
  try {
    payload = JSON.parse(stdinJson) as { transcript_path?: string; cwd?: string };
  } catch {
    return 0;
  }

  const rawPath = payload.transcript_path;
  const cwd = payload.cwd ? expandPath(payload.cwd) : '';
  if (!rawPath || !cwd) return 0;

  const transcriptPath = expandPath(rawPath);
  if (!existsSync(transcriptPath) || !existsSync(cwd)) return 0;

  const cfg = loadProcmemConfig(cwd);
  const strategyProject = projectPathFromTranscript(transcriptPath);

  let graph;
  try {
    graph = parseSession(transcriptPath, strategyProject);
  } catch {
    return 0;
  }

  // ─── Core pipeline ────────────────────────────────────────────────────

  let graphs = loadGraphs(cfg.dataDir);
  graphs = upsertGraph(graphs, graph);
  saveGraphs(cfg.dataDir, graphs);

  const subset = filterGraphsByProject(graphs, strategyProject);
  if (subset.length === 0) return 0;

  const existingIndex = loadStrategyIndex(cfg.dataDir, strategyProject);
  const index = buildStrategyIndex(subset, strategyProject, existingIndex || undefined);
  index.strategies = index.strategies.filter((s) => s.confidence >= MIN_CONFIDENCE);

  saveStrategyIndex(cfg.dataDir, index, strategyProject);

  // ─── Full consciousness pipeline ──────────────────────────────────────

  try {
    // Metacognition
    let metaStore = loadMetacognitiveStore(cfg.dataDir) || emptyMetacognitiveStore();
    const fingerprint = buildCognitiveFingerprint(subset);
    const reflection = generateReflection(graph);
    const intent = classifySessionIntent(graph);

    metaStore.fingerprint = fingerprint;
    metaStore.reflections = [...metaStore.reflections.slice(-49), reflection];
    metaStore.temporalProfile = buildTemporalProfile(subset);
    metaStore.recentIntents = [...metaStore.recentIntents.slice(-19), intent];
    saveMetacognitiveStore(cfg.dataDir, metaStore);

    // Consciousness
    let conStore = loadConsciousnessStore(cfg.dataDir) || emptyConsciousnessStore();
    conStore.identity = buildNarrativeIdentity(
      subset, fingerprint, metaStore.reflections,
      metaStore.temporalProfile, conStore.identity
    );
    conStore.epistemicMap = buildEpistemicMap(subset, conStore.epistemicMap);
    conStore.userModel = buildUserModel(subset, conStore.userModel);
    conStore.somaticMarkers = generateSomaticMarkers(subset, conStore.somaticMarkers);
    conStore.phenomenology = buildPhenomenologicalState(subset, conStore.phenomenology);
    saveConsciousnessStore(cfg.dataDir, conStore);

    // Pre-mortem for the NEXT session
    const preMortem = runPreMortem(intent, fingerprint, subset, conStore.epistemicMap);

    // Fire somatic markers against current context
    const firedMarkers = fireSomaticMarkers(conStore.somaticMarkers, intent, []);

    // ─── Generate consciousness-enriched CLAUDE_STRATEGIES.md ─────────

    if (index.strategies.length > 0) {
      const predictions = predictStrategies(index, {
        intent,
        fingerprint,
        activeFiles: [],
        recentErrors: [],
        timeOfDay: getTimeOfDay(),
        sessionNumberToday: 1,
      });

      const selectedStrategies = selectStrategiesForInjection(index, predictions, {
        includeHighRisk: true,
      });

      const markdown = generateMetacognitiveMarkdown({
        index,
        fingerprint,
        recentReflections: metaStore.reflections.slice(-10),
        temporalProfile: metaStore.temporalProfile,
        predictions,
        selectedStrategies,
        // Consciousness
        preMortem,
        firedSomaticMarkers: firedMarkers,
        epistemicMap: conStore.epistemicMap,
        userModel: conStore.userModel,
        identity: conStore.identity,
        phenomenology: conStore.phenomenology,
      });

      writeFileSync(join(cwd, 'CLAUDE_STRATEGIES.md'), markdown, 'utf-8');
      writeStrategiesJsonToProject(cwd, index);
    }
  } catch {
    // Consciousness failure should not break the core pipeline
    if (index.strategies.length > 0) {
      writeStrategiesJsonToProject(cwd, index);
    }
  }

  return 0;
}

function getTimeOfDay(): 'morning' | 'afternoon' | 'evening' | 'night' {
  const hour = new Date().getHours();
  if (hour < 6) return 'night';
  if (hour < 12) return 'morning';
  if (hour < 18) return 'afternoon';
  if (hour < 22) return 'evening';
  return 'night';
}

export function readStdinSync(): string {
  try {
    return readFileSync(0, 'utf-8');
  } catch {
    return '';
  }
}
