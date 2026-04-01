#!/usr/bin/env node

/**
 * guardrail MCP Server v2.0 - Clean Product Surface
 *
 * 6 Public Tools (maps to CLI):
 *   guardrail.scan   - Find truth
 *   guardrail.gate   - Enforce truth in CI
 *   guardrail.fix    - Apply safe patches
 *   guardrail.proof  - Premium verification (mocks, reality)
 *   guardrail.report - Access artifacts
 *   guardrail.status - Health and config info
 *
 * Everything else is parameters on these tools.
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import { execSync, execFileSync } from "child_process";
import { getEffectiveTier } from "./tier-resolve.js";
import { applyFreeTierRedaction } from "./mcp-redact.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const VERSION = "2.1.0";

// Import intelligence tools
import {
  INTELLIGENCE_TOOLS,
  handleIntelligenceTool,
} from "./intelligence-tools.js";

// Import AI guardrail tools
import {
  GUARDRAIL_TOOLS,
  handleGuardrailTool,
} from "./guardrail-tools.js";

// Import agent checkpoint tools
import {
  AGENT_CHECKPOINT_TOOLS,
  handleCheckpointTool,
} from "./agent-checkpoint.js";

// Import architect tools
import {
  ARCHITECT_TOOLS,
  handleArchitectTool,
} from "./architect-tools.js";

// Import codebase architect tools
import {
  CODEBASE_ARCHITECT_TOOLS,
  handleCodebaseArchitectTool,
} from "./codebase-architect-tools.js";

// Import guardrail 2.0 tools
import {
  GUARDRAIL_2_TOOLS,
  handleGuardrail2Tool,
} from "./guardrail-2.0-tools.js";

// Import intent drift tools
import {
  intentDriftTools,
} from "./intent-drift-tools.js";

// Import audit trail for MCP
import { emitToolInvoke, emitToolComplete } from "./audit-mcp.js";

// Import MDC generator
import { mdcGeneratorTool, handleMDCGeneration } from "./mdc-generator.js";

// Import context injection (AI Feedback Loop)
import {
  CONTEXT_INJECTION_RESOURCES,
  handleContextInjectionResource,
  INJECT_TOOL,
  handleInjectTool,
} from "./context-injection.js";

// ============================================================================
// TOOL DEFINITIONS - Public Tools (Clean Product Surface)
// ============================================================================

const TOOLS = [
  ...INTELLIGENCE_TOOLS, // Add all intelligence suite tools
  ...GUARDRAIL_TOOLS,    // Add AI guardrail tools (verify, quality, smells, etc.)
  ...AGENT_CHECKPOINT_TOOLS, // Add agent checkpoint tools
  ...ARCHITECT_TOOLS,    // Add architect review/suggest tools
  ...CODEBASE_ARCHITECT_TOOLS, // Add codebase-aware architect tools
  ...GUARDRAIL_2_TOOLS,  // Add guardrail 2.0 consolidated tools
  ...intentDriftTools,   // Add intent drift guard tools
  mdcGeneratorTool,      // Add MDC generator tool
  INJECT_TOOL,           // Add context injection tool (AI Feedback Loop)
  // 1. SHIP - Quick health check (vibe coder friendly)
  {
    name: "guardrail.ship",
    description:
      "🚀 Quick health check — 'Is my app ready?' Plain English, traffic light score",
    inputSchema: {
      type: "object",
      properties: {
        projectPath: {
          type: "string",
          description: "Path to project root",
          default: ".",
        },
        fix: {
          type: "boolean",
          description: "Auto-fix problems where possible",
          default: false,
        },
      },
    },
  },

  // 2. SCAN - Deep technical analysis
  {
    name: "guardrail.scan",
    description:
      "🔍 Deep scan — technical analysis of secrets, auth, mocks, routes (detailed output)",
    inputSchema: {
      type: "object",
      properties: {
        projectPath: {
          type: "string",
          description: "Path to project root",
          default: ".",
        },
        profile: {
          type: "string",
          enum: ["quick", "full", "ship", "ci", "security", "compliance", "ai"],
          description:
            "Check profile: quick, full, ship, ci, security, compliance, ai",
          default: "quick",
        },
        only: {
          type: "array",
          items: { type: "string" },
          description:
            "Run only specific checks: integrity, security, hygiene, contracts, auth, routes, mocks, compliance, ai",
        },
        format: {
          type: "string",
          enum: ["text", "json", "html", "sarif"],
          description: "Output format",
          default: "text",
        },
      },
    },
  },

  // 3. REALITY - Browser testing
  {
    name: "guardrail.reality",
    description:
      "🧪 Browser testing — clicks buttons, fills forms, finds broken UI with Playwright",
    inputSchema: {
      type: "object",
      properties: {
        url: {
          type: "string",
          description: "Target URL to test (required)",
        },
        auth: {
          type: "string",
          description: "Auth credentials (email:password)",
        },
        flows: {
          type: "array",
          items: { type: "string" },
          description: "Flow packs to test: auth, ui, forms, ecommerce",
        },
        headed: {
          type: "boolean",
          description: "Run browser in visible mode",
          default: false,
        },
      },
      required: ["url"],
    },
  },

  // 4. AI-TEST - AI Agent testing
  {
    name: "guardrailai.dev-test",
    description:
      "🤖 AI Agent — autonomous testing that explores your app and generates fix prompts",
    inputSchema: {
      type: "object",
      properties: {
        url: {
          type: "string",
          description: "Target URL to test (required)",
        },
        goal: {
          type: "string",
          description: "Natural language goal for the AI agent",
          default: "Test all features and find issues",
        },
        headed: {
          type: "boolean",
          description: "Run browser in visible mode",
          default: false,
        },
      },
      required: ["url"],
    },
  },

  // 2. GATE - Enforce truth in CI
  {
    name: "guardrail.gate",
    description: "🚦 Enforce truth in CI — fail builds on policy violations",
    inputSchema: {
      type: "object",
      properties: {
        projectPath: {
          type: "string",
          default: ".",
        },
        policy: {
          type: "string",
          enum: ["default", "strict", "ci"],
          description: "Policy strictness level",
          default: "strict",
        },
        sarif: {
          type: "boolean",
          description: "Generate SARIF for GitHub Code Scanning",
          default: true,
        },
      },
    },
  },

  // 3. FIX - Apply safe patches
  {
    name: "guardrail.fix",
    description: "🔧 Apply safe patches — preview plan then apply fixes",
    inputSchema: {
      type: "object",
      properties: {
        projectPath: {
          type: "string",
          default: ".",
        },
        plan: {
          type: "boolean",
          description: "Show fix plan without applying (dry run)",
          default: true,
        },
        apply: {
          type: "boolean",
          description: "Apply fixes from plan",
          default: false,
        },
        scope: {
          type: "string",
          enum: ["all", "secrets", "auth", "mocks", "routes"],
          description: "Fix scope",
          default: "all",
        },
        risk: {
          type: "string",
          enum: ["safe", "moderate", "aggressive"],
          description: "Risk tolerance for auto-fixes",
          default: "safe",
        },
      },
    },
  },

  // 4. PROOF - Premium verification
  {
    name: "guardrail.proof",
    description:
      "🎬 Premium verification — mocks (static) or reality (runtime with Playwright)",
    inputSchema: {
      type: "object",
      properties: {
        projectPath: {
          type: "string",
          default: ".",
        },
        mode: {
          type: "string",
          enum: ["mocks", "reality"],
          description:
            "Proof mode: mocks (import graph + fake domains) or reality (Playwright runtime)",
        },
        url: {
          type: "string",
          description: "Base URL for reality mode",
          default: "http://localhost:3000",
        },
        flow: {
          type: "string",
          enum: ["auth", "checkout", "dashboard"],
          description: "Flow to test in reality mode",
          default: "auth",
        },
      },
      required: ["mode"],
    },
  },

  // 5. REPORT - Access artifacts
  {
    name: "guardrail.validate",
    description:
      "🤖 Validate AI-generated code. Checks for hallucinations, intent mismatch, and quality issues.",
    inputSchema: {
      type: "object",
      properties: {
        code: { type: "string", description: "The code content to validate" },
        intent: {
          type: "string",
          description: "The user's original request/intent",
        },
        projectPath: { type: "string", default: "." },
      },
      required: ["code"],
    },
  },
  {
    name: "guardrail.report",
    description:
      "📄 Access scan artifacts — summary, full report, SARIF export",
    inputSchema: {
      type: "object",
      properties: {
        projectPath: {
          type: "string",
          default: ".",
        },
        type: {
          type: "string",
          enum: ["summary", "full", "sarif", "html"],
          description: "Report type to retrieve",
          default: "summary",
        },
        runId: {
          type: "string",
          description: "Specific run ID (defaults to last run)",
        },
      },
    },
  },

  // 6. STATUS - Health and config
  {
    name: "guardrail.status",
    description: "📊 Server status — health, versions, config, last run info",
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

  // 7. AUTOPILOT - Continuous protection
  {
    name: "guardrail.autopilot",
    description:
      "🤖 Autopilot — continuous protection with weekly reports, auto-PRs, deploy blocking",
    inputSchema: {
      type: "object",
      properties: {
        projectPath: {
          type: "string",
          default: ".",
        },
        action: {
          type: "string",
          enum: ["status", "enable", "disable", "digest"],
          description: "Autopilot action",
          default: "status",
        },
        slack: {
          type: "string",
          description: "Slack webhook URL for notifications",
        },
        email: {
          type: "string",
          description: "Email for weekly digest",
        },
      },
    },
  },

  // 8. AUTOPILOT PLAN - Generate fix plan (Pro/Compliance)
  {
    name: "guardrail.autopilot_plan",
    description:
      "🤖 Autopilot Plan — scan codebase, group issues into fix packs, estimate risk (Pro/Compliance)",
    inputSchema: {
      type: "object",
      properties: {
        projectPath: {
          type: "string",
          default: ".",
        },
        profile: {
          type: "string",
          enum: ["quick", "full", "ship", "ci"],
          description: "Scan profile",
          default: "ship",
        },
        maxFixes: {
          type: "number",
          description: "Max fixes per category",
          default: 10,
        },
      },
    },
  },

  // 9. AUTOPILOT APPLY - Apply fixes (Pro/Compliance)
  {
    name: "guardrail.autopilot_apply",
    description:
      "🔧 Autopilot Apply — apply fix packs with verification, re-scan to confirm (Pro/Compliance)",
    inputSchema: {
      type: "object",
      properties: {
        projectPath: {
          type: "string",
          default: ".",
        },
        profile: {
          type: "string",
          enum: ["quick", "full", "ship", "ci"],
          description: "Scan profile",
          default: "ship",
        },
        maxFixes: {
          type: "number",
          description: "Max fixes per category",
          default: 10,
        },
        verify: {
          type: "boolean",
          description: "Run verification after apply",
          default: true,
        },
        dryRun: {
          type: "boolean",
          description: "Preview changes without applying",
          default: false,
        },
      },
    },
  },

  // 10. BADGE - Generate ship badge
  {
    name: "guardrail.badge",
    description:
      "🏅 Ship Badge — generate a badge for README/PR showing scan status",
    inputSchema: {
      type: "object",
      properties: {
        projectPath: {
          type: "string",
          default: ".",
        },
        format: {
          type: "string",
          enum: ["svg", "md", "html"],
          description: "Badge format",
          default: "svg",
        },
        style: {
          type: "string",
          enum: ["flat", "flat-square"],
          description: "Badge style",
          default: "flat",
        },
      },
    },
  },

  // 9. CONTEXT - AI Rules Generator
  {
    name: "guardrail.context",
    description:
      "🧠 AI Context — generate rules files for Cursor, Windsurf, Copilot to understand your codebase",
    inputSchema: {
      type: "object",
      properties: {
        projectPath: {
          type: "string",
          description: "Path to project root",
          default: ".",
        },
        platform: {
          type: "string",
          enum: ["all", "cursor", "windsurf", "copilot", "claude"],
          description: "Target platform (default: all)",
          default: "all",
        },
      },
    },
  },

  // Vibe coder — shipping readiness + templates (CLI-backed)
  {
    name: "guardrail.vibe_check",
    description:
      "🎯 Vibe Check — filesystem analysis for missing auth, error handling, UX; score + recommendations (same as guardrail vibe-check --json)",
    inputSchema: {
      type: "object",
      properties: {
        projectPath: {
          type: "string",
          description: "Path to project root",
          default: ".",
        },
        strict: {
          type: "boolean",
          description: "Fail when score is below threshold (exit 1 in CLI)",
          default: false,
        },
      },
    },
  },
  {
    name: "guardrail.list_templates",
    description:
      "📋 List Templates — available apply-template ids (error-boundary, loading-state, middleware, etc.)",
    inputSchema: {
      type: "object",
      properties: {
        projectPath: {
          type: "string",
          description: "Path to project root (cwd for CLI)",
          default: ".",
        },
      },
    },
  },
  {
    name: "guardrail.apply_template",
    description:
      "📦 Apply Template — copy guardrail template files into the project (components, middleware, pages)",
    inputSchema: {
      type: "object",
      properties: {
        projectPath: {
          type: "string",
          description: "Path to project root",
          default: ".",
        },
        template: {
          type: "string",
          description:
            "Template id from guardrail.list_templates (e.g. error-boundary, auth-middleware)",
        },
        dryRun: {
          type: "boolean",
          description: "Preview only; do not write files",
          default: false,
        },
        overwrite: {
          type: "boolean",
          description: "Overwrite existing files",
          default: false,
        },
      },
      required: ["template"],
    },
  },
];

// ============================================================================
// SERVER IMPLEMENTATION
// ============================================================================

class GuardrailMCP {
  constructor() {
    this.server = new Server(
      { name: "guardrail", version: VERSION },
      { capabilities: { tools: {}, resources: {} } },
    );
    this.setupHandlers();
  }

  setupHandlers() {
    // List tools
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: TOOLS,
    }));

    // Call tool
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;
      const projectPath = path.resolve(args?.projectPath || ".");
      const startTime = Date.now();

      // Emit audit event for tool invocation start
      emitToolInvoke(name, args, "success", { projectPath });

      try {
        // Handle intelligence tools first
        if (name.startsWith("guardrail.intelligence.")) {
          return await handleIntelligenceTool(name, args, __dirname);
        }

        // Handle AI guardrail tools (verify, quality, smells, hallucination, breaking, mdc, coverage)
        if (["guardrail.verify", "guardrail.quality", "guardrail.smells", 
             "guardrail.hallucination", "guardrail.breaking", "guardrail.mdc", 
             "guardrail.coverage", "guardrail.autofix"].includes(name)) {
          const result = await handleGuardrailTool(name, args);
          const tier = getEffectiveTier();
          const redacted = applyFreeTierRedaction(result, tier);
          return {
            content: [{ type: "text", text: JSON.stringify(redacted, null, 2) }],
          };
        }

        // Handle agent checkpoint tools
        if (["guardrail_checkpoint", "guardrail_set_strictness", "guardrail_checkpoint_status"].includes(name)) {
          return await handleCheckpointTool(name, args);
        }

        // Handle architect tools
        if (["guardrail_architect_review", "guardrail_architect_suggest", 
             "guardrail_architect_patterns", "guardrail_architect_set_strictness"].includes(name)) {
          return await handleArchitectTool(name, args);
        }

        // Handle codebase architect tools
        if (["guardrail_architect_context", "guardrail_architect_guide",
             "guardrail_architect_validate", "guardrail_architect_patterns",
             "guardrail_architect_dependencies"].includes(name)) {
          return await handleCodebaseArchitectTool(name, args);
        }

        // Handle guardrail 2.0 tools
        if (["checkpoint", "check", "ship", "fix", "status", "set_strictness"].includes(name)) {
          return await handleGuardrail2Tool(name, args, __dirname);
        }

        // Handle intent drift tools
        if (name.startsWith("guardrail_intent_")) {
          const tool = intentDriftTools.find(t => t.name === name);
          if (tool && tool.handler) {
            const result = await tool.handler(args);
            const tier = getEffectiveTier();
            const redacted = applyFreeTierRedaction(result, tier);
            return {
              content: [{ type: "text", text: JSON.stringify(redacted, null, 2) }],
            };
          }
        }

        switch (name) {
          case "guardrail.ship":
            return await this.handleShip(projectPath, args);
          case "guardrail.scan":
            return await this.handleScan(projectPath, args);
          case "guardrail.reality":
            return await this.handleReality(projectPath, args);
          case "guardrailai.dev-test":
            return await this.handleAITest(projectPath, args);
          case "guardrail.gate":
            return await this.handleGate(projectPath, args);
          case "guardrail.fix":
            return await this.handleFix(projectPath, args);
          case "guardrail.proof":
            return await this.handleProof(projectPath, args);
          case "guardrail.validate":
            return await this.handleValidate(projectPath, args);
          case "guardrail.report":
            return await this.handleReport(projectPath, args);
          case "guardrail.status":
            return await this.handleStatus(projectPath, args);
          case "guardrail.autopilot":
            return await this.handleAutopilot(projectPath, args);
          case "guardrail.autopilot_plan":
            return await this.handleAutopilotPlan(projectPath, args);
          case "guardrail.autopilot_apply":
            return await this.handleAutopilotApply(projectPath, args);
          case "guardrail.badge":
            return await this.handleBadge(projectPath, args);
          case "guardrail.context":
            return await this.handleContext(projectPath, args);
          case "guardrail.vibe_check":
            return await this.handleVibeCheck(projectPath, args);
          case "guardrail.list_templates":
            return await this.handleListTemplates(projectPath, args);
          case "guardrail.apply_template":
            return await this.handleApplyTemplate(projectPath, args);
          case "guardrail.inject":
            return await handleInjectTool(args);
          case "generate_mdc":
            return await handleMDCGeneration(args);
          default:
            return this.error(`Unknown tool: ${name}`);
        }
      } catch (err) {
        // Emit audit event for tool error
        emitToolComplete(name, "error", { 
          errorMessage: err.message,
          durationMs: Date.now() - startTime 
        });
        return this.error(`${name} failed: ${err.message}`);
      }
    });

    // Resources
    this.server.setRequestHandler(ListResourcesRequestSchema, async () => ({
      resources: [
        {
          uri: "guardrail://config",
          name: "guardrail Config",
          mimeType: "application/json",
        },
        {
          uri: "guardrail://summary",
          name: "Last Scan Summary",
          mimeType: "application/json",
        },
        // Truthpack resources (AI Feedback Loop)
        ...CONTEXT_INJECTION_RESOURCES,
      ],
    }));

    this.server.setRequestHandler(
      ReadResourceRequestSchema,
      async (request) => {
        const { uri } = request.params;
        const projectPath = process.cwd();

        if (uri === "guardrail://config") {
          const configPath = path.join(projectPath, "guardrail.config.json");
          try {
            const content = await fs.readFile(configPath, "utf-8");
            return {
              contents: [{ uri, mimeType: "application/json", text: content }],
            };
          } catch {
            return {
              contents: [{ uri, mimeType: "application/json", text: "{}" }],
            };
          }
        }

        if (uri === "guardrail://summary") {
          const summaryPath = path.join(
            projectPath,
            ".guardrail",
            "summary.json",
          );
          try {
            const content = await fs.readFile(summaryPath, "utf-8");
            return {
              contents: [{ uri, mimeType: "application/json", text: content }],
            };
          } catch {
            return {
              contents: [
                {
                  uri,
                  mimeType: "application/json",
                  text: '{"message": "No scan found. Run guardrail.scan first."}',
                },
              ],
            };
          }
        }

        // Truthpack resources (AI Feedback Loop)
        if (uri.startsWith("guardrail://truthpack/")) {
          return await handleContextInjectionResource(uri, projectPath);
        }

        return { contents: [] };
      },
    );
  }

  // Helpers
  success(text) {
    return { content: [{ type: "text", text }] };
  }

  error(text) {
    return { content: [{ type: "text", text: `❌ ${text}` }], isError: true };
  }

  // ============================================================================
  // SCAN
  // ============================================================================
  async handleScan(projectPath, args) {
    const profile = args?.profile || "quick";
    const format = args?.format || "text";
    const only = args?.only;

    let output = "# 🔍 guardrail Scan\n\n";
    output += `**Profile:** ${profile}\n`;
    output += `**Path:** ${projectPath}\n\n`;

    try {
      // Build CLI command
      let cmd = `node "${path.join(__dirname, "..", "bin", "guardrail.js")}" scan`;
      cmd += ` --profile=${profile}`;
      if (only?.length) cmd += ` --only=${only.join(",")}`;
      cmd += ` --json`;

      const result = execSync(cmd, {
        cwd: projectPath,
        encoding: "utf8",
        maxBuffer: 10 * 1024 * 1024,
      });

      // Read summary
      const summaryPath = path.join(projectPath, ".guardrail", "summary.json");
      const summary = JSON.parse(await fs.readFile(summaryPath, "utf-8"));

      output += `## Score: ${summary.score}/100 (${summary.grade})\n\n`;
      output += `**Verdict:** ${summary.canShip ? "✅ SHIP" : "🚫 NO-SHIP"}\n\n`;

      if (summary.counts) {
        output += "### Checks\n\n";
        output += "| Category | Issues |\n|----------|--------|\n";
        for (const [key, count] of Object.entries(summary.counts)) {
          const icon = count === 0 ? "✅" : "⚠️";
          output += `| ${icon} ${key} | ${count} |\n`;
        }
      }

      output += `\n📄 **Report:** .guardrail/report.html\n`;
    } catch (err) {
      output += `\n⚠️ Scan error: ${err.message}\n`;
    }

    if (getEffectiveTier() === "free") {
      output +=
        "\n> **Free plan:** Same as CLI — detailed findings are redacted; you still see score and severity counts. Upgrade: https://guardrailai.dev/billing\n";
    }

    output += "\n---\n_Context Enhanced by guardrail AI_\n";
    return this.success(output);
  }

  // ============================================================================
  // GATE
  // ============================================================================
  async handleGate(projectPath, args) {
    const policy = args?.policy || "strict";

    let output = "# 🚦 guardrail Gate\n\n";
    output += `**Policy:** ${policy}\n\n`;

    try {
      let cmd = `node "${path.join(__dirname, "..", "bin", "guardrail.js")}" gate`;
      cmd += ` --policy=${policy}`;
      if (args?.sarif) cmd += ` --sarif`;

      execSync(cmd, {
        cwd: projectPath,
        encoding: "utf8",
        maxBuffer: 10 * 1024 * 1024,
      });

      output += "## ✅ GATE PASSED\n\n";
      output += "All checks passed. Clear to merge.\n";
    } catch (err) {
      output += "## 🚫 GATE FAILED\n\n";
      output += "Build blocked. Fix the issues and re-run.\n\n";
      output += `Run \`guardrail fix --plan\` to see recommended fixes.\n`;
    }

    return this.success(output);
  }

  // ============================================================================
  // FIX
  // ============================================================================
  async handleFix(projectPath, args) {
    const planOnly = args?.plan !== false && !args?.apply;

    let output = "# 🔧 guardrail Fix\n\n";
    output += `**Mode:** ${planOnly ? "Plan (dry run)" : "Apply"}\n`;
    output += `**Scope:** ${args?.scope || "all"}\n\n`;

    try {
      let cmd = `node "${path.join(__dirname, "..", "bin", "guardrail.js")}" fix`;
      if (planOnly) cmd += ` --plan`;
      if (args?.apply) cmd += ` --apply`;
      if (args?.scope) cmd += ` --scope=${args.scope}`;
      if (args?.risk) cmd += ` --risk=${args.risk}`;

      const result = execSync(cmd, {
        cwd: projectPath,
        encoding: "utf8",
        maxBuffer: 10 * 1024 * 1024,
      });

      output += result;
    } catch (err) {
      output += `\n⚠️ Fix error: ${err.message}\n`;
    }

    return this.success(output);
  }

  // ============================================================================
  // PROOF
  // ============================================================================
  async handleProof(projectPath, args) {
    const mode = args?.mode;

    if (!mode) {
      return this.error("Mode required: 'mocks' or 'reality'");
    }

    let output = `# 🎬 guardrail Proof: ${mode.toUpperCase()}\n\n`;

    try {
      let cmd = `node "${path.join(__dirname, "..", "bin", "guardrail.js")}" proof ${mode}`;
      if (mode === "reality" && args?.url) cmd += ` --url=${args.url}`;
      if (mode === "reality" && args?.flow) cmd += ` --flow=${args.flow}`;

      const result = execSync(cmd, {
        cwd: projectPath,
        encoding: "utf8",
        maxBuffer: 10 * 1024 * 1024,
        timeout: 120000, // 2 min timeout for reality mode
      });

      output += result;
    } catch (err) {
      if (mode === "mocks") {
        output += "## 🚫 MOCKPROOF: FAIL\n\n";
        output += "Mock/demo code detected in production paths.\n";
      } else {
        output += "## 🚫 REALITY MODE: FAIL\n\n";
        output += "Fake data or mock services detected at runtime.\n";
      }
      output += `\n${err.stdout || err.message}\n`;
    }

    return this.success(output);
  }

  // ============================================================================
  // VALIDATE
  // ============================================================================
  async handleValidate(projectPath, args) {
    const { code, intent } = args;
    if (!code) return this.error("Code is required");

    let output = "# 🤖 AI Code Validation\n\n";
    if (intent) output += `**Intent:** ${intent}\n\n`;

    try {
      const {
        runHallucinationCheck,
        validateIntent,
        validateQuality,
      } = require(
        path.join(__dirname, "..", "bin", "runners", "lib", "ai-bridge.js"),
      );

      // 1. Hallucinations (checking against project deps + internal logic)
      // Note: In MCP context, we might want to check the provided code specifically for imports.
      // The bridge's runHallucinationCheck mostly checks package.json.
      // But we can check imports in the 'code' snippet if we extract them.
      // The bridge handles extractImports internally but runHallucinationCheck doesn't expose it directly for a string input.
      // We will rely on package.json sanity check for now + static analysis of the snippet.

      const hallResult = await runHallucinationCheck(projectPath);

      // 2. Intent
      let intentResult = { score: 100, issues: [] };
      if (intent) {
        intentResult = validateIntent(code, intent);
      }

      // 3. Quality
      const qualityResult = validateQuality(code);

      const allIssues = [
        ...hallResult.issues,
        ...intentResult.issues,
        ...qualityResult.issues,
      ];

      const score = Math.round(
        (hallResult.score + intentResult.score + qualityResult.score) / 3,
      );
      const status = score >= 80 ? "✅ PASSED" : "⚠️ ISSUES FOUND";

      output += `**Status:** ${status} (${score}/100)\n\n`;

      if (allIssues.length > 0) {
        output += "### Issues\n";
        for (const issue of allIssues) {
          const icon =
            issue.severity === "critical"
              ? "🔴"
              : issue.severity === "high"
                ? "🟠"
                : "🟡";
          output += `- ${icon} **[${issue.type}]** ${issue.message}\n`;
        }
      } else {
        output += "✨ Code looks valid and safe.\n";
      }

      return this.success(output);
    } catch (err) {
      return this.error(`Validation failed: ${err.message}`);
    }
  }

  // ============================================================================
  // REPORT
  // ============================================================================
  async handleReport(projectPath, args) {
    const type = args?.type || "summary";
    const outputDir = path.join(projectPath, ".guardrail");

    let output = "# 📄 guardrail Report\n\n";

    try {
      if (type === "summary") {
        const summaryPath = path.join(outputDir, "summary.json");
        const summary = JSON.parse(await fs.readFile(summaryPath, "utf-8"));

        output += `**Score:** ${summary.score}/100 (${summary.grade})\n`;
        output += `**Verdict:** ${summary.canShip ? "✅ SHIP" : "🚫 NO-SHIP"}\n`;
        output += `**Generated:** ${summary.timestamp}\n`;
      } else if (type === "full") {
        const reportPath = path.join(outputDir, "summary.md");
        output += await fs.readFile(reportPath, "utf-8");
      } else if (type === "sarif") {
        const sarifPath = path.join(outputDir, "results.sarif");
        const sarif = await fs.readFile(sarifPath, "utf-8");
        output += "```json\n" + sarif.substring(0, 2000) + "\n```\n";
        output += `\n📄 **Full SARIF:** ${sarifPath}\n`;
      } else if (type === "html") {
        output += `📄 **HTML Report:** ${path.join(outputDir, "report.html")}\n`;
        output += "Open in browser to view the full report.\n";
      }
    } catch (err) {
      output += `⚠️ No ${type} report found. Run \`guardrail.scan\` first.\n`;
    }

    return this.success(output);
  }

  // ============================================================================
  // SHIP - Quick health check
  // ============================================================================
  async handleShip(projectPath, args) {
    let output = "# 🚀 guardrail Ship\n\n";
    output += `**Path:** ${projectPath}\n\n`;

    try {
      let cmd = `node "${path.join(__dirname, "..", "bin", "guardrail.js")}" ship`;
      if (args?.fix) cmd += ` --fix`;

      const result = execSync(cmd, {
        cwd: projectPath,
        encoding: "utf8",
        maxBuffer: 10 * 1024 * 1024,
        env: { ...process.env, GUARDRAIL_SKIP_AUTH: "1" },
      });

      // Parse the output for key information
      output += result.replace(/\x1b\[[0-9;]*m/g, ""); // Strip ANSI codes
    } catch (err) {
      output += `\n⚠️ Ship check failed: ${err.message}\n`;
    }

    output += "\n---\n_Context Enhanced by guardrail AI_\n";
    return this.success(output);
  }

  // ============================================================================
  // REALITY - Browser testing
  // ============================================================================
  async handleReality(projectPath, args) {
    const url = args?.url;
    if (!url) return this.error("URL is required");

    let output = "# 🧪 guardrail Reality Mode\n\n";
    output += `**URL:** ${url}\n\n`;

    try {
      let cmd = `node "${path.join(__dirname, "..", "bin", "guardrail.js")}" reality --url "${url}"`;
      if (args?.auth) cmd += ` --auth "${args.auth}"`;
      if (args?.flows?.length) cmd += ` --flows ${args.flows.join(",")}`;
      if (args?.headed) cmd += ` --headed`;

      const result = execSync(cmd, {
        cwd: projectPath,
        encoding: "utf8",
        maxBuffer: 10 * 1024 * 1024,
        timeout: 120000,
        env: { ...process.env, GUARDRAIL_SKIP_AUTH: "1" },
      });

      output += result.replace(/\x1b\[[0-9;]*m/g, "");
    } catch (err) {
      output += `\n⚠️ Reality mode failed: ${err.message}\n`;
    }

    output += "\n---\n_Context Enhanced by guardrail AI_\n";
    return this.success(output);
  }

  // ============================================================================
  // AI-TEST - AI Agent testing
  // ============================================================================
  async handleAITest(projectPath, args) {
    const url = args?.url;
    if (!url) return this.error("URL is required");

    let output = "# 🤖 guardrail AI Agent\n\n";
    output += `**URL:** ${url}\n`;
    output += `**Goal:** ${args?.goal || "Test all features"}\n\n`;

    try {
      let cmd = `node "${path.join(__dirname, "..", "bin", "guardrail.js")}" ai-test --url "${url}"`;
      if (args?.goal) cmd += ` --goal "${args.goal}"`;
      if (args?.headed) cmd += ` --headed`;

      const result = execSync(cmd, {
        cwd: projectPath,
        encoding: "utf8",
        maxBuffer: 10 * 1024 * 1024,
        timeout: 180000,
        env: { ...process.env, GUARDRAIL_SKIP_AUTH: "1" },
      });

      output += result.replace(/\x1b\[[0-9;]*m/g, "");

      // Try to read fix prompts
      const promptPath = path.join(
        projectPath,
        ".guardrail",
        "ai-agent",
        "fix-prompt.md",
      );
      try {
        const prompts = await fs.readFile(promptPath, "utf-8");
        output += "\n## Fix Prompts Generated\n\n";
        output += prompts.substring(0, 2000);
        if (prompts.length > 2000) output += "\n\n... (truncated)";
      } catch {}
    } catch (err) {
      output += `\n⚠️ AI Agent failed: ${err.message}\n`;
    }

    output += "\n---\n_Context Enhanced by guardrail AI_\n";
    return this.success(output);
  }

  // ============================================================================
  // AUTOPILOT - Continuous protection
  // ============================================================================
  async handleAutopilot(projectPath, args) {
    const action = args?.action || "status";

    let output = "# 🤖 guardrail Autopilot\n\n";
    output += `**Action:** ${action}\n\n`;

    try {
      let cmd = `node "${path.join(__dirname, "..", "bin", "guardrail.js")}" autopilot ${action}`;
      if (args?.slack) cmd += ` --slack="${args.slack}"`;
      if (args?.email) cmd += ` --email="${args.email}"`;

      const result = execSync(cmd, {
        cwd: projectPath,
        encoding: "utf8",
        maxBuffer: 10 * 1024 * 1024,
        env: { ...process.env, GUARDRAIL_SKIP_AUTH: "1" },
      });

      output += result.replace(/\x1b\[[0-9;]*m/g, "");
    } catch (err) {
      output += `\n⚠️ Autopilot failed: ${err.message}\n`;
    }

    return this.success(output);
  }

  // ============================================================================
  // AUTOPILOT PLAN - Generate fix plan (Pro/Compliance)
  // ============================================================================
  async handleAutopilotPlan(projectPath, args) {
    let output = "# 🤖 guardrail Autopilot Plan\n\n";
    output += `**Path:** ${projectPath}\n`;
    output += `**Profile:** ${args?.profile || "ship"}\n\n`;

    try {
      // Use the core autopilot runner directly
      const corePath = path.join(__dirname, "..", "packages", "core", "dist", "index.js");
      let runAutopilot;
      
      try {
        const core = await import(corePath);
        runAutopilot = core.runAutopilot;
      } catch {
        // Fallback to CLI
        let cmd = `node "${path.join(__dirname, "..", "bin", "guardrail.js")}" autopilot plan`;
        cmd += ` --profile ${args?.profile || "ship"}`;
        cmd += ` --max-fixes ${args?.maxFixes || 10}`;
        cmd += ` --json`;

        const result = execSync(cmd, {
          cwd: projectPath,
          encoding: "utf8",
          maxBuffer: 10 * 1024 * 1024,
          env: { ...process.env, GUARDRAIL_SKIP_AUTH: "1" },
        });

        const jsonResult = JSON.parse(result);
        output += `## Scan Results\n\n`;
        output += `- **Total findings:** ${jsonResult.totalFindings}\n`;
        output += `- **Fixable:** ${jsonResult.fixableFindings}\n`;
        output += `- **Estimated time:** ${jsonResult.estimatedDuration}\n\n`;

        output += `## Fix Packs\n\n`;
        for (const pack of jsonResult.packs || []) {
          const risk = pack.estimatedRisk === "high" ? "🔴" : pack.estimatedRisk === "medium" ? "🟡" : "🟢";
          output += `### ${risk} ${pack.name}\n`;
          output += `- Issues: ${pack.findings.length}\n`;
          output += `- Files: ${pack.impactedFiles.join(", ")}\n\n`;
        }

        output += `\n💡 Run \`guardrail.autopilot_apply\` to apply these fixes.\n`;
        return this.success(output);
      }

      if (runAutopilot) {
        const result = await runAutopilot({
          projectPath,
          mode: "plan",
          profile: args?.profile || "ship",
          maxFixes: args?.maxFixes || 10,
        });

        output += `## Scan Results\n\n`;
        output += `- **Total findings:** ${result.totalFindings}\n`;
        output += `- **Fixable:** ${result.fixableFindings}\n`;
        output += `- **Estimated time:** ${result.estimatedDuration}\n\n`;

        output += `## Fix Packs\n\n`;
        for (const pack of result.packs) {
          const risk = pack.estimatedRisk === "high" ? "🔴" : pack.estimatedRisk === "medium" ? "🟡" : "🟢";
          output += `### ${risk} ${pack.name}\n`;
          output += `- Issues: ${pack.findings.length}\n`;
          output += `- Files: ${pack.impactedFiles.join(", ")}\n\n`;
        }

        output += `\n💡 Run \`guardrail.autopilot_apply\` to apply these fixes.\n`;
      }
    } catch (err) {
      output += `\n❌ Error: ${err.message}\n`;
    }

    return this.success(output);
  }

  // ============================================================================
  // AUTOPILOT APPLY - Apply fixes (Pro/Compliance)
  // ============================================================================
  async handleAutopilotApply(projectPath, args) {
    let output = "# 🔧 guardrail Autopilot Apply\n\n";
    output += `**Path:** ${projectPath}\n`;
    output += `**Profile:** ${args?.profile || "ship"}\n`;
    output += `**Dry Run:** ${args?.dryRun ? "Yes" : "No"}\n\n`;

    try {
      // Fallback to CLI
      let cmd = `node "${path.join(__dirname, "..", "bin", "guardrail.js")}" autopilot apply`;
      cmd += ` --profile ${args?.profile || "ship"}`;
      cmd += ` --max-fixes ${args?.maxFixes || 10}`;
      if (args?.verify === false) cmd += ` --no-verify`;
      if (args?.dryRun) cmd += ` --dry-run`;
      cmd += ` --json`;

      const result = execSync(cmd, {
        cwd: projectPath,
        encoding: "utf8",
        maxBuffer: 10 * 1024 * 1024,
        timeout: 300000, // 5 min timeout
        env: { ...process.env, GUARDRAIL_SKIP_AUTH: "1" },
      });

      const jsonResult = JSON.parse(result);

      output += `## Results\n\n`;
      output += `- **Packs attempted:** ${jsonResult.packsAttempted}\n`;
      output += `- **Packs succeeded:** ${jsonResult.packsSucceeded}\n`;
      output += `- **Packs failed:** ${jsonResult.packsFailed}\n`;
      output += `- **Fixes applied:** ${jsonResult.appliedFixes?.filter(f => f.success).length || 0}\n`;
      output += `- **Duration:** ${jsonResult.duration}ms\n\n`;

      if (jsonResult.verification) {
        output += `## Verification\n\n`;
        output += `- TypeScript: ${jsonResult.verification.typecheck?.passed ? "✅" : "❌"}\n`;
        output += `- Build: ${jsonResult.verification.build?.passed ? "✅" : "⏭️"}\n`;
        output += `- Overall: ${jsonResult.verification.passed ? "✅ PASSED" : "❌ FAILED"}\n\n`;
      }

      output += `**Remaining findings:** ${jsonResult.remainingFindings}\n`;
      output += `**New scan verdict:** ${jsonResult.newScanVerdict}\n`;
    } catch (err) {
      output += `\n❌ Error: ${err.message}\n`;
    }

    return this.success(output);
  }

  // ============================================================================
  // BADGE - Generate ship badge
  // ============================================================================
  async handleBadge(projectPath, args) {
    const format = args?.format || "svg";

    let output = "# 🏅 guardrail Badge\n\n";

    try {
      let cmd = `node "${path.join(__dirname, "..", "bin", "guardrail.js")}" badge --format ${format}`;
      if (args?.style) cmd += ` --style ${args.style}`;

      const result = execSync(cmd, {
        cwd: projectPath,
        encoding: "utf8",
        maxBuffer: 10 * 1024 * 1024,
        env: { ...process.env, GUARDRAIL_SKIP_AUTH: "1" },
      });

      output += result.replace(/\x1b\[[0-9;]*m/g, "");

      // Read the badge file
      const badgePath = path.join(
        projectPath,
        ".guardrail",
        "badges",
        `badge.${format}`,
      );
      try {
        const badge = await fs.readFile(badgePath, "utf-8");
        if (format === "md") {
          output += "\n**Markdown:**\n```\n" + badge + "\n```\n";
        } else if (format === "html") {
          output += "\n**HTML:**\n```html\n" + badge + "\n```\n";
        } else {
          output += `\n**Badge saved to:** ${badgePath}\n`;
        }
      } catch {}
    } catch (err) {
      output += `\n⚠️ Badge generation failed: ${err.message}\n`;
    }

    return this.success(output);
  }

  // ============================================================================
  // CONTEXT - AI Rules Generator
  // ============================================================================
  async handleContext(projectPath, args) {
    const platform = args?.platform || "all";

    let output = "# 🧠 guardrail Context Generator\n\n";
    output += `**Project:** ${path.basename(projectPath)}\n`;
    output += `**Platform:** ${platform}\n\n`;

    try {
      let cmd = `node "${path.join(__dirname, "..", "bin", "guardrail.js")}" context`;
      if (platform !== "all") cmd += ` --platform=${platform}`;

      execSync(cmd, {
        cwd: projectPath,
        encoding: "utf8",
        maxBuffer: 10 * 1024 * 1024,
      });

      output += "## ✅ Context Generated\n\n";
      output +=
        "Your AI coding assistants now have full project awareness.\n\n";

      output += "### Generated Files\n\n";

      if (platform === "all" || platform === "cursor") {
        output += "**Cursor:**\n";
        output += "- `.cursorrules` - Main rules file\n";
        output += "- `.cursor/rules/*.mdc` - Modular rules\n\n";
      }

      if (platform === "all" || platform === "windsurf") {
        output += "**Windsurf:**\n";
        output += "- `.windsurf/rules/*.md` - Cascade rules\n\n";
      }

      if (platform === "all" || platform === "copilot") {
        output += "**GitHub Copilot:**\n";
        output += "- `.github/copilot-instructions.md`\n\n";
      }

      output += "**Universal (MCP):**\n";
      output += "- `.guardrail/context.json` - Full context\n";
      output += "- `.guardrail/project-map.json` - Project analysis\n\n";

      output += "### What Your AI Now Knows\n\n";
      output += "- Project architecture and structure\n";
      output += "- API routes and endpoints\n";
      output += "- Components and data models\n";
      output += "- Coding conventions and patterns\n";
      output += "- Dependencies and tech stack\n\n";

      output +=
        "> **Tip:** Regenerate after major codebase changes with `guardrail context`\n";
    } catch (err) {
      output += `\n⚠️ Context generation failed: ${err.message}\n`;
    }

    output += "\n---\n_Context Enhanced by guardrail AI_\n";
    return this.success(output);
  }

  // ============================================================================
  async handleVibeCheck(projectPath, args) {
    const bin = path.join(__dirname, "..", "bin", "guardrail.js");
    const argv = [bin, "vibe-check", "--json"];
    if (args?.strict) argv.push("--strict");
    try {
      const stdout = execFileSync(process.execPath, argv, {
        cwd: projectPath,
        encoding: "utf8",
        maxBuffer: 10 * 1024 * 1024,
      });
      const data = JSON.parse(stdout.trim());
      return this.success(JSON.stringify({ ok: true, exitCode: 0, ...data }, null, 2));
    } catch (err) {
      const stdout = err.stdout?.toString?.()?.trim?.() || "";
      if (stdout) {
        try {
          const data = JSON.parse(stdout);
          return this.success(
            JSON.stringify(
              {
                ok: true,
                exitCode: err.status ?? 1,
                strictFailed: Boolean(args?.strict && (err.status ?? 1) !== 0),
                ...data,
              },
              null,
              2,
            ),
          );
        } catch {
          /* fall through */
        }
      }
      return this.error(`vibe_check failed: ${err.message}`);
    }
  }

  async handleListTemplates(projectPath, _args) {
    const bin = path.join(__dirname, "..", "bin", "guardrail.js");
    try {
      const stdout = execFileSync(process.execPath, [bin, "list-templates", "--json"], {
        cwd: projectPath,
        encoding: "utf8",
        maxBuffer: 10 * 1024 * 1024,
      });
      const data = JSON.parse(stdout.trim());
      return this.success(JSON.stringify(data, null, 2));
    } catch (err) {
      const stderr = err.stderr?.toString?.() || err.message;
      return this.error(`list_templates failed: ${stderr}`);
    }
  }

  async handleApplyTemplate(projectPath, args) {
    const template = args?.template;
    if (!template || typeof template !== "string") {
      return this.error("apply_template requires template (string), e.g. error-boundary");
    }
    const bin = path.join(__dirname, "..", "bin", "guardrail.js");
    const argv = [bin, "apply-template", template, "--json"];
    if (args?.dryRun) argv.push("--dry-run");
    if (args?.overwrite) argv.push("--overwrite");
    try {
      const stdout = execFileSync(process.execPath, argv, {
        cwd: projectPath,
        encoding: "utf8",
        maxBuffer: 10 * 1024 * 1024,
      });
      const data = JSON.parse(stdout.trim());
      return this.success(JSON.stringify(data, null, 2));
    } catch (err) {
      const stdout = err.stdout?.toString?.()?.trim?.() || "";
      if (stdout) {
        try {
          const data = JSON.parse(stdout);
          return this.success(JSON.stringify(data, null, 2));
        } catch {
          /* fall through */
        }
      }
      return this.error(`apply_template failed: ${err.stderr?.toString?.() || err.message}`);
    }
  }

  // ============================================================================
  // STATUS
  // ============================================================================
  async handleStatus(projectPath, args) {
    let output = "# 📊 guardrail Status\n\n";

    output += "## Server\n\n";
    output += `- **Version:** ${VERSION}\n`;
    output += `- **Node:** ${process.version}\n`;
    output += `- **Platform:** ${process.platform}\n\n`;

    output += "## Project\n\n";
    output += `- **Path:** ${projectPath}\n`;

    // Config
    const configPaths = [
      path.join(projectPath, "guardrail.config.json"),
      path.join(projectPath, ".guardrailrc"),
    ];
    let hasConfig = false;
    for (const p of configPaths) {
      try {
        await fs.access(p);
        hasConfig = true;
        output += `- **Config:** ✅ Found (${path.basename(p)})\n`;
        break;
      } catch {}
    }
    if (!hasConfig) {
      output += "- **Config:** ⚠️ Not found (run `guardrail init`)\n";
    }

    // Last scan
    const summaryPath = path.join(projectPath, ".guardrail", "summary.json");
    try {
      const summary = JSON.parse(await fs.readFile(summaryPath, "utf-8"));
      output += `- **Last Scan:** ${summary.timestamp}\n`;
      output += `- **Last Score:** ${summary.score}/100 (${summary.grade})\n`;
      output += `- **Last Verdict:** ${summary.canShip ? "✅ SHIP" : "🚫 NO-SHIP"}\n`;
    } catch {
      output += "- **Last Scan:** None\n";
    }

    output += "\n## Available Tools\n\n";
    output += "| Tool | Description |\n|------|-------------|\n";
    for (const tool of TOOLS) {
      output += `| \`${tool.name}\` | ${tool.description.split("—")[0].trim()} |\n`;
    }

    output += "\n---\n_Guardrail v" + VERSION + " — https://guardrailai.dev_\n";

    return this.success(output);
  }

  // ============================================================================
  // RUN
  // ============================================================================
  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error("guardrail MCP Server v2.0 running on stdio");
  }
}

// Main
const server = new GuardrailMCP();
server.run().catch(console.error);
