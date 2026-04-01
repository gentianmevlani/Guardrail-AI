/**
 * Runs Reader - Load real run data from local artifacts or API
 * 
 * In dev mode, reads from .guardrail/runs directory
 * In production, fetches from API endpoint
 */

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

export interface Run {
  id: string;
  timestamp: string;
  repo: string;
  branch: string;
  commit: string;
  pr?: number;
  trigger: 'local' | 'ci' | 'mcp';
  profile: 'quick' | 'standard' | 'strict';
  verdict: 'SHIP' | 'NO_SHIP' | 'PENDING' | 'ERROR';
  duration: number;
  tools: string[];
  author?: string;
  policyHash?: string;
  score?: number;
  blockers?: string[];
  artifacts?: {
    report?: string;
    sarif?: string;
    replay?: string;
  };
}

export interface RunsData {
  runs: Run[];
  loading: boolean;
  error: string | null;
  source: 'local' | 'api' | 'none';
}

/**
 * Fetch runs from API endpoint
 */
export async function fetchRuns(): Promise<RunsData> {
  try {
    // Try API first
    const response = await fetch('/api/runs/', {
      headers: { 'Accept': 'application/json' },
    });
    
    if (response.ok) {
      const data = await response.json();
      return {
        runs: data.runs || [],
        loading: false,
        error: null,
        source: 'api',
      };
    }
    
    // API not available
    return {
      runs: [],
      loading: false,
      error: null,
      source: 'none',
    };
  } catch (error) {
    return {
      runs: [],
      loading: false,
      error: error instanceof Error ? error.message : 'Failed to fetch runs',
      source: 'none',
    };
  }
}

/**
 * Fetch a single run by ID
 */
export async function fetchRun(runId: string): Promise<{ run: Run | null; error: string | null }> {
  try {
    const response = await fetch(`/api/runs/${encodeURIComponent(runId)}`);
    
    if (response.ok) {
      const data = await response.json();
      return { run: data, error: null };
    }
    
    return { run: null, error: 'Run not found' };
  } catch (error) {
    return { 
      run: null, 
      error: error instanceof Error ? error.message : 'Failed to fetch run' 
    };
  }
}

/**
 * Check if runs data is available (API connected or local runs exist)
 */
export async function checkRunsAvailable(): Promise<{ 
  available: boolean; 
  source: 'api' | 'local' | 'none';
  message: string;
}> {
  try {
    const response = await fetch('/api/runs/status/');
    
    if (response.ok) {
      const data = await response.json();
      return {
        available: data.available,
        source: data.source,
        message: data.message || 'Runs data available',
      };
    }
    
    return {
      available: false,
      source: 'none',
      message: 'Run `guardrail ship` locally or connect GitHub to see runs.',
    };
  } catch {
    return {
      available: false,
      source: 'none',
      message: 'Run `guardrail ship` locally or connect GitHub to see runs.',
    };
  }
}

/**
 * Convert raw run data to UI format
 */
export function normalizeRun(
  runId: string,
  metadata: RunMetadata,
  summary: RunSummary
): Run {
  // Determine trigger based on metadata
  let trigger: Run['trigger'] = 'local';
  if (metadata.cwd?.includes('actions') || metadata.cwd?.includes('runner')) {
    trigger = 'ci';
  }
  
  // Map verdict
  let verdict: Run['verdict'] = 'PENDING';
  if (summary.verdict === 'ship') {
    verdict = 'SHIP';
  } else if (summary.verdict === 'no-ship') {
    verdict = 'NO_SHIP';
  } else if (summary.exitCode === 3) {
    verdict = 'ERROR';
  }
  
  // Map profile
  let profile: Run['profile'] = 'standard';
  if (metadata.profile === 'strict') {
    profile = 'strict';
  } else if (metadata.profile === 'relaxed') {
    profile = 'quick';
  }
  
  // Determine tools used
  const tools: string[] = [];
  if (summary.gates.mockproof.verdict !== 'skip') tools.push('mockproof');
  if (summary.gates.reality.verdict !== 'skip') tools.push('reality');
  if (summary.gates.badge.verdict !== 'skip') tools.push('badge');
  
  // Extract repo name from cwd
  const cwdParts = metadata.cwd?.split(/[\/\\]/) || [];
  const repo = cwdParts[cwdParts.length - 1] || 'unknown';
  
  return {
    id: runId,
    timestamp: metadata.timestamp,
    repo,
    branch: metadata.branch || 'unknown',
    commit: metadata.commitSha?.slice(0, 7) || 'unknown',
    trigger,
    profile,
    verdict,
    duration: Math.round(summary.duration / 1000),
    tools,
    policyHash: metadata.policyHash,
    score: summary.score,
    blockers: summary.blockers,
  };
}
