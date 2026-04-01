# Quick Reality Scan - MDC Generator v3 Upgrade

## What Was Inspected

**Paths Analyzed:**
- `src/lib/mdc-generator/` - Current MDC generator implementation
- `src/lib/reality-sniff/` - Reality scan implementation  
- `packages/cli/src/scanner/incremental.ts` - Git diff utilities
- `packages/cli/src/reality/no-dead-buttons/` - No dead buttons system
- `bin/runners/runMdc.ts` - CLI entry point
- `scripts/generate-mdc.ts` - Generation script

**Current Architecture:**
- MDC Generator: Generates comprehensive `.mdc` files with AST parsing, verification, source anchoring
- Reality Scan: Three-layer verifier (lexical → structural → runtime) for AI artifacts
- Incremental Scanner: Git diff-based change detection
- No Dead Buttons: Static scanner + button sweep tests

## Biggest Risks/Holes Found

1. **No Change-Aware Context Selection** - MDC generator scans entire codebase, not just changed files
2. **No Lane Separation** - Single MDC output mixes CLI/MCP concerns with Dashboard concerns
3. **No Truth Index** - No centralized index of commands, routes, env vars extracted from code
4. **No Critical Invariants** - Hardening rules not embedded in MDC packs
5. **Reality Scan Not Integrated** - Findings exist but not included in MDC packs
6. **Non-Deterministic Output** - No versioning, unstable ordering
7. **No Verification Loop Integration** - MDC doesn't drive patch verification

## Target Architecture

### Current (v2)
```
MDC Generator
  → Scans entire codebase
  → Generates category-based .mdc files
  → Includes verification + source anchoring
  → No change awareness
  → No lane separation
```

### Proposed (v3)
```
MDC Generator v3
  ├─ Change-Aware Selector
  │   ├─ Git diff (staged + unstaged)
  │   ├─ Base ref (main/master)
  │   └─ Dependency closure (imports + symbols)
  │
  ├─ Lane Router
  │   ├─ PACK_CLI_MCP.mdc
  │   │   ├─ Command registry
  │   │   ├─ MCP tools
  │   │   ├─ Exit codes
  │   │   └─ Evidence ladder
  │   │
  │   └─ PACK_DASHBOARD.mdc
  │       ├─ Action registry
  │       ├─ API contracts
  │       ├─ Permission model
  │       └─ Button sweep rules
  │
  ├─ Truth Index Extractor
  │   ├─ Commands/tools (where defined)
  │   ├─ Routes/endpoints (handlers + middleware)
  │   ├─ Env vars (dependencies + defaults)
  │   ├─ DB models (Prisma schema)
  │   └─ Integration touchpoints
  │
  ├─ Reality Scan Integration
  │   ├─ Run scan on changed files
  │   ├─ Extract findings (FAIL/WARN/INFO)
  │   └─ Embed "Hotspots" section in packs
  │
  ├─ Critical Invariants
  │   ├─ No entitlement bypass
  │   ├─ No mocks/TODO in prod
  │   ├─ No silent failures
  │   └─ No dead buttons
  │
  └─ Deterministic Output
      ├─ Stable ordering (path → symbol)
      ├─ Version header (MDC_PACK_VERSION)
      ├─ Git commit hash
      └─ Timestamp
```
