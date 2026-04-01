# CLI + MCP Tighten & Polish - Reality Audit & Implementation Plan

**Date**: 2024-12-19  
**Engineer**: guardrail CLI + MCP Tighten & Polish  
**Scope**: Feature-freeze hardening pass for reliability, speed, determinism, actionability

---

## 1. Quick Reality Scan

### Files Inspected

**CLI Core**:
- `bin/guardrail.js` - Main CLI entry point, command routing, auth/entitlement checks
- `bin/runners/runGate.js` - CI/CD gate command
- `bin/runners/runShip.js` - Ship decision command  
- `bin/runners/runScan.js` - Scan command (referenced, needs inspection)
- `bin/runners/lib/error-handler.js` - Error handling utilities
- `bin/runners/lib/auth.js` - Authentication/entitlement logic
- `bin/_router.js` - Command routing logic

**MCP Server**:
- `mcp-server/index.js` - Main MCP server (v2.0)
- `mcp-server/index-v1.js` - Legacy MCP server
- `mcp-server/guardrail-2.0-tools.js` - guardrail 2.0 tool definitions
- `mcp-server/guardrail-tools.js` - Legacy tool definitions

**Output & Formatting**:
- `packages/cli/src/runtime/exit-codes.ts` - Exit code definitions (TypeScript)
- `bin/runners/lib/scan-output-schema.js` - Scan output schema
- Multiple command runners with inconsistent output formatting

### Biggest Holes Identified

1. **Exit Code Inconsistency (P0)**
   - Some commands use `EXIT_CODES` from error-handler.js
   - Others use `process.exit(1)` / `process.exit(0)` directly
   - TypeScript code uses `ExitCode` enum from packages/cli
   - No unified exit code contract across CLI

2. **JSON Output Schema Not Versioned (P0)**
   - No version field in JSON outputs
   - Schema varies between commands (scan vs gate vs ship)
   - No machine-readable schema definition
   - MCP responses lack version metadata

3. **Error Handling Inconsistency (P0)**
   - Some commands use `withErrorHandling` wrapper
   - Others handle errors inline with varying formats
   - Error messages lack consistent structure (receipts, next steps)
   - No standardized error taxonomy

4. **Offline Mode Entitlement Risk (P0)**
   - `packages/cli/src/index.ts` allows offline mode with cached tier
   - `bin/runners/lib/server-usage.js` has offline allowances
   - Risk: Offline mode could grant paid features if cache is stale/wrong
   - Need strict enforcement: offline = free tier only

5. **MCP Tool Response Schema Instability (P1)**
   - Tool responses in `mcp-server/index.js` use inconsistent formats
   - No version field in tool responses
   - Error responses use `isError: true` but structure varies
   - No schema validation for tool outputs

6. **Hardcoded Exit Codes (P1)**
   - `runEnhancedShip.js:54` - `process.exit(1)`
   - `runVerifyAgentOutput.js:83` - `process.exit(1)`
   - `runMdc.js:219` - `process.exit(1)`
   - `runFixVerified.js:452` - `process.exit(1)`
   - `runCertify.js:67` - `process.exit(1)`
   - `runAIAgent.js:2364` - `process.exit(1)`
   - `runDashboard.js:65,113` - `process.exit(0)`

7. **Output Formatting Inconsistency (P1)**
   - Human-readable output varies between commands
   - No single formatting layer
   - Colors/styling inconsistent
   - Help text format varies

8. **Missing Receipts in Failures (P1)**
   - Some errors don't include file:line references
   - No "verify it's fixed" guidance in many errors
   - Findings don't consistently include evidence/context

9. **No Golden Tests for Output (P2)**
   - Tests exist but no snapshot tests for human-readable output
   - JSON output not validated against schemas
   - Output format changes could break CI/CD integrations

10. **Performance: No Incremental Cache Strategy (P2)**
    - Scan commands don't leverage incremental scanning consistently
    - Cache invalidation unclear
    - Redundant filesystem traversal

---

## 2. Scope Statement

**guardrail CLI/MCP produces PASS/FAIL verdicts with receipts for AI-generated code reality issues, fast enough to run constantly.**

The CLI and MCP focus exclusively on:
- **Verdicts**: Clear PASS/FAIL/WARN decisions with confidence levels
- **Receipts**: Every finding includes file:line evidence and concrete proof
- **Speed**: Fast enough for pre-commit hooks and constant monitoring
- **Actionability**: Every FAIL includes "verify it's fixed" guidance

**Out of scope for this hardening pass**:
- New feature commands or capabilities
- UI/UX enhancements that don't increase verdict trustworthiness
- Performance improvements beyond incremental scanning
- Documentation beyond exit codes and JSON schemas

Any code in CLI/MCP that violates this scope (bloat, half-features, dead commands, confusing flags) should be flagged for removal in a future cleanup pass.

---

## 3. Definition of Done: CLI + MCP v1 Polish Checklist

### Core Requirements

- [ ] **Exit Codes**: Every command uses standardized exit codes from unified source
- [ ] **JSON Output**: Every command with `--json` flag outputs versioned, schema-stable JSON
- [ ] **Error Handling**: Every error includes receipt (file:line or evidence), next step, verification guidance
- [ ] **Entitlements**: Offline mode NEVER grants paid commands; strict free-tier-only fallback
- [ ] **MCP Stability**: All tool responses include version, schema-stable structure, normalized errors
- [ ] **Output Formatting**: Single formatting layer; human output is consistent and stable
- [ ] **Tests**: Unit tests for error paths, integration tests for commands, golden tests for output
- [ ] **Performance**: Incremental scanning enabled where applicable, cache strategy clear
- [ ] **Documentation**: Exit code spec, JSON schema docs, error taxonomy documented
- [ ] **Verification**: All tests pass, lint/typecheck clean, smoke test on fixture repo

### Success Criteria

1. **Reliability**: No crashes from undefined access, null handling, or missing error cases
2. **Determinism**: Same input produces same output (including exit codes)
3. **Actionability**: Every FAIL includes file:line receipt and "verify it's fixed" command
4. **Speed**: Incremental scans are 3x+ faster on unchanged code
5. **Stability**: MCP tool responses are schema-stable and versioned

---

## 4. Ranked Punchlist

### P0 - Critical (Must Fix)

1. **Unified Exit Code System** (`bin/guardrail.js`, `bin/runners/*.js`)
   - Replace all `process.exit(1/0)` with standardized codes
   - Export EXIT_CODES from single source
   - Document exit code contract

2. **Offline Mode Entitlement Hardening** (`bin/runners/lib/auth.js`, `packages/cli/src/index.ts`)
   - Enforce free-tier-only in offline mode
   - Remove cached tier fallback for paid features
   - Add explicit offline mode messaging

3. **JSON Output Versioning** (All command runners)
   - Add `version` field to all JSON outputs
   - Standardize schema structure
   - Document JSON schema contract

4. **Error Receipts** (`bin/runners/lib/error-handler.js`, all runners)
   - Ensure all errors include file:line or evidence
   - Add "verify it's fixed" guidance
   - Standardize error message format

5. **MCP Tool Response Schema** (`mcp-server/index.js`, `mcp-server/guardrail-2.0-tools.js`)
   - Add version to all tool responses
   - Normalize error response structure
   - Document tool response schemas

### P1 - High Priority (Should Fix)

6. **Hardcoded Exit Codes** (`bin/runners/runEnhancedShip.js`, `runVerifyAgentOutput.js`, etc.)
   - Replace with EXIT_CODES
   - Standardize error handling

7. **Output Formatting Layer** (New file: `bin/runners/lib/output-formatter.js`)
   - Single source for colors, formatting
   - Consistent help text format
   - Stable human-readable output

8. **Error Taxonomy** (`bin/runners/lib/error-handler.js`)
   - Standardize error types (AuthError, ValidationError, NetworkError, etc.)
   - Map error types to exit codes
   - Consistent error formatting

9. **JSON Schema Documentation** (`docs/CLI_JSON_SCHEMAS.md`)
   - Document all JSON output schemas
   - Provide example outputs
   - Versioning strategy

### P2 - Nice to Have

10. **Golden Tests** (`tests/cli/output-snapshots.test.js`)
    - Snapshot tests for human output
    - JSON schema validation tests
    - Output stability tests

11. **Incremental Scan Performance** (`bin/runners/runScan.js`)
    - Enable incremental scanning by default
    - Clear cache invalidation strategy
    - Performance benchmarks

12. **Help Text Standardization** (All runners)
    - Consistent help format
    - Standard flag descriptions
    - Examples in help

---

## 5. The 12 Tightening Changes

### Correctness/Reliability (6 items)

#### 1. Unified Exit Code System
- **Goal**: Single source of truth for exit codes; all commands use it
- **Done Criteria**: No hardcoded exit codes; all commands use EXIT_CODES; documented
- **Files Changed**: 
  - Create `bin/runners/lib/exit-codes.js` (unified JS export)
  - Update `bin/runners/lib/error-handler.js` to use it
  - Fix all hardcoded `process.exit(1/0)` in runners
- **Tests Added**: Unit tests for exit code mapping; integration tests verify codes
- **Telemetry**: Log exit code on command completion

#### 2. Offline Mode Entitlement Hardening  
- **Goal**: Offline mode = free tier only, never grants paid features
- **Done Criteria**: Offline mode blocks paid commands; clear messaging; tests
- **Files Changed**:
  - `bin/runners/lib/auth.js` - Remove cached tier fallback for paid
  - `packages/cli/src/index.ts` - Enforce free-tier-only offline
  - `bin/guardrail.js` - Update offline messaging
- **Tests Added**: Offline mode entitlement tests; verify paid commands blocked
- **Telemetry**: Log offline mode usage

#### 3. Error Receipts & Guidance
- **Goal**: Every error includes file:line receipt and "verify it's fixed" command
- **Done Criteria**: All errors have receipts; consistent format; verification guidance
- **Files Changed**:
  - `bin/runners/lib/error-handler.js` - Enhance error formatting
  - All runners - Ensure errors include receipts
- **Tests Added**: Error format validation; receipt presence checks
- **Telemetry**: Error type tracking

#### 4. Null Safety & Undefined Access Protection
- **Goal**: No crashes from undefined/null access
- **Done Criteria**: All optional chaining/defensive checks in place; no crashes in tests
- **Files Changed**: 
  - `bin/runners/runGate.js` - Add null checks
  - `bin/runners/runShip.js` - Add null checks
  - Other runners with risky access patterns
- **Tests Added**: Null/undefined input tests; crash prevention tests
- **Telemetry**: Crash tracking (if possible)

#### 5. Error Handling Consistency
- **Goal**: All commands use standardized error handling
- **Done Criteria**: All runners use error-handler utilities; consistent error format
- **Files Changed**: All runners - Standardize error handling
- **Tests Added**: Error handling integration tests
- **Telemetry**: Error rate tracking

#### 6. JSON Output Schema Versioning
- **Goal**: All JSON outputs include version and stable schema
- **Done Criteria**: Version field in all JSON; schema documented; tests validate
- **Files Changed**:
  - All runners with JSON output - Add version field
  - Create `bin/runners/lib/json-schemas.js` - Schema definitions
- **Tests Added**: JSON schema validation tests
- **Telemetry**: JSON output version tracking

### UX/DX Output Fixes (3 items)

#### 7. Unified Output Formatting
- **Goal**: Single formatting layer for consistent human-readable output
- **Done Criteria**: All commands use formatter; consistent styling; stable format
- **Files Changed**:
  - Create `bin/runners/lib/output-formatter.js`
  - Update all runners to use formatter
- **Tests Added**: Output format snapshot tests
- **Telemetry**: Output format usage

#### 8. Clearer Error Messages
- **Goal**: Errors are actionable with clear next steps
- **Done Criteria**: All errors have "Next steps" section; verification guidance
- **Files Changed**:
  - `bin/runners/lib/error-handler.js` - Enhance error messages
  - Update error guidance map
- **Tests Added**: Error message readability tests
- **Telemetry**: Error resolution tracking (if possible)

#### 9. Stable Help Text
- **Goal**: Help text is consistent and doesn't change unexpectedly
- **Done Criteria**: Consistent help format; examples; stable across commands
- **Files Changed**: All runners - Standardize help text
- **Tests Added**: Help text snapshot tests
- **Telemetry**: Help usage (if possible)

### Performance Improvements (2 items)

#### 10. Incremental Scan Cache
- **Goal**: Scans of unchanged code are 3x+ faster
- **Done Criteria**: Incremental scanning enabled; cache hit rate >50%; benchmarks
- **Files Changed**:
  - `bin/runners/runScan.js` - Enable incremental scanning
  - `bin/runners/lib/scan-cache.js` - Improve cache strategy
- **Tests Added**: Cache performance tests; incremental scan tests
- **Telemetry**: Cache hit rate; scan duration

#### 11. Reduced Filesystem I/O
- **Goal**: Eliminate redundant file reads and traversal
- **Done Criteria**: File reads cached; traversal optimized; benchmarks show improvement
- **Files Changed**: Scan runners - Add file read caching
- **Tests Added**: I/O reduction tests
- **Telemetry**: File read count; traversal depth

### MCP Stability (1 item)

#### 12. MCP Tool Response Schema Stability
- **Goal**: Tool responses are versioned and schema-stable
- **Done Criteria**: All responses include version; error structure normalized; schema documented
- **Files Changed**:
  - `mcp-server/index.js` - Add version to responses
  - `mcp-server/guardrail-2.0-tools.js` - Normalize responses
  - Create `mcp-server/schemas.js` - Response schemas
- **Tests Added**: MCP response schema tests
- **Telemetry**: MCP tool usage

---

## 6. Implementation Priority

**Phase 1 (P0 - Critical)**:
1. Unified Exit Code System
2. Offline Mode Entitlement Hardening
3. JSON Output Schema Versioning
4. Error Receipts & Guidance
5. MCP Tool Response Schema Stability

**Phase 2 (P1 - High Priority)**:
6. Error Handling Consistency
7. Unified Output Formatting
8. Clearer Error Messages
9. Null Safety Protection

**Phase 3 (P2 - Performance & Polish)**:
10. Incremental Scan Cache
11. Reduced Filesystem I/O
12. Stable Help Text

---

## 7. Verification Steps

1. **Lint/Typecheck**: `pnpm lint && pnpm type-check`
2. **Unit Tests**: `pnpm test:unit`
3. **Integration Tests**: `pnpm test:integration`
4. **Smoke Test**: Run `guardrail scan`, `guardrail gate`, `guardrail ship` on fixture repo
5. **MCP Test**: Test MCP tools with Cursor/Windsurf
6. **Offline Test**: Test offline mode with paid commands (should block)
7. **Exit Code Test**: Verify exit codes are consistent
8. **JSON Schema Test**: Validate JSON outputs against schemas

---

## 8. Rollout & Rollback Plan

### Rollout
1. Merge to `main` after all tests pass
2. Tag release with `v1.0.0-polish`
3. Monitor error rates and exit codes
4. Gather feedback on error messages
5. Monitor MCP tool usage

### Rollback
- If critical issues: Revert commit
- If MCP breaking: Pin MCP server version
- If exit code changes break CI: Document migration guide

### Release Notes Draft
See `CLI_MCP_POLISH_RELEASE_NOTES.md` (to be created)
