# guardrail AI - API Reference

Complete API documentation for guardrail AI security platform.

## Table of Contents

1. [Authentication](#authentication)
2. [Security Scanning](#security-scanning)
3. [Vulnerability Detection](#vulnerability-detection)
4. [Compliance Assessment](#compliance-assessment)
5. [SBOM Generation](#sbom-generation)
6. [Injection Detection](#injection-detection)
7. [Policy Engine](#policy-engine)

---

## Authentication

All API endpoints require authentication via JWT token or API key.

### Headers

```http
Authorization: Bearer <jwt_token>
# OR
X-API-Key: <api_key>
```

---

## Security Scanning

### Scan for Secrets

Detect hardcoded secrets and credentials in source code.

```http
POST /api/security/scan/secrets
```

**Request Body:**

```json
{
  "content": "string (code content to scan)",
  "projectPath": "string (alternative: path to project)",
  "options": {
    "includeTests": false,
    "sensitivity": "high|medium|low"
  }
}
```

**Response:**

```json
{
  "success": true,
  "data": {
    "detections": [
      {
        "id": "string",
        "secretType": "API_KEY|PASSWORD|TOKEN|...",
        "maskedValue": "sk-****1234",
        "location": {
          "file": "src/config.ts",
          "line": 15,
          "column": 10
        },
        "confidence": 0.95,
        "severity": "critical|high|medium|low",
        "recommendation": {
          "action": "remove|move_to_env|use_vault",
          "remediation": "Move to environment variable"
        }
      }
    ],
    "summary": {
      "totalSecrets": 5,
      "byType": { "API_KEY": 2, "PASSWORD": 3 },
      "byRisk": { "critical": 1, "high": 2, "medium": 2 }
    }
  }
}
```

---

## Vulnerability Detection

### Check Package Vulnerabilities

```http
POST /api/security/scan/vulnerabilities
```

**Request Body:**

```json
{
  "packages": [
    { "name": "lodash", "version": "4.17.21" },
    { "name": "express", "version": "4.18.2" }
  ]
}
```

**Response:**

```json
{
  "success": true,
  "data": {
    "results": [
      {
        "package": "lodash",
        "version": "4.17.21",
        "isVulnerable": false,
        "vulnerabilities": [],
        "highestSeverity": "none"
      }
    ],
    "summary": {
      "critical": 0,
      "high": 1,
      "medium": 2,
      "low": 0
    }
  }
}
```

### Check for Typosquatting

```http
POST /api/security/scan/typosquat
```

**Request Body:**

```json
{
  "packageName": "react"
}
```

**Response:**

```json
{
  "success": true,
  "data": {
    "isTyposquat": false,
    "suspiciousPackage": "react",
    "targetPackage": null,
    "similarity": 0,
    "patterns": []
  }
}
```

---

## Compliance Assessment

### Run Compliance Check

```http
POST /api/compliance/assess
```

**Request Body:**

```json
{
  "projectPath": "/path/to/project",
  "framework": "soc2|gdpr|hipaa|pci|iso27001|nist"
}
```

**Response:**

```json
{
  "success": true,
  "data": {
    "framework": "SOC 2",
    "score": 85,
    "passedControls": 42,
    "failedControls": 8,
    "totalControls": 50,
    "results": [
      {
        "controlId": "CC6.1",
        "title": "Logical Access Security",
        "passed": true,
        "findings": [],
        "recommendations": []
      }
    ]
  }
}
```

---

## SBOM Generation

### Generate Software Bill of Materials

```http
POST /api/security/sbom/generate
```

**Request Body:**

```json
{
  "projectPath": "/path/to/project",
  "format": "cyclonedx|spdx|json",
  "options": {
    "includeDevDependencies": false,
    "includeLicenses": true,
    "includeHashes": true
  }
}
```

**Response:**

```json
{
  "success": true,
  "data": {
    "format": "cyclonedx",
    "specVersion": "1.5",
    "serialNumber": "urn:uuid:...",
    "metadata": {
      "timestamp": "2025-01-01T00:00:00Z",
      "component": {
        "name": "my-project",
        "version": "1.0.0"
      }
    },
    "components": [
      {
        "name": "lodash",
        "version": "4.17.21",
        "purl": "pkg:npm/lodash@4.17.21",
        "licenses": ["MIT"]
      }
    ]
  }
}
```

---

## Injection Detection

### Scan for Prompt Injection

```http
POST /api/injection/scan
```

**Request Body:**

```json
{
  "content": "User message to scan",
  "contentType": "user_input|code|data_source"
}
```

**Response:**

```json
{
  "success": true,
  "data": {
    "verdict": "CLEAN|SUSPICIOUS|MALICIOUS|BLOCKED",
    "confidence": 0.95,
    "detections": [
      {
        "type": "instruction_override",
        "severity": "critical",
        "pattern": "ignore previous instructions",
        "location": { "start": 0, "end": 28 }
      }
    ],
    "recommendation": {
      "action": "allow|sanitize|block|review",
      "reason": "Content appears safe"
    },
    "scanDuration": 15
  }
}
```

### Sanitize Content

```http
POST /api/injection/sanitize
```

**Request Body:**

```json
{
  "content": "Content with potential injection attempts"
}
```

**Response:**

```json
{
  "success": true,
  "data": {
    "original": "...",
    "sanitized": "...",
    "modificationsApplied": true
  }
}
```

---

## Policy Engine

### Evaluate Policy

```http
POST /api/policy/evaluate
```

**Request Body:**

```json
{
  "policyId": "no-hardcoded-secrets",
  "input": {
    "type": "code",
    "data": {
      "content": "const apiKey = 'secret123';"
    }
  }
}
```

**Response:**

```json
{
  "success": true,
  "data": {
    "policyId": "no-hardcoded-secrets",
    "allowed": false,
    "violations": [
      {
        "rule": "no-hardcoded-secrets",
        "message": "Potential secret detected",
        "severity": "critical",
        "remediation": "Move to environment variable"
      }
    ],
    "evaluatedAt": "2025-01-01T00:00:00Z",
    "durationMs": 5
  }
}
```

### List Policies

```http
GET /api/policy/list
```

**Response:**

```json
{
  "success": true,
  "data": {
    "policies": [
      {
        "id": "no-hardcoded-secrets",
        "name": "No Hardcoded Secrets",
        "category": "security",
        "severity": "critical",
        "enabled": true
      }
    ]
  }
}
```

---

## Error Responses

All endpoints return consistent error responses:

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid request body",
    "details": [
      { "field": "content", "message": "Required field missing" }
    ]
  }
}
```

### Error Codes

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `VALIDATION_ERROR` | 400 | Invalid request parameters |
| `UNAUTHORIZED` | 401 | Missing or invalid authentication |
| `FORBIDDEN` | 403 | Insufficient permissions |
| `NOT_FOUND` | 404 | Resource not found |
| `RATE_LIMITED` | 429 | Too many requests |
| `INTERNAL_ERROR` | 500 | Server error |

---

## Rate Limits

| Plan | Requests/minute | Scans/day |
|------|-----------------|-----------|
| Free | 10 | 100 |
| Pro | 100 | 5,000 |
| Enterprise | 1,000 | Unlimited |

---

## SDK Examples

### JavaScript/TypeScript

```typescript
import { GuardrailClient } from '@guardrail/sdk';

const client = new GuardrailClient({
  apiKey: process.env.Guardrail_API_KEY,
});

// Scan for secrets
const secretsResult = await client.security.scanSecrets({
  content: sourceCode,
});

// Check vulnerabilities
const vulnResult = await client.security.checkVulnerabilities({
  packages: [{ name: 'lodash', version: '4.17.21' }],
});

// Run compliance assessment
const complianceResult = await client.compliance.assess({
  projectPath: '/path/to/project',
  framework: 'soc2',
});
```

### Python

```python
from guardrail import GuardrailClient

client = GuardrailClient(api_key=os.environ['Guardrail_API_KEY'])

# Scan for secrets
result = client.security.scan_secrets(content=source_code)

# Check vulnerabilities  
result = client.security.check_vulnerabilities(
    packages=[{'name': 'requests', 'version': '2.31.0'}]
)
```

### CLI

```bash
# Scan for secrets
guardrail scan:secrets --path ./src

# Check vulnerabilities
guardrail scan:vulnerabilities --path .

# Generate SBOM
guardrail sbom:generate --format cyclonedx --output sbom.json

# Run compliance check
guardrail scan:compliance --framework soc2
```

---

## Webhooks

Configure webhooks for real-time notifications:

```http
POST /api/webhooks
```

**Request Body:**

```json
{
  "url": "https://your-server.com/webhook",
  "events": ["scan.completed", "vulnerability.detected", "secret.found"],
  "secret": "webhook_secret_for_verification"
}
```

Webhook payload example:

```json
{
  "event": "vulnerability.detected",
  "timestamp": "2025-01-01T00:00:00Z",
  "data": {
    "projectId": "proj_123",
    "severity": "critical",
    "package": "lodash",
    "version": "4.17.20",
    "vulnerability": {
      "id": "CVE-2021-23337",
      "title": "Command Injection"
    }
  },
  "signature": "sha256=..."
}
```

---

*Context Enhanced by guardrail AI*
