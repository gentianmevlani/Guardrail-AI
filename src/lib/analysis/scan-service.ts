/**
 * Scan Service - Orchestrates code analysis
 *
 * Coordinates:
 * - Static analysis with AST parsing
 * - LLM-powered analysis (optional)
 * - GitHub repository cloning
 * - Progress tracking and result persistence
 */

import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { execSync } from "child_process";
import { StaticAnalyzer, Finding, AnalysisResult } from "./static-analyzer";
import { LLMAnalyzer, LLMConfig, CodeContext } from "./llm-analyzer";

// ============================================================================
// TYPES
// ============================================================================

export interface ScanOptions {
  repositoryUrl?: string;
  localPath?: string;
  branch?: string;
  commitSha?: string;
  userId: string;
  enableLLM?: boolean;
  llmConfig?: LLMConfig;
  onProgress?: (progress: number, message: string) => void;
}

export interface ScanResult {
  id: string;
  status: "completed" | "failed";
  verdict: "pass" | "fail" | "review";
  score: number;
  findings: Finding[];
  metrics: {
    filesScanned: number;
    linesScanned: number;
    issuesFound: number;
    criticalCount: number;
    warningCount: number;
    infoCount: number;
    duration: number;
  };
  llmMetrics?: {
    tokensUsed: number;
    cost: number;
    findingsCount: number;
  };
  error?: string;
}

export interface CloneResult {
  path: string;
  commitSha: string;
  branch: string;
}

// ============================================================================
// SCAN SERVICE CLASS
// ============================================================================

export class ScanService {
  private staticAnalyzer: StaticAnalyzer;
  private llmAnalyzer: LLMAnalyzer;
  private tempDirs: Set<string> = new Set();

  constructor() {
    this.staticAnalyzer = new StaticAnalyzer();
    this.llmAnalyzer = new LLMAnalyzer();
  }

  /**
   * Run a complete scan
   */
  async runScan(options: ScanOptions): Promise<ScanResult> {
    const scanId = this.generateScanId();
    const startTime = Date.now();
    let projectPath: string;
    let cloneResult: CloneResult | null = null;

    try {
      // Step 1: Get project path (clone if needed)
      this.reportProgress(options, 5, "Preparing project...");

      if (options.repositoryUrl) {
        cloneResult = await this.cloneRepository(
          options.repositoryUrl,
          options.branch,
        );
        projectPath = cloneResult.path;
        this.reportProgress(options, 15, "Repository cloned successfully");
      } else if (options.localPath) {
        projectPath = options.localPath;
        this.reportProgress(options, 15, "Using local project path");
      } else {
        throw new Error("Either repositoryUrl or localPath is required");
      }

      // Step 2: Run static analysis
      this.reportProgress(options, 20, "Running static analysis...");
      const staticResult =
        await this.staticAnalyzer.analyzeProject(projectPath);
      this.reportProgress(
        options,
        60,
        `Static analysis complete. Found ${staticResult.findings.length} issues.`,
      );

      // Step 3: Run LLM analysis if enabled
      let llmMetrics: ScanResult["llmMetrics"] | undefined;
      let allFindings = [...staticResult.findings];

      if (options.enableLLM && options.llmConfig) {
        this.reportProgress(options, 65, "Running AI-powered analysis...");
        this.llmAnalyzer.initialize(options.llmConfig);

        const contexts = await this.prepareCodeContexts(projectPath);
        const llmResult = await this.llmAnalyzer.batchAnalyze(contexts);

        allFindings = this.mergeFindings(
          staticResult.findings,
          llmResult.findings,
        );

        llmMetrics = {
          tokensUsed: llmResult.tokensUsed,
          cost: llmResult.cost,
          findingsCount: llmResult.findings.length,
        };

        this.reportProgress(
          options,
          85,
          `AI analysis complete. Found ${llmResult.findings.length} additional issues.`,
        );
      }

      // Step 4: Calculate metrics and score
      this.reportProgress(options, 90, "Calculating results...");
      const metrics = this.calculateMetrics(
        allFindings,
        staticResult,
        startTime,
      );
      const score = this.calculateScore(allFindings);
      const verdict = this.determineVerdict(score, allFindings);

      // Step 5: Cleanup
      this.reportProgress(options, 95, "Cleaning up...");
      if (cloneResult) {
        await this.cleanupTempDir(cloneResult.path);
      }

      this.reportProgress(options, 100, "Scan complete!");

      return {
        id: scanId,
        status: "completed",
        verdict,
        score,
        findings: allFindings,
        metrics,
        llmMetrics,
      };
    } catch (error) {
      // Cleanup on error
      if (cloneResult) {
        await this.cleanupTempDir(cloneResult.path);
      }

      return {
        id: scanId,
        status: "failed",
        verdict: "fail",
        score: 0,
        findings: [],
        metrics: {
          filesScanned: 0,
          linesScanned: 0,
          issuesFound: 0,
          criticalCount: 0,
          warningCount: 0,
          infoCount: 0,
          duration: Date.now() - startTime,
        },
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /**
   * Clone a GitHub repository
   */
  async cloneRepository(url: string, branch?: string): Promise<CloneResult> {
    const tempDir = await this.createTempDir();

    try {
      // Build clone command
      const branchArg = branch ? `--branch ${branch}` : "";
      const cloneCmd = `git clone --depth 1 ${branchArg} ${url} ${tempDir}`;

      execSync(cloneCmd, {
        stdio: "pipe",
        timeout: 120000, // 2 minute timeout
      });

      // Get commit SHA
      const commitSha = execSync("git rev-parse HEAD", {
        cwd: tempDir,
        encoding: "utf-8",
      }).trim();

      // Get branch name
      const actualBranch = execSync("git rev-parse --abbrev-ref HEAD", {
        cwd: tempDir,
        encoding: "utf-8",
      }).trim();

      return {
        path: tempDir,
        commitSha,
        branch: actualBranch,
      };
    } catch (error) {
      await this.cleanupTempDir(tempDir);
      throw new Error(`Failed to clone repository: ${error}`);
    }
  }

  /**
   * Prepare code contexts for LLM analysis
   */
  private async prepareCodeContexts(
    projectPath: string,
  ): Promise<CodeContext[]> {
    const contexts: CodeContext[] = [];
    const files = await this.findPriorityFiles(projectPath);

    for (const file of files.slice(0, 20)) {
      // Limit to 20 files for cost control
      try {
        const content = await fs.promises.readFile(file, "utf-8");
        const ext = path.extname(file);
        const language = this.getLanguage(ext);

        contexts.push({
          file: path.relative(projectPath, file),
          content,
          language,
          imports: this.extractImportNames(content),
          exports: this.extractExportNames(content),
        });
      } catch {
        // Skip files that can't be read
      }
    }

    return contexts;
  }

  /**
   * Find priority files for LLM analysis (entry points, API routes, etc.)
   */
  private async findPriorityFiles(projectPath: string): Promise<string[]> {
    const priorityPatterns = [
      /^src\/(app|pages)\/.*\.(tsx?|jsx?)$/,
      /^(app|pages)\/.*\.(tsx?|jsx?)$/,
      /routes?\.(tsx?|jsx?|ts|js)$/,
      /api\/.*\.(tsx?|jsx?|ts|js)$/,
      /services?\/.*\.(tsx?|jsx?|ts|js)$/,
      /hooks?\/.*\.(tsx?|jsx?|ts|js)$/,
      /components?\/.*\.(tsx?|jsx?)$/,
    ];

    const allFiles: string[] = [];
    const priorityFiles: string[] = [];
    const otherFiles: string[] = [];

    const walk = async (dir: string): Promise<void> => {
      const excludeDirs = [
        "node_modules",
        ".git",
        "dist",
        "build",
        ".next",
        "__tests__",
        "test",
      ];

      try {
        const entries = await fs.promises.readdir(dir, { withFileTypes: true });

        for (const entry of entries) {
          const fullPath = path.join(dir, entry.name);
          const relativePath = path.relative(projectPath, fullPath);

          if (entry.isDirectory()) {
            if (
              !excludeDirs.includes(entry.name) &&
              !entry.name.startsWith(".")
            ) {
              await walk(fullPath);
            }
          } else if (entry.isFile()) {
            const ext = path.extname(entry.name);
            if ([".ts", ".tsx", ".js", ".jsx"].includes(ext)) {
              // Check if it's a priority file
              const isPriority = priorityPatterns.some((p) =>
                p.test(relativePath.replace(/\\/g, "/")),
              );
              if (isPriority) {
                priorityFiles.push(fullPath);
              } else {
                otherFiles.push(fullPath);
              }
            }
          }
        }
      } catch {
        // Skip directories that can't be read
      }
    };

    await walk(projectPath);

    // Return priority files first, then others
    return [...priorityFiles, ...otherFiles];
  }

  /**
   * Get language from file extension
   */
  private getLanguage(ext: string): string {
    const mapping: Record<string, string> = {
      ".ts": "typescript",
      ".tsx": "typescript",
      ".js": "javascript",
      ".jsx": "javascript",
      ".mjs": "javascript",
    };
    return mapping[ext] || "javascript";
  }

  /**
   * Extract import names from code
   */
  private extractImportNames(content: string): string[] {
    const imports: string[] = [];
    const regex = /import\s+(?:{([^}]+)}|(\w+))\s+from\s+['"]([^'"]+)['"]/g;
    let match;

    while ((match = regex.exec(content)) !== null) {
      if (match[1]) {
        imports.push(
          ...match[1].split(",").map((s) => s.trim().split(" as ")[0]),
        );
      }
      if (match[2]) {
        imports.push(match[2]);
      }
    }

    return imports;
  }

  /**
   * Extract export names from code
   */
  private extractExportNames(content: string): string[] {
    const exports: string[] = [];
    const regex = /export\s+(?:const|function|class|let|var)\s+(\w+)/g;
    let match;

    while ((match = regex.exec(content)) !== null) {
      exports.push(match[1]);
    }

    return exports;
  }

  /**
   * Merge static and LLM findings, removing duplicates
   */
  private mergeFindings(
    staticFindings: Finding[],
    llmFindings: Finding[],
  ): Finding[] {
    const merged = [...staticFindings];
    const existingKeys = new Set(
      staticFindings.map((f) => `${f.file}:${f.line}:${f.type}`),
    );

    for (const finding of llmFindings) {
      const key = `${finding.file}:${finding.line}:${finding.type}`;
      if (!existingKeys.has(key)) {
        merged.push(finding);
        existingKeys.add(key);
      }
    }

    // Sort by severity then by file
    return merged.sort((a, b) => {
      const severityOrder = { critical: 0, warning: 1, info: 2 };
      const severityDiff =
        severityOrder[a.severity] - severityOrder[b.severity];
      if (severityDiff !== 0) return severityDiff;
      return a.file.localeCompare(b.file);
    });
  }

  /**
   * Calculate metrics from findings
   */
  private calculateMetrics(
    findings: Finding[],
    staticResult: AnalysisResult,
    startTime: number,
  ): ScanResult["metrics"] {
    return {
      filesScanned: staticResult.filesScanned,
      linesScanned: staticResult.linesScanned,
      issuesFound: findings.length,
      criticalCount: findings.filter((f) => f.severity === "critical").length,
      warningCount: findings.filter((f) => f.severity === "warning").length,
      infoCount: findings.filter((f) => f.severity === "info").length,
      duration: Date.now() - startTime,
    };
  }

  /**
   * Calculate overall score (0-100)
   */
  private calculateScore(findings: Finding[]): number {
    let score = 100;

    for (const finding of findings) {
      switch (finding.severity) {
        case "critical":
          score -= 15;
          break;
        case "warning":
          score -= 5;
          break;
        case "info":
          score -= 1;
          break;
      }
    }

    return Math.max(0, Math.min(100, score));
  }

  /**
   * Determine verdict based on score and findings
   */
  private determineVerdict(
    score: number,
    findings: Finding[],
  ): "pass" | "fail" | "review" {
    const criticalCount = findings.filter(
      (f) => f.severity === "critical",
    ).length;

    if (criticalCount > 0 || score < 50) {
      return "fail";
    } else if (score < 80) {
      return "review";
    }
    return "pass";
  }

  /**
   * Create temporary directory
   */
  private async createTempDir(): Promise<string> {
    const tempDir = path.join(
      os.tmpdir(),
      `guardrail-scan-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    );
    await fs.promises.mkdir(tempDir, { recursive: true });
    this.tempDirs.add(tempDir);
    return tempDir;
  }

  /**
   * Cleanup temporary directory
   */
  private async cleanupTempDir(dir: string): Promise<void> {
    try {
      await fs.promises.rm(dir, { recursive: true, force: true });
      this.tempDirs.delete(dir);
    } catch {
      // Ignore cleanup errors
    }
  }

  /**
   * Report progress to callback
   */
  private reportProgress(
    options: ScanOptions,
    progress: number,
    message: string,
  ): void {
    options.onProgress?.(progress, message);
  }

  /**
   * Generate unique scan ID
   */
  private generateScanId(): string {
    return `scan_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
  }

  /**
   * Cleanup all temp directories on shutdown
   */
  async cleanup(): Promise<void> {
    for (const dir of this.tempDirs) {
      await this.cleanupTempDir(dir);
    }
  }
}

// Export singleton instance
export const scanService = new ScanService();
