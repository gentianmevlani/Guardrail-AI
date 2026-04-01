# Reality Sniff - Quick Reference

## What It Does

Reality Sniff detects AI-generated fake logic using a three-layer verifier:

1. **Lexical** (fast regex) - Catches obvious patterns
2. **Structural** (AST) - Verifies reachability and context  
3. **Runtime** (proof) - Generates replay artifacts

## Philosophy

> **FAIL only when you can prove reachability/impact in prod paths.**

## Quick Start

```bash
# Basic scan
guardrail reality-sniff

# Replay previous scan
guardrail reality-sniff --replay <scan-id>

# List scans
guardrail reality-sniff --list
```

## What It Catches

### Pass A: AI Artifacts
- `TODO`, `FIXME`, `placeholder`, `stub`, `dummy`, `fake`
- `not implemented`, `coming soon`, `hardcoded`

### Pass B: Silent Failures
- Empty catch blocks
- Swallowed errors
- Best-effort fallbacks

### Pass C: Fake Success
- `success: true` in error paths
- Always-ok returns
- Fake status responses

### Pass D: Auth Bypass
- `bypassAuth`, `skipAuth`, `ALLOW_ALL`
- Unguarded admin mode
- Dev-only flags in prod

### Pass E: Dangerous Defaults
- Secrets with test defaults
- Missing required env vars
- Unsafe fallbacks

## Scoring

- **FAIL** (score ≥ 5): Blockers that must be fixed
- **WARN** (score 2-4): Issues worth reviewing
- **INFO** (score 1): Minor issues

## Evidence Levels

1. **Lexical**: Regex match → WARN
2. **Structural**: AST verification → FAIL if in prod
3. **Runtime**: Proof traces → FAIL with receipt

## Output

- Verdict (FAIL/WARN/INFO/PASS)
- Score (0-100)
- Top blockers (ranked)
- Receipts for each finding
- Scan ID for replay

## Receipts

Each finding includes:
- Evidence chain
- File/line/column
- Fix suggestion
- Replay command

## Proof Bundles

Runtime scans generate:
- Traces (HTTP, Playwright)
- Screenshots
- HAR files
- Receipts

## Integration

```typescript
import { scanRealitySniff } from '@guardrail/reality-sniff';

const result = await scanRealitySniff({
  projectPath: './src',
  layers: {
    lexical: true,
    structural: true,
    runtime: false,
  },
});

if (result.verdict === 'FAIL') {
  // Block deployment
  process.exit(1);
}
```

## Examples

### Empty Catch Block

```typescript
// ❌ FAIL
try {
  await processPayment();
} catch (err) {}
```

### Fake Success

```typescript
// ❌ FAIL
catch (err) {
  return { success: true };
}
```

### Dangerous Default

```typescript
// ❌ FAIL
const apiKey = process.env.API_KEY || 'test-key';
```

## Best Practices

1. Run in CI/CD - catch before merge
2. Fix blockers first - address FAILs immediately  
3. Review warnings - many are legitimate
4. Use receipts - share evidence with team
5. Enable runtime - for pre-ship verification

## Next Steps

- Read full guide: `docs/reality-sniff.md`
- Check implementation: `REALITY_SNIFF_IMPLEMENTATION.md`
- Run scan: `guardrail reality-sniff`
