# Scan Command Integration Analysis

Analysis of whether MDC generator, context engine, and related features are integrated into the `scan` command.

## Current State

### What `scan` Command Uses

The `scan` command currently uses:

1. **Route Integrity Orchestrator** (`src/lib/route-integrity/orchestrator.ts`)
   - Layer 1: AST static analysis (FileScanner)
   - Layer 2: Build Truth (framework manifests)
   - Layer 3: Reality Proof (Playwright crawler)
   - Verdict Engine for scoring
   - Report Generator

2. **Project Discovery** (`src/lib/route-integrity/discovery/project-discovery.ts`)
   - Detects project type
   - Finds packages
   - Basic project structure analysis

### What `scan` Command Does NOT Currently Use

1. **MDC Generator** - Not integrated
   - MDC is a separate command: `guardrail mdc`
   - Generates comprehensive codebase documentation
   - Could enhance scan with better codebase understanding

2. **Context Engine** - Not integrated
   - Context is a separate command: `guardrail context`
   - Builds full codebase knowledge base
   - Could provide semantic understanding for scan

3. **Codebase Knowledge Base** - Not integrated
   - Located in `src/lib/codebase-knowledge.ts`
   - Provides semantic search and pattern detection
   - Could improve route discovery and analysis

4. **Semantic Search** - Not integrated
   - Located in `src/lib/semantic-search.ts`
   - Could help find related routes and components

## Integration Opportunities

### Potential Benefits of Integration

1. **Better Route Discovery**
   - MDC generator understands component relationships
   - Context engine has full codebase map
   - Could discover routes that AST misses

2. **Improved Analysis**
   - Codebase knowledge provides semantic understanding
   - Better pattern detection
   - More accurate verdict scoring

3. **Enhanced Context**
   - Understands data flow
   - Knows API contracts
   - Maps dependencies better

### Current Architecture

```
scan command
  ↓
Route Integrity Orchestrator
  ├─ Layer 1: AST Analysis (FileScanner)
  ├─ Layer 2: Build Truth (Manifests)
  ├─ Layer 3: Reality Proof (Playwright)
  └─ Verdict Engine
```

### Proposed Enhanced Architecture

```
scan command
  ↓
Route Integrity Orchestrator
  ├─ Pre-scan: Build Context (optional)
  │   ├─ MDC Generator (if not exists)
  │   ├─ Context Engine (if not exists)
  │   └─ Codebase Knowledge Base
  ├─ Layer 1: AST Analysis (enhanced with context)
  ├─ Layer 2: Build Truth (enhanced with knowledge)
  ├─ Layer 3: Reality Proof (enhanced with semantic search)
  └─ Verdict Engine (enhanced with codebase understanding)
```

## Recommendation

**Current Status:** MDC generator and context engine are NOT integrated into scan command.

**Options:**

1. **Keep Separate** (Current)
   - Pros: Clear separation of concerns, faster scan
   - Cons: Misses opportunities for better analysis

2. **Optional Integration**
   - Add `--with-context` flag to scan
   - Uses MDC/context if available, builds if not
   - Pros: Best of both worlds
   - Cons: More complex

3. **Full Integration**
   - Always build context before scanning
   - Pros: Best analysis quality
   - Cons: Slower, more dependencies

## Conclusion

**Update:** `guardrail scan` integrates Truth Pack (context engine) in two ways:

- **`--with-context` / `--refresh-context`** — Ensures `.guardrail-context` is indexed before the Reality Sniff (regenerates if missing or older than 24h, or when forced). See `packages/cli/src/commands/scan-context.ts`.
- **Scoring merge** — If `.guardrail-context/truthpack.json` exists, `loadTruthPackScoringIndex` reads `symbols.json`, `routes.json`, and `importance.json` and **escalates Reality Sniff scores** on high-impact files (up to ×3). Implemented in `packages/cli/src/scan/truth-pack-scoring.ts` and `reality-sniff.ts`.

MDC generator and semantic codebase search are still separate.
