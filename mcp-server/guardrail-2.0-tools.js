/**
 * guardrail 2.0 MCP Tools - Consolidated to 6 Tools
 *
 * Tools:
 *   checkpoint() - Pre/post write enforcement, block AI until fixed
 *   check()      - Verify code is real, wired, honest
 *   ship()       - Go/No-Go decision (GO / WARN / NO-GO)
 *   fix()        - Fix blocking issues safely
 *   status()     - Health + version info
 *   set_strictness() - Set checkpoint strictness level
 *
 * Server-side enforcement:
 *   - Fix-Only Mode: Rejects patches outside allowedFiles when blocked
 *   - Intent Lock: Prevents scope creep when enabled
 */

import { execSync } from "child_process";
import fs from "fs/promises";
import path from "path";

// Strictness levels for checkpoint
const STRICTNESS_LEVELS = ["chill", "standard", "strict", "paranoid"];

// Current strictness (in-memory, should be persisted per-project)
let currentStrictness = "standard";

// Blocked state tracking (in-memory, should be persisted)
const blockedState = new Map();

// ============================================================================
// TOOL DEFINITIONS - 6 TOOLS ONLY
// ============================================================================

const GUARDRAIL_2_TOOLS = [
  // 1. CHECKPOINT - Block AI agents until issues are fixed
  {
    name: "checkpoint",
    description: `🛡️ Block AI agents until issues are fixed. Call BEFORE and AFTER every code write.
    
Returns:
- PASS: Continue writing code
- BLOCKED: Stop and fix issues first. Response includes:
  - blockedFiles: Files with violations
  - violations: List of issues with ruleId, message, file, line
  - fixOnly: { allowedFiles, forbiddenActions } - Fix-Only Mode restrictions

If BLOCKED, you MUST:
1. Enter Fix-Only Mode
2. Only modify files in allowedFiles
3. Do NOT add features, refactors, or new files
4. Call checkpoint again after fixes`,
    inputSchema: {
      type: "object",
      properties: {
        file_path: {
          type: "string",
          description: "Path to file being written",
        },
        content: {
          type: "string",
          description: "Content to validate (for pre-write check)",
        },
        action: {
          type: "string",
          enum: ["pre_write", "post_write", "status"],
          description: "Checkpoint action type",
          default: "pre_write",
        },
        projectPath: {
          type: "string",
          default: ".",
        },
      },
      required: ["file_path"],
    },
  },

  // 2. CHECK - Verify code is real, wired, honest
  {
    name: "check",
    description: `🔍 Verify code is real, wired, and honest.

Consolidates: scan, validate, mockproof
Returns: PASS | WARN | FAIL with findings list

Use cases:
- Quick code verification
- Mock/placeholder detection (--mocks)
- Security scanning (--only=security)
- AI code validation (--validate)`,
    inputSchema: {
      type: "object",
      properties: {
        projectPath: {
          type: "string",
          default: ".",
        },
        mocks: {
          type: "boolean",
          description: "Focus on mock/placeholder detection",
          default: false,
        },
        validate: {
          type: "boolean",
          description: "Include AI code validation",
          default: false,
        },
        only: {
          type: "array",
          items: { type: "string" },
          description:
            "Run specific checks: secrets, auth, routes, mocks, hygiene, security",
        },
        json: {
          type: "boolean",
          description: "Return machine-readable JSON",
          default: true,
        },
      },
    },
  },

  // 3. SHIP - Go/No-Go decision
  {
    name: "ship",
    description: `🚀 Decide if this can ship. Returns GO | WARN | NO-GO.

Consolidates: ship, gate, realityproof, ai-test, badge, evidence
Flags:
- --ci: CI/CD hard fail mode
- --runtime: Runtime verification (Playwright)
- --badge: Generate ship badge
- --report: Generate full report
- --evidence: Enterprise audit evidence pack`,
    inputSchema: {
      type: "object",
      properties: {
        projectPath: {
          type: "string",
          default: ".",
        },
        ci: {
          type: "boolean",
          description: "CI mode - hard fail on issues",
          default: false,
        },
        runtime: {
          type: "boolean",
          description: "Run runtime verification",
          default: false,
        },
        url: {
          type: "string",
          description: "URL for runtime testing (required if runtime=true)",
        },
        badge: {
          type: "boolean",
          description: "Generate ship badge",
          default: false,
        },
        report: {
          type: "boolean",
          description: "Generate detailed report",
          default: true,
        },
        evidence: {
          type: "boolean",
          description: "Generate audit evidence pack (Enterprise)",
          default: false,
        },
      },
    },
  },

  // 4. FIX - Fix blocking issues safely
  {
    name: "fix",
    description: `🔧 Fix blocking issues safely.

Options:
- --plan: Show fix plan without applying (default)
- --apply: Apply the fixes
- --pr: Open a pull request with fixes

Respects Fix-Only Mode restrictions when checkpoint is BLOCKED.`,
    inputSchema: {
      type: "object",
      properties: {
        projectPath: {
          type: "string",
          default: ".",
        },
        plan: {
          type: "boolean",
          description: "Show fix plan without applying",
          default: true,
        },
        apply: {
          type: "boolean",
          description: "Apply fixes",
          default: false,
        },
        pr: {
          type: "boolean",
          description: "Open PR with fixes",
          default: false,
        },
        scope: {
          type: "string",
          enum: ["all", "secrets", "auth", "mocks", "routes"],
          default: "all",
        },
      },
    },
  },

  // 5. STATUS - Health + version info
  {
    name: "status",
    description: `📊 Get guardrail status - health, version, config, checkpoint state.

Returns:
- healthy: boolean
- version: string
- checkpoint: { strictness, blockedFiles, fixOnlyMode }
- lastRun: timestamp and results`,
    inputSchema: {
      type: "object",
      properties: {
        projectPath: {
          type: "string",
          default: ".",
        },
      },
    },
  },

  // 6. SET_STRICTNESS - Set checkpoint strictness level
  {
    name: "set_strictness",
    description: `⚙️ Set checkpoint strictness level.

Levels:
- chill: TODOs, FIXMEs, mock data, placeholders
- standard: + console.log, debugger, localhost URLs
- strict: + any types, @ts-ignore, eslint-disable
- paranoid: + nested ternaries, inline styles, JSDoc requirements`,
    inputSchema: {
      type: "object",
      properties: {
        level: {
          type: "string",
          enum: ["chill", "standard", "strict", "paranoid"],
          description: "Strictness level",
        },
        projectPath: {
          type: "string",
          default: ".",
        },
      },
      required: ["level"],
    },
  },
];

// ============================================================================
// CHECKPOINT RULES BY STRICTNESS
// ============================================================================

const CHECKPOINT_RULES = {
  chill: [
    {
      id: "no-todo",
      pattern: /\/\/\s*TODO[:\s].*$/gim,
      message: "TODO comment found",
      block: true,
    },
    {
      id: "no-fixme",
      pattern: /\/\/\s*FIXME[:\s].*$/gim,
      message: "FIXME comment found",
      block: true,
    },
    {
      id: "no-mock-data",
      pattern: /['"]mock['"]/gi,
      message: "Mock data reference",
      block: true,
    },
    {
      id: "no-placeholder",
      pattern: /placeholder|lorem ipsum/gi,
      message: "Placeholder content",
      block: true,
    },
  ],
  standard: [
    {
      id: "no-console-log",
      pattern: /console\.log\s*\(/g,
      message: "console.log found",
      block: true,
    },
    {
      id: "no-debugger",
      pattern: /\bdebugger\b/g,
      message: "debugger statement",
      block: true,
    },
    {
      id: "no-localhost",
      pattern: /localhost:\d+/g,
      message: "localhost URL",
      block: true,
    },
    {
      id: "no-empty-catch",
      pattern: /catch\s*\([^)]*\)\s*\{\s*\}/g,
      message: "Empty catch block",
      block: true,
    },
  ],
  strict: [
    {
      id: "no-any",
      pattern: /:\s*any\b/g,
      message: "any type used",
      block: true,
    },
    {
      id: "no-ts-ignore",
      pattern: /@ts-ignore/g,
      message: "@ts-ignore directive",
      block: true,
    },
    {
      id: "no-ts-nocheck",
      pattern: /@ts-nocheck/g,
      message: "@ts-nocheck directive",
      block: true,
    },
    {
      id: "no-eslint-disable",
      pattern: /eslint-disable/g,
      message: "eslint-disable directive",
      block: true,
    },
  ],
  paranoid: [
    {
      id: "no-nested-ternary",
      pattern: /\?[^:]+\?/g,
      message: "Nested ternary",
      block: true,
    },
    {
      id: "no-inline-style",
      pattern: /style\s*=\s*\{/g,
      message: "Inline style object",
      block: true,
    },
  ],
};

// ============================================================================
// TOOL HANDLERS
// ============================================================================

/**
 * Handle checkpoint tool - server-side enforcement
 */
async function handleCheckpoint(args, dirname) {
  const { file_path, content, action = "pre_write", projectPath = "." } = args;
  const fullPath = path.resolve(projectPath, file_path);

  // Get current blocked state for this project
  const projectKey = path.resolve(projectPath);
  const blocked = blockedState.get(projectKey) || { files: [], violations: [] };

  if (action === "status") {
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            {
              status: blocked.files.length > 0 ? "BLOCKED" : "PASS",
              strictness: currentStrictness,
              blockedFiles: blocked.files,
              violations: blocked.violations,
              fixOnly:
                blocked.files.length > 0
                  ? {
                      allowedFiles: blocked.files,
                      forbiddenActions: [
                        "add_file",
                        "add_feature",
                        "refactor",
                        "change_scope",
                      ],
                    }
                  : null,
            },
            null,
            2,
          ),
        },
      ],
    };
  }

  // Validate content against checkpoint rules
  const violations = [];
  const contentToCheck = content || "";

  // Get rules for current strictness and below
  const strictnessIndex = STRICTNESS_LEVELS.indexOf(currentStrictness);
  const applicableLevels = STRICTNESS_LEVELS.slice(0, strictnessIndex + 1);

  for (const level of applicableLevels) {
    const rules = CHECKPOINT_RULES[level] || [];
    for (const rule of rules) {
      const matches = contentToCheck.match(rule.pattern);
      if (matches) {
        for (const match of matches) {
          const lineNum = contentToCheck
            .substring(0, contentToCheck.indexOf(match))
            .split("\n").length;
          violations.push({
            ruleId: rule.id,
            message: rule.message,
            file: file_path,
            line: lineNum,
            match: match.substring(0, 50),
          });
        }
      }
    }
  }

  if (violations.length > 0) {
    // Update blocked state
    if (!blocked.files.includes(file_path)) {
      blocked.files.push(file_path);
    }
    blocked.violations = [...blocked.violations, ...violations];
    blockedState.set(projectKey, blocked);

    return {
      isError: true,
      content: [
        {
          type: "text",
          text: JSON.stringify(
            {
              status: "BLOCKED",
              message: `🛑 CHECKPOINT BLOCKED: ${violations.length} violation(s) found`,
              blockedFiles: blocked.files,
              violations: violations,
              fixOnly: {
                allowedFiles: blocked.files,
                forbiddenActions: [
                  "add_file",
                  "add_feature",
                  "refactor",
                  "change_scope",
                ],
              },
              instruction:
                "Enter Fix-Only Mode. Only modify files in allowedFiles. Do NOT add features or new files.",
            },
            null,
            2,
          ),
        },
      ],
    };
  }

  // Clear blocked state for this file if it was blocked
  if (blocked.files.includes(file_path)) {
    blocked.files = blocked.files.filter((f) => f !== file_path);
    blocked.violations = blocked.violations.filter((v) => v.file !== file_path);
    blockedState.set(projectKey, blocked);
  }

  return {
    content: [
      {
        type: "text",
        text: JSON.stringify(
          {
            status: "PASS",
            message: "✅ Checkpoint passed",
            blockedFiles: blocked.files,
          },
          null,
          2,
        ),
      },
    ],
  };
}

/**
 * Handle check tool - unified code verification
 */
async function handleCheck(args, dirname) {
  const { projectPath = ".", mocks, validate, only, json = true } = args;

  let output = "# 🔍 guardrail Check\n\n";

  try {
    let cmd = `node "${path.join(dirname, "..", "bin", "guardrail.js")}" check`;
    if (mocks) cmd += " --mocks";
    if (validate) cmd += " --validate";
    if (only?.length) cmd += ` --only=${only.join(",")}`;
    if (json) cmd += " --json";

    const result = execSync(cmd, {
      cwd: path.resolve(projectPath),
      encoding: "utf8",
      maxBuffer: 10 * 1024 * 1024,
    });

    if (json) {
      return { content: [{ type: "text", text: result }] };
    }

    output += result;
  } catch (err) {
    output += `⚠️ Check error: ${err.message}\n`;
  }

  return { content: [{ type: "text", text: output }] };
}

/**
 * Handle ship tool - Go/No-Go decision
 */
async function handleShip(args, dirname) {
  const { projectPath = ".", ci, runtime, url, badge, report, evidence } = args;

  let output = "# 🚀 guardrail Ship\n\n";

  try {
    let cmd = `node "${path.join(dirname, "..", "bin", "guardrail.js")}" ship`;
    if (ci) cmd += " --ci";
    if (runtime && url) cmd += ` --runtime --url="${url}"`;
    if (badge) cmd += " --badge";
    if (evidence) cmd += " --evidence";
    cmd += " --json";

    const result = execSync(cmd, {
      cwd: path.resolve(projectPath),
      encoding: "utf8",
      maxBuffer: 10 * 1024 * 1024,
    });

    return { content: [{ type: "text", text: result }] };
  } catch (err) {
    // Ship command exits non-zero for NO-GO
    output += `## 🚫 NO-GO\n\n`;
    output += `${err.message}\n`;
    output += `\nRun \`guardrail fix --plan\` to see fixes.\n`;
  }

  return { content: [{ type: "text", text: output }] };
}

/**
 * Handle fix tool
 */
async function handleFix(args, dirname) {
  const { projectPath = ".", plan = true, apply, pr, scope = "all" } = args;

  // Check Fix-Only Mode restrictions
  const projectKey = path.resolve(projectPath);
  const blocked = blockedState.get(projectKey);

  if (blocked?.files.length > 0) {
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            {
              fixOnlyMode: true,
              message:
                "⚠️ Fix-Only Mode active. Fixes restricted to blocked files.",
              allowedFiles: blocked.files,
              scope: scope,
            },
            null,
            2,
          ),
        },
      ],
    };
  }

  let output = "# 🔧 guardrail Fix\n\n";

  try {
    let cmd = `node "${path.join(dirname, "..", "bin", "guardrail.js")}" fix`;
    if (plan && !apply) cmd += " --plan";
    if (apply) cmd += " --apply";
    if (pr) cmd += " --pr";
    cmd += ` --scope=${scope}`;

    const result = execSync(cmd, {
      cwd: path.resolve(projectPath),
      encoding: "utf8",
      maxBuffer: 10 * 1024 * 1024,
    });

    output += result;
  } catch (err) {
    output += `⚠️ Fix error: ${err.message}\n`;
  }

  return { content: [{ type: "text", text: output }] };
}

/**
 * Handle status tool
 */
async function handleStatus(args, dirname) {
  const { projectPath = "." } = args;
  const projectKey = path.resolve(projectPath);
  const blocked = blockedState.get(projectKey) || { files: [], violations: [] };

  const status = {
    healthy: true,
    version: "2.0.0",
    checkpoint: {
      strictness: currentStrictness,
      blockedFiles: blocked.files,
      fixOnlyMode: blocked.files.length > 0,
      violations: blocked.violations.length,
    },
    lastRun: null,
  };

  // Try to read last run info
  try {
    const summaryPath = path.join(projectPath, ".guardrail", "summary.json");
    const summary = JSON.parse(await fs.readFile(summaryPath, "utf-8"));
    status.lastRun = {
      timestamp: summary.timestamp,
      score: summary.score,
      canShip: summary.canShip,
    };
  } catch {
    // No last run
  }

  return {
    content: [
      {
        type: "text",
        text: JSON.stringify(status, null, 2),
      },
    ],
  };
}

/**
 * Handle set_strictness tool
 */
function handleSetStrictness(args) {
  const { level, projectPath = "." } = args;

  if (!STRICTNESS_LEVELS.includes(level)) {
    return {
      isError: true,
      content: [
        {
          type: "text",
          text: `Invalid strictness level: ${level}. Valid: ${STRICTNESS_LEVELS.join(", ")}`,
        },
      ],
    };
  }

  const previousLevel = currentStrictness;
  currentStrictness = level;

  // Clear blocked state when changing strictness (they'll need to re-check)
  const projectKey = path.resolve(projectPath);
  blockedState.delete(projectKey);

  return {
    content: [
      {
        type: "text",
        text: JSON.stringify(
          {
            success: true,
            previousLevel,
            currentLevel: currentStrictness,
            message: `Strictness changed from ${previousLevel} to ${currentStrictness}. Blocked state cleared.`,
          },
          null,
          2,
        ),
      },
    ],
  };
}

/**
 * Route tool calls to handlers
 */
async function handleGuardrail2Tool(name, args, dirname) {
  switch (name) {
    case "checkpoint":
      return await handleCheckpoint(args, dirname);
    case "check":
      return await handleCheck(args, dirname);
    case "ship":
      return await handleShip(args, dirname);
    case "fix":
      return await handleFix(args, dirname);
    case "status":
      return await handleStatus(args, dirname);
    case "set_strictness":
      return handleSetStrictness(args);
    default:
      return {
        isError: true,
        content: [{ type: "text", text: `Unknown tool: ${name}` }],
      };
  }
}

export {
  GUARDRAIL_2_TOOLS,
  handleGuardrail2Tool,
  handleCheckpoint,
  handleCheck,
  handleShip,
  handleFix,
  handleStatus,
  handleSetStrictness,
  CHECKPOINT_RULES,
  STRICTNESS_LEVELS,
};
