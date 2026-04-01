/**
 * Agent Guardrails - MCP Server Integration
 *
 * This MCP tool intercepts file writes from AI agents and validates
 * them against checkpoint rules BEFORE the write happens.
 *
 * When an agent (Cursor, Windsurf, etc.) tries to write code,
 * this tool validates it first and blocks if violations found.
 */

import fs from "fs";
import path from "path";

// Strictness level rules
const STRICTNESS_LEVELS = ["chill", "standard", "strict", "paranoid"];

// Built-in checkpoint rules
const CHECKPOINT_RULES = {
  chill: [
    {
      id: "no-todo",
      pattern: /\/\/\s*TODO[:\s].*$/gim,
      message: "TODO comment - complete before moving on",
      block: true,
    },
    {
      id: "no-fixme",
      pattern: /\/\/\s*FIXME[:\s].*$/gim,
      message: "FIXME comment - fix it now",
      block: true,
    },
    {
      id: "no-mock-data",
      pattern:
        /(?:const|let|var)\s+(?:mock|fake|dummy|sample)(?:Data|Users?|Items?)\s*=/gi,
      message: "Mock data detected",
      block: true,
    },
    {
      id: "no-placeholder",
      pattern: /['"`](?:TODO|PLACEHOLDER|REPLACE_ME|CHANGEME|XXX)['"`]/gi,
      message: "Placeholder string",
      block: true,
    },
    {
      id: "no-lorem",
      pattern: /lorem\s+ipsum/gi,
      message: "Lorem ipsum placeholder",
      block: true,
    },
  ],
  standard: [
    {
      id: "no-console-log",
      pattern: /console\.log\s*\(/g,
      message: "console.log - remove or use proper logging",
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
      pattern: /['"`]https?:\/\/localhost[:\d]*[^'"`]*['"`]/g,
      message: "Hardcoded localhost",
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
      message: "any type - use proper TypeScript type",
      block: true,
    },
    {
      id: "no-ts-ignore",
      pattern: /@ts-ignore/g,
      message: "@ts-ignore - fix the type error",
      block: true,
    },
    {
      id: "no-eslint-disable",
      pattern: /eslint-disable/g,
      message: "ESLint disabled - fix the lint error",
      block: true,
    },
  ],
  paranoid: [
    {
      id: "no-nested-ternary",
      pattern: /\?[^:]+\?[^:]+:/g,
      message: "Nested ternary - use if/else",
      block: true,
    },
    {
      id: "no-inline-styles",
      pattern: /style\s*=\s*\{\s*\{/g,
      message: "Inline styles - use CSS",
      block: false,
    },
  ],
};

// Current state
let currentStrictness = "standard";
let blockedFiles = new Map();
let stats = { checked: 0, blocked: 0, passed: 0 };

/**
 * Get all rules for a strictness level (includes all lower levels)
 */
function getRulesForLevel(level) {
  const levelIndex = STRICTNESS_LEVELS.indexOf(level);
  let rules = [];

  for (let i = 0; i <= levelIndex; i++) {
    const levelRules = CHECKPOINT_RULES[STRICTNESS_LEVELS[i]] || [];
    rules = [...rules, ...levelRules];
  }

  return rules;
}

/**
 * Validate content against checkpoint rules
 */
function validateContent(filePath, content) {
  const rules = getRulesForLevel(currentStrictness);
  const violations = [];
  const lines = content.split("\n");

  for (const rule of rules) {
    rule.pattern.lastIndex = 0;
    let match;

    while ((match = rule.pattern.exec(content)) !== null) {
      const beforeMatch = content.substring(0, match.index);
      const lineNumber = beforeMatch.split("\n").length;
      const line = lines[lineNumber - 1] || "";

      // Check for ignore directive
      if (line.includes("@guardrail-ignore")) continue;

      violations.push({
        rule: rule.id,
        message: rule.message,
        line: lineNumber,
        code: line.trim(),
        block: rule.block,
      });

      if (match[0].length === 0) break;
    }
  }

  return violations;
}

/**
 * Format violations for output
 */
function formatViolations(filePath, violations) {
  const blockers = violations.filter((v) => v.block);

  if (blockers.length === 0) {
    return { blocked: false, message: "✅ Checkpoint passed" };
  }

  let output = "\n🛑 CHECKPOINT BLOCKED\n";
  output += "═".repeat(50) + "\n";
  output += `File: ${filePath}\n\n`;

  for (const v of blockers) {
    output += `  ❌ Line ${v.line}: ${v.message}\n`;
    output += `     ${v.code}\n\n`;
  }

  output += "═".repeat(50) + "\n";
  output += "Fix these issues before proceeding.\n";

  return { blocked: true, message: output };
}

/**
 * MCP Tool Definitions for Agent Guardrails
 */
const AGENT_CHECKPOINT_TOOLS = [
  {
    name: "guardrail_checkpoint",
    description: `🛡️ AGENT CHECKPOINT - Validates code before writing. 
    
IMPORTANT: Call this tool BEFORE writing any code to check for:
- TODOs, FIXMEs that must be completed
- Mock/placeholder data that must be replaced  
- console.log/debugger statements
- Type errors (any, @ts-ignore)

If this returns blocked=true, you MUST fix the issues before proceeding.
Do NOT skip this checkpoint.`,
    inputSchema: {
      type: "object",
      properties: {
        file_path: {
          type: "string",
          description: "Path to the file being written",
        },
        content: {
          type: "string",
          description: "The content to validate",
        },
        strictness: {
          type: "string",
          enum: ["chill", "standard", "strict", "paranoid"],
          description: "Validation strictness level (default: standard)",
        },
      },
      required: ["file_path", "content"],
    },
  },
  {
    name: "guardrail_set_strictness",
    description: `Set the checkpoint strictness level:
- chill: TODOs, FIXMEs, mock data, placeholders
- standard: + console.log, debugger, localhost URLs
- strict: + any types, @ts-ignore, eslint-disable  
- paranoid: + nested ternaries, inline styles`,
    inputSchema: {
      type: "object",
      properties: {
        level: {
          type: "string",
          enum: ["chill", "standard", "strict", "paranoid"],
          description: "The strictness level",
        },
      },
      required: ["level"],
    },
  },
  {
    name: "guardrail_checkpoint_status",
    description: "Get current checkpoint status and any blocking violations",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },
];

/**
 * Handle MCP tool calls
 */
async function handleCheckpointTool(name, args) {
  switch (name) {
    case "guardrail_checkpoint": {
      const { file_path, content, strictness } = args;

      if (strictness) {
        currentStrictness = strictness;
      }

      stats.checked++;
      const violations = validateContent(file_path, content);
      const result = formatViolations(file_path, violations);

      if (result.blocked) {
        stats.blocked++;
        blockedFiles.set(file_path, violations);

        return {
          content: [
            {
              type: "text",
              text: result.message,
            },
          ],
          isError: true, // Signal to agent this is a blocker
        };
      }

      stats.passed++;
      blockedFiles.delete(file_path);

      return {
        content: [
          {
            type: "text",
            text: `✅ Checkpoint PASSED for ${file_path}\n\nYou may proceed with writing this file.`,
          },
        ],
      };
    }

    case "guardrail_set_strictness": {
      const { level } = args;
      currentStrictness = level;

      return {
        content: [
          {
            type: "text",
            text: `🛡️ Checkpoint strictness set to: ${level.toUpperCase()}\n\nActive rules:\n${getRulesForLevel(
              level,
            )
              .map((r) => `- ${r.id}: ${r.message}`)
              .join("\n")}`,
          },
        ],
      };
    }

    case "guardrail_checkpoint_status": {
      const blockedList = Array.from(blockedFiles.entries());

      let status = `🛡️ Agent Guardrails Status\n`;
      status += `═══════════════════════════\n`;
      status += `Strictness: ${currentStrictness.toUpperCase()}\n`;
      status += `Files checked: ${stats.checked}\n`;
      status += `Passed: ${stats.passed}\n`;
      status += `Blocked: ${stats.blocked}\n\n`;

      if (blockedList.length > 0) {
        status += `⚠️ Currently blocked files:\n`;
        for (const [file, violations] of blockedList) {
          status += `\n📄 ${file}\n`;
          for (const v of violations.filter((v) => v.block)) {
            status += `   Line ${v.line}: ${v.message}\n`;
          }
        }
      } else {
        status += `✅ No blocked files - all clear!\n`;
      }

      return {
        content: [{ type: "text", text: status }],
      };
    }

    default:
      return {
        content: [{ type: "text", text: `Unknown tool: ${name}` }],
        isError: true,
      };
  }
}

export {
  AGENT_CHECKPOINT_TOOLS,
  handleCheckpointTool,
  validateContent,
  formatViolations,
  getRulesForLevel,
  CHECKPOINT_RULES,
  STRICTNESS_LEVELS,
};
