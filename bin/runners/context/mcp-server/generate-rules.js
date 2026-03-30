/**
 * Generate thin rules files that point to MCP tools
 * These are the "policy layer" - short files that tell agents what tools to call
 */

const fs = require("fs");
const path = require("path");

/**
 * Generate Cursor MCP config
 */
function generateCursorMCPConfig(projectPath) {
  return {
    mcpServers: {
      "guardrail-context": {
        command: "node",
        args: [path.join(projectPath, ".guardrail", "mcp-server", "index.js"), "serve"],
        env: {}
      }
    }
  };
}

/**
 * Generate thin Cursor rules that point to MCP tools
 */
function generateCursorMCPRules(projectPath, analysis) {
  const projectName = path.basename(projectPath);
  
  return `---
description: Context Engine Integration - USE THESE TOOLS BEFORE MAKING CHANGES
globs: ["**/*"]
alwaysApply: true
---

# 🔧 Context Engine Tools (MCP)

> This project has a Context Engine. ALWAYS use these tools before making changes.

## MANDATORY WORKFLOW

### Before Planning ANY Change:
\`\`\`
1. Call repo_map() → understand architecture
2. Call risk_blast_radius(files) → assess impact
\`\`\`

### Before Using ANY Symbol:
\`\`\`
Call symbols_exists(name) → verify it exists
If returns { exists: false } → DO NOT USE IT
\`\`\`

### Before Using ANY Package:
\`\`\`
Call versions_allowed(package) → verify installed
If returns { allowed: false } → DO NOT SUGGEST IT
\`\`\`

### Before Claiming ANY Route Exists:
\`\`\`
Call routes_exists(method, path) → verify it exists
If returns { exists: false } → DO NOT INVENT IT
\`\`\`

### When Creating New Code:
\`\`\`
Call patterns_get(type) → get verified pattern
Available: api-route, component, hook
\`\`\`

### Before Touching Auth:
\`\`\`
Call security_auth_flow() → understand auth system
Follow existing patterns exactly
\`\`\`

### After Making Changes:
\`\`\`
Call tests_required(files) → know what to test
Call verify_changes(changes) → final check
\`\`\`

## Project Identity

- **Name**: ${projectName}
- **Framework**: ${analysis?.framework || "Unknown"}
- **Language**: ${analysis?.language || "Unknown"}

## HARD RULES

1. ❌ **NEVER** invent symbols without calling \`symbols_exists\`
2. ❌ **NEVER** suggest packages without calling \`versions_allowed\`
3. ❌ **NEVER** claim routes exist without calling \`routes_exists\`
4. ❌ **NEVER** touch auth without calling \`security_auth_flow\`
5. ✅ **ALWAYS** call \`repo_map\` before planning changes
6. ✅ **ALWAYS** call \`patterns_get\` when creating new code

## If Tools Return "Not Found"

When a tool says something doesn't exist:
- Do NOT proceed as if it does
- Do NOT invent alternatives
- ASK the user for clarification or guidance

---
*Powered by guardrail Context Engine*
`;
}

/**
 * Generate thin Windsurf rules
 */
function generateWindsurfMCPRules(projectPath, analysis) {
  const projectName = path.basename(projectPath);
  
  return `---
trigger: always
description: Context Engine Integration for ${projectName}
---

# Context Engine Integration

This project uses the guardrail Context Engine. Query it before making changes.

## Project Info
- Framework: ${analysis?.framework || "Unknown"}
- Language: ${analysis?.language || "Unknown"}
- State: ${analysis?.antiHallucination?.stateManagement || "N/A"}

## Available Tools (via MCP)

| Tool | Use When |
|------|----------|
| \`repo_map()\` | Starting any task |
| \`symbols_exists(name)\` | Before using any function/component |
| \`versions_allowed(pkg)\` | Before suggesting packages |
| \`routes_exists(method, path)\` | Before claiming API exists |
| \`patterns_get(type)\` | When creating new code |
| \`security_auth_flow()\` | Before touching auth |
| \`tests_required(files)\` | After making changes |
| \`risk_blast_radius(files)\` | Before risky changes |

## Mandatory Checks

1. **Before planning**: Call \`repo_map()\`
2. **Before using symbols**: Call \`symbols_exists()\`
3. **Before packages**: Call \`versions_allowed()\`
4. **Before auth changes**: Call \`security_auth_flow()\`

## If Tool Says "Not Found"

- Do NOT proceed as if it exists
- Do NOT invent alternatives  
- ASK user for guidance
`;
}

/**
 * Generate thin Copilot instructions
 */
function generateCopilotMCPInstructions(projectPath, analysis) {
  const projectName = path.basename(projectPath);
  
  return `# ${projectName} - AI Context Instructions

## Project Stack
- Framework: ${analysis?.framework || "Unknown"}
- Language: ${analysis?.language || "Unknown"}
- ORM: ${analysis?.antiHallucination?.ormType || "N/A"}
- UI: ${analysis?.antiHallucination?.uiLibrary?.name || "N/A"}
- State: ${analysis?.antiHallucination?.stateManagement || "N/A"}

## Context Engine Available

This project has a Context Engine with verified facts. Query the \`.guardrail/truth-pack.json\` for:

- **Symbols**: All exported functions, components, hooks
- **Routes**: All API endpoints with file:line proof
- **Versions**: All installed packages with exact versions
- **Patterns**: Verified code patterns to follow
- **Security**: Auth files, middleware, protected routes

## Mandatory Rules

### DO NOT:
- Invent functions that aren't in the symbol index
- Suggest packages not in package.json
- Claim routes exist without proof
- Bypass auth patterns

### ALWAYS:
- Check truth-pack.json before claiming something exists
- Follow existing patterns from the codebase
- Verify package versions before suggesting APIs
- Reference file:line when citing code

## Verification

Before suggesting code:
1. Verify symbols exist in truth-pack.json
2. Verify packages are installed
3. Check patterns for correct style
4. Assess blast radius for risky files

---
*Generated by guardrail Context Engine*
`;
}

/**
 * Generate Claude project context with MCP config
 */
function generateClaudeMCPContext(projectPath, analysis) {
  const projectName = path.basename(projectPath);
  
  return `# ${projectName} - Project Context

## Stack
- **Framework**: ${analysis?.framework || "Unknown"}
- **Language**: ${analysis?.language || "Unknown"}
- **Database**: ${analysis?.antiHallucination?.ormType || "N/A"}
- **UI Library**: ${analysis?.antiHallucination?.uiLibrary?.name || "N/A"}
- **State Management**: ${analysis?.antiHallucination?.stateManagement || "N/A"}

## Context Engine

This project has a guardrail Context Engine at \`.guardrail/\`.

### Truth Pack Location
\`\`\`
.guardrail/truth-pack.json
\`\`\`

Contains verified:
- Symbol index (what exists)
- Route map (API endpoints)
- Version truth (installed packages)
- Security map (auth flow)
- Golden patterns (verified code)
- Risk map (critical files)

## MCP Tools

If MCP is configured, use these tools:

| Tool | Purpose |
|------|---------|
| repo_map | Get architecture overview |
| symbols_exists | Verify symbol exists |
| versions_allowed | Verify package installed |
| routes_exists | Verify route exists |
| patterns_get | Get verified pattern |
| security_auth_flow | Get auth info |
| tests_required | Get test requirements |
| risk_blast_radius | Assess change risk |

## Rules

1. **Verify before using** - Check truth-pack before claiming things exist
2. **Follow patterns** - Use golden patterns for new code
3. **Respect versions** - Only use installed package APIs
4. **Check risk** - Assess blast radius for critical files
`;
}

/**
 * Copy MCP server to project
 */
function copyMCPServerToProject(projectPath) {
  const guardrailDir = path.join(projectPath, ".guardrail", "mcp-server");
  
  if (!fs.existsSync(guardrailDir)) {
    fs.mkdirSync(guardrailDir, { recursive: true });
  }

  // Copy the MCP server
  const serverSource = path.join(__dirname, "index.js");
  const serverDest = path.join(guardrailDir, "index.js");
  
  if (fs.existsSync(serverSource)) {
    fs.copyFileSync(serverSource, serverDest);
  }

  // Create package.json
  const pkgContent = {
    name: "guardrail-context-engine",
    version: "1.0.0",
    main: "index.js",
    scripts: {
      "index": "node index.js index --path=../..",
      "serve": "node index.js serve --http --path=../..",
      "serve:mcp": "node index.js serve --path=../.."
    }
  };
  
  fs.writeFileSync(
    path.join(guardrailDir, "package.json"),
    JSON.stringify(pkgContent, null, 2)
  );

  return guardrailDir;
}

/**
 * Generate all MCP-related files
 */
function generateMCPFiles(projectPath, analysis) {
  const files = {};

  // Cursor MCP config
  files[".cursor/mcp.json"] = JSON.stringify(generateCursorMCPConfig(projectPath), null, 2);
  
  // Cursor thin rules
  files[".cursor/rules/context-engine.mdc"] = generateCursorMCPRules(projectPath, analysis);
  
  // Windsurf thin rules
  files[".windsurf/rules/context-engine.md"] = generateWindsurfMCPRules(projectPath, analysis);
  
  // Copilot instructions
  files[".github/copilot-context.md"] = generateCopilotMCPInstructions(projectPath, analysis);
  
  // Claude context
  files[".claude/project-context.md"] = generateClaudeMCPContext(projectPath, analysis);

  return files;
}

module.exports = {
  generateCursorMCPConfig,
  generateCursorMCPRules,
  generateWindsurfMCPRules,
  generateCopilotMCPInstructions,
  generateClaudeMCPContext,
  copyMCPServerToProject,
  generateMCPFiles,
};
