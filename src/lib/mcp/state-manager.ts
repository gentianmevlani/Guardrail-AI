/**
 * MCP State Manager
 * 
 * Manages run history, findings, artifacts, and session state for the MCP plugin.
 * Enables "evidence-first" UX with stable IDs for diagnostics linking.
 */

import * as fs from 'fs';
import * as path from 'path';
import { createHash } from 'crypto';
import {
  getCloudSyncEnvFromEnv,
  uploadRunToCloud,
  shipVerdictToApi,
} from '@guardrail/core';

export interface Finding {
  id: string;
  runId: string;
  ruleId: string;
  title: string;
  description: string;
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
  file: string;
  line: number;
  column?: number;
  endLine?: number;
  endColumn?: number;
  evidence: {
    type: 'network' | 'code' | 'import' | 'config' | 'runtime';
    content: string;
    trace?: string[];
    request?: {
      url: string;
      method: string;
      headers?: Record<string, string>;
    };
    response?: {
      status: number;
      body?: string;
    };
  };
  fix?: {
    suggestion: string;
    autoFixable: boolean;
    diff?: string;
  };
  policy?: {
    canAllowlist: boolean;
    canDowngrade: boolean;
    currentSeverity: string;
  };
}

export interface RunResult {
  id: string;
  tool: 'ship' | 'reality' | 'mockproof' | 'airlock' | 'doctor';
  verdict: 'SHIP' | 'NO-SHIP' | 'REVIEW' | 'PASS' | 'FAIL';
  profile?: string;
  flow?: string;
  timestamp: string;
  duration: number;
  findings: Finding[];
  blockers: Finding[];
  warnings: Finding[];
  artifacts: Artifact[];
  summary: {
    totalFindings: number;
    criticalCount: number;
    highCount: number;
    mediumCount: number;
    lowCount: number;
  };
}

export interface Artifact {
  id: string;
  runId: string;
  type: 'report' | 'replay' | 'trace' | 'sarif' | 'badge';
  name: string;
  path: string;
  mimeType: string;
  size: number;
  timestamp: string;
}

export interface ServerStatus {
  connected: boolean;
  version: string;
  tier: 'free' | 'pro' | 'enterprise';
  mode: 'local' | 'ci';
  workspace: {
    path: string;
    trusted: boolean;
    hasConfig: boolean;
  };
  lastRun?: {
    tool: string;
    verdict: string;
    timestamp: string;
  };
}

export interface FixModeState {
  active: boolean;
  runId: string;
  blockers: Finding[];
  completed: string[];
  remaining: string[];
}

class MCPStateManager {
  private stateDir: string;
  private runs: Map<string, RunResult> = new Map();
  private findings: Map<string, Finding> = new Map();
  private artifacts: Map<string, Artifact> = new Map();
  private fixModeState: FixModeState | null = null;
  private lastRunByTool: Map<string, string> = new Map();

  constructor() {
    this.stateDir = path.join(process.cwd(), '.guardrail', 'mcp-state');
  }

  async initialize(projectPath: string): Promise<void> {
    this.stateDir = path.join(projectPath, '.guardrail', 'mcp-state');
    await fs.promises.mkdir(this.stateDir, { recursive: true });
    await this.loadState();
  }

  private async loadState(): Promise<void> {
    try {
      const statePath = path.join(this.stateDir, 'state.json');
      if (fs.existsSync(statePath)) {
        const data = JSON.parse(await fs.promises.readFile(statePath, 'utf-8'));
        
        if (data.runs) {
          this.runs = new Map(Object.entries(data.runs));
        }
        if (data.findings) {
          this.findings = new Map(Object.entries(data.findings));
        }
        if (data.artifacts) {
          this.artifacts = new Map(Object.entries(data.artifacts));
        }
        if (data.lastRunByTool) {
          this.lastRunByTool = new Map(Object.entries(data.lastRunByTool));
        }
        if (data.fixModeState) {
          this.fixModeState = data.fixModeState;
        }
      }
    } catch (error) {
      // State file doesn't exist or is corrupted, start fresh
    }
  }

  private async saveState(): Promise<void> {
    const statePath = path.join(this.stateDir, 'state.json');
    const data = {
      runs: Object.fromEntries(this.runs),
      findings: Object.fromEntries(this.findings),
      artifacts: Object.fromEntries(this.artifacts),
      lastRunByTool: Object.fromEntries(this.lastRunByTool),
      fixModeState: this.fixModeState,
    };
    await fs.promises.writeFile(statePath, JSON.stringify(data, null, 2));
  }

  generateRunId(tool: string): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 8);
    return `${tool}-${timestamp}-${random}`;
  }

  generateFindingId(finding: Partial<Finding>): string {
    const content = `${finding.ruleId}:${finding.file}:${finding.line}`;
    return createHash('sha256').update(content).digest('hex').substring(0, 12);
  }

  async recordRun(result: Omit<RunResult, 'id'>): Promise<RunResult> {
    const id = this.generateRunId(result.tool);
    const run: RunResult = { ...result, id };
    
    this.runs.set(id, run);
    this.lastRunByTool.set(result.tool, id);
    
    // Index findings
    for (const finding of run.findings) {
      finding.runId = id;
      finding.id = this.generateFindingId(finding);
      this.findings.set(finding.id, finding);
    }
    
    // Index artifacts
    for (const artifact of run.artifacts) {
      artifact.runId = id;
      this.artifacts.set(artifact.id, artifact);
    }
    
    await this.saveState();
    void this.syncRunToCloudIfConfigured(run).catch(() => {
      /* optional cloud sync */
    });
    return run;
  }

  private async syncRunToCloudIfConfigured(run: RunResult): Promise<void> {
    if (process.env.GUARDRAIL_SYNC === '0') {
      return;
    }
    const env = getCloudSyncEnvFromEnv();
    if (!env) {
      return;
    }
    const { verdict, score } = shipVerdictToApi(run.verdict);
    const projectRoot = path.dirname(path.dirname(this.stateDir));
    const repo = path.basename(projectRoot);
    await uploadRunToCloud({
      baseUrl: env.baseUrl,
      apiKey: env.apiKey,
      payload: {
        repo,
        branch: process.env.GUARDRAIL_BRANCH || process.env.GITHUB_REF_NAME,
        commitSha: process.env.GUARDRAIL_COMMIT_SHA || process.env.GITHUB_SHA,
        verdict,
        score,
        source: 'mcp',
        findings: run.findings,
        guardrailResult: {
          tool: run.tool,
          verdict: run.verdict,
          summary: run.summary,
          blockerCount: run.blockers.length,
        },
      },
    });
  }

  async getLastRun(tool?: string): Promise<RunResult | null> {
    if (tool) {
      const runId = this.lastRunByTool.get(tool);
      return runId ? this.runs.get(runId) || null : null;
    }
    
    // Get most recent run across all tools
    let latest: RunResult | null = null;
    for (const run of this.runs.values()) {
      if (!latest || new Date(run.timestamp) > new Date(latest.timestamp)) {
        latest = run;
      }
    }
    return latest;
  }

  async getRun(runId: string): Promise<RunResult | null> {
    return this.runs.get(runId) || null;
  }

  async getFinding(findingId: string): Promise<Finding | null> {
    return this.findings.get(findingId) || null;
  }

  async getArtifact(artifactId: string): Promise<Artifact | null> {
    return this.artifacts.get(artifactId) || null;
  }

  async getArtifactsByRun(runId: string): Promise<Artifact[]> {
    return Array.from(this.artifacts.values()).filter(a => a.runId === runId);
  }

  async startFixMode(runId: string): Promise<FixModeState> {
    const run = await this.getRun(runId);
    if (!run) {
      throw new Error(`Run ${runId} not found`);
    }
    
    this.fixModeState = {
      active: true,
      runId,
      blockers: run.blockers,
      completed: [],
      remaining: run.blockers.map(b => b.id),
    };
    
    await this.saveState();
    return this.fixModeState;
  }

  async markFixComplete(findingId: string): Promise<FixModeState | null> {
    if (!this.fixModeState) return null;
    
    if (this.fixModeState.remaining.includes(findingId)) {
      this.fixModeState.remaining = this.fixModeState.remaining.filter(id => id !== findingId);
      this.fixModeState.completed.push(findingId);
    }
    
    await this.saveState();
    return this.fixModeState;
  }

  async getFixModeState(): Promise<FixModeState | null> {
    return this.fixModeState;
  }

  async exitFixMode(): Promise<void> {
    this.fixModeState = null;
    await this.saveState();
  }

  async getStatus(projectPath: string): Promise<ServerStatus> {
    const configPath = path.join(projectPath, '.guardrailrc');
    const hasConfig = fs.existsSync(configPath);
    
    const lastRun = await this.getLastRun();
    
    return {
      connected: true,
      version: '1.0.0',
      tier: 'pro', // Could be read from license file
      mode: process.env.CI ? 'ci' : 'local',
      workspace: {
        path: projectPath,
        trusted: true, // Could implement workspace trust checking
        hasConfig,
      },
      lastRun: lastRun ? {
        tool: lastRun.tool,
        verdict: lastRun.verdict,
        timestamp: lastRun.timestamp,
      } : undefined,
    };
  }

  formatToast(run: RunResult): string {
    const verdict = run.verdict === 'SHIP' || run.verdict === 'PASS' ? 'SHIP' : 'NO-SHIP';
    const blockerCount = run.blockers.length;
    const hasReplay = run.artifacts.some(a => a.type === 'replay');
    
    let toast = `${verdict}`;
    if (blockerCount > 0) {
      toast += ` • ${blockerCount} blocker${blockerCount > 1 ? 's' : ''}`;
    }
    if (hasReplay) {
      toast += ' • Replay ready';
    }
    
    return toast;
  }
}

export const mcpStateManager = new MCPStateManager();
