# Proof-of-Execution Receipts Implementation

## Overview

Proof-of-Execution Receipts transform guardrail from "we think it works" to "here's cryptographic proof it actually executed."

Every PASS/SHIP verdict now includes a tamper-evident receipt bundle with machine-verifiable evidence.

## What Was Implemented

### 1. Receipt Generator (`packages/cli/src/reality/receipt-generator.ts`)

Generates comprehensive receipt bundles containing:

- **Build Evidence**: SHA-256 hashes of build artifacts and dependency lock files
- **Execution Evidence**: Exact commands run, HTTP requests, routes hit, DB queries
- **Coverage Evidence**: Critical paths (auth, billing, write ops) with proof of coverage
- **Artifacts**: Screenshots, videos, traces, logs
- **Attestation**: Cryptographic signature (RS256/ES256/HMAC-SHA256) with org key

### 2. Runtime Tracer (`packages/cli/src/reality/runtime-tracer.ts`)

Collects runtime traces during test execution:

- HTTP request/response interception
- Route hit tracking
- Database query logging (when instrumented)
- Request duration and status code tracking

### 3. Enhanced Playwright Test Template

Updated `packages/ship/src/reality-mode/reality-scanner.ts` to:

- Record all HTTP requests/responses with timing
- Track routes hit during execution
- Save runtime traces to `runtime-traces.json`
- Link screenshots/videos to critical paths

### 4. CLI Integration

Enhanced `guardrail reality` command with:

- `--receipt` flag to generate receipts
- `--org-key-id` for organization key identification
- `--org-private-key` for signing receipts
- Automatic receipt generation after test execution
- Receipt summary display in output

### 5. Receipt Verification Command

New `guardrail receipt:verify` command:

- Verifies receipt signatures
- Checks for tampering
- Validates artifact hashes
- Supports batch verification

## Usage Examples

### Generate Receipt

```bash
# Basic receipt generation
guardrail reality --url https://app.example.com --flow checkout --receipt

# With organization signing
guardrail reality \
  --url https://app.example.com \
  --flow checkout \
  --receipt \
  --org-key-id "org-12345" \
  --org-private-key "$(cat org-private-key.pem)"
```

### Verify Receipt

```bash
# Verify single receipt
guardrail receipt:verify --path .guardrail/receipts/receipt-123/receipt.json

# Verify all receipts
guardrail receipt:verify --path .guardrail/receipts

# With public key
guardrail receipt:verify \
  --path .guardrail/receipts \
  --org-public-key "$(cat org-public-key.pem)"
```

## Receipt Structure

```
.guardrail/receipts/
└── receipt-{runId}-{timestamp}/
    ├── manifest.json          # Receipt metadata
    ├── receipt.json          # Full receipt bundle (signed)
    ├── receipt-summary.txt   # Human-readable summary
    └── artifacts/            # Evidence artifacts
        ├── screenshots/
        ├── videos/
        ├── traces/
        └── logs/
```

## Critical Paths

Predefined critical paths that must be covered:

### Auth Flow
- `/api/auth/login` - User authentication
- `/api/auth/session` - Session validation
- `/api/auth/logout` - Session termination
- `/login` - Login page
- `/dashboard` - Post-auth redirect

### Checkout Flow
- `/api/billing/upgrade` - Billing upgrade endpoint
- `/api/webhooks/stripe` - Stripe webhook handler
- `/checkout` - Checkout page
- `/api/payment/intent` - Payment intent creation
- `/api/subscription` - Subscription management

### Dashboard Flow
- `/api/user/profile` - User profile endpoint
- `/api/settings` - Settings endpoint
- `/dashboard` - Dashboard page
- `/api/data` - Data fetching endpoint

## Signing & Verification

### Organization Keys

1. **RSA (RS256)** - Recommended for production
   ```bash
   openssl genrsa -out org-private-key.pem 2048
   openssl rsa -in org-private-key.pem -pubout -out org-public-key.pem
   ```

2. **ECDSA (ES256)** - Smaller keys
   ```bash
   openssl ecparam -genkey -name secp256r1 -noout -out org-private-key.pem
   openssl ec -in org-private-key.pem -pubout -out org-public-key.pem
   ```

3. **HMAC-SHA256** - Shared secret (fallback)
   ```bash
   export GUARDRAIL_ORG_KEY="your-secret-key"
   ```

## Answering CTO Questions

**Q: "Did you actually hit `/api/billing/upgrade`?"**
A: Receipt shows:
- HTTP POST request to `/api/billing/upgrade`
- Status code 200
- Duration: 234ms
- Screenshot: `screenshots/checkout-success.png`
- Video: `videos/checkout-flow.webm`

**Q: "Can you prove Stripe webhooks work?"**
A: Receipt shows:
- Webhook endpoint `/api/webhooks/stripe` hit
- DB query: `UPDATE subscriptions SET status = 'active'`
- Response time: 45ms
- Full trace available in `traces/trace.zip`

**Q: "Is this receipt tampered?"**
A: Run `guardrail receipt:verify` - signature verification will fail if tampered.

## Integration with CI/CD

```yaml
# GitHub Actions example
- name: Run Reality Mode with Receipts
  run: |
    guardrail reality \
      --url ${{ env.APP_URL }} \
      --flow checkout \
      --receipt \
      --org-key-id "${{ secrets.ORG_KEY_ID }}" \
      --org-private-key "${{ secrets.ORG_PRIVATE_KEY }}"

- name: Verify Receipts
  run: |
    guardrail receipt:verify \
      --path .guardrail/receipts \
      --org-public-key "${{ secrets.ORG_PUBLIC_KEY }}"

- name: Upload Receipts
  uses: actions/upload-artifact@v3
  with:
    name: proof-of-execution-receipts
    path: .guardrail/receipts/
```

## Benefits

1. **Cryptographic Proof**: Verdicts are tamper-evident artifacts
2. **Audit Trail**: Complete execution history for compliance
3. **CTO Confidence**: Answer "did it actually work?" with evidence
4. **Incident Investigation**: Replay exactly what happened
5. **Vendor Assessment**: Prove to customers that tests ran

## Next Steps

- [ ] Automatic receipt generation for all SHIP verdicts
- [ ] Receipt API for programmatic access
- [ ] Receipt visualization dashboard
- [ ] Receipt comparison (diff between runs)
- [ ] Database query instrumentation hooks

## Files Created/Modified

**New Files:**
- `packages/cli/src/reality/receipt-generator.ts` - Receipt generation
- `packages/cli/src/reality/runtime-tracer.ts` - Runtime trace collection
- `docs/PROOF_OF_EXECUTION_RECEIPTS.md` - User documentation
- `docs/REALITY_RECEIPTS_IMPLEMENTATION.md` - This file

**Modified Files:**
- `packages/cli/src/reality/reality-runner.ts` - Integrated receipt generation
- `packages/cli/src/index.ts` - Added `--receipt` flag and `receipt:verify` command
- `packages/ship/src/reality-mode/reality-scanner.ts` - Enhanced test template with tracing

## Testing

```bash
# Test receipt generation
guardrail reality --url http://localhost:3000 --flow auth --receipt --run

# Test receipt verification
guardrail receipt:verify --path .guardrail/receipts

# Test with org key
guardrail reality \
  --url http://localhost:3000 \
  --flow checkout \
  --receipt \
  --org-key-id "test-org" \
  --org-private-key "$(cat test-key.pem)"
```
