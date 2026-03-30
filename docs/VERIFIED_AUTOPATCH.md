# Agent-Safe Autopatch: "Verified Fixes Only"

## Overview

Agent-Safe Autopatch is how guardrail becomes the first tool that can honestly say:

**"We don't just suggest fixes. We prove they work."**

## The Problem

Most tools either:
- Just report issues (you fix manually)
- Auto-fix and pray (hope it doesn't break things)

## The Solution

**Verified Fixes Only**: Fix Packs only ship if they pass verification gates.

## Pipeline

1. **Generate Patch**: AI generates a fix patch
2. **Apply in Sandbox Branch**: Create isolated git branch
3. **Run Proof Suite**: Execute verification gates
   - Build gate: Project builds successfully
   - Tests gate: All tests pass
   - Flows gate: Critical flows work (auth, checkout)
   - Policy gate: Ship checks pass
   - Lint gate: Code style checks pass
   - Type-check gate: TypeScript compiles
4. **Verified Fix Badge**: Only if all gates pass
5. **One-Click Merge**: Safe to merge with confidence

## Usage

### Basic Usage

```bash
# Generate and verify a fix
guardrail autopatch:verify \
  --file src/app.ts \
  --line 42 \
  --patch "const apiUrl = process.env.API_URL;"

# With specific gates
guardrail autopatch:verify \
  --file src/app.ts \
  --line 42 \
  --patch "const apiUrl = process.env.API_URL;" \
  --gates "build,tests,lint,type-check"

# Generate receipt
guardrail autopatch:verify \
  --file src/app.ts \
  --line 42 \
  --patch "const apiUrl = process.env.API_URL;" \
  --receipt

# Auto-merge if verified
guardrail autopatch:verify \
  --file src/app.ts \
  --line 42 \
  --patch "const apiUrl = process.env.API_URL;" \
  --merge
```

### Merge Verified Fix

```bash
# Merge a verified fix
guardrail autopatch:merge --fix-id <fix-id>

# Merge to specific branch
guardrail autopatch:merge --fix-id <fix-id> --target develop
```

## Verification Gates

### Build Gate
- **Purpose**: Ensure project builds successfully
- **Commands**: `npm run build`, `pnpm build`, `yarn build`
- **Timeout**: 2 minutes
- **Required**: Yes (if build command exists)

### Tests Gate
- **Purpose**: Run test suite
- **Commands**: `npm test`, `pnpm test`, `yarn test`
- **Timeout**: 5 minutes
- **Required**: Yes (if test command exists)

### Flows Gate
- **Purpose**: Run reality mode critical flows
- **Commands**: `guardrail reality --flow auth`, `guardrail reality --flow checkout`
- **Timeout**: 2 minutes per flow
- **Required**: No (skipped if guardrail not available)

### Policy Gate
- **Purpose**: Run ship checks
- **Commands**: `guardrail ship`
- **Timeout**: 2 minutes
- **Required**: No (skipped if guardrail not available)

### Lint Gate
- **Purpose**: Code style checks
- **Commands**: `npm run lint`, `pnpm lint`, `yarn lint`
- **Timeout**: 1 minute
- **Required**: No (skipped if lint command not found)

### Type-Check Gate
- **Purpose**: TypeScript compilation
- **Commands**: `tsc --noEmit`, `npm run type-check`
- **Timeout**: 2 minutes
- **Required**: No (skipped if TypeScript not found)

## Fix Status

### pending
- Fix generated, verification not started
- Branch created, patch applied

### verifying
- Verification gates running
- All gates must pass

### verified
- All gates passed
- Ready to merge
- Receipt generated (if requested)

### failed
- One or more gates failed
- Fix not safe to merge
- Review gate results

### merged
- Successfully merged to target branch
- Sandbox branch cleaned up

## Example Output

```
🔧 VERIFIED AUTOPATCH

Creating verified fix...
  File: src/app.ts
  Line: 42
  Gates: build,tests,lint,type-check

Verification Results:

  ✓ build (1234ms)
  ✓ tests (5678ms)
  ✓ lint (234ms)
  ✓ type-check (1234ms)

✓ VERIFIED FIX

  Branch: guardrail/verified-fix-a1b2c3d4
  Status: verified
  Verified at: 2026-01-13T23:00:00.000Z
  Receipt: .guardrail/verified-fixes/a1b2c3d4/receipt.json

To merge this fix:
  guardrail autopatch:merge --fix-id a1b2c3d4
```

## Integration with Findings

```typescript
// Generate fix from finding
const finding = await getFinding(findingId);
const patch = generatePatch(finding);

// Verify fix
const autopatch = new VerifiedAutopatch(projectPath);
const fix = await autopatch.createVerifiedFix({
  projectPath,
  findingId: finding.id,
  file: finding.file,
  line: finding.line,
  patch: patch.content,
  gates: ['build', 'tests', 'lint', 'type-check'],
  generateReceipt: true,
});

// Merge if verified
if (fix.status === 'verified') {
  await autopatch.mergeFix(fix.id);
}
```

## Receipt Integration

Verified fixes can generate Proof-of-Execution Receipts:

```json
{
  "verdict": "SHIP",
  "execution": {
    "commands": [
      {
        "command": "gate:build",
        "exitCode": 0,
        "duration": 1234
      },
      {
        "command": "gate:tests",
        "exitCode": 0,
        "duration": 5678
      }
    ]
  },
  "metadata": {
    "fixId": "a1b2c3d4",
    "findingId": "finding-123"
  }
}
```

## Benefits

1. **Proven to Work**: Fixes are verified before merge
2. **No Breaking Changes**: Gates catch regressions
3. **Confidence**: Merge with cryptographic proof
4. **Automated**: No manual verification needed
5. **Safe**: Sandbox branches isolate changes

## Best Practices

1. **Always verify**: Never skip verification gates
2. **Use receipts**: Generate receipts for audit trail
3. **Review failures**: Understand why gates failed
4. **Merge carefully**: Review verified fixes before merging
5. **Clean up**: Remove sandbox branches after merge

## Limitations

- Requires git repository
- Requires build/test commands in package.json
- Some gates may be skipped if tools not available
- TypeScript projects benefit most from type-check gate

## Future Enhancements

- [ ] Custom gate definitions
- [ ] Gate result caching
- [ ] Parallel gate execution
- [ ] Gate result visualization
- [ ] Integration with CI/CD
- [ ] PR creation for verified fixes

## The Moat

This becomes your moat because:

- **Nobody else proves fixes**: Competitors suggest; you verify
- **Cryptographic proof**: Receipts prove fixes work
- **Zero-trust**: Every fix is verified, no exceptions
- **Developer confidence**: Merge with proof, not hope

This is how you become the first tool that can honestly say:

**"We don't just suggest fixes. We prove they work."**
