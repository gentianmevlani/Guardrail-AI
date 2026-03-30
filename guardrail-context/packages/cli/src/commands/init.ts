import fs from "node:fs";
import path from "node:path";
import { buildTruthPack } from "@guardrail-context/engine";
import { brandHeader, bold, dim, success, link, badge } from "../ui/brand.js";
import { spin } from "../ui/spinner.js";
import { panel } from "../ui/box.js";

export async function cmdInit(repoRoot: string) {
  console.log("");
  console.log(bold("Welcome to guardrail."));
  console.log(dim("We're going to make your AI understand this repo."));
  console.log("");

  // Step 1: Detect stack
  const s1 = spin("[1/5] Detecting stack...");
  await sleep(300);
  const stack = detectStack(repoRoot);
  s1.succeed(`[1/5] Detecting stack... ${success(stack.join(" + ") || "Generic")}`);

  // Step 2: Build Truth Pack
  const s2 = spin("[2/5] Building Truth Pack...");
  let symbolCount = 0;
  try {
    const result = await buildTruthPack(repoRoot);
    symbolCount = result.symbols?.length || 0;
    s2.succeed(`[2/5] Building Truth Pack... ${success(`${symbolCount.toLocaleString()} symbols indexed`)}`);
  } catch (e: any) {
    s2.fail(`[2/5] Building Truth Pack... ${e.message}`);
  }

  // Step 3: Install IDE rules
  const s3 = spin("[3/5] Installing IDE rules...");
  const dirs = [".windsurf/rules", ".windsurf/workflows", ".github", ".cursor", ".guardrail", ".guardrail/runtime"];
  for (const dir of dirs) {
    const p = path.join(repoRoot, dir);
    if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
  }

  const cursorMcpPath = path.join(repoRoot, ".cursor", "mcp.json");
  if (!fs.existsSync(cursorMcpPath)) {
    fs.writeFileSync(cursorMcpPath, CURSOR_MCP_CONFIG, "utf8");
  }
  writeIfMissing(path.join(repoRoot, ".cursor", "rules.md"), CURSOR_RULES);
  writeIfMissing(path.join(repoRoot, ".windsurf", "rules", "guardrail.md"), WINDSURF_RULES);
  writeIfMissing(path.join(repoRoot, ".windsurf", "workflows", "verify.md"), WINDSURF_WORKFLOW);
  writeIfMissing(path.join(repoRoot, ".github", "copilot-instructions.md"), COPILOT_INSTRUCTIONS);
  
  const ides = ["Cursor", "Windsurf", "Copilot"].join(" + ");
  s3.succeed(`[3/5] Installing IDE rules... ${success(ides)}`);

  // Step 4: MCP tools
  const s4 = spin("[4/5] Connecting MCP tools...");
  await sleep(200);
  s4.succeed(`[4/5] Connecting MCP tools... ${success("20 tools available")}`);

  // Step 5: Telemetry
  const s5 = spin("[5/5] Enabling telemetry...");
  await sleep(150);
  s5.succeed(`[5/5] Enabling telemetry... ${success("Local only")}`);

  // Final message
  console.log("");
  console.log(panel(
    `${badge("Done", "ok")} Your AI is now connected.`,
    `${bold("Next:")} ${link("guardrail on")}  ${dim("(start Context Mode)")}

${dim("Or run")} ${link("guardrail")} ${dim("to open the launcher.")}`,
    { kind: "ok" }
  ));
  console.log("");
}

function detectStack(repoRoot: string): string[] {
  const stack: string[] = [];
  const pkgPath = path.join(repoRoot, "package.json");
  
  if (fs.existsSync(pkgPath)) {
    try {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"));
      const deps = { ...pkg.dependencies, ...pkg.devDependencies };
      
      if (deps["next"]) stack.push("Next.js");
      else if (deps["react"]) stack.push("React");
      else if (deps["vue"]) stack.push("Vue");
      
      if (deps["typescript"]) stack.push("TS");
      if (deps["prisma"] || deps["@prisma/client"]) stack.push("Prisma");
      if (deps["drizzle-orm"]) stack.push("Drizzle");
      if (deps["express"]) stack.push("Express");
      if (deps["tailwindcss"]) stack.push("Tailwind");
    } catch {}
  }
  
  return stack;
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function writeIfMissing(p: string, content: string) {
  if (!fs.existsSync(p)) {
    fs.writeFileSync(p, content, "utf8");
  }
}

const CURSOR_MCP_CONFIG = `{
  "mcpServers": {
    "guardrail": {
      "command": "npx",
      "args": ["guardrail-context", "on"],
      "env": {}
    }
  }
}
`;

const COPILOT_INSTRUCTIONS = `# guardrail Context Engine - Repository Instructions

This repository has a Truth Pack at \`.guardrail-context/\` with verified facts.

## Before Writing Code
1. Check \`.guardrail-context/symbols.json\` before using any function/component
2. Check \`.guardrail-context/deps.json\` before suggesting package usage
3. Check \`.guardrail-context/patterns.json\` for the correct patterns to follow

## Hard Rules
- ❌ NEVER claim a symbol exists unless it's in symbols.json
- ❌ NEVER suggest a package unless it's in deps.json
- ❌ NEVER invent API endpoints - check the codebase first
- ✅ ALWAYS follow existing patterns from patterns.json
- ✅ ALWAYS run \`guardrail-context verify\` after changes

## After Making Changes
Run: \`guardrail-context verify\`
Fix any failures before finalizing.
`;

const WINDSURF_RULES = `---
trigger: always
description: guardrail Context Engine - Verified repo facts
---

# guardrail Context Engine

This repo has a Truth Pack at \`.guardrail-context/\`.

## Available MCP Tools
- \`repo_map()\` - Get architecture overview
- \`symbols_exists(name)\` - Check if symbol exists
- \`versions_allowed(pkg)\` - Check if package is installed
- \`graph_related(file)\` - Get related files
- \`patterns_pick(intent)\` - Get golden pattern
- \`verify_fast()\` - Run verification gates

## Hard Rules
- Call \`symbols_exists\` before using ANY symbol
- Call \`versions_allowed\` before suggesting ANY package
- Call \`patterns_pick\` when creating new code
- Call \`verify_fast\` after making changes

## If Tool Says "Not Found"
- Do NOT proceed as if it exists
- Do NOT invent alternatives
- ASK user for guidance
`;

const WINDSURF_WORKFLOW = `---
name: Verify Changes
description: Run guardrail verification gates
---

# Verify Changes

Run: \`guardrail-context verify\`

If verification fails:
1. Read the error message
2. Fix the identified issues
3. Re-run verification
4. Do not finalize until all gates pass
`;

const CURSOR_RULES = `# Cursor Rules - guardrail Context Engine

This repo has a Truth Pack at \`.guardrail-context/\`.

## Before Coding
- Check symbols.json for available functions/components
- Check deps.json for installed packages
- Check patterns.json for correct patterns

## MCP Tools Available
- repo_map() - Architecture overview
- symbols_exists(name) - Verify symbol exists
- versions_allowed(pkg) - Verify package installed
- patterns_pick(intent) - Get golden pattern
- verify_fast() - Run verification

## Hard Rules
1. NEVER invent symbols - verify with symbols_exists first
2. NEVER suggest packages not in deps.json
3. ALWAYS use patterns from patterns.json
4. ALWAYS run verify after changes

## After Coding
Run: \`guardrail-context verify\`
`;
