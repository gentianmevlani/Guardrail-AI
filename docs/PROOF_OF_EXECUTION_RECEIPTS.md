# Proof-of-Execution Receipts

## Overview

Proof-of-Execution Receipts are tamper-evident, machine-verifiable evidence bundles that prove a PASS/SHIP verdict was actually executed, not just "we think it works."

## Why Receipts Matter

**Competitors show findings; guardrail shows evidence.**

When a CTO asks: *"Did you actually hit `/api/billing/upgrade` and confirm Stripe webhooks update state?"*

You can answer with cryptographic proof.

## What's Inside a Receipt

Every receipt bundle contains:

### 1. Build & Dependency Evidence
- **Build Hash**: Cryptographic hash of build artifacts (dist/, build/, .next/)
- **Dependency Lock Hash**: SHA-256 of package-lock.json, yarn.lock, or pnpm-lock.yaml
- **Package Manager**: npm, yarn, or pnpm
- **Platform**: OS and architecture

### 2. Execution Evidence
- **Commands Run**: Exact commands executed with args, exit codes, stdout/stderr, duration
- **Runtime Traces**:
  - HTTP requests (method, URL, status code, headers, duration)
  - Routes hit (path, method, response time)
  - Database queries (query text, duration, table)

### 3. Coverage Evidence
- **Critical Paths**: Predefined critical paths (auth, billing, write operations)
- **Coverage Report**: Percentage of critical paths covered
- **Evidence**: Screenshot/video paths proving coverage

### 4. Artifacts
- **Screenshots**: All screenshots captured during execution
- **Videos**: Video recordings of test execution
- **Traces**: Playwright trace files
- **Logs**: Execution logs

### 5. Cryptographic Attestation
- **Algorithm**: RS256, ES256, or HMAC-SHA256
- **Key ID**: Organization key identifier
- **Signature**: Tamper-evident signature over entire receipt
- **Signed At**: Timestamp of signing

## Usage

### Generate Receipt

```bash
# Generate receipt automatically with reality command
guardrail reality --url https://app.example.com --flow checkout --receipt

# With organization key for signing
guardrail reality --url https://app.example.com --flow checkout \
  --receipt \
  --org-key-id "org-12345" \
  --org-private-key "$(cat org-key.pem)"
```

### Verify Receipt

```bash
# Verify a single receipt
guardrail receipt:verify --path .guardrail/receipts/run-123/receipt.json

# Verify all receipts in directory
guardrail receipt:verify --path .guardrail/receipts

# With organization public key
guardrail receipt:verify \
  --path .guardrail/receipts \
  --org-public-key "$(cat org-public-key.pem)"
```

## Receipt Structure

```
.guardrail/receipts/
└── receipt-{runId}-{timestamp}/
    ├── manifest.json          # Receipt metadata
    ├── receipt.json          # Full receipt bundle
    ├── receipt-summary.txt   # Human-readable summary
    └── artifacts/            # Evidence artifacts
        ├── screenshots/
        ├── videos/
        ├── traces/
        └── logs/
```

## Receipt Schema

```json
{
  "schemaVersion": "guardrail.receipt.v1",
  "receiptId": "receipt-run-123-1234567890",
  "verdict": "SHIP",
  "timestamp": "2026-01-13T23:00:00.000Z",
  
  "build": {
    "buildHash": "sha256:abc123...",
    "dependencyLockHash": "sha256:def456...",
    "packageManager": "npm",
    "nodeVersion": "v20.10.0",
    "platform": "linux-x64"
  },
  
  "execution": {
    "commands": [
      {
        "command": "npx",
        "args": ["playwright", "test", "..."],
        "exitCode": 0,
        "duration": 45000,
        "timestamp": "2026-01-13T23:00:00.000Z"
      }
    ],
    "runtimeTraces": {
      "requests": [
        {
          "method": "POST",
          "url": "https://app.example.com/api/billing/upgrade",
          "statusCode": 200,
          "duration": 234,
          "timestamp": "2026-01-13T23:00:15.000Z"
        }
      ],
      "routes": [
        {
          "path": "/api/billing/upgrade",
          "method": "POST",
          "hit": true,
          "responseTime": 234,
          "timestamp": "2026-01-13T23:00:15.000Z"
        }
      ],
      "dbQueries": [
        {
          "query": "UPDATE subscriptions SET status = 'active' WHERE id = $1",
          "duration": 12,
          "table": "subscriptions",
          "timestamp": "2026-01-13T23:00:15.012Z"
        }
      ]
    }
  },
  
  "coverage": {
    "criticalPaths": [
      {
        "path": "/api/billing/upgrade",
        "description": "Billing upgrade endpoint",
        "covered": true,
        "evidence": ["screenshots/checkout-1.png", "videos/checkout.webm"],
        "timestamp": "2026-01-13T23:00:15.000Z"
      }
    ],
    "coverageReport": {
      "totalPaths": 5,
      "coveredPaths": 5,
      "percentage": 100
    }
  },
  
  "artifacts": {
    "screenshots": ["screenshots/checkout-1.png"],
    "videos": ["videos/checkout.webm"],
    "traces": ["traces/trace.zip"],
    "logs": ["output.log"]
  },
  
  "attestation": {
    "algorithm": "RS256",
    "keyId": "org-12345",
    "signature": "base64:signature...",
    "signedAt": "2026-01-13T23:00:30.000Z"
  },
  
  "metadata": {
    "projectPath": "/path/to/project",
    "gitSha": "abc123def456",
    "gitBranch": "main",
    "runId": "run-123",
    "toolVersion": "2.0.0"
  }
}
```

## Critical Paths

Critical paths are predefined routes that must be covered for a SHIP verdict:

### Auth Flow
- `/api/auth/login` - User authentication
- `/api/auth/session` - Session validation
- `/api/auth/logout` - Session termination
- `/login` - Login page
- `/dashboard` - Post-auth redirect

### Checkout Flow
- `/api/billing/upgrade` - Billing upgrade
- `/api/webhooks/stripe` - Stripe webhook handler
- `/checkout` - Checkout page
- `/api/payment/intent` - Payment intent creation
- `/api/subscription` - Subscription management

### Dashboard Flow
- `/api/user/profile` - User profile
- `/api/settings` - Settings endpoint
- `/dashboard` - Dashboard page
- `/api/data` - Data fetching

## Signing & Verification

### Organization Keys

Receipts can be signed with organization keys for tamper-evident verification:

1. **RSA (RS256)**: Recommended for production
   ```bash
   # Generate key pair
   openssl genrsa -out org-private-key.pem 2048
   openssl rsa -in org-private-key.pem -pubout -out org-public-key.pem
   ```

2. **ECDSA (ES256)**: Smaller keys, same security
   ```bash
   # Generate key pair
   openssl ecparam -genkey -name secp256r1 -noout -out org-private-key.pem
   openssl ec -in org-private-key.pem -pubout -out org-public-key.pem
   ```

3. **HMAC-SHA256**: Simple shared secret (less secure)
   ```bash
   export GUARDRAIL_ORG_KEY="your-secret-key"
   ```

### Verification Process

1. Extract signature from receipt
2. Recompute signature over receipt content (without signature field)
3. Compare signatures using timing-safe comparison
4. Verify artifact hashes match receipt claims
5. Check receipt timestamp is valid

## Integration Examples

### CI/CD Integration

```yaml
# GitHub Actions
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

- name: Upload Receipts as Artifacts
  uses: actions/upload-artifact@v3
  with:
    name: proof-of-execution-receipts
    path: .guardrail/receipts/
```

### Audit Trail

Receipts provide cryptographic proof for:
- Compliance audits
- Security reviews
- Incident investigations
- Vendor assessments

### CTO Questions Answered

**Q: "Did you actually test the billing upgrade?"**
A: Receipt shows HTTP POST to `/api/billing/upgrade` with 200 status, DB query updating subscriptions table, screenshot of success page.

**Q: "Can you prove Stripe webhooks work?"**
A: Receipt shows webhook endpoint hit, subscription status updated in database, video recording of full flow.

**Q: "Is this receipt tampered?"**
A: Run `guardrail receipt:verify` - signature verification will fail if tampered.

## Best Practices

1. **Always generate receipts for production deployments**
2. **Store receipts in version control or artifact storage**
3. **Use organization keys for production receipts**
4. **Verify receipts before trusting verdicts**
5. **Archive receipts for compliance requirements**

## Limitations

- Receipts prove execution happened, not that code is correct
- Runtime traces require Playwright network interception
- DB query tracing requires database proxy/monitoring
- Large artifacts increase receipt size

## Future Enhancements

- [ ] Automatic receipt generation for all SHIP verdicts
- [ ] Receipt aggregation across multiple runs
- [ ] Receipt comparison (diff between runs)
- [ ] Receipt API for programmatic access
- [ ] Receipt visualization dashboard
