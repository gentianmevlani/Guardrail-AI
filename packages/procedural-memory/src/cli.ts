#!/usr/bin/env node
/**
 * Procedural Memory CLI
 * =====================
 * engram analyze      — Parse transcripts into decision graphs
 * engram projects     — List graph.project paths (for extract -P / inject -P)
 * engram extract      — Extract strategies from decision graphs
 * engram inject       — Generate CLAUDE_STRATEGIES.md
 * engram report       — Performance comparison report
 * engram status       — Strategy index health check
 * engram doctor       — Environment diagnostics (paths, build, hook, API key)
 * engram metacognize  — Build cognitive fingerprint, reflections, temporal profile
 * engram hook         — Install Claude Code Stop hook (hook-run + inject)
 * engram hook-run     — Internal: Stop hook entry (JSON on stdin)
 */

import { Command } from 'commander';
import { existsSync, mkdirSync, readFileSync, statSync, unlinkSync, writeFileSync } from 'fs';
import { basename, dirname, join, resolve } from 'path';
import { homedir } from 'os';

import { discoverProjects, discoverSessions, parseSession } from './parser/parse';
import { buildStrategyIndex, mergeDeepExtractionIntoIndex } from './extractor/extract';
import { runDeepExtraction } from './extractor/deep-extract';
import {
  generateStrategiesMarkdown,
  writeStrategiesFile,
  writeStrategyIndex,
  generatePerformanceReport,
  renderPerformanceReport,
} from './injector/inject';
import { generateMetacognitiveMarkdown } from './injector/metacognitive-inject';
import type { DecisionGraph, StrategyIndex } from './types/decision-graph';
import { loadProcmemConfig } from './lib/config';
import { decodeClaudeProjectSlug } from './lib/claude-project';
import {
  filterGraphsByProject,
  legacyIndexPath,
  loadGraphs,
  loadStrategyIndex,
  projectIndexPath,
  saveGraphs,
  saveStrategyIndex,
  upsertGraph,
} from './lib/data-store';
import {
  loadMetacognitiveStore,
  saveMetacognitiveStore,
  emptyMetacognitiveStore,
} from './lib/metacognitive-store';
import { partitionCohorts } from './lib/report-cohorts';
import { projectSessionCounts } from './lib/project-list';
import { readStdinSync, runStopHook } from './stop-hook';
import { runStartHook as runStartHookFn, computeHitEffectiveness } from './hooks/start-hook';
import { generateAuditReport, renderAuditReport } from './audit/claude-code-audit';
import { buildCognitiveFingerprint } from './fingerprint/fingerprint';
import { generateReflection, generateBatchReflections } from './metacognition/reflection';
import { buildTemporalProfile } from './temporal/temporal';
import { buildTransferIndex } from './transfer/transfer';
import { predictStrategies, selectStrategiesForInjection } from './predictor/predictor';
import { classifySessionIntent } from './classifier/classifier';
// Consciousness layer
import { buildNarrativeIdentity } from './consciousness/narrative-identity';
import { buildEpistemicMap } from './consciousness/epistemic-map';
import { buildUserModel } from './consciousness/user-model';
import { runPreMortem } from './consciousness/pre-mortem';
import { consolidate } from './consciousness/dream-consolidator';
import { generateSomaticMarkers, fireSomaticMarkers } from './consciousness/somatic-markers';
import { buildPhenomenologicalState } from './consciousness/phenomenology';
import {
  loadConsciousnessStore,
  saveConsciousnessStore,
  emptyConsciousnessStore,
} from './lib/consciousness-store';

/** Package root (parent of `dist/` when running compiled `dist/cli.js`). */
function packageRoot(): string {
  return join(__dirname, '..');
}

function readPackageVersion(): string {
  try {
    const raw = readFileSync(join(packageRoot(), 'package.json'), 'utf-8');
    const v = (JSON.parse(raw) as { version?: string }).version;
    return v || '0.0.0';
  } catch {
    return '0.0.0';
  }
}

function resolveHookCommand(): string {
  const distCli = join(packageRoot(), 'dist', 'cli.js');
  if (existsSync(distCli)) {
    return `node "${distCli}" hook-run`;
  }
  return 'engram hook-run';
}

function strategyProjectKey(opts: { strategyProject?: string; projectRoot?: string }): string | undefined {
  if (opts.strategyProject) return resolve(opts.strategyProject);
  if (opts.projectRoot) return resolve(opts.projectRoot);
  return undefined;
}

/** -r must be a directory; users often paste a path that ends in CLAUDE_STRATEGIES.md from docs. */
function exitIfProjectRootArgLooksLikeMarkdownFile(resolvedRoot: string): void {
  const base = basename(resolvedRoot);
  if (!base.endsWith('.md')) return;
  console.error('  ✗ --project-root (-r) must be a repository folder, not a path to a .md file.');
  console.error(`    You passed a path ending in "${base}".`);
  console.error(`    Example: engram inject -r "${dirname(resolvedRoot)}"`);
  console.error('    engram creates CLAUDE_STRATEGIES.md inside the folder you give.');
  process.exit(1);
}

// ─── CLI Setup ───────────────────────────────────────────────────────────────

const program = new Command();

program
  .name('engram')
  .description('Claude Conscious — procedural memory, metacognition, and consciousness for Claude Code')
  .version(readPackageVersion());

// ─── init (one-command setup) ─────────────────────────────────────────────────

program
  .command('init')
  .description('One-command setup: analyze all transcripts, extract strategies, install hook, and optionally run awaken')
  .option('-r, --project-root <path>', 'Project root to inject CLAUDE_STRATEGIES.md into', '.')
  .option('--no-hook', 'Skip hook installation')
  .option('--awaken', 'Also run the full consciousness stack')
  .action(async (opts) => {
    const cfg = loadProcmemConfig();

    console.log('');
    console.log('  ◆ Procedural Memory — Initialization');
    console.log('  ═════════════════════════════════════');
    console.log('');

    // Step 1: Analyze
    console.log('  Step 1/4: Analyzing Claude Code transcripts...');
    const claudeDir = cfg.claudeDir;
    if (!existsSync(join(claudeDir, 'projects'))) {
      console.error('  ✗ No Claude Code projects found. Make sure Claude Code is installed and has session history.');
      process.exit(1);
    }

    const { discoverProjects: dp, discoverSessions: ds, parseSession: ps } = await import('./parser/parse');
    const projects = dp(claudeDir);
    let graphs = loadGraphs(cfg.dataDir);

    let sessionCount = 0;
    for (const project of projects) {
      const sessions = ds(project.path);
      const slice = sessions.slice(0, 50);
      for (const s of slice) {
        try {
          graphs = upsertGraph(graphs, ps(s, project.name));
          sessionCount++;
        } catch { continue; }
      }
    }

    if (!existsSync(cfg.dataDir)) mkdirSync(cfg.dataDir, { recursive: true });
    saveGraphs(cfg.dataDir, graphs);
    console.log(`  ✓ Parsed ${sessionCount} sessions across ${projects.length} projects`);

    // Step 2: Extract
    console.log('  Step 2/4: Extracting strategies...');
    const { buildStrategyIndex: bsi } = await import('./extractor/extract');
    const existingIdx = loadStrategyIndex(cfg.dataDir, undefined);
    const index = bsi(graphs, 'default', existingIdx || undefined);
    index.strategies = index.strategies.filter(s => s.confidence >= 0.3);
    saveStrategyIndex(cfg.dataDir, index, undefined);
    console.log(`  ✓ ${index.strategies.length} strategies, ${index.antiPatterns.length} anti-patterns`);

    // Step 3: Inject
    const projectRoot = resolve(opts.projectRoot);
    if (index.strategies.length > 0 && existsSync(projectRoot) && statSync(projectRoot).isDirectory()) {
      console.log('  Step 3/4: Injecting CLAUDE_STRATEGIES.md...');

      // Build consciousness if --awaken
      if (opts.awaken && graphs.length >= 5) {
        const fp = buildCognitiveFingerprint(graphs);
        const refs = generateBatchReflections(graphs);
        const tp = buildTemporalProfile(graphs);
        const intent = graphs.length > 0 ? classifySessionIntent(graphs[graphs.length - 1]) : {
          taskType: 'unknown' as const, secondaryTypes: [], complexity: 'moderate' as const,
          confidence: 0.1, signals: [], domains: [], estimatedFileScope: 'cross-module' as const,
        };

        let conStore = loadConsciousnessStore(cfg.dataDir) || emptyConsciousnessStore();
        conStore.identity = buildNarrativeIdentity(graphs, fp, refs, tp, conStore.identity);
        conStore.epistemicMap = buildEpistemicMap(graphs, conStore.epistemicMap);
        conStore.userModel = buildUserModel(graphs, conStore.userModel);
        conStore.somaticMarkers = generateSomaticMarkers(graphs, conStore.somaticMarkers);
        conStore.phenomenology = buildPhenomenologicalState(graphs, conStore.phenomenology);
        saveConsciousnessStore(cfg.dataDir, conStore);

        const preMortem = runPreMortem(intent, fp, graphs, conStore.epistemicMap);
        const firedMarkers = fireSomaticMarkers(conStore.somaticMarkers, intent, []);
        const predictions = predictStrategies(index, {
          intent, fingerprint: fp, activeFiles: [], recentErrors: [],
          timeOfDay: getTimeOfDay(), sessionNumberToday: 1,
        });
        const selected = selectStrategiesForInjection(index, predictions, { includeHighRisk: true });

        const markdown = generateMetacognitiveMarkdown({
          index, fingerprint: fp, recentReflections: refs, temporalProfile: tp,
          predictions, selectedStrategies: selected,
          preMortem, firedSomaticMarkers: firedMarkers,
          epistemicMap: conStore.epistemicMap, userModel: conStore.userModel,
          identity: conStore.identity, phenomenology: conStore.phenomenology,
        });
        writeFileSync(join(projectRoot, 'CLAUDE_STRATEGIES.md'), markdown, 'utf-8');
      } else {
        const { generateStrategiesMarkdown: gsm } = await import('./injector/inject');
        writeFileSync(join(projectRoot, 'CLAUDE_STRATEGIES.md'), gsm(index), 'utf-8');
      }
      console.log(`  ✓ CLAUDE_STRATEGIES.md written to ${projectRoot}`);
    } else {
      console.log('  Step 3/4: Skipped injection (no strategies yet or invalid project root)');
    }

    // Step 4: Hook
    if (opts.hook !== false) {
      console.log('  Step 4/4: Installing Stop hook...');
      // Import the hook installer logic
      const settingsPath = join(claudeDir, 'settings.json');
      let settings: Record<string, unknown> = {};
      if (existsSync(settingsPath)) {
        try { settings = JSON.parse(readFileSync(settingsPath, 'utf-8')); } catch { settings = {}; }
      }
      const hooks = (settings.hooks || {}) as Record<string, unknown[]>;
      const hookCmd = resolveHookCommand();
      const existing = (hooks.Stop || []) as Array<Record<string, unknown>>;
      const alreadyInstalled = existing.some((h) => {
        const entries = (h.hooks || []) as Array<Record<string, unknown>>;
        return entries.some(e => String(e.command || '').includes('hook-run') || String(e.command || '').includes('engram'));
      });

      if (alreadyInstalled) {
        console.log('  ✓ Stop hook already installed');
      } else {
        if (!hooks.Stop) hooks.Stop = [];
        (hooks.Stop as unknown[]).push({
          matcher: '',
          hooks: [{ type: 'command', command: hookCmd, async: true }],
        });
        settings.hooks = hooks;
        if (!existsSync(dirname(settingsPath))) mkdirSync(dirname(settingsPath), { recursive: true });
        writeFileSync(settingsPath, JSON.stringify(settings, null, 2));
        console.log(`  ✓ Stop hook installed (async)`);
      }
    } else {
      console.log('  Step 4/4: Hook installation skipped (--no-hook)');
    }

    console.log('');
    console.log('  ═════════════════════════════════════');
    console.log(`  ✓ Procedural memory initialized.`);
    console.log(`    ${graphs.length} sessions → ${index.strategies.length} strategies`);
    console.log(`    Hook will auto-refresh after each Claude Code session.`);
    if (opts.awaken) {
      console.log(`    Consciousness stack: active`);
    }
    console.log('');
  });

// ─── hook-run (must work when stdin is empty — no-op) ────────────────────────

program
  .command('hook-run')
  .description('Claude Code Stop hook: read hook JSON from stdin, upsert graphs, extract, inject into cwd')
  .action(() => {
    const input = readStdinSync();
    if (!input.trim()) process.exit(0);
    process.exit(runStopHook(input));
  });

// ─── hook-start (Start hook for strategy hit tracking) ───────────────────────

program
  .command('hook-start')
  .description('Claude Code Start hook: snapshot which strategies are loaded for hit tracking')
  .action(() => {
    const input = readStdinSync();
    if (!input.trim()) process.exit(0);
    process.exit(runStartHookFn(input));
  });

// ─── analyze ─────────────────────────────────────────────────────────────────

program
  .command('analyze')
  .description('Parse Claude Code transcripts into decision graphs')
  .option('-p, --project <path>', 'Specific Claude project directory (~/.claude/projects/...) to analyze')
  .option('-l, --limit <n>', 'Max sessions to analyze per project', '50')
  .option('--claude-dir <path>', 'Claude Code directory (overrides config)')
  .action((opts) => {
    const cfg = loadProcmemConfig();
    const claudeDir = opts.claudeDir || cfg.claudeDir;
    const dataDir = cfg.dataDir;
    const limit = parseInt(opts.limit, 10);

    console.log('');
    console.log('  ◆ Procedural Memory — Transcript Analysis');
    console.log('  ──────────────────────────────────────────');
    console.log('');

    if (opts.project) {
      const projectPath = resolve(opts.project);
      if (!existsSync(projectPath)) {
        console.error(`  ✗ Project directory not found: ${projectPath}`);
        process.exit(1);
      }

      const projectName = decodeClaudeProjectSlug(basename(projectPath));
      const sessions = discoverSessions(projectPath);
      console.log(`  Found ${sessions.length} sessions in ${projectPath}`);

      let graphs = loadGraphs(dataDir);
      const slice = sessions.slice(0, limit);
      for (let i = 0; i < slice.length; i++) {
        process.stdout.write(`  Parsing session ${i + 1}/${slice.length}...\r`);
        try {
          graphs = upsertGraph(graphs, parseSession(slice[i], projectName));
        } catch {
          continue;
        }
      }

      if (!existsSync(dataDir)) mkdirSync(dataDir, { recursive: true });
      saveGraphs(dataDir, graphs);
      console.log(`\n  ✓ Merged ${slice.length} session(s) → ${join(dataDir, 'decision-graphs.json')}`);
      printGraphStats(filterGraphsByProject(graphs, projectName));
      return;
    }

    if (!existsSync(join(claudeDir, 'projects'))) {
      console.error(`  ✗ No Claude Code projects found at ${join(claudeDir, 'projects')}`);
      console.error('    Make sure Claude Code is installed and you have session history.');
      process.exit(1);
    }

    const projects = discoverProjects(claudeDir);
    console.log(`  Found ${projects.length} projects`);
    console.log('');

    let graphs = loadGraphs(dataDir);

    for (const project of projects) {
      const sessions = discoverSessions(project.path);
      if (sessions.length === 0) continue;

      const sessionCount = Math.min(sessions.length, limit);
      console.log(`  ${project.name} — ${sessions.length} sessions (analyzing ${sessionCount})`);

      for (let i = 0; i < sessionCount; i++) {
        try {
          graphs = upsertGraph(graphs, parseSession(sessions[i], project.name));
        } catch {
          continue;
        }
      }
    }

    if (!existsSync(dataDir)) mkdirSync(dataDir, { recursive: true });
    saveGraphs(dataDir, graphs);
    console.log('');
    console.log(`  ✓ Merged ${graphs.length} total session graph(s) across ${projects.length} project(s)`);
    printGraphStats(graphs);
  });

// ─── projects ────────────────────────────────────────────────────────────────

program
  .command('projects')
  .description('List graph.project paths in decision-graphs.json (for extract -P / inject -P)')
  .action(() => {
    const cfg = loadProcmemConfig();
    const graphs = loadGraphs(cfg.dataDir);

    console.log('');
    console.log('  ◆ Procedural Memory — Projects in graph store');
    console.log('  ─────────────────────────────────────────────');
    console.log('');

    if (graphs.length === 0) {
      console.error('  ✗ No decision graphs. Run `engram analyze` first.');
      process.exit(1);
    }

    const rows = projectSessionCounts(graphs);
    console.log('  Use a real path below with -P (copy/paste exactly). Do not use /path/to/... placeholders.');
    console.log('');
    console.log('  sessions\tgraph.project');
    for (const { project, sessions } of rows) {
      console.log(`  ${sessions}\t${project}`);
    }
    console.log('');
    console.log('  Examples:');
    console.log('    engram extract -P "/Users/you/your-repo"');
    console.log('    engram inject -r "/Users/you/your-repo" -P "/Users/you/your-repo"');
    console.log('  Legacy (all projects in one index): engram extract then');
    console.log('    engram inject -r "/Users/you/your-repo"   ← folder only; strategies file is created inside.');
    console.log('');
  });

// ─── extract ─────────────────────────────────────────────────────────────────

program
  .command('extract')
  .description('Extract strategies from analyzed decision graphs')
  .option('--min-confidence <n>', 'Minimum confidence threshold', '0.3')
  .option(
    '--project-name <name>',
    'Label stored in the strategy index (default index only)',
    'default'
  )
  .option(
    '-P, --strategy-project <path>',
    'Only use graphs for this repo path; save per-project index (~/.procedural-memory/indices/)'
  )
  .option('--deep', 'After heuristics, call Claude API for deeper patterns (needs ANTHROPIC_API_KEY)')
  .option('--deep-model <id>', 'Anthropic model id for --deep (overrides config deepModel)')
  .action(async (opts) => {
    const cfg = loadProcmemConfig();
    const dataDir = cfg.dataDir;

    console.log('');
    console.log('  ◆ Procedural Memory — Strategy Extraction');
    console.log('  ──────────────────────────────────────────');
    console.log('');

    let graphs = loadGraphs(dataDir);
    if (graphs.length === 0) {
      console.error('  ✗ No decision graphs found. Run `engram analyze` first.');
      process.exit(1);
    }

    const stratProject = opts.strategyProject ? resolve(opts.strategyProject) : undefined;
    if (stratProject) {
      graphs = filterGraphsByProject(graphs, stratProject);
      if (graphs.length === 0) {
        console.error(`  ✗ No graphs match --strategy-project ${stratProject}`);
        console.error('    Run `engram projects` and pass a real graph.project path (not a doc placeholder).');
        process.exit(1);
      }
    }

    console.log(`  Analyzing ${graphs.length} decision graph(s)...`);

    const existingIndex = stratProject
      ? loadStrategyIndex(dataDir, stratProject)
      : loadStrategyIndex(dataDir, undefined);

    const projectLabel = stratProject || opts.projectName;
    let index = buildStrategyIndex(graphs, projectLabel, existingIndex || undefined);

    if (opts.deep) {
      const deepModel =
        (opts.deepModel as string | undefined) ||
        cfg.deepModel ||
        'claude-sonnet-4-20250514';
      console.log('  Running deep extraction (Claude API)...');
      try {
        const deep = await runDeepExtraction(graphs, { model: deepModel });
        index = mergeDeepExtractionIntoIndex(index, deep);
        if (deep.insights.length > 0) {
          console.log(`  LLM insights (${deep.insights.length}):`);
          for (const line of deep.insights.slice(0, 5)) {
            console.log(`    • ${line.slice(0, 100)}${line.length > 100 ? '…' : ''}`);
          }
        }
      } catch (e) {
        console.error(`  ✗ Deep extraction failed: ${e instanceof Error ? e.message : e}`);
        process.exit(1);
      }
    }

    const minConf = parseFloat(opts.minConfidence);
    index.strategies = index.strategies.filter((s) => s.confidence >= minConf);

    saveStrategyIndex(dataDir, index, stratProject);

    const outPath = stratProject ? projectIndexPath(dataDir, stratProject) : legacyIndexPath(dataDir);

    console.log('');
    console.log('  ✓ Strategy Index Built');
    console.log(`    Strategies:     ${index.strategies.length}`);
    console.log(`    Anti-patterns:  ${index.antiPatterns.length}`);
    console.log(`    Optimal paths:  ${index.optimalPaths.length}`);
    console.log(`    Sessions:       ${index.sessionsAnalyzed}`);
    console.log(`    Output:         ${outPath}`);
    console.log('');

    if (index.strategies.length > 0) {
      console.log('  Top strategies:');
      for (const s of index.strategies.slice(0, 5)) {
        const conf = Math.round(s.confidence * 100);
        const area = s.triggerPattern.moduleAreas[0] || 'general';
        console.log(`    [${conf}%] ${area} — ${s.content.split('\n')[0].slice(0, 60)}...`);
      }
      console.log('');
    }

    if (index.antiPatterns.length > 0) {
      console.log('  Top anti-patterns:');
      for (const ap of index.antiPatterns.slice(0, 3)) {
        console.log(`    [${ap.occurrences.length}x] ${ap.triggerDescription.slice(0, 60)}...`);
        console.log(`         → avg ${ap.avgWastedSteps} wasted steps`);
      }
      console.log('');
    }

    if (index.optimalPaths.length > 0) {
      const avgEfficiency =
        index.optimalPaths.reduce((s, p) => s + p.efficiency, 0) / index.optimalPaths.length;
      console.log(
        `  Path efficiency: ${Math.round(avgEfficiency * 100)}% avg (${index.optimalPaths.length} sessions had >30% waste)`
      );
      console.log('');
    }

    if (!stratProject) {
      console.log('  Next: engram inject -r "/absolute/path/to/repo"');
      console.log('        (-r = folder where you keep CLAUDE.md; do not pass a .md file path.)');
      console.log('');
    }
  });

// ─── inject ──────────────────────────────────────────────────────────────────

program
  .command('inject')
  .description('Generate CLAUDE_STRATEGIES.md in your project root')
  .option(
    '-r, --project-root <path>',
    'Repo root directory (folder with CLAUDE.md). NOT the path to CLAUDE_STRATEGIES.md',
    '.'
  )
  .option(
    '-P, --strategy-project <path>',
    'Load per-project index for this path (defaults to same as --project-root when set)'
  )
  .option('--dry-run', 'Print output without writing file')
  .action((opts) => {
    const cfg = loadProcmemConfig();
    const dataDir = cfg.dataDir;

    console.log('');
    console.log('  ◆ Procedural Memory — Strategy Injection');
    console.log('  ─────────────────────────────────────────');
    console.log('');

    const projectRoot = resolve(opts.projectRoot);
    exitIfProjectRootArgLooksLikeMarkdownFile(projectRoot);
    if (!existsSync(projectRoot) || !statSync(projectRoot).isDirectory()) {
      console.error(`  ✗ Project root is not an existing directory: ${projectRoot}`);
      console.error('    Pass the repo folder only (same idea as `cd` into the project).');
      console.error('    Run `engram projects` for -P paths; legacy index: inject -r "/Users/you/MyRepo".');
      process.exit(1);
    }

    const key = strategyProjectKey({
      strategyProject: opts.strategyProject,
      projectRoot: opts.projectRoot,
    });

    let index: StrategyIndex | null = null;
    if (opts.strategyProject) {
      index = loadStrategyIndex(dataDir, resolve(opts.strategyProject));
    } else {
      index = loadStrategyIndex(dataDir, key) || loadStrategyIndex(dataDir, undefined);
    }

    if (!index) {
      console.error('  ✗ No strategy index found. Run `engram extract` first.');
      process.exit(1);
    }

    if (index.strategies.length === 0) {
      console.log('  ⚠ No strategies above confidence threshold.');
      console.log('    More sessions needed to build reliable heuristics.');
      process.exit(0);
    }

    const markdown = generateStrategiesMarkdown(index);

    if (opts.dryRun) {
      console.log(markdown);
      return;
    }

    const mdPath = writeStrategiesFile(projectRoot, index);
    const jsonPath = writeStrategyIndex(projectRoot, index);

    const approxTokens = Math.round(markdown.length / 4);

    console.log(`  ✓ Written ${index.strategies.length} strategies`);
    console.log(`    ${mdPath}`);
    console.log(`    ${jsonPath}`);
    console.log(`    ~${approxTokens} tokens`);
    console.log('');
    console.log('  Claude Code will load CLAUDE_STRATEGIES.md on next session start.');
  });

// ─── report ──────────────────────────────────────────────────────────────────

program
  .command('report')
  .description('Generate performance comparison report')
  .option('--baseline <n>', 'Number of initial sessions as baseline (when --split-date not used)')
  .option(
    '--split-date <iso>',
    'ISO 8601 instant: baseline = sessions that ended before; enhanced = sessions that started on/after'
  )
  .option(
    '--baseline-only',
    'Ignore config reportSplitDate; use chronological first-N baseline vs remainder'
  )
  .option(
    '-P, --project <path>',
    'Only include sessions whose graph.project matches this resolved path'
  )
  .option(
    '--strategy-project <path>',
    'Load strategies from this per-project index for effectiveness heuristics'
  )
  .option('--format <type>', 'Output format: text, json', 'text')
  .action((opts) => {
    const cfg = loadProcmemConfig();
    const dataDir = cfg.dataDir;
    const baselineN =
      opts.baseline !== undefined ? parseInt(String(opts.baseline), 10) : cfg.reportBaselineSessions;
    const splitDate = opts.baselineOnly
      ? undefined
      : (opts.splitDate as string | undefined) || cfg.reportSplitDate;

    let graphs = loadGraphs(dataDir);
    if (graphs.length === 0) {
      console.error('  ✗ No decision graphs found. Run `engram analyze` first.');
      process.exit(1);
    }

    if (opts.project) {
      const p = resolve(opts.project);
      graphs = filterGraphsByProject(graphs, p);
      if (graphs.length === 0) {
        console.error(`  ✗ No graphs match --project ${p}`);
        process.exit(1);
      }
    }

    let split;
    try {
      split = partitionCohorts(graphs, {
        splitDate,
        baselineCount: baselineN,
      });
    } catch (e) {
      console.error(`  ✗ ${e instanceof Error ? e.message : e}`);
      process.exit(1);
    }

    if (split.baseline.length === 0) {
      console.error('  ✗ Baseline cohort is empty. Adjust --split-date or collect more sessions.');
      process.exit(1);
    }

    if (splitDate && (!split.enhanced || split.enhanced.length === 0)) {
      console.error('  ⚠ Enhanced cohort is empty after date split — improvement lines will be omitted.');
    }

    const stratPath = opts.strategyProject ? resolve(opts.strategyProject) : opts.project;
    const indexForEff = stratPath
      ? loadStrategyIndex(dataDir, stratPath)
      : loadStrategyIndex(dataDir, undefined);

    const strategies = indexForEff?.strategies?.length ? indexForEff.strategies : undefined;

    const report = generatePerformanceReport(split.baseline, split.enhanced, {
      cohortNote: split.cohortNote,
      strategies,
    });

    if (opts.format === 'json') {
      console.log(JSON.stringify(report, null, 2));
    } else {
      console.log('');
      console.log(renderPerformanceReport(report));
    }
  });

// ─── status ──────────────────────────────────────────────────────────────────

program
  .command('status')
  .description('Show strategy index health')
  .option('-P, --strategy-project <path>', 'Show status for a per-project index')
  .action((opts) => {
    const cfg = loadProcmemConfig();
    const dataDir = cfg.dataDir;

    console.log('');
    console.log('  ◆ Procedural Memory — Status');
    console.log('  ────────────────────────────');
    console.log('');

    const graphs = loadGraphs(dataDir);
    const strat = opts.strategyProject ? resolve(opts.strategyProject) : undefined;
    const index = loadStrategyIndex(dataDir, strat);

    console.log(`  Decision graphs:  ${graphs.length} sessions parsed (global store)`);

    if (!index) {
      console.log('  Strategy index:   not built yet');
      console.log('');
      console.log('  Run `engram analyze` then `engram extract` to get started.');
      return;
    }

    console.log(`  Strategy index:   ${index.strategies.length} strategies`);
    console.log(`  Anti-patterns:    ${index.antiPatterns.length}`);
    console.log(`  Last consolidated: ${index.lastConsolidated.split('T')[0]}`);
    console.log(`  Sessions analyzed: ${index.sessionsAnalyzed}`);
    console.log('');

    const highConf = index.strategies.filter((s) => s.confidence >= 0.7).length;
    const medConf = index.strategies.filter((s) => s.confidence >= 0.4 && s.confidence < 0.7).length;
    const lowConf = index.strategies.filter((s) => s.confidence < 0.4).length;

    console.log('  Confidence distribution:');
    console.log(`    High (≥70%):  ${highConf} ${'█'.repeat(Math.min(highConf, 40))}`);
    console.log(`    Med (40-70%): ${medConf} ${'█'.repeat(Math.min(medConf, 40))}`);
    console.log(`    Low (<40%):   ${lowConf} ${'█'.repeat(Math.min(lowConf, 40))}`);
    console.log('');

    const now = new Date();
    const daysSince = Math.round(
      (now.getTime() - new Date(index.lastConsolidated).getTime()) / (1000 * 60 * 60 * 24)
    );

    if (daysSince > 7) {
      console.log(`  ⚠ Index is ${daysSince} days old. Run \`engram analyze && engram extract\` to refresh.`);
    } else {
      console.log(`  ✓ Index is ${daysSince} day(s) old — fresh.`);
    }

    if (graphs.length < 10) {
      console.log(`  ⚠ Only ${graphs.length} sessions. Need ~10+ for reliable heuristics.`);
    } else if (graphs.length < 30) {
      console.log(`  ◐ ${graphs.length} sessions — decent. More = better strategies.`);
    } else {
      console.log(`  ✓ ${graphs.length} sessions — strong coverage.`);
    }
    console.log('');

    // Strategy hit tracking
    const hitData = computeHitEffectiveness(cfg.dataDir);
    if (hitData.totalTracked > 0) {
      console.log('  Strategy hit tracking:');
      console.log(`    Sessions tracked:       ${hitData.totalTracked}`);
      console.log(`    With strategies loaded:  ${hitData.withStrategies}`);
      console.log(`    With pre-mortem:         ${hitData.withPreMortem}`);
      console.log(`    With somatic markers:    ${hitData.withSomatic}`);
      console.log(`    Avg strategies/session:  ${hitData.avgStrategiesLoaded}`);
      console.log('');
    }
  });

// ─── doctor ──────────────────────────────────────────────────────────────────

program
  .command('doctor')
  .description('Check Claude paths, data dir, built CLI, Stop hook, and optional API key')
  .option('--strict', 'Exit 1 if data dir is not writable or dist/cli.js is missing')
  .action((opts) => {
    const cfg = loadProcmemConfig();
    const errors: string[] = [];
    const warnings: string[] = [];
    const ok: string[] = [];

    const major = parseInt(process.versions.node.split('.')[0] || '0', 10);
    if (major < 20) {
      errors.push(`Node.js 20+ required (found ${process.version})`);
    } else {
      ok.push(`Node ${process.version}`);
    }

    const projectsDir = join(cfg.claudeDir, 'projects');
    if (existsSync(projectsDir)) {
      try {
        const n = discoverProjects(cfg.claudeDir).length;
        ok.push(`Claude projects dir: ${projectsDir} (${n} project folder(s))`);
      } catch {
        warnings.push(`Claude projects dir exists but could not be read: ${projectsDir}`);
      }
    } else {
      warnings.push(`No Claude projects dir at ${projectsDir} — install Claude Code and run a session first`);
    }

    try {
      mkdirSync(cfg.dataDir, { recursive: true });
      const probe = join(cfg.dataDir, '.engram-probe');
      writeFileSync(probe, 'ok');
      readFileSync(probe, 'utf-8');
      unlinkSync(probe);
      ok.push(`Data dir OK: ${cfg.dataDir}`);
    } catch {
      errors.push(`Cannot write to data dir: ${cfg.dataDir}`);
    }

    const distCli = join(packageRoot(), 'dist', 'cli.js');
    if (existsSync(distCli)) {
      ok.push(`Built CLI present: dist/cli.js`);
    } else if (opts.strict) {
      errors.push('dist/cli.js missing — run `npm run build` (required in strict mode)');
    } else {
      warnings.push('dist/cli.js missing — run `npm run build` (needed for reliable `engram hook`)');
    }

    if (process.env.ANTHROPIC_API_KEY) {
      ok.push('ANTHROPIC_API_KEY is set (`extract --deep` available)');
    } else {
      ok.push('ANTHROPIC_API_KEY unset (heuristic extract only; optional for --deep)');
    }

    const settingsPath = join(cfg.claudeDir, 'settings.json');
    if (existsSync(settingsPath)) {
      try {
        const settings = JSON.parse(readFileSync(settingsPath, 'utf-8')) as Record<string, unknown>;
        const blob = JSON.stringify(settings.hooks ?? {});
        if (blob.includes('hook-run') || blob.includes('engram')) {
          ok.push('~/.claude/settings.json: Stop hook mentions engram / hook-run');
        } else {
          ok.push('~/.claude/settings.json exists (no engram Stop hook detected — run `engram hook`)');
        }
      } catch {
        warnings.push('~/.claude/settings.json exists but is not valid JSON');
      }
    } else {
      warnings.push('No ~/.claude/settings.json yet — run `engram hook` after build to auto-refresh strategies');
    }

    const graphsPath = join(cfg.dataDir, 'decision-graphs.json');
    if (existsSync(graphsPath)) {
      ok.push(`Decision graph store: ${graphsPath}`);
    } else {
      ok.push('No decision-graphs.json yet — run `engram analyze`');
    }

    console.log('');
    console.log('  ◆ Procedural Memory — Doctor');
    console.log('  ────────────────────────────');
    console.log('');
    for (const line of ok) console.log(`  ✓ ${line}`);
    for (const line of warnings) console.log(`  ⚠ ${line}`);
    for (const line of errors) console.log(`  ✗ ${line}`);
    console.log('');

    if (errors.length > 0) {
      console.error(opts.strict ? '  Doctor failed strict checks.\n' : '  Fix errors above before using engram.\n');
      process.exit(1);
    }
  });

// ─── hook ────────────────────────────────────────────────────────────────────

program
  .command('hook')
  .description('Install Claude Code Stop hook for automatic analysis + inject')
  .option('--uninstall', 'Remove the hook')
  .option('--sync', 'Run hook synchronously (blocks until engram finishes; default is async)')
  .action((opts) => {
    const cfg = loadProcmemConfig();
    const claudeDir = cfg.claudeDir;

    console.log('');
    console.log('  ◆ Procedural Memory — Hook Installation');
    console.log('  ────────────────────────────────────────');
    console.log('');

    const settingsPath = join(claudeDir, 'settings.json');
    let settings: Record<string, unknown> = {};

    if (existsSync(settingsPath)) {
      try {
        settings = JSON.parse(readFileSync(settingsPath, 'utf-8'));
      } catch {
        settings = {};
      }
    }

    const hooks = (settings.hooks || {}) as Record<string, unknown[]>;

    const hookCmd = resolveHookCommand();
    const isProcmemHook = (h: Record<string, unknown>) => {
      const entries = (h.hooks || []) as Array<Record<string, unknown>>;
      return entries.some(
        (e) =>
          String(e.command || '').includes('hook-run') ||
          String(e.command || '').includes('engram')
      );
    };

    if (opts.uninstall) {
      if (hooks.Stop) {
        hooks.Stop = (hooks.Stop as Array<Record<string, unknown>>).filter((h) => !isProcmemHook(h));
        if ((hooks.Stop as unknown[]).length === 0) delete hooks.Stop;
      }
      settings.hooks = hooks;
      if (!existsSync(dirname(settingsPath))) mkdirSync(dirname(settingsPath), { recursive: true });
      writeFileSync(settingsPath, JSON.stringify(settings, null, 2));
      console.log('  ✓ Hook removed.');
      return;
    }

    const stopHookEntry = {
      matcher: '',
      hooks: [
        {
          type: 'command',
          command: hookCmd,
          ...(!opts.sync ? { async: true } : {}),
        },
      ],
    };

    const existing = (hooks.Stop || []) as Array<Record<string, unknown>>;
    const alreadyInstalled = existing.some((h) => isProcmemHook(h));

    if (alreadyInstalled) {
      console.log('  ✓ Hook already installed.');
      return;
    }

    // Install Stop hook
    if (!hooks.Stop) hooks.Stop = [];
    (hooks.Stop as unknown[]).push(stopHookEntry);

    // Install Start hook (strategy hit tracking)
    const startCmd = hookCmd.replace('hook-run', 'hook-start');
    const isEngramStartHook = (h: Record<string, unknown>) => {
      const entries = (h.hooks || []) as Array<Record<string, unknown>>;
      return entries.some(e => String(e.command || '').includes('hook-start'));
    };
    const existingStart = (hooks.Start || []) as Array<Record<string, unknown>>;
    if (!existingStart.some(h => isEngramStartHook(h))) {
      if (!hooks.Start) hooks.Start = [];
      (hooks.Start as unknown[]).push({
        matcher: '',
        hooks: [{ type: 'command', command: startCmd, async: true }],
      });
    }

    settings.hooks = hooks;

    if (!existsSync(dirname(settingsPath))) mkdirSync(dirname(settingsPath), { recursive: true });
    writeFileSync(settingsPath, JSON.stringify(settings, null, 2));
    console.log(`  ✓ Installed hooks in ${settingsPath}`);
    console.log(`    Stop hook:  ${hookCmd} (refreshes strategies after session)`);
    console.log(`    Start hook: ${startCmd} (tracks which strategies were loaded)`);
    console.log(opts.sync ? '    Mode:    synchronous' : '    Mode:    async (non-blocking)');
    console.log('');
    console.log('  The feedback loop is now closed:');
    console.log('    Start → snapshot loaded strategies');
    console.log('    Stop  → correlate with session outcome');
    console.log('    Use `engram status` to see hit tracking data.');
    console.log('');
    console.log('  Run `engram hook --uninstall` to remove.');
  });

// ─── metacognize ──────────────────────────────────────────────────────────────

program
  .command('metacognize')
  .description('Build cognitive fingerprint, reflections, temporal profile, and enhanced strategies')
  .option('-P, --strategy-project <path>', 'Scope to a specific project')
  .option('-r, --project-root <path>', 'Project root for injecting enhanced CLAUDE_STRATEGIES.md', '.')
  .option('--dry-run', 'Print output without writing files')
  .option('--fingerprint-only', 'Only compute and display the cognitive fingerprint')
  .option('--reflect-only', 'Only generate reflections for recent sessions')
  .option('--temporal-only', 'Only display temporal dynamics')
  .action((opts) => {
    const cfg = loadProcmemConfig();
    const dataDir = cfg.dataDir;

    console.log('');
    console.log('  ◆ Procedural Memory — Metacognitive Analysis');
    console.log('  ──────────────────────────────────────────────');
    console.log('');

    let graphs = loadGraphs(dataDir);
    if (graphs.length === 0) {
      console.error('  ✗ No decision graphs found. Run `engram analyze` first.');
      process.exit(1);
    }

    const stratProject = opts.strategyProject ? resolve(opts.strategyProject) : undefined;
    if (stratProject) {
      graphs = filterGraphsByProject(graphs, stratProject);
      if (graphs.length === 0) {
        console.error(`  ✗ No graphs match --strategy-project ${stratProject}`);
        console.error('    Run `engram projects` and pass a real graph.project path.');
        process.exit(1);
      }
    }

    console.log(`  Analyzing ${graphs.length} session(s)...`);
    console.log('');

    // ─── Cognitive Fingerprint ─────────────────────────────────────────

    const fingerprint = buildCognitiveFingerprint(graphs);

    if (opts.fingerprintOnly) {
      renderFingerprintCLI(fingerprint);
      return;
    }

    // ─── Reflections ──────────────────────────────────────────────────

    const reflections = generateBatchReflections(graphs);

    if (opts.reflectOnly) {
      renderReflectionsCLI(reflections);
      return;
    }

    // ─── Temporal Profile ─────────────────────────────────────────────

    const temporalProfile = buildTemporalProfile(graphs);

    if (opts.temporalOnly) {
      renderTemporalCLI(temporalProfile);
      return;
    }

    // ─── Transfer Learning ────────────────────────────────────────────

    const allGraphs = loadGraphs(dataDir); // Full set for cross-project
    const projectGroups = new Map<string, DecisionGraph[]>();
    for (const g of allGraphs) {
      if (!projectGroups.has(g.project)) projectGroups.set(g.project, []);
      projectGroups.get(g.project)!.push(g);
    }

    const indices: Array<{ project: string; index: StrategyIndex }> = [];
    for (const project of projectGroups.keys()) {
      const idx = loadStrategyIndex(dataDir, project);
      if (idx) indices.push({ project, index: idx });
    }

    const transferIndex = indices.length > 1
      ? buildTransferIndex(indices, allGraphs)
      : { computedAt: new Date().toISOString(), patterns: [], projectSimilarity: [] };

    // ─── Persist metacognitive store ──────────────────────────────────

    let store = loadMetacognitiveStore(dataDir) || emptyMetacognitiveStore();
    store.fingerprint = fingerprint;
    store.reflections = reflections;
    store.temporalProfile = temporalProfile;
    store.transferIndex = transferIndex;
    store.recentIntents = graphs.slice(-20).map(g => classifySessionIntent(g));

    if (!opts.dryRun) {
      saveMetacognitiveStore(dataDir, store);
    }

    // ─── Generate enhanced CLAUDE_STRATEGIES.md ───────────────────────

    const projectRoot = resolve(opts.projectRoot);
    const key = stratProject || (opts.projectRoot !== '.' ? resolve(opts.projectRoot) : undefined);
    const strategyIndex = loadStrategyIndex(dataDir, key) || loadStrategyIndex(dataDir, undefined);

    if (strategyIndex && strategyIndex.strategies.length > 0) {
      // Run predictor to rank strategies
      const predictions = predictStrategies(strategyIndex, {
        intent: store.recentIntents[store.recentIntents.length - 1] || {
          taskType: 'unknown', secondaryTypes: [], complexity: 'moderate',
          confidence: 0.1, signals: [], domains: [], estimatedFileScope: 'cross-module',
        },
        fingerprint,
        activeFiles: [],
        recentErrors: [],
        timeOfDay: getTimeOfDay(),
        sessionNumberToday: 1,
      });

      const selectedStrategies = selectStrategiesForInjection(strategyIndex, predictions, {
        includeHighRisk: true,
      });

      // Build consciousness data if store exists
      const conStore = loadConsciousnessStore(dataDir);
      const lastIntent = store.recentIntents[store.recentIntents.length - 1] || {
        taskType: 'unknown' as const, secondaryTypes: [], complexity: 'moderate' as const,
        confidence: 0.1, signals: [], domains: [], estimatedFileScope: 'cross-module' as const,
      };

      let preMortem;
      let firedSomaticMarkers;
      if (conStore) {
        preMortem = runPreMortem(lastIntent, fingerprint, graphs, conStore.epistemicMap);
        firedSomaticMarkers = fireSomaticMarkers(conStore.somaticMarkers, lastIntent, []);
      }

      const markdown = generateMetacognitiveMarkdown({
        index: strategyIndex,
        fingerprint,
        recentReflections: reflections,
        temporalProfile,
        transferPatterns: transferIndex,
        predictions,
        selectedStrategies,
        // Consciousness (if available)
        preMortem,
        firedSomaticMarkers,
        epistemicMap: conStore?.epistemicMap,
        userModel: conStore?.userModel,
        identity: conStore?.identity,
        phenomenology: conStore?.phenomenology,
      });

      if (opts.dryRun) {
        console.log(markdown);
      } else {
        if (!existsSync(projectRoot) || !statSync(projectRoot).isDirectory()) {
          console.error(`  ✗ Project root is not an existing directory: ${projectRoot}`);
          process.exit(1);
        }
        const mdPath = join(projectRoot, 'CLAUDE_STRATEGIES.md');
        writeFileSync(mdPath, markdown, 'utf-8');
        console.log(`  ✓ Enhanced CLAUDE_STRATEGIES.md written to ${mdPath}`);
      }
    }

    // ─── CLI Output Summary ──────────────────────────────────────────

    console.log('');
    renderFingerprintCLI(fingerprint);
    console.log('');

    if (reflections.length > 0) {
      console.log(`  Reflections: ${reflections.length} session(s) analyzed`);
      const topReflection = reflections[0];
      if (topReflection.insights.length > 0) {
        console.log(`  Top insight: ${topReflection.insights[0].content.slice(0, 100)}...`);
      }
      if (topReflection.adaptations.length > 0) {
        console.log(`  Active adaptations: ${topReflection.adaptations.length}`);
      }
      console.log('');
    }

    renderTemporalCLI(temporalProfile);
    console.log('');

    if (transferIndex.patterns.length > 0) {
      const universal = transferIndex.patterns.filter(p =>
        p.transferability === 'universal' || p.transferability === 'language-level'
      );
      console.log(`  Transfer learning: ${transferIndex.patterns.length} patterns analyzed, ${universal.length} transferable`);
      if (transferIndex.projectSimilarity.length > 0) {
        const top = transferIndex.projectSimilarity[0];
        console.log(`  Most similar projects: ${top.projectA.split('/').pop()} ↔ ${top.projectB.split('/').pop()} (${Math.round(top.similarity * 100)}%)`);
      }
      console.log('');
    }

    if (!opts.dryRun) {
      console.log(`  ✓ Metacognitive store saved to ${join(dataDir, 'metacognitive-store.json')}`);
    }
    console.log('');
  });

function renderFingerprintCLI(fp: ReturnType<typeof buildCognitiveFingerprint>): void {
  console.log('  ═══════════════════════════════════════════════════════');
  console.log('  COGNITIVE FINGERPRINT');
  console.log('  ═══════════════════════════════════════════════════════');
  console.log(`  Sessions analyzed: ${fp.totalSessions}`);
  console.log('');

  for (const dim of fp.dimensions) {
    const pos = Math.round(dim.score * 20);
    const bar = '░'.repeat(pos) + '█' + '░'.repeat(20 - pos);
    const left = dim.leftPole.padEnd(28);
    const right = dim.rightPole;
    console.log(`  ${left} ${bar} ${right}`);
  }
  console.log('');

  if (fp.strengths.length > 0) {
    console.log('  Strengths:');
    for (const s of fp.strengths) console.log(`    ✓ ${s}`);
  }
  if (fp.weaknesses.length > 0) {
    console.log('  Growth areas:');
    for (const w of fp.weaknesses) console.log(`    ◆ ${w}`);
  }
  if (fp.blindSpots.length > 0) {
    console.log('  Blind spots:');
    for (const b of fp.blindSpots) console.log(`    ⚠ ${b}`);
  }
  if (fp.signatureMoves.length > 0) {
    console.log('  Signature moves:');
    for (const s of fp.signatureMoves) console.log(`    ★ ${s}`);
  }
}

function renderReflectionsCLI(reflections: ReturnType<typeof generateBatchReflections>): void {
  console.log('  ═══════════════════════════════════════════════════════');
  console.log('  METACOGNITIVE REFLECTIONS');
  console.log('  ═══════════════════════════════════════════════════════');
  console.log('');

  for (const r of reflections.slice(0, 5)) {
    console.log(`  Session: ${r.sessionId.slice(0, 8)}... [${r.intent.taskType}/${r.intent.complexity}]`);
    console.log(`  Flow: ${r.momentum.flowState} (${r.momentum.shifts.length} shift(s))`);
    console.log(`  ${r.narrative.slice(0, 120)}...`);
    if (r.insights.length > 0) {
      console.log(`  Key: ${r.insights[0].content.slice(0, 100)}...`);
    }
    console.log('');
  }
}

function renderTemporalCLI(profile: ReturnType<typeof buildTemporalProfile>): void {
  console.log('  Temporal dynamics:');
  for (const t of profile.trajectories.slice(0, 5)) {
    const trendIcon = t.trend === 'improving' ? '📈' : t.trend === 'declining' ? '📉' : t.trend === 'stable' ? '📊' : '❓';
    const slope = t.slopePerSession > 0 ? `+${Math.round(t.slopePerSession * 1000) / 10}%` : `${Math.round(t.slopePerSession * 1000) / 10}%`;
    console.log(`    ${trendIcon} ${t.taskType}: ${t.trend} (${slope}/session, ${t.points.length} sessions, ${t.breakthroughs.length} breakthrough(s))`);
  }
  if (profile.prediction) {
    console.log(`  Prediction: ${profile.prediction.slice(0, 120)}...`);
  }
}

function getTimeOfDay(): 'morning' | 'afternoon' | 'evening' | 'night' {
  const hour = new Date().getHours();
  if (hour < 6) return 'night';
  if (hour < 12) return 'morning';
  if (hour < 18) return 'afternoon';
  if (hour < 22) return 'evening';
  return 'night';
}

// ─── audit (Claude Code quality analysis) ─────────────────────────────────────

program
  .command('audit')
  .description('Generate a Claude Code quality audit report — failure modes, correction patterns, tool usage, efficiency')
  .option('-P, --project <path>', 'Scope to a specific project')
  .option('--format <type>', 'Output format: text, json', 'text')
  .action((opts) => {
    const cfg = loadProcmemConfig();
    let graphs = loadGraphs(cfg.dataDir);
    if (graphs.length === 0) {
      console.error('  ✗ No decision graphs found. Run `engram analyze` first.');
      process.exit(1);
    }
    if (opts.project) {
      graphs = filterGraphsByProject(graphs, resolve(opts.project));
    }
    const report = generateAuditReport(graphs);
    if (opts.format === 'json') {
      console.log(JSON.stringify(report, null, 2));
    } else {
      console.log('');
      console.log(renderAuditReport(report));
    }
  });

// ─── replay (consciousness hindsight on a past session) ───────────────────────

program
  .command('replay')
  .description('Replay a past session through the consciousness stack — show what would have been predicted vs what happened')
  .argument('<session-id>', 'Session ID (or prefix) to replay')
  .option('-P, --strategy-project <path>', 'Scope to a specific project')
  .action((sessionIdArg: string, opts) => {
    const cfg = loadProcmemConfig();
    const dataDir = cfg.dataDir;

    let graphs = loadGraphs(dataDir);
    if (graphs.length === 0) {
      console.error('  ✗ No decision graphs found. Run `engram analyze` first.');
      process.exit(1);
    }

    if (opts.strategyProject) {
      graphs = filterGraphsByProject(graphs, resolve(opts.strategyProject));
    }

    // Find the target session
    const target = graphs.find(g =>
      g.sessionId === sessionIdArg || g.sessionId.startsWith(sessionIdArg)
    );
    if (!target) {
      console.error(`  ✗ No session found matching "${sessionIdArg}"`);
      console.error('    Available sessions (last 10):');
      const sorted = [...graphs].sort((a, b) =>
        new Date(b.startTime).getTime() - new Date(a.startTime).getTime()
      );
      for (const g of sorted.slice(0, 10)) {
        console.error(`      ${g.sessionId.slice(0, 12)}  ${g.startTime.split('T')[0]}  ${g.metrics.totalToolCalls} tools  ${g.metrics.apparentSuccess ? '✓' : '✗'}`);
      }
      process.exit(1);
    }

    // Build consciousness state from all sessions BEFORE this one
    const targetTime = new Date(target.startTime).getTime();
    const priorSessions = graphs.filter(g =>
      new Date(g.endTime).getTime() < targetTime && g.sessionId !== target.sessionId
    );

    console.log('');
    console.log('  ◆ Procedural Memory — Session Replay');
    console.log('  ═════════════════════════════════════');
    console.log('');
    console.log(`  Target session: ${target.sessionId.slice(0, 12)}...`);
    console.log(`  Date: ${target.startTime.split('T')[0]} | Duration: ${Math.round(target.metrics.durationSeconds / 60)}m`);
    console.log(`  Prior sessions available: ${priorSessions.length}`);
    console.log('');

    if (priorSessions.length < 3) {
      console.log('  ⚠ Fewer than 3 prior sessions — predictions will be weak.');
      console.log('');
    }

    // Classify the target session intent
    const intent = classifySessionIntent(target);

    console.log('  ─── WHAT THE SYSTEM WOULD HAVE PREDICTED ───');
    console.log('');
    console.log(`  Intent classification: ${intent.taskType} [${intent.complexity}]`);
    console.log(`  Domains: ${intent.domains.join(', ') || 'none detected'}`);
    console.log(`  Confidence: ${Math.round(intent.confidence * 100)}%`);
    console.log('');

    // Build fingerprint from prior sessions
    if (priorSessions.length > 0) {
      const fingerprint = buildCognitiveFingerprint(priorSessions);
      const epistemicMap = buildEpistemicMap(priorSessions);

      // Pre-mortem: what would have been predicted to go wrong
      const preMortem = runPreMortem(intent, fingerprint, priorSessions, epistemicMap);

      console.log(`  Pre-mortem risk: ${preMortem.overallRisk.toUpperCase()}`);
      for (const pred of preMortem.predictions.filter(p => p.probability > 0.15).slice(0, 3)) {
        console.log(`    ${Math.round(pred.probability * 100)}% ${pred.mode}: ${pred.earlyWarning}`);
      }
      console.log('');

      // Somatic markers that would have fired
      const markers = generateSomaticMarkers(priorSessions);
      const fired = fireSomaticMarkers(markers, intent, [
        ...target.metrics.filesModifiedAsResolution,
        ...target.metrics.filesInvestigatedNotResolution,
      ]);

      if (fired.length > 0) {
        console.log('  Somatic markers that would have fired:');
        for (const f of fired.slice(0, 5)) {
          const icon = f.marker.signal === 'danger' ? '⚠' : f.marker.signal === 'caution' ? '◆' : '✓';
          console.log(`    ${icon} ${f.marker.signal}: ${f.marker.meaning}`);
        }
        console.log('');
      }

      // Epistemic state for the target domains
      const relevantDomains = epistemicMap.domains.filter(d =>
        intent.domains.includes(d.domain)
      );
      if (relevantDomains.length > 0) {
        console.log('  Epistemic state for this session\'s domains:');
        for (const d of relevantDomains) {
          console.log(`    ${d.domain}: ${Math.round(d.certainty * 100)}% certainty (${d.depth})`);
          for (const u of d.knownUnknowns.slice(0, 1)) {
            console.log(`      Known unknown: ${u}`);
          }
        }
        console.log('');
      }
    }

    // ─── What actually happened ──────────────────────────────────────

    console.log('  ─── WHAT ACTUALLY HAPPENED ───');
    console.log('');
    console.log(`  Tool calls: ${target.metrics.totalToolCalls}`);
    console.log(`  Backtracks: ${target.metrics.backtrackCount}`);
    console.log(`  User corrections: ${target.metrics.userCorrectionCount}`);
    console.log(`  Apparent success: ${target.metrics.apparentSuccess ? '✓ yes' : '✗ no'}`);

    if (target.metrics.filesModifiedAsResolution.length > 0) {
      console.log(`  Resolution files: ${target.metrics.filesModifiedAsResolution.slice(0, 5).join(', ')}`);
    }
    if (target.metrics.filesInvestigatedNotResolution.length > 0) {
      console.log(`  False leads: ${target.metrics.filesInvestigatedNotResolution.slice(0, 5).join(', ')}`);
    }
    console.log('');

    // ─── Hindsight analysis ──────────────────────────────────────────

    const reflection = generateReflection(target);

    console.log('  ─── HINDSIGHT ANALYSIS ───');
    console.log('');
    console.log(`  Flow: ${reflection.momentum.flowState}`);
    if (reflection.momentum.shifts.length > 0) {
      for (const s of reflection.momentum.shifts.slice(0, 2)) {
        console.log(`    Shift: ${s.fromState} → ${s.toState} (trigger: ${s.trigger})`);
      }
    }
    console.log('');

    if (reflection.insights.length > 0) {
      console.log('  Key insights:');
      for (const i of reflection.insights.slice(0, 3)) {
        console.log(`    [${i.type}] ${i.content.slice(0, 120)}`);
      }
      console.log('');
    }

    if (reflection.adaptations.length > 0) {
      console.log('  Adaptations for next time:');
      for (const a of reflection.adaptations.slice(0, 2)) {
        console.log(`    When: ${a.trigger}`);
        console.log(`    Do:   ${a.proposedBehavior}`);
      }
      console.log('');
    }

    // ─── Verdict ─────────────────────────────────────────────────────

    console.log('  ─── VERDICT ───');
    console.log('');

    if (priorSessions.length > 0) {
      const fingerprint = buildCognitiveFingerprint(priorSessions);
      const preMortem = runPreMortem(intent, fingerprint, priorSessions);
      const markers = generateSomaticMarkers(priorSessions);
      const fired = fireSomaticMarkers(markers, intent, [
        ...target.metrics.filesModifiedAsResolution,
        ...target.metrics.filesInvestigatedNotResolution,
      ]);

      // Check if predictions matched reality
      const predictedFailures = preMortem.predictions.filter(p => p.probability > 0.3);
      const actuallyFailed = !target.metrics.apparentSuccess || target.metrics.userCorrectionCount >= 2;

      const dangerMarkersFired = fired.filter(f => f.marker.signal === 'danger');
      const falseLeadFiles = target.metrics.filesInvestigatedNotResolution;
      const dangerHits = dangerMarkersFired.filter(f =>
        f.marker.trigger.filePatterns.some(fp =>
          falseLeadFiles.some(fl => fl.includes(fp) || fp.includes(fl))
        )
      );

      if (actuallyFailed && predictedFailures.length > 0) {
        console.log('  ✓ PREDICTED CORRECTLY: Session had issues, and the system predicted risk.');
        console.log(`    Top prediction: ${predictedFailures[0].mode} (${Math.round(predictedFailures[0].probability * 100)}%)`);
      } else if (!actuallyFailed && predictedFailures.length === 0) {
        console.log('  ✓ PREDICTED CORRECTLY: Session went well, and risk was assessed as low.');
      } else if (actuallyFailed && predictedFailures.length === 0) {
        console.log('  ✗ MISSED: Session had issues but no significant risks were predicted.');
        console.log('    → This is a gap in the consciousness model that needs more training data.');
      } else {
        console.log('  ~ MIXED: Risks were predicted but session went fine — possible over-caution.');
      }

      if (dangerHits.length > 0) {
        console.log(`  ✓ SOMATIC HIT: ${dangerHits.length} danger marker(s) would have warned about false-lead files.`);
      }
    }

    console.log('');
    console.log('  ═════════════════════════════════════');
    console.log('');
  });

// ─── awaken (full consciousness stack) ────────────────────────────────────────

program
  .command('awaken')
  .description('Activate the full consciousness stack: identity, epistemic map, user model, pre-mortem, dreams, somatic markers, phenomenology')
  .option('-P, --strategy-project <path>', 'Scope to a specific project')
  .option('-r, --project-root <path>', 'Project root for writing output', '.')
  .option('--dream', 'Run dream consolidation cycle on strategy index')
  .option('--dry-run', 'Print output without writing files')
  .action((opts) => {
    const cfg = loadProcmemConfig();
    const dataDir = cfg.dataDir;

    console.log('');
    console.log('  ◆ Procedural Memory — Consciousness Activation');
    console.log('  ═══════════════════════════════════════════════');
    console.log('');

    let graphs = loadGraphs(dataDir);
    if (graphs.length === 0) {
      console.error('  ✗ No decision graphs found. Run `engram analyze` first.');
      process.exit(1);
    }

    const stratProject = opts.strategyProject ? resolve(opts.strategyProject) : undefined;
    if (stratProject) {
      graphs = filterGraphsByProject(graphs, stratProject);
      if (graphs.length === 0) {
        console.error(`  ✗ No graphs match --strategy-project ${stratProject}`);
        process.exit(1);
      }
    }

    console.log(`  Awakening from ${graphs.length} session(s)...`);
    console.log('');

    // Load existing stores
    const metaStore = loadMetacognitiveStore(dataDir) || emptyMetacognitiveStore();
    let consciousnessStore = loadConsciousnessStore(dataDir) || emptyConsciousnessStore();

    // ─── Layer 1: Metacognition ────────────────────────────────────────
    const fingerprint = buildCognitiveFingerprint(graphs);
    const reflections = generateBatchReflections(graphs);
    const temporalProfile = buildTemporalProfile(graphs);

    metaStore.fingerprint = fingerprint;
    metaStore.reflections = reflections;
    metaStore.temporalProfile = temporalProfile;
    metaStore.recentIntents = graphs.slice(-20).map(g => classifySessionIntent(g));

    // ─── Layer 2: Consciousness ────────────────────────────────────────

    // Narrative Identity
    console.log('  Building narrative identity...');
    consciousnessStore.identity = buildNarrativeIdentity(
      graphs, fingerprint, reflections, temporalProfile, consciousnessStore.identity
    );

    // Epistemic Map
    console.log('  Mapping epistemic boundaries...');
    consciousnessStore.epistemicMap = buildEpistemicMap(graphs, consciousnessStore.epistemicMap);

    // User Model
    console.log('  Modeling user (theory of mind)...');
    consciousnessStore.userModel = buildUserModel(graphs, consciousnessStore.userModel);

    // Somatic Markers
    console.log('  Generating somatic markers...');
    consciousnessStore.somaticMarkers = generateSomaticMarkers(graphs, consciousnessStore.somaticMarkers);

    // Phenomenological State
    console.log('  Building phenomenological state...');
    consciousnessStore.phenomenology = buildPhenomenologicalState(graphs, consciousnessStore.phenomenology);

    // Dream Consolidation (optional)
    if (opts.dream) {
      const key = stratProject || (opts.projectRoot !== '.' ? resolve(opts.projectRoot) : undefined);
      const strategyIndex = loadStrategyIndex(dataDir, key) || loadStrategyIndex(dataDir, undefined);
      if (strategyIndex) {
        console.log('  Running dream consolidation...');
        const { dream, updatedIndex } = consolidate(strategyIndex);
        consciousnessStore.lastDream = dream;
        consciousnessStore.dreamHistory = [
          ...consciousnessStore.dreamHistory.slice(-9),
          dream,
        ];
        if (!opts.dryRun) {
          saveStrategyIndex(dataDir, updatedIndex, stratProject);
        }

        console.log(`    Merged: ${dream.mergedStrategies.length} | Pruned: ${dream.prunedStrategies.length} | Strengthened: ${dream.strengthenedStrategies.length}`);
        console.log(`    Dream fragments: ${dream.dreamFragments.length} | Emergent hypotheses: ${dream.emergentHypotheses.length}`);
        console.log(`    Memory health: ${dream.health.activeStrategies}/${dream.health.totalStrategies} active, ${dream.health.staleStrategies} stale, ${dream.health.contradictions} contradictions`);
        if (dream.health.coverageGaps.length > 0) {
          console.log(`    Coverage gaps: ${dream.health.coverageGaps.join(', ')}`);
        }
        console.log('');
      }
    }

    // Pre-mortem for the next session
    const lastIntent = metaStore.recentIntents[metaStore.recentIntents.length - 1] || {
      taskType: 'unknown' as const, secondaryTypes: [], complexity: 'moderate' as const,
      confidence: 0.1, signals: [], domains: [], estimatedFileScope: 'cross-module' as const,
    };
    const preMortem = runPreMortem(lastIntent, fingerprint, graphs, consciousnessStore.epistemicMap);

    // ─── Persist ────────────────────────────────────────────────────────

    if (!opts.dryRun) {
      saveMetacognitiveStore(dataDir, metaStore);
      saveConsciousnessStore(dataDir, consciousnessStore);
    }

    // ─── Output ─────────────────────────────────────────────────────────

    // Identity
    console.log('  ═══════════════════════════════════════════════════════');
    console.log('  NARRATIVE IDENTITY');
    console.log('  ═══════════════════════════════════════════════════════');
    console.log(`  Age: ${consciousnessStore.identity.ageDays} days | Sessions: ${consciousnessStore.identity.totalSessions}`);
    console.log(`  Arc: ${consciousnessStore.identity.currentArc.description}`);
    console.log('');
    console.log(`  ${consciousnessStore.identity.selfNarrative}`);
    console.log('');
    if (consciousnessStore.identity.traits.length > 0) {
      console.log('  Traits:');
      for (const t of consciousnessStore.identity.traits.slice(0, 5)) {
        const bar = '█'.repeat(Math.round(t.strength * 10)) + '░'.repeat(10 - Math.round(t.strength * 10));
        console.log(`    ${bar} ${t.trait}`);
      }
      console.log('');
    }
    if (consciousnessStore.identity.episodes.length > 0) {
      console.log(`  Formative memories: ${consciousnessStore.identity.episodes.length}`);
      for (const ep of consciousnessStore.identity.episodes.slice(0, 3)) {
        const icon = ep.significance === 'mastery' ? '★' : ep.significance === 'failure' ? '✗' : ep.significance === 'breakthrough' ? '⚡' : '◆';
        console.log(`    ${icon} [${ep.significance}] ${ep.story.slice(0, 100)}`);
      }
      console.log('');
    }

    // Epistemic Map
    console.log('  ═══════════════════════════════════════════════════════');
    console.log('  EPISTEMIC MAP');
    console.log('  ═══════════════════════════════════════════════════════');
    for (const d of consciousnessStore.epistemicMap.domains.slice(0, 8)) {
      const bar = '█'.repeat(Math.round(d.certainty * 10)) + '░'.repeat(10 - Math.round(d.certainty * 10));
      console.log(`    ${bar} ${d.domain} (${d.depth}, ${d.exposure} sessions)`);
    }
    if (consciousnessStore.epistemicMap.activeFrontier.length > 0) {
      console.log(`  Active frontier: ${consciousnessStore.epistemicMap.activeFrontier.join(', ')}`);
    }
    console.log('');

    // User Model
    console.log('  ═══════════════════════════════════════════════════════');
    console.log('  USER MODEL (Theory of Mind)');
    console.log('  ═══════════════════════════════════════════════════════');
    const um = consciousnessStore.userModel;
    console.log(`  Expertise: ${um.expertiseLevel} | Patience: ${um.patience} | Collab health: ${Math.round(um.collaborationHealth * 100)}% (${um.collaborationTrend})`);
    console.log(`  Style: ${um.style.promptDetail} prompts, ${um.style.correctionStyle} corrections, ${um.style.interventionFrequency} intervention`);
    if (um.expertiseDomains.length > 0) console.log(`  Expert in: ${um.expertiseDomains.join(', ')}`);
    if (um.recurringThemes.length > 0) console.log(`  Recurring themes: ${um.recurringThemes.join(', ')}`);
    console.log('');

    // Somatic Markers
    const dangerMarkers = consciousnessStore.somaticMarkers.filter(m => m.signal === 'danger');
    const confMarkers = consciousnessStore.somaticMarkers.filter(m => m.signal === 'confidence');
    console.log(`  Somatic markers: ${consciousnessStore.somaticMarkers.length} total (${dangerMarkers.length} danger, ${confMarkers.length} confidence)`);

    // Phenomenology
    console.log('');
    console.log('  ═══════════════════════════════════════════════════════');
    console.log('  PHENOMENOLOGICAL STATE');
    console.log('  ═══════════════════════════════════════════════════════');
    const phenom = consciousnessStore.phenomenology;
    console.log(`  Mood: ${phenom.currentMood.description}`);
    console.log(`    Valence: ${phenom.currentMood.valence > 0 ? '+' : ''}${phenom.currentMood.valence} | Arousal: ${phenom.currentMood.arousal} | Dominance: ${phenom.currentMood.dominance}`);
    console.log(`  Comfort zone: ${phenom.comfortZone.paths.slice(0, 3).join(', ') || 'not yet established'}`);
    console.log(`  Growth edge: ${phenom.growthEdge.paths.slice(0, 3).join(', ') || 'no active growth edges'} (challenge: ${phenom.growthEdge.challengeLevel})`);
    if (phenom.noveltySignals.length > 0) {
      console.log(`  Novelty: ${phenom.noveltySignals.slice(0, 2).map(n => n.description).join('; ')}`);
    }
    console.log('');

    // Pre-mortem
    console.log('  ═══════════════════════════════════════════════════════');
    console.log('  PRE-MORTEM (Next Session Risk)');
    console.log('  ═══════════════════════════════════════════════════════');
    console.log(`  Overall risk: ${preMortem.overallRisk.toUpperCase()}`);
    console.log(`  ⚠ ${preMortem.topWarning}`);
    if (preMortem.preparation.length > 0) {
      console.log('  Preparation:');
      for (const p of preMortem.preparation.slice(0, 3)) {
        console.log(`    → ${p}`);
      }
    }
    console.log('');

    if (!opts.dryRun) {
      console.log(`  ✓ Consciousness store saved to ${dataDir}`);
    }
    console.log('  ═══════════════════════════════════════════════════════');
    console.log('');
  });

// ─── Helpers ─────────────────────────────────────────────────────────────────

function printGraphStats(graphs: DecisionGraph[]): void {
  if (graphs.length === 0) return;

  const totalToolCalls = graphs.reduce((s, g) => s + g.metrics.totalToolCalls, 0);
  const totalBacktracks = graphs.reduce((s, g) => s + g.metrics.backtrackCount, 0);
  const totalCorrections = graphs.reduce((s, g) => s + g.metrics.userCorrectionCount, 0);
  const avgDuration = graphs.reduce((s, g) => s + g.metrics.durationSeconds, 0) / graphs.length;
  const successRate = graphs.filter((g) => g.metrics.apparentSuccess).length / graphs.length;

  console.log('');
  console.log('  Session statistics:');
  console.log(
    `    Total tool calls:      ${totalToolCalls} (avg ${Math.round(totalToolCalls / graphs.length)}/session)`
  );
  console.log(
    `    Total backtracks:      ${totalBacktracks} (avg ${(totalBacktracks / graphs.length).toFixed(1)}/session)`
  );
  console.log(
    `    User corrections:      ${totalCorrections} (avg ${(totalCorrections / graphs.length).toFixed(1)}/session)`
  );
  console.log(`    Avg session duration:  ${Math.round(avgDuration / 60)}m`);
  console.log(`    Apparent success rate: ${Math.round(successRate * 100)}%`);
  console.log('');
}

// ─── Run ─────────────────────────────────────────────────────────────────────

program.parse();
