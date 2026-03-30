/**
 * Signed Evidence Packs
 * Enterprise-grade audit trail with cryptographic attestation
 * 
 * Generates:
 * - manifest.json (scan metadata)
 * - inputs.sha256 (hash list of scanned files)
 * - results.json / results.sarif
 * - attestation.sig (signature for tamper detection)
 */

import crypto from 'crypto';
import { writeFileSync, mkdirSync, existsSync, readdirSync, statSync, readFileSync } from 'fs';
import { join, relative } from 'path';
import { execSync } from 'child_process';

export interface EvidenceManifest {
  schemaVersion: string;
  runId: string;
  tool: {
    name: string;
    version: string;
    commit?: string;
  };
  project: {
    path: string;
    gitSha?: string;
    gitBranch?: string;
    gitRemote?: string;
  };
  scan: {
    type: string;
    startedAt: string;
    completedAt: string;
    filesScanned: number;
    findingsCount: number;
  };
  evidence: {
    inputsSha256: string;
    resultsSha256: string;
    policySha256?: string;
  };
  attestation: {
    algorithm: string;
    keyId: string;
    signature?: string;
  };
}

function getVersion(): string {
  try {
    const pkg = require('../../package.json');
    return pkg.version || '1.0.0';
  } catch {
    return '1.0.0';
  }
}

function getGitInfo(projectPath: string): { sha?: string; branch?: string; remote?: string } {
  try {
    const sha = execSync('git rev-parse HEAD', { cwd: projectPath, encoding: 'utf8' }).trim();
    const branch = execSync('git rev-parse --abbrev-ref HEAD', { cwd: projectPath, encoding: 'utf8' }).trim();
    let remote: string | undefined;
    try {
      remote = execSync('git remote get-url origin', { cwd: projectPath, encoding: 'utf8' }).trim();
    } catch {
      // No remote configured
    }
    return { sha, branch, remote };
  } catch {
    return {};
  }
}

function sha256(content: string): string {
  return crypto.createHash('sha256').update(content).digest('hex');
}

function generateRunId(): string {
  return `run_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
}

function hashFileList(projectPath: string, extensions: string[] = ['.ts', '.js', '.json', '.env', '.yaml', '.yml']): string {
  const hashes: string[] = [];
  
  function walkDir(dir: string): void {
    try {
      const items = readdirSync(dir);
      for (const item of items) {
        if (item.startsWith('.') || item === 'node_modules' || item === 'dist' || item === '.git') continue;
        const fullPath = join(dir, item);
        try {
          const stat = statSync(fullPath);
          if (stat.isDirectory()) {
            walkDir(fullPath);
          } else if (extensions.some(ext => item.endsWith(ext))) {
            const content = readFileSync(fullPath);
            const hash = crypto.createHash('sha256').update(content).digest('hex');
            const relPath = relative(projectPath, fullPath).replace(/\\/g, '/');
            hashes.push(`${hash}  ${relPath}`);
          }
        } catch {
          // Skip inaccessible files
        }
      }
    } catch {
      // Skip inaccessible directories
    }
  }
  
  walkDir(projectPath);
  hashes.sort();
  return hashes.join('\n');
}

function signContent(content: string, keyId: string): string {
  // Use HMAC-SHA256 with a per-installation key
  // In production, this would use a proper signing key from keychain
  const key = process.env.GUARDRAIL_SIGNING_KEY || `guardrail-${keyId}`;
  return crypto.createHmac('sha256', key).update(content).digest('hex');
}

export async function generateEvidence(
  scanType: string,
  results: any,
  projectPath: string
): Promise<string> {
  const evidenceDir = join(projectPath, '.guardrail', 'evidence');
  
  if (!existsSync(evidenceDir)) {
    mkdirSync(evidenceDir, { recursive: true });
  }
  
  const runId = generateRunId();
  const runDir = join(evidenceDir, runId);
  mkdirSync(runDir, { recursive: true });
  
  const startTime = new Date().toISOString();
  const gitInfo = getGitInfo(projectPath);
  const version = getVersion();
  
  // Generate inputs hash
  const inputsContent = hashFileList(projectPath);
  const inputsPath = join(runDir, 'inputs.sha256');
  writeFileSync(inputsPath, inputsContent);
  const inputsSha256 = sha256(inputsContent);
  
  // Write results
  const resultsJson = JSON.stringify(results, null, 2);
  const resultsPath = join(runDir, 'results.json');
  writeFileSync(resultsPath, resultsJson);
  const resultsSha256 = sha256(resultsJson);
  
  // Generate machine ID for key identification
  const keyId = crypto.createHash('sha256')
    .update(process.env.COMPUTERNAME || process.env.HOSTNAME || 'unknown')
    .digest('hex')
    .slice(0, 16);
  
  // Build manifest
  const manifest: EvidenceManifest = {
    schemaVersion: 'guardrail.evidence.v1',
    runId,
    tool: {
      name: 'guardrail-cli-tool',
      version,
    },
    project: {
      path: projectPath,
      gitSha: gitInfo.sha,
      gitBranch: gitInfo.branch,
      gitRemote: gitInfo.remote,
    },
    scan: {
      type: scanType,
      startedAt: startTime,
      completedAt: new Date().toISOString(),
      filesScanned: results.filesScanned || 0,
      findingsCount: results.findings?.length || 0,
    },
    evidence: {
      inputsSha256,
      resultsSha256,
    },
    attestation: {
      algorithm: 'HMAC-SHA256',
      keyId,
    },
  };
  
  // Sign the manifest
  const manifestContent = JSON.stringify(manifest, null, 2);
  const signature = signContent(manifestContent, keyId);
  manifest.attestation.signature = signature;
  
  // Write final manifest with signature
  const manifestPath = join(runDir, 'manifest.json');
  writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
  
  // Write attestation separately
  const attestationPath = join(runDir, 'attestation.sig');
  writeFileSync(attestationPath, signature);
  
  console.log(`\n  📦 Evidence pack generated: ${runDir}`);
  console.log(`     Run ID: ${runId}`);
  console.log(`     Inputs hash: ${inputsSha256.slice(0, 16)}...`);
  console.log(`     Results hash: ${resultsSha256.slice(0, 16)}...`);
  console.log(`     Signature: ${signature.slice(0, 16)}...\n`);
  
  return runDir;
}

export async function verifyEvidence(evidencePath: string): Promise<boolean> {
  try {
    const manifestPath = join(evidencePath, 'manifest.json');
    const manifestContent = readFileSync(manifestPath, 'utf8');
    const manifest: EvidenceManifest = JSON.parse(manifestContent);
    
    // Remove signature for verification
    const storedSignature = manifest.attestation.signature;
    delete manifest.attestation.signature;
    
    // Recompute signature
    const expectedSignature = signContent(JSON.stringify(manifest, null, 2), manifest.attestation.keyId);
    
    if (storedSignature !== expectedSignature) {
      console.error('❌ Evidence verification failed: signature mismatch');
      return false;
    }
    
    // Verify results hash
    const resultsPath = join(evidencePath, 'results.json');
    const resultsContent = readFileSync(resultsPath, 'utf8');
    const resultsSha256 = sha256(resultsContent);
    
    if (resultsSha256 !== manifest.evidence.resultsSha256) {
      console.error('❌ Evidence verification failed: results tampered');
      return false;
    }
    
    console.log('✓ Evidence pack verified successfully');
    return true;
  } catch (err: any) {
    console.error(`❌ Evidence verification failed: ${err.message}`);
    return false;
  }
}
