/**
 * Proof-of-Execution Receipt Generator
 * 
 * Generates tamper-evident receipt bundles for every PASS/SHIP verdict.
 * Includes cryptographic attestation and machine-verifiable evidence.
 */

import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';
import { createHash } from 'crypto';
import { RealityGraphBuilder } from './reality-graph';

export interface ReceiptBundle {
  schemaVersion: string;
  receiptId: string;
  verdict: 'PASS' | 'SHIP' | 'FAIL';
  timestamp: string;
  
  // Build & Dependencies
  build: {
    buildHash: string;
    dependencyLockHash: string;
    packageManager: string;
    nodeVersion: string;
    platform: string;
  };
  
  // Execution Evidence
  execution: {
    commands: Array<{
      command: string;
      args: string[];
      exitCode: number;
      stdout?: string;
      stderr?: string;
      duration: number;
      timestamp: string;
    }>;
    runtimeTraces: {
      requests: Array<{
        method: string;
        url: string;
        statusCode: number;
        timestamp: string;
        duration: number;
        headers?: Record<string, string>;
      }>;
      routes: Array<{
        path: string;
        method: string;
        hit: boolean;
        timestamp: string;
        responseTime?: number;
      }>;
      dbQueries?: Array<{
        query: string;
        duration: number;
        timestamp: string;
        table?: string;
      }>;
    };
  };
  
  // Coverage Evidence
  coverage: {
    criticalPaths: Array<{
      path: string;
      description: string;
      covered: boolean;
      evidence: string[]; // Screenshot/video paths
      timestamp: string;
    }>;
    coverageReport?: {
      totalPaths: number;
      coveredPaths: number;
      percentage: number;
    };
  };
  
  // Artifacts
  artifacts: {
    screenshots: string[];
    videos: string[];
    traces: string[];
    logs: string[];
  };
  
  // Attestation
  attestation: {
    algorithm: 'RS256' | 'ES256' | 'HMAC-SHA256';
    keyId: string;
    /** Omitted while verifying; always set when persisting a signed receipt */
    signature?: string;
    publicKey?: string; // For RSA/ECDSA
    signedAt: string;
  };
  
  // Metadata
  metadata: {
    projectPath: string;
    gitSha?: string;
    gitBranch?: string;
    runId: string;
    toolVersion: string;
    realityGraph?: {
      nodeCount: number;
      edgeCount: number;
      graphPath: string;
    };
  };
}

export interface ReceiptOptions {
  projectPath: string;
  runId: string;
  verdict: 'PASS' | 'SHIP' | 'FAIL';
  artifactDir: string;
  commands?: Array<{
    command: string;
    args: string[];
    exitCode: number;
    stdout?: string;
    stderr?: string;
    duration: number;
    timestamp: string;
  }>;
  runtimeTraces?: {
    requests?: Array<{
      method: string;
      url: string;
      statusCode: number;
      timestamp: string;
      duration: number;
      headers?: Record<string, string>;
    }>;
    routes?: Array<{
      path: string;
      method: string;
      hit: boolean;
      timestamp: string;
      responseTime?: number;
    }>;
    dbQueries?: Array<{
      query: string;
      duration: number;
      timestamp: string;
      table?: string;
    }>;
  };
  criticalPaths?: Array<{
    path: string;
    description: string;
    covered: boolean;
    evidence: string[];
    timestamp: string;
  }>;
  orgKeyId?: string;
  orgPrivateKey?: string;
}

/**
 * Get build hash from package-lock.json, yarn.lock, or pnpm-lock.yaml
 */
function getDependencyLockHash(projectPath: string): { hash: string; packageManager: string } {
  const lockFiles = [
    { file: 'package-lock.json', pm: 'npm' },
    { file: 'yarn.lock', pm: 'yarn' },
    { file: 'pnpm-lock.yaml', pm: 'pnpm' },
  ];
  
  for (const { file, pm } of lockFiles) {
    const lockPath = path.join(projectPath, file);
    if (fs.existsSync(lockPath)) {
      const content = fs.readFileSync(lockPath, 'utf-8');
      const hash = createHash('sha256').update(content).digest('hex');
      return { hash, packageManager: pm };
    }
  }
  
  return { hash: '', packageManager: 'unknown' };
}

/**
 * Get build hash from build artifacts or dist directory
 */
function getBuildHash(projectPath: string): string {
  const buildDirs = ['dist', 'build', '.next', 'out', '.turbo'];
  
  for (const dir of buildDirs) {
    const buildPath = path.join(projectPath, dir);
    if (fs.existsSync(buildPath) && fs.statSync(buildPath).isDirectory()) {
      return hashDirectory(buildPath);
    }
  }
  
  // If no build directory, hash package.json and source files
  const packageJsonPath = path.join(projectPath, 'package.json');
  if (fs.existsSync(packageJsonPath)) {
    const content = fs.readFileSync(packageJsonPath, 'utf-8');
    return createHash('sha256').update(content).digest('hex');
  }
  
  return '';
}

/**
 * Hash directory contents recursively
 */
function hashDirectory(dirPath: string): string {
  const hasher = createHash('sha256');
  
  function walk(currentPath: string) {
    const entries = fs.readdirSync(currentPath, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = path.join(currentPath, entry.name);
      
      // Skip node_modules, .git, etc.
      if (entry.name === 'node_modules' || entry.name === '.git' || entry.name.startsWith('.')) {
        continue;
      }
      
      if (entry.isDirectory()) {
        walk(fullPath);
      } else {
        try {
          const content = fs.readFileSync(fullPath);
          hasher.update(entry.name);
          hasher.update(content);
        } catch {
          // Skip files we can't read
        }
      }
    }
  }
  
  walk(dirPath);
  return hasher.digest('hex');
}

/**
 * Collect artifacts from artifact directory
 */
function collectArtifacts(artifactDir: string): {
  screenshots: string[];
  videos: string[];
  traces: string[];
  logs: string[];
} {
  const artifacts = {
    screenshots: [] as string[],
    videos: [] as string[],
    traces: [] as string[],
    logs: [] as string[],
  };
  
  if (!fs.existsSync(artifactDir)) {
    return artifacts;
  }
  
  function walk(currentPath: string, relativePath: string = '') {
    const entries = fs.readdirSync(currentPath, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = path.join(currentPath, entry.name);
      const relPath = path.join(relativePath, entry.name);
      
      if (entry.isDirectory()) {
        walk(fullPath, relPath);
      } else {
        const ext = path.extname(entry.name).toLowerCase();
        if (['.png', '.jpg', '.jpeg'].includes(ext)) {
          artifacts.screenshots.push(relPath);
        } else if (['.webm', '.mp4', '.mov'].includes(ext)) {
          artifacts.videos.push(relPath);
        } else if (ext === '.zip' && entry.name.includes('trace')) {
          artifacts.traces.push(relPath);
        } else if (['.log', '.txt'].includes(ext)) {
          artifacts.logs.push(relPath);
        }
      }
    }
  }
  
  walk(artifactDir);
  return artifacts;
}

/**
 * Get Git information
 */
function getGitInfo(projectPath: string): { sha?: string; branch?: string } {
  try {
    const sha = execSync('git rev-parse HEAD', { cwd: projectPath, encoding: 'utf-8' }).trim();
    const branch = execSync('git rev-parse --abbrev-ref HEAD', { cwd: projectPath, encoding: 'utf-8' }).trim();
    return { sha, branch };
  } catch {
    return {};
  }
}

/**
 * Sign receipt with organization key
 */
function signReceipt(
  receiptContent: string,
  orgKeyId: string,
  orgPrivateKey?: string
): { signature: string; algorithm: 'RS256' | 'ES256' | 'HMAC-SHA256' } {
  // If org private key provided, use RSA/ECDSA signing
  if (orgPrivateKey) {
    try {
      // Try RSA first
      const key = crypto.createPrivateKey(orgPrivateKey);
      const sign = crypto.createSign('RSA-SHA256');
      sign.update(receiptContent);
      const signature = sign.sign(key, 'base64');
      return { signature, algorithm: 'RS256' };
    } catch {
      // Try ECDSA
      try {
        const key = crypto.createPrivateKey(orgPrivateKey);
        const sign = crypto.createSign('sha256');
        sign.update(receiptContent);
        const signature = sign.sign(key, 'base64');
        return { signature, algorithm: 'ES256' };
      } catch {
        // Fall back to HMAC
      }
    }
  }
  
  // Fallback to HMAC with org key ID
  const key = process.env.GUARDRAIL_ORG_KEY || `org-${orgKeyId}`;
  const signature = crypto.createHmac('sha256', key).update(receiptContent).digest('hex');
  return { signature, algorithm: 'HMAC-SHA256' };
}

/**
 * Generate Proof-of-Execution Receipt
 */
export async function generateReceipt(options: ReceiptOptions): Promise<string> {
  const receiptDir = path.join(options.projectPath, '.guardrail', 'receipts', options.runId);
  fs.mkdirSync(receiptDir, { recursive: true });
  
  const timestamp = new Date().toISOString();
  const gitInfo = getGitInfo(options.projectPath);
  const { hash: dependencyLockHash, packageManager } = getDependencyLockHash(options.projectPath);
  const buildHash = getBuildHash(options.projectPath);
  const artifacts = collectArtifacts(options.artifactDir);
  
  // Try to load runtime traces from test output if not provided
  let runtimeTraces = options.runtimeTraces;
  if (!runtimeTraces) {
    const runtimeTracesPath = path.join(options.artifactDir, 'runtime-traces.json');
    if (fs.existsSync(runtimeTracesPath)) {
      try {
        const tracesData = JSON.parse(fs.readFileSync(runtimeTracesPath, 'utf-8'));
        runtimeTraces = {
          requests: tracesData.requests || [],
          routes: tracesData.routes || [],
          dbQueries: tracesData.dbQueries || [],
        };
      } catch (e) {
        // Ignore errors loading traces
        runtimeTraces = {
          requests: [],
          routes: [],
          dbQueries: [],
        };
      }
    } else {
      runtimeTraces = {
        requests: [],
        routes: [],
        dbQueries: [],
      };
    }
  }
  
  // Get tool version
  let toolVersion = 'unknown';
  try {
    const packageJsonPath = path.join(__dirname, '../../package.json');
    if (fs.existsSync(packageJsonPath)) {
      const pkg = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
      toolVersion = pkg.version || 'unknown';
    }
  } catch {
    // Ignore
  }
  
  // Update critical paths with evidence from artifacts and runtime traces
  const updatedCriticalPaths = (options.criticalPaths || []).map(path => {
    // Check if route was hit
    const routeHit = runtimeTraces?.routes?.some(r => r.path === path.path) || path.covered;
    
    // Find evidence files (screenshots/videos) that might relate to this path
    const pathEvidence = [
      ...artifacts.screenshots.filter(f => f.includes(path.path.replace(/\//g, '-'))),
      ...artifacts.videos.filter(f => f.includes(path.path.replace(/\//g, '-'))),
    ];
    
    return {
      ...path,
      covered: routeHit,
      evidence: pathEvidence.length > 0 ? pathEvidence : path.evidence,
    };
  });
  
  // Calculate coverage
  const coverageReport = updatedCriticalPaths.length > 0 ? {
    totalPaths: updatedCriticalPaths.length,
    coveredPaths: updatedCriticalPaths.filter(p => p.covered).length,
    percentage: Math.round((updatedCriticalPaths.filter(p => p.covered).length / updatedCriticalPaths.length) * 100),
  } : undefined;
  
  // Build receipt bundle
  const receipt: ReceiptBundle = {
    schemaVersion: 'guardrail.receipt.v1',
    receiptId: `receipt-${options.runId}-${Date.now()}`,
    verdict: options.verdict,
    timestamp,
    
    build: {
      buildHash,
      dependencyLockHash,
      packageManager,
      nodeVersion: process.version,
      platform: `${process.platform}-${process.arch}`,
    },
    
    execution: {
      commands: options.commands || [],
      runtimeTraces: {
        requests: runtimeTraces?.requests || [],
        routes: runtimeTraces?.routes || [],
        dbQueries: runtimeTraces?.dbQueries || [],
      },
    },
    
    coverage: {
      criticalPaths: updatedCriticalPaths,
      coverageReport,
    },
    
    artifacts: {
      screenshots: artifacts.screenshots,
      videos: artifacts.videos,
      traces: artifacts.traces,
      logs: artifacts.logs,
    },
    
    attestation: {
      algorithm: 'HMAC-SHA256',
      keyId: options.orgKeyId || 'default',
      signature: '',
      signedAt: timestamp,
    },
    
    metadata: {
      projectPath: options.projectPath,
      gitSha: gitInfo.sha,
      gitBranch: gitInfo.branch,
      runId: options.runId,
      toolVersion,
    },
  };
  
  // Sign the receipt (without signature field)
  const receiptContent = JSON.stringify(receipt, null, 2);
  const { signature, algorithm } = signReceipt(
    receiptContent,
    receipt.attestation.keyId,
    options.orgPrivateKey
  );
  
  receipt.attestation.signature = signature;
  receipt.attestation.algorithm = algorithm;
  
  // Write receipt bundle
  const receiptPath = path.join(receiptDir, 'receipt.json');
  fs.writeFileSync(receiptPath, JSON.stringify(receipt, null, 2));
  
  // Copy artifacts to receipt directory
  const receiptArtifactsDir = path.join(receiptDir, 'artifacts');
  if (fs.existsSync(options.artifactDir)) {
    copyDirectoryRecursive(options.artifactDir, receiptArtifactsDir);
  }
  
  // Build Reality Graph from execution evidence
  const graphBuilder = new RealityGraphBuilder(options.projectPath);
  graphBuilder.discoverStaticNodes();
  graphBuilder.updateFromRuntimeTraces(runtimeTraces);
  graphBuilder.saveSnapshot();
  
  // Export Reality Graph
  const graphPath = path.join(receiptDir, 'reality-graph.json');
  fs.writeFileSync(graphPath, graphBuilder.export());
  
  // Add graph summary to receipt metadata
  const graph = graphBuilder.getGraph();
  receipt.metadata = {
    ...receipt.metadata,
    realityGraph: {
      nodeCount: graph.nodes.size,
      edgeCount: graph.edges.size,
      graphPath: 'reality-graph.json',
    },
  };
  
  // Re-sign receipt with updated metadata
  const updatedReceiptContent = JSON.stringify(receipt, null, 2);
  const { signature: updatedSignature, algorithm: updatedAlgorithm } = signReceipt(
    updatedReceiptContent,
    receipt.attestation.keyId,
    options.orgPrivateKey
  );
  receipt.attestation.signature = updatedSignature;
  receipt.attestation.algorithm = updatedAlgorithm;
  
  // Write updated receipt
  fs.writeFileSync(receiptPath, JSON.stringify(receipt, null, 2));
  
  // Create receipt manifest
  const manifest = {
    receiptId: receipt.receiptId,
    receiptPath: 'receipt.json',
    artifactsDir: 'artifacts',
    realityGraphPath: 'reality-graph.json',
    verified: false,
  };
  fs.writeFileSync(
    path.join(receiptDir, 'manifest.json'),
    JSON.stringify(manifest, null, 2)
  );
  
  return receiptPath;
}

/**
 * Verify receipt signature
 */
export async function verifyReceipt(receiptPath: string, orgPublicKey?: string): Promise<boolean> {
  try {
    const receiptContent = fs.readFileSync(receiptPath, 'utf-8');
    const receipt: ReceiptBundle = JSON.parse(receiptContent);
    
    // Extract signature
    const storedSignature = receipt.attestation.signature;
    if (storedSignature === undefined) {
      return false;
    }
    delete receipt.attestation.signature;
    
    // Recompute signature
    const contentToVerify = JSON.stringify(receipt, null, 2);
    
    let isValid = false;
    
    if (receipt.attestation.algorithm === 'RS256' && orgPublicKey) {
      try {
        const key = crypto.createPublicKey(orgPublicKey);
        const verify = crypto.createVerify('RSA-SHA256');
        verify.update(contentToVerify);
        isValid = verify.verify(key, storedSignature, 'base64');
      } catch {
        isValid = false;
      }
    } else if (receipt.attestation.algorithm === 'ES256' && orgPublicKey) {
      try {
        const key = crypto.createPublicKey(orgPublicKey);
        const verify = crypto.createVerify('sha256');
        verify.update(contentToVerify);
        isValid = verify.verify(key, storedSignature, 'base64');
      } catch {
        isValid = false;
      }
    } else {
      // HMAC verification
      const key = process.env.GUARDRAIL_ORG_KEY || `org-${receipt.attestation.keyId}`;
      const expectedSignature = crypto.createHmac('sha256', key).update(contentToVerify).digest('hex');
      isValid = storedSignature === expectedSignature;
    }
    
    // Restore signature for return
    receipt.attestation.signature = storedSignature;
    
    return isValid;
  } catch (error: any) {
    console.error(`Receipt verification failed: ${error.message}`);
    return false;
  }
}

/**
 * Recursively copy directory
 */
function copyDirectoryRecursive(src: string, dest: string): void {
  if (!fs.existsSync(dest)) {
    fs.mkdirSync(dest, { recursive: true });
  }
  
  const entries = fs.readdirSync(src, { withFileTypes: true });
  
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    
    if (entry.isDirectory()) {
      copyDirectoryRecursive(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

/**
 * Generate receipt summary for display
 */
export function generateReceiptSummary(receiptPath: string): string {
  try {
    const receipt: ReceiptBundle = JSON.parse(fs.readFileSync(receiptPath, 'utf-8'));
    
    const summary = `
╔════════════════════════════════════════════════════════════╗
║  📜 PROOF-OF-EXECUTION RECEIPT                             ║
╚════════════════════════════════════════════════════════════╝

Receipt ID: ${receipt.receiptId}
Verdict: ${receipt.verdict}
Timestamp: ${receipt.timestamp}

Build Evidence:
  • Build Hash: ${receipt.build.buildHash.slice(0, 16)}...
  • Dependency Lock: ${receipt.build.dependencyLockHash.slice(0, 16)}... (${receipt.build.packageManager})
  • Platform: ${receipt.build.platform}
  • Node: ${receipt.build.nodeVersion}

Execution Evidence:
  • Commands Run: ${receipt.execution.commands.length}
  • HTTP Requests: ${receipt.execution.runtimeTraces.requests.length}
  • Routes Hit: ${receipt.execution.runtimeTraces.routes.length}
  • DB Queries: ${receipt.execution.runtimeTraces.dbQueries?.length || 0}

Coverage:
  • Critical Paths: ${receipt.coverage.criticalPaths.length}
  • Covered: ${receipt.coverage.criticalPaths.filter(p => p.covered).length}
  ${receipt.coverage.coverageReport ? `• Coverage: ${receipt.coverage.coverageReport.percentage}%` : ''}

Artifacts:
  • Screenshots: ${receipt.artifacts.screenshots.length}
  • Videos: ${receipt.artifacts.videos.length}
  • Traces: ${receipt.artifacts.traces.length}
  • Logs: ${receipt.artifacts.logs.length}

Attestation:
  • Algorithm: ${receipt.attestation.algorithm}
  • Key ID: ${receipt.attestation.keyId}
  • Signature: ${(receipt.attestation.signature ?? '').slice(0, 32)}...

Receipt Path: ${receiptPath}
`;
    
    return summary;
  } catch (error: any) {
    return `Failed to generate summary: ${error.message}`;
  }
}
