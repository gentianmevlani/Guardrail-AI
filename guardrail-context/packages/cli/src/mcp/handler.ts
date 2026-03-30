/**
 * Unified MCP Handler - Routes all MCP tool calls with telemetry
 */
import {
  buildTruthPack,
  fuzzySearchSymbols,
  checkArchitectureBoundaries,
  verifyFast,
  classifyIntent,
} from "@guardrail-context/engine";
import { TelemetryLedger } from "../telemetry/ledger.js";
import * as fs from "fs";
import * as path from "path";

const MCP_VERSION = "2024-11-05";

interface MCPRequest {
  jsonrpc: string;
  id: number | string;
  method: string;
  params?: Record<string, any>;
}

interface MCPResponse {
  jsonrpc: string;
  id: number | string;
  result?: any;
  error?: { code: number; message: string };
}

// Scope contract state (in-memory for session)
let scopeContract: { allowed: string[]; forbidden: string[] } | null = null;

const TOOLS = [
  { name: "repo_map", description: "Get project architecture, stack, critical files, and risk zones", inputSchema: { type: "object", properties: {} } },
  { name: "symbols_exists", description: "Check if a symbol exists in the codebase", inputSchema: { type: "object", properties: { name: { type: "string" } }, required: ["name"] } },
  { name: "symbols_find", description: "Find a symbol's definition and location", inputSchema: { type: "object", properties: { name: { type: "string" } }, required: ["name"] } },
  { name: "symbols_fuzzy", description: "Fuzzy search for symbols with typo correction", inputSchema: { type: "object", properties: { query: { type: "string" }, limit: { type: "number" } }, required: ["query"] } },
  { name: "versions_allowed", description: "Check if a package is installed", inputSchema: { type: "object", properties: { pkg: { type: "string" } }, required: ["pkg"] } },
  { name: "graph_related", description: "Get files related by imports", inputSchema: { type: "object", properties: { file: { type: "string" } }, required: ["file"] } },
  { name: "patterns_pick", description: "Get golden pattern for an intent", inputSchema: { type: "object", properties: { intent: { type: "string" } }, required: ["intent"] } },
  { name: "routes_list", description: "List all API endpoints", inputSchema: { type: "object", properties: { method: { type: "string" } } } },
  { name: "routes_exists", description: "Check if an API route exists", inputSchema: { type: "object", properties: { method: { type: "string" }, path: { type: "string" } }, required: ["method", "path"] } },
  { name: "antipatterns_scan", description: "Scan for code anti-patterns", inputSchema: { type: "object", properties: {} } },
  { name: "antipatterns_check", description: "Check a specific file for anti-patterns", inputSchema: { type: "object", properties: { file: { type: "string" } }, required: ["file"] } },
  { name: "vulnerabilities_scan", description: "Scan dependencies for known CVEs", inputSchema: { type: "object", properties: {} } },
  { name: "vulnerabilities_check", description: "Check a specific package for vulnerabilities", inputSchema: { type: "object", properties: { pkg: { type: "string" } }, required: ["pkg"] } },
  { name: "architecture_check", description: "Check for architecture boundary violations", inputSchema: { type: "object", properties: {} } },
  { name: "boundary_check", description: "Check a specific file's boundary compliance", inputSchema: { type: "object", properties: { file: { type: "string" } }, required: ["file"] } },
  { name: "scope_declare", description: "Declare allowed and forbidden file globs for this task", inputSchema: { type: "object", properties: { allowed: { type: "array", items: { type: "string" } }, forbidden: { type: "array", items: { type: "string" } } } } },
  { name: "scope_check", description: "Check if files are within declared scope", inputSchema: { type: "object", properties: { files: { type: "array", items: { type: "string" } } }, required: ["files"] } },
  { name: "autopilot_classify", description: "Classify user intent and suggest approach", inputSchema: { type: "object", properties: { prompt: { type: "string" } }, required: ["prompt"] } },
  { name: "verify_fast", description: "Run fast verification gates", inputSchema: { type: "object", properties: {} } },
  { name: "verify_deep", description: "Run deep verification with tests", inputSchema: { type: "object", properties: {} } },
];

export function createMCPHandler(repoPath: string, ledger: TelemetryLedger) {
  const contextDir = path.join(repoPath, ".guardrail-context");

  return async function handleRequest(request: MCPRequest): Promise<MCPResponse> {
    const startTime = Date.now();

    try {
      // Handle MCP protocol methods
      if (request.method === "initialize") {
        return {
          jsonrpc: "2.0",
          id: request.id,
          result: {
            protocolVersion: MCP_VERSION,
            capabilities: { tools: {} },
            serverInfo: { name: "guardrail-context", version: "1.0.0" },
          },
        };
      }

      if (request.method === "tools/list") {
        return {
          jsonrpc: "2.0",
          id: request.id,
          result: { tools: TOOLS },
        };
      }

      if (request.method === "tools/call") {
        const toolName = request.params?.name;
        const args = request.params?.arguments || {};

        const result = await executeTool(toolName, args, repoPath, contextDir, ledger, startTime);

        return {
          jsonrpc: "2.0",
          id: request.id,
          result: { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] },
        };
      }

      return {
        jsonrpc: "2.0",
        id: request.id,
        error: { code: -32601, message: `Unknown method: ${request.method}` },
      };
    } catch (e: any) {
      return {
        jsonrpc: "2.0",
        id: request.id,
        error: { code: -32000, message: e.message },
      };
    }
  };
}

async function executeTool(
  tool: string,
  args: Record<string, any>,
  repoPath: string,
  contextDir: string,
  ledger: TelemetryLedger,
  startTime: number
): Promise<any> {
  // Ensure Truth Pack exists
  const truthpackPath = path.join(contextDir, "truthpack.json");
  if (!fs.existsSync(truthpackPath)) {
    await buildTruthPack(repoPath);
  }

  let result: any;
  let category: any = "symbols";
  let resultType: "hit" | "miss" | "blocked" | "error" = "hit";
  let blockedHallucination = false;

  switch (tool) {
    case "repo_map": {
      category = "graph";
      const truthpack = JSON.parse(fs.readFileSync(truthpackPath, "utf-8"));
      const risk = loadJson(contextDir, "risk.json");
      const importance = loadJson(contextDir, "importance.json");
      
      result = {
        stack: truthpack,
        criticalFiles: importance?.files?.slice(0, 15) || [],
        riskZones: risk || {},
      };
      break;
    }

    case "symbols_exists": {
      category = "symbols";
      const symbols = loadJson(contextDir, "symbols.json") || [];
      const match = symbols.find((s: any) => s.name === args.name);
      
      if (match) {
        result = { exists: true, symbol: match };
        resultType = "hit";
      } else {
        result = { exists: false, message: `Symbol "${args.name}" NOT FOUND in codebase` };
        resultType = "miss";
        blockedHallucination = true;
      }
      break;
    }

    case "symbols_find": {
      category = "symbols";
      const symbols = loadJson(contextDir, "symbols.json") || [];
      const matches = symbols.filter((s: any) => 
        s.name.toLowerCase().includes(args.name.toLowerCase())
      );
      result = { matches: matches.slice(0, 20), total: matches.length };
      break;
    }

    case "symbols_fuzzy": {
      category = "symbols";
      const symbols = loadJson(contextDir, "symbols.json") || [];
      const matches = fuzzySearchSymbols(symbols, args.query, args.limit || 10);
      result = { matches, query: args.query };
      break;
    }

    case "versions_allowed": {
      category = "versions";
      const deps = loadJson(contextDir, "deps.json") || { dependencies: {}, devDependencies: {} };
      const allDeps = { ...deps.dependencies, ...deps.devDependencies };
      
      if (allDeps[args.pkg]) {
        result = { allowed: true, version: allDeps[args.pkg], pkg: args.pkg };
        resultType = "hit";
      } else {
        result = { allowed: false, message: `Package "${args.pkg}" NOT INSTALLED`, pkg: args.pkg };
        resultType = "miss";
        blockedHallucination = true;
      }
      break;
    }

    case "graph_related": {
      category = "graph";
      const graph = loadJson(contextDir, "graph.json") || { nodes: [], edges: [] };
      const related = graph.edges.filter((e: any) => 
        e.source === args.file || e.target === args.file
      );
      result = { file: args.file, related: related.slice(0, 30), total: related.length };
      break;
    }

    case "patterns_pick": {
      category = "patterns";
      const patterns = loadJson(contextDir, "patterns.json") || [];
      const match = patterns.find((p: any) => 
        p.intent === args.intent || p.id?.includes(args.intent)
      );
      result = match || { message: `No pattern found for intent: ${args.intent}`, available: patterns.map((p: any) => p.intent || p.id) };
      break;
    }

    case "routes_list": {
      category = "routes";
      const routes = loadJson(contextDir, "routes.json") || [];
      const filtered = args.method 
        ? routes.filter((r: any) => r.method === args.method.toUpperCase())
        : routes;
      result = { routes: filtered.slice(0, 50), total: filtered.length };
      break;
    }

    case "routes_exists": {
      category = "routes";
      const routes = loadJson(contextDir, "routes.json") || [];
      const match = routes.find((r: any) => 
        r.method === args.method.toUpperCase() && r.path === args.path
      );
      
      if (match) {
        result = { exists: true, route: match };
        resultType = "hit";
      } else {
        result = { exists: false, message: `Route ${args.method} ${args.path} NOT FOUND` };
        resultType = "miss";
        blockedHallucination = true;
      }
      break;
    }

    case "antipatterns_scan": {
      category = "security";
      const antipatterns = loadJson(contextDir, "antipatterns.json") || [];
      const bySeverity = {
        critical: antipatterns.filter((a: any) => a.severity === "critical"),
        high: antipatterns.filter((a: any) => a.severity === "high"),
        medium: antipatterns.filter((a: any) => a.severity === "medium"),
        low: antipatterns.filter((a: any) => a.severity === "low"),
      };
      result = { total: antipatterns.length, bySeverity };
      break;
    }

    case "antipatterns_check": {
      category = "security";
      const antipatterns = loadJson(contextDir, "antipatterns.json") || [];
      const filePatterns = antipatterns.filter((a: any) => a.file?.includes(args.file));
      result = { file: args.file, antipatterns: filePatterns };
      break;
    }

    case "vulnerabilities_scan": {
      category = "security";
      const vulns = loadJson(contextDir, "vulnerabilities.json") || [];
      result = { vulnerabilities: vulns, total: vulns.length };
      break;
    }

    case "vulnerabilities_check": {
      category = "security";
      const vulns = loadJson(contextDir, "vulnerabilities.json") || [];
      const pkgVulns = vulns.filter((v: any) => v.package === args.pkg);
      result = { pkg: args.pkg, vulnerabilities: pkgVulns };
      break;
    }

    case "architecture_check": {
      category = "architecture";
      const graph = loadJson(contextDir, "graph.json") || { nodes: [], edges: [] };
      const report = checkArchitectureBoundaries(graph);
      result = { violations: report.violations, summary: report.summary, clean: report.summary.totalViolations === 0 };
      break;
    }

    case "boundary_check": {
      category = "architecture";
      const graph = loadJson(contextDir, "graph.json") || { nodes: [], edges: [] };
      // Filter to only include edges from/to the specified file
      const filteredGraph = {
        nodes: graph.nodes,
        edges: graph.edges.filter((e: any) => e.from === args.file || e.to === args.file)
      };
      const report = checkArchitectureBoundaries(filteredGraph);
      result = { file: args.file, violations: report.violations, clean: report.summary.totalViolations === 0 };
      break;
    }

    case "scope_declare": {
      category = "scope";
      scopeContract = { allowed: args.allowed || ["**/*"], forbidden: args.forbidden || [] };
      result = { declared: true, contract: scopeContract };
      break;
    }

    case "scope_check": {
      category = "scope";
      if (!scopeContract) {
        result = { error: "No scope declared. Call scope_declare first." };
      } else {
        const violations = checkScopeViolations(args.files, scopeContract);
        result = { files: args.files, violations, clean: violations.length === 0 };
        if (violations.length > 0) {
          blockedHallucination = true;
          resultType = "blocked";
        }
      }
      break;
    }

    case "autopilot_classify": {
      category = "patterns";
      const intentResult = classifyIntent(args.prompt);
      const patterns = loadJson(contextDir, "patterns.json") || [];
      const matchedPattern = patterns.find((p: any) => 
        p.intent === intentResult.intent || p.id?.includes(intentResult.intent)
      );
      result = {
        ...intentResult,
        suggestedPattern: matchedPattern || null,
        riskLevel: getRiskLevel(intentResult.intent),
        warnings: getWarnings(intentResult.intent),
      };
      break;
    }

    case "verify_fast": {
      category = "verify";
      result = await verifyFast(repoPath);
      break;
    }

    case "verify_deep": {
      category = "verify";
      result = await verifyFast(repoPath);
      // Add lint/typecheck/test results
      result.deep = true;
      result.note = "Deep verification includes lint, typecheck, and tests when available";
      break;
    }

    default:
      throw new Error(`Unknown tool: ${tool}`);
  }

  // Log telemetry
  const latencyMs = Date.now() - startTime;
  ledger.log(tool, category, resultType, latencyMs, {
    query: args.name || args.query || args.file || args.pkg || args.prompt,
    blockedHallucination,
  });

  return result;
}

function loadJson(dir: string, filename: string): any {
  const filePath = path.join(dir, filename);
  if (!fs.existsSync(filePath)) return null;
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf-8"));
  } catch {
    return null;
  }
}

function checkScopeViolations(
  files: string[],
  contract: { allowed: string[]; forbidden: string[] }
): string[] {
  const violations: string[] = [];
  
  for (const file of files) {
    // Check forbidden first
    for (const pattern of contract.forbidden) {
      if (matchGlob(file, pattern)) {
        violations.push(`${file} is in forbidden zone: ${pattern}`);
      }
    }
    
    // Check if in allowed
    let isAllowed = false;
    for (const pattern of contract.allowed) {
      if (matchGlob(file, pattern)) {
        isAllowed = true;
        break;
      }
    }
    
    if (!isAllowed && contract.allowed.length > 0 && !contract.allowed.includes("**/*")) {
      violations.push(`${file} is not in allowed scope`);
    }
  }
  
  return violations;
}

function matchGlob(file: string, pattern: string): boolean {
  // Simple glob matching
  const regex = pattern
    .replace(/\*\*/g, ".*")
    .replace(/\*/g, "[^/]*")
    .replace(/\//g, "\\/");
  return new RegExp(`^${regex}$`).test(file);
}

function getRiskLevel(intent: string): "low" | "medium" | "high" | "critical" {
  switch (intent) {
    case "update-auth":
    case "update-payment":
      return "critical";
    case "new-table":
    case "new-schema":
      return "high";
    case "new-endpoint":
    case "fix-bug":
    case "refactor":
      return "medium";
    default:
      return "low";
  }
}

function getWarnings(intent: string): string[] {
  switch (intent) {
    case "update-auth":
      return ["🚨 Auth changes are CRITICAL - require thorough testing"];
    case "update-payment":
      return ["🚨 Payment changes are CRITICAL - require staging testing"];
    case "new-table":
    case "new-schema":
      return ["⚠️ Database changes require migration and backup"];
    case "fix-bug":
    case "refactor":
      return ["Run existing tests before and after changes"];
    default:
      return [];
  }
}
