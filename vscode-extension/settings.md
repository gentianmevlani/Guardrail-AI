# ⚙️ Configure CodeGuard

Customize CodeGuard to match your workflow.

## Settings

Open Settings (`Cmd+,` / `Ctrl+,`) and search for "codeguard":

| Setting | Default | Description |
|---------|---------|-------------|
| `codeguard.enabled` | `true` | Enable/disable analysis |
| `codeguard.analyzeOnSave` | `true` | Auto-analyze when you save |
| `codeguard.analyzeOnType` | `false` | Real-time analysis (heavier) |
| `codeguard.showInlineHints` | `true` | Show decorations in editor |

## Rule Severity

Configure severity per-rule in `codeguard.severity`:

```json
{
  "codeguard.severity": {
    "CG001": "error",    // Hardcoded mock data
    "CG002": "error",    // Fake features
    "CG003": "warning",  // TODOs
    "CG010": "off"       // Disable console warnings
  }
}
```

**Levels:** `error`, `warning`, `hint`, `off`

## Ignore Paths

Skip files from analysis:

```json
{
  "codeguard.ignorePaths": [
    "**/node_modules/**",
    "**/test/**",
    "**/*.test.ts"
  ]
}
```

## Project Config

Create `.codeguard.json` in your project root for team-wide settings:

```json
{
  "extends": "strict",
  "rules": {
    "CG001": "error",
    "CG010": "off"
  },
  "ignore": ["**/fixtures/**"]
}
```
