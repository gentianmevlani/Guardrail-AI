# guardrail v1 Implementation Checklist

## Quick Reference

**Total Issues:** 12  
**P0 (Critical):** 4  
**P1 (High):** 5  
**P2 (Medium):** 3

---

## Implementation Order

### Phase 1: P0 Critical Fixes (Week 1)

- [ ] **Fix 1:** Eliminate Silent Failures
  - [ ] Replace empty catch blocks in `runReality.js` (8 instances)
  - [ ] Replace empty catch blocks in `runNaturalLanguage.js` (6 instances)
  - [ ] Replace empty catch blocks in `runShip.js` (1 instance)
  - [ ] Replace empty catch blocks in `runProof.js` (1 instance)
  - [ ] Add unit tests for error propagation
  - [ ] Verify errors are logged

- [ ] **Fix 2:** Standardize Exit Codes
  - [ ] Update all `process.exit()` calls to use `ExitCode` enum
  - [ ] Add integration test for exit codes
  - [ ] Document exit code usage

- [ ] **Fix 3:** Add Null Safety
  - [ ] Fix `runGate.js:192` undefined filter
  - [ ] Add null checks in `runScan.js`
  - [ ] Add unit tests with null inputs

- [ ] **Fix 4:** Enforce FAIL/WARN Rule
  - [ ] Update `verdict-engine.ts` with confidence threshold
  - [ ] Add unit tests for confidence thresholds
  - [ ] Verify FAIL only on confidence ≥ 0.8

### Phase 2: P1 High Priority (Week 2)

- [ ] **Fix 5:** Fix CI Error Masking
  - [ ] Remove `continue-on-error: true` from critical steps
  - [ ] Add E2E test for CI workflow
  - [ ] Document when `continue-on-error` is acceptable

- [ ] **Fix 6:** Add Request IDs
  - [ ] Create `telemetry.ts` middleware
  - [ ] Add request ID to all routes
  - [ ] Add integration test

- [ ] **Fix 7:** Deduplicate Findings
  - [ ] Add deduplication logic to `worker.ts`
  - [ ] Add unit test for deduplication
  - [ ] Verify same finding appears once

- [ ] **Fix 8:** Standardize JSON Output
  - [ ] Add JSON schema validation
  - [ ] Update all commands to support `--json`
  - [ ] Add schema validation test

- [ ] **Fix 9:** Harden Offline Mode
  - [ ] Restrict `GUARDRAIL_TIER` to test mode only
  - [ ] Add unit test for offline mode restrictions
  - [ ] Document offline mode behavior

### Phase 3: P2 Polish (Week 3)

- [ ] **Fix 10:** Add Scan Result Caching
  - [ ] Enhance file scanner cache
  - [ ] Add cache hit/miss test
  - [ ] Monitor cache performance

- [ ] **Fix 11:** Optimize File System Walks
  - [ ] Add directory tree caching
  - [ ] Add performance test
  - [ ] Monitor scan duration

- [ ] **Fix 12:** Harden GitHub Actions Integration
  - [ ] Update CI generator
  - [ ] Add retry logic for SARIF upload
  - [ ] Add E2E test for GitHub Actions

---

## Verification After Each Fix

1. Run lint/typecheck: `pnpm lint && pnpm type-check`
2. Run unit tests: `pnpm test:unit`
3. Run integration tests: `pnpm test:integration`
4. Smoke test: Run scan/gate/ship on example project
5. Check error logs for new issues

---

## Definition of Done

All items must be checked before marking as complete:

- [ ] Code changes implemented
- [ ] Tests added and passing
- [ ] Lint/typecheck passes
- [ ] Integration tests pass
- [ ] Smoke test passes
- [ ] Documentation updated
- [ ] Telemetry/logging added
- [ ] Code reviewed

---

## Rollout Checklist

Before deploying:

- [ ] All P0 fixes implemented and tested
- [ ] All P1 fixes implemented and tested
- [ ] All P2 fixes implemented and tested
- [ ] All verification steps pass
- [ ] Release notes drafted
- [ ] Rollback plan documented
- [ ] Monitoring alerts configured

---

## Success Metrics

Track these metrics after rollout:

- **Error Rate:** Should decrease (fewer silent failures)
- **CI Failure Rate:** Should increase initially (fewer masked failures), then stabilize
- **Exit Code Consistency:** 100% of commands use standardized codes
- **Cache Hit Rate:** >50% for repeated scans
- **Scan Duration:** <30s for typical repos
- **User Feedback:** Positive on error messages and reliability

---

## Notes

- All changes are backward-compatible
- No breaking changes to API or CLI
- Focus on reliability, not new features
- Test thoroughly before each phase