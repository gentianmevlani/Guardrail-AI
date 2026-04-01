# CLI + MCP Tighten & Polish - Final Summary

**Date**: 2025-01-07  
**Engineer**: guardrail CLI + MCP Tighten & Polish  
**Status**: Analysis Complete, Partial Implementation

---

## Quick Reality Scan Summary

### What Was Inspected

1. **Command Routing** (`bin/guardrail.js`, `bin/_router.js`)
   - ✅ Central routing system exists
   - ✅ Legacy alias handling works
   - ⚠️ Natural language fallback adds complexity

2. **Output Contracts** (`bin/runners/*.js`, `packages/cli/src/runtime/exit-codes.ts`)
   - ❌ **3 different exit code systems** (critical issue)
   - ⚠️ JSON output exists but schemas inconsistent
   - ⚠️ Human-readable output varies by command

3. **Entitlements/Gating** (`bin/runners/lib/auth.js`, `packages/core/src/entitlements.ts`)
   - ⚠️ Server-authoritative checks exist
   - ❌ **Offline mode allows cached paid tier** (security issue)
   - ⚠️ Cached entitlements (10-15 min)

4. **Scan/Ship/Gate Pipeline** (`bin/runners/runScan.js`, `bin/runners/runGate.js`)
   - ✅ Findings aggregation works
   - ✅ Verdict generation (PASS/FAIL) exists
   - ⚠️ Evidence/receipt tracking not consistent

5. **Performance** (`bin/runners/lib/scan-cache.js`)
   - ✅ File-level caching implemented
   - ⚠️ Cache usage not tracked/telemetried
   - ⚠️ Incremental scanning available but not always used

6. **MCP Server** (`mcp-server/index.js`)
   - ✅ 40+ tools across categories
   - ❌ **Version hardcoded (2.1.0), no schema versioning**
   - ⚠️ Tool routing via switch statement (not scalable)

7. **Error Handling** (`bin/runners/lib/error-handler.js`)
   - ✅ Structured error handling exists
   - ❌ **Not consistently used across all runners**

### Biggest Holes Identified

1. **Exit Codes**: 3 different systems (EXIT_CODES object, ExitCode enum, hardcoded numbers)
2. **Offline Mode Security**: Cached paid tier usable offline (bypass risk)
3. **MCP Versioning**: No schema versioning (breaking changes risk)
4. **JSON Schema**: Inconsistent across commands
5. **Error Handler**: Not consistently applied
6. **Cache Telemetry**: No visibility into performance gains

---

## Definition of Done: CLI + MCP v1 Polish Checklist

### ✅ Completed
- [x] Reality audit completed
- [x] Scope defined
- [x] 12 improvements identified
- [x] Exit code unification started (partially implemented)
- [x] Analysis document created
- [x] Implementation plan created

### 🔄 In Progress
- [ ] Exit code unification (started, needs completion across all runners)
- [ ] Offline mode security fix
- [ ] MCP schema versioning
- [ ] JSON schema standardization
- [ ] Error handler standardization

### ⏳ Pending
- [ ] All P0 fixes completed
- [ ] All P1 fixes completed
- [ ] Tests added/updated
- [ ] Verification complete
- [ ] Release notes finalized

---

## Scope Statement

**guardrail CLI/MCP produces PASS/FAIL verdicts with receipts for AI-generated code reality issues, fast enough to run constantly.**

The CLI and MCP must excel at:
1. **Verdict trustworthiness**: High-confidence findings only, with evidence (file+line)
2. **Speed**: Cached results, incremental scanning, minimal I/O
3. **Actionability**: Clear errors with next steps, machine-readable output
4. **Stability**: Deterministic exit codes, stable schemas, graceful degradation

---

## Ranked Punchlist (P0/P1/P2)

### P0 - Critical (Must Fix) - **5 items**

1. **P0-1**: Exit code inconsistency ⚠️ **PARTIALLY FIXED**
   - **Status**: Unified definition created, needs propagation to all runners
   - **Files Changed**: `bin/runners/lib/error-handler.js`, `bin/runners/runGate.js`, `bin/runners/runScan.js`
   - **Remaining**: Update all `process.exit()` calls in remaining runners

2. **P0-2**: Offline mode entitlement bypass risk ❌ **NOT FIXED**
   - **Status**: Identified in `packages/cli/src/index.ts:632-636`
   - **Fix Needed**: Only allow free tier in offline mode
   - **Files**: `packages/cli/src/index.ts`, `bin/runners/lib/auth.js`

3. **P0-3**: MCP tool schema not versioned ❌ **NOT FIXED**
   - **Status**: Version hardcoded, no schema versioning
   - **Fix Needed**: Add schema version to tool definitions and responses
   - **Files**: `mcp-server/index.js`

4. **P0-4**: JSON output schema not standardized ⚠️ **PARTIALLY EXISTS**
   - **Status**: `scan-output-schema.js` exists but not consistently used
   - **Fix Needed**: Use schema in all commands, version it
   - **Files**: `bin/runners/runScan.js`, `bin/runners/runShip.js`, `bin/runners/runGate.js`

5. **P0-5**: Error handler not consistently used ⚠️ **EXISTS BUT NOT APPLIED**
   - **Status**: Error handler exists, needs wrapping all commands
   - **Fix Needed**: Wrap all runner functions with `withErrorHandling`
   - **Files**: All runner files

### P1 - High Priority (Should Fix) - **5 items**

6. **P1-1**: Cache usage not tracked
7. **P1-2**: Findings not deduplicated (exists but not used)
8. **P1-3**: Findings not sorted by impact (exists but not used)
9. **P1-4**: MCP tool routing not scalable
10. **P1-5**: No correlation IDs

### P2 - Nice to Have - **3 items**

11. Help output not standardized
12. Telemetry timing not per-stage
13. Retry logic not consistently applied

---

## Implementation Status

### ✅ Completed Changes

1. **Exit Code Unification - Phase 1**
   - Updated `bin/runners/lib/error-handler.js` with unified exit codes
   - Updated `bin/runners/runGate.js` to use `POLICY_FAIL`
   - Updated `bin/runners/runScan.js` to use `POLICY_FAIL` and `SYSTEM_ERROR`

### 📝 Remaining Critical Fixes

#### Fix #2: Offline Mode Security (P0-2)

**File**: `packages/cli/src/index.ts:632-636`

**Current Code**:
```typescript
if (!validation.ok) {
  // Allow offline mode if we have cached tier
  if (state.tier) {
    console.log(`  ${c.dim('(offline mode - using cached entitlements)')}\n`);
    return checkTierAccess(state, requiredTier);
  }
  // ...
}
```

**Fixed Code**:
```typescript
if (!validation.ok) {
  // SECURITY: Offline mode only allows free tier
  if (state.tier === 'free') {
    console.log(`  ${c.dim('(offline mode - free tier only)')}\n`);
    return checkTierAccess(state, requiredTier);
  }
  console.error(`\n${c.critical('ERROR')} ${validation.error || 'Authentication failed'}\n`);
  exitWith(ExitCode.AUTH_FAILURE);
}
```

#### Fix #3: MCP Schema Versioning (P0-3)

**File**: `mcp-server/index.js`

**Changes Needed**:
- Add `TOOL_SCHEMA_VERSION = "1.0.0"` constant
- Add `metadata.schemaVersion` to all tool definitions
- Add schema version to all tool responses

#### Fix #4: JSON Schema Standardization (P0-4)

**Files**: `bin/runners/runScan.js`, `bin/runners/runShip.js`, `bin/runners/runGate.js`

**Status**: `scan-output-schema.js` exists and is partially used
**Action**: Ensure all JSON output uses `createScanResult()` function

#### Fix #5: Error Handler Standardization (P0-5)

**Files**: All runner files

**Action**: Wrap all `run*` functions with `withErrorHandling()` wrapper

---

## Code Diffs Summary

### Files Changed (Partial Implementation)

1. `bin/runners/lib/error-handler.js` - ✅ Exit codes unified
2. `bin/runners/runGate.js` - ✅ Uses `POLICY_FAIL`
3. `bin/runners/runScan.js` - ✅ Uses `POLICY_FAIL` and `SYSTEM_ERROR`

### Files Needing Updates

1. `bin/runners/runIntelligence.js` - Replace `AUTH_REQUIRED` → `AUTH_FAILURE`, `NETWORK_ERROR` → `NETWORK_FAILURE`, `INTERNAL_ERROR` → `SYSTEM_ERROR`
2. `bin/runners/runVerifyAgentOutput.js` - Replace `SCAN_FAILED` → `POLICY_FAIL`, `INTERNAL_ERROR` → `SYSTEM_ERROR`
3. `bin/runners/runPromptFirewall.js` - Replace `INTERNAL_ERROR` → `SYSTEM_ERROR`
4. `bin/runners/runShip.js` - Replace `AUTH_REQUIRED` → `AUTH_FAILURE`
5. `bin/runners/runReality.js` - Replace `AUTH_REQUIRED` → `AUTH_FAILURE`
6. `packages/cli/src/index.ts` - Fix offline mode security
7. `mcp-server/index.js` - Add schema versioning

---

## Tests Added/Updated

### Unit Tests Needed

1. **Exit Code Mapping Tests**
   - Test all exit code mappings
   - Verify consistent usage

2. **Offline Mode Security Tests**
   - Test free tier works offline
   - Test paid tier fails offline
   - Test no cached tier fails

3. **MCP Schema Versioning Tests**
   - Test schema version in tool definitions
   - Test schema version in responses

4. **JSON Schema Validation Tests**
   - Test scan output schema
   - Test ship output schema
   - Test gate output schema

5. **Error Handler Tests**
   - Test error wrapping
   - Test error messages
   - Test exit codes on errors

### Integration Tests Needed

1. **CLI Exit Code Tests**
   - Verify exit codes in CI scenarios
   - Test all command exit codes

2. **MCP Tool Tests**
   - Verify schema versions
   - Test backward compatibility

---

## Verification Steps

### Pre-commit Checklist

- [ ] `npm run lint` - No linting errors
- [ ] `npm run type-check` - No type errors
- [ ] `npm test` - All tests pass
- [ ] `npm run test:integration` - Integration tests pass

### Manual Verification

1. **Exit Code Test**:
   ```bash
   node bin/guardrail.js scan --json > /dev/null; echo $?
   # Should return 0 (success) or 1 (POLICY_FAIL)
   ```

2. **Offline Mode Test**:
   ```bash
   # Set invalid API URL
   GUARDRAIL_API_URL=http://invalid:9999 node bin/guardrail.js ship
   # Should fail for paid features, allow free features
   ```

3. **JSON Schema Test**:
   ```bash
   node bin/guardrail.js scan --json | jq '.schemaVersion'
   # Should return "1.0.0"
   ```

4. **MCP Schema Test**:
   ```bash
   # Start MCP server and verify tool schema versions
   ```

---

## Rollout Plan

### Phase 1: Critical Fixes (P0)
1. Complete exit code unification
2. Fix offline mode security
3. Add MCP schema versioning
4. Standardize JSON schemas
5. Standardize error handlers

**Timeline**: 1-2 days
**Risk**: Medium (security fix, breaking changes)

### Phase 2: High Priority (P1)
6. Add cache telemetry
7. Use deduplication/sorting
8. Improve MCP routing
9. Add correlation IDs

**Timeline**: 2-3 days
**Risk**: Low (improvements, no breaking changes)

### Phase 3: Nice to Have (P2)
10. Standardize help output
11. Add per-stage telemetry
12. Standardize retry logic

**Timeline**: 1-2 days
**Risk**: Low

---

## Rollback Plan

Each fix is independent and can be rolled back:

1. **Exit Codes**: `git revert <commit>` - May break CI/CD scripts
2. **Offline Mode**: `git revert <commit>` - Security regression
3. **MCP Versioning**: `git revert <commit>` - No breaking change (additive)
4. **JSON Schema**: `git revert <commit>` - May break integrations
5. **Error Handler**: `git revert <commit>` - Low risk (improvement only)

**Rollback Procedure**:
1. Identify problematic commit(s)
2. Revert in staging environment
3. Test rollback
4. Deploy rollback to production
5. Create issue to re-apply fix

---

## Release Notes Draft

### CLI + MCP v1 Polish Release

**Version**: TBD  
**Date**: TBD

#### Breaking Changes

1. **Exit Codes Standardized**
   - Old codes: `SCAN_FAILED` (1), `AUTH_REQUIRED` (2), `NETWORK_ERROR` (4), `INTERNAL_ERROR` (5)
   - New codes: `POLICY_FAIL` (1), `AUTH_FAILURE` (4), `NETWORK_FAILURE` (5), `SYSTEM_ERROR` (3)
   - **Migration**: Update CI/CD scripts to use new exit codes
   - **Impact**: CI/CD pipelines may need updates

2. **JSON Output Schema Versioned**
   - All JSON output now includes `schemaVersion: "1.0.0"`
   - **Migration**: Update JSON parsers to check schema version
   - **Impact**: Integrations parsing JSON output

3. **Offline Mode: Free Tier Only**
   - Offline mode now only allows free tier commands
   - Paid features require API connection
   - **Migration**: Ensure API connectivity for paid features
   - **Impact**: Users relying on offline paid features

#### Improvements

1. **Consistent Error Messages**
   - All errors now include next-step guidance
   - Standardized error format across all commands

2. **MCP Tool Schema Versioning**
   - All MCP tools now include schema version
   - Enables backward compatibility checks

3. **Deduplicated and Sorted Findings**
   - Findings automatically deduplicated
   - Findings sorted by impact (blockers first)

4. **Cache Telemetry**
   - Cache hit/miss rates now reported
   - Performance visibility improved

#### Migration Guide

1. **CI/CD Scripts**:
   ```bash
   # Old
   guardrail gate; if [ $? -eq 1 ]; then exit 1; fi
   
   # New (same behavior, but code 1 is now POLICY_FAIL)
   guardrail gate; if [ $? -eq 1 ]; then exit 1; fi
   ```

2. **JSON Parsers**:
   ```javascript
   // Old
   const result = JSON.parse(output);
   
   // New (check schema version)
   const result = JSON.parse(output);
   if (result.schemaVersion !== "1.0.0") {
     console.warn("Unexpected schema version:", result.schemaVersion);
   }
   ```

3. **Offline Mode**:
   ```bash
   # Old: Cached paid tier worked offline
   # New: Only free tier works offline
   # Ensure API connectivity for paid features
   ```

---

## Next Steps

1. **Complete P0 Fixes** (Critical)
   - Finish exit code unification
   - Fix offline mode security
   - Add MCP schema versioning
   - Standardize JSON schemas
   - Standardize error handlers

2. **Add Tests** (Critical)
   - Unit tests for all fixes
   - Integration tests for critical paths
   - Golden tests for output formats

3. **Documentation** (High)
   - Update migration guide
   - Update API documentation
   - Update MCP tool documentation

4. **Verification** (Critical)
   - Run all tests
   - Manual verification
   - Smoke tests in staging

5. **Release** (High)
   - Create release branch
   - Tag release
   - Deploy to production
   - Monitor for issues

---

## Conclusion

This analysis identified 12 critical improvements for CLI and MCP polish. **5 P0 fixes** address critical security, stability, and consistency issues. **5 P1 fixes** improve usability and performance. **3 P2 fixes** are nice-to-have improvements.

**Current Status**: Analysis complete, partial implementation started. Exit code unification begun, remaining P0 fixes need completion.

**Priority**: Complete all P0 fixes before release. P1 fixes can be phased in. P2 fixes are optional.

**Risk**: Medium - Breaking changes require migration guide and careful rollout.
