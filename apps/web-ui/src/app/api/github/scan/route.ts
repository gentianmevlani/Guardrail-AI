import { getUncachableGitHubClient } from "@/lib/github";
import { logger } from "@/lib/logger";
import * as fs from "fs/promises";
import { NextRequest, NextResponse } from "next/server";
import * as os from "os";
import * as path from "path";

interface ScanOptions {
  owner: string;
  repo: string;
  branch?: string;
  scanType: "ship" | "security" | "reality" | "full";
}

const MAX_FILES = 100;

interface ScanContext {
  filesFetched: number;
}

interface GitHubContentItem {
  type: "file" | "dir" | "symlink" | "submodule";
  name: string;
  path: string;
  content?: string;
  encoding?: string;
}

// eslint-disable-next-line @next/next/no-img-element
type GitHubClient = any; // Using any for Octokit client flexibility

async function fetchRepoFiles(
  client: GitHubClient,
  owner: string,
  repo: string,
  basePath: string = "",
  targetDir: string,
  depth: number = 0,
  ctx: ScanContext = { filesFetched: 0 },
): Promise<string[]> {
  if (depth > 3 || ctx.filesFetched >= MAX_FILES) return [];

  const files: string[] = [];

  try {
    const { data: contents } = await client.repos.getContent({
      owner,
      repo,
      path: basePath,
    });

    const items = Array.isArray(contents) ? contents : [contents];

    for (const item of items) {
      if (item.type === "file" && ctx.filesFetched < MAX_FILES) {
        const skipPatterns = [
          /node_modules/,
          /\.git\//,
          /dist\//,
          /build\//,
          /\.next\//,
          /\.png$/i,
          /\.jpg$/i,
          /\.jpeg$/i,
          /\.gif$/i,
          /\.ico$/i,
          /\.woff/i,
          /\.ttf$/i,
          /\.eot$/i,
          /\.svg$/i,
          /\.mp4$/i,
          /\.mp3$/i,
          /\.zip$/i,
          /\.tar$/i,
          /\.gz$/i,
        ];

        if (skipPatterns.some((p) => p.test(item.path))) continue;

        try {
          const { data: fileData } = await client.repos.getContent({
            owner,
            repo,
            path: item.path,
          });

          const fd = fileData as GitHubContentItem;
          if (fd.content && fd.encoding === "base64") {
            const content = Buffer.from(fd.content, "base64").toString("utf-8");
            const filePath = path.join(targetDir, item.path);
            await fs.mkdir(path.dirname(filePath), { recursive: true });
            await fs.writeFile(filePath, content, "utf-8");
            files.push(item.path);
            ctx.filesFetched++;
          }
        } catch (e) {
          logger.debug(`Failed to fetch file ${item.path}`, { error: e });
        }
      } else if (item.type === "dir" && ctx.filesFetched < MAX_FILES) {
        const skipDirs = [
          "node_modules",
          ".git",
          "dist",
          "build",
          ".next",
          "__pycache__",
          ".venv",
        ];
        if (!skipDirs.includes(item.name)) {
          const subFiles = await fetchRepoFiles(
            client,
            owner,
            repo,
            item.path,
            targetDir,
            depth + 1,
            ctx,
          );
          files.push(...subFiles);
        }
      }
    }
  } catch (e) {
    logger.logUnknownError(`Error fetching contents for ${basePath}`, e);
  }

  return files;
}

interface MockProofViolation {
  file: string;
  type: string;
  count: number;
  pattern: string;
}

async function runMockProofAnalysis(projectPath: string) {
  const violations: MockProofViolation[] = [];
  const scannedFiles: string[] = [];

  const prodPatterns = [
    { pattern: /\bmock\b/i, type: "mock_reference" },
    { pattern: /\bfake\b/i, type: "fake_reference" },
    { pattern: /\bplaceholder\b/i, type: "placeholder" },
    { pattern: /TODO|FIXME|XXX/i, type: "todo_marker" },
    { pattern: /localhost:\d+/i, type: "localhost_url" },
    { pattern: /test@test\.com|example@example\.com/i, type: "test_email" },
    {
      pattern: /['"][a-z]*(?:pass|pwd|secret|token)[a-z]*['"].*[:=]/i,
      type: "hardcoded_cred",
    },
  ];

  async function scanDir(dir: string) {
    try {
      const entries = await fs.readdir(dir, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);

        if (entry.isDirectory()) {
          await scanDir(fullPath);
        } else if (entry.isFile()) {
          const ext = path.extname(entry.name).toLowerCase();
          const codeExts = [
            ".ts",
            ".tsx",
            ".js",
            ".jsx",
            ".py",
            ".go",
            ".rs",
            ".java",
          ];

          if (codeExts.includes(ext)) {
            try {
              const content = await fs.readFile(fullPath, "utf-8");
              scannedFiles.push(fullPath);

              for (const { pattern, type } of prodPatterns) {
                const matches = content.match(new RegExp(pattern.source, "gi"));
                if (matches) {
                  violations.push({
                    file: fullPath.replace(projectPath, ""),
                    type,
                    count: matches.length,
                    pattern: pattern.source,
                  });
                }
              }
            } catch (e) {
              logger.warn("Failed to scan file for mock patterns", {
                error: e,
                file: fullPath,
              });
            }
          }
        }
      }
    } catch (e) {
      logger.warn("Failed to read directory during mock scan", {
        error: e,
        directory: dir,
      });
    }
  }

  await scanDir(projectPath);

  return {
    verdict: violations.length === 0 ? "pass" : "fail",
    violations,
    scannedFiles: scannedFiles.length,
    entrypoints: ["src/index.ts", "src/app.ts"].filter((f) =>
      scannedFiles.some((s) => s.includes(f)),
    ),
  };
}

interface SecurityFinding {
  file: string;
  line: number;
  severity: string;
  type: string;
  snippet: string;
}

async function runSecurityAnalysis(projectPath: string) {
  const findings: SecurityFinding[] = [];
  const scannedFiles: string[] = [];

  const securityPatterns = [
    {
      pattern: /api[_-]?key\s*[:=]\s*['"][^'"]+['"]/i,
      severity: "critical",
      type: "hardcoded_api_key",
    },
    {
      pattern: /password\s*[:=]\s*['"][^'"]+['"]/i,
      severity: "critical",
      type: "hardcoded_password",
    },
    {
      pattern: /secret\s*[:=]\s*['"][^'"]+['"]/i,
      severity: "high",
      type: "hardcoded_secret",
    },
    { pattern: /eval\s*\(/i, severity: "high", type: "unsafe_eval" },
    {
      pattern: /dangerouslySetInnerHTML/i,
      severity: "medium",
      type: "xss_risk",
    },
    { pattern: /innerHTML\s*=/i, severity: "medium", type: "xss_risk" },
    { pattern: /exec\s*\(/i, severity: "high", type: "command_injection_risk" },
    { pattern: /SELECT\s.*\+/i, severity: "high", type: "sql_injection_risk" },
    {
      pattern: /http:\/\/(?!localhost)/i,
      severity: "low",
      type: "insecure_http",
    },
  ];

  async function scanDir(dir: string) {
    try {
      const entries = await fs.readdir(dir, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);

        if (entry.isDirectory()) {
          await scanDir(fullPath);
        } else if (entry.isFile()) {
          const ext = path.extname(entry.name).toLowerCase();
          const codeExts = [
            ".ts",
            ".tsx",
            ".js",
            ".jsx",
            ".py",
            ".go",
            ".rs",
            ".java",
            ".env",
          ];

          if (
            codeExts.includes(ext) ||
            entry.name === ".env" ||
            entry.name.endsWith(".env.example")
          ) {
            try {
              const content = await fs.readFile(fullPath, "utf-8");
              scannedFiles.push(fullPath);

              for (const { pattern, severity, type } of securityPatterns) {
                const lines = content.split("\n");
                lines.forEach((line, lineNum) => {
                  if (pattern.test(line)) {
                    findings.push({
                      file: fullPath.replace(projectPath, ""),
                      line: lineNum + 1,
                      severity,
                      type,
                      snippet: line.trim().substring(0, 100),
                    });
                  }
                });
              }
            } catch (e) {
              logger.warn("Failed to scan file for security patterns", {
                error: e,
                file: fullPath,
              });
            }
          }
        }
      }
    } catch (e) {
      logger.warn("Failed to read directory during security scan", {
        error: e,
        directory: dir,
      });
    }
  }

  await scanDir(projectPath);

  const critical = findings.filter((f) => f.severity === "critical").length;
  const high = findings.filter((f) => f.severity === "high").length;
  const medium = findings.filter((f) => f.severity === "medium").length;
  const low = findings.filter((f) => f.severity === "low").length;

  return {
    verdict: critical > 0 ? "fail" : high > 0 ? "warning" : "pass",
    findings,
    summary: { critical, high, medium, low, total: findings.length },
    scannedFiles: scannedFiles.length,
  };
}

interface RealityIssue {
  file: string;
  type: string;
  message: string;
  count: number;
}

async function runRealityModeAnalysis(projectPath: string) {
  const issues: RealityIssue[] = [];
  const scannedFiles: string[] = [];

  const realityPatterns = [
    {
      pattern: /console\.log\s*\(/i,
      type: "debug_log",
      message: "Console.log statement found",
    },
    {
      pattern: /debugger;/i,
      type: "debugger",
      message: "Debugger statement found",
    },
    {
      pattern: /\.only\s*\(/i,
      type: "test_only",
      message: "Test .only() found",
    },
    {
      pattern: /\.skip\s*\(/i,
      type: "test_skip",
      message: "Test .skip() found",
    },
    {
      pattern: /\/\/ @ts-ignore/i,
      type: "ts_ignore",
      message: "TypeScript ignore comment found",
    },
    {
      pattern: /\/\/ @ts-nocheck/i,
      type: "ts_nocheck",
      message: "TypeScript nocheck found",
    },
    {
      pattern: /any(?:\s|,|\))/i,
      type: "typescript_any",
      message: "TypeScript any type usage",
    },
  ];

  async function scanDir(dir: string) {
    try {
      const entries = await fs.readdir(dir, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);

        if (entry.isDirectory()) {
          await scanDir(fullPath);
        } else if (entry.isFile()) {
          const ext = path.extname(entry.name).toLowerCase();
          const codeExts = [".ts", ".tsx", ".js", ".jsx"];

          if (codeExts.includes(ext)) {
            try {
              const content = await fs.readFile(fullPath, "utf-8");
              scannedFiles.push(fullPath);

              for (const { pattern, type, message } of realityPatterns) {
                const matches = content.match(new RegExp(pattern.source, "gi"));
                if (matches) {
                  issues.push({
                    file: fullPath.replace(projectPath, ""),
                    type,
                    message,
                    count: matches.length,
                  });
                }
              }
            } catch (e) {
              logger.warn("Failed to scan file for reality patterns", {
                error: e,
                file: fullPath,
              });
            }
          }
        }
      }
    } catch (e) {
      logger.warn("Failed to read directory during reality scan", {
        error: e,
        directory: dir,
      });
    }
  }

  await scanDir(projectPath);

  return {
    verdict: issues.length > 10 ? "warning" : "pass",
    issues,
    scannedFiles: scannedFiles.length,
  };
}

interface MockProofResult {
  verdict: string;
  violations?: MockProofViolation[];
  scannedFiles: number;
  entrypoints: string[];
}

interface SecurityResult {
  verdict: string;
  findings: SecurityFinding[];
  summary: {
    critical: number;
    high: number;
    medium: number;
    low: number;
    total: number;
  };
  scannedFiles: number;
}

interface RealityResult {
  verdict: string;
  issues: RealityIssue[];
  scannedFiles: number;
}

async function calculateShipScore(
  mockproof: MockProofResult,
  security: SecurityResult,
  reality: RealityResult,
) {
  let score = 100;

  if (mockproof.verdict === "fail") score -= 30;
  else if ((mockproof.violations?.length ?? 0) > 0)
    score -= (mockproof.violations?.length ?? 0) * 2;

  if (security.summary) {
    score -= security.summary.critical * 20;
    score -= security.summary.high * 10;
    score -= security.summary.medium * 5;
    score -= security.summary.low * 1;
  }

  if ((reality.issues?.length ?? 0) > 10) score -= 10;
  else if ((reality.issues?.length ?? 0) > 5) score -= 5;

  return Math.max(0, Math.min(100, score));
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as ScanOptions;
    const { owner, repo, branch = "main", scanType = "full" } = body;

    if (!owner || !repo) {
      return NextResponse.json(
        { error: "owner and repo are required" },
        { status: 400 },
      );
    }

    const client = await getUncachableGitHubClient();

    const tempDir = path.join(os.tmpdir(), `guardrail-scan-${Date.now()}`);
    await fs.mkdir(tempDir, { recursive: true });

    const scanCtx: ScanContext = { filesFetched: 0 };

    try {
      // Fetch repository files
      const files = await fetchRepoFiles(
        client,
        owner,
        repo,
        "",
        tempDir,
        0,
        scanCtx,
      );

      interface ScanResult {
        success: boolean;
        repository: { owner: string; repo: string; branch: string };
        filesScanned: number;
        timestamp: string;
        mockproof?: MockProofResult;
        security?: SecurityResult;
        reality?: RealityResult;
        verdict?: string;
        score?: number;
        checks?: Array<{
          id: string;
          name: string;
          shortName: string;
          status: string;
          message: string;
        }>;
        persistedScan?: {
          success: boolean;
          scanId?: string;
          findingsCount?: number;
          error?: string;
        };
        runId?: string;
      }
      const result: ScanResult = {
        success: true,
        repository: { owner, repo, branch },
        filesScanned: files.length,
        timestamp: new Date().toISOString(),
      };

      if (scanType === "ship" || scanType === "full") {
        result.mockproof = await runMockProofAnalysis(tempDir);
      }

      if (scanType === "security" || scanType === "full") {
        result.security = await runSecurityAnalysis(tempDir);

        if (result.security.findings && result.security.findings.length > 0) {
          try {
            const apiKey = request.cookies.get("gr_api_key")?.value;
            const apiUrl = process.env.NEXT_PUBLIC_API_URL;
            if (!apiUrl) {
              throw new Error(
                "NEXT_PUBLIC_API_URL environment variable is required. Set it in your environment configuration.",
              );
            }

            const persistResponse = await fetch(
              `${apiUrl}/api/findings/scan/github`,
              {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  ...(apiKey ? { "x-api-key": apiKey } : {}),
                },
                body: JSON.stringify({
                  repoName: `${owner}/${repo}`,
                  branch,
                  scanType: "github-security",
                  findings: result.security.findings,
                  summary: result.security.summary,
                }),
              },
            );

            if (persistResponse.ok) {
              const persistResult = await persistResponse.json();
              result.persistedScan = {
                success: true,
                scanId: persistResult.data?.scanId,
                findingsCount: persistResult.data?.findingsCount,
              };
              // Findings persisted successfully
            } else {
              const errorText = await persistResponse.text();
              // Failed to persist findings - non-blocking error
              result.persistedScan = {
                success: false,
                error: `Failed to persist findings: ${persistResponse.status}`,
              };
            }
          } catch (persistError: unknown) {
            // Non-blocking error - scan still succeeds
            const err = persistError as Error;
            result.persistedScan = {
              success: false,
              error: err.message,
            };
          }
        }
      }

      if (scanType === "reality" || scanType === "full") {
        result.reality = await runRealityModeAnalysis(tempDir);
      }

      if (scanType === "full") {
        const mockproofData = result.mockproof ?? {
          verdict: "skip",
          violations: [],
          scannedFiles: 0,
          entrypoints: [],
        };
        const securityData = result.security ?? {
          verdict: "skip",
          findings: [],
          summary: { critical: 0, high: 0, medium: 0, low: 0, total: 0 },
          scannedFiles: 0,
        };
        const realityData = result.reality ?? {
          verdict: "skip",
          issues: [],
          scannedFiles: 0,
        };
        const score = await calculateShipScore(
          mockproofData,
          securityData,
          realityData,
        );
        result.verdict =
          score >= 80 ? "SHIP" : score >= 50 ? "REVIEW" : "NO_SHIP";
        result.score = score;

        result.checks = [
          {
            id: "mockproof",
            name: "MockProof Check",
            shortName: "MP",
            status: mockproofData.verdict === "pass" ? "pass" : "fail",
            message:
              mockproofData.verdict === "pass"
                ? "No mock data detected"
                : `Found ${mockproofData.violations?.length ?? 0} mock/placeholder issues`,
          },
          {
            id: "security",
            name: "Security Scan",
            shortName: "SEC",
            status:
              securityData.verdict === "pass"
                ? "pass"
                : securityData.verdict === "warning"
                  ? "warning"
                  : "fail",
            message:
              securityData.verdict === "pass"
                ? "No security issues detected"
                : `Found ${securityData.summary.total} security findings`,
          },
          {
            id: "reality",
            name: "Reality Mode",
            shortName: "RM",
            status: realityData.verdict === "pass" ? "pass" : "warning",
            message:
              realityData.issues.length === 0
                ? "Code is production-ready"
                : `Found ${realityData.issues.length} code quality issues`,
          },
        ];
      }

      // Save run record to database for dashboard display
      if (scanType === "full" || scanType === "ship") {
        try {
          const apiUrl = process.env.NEXT_PUBLIC_API_URL;
          if (!apiUrl) {
            throw new Error(
              "NEXT_PUBLIC_API_URL environment variable is required. Set it in your environment configuration.",
            );
          }
          const runResponse = await fetch(`${apiUrl}/api/runs/save`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              repo: `${owner}/${repo}`,
              branch,
              verdict: result.verdict || "REVIEW",
              score: result.score || 0,
              securityResult: result.security || null,
              realityResult: result.reality || null,
              guardrailResult: result.mockproof || null,
            }),
          });

          if (runResponse.ok) {
            const runData = await runResponse.json();
            result.runId = runData.data?.id;
          }
        } catch (runError) {
          logger.debug("Failed to save run record", { error: runError });
        }
      }

      return NextResponse.json(result);
    } finally {
      try {
        await fs.rm(tempDir, { recursive: true, force: true });
      } catch (e: unknown) {
        const err = e as Error;
        logger.debug("Failed to cleanup temp dir", { error: err });
      }
    }
  } catch (err: unknown) {
    const error = err as Error;
    logger.logUnknownError("GitHub scan error", error);
    if (error.message === "GitHub not connected") {
      return NextResponse.json(
        { error: "GitHub not connected", connected: false },
        { status: 401 },
      );
    }
    return NextResponse.json(
      { error: error.message || "Scan failed" },
      { status: 500 },
    );
  }
}
