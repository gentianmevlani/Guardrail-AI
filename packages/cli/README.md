# guardrail CLI v2.5.0 🎉

The official command-line interface for guardrail - AI-native code security and guardrail platform.

<<<<<<< HEAD
## CLI entry (canonical)

| What | Path |
|------|------|
| **Runnable CLI** | `bin/guardrail.js` — loads `dist/cli.js` and runs `runCLI()` (this is what `pnpm`/`npm` link for the `guardrail` command). |
| **Library exports** | `dist/index.js` — re-exports `runCLI` and commands; do not expect `--help` when running `node dist/index.js` alone. |
| **Module kind** | `package.json` sets **`"type": "module"`** so Node loads `dist/**/*.js` as ESM (no spurious warnings). Build orchestration uses **`scripts/*.cjs`** (CommonJS) so `require` keeps working. |
| **Local dev** | `pnpm run build` in `packages/cli`, then `node bin/guardrail.js --help`. |

**Integration tests** for the CLI are **not** run by Jest (see root `config/jest.config.js`). From `packages/cli` run:

```bash
pnpm run build
pnpm exec playwright install chromium   # once per machine/CI
pnpm run test:integration
# or: pnpm exec playwright test tests/integration/cli-features.test.ts
```

**Reality integration** (heavy Playwright): opt-in with `GUARDRAIL_REALITY_INTEGRATION=1` if you remove `reality-integration.test.ts` from Jest ignore patterns.

=======
>>>>>>> 64774cf6f8ffd3a30c44ac65801f229995aeb6e7
## ✨ What's New in v2.5.0

- 🎮 **Interactive Menu** - Arrow key navigation, visual selection indicators
- 🎭 **Reality Mode** - Automatic Playwright installation for browser testing
- 📦 **Ship Check** - Plain English audit and deployment readiness
- 🛠️ **AI Fixes** - Enhanced guided suggestions and automated remediation
- 🧪 **Full Test Coverage** - 50+ integration tests ensuring reliability

## Installation

```bash
npm install -g guardrail-cli-tool@latest
```

## Quick Start

```bash
# 🎮 Open the new interactive menu (recommended)
guardrail menu

# 🔐 Authenticate with your API key
guardrail auth --key gr_pro_your_api_key_here

# 🔍 Scan your project
guardrail scan --path ./your-project

# 🚀 Try Reality Mode (auto-installs Playwright)
guardrail reality --url https://your-site.com --flow user-journey

# 📦 Ship readiness check
guardrail ship --path ./your-project
```

## Authentication

The CLI uses enterprise-grade authentication with secure credential storage.

### Commands

```bash
# Authenticate with API key (validates against guardrail API)
guardrail auth --key gr_pro_abc123xyz789

# Check current authentication status
# Shows masked key (gr_pro_****xyz9), tier, email, expiry
guardrail auth --status

# Force refresh cached entitlements
guardrail auth --refresh

# Logout and remove stored credentials
guardrail auth --logout
```

### Features

- **Real API Validation**: Keys are validated against `POST /v1/cli/auth/validate`
- **Secure Storage**: Credentials stored with 0600 permissions (Unix) or NTFS ACLs (Windows)
- **Local Caching**: Entitlements cached for 15 minutes to reduce API calls
- **Auto-Refresh**: Cache reused if > 5 minutes remaining; use `--refresh` to force
- **Key Masking**: API keys always displayed masked: `gr_pro_****abcd`
- **Expiry Warnings**: Yellow warning if entitlements expire within 72 hours

### Credential Storage

| Platform | Location |
|----------|----------|
| macOS | `~/Library/Application Support/guardrail/state.json` |
| Linux | `~/.config/guardrail/state.json` |
| Windows | `%APPDATA%\guardrail\state.json` |

If `keytar` is available, sensitive tokens are stored in the OS keychain.

## Commands

- `guardrail auth` - Authenticate with your API key
- `guardrail scan` - Run security scans
- `guardrail scan:secrets` - Scan for hardcoded secrets
- `guardrail scan:vulnerabilities` - Scan dependencies for CVEs (OSV integration)
- `guardrail scan:compliance` - Compliance assessment (Pro)
- `guardrail sbom:generate` - Generate SBOM (Pro)
- `guardrail ship` - Ship readiness checks (Starter+)
- `guardrail reality` - Browser testing for fake data (Starter+)
- `guardrail smells` - Code smell analysis
- `guardrail fix` - Manual fix suggestions (Starter+)
- `guardrail autopilot` - AI-powered batch remediation (Pro)
- `guardrail cache:clear` - Clear OSV vulnerability cache
- `guardrail cache:status` - Show cache statistics
- `guardrail init` - Initialize guardrail in a project (see [Init Command](#init-command))
- `guardrail menu` - Interactive menu

## Init Command

The `guardrail init` command provides enterprise-grade project initialization with automatic framework detection and template-based configuration.

### Basic Usage

```bash
# Initialize with interactive prompts (auto-detects framework)
guardrail init

# Initialize with a specific template
guardrail init --template enterprise

# Initialize with CI and git hooks
guardrail init --ci --hooks

# Non-interactive mode
guardrail init --template startup --no-interactive
```

### Options

| Option | Description |
|--------|-------------|
| `-p, --path <path>` | Project path (default: `.`) |
| `-t, --template <template>` | Template: `startup`, `enterprise`, or `oss` |
| `--ci` | Generate CI/CD workflow (GitHub Actions with SARIF upload) |
| `--hooks` | Install git hooks (husky or lefthook) |
| `--hook-runner <runner>` | Specify hook runner: `husky` or `lefthook` |
| `--no-interactive` | Disable interactive prompts |

### Framework Detection

guardrail automatically detects your project framework by inspecting `package.json` and file structure:

| Framework | Detection Signals |
|-----------|-------------------|
| **Next.js** | `next` dependency, `next.config.*`, `app/` or `pages/` directory |
| **Express** | `express` dependency, `src/server.*` patterns, `routes/` directory |
| **NestJS** | `@nestjs/core` dependency, `nest-cli.json`, `*.module.ts` files |
| **Fastify** | `fastify` dependency, `@fastify/*` packages |
| **Remix** | `@remix-run/*` packages, `remix.config.*`, `app/routes/` |
| **Vite+React** | `vite` + `react` dependencies, `@vitejs/plugin-react` |

Based on the detected framework, guardrail recommends the most relevant scans:

- **Next.js/Remix**: secrets, vulnerabilities, ship readiness, reality mode (auth flows)
- **Express/NestJS/Fastify**: secrets, vulnerabilities, ship readiness, compliance (logging/rate limits)
- **Vite+React**: secrets, vulnerabilities, ship readiness

### Templates

Templates configure `.guardrail/config.json` with different defaults:

#### Startup Template
- **Use case**: Early-stage teams, fast iteration
- **Scan thresholds**: High (fewer alerts)
- **Compliance**: Disabled
- **Gating**: Block on critical only
- **Output**: Table format
- **Noise reduction**: Suppress test files, low-confidence findings

```bash
guardrail init --template startup
```

#### Enterprise Template
- **Use case**: Regulated industries, strict security requirements
- **Scan thresholds**: Low (catch everything)
- **Compliance**: Enabled (SOC2 by default)
- **Gating**: Block on critical and high, baseline/allowlist enabled
- **Output**: SARIF format with upload
- **SBOM**: Enabled

```bash
guardrail init --template enterprise
```

#### OSS Template
- **Use case**: Open source projects, contributor-friendly
- **Focus**: Supply chain security (SBOM, vulnerabilities)
- **Gating**: Permissive, baseline/allowlist enabled
- **Output**: Markdown format (PR-friendly)
- **Noise reduction**: Suppress test files, examples

```bash
guardrail init --template oss
```

### Generated Files

#### Configuration (`.guardrail/config.json`)

```json
{
  "version": "1.0.0",
  "template": "enterprise",
  "framework": "nextjs",
  "scans": {
    "secrets": { "enabled": true, "threshold": "low" },
    "vulnerabilities": { "enabled": true, "threshold": "medium" },
    "compliance": { "enabled": true, "frameworks": ["soc2"] },
    "sbom": { "enabled": true }
  },
  "gating": {
    "enabled": true,
    "blockOnCritical": true,
    "blockOnHigh": true,
    "baselineEnabled": true,
    "allowlistEnabled": true
  },
  "output": {
    "format": "sarif",
    "sarifUpload": true,
    "badgeGeneration": true
  }
}
```

#### CI Workflow (`.github/workflows/guardrail.yml`)

When using `--ci`, generates a GitHub Actions workflow that:
- Runs secrets and vulnerability scans
- Runs compliance checks (if enabled)
- Generates SBOM (if enabled)
- Uploads SARIF results to GitHub Security tab
- Runs ship readiness check
- Fails the workflow on critical/high findings

**Required**: Add `GUARDRAIL_API_KEY` to your repository secrets.

#### Git Hooks (`.husky/` or `lefthook.yml`)

When using `--hooks`, installs:
- **pre-commit**: Secrets scan on staged files
- **pre-push**: Full secrets + vulnerability scan + ship check

### Examples

```bash
# Next.js project with enterprise security
guardrail init --template enterprise --ci --hooks

# Express API with startup defaults
guardrail init --path ./api --template startup

# OSS project with lefthook
guardrail init --template oss --hooks --hook-runner lefthook

# CI-only setup (no hooks)
guardrail init --template enterprise --ci --no-interactive
```

## Vulnerability Scanning (OSV Integration)

The `scan:vulnerabilities` command uses real-time data from the [Open Source Vulnerabilities (OSV)](https://osv.dev) database.

### Features

- **Real-time OSV API queries** - Live vulnerability data from Google's OSV database
- **Multi-ecosystem support** - npm, PyPI, RubyGems, Go
- **Lockfile parsing** - package-lock.json, pnpm-lock.yaml, yarn.lock
- **24-hour caching** - Reduces API calls with local cache in `.guardrail/cache/osv.json`
- **CVSS scoring** - Severity levels with optional NVD enrichment
- **Remediation paths** - Upgrade suggestions with breaking change detection
- **SARIF output** - GitHub code scanning integration

### Usage

```bash
# Basic vulnerability scan
guardrail scan:vulnerabilities --path ./my-project

# Bypass cache for fresh data
guardrail scan:vulnerabilities --no-cache

# Enable NVD enrichment for CVSS scores (slower)
guardrail scan:vulnerabilities --nvd

# Output as SARIF for GitHub code scanning
guardrail scan:vulnerabilities --format sarif -o results.sarif

# Filter by ecosystem
guardrail scan:vulnerabilities --ecosystem npm

# Fail CI if critical vulnerabilities found
guardrail scan:vulnerabilities --fail-on-critical
```

### Options

| Option | Description |
|--------|-------------|
| `-p, --path <path>` | Project path to scan (default: `.`) |
| `-f, --format <format>` | Output format: `table`, `json`, `sarif` (default: `table`) |
| `-o, --output <file>` | Write report to file |
| `--no-cache` | Bypass 24h cache, fetch fresh data from OSV |
| `--nvd` | Enable NVD enrichment for CVSS scores (slower) |
| `--fail-on-critical` | Exit with error if critical vulnerabilities found |
| `--fail-on-high` | Exit with error if high+ vulnerabilities found |
| `--ecosystem <eco>` | Filter by ecosystem: `npm`, `PyPI`, `RubyGems`, `Go` |

### Cache Management

Vulnerability data is cached for 24 hours in `.guardrail/cache/osv.json`.

```bash
# View cache statistics
guardrail cache:status

# Clear the cache
guardrail cache:clear

# Clear global cache
guardrail cache:clear --global
```

### SARIF Output for GitHub

Generate SARIF v2.1.0 output for GitHub code scanning:

```bash
# Generate SARIF report
guardrail scan:vulnerabilities --format sarif -o vuln-results.sarif

# In GitHub Actions workflow:
- name: Run guardrail Vulnerability Scan
  run: guardrail scan:vulnerabilities --format sarif -o results.sarif
  
- name: Upload SARIF to GitHub
  uses: github/codeql-action/upload-sarif@v2
  with:
    sarif_file: results.sarif
```

The SARIF output includes:
- Rule metadata with CVE/GHSA IDs
- CVSS scores and vectors
- Remediation suggestions
- Package.json line locations
- Direct vs transitive classification

### Consistent Command Headers

All analysis commands (`scan`, `ship`, `smells`, etc.) display a consistent framed header with:
- **Title**: Command name with icon
- **Project**: Project name from directory
- **Path**: Project path (truncated for long paths)
- **Started**: Timestamp when command started
- **Mode**: Tier badge when authenticated (FREE/STARTER/PRO/ENTERPRISE)
- **Metadata**: Command-specific options (e.g., scan type, severity filter)

The header respects `NO_COLOR` environment variable and `--no-color` flag for CI/accessibility.

## Tiers

- **Free**: Basic scanning and validation
- **Starter** ($29/mo): Ship checks, reality mode, fix suggestions
- **Pro** ($99/mo): Advanced analysis, autopilot, smells detection, compliance
- **Enterprise** ($499/mo): Custom policies, SSO, dedicated support

## Environment Variables

| Variable | Description |
|----------|-------------|
| `GUARDRAIL_API_BASE_URL` | Override API endpoint (default: `https://api.guardrailai.dev`) |
| `GUARDRAIL_NO_INTERACTIVE` | Disable interactive prompts (`1` to disable) |
| `GUARDRAIL_NO_UNICODE` | Disable Unicode output (`1` for ASCII-only) |

## Reality Mode

Reality Mode detects fake data, mock backends, and placeholder content in your running application using Playwright browser automation.

### Generate Only (default)

```bash
# Generate a Playwright test for the auth flow
guardrail reality --flow auth

# Generate test for a custom URL
guardrail reality --url http://localhost:8080 --flow checkout
```

### Generate + Run

```bash
# Generate and immediately execute the test
guardrail reality --run --flow auth

# Run in headed mode (show browser)
guardrail reality --run --flow auth --headless=false

# Custom timeout and workers
guardrail reality --run --timeout 60 --workers 2

# Use HTML reporter for detailed results
guardrail reality --run --reporter html,list

# Full configuration example
guardrail reality --run \
  --url http://localhost:8080 \
  --flow checkout \
  --timeout 45 \
  --workers 4 \
  --reporter html,json \
  --trace retain-on-failure \
  --video retain-on-failure \
  --screenshot only-on-failure
```

**Exit Code**: Mirrors Playwright's exit code (0 = pass, non-zero = fail)

#### 3. Record Mode

Opens Playwright in interactive recording mode using `codegen` to capture user actions.

```bash
# Start recording session
guardrail reality --record --url http://localhost:3000

# Record with custom flow name
guardrail reality --record --url http://localhost:8080 --flow signup
```

**How it works**:
1. Opens browser with Playwright Inspector
2. Interact with your app (click, type, navigate)
3. Playwright records all actions with robust selectors
4. Generated test saved to `.guardrail/reality/<runId>/reality-<flow>.test.ts`
5. Press Ctrl+C when done

### Options

| Flag | Description | Default |
|------|-------------|---------|
| `-p, --path <path>` | Project path | `.` |
| `-u, --url <url>` | Base URL of running app | `http://localhost:3000` |
| `-f, --flow <flow>` | Flow to test: auth, checkout, dashboard | `auth` |
| `-t, --timeout <seconds>` | Test timeout in seconds | `30` |
| `--headless` | Run in headless mode | `false` |
| `--run` | Execute the generated test immediately | `false` |
| `--record` | Open Playwright codegen for recording | `false` |
| `--workers <n>` | Number of parallel workers | `1` |
| `--reporter <type>` | Test reporter: list, dot, html, json | `list` |
| `--trace <mode>` | Trace mode: on, off, retain-on-failure, on-first-retry | `retain-on-failure` |
| `--video <mode>` | Video mode: on, off, retain-on-failure, on-first-retry | `retain-on-failure` |
| `--screenshot <mode>` | Screenshot mode: on, off, only-on-failure | `only-on-failure` |

### Artifacts

When using `--run`, artifacts are saved under `.guardrail/reality/<runId>/`:

```
.guardrail/reality/auth-1704123456789-a1b2c3d4/
├── reality-auth.test.ts      # Generated test file
├── output.log                 # Playwright console output
├── result.json                # Run result summary (success, exitCode, duration)
├── run-metadata.json          # Execution configuration
├── screenshots/               # Failure screenshots (if --screenshot enabled)
│   ├── test-failed-1.png
│   └── test-failed-2.png
└── report/                    # HTML report (if --reporter html)
    └── index.html
```

### Viewing Results

**HTML Report** (if `--reporter html`):
```bash
npx playwright show-report .guardrail/reality/<runId>/report
```

**JSON Results**:
```bash
cat .guardrail/reality/<runId>/result.json
```

**Logs**:
```bash
cat .guardrail/reality/<runId>/output.log
```

### Prerequisites

Reality Mode requires Playwright and browser binaries.

**Install Playwright**:
```bash
npm install -D @playwright/test
npx playwright install
```

The CLI automatically detects missing dependencies and provides exact install commands with exit code 2.

### Exit Codes

| Code | Meaning |
|------|---------|
| 0 | Tests passed |
| 1 | Tests failed |
| 2 | Playwright or browsers not installed |

### Examples

**Quick test in CI**:
```bash
guardrail reality --run --flow auth --headless --timeout 30
```

**Debug with full visibility**:
```bash
guardrail reality --run --flow checkout \
  --no-headless \
  --trace on \
  --video on \
  --screenshot on
```

**Record custom flow**:
```bash
guardrail reality --record --url http://localhost:3000 --flow onboarding
```

**Parallel execution**:
```bash
guardrail reality --run --workers 4 --reporter html,json
```

## Support

- [Documentation](https://guardrailai.dev/docs)
- [Discord](https://discord.gg/guardrail)
- [Support](mailto:support@guardrailai.dev)

## License

MIT
