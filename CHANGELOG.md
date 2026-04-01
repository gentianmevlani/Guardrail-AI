# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.4.10] - 2026-01-10

### Added
- Dynamic CLI versioning from package.json
- OSV vulnerability database integration with retry logic
- SBOM generation with CycloneDX and SPDX formats
- Compliance scanning for SOC2, GDPR, HIPAA, PCI-DSS, ISO27001, NIST
- Reality Mode for browser testing and fake data detection
- Fix command with AI-powered analysis and guided suggestions
- Autopilot batch remediation for Pro/Enterprise tiers
- Pre-commit hooks integration via Husky or Lefthook
- Baseline management for suppressing known findings
- Incremental scanning with git diff support
- SARIF output format for CI/CD integration

### Changed
- Renamed fix rollback command to fix-rollback to resolve Commander.js conflict
- Updated all documentation to use unscoped package name (guardrail-cli-tool)
- Improved secret detection with contextual risk analysis
- Enhanced vulnerability scanning with NVD enrichment

### Fixed
- CLI version now correctly reports package version instead of hardcoded 1.0.0
- Runtime import rewriting for @guardrail/* to guardrail-* packages
- Package subpath exports for guardrail-security

## [2.0.0] - 2026-01-01

### Added
- Initial public release
- Secret detection with 50+ patterns
- Dependency vulnerability scanning
- Ship readiness checks
- MCP server integration

---

For older versions, see [GitHub Releases](https://github.com/guardiavault-oss/guardrail-Ofiicial/releases).
