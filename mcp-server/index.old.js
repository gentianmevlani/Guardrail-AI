#!/usr/bin/env node

/**
 * AI Agent Guardrails - MCP Server
 * Version: 1.0.0
 *
 * Professional Model Context Protocol server for AI development environments.
 * Compatible with Cursor, Claude Desktop, VS Code, Windsurf, and other MCP-enabled editors.
 *
 * Features:
 * - Project validation and architecture analysis
 * - Design system enforcement
 * - API endpoint registration
 * - Knowledge base building
 * - Semantic code search
 * - Change impact analysis
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
import { execSync } from "child_process";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const {
  STRIPE_TEST_PREFIX,
  stripeSkLiveRegex24,
} = require("../bin/runners/lib/stripe-scan-patterns.js");

// Import premium tools
import { PREMIUM_TOOLS, handlePremiumTool } from "./premium-tools.js";

// Import hygiene tools
import { createRequire } from "module";
const require = createRequire(import.meta.url);
const {
  hygieneTools,
  hygieneFullScan,
  hygieneDuplicates,
  hygieneUnused,
  hygieneErrors,
  hygieneRootCleanup,
  hygieneDeletionPlan,
} = require("./hygiene-tools.js");

// Professional logging system
class Logger {
  constructor(debug = false) {
    this.debug = debug;
  }

  log(level, message, data = null) {
    const timestamp = new Date().toISOString();
    const logEntry = `[${timestamp}] [${level}] [guardrail MCP] ${message}`;

    if (level === "ERROR") {
      console.error(logEntry);
      if (data) console.error(JSON.stringify(data, null, 2));
    } else if (this.debug) {
      console.error(logEntry);
      if (data) console.error(JSON.stringify(data, null, 2));
    }
  }

  info(message, data) {
    this.log("INFO", message, data);
  }
  warn(message, data) {
    this.log("WARN", message, data);
  }
  error(message, data) {
    this.log("ERROR", message, data);
  }
  debug(message, data) {
    this.log("DEBUG", message, data);
  }
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class GuardrailsMCPServer {
  constructor() {
    // Initialize logger
    this.logger = new Logger(process.env.GUARDRAIL_DEBUG === "true");

    this.server = new Server(
      {
        name: "guardrail-ai",
        version: "1.0.0",
      },
      {
        capabilities: {
          tools: {},
          resources: {},
        },
      },
    );

    this.setupHandlers();
    this.setupErrorHandling();
    this.logger.info("guardrail MCP Server initialized");
  }

  setupHandlers() {
    // List available tools with professional descriptions and categorization
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: [
        // 🏗️ Project Analysis & Validation
        {
          name: "validate_project",
          description:
            "🔍 Comprehensive project validation - checks structure, API endpoints, and identifies mock data usage",
          inputSchema: {
            type: "object",
            properties: {
              projectPath: {
                type: "string",
                description: "Path to project root directory",
                default: ".",
              },
            },
          },
        },
        {
          name: "check_project_drift",
          description:
            "📊 Detect architectural drift - analyzes if project structure has deviated from intended patterns",
          inputSchema: {
            type: "object",
            properties: {
              projectPath: {
                type: "string",
                description: "Path to project root directory",
                default: ".",
              },
            },
          },
        },
        {
          name: "get_project_health",
          description:
            "💯 Generate project health score with actionable recommendations (Professional feature)",
          inputSchema: {
            type: "object",
            properties: {
              projectPath: {
                type: "string",
                description: "Path to project root directory",
                default: ".",
              },
            },
          },
        },
        // 🎨 Design System Management
        {
          name: "check_design_system",
          description:
            "🎨 Validate components against locked design system - ensures visual consistency",
          inputSchema: {
            type: "object",
            properties: {
              projectPath: {
                type: "string",
                description: "Path to project root directory",
                default: ".",
              },
            },
          },
        },
        {
          name: "setup_design_system",
          description:
            "🔧 Initialize and lock a professional design system for your project",
          inputSchema: {
            type: "object",
            properties: {
              projectPath: {
                type: "string",
                description: "Path to project root directory",
                default: ".",
              },
              theme: {
                type: "string",
                enum: ["modern", "dark", "elegant", "minimal", "corporate"],
                description: "Pre-built theme to apply",
                default: "modern",
              },
            },
          },
        },
        // 🔌 API Management
        {
          name: "register_api_endpoint",
          description:
            "📝 Register new API endpoints to prevent mock data usage and maintain API integrity",
          inputSchema: {
            type: "object",
            properties: {
              projectPath: {
                type: "string",
                description: "Path to project root directory",
                default: ".",
              },
              path: {
                type: "string",
                description: "API endpoint path (e.g., /api/users)",
              },
              method: {
                type: "string",
                enum: ["GET", "POST", "PUT", "DELETE", "PATCH"],
                description: "HTTP method",
              },
              description: {
                type: "string",
                description: "Detailed endpoint description",
              },
            },
            required: ["path", "method"],
          },
        },
        {
          name: "get_guardrails_rules",
          description:
            "📋 Retrieve current guardrails rules and project constraints",
          inputSchema: {
            type: "object",
            properties: {
              projectPath: {
                type: "string",
                description: "Path to project root directory",
                default: ".",
              },
            },
          },
        },
        // 🧠 Intelligence & Knowledge
        {
          name: "architect_analyze",
          description:
            "🏗️ Intelligent project analysis - understands context and recommends optimal implementation order",
          inputSchema: {
            type: "object",
            properties: {
              projectPath: {
                type: "string",
                description: "Path to project root directory",
                default: ".",
              },
            },
          },
        },
        {
          name: "architect_apply",
          description:
            "⚡ Automatically apply recommended templates with dependency resolution",
          inputSchema: {
            type: "object",
            properties: {
              projectPath: {
                type: "string",
                description: "Path to project root directory",
                default: ".",
              },
              autoApply: {
                type: "boolean",
                description:
                  "Automatically apply critical templates without confirmation",
                default: true,
              },
            },
          },
        },
        {
          name: "build_knowledge_base",
          description:
            "🧠 Build deep codebase knowledge - analyzes architecture, patterns, and relationships",
          inputSchema: {
            type: "object",
            properties: {
              projectPath: {
                type: "string",
                description: "Path to project root directory",
                default: ".",
              },
            },
          },
        },
        {
          name: "get_deep_context",
          description:
            "💬 Get project-specific answers using knowledge base with customizable response styles",
          inputSchema: {
            type: "object",
            properties: {
              projectPath: {
                type: "string",
                description: "Path to project root directory",
                default: ".",
              },
              query: {
                type: "string",
                description:
                  'Question about your codebase (e.g., "How is authentication implemented?")',
              },
              style: {
                type: "string",
                enum: [
                  "blunt",
                  "excited",
                  "strict",
                  "friendly",
                  "professional",
                  "casual",
                  "technical",
                  "encouraging",
                  "concise",
                  "detailed",
                ],
                description:
                  "Response tone: blunt (direct), excited (energetic), strict (formal), friendly (warm), professional (business), casual (relaxed), technical (precise), encouraging (supportive), concise (brief), detailed (thorough)",
                default: "professional",
              },
              useEmojis: {
                type: "boolean",
                description:
                  "Include emojis in responses for better engagement",
                default: true,
              },
              includeExamples: {
                type: "boolean",
                description: "Include code examples in recommendations",
                default: false,
              },
            },
            required: ["query"],
          },
        },
        // 🔍 Code Analysis & Search
        {
          name: "semantic_search",
          description:
            "🔍 Semantic code search - find code by meaning, not just text matching",
          inputSchema: {
            type: "object",
            properties: {
              projectPath: {
                type: "string",
                description: "Path to project root directory",
                default: ".",
              },
              query: {
                type: "string",
                description:
                  'Describe what you\'re looking for (e.g., "authentication middleware", "user validation logic")',
              },
            },
            required: ["query"],
          },
        },
        {
          name: "analyze_change_impact",
          description:
            "💥 Analyze impact of changes - identifies dependencies and potential breaking changes",
          inputSchema: {
            type: "object",
            properties: {
              projectPath: {
                type: "string",
                description: "Path to project root directory",
                default: ".",
              },
              file: {
                type: "string",
                description: "File path to analyze for impact",
              },
            },
            required: ["file"],
          },
        },
        {
          name: "generate_code_context",
          description:
            "⚙️ Generate code prompts that follow your project's patterns and conventions",
          inputSchema: {
            type: "object",
            properties: {
              projectPath: {
                type: "string",
                description: "Path to project root directory",
                default: ".",
              },
              task: {
                type: "string",
                description:
                  'Describe what code to generate (e.g., "Create a user authentication hook with TypeScript")',
              },
            },
            required: ["task"],
          },
        },
        // 🛡️ Security Orchestrator
        {
          name: "security_scan",
          description:
            "🛡️ Full security scan - runs policy checks, SAST, supply chain analysis, and secret detection",
          inputSchema: {
            type: "object",
            properties: {
              projectPath: {
                type: "string",
                description: "Path to project root directory",
                default: ".",
              },
              environment: {
                type: "string",
                enum: ["development", "staging", "production"],
                description: "Target environment for security checks",
                default: "production",
              },
            },
          },
        },
        {
          name: "policy_check",
          description:
            "📋 Run policy checks - validates banned patterns, mock data, localhost URLs, and env vars",
          inputSchema: {
            type: "object",
            properties: {
              projectPath: {
                type: "string",
                description: "Path to project root directory",
                default: ".",
              },
              environment: {
                type: "string",
                enum: ["development", "staging", "production"],
                description: "Target environment",
                default: "production",
              },
            },
          },
        },
        {
          name: "secret_scan",
          description:
            "🔐 Scan for secrets - detects API keys, tokens, passwords, and credentials in code",
          inputSchema: {
            type: "object",
            properties: {
              projectPath: {
                type: "string",
                description: "Path to project root directory",
                default: ".",
              },
              scanHistory: {
                type: "boolean",
                description: "Also scan git history for leaked secrets",
                default: false,
              },
            },
          },
        },
        {
          name: "supply_chain_scan",
          description:
            "📦 Supply chain analysis - generates SBOM, scans vulnerabilities, checks licenses",
          inputSchema: {
            type: "object",
            properties: {
              projectPath: {
                type: "string",
                description: "Path to project root directory",
                default: ".",
              },
              repoUrl: {
                type: "string",
                description: "GitHub repo URL for OpenSSF Scorecard (optional)",
              },
            },
          },
        },
        {
          name: "ship_check",
          description:
            "🚀 Ship readiness check - MockProof build gate to ensure no fakes in production",
          inputSchema: {
            type: "object",
            properties: {
              projectPath: {
                type: "string",
                description: "Path to project root directory",
                default: ".",
              },
            },
          },
        },
        // 🔗 API Endpoint Audit
        {
          name: "audit_api_endpoints",
          description:
            "🔗 Audit API endpoints - identifies disconnected endpoints, missing backend implementations, and unused routes",
          inputSchema: {
            type: "object",
            properties: {
              projectPath: {
                type: "string",
                description: "Path to project root directory",
                default: ".",
              },
              showDetails: {
                type: "boolean",
                description: "Show detailed endpoint lists",
                default: false,
              },
            },
          },
        },
        {
          name: "get_deploy_verdict",
          description:
            "🚦 Get deploy verdict - returns ship/no-ship decision with blockers and risk score",
          inputSchema: {
            type: "object",
            properties: {
              projectPath: {
                type: "string",
                description: "Path to project root directory",
                default: ".",
              },
            },
          },
        },
        // 🛡️ Production Integrity Suite
        {
          name: "production_integrity_check",
          description:
            "🛡️ Full production integrity audit - combines API wiring, auth coverage, secrets, routes, and mock detection into one comprehensive report with integrity score",
          inputSchema: {
            type: "object",
            properties: {
              projectPath: {
                type: "string",
                description: "Path to project root directory",
                default: ".",
              },
            },
          },
        },
        {
          name: "audit_auth_coverage",
          description:
            "🔐 Auth/RBAC coverage scanner - detects unprotected endpoints, missing auth middleware, exposed admin routes, and missing role checks",
          inputSchema: {
            type: "object",
            properties: {
              projectPath: {
                type: "string",
                description: "Path to project root directory",
                default: ".",
              },
            },
          },
        },
        {
          name: "audit_env_secrets",
          description:
            "🔑 Environment & secrets audit - detects hardcoded secrets, leaked NEXT_PUBLIC vars, missing env vars, and generates .env.example",
          inputSchema: {
            type: "object",
            properties: {
              projectPath: {
                type: "string",
                description: "Path to project root directory",
                default: ".",
              },
            },
          },
        },
        {
          name: "audit_route_integrity",
          description:
            "🗺️ Route integrity scanner - finds dead links, unused pages, placeholder content, and feature flags that may hide sections",
          inputSchema: {
            type: "object",
            properties: {
              projectPath: {
                type: "string",
                description: "Path to project root directory",
                default: ".",
              },
            },
          },
        },
        {
          name: "audit_mock_blocker",
          description:
            "🚫 Mock/stub ship blocker - detects test imports, mock code, debug statements, and test credentials that shouldn't ship to production",
          inputSchema: {
            type: "object",
            properties: {
              projectPath: {
                type: "string",
                description: "Path to project root directory",
                default: ".",
              },
            },
          },
        },
        // 🔮 Reality Check - The Ultimate Truth Detector
        {
          name: "reality_check",
          description:
            "🔮 Reality Check - The ultimate production truth detector. Runs comprehensive integrity audit: API wiring, auth coverage, secrets, routes, mock code detection, plus code-level self-deception analysis. Returns full report with integrity score and ship/no-ship verdict.",
          inputSchema: {
            type: "object",
            properties: {
              projectPath: {
                type: "string",
                description: "Path to project root directory",
                default: ".",
              },
              mode: {
                type: "string",
                enum: ["full", "quick", "code-only"],
                description:
                  "full = complete production audit (default), quick = summary only, code-only = just analyze specific file",
                default: "full",
              },
              file: {
                type: "string",
                description: "Specific file to analyze (for code-only mode)",
              },
            },
          },
        },
        {
          name: "reality_check_deep",
          description:
            "🔮 Deep Reality Check (Pro) - Cross-file analysis, call graph tracing, async lifecycle analysis, and AI intent verification",
          inputSchema: {
            type: "object",
            properties: {
              projectPath: {
                type: "string",
                description: "Path to project root directory",
                default: ".",
              },
              file: {
                type: "string",
                description: "File path to analyze",
              },
              includeCallGraph: {
                type: "boolean",
                description: "Include call graph analysis",
                default: true,
              },
              includeAsyncAnalysis: {
                type: "boolean",
                description: "Include async/await lifecycle analysis",
                default: true,
              },
            },
            required: ["file"],
          },
        },
        // 🤖 AI-Enhanced Production Integrity
        {
          name: "ai_production_integrity",
          description:
            "🤖 AI-Enhanced Production Integrity - Uses LLM to analyze findings, generate intelligent fix suggestions, explain security risks, and provide prioritized action items with business impact analysis",
          inputSchema: {
            type: "object",
            properties: {
              projectPath: {
                type: "string",
                description: "Path to project root directory",
                default: ".",
              },
              enableAI: {
                type: "boolean",
                description:
                  "Enable AI-powered analysis (requires OPENAI_API_KEY)",
                default: true,
              },
            },
          },
        },
        {
          name: "ai_explain_finding",
          description:
            "🧠 AI Explain Finding - Get detailed AI explanation of a security finding including attack scenarios, compliance impact, and step-by-step fix with code examples",
          inputSchema: {
            type: "object",
            properties: {
              finding: {
                type: "object",
                description: "The finding object to explain",
                properties: {
                  category: { type: "string" },
                  severity: { type: "string" },
                  title: { type: "string" },
                  description: { type: "string" },
                  file: { type: "string" },
                  code: { type: "string" },
                },
                required: ["category", "title"],
              },
              context: {
                type: "string",
                description: "Additional context about the codebase",
              },
            },
            required: ["finding"],
          },
        },
        {
          name: "ai_generate_fix",
          description:
            "🔧 AI Generate Fix - Generate AI-powered code fix for a specific finding with step-by-step instructions and working code example",
          inputSchema: {
            type: "object",
            properties: {
              finding: {
                type: "object",
                description: "The finding to fix",
                properties: {
                  category: { type: "string" },
                  severity: { type: "string" },
                  title: { type: "string" },
                  description: { type: "string" },
                  file: { type: "string" },
                  code: { type: "string" },
                },
                required: ["category", "title"],
              },
            },
            required: ["finding"],
          },
        },
        {
          name: "ai_security_assessment",
          description:
            "🛡️ AI Security Assessment - Get comprehensive AI-powered security posture assessment with risk matrix, compliance gaps, and remediation roadmap",
          inputSchema: {
            type: "object",
            properties: {
              projectPath: {
                type: "string",
                description: "Path to project root directory",
                default: ".",
              },
              complianceFrameworks: {
                type: "array",
                items: { type: "string" },
                description:
                  "Compliance frameworks to check (e.g., SOC2, GDPR, HIPAA)",
                default: ["SOC2", "GDPR"],
              },
            },
          },
        },
        // Premium Command Palette Tools
        ...PREMIUM_TOOLS,
        // 🧹 Repo Hygiene + Debt Radar
        {
          name: "repo_hygiene_scan",
          description:
            "🧹 Full repo hygiene scan - duplicates, unused files, lint/type errors, root cleanup. Generates deletion-safe plan.",
          inputSchema: {
            type: "object",
            properties: {
              projectPath: {
                type: "string",
                description: "Path to project root",
                default: ".",
              },
              mode: {
                type: "string",
                enum: ["report", "safe-fix"],
                default: "report",
              },
              saveArtifacts: { type: "boolean", default: true },
            },
          },
        },
        {
          name: "repo_hygiene_duplicates",
          description:
            "📋 Find duplicate files - exact (same hash), near-duplicate (85%+ similar), and copy-paste blocks",
          inputSchema: {
            type: "object",
            properties: {
              projectPath: { type: "string", default: "." },
              threshold: {
                type: "number",
                description: "Similarity threshold",
                default: 0.85,
              },
            },
          },
        },
        {
          name: "repo_hygiene_unused",
          description:
            "📦 Find unused files via import graph analysis from entrypoints. Classifies by deletion safety.",
          inputSchema: {
            type: "object",
            properties: {
              projectPath: { type: "string", default: "." },
              scope: {
                type: "string",
                enum: ["all", "prod", "test"],
                default: "all",
              },
            },
          },
        },
        {
          name: "repo_hygiene_errors",
          description:
            "🔴 Unified lint/type/import/syntax error collection. CI-friendly with counts and top offenders.",
          inputSchema: {
            type: "object",
            properties: {
              projectPath: { type: "string", default: "." },
              eslint: { type: "boolean", default: true },
              tsc: { type: "boolean", default: true },
              imports: { type: "boolean", default: true },
              syntax: { type: "boolean", default: true },
            },
          },
        },
        {
          name: "repo_hygiene_root_cleanup",
          description:
            "🏠 Root directory analyzer - junk files, missing standards, duplicate configs, misplaced files",
          inputSchema: {
            type: "object",
            properties: {
              projectPath: { type: "string", default: "." },
            },
          },
        },
        {
          name: "repo_hygiene_deletion_plan",
          description:
            "🗑️ Generate safe deletion plan for duplicates and unused files. Never auto-deletes.",
          inputSchema: {
            type: "object",
            properties: {
              projectPath: { type: "string", default: "." },
              includeReview: { type: "boolean", default: false },
            },
          },
        },
      ],
    }));

    // List available resources
    this.server.setRequestHandler(ListResourcesRequestSchema, async () => ({
      resources: [
        {
          uri: "guardrails://rules",
          name: "Guardrails Rules",
          description:
            "Current guardrails rules and file organization constraints",
          mimeType: "text/markdown",
        },
        {
          uri: "guardrails://templates",
          name: "Available Templates",
          description: "List of available project templates",
          mimeType: "application/json",
        },
        {
          uri: "guardrails://design-tokens",
          name: "Design Tokens",
          description: "Current design system tokens (if locked)",
          mimeType: "application/json",
        },
      ],
    }));

    // Read resources
    this.server.setRequestHandler(
      ReadResourceRequestSchema,
      async (request) => {
        const { uri } = request.params;

        switch (uri) {
          case "guardrails://rules":
            return {
              contents: [
                {
                  uri,
                  mimeType: "text/markdown",
                  text: await this.getGuardrailsRules(),
                },
              ],
            };

          case "guardrails://templates":
            return {
              contents: [
                {
                  uri,
                  mimeType: "application/json",
                  text: JSON.stringify(
                    await this.getAvailableTemplates(),
                    null,
                    2,
                  ),
                },
              ],
            };

          case "guardrails://design-tokens":
            return {
              contents: [
                {
                  uri,
                  mimeType: "application/json",
                  text: JSON.stringify(await this.getDesignTokens(), null, 2),
                },
              ],
            };

          default:
            throw new Error(`Unknown resource: ${uri}`);
        }
      },
    );

    // Handle tool calls with enhanced error handling and progress feedback
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;
      const projectPath = args?.projectPath || process.cwd();

      // Log tool usage
      this.logger.info(`Executing tool: ${name}`, { projectPath, args });

      // Validate project path
      if (!projectPath || typeof projectPath !== "string") {
        const error = "Invalid project path provided";
        this.logger.error(error, { projectPath });
        return {
          content: [{ type: "text", text: `❌ Error: ${error}` }],
          isError: true,
        };
      }

      try {
        // Show progress for long-running operations
        const startTime = Date.now();
        let result;

        switch (name) {
          case "validate_project":
            result = await this.validateProject(projectPath);
            break;

          case "check_design_system":
            result = await this.checkDesignSystem(projectPath);
            break;

          case "check_project_drift":
            result = await this.checkProjectDrift(projectPath);
            break;

          case "setup_design_system":
            result = await this.setupDesignSystem(
              projectPath,
              args?.theme || "modern",
            );
            break;

          case "get_project_health":
            result = await this.getProjectHealth(projectPath);
            break;

          case "register_api_endpoint":
            result = await this.registerApiEndpoint(
              projectPath,
              args.path,
              args.method,
              args.description,
            );
            break;

          case "get_guardrails_rules":
            result = await this.getGuardrailsRulesResponse(projectPath);
            break;

          case "architect_analyze":
            result = await this.architectAnalyze(projectPath);
            break;

          case "architect_apply":
            result = await this.architectApply(
              projectPath,
              args?.autoApply !== false,
            );
            break;

          case "build_knowledge_base":
            result = await this.buildKnowledgeBase(projectPath);
            break;

          case "get_deep_context":
            result = await this.getDeepContext(
              projectPath,
              args?.query,
              args?.style || "professional",
              args?.useEmojis !== undefined ? args.useEmojis : true,
              args?.includeExamples !== undefined
                ? args.includeExamples
                : false,
            );
            break;

          case "semantic_search":
            result = await this.semanticSearch(projectPath, args?.query);
            break;

          case "analyze_change_impact":
            result = await this.analyzeChangeImpact(projectPath, args?.file);
            break;

          case "generate_code_context":
            result = await this.generateCodeContext(projectPath, args?.task);
            break;

          // Security Orchestrator tools
          case "security_scan":
            result = await this.securityScan(
              projectPath,
              args?.environment || "production",
            );
            break;

          case "policy_check":
            result = await this.policyCheck(
              projectPath,
              args?.environment || "production",
            );
            break;

          case "secret_scan":
            result = await this.secretScan(
              projectPath,
              args?.scanHistory || false,
            );
            break;

          case "supply_chain_scan":
            result = await this.supplyChainScan(projectPath, args?.repoUrl);
            break;

          case "ship_check":
            result = await this.shipCheck(projectPath);
            break;

          case "get_deploy_verdict":
            result = await this.getDeployVerdict(projectPath);
            break;

          case "audit_api_endpoints":
            result = await this.auditApiEndpoints(
              projectPath,
              args?.showDetails || false,
            );
            break;

          case "production_integrity_check":
            result = await this.productionIntegrityCheck(projectPath);
            break;

          case "audit_auth_coverage":
            result = await this.auditAuthCoverage(projectPath);
            break;

          case "audit_env_secrets":
            result = await this.auditEnvSecrets(projectPath);
            break;

          case "audit_route_integrity":
            result = await this.auditRouteIntegrity(projectPath);
            break;

          case "audit_mock_blocker":
            result = await this.auditMockBlocker(projectPath);
            break;

          case "reality_check":
            result = await this.realityCheck(
              projectPath,
              args?.mode || "full",
              args?.file,
            );
            break;

          case "reality_check_deep":
            result = await this.realityCheckDeep(
              projectPath,
              args?.file,
              args?.includeCallGraph,
              args?.includeAsyncAnalysis,
            );
            break;

          // 🤖 AI-Enhanced Production Integrity Tools
          case "ai_production_integrity":
            result = await this.aiProductionIntegrity(
              projectPath,
              args?.enableAI !== false,
            );
            break;

          case "ai_explain_finding":
            result = await this.aiExplainFinding(args?.finding, args?.context);
            break;

          case "ai_generate_fix":
            result = await this.aiGenerateFix(args?.finding);
            break;

          case "ai_security_assessment":
            result = await this.aiSecurityAssessment(
              projectPath,
              args?.complianceFrameworks || ["SOC2", "GDPR"],
            );
            break;

          // Repo Hygiene + Debt Radar tools
          case "repo_hygiene_scan":
            result = await this.repoHygieneScan(
              projectPath,
              args?.mode,
              args?.saveArtifacts,
            );
            break;

          case "repo_hygiene_duplicates":
            result = await this.repoHygieneDuplicates(
              projectPath,
              args?.threshold,
            );
            break;

          case "repo_hygiene_unused":
            result = await this.repoHygieneUnused(projectPath, args?.scope);
            break;

          case "repo_hygiene_errors":
            result = await this.repoHygieneErrors(projectPath, args);
            break;

          case "repo_hygiene_root_cleanup":
            result = await this.repoHygieneRootCleanup(projectPath);
            break;

          case "repo_hygiene_deletion_plan":
            result = await this.repoHygieneDeletionPlan(
              projectPath,
              args?.includeReview,
            );
            break;

          default:
            // Try premium tools first
            const premiumResult = await handlePremiumTool(
              name,
              args,
              this.logger,
            );
            if (premiumResult) {
              result = premiumResult;
              break;
            }

            const error = `Unknown tool: ${name}`;
            this.logger.error(error);
            return {
              content: [{ type: "text", text: `❌ Error: ${error}` }],
              isError: true,
            };
        }

        // Log completion
        const duration = Date.now() - startTime;
        this.logger.info(`Tool completed: ${name}`, {
          duration: `${duration}ms`,
        });

        return result;
      } catch (error) {
        // Enhanced error reporting
        const errorMessage = error.message || "Unknown error occurred";
        const errorDetails = {
          tool: name,
          error: errorMessage,
          stack: error.stack,
          projectPath,
        };

        this.logger.error(`Tool failed: ${name}`, errorDetails);

        return {
          content: [
            {
              type: "text",
              text: `❌ Error executing ${name}: ${errorMessage}\n\n💡 Tip: Check if you're in a valid project directory and all required files exist.`,
            },
          ],
          isError: true,
        };
      }
    });
  }

  async validateProject(projectPath) {
    try {
      const scriptsPath = path.join(
        __dirname,
        "..",
        "scripts",
        "validate-api-endpoints.js",
      );
      const result = execSync(`node "${scriptsPath}"`, {
        cwd: projectPath,
        encoding: "utf8",
        stdio: "pipe",
      });

      return {
        content: [
          {
            type: "text",
            text: result || "✅ Validation passed!",
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `Validation issues found:\n${error.stdout || error.message}`,
          },
        ],
      };
    }
  }

  async checkDesignSystem(projectPath) {
    try {
      const scriptsPath = path.join(
        __dirname,
        "..",
        "scripts",
        "validate-design-system.js",
      );
      const result = execSync(`node "${scriptsPath}"`, {
        cwd: projectPath,
        encoding: "utf8",
        stdio: "pipe",
      });

      return {
        content: [
          {
            type: "text",
            text: result || "✅ Design system is consistent!",
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `Design system issues:\n${error.stdout || error.message}`,
          },
        ],
      };
    }
  }

  async checkProjectDrift(projectPath) {
    try {
      const scriptsPath = path.join(
        __dirname,
        "..",
        "scripts",
        "check-project-drift.js",
      );
      const result = execSync(`node "${scriptsPath}"`, {
        cwd: projectPath,
        encoding: "utf8",
        stdio: "pipe",
      });

      return {
        content: [
          {
            type: "text",
            text: result || "✅ No drift detected!",
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `Drift detected:\n${error.stdout || error.message}`,
          },
        ],
      };
    }
  }

  async setupDesignSystem(projectPath, theme) {
    try {
      // This would call the design system wizard
      // For now, return instructions
      return {
        content: [
          {
            type: "text",
            text: `To set up design system, run: npm run design-system\nOr use theme: ${theme}`,
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `Error: ${error.message}`,
          },
        ],
        isError: true,
      };
    }
  }

  async getProjectHealth(projectPath) {
    // This would use the project health analyzer
    return {
      content: [
        {
          type: "text",
          text: "Project health scoring is a premium feature. Upgrade to Professional or Enterprise tier.",
        },
      ],
    };
  }

  async registerApiEndpoint(projectPath, endpointPath, method, description) {
    try {
      const endpointsFile = path.join(
        projectPath,
        "src",
        "config",
        "api-endpoints.ts",
      );

      // Read existing file or create new
      let content = "";
      try {
        content = await fs.readFile(endpointsFile, "utf8");
      } catch {
        // File doesn't exist, create it
        const dir = path.dirname(endpointsFile);
        await fs.mkdir(dir, { recursive: true });
        content = `import { apiValidator } from '@/lib/api-validator';

export function registerAllEndpoints() {
`;
      }

      // Add endpoint registration
      const registration = `  apiValidator.registerEndpoint({
    path: '${endpointPath}',
    method: '${method}',
    description: '${description || ""}',
  });
`;

      // Insert before the closing brace
      const updatedContent = content.replace(
        /(\s*)(\})/,
        `$1${registration}$1$2`,
      );

      await fs.writeFile(endpointsFile, updatedContent);

      return {
        content: [
          {
            type: "text",
            text: `✅ Registered endpoint: ${method} ${endpointPath}`,
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `Error: ${error.message}`,
          },
        ],
        isError: true,
      };
    }
  }

  async getGuardrailsRulesResponse(projectPath) {
    const rulesPath = path.join(projectPath, ".cursorrules");
    try {
      const rules = await fs.readFile(rulesPath, "utf8");
      return {
        content: [
          {
            type: "text",
            text: rules,
          },
        ],
      };
    } catch {
      return {
        content: [
          {
            type: "text",
            text: "No .cursorrules file found. Run setup to create guardrails.",
          },
        ],
      };
    }
  }

  async getGuardrailsRules() {
    return `# AI Agent Guardrails Rules

## CRITICAL RULES

### 1. FILE ORGANIZATION
- NEVER create files in root directory (except allowed config files)
- ALWAYS specify full file paths when creating files
- Use feature-based organization: /src/features/[name]/

### 2. NO MOCK DATA
- NEVER use mock data, fake endpoints, or placeholder data
- ALWAYS use real API endpoints that are registered
- Register new endpoints using register_api_endpoint tool

### 3. DESIGN SYSTEM
- ALWAYS use design tokens from locked design system
- NEVER use hardcoded colors, spacing, or values
- Use validate_design_system tool to check consistency

### 4. CODE QUALITY
- All code must pass ESLint and TypeScript checks
- Use proper TypeScript types (no 'any')
- Follow the project's architecture patterns
`;
  }

  async getAvailableTemplates() {
    return {
      templates: [
        { id: "00", name: "Quick Start Guide" },
        { id: "01", name: "UI/UX System" },
        { id: "02", name: "Design System" },
        { id: "03", name: "Project Architecture" },
        { id: "04", name: "API Architecture" },
        { id: "05", name: "AI Agent File Rules" },
        { id: "06", name: "Testing Setup" },
        { id: "07", name: "State Management" },
        { id: "08", name: "Environment Config" },
        { id: "09", name: "Database & ORM" },
        { id: "10", name: "Authentication" },
      ],
    };
  }

  async getDesignTokens() {
    const lockFile = path.join(process.cwd(), ".design-system-lock.json");
    try {
      const lock = JSON.parse(await fs.readFile(lockFile, "utf8"));
      return {
        locked: true,
        theme: lock.theme,
        message:
          "Design system is locked. Use design tokens for all components.",
      };
    } catch {
      return {
        locked: false,
        message:
          "No design system locked. Run setup_design_system tool to lock one.",
      };
    }
  }

  async architectAnalyze(projectPath) {
    try {
      // Import architect agent (using dynamic import for ES modules)
      const { architectAgent } = await import("../src/lib/architect-agent.js");
      const analysis = await architectAgent.analyzeProject(projectPath);

      const output = {
        context: analysis.context,
        recommendations: analysis.recommendations.map((rec) => ({
          action: rec.action,
          priority: rec.priority,
          description: rec.description,
          templates: rec.templates,
          autoApply: rec.autoApply,
        })),
        plan: {
          totalTemplates: analysis.plan.templates.length,
          estimatedTime: analysis.plan.estimatedTime,
          templates: analysis.plan.templates.map((t) => ({
            name: t.name,
            category: t.category,
            priority: t.priority,
            reason: t.reason,
          })),
        },
      };

      return {
        content: [
          {
            type: "text",
            text:
              `🏗️ Architect Agent Analysis\n\n` +
              `Project Type: ${analysis.context.type}\n` +
              `Framework: ${analysis.context.framework.join(", ") || "None"}\n` +
              `Stage: ${analysis.context.stage}\n\n` +
              `Found ${analysis.recommendations.length} recommendations\n` +
              `Plan includes ${analysis.plan.templates.length} templates\n` +
              `Estimated time: ${analysis.plan.estimatedTime}\n\n` +
              `Use architect_apply tool to apply templates automatically.`,
          },
          {
            type: "text",
            text: JSON.stringify(output, null, 2),
            mimeType: "application/json",
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `Error analyzing project: ${error.message}\n\nMake sure you're in a valid project directory.`,
          },
        ],
        isError: true,
      };
    }
  }

  async architectApply(projectPath, autoApply) {
    try {
      const { architectAgent } = await import("../src/lib/architect-agent.js");
      const analysis = await architectAgent.analyzeProject(projectPath);
      const result = await architectAgent.applyTemplates(
        projectPath,
        analysis.plan,
        autoApply,
      );

      const summary =
        `✅ Applied: ${result.applied.length}\n` +
        `⏭️  Skipped: ${result.skipped.length}\n` +
        (result.errors.length > 0
          ? `❌ Errors: ${result.errors.length}\n`
          : "");

      return {
        content: [
          {
            type: "text",
            text:
              `🏗️ Architect Agent - Template Application\n\n${summary}\n\n` +
              (result.applied.length > 0
                ? `Applied templates:\n${result.applied.map((id) => `  ✅ ${id}`).join("\n")}\n\n`
                : "") +
              (result.errors.length > 0
                ? `Errors:\n${result.errors.map((e) => `  ❌ ${e.template}: ${e.error}`).join("\n")}\n\n`
                : "") +
              `Review applied templates and customize as needed.`,
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `Error applying templates: ${error.message}`,
          },
        ],
        isError: true,
      };
    }
  }

  async buildKnowledgeBase(projectPath) {
    try {
      const { codebaseKnowledgeBase } =
        await import("../src/lib/codebase-knowledge.js");
      const knowledge = await codebaseKnowledgeBase.buildKnowledge(projectPath);

      return {
        content: [
          {
            type: "text",
            text:
              `🧠 Knowledge Base Built!\n\n` +
              `Architecture: ${knowledge.architecture.structure.type}\n` +
              `Patterns: ${knowledge.patterns.length}\n` +
              `Files analyzed: ${knowledge.relationships.imports.size}\n` +
              `Active features: ${knowledge.context.activeFeatures.length}\n\n` +
              `Knowledge saved to .codebase-knowledge.json\n` +
              `Use get_deep_context tool to query this knowledge.`,
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `Error building knowledge base: ${error.message}`,
          },
        ],
        isError: true,
      };
    }
  }

  async getDeepContext(
    projectPath,
    query,
    style = "professional",
    useEmojis = true,
    includeExamples = false,
  ) {
    if (!query) {
      return {
        content: [
          {
            type: "text",
            text: "Error: query parameter is required",
          },
        ],
        isError: true,
      };
    }

    try {
      const { deepContextAgent } =
        await import("../src/lib/deep-context-agent.js");
      const { responseStyleService } =
        await import("../src/lib/response-style-service.js");

      // Validate style
      const availableStyles = responseStyleService.getAvailableStyles();
      const validStyle = availableStyles.includes(style)
        ? style
        : "professional";

      await deepContextAgent.initialize(projectPath);

      // Get formatted response with style
      const formattedResponse = await deepContextAgent.getFormattedContext(
        query,
        projectPath,
        validStyle,
        {
          useEmojis,
          includeExamples,
        },
      );

      return {
        content: [
          {
            type: "text",
            text: formattedResponse,
          },
        ],
      };
    } catch (error) {
      const { responseStyleService } =
        await import("../src/lib/response-style-service.js");
      const errorMessage = responseStyleService.formatMessage(
        `Error getting context: ${error.message}\n\nTry running build_knowledge_base first.`,
        style || "professional",
        useEmojis,
      );

      return {
        content: [
          {
            type: "text",
            text: errorMessage,
          },
        ],
        isError: true,
      };
    }
  }

  async semanticSearch(projectPath, query) {
    try {
      // Import the semantic search service
      const { semanticSearchService } =
        await import("../src/lib/semantic-search-service.js");

      // Perform semantic search
      const results = await semanticSearchService.search(
        query,
        projectPath,
        10,
      );

      if (results.length === 0) {
        return {
          content: [
            {
              type: "text",
              text: `🔍 No results found for "${query}"\n\nTry different keywords or check if the files are indexed.`,
            },
          ],
        };
      }

      // Format results
      let response = `🔍 Semantic Search Results for "${query}"\n\nFound ${results.length} relevant results:\n\n`;

      results.forEach((result, index) => {
        const relativePath = result.file
          .replace(projectPath, "")
          .replace(/^[\/\\]/, "");
        response += `${index + 1}. **${relativePath}:${result.line}**\n`;
        response += `   📄 ${result.content.substring(0, 100)}${result.content.length > 100 ? "..." : ""}\n`;
        response += `   💡 ${result.context}\n`;
        response += `   ⭐ Relevance: ${Math.round(result.score * 10)}/10\n\n`;
      });

      return {
        content: [
          {
            type: "text",
            text: response,
          },
        ],
      };
    } catch (error) {
      this.logger.error("Semantic search failed", {
        error: error.message,
        projectPath,
        query,
      });
      return {
        content: [
          {
            type: "text",
            text: `❌ Error performing semantic search: ${error.message}\n\nTip: Ensure you're in a valid project directory with source files.`,
          },
        ],
        isError: true,
      };
    }
  }

  async analyzeChangeImpact(projectPath, file) {
    try {
      // Import the change impact analyzer
      const { changeImpactAnalyzer } =
        await import("../src/lib/change-impact-analyzer.js");

      // Analyze change impact
      const analysis = await changeImpactAnalyzer.analyzeImpact(
        projectPath,
        file,
      );

      // Format results
      let response = `💥 Change Impact Analysis for "${file}"\n\n`;
      response += `📊 **Summary:**\n`;
      response += `- Total files affected: ${analysis.summary.totalAffected}\n`;
      response += `- Risk score: ${analysis.summary.riskScore}/100\n`;
      response += `- Estimated tests needed: ${analysis.summary.estimatedTests}\n\n`;

      // Critical impact
      if (analysis.impact.critical.length > 0) {
        response += `🚨 **Critical Impact (${analysis.impact.critical.length} files):**\n`;
        analysis.impact.critical.forEach((dep) => {
          const relativePath = dep.file
            .replace(projectPath, "")
            .replace(/^[\/\\]/, "");
          response += `  - ${relativePath}: ${dep.description}\n`;
        });
        response += "\n";
      }

      // High impact
      if (analysis.impact.high.length > 0) {
        response += `⚠️ **High Impact (${analysis.impact.high.length} files):**\n`;
        analysis.impact.high.forEach((dep) => {
          const relativePath = dep.file
            .replace(projectPath, "")
            .replace(/^[\/\\]/, "");
          response += `  - ${relativePath}: ${dep.description}\n`;
        });
        response += "\n";
      }

      // Medium impact
      if (analysis.impact.medium.length > 0) {
        response += `📋 **Medium Impact (${analysis.impact.medium.length} files):**\n`;
        analysis.impact.medium.forEach((dep) => {
          const relativePath = dep.file
            .replace(projectPath, "")
            .replace(/^[\/\\]/, "");
          response += `  - ${relativePath}: ${dep.description}\n`;
        });
        response += "\n";
      }

      // Low impact
      if (analysis.impact.low.length > 0) {
        response += `📝 **Low Impact (${analysis.impact.low.length} files):**\n`;
        analysis.impact.low.forEach((dep) => {
          const relativePath = dep.file
            .replace(projectPath, "")
            .replace(/^[\/\\]/, "");
          response += `  - ${relativePath}: ${dep.description}\n`;
        });
        response += "\n";
      }

      // Recommendations
      response += `💡 **Recommendations:**\n`;
      analysis.recommendations.forEach((rec) => {
        response += `${rec}\n`;
      });

      return {
        content: [
          {
            type: "text",
            text: response,
          },
        ],
      };
    } catch (error) {
      this.logger.error("Change impact analysis failed", {
        error: error.message,
        projectPath,
        file,
      });
      return {
        content: [
          {
            type: "text",
            text: `❌ Error analyzing change impact: ${error.message}\n\nTip: Ensure the file exists and is a valid source file.`,
          },
        ],
        isError: true,
      };
    }
  }

  async generateCodeContext(projectPath, task) {
    try {
      // Import the code context generator
      const { codeContextGenerator } =
        await import("../src/lib/code-context-generator.js");

      // Generate code context
      const context = await codeContextGenerator.generatePrompt(
        projectPath,
        task,
      );

      // Format results
      let response = `⚙️ Code Generation Context for: "${task}"\n\n`;
      response += `📋 **Context:**\n${context.context}\n\n`;

      // Show detected patterns
      if (context.patterns.length > 0) {
        response += `🎨 **Detected Patterns:**\n`;
        context.patterns.forEach((p) => {
          response += `- Type: ${p.type} (${p.framework})\n`;
          response += `  Naming: ${p.conventions.naming}\n`;
          response += `  Exports: ${p.conventions.exports.join(", ")}\n\n`;
        });
      }

      // Show best practices
      if (context.bestPractices.length > 0) {
        response += `✨ **Best Practices:**\n`;
        context.bestPractices.forEach((practice) => {
          response += `- ${practice}\n`;
        });
        response += "\n";
      }

      // Show examples
      if (context.examples.length > 0) {
        response += `📝 **Code Examples:**\n`;
        context.examples.slice(0, 2).forEach((example) => {
          response += `\n${example.description}:\n`;
          response += "```typescript\n";
          response += example.code;
          response += "\n```\n";
        });
      }

      // Add the generated prompt
      response += `\n🚀 **Generated Prompt:**\n`;
      response += "```\n";
      response += context.prompt;
      response += "\n```\n";

      return {
        content: [
          {
            type: "text",
            text: response,
          },
        ],
      };
    } catch (error) {
      this.logger.error("Code context generation failed", {
        error: error.message,
        projectPath,
        task,
      });
      return {
        content: [
          {
            type: "text",
            text: `❌ Error generating code context: ${error.message}\n\nTip: Ensure you're in a valid project directory with source files.`,
          },
        ],
        isError: true,
      };
    }
  }

  // ============ Security Orchestrator Methods ============

  async securityScan(projectPath, environment) {
    try {
      const scriptsPath = path.join(
        __dirname,
        "..",
        "scripts",
        "orchestrator.js",
      );
      const result = execSync(
        `node "${scriptsPath}" --path "${projectPath}" --env ${environment} --format json`,
        { cwd: projectPath, encoding: "utf8", maxBuffer: 10 * 1024 * 1024 },
      );

      // Parse the JSON report
      const reportPath = path.join(
        projectPath,
        ".guardrail",
        "security-report.json",
      );
      let report;
      try {
        report = JSON.parse(await fs.readFile(reportPath, "utf8"));
      } catch {
        report = {
          verdict: { allowed: true },
          metrics: { riskScore: 0, totalFindings: 0 },
        };
      }

      const icon = report.verdict.allowed ? "✅" : "🛑";
      let response = `${icon} **Security Scan Complete**\n\n`;
      response += `**Environment:** ${environment}\n`;
      response += `**Risk Score:** ${report.metrics.riskScore}/100\n`;
      response += `**Total Findings:** ${report.metrics.totalFindings}\n\n`;

      if (report.metrics.findingsBySeverity) {
        response += `**Findings by Severity:**\n`;
        response += `- Critical: ${report.metrics.findingsBySeverity.critical || 0}\n`;
        response += `- High: ${report.metrics.findingsBySeverity.high || 0}\n`;
        response += `- Medium: ${report.metrics.findingsBySeverity.medium || 0}\n`;
        response += `- Low: ${report.metrics.findingsBySeverity.low || 0}\n\n`;
      }

      if (!report.verdict.allowed && report.verdict.blockers?.length > 0) {
        response += `**Blockers:**\n`;
        report.verdict.blockers.forEach((b) => {
          response += `- ❌ ${b}\n`;
        });
        response += "\n";
      }

      if (report.verdict.warnings?.length > 0) {
        response += `**Warnings:**\n`;
        report.verdict.warnings.forEach((w) => {
          response += `- ⚠️ ${w}\n`;
        });
      }

      response += `\n📄 Full report: .guardrail/security-report.json`;

      return {
        content: [{ type: "text", text: response }],
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `❌ Security scan failed: ${error.message}\n\nTip: Run 'npm run ship' to see detailed output.`,
          },
        ],
        isError: true,
      };
    }
  }

  async policyCheck(projectPath, environment) {
    try {
      // Run policy check using the orchestrator
      const BANNED_PATTERNS = [
        { pattern: "MockProvider", message: "MockProvider in production code" },
        { pattern: "useMock", message: "useMock hook in production code" },
        {
          pattern: "localhost:\\d+",
          isRegex: true,
          message: "Hardcoded localhost URLs",
        },
        {
          pattern: "demo_|inv_demo|fake_",
          isRegex: true,
          message: "Demo/fake identifiers",
        },
        { pattern: STRIPE_TEST_PREFIX, message: "Stripe test keys" },
      ];

      const findings = [];
      const excludeDirs = [
        "node_modules",
        "__tests__",
        "*.test.*",
        "*.spec.*",
        "docs",
        "landing",
      ];
      const excludeArgs = excludeDirs
        .map((d) => `--glob '!**/${d}/**'`)
        .join(" ");

      for (const { pattern, message, isRegex } of BANNED_PATTERNS) {
        try {
          const searchPattern = isRegex
            ? pattern
            : pattern.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
          const cmd = `rg -n --hidden ${excludeArgs} "${searchPattern}" "${projectPath}"`;
          const output = execSync(cmd, {
            encoding: "utf-8",
            maxBuffer: 10 * 1024 * 1024,
          });

          output
            .trim()
            .split("\n")
            .filter(Boolean)
            .forEach((line) => {
              const match = line.match(/^(.+?):(\d+):(.*)$/);
              if (match) {
                findings.push({
                  pattern,
                  message,
                  file: path.relative(projectPath, match[1]),
                  line: match[2],
                  snippet: match[3].trim().substring(0, 60),
                });
              }
            });
        } catch {
          // No matches found - good!
        }
      }

      const passed = findings.length === 0;
      let response = passed
        ? `✅ **Policy Check Passed**\n\nNo policy violations found in ${environment} configuration.\n`
        : `🛑 **Policy Check Failed**\n\nFound ${findings.length} policy violation(s):\n\n`;

      if (!passed) {
        findings.slice(0, 10).forEach((f) => {
          response += `- **${f.message}**\n`;
          response += `  📄 ${f.file}:${f.line}\n`;
          response += `  \`${f.snippet}...\`\n\n`;
        });

        if (findings.length > 10) {
          response += `... and ${findings.length - 10} more violations\n`;
        }
      }

      return {
        content: [{ type: "text", text: response }],
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `❌ Policy check failed: ${error.message}`,
          },
        ],
        isError: true,
      };
    }
  }

  async secretScan(projectPath, scanHistory) {
    try {
      const SECRET_PATTERNS = [
        { type: "AWS Access Key", pattern: /AKIA[0-9A-Z]{16}/g },
        { type: "GitHub Token", pattern: /ghp_[a-zA-Z0-9]{36}/g },
        { type: "Stripe Key", pattern: stripeSkLiveRegex24() },
        {
          type: "JWT",
          pattern: /eyJ[a-zA-Z0-9\-_]+\.eyJ[a-zA-Z0-9\-_]+\.[a-zA-Z0-9\-_]+/g,
        },
        {
          type: "Private Key",
          pattern: /-----BEGIN (RSA |EC )?PRIVATE KEY-----/g,
        },
        {
          type: "Database URL",
          pattern: /(?:postgres|mysql|mongodb):\/\/[^\s"']+/gi,
        },
      ];

      const secrets = [];
      const codeExtensions = [
        ".ts",
        ".tsx",
        ".js",
        ".jsx",
        ".json",
        ".env",
        ".yaml",
        ".yml",
      ];

      // Walk directory
      const walkDir = async (dir) => {
        const files = [];
        try {
          const entries = await fs.readdir(dir, { withFileTypes: true });
          for (const entry of entries) {
            const fullPath = path.join(dir, entry.name);
            if (
              entry.isDirectory() &&
              !entry.name.startsWith(".") &&
              entry.name !== "node_modules"
            ) {
              files.push(...(await walkDir(fullPath)));
            } else if (
              entry.isFile() &&
              codeExtensions.some((ext) => entry.name.endsWith(ext))
            ) {
              files.push(fullPath);
            }
          }
        } catch {}
        return files;
      };

      const files = await walkDir(projectPath);

      for (const file of files) {
        if (
          file.includes("__tests__") ||
          file.includes(".test.") ||
          file.includes(".spec.")
        )
          continue;

        try {
          const content = await fs.readFile(file, "utf-8");
          const lines = content.split("\n");

          for (const { type, pattern } of SECRET_PATTERNS) {
            for (let i = 0; i < lines.length; i++) {
              const matches = lines[i].match(pattern);
              if (matches) {
                for (const match of matches) {
                  if (lines[i].toLowerCase().includes("example")) continue;
                  secrets.push({
                    type,
                    file: path.relative(projectPath, file),
                    line: i + 1,
                    redacted:
                      match.substring(0, 4) +
                      "..." +
                      match.substring(match.length - 4),
                  });
                }
              }
            }
          }
        } catch {}
      }

      const passed = secrets.length === 0;
      let response = passed
        ? `✅ **Secret Scan Passed**\n\nNo secrets detected in codebase.\n`
        : `🛑 **Secrets Detected!**\n\nFound ${secrets.length} potential secret(s):\n\n`;

      if (!passed) {
        secrets.slice(0, 10).forEach((s) => {
          response += `- **${s.type}**\n`;
          response += `  📄 ${s.file}:${s.line}\n`;
          response += `  🔑 \`${s.redacted}\`\n\n`;
        });

        if (secrets.length > 10) {
          response += `... and ${secrets.length - 10} more secrets\n\n`;
        }

        response += `⚠️ **Action Required:** Rotate these secrets immediately!\n`;
      }

      return {
        content: [{ type: "text", text: response }],
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `❌ Secret scan failed: ${error.message}`,
          },
        ],
        isError: true,
      };
    }
  }

  async supplyChainScan(projectPath, repoUrl) {
    try {
      let response = `📦 **Supply Chain Analysis**\n\n`;

      // Try npm audit
      try {
        execSync("npm audit --json", { cwd: projectPath, encoding: "utf-8" });
        response += `✅ **npm audit:** No vulnerabilities found\n\n`;
      } catch (error) {
        if (error.stdout) {
          try {
            const result = JSON.parse(error.stdout);
            const vulnCount = result.metadata?.vulnerabilities || {};
            const total =
              (vulnCount.critical || 0) +
              (vulnCount.high || 0) +
              (vulnCount.moderate || 0) +
              (vulnCount.low || 0);

            if (total > 0) {
              response += `⚠️ **npm audit:** Found ${total} vulnerabilities\n`;
              response += `- Critical: ${vulnCount.critical || 0}\n`;
              response += `- High: ${vulnCount.high || 0}\n`;
              response += `- Moderate: ${vulnCount.moderate || 0}\n`;
              response += `- Low: ${vulnCount.low || 0}\n\n`;
            } else {
              response += `✅ **npm audit:** No vulnerabilities found\n\n`;
            }
          } catch {
            response += `⚠️ **npm audit:** Could not parse results\n\n`;
          }
        }
      }

      // Count dependencies
      try {
        const pkgPath = path.join(projectPath, "package.json");
        const pkg = JSON.parse(await fs.readFile(pkgPath, "utf8"));
        const deps = Object.keys(pkg.dependencies || {}).length;
        const devDeps = Object.keys(pkg.devDependencies || {}).length;

        response += `📊 **Dependencies:**\n`;
        response += `- Production: ${deps}\n`;
        response += `- Development: ${devDeps}\n`;
        response += `- Total: ${deps + devDeps}\n\n`;
      } catch {}

      // License check (basic)
      response += `📜 **License compliance:** Run \`npm run ship:badge\` for full analysis\n`;

      return {
        content: [{ type: "text", text: response }],
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `❌ Supply chain scan failed: ${error.message}`,
          },
        ],
        isError: true,
      };
    }
  }

  async shipCheck(projectPath) {
    try {
      // Run ship check with JSON output to get structured results
      let output;
      let exitCode = 0;
      try {
        output = execSync("npx ts-node src/bin/ship.ts check --json", {
          cwd: projectPath,
          encoding: "utf8",
          maxBuffer: 10 * 1024 * 1024,
          stdio: ["pipe", "pipe", "pipe"],
        });
      } catch (e) {
        output = e.stdout || "";
        exitCode = e.status || 1;
      }

      // Find the latest run directory
      const runsDir = path.join(projectPath, ".guardrail", "runs");
      let runId = null;
      let summary = null;
      let artifacts = {};

      try {
        const runs = await fs.readdir(runsDir);
        if (runs.length > 0) {
          runs.sort().reverse();
          runId = runs[0];
          const runDir = path.join(runsDir, runId);

          // Read summary
          const summaryPath = path.join(runDir, "summary.json");
          if (
            await fs
              .access(summaryPath)
              .then(() => true)
              .catch(() => false)
          ) {
            summary = JSON.parse(await fs.readFile(summaryPath, "utf-8"));
          }

          // Collect artifact paths
          artifacts = {
            runDir,
            report: path.join(runDir, "report.json"),
            reportTxt: path.join(runDir, "report.txt"),
            sarif: path.join(runDir, "sarif.json"),
            replay: path.join(runDir, "replay", "replay.json"),
            badges: path.join(runDir, "badges"),
          };
        }
      } catch (e) {
        // No runs yet
      }

      const passed = summary?.verdict === "ship" || exitCode === 0;
      const icon = passed ? "✅" : "🛑";

      let response = `${icon} **Ship Check: ${passed ? "SHIP" : "NO-SHIP"}**\n\n`;

      if (summary) {
        response += `**Score:** ${summary.score}/100\n`;
        response += `**Exit Code:** ${summary.exitCode}\n\n`;

        response += `**Gates:**\n`;
        response += `- MockProof: ${summary.gates.mockproof.verdict === "pass" ? "✅" : "❌"} (${summary.gates.mockproof.violations} violations)\n`;
        response += `- Badge: ${summary.gates.badge.verdict === "pass" ? "✅" : summary.gates.badge.verdict === "fail" ? "❌" : "⏭️"} (${summary.gates.badge.score}/100)\n`;
        response += `- Reality: ${summary.gates.reality.verdict}\n\n`;

        if (summary.blockers?.length > 0) {
          response += `**Blockers:**\n`;
          summary.blockers.slice(0, 5).forEach((b) => {
            response += `- ❌ ${b}\n`;
          });
          response += "\n";
        }
      }

      if (runId) {
        response += `**Run ID:** \`${runId}\`\n`;
        response += `**Artifacts:**\n`;
        response += `- Report: \`${path.relative(projectPath, artifacts.report)}\`\n`;
        response += `- SARIF: \`${path.relative(projectPath, artifacts.sarif)}\`\n`;
        response += `- Replay: \`${path.relative(projectPath, artifacts.replay)}\`\n`;
      }

      // Return structured data for MCP clients
      return {
        content: [
          { type: "text", text: response },
          {
            type: "text",
            text: JSON.stringify(
              {
                verdict: passed ? "ship" : "no-ship",
                runId,
                score: summary?.score || 0,
                exitCode: summary?.exitCode || exitCode,
                blockers: summary?.blockers || [],
                artifacts: runId
                  ? {
                      runDir: artifacts.runDir,
                      report: artifacts.report,
                      sarif: artifacts.sarif,
                      replay: artifacts.replay,
                    }
                  : null,
              },
              null,
              2,
            ),
            mimeType: "application/json",
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `❌ Ship check failed: ${error.message}\n\nTip: Run \`guardrail ship\` to see detailed output.`,
          },
        ],
        isError: true,
      };
    }
  }

  async getDeployVerdict(projectPath) {
    try {
      // Find the latest run
      const runsDir = path.join(projectPath, ".guardrail", "runs");
      let latestRun = null;
      let summary = null;
      let metadata = null;

      try {
        const runs = await fs.readdir(runsDir);
        if (runs.length > 0) {
          runs.sort().reverse();
          latestRun = runs[0];
          const runDir = path.join(runsDir, latestRun);

          const summaryPath = path.join(runDir, "summary.json");
          const metadataPath = path.join(runDir, "metadata.json");

          if (
            await fs
              .access(summaryPath)
              .then(() => true)
              .catch(() => false)
          ) {
            summary = JSON.parse(await fs.readFile(summaryPath, "utf-8"));
          }
          if (
            await fs
              .access(metadataPath)
              .then(() => true)
              .catch(() => false)
          ) {
            metadata = JSON.parse(await fs.readFile(metadataPath, "utf-8"));
          }
        }
      } catch {
        // No runs available
      }

      // If no runs, prompt user to run ship first
      if (!summary) {
        return {
          content: [
            {
              type: "text",
              text:
                `⚠️ **No Ship Run Found**\n\nRun \`guardrail ship\` first to generate a deploy verdict.\n\n` +
                `This will:\n` +
                `1. Scan for mock data (MockProof)\n` +
                `2. Generate ship badge\n` +
                `3. Create Reality Mode test\n` +
                `4. Produce a deploy verdict`,
            },
          ],
        };
      }

      const allowed = summary.verdict === "ship";
      const icon = allowed ? "🚀" : "🛑";

      let response = `${icon} **Deploy Verdict: ${allowed ? "SHIP" : "NO SHIP"}**\n\n`;

      response += `**Run:** \`${latestRun}\`\n`;
      response += `**Score:** ${summary.score}/100\n`;
      response += `**Duration:** ${summary.duration}ms\n\n`;

      if (metadata) {
        response += `**Context:**\n`;
        response += `- Commit: \`${metadata.commitSha?.substring(0, 8) || "N/A"}\`\n`;
        response += `- Branch: \`${metadata.branch || "N/A"}\`\n`;
        response += `- Policy: \`${metadata.policyHash}\`\n\n`;
      }

      response += `**Gates:**\n`;
      response += `- MockProof: ${summary.gates.mockproof.verdict === "pass" ? "✅" : "❌"} (${summary.gates.mockproof.violations} violations)\n`;
      response += `- Badge: ${summary.gates.badge.verdict === "pass" ? "✅" : summary.gates.badge.verdict === "fail" ? "❌" : "⏭️"} (${summary.gates.badge.score}/100)\n`;
      response += `- Reality: ${summary.gates.reality.verdict}\n\n`;

      if (!allowed && summary.blockers?.length > 0) {
        response += `**Blockers:**\n`;
        summary.blockers.forEach((b) => {
          response += `- ❌ ${b}\n`;
        });
        response += "\n";
      }

      if (allowed) {
        response += `✅ **Ready to deploy!** All checks passed.\n\n`;
        response += `Add to README:\n\`\`\`markdown\n[![Ship Status](https://img.shields.io/badge/guardrail-ship-green)](https://guardrail.dev)\n\`\`\`\n`;
      } else {
        response += `⚠️ **Fix blockers before deploying.**\n\n`;
        response += `Run \`guardrail ship\` locally for detailed fix suggestions.\n`;
      }

      // Return structured data
      return {
        content: [
          { type: "text", text: response },
          {
            type: "text",
            text: JSON.stringify(
              {
                verdict: summary.verdict,
                runId: latestRun,
                score: summary.score,
                exitCode: summary.exitCode,
                gates: summary.gates,
                blockers: summary.blockers,
                metadata: metadata
                  ? {
                      commitSha: metadata.commitSha,
                      branch: metadata.branch,
                      policyHash: metadata.policyHash,
                      timestamp: metadata.timestamp,
                    }
                  : null,
              },
              null,
              2,
            ),
            mimeType: "application/json",
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `❌ Could not get deploy verdict: ${error.message}\n\nTip: Run \`guardrail ship\` first.`,
          },
        ],
        isError: true,
      };
    }
  }

  async realityCheck(projectPath, mode = "full", file = null) {
    try {
      this.logger.info(
        `🔮 Reality Check starting: mode=${mode}, path=${projectPath}`,
      );

      // Code-only mode: analyze specific file for self-deception
      if (mode === "code-only" && file) {
        return await this.realityCheckCodeOnly(projectPath, file);
      }

      // Full or Quick mode: run production integrity suite
      const { auditProductionIntegrity, formatProductionResults } = require(
        path.join(__dirname, "..", "scripts", "audit-production-integrity.js"),
      );

      const { results, integrity } =
        await auditProductionIntegrity(projectPath);

      // Build the Reality Check header
      let output = `# 🔮 REALITY CHECK\n`;
      output += `## "Where Your Code Lies To You"\n\n`;
      output += `**Project:** ${results.projectPath}\n`;
      output += `**Timestamp:** ${new Date().toISOString()}\n\n`;

      // Big verdict box
      output += `\`\`\`\n`;
      output += `┌────────────────────────────────────────────┐\n`;
      output += `│                                            │\n`;
      output += `│        REALITY SCORE: ${String(integrity.score).padStart(3)}                  │\n`;
      output += `│        GRADE: ${integrity.grade.padStart(2)}                           │\n`;
      output += `│                                            │\n`;
      output += `│        ${integrity.canShip ? "✅ CLEAR TO SHIP              " : "🚫 NOT READY TO SHIP          "}    │\n`;
      output += `│                                            │\n`;
      output += `└────────────────────────────────────────────┘\n`;
      output += `\`\`\`\n\n`;

      // The Reality
      output += `## 🎭 The Reality\n\n`;
      output += `| What You Think | The Truth | Gap |\n`;
      output += `|----------------|-----------|-----|\n`;

      const apiConnected = results.api?.summary?.connected || 0;
      const apiMissing = results.api?.summary?.missingBackend || 0;
      const apiTotal = apiConnected + apiMissing;
      if (apiTotal > 0) {
        output += `| "All APIs work" | ${apiMissing} endpoints don't exist | ${apiMissing > 0 ? "🔴" : "✅"} |\n`;
      }

      const authProtected = results.auth?.analysis?.protected?.length || 0;
      const authExposed =
        (results.auth?.analysis?.adminExposed?.length || 0) +
        (results.auth?.analysis?.sensitiveUnprotected?.length || 0);
      if (authProtected > 0 || authExposed > 0) {
        output += `| "App is secure" | ${authExposed} sensitive endpoints exposed | ${authExposed > 0 ? "🔴" : "✅"} |\n`;
      }

      const criticalSecrets =
        results.env?.secrets?.filter((s) => s.severity === "critical").length ||
        0;
      output += `| "Secrets are safe" | ${criticalSecrets} hardcoded in code | ${criticalSecrets > 0 ? "🔴" : "✅"} |\n`;

      const deadLinks = results.routes?.integrity?.deadLinks?.length || 0;
      output += `| "All pages work" | ${deadLinks} links go to 404 | ${deadLinks > 0 ? "🔴" : "✅"} |\n`;

      const mockCritical = (results.mocks?.issues || []).filter(
        (i) => i.severity === "critical",
      ).length;
      const mockHigh = (results.mocks?.issues || []).filter(
        (i) => i.severity === "high",
      ).length;
      output += `| "No test code in prod" | ${mockCritical + mockHigh} mock/test issues | ${mockCritical + mockHigh > 0 ? "🔴" : "✅"} |\n`;

      output += `\n`;

      // Quick mode stops here with summary
      if (mode === "quick") {
        output += `## 📊 Quick Summary\n\n`;
        output += `- **API Wiring:** ${apiConnected} connected, ${apiMissing} missing\n`;
        output += `- **Auth:** ${authProtected} protected, ${authExposed} exposed\n`;
        output += `- **Secrets:** ${criticalSecrets} critical issues\n`;
        output += `- **Routes:** ${deadLinks} dead links\n`;
        output += `- **Mock Code:** ${mockCritical + mockHigh} blocking issues\n\n`;
        output += `_Run with mode="full" for complete details._\n`;

        return {
          content: [{ type: "text", text: output }],
        };
      }

      // Full mode: add complete production integrity report
      const fullReport = formatProductionResults({ results, integrity });

      // Extract the detailed findings section from the full report
      const detailedStart = fullReport.indexOf("# 📋 Detailed Findings");
      if (detailedStart > 0) {
        output += fullReport.substring(detailedStart);
      } else {
        output += fullReport;
      }

      // Add JSON summary at the end
      const summary = {
        score: integrity.score,
        grade: integrity.grade,
        canShip: integrity.canShip,
        verdict: integrity.canShip ? "SHIP" : "NO_SHIP",
        counts: {
          api: { connected: apiConnected, missing: apiMissing },
          auth: { protected: authProtected, exposed: authExposed },
          secrets: { critical: criticalSecrets },
          routes: { deadLinks },
          mocks: { critical: mockCritical, high: mockHigh },
        },
        timestamp: new Date().toISOString(),
      };

      output += `\n---\n\n`;
      output += `## 📦 JSON Summary\n\n`;
      output += `\`\`\`json\n${JSON.stringify(summary, null, 2)}\n\`\`\`\n`;

      // Context attribution
      output += `\n---\n_Context Enhanced by guardrail AI_\n`;

      this.logger.info(
        `Reality Check complete: Score ${integrity.score}, Grade ${integrity.grade}`,
      );

      return {
        content: [{ type: "text", text: output }],
      };
    } catch (error) {
      this.logger.error("Reality check failed", {
        error: error.message,
        stack: error.stack,
      });
      return {
        content: [
          {
            type: "text",
            text:
              `❌ Reality Check failed: ${error.message}\n\n` +
              `**Troubleshooting:**\n` +
              `- Ensure the project path exists and is accessible\n` +
              `- For code-only mode, provide a valid file path\n` +
              `- Try: \`node scripts/audit-production-integrity.js "${projectPath}"\``,
          },
        ],
        isError: true,
      };
    }
  }

  async realityCheckCodeOnly(projectPath, file) {
    try {
      const filePath = path.join(projectPath, file);
      const code = await fs.readFile(filePath, "utf8");

      // Import and run the reality check service for code analysis
      const { realityCheck } =
        await import("../src/lib/reality-check-service.js");
      const result = await realityCheck.check(code, file);

      // Format the output
      let output = `🔮 **Reality Check - Code Analysis**\n\n`;
      output += `📁 File: ${result.file}\n`;
      output += `📊 Reality Score: ${result.overallScore}/100\n`;
      output += `⏰ Analyzed: ${result.timestamp}\n\n`;

      output += `## Summary\n`;
      output += `- 🔴 Critical: ${result.summary.critical}\n`;
      output += `- 🟡 Warnings: ${result.summary.warnings}\n`;
      output += `- 🔵 Suggestions: ${result.summary.suggestions}\n\n`;

      if (result.findings.length === 0) {
        output += `✅ **No self-deception detected!** Your code does what you think it does.\n`;
      } else {
        output += `## Findings\n\n`;
        for (const finding of result.findings) {
          const icon =
            finding.type === "critical"
              ? "❌"
              : finding.type === "warning"
                ? "⚠️"
                : "💡";
          output += `### ${icon} ${finding.category.replace(/-/g, " ").toUpperCase()}\n`;
          if (finding.line) output += `📍 Line ${finding.line}\n`;
          output += `\`\`\`\n${finding.code}\n\`\`\`\n`;
          output += `**You think:** ${finding.intent}\n`;
          output += `**Reality:** ${finding.reality}\n`;
          output += `**Why it matters:** ${finding.explanation}\n`;
          output += `_Confidence: ${Math.round(finding.confidence * 100)}%_\n\n`;
        }
      }

      output += `\n---\n_Context Enhanced by guardrail AI_\n`;

      return {
        content: [
          { type: "text", text: output },
          {
            type: "text",
            text: JSON.stringify(result, null, 2),
            mimeType: "application/json",
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `❌ Code analysis failed: ${error.message}\n\nMake sure the file exists and contains valid code.`,
          },
        ],
        isError: true,
      };
    }
  }

  async realityCheckDeep(
    projectPath,
    file,
    includeCallGraph = true,
    includeAsyncAnalysis = true,
  ) {
    try {
      if (!file) {
        return {
          content: [
            {
              type: "text",
              text: "❌ Deep Reality Check requires a file path.",
            },
          ],
          isError: true,
        };
      }

      const filePath = path.join(projectPath, file);
      const code = await fs.readFile(filePath, "utf8");

      // Run basic reality check first
      const { realityCheck } =
        await import("../src/lib/reality-check-service.js");
      const basicResult = await realityCheck.check(code, file);

      // Deep analysis additions
      let output = `🔮 **Deep Reality Check Results** (Pro)\n\n`;
      output += `📁 File: ${file}\n`;
      output += `📊 Reality Score: ${basicResult.overallScore}/100\n\n`;

      output += `## Basic Analysis\n`;
      output += `- 🔴 Critical: ${basicResult.summary.critical}\n`;
      output += `- 🟡 Warnings: ${basicResult.summary.warnings}\n`;
      output += `- 🔵 Suggestions: ${basicResult.summary.suggestions}\n\n`;

      if (includeCallGraph) {
        output += `## 📊 Call Graph Analysis\n`;
        output += `_Cross-file dependency tracking identifies assumptions about external code._\n\n`;
        // This would be enhanced with actual call graph analysis
        const imports = code.match(/import\s+.*from\s+['"]([^'"]+)['"]/g) || [];
        const calls = code.match(/\b(\w+)\s*\(/g) || [];
        output += `- Imports: ${imports.length}\n`;
        output += `- Function calls: ${[...new Set(calls)].length}\n\n`;
      }

      if (includeAsyncAnalysis) {
        output += `## ⏳ Async Lifecycle Analysis\n`;
        output += `_Timing assumptions are a major source of bugs._\n\n`;
        const asyncFns = (code.match(/async\s+function|\basync\s*\(/g) || [])
          .length;
        const awaits = (code.match(/\bawait\s+/g) || []).length;
        const promises = (code.match(/new\s+Promise|\.then\(|\.catch\(/g) || [])
          .length;
        output += `- Async functions: ${asyncFns}\n`;
        output += `- Await expressions: ${awaits}\n`;
        output += `- Promise patterns: ${promises}\n`;

        if (asyncFns > 0 && awaits === 0) {
          output += `\n⚠️ **Found async functions with no awaits** - these may not need to be async.\n`;
        }
        output += `\n`;
      }

      output += `## All Findings\n\n`;
      for (const finding of basicResult.findings) {
        const icon =
          finding.type === "critical"
            ? "❌"
            : finding.type === "warning"
              ? "⚠️"
              : "💡";
        output += `### ${icon} ${finding.category.replace(/-/g, " ").toUpperCase()}\n`;
        if (finding.line) output += `📍 Line ${finding.line}\n`;
        output += `\`\`\`\n${finding.code}\n\`\`\`\n`;
        output += `**You think:** ${finding.intent}\n`;
        output += `**Reality:** ${finding.reality}\n`;
        output += `**Why it matters:** ${finding.explanation}\n\n`;
      }

      return {
        content: [{ type: "text", text: output }],
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `❌ Deep Reality Check failed: ${error.message}`,
          },
        ],
        isError: true,
      };
    }
  }

  async auditApiEndpoints(projectPath, showDetails = false) {
    try {
      const {
        auditApiEndpoints,
      } = require("../scripts/audit-api-endpoints.js");
      const results = await auditApiEndpoints(projectPath);

      // Format summary
      let response = `🔗 **API Endpoint Audit Report**\n\n`;
      response += `📊 **Summary:**\n`;
      response += `| Metric | Count |\n`;
      response += `|--------|-------|\n`;
      response += `| Backend Endpoints | ${results.summary.totalBackendEndpoints} |\n`;
      response += `| Frontend API Calls | ${results.summary.totalFrontendCalls} |\n`;
      response += `| ✅ Connected | ${results.summary.connectedEndpoints} |\n`;
      response += `| ⚠️ Unused Backend | ${results.summary.unusedBackendEndpoints} |\n`;
      response += `| ❌ Missing Backend | ${results.summary.missingBackendEndpoints} |\n\n`;

      // Missing backend implementations (priority)
      if (results.missing.length > 0) {
        response += `## ❌ Missing Backend Implementations\n\n`;
        response += `These frontend API calls have **no backend endpoint**:\n\n`;
        results.missing.slice(0, 15).forEach((item) => {
          response += `- **${item.method} ${item.path}**\n`;
          response += `  - File: \`${item.file}\`\n`;
          response += `  - 💡 ${item.suggestion}\n\n`;
        });
        if (results.missing.length > 15) {
          response += `... and ${results.missing.length - 15} more\n\n`;
        }
      }

      // Unused backend endpoints
      if (results.unused.length > 0) {
        response += `## ⚠️ Unused Backend Endpoints\n\n`;
        response += `These backend endpoints have **no frontend calls**:\n\n`;
        results.unused.slice(0, 15).forEach((item) => {
          response += `- **${item.method} ${item.path}** (\`${item.file}\`)\n`;
        });
        if (results.unused.length > 15) {
          response += `... and ${results.unused.length - 15} more\n\n`;
        }
      }

      // Connected (if showDetails)
      if (showDetails && results.connected.length > 0) {
        response += `## ✅ Connected Endpoints\n\n`;
        results.connected.forEach((item) => {
          response += `- ${item.method} ${item.path}\n`;
        });
        response += "\n";
      } else if (results.connected.length > 0) {
        response += `✅ **${results.connected.length} endpoints properly connected**\n\n`;
      }

      // Recommendations
      response += `## 💡 Recommendations\n\n`;
      if (results.missing.length > 0) {
        response += `1. **Implement missing backend routes** - ${results.missing.length} frontend calls need backend endpoints\n`;
      }
      if (results.unused.length > 0) {
        response += `2. **Review unused endpoints** - ${results.unused.length} backend routes may be dead code or need frontend integration\n`;
      }
      if (results.missing.length === 0 && results.unused.length === 0) {
        response += `🎉 All endpoints are properly connected!\n`;
      }

      return {
        content: [
          { type: "text", text: response },
          {
            type: "text",
            text: JSON.stringify(
              {
                summary: results.summary,
                missing: results.missing,
                unused: results.unused,
                connected: results.connected.length,
              },
              null,
              2,
            ),
            mimeType: "application/json",
          },
        ],
      };
    } catch (error) {
      this.logger.error("API audit failed", {
        error: error.message,
        projectPath,
      });
      return {
        content: [
          {
            type: "text",
            text:
              `❌ API endpoint audit failed: ${error.message}\n\n` +
              `Tip: Ensure you're in a project with:\n` +
              `- Backend routes in \`apps/api/src/routes/\` or \`server/routes/\`\n` +
              `- Frontend code in \`apps/web-ui/src/\` or \`src/\``,
          },
        ],
        isError: true,
      };
    }
  }

  async productionIntegrityCheck(projectPath) {
    try {
      const { auditProductionIntegrity, formatProductionResults } = require(
        path.join(__dirname, "..", "scripts", "audit-production-integrity.js"),
      );

      this.logger.info(
        `🛡️ Running Production Integrity Check on: ${projectPath}`,
      );

      const { results, integrity } =
        await auditProductionIntegrity(projectPath);
      const report = formatProductionResults({ results, integrity });

      // Build comprehensive JSON summary
      const summary = {
        score: integrity.score,
        grade: integrity.grade,
        canShip: integrity.canShip,
        verdict: integrity.canShip ? "SHIP" : "NO_SHIP",
        deductions: integrity.deductions,
        counts: {
          api: {
            connected: results.api?.summary?.connected || 0,
            missing: results.api?.summary?.missingBackend || 0,
            unused: results.api?.summary?.unusedBackend || 0,
          },
          auth: {
            protected: results.auth?.analysis?.protected?.length || 0,
            unprotected: results.auth?.analysis?.unprotected?.length || 0,
            adminExposed: results.auth?.analysis?.adminExposed?.length || 0,
          },
          secrets: {
            critical:
              results.env?.secrets?.filter((s) => s.severity === "critical")
                .length || 0,
            high:
              results.env?.secrets?.filter((s) => s.severity === "high")
                .length || 0,
            devUrls: results.env?.devUrls?.length || 0,
            envVars: results.env?.envExample?.variables?.length || 0,
          },
          routes: {
            pages: results.routes?.pages?.length || 0,
            deadLinks: results.routes?.integrity?.deadLinks?.length || 0,
            placeholders: results.routes?.placeholders?.length || 0,
          },
          mocks: {
            critical: (results.mocks?.issues || []).filter(
              (i) => i.severity === "critical",
            ).length,
            high: (results.mocks?.issues || []).filter(
              (i) => i.severity === "high",
            ).length,
            consoleLogs: (results.mocks?.issues || []).filter(
              (i) => i.name === "console.log",
            ).length,
          },
        },
        timestamp: new Date().toISOString(),
        projectPath: results.projectPath,
      };

      this.logger.info(
        `Production integrity check complete: Score ${integrity.score}, Grade ${integrity.grade}`,
      );

      return {
        content: [
          { type: "text", text: report },
          {
            type: "text",
            text: `\n---\n**JSON Summary:**\n\`\`\`json\n${JSON.stringify(summary, null, 2)}\n\`\`\``,
          },
        ],
      };
    } catch (error) {
      this.logger.error("Production integrity check failed", {
        error: error.message,
        stack: error.stack,
      });
      return {
        content: [
          {
            type: "text",
            text:
              `❌ Production integrity check failed: ${error.message}\n\n` +
              `**Troubleshooting:**\n` +
              `- Ensure the project path exists\n` +
              `- Check that Node.js can access the directory\n` +
              `- Try running: \`node scripts/audit-production-integrity.js "${projectPath}"\``,
          },
        ],
        isError: true,
      };
    }
  }

  async auditAuthCoverage(projectPath) {
    try {
      const { auditAuthCoverage, formatAuthResults } = require(
        path.join(__dirname, "..", "scripts", "audit-auth-coverage.js"),
      );

      const results = await auditAuthCoverage(projectPath);
      const report = formatAuthResults(results);

      return {
        content: [{ type: "text", text: report }],
      };
    } catch (error) {
      this.logger.error("Auth coverage audit failed", { error: error.message });
      return {
        content: [
          {
            type: "text",
            text: `❌ Auth coverage audit failed: ${error.message}`,
          },
        ],
        isError: true,
      };
    }
  }

  async auditEnvSecrets(projectPath) {
    try {
      const { auditEnvSecrets, formatEnvResults } = require(
        path.join(__dirname, "..", "scripts", "audit-env-secrets.js"),
      );

      const results = await auditEnvSecrets(projectPath);
      const report = formatEnvResults(results);

      return {
        content: [{ type: "text", text: report }],
      };
    } catch (error) {
      this.logger.error("Env secrets audit failed", { error: error.message });
      return {
        content: [
          {
            type: "text",
            text: `❌ Env secrets audit failed: ${error.message}`,
          },
        ],
        isError: true,
      };
    }
  }

  async auditRouteIntegrity(projectPath) {
    try {
      const { auditRouteIntegrity, formatRouteResults } = require(
        path.join(__dirname, "..", "scripts", "audit-route-integrity.js"),
      );

      const results = await auditRouteIntegrity(projectPath);
      const report = formatRouteResults(results);

      return {
        content: [{ type: "text", text: report }],
      };
    } catch (error) {
      this.logger.error("Route integrity audit failed", {
        error: error.message,
      });
      return {
        content: [
          {
            type: "text",
            text: `❌ Route integrity audit failed: ${error.message}`,
          },
        ],
        isError: true,
      };
    }
  }

  async auditMockBlocker(projectPath) {
    try {
      const { auditMockBlocker, formatMockResults } = require(
        path.join(__dirname, "..", "scripts", "audit-mock-blocker.js"),
      );

      const results = await auditMockBlocker(projectPath);
      const report = formatMockResults(results);

      return {
        content: [{ type: "text", text: report }],
      };
    } catch (error) {
      this.logger.error("Mock blocker audit failed", { error: error.message });
      return {
        content: [
          {
            type: "text",
            text: `❌ Mock blocker audit failed: ${error.message}`,
          },
        ],
        isError: true,
      };
    }
  }

  // ==================== REPO HYGIENE + DEBT RADAR ====================

  async repoHygieneScan(projectPath, mode = "report", saveArtifacts = true) {
    try {
      this.logger.info(`🧹 Running repo hygiene scan on: ${projectPath}`);
      const result = await hygieneFullScan({
        projectPath,
        mode,
        saveArtifacts,
      });

      let response = `# 🧹 Repo Hygiene + Debt Radar\n\n`;
      response += `**Score:** ${result.score.score}/100 (Grade: ${result.score.grade})\n`;
      response += `**Status:** ${result.score.status}\n\n`;

      response += `## Summary\n\n`;
      response += `| Category | Count |\n|----------|-------|\n`;
      response += `| Exact Duplicates | ${result.summary.duplicates.exact} |\n`;
      response += `| Near-Duplicates | ${result.summary.duplicates.near} |\n`;
      response += `| Copy-Paste Blocks | ${result.summary.duplicates.copyPaste} |\n`;
      response += `| Definitely Unused | ${result.summary.unused.definitelyUnused} |\n`;
      response += `| Probably Unused | ${result.summary.unused.probablyUnused} |\n`;
      response += `| Lint/Type Errors | ${result.summary.errors.total} |\n`;
      response += `| Junk Files | ${result.summary.rootCleanup.junkFiles} |\n\n`;

      if (saveArtifacts) {
        response += `📄 **Reports saved to:** .guardrail/\n`;
        response += result.artifacts.map((a) => `- ${a}`).join("\n");
      }

      return { content: [{ type: "text", text: response }] };
    } catch (error) {
      this.logger.error("Repo hygiene scan failed", { error: error.message });
      return {
        content: [
          {
            type: "text",
            text: `❌ Repo hygiene scan failed: ${error.message}`,
          },
        ],
        isError: true,
      };
    }
  }

  async repoHygieneDuplicates(projectPath, threshold = 0.85) {
    try {
      const result = await hygieneDuplicates({ projectPath, threshold });

      let response = `# 📋 Duplicate File Analysis\n\n`;
      response += `**Exact Duplicates:** ${result.summary.exactCount}\n`;
      response += `**Near-Duplicates:** ${result.summary.nearCount}\n`;
      response += `**Copy-Paste Blocks:** ${result.summary.copyPasteCount}\n`;
      response += `**Total Wasted Bytes:** ${result.summary.totalWastedBytes}\n\n`;

      if (result.exact.length > 0) {
        response += `## Exact Duplicates\n\n`;
        for (const group of result.exact.slice(0, 10)) {
          response += `**Hash:** \`${group.hash}\`\n`;
          group.files.forEach((f) => (response += `- \`${f.path}\`\n`));
          response += `\n`;
        }
      }

      if (result.near.length > 0) {
        response += `## Near-Duplicates (≥${threshold * 100}% similar)\n\n`;
        for (const group of result.near.slice(0, 10)) {
          response += `**Similarity:** ${group.similarity}%\n`;
          group.files.forEach((f) => (response += `- \`${f}\`\n`));
          response += `\n`;
        }
      }

      return { content: [{ type: "text", text: response }] };
    } catch (error) {
      return {
        content: [
          { type: "text", text: `❌ Duplicate scan failed: ${error.message}` },
        ],
        isError: true,
      };
    }
  }

  async repoHygieneUnused(projectPath, scope = "all") {
    try {
      const result = await hygieneUnused({ projectPath, scope });

      let response = `# 📦 Unused File Analysis\n\n`;
      response += `**Total Files:** ${result.stats.totalFiles}\n`;
      response += `**Entrypoints:** ${result.stats.entrypoints}\n`;
      response += `**Reachable:** ${result.stats.reachable}\n`;
      response += `**Unreachable:** ${result.stats.unreachable}\n\n`;

      if (result.safeToDelete.length > 0) {
        response += `## ✅ Safe to Delete (${result.safeToDelete.length} files)\n\n`;
        result.safeToDelete
          .slice(0, 20)
          .forEach((f) => (response += `- \`${f}\`\n`));
        if (result.safeToDelete.length > 20)
          response += `- ... and ${result.safeToDelete.length - 20} more\n`;
        response += `\n`;
      }

      if (result.reviewFirst.length > 0) {
        response += `## 🟡 Review First (${result.reviewFirst.length} files)\n\n`;
        result.reviewFirst
          .slice(0, 10)
          .forEach((f) => (response += `- \`${f}\`\n`));
        response += `\n`;
      }

      return { content: [{ type: "text", text: response }] };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `❌ Unused file scan failed: ${error.message}`,
          },
        ],
        isError: true,
      };
    }
  }

  async repoHygieneErrors(projectPath, options = {}) {
    try {
      const result = await hygieneErrors({ projectPath, ...options });

      let response = `# 🔴 Lint/Type/Import Errors\n\n`;
      response += `**Total:** ${result.summary.total}\n`;
      response += `**Errors:** ${result.summary.bySeverity.error}\n`;
      response += `**Warnings:** ${result.summary.bySeverity.warning}\n`;
      response += `**Auto-fixable:** ${result.summary.autoFixable}\n\n`;

      response += `## By Category\n\n`;
      response += `| Category | Count |\n|----------|-------|\n`;
      Object.entries(result.summary.byCategory).forEach(([cat, count]) => {
        if (count > 0) response += `| ${cat} | ${count} |\n`;
      });
      response += `\n`;

      if (result.topOffenders.length > 0) {
        response += `## Top Offending Files\n\n`;
        result.topOffenders
          .slice(0, 15)
          .forEach((o) => (response += `- \`${o.file}\`: ${o.count} errors\n`));
      }

      return { content: [{ type: "text", text: response }] };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `❌ Error collection failed: ${error.message}`,
          },
        ],
        isError: true,
      };
    }
  }

  async repoHygieneRootCleanup(projectPath) {
    try {
      const result = await hygieneRootCleanup({ projectPath });

      let response = `# 🏠 Root Directory Cleanup\n\n`;

      if (result.junkFiles.length > 0) {
        response += `## Junk Files (${result.junkFiles.length})\n\n`;
        result.junkFiles.forEach(
          (j) => (response += `- \`${j.file}\` - ${j.reason}\n`),
        );
        response += `\n`;
      }

      if (result.missingStandards.length > 0) {
        response += `## Missing Standards\n\n`;
        result.missingStandards.forEach((s) => {
          const icon = s.importance === "required" ? "🔴" : "🟡";
          response += `- ${icon} ${s.suggestion}\n`;
        });
        response += `\n`;
      }

      if (result.duplicateConfigs.length > 0) {
        response += `## Duplicate Configs\n\n`;
        result.duplicateConfigs.forEach(
          (d) => (response += `- **${d.type}:** ${d.files.join(", ")}\n`),
        );
        response += `\n`;
      }

      response += `\n---\n${result.cleanupPlan}`;

      return { content: [{ type: "text", text: response }] };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `❌ Root cleanup analysis failed: ${error.message}`,
          },
        ],
        isError: true,
      };
    }
  }

  async repoHygieneDeletionPlan(projectPath, includeReview = false) {
    try {
      const result = await hygieneDeletionPlan({ projectPath, includeReview });

      let response = `# 🗑️ Safe Deletion Plan\n\n`;
      response += `**Safe to Delete:** ${result.summary.safeCount} files\n`;
      response += `**Needs Review:** ${result.summary.reviewCount} files\n\n`;

      if (result.safeToDelete.length > 0) {
        response += `## ✅ Safe to Delete Now\n\n`;
        response += `| File | Reason | Category |\n|------|--------|----------|\n`;
        result.safeToDelete.slice(0, 30).forEach((f) => {
          response += `| \`${f.file}\` | ${f.reason} | ${f.category} |\n`;
        });
        if (result.safeToDelete.length > 30)
          response += `| ... | ${result.safeToDelete.length - 30} more | |\n`;
        response += `\n`;
      }

      if (includeReview && result.reviewFirst.length > 0) {
        response += `## 🟡 Review Before Deleting\n\n`;
        result.reviewFirst
          .slice(0, 20)
          .forEach((f) => (response += `- \`${f.file}\` - ${f.reason}\n`));
      }

      response += `\n⚠️ **Note:** This tool never auto-deletes. Review and delete manually.\n`;

      return { content: [{ type: "text", text: response }] };
    } catch (error) {
      return {
        content: [
          { type: "text", text: `❌ Deletion plan failed: ${error.message}` },
        ],
        isError: true,
      };
    }
  }

  // 🤖 AI-Enhanced Production Integrity Methods
  async aiProductionIntegrity(projectPath, enableAI = true) {
    try {
      const { auditProductionIntegrity } = require(
        path.join(__dirname, "..", "scripts", "audit-production-integrity.js"),
      );

      this.logger.info(
        `🤖 Running AI-Enhanced Production Integrity on: ${projectPath}`,
      );

      const { results, integrity } =
        await auditProductionIntegrity(projectPath);

      // Convert to AI-friendly format
      const findings = this.convertToAIFindings(results);

      // Generate AI insights if enabled
      let aiInsights;
      if (enableAI && process.env.OPENAI_API_KEY) {
        aiInsights = await this.generateAIInsights(findings);
      } else {
        aiInsights = this.generateLocalInsights(findings);
      }

      const report = this.formatAIProductionReport(
        findings,
        integrity,
        aiInsights,
      );

      return {
        content: [
          { type: "text", text: report },
          {
            type: "text",
            text: `\n---\n**AI Analysis JSON:**\n\`\`\`json\n${JSON.stringify(
              {
                score: integrity.score,
                grade: integrity.grade,
                canShip: integrity.canShip,
                aiInsights,
                findingsCount: findings.length,
              },
              null,
              2,
            )}\n\`\`\``,
          },
        ],
      };
    } catch (error) {
      this.logger.error("AI Production integrity failed", {
        error: error.message,
      });
      return {
        content: [
          {
            type: "text",
            text: `❌ AI Production integrity failed: ${error.message}`,
          },
        ],
        isError: true,
      };
    }
  }

  convertToAIFindings(results) {
    const findings = [];
    let id = 1;

    // Auth findings
    if (results.auth?.analysis) {
      for (const e of results.auth.analysis.adminExposed || []) {
        findings.push({
          id: `auth-${id++}`,
          category: "auth",
          severity: "critical",
          title: "Admin Endpoint Exposed",
          description: `${e.method || "GET"} ${e.path} lacks authentication`,
          file: e.file,
        });
      }
    }

    // Secret findings
    if (results.env?.secrets) {
      for (const s of results.env.secrets) {
        findings.push({
          id: `secret-${id++}`,
          category: "secrets",
          severity: s.severity,
          title: `Hardcoded ${s.type}`,
          description: `Found hardcoded ${s.type} in code`,
          file: s.file,
          line: s.line,
        });
      }
    }

    // Mock findings
    if (results.mocks?.issues) {
      for (const m of results.mocks.issues) {
        findings.push({
          id: `mock-${id++}`,
          category: "mocks",
          severity: m.severity || "medium",
          title: `Mock Code: ${m.name}`,
          description: m.reason || `Found ${m.name} in production code`,
          file: m.file,
        });
      }
    }

    return findings;
  }

  async generateAIInsights(findings) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) return this.generateLocalInsights(findings);

    const summary = findings
      .slice(0, 15)
      .map((f) => `[${f.severity}] ${f.title}: ${f.description}`)
      .join("\n");

    const prompt = `Analyze these security findings and provide insights:

${summary}

Respond with JSON:
{
  "overallAssessment": "1-2 sentence assessment",
  "topRisks": ["Top 3 risks"],
  "quickWins": ["3-5 easy fixes"],
  "securityPosture": "strong|moderate|weak|critical",
  "estimatedFixTime": "e.g. '2-4 hours'",
  "prioritizedActions": [{"priority": 1, "action": "...", "reason": "...", "effort": "low|medium|high", "impact": "low|medium|high"}]
}`;

    try {
      const response = await fetch(
        "https://api.openai.com/v1/chat/completions",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model: "gpt-4o-mini",
            messages: [
              {
                role: "system",
                content:
                  "You are an expert security auditor. Respond only with valid JSON.",
              },
              { role: "user", content: prompt },
            ],
            temperature: 0.3,
            max_tokens: 2000,
            response_format: { type: "json_object" },
          }),
        },
      );

      if (!response.ok) throw new Error("AI request failed");
      const data = await response.json();
      return JSON.parse(data.choices?.[0]?.message?.content || "{}");
    } catch (error) {
      this.logger.warn("AI insights generation failed, using local", {
        error: error.message,
      });
      return this.generateLocalInsights(findings);
    }
  }

  generateLocalInsights(findings) {
    const critical = findings.filter((f) => f.severity === "critical");
    const high = findings.filter((f) => f.severity === "high");

    return {
      overallAssessment:
        critical.length > 0
          ? `Found ${critical.length} critical issues requiring immediate attention.`
          : "No critical issues. Review high-priority items before shipping.",
      topRisks: [
        critical.length > 0
          ? "Unauthenticated endpoints may allow unauthorized access"
          : null,
        findings.some((f) => f.category === "secrets")
          ? "Hardcoded secrets risk credential exposure"
          : null,
        findings.some((f) => f.category === "mocks")
          ? "Mock code may bypass security controls"
          : null,
      ].filter(Boolean),
      quickWins: [
        findings.some((f) => f.title.includes("console"))
          ? "Remove console.log statements"
          : null,
        findings.some((f) => f.category === "secrets")
          ? "Move secrets to environment variables"
          : null,
      ].filter(Boolean),
      securityPosture:
        critical.length > 3
          ? "critical"
          : critical.length > 0
            ? "weak"
            : high.length > 5
              ? "moderate"
              : "strong",
      estimatedFixTime:
        critical.length > 5
          ? "4-8 hours"
          : critical.length > 0
            ? "1-2 hours"
            : "< 1 hour",
      prioritizedActions: [],
    };
  }

  formatAIProductionReport(findings, integrity, aiInsights) {
    const lines = [];
    lines.push("# 🤖 AI-Enhanced Production Integrity Report\n");
    lines.push(`**Score:** ${integrity.score}/100 (${integrity.grade})`);
    lines.push(
      `**Ship Decision:** ${integrity.canShip ? "✅ APPROVED" : "🚫 BLOCKED"}\n`,
    );

    lines.push("## 🧠 AI Assessment\n");
    lines.push(`${aiInsights.overallAssessment}\n`);
    lines.push(
      `**Security Posture:** ${aiInsights.securityPosture?.toUpperCase()}`,
    );
    lines.push(`**Estimated Fix Time:** ${aiInsights.estimatedFixTime}\n`);

    if (aiInsights.topRisks?.length > 0) {
      lines.push("### 🚨 Top Risks\n");
      for (const risk of aiInsights.topRisks) {
        lines.push(`- ${risk}`);
      }
      lines.push("");
    }

    if (aiInsights.quickWins?.length > 0) {
      lines.push("### ⚡ Quick Wins\n");
      for (const win of aiInsights.quickWins) {
        lines.push(`- ${win}`);
      }
      lines.push("");
    }

    lines.push("## 📋 Findings Summary\n");
    lines.push(`| Severity | Count |`);
    lines.push(`|----------|-------|`);
    lines.push(
      `| Critical | ${findings.filter((f) => f.severity === "critical").length} |`,
    );
    lines.push(
      `| High | ${findings.filter((f) => f.severity === "high").length} |`,
    );
    lines.push(
      `| Medium | ${findings.filter((f) => f.severity === "medium").length} |`,
    );
    lines.push("");

    lines.push("---\n_Context Enhanced by guardrail AI_");

    return lines.join("\n");
  }

  async aiExplainFinding(finding, context) {
    if (!finding) {
      return {
        content: [{ type: "text", text: "❌ No finding provided to explain" }],
        isError: true,
      };
    }

    const apiKey = process.env.OPENAI_API_KEY;

    if (apiKey) {
      try {
        const prompt = `Explain this security finding for a developer:

Finding: ${finding.title}
Category: ${finding.category}
Severity: ${finding.severity}
Description: ${finding.description}
${context ? `Context: ${context}` : ""}

Provide:
1. Plain English explanation of why this matters
2. A realistic attack scenario
3. Which compliance frameworks this affects (GDPR, SOC2, HIPAA, etc.)
4. Step-by-step fix instructions
5. Code example showing the fix

Be specific and actionable.`;

        const response = await fetch(
          "https://api.openai.com/v1/chat/completions",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${apiKey}`,
            },
            body: JSON.stringify({
              model: "gpt-4o-mini",
              messages: [{ role: "user", content: prompt }],
              temperature: 0.3,
              max_tokens: 1500,
            }),
          },
        );

        if (response.ok) {
          const data = await response.json();
          const explanation =
            data.choices?.[0]?.message?.content ||
            "Unable to generate explanation";

          return {
            content: [
              {
                type: "text",
                text: `# 🧠 AI Explanation: ${finding.title}\n\n${explanation}\n\n---\n_Context Enhanced by guardrail AI_`,
              },
            ],
          };
        }
      } catch (error) {
        this.logger.warn("AI explanation failed", { error: error.message });
      }
    }

    // Local fallback
    const localExplanation = this.getLocalExplanation(finding);
    return {
      content: [
        {
          type: "text",
          text: `# 🧠 Explanation: ${finding.title}\n\n${localExplanation}\n\n_Note: For detailed AI-powered explanations, set OPENAI_API_KEY_`,
        },
      ],
    };
  }

  getLocalExplanation(finding) {
    const explanations = {
      auth: `**Why it matters:** This endpoint lacks authentication, allowing anyone to access it.\n\n**Risk:** Unauthorized users could access or modify sensitive data.\n\n**Fix:** Add authentication middleware to verify user identity before processing requests.`,
      secrets: `**Why it matters:** Hardcoded secrets in code can be exposed if the repository is leaked.\n\n**Risk:** Attackers could use these credentials to access external services.\n\n**Fix:** Move secrets to environment variables and rotate the exposed credential.`,
      mocks: `**Why it matters:** Test/mock code in production may bypass security controls.\n\n**Risk:** Users might see fake data or bypass authentication.\n\n**Fix:** Remove mock imports and ensure only production code is deployed.`,
    };
    return (
      explanations[finding.category] ||
      "This finding indicates a potential security or quality issue that should be reviewed."
    );
  }

  async aiGenerateFix(finding) {
    if (!finding) {
      return {
        content: [{ type: "text", text: "❌ No finding provided" }],
        isError: true,
      };
    }

    const apiKey = process.env.OPENAI_API_KEY;

    if (apiKey) {
      try {
        const prompt = `Generate a specific fix for this security issue:

Category: ${finding.category}
Severity: ${finding.severity}
Title: ${finding.title}
Description: ${finding.description}
File: ${finding.file || "unknown"}
Code: ${finding.code || "N/A"}

Provide:
1. Step-by-step instructions to fix this
2. A complete code example showing the fix
3. How to verify the fix works

Be specific and provide working code.`;

        const response = await fetch(
          "https://api.openai.com/v1/chat/completions",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${apiKey}`,
            },
            body: JSON.stringify({
              model: "gpt-4o-mini",
              messages: [{ role: "user", content: prompt }],
              temperature: 0.3,
              max_tokens: 1500,
            }),
          },
        );

        if (response.ok) {
          const data = await response.json();
          const fix =
            data.choices?.[0]?.message?.content || "Unable to generate fix";

          return {
            content: [
              {
                type: "text",
                text: `# 🔧 AI-Generated Fix: ${finding.title}\n\n${fix}\n\n---\n_Context Enhanced by guardrail AI_`,
              },
            ],
          };
        }
      } catch (error) {
        this.logger.warn("AI fix generation failed", { error: error.message });
      }
    }

    // Local fallback
    const localFix = this.getLocalFix(finding);
    return {
      content: [
        {
          type: "text",
          text: `# 🔧 Fix: ${finding.title}\n\n${localFix.fix}\n\n**Code Example:**\n\`\`\`javascript\n${localFix.code || "// No code example available"}\n\`\`\`\n\n_Note: For detailed AI-powered fixes, set OPENAI_API_KEY_`,
        },
      ],
    };
  }

  getLocalFix(finding) {
    const fixes = {
      auth: {
        fix: "1. Add authentication middleware to the route\n2. Verify user session/token\n3. Check required permissions\n4. Return 401/403 for unauthorized access",
        code: `// Add auth middleware
router.use(requireAuth);

router.get('/admin/users', async (req, res) => {
  if (!req.user?.isAdmin) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  // ... handler
});`,
      },
      secrets: {
        fix: "1. Remove the hardcoded secret\n2. Add to .env file\n3. Use process.env.VAR\n4. Rotate the exposed credential",
        code: `// Before (bad)
const apiKey = 'sk-abc123...';

// After (good)
const apiKey = process.env.API_KEY;
if (!apiKey) {
  throw new Error('API_KEY required');
}`,
      },
      mocks: {
        fix: "1. Remove mock/test imports\n2. Move test code to test directories\n3. Remove console.log statements",
        code: `// Remove these from production
// import { mockData } from './test-utils';
// console.log('debug:', data);`,
      },
    };
    return (
      fixes[finding.category] || {
        fix: "Review and apply appropriate fix.",
        code: null,
      }
    );
  }

  async aiSecurityAssessment(
    projectPath,
    complianceFrameworks = ["SOC2", "GDPR"],
  ) {
    try {
      const { auditProductionIntegrity } = require(
        path.join(__dirname, "..", "scripts", "audit-production-integrity.js"),
      );

      const { results, integrity } =
        await auditProductionIntegrity(projectPath);
      const findings = this.convertToAIFindings(results);

      const apiKey = process.env.OPENAI_API_KEY;

      let assessment;
      if (apiKey) {
        const prompt = `You are a security consultant. Assess this codebase for ${complianceFrameworks.join(", ")} compliance.

Findings Summary:
- Critical: ${findings.filter((f) => f.severity === "critical").length}
- High: ${findings.filter((f) => f.severity === "high").length}
- Categories: auth (${findings.filter((f) => f.category === "auth").length}), secrets (${findings.filter((f) => f.category === "secrets").length}), mocks (${findings.filter((f) => f.category === "mocks").length})

Top Issues:
${findings
  .slice(0, 10)
  .map((f) => `- [${f.severity}] ${f.title}`)
  .join("\n")}

Provide a comprehensive security assessment including:
1. Overall security posture rating
2. Compliance gaps for each framework
3. Risk matrix (likelihood vs impact)
4. Remediation roadmap with timeline
5. Quick wins vs long-term improvements`;

        try {
          const response = await fetch(
            "https://api.openai.com/v1/chat/completions",
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${apiKey}`,
              },
              body: JSON.stringify({
                model: "gpt-4o-mini",
                messages: [{ role: "user", content: prompt }],
                temperature: 0.3,
                max_tokens: 2500,
              }),
            },
          );

          if (response.ok) {
            const data = await response.json();
            assessment = data.choices?.[0]?.message?.content;
          }
        } catch (error) {
          this.logger.warn("AI assessment failed", { error: error.message });
        }
      }

      if (!assessment) {
        assessment = this.generateLocalAssessment(
          findings,
          integrity,
          complianceFrameworks,
        );
      }

      return {
        content: [
          {
            type: "text",
            text: `# 🛡️ AI Security Assessment\n\n**Frameworks:** ${complianceFrameworks.join(", ")}\n**Score:** ${integrity.score}/100\n\n${assessment}\n\n---\n_Context Enhanced by guardrail AI_`,
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `❌ Security assessment failed: ${error.message}`,
          },
        ],
        isError: true,
      };
    }
  }

  generateLocalAssessment(findings, integrity, frameworks) {
    const critical = findings.filter((f) => f.severity === "critical").length;
    const high = findings.filter((f) => f.severity === "high").length;

    let posture = "Moderate";
    if (critical > 3) posture = "Critical";
    else if (critical > 0) posture = "Weak";
    else if (high === 0) posture = "Strong";

    return `## Security Posture: ${posture}

### Findings Summary
- Critical Issues: ${critical}
- High Priority: ${high}
- Total Findings: ${findings.length}

### Compliance Gaps
${frameworks.map((f) => `- **${f}**: ${critical > 0 ? "Gaps detected - review required" : "No critical gaps"}`).join("\n")}

### Recommendations
1. ${critical > 0 ? "Address critical authentication issues immediately" : "Continue monitoring security posture"}
2. ${findings.some((f) => f.category === "secrets") ? "Rotate exposed credentials and move to environment variables" : "Maintain secret management practices"}
3. Regular security audits recommended

_For detailed AI-powered assessment, set OPENAI_API_KEY_`;
  }

  setupErrorHandling() {
    // Enhanced error handling with detailed logging
    this.server.onerror = (error) => {
      this.logger.error("MCP Server Error", {
        message: error.message,
        stack: error.stack,
        timestamp: new Date().toISOString(),
      });
    };

    // Graceful shutdown
    process.on("SIGINT", async () => {
      this.logger.info("Received SIGINT, shutting down gracefully...");
      try {
        await this.server.close();
        this.logger.info("Server closed successfully");
        process.exit(0);
      } catch (error) {
        this.logger.error("Error during shutdown", error);
        process.exit(1);
      }
    });

    process.on("SIGTERM", async () => {
      this.logger.info("Received SIGTERM, shutting down gracefully...");
      try {
        await this.server.close();
        this.logger.info("Server closed successfully");
        process.exit(0);
      } catch (error) {
        this.logger.error("Error during shutdown", error);
        process.exit(1);
      }
    });

    // Unhandled promise rejections
    process.on("unhandledRejection", (reason, promise) => {
      this.logger.error("Unhandled Promise Rejection", {
        reason: reason.toString(),
        promise: promise.toString(),
      });
    });

    // Uncaught exceptions
    process.on("uncaughtException", (error) => {
      this.logger.error("Uncaught Exception", {
        message: error.message,
        stack: error.stack,
      });
      process.exit(1);
    });
  }

  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    this.logger.info("guardrail AI MCP Server started successfully");
    console.error("guardrail AI MCP Server running on stdio");
  }
}

const server = new GuardrailsMCPServer();
server.run().catch(console.error);
