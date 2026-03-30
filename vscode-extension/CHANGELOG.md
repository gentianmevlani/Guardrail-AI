# Changelog

All notable changes to the guardrail VS Code extension.

## [1.0.0] - 2026-01-05

### Added

- **Score Badge** - Real-time workspace health score in status bar (🟢🟡🔴)
- **Scan Workspace** command (`Ctrl+Shift+G`) - Full project analysis
- **Validate AI Code** command (`Ctrl+Shift+V`) - Check AI-generated code for hallucinations
- **Dashboard** - Visual health overview with one-click actions
- **Inline Diagnostics** - Problems appear in the Problems tab
- **CodeLens Warnings** - Contextual warnings above functions
- **Hover Tooltips** - Detailed explanations on hover

### Detection Categories

- Hardcoded secrets
- Mock/fake data in production paths
- Silent error catches
- Hallucinated imports
- Missing auth checks
- Unhandled JSON.parse
- Debug console.log statements

### Settings

- `guardrail.enabled` - Toggle analysis
- `guardrail.showScoreBadge` - Toggle status bar badge
- `guardrail.analyzeOnSave` - Auto-analyze on save
- `guardrail.scanProfile` - Default scan depth (quick/ship/full/security)
- `guardrail.apiKey` - API key for premium features

### Keyboard Shortcuts

- `Ctrl+Shift+G` / `Cmd+Shift+G` - Scan Workspace
- `Ctrl+Shift+R` / `Cmd+Shift+R` - Analyze Selection
- `Ctrl+Shift+V` / `Cmd+Shift+V` - Validate AI Code

---

For more information, visit [guardrail.dev](https://guardrail.dev)
