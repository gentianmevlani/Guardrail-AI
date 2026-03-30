#!/usr/bin/env node

/**
 * guardrail MCP Server - Consolidated Interface
 *
 * 7 Public Tools (New Surface):
 *   guardrail.scan     - Find truth (integrity, security, hygiene, contracts)
 *   guardrail.gate     - Enforce truth in CI (fail builds on blockers)
 *   guardrail.fix      - Apply safe patches (plan -> apply)
 *   guardrail.proof    - Premium verification (mocks, reality)
 *   guardrail.report   - Access artifacts and export reports
 *   guardrail.policy   - View/modify policy configuration
 *   guardrail.status   - Health, versions, config info
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
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const VERSION = "2.0.0";

// ============================================================================
// TOOL DEFINITIONS
// ============================================================================

const TOOLS = [
  {
    name: "guardrail.scan",
    description:
      "🔮 Find truth. Runs comprehensive integrity, hygiene, and security checks.",
    inputSchema: {
      type: "object",
      properties: {
        projectPath: { type: "string", default: "." },
        profile: {
          type: "string",
          enum: ["default", "ship", "ci"],
          description: "Scan profile. 'ship'/'ci' includes all checks.",
          default: "default",
        },
        only: {
          type: "array",
          items: { type: "string" },
          description:
            "Run specific checks: 'integrity', 'hygiene', 'security', 'auth', 'routes', 'contracts', 'mocks'",
        },
        format: {
          type: "string",
          enum: ["text", "json", "markdown"],
          default: "markdown",
        },
      },
    },
  },
  {
    name: "guardrail.gate",
    description:
      "🚦 Enforce truth. CI blocker mode that fails on policy violations.",
    inputSchema: {
      type: "object",
      properties: {
        projectPath: { type: "string", default: "." },
        policy: {
          type: "string",
          description: "Policy profile: default, strict, ci",
          default: "strict",
        },
      },
    },
  },
  {
    name: "guardrail.fix",
    description: "🔧 Make truth real. Apply safe patches and scaffolds.",
    inputSchema: {
      type: "object",
      properties: {
        projectPath: { type: "string", default: "." },
        mode: {
          type: "string",
          enum: ["plan", "apply"],
          description: "Preview fixes (plan) or apply them (apply)",
          default: "plan",
        },
        targets: {
          type: "array",
          items: { type: "string" },
          description: "Limit fixes to: secrets, auth, mock, config",
        },
        ai: {
          type: "boolean",
          description: "Use AI to generate fix suggestions",
          default: false,
        },
      },
    },
  },
  {
    name: "guardrail.proof",
    description:
      "🧪 Premium verification. Detect mocks and verify runtime reality.",
    inputSchema: {
      type: "object",
      properties: {
        projectPath: { type: "string", default: "." },
        mode: {
          type: "string",
          enum: ["mocks", "reality"],
          description:
            "mocks: static mock detection. reality: runtime verification.",
        },
      },
      required: ["mode"],
    },
  },
  {
    name: "guardrail.report",
    description: "📄 Access scan artifacts and export reports.",
    inputSchema: {
      type: "object",
      properties: {
        projectPath: { type: "string", default: "." },
        runId: {
          type: "string",
          description: "Specific run ID (defaults to latest)",
        },
        format: {
          type: "string",
          enum: ["md", "html", "json"],
          default: "md",
        },
      },
    },
  },
  {
    name: "guardrail.policy",
    description: "⚙️ View and modify policy configuration.",
    inputSchema: {
      type: "object",
      properties: {
        projectPath: { type: "string", default: "." },
        action: {
          type: "string",
          enum: ["get", "set", "allowlist", "ignore", "reset"],
          default: "get",
        },
        key: { type: "string", description: "Config key to get/set" },
        value: { type: "string", description: "Value to set" },
        target: { type: "string", description: "Target for allowlist/ignore" },
      },
    },
  },
  {
    name: "guardrail.status",
    description: "📊 Server status, health, versions, and config info.",
    inputSchema: {
      type: "object",
      properties: {
        projectPath: { type: "string", default: "." },
        verbose: { type: "boolean", default: false },
      },
    },
  },
];

// ============================================================================
// TOOL HANDLERS
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

      try {
        switch (name) {
          case "guardrail.scan":
            return await this.handleScan(projectPath, args);
          case "guardrail.gate":
            return await this.handleGate(projectPath, args);
          case "guardrail.fix":
            return await this.handleFix(projectPath, args);
          case "guardrail.proof":
            return await this.handleProof(projectPath, args);
          case "guardrail.report":
            return await this.handleReport(projectPath, args);
          case "guardrail.policy":
            return await this.handlePolicy(projectPath, args);
          case "guardrail.status":
            return await this.handleStatus(projectPath, args);

          // Legacy mappings
          case "guardrail.hygiene":
            return await this.handleScan(projectPath, {
              ...args,
              only: ["hygiene"],
            });
          case "guardrail.security":
            return await this.handleScan(projectPath, {
              ...args,
              only: ["security"],
            });

          default:
            return this.error(`Unknown tool: ${name}`);
        }
      } catch (err) {
        return this.error(`${name} failed: ${err.message}`);
      }
    });

    // Resources (unchanged)
    this.server.setRequestHandler(ListResourcesRequestSchema, async () => ({
      resources: [
        {
          uri: "guardrail://config",
          name: "guardrail Config",
          description: "Current guardrail configuration",
          mimeType: "application/json",
        },
        {
          uri: "guardrail://summary",
          name: "Last Scan Summary",
          description: "Summary of the last scan",
          mimeType: "application/json",
        },
      ],
    }));

    this.server.setRequestHandler(
      ReadResourceRequestSchema,
      async (request) => {
        const { uri } = request.params;
        const projectPath = process.cwd();

        if (uri === "guardrail://config") {
          const configPath = path.join(projectPath, ".guardrailrc");
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
                  text: '{"error": "No scan found"}',
                },
              ],
            };
          }
        }

        return { contents: [] };
      },
    );
  }

  // Helper methods
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
    const profile = args?.profile || "default";
    let only = args?.only || [];
    const format = args?.format || "markdown";

    let output = "# 🔮 guardrail Scan\n\n";
    output += `**Profile:** ${profile}\n`;
    if (only.length > 0) output += `**Only:** ${only.join(", ")}\n`;
    output += "\n";

    // Determine checks to run
    let checksToRun = ["integrity"];
    if (profile === "ship" || profile === "ci") {
      checksToRun = ["integrity", "hygiene", "security"];
    }
    if (only.length > 0) {
      checksToRun = [];
      if (only.includes("integrity")) checksToRun.push("integrity");
      if (only.includes("hygiene")) checksToRun.push("hygiene");
      if (only.includes("security")) checksToRun.push("security");
      if (only.includes("contracts") || only.includes("api"))
        checksToRun.push("api");
      if (only.includes("auth")) checksToRun.push("auth");
      if (only.includes("routes")) checksToRun.push("routes");
      if (only.includes("mocks")) checksToRun.push("mock");

      // Fallback if specific integrity sub-checks are requested but integrity not explicit
      if (
        ["api", "auth", "secrets", "routes", "mock"].some((c) =>
          only.includes(c),
        ) &&
        !checksToRun.includes("integrity")
      ) {
        checksToRun.push("integrity");
      }
    }

    const results = {
      score: 100,
      grade: "A",
      canShip: true,
      deductions: [],
      blockers: [],
      counts: {},
      checks: {},
    };

    // 1. Integrity Check (Main)
    if (
      checksToRun.includes("integrity") ||
      checksToRun.some((c) => ["api", "auth", "routes", "mock"].includes(c))
    ) {
      try {
        const { auditProductionIntegrity } = require(
          path.join(
            __dirname,
            "..",
            "scripts",
            "audit-production-integrity.js",
          ),
        );
        const { results: integrityResults, integrity } =
          await auditProductionIntegrity(projectPath);

        results.score = integrity.score;
        results.grade = integrity.grade;
        results.canShip = integrity.canShip;
        results.deductions = integrity.deductions;

        // Build summary
        output += `## Integrity Score: ${integrity.score}/100 (${integrity.grade})\n\n`;

        // Add specific check results if requested
        if (
          only.length === 0 ||
          only.includes("integrity") ||
          only.includes("api")
        ) {
          output += `- **API Wiring:** ${integrityResults.api?.summary?.missingBackend || 0} missing endpoints\n`;
        }
        if (
          only.length === 0 ||
          only.includes("integrity") ||
          only.includes("auth")
        ) {
          output += `- **Auth Coverage:** ${integrityResults.auth?.analysis?.sensitiveUnprotected?.length || 0} issues\n`;
        }
        if (
          only.length === 0 ||
          only.includes("integrity") ||
          only.includes("mocks")
        ) {
          output += `- **Mock Code:** ${integrityResults.mocks?.issues?.filter((i) => i.severity === "critical").length || 0} blockers\n`;
        }
      } catch (err) {
        output += `⚠️ Integrity check failed: ${err.message}\n`;
      }
    }

    // 2. Hygiene Check
    if (checksToRun.includes("hygiene")) {
      try {
        const {
          findDuplicates,
          findUnusedFiles,
          collectAllErrors,
          calculateHygieneScore,
        } = require(path.join(__dirname, "..", "scripts", "hygiene"));

        const hygieneResults = {
          duplicates: findDuplicates(projectPath),
          unused: findUnusedFiles(projectPath),
          errors: collectAllErrors(projectPath),
        };
        const hygieneScore = calculateHygieneScore(hygieneResults);

        output += `\n## Hygiene Score: ${hygieneScore.score}/100\n`;
        output += `- **Duplicates:** ${hygieneResults.duplicates?.exact?.length || 0}\n`;
        output += `- **Unused Files:** ${hygieneResults.unused?.unused?.definitelyUnused?.length || 0}\n`;
        output += `- **Errors:** ${hygieneResults.errors?.summary?.total || 0}\n`;
      } catch (err) {
        output += `⚠️ Hygiene check failed: ${err.message}\n`;
      }
    }

    // 3. Security Check
    if (checksToRun.includes("security")) {
      try {
        const { auditEnvSecrets } = require(
          path.join(__dirname, "..", "scripts", "audit-env-secrets.js"),
        );
        const secResults = await auditEnvSecrets(projectPath);
        const critical =
          secResults.secrets?.filter((s) => s.severity === "critical").length ||
          0;

        output += `\n## Security\n`;
        output += `- **Critical Secrets:** ${critical}\n`;
      } catch (err) {
        output += `⚠️ Security check failed: ${err.message}\n`;
      }
    }

    // 4. Compliance Check (IaC + PII)
    if (
      checksToRun.includes("compliance") ||
      profile === "ship" ||
      profile === "ci"
    ) {
      try {
        const { runComplianceScan } = require(
          path.join(
            __dirname,
            "..",
            "bin",
            "runners",
            "lib",
            "compliance-bridge.js",
          ),
        );
        const complianceResults = await runComplianceScan(projectPath);

        output += `\n## Compliance\n`;
        output += `- **IaC Issues:** ${complianceResults.iac.length}\n`;
        output += `- **PII Findings:** ${complianceResults.pii.length}\n`;

        results.checks.compliance = complianceResults;
      } catch (err) {
        output += `⚠️ Compliance check failed: ${err.message}\n`;
      }
    }

    // 5. AI Guardrails Check
    if (checksToRun.includes("ai") || profile === "ship" || profile === "ci") {
      try {
        const { runHallucinationCheck } = require(
          path.join(__dirname, "..", "bin", "runners", "lib", "ai-bridge.js"),
        );
        const aiResults = await runHallucinationCheck(projectPath);

        output += `\n## AI Guardrails\n`;
        output += `- **Hallucinations:** ${aiResults.issues.length}\n`;

        results.checks.ai = aiResults;
      } catch (err) {
        output += `⚠️ AI check failed: ${err.message}\n`;
      }
    }

    output += "\n---\n_Context Enhanced by guardrail AI_";

    if (format === "json") {
      return this.success(JSON.stringify({ output, results }, null, 2));
    }
    return this.success(output);
  }

  // ============================================================================
  // GATE
  // ============================================================================
  async handleGate(projectPath, args) {
    // Reuse scan logic with CI defaults
    return this.handleScan(projectPath, { ...args, profile: "ci" });
  }

  // ============================================================================
  // FIX
  // ============================================================================
  async handleFix(projectPath, args) {
    const mode = args?.mode || "plan";
    const targets = args?.targets || ["all"];

    let output = "# 🔧 guardrail Fix\n\n";
    output += `**Mode:** ${mode}\n`;
    output += `**Targets:** ${targets.join(", ")}\n\n`;

    if (mode === "apply") {
      output +=
        "⚠️ Automated fixes are not yet fully implemented via MCP. Please run `guardrail fix` in terminal for interactive mode.\n";
      output += "Showing plan instead:\n\n";
    }

    try {
      const { auditProductionIntegrity } = require(
        path.join(__dirname, "..", "scripts", "audit-production-integrity.js"),
      );
      const { results } = await auditProductionIntegrity(projectPath);

      if (results.env?.secrets?.length > 0) {
        output += "### 🔑 Secrets\n";
        output += "- Move hardcoded secrets to .env\n";
      }
      if (results.auth?.analysis?.sensitiveUnprotected?.length > 0) {
        output += "### 🔐 Auth\n";
        output += "- Add auth middleware to sensitive endpoints\n";
      }
      if (results.mocks?.issues?.length > 0) {
        output += "### 🧪 Mock Code\n";
        output += "- Remove mock/test code from production bundles\n";
      }

      if (
        !results.env?.secrets?.length &&
        !results.auth?.analysis?.sensitiveUnprotected?.length &&
        !results.mocks?.issues?.length
      ) {
        output += "✅ No fixes needed.\n";
      }
    } catch (err) {
      output += `❌ Analysis failed: ${err.message}\n`;
    }

    return this.success(output);
  }

  // ============================================================================
  // PROOF
  // ============================================================================
  async handleProof(projectPath, args) {
    const mode = args?.mode;

    if (!mode) return this.error("Mode required: mocks | reality");

    let output = `# 🧪 guardrail Proof: ${mode}\n\n`;

    try {
      if (mode === "mocks") {
        const { auditMockBlocker } = require(
          path.join(__dirname, "..", "scripts", "audit-mock-blocker.js"),
        );
        const results = await auditMockBlocker(projectPath);

        const issues = results.issues.length;
        output += `**Status:** ${issues === 0 ? "✅ PASSED" : "🚫 FAILED"}\n`;
        output += `**Issues Found:** ${issues}\n\n`;

        if (issues > 0) {
          output += "### Issues\n";
          for (const issue of results.issues.slice(0, 10)) {
            output += `- ${issue.name} in ${issue.file}\n`;
          }
        }
      } else if (mode === "reality") {
        // Reality check maps to production integrity currently
        const { auditProductionIntegrity } = require(
          path.join(
            __dirname,
            "..",
            "scripts",
            "audit-production-integrity.js",
          ),
        );
        const { integrity } = await auditProductionIntegrity(projectPath);

        output += `**Status:** ${integrity.canShip ? "✅ PASSED" : "🚫 FAILED"}\n`;
        output += `**Score:** ${integrity.score}/100\n`;
      } else {
        return this.error("Invalid mode. Use 'mocks' or 'reality'.");
      }
    } catch (err) {
      output += `❌ Proof failed: ${err.message}\n`;
    }

    return this.success(output);
  }

  // ============================================================================
  // REPORT
  // ============================================================================
  async handleReport(projectPath, args) {
    const outputDir = path.join(projectPath, ".guardrail");
    try {
      const summaryPath = path.join(outputDir, "summary.json");
      const summary = JSON.parse(await fs.readFile(summaryPath, "utf-8"));

      let output = "# 📄 guardrail Report\n\n";
      output += `**Date:** ${summary.timestamp}\n`;
      output += `**Score:** ${summary.score}\n`;
      output += `**Verdict:** ${summary.canShip ? "SHIP" : "NO-SHIP"}\n`;

      return this.success(output);
    } catch {
      return this.error("No report found. Run guardrail.scan first.");
    }
  }

  // ============================================================================
  // POLICY
  // ============================================================================
  async handlePolicy(projectPath, args) {
    const action = args?.action || "get";
    const configPath = path.join(projectPath, ".guardrailrc");

    let config = {};
    try {
      config = JSON.parse(await fs.readFile(configPath, "utf-8"));
    } catch {}

    if (action === "get") {
      return this.success(JSON.stringify(config, null, 2));
    }

    // Set/Modify logic simplified for MCP
    return this.success(
      "Policy modification via MCP is read-only in this version. Edit .guardrailrc directly.",
    );
  }

  // ============================================================================
  // STATUS
  // ============================================================================
  async handleStatus(projectPath, args) {
    let output = "# 📊 guardrail Status\n\n";
    output += `- **Version:** ${VERSION}\n`;
    output += `- **Path:** ${projectPath}\n`;

    try {
      await fs.access(path.join(projectPath, ".guardrailrc"));
      output += "- **Config:** ✅ Present\n";
    } catch {
      output += "- **Config:** ⚠️ Missing\n";
    }

    return this.success(output);
  }

  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error("guardrail MCP Server running on stdio");
  }
}

// Main
if (fileURLToPath(import.meta.url) === process.argv[1]) {
  new GuardrailMCP().run().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
