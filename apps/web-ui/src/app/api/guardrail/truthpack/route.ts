/**
 * API Route: Truth Pack Info
 * Reads `.guardrail-context/` — same index as `TruthPackGenerator` / `guardrail-context index` / `guardrail scan --with-context`.
 */
import { NextResponse } from "next/server";
import * as fs from "fs";
import * as path from "path";

interface TruthPackFileShape {
  version?: string;
  generatedAt?: string;
  stack?: {
    framework?: string;
    language?: string;
    packageManager?: string;
  };
  metadata?: {
    fileCount?: number;
    lineCount?: number;
    totalSize?: number;
  };
}

function readJsonArrayLength(filePath: string): number {
  if (!fs.existsSync(filePath)) return 0;
  try {
    const raw = JSON.parse(fs.readFileSync(filePath, "utf-8")) as unknown;
    return Array.isArray(raw) ? raw.length : 0;
  } catch {
    return 0;
  }
}

function readScanSnapshot(repoPath: string): {
  verdict: string;
  timestamp: string;
  totalScore?: number;
} | null {
  const p = path.join(repoPath, ".guardrail", "scan.json");
  if (!fs.existsSync(p)) return null;
  try {
    const raw = JSON.parse(fs.readFileSync(p, "utf-8")) as {
      verdict?: string;
      timestamp?: string;
      summary?: { totalScore?: number };
    };
    if (!raw.verdict || !raw.timestamp) return null;
    return {
      verdict: raw.verdict,
      timestamp: raw.timestamp,
      totalScore: raw.summary?.totalScore,
    };
  } catch {
    return null;
  }
}

export async function GET() {
  const repoPath = process.env.GUARDRAIL_REPO_PATH || process.cwd();
  const ctxDir = path.join(repoPath, ".guardrail-context");
  const truthpackPath = path.join(ctxDir, "truthpack.json");
  const symbolsPath = path.join(ctxDir, "symbols.json");
  const routesPath = path.join(ctxDir, "routes.json");
  const depsPath = path.join(ctxDir, "deps.json");

  if (!fs.existsSync(truthpackPath)) {
    return NextResponse.json({
      exists: false,
      lastUpdated: null,
      generatedAt: null,
      symbolCount: 0,
      routeCount: 0,
      dependencyCount: 0,
      fileCount: 0,
      lineCount: 0,
      framework: null,
      language: null,
      packageManager: null,
      lastRealityScan: null,
    });
  }

  try {
    const stats = fs.statSync(truthpackPath);
    const parsed = JSON.parse(
      fs.readFileSync(truthpackPath, "utf-8"),
    ) as TruthPackFileShape;

    const symbolCount = readJsonArrayLength(symbolsPath);
    const routeCount = readJsonArrayLength(routesPath);
    const dependencyCount = readJsonArrayLength(depsPath);

    const generatedAt =
      typeof parsed.generatedAt === "string" ? parsed.generatedAt : null;
    const lastUpdated = generatedAt ?? stats.mtime.toISOString();

    const lastRealityScan = readScanSnapshot(repoPath);

    return NextResponse.json({
      exists: true,
      lastUpdated,
      generatedAt,
      symbolCount,
      routeCount,
      dependencyCount,
      fileCount: parsed.metadata?.fileCount ?? 0,
      lineCount: parsed.metadata?.lineCount ?? 0,
      framework: parsed.stack?.framework ?? null,
      language: parsed.stack?.language ?? null,
      packageManager: parsed.stack?.packageManager ?? null,
      /** Last `guardrail scan` result when `.guardrail/scan.json` exists */
      lastRealityScan,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      {
        exists: false,
        lastUpdated: null,
        generatedAt: null,
        symbolCount: 0,
        routeCount: 0,
        dependencyCount: 0,
        fileCount: 0,
        lineCount: 0,
        framework: null,
        language: null,
        packageManager: null,
        lastRealityScan: null,
        error: message,
      },
      { status: 200 },
    );
  }
}
