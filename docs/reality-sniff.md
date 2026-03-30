# Reality Sniff - Advanced AI Artifact Detection

Reality Sniff is guardrail's three-layer verifier that detects AI-generated fake logic with receipts and low false positives.

## Overview

Reality Sniff uses an **Evidence Ladder** approach:

1. **Lexical Evidence** (fast, cheap) - Regex pattern matching
2. **Structural Evidence** (AST analysis) - Verifies reachability and context
3. **Runtime Witness** (proof traces) - Playwright traces, HTTP probes

## Philosophy

> **FAIL only when you can prove reachability/impact in prod paths. Everything else WARN/INFO.**

This keeps false positives low and makes FAIL verdicts defensible.

## Usage

```bash
# Basic scan (lexical + structural)
guardrail reality-sniff

# Skip AST verification
guardrail reality-sniff --no-structural

# Enable runtime witness (experimental)
guardrail reality-sniff --runtime --verbose
```

## Detection Passes

### Pass A: AI Artifact Vocabulary

Detects placeholder/stub/TODO patterns:
- `TODO`, `FIXME`, `XXX`, `HACK`, `WIP`
- `placeholder`, `stub`, `dummy`, `fake`
- `not implemented`, `coming soon`
- `hardcoded`, `temporary`, `workaround`

**Verdict Rules:**
- In non-prod paths → WARN or ignore
- In runtime paths → candidate FAIL if paired with dangerous patterns

### Pass B: Silent Failure Patterns

Detects empty catch blocks and error swallowing:

```typescript
// Empty catch - FAIL if in prod
catch (err) {}

// Swallowed error - WARN
catch (err) {
  // best effort, ignore error
}
```

**Verdict Rules:**
- Empty catch outside non-prod → FAIL unless logs + rethrows
- "best effort/fallback" → WARN, escalates if paired with fake success

### Pass C: Fake Success Patterns

Detects "success: true" lies:

```typescript
// In error path - FAIL
catch (err) {
  return { success: true }; // ❌
}

// In normal path - WARN
return { success: true }; // ⚠️
```

**Verdict Rules:**
- In API handlers/controllers → WARN
- In error paths (catch/onError) → FAIL
- Escalates if replaces real check

### Pass D: Auth/Permissions Shortcuts

Detects auth bypass patterns:

```typescript
// FAIL - unguarded
bypassAuth = true;
skipAuth();
ALLOW_ALL = true;

// WARN - guarded by NODE_ENV
if (process.env.NODE_ENV !== 'production') {
  bypassAuth = true; // ⚠️
}
```

**Verdict Rules:**
- Any match outside non-prod → FAIL unless explicitly guarded
- Guarded by safe build-time flag → WARN

### Pass E: Dangerous Defaults

Detects dangerous environment variable defaults:

```typescript
// FAIL - secrets with defaults
const apiKey = process.env.API_KEY || 'test-key';
const dbUrl = process.env.DATABASE_URL || 'localhost';

// WARN - harmless defaults
const port = process.env.PORT || 3000;
```

**Verdict Rules:**
- Defaults for secrets/auth/webhooks/billing → FAIL
- Defaults for harmless settings → WARN

## Scoring System

Findings are scored with points:

- **+5**: Empty catch, auth bypass, webhook signature missing
- **+3**: Fake success patterns, dangerous env defaults
- **+1**: Placeholder/stub/TODO wording
- **-3**: File path matches non-prod hints (tests/examples)

**Decision:**
- **FAIL** if score ≥ 5
- **WARN** if score 2–4
- **INFO** if score 1

## Evidence Ladder

### Level 1: Lexical Evidence

Fast regex matching. Output: WARN by default.

### Level 2: Structural Evidence (AST)

AST-based verification:
- Empty catch: verify no logging/rethrow
- Fake success: detect returns in catch/error handlers
- Auth bypass: verify reachability in production

Output: FAIL if reachable in prod path.

### Level 3: Runtime Witness

Runtime proof collection:
- Route reality checks
- HTTP probes for critical routes
- Playwright traces

Output: FAIL with replay artifact.

## Reality Proof Graph

Every finding becomes a graph node with evidence edges:

- **Nodes**: Findings, evidence, routes, files, dependencies
- **Edges**: `depends_on`, `reachable_via`, `guarded_by`, `validated_by`, `evidence_of`

Used for:
- Deduplication and prioritization
- Topological "blocks shipping first" ordering
- Receipt generation

## Output

### CLI Output

```
VERDICT: ❌ FAIL
SCORE: 45/100

SUMMARY:
  Total findings: 12
  Critical: 3
  High: 5
  Medium: 2
  Low: 2

🚨 TOP BLOCKERS (3):

  1. Empty Catch Block
     Empty catch block detected - errors are silently swallowed
     src/api/routes.ts:42
     → Add error logging and/or rethrow

  2. Auth Bypass Pattern
     Auth bypass pattern detected: bypassAuth
     src/middleware/auth.ts:15
     → Remove auth bypass or guard behind safe build-time flag
```

### Receipts

Each finding can generate a detailed receipt:

```bash
guardrail reality-sniff --receipt <finding-id>
```

Receipts include:
- Verdict and severity
- Evidence chain
- File/line/column
- Fix suggestion
- Replay command

## Integration

Reality Sniff integrates with:

- `guardrail scan` - Can include reality-sniff findings
- `guardrail gate` - Blocks on FAIL verdicts
- `guardrail ship` - Pre-ship verification

## Configuration

Create `.guardrailrc`:

```json
{
  "realitySniff": {
    "layers": {
      "lexical": true,
      "structural": true,
      "runtime": false
    },
    "excludePatterns": [
      "**/vendor/**",
      "**/generated/**"
    ],
    "nonProdPaths": [
      "**/__tests__/**",
      "**/examples/**"
    ]
  }
}
```

## Best Practices

1. **Run in CI/CD** - Catch issues before merge
2. **Fix blockers first** - Address FAIL verdicts immediately
3. **Review warnings** - Many are legitimate, but worth checking
4. **Use receipts** - Share detailed evidence with team
5. **Enable runtime** - For critical pre-ship verification

## Examples

### Example 1: Empty Catch Block

```typescript
// ❌ FAIL
try {
  await processPayment();
} catch (err) {
  // Silent failure
}

// ✅ PASS
try {
  await processPayment();
} catch (err) {
  logger.error('Payment failed', err);
  throw err;
}
```

### Example 2: Fake Success

```typescript
// ❌ FAIL
async function createUser(data) {
  try {
    return await db.users.create(data);
  } catch (err) {
    return { success: true }; // Fake success
  }
}

// ✅ PASS
async function createUser(data) {
  try {
    return await db.users.create(data);
  } catch (err) {
    logger.error('User creation failed', err);
    throw new Error('Failed to create user');
  }
}
```

### Example 3: Auth Bypass

```typescript
// ❌ FAIL
if (bypassAuth) {
  return next(); // Unguarded
}

// ⚠️ WARN
if (process.env.NODE_ENV !== 'production' && bypassAuth) {
  return next(); // Guarded but still risky
}

// ✅ PASS
// No auth bypass
```

## Next Steps

- [ ] Add runtime witness collection
- [ ] Route reality checks integration
- [ ] Auth chain verification
- [ ] Config truth detection
- [ ] Replay command implementation
