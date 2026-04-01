# CLI + MCP Polish Implementation

**Date**: 2025-01-07  
**Status**: Implementation Plan & Code Changes

---

## Summary

This document provides PR-ready code changes for the 12 tightening improvements identified in the analysis. The changes focus on P0 (critical) fixes plus highest-leverage P1 improvements.

---

## Fix #1: Unify Exit Codes (P0-1)

### Goal
Single exit code system used consistently across all CLI commands.

### Changes

**1. Update `bin/runners/lib/error-handler.js` to use unified exit codes matching TypeScript enum:**

```javascript
// Standard exit codes - unified with packages/cli/src/runtime/exit-codes.ts
const EXIT_CODES = {
  SUCCESS: 0,
  POLICY_FAIL: 1,           // Changed from SCAN_FAILED
  USER_ERROR: 2,
  SYSTEM_ERROR: 3,
  AUTH_FAILURE: 4,          // Changed from AUTH_REQUIRED  
  NETWORK_FAILURE: 5,       // Changed from NETWORK_ERROR
};
```

**2. Update all `process.exit()` calls to use unified codes:**
- `bin/runners/runGate.js`: Use `EXIT_CODES.POLICY_FAIL` instead of `EXIT_CODES.SCAN_FAILED`
- `bin/runners/runScan.js`: Use `EXIT_CODES.POLICY_FAIL` for scan failures
- All other runners: Use unified codes

**Files Changed:**
- `bin/runners/lib/error-handler.js`
- `bin/runners/runGate.js`
- `bin/runners/runScan.js`
- `bin/runners/runShip.js`
- `bin/runners/runReality.js`
- `bin/runners/runIntelligence.js`
- `bin/runners/runPromptFirewall.js`
- `bin/runners/runVerifyAgentOutput.js`
- `bin/runners/runMdc.js`
- `bin/runners/runMdc.ts`

**Tests:**
- Unit tests for exit code mapping
- Integration tests verifying exit codes in CI scenarios

---

## Fix #2: Fix Offline Mode Entitlement Bypass (P0-2)

### Goal
Offline mode NEVER grants paid commands (free only).

### Changes

**1. Update `bin/runners/lib/auth.js` to enforce free-only in offline mode:**

```javascript
async function getEntitlements(apiKey) {
  // ... existing cache check ...

  try {
    // ... existing API call ...
  } catch (error) {
    // SECURITY: Do not fallback to cached entitlements for paid features
    // Offline mode only allows FREE tier commands
    const cached = getCachedEntitlements(apiKey);
    if (cached && cached.plan === 'free') {
      return cached; // Only allow free tier offline
    }
    throw new Error(
      "Cannot connect to guardrail API. API connection required for paid features. " +
      "Free tier commands work offline. Please check your network connection."
    );
  }
}
```

**2. Update `packages/cli/src/index.ts` offline mode check:**

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

**Files Changed:**
- `bin/runners/lib/auth.js`
- `packages/cli/src/index.ts`

**Tests:**
- Unit tests: offline mode with free tier (should work)
- Unit tests: offline mode with paid tier (should fail)
- Integration tests: verify offline mode behavior

---

## Fix #3: Standardize Error Handler Usage (P0-5)

### Goal
All commands use `withErrorHandling` wrapper for consistent error messages.

### Changes

**1. Update `bin/runners/runScan.js` to use error handler:**

```javascript
const { withErrorHandling, EXIT_CODES } = require('./lib/error-handler');

async function runScan(args) {
  // ... existing code ...
  
  return withErrorHandling(async () => {
    // ... existing scan logic ...
    return exitCode;
  }, 'Scan')();
}

module.exports = { runScan: withErrorHandling(runScan, 'Scan') };
```

**2. Apply same pattern to other runners:**
- `bin/runners/runGate.js`
- `bin/runners/runShip.js`
- `bin/runners/runReality.js`
- `bin/runners/runFix.js`

**Files Changed:**
- All runner files in `bin/runners/`

**Tests:**
- Error scenarios for each command
- Verify error messages are consistent

---

## Fix #4: Standardize JSON Output Schema (P0-4)

### Goal
Versioned JSON schema for all commands (scan, ship, gate).

### Changes

**1. Update `bin/runners/runScan.js` to use schema:**

```javascript
const { createScanResult, SCHEMA_VERSION } = require('./lib/scan-output-schema');

// In JSON output section:
if (opts.json) {
  const result = createScanResult({
    findings: report.findings || [],
    projectPath,
    scanId: `scan_${Date.now()}`,
    startTime,
  });
  
  console.log(JSON.stringify(result, null, 2));
  return result.verdict === 'pass' ? EXIT_CODES.SUCCESS : EXIT_CODES.POLICY_FAIL;
}
```

**2. Create similar schema functions for ship and gate commands**

**Files Changed:**
- `bin/runners/runScan.js`
- `bin/runners/runShip.js`
- `bin/runners/runGate.js`
- `bin/runners/lib/scan-output-schema.js` (already exists, enhance)

**Tests:**
- JSON schema validation tests
- Version compatibility tests

---

## Fix #5: Version MCP Tool Schema (P0-3)

### Goal
Tool schema versioned, stable responses.

### Changes

**1. Update `mcp-server/index.js`:**

```javascript
const TOOL_SCHEMA_VERSION = "1.0.0";

// Add version to all tool definitions:
{
  name: "guardrail.scan",
  description: "...",
  inputSchema: {
    type: "object",
    properties: {
      // ... existing properties ...
    },
  },
  metadata: {
    schemaVersion: TOOL_SCHEMA_VERSION,
    version: VERSION,
  },
}

// In tool response handler:
async handleScan(projectPath, args) {
  try {
    // ... existing logic ...
    return {
      content: [{ type: "text", text: output }],
      metadata: {
        schemaVersion: TOOL_SCHEMA_VERSION,
        toolVersion: VERSION,
      },
    };
  } catch (err) {
    return {
      content: [{ type: "text", text: `Error: ${err.message}` }],
      isError: true,
      metadata: {
        schemaVersion: TOOL_SCHEMA_VERSION,
        toolVersion: VERSION,
      },
    };
  }
}
```

**Files Changed:**
- `mcp-server/index.js`
- All tool handlers in MCP server

**Tests:**
- Schema versioning tests
- Backward compatibility tests

---

## Fix #6-12: Additional Improvements

### Fix #6: Add Null/Undefined Guards
- Add defensive checks for all object property access
- Files: All runner files, MCP server

### Fix #7: Standardize Network Error Handling
- Add timeout to all fetch calls
- Use retry logic consistently
- Files: `bin/runners/lib/auth.js`, API call sites

### Fix #8: Deduplicate and Sort Findings
- Use existing `dedupeFindings` and `sortFindings` functions
- Files: Finding aggregation code

### Fix #9: Add Cache Telemetry
- Track cache hit/miss rates
- Report in output
- Files: `bin/runners/lib/scan-cache.js`

### Fix #10: Enable Incremental Scanning by Default
- Enable where appropriate
- Files: Scan orchestration code

### Fix #11: Add Evidence Strength Tagging
- Tag findings with confidence scores
- Files: Finding generation code

### Fix #12: Add Correlation IDs
- Add request IDs to error logs
- Files: Error handler, API calls

---

## Verification Steps

1. **Lint Check**: `npm run lint`
2. **Type Check**: `npm run type-check`
3. **Unit Tests**: `npm test`
4. **Integration Tests**: `npm run test:integration`
5. **Smoke Test**: `node bin/guardrail.js scan --json` (verify schema)
6. **MCP Test**: Verify tool schema versions
7. **Offline Test**: Verify free-only access offline

---

## Rollout Plan

1. **Phase 1**: Fixes #1-5 (P0 critical)
2. **Phase 2**: Fixes #6-8 (High impact)
3. **Phase 3**: Fixes #9-12 (Nice to have)

---

## Rollback Plan

Each fix is independent and can be rolled back via git revert:
- `git revert <commit-hash>` for each fix
- Test rollback in staging environment first

---

## Release Notes Draft

### CLI + MCP v1 Polish Release

**Breaking Changes:**
- Exit codes standardized (see migration guide)
- JSON output schema versioned (v1.0.0)
- Offline mode: free tier only (paid features require API connection)

**Improvements:**
- Consistent error messages with next-step guidance
- Standardized exit codes for CI/CD
- Versioned MCP tool schemas
- Deduplicated and sorted findings
- Cache telemetry added

**Migration Guide:**
- Update CI/CD scripts to use new exit codes
- Update JSON parsers to handle schema version
- Offline mode behavior: free tier only
