# Writing Custom Compliance Policies

Guide for creating custom compliance policies for the guardrail Compliance Scanner.

## Policy Structure

Create JSON files in `.guardrail/policies/`:

```json
{
  "version": "1.0.0",
  "framework": "soc2",
  "rules": [{
    "id": "CUSTOM-001",
    "controlId": "CC6.1",
    "title": "Rule Title",
    "description": "What this rule checks",
    "severity": "critical",
    "category": "access-control",
    "checks": [],
    "remediation": "How to fix"
  }]
}
```

## Check Types

### file-exists
```json
{"type": "file-exists", "target": "src/auth"}
```

### dependency-present
```json
{"type": "dependency-present", "target": "bcrypt"}
```

### config-value
```json
{"type": "config-value", "target": "hasEncryption", "expected": true}
```

### pattern-match
```json
{"type": "pattern-match", "target": "src/server.ts", "pattern": "https\\.createServer"}
```

## Examples

See COMPLIANCE-SCANNER.md for complete examples and best practices.
