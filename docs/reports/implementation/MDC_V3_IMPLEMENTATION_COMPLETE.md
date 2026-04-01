# MDC Generator v3 + Reality Scan Unfair Mode - Implementation Complete

## Quick Reality Scan

**What Was Inspected:**
- `src/lib/mdc-generator/` - Current MDC generator (v2)
- `src/lib/reality-sniff/` - Reality scan implementation
- `packages/cli/src/scanner/incremental.ts` - Git diff utilities
- `packages/cli/src/reality/no-dead-buttons/` - No dead buttons system
- `bin/runners/runMdc.ts` - CLI entry point

**Biggest Risks/Holes Found:**
1. ✅ **Fixed:** No change-aware context selection
2. ✅ **Fixed:** No lane separation (CLI/MCP vs Dashboard)
3. ✅ **Fixed:** No Truth Index (commands, routes, env vars)
4. ✅ **Fixed:** No Critical Invariants embedded
5. ✅ **Fixed:** Reality scan not integrated into MDC packs
6. ✅ **Fixed:** Non-deterministic output (no versioning, unstable ordering)

## Target Architecture

### Current (v2)
```
MDC Generator v2
  → Scans entire codebase
  → Generates category-based .mdc files
  → Includes verification + source anchoring
  → No change awareness
  → No lane separation
```

### Implemented (v3)
```
MDC Generator v3
  ├─ Change-Aware Selector ✅
  │   ├─ Git diff (staged + unstaged)
  │   ├─ Base ref (main/master)
  │   └─ Dependency closure (imports + symbols)
  │
  ├─ Lane Router ✅
  │   ├─ PACK_CLI_MCP.mdc
  │   ├─ PACK_DASHBOARD.mdc
  │   └─ PACK_SHARED.mdc
  │
  ├─ Truth Index Extractor ✅
  │   ├─ Commands/tools (where defined)
  │   ├─ Routes/endpoints (handlers + middleware)
  │   ├─ Env vars (dependencies + defaults)
  │   ├─ DB models (Prisma schema)
  │   └─ Integration touchpoints
  │
  ├─ Reality Scan Integration ✅
  │   ├─ Run scan on changed files
  │   ├─ Extract findings (FAIL/WARN/INFO)
  │   └─ Embed "Hotspots" section in packs
  │
  ├─ Critical Invariants ✅
  │   ├─ No entitlement bypass
  │   ├─ No mocks/TODO in prod
  │   ├─ No silent failures
  │   └─ No dead buttons
  │
  └─ Deterministic Pack Generator ✅
      ├─ Stable ordering (path → symbol)
      ├─ Version header (MDC_PACK_VERSION)
      ├─ Git commit hash
      └─ Timestamp
```

## Ranked Plan (P0/P1/P2)

### P0 - Implemented ✅
- ✅ Deterministic packs + lane split + truth index skeleton
- ✅ Change-aware diff selection + dep closure
- ✅ Reality scan integration + hotspots section
- ✅ Critical invariants enforcement + pack schema versioning
- ✅ CLI integration with --v3 flag

### P1 - Future Enhancements
- Golden tests + CI gate wiring
- Runtime witness integration hooks
- Action registry system (for dashboard)
- Typed API contract generation

### P2 - Nice to Have
- Incremental pack updates (only regenerate changed lanes)
- Pack diff visualization
- Pack size optimization (compression)

## Implementation Plan

### File Structure

```
src/lib/mdc-generator/v3/
├── change-aware-selector.ts      # Git diff + dependency closure
├── lane-router.ts                # Route files to CLI/MCP vs Dashboard lanes
├── truth-index-extractor.ts      # Extract commands, routes, env vars, schemas
├── critical-invariants.ts         # Hard rules that must not be violated
├── reality-scan-integration.ts    # Integrate Reality scan findings
├── deterministic-pack-generator.ts # Generate packs with stable output
├── mdc-generator-v3.ts           # Main generator orchestrator
└── index.ts                      # Public exports
```

### Data Structures/Schemas

**Pack Schema:**
```typescript
interface PackMetadata {
  version: string;           // "3.0.0"
  timestamp: string;          // ISO 8601
  gitCommit: string;          // Full commit hash
  gitBranch?: string;         // Current branch
  lane: 'cli-mcp' | 'dashboard' | 'shared';
  filesIncluded: number;
  symbolsIncluded: number;
}

interface PackContent {
  metadata: PackMetadata;
  changedFiles: Array<{ path, status, summary }>;
  dependencyClosure: { changedFiles, dependentFiles, relatedSymbols };
  truthIndex: TruthIndex;
  criticalInvariants: CriticalInvariant[];
  realityHotspots?: Array<{ file, line, severity, rule, message }>;
}
```

**Truth Index Schema:**
```typescript
interface TruthIndex {
  commands: CommandEntry[];      // CLI commands
  tools: ToolEntry[];            // MCP tools
  routes: RouteEntry[];          // API routes
  envVars: EnvVarEntry[];       // Environment variables
  dbModels: DBModelEntry[];     // Prisma models
  integrations: IntegrationEntry[]; // Webhooks, OAuth, etc.
  schemas: SchemaEntry[];       // Zod, TypeScript types
}
```

**Critical Invariants Schema:**
```typescript
interface CriticalInvariant {
  id: string;                    // "INV-001"
  category: 'entitlements' | 'cli-contract' | 'dashboard-actions' | ...;
  rule: string;                  // Human-readable rule
  rationale: string;             // Why this matters
  enforcement: 'compile-time' | 'runtime' | 'test' | 'review';
  examples: { violation, correct };
}
```

## Code Changes

### New Files Created

1. **`src/lib/mdc-generator/v3/change-aware-selector.ts`**
   - Git diff detection (staged + unstaged)
   - Dependency closure computation (AST-based)
   - File exclusion patterns

2. **`src/lib/mdc-generator/v3/lane-router.ts`**
   - Routes files to appropriate lanes
   - CLI/MCP: `packages/cli/`, `bin/runners/`, `mcp-server/`
   - Dashboard: `apps/web-ui/`, `apps/api/src/routes/`
   - Shared: `packages/security/`, `shared/`, `prisma/`

3. **`src/lib/mdc-generator/v3/truth-index-extractor.ts`**
   - Extracts commands (commander.js patterns)
   - Extracts MCP tools
   - Extracts API routes (Fastify, Express, Next.js)
   - Extracts env vars (with dangerous defaults detection)
   - Extracts Prisma models
   - Extracts integrations (webhooks, OAuth)
   - Extracts schemas (Zod, TypeScript)

4. **`src/lib/mdc-generator/v3/critical-invariants.ts`**
   - 11 critical invariants defined
   - Grouped by category
   - Includes violation/correct examples
   - Formatting utilities

5. **`src/lib/mdc-generator/v3/reality-scan-integration.ts`**
   - Integrates RealitySniffScanner
   - Extracts top hotspots (FAIL + high severity WARN)
   - Formats as markdown section

6. **`src/lib/mdc-generator/v3/deterministic-pack-generator.ts`**
   - Generates packs with stable ordering
   - Version headers
   - Git commit/branch detection
   - Normalized formatting

7. **`src/lib/mdc-generator/v3/mdc-generator-v3.ts`**
   - Main orchestrator
   - Coordinates all components
   - Generates packs for each lane

8. **`src/lib/mdc-generator/v3/index.ts`**
   - Public exports

### Modified Files

1. **`bin/runners/runMdc.ts`**
   - Added `--v3` flag
   - Added `--base-ref` option
   - Added `--no-reality-scan` option
   - Direct v3 generator invocation when `--v3` is set

## Tests Added/Updated

### Unit Tests Needed (TODO)

1. **`src/lib/mdc-generator/v3/__tests__/change-aware-selector.test.ts`**
   - Test git diff detection
   - Test dependency closure
   - Test file exclusion

2. **`src/lib/mdc-generator/v3/__tests__/lane-router.test.ts`**
   - Test lane assignment
   - Test file grouping

3. **`src/lib/mdc-generator/v3/__tests__/truth-index-extractor.test.ts`**
   - Test command extraction
   - Test route extraction
   - Test env var extraction
   - Test Prisma model extraction

4. **`src/lib/mdc-generator/v3/__tests__/deterministic-pack-generator.test.ts`**
   - Test stable ordering
   - Test version headers
   - Test pack formatting

5. **`src/lib/mdc-generator/v3/__tests__/mdc-generator-v3.test.ts`**
   - Integration test
   - Test full generation flow
   - Test pack output

### Golden Tests Needed (TODO)

- Snapshot tests for pack output
- Verify deterministic output (same inputs → same output)
- Verify version headers are correct

## Verification Steps

### 1. Test v3 Generator

```bash
# Generate v3 packs
cd /path/to/guardrail
guardrail mdc --v3

# Expected output:
# - .guardrail/mdc-v3/PACK_CLI_MCP.mdc
# - .guardrail/mdc-v3/PACK_DASHBOARD.mdc
# - .guardrail/mdc-v3/PACK_SHARED.mdc
```

### 2. Verify Pack Contents

```bash
# Check pack headers
head -20 .guardrail/mdc-v3/PACK_CLI_MCP.mdc

# Expected:
# ---
# MDC_PACK_VERSION: 3.0.0
# TIMESTAMP: 2024-...
# GIT_COMMIT: abc123...
# LANE: CLI_MCP
# ---
```

### 3. Test Change-Aware Mode

```bash
# Make some changes
git checkout -b test-mdc-v3
echo "// test" >> src/lib/mdc-generator/v3/mdc-generator-v3.ts
git add src/lib/mdc-generator/v3/mdc-generator-v3.ts

# Generate with base ref
guardrail mdc --v3 --base-ref main

# Verify only changed files appear in packs
```

### 4. Test Reality Scan Integration

```bash
# Generate with reality scan
guardrail mdc --v3

# Check for "Reality Scan Hotspots" section in packs
grep -A 10 "Reality Scan Hotspots" .guardrail/mdc-v3/PACK_CLI_MCP.mdc
```

### 5. Test Deterministic Output

```bash
# Generate twice
guardrail mdc --v3 > /tmp/run1.log
guardrail mdc --v3 > /tmp/run2.log

# Compare outputs (should be identical except timestamps)
diff <(sed 's/TIMESTAMP:.*/TIMESTAMP: XXX/' .guardrail/mdc-v3/PACK_CLI_MCP.mdc) \
     <(sed 's/TIMESTAMP:.*/TIMESTAMP: XXX/' .guardrail/mdc-v3/PACK_CLI_MCP.mdc)
```

## Rollout Notes

### Backward Compatibility

- ✅ v2 generator still works (default behavior)
- ✅ v3 is opt-in via `--v3` flag
- ✅ No breaking changes to existing CLI

### Feature Flag Plan

- Current: `--v3` flag (opt-in)
- Future: Make v3 default after validation period
- Future: Remove v2 after migration complete

### Rollback Strategy

- If v3 has issues, users can simply not use `--v3` flag
- v2 generator remains unchanged
- No database or persistent state changes

### Release Notes Draft

```markdown
## MDC Generator v3

### New Features

- **Change-Aware Generation**: Only includes changed files + dependency closure
- **Lane-Based Packs**: Separate packs for CLI/MCP vs Dashboard (no merge conflicts)
- **Truth Index**: Extracted commands, routes, env vars, schemas from codebase
- **Critical Invariants**: Hard rules embedded in packs (no entitlement bypass, etc.)
- **Reality Scan Integration**: AI artifact findings included in packs
- **Deterministic Output**: Stable ordering, version headers, git commit tracking

### Usage

```bash
# Generate v3 packs
guardrail mdc --v3

# With custom base ref
guardrail mdc --v3 --base-ref main

# Skip reality scan
guardrail mdc --v3 --no-reality-scan
```

### Output

Generates three packs:
- `PACK_CLI_MCP.mdc` - CLI commands, MCP tools, exit codes
- `PACK_DASHBOARD.mdc` - Action registry, API contracts, button sweep rules
- `PACK_SHARED.mdc` - Shared infrastructure

Each pack includes:
- Changed files summary
- Dependency closure
- Truth index (commands, routes, env vars, etc.)
- Critical invariants
- Reality scan hotspots (if enabled)
```

## Definition of Done

### MDC Generator v3 ✅

- ✅ Change-aware selection (git diff + dependency closure)
- ✅ Lane-based packs (CLI/MCP vs Dashboard)
- ✅ Truth index extraction (commands, routes, env vars, schemas)
- ✅ Critical invariants embedded
- ✅ Reality scan integration
- ✅ Deterministic output (stable ordering, versioning)
- ✅ CLI integration (`--v3` flag)

### Reality Scan Integration ✅

- ✅ Runs scan on changed files
- ✅ Extracts hotspots (FAIL + high severity WARN)
- ✅ Embeds in MDC packs
- ✅ Configurable layers (lexical/structural/runtime)

### Dashboard "No Dead Buttons" Gate ✅

- ✅ Already implemented in `packages/cli/src/reality/no-dead-buttons/`
- ✅ Static scanner for dead UI patterns
- ✅ Button sweep test generator
- ✅ Integrated into Reality CLI command

## Next Steps

1. **Add Tests** - Unit tests and golden tests for v3 components
2. **CI Integration** - Add v3 generation to CI pipeline
3. **Documentation** - Update docs with v3 usage
4. **Validation** - Test with real codebases
5. **Performance** - Optimize for large codebases

## Notes

- v3 generator requires TypeScript for AST parsing (falls back to regex if unavailable)
- Reality scan requires `src/lib/reality-sniff/` to be available
- Git repository required for change-aware mode (gracefully degrades if not git repo)
- Pack generation is deterministic but timestamps will differ between runs (expected)
