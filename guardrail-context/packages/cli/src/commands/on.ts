/**
 * `guardrail on` - Always-on Context Mode
 * Starts file watcher + MCP server + telemetry ledger
 */
import * as fs from "fs";
import * as path from "path";
import * as http from "http";
import * as readline from "readline";
import { buildTruthPack } from "@guardrail-context/engine";
import { TelemetryLedger } from "../telemetry/ledger.js";
import { createMCPHandler } from "../mcp/handler.js";
import { brandHeader, bold, dim, success, warning, link, badge } from "../ui/brand.js";
import { spin } from "../ui/spinner.js";
import { divider } from "../ui/box.js";
import { getCaps } from "../ui/terminal.js";

interface OnOptions {
  http?: boolean;
  port?: number;
  verbose?: boolean;
}

export async function cmdOn(repoPath: string, opts: OnOptions = {}): Promise<void> {
  const contextDir = path.join(repoPath, ".guardrail-context");
  const guardrailDir = path.join(repoPath, ".guardrail");
  const runtimeDir = path.join(guardrailDir, "runtime");
  const pidFile = path.join(runtimeDir, "context.pid");
  const { unicode } = getCaps();

  // Ensure directories exist
  [guardrailDir, runtimeDir].forEach(dir => {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  });

  // Write PID file so other commands know we're running
  fs.writeFileSync(pidFile, process.pid.toString(), "utf8");

  console.log("");
  
  // Check if Truth Pack exists, if not, build it
  const truthpackPath = path.join(contextDir, "truthpack.json");
  if (!fs.existsSync(truthpackPath)) {
    const s = spin("Building Truth Pack (first run)...");
    await buildTruthPack(repoPath);
    s.succeed("Truth Pack ready");
  }

  // Initialize telemetry ledger
  const ledger = new TelemetryLedger(repoPath);

  // Create MCP handler with ledger integration
  const mcpHandler = createMCPHandler(repoPath, ledger);

  // Start file watcher for incremental updates
  const watcher = startFileWatcher(repoPath, contextDir, opts.verbose);

  // THE CONFIRMATION - "Your AI is connected"
  const checkIcon = unicode ? "✅" : "[OK]";
  const mode = opts.http ? `HTTP :${opts.port || 3847}` : "stdio";
  
  console.log("");
  console.log(`${checkIcon} ${bold("Your AI is now connected.")}`);
  console.log("");
  console.log(`  ${dim("Mode:")}       ${mode}`);
  console.log(`  ${dim("Watch:")}      ON ${dim("(incremental)")}`);
  console.log(`  ${dim("Telemetry:")}  ON ${dim("(local only)")}`);
  console.log(`  ${dim("Tools:")}      20 MCP tools available`);
  console.log("");
  console.log(divider(45));
  console.log(dim("Press Ctrl+C to stop. Stats saved on exit."));
  console.log("");

  // Start MCP server
  if (opts.http) {
    await startHTTPServer(mcpHandler, opts.port || 3847, repoPath);
  } else {
    await startStdioServer(mcpHandler, repoPath);
  }

  // Cleanup on exit
  const cleanup = () => {
    console.log("");
    console.log(dim("Stopping Context Mode..."));
    watcher.close();
    ledger.flush();
    
    // Remove PID file
    try { fs.unlinkSync(pidFile); } catch {}
    
    console.log(success("Context Mode stopped. Stats saved."));
    console.log(dim(`Run ${link("guardrail stats")} to see your impact.`));
    console.log("");
    process.exit(0);
  };

  process.on("SIGINT", cleanup);
  process.on("SIGTERM", cleanup);
}

function startFileWatcher(repoPath: string, contextDir: string, verbose?: boolean): fs.FSWatcher {
  const debounceMs = 1000;
  let debounceTimer: NodeJS.Timeout | null = null;
  let changedFiles: Set<string> = new Set();

  const watcher = fs.watch(repoPath, { recursive: true }, (eventType, filename) => {
    if (!filename) return;
    
    // Ignore node_modules, .git, and context directory itself
    if (
      filename.includes("node_modules") ||
      filename.includes(".git") ||
      filename.includes(".guardrail-context") ||
      filename.includes(".guardrail")
    ) {
      return;
    }

    // Only watch relevant files
    if (!/\.(ts|tsx|js|jsx|json|md)$/.test(filename)) {
      return;
    }

    changedFiles.add(filename);

    if (debounceTimer) {
      clearTimeout(debounceTimer);
    }

    debounceTimer = setTimeout(async () => {
      const files = Array.from(changedFiles);
      changedFiles.clear();
      
      if (verbose) {
        console.log(dim(`[watch] ${files.length} file(s) changed, updating index...`));
      }

      try {
        // Incremental update - just rebuild affected parts
        await incrementalUpdate(repoPath, files);
        if (verbose) {
          console.log(dim("[watch] Index updated"));
        }
      } catch (e) {
        // Silent fail for watcher updates
      }
    }, debounceMs);
  });

  return watcher;
}

async function incrementalUpdate(repoPath: string, changedFiles: string[]): Promise<void> {
  // For v1, we do a full rebuild on changes
  // Future: implement true incremental updates
  await buildTruthPack(repoPath);
}

async function startHTTPServer(
  handler: (req: any) => Promise<any>,
  port: number,
  repoPath: string
): Promise<void> {
  const server = http.createServer(async (req, res) => {
    if (req.method === "OPTIONS") {
      res.writeHead(200, {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
      });
      res.end();
      return;
    }

    if (req.method === "GET" && req.url === "/health") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ status: "ok", mode: "context" }));
      return;
    }

    if (req.method === "POST") {
      let body = "";
      req.on("data", (chunk: Buffer) => (body += chunk.toString()));
      req.on("end", async () => {
        try {
          const request = JSON.parse(body);
          const response = await handler(request);
          res.writeHead(200, {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
          });
          res.end(JSON.stringify(response));
        } catch (e: any) {
          res.writeHead(400, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: e.message }));
        }
      });
      return;
    }

    res.writeHead(404);
    res.end("Not found");
  });

  server.listen(port, () => {
    // Server started - confirmation already shown in cmdOn
  });
}

async function startStdioServer(
  handler: (req: any) => Promise<any>,
  repoPath: string
): Promise<void> {
  // Confirmation already shown in cmdOn - just start the server
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: false,
  });

  let buffer = "";

  rl.on("line", async (line) => {
    buffer += line;
    try {
      const request = JSON.parse(buffer);
      buffer = "";
      const response = await handler(request);
      console.log(JSON.stringify(response));
    } catch {
      // Continue buffering if JSON is incomplete
    }
  });
}
