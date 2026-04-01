# Contributing to guardrail

Thank you for your interest in contributing to guardrail! We welcome contributions from the community.

## Code of Conduct

This project and everyone participating in it is governed by our [Code of Conduct](CODE_OF_CONDUCT.md). By participating, you are expected to uphold this code.

## How Can I Contribute?

### Reporting Bugs

Before creating bug reports, please check existing issues to avoid duplicates. When creating a bug report, include:

- **Clear title and description**
- **Steps to reproduce** the behavior
- **Expected vs actual behavior**
- **Screenshots** if applicable
- **Environment details** (OS, Node version, CLI version)
- **Additional context** or logs

### Suggesting Enhancements

Enhancement suggestions are tracked as GitHub issues. When creating an enhancement suggestion:

- **Use a clear and descriptive title**
- **Provide detailed description** of the suggested enhancement
- **Explain why** this enhancement would be useful
- **List similar features** in other tools if applicable

### Pull Requests

1. **Fork the repository** and create your branch from `main`
2. **Install dependencies**: `pnpm install`
3. **Make your changes** following our coding standards
4. **Add tests** for new features
5. **Run tests**: `pnpm test`
6. **Run linter**: `pnpm lint`
7. **Build the project**: `pnpm build`
8. **Commit your changes** using conventional commits
9. **Push to your fork** and submit a pull request

#### Conventional Commits

We use conventional commits for clear changelog generation:

```
feat: add new secret detection pattern
fix: resolve OSV API timeout issue
docs: update README with new examples
test: add tests for compliance scanner
chore: update dependencies
```

## Development Setup

### Prerequisites

- Node.js >= 20.11
- pnpm >= 8.0

### Installation

```bash
# Clone your fork
git clone https://github.com/YOUR_USERNAME/guardrail.git
cd guardrail

# Install dependencies
pnpm install

# Build all packages
pnpm build

# Run tests
pnpm test
```

### Testing matrix (where tests run)

| Suite | Command | Notes |
|--------|---------|--------|
| **Jest (default)** | `pnpm test` | Root `config/jest.config.js`. Some paths are intentionally ignored (Vitest-only files, Playwright specs, optional integration). See the comment block above `testPathIgnorePatterns` in that file. |
| **CLI Playwright** | `cd packages/cli && pnpm run build && pnpm run test:integration` | Spawns real Node processes; not part of Jest. |
| **Web UI** | `pnpm --filter @guardrail/web-ui test` (or Vitest where configured) | React/UI coverage per app package. |
| **Reality Jest (opt-in)** | `GUARDRAIL_REALITY_INTEGRATION=1 pnpm test -- …` | Only if you un-ignore `packages/cli/src/reality/__tests__/reality-integration.test.ts`. |

CI runs Jest with coverage and a dedicated **CLI Playwright** job; see `.github/workflows/ci-cd.yml`.

### Project Structure

```
guardrail/
├── packages/
│   ├── cli/          # Command-line interface
│   ├── core/         # Core scanning engine
│   ├── security/     # Security scanners (secrets, vulns, SBOM)
│   ├── compliance/   # Compliance scanning
│   └── ship/         # Ship readiness checks
├── apps/
│   ├── api/          # Backend API
│   └── web-ui/       # Web dashboard
└── docs/             # Documentation
```

### Deprecated repository-root `src/`

The top-level `src/` directory at the monorepo root is **legacy**. Do **not** add new `.ts` or `.tsx` files there. Put work in:

- **`apps/web-ui/src`** for the Next.js app (UI, client/server components, route handlers under `app/`)
- **`apps/api/src`** for HTTP API and server-only code
- **`packages/*`** for shared libraries consumed by apps or the CLI

Intended relocation targets for existing root `src/` files are listed in **`SOURCE_MAP.md`**. CI runs `pnpm lint:root-src` to block new TypeScript under root `src/`.

#### Jest `@/` path alias → root `src/`

**`tsconfig.test.json`** (used with root Jest / `ts-jest`) maps `@/*` to the **repository root `src/`** tree, not `apps/web-ui/src`. Tests under `tests/` or legacy root `src/` that import `@/lib/...` resolve there. For new work, prefer **`apps/web-ui/src`** or **`apps/api/src`** and that package’s own `paths`; use the root `@/` mapping only when touching legacy tests or root `src/` code.

### Test runners: Jest vs Vitest

| Runner | Where | How to run |
|--------|--------|------------|
| **Jest** | Root config `config/jest.config.js`; roots include monorepo `src/`, `packages/`, `apps/`, `tests/`. Default **`pnpm test`** from repo root. | `pnpm test`, `pnpm test:coverage`, `pnpm test:unit` |
| **Vitest** | **`apps/web-ui`** (Next.js app tests). Several **`packages/*`** (e.g. `ai-guardrails`, `compliance`, `security`, `engines`). | `pnpm --filter @guardrail/web-ui test` (or `cd apps/web-ui && pnpm test`); per-package `pnpm --filter <pkg> test` |

Root `pnpm test` does **not** execute every Vitest suite. Vitest-only files are excluded from Jest where needed—see `testPathIgnorePatterns` in `config/jest.config.js`. Long-term consolidation toward Vitest in more packages is a process change, not a single PR.

### Build output (`packages/*/dist`)

**`packages/*/dist/`** is **gitignored** (see root `.gitignore`). Build packages locally or in CI; do not commit compiled output—published packages ship via npm from build artifacts, not checked-in `dist/`.

### Stripe SDK version (workspace)

**`stripe`** is aligned at **^17** across root **`devDependencies`** (CLI/tests/tooling) and **`apps/api`** / **`apps/web-ui`** dependencies. When upgrading the Stripe major, bump all of these together and re-run billing and webhook tests.

### Running Locally

```bash
# CLI development
cd packages/cli
pnpm build
pnpm link --global

# Test the CLI
guardrail --version
guardrail scan --path ./test-project
```

### Running Tests

**Runners**

- **Jest** (`pnpm test`, `pnpm test:coverage`): root `src/`, `apps/api`, `packages/*`, and `tests/` — Node-oriented unit and integration tests. Coverage thresholds are **per directory** in `config/jest.config.js` (no repo-wide 80% gate).
- **Vitest** (`pnpm --filter @guardrail/web-ui test` / `test:coverage`): `apps/web-ui` only. Install `@vitest/coverage-v8` in that app if you use `test:coverage`.

```bash
# Run all tests
pnpm test

# Run specific package tests
pnpm --filter @guardrail/cli test

# Jest coverage (monorepo config)
pnpm test:coverage

# Web UI (Vitest)
pnpm --filter @guardrail/web-ui test:coverage
```

## Coding Standards

### TypeScript

- Use TypeScript for all new code
- Enable strict mode
- Avoid `any` types
- Document public APIs with JSDoc

### Code Style

- 2 spaces for indentation
- Single quotes for strings
- Semicolons required
- Run `pnpm lint` before committing

### Testing

- Write unit tests for new features
- Respect coverage floors for the runner you touch: Jest thresholds live in `config/jest.config.js` (and `apps/api/jest.config.js` if you use that project config); Vitest thresholds are in `apps/web-ui/vitest.config.ts`
- Use descriptive test names
- Mock external APIs

## Package Guidelines

### CLI Package

- Keep CLI commands focused and single-purpose
- Provide `--help` for all commands
- Include examples in help text
- Follow existing command patterns

### Security Package

- Add tests for new detection patterns
- Minimize false positives
- Document detection logic
- Include severity ratings

## Documentation

- Update README.md for user-facing changes
- Add JSDoc for public APIs
- Update CHANGELOG.md for releases
- Include code examples

## Release Process

Releases are managed by maintainers:

1. Update version in `package.json`
2. Update CHANGELOG.md
3. Create GitHub release
4. Publish to npm

## Getting Help

- **Discord**: [Join our community](https://discord.gg/guardrail)
- **GitHub Discussions**: Ask questions
- **Documentation**: https://guardrailai.dev/docs

## License

By contributing, you agree that your contributions will be licensed under the MIT License.

## Recognition

Contributors will be:
- Listed in CHANGELOG.md
- Recognized in release notes
- Added to our contributors page

Thank you for contributing to guardrail! 🛡️
