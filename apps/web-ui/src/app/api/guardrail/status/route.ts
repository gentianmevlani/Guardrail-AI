/**
 * API Route: guardrail Status
 * Checks if guardrail on daemon is running via PID file
 */
import { NextResponse } from "next/server";
import * as fs from "fs";
import * as path from "path";

export async function GET() {
  const repoPath = process.env.GUARDRAIL_REPO_PATH || process.cwd();
  const pidFile = path.join(repoPath, ".guardrail", "runtime", "context.pid");

  if (!fs.existsSync(pidFile)) {
    return NextResponse.json({
      connected: false,
      pid: null,
      mode: null,
      uptime: null,
    });
  }

  try {
    const pidStr = fs.readFileSync(pidFile, "utf-8").trim();
    const pid = parseInt(pidStr, 10);
    
    // Check if process is running
    let connected = false;
    try {
      process.kill(pid, 0);
      connected = true;
    } catch {
      connected = false;
    }

    // Get uptime from file modification time
    const stats = fs.statSync(pidFile);
    const uptime = connected ? Math.floor((Date.now() - stats.mtimeMs) / 1000) : null;

    return NextResponse.json({
      connected,
      pid: connected ? pid : null,
      mode: "stdio", // Default mode
      uptime,
    });
  } catch (error: any) {
    return NextResponse.json({
      connected: false,
      pid: null,
      mode: null,
      uptime: null,
    });
  }
}
