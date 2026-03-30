import { spawn } from "child_process";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { logger } from "../lib/enhanced-logger";
import type { ScanJobResult } from "../lib/queue";
import { realtimeEventsService } from "../services/realtime-events";
import { getErrorStack, toErrorMessage } from "../utils/toErrorMessage";

// ============================================================================
// SCAN EXECUTION SERVICE
// ============================================================================

interface ScanProgressCallback {
  (progress: number, message: string): Promise<void>;
}

interface ScanServiceOptions {
  scanId: string;
  repositoryUrl?: string;
  localPath?: string;
  branch: string;
  userId: string;
  enableLLM?: boolean;
  llmConfig?: {
    provider: 'openai' | 'anthropic';
    apiKey: string;
  };
  onProgress?: ScanProgressCallback;
  onLog?: (logLine: string) => void;
}

interface ScanFinding {
  type: string;
  severity: string;
  category: string;
  file: string;
  line: number;
  column?: number;
  endLine?: number;
  endColumn?: number;
  title: string;
  message: string;
  codeSnippet?: string;
  suggestion?: string;
  confidence: number;
  ruleId?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Real scan service that executes the guardrail CLI
 * Runs actual code analysis on the target directory
 */
export class ScanService {
  private artifactsDir: string;

  constructor() {
    // Use environment variable or default to /tmp/guardrail-artifacts
    this.artifactsDir = process.env.ARTIFACTS_DIR || path.join(os.tmpdir(), 'guardrail-artifacts');
    this.ensureArtifactsDir();
  }

  private ensureArtifactsDir(): void {
    if (!fs.existsSync(this.artifactsDir)) {
      fs.mkdirSync(this.artifactsDir, { recursive: true });
    }
  }

  async runScan(options: ScanServiceOptions): Promise<ScanJobResult> {
    const startTime = Date.now();
    const { scanId } = options;
    let scanPath: string | null = null;
    let tempDir: string | null = null;

    try {
      await options.onProgress?.(5, 'Preparing scan environment...');

      // Determine the path to scan
      if (options.localPath) {
        scanPath = options.localPath;
      } else if (options.repositoryUrl) {
        // Clone the repository to a temp directory
        tempDir = path.join(os.tmpdir(), `guardrail-scan-${scanId}`);
        await options.onProgress?.(10, 'Cloning repository...');
        await this.cloneRepository(options.repositoryUrl, tempDir, options.branch);
        scanPath = tempDir;
      } else {
        throw new Error('Either localPath or repositoryUrl must be provided');
      }

      // Verify the path exists
      if (!fs.existsSync(scanPath)) {
        throw new Error(`Scan path does not exist: ${scanPath}`);
      }

      // Enhanced progress reporting with detailed steps
      const progressSteps = [
        { progress: 10, message: 'Initializing scan environment...' },
        { progress: 20, message: 'Scanning security patterns...' },
        { progress: 35, message: 'Checking for mock data and placeholders...' },
        { progress: 50, message: 'Validating API endpoints...' },
        { progress: 65, message: 'Analyzing code structure...' },
        { progress: 80, message: 'Detecting potential issues...' },
        { progress: 90, message: 'Processing findings...' },
        { progress: 95, message: 'Generating report...' },
        { progress: 100, message: 'Scan completed!' },
      ];

      let currentStepIndex = 0;

      // Report initial step
      await options.onProgress?.(progressSteps[0].progress, progressSteps[0].message);

      // Run the guardrail CLI scan with enhanced progress
      const cliResult = await this.runCliScan(
        scanPath, 
        scanId, 
        options.userId,
        async (progress, message) => {
          // Map CLI progress to our detailed steps
          const stepProgress = Math.min(90, 20 + (progress * 0.7)); // Map 0-100 to 20-90
          
          // Determine which step we're on based on progress
          const targetStep = progressSteps.findIndex(
            step => step.progress > stepProgress
          ) - 1;
          
          if (targetStep >= 0 && targetStep > currentStepIndex) {
            currentStepIndex = targetStep;
            await options.onProgress?.(
              progressSteps[currentStepIndex].progress,
              progressSteps[currentStepIndex].message
            );
          } else if (message) {
            // Use custom message if provided
            await options.onProgress?.(stepProgress, message);
          }
        },
        options.onLog
      );

      // Final processing steps
      await options.onProgress?.(progressSteps[7].progress, progressSteps[7].message);

      // Parse findings from CLI output
      const findings = this.parseFindings(cliResult);

      // Store artifacts
      await this.storeArtifacts(scanId, cliResult, findings);

      await options.onProgress?.(100, 'Scan completed');

      // Safe property access with nullish coalescing for graceful degradation
      const safeFindings = findings || [];
      const safeScore = cliResult?.score ?? 0;
      
      const result: ScanJobResult = {
        success: true,
        scanId,
        verdict: this.calculateVerdict(safeFindings, safeScore),
        score: safeScore,
        metrics: {
          filesScanned: cliResult?.filesScanned ?? 0,
          linesScanned: cliResult?.linesScanned ?? 0,
          issuesFound: safeFindings.length,
          criticalCount: safeFindings.filter(f => f.severity === 'critical').length,
          warningCount: safeFindings.filter(f => f.severity === 'warning').length,
          infoCount: safeFindings.filter(f => f.severity === 'info').length,
        },
        findings: safeFindings,
      };
      
      // Log warning if partial results (indicates potential issues)
      if (!cliResult || !findings) {
        logger.warn("Scan completed with partial results", {
          scanId,
          missingFields: !cliResult
            ? ["cliResult"]
            : !findings
              ? ["findings"]
              : [],
        });
      }

      logger.info("Scan completed successfully", {
        scanId,
        verdict: result.verdict,
        score: result.score,
        issuesFound: result.metrics?.issuesFound,
        durationMs: Date.now() - startTime,
      });

      return result;

    } catch (error) {
      logger.error("Scan failed", {
        scanId,
        error: error instanceof Error ? error.message : String(error),
      });
      
      // Store error artifacts
      await this.storeErrorArtifacts(scanId, error);
      
      return {
        success: false,
        scanId,
        error: error instanceof Error ? toErrorMessage(error) : 'Unknown error',
        errorDetails: {
          stack: error instanceof Error ? getErrorStack(error) : undefined,
          timestamp: new Date().toISOString(),
          durationMs: Date.now() - startTime,
        },
      };
    } finally {
      // Clean up temp directory if we created one
      if (tempDir && fs.existsSync(tempDir)) {
        try {
          fs.rmSync(tempDir, { recursive: true, force: true });
        } catch (cleanupError) {
          logger.warn("Failed to clean up temp directory", {
            tempDir,
            error:
              cleanupError instanceof Error
                ? cleanupError.message
                : String(cleanupError),
          });
        }
      }
    }
  }

  /**
   * Clone a git repository to a local directory
   */
  private async cloneRepository(repoUrl: string, targetDir: string, branch: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const args = ['clone', '--depth', '1', '--branch', branch, repoUrl, targetDir];
      const gitProcess = spawn('git', args);

      let stderr = '';
      gitProcess.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      gitProcess.on('close', (code) => {
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`Git clone failed: ${stderr}`));
        }
      });

      gitProcess.on('error', (error) => {
        reject(new Error(`Failed to spawn git: ${toErrorMessage(error)}`));
      });
    });
  }

  /**
   * Run the guardrail CLI scan command
   */
  private async runCliScan(
    scanPath: string, 
    scanId: string,
    userId: string,
    onProgress?: ScanProgressCallback,
    onLog?: (logLine: string) => void
  ): Promise<{
    stdout: string;
    stderr: string;
    score: number;
    grade: string;
    filesScanned: number;
    linesScanned: number;
    jsonReport: any;
  }> {
    return new Promise((resolve, reject) => {
      // Find the guardrail CLI - it should be in the repo's bin directory
      const cliPath = path.resolve(__dirname, '../../../bin/guardrail.js');
      
      // Check if CLI exists, fall back to npx if not
      const useNpx = !fs.existsSync(cliPath);
      
      const args = useNpx 
        ? ['guardrail', 'scan', '--json', scanPath]
        : [cliPath, 'scan', '--json', scanPath];
      
      const command = useNpx ? 'npx' : 'node';

      (logger as any).info({ command, args, scanPath }, 'Starting CLI scan');

      // SECURITY: Worker must authenticate with user's API key
      const scanProcess = spawn(command, args, {
        cwd: scanPath,
        env: {
          ...process.env,
          NODE_ENV: 'production',
        },
        timeout: 300000, // 5 minute timeout
      });

      let stdout = '';
      let stderr = '';

      scanProcess.stdout.on('data', (data) => {
        const chunk = data.toString();
        stdout += chunk;
        
        // Emit log lines for realtime streaming
        const lines = chunk.split('\n').filter((line: string) => line.trim());
        for (const line of lines) {
          realtimeEventsService.emitLog(scanId, userId, line);
          onLog?.(line);
        }
        
        // Try to parse progress from output
        const progressMatch = chunk.match(/(\d+)%/);
        if (progressMatch && onProgress) {
          const progress = parseInt(progressMatch[1], 10);
          // Scale progress to 20-90 range (20% for setup, 90% before processing)
          const scaledProgress = 20 + (progress * 0.7);
          onProgress(scaledProgress, 'Analyzing code...');
        }
      });

      scanProcess.stderr.on('data', (data) => {
        const chunk = data.toString();
        stderr += chunk;
        
        // Emit stderr as log lines
        const lines = chunk.split('\n').filter((line: string) => line.trim());
        for (const line of lines) {
          const logLine = `[stderr] ${line}`;
          realtimeEventsService.emitLog(scanId, userId, logLine);
          onLog?.(logLine);
        }
      });

      scanProcess.on('close', (code) => {
        // Try to parse JSON output
        let jsonReport: any = null;
        let score = 0;
        let grade = 'F';
        let filesScanned = 0;
        let linesScanned = 0;

        try {
          // The CLI outputs JSON when --json flag is used
          // Try to find JSON in stdout
          const jsonMatch = stdout.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            jsonReport = JSON.parse(jsonMatch[0]);
            score = jsonReport.score?.overall || jsonReport.score || 0;
            grade = jsonReport.score?.grade || jsonReport.grade || 'F';
            filesScanned = jsonReport.metrics?.filesScanned || 0;
            linesScanned = jsonReport.metrics?.linesScanned || 0;
          }
        } catch (parseError) {
          logger.warn("Failed to parse CLI JSON output", {
            parseError:
              parseError instanceof Error
                ? parseError.message
                : String(parseError),
            stdout: stdout.substring(0, 500),
          });
        }

        // Even if exit code is non-zero, we might have valid results
        if (code !== 0 && !jsonReport) {
          reject(new Error(`CLI scan failed with code ${code}: ${stderr || stdout}`));
        } else {
          resolve({
            stdout,
            stderr,
            score,
            grade,
            filesScanned,
            linesScanned,
            jsonReport,
          });
        }
      });

      scanProcess.on('error', (error) => {
        reject(new Error(`Failed to spawn CLI: ${toErrorMessage(error)}`));
      });
    });
  }

  /**
   * Parse findings from CLI output
   */
  private parseFindings(cliResult: { jsonReport: any; stdout: string }): ScanFinding[] {
    const findings: ScanFinding[] = [];

    if (cliResult.jsonReport) {
      const report = cliResult.jsonReport;

      // Parse ship blockers
      if (report.shipBlockers && Array.isArray(report.shipBlockers)) {
        for (const blocker of report.shipBlockers) {
          findings.push({
            type: blocker.type || 'ship_blocker',
            severity: blocker.severity || 'warning',
            category: blocker.category || 'route_integrity',
            file: blocker.file || blocker.route || 'unknown',
            line: blocker.line || 1,
            column: blocker.column,
            title: blocker.title || blocker.message || 'Ship Blocker',
            message: blocker.message || blocker.description || '',
            suggestion: blocker.suggestion || blocker.fix,
            confidence: blocker.confidence || 0.8,
            ruleId: blocker.ruleId || blocker.type,
          });
        }
      }

      // Parse route verdicts
      if (report.routeVerdicts && Array.isArray(report.routeVerdicts)) {
        for (const verdict of report.routeVerdicts) {
          if (verdict.status !== 'ok' && verdict.status !== 'pass') {
            findings.push({
              type: 'route_issue',
              severity: verdict.status === 'dead' ? 'critical' : 'warning',
              category: 'route_integrity',
              file: verdict.route || verdict.file || 'unknown',
              line: 1,
              title: `Route ${verdict.status}: ${verdict.route}`,
              message: verdict.reason || `Route has status: ${verdict.status}`,
              confidence: 0.9,
              ruleId: `ROUTE-${verdict.status?.toUpperCase()}`,
            });
          }
        }
      }

      // Parse link verdicts
      if (report.linkVerdicts && Array.isArray(report.linkVerdicts)) {
        for (const verdict of report.linkVerdicts) {
          if (verdict.status !== 'ok' && verdict.status !== 'valid') {
            findings.push({
              type: 'link_issue',
              severity: verdict.status === 'broken' ? 'critical' : 'warning',
              category: 'route_integrity',
              file: verdict.sourceFile || 'unknown',
              line: verdict.line || 1,
              column: verdict.column,
              title: `${verdict.status} link: ${verdict.href}`,
              message: verdict.reason || `Link to ${verdict.href} is ${verdict.status}`,
              codeSnippet: verdict.snippet,
              confidence: 0.85,
              ruleId: `LINK-${verdict.status?.toUpperCase()}`,
            });
          }
        }
      }

      // Parse placeholders
      if (report.placeholders && Array.isArray(report.placeholders)) {
        for (const placeholder of report.placeholders) {
          findings.push({
            type: 'placeholder',
            severity: 'info',
            category: 'code_quality',
            file: placeholder.file || 'unknown',
            line: placeholder.line || 1,
            column: placeholder.column,
            title: 'Placeholder detected',
            message: placeholder.match || 'Placeholder or TODO found in code',
            codeSnippet: placeholder.snippet,
            confidence: 0.7,
            ruleId: 'PLACEHOLDER-001',
          });
        }
      }
    }

    // Deduplicate findings by rule ID + file + line
    return this.deduplicateFindings(findings);
  }

  /**
   * Deduplicate findings - same issue in same file/line appears once
   * Keeps the finding with highest confidence if duplicates exist
   */
  private deduplicateFindings(findings: ScanFinding[]): ScanFinding[] {
    const seen = new Map<string, ScanFinding>();
    
    for (const finding of findings) {
      // Create deduplication key: ruleId + file + line
      const key = `${finding.ruleId || finding.type}:${finding.file}:${finding.line || 0}`;
      
      if (!seen.has(key)) {
        seen.set(key, finding);
      } else {
        // Merge metadata if duplicate - keep the one with higher confidence
        const existing = seen.get(key)!;
        if (finding.confidence > existing.confidence) {
          // Update with higher confidence finding
          seen.set(key, {
            ...finding,
            // Merge metadata if present
            metadata: {
              ...existing.metadata,
              ...finding.metadata,
            },
          });
        } else {
          // Keep existing but merge metadata
          existing.metadata = {
            ...existing.metadata,
            ...finding.metadata,
          };
        }
      }
    }
    
    return Array.from(seen.values());
  }

  /**
   * Store scan artifacts to disk
   */
  private async storeArtifacts(
    scanId: string, 
    cliResult: { stdout: string; stderr: string; jsonReport: any },
    findings: ScanFinding[]
  ): Promise<void> {
    const scanArtifactsDir = path.join(this.artifactsDir, scanId);
    
    if (!fs.existsSync(scanArtifactsDir)) {
      fs.mkdirSync(scanArtifactsDir, { recursive: true });
    }

    fs.writeFileSync(path.join(scanArtifactsDir, 'stdout.log'), cliResult.stdout);
    fs.writeFileSync(path.join(scanArtifactsDir, 'stderr.log'), cliResult.stderr);

    if (cliResult.jsonReport) {
      fs.writeFileSync(path.join(scanArtifactsDir, 'report.json'), JSON.stringify(cliResult.jsonReport, null, 2));
    }

    fs.writeFileSync(path.join(scanArtifactsDir, 'findings.json'), JSON.stringify(findings, null, 2));

    fs.writeFileSync(
      path.join(scanArtifactsDir, 'metadata.json'),
      JSON.stringify({
        scanId,
        timestamp: new Date().toISOString(),
        artifactsPath: scanArtifactsDir,
      }, null, 2)
    );

    logger.info("Artifacts stored", { scanId, artifactsDir: scanArtifactsDir });
  }

  /**
   * Store error artifacts
   */
  private async storeErrorArtifacts(scanId: string, error: unknown): Promise<void> {
    try {
      const scanArtifactsDir = path.join(this.artifactsDir, scanId);
      if (!fs.existsSync(scanArtifactsDir)) {
        fs.mkdirSync(scanArtifactsDir, { recursive: true });
      }
      fs.writeFileSync(
        path.join(scanArtifactsDir, 'error.json'),
        JSON.stringify({
          message: error instanceof Error ? toErrorMessage(error) : 'Unknown error',
          stack: error instanceof Error ? getErrorStack(error) : undefined,
          timestamp: new Date().toISOString(),
        }, null, 2)
      );
    } catch (storeError) {
      logger.warn("Failed to store error artifacts", {
        scanId,
        storeError:
          storeError instanceof Error ? storeError.message : String(storeError),
      });
    }
  }

  /**
   * Calculate verdict based on findings and score
   * 
   * Strict FAIL criteria: Only fail with high-confidence proof
   * - Critical severity findings always fail (high confidence)
   * - Score < 50 with high severity findings fail
   * - Everything else is WARN/INFO or REVIEW
   */
  private calculateVerdict(findings: ScanFinding[], score: number): string {
    if (!findings || findings.length === 0) {
      return score >= 80 ? 'pass' : 'review';
    }
    
    // Critical findings always fail (highest confidence)
    const criticalCount = findings.filter(f => f.severity === 'critical').length;
    if (criticalCount > 0) {
      return 'fail';
    }
    
    // High severity + low score = fail (high confidence)
    const highCount = findings.filter(f => f.severity === 'high').length;
    if (score < 50 && highCount > 0) {
      return 'fail';
    }
    
    // Medium severity findings are warnings, not blockers
    // Low score or many warnings = needs review
    if (score < 70) {
      return 'review';
    }
    
    // Many warnings (even with good score) needs review
    const warningCount = findings.filter(f => f.severity === 'warning' || f.severity === 'medium').length;
    if (warningCount > 10) {
      return 'review';
    }
    
    return 'pass';
  }
}
