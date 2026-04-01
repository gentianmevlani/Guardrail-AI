# @guardrail/compliance

Enterprise-grade compliance scanning with real policy evaluation, evidence collection, and drift detection.

## Features

- ✅ Real policy evaluation (no mock output)
- 📋 SOC2, GDPR, HIPAA, PCI-DSS, ISO 27001, NIST CSF
- 📁 Evidence collection with sanitized snapshots
- 📊 Drift detection with historical tracking
- 📄 Multiple output formats (Table, JSON, SARIF)
- 🔧 Custom policies support

## Quick Start

```typescript
import { ComplianceScannerEngine, TableFormatter } from '@guardrail/compliance';

const scanner = new ComplianceScannerEngine();
const result = await scanner.scan('/path/to/project', 'soc2');

const formatter = new TableFormatter();
console.log(formatter.format(result));
```

## Documentation

- [Compliance Scanner Guide](../../docs/COMPLIANCE-SCANNER.md)
- [Custom Policies](../../docs/CUSTOM-POLICIES.md)

## Supported Frameworks

- **SOC 2**: Trust Services Criteria
- **GDPR**: EU Data Protection
- **HIPAA**: Healthcare Security
- **PCI-DSS**: Payment Card Security
- **ISO 27001**: Information Security
- **NIST CSF**: Cybersecurity Framework

## License

MIT
