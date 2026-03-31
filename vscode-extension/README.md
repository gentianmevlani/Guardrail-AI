# guardrail – Production Readiness & AI Code Safety

<p align="center">
  <img src="images/guardrail-icon.png" alt="guardrail Logo" width="128">
</p>

<p align="center">
  <strong>Blocks fake data, missing wiring, and unsafe AI code before prod.</strong>
</p>

<p align="center">
  <a href="https://guardrailai.dev">Website</a> •
  <a href="https://github.com/guardrail-ai/guardrail-vscode">GitHub</a> •
  <a href="https://guardrailai.dev/docs">Documentation</a>
</p>

---

## Why guardrail?

AI coding assistants generate code fast—but they also generate:

- **Hallucinated imports** that don't exist
- **Mock data** that looks real but isn't wired up
- **Fake success patterns** where buttons do nothing
- **Missing auth checks** on sensitive routes

guardrail catches these issues **before they reach production**.

## Features

### 🛡️ Score Badge

Real-time workspace health score in your status bar:

- 🟢 **80+** — Ready to ship
- 🟡 **50-79** — Needs attention
- 🔴 **<50** — Critical issues

![Score Badge](images/screenshots/score-badge.png)

### 🔍 Inline Diagnostics

Problems appear directly in the **Problems** tab:

- Hardcoded secrets
- Mock/fake data in production paths
- Unhandled errors
- Missing API wiring

![Inline Diagnostics](images/screenshots/inline-error.png)

### 🏷️ CodeLens Warnings

Above each function:

- "Mock detected in prod path"
- "No auth check"
- "Silent error catch"

![CodeLens](images/screenshots/codelens.png)

### 🤖 AI Code Validation

Select any AI-generated code and validate it:

- Detects hallucinated packages
- Catches intent mismatches
- Flags unsafe patterns

### 📊 Dashboard

Full project health at a glance:

- Production readiness score
- Issue breakdown by category
- One-click scan

## Quick Start

1. **Install** from VS Code Marketplace
2. **Press** `Ctrl+Shift+G` (or `Cmd+Shift+G` on Mac) to scan your workspace
3. **Check** the score badge in your status bar
4. **Fix** issues shown in the Problems panel

## Commands

| Command                          | Shortcut       | Description            |
| -------------------------------- | -------------- | ---------------------- |
| **guardrail: Scan Workspace**    | `Ctrl+Shift+G` | Full workspace scan    |
| **guardrail: Validate AI Code**  | `Ctrl+Shift+V` | Check selected AI code |
| **guardrail: Show Dashboard**    | —              | Open health dashboard  |
| **guardrail: Analyze Selection** | `Ctrl+Shift+R` | Analyze selected code  |

## What It Catches

| Issue                    | Severity    | Example                                               |
| ------------------------ | ----------- | ----------------------------------------------------- |
| **Hardcoded Secrets**    | 🔴 Critical | `apiKey = "sk-..."`                                   |
| **Mock in Production**   | 🔴 Critical | `if (process.env.NODE_ENV !== 'test')` with mock data |
| **Silent Failures**      | 🔴 Critical | `catch (e) {}`                                        |
| **Hallucinated Imports** | 🟡 Warning  | Importing packages that don't exist                   |
| **Missing Auth**         | 🟡 Warning  | Unprotected admin routes                              |
| **No Error Handling**    | 🟡 Warning  | `JSON.parse()` without try-catch                      |
| **Debug Code**           | 💡 Info     | `console.log` in production                           |

## Settings

| Setting                    | Default | Description                  |
| -------------------------- | ------- | ---------------------------- |
| `guardrail.enabled`        | `true`  | Enable guardrail             |
| `guardrail.showScoreBadge` | `true`  | Show score in status bar     |
| `guardrail.analyzeOnSave`  | `true`  | Scan on file save            |
| `guardrail.scanProfile`    | `ship`  | Default scan depth           |
| `guardrail.apiKey`         | —       | API key for premium features |

## CI Integration

Add guardrail to your CI pipeline:

```yaml
# .github/workflows/guardrail.yml
- name: guardrail Gate
  run: npx guardrail gate --policy=strict
```

Block deploys when score drops below threshold.

## Premium Features

With a guardrail API key:

- **Reality Mode** — Browser testing with Playwright
- **Autopilot** — Weekly health reports
- **Compliance** — SOC2/HIPAA/GDPR checks
- **Team Dashboard** — Org-wide visibility

Get your API key at [guardrailai.dev](https://guardrailai.dev)

## Privacy & Security

- ✅ **Local analysis** — Core checks run entirely on your machine
- ✅ **No telemetry** — We don't track your code or behavior
- ✅ **Opt-in cloud** — Premium features require explicit API key
- ✅ **Open source** — [View the code](https://github.com/guardrail-ai/guardrail-vscode)

## Requirements

- VS Code 1.85.0+
- Node.js 18+ (for CLI features)

## Support

- 📖 [Documentation](https://guardrailai.dev/docs)
- 🐛 [Report Issues](https://github.com/guardrail-ai/guardrail-vscode/issues)
- 💬 [Discord Community](https://discord.gg/guardrail)

---

<p align="center">
  Made with ❤️ by the guardrail team
</p>
