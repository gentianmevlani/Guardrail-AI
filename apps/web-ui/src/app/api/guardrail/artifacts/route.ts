/**
 * API Route: Artifacts
 * Lists report artifacts from .guardrail/reports
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
    const artifacts = [];

    for (const file of files) {
      const filePath = path.join(reportsDir, file);
      const stats = fs.statSync(filePath);
      
      if (stats.isFile()) {
        const ext = path.extname(file).toLowerCase();
        let type: "html" | "json" | "sarif" | "video" = "json";
        
        if (ext === ".html") type = "html";
        else if (ext === ".sarif") type = "sarif";
        else if ([".mp4", ".webm"].includes(ext)) type = "video";
        
        artifacts.push({
          id: file,
          type,
          name: file,
          path: `/api/guardrail/artifacts/${encodeURIComponent(file)}`,
          timestamp: stats.mtime.toISOString(),
          size: stats.size,
          runId: file.startsWith("ship-") ? file.split(".")[0] : undefined,
        });
      }
    }

    // Sort by timestamp descending
    artifacts.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    return NextResponse.json(artifacts);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
