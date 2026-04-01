# guardrail MCP Premium Tools

> "Stop shipping pretend features."

This document describes the premium MCP tools that provide a top-notch, zero-friction UX for the guardrail plugin.

## Command Palette Commands

All commands are designed to be invoked via the IDE's command palette for instant access.

### Core Commands

| Command | Tool Name | Description |
|---------|-----------|-------------|
| **guardrail: Ship Check (GO/NO-GO)** | `run_ship` | Full ship-worthiness check with MockProof + Reality + Badge |
| **guardrail: Run Reality Mode** | `run_reality` | Spin up app and detect fake data at runtime |
| **guardrail: Run MockProof Gate** | `run_mockproof` | Static import graph scan for banned patterns |
| **guardrail: Run Airlock (SupplyChain)** | `run_airlock` | SBOM generation, vulnerability scan, license check |
| **guardrail: Open Last Run Report** | `get_last_run` | Get details of the most recent check |
| **guardrail: Re-run Last Check** | `rerun_last_check` | Repeat the previous check with same parameters |
| **guardrail: Doctor (Fix my setup)** | `run_doctor` | Diagnose and auto-fix environment issues |
| **guardrail: Policies (Quick Edit)** | `edit_policies` | View and modify .guardrailrc settings |

### Tool Reference

#### `get_status`
Get guardrail server status, connection info, workspace trust, and last run summary.

```
Response format:
- Connected: ✅ / ❌
- Mode: Local / CI
- Workspace: trusted/untrusted
- Last Run: tool, verdict, timestamp
```

#### `run_ship`
Full ship-worthiness check. Returns GO/NO-GO verdict with toast notification.

**Parameters:**
- `projectPath` (string): Path to project (default: ".")
- `profile` (string): Profile to use - "default", "strict", "ci"
- `flows` (array): Specific flows to test

**Response toast format:**
```
NO-SHIP • 3 blockers • Replay ready
```

#### `run_reality`
Generate and run Reality Mode Playwright test.

**Parameters:**
- `projectPath` (string): Path to project
- `flow` (string): Flow to test - "auth", "checkout", "dashboard"
- `profile` (string): Profile to use
- `baseUrl` (string): Base URL of running app (default: http://localhost:3000)

#### `run_mockproof`
Static analysis of import graph for banned patterns.

**Parameters:**
- `projectPath` (string): Path to project
- `profile` (string): Profile to use

#### `run_airlock`
Supply chain analysis including npm audit, dependency count, and license compliance.

**Parameters:**
- `projectPath` (string): Path to project
- `profile` (string): Profile to use

#### `get_last_run`
Retrieve the most recent run result.

**Parameters:**
- `projectPath` (string): Path to project
- `tool` (string): Filter by tool - "ship", "reality", "mockproof", "airlock"

#### `open_artifact`
Open a specific artifact from a run.

**Parameters:**
- `projectPath` (string): Path to project
- `type` (string): Artifact type - "report", "replay", "trace", "sarif", "badge"
- `runId` (string): Specific run ID (defaults to last run)

#### `rerun_last_check`
Re-run the previous check with the same parameters.

#### `run_doctor`
Diagnose environment and optionally auto-fix issues.

**Parameters:**
- `projectPath` (string): Path to project
- `autoFix` (boolean): Automatically fix issues (default: false)

**Checks performed:**
- Node.js version (18+)
- Playwright installed
- Playwright browsers installed
- .guardrailrc exists
- .guardrail directory
- Git repository
- TypeScript config
- Next.js build mode
- Environment setup

#### `edit_policies`
View and modify .guardrailrc settings.

**Parameters:**
- `projectPath` (string): Path to project
- `action` (string): "view", "allowlist_domain", "allowlist_package", "ignore_path", "downgrade_rule"
- `target` (string): Target for action
- `auditNote` (string): Audit note for team visibility

#### `explain_finding`
Get detailed explanation of a finding with evidence, trace, and fix suggestions.

**Parameters:**
- `projectPath` (string): Path to project
- `findingId` (string): Finding ID to explain

**Response tabs:**
- **Why**: Rule explanation + trigger condition
- **Evidence**: Request/response snippet, matched regex, domain
- **Trace**: Import path or stack trace
- **Fix**: Exact suggestion + file/line list
- **Policy**: Toggle severity / add exception

#### `policy_patch`
Apply atomic policy changes with diff preview.

**Parameters:**
- `projectPath` (string): Path to project
- `patches` (array): Array of policy patches
- `dryRun` (boolean): Preview changes without applying

**Patch format:**
```json
{
  "action": "allowlist_domain",
  "target": "api.stripe.com",
  "auditNote": "Production Stripe API"
}
```

**Diff preview example:**
```
You are adding: allowlist.domains += "api.stripe.com"
```

#### `export_sarif`
Export findings as SARIF for VS Code diagnostics and GitHub Code Scanning.

**Parameters:**
- `projectPath` (string): Path to project
- `runId` (string): Run ID to export (defaults to last run)
- `outputPath` (string): Output path (default: ".guardrail/results.sarif")

## Fix Mode

The killer feature that makes people talk: one-click "NO-SHIP → Fix Mode".

### `enter_fix_mode`
Enter Fix Mode for interactive blocker resolution.

**Parameters:**
- `projectPath` (string): Path to project
- `runId` (string): Run ID to fix (defaults to last NO-SHIP run)

**Response:**
```
Fix Mode Activated

Checklist:
☐ `src/api/client.ts:42` - Fake API Domain
   Open file | Suggested fix | Re-run
☐ `src/hooks/useAuth.ts:15` - Mock Import
   Open file | Suggested fix | Re-run
```

### `fix_mode_status`
Get current Fix Mode status and remaining blockers.

### `mark_fix_complete`
Mark a blocker as fixed.

**Parameters:**
- `projectPath` (string): Path to project
- `findingId` (string): Finding ID to mark as fixed

### `exit_fix_mode`
Exit Fix Mode and optionally re-run ship check.

**Parameters:**
- `projectPath` (string): Path to project
- `rerunCheck` (boolean): Re-run ship check after exiting (default: true)

## Verdict Display

### Status Block
```
Connected: ✅
Mode: Local
Workspace: trusted
```

### Last Verdict Block (Big)
```
🚀 SHIP
Chips: REALITY MOCKPROOF AIRLOCK
Duration: 1.2s • 2025-01-01 09:15:00
```

or

```
🛑 NO-SHIP
Chips: MOCKPROOF
Duration: 0.8s • 2025-01-01 09:15:00
```

### Blockers List (3-6 items max)
```
• 🔴 `src/api/client.ts:42` - Fake API Domain
• 🔴 `src/hooks/useAuth.ts:15` - Mock Import
• 🟡 `src/utils/config.ts:8` - Localhost URL
```

### Artifacts Row
```
[Report] [Replay] [Trace] [SARIF] [Badge]
```

## Privacy & Trust

All operations are local-first:
- Runs locally
- Artifacts saved to `.guardrail/`
- No upload unless you export/share

Workspace trust gate: Reality Mode runs only if workspace is trusted.

## File Structure

```
.guardrail/
├── mcp-state/
│   └── state.json          # Run history, findings, artifacts
├── ship/
│   ├── ship-report.json    # Last ship check report
│   ├── badges/             # Generated badges
│   └── reality-mode/       # Reality Mode tests and results
├── results.sarif           # SARIF export for diagnostics
└── security-report.json    # Security scan results
```

## Integration with .guardrailrc

The policy manager reads and writes `.guardrailrc`:

```json
{
  "version": "1.0.0",
  "rules": {
    "fake-api-domain": { "severity": "warn", "auditNote": "Known staging domain" }
  },
  "allowlist": {
    "domains": ["api.stripe.com", "api.segment.io"],
    "packages": [],
    "paths": ["src/testing/*"]
  },
  "ignore": {
    "paths": ["node_modules", "__tests__", "*.test.*"]
  },
  "profiles": {
    "default": { "flows": ["auth", "checkout", "dashboard"] },
    "strict": { "extends": "default" },
    "ci": { "extends": "strict" }
  }
}
```

## Best Practices

1. **Start with Doctor**: Run `run_doctor` on first use to ensure environment is ready
2. **Use Profiles**: Create profiles for different environments (local, CI, staging)
3. **Audit Notes**: Always add audit notes when downgrading rules for team visibility
4. **Fix Mode Loop**: Use Fix Mode for systematic blocker resolution
5. **SARIF Export**: Export to SARIF for integration with VS Code and GitHub
