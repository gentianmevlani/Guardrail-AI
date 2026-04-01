# Contributing to guardrail

First off, thank you for considering contributing to guardrail! It's people like you that make guardrail such a great tool for the developer community.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Setup](#development-setup)
- [How to Contribute](#how-to-contribute)
- [Pull Request Process](#pull-request-process)
- [Style Guidelines](#style-guidelines)
- [Community](#community)

---

## Code of Conduct

This project and everyone participating in it is governed by the [guardrail Code of Conduct](CODE_OF_CONDUCT.md). By participating, you are expected to uphold this code. Please report unacceptable behavior to [conduct@guardrailai.dev](mailto:conduct@guardrailai.dev).

---

## Getting Started

### Prerequisites

- **Node.js** >= 20.11
- **pnpm** >= 8.0 (recommended) or npm >= 10
- **Git**
- **Docker** (optional, for database tests)

### Fork & Clone

1. Fork the repository on GitHub
2. Clone your fork locally:

```bash
git clone https://github.com/YOUR_USERNAME/codeguard.git
cd codeguard
```

3. Add the upstream remote:

```bash
git remote add upstream https://github.com/guardiavault-oss/codeguard.git
```

---

## Development Setup

### 1. Install Dependencies

```bash
pnpm install
```

### 2. Set Up Environment

```bash
cp .env.example .env
# Edit .env with your local settings
```

### 3. Build All Packages

```bash
pnpm build
```

### 4. Run Tests

```bash
# Unit tests
pnpm test

# Integration tests
pnpm test:integration

# E2E tests
pnpm test:e2e
```

### 5. Start Development

```bash
# Start all services in dev mode
pnpm dev

# Or start specific services
pnpm api:dev    # API server
pnpm web:dev    # Web UI
```

### Project Structure

```
guardrail/
├── apps/
│   ├── api/              # Express API server
│   └── web-ui/           # Next.js dashboard
├── packages/
│   ├── core/             # Core scanning engine
│   ├── cli/              # CLI implementation
│   ├── compliance/       # Compliance frameworks
│   └── ai-guardrails/    # AI-specific checks
├── bin/
│   ├── guardrail.js      # CLI entry point
│   └── runners/          # Command implementations
├── src/lib/              # Shared libraries
├── scripts/              # Build & utility scripts
├── tests/                # Test suites
└── docs/                 # Documentation
```

---

## How to Contribute

### Reporting Bugs

Before creating bug reports, please check the [existing issues](https://github.com/guardiavault-oss/codeguard/issues) to avoid duplicates.

When creating a bug report, include:

- **Clear title** describing the issue
- **Steps to reproduce** the behavior
- **Expected behavior** vs **actual behavior**
- **Environment details** (OS, Node version, etc.)
- **Error messages** and stack traces
- **Screenshots** if applicable

Use the [Bug Report template](.github/ISSUE_TEMPLATE/bug_report.md).

### Suggesting Features

We love feature suggestions! Before suggesting:

1. Check if it's already been [suggested or planned](https://github.com/guardiavault-oss/codeguard/issues?q=label%3Aenhancement)
2. Ensure it aligns with guardrail's mission

Use the [Feature Request template](.github/ISSUE_TEMPLATE/feature_request.md).

### Your First Code Contribution

Looking for something to work on? Check:

- [`good first issue`](https://github.com/guardiavault-oss/codeguard/labels/good%20first%20issue) - Great for newcomers
- [`help wanted`](https://github.com/guardiavault-oss/codeguard/labels/help%20wanted) - Extra attention needed
- [`documentation`](https://github.com/guardiavault-oss/codeguard/labels/documentation) - Docs improvements

### Types of Contributions

| Type             | Description                                 |
| ---------------- | ------------------------------------------- |
| 🐛 Bug fixes     | Fix something that's broken                 |
| ✨ Features      | Add new functionality                       |
| 📝 Documentation | Improve docs, examples, comments            |
| 🧪 Tests         | Add or improve tests                        |
| ♻️ Refactoring   | Code improvements without changing behavior |
| 🎨 UI/UX         | Dashboard and report improvements           |
| 🔧 Tooling       | Build, CI, dev experience improvements      |

---

## Pull Request Process

### 1. Create a Branch

```bash
# Update your fork
git fetch upstream
git checkout main
git merge upstream/main

# Create a feature branch
git checkout -b feature/your-feature-name
# or
git checkout -b fix/your-bug-fix
```

### 2. Make Your Changes

- Write clear, concise commit messages
- Follow the [style guidelines](#style-guidelines)
- Add tests for new functionality
- Update documentation as needed

### 3. Test Your Changes

```bash
# Run the full test suite
pnpm test

# Run linting
pnpm lint

# Type check
pnpm type-check

# Test your specific changes
pnpm test -- --grep "your test name"
```

### 4. Submit Your PR

1. Push your branch to your fork
2. Open a PR against `main`
3. Fill out the PR template completely
4. Link any related issues

### 5. Code Review

- Respond to feedback promptly
- Make requested changes
- Keep the PR focused (one feature/fix per PR)

### PR Checklist

- [ ] Tests pass locally (`pnpm test`)
- [ ] Linting passes (`pnpm lint`)
- [ ] Types check (`pnpm type-check`)
- [ ] Documentation updated (if applicable)
- [ ] CHANGELOG.md updated (for user-facing changes)
- [ ] Commits are clean and descriptive

---

## Style Guidelines

### Code Style

We use **Prettier** and **ESLint** to maintain consistent code style.

```bash
# Format code
pnpm lint:fix

# Check formatting
pnpm lint
```

### TypeScript Guidelines

- Use strict TypeScript (`strict: true`)
- Prefer `interface` over `type` for object shapes
- Use explicit return types for public functions
- Avoid `any` - use `unknown` when type is truly unknown

```typescript
// ✅ Good
interface ScanResult {
  score: number;
  issues: Issue[];
}

function scan(path: string): Promise<ScanResult> {
  // ...
}

// ❌ Avoid
function scan(path: any): any {
  // ...
}
```

### Commit Messages

Follow [Conventional Commits](https://www.conventionalcommits.org/):

```
type(scope): description

[optional body]

[optional footer]
```

**Types:**

| Type       | Description                                         |
| ---------- | --------------------------------------------------- |
| `feat`     | New feature                                         |
| `fix`      | Bug fix                                             |
| `docs`     | Documentation only                                  |
| `style`    | Formatting, no code change                          |
| `refactor` | Code change that neither fixes bug nor adds feature |
| `perf`     | Performance improvement                             |
| `test`     | Adding or fixing tests                              |
| `chore`    | Build process or tooling changes                    |

**Examples:**

```
feat(cli): add --verbose flag to scan command
fix(core): handle empty files in security scanner
docs: update installation instructions for pnpm
test(api): add integration tests for auth routes
```

### File Naming

- **TypeScript/JavaScript:** `kebab-case.ts`
- **React Components:** `PascalCase.tsx`
- **Tests:** `*.test.ts` or `*.spec.ts`
- **Documentation:** `UPPER-CASE.md` for root, `kebab-case.md` for docs/

### Documentation

- Use clear, concise language
- Include code examples
- Keep API docs up to date
- Add JSDoc comments for public APIs

````typescript
/**
 * Scans a codebase for security vulnerabilities and code quality issues.
 *
 * @param projectPath - Absolute path to the project root
 * @param options - Scan configuration options
 * @returns Scan results including score and detected issues
 *
 * @example
 * ```typescript
 * const results = await scan('/path/to/project', { profile: 'full' });
 * console.log(`Score: ${results.score}`);
 * ```
 */
export async function scan(
  projectPath: string,
  options?: ScanOptions,
): Promise<ScanResult> {
  // ...
}
````

---

## Community

### Getting Help

- 💬 **Discord:** [discord.gg/guardrail](https://discord.gg/guardrail)
- 📧 **Email:** [support@guardrailai.dev](mailto:support@guardrailai.dev)
- 🐛 **Issues:** [GitHub Issues](https://github.com/guardiavault-oss/codeguard/issues)

### Recognition

Contributors are recognized in:

- [README.md](README.md) contributors section
- [CHANGELOG.md](CHANGELOG.md) for specific changes
- Our [Contributors page](https://guardrailai.dev/contributors)

### Contributor License Agreement

By contributing to guardrail, you agree that your contributions will be licensed under the MIT License.

---

## Thank You! 🙏

Your contributions make guardrail better for everyone. We're grateful for your time and effort!

Questions? Reach out on [Discord](https://discord.gg/guardrail) or open a [Discussion](https://github.com/guardiavault-oss/codeguard/discussions).
