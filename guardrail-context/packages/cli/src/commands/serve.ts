import { startStdioServer, startHttpServer } from "@guardrail-context/mcp-server";
import { truthPackExists } from "@guardrail-context/engine";
import { buildTruthPack } from "@guardrail-context/engine";

export async function cmdServe(repoRoot: string, opts: { http?: boolean; port?: number } = {}) {
  // Check if Truth Pack exists, build if not
  if (!truthPackExists(repoRoot)) {
    console.log("⚠️  No Truth Pack found. Building now...\n");
    await buildTruthPack(repoRoot);
    console.log("");
  }

  if (opts.http) {
    console.log("🚀 Starting HTTP server...\n");
    startHttpServer(opts.port ?? 3847);
  } else {
    console.log("🚀 Starting MCP server (stdio mode)...\n");
    startStdioServer();
  }
}
