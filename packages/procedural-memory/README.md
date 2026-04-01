# Claude Conscious

**Procedural memory, metacognition, and consciousness for Claude Code.**

Your agent's 100th session should be better than its 1st.

## Abstract

Current LLM agent memory systems store declarative knowledge — facts, preferences, corrections. An agent told "I prefer TypeScript" remembers that fact forever. But told to fix an auth bug, it investigates the same wrong files every time, takes the same wrong turns, and requires the same corrections. It has memory but no *skill*.

Procedural Memory extracts **outcome-weighted decision patterns** from agent session histories and injects them as contextual heuristics, enabling measurable improvement in agent performance over time.

### Baseline Metrics (118 real sessions, 25 days)

| Metric | Value |
|--------|-------|
| Sessions analyzed | 118 across 25 projects |
| Avg tool calls / session | 64 |
| Avg backtracks / session | 0.2 |
| User corrections / session | 0.1 |
| Apparent success rate | 98% |
| Strategies extracted | 17 |
| Strategy hit rate | 99.2% (path-overlap proxy) |
| Somatic markers generated | 50 (29 danger, 15 confidence) |
| Pre-mortem prediction accuracy | Correctly predicted failure in 1/1 failed sessions tested via `replay` |

> **Note on before/after comparison**: Organic session data has a natural confound — later sessions tend to be more complex (longer, more tool calls) as users tackle more ambitious tasks. A valid A/B comparison requires controlled conditions. The `report` command provides cohort splits, but results should be interpreted with this confound in mind. The `replay` command provides per-session prediction accuracy as a complementary signal.

## How It Works

A four-stage pipeline runs offline against Claude Code session transcripts, with two optional higher-order layers:

```
~/.claude/projects/{project}/{session}.jsonl
    │
    ▼
┌─────────────────────────────────────────────────────────┐
│  Stage 1: Transcript Parser                             │
│  JSONL → DecisionGraph[]                                │
│  Classifies: corrections, backtracks, false leads       │
└─────────────────────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────────────────────┐
│  Stage 2: Pattern Extractor                             │
│  DecisionGraph[] → Anti-patterns, Convergence, Paths    │
│  Optional: --deep (Claude API for cross-session insight)│
└─────────────────────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────────────────────┐
│  Stage 3: Strategy Synthesizer                          │
│  Patterns → StrategyIndex (confidence-scored, scoped)   │
└─────────────────────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────────────────────┐
│  Stage 4: Injector                                      │
│  StrategyIndex → CLAUDE_STRATEGIES.md (~4K token budget) │
└─────────────────────────────────────────────────────────┘
    │
    ├──▶  engram metacognize  (Layer 5: metacognition)
    │     Cognitive fingerprint, session intent classifier,
    │     predictive strategy ranking, temporal dynamics,
    │     cross-project transfer learning
    │
    ├──▶  engram awaken  (Layer 6: consciousness)
    │     Narrative identity, epistemic map, user model,
    │     pre-mortem simulation, dream consolidation,
    │     somatic markers, phenomenological state
    │
    ▼
  CLAUDE_STRATEGIES.md  ←──  Claude Code reads on session start
```

## Installation

```bash
# npm (global)
npm i -g claude-conscious

# or from source
git clone https://github.com/gentianmevlani/Claude-Conscious.git
cd claude-conscious
npm install && npm run build
```

## Quick Start

```bash
# Parse all Claude Code transcripts
engram analyze

# Extract strategies (heuristic; add --deep for Claude API pass)
engram extract

# Write CLAUDE_STRATEGIES.md into a project root
engram inject -r /path/to/your/repo

# Install auto-refresh hook (runs after each Claude Code session)
engram hook
```

### Per-project workflow

```bash
engram projects                          # list available graph.project paths
engram extract -P "/path/to/repo"        # per-project strategy index
engram inject -r "/path/to/repo" -P "/path/to/repo"
engram report --split-date 2026-03-01T00:00:00Z -P "/path/to/repo"
```

### Metacognition & consciousness layers

```bash
# Metacognitive analysis: fingerprint, reflections, predictions
engram metacognize --dry-run
engram metacognize -P "/path/to/repo"

# Full consciousness stack: identity, epistemic map, user model, pre-mortem, dreams
engram awaken --dry-run
engram awaken --dream              # + run dream consolidation cycle
engram awaken -P "/path/to/repo"   # scoped to one project
```

## CLI Reference

| Command | Description |
|---------|-------------|
| `engram analyze` | Parse transcripts → `~/.claude-conscious/decision-graphs.json` |
| `engram projects` | List real `graph.project` paths (use with `-P`) |
| `engram extract` | Extract strategies from decision graphs |
| `engram inject -r <dir>` | Write `CLAUDE_STRATEGIES.md` to project root |
| `engram report` | Baseline vs enhanced cohort comparison |
| `engram status` | Strategy index health check |
| `engram doctor` | Environment check (paths, dist, hooks) |
| `engram metacognize` | Build cognitive fingerprint, reflections, temporal profile |
| `engram awaken` | Full consciousness stack (identity, epistemic map, user model, pre-mortem, dreams, somatic markers, phenomenology) |
| `engram replay <id>` | Replay a past session: what would consciousness have predicted vs what happened |
| `engram audit` | Claude Code quality audit — failure modes, correction patterns, tool usage, token economics |
| `engram hook` | Install Claude Code Start + Stop hooks (hit tracking + auto-refresh) |

Common flags: `-P <path>` (per-project scope), `--dry-run` (preview), `--deep` (Claude API).

## Architecture

### Core Pipeline (Stages 1–4)

| Module | File | Purpose |
|--------|------|---------|
| Transcript types | `src/types/transcript.ts` | Maps Claude Code JSONL schema |
| Decision graph types | `src/types/decision-graph.ts` | DecisionGraph, Strategy, AntiPattern, OptimalPath |
| Parser | `src/parser/parse.ts` | JSONL → DecisionGraph with node classification |
| Heuristic extractor | `src/extractor/extract.ts` | Anti-patterns, convergence, optimal paths |
| LLM extractor | `src/extractor/deep-extract.ts` | Claude API for cross-session patterns |
| Injector | `src/injector/inject.ts` | StrategyIndex → CLAUDE_STRATEGIES.md |
| Data store | `src/lib/data-store.ts` | `~/.claude-conscious` persistence |
| Stop hook | `src/stop-hook.ts` | Auto-refresh on session end |

### Layer 5: Metacognition

Adds self-awareness to the pipeline. The agent doesn't just get strategies — it gets a model of its own reasoning.

| Module | File | What it computes |
|--------|------|------------------|
| Session intent classifier | `src/classifier/classifier.ts` | Task type (bug-fix, feature, refactor, debug...), complexity, domain, file scope |
| Cognitive fingerprint | `src/fingerprint/fingerprint.ts` | 7-dimension reasoning profile: exploration/exploitation, caution/boldness, persistence/pivoting, breadth/depth, tool diversity, self-correction, efficiency/thoroughness |
| Metacognitive reflection | `src/metacognition/reflection.ts` | Causal chains, counterfactuals, flow state detection, momentum shifts, behavioral adaptations |
| Predictive strategy engine | `src/predictor/predictor.ts` | Ranks strategies by predicted relevance given intent + fingerprint + context |
| Cross-project transfer | `src/transfer/transfer.ts` | Identifies universal vs language/framework/domain/project-specific patterns |
| Temporal dynamics | `src/temporal/temporal.ts` | Skill trajectories per task type, plateau/breakthrough detection, learning rate |
| Metacognitive injector | `src/injector/metacognitive-inject.ts` | Enhanced CLAUDE_STRATEGIES.md with self-portrait, adaptations, predictions |

### Layer 6: Consciousness

Adds experiential structures — identity continuity, knowledge boundaries, empathy for the user, failure anticipation, and memory consolidation.

| Module | File | What it computes |
|--------|------|------------------|
| Narrative identity | `src/consciousness/narrative-identity.ts` | Autobiographical episodes, character traits, self-narrative, current arc |
| Epistemic map | `src/consciousness/epistemic-map.ts` | Per-domain certainty with decay, known unknowns, cross-domain connections, calibration |
| User model | `src/consciousness/user-model.ts` | Expertise level, communication style, patience, correction patterns, collaboration health |
| Pre-mortem simulator | `src/consciousness/pre-mortem.ts` | 12 failure modes with context-adjusted probabilities, early warnings, prevention |
| Dream consolidator | `src/consciousness/dream-consolidator.ts` | Strategy merge/prune/strengthen, novel cross-pattern connections, memory health |
| Somatic markers | `src/consciousness/somatic-markers.ts` | Fast gut-feeling heuristics (danger/caution/confidence) from repeated outcomes |
| Phenomenological state | `src/consciousness/phenomenology.ts` | Familiarity zones, comfort/growth mapping, novelty detection, mood (PAD model) |

## Example Output

### `engram replay` — Predicting a failed session

This is a real session that failed (5 user corrections, false leads across multiple files). The system is replaying it through the consciousness stack using only data from the 91 sessions that came *before* it:

```
$ engram replay 24610294

  Target session: 24610294-ce0...
  Date: 2026-03-20 | Duration: 77m
  Prior sessions available: 91

  ─── WHAT THE SYSTEM WOULD HAVE PREDICTED ───

  Intent classification: debug [complex]
  Domains: auth, api, state

  Pre-mortem risk: CRITICAL
    95% scope-creep: Touching more than 10 files or exceeding 25 tool calls
    75% wrong-file-first: First file opened is not in the resolution path
    60% silent-regression: Editing multiple files without running the test suite

  ─── WHAT ACTUALLY HAPPENED ───

  Tool calls: 35
  User corrections: 5
  Apparent success: ✗ no

  ─── VERDICT ───

  ✓ PREDICTED CORRECTLY: Session had issues, and the system predicted risk.
    Top prediction: scope-creep (95%)
```

### `engram awaken` — Full consciousness profile

```
$ engram awaken --dry-run

  NARRATIVE IDENTITY
    Age: 25 days | Sessions: 118
    Arc: Mastery phase — consistently performing at high efficiency
    Traits:
      █████████░ Efficient executor
      █████████░ Persistent
      █████░░░░░ Self-correcting

  EPISTEMIC MAP
      ██████████ api (expert, 59 sessions)
      █████████░ auth (deep, 42 sessions)
      █████████░ database (deep, 31 sessions)

  USER MODEL
    Expertise: intermediate | Patience: moderate | Collab health: 99%

  PRE-MORTEM
    Overall risk: HIGH
    ⚠ scope-creep (48% likely, ~15 wasted steps)

  PHENOMENOLOGICAL STATE
    Mood: Valence: +0.45 | Dominance: 0.56
    Comfort zone: code-extension/src, packages/vscode-extension
```

Every claim traces back to a count or ratio on real session data. `--dry-run` previews without writing. `replay` validates predictions against actual outcomes.

## Design Principles

### Case Law, Not Legislation

LLMs are poor at following imperative rules but excellent at reasoning from precedent. Strategies are expressed as **contextual knowledge with evidence**, not commands:

```markdown
## src/middleware (confidence: 82%, 4 sessions)

When investigating auth-related errors, check src/middleware/auth.ts
before src/services/auth.service.ts. In 4 of 5 historical auth failures,
the root cause was middleware ordering.
```

### Confidence Decay

Strategies lose ~5%/month without revalidation. Codebases change — a strategy from 6 months ago may no longer apply. This mimics how procedural memory degrades without practice.

### Minimal Token Footprint

Total injection stays under ~4–5K tokens. Strategies are ranked by predicted relevance (metacognize) or confidence (basic); lower-priority strategies are omitted to preserve context budget.

### Local-First

All processing happens locally. Session transcripts never leave the machine. No API calls required for heuristic extraction. LLM-powered extraction (`--deep`) uses the developer's own API key.

### Measurement as Backbone

The `report` command provides honest baseline vs enhanced cohort comparisons. Strategy effectiveness uses path-overlap proxies, not self-reported accuracy. `awaken --dry-run` outputs are auditable — every claim references session counts and success rates.

## Cognitive Science Foundation

| System | Human Brain | This Tool |
|--------|-------------|-----------|
| Episodic Memory | Hippocampus | Session transcripts |
| Semantic Memory | Neocortex | CLAUDE.md / MEMORY.md |
| Procedural Memory | Basal ganglia, cerebellum | CLAUDE_STRATEGIES.md |
| Metacognition | Prefrontal cortex | `engram metacognize` |
| Autobiographical Self | Medial PFC, default mode network | Narrative identity |
| Theory of Mind | Temporoparietal junction | User model |
| Somatic Markers | Ventromedial PFC, amygdala | Somatic markers |
| Epistemic Awareness | Anterior insula | Epistemic map |
| Consolidation | REM sleep | Dream consolidator |
| Pre-mortem Planning | Dorsolateral PFC | Pre-mortem simulator |
| Proprioception | Somatosensory cortex | Phenomenological state |

The key insight from cognitive science: **procedural memory is built from outcomes, not instructions.** You don't learn to ride a bike by reading about it — you learn by falling and adjusting. Similarly, agent skill isn't built from preference notes — it's built from tracking which approaches succeeded and which failed.

## Known Limitations

- **Cold start**: Requires ~10+ sessions for useful heuristics, ~20+ for reliable metacognition, ~50+ for meaningful consciousness-layer output.
- **Outcome signal is noisy**: `apparentSuccess` is heuristic (corrections < 3, backtracks < 5). Not ground truth.
- **Correction detection is conservative**: Tightened to avoid false positives (was inflating user model and narrative identity). May under-count real corrections.
- **Epistemic "expert" inflation**: With high overall success rates, most domains qualify as "expert". The threshold is legitimate for the data — it would differentiate more on noisier histories.
- **Pre-mortem variance**: Scope-creep dominates as top risk when avg tool calls/session is high, regardless of task type. Domain-specific rates help but base rate is strong.
- **Strategy effectiveness in reports**: Uses path-overlap proxies, not runtime instrumentation inside Claude Code.
- **Transcript format dependency**: Claude Code's JSONL format is undocumented. Parser is abstracted to minimize breakage.

## Testing

```bash
npm test                    # 69 tests across 9 test files
```

Tests cover: parser, extractor, injector, metacognition (classifier, fingerprint, reflection, predictor, temporal, transfer), consciousness (narrative identity, epistemic map, user model, pre-mortem, dream consolidator, somatic markers, phenomenology).

## Contributing

MIT license. Contributions welcome — especially:
- Improved correction/backtrack detection heuristics
- Instrumented eval framework (log strategy hits inside Claude Code)
- Cross-project transfer validation
- Better outcome signals beyond `apparentSuccess`
- Performance benchmarks on real session data

## License

MIT

---

*Memory tells your agent what you prefer. Skill tells your agent what succeeds.*
