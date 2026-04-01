/**
 * API Route: Ship Runs
 * Lists all ship runs from artifacts directory
 */
import { NextResponse } from "next/server";
import * as fs from "fs";
import * as path from "path";

export async function GET() {
  const repoPath = process.env.GUARDRAIL_REPO_PATH || process.cwd();
  const reportsDir = path.join(repoPath, ".guardrail", "reports");

  if (!fs.existsSync(reportsDir)) {
    return NextResponse.json([]);
  }

  try {
    const files = fs.readdirSync(reportsDir);
    const runs = [];

    for (const file of files) {
      if (file.endsWith(".json") && file.startsWith("ship-")) {
        const filePath = path.join(reportsDir, file);
        const content = fs.readFileSync(filePath, "utf-8");
        const data = JSON.parse(content);
        
        runs.push({
          id: file.replace(".json", ""),
          timestamp: data.timestamp || fs.statSync(filePath).mtime.toISOString(),
          verdict: data.verdict || "UNKNOWN",
          blockersCount: data.blockers?.length || 0,
          warningsCount: data.warnings?.length || 0,
          passedCount: data.passed?.length || 0,
          reportPath: file.replace(".json", ".html"),
          duration: data.duration,
        });
      }
    }

    // Sort by timestamp descending
    runs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    return NextResponse.json(runs);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
