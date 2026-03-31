<div align="center">

# 🛡️ Guardrail

### CI Truth for AI-Generated Code

**Prove your app is real — before you ship.**

[![npm version](https://img.shields.io/npm/v/guardrail?style=flat-square&color=cb3837&logo=npm)](https://npmjs.com/package/guardrail)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg?style=flat-square)](https://opensource.org/licenses/MIT)
[![Build Status](https://img.shields.io/github/actions/workflow/status/guardrail-Official/guardrail/ci-cd.yml?style=flat-square&logo=github)](https://github.com/guardrail-Official/guardrail/actions)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg?style=flat-square)](https://github.com/guardrail-Official/guardrail/pulls)
[![Node](https://img.shields.io/badge/node-%3E%3D20.11-brightgreen?style=flat-square&logo=node.js)](https://nodejs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.3-blue?style=flat-square&logo=typescript)](https://www.typescriptlang.org/)
[![Discord](https://img.shields.io/badge/Discord-Join%20Us-7289da?style=flat-square&logo=discord&logoColor=white)](https://discord.gg/guardrail)

[Website](https://guardrailai.dev) · [Documentation](https://guardrailai.dev/docs) · [Report Bug](https://github.com/guardrail-Official/guardrail/issues/new?template=bug_report.md) · [Request Feature](https://github.com/guardrail-Official/guardrail/issues/new?template=feature_request.md)

</div>

---

## 🎯 The Problem

AI-assisted coding creates **convincing wrongness**: dead routes, fake data, stub APIs, missing auth, leaked secrets, UI/API drift. Your tests pass. Your CI is green. But your app isn't real.

**Guardrail catches that and blocks it in CI.**

<div align="center">

```
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│   🔴 BEFORE: "It looks like it works!"                          │
│   ───────────────────────────────────                           │
│   ✓ Tests pass                                                  │
│   ✓ CI green                                                    │
│   ✗ Routes return 404                                           │
│   ✗ Auth bypassed                                               │
│   ✗ API keys in code                                            │
│   ✗ Mock data in production                                     │
│                                                                 │
│   🟢 AFTER: "It actually works!"                                │
│   ───────────────────────────────                               │
│   ✓ Tests pass                                                  │
│   ✓ CI green                                                    │
│   ✓ Guardrail SHIP                                              │
│   ✓ Routes verified                                             │
│   ✓ Auth enforced                                               │
│   ✓ Secrets safe                                                │
│   ✓ Real data flows                                             │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

</div>

---

## ✨ What guardrail Guarantees

| Check                    | Description                                             |
| ------------------------ | ------------------------------------------------------- |
| 🚫 **No Dead Routes**    | Placeholder handlers and 404s caught before merge       |
| 🔐 **Auth Enforced**     | Sensitive endpoints require authentication + RBAC       |
| 🔑 **No Leaked Secrets** | API keys, tokens, passwords detected and blocked        |
| 🎭 **No Mock Data**      | Fake domains, fixtures, demo data caught in prod builds |
| 🔄 **Contract Match**    | UI ↔ API endpoint drift detection                       |
| 🚦 **CI Gating**         | Policy-driven merge blocking                            |

---

## 🚀 Quick Start

### Installation
```bash
# Install the CLI
npm install -g guardrail-cli-tool

# Or use with npx
npx guardrail-cli-tool --help
```

### Authentication
```bash
# Get your API key from https://guardrailai.dev
guardrail auth --key vc_starter_your_api_key_here
```

**That's it!** Guardrail starts protecting your code immediately.

### Basic Usage
```bash
# Free tier - Basic scanning
guardrail scan --path ./my-project

# Starter tier - Ship readiness  
guardrail ship --path ./my-project

# Pro tier - Advanced analysis
guardrail smells --pro --path ./my-project

# Enterprise tier - Compliance
guardrail scan:compliance --framework soc2 --path ./my-project
```

---

## 💰 Pricing & Tiers

| Tier | Price | Key Features | Best For |
|------|-------|--------------|-----------|
| **🆓 Free** | $0 | Basic scanning, validation | Personal projects |
| **🚀 Starter** | $29/mo | Ship checks, reality mode, fix suggestions | Freelancers & small teams |
| **💼 Pro** | $99/mo | Advanced analysis, autopilot, smells detection | Development teams |
| **🏢 Compliance** | $199/mo | Enterprise frameworks, audit trails | Companies requiring compliance |
| **🔒 Enterprise** | $499/mo | Custom policies, SSO, dedicated support | Large organizations |

[View detailed pricing →](https://guardrailai.dev/pricing)

---

## 📖 Core Commands

### `guardrail scan`

Find truth — run checks and produce artifacts.

```bash
npx guardrail scan                      # Quick integrity scan
npx guardrail scan --profile=full       # All static checks
npx guardrail scan --profile=ship       # Full ship-readiness check
npx guardrail scan --only=security,auth # Specific checks only
npx guardrail scan --format=html,sarif  # Multiple output formats
```

<details>
<summary><strong>📋 Check Modules</strong></summary>

| Module      | What It Checks                                  |
| ----------- | ----------------------------------------------- |
| `integrity` | API wiring, routes, auth presence, placeholders |
| `security`  | Secrets, SBOM, dependency vulns, licenses       |
| `hygiene`   | Duplicates, unused files, lint failures         |
| `contracts` | UI/API endpoint matching, drift detection       |
| `mocks`     | Mock/test code leakage                          |

</details>

<details>
<summary><strong>📁 Output Files</strong></summary>

| File                       | Description                 |
| -------------------------- | --------------------------- |
| `.guardrail/summary.json`  | Machine-readable results    |
| `.guardrail/summary.md`    | Human-readable report       |
| `.guardrail/report.html`   | Shareable HTML report       |
| `.guardrail/results.sarif` | GitHub Code Scanning format |

</details>

---

### `guardrail gate`

Enforce truth in CI — fail builds on policy violations.

```bash
npx guardrail gate                   # Default policy
npx guardrail gate --policy=strict   # Stricter thresholds
npx guardrail gate --sarif           # Generate SARIF for GitHub
```

**Exit Codes:**

| Code | Status     | Meaning           |
| ---- | ---------- | ----------------- |
| `0`  | ✅ SHIP    | All checks passed |
| `1`  | 🚫 NO-SHIP | Violations found  |
| `2`  | ⚠️ ERROR   | Misconfiguration  |

---

### `guardrail fix`

Apply safe patches — preview plan then apply.

```bash
npx guardrail fix --plan           # Preview recommended fixes
npx guardrail fix --apply          # Apply safe fixes
npx guardrail fix --scope=secrets  # Fix only secrets
npx guardrail fix --risk=moderate  # Allow medium-risk fixes
```

---

## 🔬 Reality Mode (Premium)

Runtime verification that catches what static analysis can't.

### Mock Detection

```bash
npx guardrail proof mocks
```

**Catches:**

- Mock imports in production builds
- Fixture/demo data leaks
- Fake API domains (`jsonplaceholder.typicode.com`)
- Placeholder endpoints

### Runtime Verification

```bash
npx guardrail proof reality --url http://localhost:3000
npx guardrail proof reality --flow checkout --video
```

**Catches:**

- "Looks real" UI using fake data at runtime
- Network requests hitting mock services
- Runtime UI/API mismatches

---

## 🤖 AI IDE Integration (MCP)

Expose guardrail as tools in AI agent workflows.

```bash
npx guardrail mcp
```

**Available Tools:**

- `guardrail.scan` — Run checks
- `guardrail.gate` — CI enforcement
- `guardrail.fix` — Apply patches
- `guardrail.proof` — Premium verification
- `guardrail.status` — Health info

<details>
<summary><strong>🔧 Cursor/Windsurf Configuration</strong></summary>

```json
{
  "mcpServers": {
    "guardrail": {
      "command": "npx",
      "args": ["guardrail", "mcp"]
    }
  }
}
```

</details>

---

## ⚙️ Configuration

Create `guardrail.config.json` in your project root:

```json
{
  "version": "2.0.0",
  "checks": ["integrity", "security", "hygiene"],
  "output": ".guardrail",
  "policy": {
    "failOn": ["critical", "high"],
    "allowlist": {
      "domains": ["api.stripe.com"],
      "packages": [],
      "paths": ["src/testing/*"]
    },
    "ignore": {
      "paths": ["node_modules", "__tests__", "*.test.*"]
    }
  },
  "profiles": {
    "quick": { "checks": ["integrity"] },
    "full": { "checks": ["integrity", "security", "hygiene", "contracts"] },
    "ship": {
      "checks": ["integrity", "security", "hygiene", "contracts", "mocks"]
    }
  }
}
```

---

## 🔄 CI/CD Integration

### GitHub Actions

```yaml
name: guardrail Check

on: [push, pull_request]

jobs:
  guardrail:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup Node
        uses: actions/setup-node@v4
        with:
          node-version: "20"

      - name: Install Dependencies
        run: npm ci

      - name: guardrail Gate
        run: npx guardrail gate --sarif

      - name: Upload SARIF
        uses: github/codeql-action/upload-sarif@v3
        if: always()
        with:
          sarif_file: .guardrail/results.sarif
```

<details>
<summary><strong>GitLab CI</strong></summary>

```yaml
guardrail:
  stage: test
  image: node:20
  script:
    - npm ci
    - npx guardrail gate
  artifacts:
    paths:
      - .guardrail/
    reports:
      codequality: .guardrail/results.json
```

</details>

<details>
<summary><strong>CircleCI</strong></summary>

```yaml
version: 2.1
jobs:
  guardrail:
    docker:
      - image: cimg/node:20.11
    steps:
      - checkout
      - run: npm ci
      - run: npx guardrail gate
      - store_artifacts:
          path: .guardrail
```

</details>

---

## 🏗️ Project Structure

```
guardrail/
├── 📁 apps/                    # Applications
│   ├── api/                   # Backend API service  
│   └── web-ui/                # Dashboard & reports
├── 📁 packages/               # Shared packages
│   ├── core/                  # Core scanning engine
│   ├── cli/                   # CLI implementation
│   ├── compliance/            # Compliance frameworks
│   └── ai-guardrails/         # AI-specific checks
├── 📁 bin/                    # CLI entry points
├── 📁 config/                 # All configuration files
├── 📁 deploy/                 # Deployment configs
├── 📁 docker/                 # Docker configurations
├── 📁 docs/                   # Complete documentation
├── 📁 scripts/                # Build & utility scripts
├── 📁 src/                    # Shared source code
├── 📁 templates/              # Project templates
├── 📁 tests/                  # Test suites
└── 📁 examples/               # Example projects

📄 Root contains only essential files:
    README.md, LICENSE, package.json, tsconfig*.json,
    .env*, .git*, .npmrc, .nvmrc, .editorconfig
```

---

## 🔒 Privacy & Security

| Feature              | Status                                  |
| -------------------- | --------------------------------------- |
| **Local-First**      | ✅ All scans run locally                |
| **No Telemetry**     | ✅ No code sent to external servers     |
| **Artifact Storage** | ✅ `.guardrail/` directory (gitignored) |
| **SARIF Export**     | ✅ Opt-in only                          |
| **SOC2/HIPAA Ready** | ✅ Compliance tier available            |

---

## 💰 Pricing

| Tier           | Price   | Includes                                           |
| -------------- | ------- | -------------------------------------------------- |
| **Free**       | $0      | `scan`, `gate`, basic reports                      |
| **Starter**    | $29/mo  | + contract checks, mock detection                  |
| **Pro**        | $99/mo  | + `fix` workflows, proof modes, advanced reports   |
| **Compliance** | $199/mo | + SOC2, HIPAA, GDPR, PCI, NIST, ISO27001           |
| **Enterprise** | Custom  | + SSO, on-prem, custom policies, dedicated support |

[View Pricing →](https://guardrailai.dev/pricing)

---

## 🤝 Contributing

We love contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details.

```bash
# Clone the repo
git clone https://github.com/guardiavault-oss/codeguard.git
cd codeguard

# Install dependencies
pnpm install

# Run tests
pnpm test

# Start development
pnpm dev
```

---

## 🎮 New to Coding with AI? Start Here!

If you're a **vibe coder** who uses AI assistants to write code, these guides are for you:

| Guide | What You'll Learn |
|-------|-------------------|
| [**Getting Started for Vibe Coders**](docs/GETTING-STARTED-FOR-VIBE-CODERS.md) | Plain English explanation of everything |
| [**Quick Reference Card**](docs/QUICK-REFERENCE-CARD.md) | One-page cheat sheet to keep open |
| [**Example MCP Configs**](docs/EXAMPLE-MCP-CONFIGS.md) | Copy-paste configs for your editor |

**5-Minute Setup:**
1. Run `cd mcp-server && npm install`
2. Copy config from [Example Configs](docs/EXAMPLE-MCP-CONFIGS.md) into your editor
3. Ask your AI: *"Run guardrail ship check"*

That's it! You're protected.

---

## 📚 Documentation

| Resource                                                        | Description                    |
| --------------------------------------------------------------- | ------------------------------ |
| [Getting Started](https://guardrailai.dev/docs/getting-started) | Quick setup guide              |
| [Getting Started for Vibe Coders](docs/GETTING-STARTED-FOR-VIBE-CODERS.md) | Beginner-friendly guide |
| [Quick Reference Card](docs/QUICK-REFERENCE-CARD.md) | One-page cheat sheet |
| [CLI Reference](https://guardrailai.dev/docs/cli)               | Complete command documentation |
| [Configuration](https://guardrailai.dev/docs/config)            | Config file options            |
| [API Reference](https://guardrailai.dev/docs/api)               | REST API documentation         |
| [FAQ](https://guardrailai.dev/docs/faq)                         | Common questions               |

---

## 🌟 Community

- 💬 [Discord](https://discord.gg/guardrail) — Chat with the team
- 🐦 [Twitter](https://twitter.com/getguardrail) — Updates & tips
- 📝 [Blog](https://guardrailai.dev/blog) — Tutorials & insights
- 📧 [Newsletter](https://guardrailai.dev/newsletter) — Monthly updates

---

## 📄 License

guardrail is [MIT licensed](LICENSE).

---

<div align="center">

**🛡️ guardrail — CI Truth for AI-Generated Code**

[Website](https://guardrailai.dev) · [Docs](https://guardrailai.dev/docs) · [Discord](https://discord.gg/guardrail) · [Twitter](https://twitter.com/getguardrail)

Made with ❤️ by the guardrail team

</div>
# Guardrail-AI
