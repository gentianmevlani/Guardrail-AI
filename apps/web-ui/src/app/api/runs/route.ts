import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logger';
import fs from 'fs/promises';
import path from 'path';

/**
 * GET /api/runs
 * 
 * Returns runs from:
 * 1. Local .guardrail/runs directory (dev mode)
 * 2. Database via API server (production with GitHub integration)
 * 
 * If no runs available, returns empty array with helpful message.
 */
export async function GET(request: NextRequest) {
  try {
    // Try to read from local runs directory first
    const runsDir = path.join(process.cwd(), '..', '..', '.guardrail', 'runs');
    
    interface RunData {
      id: string;
      timestamp: string;
      repo: string;
      branch: string;
      commit?: string;
      trigger: string;
      profile?: string;
      verdict: string;
      duration?: number;
      tools?: string[];
      policyHash?: string;
      score?: number;
      blockers?: number;
      status?: string;
      securityResult?: unknown;
      realityResult?: unknown;
      guardrailResult?: unknown;
      traceUrl?: string;
      videoUrl?: string;
    }
    let runs: RunData[] = [];
    let source: 'local' | 'api' | 'database' | 'none' = 'none';
    
    try {
      const entries = await fs.readdir(runsDir, { withFileTypes: true });
      const runDirs = entries.filter(e => e.isDirectory()).map(e => e.name);
      
      for (const runId of runDirs.slice(0, 50)) {
        try {
          const runDir = path.join(runsDir, runId);
          const summaryPath = path.join(runDir, 'summary.json');
          const metadataPath = path.join(runDir, 'metadata.json');
          
          const [summaryRaw, metadataRaw] = await Promise.all([
            fs.readFile(summaryPath, 'utf-8').catch(() => null),
            fs.readFile(metadataPath, 'utf-8').catch(() => null),
          ]);
          
          if (summaryRaw && metadataRaw) {
            const summary = JSON.parse(summaryRaw);
            const metadata = JSON.parse(metadataRaw);
            
            // Normalize to UI format
            runs.push({
              id: runId,
              timestamp: metadata.timestamp,
              repo: path.basename(metadata.cwd || 'unknown'),
              branch: metadata.branch || 'unknown',
              commit: metadata.commitSha?.slice(0, 7) || 'unknown',
              trigger: 'local',
              profile: metadata.profile === 'strict' ? 'strict' : metadata.profile === 'relaxed' ? 'quick' : 'standard',
              verdict: summary.verdict === 'ship' ? 'SHIP' : 'NO_SHIP',
              duration: Math.round(summary.duration / 1000),
              tools: Object.entries(summary.gates || {})
                .filter(([_, v]) => (v as { verdict?: string }).verdict !== 'skip')
                .map(([k]) => k),
              policyHash: metadata.policyHash,
              score: summary.score,
              blockers: summary.blockers,
            });
          }
        } catch {
          // Skip invalid runs
        }
      }
      
      if (runs.length > 0) {
        source = 'local';
      }
      
      // Sort by timestamp descending
      runs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    } catch {
      // Local runs not available, try database via API server
    }
    
    // If no local runs, try fetching from database via API server
    if (runs.length === 0) {
      try {
        const apiUrl = (
          process.env.GUARDRAIL_API_URL ||
          process.env.NEXT_PUBLIC_API_URL ||
          'http://localhost:4000'
        ).replace(/\/$/, '');
        const response = await fetch(`${apiUrl}/api/runs/list`, {
          headers: {
            'Content-Type': 'application/json',
          },
          cache: 'no-store',
        });
        
        if (response.ok) {
          const data = await response.json();
          if (data.success && data.data?.runs) {
            interface ApiRunData {
              id: string;
              created_at?: string;
              createdAt?: string;
              repo: string;
              branch?: string;
              commit_sha?: string;
              commitSha?: string;
              verdict: string;
              score?: number;
              status?: string;
              security_result?: unknown;
              securityResult?: unknown;
              reality_result?: unknown;
              realityResult?: unknown;
              guardrail_result?: unknown;
              guardrailResult?: unknown;
              trace_url?: string;
              traceUrl?: string;
              video_url?: string;
              videoUrl?: string;
            }
            runs = data.data.runs.map((run: ApiRunData) => ({
              id: run.id,
              timestamp: run.created_at || run.createdAt,
              repo: run.repo,
              branch: run.branch || 'main',
              commit: run.commit_sha?.slice(0, 7) || run.commitSha?.slice(0, 7),
              trigger: 'github',
              verdict: run.verdict,
              score: run.score,
              status: run.status,
              securityResult: run.security_result || run.securityResult,
              realityResult: run.reality_result || run.realityResult,
              guardrailResult: run.guardrail_result || run.guardrailResult,
              traceUrl: run.trace_url || run.traceUrl,
              videoUrl: run.video_url || run.videoUrl,
            }));
            source = 'database';
          }
        }
      } catch (dbError) {
        logger.debug('Failed to fetch runs from database:', dbError);
      }
    }
    
    return NextResponse.json({
      runs,
      source,
      message: runs.length === 0 
        ? 'No runs found. Run `guardrail ship` locally or connect GitHub.'
        : `Found ${runs.length} run(s)`,
    });
  } catch (error) {
    logger.error('Failed to fetch runs:', error);
    return NextResponse.json({
      runs: [],
      source: 'none',
      error: 'Failed to fetch runs',
    }, { status: 500 });
  }
}
