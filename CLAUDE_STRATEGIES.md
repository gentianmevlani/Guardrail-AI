# CLAUDE_STRATEGIES.md
# Procedural Memory — Session Briefing
# Generated: 2026-03-30
# Sessions analyzed: 14 | Strategies: 1
# Identity: Mastery phase — consistently performing at high efficiency

## Pre-mortem: Predicted Risks

- **scope-creep** (95% likely, ~15 wasted steps): Touching more than 10 files or exceeding 25 tool calls
  Prevention: Before expanding scope, ask: "Is this necessary for the SPECIFIC task requested?"
- **overengineering** (92% likely, ~10 wasted steps): Creating 3+ new files for what should be a localized change
  Prevention: Before creating a new file, ask: "Can this be done by modifying an existing file?"
- **silent-regression** (92% likely, ~6 wasted steps): Editing multiple files without running the test suite
  Prevention: Run tests after every significant code change, not just at the end

## Self-Awareness Profile

> Your cognitive fingerprint across 14 sessions:

  Exploiter (direct path)      ░░░░░░█░░░░ Explorer (wide search)
  Bold (writes early)          ░░░░░░█░░░░ Cautious (reads first)
  Quick pivoter                ░░░░░░░░█░░ Persistent
  Deep (few files, many actions) ░░░░░░█░░░░ Broad (many files, few actions)
  Specialist (few tools)       ░░░░█░░░░░░ Generalist (many tools)
  Externally corrected         ░░░░░░░░█░░ Self-correcting
  Efficient (minimal path)     ░░░░░░█░░░░ Thorough (exhaustive)


**⚠ Blind spots (compensate actively):**
- Tendency to run Bash commands before reading relevant files — reading first usually provides better context

**Signature strengths (keep doing):**
- Clean execution: 43% of sessions resolve with zero backtracks and ≤10 tool calls

## Collaborator Awareness

- User is **learning** — explain context, link to docs, avoid jargon
- User has rejected: Using Read on /Users/liquidgroove/Desktop/Vibecheck/packages/shared-types/src/auth.ts; Using Glob on packages/shipgate/shipgate-dashboard/lib/api-auth.ts

## Active Behavioral Adaptations

> Changes derived from session reflections. Apply these proactively:

- **When:** About to interact with a file
  **Instead of:** Try one tool, then switch to another on the same file
  **Do:** Decide the right tool upfront: Read for understanding, Grep for searching, Edit for known changes

- **When:** Working on bug-fix in ui domain
  **Instead of:** Investigating /Users/liquidgroove/Downloads/Guardrail-Ofiicial-main/apps/web-ui/src/app/page.tsx, apps/web-ui/src/components/landing/**/*.tsx, /Users/liquidgroove/Downloads/Guardrail-Ofiicial-main/.vibecheck/truthpack/copy.json first
  **Do:** Check /Users/liquidgroove/Downloads/Guardrail-Ofiicial-main/apps/web-ui/src/components/landing/home-landing.tsx, /Users/liquidgroove/Downloads/Guardrail-Ofiicial-main/apps/web-ui/src/components/landing/sections/hero-section.tsx, /Users/liquidgroove/Downloads/Guardrail-Ofiicial-main/apps/web-ui/src/components/landing/sections/cta-section.tsx first — these are where resolutions typically occur

## Strategies

### Downloads/Guardrail-Ofiicial-main

**[95% ◆]** (40 sessions)
📋 Module checkpoint for Downloads/Guardrail-Ofiicial-main (based on 4 sessions):
When entering this module, preload context on:
  - Downloads/Guardrail-Ofiicial-main/packages/cli/src/commands/scan-consolidated.ts (touched in 100% of sessions)
  - Downloads/Guardrail-Ofiicial-main/package.json (touched in 100% of sessions)
  - Downloads/Guardrail-Ofiicial-main/packages/cli/src/commands/index.ts (touched in 75% of sessions)
  - Downloads/Guardrail-Ofiicial-main/apps/api/src/routes/v1/index.ts (touched in 50% of sessions)
  - Downloads/Guardrail-Ofiicial-main/packages/cli/src/commands/init.ts (touched in 50% of sessions)
