# Definition of Done: guardrail v1

## What guardrail Does Extremely Well

**guardrail detects fake features, placeholder code, and security risks before they ship to production — giving teams high-confidence verdicts with clear fix paths.**

---

## Quality Bar Checklist

### 🔐 Security (Must Pass)

- [x] No auth bypasses (`GUARDRAIL_OWNER_MODE`, `SKIP_ENTITLEMENTS` removed)
- [x] CLI entitlement checks require real API verification (no mock fallbacks)
- [x] API routes have proper auth middleware applied
- [x] Webhook signatures verified (Stripe, GitHub)
- [x] No secrets in logs or error messages
- [x] Rate limiting on all public endpoints

### 📊 Verdict Trustworthiness (Must Pass)

- [x] FAIL only when high-confidence proof exists (>70% confidence for critical)
- [x] WARN for medium-confidence findings
- [x] Confidence scoring on all findings
- [x] Dedupe noisy/duplicate findings
- [x] Findings sorted by "blocks shipping" priority
- [x] Clear fix paths provided for all findings

### 🖥️ CLI Output Contract (Must Pass)

- [x] `--json` flag outputs valid JSON on all commands
- [x] Schema version in JSON output for compatibility
- [x] Consistent exit codes (0=pass, 1=fail, 2=auth, 3+=specific errors)
- [x] Human-readable errors with next steps
- [x] No crashes on malformed input
- [x] Works in CI environments (non-TTY)

### ⚡ Performance (Must Pass)

- [x] File-level caching for incremental scans
- [x] Cache invalidation on file changes
- [x] Reasonable timeout defaults
- [x] Async operations don't block CLI

### 🧪 Testing (Must Pass)

- [x] Unit tests for scan output schema
- [x] Unit tests for scan cache
- [x] Unit tests for error handling
- [x] Integration test for gate command
- [ ] E2E test with sample project fixture
- [ ] All tests passing in CI

### 📝 Documentation (Must Pass)

- [x] Release notes draft
- [x] CLI help text accurate
- [ ] API documentation updated
- [ ] Troubleshooting guide

---

## Ranked Punchlist

### P0 - Critical (Must Fix Before Release)

| # | Issue | Status | Files |
|---|-------|--------|-------|
| 1 | ~~Mock upload in runGate~~ | ✅ Fixed | `bin/runners/runGate.js` |
| 2 | ~~No JSON schema for output~~ | ✅ Fixed | `bin/runners/lib/scan-output-schema.js` |
| 3 | ~~Inconsistent exit codes~~ | ✅ Fixed | `bin/runners/lib/error-handler.js` |

### P1 - High (Should Fix)

| # | Issue | Status | Files |
|---|-------|--------|-------|
| 1 | ~~No confidence scoring~~ | ✅ Fixed | `bin/runners/lib/scan-output-schema.js` |
| 2 | ~~Noisy duplicate findings~~ | ✅ Fixed | `bin/runners/lib/scan-output-schema.js` |
| 3 | ~~No incremental caching~~ | ✅ Fixed | `bin/runners/lib/scan-cache.js` |
| 4 | ~~Vague error messages~~ | ✅ Fixed | `bin/runners/lib/error-handler.js` |

### P2 - Medium (Nice to Have)

| # | Issue | Status | Files |
|---|-------|--------|-------|
| 1 | Telemetry for scan pipeline | 🔄 In Progress | - |
| 2 | ~~Comprehensive tests~~ | ✅ Added | `tests/cli/` |

---

## Verification Commands

```bash
# Run all tests
pnpm test

# Run CLI-specific tests
pnpm test -- tests/cli/

# Lint check
pnpm lint

# Type check
pnpm tsc --noEmit

# Smoke test: scan
node bin/guardrail.js scan --json

# Smoke test: gate
node bin/guardrail.js gate --json

# Smoke test: doctor
node bin/guardrail.js doctor
```

### Expected Outcomes

| Command | Expected Exit Code | Expected Output |
|---------|-------------------|-----------------|
| `guardrail scan --json` | 0 or 1 | Valid JSON with schemaVersion |
| `guardrail gate --json` | 0 or 1 | JSON with verdict field |
| `guardrail doctor` | 0 | Environment diagnostics |
| `guardrail (no args)` | 0 | Help text |

---

## Changes Summary

### Files Created
- `bin/runners/lib/scan-output-schema.js` - Scan output contract with confidence scoring
- `bin/runners/lib/scan-cache.js` - File-level caching for incremental scans
- `tests/cli/scan-output-schema.test.js` - Schema validation tests
- `tests/cli/scan-cache.test.js` - Cache functionality tests

### Files Modified
- `bin/runners/runGate.js` - Real SARIF upload, JSON output, exit codes
- `bin/runners/lib/error-handler.js` - Next-step guidance, EXIT_CODES constant
- `bin/runners/lib/auth.js` - Removed mock entitlements fallback (prior work)

### Files Verified (No Changes Needed)
- `bin/guardrail.js` - Auth bypasses already removed
- `apps/api/src/middleware/fastify-auth.ts` - Auth middleware comprehensive
- `apps/api/src/middleware/plan-gating.ts` - Plan gating working

---

## Rollout Plan

### Pre-Release
1. Run full test suite
2. Test on internal projects
3. Review with team

### Release
1. Tag release `v1.0.0`
2. Publish to npm
3. Update documentation site
4. Announce in changelog

### Rollback Strategy
If critical issues found:
1. Unpublish from npm: `npm unpublish @guardrail/cli@1.0.0`
2. Tag previous version: `npm dist-tag add @guardrail/cli@0.x.x latest`
3. Post incident report

---

## Sign-off

- [ ] Engineering Lead
- [ ] Security Review
- [ ] QA Verification
- [ ] Documentation Review
