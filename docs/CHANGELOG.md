# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Planned

- VS Code extension with inline diagnostics
- Cursor/Windsurf native integration
- Web dashboard for team monitoring
- Custom rule configuration UI
- Slack/Teams notifications

---

## [2.0.0] - 2026-01-05

### Added

- **CLI Rewrite** - New router-based architecture with cleaner command structure
- **Reality Mode** - Playwright-based runtime verification (`guardrail proof reality`)
- **MockProof** - Static analysis for mock/demo data leakage (`guardrail proof mocks`)
- **Team Intelligence** - AI-powered codebase analysis and recommendations
- **Compliance Suite** - SOC2, HIPAA, GDPR, PCI-DSS, NIST, ISO27001 frameworks
- **MCP Server** - IDE integration for AI agents (`guardrail mcp`)
- **Entitlements System** - Tier-based feature gating and usage tracking
- **Autopilot** - Continuous monitoring with weekly digests

### Changed

- Rebranded from CodeGuard to guardrail
- CLI commands simplified: `scan`, `gate`, `fix`, `proof`, `init`, `doctor`, `mcp`
- Legacy commands (`ship`, `mockproof`, `hygiene`) now map to new commands with deprecation warnings
- Improved SARIF output for GitHub Code Scanning integration

### Fixed

- Route detection accuracy improved by 40%
- False positives reduced in secret scanning
- Memory usage optimized for large monorepos

---

## [1.1.0] - 2026-01-01

### Added

- **Context Generation** - Auto-generate AI context files (`guardrail context`)
- **Dependency Graph** - Visualize component relationships (Mermaid, D3.js)
- **Git Context** - Extract patterns from git history
- **API Contracts** - OpenAPI/GraphQL schema extraction
- **Team Conventions** - Learn coding styles from git blame

### Changed

- Context pruning with relevance scoring
- Token-aware context generation (--max-tokens flag)

---

## [1.0.0] - 2025-12-30

### Added

- Initial release of guardrail (formerly AI Agent Guardrails Kit)
- **Core Scanning Engine** - Static analysis for code integrity
- **Security Checks** - Secret detection, SBOM, dependency vulnerabilities
- **Hygiene Checks** - Duplicates, unused files, lint failures
- **Contract Checks** - UI/API endpoint drift detection
- **CI Gating** - Policy-driven merge blocking
- **Fix System** - Safe automated patches
- ESLint configuration with strict rules
- TypeScript strict configuration
- Pre-commit hooks with Husky
- Comprehensive documentation

### Features

- Prevents AI agent drift through structure validation
- Catches ESLint and syntax errors early
- Prevents mock data in production
- Validates API endpoints before use
- Auto-fixes code issues on commit
- Type safety enforcement

---

## How to Upgrade

### From 1.x to 2.x

```bash
# Update the package
npm install -D guardrail@latest

# Run the doctor to check compatibility
npx guardrail doctor

# Update your CI workflows to use new commands
# Old: npx guardrail ship
# New: npx guardrail gate
```

See the [Migration Guide](https://guardrailai.dev/docs/migration) for detailed instructions.
