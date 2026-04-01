/**
 * Replay Engine
 * 
 * Re-runs the exact proof checks that failed in a previous scan.
 * Generates proof bundles with traces, HAR files, screenshots.
 */

import * as fs from 'fs';
import * as path from 'path';
import { RealityFinding, RealitySniffResult } from './reality-sniff-scanner';

export interface ReplayResult {
  scanId: string;
  originalVerdict: string;
  replayVerdict: string;
  findings: RealityFinding[];
  fixed: RealityFinding[];
  stillBlocking: RealityFinding[];
  proofBundle?: string;
  duration: number;
}

export interface ProofBundle {
  scanId: string;
  timestamp: string;
  findings: RealityFinding[];
  traces?: Array<{
    type: 'http' | 'playwright' | 'ast';
    endpoint?: string;
    file?: string;
    evidence: any;
  }>;
  screenshots?: string[];
  har?: any;
}

export class ReplayEngine {
  private projectPath: string;
  private scanCacheDir: string;

  constructor(projectPath: string) {
    this.projectPath = projectPath;
    this.scanCacheDir = path.join(projectPath, '.guardrail', 'reality-sniff');
  }

  /**
   * Load a previous scan result
   */
  async loadScan(scanId: string): Promise<RealitySniffResult | null> {
    const scanFile = path.join(this.scanCacheDir, 'scans', `${scanId}.json`);
    
    if (!fs.existsSync(scanFile)) {
      return null;
    }

    try {
      const content = await fs.promises.readFile(scanFile, 'utf8');
      return JSON.parse(content);
    } catch {
      return null;
    }
  }

  /**
   * Replay a scan - re-run only the checks that failed
   */
  async replay(scanId: string): Promise<ReplayResult> {
    const startTime = Date.now();
    const original = await this.loadScan(scanId);

    if (!original) {
      throw new Error(`Scan ${scanId} not found`);
    }

    // Re-run scan with same options
    const { scanRealitySniff } = await import('./reality-sniff-scanner');
    const replayed = await scanRealitySniff({
      projectPath: this.projectPath,
      layers: {
        lexical: true,
        structural: true,
        runtime: original.layersExecuted.runtime,
      },
    });

    // Compare findings
    const fixed: RealityFinding[] = [];
    const stillBlocking: RealityFinding[] = [];

    const originalBlockers = new Map(
      original.blockers.map(f => [this.getFindingKey(f), f])
    );

    for (const newFinding of replayed.findings) {
      const key = this.getFindingKey(newFinding);
      const originalFinding = originalBlockers.get(key);

      if (originalFinding && originalFinding.verdict === 'FAIL') {
        if (newFinding.verdict !== 'FAIL') {
          // Fixed!
          fixed.push(originalFinding);
        } else {
          // Still blocking
          stillBlocking.push(newFinding);
        }
      }
    }

    // Generate proof bundle if there are still blockers
    let proofBundle: string | undefined;
    if (stillBlocking.length > 0) {
      proofBundle = await this.generateProofBundle(scanId, stillBlocking);
    }

    return {
      scanId,
      originalVerdict: original.verdict,
      replayVerdict: replayed.verdict,
      findings: replayed.findings,
      fixed,
      stillBlocking,
      proofBundle,
      duration: Date.now() - startTime,
    };
  }

  /**
   * Generate a proof bundle with traces, screenshots, HAR files
   */
  private async generateProofBundle(
    scanId: string,
    findings: RealityFinding[]
  ): Promise<string> {
    const bundleDir = path.join(this.scanCacheDir, 'proof-bundles', scanId);
    await fs.promises.mkdir(bundleDir, { recursive: true });

    const bundle: ProofBundle = {
      scanId,
      timestamp: new Date().toISOString(),
      findings,
      traces: [],
      screenshots: [],
    };

    // Collect traces for runtime findings
    for (const finding of findings) {
      if (finding.evidenceLevel === 'runtime') {
        for (const evidence of finding.evidence) {
          if (evidence.type === 'runtime') {
            bundle.traces?.push({
              type: 'http',
              file: finding.file,
              evidence: evidence.metadata,
            });
          }
        }
      }
    }

    // Save bundle
    const bundleFile = path.join(bundleDir, 'bundle.json');
    await fs.promises.writeFile(
      bundleFile,
      JSON.stringify(bundle, null, 2)
    );

    // Generate receipt for each finding
    const receiptsDir = path.join(bundleDir, 'receipts');
    await fs.promises.mkdir(receiptsDir, { recursive: true });

    const { RealityProofGraph } = await import('./reality-proof-graph');
    const graph = new RealityProofGraph();
    
    for (const finding of findings) {
      graph.addFinding(finding);
      const receipt = graph.generateReceipt(finding);
      
      const receiptFile = path.join(receiptsDir, `${finding.id}.txt`);
      await fs.promises.writeFile(receiptFile, receipt);
    }

    return bundleDir;
  }

  /**
   * Get a unique key for a finding (for comparison)
   */
  private getFindingKey(finding: RealityFinding): string {
    return `${finding.ruleId}:${finding.file}:${finding.line}:${finding.column || 0}`;
  }

  /**
   * Save a scan result for later replay
   */
  async saveScan(scanId: string, result: RealitySniffResult): Promise<void> {
    const scansDir = path.join(this.scanCacheDir, 'scans');
    await fs.promises.mkdir(scansDir, { recursive: true });

    const scanFile = path.join(scansDir, `${scanId}.json`);
    await fs.promises.writeFile(
      scanFile,
      JSON.stringify(result, null, 2)
    );
  }

  /**
   * List available scans for replay
   */
  async listScans(): Promise<Array<{ id: string; timestamp: string; verdict: string }>> {
    const scansDir = path.join(this.scanCacheDir, 'scans');
    
    if (!fs.existsSync(scansDir)) {
      return [];
    }

    const files = await fs.promises.readdir(scansDir);
    const scans: Array<{ id: string; timestamp: string; verdict: string }> = [];

    for (const file of files) {
      if (file.endsWith('.json')) {
        try {
          const content = await fs.promises.readFile(
            path.join(scansDir, file),
            'utf8'
          );
          const scan = JSON.parse(content);
          scans.push({
            id: scan.id || file.replace('.json', ''),
            timestamp: scan.timestamp || fs.statSync(path.join(scansDir, file)).mtime.toISOString(),
            verdict: scan.verdict || 'UNKNOWN',
          });
        } catch {
          // Skip invalid files
        }
      }
    }

    return scans.sort((a, b) => 
      new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
  }
}
