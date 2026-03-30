# guardrail MCP Server

Professional Model Context Protocol server for guardrail AI.

> "Stop shipping pretend features."

## Installation

```bash
npm install -g guardrail-mcp-server
```

## Configuration

See [MCP-INSTALLATION-GUIDE.md](../docs/MCP-INSTALLATION-GUIDE.md) for editor-specific setup.

## Development

```bash
cd mcp-server
npm install
npm start
```

## Premium Command Palette Tools

These tools provide a top-notch, zero-friction UX:

### Ship Check Commands
- `run_ship` - guardrail: Ship Check (GO/NO-GO)
- `run_reality` - guardrail: Run Reality Mode
- `run_mockproof` - guardrail: Run MockProof Gate
- `run_airlock` - guardrail: Run Airlock (SupplyChain)

### Report & Artifact Commands
- `get_last_run` - guardrail: Open Last Run Report
- `open_artifact` - Open Report/Replay/Trace/SARIF/Badge
- `rerun_last_check` - guardrail: Re-run Last Check
- `export_sarif` - Export findings as SARIF

### Setup & Policy Commands
- `run_doctor` - guardrail: Doctor (Fix my setup)
- `edit_policies` - guardrail: Policies (Quick Edit)
- `get_status` - Get server status and workspace info
- `policy_patch` - Apply atomic policy changes

### Fix Mode Commands
- `enter_fix_mode` - Enter Fix Mode for blocker resolution
- `fix_mode_status` - Get Fix Mode checklist status
- `mark_fix_complete` - Mark blocker as fixed
- `exit_fix_mode` - Exit and re-run ship check

### Evidence & Diagnostics
- `explain_finding` - Get detailed finding explanation

## AI guardrail Tools (Prompt Firewall + Output Verification)

These tools provide AI safety and verification capabilities:

| Tool | Description |
|------|-------------|
| `guardrail.verify` | 🛡️ Verify AI agent output before applying - checks secrets, dangerous commands, path traversal |
| `guardrail.quality` | 📊 Code quality analysis - complexity, maintainability, technical debt metrics |
| `guardrail.smells` | 👃 Code smell detection - anti-patterns, naming issues, structural problems |
| `guardrail.hallucination` | 🔍 Hallucination check - verify claims against actual source code |
| `guardrail.breaking` | ⚠️ Breaking change detection - API changes, removed methods, type changes |
| `guardrail.mdc` | 📝 MDC Generator - source-anchored documentation generation |
| `guardrail.coverage` | 🧪 Test coverage mapping - identify untested components |

### Example Usage

```json
// Verify AI-generated code before applying
{
  "tool": "guardrail.verify",
  "arguments": {
    "input": "{\"format\":\"guardrail-v1\",\"diff\":\"...\",\"commands\":[]}",
    "mode": "build"
  }
}

// Check code quality
{
  "tool": "guardrail.quality",
  "arguments": {
    "projectPath": ".",
    "threshold": 70
  }
}

// Detect code smells
{
  "tool": "guardrail.smells",
  "arguments": {
    "projectPath": ".",
    "severity": "high"
  }
}
```

## Agent Checkpoint Tools

Pre-write validation that blocks AI agents until issues are fixed:

| Tool | Description |
|------|-------------|
| `guardrail_checkpoint` | 🛡️ Validate code before writing - blocks on TODOs, mocks, console.log, etc. |
| `guardrail_set_strictness` | ⚙️ Set checkpoint strictness: chill, standard, strict, paranoid |
| `guardrail_checkpoint_status` | 📊 Get current checkpoint status and blocking violations |

## Architect Tools

AI agents consult the Architect before writing code:

| Tool | Description |
|------|-------------|
| `guardrail_architect_review` | 🏛️ Review code against architecture patterns |
| `guardrail_architect_suggest` | 💡 Get architectural guidance before writing code |
| `guardrail_architect_patterns` | 📋 List all active architecture patterns |
| `guardrail_architect_set_strictness` | ⚙️ Set architect strictness level |

## Codebase Architect Tools

Deep codebase knowledge for AI agents:

| Tool | Description |
|------|-------------|
| `guardrail_architect_context` | 🧠 Load full codebase context (tech stack, conventions, patterns) |
| `guardrail_architect_guide` | 🏛️ Get guidance for creating/modifying code |
| `guardrail_architect_validate` | ✅ Validate code against codebase patterns |
| `guardrail_architect_dependencies` | 🔗 Understand file relationships and impact |

## guardrail 2.0 Tools (Consolidated)

Six core tools for the complete workflow:

| Tool | Description |
|------|-------------|
| `checkpoint` | 🛡️ Block AI agents until issues are fixed (pre/post write) |
| `check` | 🔍 Verify code is real, wired, honest |
| `ship` | 🚀 Go/No-Go decision (GO / WARN / NO-GO) |
| `fix` | 🔧 Fix blocking issues safely |
| `status` | 📊 Health + version info |
| `set_strictness` | ⚙️ Set checkpoint strictness level |

## Intent Drift Guard Tools

Capture intent before writing code, monitor for drift:

| Tool | Description |
|------|-------------|
| `guardrail_intent_start` | 🎯 Start a new step with explicit intent |
| `guardrail_intent_check` | ✅ Check if code changes align with stated intent |
| `guardrail_intent_validate_prompt` | 🔒 Validate new prompts against locked intent |
| `guardrail_intent_status` | 📊 Get current Intent Drift Guard status |
| `guardrail_intent_complete` | ✅ Complete step and generate proof artifact |
| `guardrail_intent_lock` | 🔒 Lock intent to prevent scope expansion |
| `guardrail_intent_unlock` | 🔓 Unlock intent, allow scope changes |

## Core Analysis Tools

- `validate_project` - Validate project structure and API endpoints
- `check_design_system` - Validate design system consistency
- `check_project_drift` - Check for architecture drift
- `setup_design_system` - Set up and lock design system
- `register_api_endpoint` - Register API endpoint
- `get_project_health` - Get project health score
- `get_guardrails_rules` - Get guardrails rules
- `architect_analyze` - Intelligent project analysis
- `build_knowledge_base` - Build codebase knowledge
- `semantic_search` - Search code by meaning
- `security_scan` - Full security scan
- `ship_check` - Ship readiness check
- `get_deploy_verdict` - Get deploy GO/NO-GO decision

## Resources

- `guardrails://rules` - Guardrails rules document
- `guardrails://templates` - Available templates
- `guardrails://design-tokens` - Design system tokens

## Documentation

See [MCP-PREMIUM-TOOLS.md](../docs/MCP-PREMIUM-TOOLS.md) for detailed tool documentation.

## Privacy & Trust

- Runs locally
- Artifacts saved to `.guardrail/`
- No upload unless you export/share

