/**
 * `guardrail dashboard` - Launch the Command Center
 * Starts API server + opens dashboard UI
 */
import * as http from "http";
import * as fs from "fs";
import * as path from "path";
import * as url from "url";
import { spawn, ChildProcess } from "child_process";
import { TelemetryLedger } from "../telemetry/ledger.js";

const API_PORT = 3849;
const UI_PORT = 3850;

interface DashboardOptions {
  apiOnly?: boolean;
  port?: number;
}

const ANSI = {
  reset: "\x1b[0m",
  dim: "\x1b[2m",
  bold: "\x1b[1m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  cyan: "\x1b[36m",
  magenta: "\x1b[35m",
};

// Helper functions
function loadJson(filePath: string): any {
  if (!fs.existsSync(filePath)) return null;
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf-8"));
  } catch {
    return null;
  }
}

function loadNdjson(filePath: string): any[] {
  if (!fs.existsSync(filePath)) return [];
  try {
    const content = fs.readFileSync(filePath, "utf-8");
    return content
      .trim()
      .split("\n")
      .filter(Boolean)
      .map((line) => {
        try { return JSON.parse(line); } catch { return null; }
      })
      .filter(Boolean);
  } catch {
    return [];
  }
}

function getFileAge(filePath: string): number {
  if (!fs.existsSync(filePath)) return -1;
  const stat = fs.statSync(filePath);
  return Math.floor((Date.now() - stat.mtimeMs) / 1000);
}

function parseSince(since: string): Date {
  const now = new Date();
  const match = since.match(/^(\d+)(h|d|w|m)$/);
  if (!match) return new Date(0);
  const [, num, unit] = match;
  const n = parseInt(num, 10);
  switch (unit) {
    case "h": return new Date(now.getTime() - n * 60 * 60 * 1000);
    case "d": return new Date(now.getTime() - n * 24 * 60 * 60 * 1000);
    case "w": return new Date(now.getTime() - n * 7 * 24 * 60 * 60 * 1000);
    case "m": return new Date(now.getTime() - n * 30 * 24 * 60 * 60 * 1000);
    default: return new Date(0);
  }
}

function describeMoment(event: any): string {
  switch (event.category) {
    case "symbols": return `Blocked non-existent symbol${event.queryHash ? ` (${event.queryHash.slice(0, 6)}...)` : ""}`;
    case "routes": return `Blocked non-existent API route`;
    case "versions": return `Blocked uninstalled package`;
    case "security": return `Flagged potential security issue`;
    case "architecture": return `Blocked architecture boundary violation`;
    case "scope": return `Blocked out-of-scope file access`;
    default: return `Blocked potential hallucination`;
  }
}

// CORS headers
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Content-Type": "application/json",
};

function createApiHandlers(repoPath: string) {
  const guardrailDir = path.join(repoPath, ".guardrail");
  const contextDir = path.join(repoPath, ".guardrail-context");
  const telemetryDir = path.join(guardrailDir, "telemetry");
  const reportsDir = path.join(guardrailDir, "reports");

  return {
    "/api/status": () => {
      const truthpackPath = path.join(contextDir, "truthpack.json");
      const eventsPath = path.join(telemetryDir, "context-events.ndjson");
      const events = loadNdjson(eventsPath);
      const recentEvents = events.slice(-100);
      const avgLatency = recentEvents.length > 0
        ? Math.round(recentEvents.reduce((sum, e) => sum + (e.latencyMs || 0), 0) / recentEvents.length)
        : 0;
      const lastEvent = events[events.length - 1];
      return {
        contextMode: events.length > 0 ? "connected" : "disconnected",
        truthPackAge: getFileAge(truthpackPath),
        truthPackPath: contextDir,
        mcpLatency: avgLatency,
        mcpServer: { running: fs.existsSync(path.join(guardrailDir, "mcp.pid")), mode: "stdio" },
        lastActivity: lastEvent?.timestamp || null,
      };
    },

    "/api/stats": (_req: any, params: URLSearchParams) => {
      const period = params.get("period") || "24h";
      const eventsPath = path.join(telemetryDir, "context-events.ndjson");
      const events = loadNdjson(eventsPath);
      const sinceDate = parseSince(period);
      const filtered = events.filter((e) => new Date(e.timestamp) >= sinceDate);
      const prevPeriod = period === "24h" ? "48h" : period === "7d" ? "14d" : "60d";
      const prevSinceDate = parseSince(prevPeriod);
      const prevFiltered = events.filter((e) => new Date(e.timestamp) >= prevSinceDate && new Date(e.timestamp) < sinceDate);

      const calcStats = (data: any[]) => ({
        hallucinationsBlocked: data.filter((e) => e.blockedHallucination).length,
        symbolsVerified: data.filter((e) => e.category === "symbols" && e.resultType === "hit").length,
        routesValidated: data.filter((e) => e.category === "routes" && e.resultType === "hit").length,
        versionsChecked: data.filter((e) => e.category === "versions").length,
        patternsEnforced: data.filter((e) => e.category === "patterns").length,
        boundaryViolations: data.filter((e) => e.category === "architecture" && e.resultType === "blocked").length,
        securityFootguns: data.filter((e) => e.category === "security" && e.blockedHallucination).length,
        avgLatencyMs: data.length > 0 ? Math.round(data.reduce((sum, e) => sum + (e.latencyMs || 0), 0) / data.length) : 0,
        totalCalls: data.length,
      });

      const current = calcStats(filtered);
      const prev = calcStats(prevFiltered);
      return { period, ...current, trend: { hallucinationsBlocked: current.hallucinationsBlocked - prev.hallucinationsBlocked, totalCalls: current.totalCalls - prev.totalCalls } };
    },

    "/api/moments": (_req: any, params: URLSearchParams) => {
      const limit = parseInt(params.get("limit") || "50");
      const eventsPath = path.join(telemetryDir, "context-events.ndjson");
      const events = loadNdjson(eventsPath);
      const moments = events
        .filter((e) => e.blockedHallucination || e.resultType === "blocked")
        .slice(-limit)
        .reverse()
        .map((e, i) => ({
          id: `moment-${Date.now()}-${i}`,
          timestamp: e.timestamp,
          type: e.blockedHallucination ? "blocked_hallucination" : "blocked_dep",
          category: e.category,
          summary: describeMoment(e),
          tool: e.tool,
          file: e.file,
          line: e.line,
          suggestion: e.suggestion,
        }));
      return { moments };
    },

    "/api/risks": (_req: any, params: URLSearchParams) => {
      const limit = parseInt(params.get("limit") || "10");
      const importance = loadJson(path.join(contextDir, "importance.json"));
      const risk = loadJson(path.join(contextDir, "risk.json"));
      const eventsPath = path.join(telemetryDir, "context-events.ndjson");
      const events = loadNdjson(eventsPath);

      const violationsByFile: Record<string, number> = {};
      for (const e of events) {
        if (e.blockedHallucination && e.file) {
          violationsByFile[e.file] = (violationsByFile[e.file] || 0) + 1;
        }
      }

      const files = importance?.files || [];
      const risks = files.slice(0, 50).map((f: any) => {
        const fileRisk = risk?.files?.[f.file] || {};
        return {
          file: f.file,
          score: Math.round((f.score || 0) * 100),
          riskTags: fileRisk.tags || [],
          importance: f.score || 0,
          recentEdits: f.recentEdits || 0,
          violations: violationsByFile[f.file] || 0,
          lastTouched: f.lastModified || null,
        };
      }).sort((a: any, b: any) => b.score - a.score).slice(0, limit);

      return { risks };
    },

    "/api/live": () => {
      const eventsPath = path.join(telemetryDir, "context-events.ndjson");
      const events = loadNdjson(eventsPath);
      const sixtySecondsAgo = new Date(Date.now() - 60 * 1000);
      const recent = events
        .filter((e) => new Date(e.timestamp) >= sixtySecondsAgo)
        .slice(-100)
        .map((e) => ({
          timestamp: e.timestamp,
          tool: e.tool,
          latencyMs: e.latencyMs,
          result: e.resultType,
          blockedHallucination: e.blockedHallucination,
          query: e.queryHash,
        }));
      return { events: recent };
    },

    "/api/runs": (_req: any, params: URLSearchParams) => {
      const limit = parseInt(params.get("limit") || "20");
      if (!fs.existsSync(reportsDir)) return { runs: [] };
      const files = fs.readdirSync(reportsDir).filter((f) => f.endsWith(".json"));
      const runs = files.map((f) => {
        const data = loadJson(path.join(reportsDir, f));
        if (!data) return null;
        return {
          id: f.replace(".json", ""),
          timestamp: data.timestamp,
          verdict: data.verdict,
          blockersCount: data.blockers?.length || 0,
          warningsCount: data.warnings?.length || 0,
          passedCount: data.passed?.length || 0,
          commit: data.commit,
          branch: data.branch,
          reportPath: path.join(reportsDir, f.replace(".json", ".html")),
          artifacts: [path.join(reportsDir, f)],
        };
      }).filter(Boolean).sort((a: any, b: any) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()).slice(0, limit);
      return { runs };
    },

    "/api/policies": () => {
      const configPath = path.join(guardrailDir, "config.json");
      const config = loadJson(configPath);
      return config || { strictness: "dev", boundaries: [], deps: { allowed: [], denied: [] }, scopeTemplates: {} };
    },

    "/api/truthpack": () => {
      const symbols = loadJson(path.join(contextDir, "symbols.json")) || [];
      const routes = loadJson(path.join(contextDir, "routes.json")) || [];
      const deps = loadJson(path.join(contextDir, "deps.json")) || {};
      const patterns = loadJson(path.join(contextDir, "patterns.json")) || [];
      const graph = loadJson(path.join(contextDir, "graph.json")) || { nodes: [], edges: [] };
      const truthpackPath = path.join(contextDir, "truthpack.json");
      return {
        lastBuilt: fs.existsSync(truthpackPath) ? fs.statSync(truthpackPath).mtime.toISOString() : null,
        symbolsCount: symbols.length,
        routesCount: routes.length,
        depsCount: Object.keys(deps.dependencies || {}).length + Object.keys(deps.devDependencies || {}).length,
        patternsCount: patterns.length,
        graphNodes: graph.nodes?.length || 0,
        graphEdges: graph.edges?.length || 0,
      };
    },
  };
}

function startApiServer(repoPath: string, port: number): http.Server {
  const handlers = createApiHandlers(repoPath);
  const guardrailDir = path.join(repoPath, ".guardrail");
  const reportsDir = path.join(guardrailDir, "reports");

  const server = http.createServer(async (req, res) => {
    if (req.method === "OPTIONS") {
      res.writeHead(204, corsHeaders);
      res.end();
      return;
    }

    const parsedUrl = url.parse(req.url || "", true);
    const pathname = parsedUrl.pathname || "";
    const params = new URLSearchParams(parsedUrl.search || "");

    if (pathname === "/health") {
      res.writeHead(200, corsHeaders);
      res.end(JSON.stringify({ status: "ok", server: "guardrail-dashboard" }));
      return;
    }

    // Find handler
    let handler = (handlers as any)[pathname];

    // Check for parameterized routes
    if (!handler && pathname.startsWith("/api/runs/") && pathname !== "/api/runs") {
      const id = pathname.split("/").pop();
      const reportPath = path.join(reportsDir, `${id}.json`);
      const data = loadJson(reportPath);
      if (data) {
        const htmlPath = path.join(reportsDir, `${id}.html`);
        const reportHtml = fs.existsSync(htmlPath) ? fs.readFileSync(htmlPath, "utf-8") : undefined;
        res.writeHead(200, corsHeaders);
        res.end(JSON.stringify({ ...data, id, reportHtml }, null, 2));
        return;
      }
      res.writeHead(404, corsHeaders);
      res.end(JSON.stringify({ error: "Run not found" }));
      return;
    }

    if (handler && req.method === "GET") {
      try {
        const result = handler(req, params);
        res.writeHead(200, corsHeaders);
        res.end(JSON.stringify(result, null, 2));
      } catch (e: any) {
        res.writeHead(500, corsHeaders);
        res.end(JSON.stringify({ error: e.message }));
      }
      return;
    }

    // PUT /api/policies
    if (pathname === "/api/policies" && req.method === "PUT") {
      let body = "";
      req.on("data", (chunk) => (body += chunk.toString()));
      req.on("end", () => {
        try {
          const config = JSON.parse(body);
          const configPath = path.join(guardrailDir, "config.json");
          if (!fs.existsSync(guardrailDir)) fs.mkdirSync(guardrailDir, { recursive: true });
          fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
          res.writeHead(200, corsHeaders);
          res.end(JSON.stringify({ success: true, path: configPath }));
        } catch (e: any) {
          res.writeHead(400, corsHeaders);
          res.end(JSON.stringify({ error: e.message }));
        }
      });
      return;
    }

    res.writeHead(404, corsHeaders);
    res.end(JSON.stringify({ error: "Not found", path: pathname }));
  });

  server.listen(port);
  return server;
}

export async function cmdDashboard(repoPath: string, opts: DashboardOptions = {}): Promise<void> {
  const apiPort = opts.port || API_PORT;

  console.log(`
${ANSI.cyan}╔═══════════════════════════════════════════════════════════╗
║              guardrail COMMAND CENTER                     ║
║           Your AI is being kept honest.                   ║
╚═══════════════════════════════════════════════════════════╝${ANSI.reset}
`);

  // Start API server
  console.log(`${ANSI.dim}Starting API server...${ANSI.reset}`);
  const apiServer = startApiServer(repoPath, apiPort);
  console.log(`${ANSI.green}✓ API server running on http://localhost:${apiPort}${ANSI.reset}`);

  if (opts.apiOnly) {
    console.log(`
${ANSI.cyan}Dashboard API${ANSI.reset}
${ANSI.dim}─────────────────────────────────────────────────${ANSI.reset}
  ${ANSI.bold}API:${ANSI.reset}        http://localhost:${apiPort}
  ${ANSI.bold}Health:${ANSI.reset}     http://localhost:${apiPort}/health
  ${ANSI.bold}Repo:${ANSI.reset}       ${repoPath}
${ANSI.dim}─────────────────────────────────────────────────${ANSI.reset}
  ${ANSI.dim}Press Ctrl+C to stop${ANSI.reset}
`);
    return;
  }

  // Find dashboard UI path
  const dashboardPaths = [
    path.join(repoPath, "Dashboard Development"),
    path.join(repoPath, "..", "Dashboard Development"),
    path.resolve(__dirname, "../../../../../Dashboard Development"),
  ];

  let dashboardPath: string | null = null;
  for (const p of dashboardPaths) {
    if (fs.existsSync(path.join(p, "package.json"))) {
      dashboardPath = p;
      break;
    }
  }

  if (!dashboardPath) {
    console.log(`${ANSI.yellow}⚠ Dashboard UI not found. Running API-only mode.${ANSI.reset}`);
    console.log(`${ANSI.dim}Open http://localhost:${apiPort}/health to verify API is running.${ANSI.reset}`);
    return;
  }

  console.log(`${ANSI.dim}Starting dashboard UI...${ANSI.reset}`);

  // Start Vite dev server
  const viteProcess = spawn("npm", ["run", "dev"], {
    cwd: dashboardPath,
    shell: true,
    stdio: "pipe",
  });

  viteProcess.stdout?.on("data", (data) => {
    const output = data.toString();
    if (output.includes("Local:") || output.includes("ready in")) {
      console.log(`${ANSI.green}✓ Dashboard UI running on http://localhost:${UI_PORT}${ANSI.reset}`);
    }
  });

  viteProcess.stderr?.on("data", (data) => {
    // Suppress most vite output, just show errors
    const output = data.toString();
    if (output.includes("error") || output.includes("Error")) {
      console.error(`${ANSI.dim}${output}${ANSI.reset}`);
    }
  });

  console.log(`
${ANSI.cyan}Command Center${ANSI.reset}
${ANSI.dim}─────────────────────────────────────────────────${ANSI.reset}
  ${ANSI.bold}Dashboard:${ANSI.reset}  http://localhost:${UI_PORT}
  ${ANSI.bold}API:${ANSI.reset}        http://localhost:${apiPort}
  ${ANSI.bold}Repo:${ANSI.reset}       ${repoPath}
${ANSI.dim}─────────────────────────────────────────────────${ANSI.reset}
  ${ANSI.dim}Press Ctrl+C to stop${ANSI.reset}
`);

  // Handle cleanup
  process.on("SIGINT", () => {
    console.log(`\n${ANSI.dim}Shutting down...${ANSI.reset}`);
    viteProcess.kill();
    apiServer.close();
    process.exit(0);
  });
}
