# Compliance Scanner

Enterprise-grade compliance scanning with real policy evaluation, evidence collection, and drift detection.

## Overview

The Compliance Scanner is a defensible, production-ready system that evaluates your codebase against industry compliance frameworks including SOC2, GDPR, HIPAA, PCI-DSS, ISO 27001, and NIST CSF.

**Key Features:**
- ✅ Real policy evaluation (no mock output)
- 📋 Policy-as-code rules mapped to compliance frameworks
- 📁 Evidence collection with sanitized snapshots
- 📊 Drift detection with historical trend analysis
- 📄 Multiple output formats (Table, JSON, SARIF)
- 🔧 Extensible with custom policies

## Quick Start

```typescript
import { ComplianceScannerEngine, TableFormatter } from '@guardrail/compliance';

const scanner = new ComplianceScannerEngine();

// Run a compliance scan
const result = await scanner.scan(
  '/path/to/project',
  'soc2',
  {
    collectEvidence: true,
    detectDrift: true
  }
);

// Format and display results
const formatter = new TableFormatter();
console.log(formatter.format(result));
```

## Supported Frameworks

### SOC 2 Type II
Trust Services Criteria for service organizations:
- **CC6.1**: Logical and Physical Access Controls
- **CC6.6**: Security Event Monitoring
- **CC6.7**: Data Protection
- **CC7.2**: System Component Monitoring
- **CC8.1**: Change Management

### GDPR
EU General Data Protection Regulation:
- **Article 25**: Data Protection by Design
- **Article 30**: Processing Activity Records
- **Article 32**: Security of Processing
- **Article 33**: Breach Detection and Notification

### HIPAA
Health Insurance Portability and Accountability Act:
- **164.312(a)(1)**: Access Control
- **164.312(b)**: Audit Controls
- **164.312(c)(1)**: Integrity Controls
- **164.312(d)**: Person or Entity Authentication
- **164.312(e)(1)**: Transmission Security

### PCI-DSS
Payment Card Industry Data Security Standard:
- **Requirement 2**: Secure System Configuration
- **Requirement 3**: Protect Stored Cardholder Data
- **Requirement 4**: Encrypt Transmission
- **Requirement 6**: Secure Development
- **Requirement 8**: Identify and Authenticate Access
- **Requirement 10**: Track and Monitor Access

### ISO 27001
Information Security Management:
- **A.9.2.1**: User Registration
- **A.9.4.1**: Information Access Restriction
- **A.10.1.1**: Cryptographic Controls
- **A.12.4.1**: Event Logging
- **A.14.2.1**: Secure Development Policy

### NIST Cybersecurity Framework
- **Identify**: Asset Management
- **Protect**: Access Control, Data Security
- **Detect**: Monitoring, Event Correlation
- **Respond**: Incident Reporting
- **Recover**: Recovery Plan Execution

## Policy Engine

### Policy Structure

Policies are defined in JSON format in `.guardrail/policies/` or built-in at `packages/compliance/src/policies/`:

```json
{
  "version": "1.0.0",
  "framework": "SOC2",
  "rules": [
    {
      "id": "SOC2-CC6.1-001",
      "controlId": "CC6.1",
      "title": "Authentication Implementation Required",
      "description": "System must implement authentication mechanisms",
      "severity": "critical",
      "category": "access-control",
      "checks": [
        {
          "type": "file-exists",
          "target": "src/auth"
        },
        {
          "type": "dependency-present",
          "target": "passport"
        }
      ],
      "remediation": "Implement authentication using Passport.js or similar"
    }
  ]
}
```

### Check Types

#### file-exists
Verifies that a file or directory exists:
```json
{
  "type": "file-exists",
  "target": "src/middleware/auth.ts"
}
```

#### dependency-present
Checks if a package is in dependencies:
```json
{
  "type": "dependency-present",
  "target": "bcrypt"
}
```

#### config-value
Validates project configuration:
```json
{
  "type": "config-value",
  "target": "hasEncryption",
  "expected": true
}
```

#### pattern-match
Searches for regex patterns in files:
```json
{
  "type": "pattern-match",
  "target": "src/server.ts",
  "pattern": "https\\.createServer"
}
```

### Severity Levels

- **critical**: Security vulnerabilities, data protection failures
- **high**: Access control issues, encryption missing
- **medium**: Monitoring gaps, configuration issues
- **low**: Documentation, best practices

## Evidence Collection

Evidence is automatically collected during scans and stored in `.guardrail/evidence/<runId>/`:

### Collected Artifacts

1. **config-snapshot.json**: Sanitized project configuration
   - Sensitive values redacted
   - Boolean flags for security features

2. **file-checks.json**: File presence verification
   - Lists all referenced files
   - Records existence status

3. **dependencies.json**: Dependency snapshot
   - Package versions
   - Private packages filtered

4. **manifest.json**: Evidence manifest
   - Artifact metadata
   - Collection timestamp

### Evidence Structure

```
.guardrail/
└── evidence/
    └── <runId>/
        ├── manifest.json
        ├── config-snapshot.json
        ├── file-checks.json
        └── dependencies.json
```

### Sanitization

All evidence is sanitized before storage:
- Passwords, secrets, tokens redacted
- API keys masked
- Private packages filtered
- Only structural information retained

## Drift Detection

Drift detection tracks compliance changes over time.

### History Storage

Scan results are stored in `.guardrail/history/compliance.jsonl`:

```jsonl
{"runId":"abc123","timestamp":"2024-01-01T00:00:00Z","framework":"soc2","score":85,"passed":8,"failed":2,"totalRules":10}
{"runId":"def456","timestamp":"2024-01-02T00:00:00Z","framework":"soc2","score":90,"passed":9,"failed":1,"totalRules":10}
```

### Drift Analysis

Each scan compares against the previous run:

```typescript
{
  drift: {
    previousRunId: "abc123",
    scoreDelta: +5,           // Score improved by 5 points
    newFailures: [],          // No new failures
    newPasses: ["CC6.7"],     // Encryption now passing
    regressions: []           // No regressions
  }
}
```

### Regression Detection

Regressions are prioritized by severity:

```typescript
{
  regressions: [
    {
      controlId: "CC6.1",
      severity: "critical",
      message: "Authentication removed",
      previousStatus: "passed",
      currentStatus: "failed"
    }
  ]
}
```

## Output Formats

### Table Format

Human-readable console output:

```
════════════════════════════════════════════════════════════════════════════════
  COMPLIANCE SCAN REPORT - SOC2
════════════════════════════════════════════════════════════════════════════════

Run ID:       abc123-def456
Timestamp:    2024-01-01T00:00:00.000Z
Project Path: /path/to/project

────────────────────────────────────────────────────────────────────────────────
  SUMMARY
────────────────────────────────────────────────────────────────────────────────

Total Rules:  10
Passed:       8 (80%)
Failed:       2 (20%)
Score:        85/100 🟢

────────────────────────────────────────────────────────────────────────────────
  DRIFT ANALYSIS
────────────────────────────────────────────────────────────────────────────────

Previous Run: xyz789
Score Delta:  +5

✅ NEW PASSES (1): CC6.7
```

### JSON Format

Machine-readable output for CI/CD integration:

```typescript
import { JsonFormatter } from '@guardrail/compliance';

const formatter = new JsonFormatter();
const json = formatter.format(result, true); // pretty print
```

### SARIF Format

Static Analysis Results Interchange Format for tool integration:

```typescript
import { SarifFormatter } from '@guardrail/compliance';

const formatter = new SarifFormatter();
const sarif = formatter.format(result);
```

SARIF output is compatible with:
- GitHub Code Scanning
- Azure DevOps
- GitLab Security Dashboard
- SonarQube

## Custom Policies

### Creating Custom Policies

1. Create policy directory:
```bash
mkdir -p .guardrail/policies
```

2. Define custom policy (`.guardrail/policies/custom-soc2.json`):
```json
{
  "version": "1.0.0",
  "framework": "soc2",
  "rules": [
    {
      "id": "CUSTOM-001",
      "controlId": "CC6.1",
      "title": "Multi-Factor Authentication",
      "description": "MFA must be enabled for all users",
      "severity": "critical",
      "category": "access-control",
      "checks": [
        {
          "type": "dependency-present",
          "target": "speakeasy"
        },
        {
          "type": "file-exists",
          "target": "src/auth/mfa.ts"
        }
      ],
      "remediation": "Implement MFA using TOTP (speakeasy) or similar"
    }
  ]
}
```

3. Run scan (custom policies are automatically loaded):
```typescript
const result = await scanner.scan('/path/to/project', 'soc2');
```

### Policy Best Practices

1. **Specific Control IDs**: Map to actual framework controls
2. **Clear Remediation**: Provide actionable steps
3. **Appropriate Severity**: Match risk level
4. **Multiple Checks**: Use OR logic for flexibility
5. **Evidence References**: Ensure checks reference real files

## API Reference

### ComplianceScannerEngine

```typescript
class ComplianceScannerEngine {
  async scan(
    projectPath: string,
    framework: string,
    options?: {
      collectEvidence?: boolean;  // default: true
      detectDrift?: boolean;      // default: true
    }
  ): Promise<ComplianceScanResult>;

  getHistory(
    framework: string,
    limit?: number  // default: 10
  ): HistoryEntry[];
}
```

### ComplianceScanResult

```typescript
interface ComplianceScanResult {
  runId: string;
  timestamp: Date;
  projectPath: string;
  framework: string;
  summary: {
    totalRules: number;
    passed: number;
    failed: number;
    score: number;  // 0-100
  };
  results: RuleResult[];
  evidence: EvidenceCollection;
  drift?: DriftAnalysis;
}
```

### RuleResult

```typescript
interface RuleResult {
  passed: boolean;
  controlId: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  message: string;
  evidenceRefs: string[];
  remediation: string;
  metadata?: Record<string, any>;
}
```

## CI/CD Integration

### GitHub Actions

```yaml
name: Compliance Scan

on: [push, pull_request]

jobs:
  compliance:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - run: npm install
      - run: npm run compliance:scan
      - uses: github/codeql-action/upload-sarif@v2
        with:
          sarif_file: compliance-report.sarif
```

### GitLab CI

```yaml
compliance:
  script:
    - npm install
    - npm run compliance:scan
  artifacts:
    reports:
      sast: compliance-report.sarif
```

## Troubleshooting

### No Policies Loaded

**Problem**: Scanner returns 0 rules

**Solution**: Verify policy files exist:
```bash
ls packages/compliance/src/policies/
```

### Evidence Not Collected

**Problem**: Evidence directory empty

**Solution**: Ensure write permissions:
```bash
chmod -R 755 .guardrail/
```

### Drift Not Detected

**Problem**: No drift analysis in results

**Solution**: Run at least two scans:
```typescript
await scanner.scan(projectPath, 'soc2', { detectDrift: true });
await scanner.scan(projectPath, 'soc2', { detectDrift: true });
```

## Performance

- **Scan Time**: ~2-5 seconds for typical project
- **Memory Usage**: ~50MB per scan
- **Storage**: ~1MB per evidence collection
- **History**: JSONL format, ~100 bytes per entry

## Security Considerations

1. **Evidence Sanitization**: All secrets automatically redacted
2. **File Permissions**: Evidence stored with 644 permissions
3. **No Network Calls**: All checks are local
4. **No Code Execution**: Policies are declarative JSON
5. **Audit Trail**: All scans logged with timestamps

## Roadmap

- [ ] Custom check types via plugins
- [ ] Real-time monitoring integration
- [ ] Automated remediation suggestions
- [ ] Compliance dashboard UI
- [ ] Multi-project aggregation
- [ ] Compliance report generation (PDF)

## Support

For issues or questions:
- GitHub Issues: https://github.com/guardrail/compliance/issues
- Documentation: https://docs.guardrail.dev/compliance
- Email: support@guardrail.dev
