# guardrail Roadmap

> **Last Updated:** January 2026

This document outlines the public roadmap for guardrail. We update this quarterly based on community feedback and product priorities.

## Vision

**Make AI-generated code production-ready by default.**

Every developer using AI coding assistants should ship with confidence, knowing their code is real, secure, and compliant.

---

## Current Release: v2.0

### What's Available Now

| Feature                   | Status    | Description                            |
| ------------------------- | --------- | -------------------------------------- |
| `guardrail scan`          | ✅ Stable | Static analysis for code integrity     |
| `guardrail gate`          | ✅ Stable | CI/CD merge blocking                   |
| `guardrail fix`           | ✅ Stable | Automated safe fixes                   |
| `guardrail proof mocks`   | ✅ Stable | Mock/demo data detection               |
| `guardrail proof reality` | ✅ Stable | Playwright runtime verification        |
| `guardrail mcp`           | ✅ Stable | MCP server for AI IDEs                 |
| Compliance Suite          | ✅ Stable | SOC2, HIPAA, GDPR, PCI, NIST, ISO27001 |

---

## Q1 2026: IDE Native Experience

### VS Code Extension

- [ ] Inline diagnostics and warnings
- [ ] Quick fixes from editor
- [ ] Status bar integration
- [ ] Command palette commands

### Cursor/Windsurf Deep Integration

- [ ] Native MCP improvements
- [ ] Context-aware suggestions
- [ ] Real-time scanning as you code

### Dashboard MVP

- [ ] Web-based results viewer
- [ ] Team overview dashboard
- [ ] Historical trend charts

---

## Q2 2026: Team & Enterprise

### Team Features

- [ ] Organization management
- [ ] Team-wide policies
- [ ] Shared allowlists/blocklists
- [ ] Role-based access control

### Enterprise

- [ ] SSO (SAML, OIDC)
- [ ] Audit logging
- [ ] On-premise deployment
- [ ] Custom compliance frameworks

### Notifications

- [ ] Slack integration
- [ ] Microsoft Teams integration
- [ ] Email digests
- [ ] Webhook callbacks

---

## Q3 2026: AI-Powered Fixes

### Smart Fix Engine

- [ ] AI-suggested fixes for complex issues
- [ ] Multi-file refactoring
- [ ] Dependency upgrade assistance
- [ ] Breaking change migration

### Learning Mode

- [ ] Learn from your codebase patterns
- [ ] Custom rule generation
- [ ] False positive learning

---

## Q4 2026: Platform Expansion

### Language Support

- [ ] Python deep support
- [ ] Go support
- [ ] Rust support
- [ ] Java/Kotlin support

### Framework Detection

- [ ] Django/Flask patterns
- [ ] Spring Boot patterns
- [ ] Rails patterns

### API Marketplace

- [ ] Third-party check plugins
- [ ] Community rules
- [ ] Compliance templates

---

## How We Prioritize

We prioritize based on:

1. **Community feedback** - GitHub issues, Discord discussions
2. **Customer requests** - Paid tier feature requests
3. **Security impact** - Features that improve security posture
4. **Developer experience** - Reducing friction in daily workflows

## Request a Feature

Have an idea? We'd love to hear it!

- **GitHub:** [Feature Request](https://github.com/guardiavault-oss/codeguard/issues/new?template=feature_request.md)
- **Discord:** [#feature-ideas](https://discord.gg/guardrail)
- **Email:** feedback@guardrail.dev

## Stay Updated

- **Changelog:** [CHANGELOG.md](CHANGELOG.md)
- **Blog:** [guardrail.dev/blog](https://guardrail.dev/blog)
- **Twitter:** [@getguardrail](https://twitter.com/getguardrail)
- **Newsletter:** [Subscribe](https://guardrail.dev/newsletter)
