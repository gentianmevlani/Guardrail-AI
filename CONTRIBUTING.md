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

```bash
# Run all tests
pnpm test

# Run specific package tests
pnpm --filter @guardrail/cli test

# Run with coverage
pnpm test:coverage
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
- Maintain >80% code coverage
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
- **Documentation**: https://guardrail.dev/docs

## License

By contributing, you agree that your contributions will be licensed under the MIT License.

## Recognition

Contributors will be:
- Listed in CHANGELOG.md
- Recognized in release notes
- Added to our contributors page

Thank you for contributing to guardrail! 🛡️
