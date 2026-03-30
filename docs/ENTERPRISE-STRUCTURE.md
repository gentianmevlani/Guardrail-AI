# Enterprise Structure Guide

This document outlines the enterprise-grade directory structure and organization of the guardrail project.

## Directory Structure

```
guardrail/
├── 📁 apps/                     # Applications
│   ├── api/                    # Backend API server
│   └── web-ui/                 # Frontend web application
│
├── 📁 packages/                 # Shared packages
│   ├── core/                   # Core utilities and types
│   ├── database/               # Database layer (Prisma)
│   ├── ai-guardrails/          # AI guardrails implementation
│   ├── security/               # Security utilities
│   └── compliance/             # Compliance checks
│
├── 📁 config/                   # Configuration files
│   ├── eslint.config.js        # ESLint configuration
│   ├── jest.config.js          # Jest test configuration
│   ├── playwright.config.ts    # E2E test configuration
│   ├── turbo.json              # Turbo build configuration
│   ├── .env.example            # Environment template
│   └── docker-compose.test.yml # Test database
│
├── 📁 bin/                      # CLI tools
│   ├── cli.js                  # Basic installation CLI
│   ├── cli-wizard.js           # Interactive setup wizard
│   └── cli-natural.js          # Natural language interface
│
├── 📁 scripts/                  # Build and utility scripts
│   ├── build-*.js              # Build scripts
│   ├── deploy-*.js             # Deployment scripts
│   └── sync-figma-tokens.ts    # Design sync
│
├── 📁 docs/                     # Documentation
│   ├── guides/                 # User guides
│   │   ├── GETTING-STARTED.md
│   │   └── CONTRIBUTING.md
│   ├── templates/              # Project templates
│   │   ├── 01-UI-UX-SYSTEM-TEMPLATE.md
│   │   └── 02-DESIGN-SYSTEM-TEMPLATE.md
│   ├── marketing/              # Marketing materials
│   └── archive/                # Archived documentation
│
├── 📁 tests/                    # Test files
│   ├── unit/                   # Unit tests
│   ├── integration/            # Integration tests
│   └── e2e/                    # End-to-end tests
│
├── 📁 examples/                 # Usage examples
│   └── premium-usage.ts
│
├── 📁 docker/                   # Docker configurations
│   ├── Dockerfile
│   └── docker-compose.yml
│
├── 📁 .github/                  # GitHub configurations
│   └── workflows/              # CI/CD workflows
│
├── 📁 prisma/                   # Database schema
│   └── schema.prisma
│
├── 📁 templates/                # Code templates
│   ├── backend/
│   ├── components/
│   └── design-systems/
│
├── 📄 README.md                 # Main project README
├── 📄 CHANGELOG.md              # Version history
├── 📄 CLI-TOOLS.md              # CLI documentation
├── 📄 DOCUMENTATION-INDEX.md    # Documentation index
├── 📄 NAMING-CONVENTIONS.md    # Naming standards
├── 📄 TODO-TICKETS.md           # TODO tracking
├── 📄 package.json              # Root package configuration
├── 📄 pnpm-workspace.yaml      # PNPM workspace config
├── 📄 tsconfig.json             # TypeScript configuration
├── 📄 .gitignore                # Git ignore rules
└── 📄 .npmignore                # NPM ignore rules
```

## Principles

### 1. Separation of Concerns
- **Apps**: Complete, deployable applications
- **Packages**: Reusable code shared across apps
- **Config**: All configuration in one place
- **Scripts**: Build and utility logic separated from source

### 2. Scalability
- Monorepo structure with PNPM workspaces
- Independent package versioning
- Shared tooling configuration

### 3. Developer Experience
- Clear directory naming
- Consistent structure across packages
- Easy navigation and discovery

### 4. Enterprise Standards
- Comprehensive .gitignore
- Proper configuration management
- Security best practices

## File Organization Rules

### Configuration Files
- All config files go in `config/`
- Use descriptive names (e.g., `jest.config.js`)
- Keep examples with `.example` suffix

### CLI Tools
- Place in `bin/` directory
- Use kebab-case with `cli-` prefix
- Include shebang for direct execution

### Documentation
- User guides in `docs/guides/`
- Templates in `docs/templates/`
- Archive old docs in `docs/archive/`

### Scripts
- Build scripts in `scripts/`
- Use descriptive prefixes (`build-`, `deploy-`, `test-`)
- Include TypeScript versions where applicable

## Import Paths

Use the following path aliases:
- `@/*` - Root src directory
- `@/config/*` - Configuration files
- `@/bin/*` - CLI tools
- `@/scripts/*` - Scripts
- `@guardrail/*` - Internal packages

## Best Practices

1. **Keep root clean**: Only essential files in root
2. **Group related files**: Use directories to group related items
3. **Consistent naming**: Follow naming conventions
4. **Document structure**: Keep this guide updated
5. **Version control**: Use .gitignore effectively

## Migration Notes

- Moved from flat structure to organized hierarchy
- Configuration centralized in `config/`
- CLI tools moved to `bin/`
- Documentation organized in `docs/`
- Templates moved to `docs/templates/`

This structure supports:
- Better maintainability
- Easier onboarding
- Scalable development
- Enterprise compliance
