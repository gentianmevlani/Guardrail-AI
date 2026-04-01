# 🏗️ guardrail Project Structure

This document outlines the complete, world-class organization of the guardrail codebase.

## 📁 Root Directory

The root directory contains only essential files and directories:

### Essential Files
- `README.md` - Project overview and getting started
- `LICENSE` - MIT license
- `package.json` - Root package configuration
- `pnpm-workspace.yaml` - PNPM workspace configuration
- `turbo.json` - Turborepo build configuration
- `.gitignore` - Git ignore rules
- `.nvmrc` - Node version specification

### Configuration Files
- `.env` - Local environment (never committed)
- `env.example` - Environment template
- `tsconfig.json` - TypeScript configuration
- `tsconfig.base.json` - Base TypeScript config
- `tsconfig.test.json` - Test TypeScript config
- `.editorconfig` - Editor configuration
- `.npmrc` - NPM configuration
- `.cursorrules` - Cursor AI rules
- `.guardrailrc` - guardrail CLI configuration

### Core Directories

## 📁 `apps/` - Applications

### `api/` - Backend API Service
- **Purpose**: Main API server and web services
- **Tech**: Express.js, TypeScript, Prisma
- **Key Files**:
  - `src/routes/` - API endpoints
  - `src/services/` - Business logic
  - `src/middleware/` - Request handling
  - `Dockerfile` - Container configuration

### `web-ui/` - Dashboard & Reports
- **Purpose**: Web interface for guardrail
- **Tech**: Next.js, React, TypeScript
- **Key Files**:
  - `src/app/` - Next.js app router
  - `src/components/` - React components
  - `src/lib/` - Shared utilities

## 📁 `packages/` - Shared Packages

### `core/` - Core Scanning Engine
- **Purpose**: Main analysis and scanning logic
- **Key Files**:
  - `src/scanner/` - Code analysis engines
  - `src/rules/` - Validation rules
  - `src/reporters/` - Report generation

### `cli/` - CLI Implementation
- **Purpose**: Command-line interface
- **Key Files**:
  - `src/commands/` - CLI commands
  - `src/utils/` - CLI utilities

### `compliance/` - Compliance Frameworks
- **Purpose**: Security and compliance checks
- **Key Files**:
  - `src/frameworks/` - SOC2, HIPAA, GDPR, etc.
  - `src/rules/` - Compliance rules

### `ai-guardrails/` - AI-Specific Checks
- **Purpose**: AI-generated code validation
- **Key Files**:
  - `src/detectors/` - AI pattern detection
  - `src/validators/` - AI output validation

## 📁 `bin/` - CLI Entry Points
- `guardrail.js` - Main CLI entry point
- `runners/` - Command implementations
- `_router.js` - Command routing logic

## 📁 `config/` - Configuration Files
- `jest.config.js` - Jest testing configuration
- `playwright.config.ts` - Playwright e2e testing
- `vitest.config.ts` - Vitest unit testing
- `sentry.client.config.ts` - Error tracking (client)
- `sentry.server.config.ts` - Error tracking (server)
- `eslint.config.js` - ESLint configuration
- `.prettierrc` - Code formatting rules

## 📁 `deploy/` - Deployment Configurations
- `railway.json` - Railway deployment
- `railway.toml` - Railway configuration
- `netlify.toml` - Netlify deployment
- `Procfile` - Heroku deployment

## 📁 `docker/` - Docker Configurations
- `docker-compose.yml` - Development environment
- `docker-compose.dev.yml` - Development overrides
- `alertmanager/` - Monitoring alerts
- `grafana/` - Metrics dashboard
- `prometheus/` - Metrics collection

## 📁 `docs/` - Documentation

### `reports/` - Audit & Security Reports
- `API-KEY-SECURITY-PROOF.md` - API security analysis
- `API-PRODUCTION-GATE-REPORT.md` - Production readiness
- `CURRENT_AUDIT_REPORT.md` - Latest audit results
- `SECURITY-GATE-REPORT.md` - Security gate status
- `UX-AUDIT-AND-MARKETING-PLAN.md` - UX analysis

### `architecture/` - Architecture Documentation
- `ADR-001-result-types.md` - Architecture Decision Records
- `ADR-002-modular-polish-service.md` - Service architecture
- `IMPLEMENTATION-TICKETS.md` - Implementation tracking
- `TODO-TICKETS.md` - Development tasks

### `ops/` - Operations Guides
- `backup-restore-runbook.md` - Backup procedures
- `DEPLOYMENT-CHECKLIST.md` - Deployment guide
- `HOTFIX-PROCEDURE.md` - Emergency procedures
- `INCIDENT-RESPONSE.md` - Incident handling

## 📁 `scripts/` - Build & Utility Scripts
- `build/` - Build automation
- `hygiene/` - Code quality checks
- `deploy/` - Deployment automation
- `test/` - Test utilities

## 📁 `src/` - Shared Source Code
- `lib/` - Shared libraries
- `components/` - Shared components
- `types/` - TypeScript type definitions
- `utils/` - Utility functions

## 📁 `templates/` - Project Templates
- `backend/` - Backend project templates
- `components/` - Component templates
- `design-systems/` - Design system templates

## 📁 `tests/` - Test Suites
- `e2e/` - End-to-end tests
- `integration/` - Integration tests
- `unit/` - Unit tests
- `factories/` - Test data factories

## 📁 `examples/` - Example Projects
- `express-api/` - Express API example
- `nextjs-app/` - Next.js application example
- `bad-saas-app/` - Anti-pattern examples

## 📁 `prisma/` - Database
- `schema.prisma` - Database schema
- `migrations/` - Database migrations
- `seed.ts` - Database seeding

## 📁 `.github/` - GitHub Configuration
- `workflows/` - GitHub Actions
- `ISSUE_TEMPLATE/` - Issue templates
- `CODEOWNERS` - Code ownership rules

## 📁 `mcp-server/` - MCP Server
- `index.js` - MCP server implementation
- `hygiene-tools.js` - MCP hygiene tools

## 📁 `vscode-extension/` - VS Code Extension
- `src/` - Extension source code
- `package.json` - Extension manifest

## 🎯 World-Class Standards

This structure follows world-class practices:

1. **Clear Separation**: Apps, packages, and configuration are clearly separated
2. **Logical Grouping**: Related files are grouped together
3. **Consistent Naming**: Standardized naming conventions
4. **Minimal Root**: Only essential files in root directory
5. **Comprehensive Docs**: Well-documented architecture and decisions
6. **Scalable Organization**: Structure scales with project growth

## 🚀 Getting Started

1. Clone the repository
2. Copy `env.example` to `.env` and configure
3. Install dependencies: `pnpm install`
4. Run development: `pnpm dev`

For detailed setup instructions, see the main [README.md](../README.md).
