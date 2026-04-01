# CLAUDE_STRATEGIES.md
# Procedural Memory — Session Briefing
# Generated: 2026-03-31
# Sessions analyzed: 21 | Strategies: 3
# Identity: Mastery phase — consistently performing at high efficiency

## Pre-mortem: Predicted Risks

- **scope-creep** (68% likely, ~15 wasted steps): Touching more than 10 files or exceeding 25 tool calls
  Prevention: Before expanding scope, ask: "Is this necessary for the SPECIFIC task requested?"
- **overengineering** (41% likely, ~10 wasted steps): Creating 3+ new files for what should be a localized change
  Prevention: Before creating a new file, ask: "Can this be done by modifying an existing file?"
- **wrong-file-first** (74% likely, ~5 wasted steps): First file opened is not in the resolution path
  Prevention: Read error messages, stack traces, and test output to identify the RIGHT file before exploring

## Self-Awareness Profile

> Your cognitive fingerprint across 21 sessions:

  Exploiter (direct path)      ░░░░░░░█░░░ Explorer (wide search)
  Bold (writes early)          ░░░░░░█░░░░ Cautious (reads first)
  Quick pivoter                ░░░░░░░░░█░ Persistent
  Deep (few files, many actions) ░░░░░░░█░░░ Broad (many files, few actions)
  Specialist (few tools)       ░░░░░░█░░░░ Generalist (many tools)
  Externally corrected         ░░░░░░░░█░░ Self-correcting
  Efficient (minimal path)     ░░░░░░░█░░░ Thorough (exhaustive)


**Signature strengths (keep doing):**
- Clean execution: 29% of sessions resolve with zero backtracks and ≤10 tool calls

## Collaborator Awareness

- User prefers **detailed** responses — explain reasoning and alternatives
- User is **learning** — explain context, link to docs, avoid jargon
- User has rejected: Using Read on /Users/liquidgroove/Desktop/Vibecheck/packages/shared-types/src/auth.ts; Using Glob on packages/shipgate/shipgate-dashboard/lib/api-auth.ts

## Active Behavioral Adaptations

> Changes derived from session reflections. Apply these proactively:

- **When:** Working on multi-task in ui domain
  **Instead of:** Investigating /Users/liquidgroove/Downloads/Guardrail-Ofiicial-main/bin/runners/lib/unified-output.js, runLightweightScan, /Users/liquidgroove/Downloads/Guardrail-Ofiicial-main/bin/runners/lib/error-handler.js first
  **Do:** Check /Users/liquidgroove/Downloads/Guardrail-Ofiicial-main/bin/runners/runScan.js, /tmp/guardrail-cli-publish/package.json, /tmp/guardrail-cli-publish/README.md first — these are where resolutions typically occur

- **When:** About to interact with a file
  **Instead of:** Try one tool, then switch to another on the same file
  **Do:** Decide the right tool upfront: Read for understanding, Grep for searching, Edit for known changes

## Strategies

### packages/cli

**[95% ◆]** (75 sessions)
📋 Module checkpoint for packages/cli (based on 2 sessions):
When entering this module, preload context on:
  - Downloads/Guardrail-Ofiicial-main/packages/cli/package.json (touched in 100% of sessions)
  - Downloads/Guardrail-Ofiicial-main/packages/cli/src/ui/spinner.ts (touched in 50% of sessions)
  - Downloads/Guardrail-Ofiicial-main/packages/cli/src/ui/progress.ts (touched in 50% of sessions)
  - Downloads/Guardrail-Ofiicial-main/packages/cli/src/ui/summary.ts (touched in 50% of sessions)
  - Downloads/Guardrail-Ofiicial-main/packages/cli/src/ui/index.ts (touched in 50% of sessions)

### Downloads/Guardrail-Ofiicial-main

**[95% ◆]** (135 sessions)
📋 Module checkpoint for Downloads/Guardrail-Ofiicial-main (based on 4 sessions):
When entering this module, preload context on:
  - Downloads/Guardrail-Ofiicial-main/packages/cli/src/commands/scan-consolidated.ts (touched in 100% of sessions)
  - Downloads/Guardrail-Ofiicial-main/package.json (touched in 100% of sessions)
  - Downloads/Guardrail-Ofiicial-main/packages/cli/src/commands/index.ts (touched in 75% of sessions)
  - Downloads/Guardrail-Ofiicial-main/apps/api/src/routes/v1/index.ts (touched in 50% of sessions)
  - Downloads/Guardrail-Ofiicial-main/packages/cli/src/commands/init.ts (touched in 50% of sessions)

### packages/cli

**[95% ◆]** (60 sessions)
📋 Module checkpoint for packages/cli (based on 2 sessions):
When entering this module, preload context on:
  - Downloads/Guardrail-Ofiicial-main/packages/cli/package.json (touched in 100% of sessions)
  - Downloads/Guardrail-Ofiicial-main/packages/cli/src/ui/spinner.ts (touched in 50% of sessions)
  - Downloads/Guardrail-Ofiicial-main/packages/cli/src/ui/progress.ts (touched in 50% of sessions)
  - Downloads/Guardrail-Ofiicial-main/packages/cli/src/ui/summary.ts (touched in 50% of sessions)
  - Downloads/Guardrail-Ofiicial-main/packages/cli/src/ui/index.ts (touched in 50% of sessions)
