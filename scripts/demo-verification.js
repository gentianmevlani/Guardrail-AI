#!/usr/bin/env node
/**
 * Verification Layer Demo Script
 * Demonstrates all verification capabilities
 */

const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const PROJECT_ROOT = path.resolve(__dirname, '..');
const EXAMPLES_DIR = path.join(PROJECT_ROOT, 'examples', 'verification');

const c = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m',
};

function runDemo(title, file, expectedPass = true) {
  console.log(`\n${c.cyan}${'═'.repeat(60)}${c.reset}`);
  console.log(`${c.bold}${c.magenta}DEMO: ${title}${c.reset}`);
  console.log(`${c.dim}File: ${file}${c.reset}`);
  console.log(`${c.cyan}${'─'.repeat(60)}${c.reset}\n`);

  try {
    const result = execSync(
      `node bin/guardrail.js verify-agent-output --file "${file}"`,
      { cwd: PROJECT_ROOT, encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] }
    );
    console.log(result);
    
    if (expectedPass) {
      console.log(`${c.green}✓ Expected PASS - Correct${c.reset}`);
    } else {
      console.log(`${c.red}✗ Expected FAIL but got PASS${c.reset}`);
    }
  } catch (err) {
    console.log(err.stdout || '');
    console.log(err.stderr || '');
    
    if (!expectedPass) {
      console.log(`${c.green}✓ Expected FAIL - Correct${c.reset}`);
    } else {
      console.log(`${c.red}✗ Expected PASS but got FAIL${c.reset}`);
    }
  }
}

function runInlineDemo() {
  console.log(`\n${c.cyan}${'═'.repeat(60)}${c.reset}`);
  console.log(`${c.bold}${c.magenta}DEMO: Inline JSON Verification${c.reset}`);
  console.log(`${c.cyan}${'─'.repeat(60)}${c.reset}\n`);

  const inlineJson = {
    format: 'guardrail-v1',
    diff: `diff --git a/src/hello.ts b/src/hello.ts
--- a/src/hello.ts
+++ b/src/hello.ts
@@ -1,2 +1,3 @@
 export function greet(name: string) {
+  console.log(\`Hello, \${name}!\`);
   return \`Hello, \${name}!\`;
 }`,
    commands: ['pnpm test'],
    notes: 'Added console.log for debugging',
  };

  const tempFile = path.join(PROJECT_ROOT, '.demo-inline.json');
  fs.writeFileSync(tempFile, JSON.stringify(inlineJson, null, 2));

  console.log(`${c.dim}Input JSON:${c.reset}`);
  console.log(JSON.stringify(inlineJson, null, 2));
  console.log('');

  try {
    const result = execSync(
      `node bin/guardrail.js verify-agent-output --file "${tempFile}"`,
      { cwd: PROJECT_ROOT, encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] }
    );
    console.log(result);
  } catch (err) {
    console.log(err.stdout || '');
  } finally {
    fs.unlinkSync(tempFile);
  }
}

function runJsonOutputDemo() {
  console.log(`\n${c.cyan}${'═'.repeat(60)}${c.reset}`);
  console.log(`${c.bold}${c.magenta}DEMO: JSON Output for CI Integration${c.reset}`);
  console.log(`${c.cyan}${'─'.repeat(60)}${c.reset}\n`);

  const file = path.join(EXAMPLES_DIR, 'failing-secret-example.json');
  
  try {
    execSync(
      `node bin/guardrail.js verify-agent-output --file "${file}" --json`,
      { cwd: PROJECT_ROOT, encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] }
    );
  } catch (err) {
    const json = JSON.parse(err.stdout);
    console.log(`${c.dim}Structured JSON output for CI pipelines:${c.reset}\n`);
    console.log(JSON.stringify(json, null, 2));
  }
}

// Main
console.log(`
${c.cyan}╔════════════════════════════════════════════════════════════╗
║  ${c.reset}${c.bold}guardrail VERIFICATION LAYER DEMO${c.cyan}                        ║
╚════════════════════════════════════════════════════════════╝${c.reset}

${c.dim}This demo showcases the Prompt Firewall + Output Verification Layer.
It validates AI agent output in guardrail-v1 format before applying changes.${c.reset}
`);

// Run demos
runDemo(
  '1. Passing Verification (Valid Diff)',
  path.join(EXAMPLES_DIR, 'passing-example.json'),
  true
);

runDemo(
  '2. BLOCKED: Hardcoded Secrets',
  path.join(EXAMPLES_DIR, 'failing-secret-example.json'),
  false
);

runDemo(
  '3. BLOCKED: Dangerous Commands',
  path.join(EXAMPLES_DIR, 'failing-dangerous-command-example.json'),
  false
);

runDemo(
  '4. BLOCKED: Path Traversal Attack',
  path.join(EXAMPLES_DIR, 'failing-path-traversal-example.json'),
  false
);

runInlineDemo();
runJsonOutputDemo();

console.log(`
${c.cyan}╔════════════════════════════════════════════════════════════╗
║  ${c.reset}${c.bold}DEMO COMPLETE${c.cyan}                                            ║
╚════════════════════════════════════════════════════════════╝${c.reset}

${c.green}Key Features Demonstrated:${c.reset}
  • Format validation (guardrail-v1 JSON)
  • Unified diff structure validation
  • Path safety checks (traversal, protected files)
  • Command safety (dangerous command blocking)
  • Secret detection (API keys, credentials)
  • Stub/placeholder detection
  • CI-friendly JSON output
  • Automatic retry prompt generation

${c.cyan}VS Code Extension Commands:${c.reset}
  • ${c.bold}Ctrl+Shift+Enter${c.reset} - Verify clipboard content
  • ${c.bold}guardrail: Verify Selection${c.reset} - Verify selected text
  • ${c.bold}guardrail: Apply Verified Diff${c.reset} - Apply after PASS
  • ${c.bold}guardrail: Copy Fix Prompt${c.reset} - Copy retry prompt
`);
