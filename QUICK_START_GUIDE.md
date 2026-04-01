# guardrail Quick Start Guide

## The 4-Command Product Loop

### 1. Initialize (One-time setup)
```bash
guardrail init
```
- Builds Truth Pack (all 10 JSON files)
- Installs MCP configuration
- Confirms "AI connected ✅"

### 2. Start Context Mode (The relationship)
```bash
guardrail on
```
- Always-on watcher + MCP server
- Regenerates Truth Pack on file changes
- Logs telemetry for stats

### 3. View Stats (Proof of value)
```bash
guardrail stats
```
Shows:
- Hallucinations blocked (24h/7d/total)
- Symbols verified
- Latency metrics
- Trends

### 4. Ship Check (The paid moment)
```bash
guardrail ship
```
- GO/WARN/NO-GO verdict
- Premium HTML report
- Proof artifacts
- `--open` to view report

## Interactive Launcher

Just run:
```bash
guardrail
```

Opens interactive menu showing:
- Context Mode status
- Truth Pack freshness
- Tier
- Last 24h stats

## Output Flags

All commands support:
- `--json` - Machine-readable output
- `--plain` - No color/unicode
- `--details` - Expanded output

## Exit Codes

- `0` - Success
- `1` - Violations found
- `2` - Setup error
- `3` - Payment gate

## Next Best Action

Every command ends with "Next best action" - the recommended next step.

## That's it!

The 4-command loop is the entire product surface. Everything else is internal or advanced flags.
