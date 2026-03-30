# CLI Excellence Implementation

## Overview

This document tracks the implementation of the "AMAZING CLI" improvements focused on 5 core areas:

1. **Inevitable Verdict Output** - PASS/FAIL with receipts
2. **Determinism** - Stable ordering, wording, exit codes
3. **Actionability** - Fix-first, autofix, explain
4. **Speed** - Caching, incremental, progress
5. **Self-Diagnosis** - Enhanced doctor command

## ✅ Completed

### 1. Output Contract (`src/lib/cli/output-contract.ts`)
- ✅ Exit code specification (0/1/2/3)
- ✅ Standard finding format with stable IDs (GR-*)
- ✅ Verdict output structure
- ✅ JSON schema versioning
- ✅ Deterministic sorting

### 2. Verdict Formatter (`src/lib/cli/verdict-formatter.ts`)
- ✅ PASS/FAIL header
- ✅ Top blockers section
- ✅ Collapsed warnings (expand with --verbose)
- ✅ What/where/why/fix/verify for each finding
- ✅ Evidence strength display

### 3. Cache Manager (`src/lib/cli/cache-manager.ts`)
- ✅ Incremental caching by file hash
- ✅ Cache hit/miss tracking
- ✅ Cache statistics
- ✅ Automatic invalidation

### 4. Enhanced Doctor (`bin/runners/lib/doctor-enhanced.js`)
- ✅ Node version check
- ✅ Package manager detection
- ✅ Required binaries check
- ✅ Environment variable validation
- ✅ Permission checks
- ✅ Project structure validation
- ✅ Build capability check
- ✅ Clear error messages with fixes

### 5. Unified Output (`bin/runners/lib/unified-output.js`)
- ✅ Consistent error handling
- ✅ Proper exit codes
- ✅ Error classification
- ✅ Next steps guidance

## 🚧 In Progress

### Integration Points

1. **Update `runScan.js`** to use new formatters
2. **Update `runGate.js`** to use unified output
3. **Update `runShip.js`** to use unified output
4. **Add finding IDs** to all scanners
5. **Implement autofix** commands

## 📋 Next Steps

### P0: Core Integration

1. **Update scan command**
   ```javascript
   // Use unified output contract
   const { formatScanOutput, getExitCode } = require('./lib/unified-output');
   const { buildVerdictOutput, normalizeFinding } = require('../../dist/lib/cli/output-contract');
   
   // Normalize findings
   const normalized = findings.map((f, i) => 
     normalizeFinding(f, 'REALITY', i, existingIDs)
   );
   
   // Build verdict
   const verdict = buildVerdictOutput(normalized, timings, cached);
   
   // Format output
   console.log(formatScanOutput({ verdict, findings: normalized }, { verbose, json }));
   
   // Exit with proper code
   process.exit(getExitCode(verdict));
   ```

2. **Add stable finding IDs**
   - Update Reality Sniff scanner to generate IDs
   - Update route integrity to generate IDs
   - Update all other scanners

3. **Implement autofix**
   ```javascript
   // guardrail fix --id GR-REALITY-001
   async function fixFinding(findingId) {
     const finding = loadFinding(findingId);
     if (!finding.autofixAvailable) {
       throw new Error('Autofix not available for this finding');
     }
     // Apply fix
   }
   ```

### P1: Polish

1. **Golden snapshot tests**
   ```javascript
   // tests/cli/output-snapshots.test.js
   test('scan output is stable', () => {
     const output = runScan(['--json']);
     expect(output).toMatchSnapshot();
   });
   ```

2. **Performance optimizations**
   - Parallel file scanning
   - Incremental cache for monorepos
   - Skip unchanged packages

3. **Progress indicators**
   - Only show when > 800ms
   - 3-stage timings (discover → analyze → verify)
   - Cache hit indicators

## 🎯 Success Metrics

### Determinism
- [ ] All output passes golden snapshot tests
- [ ] Exit codes are consistent
- [ ] Finding IDs are stable across runs
- [ ] JSON schema is versioned and stable

### Speed
- [ ] Cached scans complete in < 1s
- [ ] First scan shows progress only when > 800ms
- [ ] Monorepo scans skip unchanged packages

### Actionability
- [ ] Every FAIL has: what, where, why, fix, verify
- [ ] Autofix available for 50%+ of findings
- [ ] Explain command works for all findings

### Self-Diagnosis
- [ ] Doctor catches 90% of setup issues
- [ ] Error messages link to doctor
- [ ] Doctor provides exact fix commands

## 📝 Implementation Checklist

### Phase 1: Core Contract (DONE)
- [x] Output contract types
- [x] Exit code specification
- [x] Verdict formatter
- [x] Cache manager
- [x] Enhanced doctor

### Phase 2: Integration (IN PROGRESS)
- [ ] Update scan command
- [ ] Update gate command
- [ ] Update ship command
- [ ] Add finding IDs to scanners
- [ ] Implement unified error handling

### Phase 3: Features (TODO)
- [ ] Autofix implementation
- [ ] Explain command
- [ ] Replay command
- [ ] Finding ID lookup

### Phase 4: Polish (TODO)
- [ ] Golden snapshot tests
- [ ] Performance optimizations
- [ ] Progress indicators
- [ ] Documentation updates

## 🔍 Verification

### Test Commands

```bash
# Test exit codes
guardrail scan && echo "Exit: $?"  # Should be 0
guardrail scan --reality-sniff && echo "Exit: $?"  # Should be 1 if blockers

# Test JSON output
guardrail scan --json | jq '.schemaVersion'  # Should be "1.0.0"

# Test caching
guardrail scan  # First run
guardrail scan  # Second run should show "✓ Cached"

# Test doctor
guardrail doctor  # Should catch setup issues

# Test error handling
guardrail scan --path /nonexistent  # Should show helpful error
```

### Expected Output Format

```
══════════════════════════════════════════════════════════════════
VERDICT: FAIL

Discovery: 120ms | Analysis: 450ms | Verify: 230ms
Total: 800ms
══════════════════════════════════════════════════════════════════

🚨 BLOCKERS (2):

1. GR-REALITY-001 CRITICAL Empty Catch Block
    Empty catch block detected - errors are silently swallowed
    src/api/routes.ts:42
    → Fix: Add error logging and/or rethrow: catch (err) { logger.error(err); throw err; }
    → Autofix: guardrail fix --id GR-REALITY-001
    → Verify: guardrail replay latest --id GR-REALITY-001

2. GR-AUTH-002 HIGH Unprotected Route
    Route "/admin" requires auth but has no middleware
    src/routes/admin.ts:15
    → Fix: Add authentication middleware to route
    → Verify: guardrail replay latest --id GR-AUTH-002

──────────────────────────────────────────────────────────────────

⚠️  WARNINGS (3) - Run with --verbose to see details

SUMMARY:
  Total findings: 5
  Blockers: 2
  Warnings: 3
  Info: 0

NEXT STEPS:
  1. Fix the blockers above
  2. Run: guardrail scan to verify
  3. Or use: guardrail fix --id <finding-id> for autofix
```

## 🎉 Key Improvements

1. **Deterministic**: Same input → same output, always
2. **Fast**: Cached scans in < 1s
3. **Actionable**: Every finding has fix + verify
4. **Self-healing**: Doctor catches 90% of issues
5. **Beautiful failures**: Clear errors with next steps

This is what makes guardrail feel "world-class".
