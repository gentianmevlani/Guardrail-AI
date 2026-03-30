/**
 * Run Manager - Unified Run Folder Structure
 * 
 * Manages run artifacts with deterministic outputs:
 * .guardrail/runs/<runId>/
 *   metadata.json
 *   summary.json
 *   report.txt
 *   report.json
 *   report.html (if available)
 *   sarif.json (if requested)
 *   artifacts/ (trace.zip/video.webm/screenshots)
 *   replay/ (replay.json)
 */

import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { execSync } from 'child_process';

export interface RunMetadata {
  runId: string;
  commitSha: string | null;
  branch: string | null;
  timestamp: string;
  profile: 'default' | 'strict' | 'relaxed';
  policyHash: string;
  nodeVersion: string;
  platform: string;
  cwd: string;
  cliVersion: string;
}

export interface RunSummary {
  verdict: 'ship' | 'no-ship';
  exitCode: number;
  score: number;
  gates: {
    mockproof: { verdict: 'pass' | 'fail' | 'skip'; violations: number };
    reality: { verdict: 'pass' | 'fail' | 'skip'; detections: number };
    badge: { verdict: 'pass' | 'fail' | 'skip'; score: number };
  };
  blockers: string[];
  duration: number;
}

export interface RunArtifacts {
  runDir: string;
  metadata: string;
  summary: string;
  reportTxt: string;
  reportJson: string;
  reportHtml: string | null;
  sarifJson: string | null;
  artifacts: string;
  replay: string;
}

export const EXIT_CODES = {
  SHIP: 0,          // All checks passed
  NO_SHIP: 1,       // Violations found
  MISCONFIG: 2,     // Missing Playwright/browsers/app start failure
  RUNTIME_ERROR: 3, // Unexpected crash
} as const;

export class RunManager {
  private projectPath: string;
  private runsDir: string;
  
  constructor(projectPath: string) {
    this.projectPath = projectPath;
    this.runsDir = path.join(projectPath, '.guardrail', 'runs');
  }

  /**
   * Generate a unique run ID
   */
  generateRunId(): string {
    const timestamp = Date.now().toString(36);
    const random = crypto.randomBytes(4).toString('hex');
    return `run_${timestamp}_${random}`;
  }

  /**
   * Get git commit SHA
   */
  getCommitSha(): string | null {
    try {
      return execSync('git rev-parse HEAD', { 
        cwd: this.projectPath, 
        encoding: 'utf-8',
        stdio: ['pipe', 'pipe', 'pipe']
      }).trim();
    } catch {
      return null;
    }
  }

  /**
   * Get git branch
   */
  getBranch(): string | null {
    try {
      return execSync('git rev-parse --abbrev-ref HEAD', { 
        cwd: this.projectPath, 
        encoding: 'utf-8',
        stdio: ['pipe', 'pipe', 'pipe']
      }).trim();
    } catch {
      return null;
    }
  }

  /**
   * Generate policy hash from configuration
   */
  generatePolicyHash(): string {
    const configFiles = [
      '.guardrailrc',
      '.guardrailrc.json',
      'guardrail.config.js',
      'guardrail.config.ts',
    ];
    
    let content = '';
    for (const file of configFiles) {
      const filePath = path.join(this.projectPath, file);
      if (fs.existsSync(filePath)) {
        content += fs.readFileSync(filePath, 'utf-8');
      }
    }
    
    // Include default policy if no config
    if (!content) {
      content = 'default-policy-v1';
    }
    
    return crypto.createHash('sha256').update(content).digest('hex').slice(0, 16);
  }

  /**
   * Create a new run folder with metadata
   */
  async createRun(runId: string, profile: 'default' | 'strict' | 'relaxed' = 'default'): Promise<RunArtifacts> {
    const runDir = path.join(this.runsDir, runId);
    const artifactsDir = path.join(runDir, 'artifacts');
    const replayDir = path.join(runDir, 'replay');

    // Create directories
    await fs.promises.mkdir(runDir, { recursive: true });
    await fs.promises.mkdir(artifactsDir, { recursive: true });
    await fs.promises.mkdir(replayDir, { recursive: true });

    // Generate metadata
    const metadata: RunMetadata = {
      runId,
      commitSha: this.getCommitSha(),
      branch: this.getBranch(),
      timestamp: new Date().toISOString(),
      profile,
      policyHash: this.generatePolicyHash(),
      nodeVersion: process.version,
      platform: process.platform,
      cwd: this.projectPath,
      cliVersion: this.getCliVersion(),
    };

    const metadataPath = path.join(runDir, 'metadata.json');
    await fs.promises.writeFile(metadataPath, JSON.stringify(metadata, null, 2));

    return {
      runDir,
      metadata: metadataPath,
      summary: path.join(runDir, 'summary.json'),
      reportTxt: path.join(runDir, 'report.txt'),
      reportJson: path.join(runDir, 'report.json'),
      reportHtml: null,
      sarifJson: null,
      artifacts: artifactsDir,
      replay: replayDir,
    };
  }

  /**
   * Save run summary
   */
  async saveSummary(runDir: string, summary: RunSummary): Promise<void> {
    const summaryPath = path.join(runDir, 'summary.json');
    await fs.promises.writeFile(summaryPath, JSON.stringify(summary, null, 2));
  }

  /**
   * Save text report
   */
  async saveReportTxt(runDir: string, content: string): Promise<void> {
    const reportPath = path.join(runDir, 'report.txt');
    await fs.promises.writeFile(reportPath, content);
  }

  /**
   * Save JSON report
   */
  async saveReportJson(runDir: string, data: any): Promise<void> {
    const reportPath = path.join(runDir, 'report.json');
    await fs.promises.writeFile(reportPath, JSON.stringify(data, null, 2));
  }

  /**
   * Save SARIF report for GitHub integration
   */
  async saveSarifReport(runDir: string, violations: any[]): Promise<string> {
    const sarifPath = path.join(runDir, 'sarif.json');
    
    const sarif = {
      $schema: 'https://raw.githubusercontent.com/oasis-tcs/sarif-spec/master/Schemata/sarif-schema-2.1.0.json',
      version: '2.1.0',
      runs: [{
        tool: {
          driver: {
            name: 'guardrail',
            version: this.getCliVersion(),
            informationUri: 'https://guardrail.dev',
            rules: this.generateSarifRules(violations),
          }
        },
        results: violations.map((v, idx) => ({
          ruleId: v.pattern || `violation-${idx}`,
          level: v.severity === 'critical' ? 'error' : 'warning',
          message: { text: v.message },
          locations: v.file ? [{
            physicalLocation: {
              artifactLocation: { uri: v.file },
              region: { startLine: v.line || 1 }
            }
          }] : [],
        })),
      }]
    };

    await fs.promises.writeFile(sarifPath, JSON.stringify(sarif, null, 2));
    return sarifPath;
  }

  /**
   * Generate SARIF rules from violations
   */
  private generateSarifRules(violations: any[]): any[] {
    const ruleMap = new Map();
    
    for (const v of violations) {
      const id = v.pattern || 'unknown';
      if (!ruleMap.has(id)) {
        ruleMap.set(id, {
          id,
          name: v.name || id,
          shortDescription: { text: v.message || 'Violation detected' },
          fullDescription: { text: v.description || v.message || 'Violation detected' },
          defaultConfiguration: { level: v.severity === 'critical' ? 'error' : 'warning' },
        });
      }
    }
    
    return Array.from(ruleMap.values());
  }

  /**
   * Copy artifacts from Playwright to run folder
   */
  async copyPlaywrightArtifacts(runDir: string, testResultsDir: string): Promise<void> {
    const artifactsDir = path.join(runDir, 'artifacts');
    
    if (!fs.existsSync(testResultsDir)) return;
    
    // Find and copy trace/video files
    const copyFiles = async (dir: string): Promise<void> => {
      try {
        const entries = await fs.promises.readdir(dir, { withFileTypes: true });
        
        for (const entry of entries) {
          const fullPath = path.join(dir, entry.name);
          
          if (entry.isDirectory()) {
            await copyFiles(fullPath);
          } else if (entry.isFile()) {
            const ext = path.extname(entry.name).toLowerCase();
            if (['.webm', '.zip', '.png', '.jpg'].includes(ext)) {
              const destPath = path.join(artifactsDir, entry.name);
              await fs.promises.copyFile(fullPath, destPath);
            }
          }
        }
      } catch {
        // Skip errors
      }
    };
    
    await copyFiles(testResultsDir);
  }

  /**
   * Save replay data
   */
  async saveReplay(runDir: string, replay: any): Promise<void> {
    const replayPath = path.join(runDir, 'replay', 'replay.json');
    await fs.promises.writeFile(replayPath, JSON.stringify(replay, null, 2));
  }

  /**
   * Get CLI version
   */
  private getCliVersion(): string {
    try {
      const pkgPath = path.join(__dirname, '..', '..', '..', 'package.json');
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
      return pkg.version || '1.0.0';
    } catch {
      return '1.0.0';
    }
  }

  /**
   * Get latest run
   */
  async getLatestRun(): Promise<string | null> {
    try {
      if (!fs.existsSync(this.runsDir)) return null;
      
      const runs = await fs.promises.readdir(this.runsDir);
      if (runs.length === 0) return null;
      
      // Sort by creation time (runId contains timestamp)
      runs.sort().reverse();
      return path.join(this.runsDir, runs[0]);
    } catch {
      return null;
    }
  }

  /**
   * List all runs
   */
  async listRuns(): Promise<{ runId: string; timestamp: string; verdict: string }[]> {
    try {
      if (!fs.existsSync(this.runsDir)) return [];
      
      const runs = await fs.promises.readdir(this.runsDir);
      const results = [];
      
      for (const runId of runs) {
        const summaryPath = path.join(this.runsDir, runId, 'summary.json');
        if (fs.existsSync(summaryPath)) {
          try {
            const summary = JSON.parse(await fs.promises.readFile(summaryPath, 'utf-8'));
            const metaPath = path.join(this.runsDir, runId, 'metadata.json');
            const meta = JSON.parse(await fs.promises.readFile(metaPath, 'utf-8'));
            results.push({
              runId,
              timestamp: meta.timestamp,
              verdict: summary.verdict,
            });
          } catch {
            // Skip invalid runs
          }
        }
      }
      
      return results.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
    } catch {
      return [];
    }
  }
}
