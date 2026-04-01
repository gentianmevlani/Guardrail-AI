import path from "node:path";
import fs from "node:fs";
import http from "node:http";
import readline from "node:readline";
import { repoMapTool } from "./tools/repo.js";
import { symbolsExistsTool, symbolsFindTool } from "./tools/symbols.js";
import { versionsAllowedTool } from "./tools/versions.js";
import { graphRelatedTool } from "./tools/graph.js";
import { patternsPickTool } from "./tools/patterns.js";
import { verifyFastTool, verifyDeepTool } from "./tools/verify.js";
import { antipatternsScanTool, antipatternsCheckTool } from "./tools/antipatterns.js";
import { routesListTool, routesExistsTool } from "./tools/routes.js";
import { autopilotTool, intentTool } from "./tools/autopilot.js";
import { scopeDeclareTool, scopeCheckTool, scopeClearTool } from "./tools/scope.js";
<<<<<<< HEAD
import { promptFirewallAnalyzeTool, promptInjectionDetectTool, promptSafetyCheckTool } from "./tools/prompt.js";
=======
>>>>>>> 64774cf6f8ffd3a30c44ac65801f229995aeb6e7

const MCP_VERSION = "2024-11-05";

type ToolCall = { name: string; arguments?: Record<string, unknown> };
type ToolResult = { content: Array<{ type: "text"; text: string }> };

const TOOLS = [
  {
    name: "repo_map",
    description: "Get project architecture, stack, boundaries, and file counts. Call FIRST before planning any changes.",
    inputSchema: {
      type: "object",
      properties: {
        repoRoot: { type: "string", description: "Path to the repository root" }
      },
      required: ["repoRoot"]
    }
  },
  {
    name: "symbols_exists",
    description: "Check if a symbol (function, class, component, hook, type) exists. MUST call before using any symbol to prevent hallucinations.",
    inputSchema: {
      type: "object",
      properties: {
        repoRoot: { type: "string", description: "Path to the repository root" },
        name: { type: "string", description: "Symbol name to check" }
      },
      required: ["repoRoot", "name"]
    }
  },
  {
    name: "symbols_find",
    description: "Find a symbol's definition, location, and type. Use to get exact file:line for a symbol.",
    inputSchema: {
      type: "object",
      properties: {
        repoRoot: { type: "string", description: "Path to the repository root" },
        name: { type: "string", description: "Symbol name to find" }
      },
      required: ["repoRoot", "name"]
    }
  },
  {
    name: "versions_allowed",
    description: "Check if a package is installed and get its version. MUST call before suggesting any package usage.",
    inputSchema: {
      type: "object",
      properties: {
        repoRoot: { type: "string", description: "Path to the repository root" },
        pkg: { type: "string", description: "Package name to check" }
      },
      required: ["repoRoot", "pkg"]
    }
  },
  {
    name: "graph_related",
    description: "Get files related to a given file by imports (what it imports and what imports it).",
    inputSchema: {
      type: "object",
      properties: {
        repoRoot: { type: "string", description: "Path to the repository root" },
        file: { type: "string", description: "File path (relative to repo root)" },
        depth: { type: "number", description: "How many levels deep to search (default: 1)" }
      },
      required: ["repoRoot", "file"]
    }
  },
  {
    name: "patterns_pick",
    description: "Get the best golden pattern for an intent (e.g., 'new-endpoint', 'new-component', 'new-hook'). Use when creating new code.",
    inputSchema: {
      type: "object",
      properties: {
        repoRoot: { type: "string", description: "Path to the repository root" },
        intent: { type: "string", description: "What you're trying to create (e.g., 'new-endpoint', 'component', 'hook')" }
      },
      required: ["repoRoot", "intent"]
    }
  },
  {
    name: "verify_fast",
    description: "Run fast verification gates (scope check, symbol reality, version constraints). Call after making changes.",
    inputSchema: {
      type: "object",
      properties: {
        repoRoot: { type: "string", description: "Path to the repository root" },
        changedFiles: { type: "array", items: { type: "string" }, description: "Files that were changed" },
        referencedSymbols: { type: "array", items: { type: "string" }, description: "Symbols used in the changes" },
        referencedPackages: { type: "array", items: { type: "string" }, description: "Packages used in the changes" }
      },
      required: ["repoRoot"]
    }
  },
  {
    name: "verify_deep",
    description: "Run deep verification including tests. Use for risky changes.",
    inputSchema: {
      type: "object",
      properties: {
        repoRoot: { type: "string", description: "Path to the repository root" },
        changedFiles: { type: "array", items: { type: "string" }, description: "Files that were changed" }
      },
      required: ["repoRoot"]
    }
  },
  {
    name: "antipatterns_scan",
    description: "Scan repository for anti-patterns (security issues, code smells, bad practices). Returns critical issues first.",
    inputSchema: {
      type: "object",
      properties: {
        repoRoot: { type: "string", description: "Path to the repository root" }
      },
      required: ["repoRoot"]
    }
  },
  {
    name: "antipatterns_check",
    description: "Check a specific file for anti-patterns before committing.",
    inputSchema: {
      type: "object",
      properties: {
        repoRoot: { type: "string", description: "Path to the repository root" },
        file: { type: "string", description: "File path to check" }
      },
      required: ["repoRoot", "file"]
    }
  },
  {
    name: "routes_list",
    description: "List all API routes/endpoints in the project.",
    inputSchema: {
      type: "object",
      properties: {
        repoRoot: { type: "string", description: "Path to the repository root" }
      },
      required: ["repoRoot"]
    }
  },
  {
    name: "routes_exists",
    description: "Check if a specific API route exists. MUST call before using any route to prevent hallucinations.",
    inputSchema: {
      type: "object",
      properties: {
        repoRoot: { type: "string", description: "Path to the repository root" },
        method: { type: "string", description: "HTTP method (GET, POST, PUT, DELETE, PATCH)" },
        path: { type: "string", description: "Route path (e.g., /api/users)" }
      },
      required: ["repoRoot", "method", "path"]
    }
  },
  {
    name: "autopilot",
    description: "Analyze user intent and get suggested pattern, required files, warnings, and risk level. Call at the START of any task.",
    inputSchema: {
      type: "object",
      properties: {
        repoRoot: { type: "string", description: "Path to the repository root" },
        prompt: { type: "string", description: "User's request/prompt" }
      },
      required: ["repoRoot", "prompt"]
    }
  },
  {
    name: "scope_declare",
    description: "Declare a scope contract - limit which files can be modified. Call BEFORE making changes.",
    inputSchema: {
      type: "object",
      properties: {
        repoRoot: { type: "string", description: "Path to the repository root" },
        allowedGlobs: { type: "array", items: { type: "string" }, description: "Glob patterns for allowed files" },
        forbiddenGlobs: { type: "array", items: { type: "string" }, description: "Glob patterns for forbidden files" }
      },
      required: ["repoRoot", "allowedGlobs"]
    }
  },
  {
    name: "scope_check",
    description: "Check if files are within the declared scope contract.",
    inputSchema: {
      type: "object",
      properties: {
        repoRoot: { type: "string", description: "Path to the repository root" },
        files: { type: "array", items: { type: "string" }, description: "Files to check" }
      },
      required: ["repoRoot", "files"]
    }
<<<<<<< HEAD
  },
  {
    name: "prompt_firewall_analyze",
    description: "Run a prompt through the Advanced Prompt Firewall for verification, task breakdown, hallucination risk, and fix generation.",
    inputSchema: {
      type: "object",
      properties: {
        repoRoot: { type: "string", description: "Path to the repository root" },
        prompt: { type: "string", description: "The prompt text to analyze" },
        options: {
          type: "object",
          description: "Firewall options",
          properties: {
            autoBreakdown: { type: "boolean" },
            autoVerify: { type: "boolean" },
            autoFix: { type: "boolean" },
            includeVersionControl: { type: "boolean" },
            generatePlan: { type: "boolean" },
          }
        }
      },
      required: ["repoRoot", "prompt"]
    }
  },
  {
    name: "prompt_injection_detect",
    description: "Check text for prompt injection and jailbreak patterns. MUST call before sending user-supplied text to an LLM.",
    inputSchema: {
      type: "object",
      properties: {
        text: { type: "string", description: "Text to scan for injection patterns" }
      },
      required: ["text"]
    }
  },
  {
    name: "prompt_safety_check",
    description: "Combined safety check: injection detection + PII scanning + unicode anomaly detection.",
    inputSchema: {
      type: "object",
      properties: {
        text: { type: "string", description: "Text to check for all safety concerns" }
      },
      required: ["text"]
    }
  },
=======
  }
>>>>>>> 64774cf6f8ffd3a30c44ac65801f229995aeb6e7
];

export async function handleToolCall(call: ToolCall): Promise<ToolResult> {
  const args = call.arguments ?? {};
  const repoRoot = String(args.repoRoot ?? process.cwd());

  try {
    switch (call.name) {
      case "repo_map":
        return text(JSON.stringify(await repoMapTool(repoRoot), null, 2));
      
      case "symbols_exists":
        return text(JSON.stringify(await symbolsExistsTool(repoRoot, String(args.name)), null, 2));
      
      case "symbols_find":
        return text(JSON.stringify(await symbolsFindTool(repoRoot, String(args.name)), null, 2));
      
      case "versions_allowed":
        return text(JSON.stringify(await versionsAllowedTool(repoRoot, String(args.pkg)), null, 2));
      
      case "graph_related":
        return text(JSON.stringify(await graphRelatedTool(repoRoot, String(args.file), Number(args.depth ?? 1)), null, 2));
      
      case "patterns_pick":
        return text(JSON.stringify(await patternsPickTool(repoRoot, String(args.intent)), null, 2));
      
      case "verify_fast":
        return text(JSON.stringify(await verifyFastTool(repoRoot, {
          changedFiles: args.changedFiles as string[] | undefined,
          referencedSymbols: args.referencedSymbols as string[] | undefined,
          referencedPackages: args.referencedPackages as string[] | undefined,
        }), null, 2));
      
      case "verify_deep":
        return text(JSON.stringify(await verifyDeepTool(repoRoot, {
          changedFiles: args.changedFiles as string[] | undefined,
        }), null, 2));
      
      case "antipatterns_scan":
        return text(JSON.stringify(await antipatternsScanTool(repoRoot), null, 2));
      
      case "antipatterns_check":
        return text(JSON.stringify(await antipatternsCheckTool(repoRoot, String(args.file)), null, 2));
      
      case "routes_list":
        return text(JSON.stringify(await routesListTool(repoRoot), null, 2));
      
      case "routes_exists":
        return text(JSON.stringify(await routesExistsTool(repoRoot, String(args.method), String(args.path)), null, 2));
      
      case "autopilot":
        return text(JSON.stringify(await autopilotTool(repoRoot, String(args.prompt)), null, 2));
      
      case "scope_declare":
        return text(JSON.stringify(await scopeDeclareTool(
          repoRoot, 
          args.allowedGlobs as string[],
          args.forbiddenGlobs as string[] | undefined
        ), null, 2));
      
      case "scope_check":
        return text(JSON.stringify(await scopeCheckTool(repoRoot, args.files as string[]), null, 2));
<<<<<<< HEAD

      case "prompt_firewall_analyze":
        return text(JSON.stringify(await promptFirewallAnalyzeTool(repoRoot, String(args.prompt), args.options as any), null, 2));

      case "prompt_injection_detect":
        return text(JSON.stringify(await promptInjectionDetectTool(String(args.text)), null, 2));

      case "prompt_safety_check":
        return text(JSON.stringify(await promptSafetyCheckTool(String(args.text)), null, 2));

=======
      
>>>>>>> 64774cf6f8ffd3a30c44ac65801f229995aeb6e7
      default:
        throw new Error(`Unknown tool: ${call.name}`);
    }
  } catch (e: any) {
    return text(JSON.stringify({ error: e.message }, null, 2));
  }
}

function text(t: string): ToolResult {
  return { content: [{ type: "text", text: t }] };
}

function handleMCPRequest(request: any): any {
  const { method, params, id } = request;

  switch (method) {
    case "initialize":
      return {
        jsonrpc: "2.0",
        id,
        result: {
          protocolVersion: MCP_VERSION,
          serverInfo: { name: "guardrail-context", version: "1.0.0" },
          capabilities: { tools: {} }
        }
      };

    case "tools/list":
      return { jsonrpc: "2.0", id, result: { tools: TOOLS } };

    case "tools/call":
      return handleToolCall({ name: params.name, arguments: params.arguments })
        .then(result => ({ jsonrpc: "2.0", id, result }));

    default:
      return { jsonrpc: "2.0", id, error: { code: -32601, message: `Unknown method: ${method}` } };
  }
}

export function startStdioServer() {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: false });

  rl.on("line", async (line) => {
    try {
      const request = JSON.parse(line);
      const response = await handleMCPRequest(request);
      console.log(JSON.stringify(response));
    } catch (e: any) {
      console.log(JSON.stringify({ error: e.message }));
    }
  });

  console.error("guardrail Context Engine MCP Server started (stdio mode)");
}

export function startHttpServer(port = 3847) {
  const server = http.createServer(async (req, res) => {
    if (req.method === "POST") {
      let body = "";
      req.on("data", (chunk) => (body += chunk));
      req.on("end", async () => {
        try {
          const request = JSON.parse(body);
          const response = await handleMCPRequest(request);
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify(response, null, 2));
        } catch (e: any) {
          res.writeHead(400, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: e.message }));
        }
      });
    } else if (req.method === "GET" && req.url === "/tools") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ tools: TOOLS }, null, 2));
    } else {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ status: "ok", tools: TOOLS.map((t) => t.name) }));
    }
  });

  server.listen(port, () => {
    console.log(`🚀 guardrail Context Engine running on http://localhost:${port}`);
    console.log(`   Tools: ${TOOLS.map((t) => t.name).join(", ")}`);
  });

  return server;
}

export { TOOLS };
