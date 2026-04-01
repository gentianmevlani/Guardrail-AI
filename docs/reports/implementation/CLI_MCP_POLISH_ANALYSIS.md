# CLI + MCP Tighten & Polish Analysis

**Date**: 2025-01-07  
**Engineer**: guardrail CLI + MCP Tighten & Polish  
**Status**: Feature-freeze hardening pass

---

## Quick Reality Scan

### What Was Inspected

1. **Command Routing** (`bin/guardrail.js`, `bin/_router.js`)
   - Central routing with legacy aliases
   - Tier-based command access checks
   - Natural language command fallback

2. **Output Contracts** (`bin/runners/*.js`, `packages/cli/src/runtime/exit-codes.ts`)
   - Multiple exit code definitions (3 different systems)
   - JSON output exists but schemas inconsistent
   - Human-readable output varies by command

3. **Entitlements/Gating** (`bin/runners/lib/auth.js`, `packages/core/src/entitlements.ts`, `bin/guardrail.js`)
   - Server-authoritative checks
   - Cached entitlements (10-15 min)
   - Offline mode handling varies (some allow, some fail)

4. **Scan/Ship/Gate Pipeline** (`bin/runners/runScan.js`, `bin/runners/runGate.js`, `bin/runners/runShip.js`)
   - Findings aggregation and formatting
   - Verdict generation (PASS/FAIL)
   - Evidence/receipt tracking exists but not consistent

5. **Performance** (`bin/runners/lib/scan-cache.js`, `src/lib/route-integrity/ast/file-scanner.ts`)
   - File-level caching implemented
   - Incremental scanning available but not consistently used
   - No cache hit/miss telemetry

6. **Network** (`bin/runners/lib/auth.js`, `bin/runners/lib/server-usage.js`)
   - Timeout handling (5s for auth)
   - Retry logic exists in error-handler
   - Offline mode messages inconsistent

7. **MCP Server** (`mcp-server/index.js`)
   - 40+ tools across multiple categories
   - Version 2.1.0 (hardcoded)
   - Tool routing via switch statement (not scalable)
   - Error responses inconsistent format

8. **Logging/Telemetry** (`bin/runners/lib/error-handler.js`)
   - Structured error handling exists
   - Not consistently applied
   - No correlation IDs

### Biggest Holes

1. **Exit Codes**: 3 different systems (`EXIT_CODES` object, `ExitCode` enum, hardcoded numbers)
2. **JSON Schema**: No versioned schema, inconsistent structure across commands
3. **Error Format**: Error handler exists but not used everywhere
4. **Offline Mode**: Inconsistent - some places allow cached tier, some fail
5. **MCP Versioning**: Hardcoded version string, no schema versioning
6. **Cache Usage**: Caching exists but hit/miss not tracked or reported

---

## Definition of Done: CLI + MCP v1 Polish Checklist

### Correctness & Reliability
- [ ] Single exit code system used consistently
- [ ] All commands use standardized error handler
- [ ] Offline mode NEVER grants paid commands (free only)
- [ ] No undefined/null access in production paths
- [ ] All network errors have retries/timeouts
- [ ] All file operations handle ENOENT/EACCES

### Output Contracts
- [ ] Versioned JSON schema for scan/ship/gate output
- [ ] Deterministic exit codes documented
- [ ] Consistent error message format (error type + message + next step)
- [ ] Golden/snapshot tests for human-readable output
- [ ] Machine-readable output available for all FAIL commands

### Verdict Trustworthiness
- [ ] FAIL only with high-confidence evidence (file+line)
- [ ] WARN/INFO clearly separated from FAIL
- [ ] Deduplication of repeated findings
- [ ] Findings sorted by "blocks shipping first"
- [ ] Confidence scores on findings

### MCP Stability
- [ ] Tool schema versioned
- [ ] Tool response format stable
- [ ] Error responses normalized
- [ ] Context passing consistent
- [ ] Tool version in tool definitions

### Performance
- [ ] Cache hit/miss telemetry
- [ ] Incremental scanning used where appropriate
- [ ] File I/O minimized
- [ ] Network calls batched where possible

---

## Scope Statement

**guardrail CLI/MCP produces PASS/FAIL verdicts with receipts for AI-generated code reality issues, fast enough to run constantly.**

The CLI and MCP must excel at:
1. **Verdict trustworthiness**: High-confidence findings only, with evidence (file+line)
2. **Speed**: Cached results, incremental scanning, minimal I/O
3. **Actionability**: Clear errors with next steps, machine-readable output
4. **Stability**: Deterministic exit codes, stable schemas, graceful degradation

Out of scope:
- New features (unless directly increasing trustworthiness/speed/actionability/stability)
- Half-implemented features (remove or complete)
- Dead commands (document or remove)
- Confusing flags (clarify or remove)

---

## Ranked Punchlist (P0/P1/P2)

### P0 - Critical (Must Fix)

1. **P0-1**: Exit code inconsistency (`bin/runners/lib/error-handler.js`, `packages/cli/src/runtime/exit-codes.ts`, `src/lib/ship/run-manager.ts`)
   - **Impact**: CI/CD breaks, unpredictable behavior
   - **Files**: Multiple exit code definitions

2. **P0-2**: Offline mode entitlement bypass risk (`bin/runners/lib/auth.js:143-148`, `packages/cli/src/index.ts:632-636`)
   - **Impact**: Security - paid features accessible offline
   - **Files**: `bin/runners/lib/auth.js`, `packages/cli/src/index.ts`

3. **P0-3**: MCP tool schema not versioned (`mcp-server/index.js:34`)
   - **Impact**: Breaking changes break integrations
   - **Files**: `mcp-server/index.js`

4. **P0-4**: JSON output schema not standardized (`bin/runners/runScan.js`, `bin/runners/runGate.js`)
   - **Impact**: Integrations break, parsing fails
   - **Files**: Multiple runner files

5. **P0-5**: Error handler not consistently used (`bin/runners/*.js`)
   - **Impact**: Inconsistent error messages, missing guidance
   - **Files**: All runner files

### P1 - High Priority (Should Fix)

6. **P1-1**: Cache usage not tracked (`bin/runners/lib/scan-cache.js`)
   - **Impact**: No visibility into performance gains
   - **Files**: `bin/runners/lib/scan-cache.js`

7. **P1-2**: Findings not deduplicated (`bin/runners/runScan.js`, `apps/api/src/worker.ts`)
   - **Impact**: Noise in output, user confusion
   - **Files**: Scan aggregation code

8. **P1-3**: Findings not sorted by impact (`bin/runners/runScan.js`)
   - **Impact**: Users fix wrong issues first
   - **Files**: Output formatting code

9. **P1-4**: MCP tool routing not scalable (`mcp-server/index.js:590-625`)
   - **Impact**: Hard to maintain, error-prone
   - **Files**: `mcp-server/index.js`

10. **P1-5**: No correlation IDs (`bin/runners/lib/error-handler.js`)
    - **Impact**: Hard to debug in production
    - **Files**: Error handling code

### P2 - Nice to Have (Can Defer)

11. **P2-1**: Help output not standardized
12. **P2-2**: Telemetry timing not per-stage
13. **P2-3**: Retry logic not consistently applied

---

## The 12 Tightening Changes

### Correctness/Reliability Fixes (6)

#### 1. Unify Exit Codes
- **Goal**: Single exit code system used everywhere
- **Value**: Predictable CI/CD behavior, easier debugging
- **Effort**: Medium (requires grep/replace across all runners)
- **Risk**: Low (just standardizing existing codes)
- **Files**: `bin/runners/lib/error-handler.js`, all runner files
- **Done Criteria**: All `process.exit()` calls use standardized codes
- **Tests**: Unit tests for exit code mapping

#### 2. Fix Offline Mode Entitlement Bypass
- **Goal**: Offline mode NEVER grants paid commands (free only)
- **Value**: Security - prevents entitlement bypass
- **Effort**: Low (clear conditional check)
- **Risk**: Medium (might break offline usage, but correct behavior)
- **Files**: `bin/runners/lib/auth.js`, `packages/cli/src/index.ts`
- **Done Criteria**: Offline mode only allows free tier commands
- **Tests**: Unit tests for offline mode gating

#### 3. Standardize Error Handler Usage
- **Goal**: All commands use `withErrorHandling` wrapper
- **Value**: Consistent error messages, better UX
- **Effort**: Medium (wrap all command functions)
- **Risk**: Low (additive change)
- **Files**: All runner files
- **Done Criteria**: All runners use error handler
- **Tests**: Error scenarios for each command

#### 4. Add Null/Undefined Guards
- **Goal**: No undefined/null access in production paths
- **Value**: Prevents crashes
- **Effort**: Medium (audit and fix)
- **Risk**: Low (defensive coding)
- **Files**: `bin/runners/*.js`, `mcp-server/index.js`
- **Done Criteria**: No unsafe property access
- **Tests**: Fuzz test with null inputs

#### 5. Standardize Network Error Handling
- **Goal**: All network calls have timeout + retry
- **Value**: Better reliability
- **Effort**: Low (use existing retry logic)
- **Risk**: Low (improves behavior)
- **Files**: `bin/runners/lib/auth.js`, API call sites
- **Done Criteria**: All fetch calls have timeout
- **Tests**: Network failure scenarios

#### 6. Add File Operation Error Handling
- **Goal**: All file operations handle ENOENT/EACCES
- **Value**: Better error messages
- **Effort**: Low (wrap file operations)
- **Risk**: Low (improves UX)
- **Files**: File I/O code
- **Done Criteria**: All fs calls wrapped
- **Tests**: Permission denied scenarios

### UX/DX Output Fixes (3)

#### 7. Standardize JSON Output Schema
- **Goal**: Versioned JSON schema for all commands
- **Value**: Stable integrations, easier parsing
- **Effort**: High (define schema, migrate all outputs)
- **Risk**: Medium (breaking change for integrations)
- **Files**: `bin/runners/lib/scan-output-schema.js`, all runners
- **Done Criteria**: All JSON output validates against schema
- **Tests**: JSON schema validation tests

#### 8. Deduplicate and Sort Findings
- **Goal**: Findings deduplicated and sorted by impact
- **Value**: Less noise, better actionability
- **Effort**: Medium (add dedupe + sort logic)
- **Risk**: Low (improves output)
- **Files**: Finding aggregation code
- **Done Criteria**: No duplicate findings, sorted output
- **Tests**: Deduplication tests, sort order tests

#### 9. Add Evidence Strength Tagging
- **Goal**: Tag findings with confidence/evidence strength
- **Value**: Better verdict trustworthiness
- **Effort**: Medium (add metadata to findings)
- **Risk**: Low (additive)
- **Files**: Finding generation code
- **Done Criteria**: All findings have confidence scores
- **Tests**: Confidence scoring tests

### Performance Improvements (2)

#### 10. Add Cache Telemetry
- **Goal**: Track cache hit/miss rates
- **Value**: Visibility into performance
- **Effort**: Low (add stats to cache)
- **Risk**: Low (additive)
- **Files**: `bin/runners/lib/scan-cache.js`
- **Done Criteria**: Cache stats reported in output
- **Tests**: Cache statistics tests

#### 11. Enable Incremental Scanning by Default
- **Goal**: Use incremental scanning where appropriate
- **Value**: Faster scans
- **Effort**: Low (enable by default)
- **Risk**: Low (already implemented)
- **Files**: Scan orchestration code
- **Done Criteria**: Incremental scanning enabled
- **Tests**: Performance tests

### MCP Stability Fix (1)

#### 12. Version MCP Tool Schema
- **Goal**: Tool schema versioned, stable responses
- **Value**: Prevents breaking changes
- **Effort**: Medium (add versioning infrastructure)
- **Risk**: Low (additive)
- **Files**: `mcp-server/index.js`
- **Done Criteria**: Tool responses include schema version
- **Tests**: Schema versioning tests

---

## Implementation Priority

**Phase 1 (P0 - Critical)**: Fixes 1-5  
**Phase 2 (P1 - High)**: Fixes 6-9  
**Phase 3 (P1 - High)**: Fixes 10-12  

---

## Verification Steps

1. Run `npm run lint`
2. Run `npm run type-check`
3. Run `npm test`
4. Run smoke test: `node bin/guardrail.js scan --json` on test repo
5. Run MCP tool list: verify schema versions
6. Test offline mode: verify free-only access

---

## Expected Output Format

See `CLI_MCP_POLISH_IMPLEMENTATION.md` for code diffs and implementation details.
