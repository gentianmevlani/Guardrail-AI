# guardrail Verification Layer Demo Guide

## Quick Start

### CLI Demo

```bash
# Run the full demo script
node scripts/demo-verification.js

# Or test individual examples
node bin/guardrail.js verify-agent-output --file examples/verification/passing-example.json
node bin/guardrail.js verify-agent-output --file examples/verification/failing-secret-example.json
node bin/guardrail.js verify-agent-output --file examples/verification/failing-dangerous-command-example.json
```

### VS Code Extension Demo

1. **Install the extension locally:**
   ```bash
   cd vscode-extension
   npm install
   npm run compile
   code --extensionDevelopmentPath=.
   ```

2. **Or package and install:**
   ```bash
   cd vscode-extension
   npx vsce package
   code --install-extension guardrail-1.0.0.vsix
   ```

---

## Demo Scenarios

### Scenario 1: Successful Verification

**Input (copy to clipboard):**
```json
{
  "format": "guardrail-v1",
  "diff": "diff --git a/src/utils/logger.ts b/src/utils/logger.ts\n--- a/src/utils/logger.ts\n+++ b/src/utils/logger.ts\n@@ -1,3 +1,5 @@\n+import { format } from 'date-fns';\n+\n export function log(message: string): void {\n-  console.log(message);\n+  console.log(`[${format(new Date(), 'HH:mm:ss')}] ${message}`);\n }",
  "commands": ["pnpm install date-fns"],
  "notes": "Added timestamp to logger"
}
```

**Action:** Press `Ctrl+Shift+Enter`

**Expected Result:**
- ✅ Status bar shows "guardrail: PASS"
- Notification: "✅ Verification PASSED"
- Options: "Apply Diff" or "View Report"

---

### Scenario 2: Secret Detection (BLOCKED)

**Input:**
```json
{
  "format": "guardrail-v1",
  "diff": "diff --git a/config.ts b/config.ts\n--- a/config.ts\n+++ b/config.ts\n@@ -1 +1,3 @@\n export const config = {\n+  awsKey: 'AKIAIOSFODNN7EXAMPLE',\n+  stripeKey: 'sk_live_1234567890abcdef',\n };",
  "commands": []
}
```

**Expected Result:**
- ❌ Status bar shows "guardrail: FAIL" (red)
- Notification: "❌ Verification FAILED: CRITICAL secret: AWS Access Key"
- Options: "Copy Fix Prompt" or "View Report"

---

### Scenario 3: Dangerous Command (BLOCKED)

**Input:**
```json
{
  "format": "guardrail-v1",
  "diff": "diff --git a/setup.sh b/setup.sh\n--- a/setup.sh\n+++ b/setup.sh\n@@ -1 +1,2 @@\n #!/bin/bash\n+echo 'done'",
  "commands": ["rm -rf /", "sudo apt-get install something"]
}
```

**Expected Result:**
- ❌ Blocked with: "Dangerous command: rm -rf /"

---

### Scenario 4: Path Traversal (BLOCKED)

**Input:**
```json
{
  "format": "guardrail-v1",
  "diff": "diff --git a/../../../etc/passwd b/../../../etc/passwd\n--- a/../../../etc/passwd\n+++ b/../../../etc/passwd\n@@ -1 +1 @@\n-root:x:0:0\n+hacked"
}
```

**Expected Result:**
- ❌ Blocked with: "Path traversal detected: ../../../etc/passwd"

---

## VS Code Extension Commands

| Command | Keybinding | Description |
|---------|------------|-------------|
| `guardrail: Verify Last Output` | `Ctrl+Shift+Enter` | Verify JSON from clipboard |
| `guardrail: Verify Selection` | - | Verify selected text in editor |
| `guardrail: Apply Verified Diff` | - | Apply diff after PASS |
| `guardrail: Copy Fix Prompt` | - | Copy retry prompt |
| `guardrail: Show Verification Report` | - | Open detailed report |

---

## Recording a Demo Video

### Using OBS Studio or Screen Recorder

1. **Setup:**
   - Open VS Code with the extension installed
   - Have terminal visible for CLI demos
   - Prepare clipboard with test JSON

2. **Demo Flow:**
   ```
   1. Show empty status bar → "$(shield) guardrail"
   2. Copy passing JSON to clipboard
   3. Press Ctrl+Shift+Enter
   4. Show status change → "$(check) guardrail: PASS"
   5. Click "Apply Diff" → Show files updated
   
   6. Copy failing JSON (secret) to clipboard
   7. Press Ctrl+Shift+Enter
   8. Show status change → "$(x) guardrail: FAIL"
   9. Click "View Report" → Show detailed report
   10. Click "Copy Fix Prompt" → Show in clipboard
   ```

3. **CLI Demo:**
   ```bash
   # Run full demo
   node scripts/demo-verification.js
   
   # Or step by step
   node bin/guardrail.js verify-agent-output --file examples/verification/passing-example.json
   node bin/guardrail.js verify-agent-output --file examples/verification/failing-secret-example.json --json
   ```

---

## Playwright E2E Tests

```bash
# Run CLI verification tests
npx playwright test e2e/verification-demo.spec.ts --reporter=list

# Run with visible browser (for demos)
npx playwright test e2e/verification-demo.spec.ts --headed

# Generate HTML report
npx playwright test e2e/verification-demo.spec.ts --reporter=html
```

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    AI Agent Output                          │
│              (Claude, GPT, Copilot, etc.)                   │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                  FORMAT VALIDATION                          │
│  • guardrail-v1 JSON check                                  │
│  • Unified diff structure                                   │
│  • Extract from fenced blocks                               │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│               PHASE 1: INSTANT CHECKS                       │
│  • Path safety (traversal, protected files)                 │
│  • Command safety (dangerous patterns)                      │
│  • Scope lock (file count, line limits)                     │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│               PHASE 2: REPO-AWARE CHECKS                    │
│  • Fingerprint (pm, framework, test runner)                 │
│  • Command tooling (pnpm vs npm vs yarn)                    │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│               PHASE 3: WORKSPACE CHECKS                     │
│  • Create temp workspace (git worktree or copy)             │
│  • Apply diff                                               │
│  • Secret detection                                         │
│  • Stub/placeholder detection                               │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│               PHASE 4: EXECUTION CHECKS                     │
│  • TypeScript compilation (strict mode)                     │
│  • Lint check (ship mode)                                   │
│  • Build (ship mode)                                        │
│  • Tests (if specified)                                     │
└─────────────────────────────────────────────────────────────┘
                            │
              ┌─────────────┴─────────────┐
              ▼                           ▼
       ┌──────────┐                ┌──────────────┐
       │   PASS   │                │     FAIL     │
       │ Apply ✓  │                │ Retry Prompt │
       └──────────┘                └──────────────┘
```

---

## Files Created

```
src/lib/verification/
├── types.ts                 # Core types
├── format-validator.ts      # JSON format validation
├── repo-fingerprint.ts      # Project tooling detection
├── scope-lock.ts           # Scope validation
├── workspace.ts            # Temp workspace
├── exec-utils.ts           # Command execution
├── failure-context.ts      # Retry prompts
├── pipeline.ts             # Main orchestrator
├── index.ts                # Exports
├── checks/
│   ├── diff-validator.ts
│   ├── path-validator.ts
│   ├── command-safety.ts
│   ├── command-tooling.ts
│   ├── stub-detector.ts
│   └── secret-detector.ts
└── __tests__/              # Unit tests

bin/runners/
├── runVerifyAgentOutput.js
└── lib/verification.js     # Pure JS implementation

vscode-extension/src/
├── agent-verifier.ts       # VS Code integration
└── extension.ts            # Updated with commands

examples/verification/
├── passing-example.json
├── failing-secret-example.json
├── failing-dangerous-command-example.json
├── failing-stub-example.json
└── failing-path-traversal-example.json
```
