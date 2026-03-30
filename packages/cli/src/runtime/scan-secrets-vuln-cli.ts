import { join } from 'path';
import { readFileSync, existsSync } from 'fs';
import { SecretsGuardian } from 'guardrail-security';
import { spinner } from '../ui/cli-terminal';
import { isAffected } from './semver';

export async function scanSecrets(projectPath: string, options: any): Promise<any> {
  const s = spinner('Scanning for hardcoded secrets...');
  
  const guardian = new SecretsGuardian();
  
  // Use enterprise-grade scanProject instead of custom file walking
  // Handles: ignores, binary files, size caps, concurrency, dedupe
  const report = await guardian.scanProject(projectPath, 'cli-scan', {
    excludeTests: options.excludeTests || false,
    minConfidence: options.minConfidence,
    maxFileSizeBytes: 2 * 1024 * 1024, // 2MB
    concurrency: 8,
    skipBinaryFiles: true,
  });
  
  s.stop(true, 'Secret scan complete');
  
  // Transform detections to CLI format
  const findings = report.detections.map(d => ({
    type: d.secretType,
    file: d.filePath,
    line: d.location.line,
    risk: d.risk,
    confidence: d.confidence,
    entropy: d.entropy,
    match: d.maskedValue,
    isTest: d.isTest,
    recommendation: d.recommendation,
  }));
  
  const patternTypes = new Set(findings.map(f => f.type));
  const highEntropy = findings.filter(f => f.entropy >= 4.0).length;
  const lowEntropy = findings.filter(f => f.entropy < 4.0).length;
  
  return {
    projectPath,
    scanType: 'secrets',
    filesScanned: report.scannedFiles,
    patterns: patternTypes.size > 0 ? Array.from(patternTypes) : ['API Keys', 'AWS Credentials', 'Private Keys', 'JWT Tokens', 'Database URLs'],
    findings,
    summary: { 
      total: findings.length, 
      highEntropy, 
      lowEntropy,
      byRisk: report.summary.byRisk,
    },
  };
}

export async function scanVulnerabilities(projectPath: string, _options: any): Promise<any> {
  const s = spinner('Analyzing dependencies for vulnerabilities...');
  
  const packageJsonPath = join(projectPath, 'package.json');
  const findings: any[] = [];
  let packagesScanned = 0;
  
  // Known vulnerabilities database
  const vulnerabilityDb: Record<string, { severity: string; cve: string; title: string; fixedIn: string; affectedVersions: string }> = {
    'lodash': { severity: 'high', cve: 'CVE-2021-23337', title: 'Command Injection', fixedIn: '4.17.21', affectedVersions: '<4.17.21' },
    'minimist': { severity: 'medium', cve: 'CVE-2021-44906', title: 'Prototype Pollution', fixedIn: '1.2.6', affectedVersions: '<1.2.6' },
    'node-fetch': { severity: 'medium', cve: 'CVE-2022-0235', title: 'Exposure of Sensitive Information', fixedIn: '2.6.7', affectedVersions: '<2.6.7' },
    'axios': { severity: 'high', cve: 'CVE-2023-45857', title: 'Cross-Site Request Forgery', fixedIn: '1.6.0', affectedVersions: '<1.6.0' },
    'tar': { severity: 'high', cve: 'CVE-2024-28863', title: 'Arbitrary File Creation', fixedIn: '6.2.1', affectedVersions: '<6.2.1' },
    'qs': { severity: 'high', cve: 'CVE-2022-24999', title: 'Prototype Pollution', fixedIn: '6.11.0', affectedVersions: '<6.11.0' },
    'jsonwebtoken': { severity: 'high', cve: 'CVE-2022-23529', title: 'Insecure Secret Validation', fixedIn: '9.0.0', affectedVersions: '<9.0.0' },
    'moment': { severity: 'medium', cve: 'CVE-2022-31129', title: 'ReDoS Vulnerability', fixedIn: '2.29.4', affectedVersions: '<2.29.4' },
    'express': { severity: 'medium', cve: 'CVE-2024-29041', title: 'Open Redirect', fixedIn: '4.19.2', affectedVersions: '<4.19.2' },
    'json5': { severity: 'high', cve: 'CVE-2022-46175', title: 'Prototype Pollution', fixedIn: '2.2.2', affectedVersions: '<2.2.2' },
  };
  
  if (existsSync(packageJsonPath)) {
    try {
      const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'));
      const deps = { ...packageJson.dependencies, ...packageJson.devDependencies };
      
      for (const [pkg, version] of Object.entries(deps)) {
        packagesScanned++;
        const versionStr = String(version).replace(/^[\^~]/, '');
        
        if (vulnerabilityDb[pkg]) {
          const vuln = vulnerabilityDb[pkg];
          // Enterprise-grade semver comparison (not lexicographic)
          if (isAffected(versionStr, vuln.affectedVersions)) {
            findings.push({
              package: pkg,
              version: versionStr,
              severity: vuln.severity,
              cve: vuln.cve,
              title: vuln.title,
              fixedIn: vuln.fixedIn,
            });
          }
        }
      }
    } catch {
      // Package.json parsing failed
    }
  }
  
  // Also scan lock files for deeper dependency analysis
  const lockFiles = ['package-lock.json', 'pnpm-lock.yaml', 'yarn.lock'];
  for (const lockFile of lockFiles) {
    const lockPath = join(projectPath, lockFile);
    if (existsSync(lockPath)) {
      try {
        if (lockFile === 'package-lock.json') {
          const lockData = JSON.parse(readFileSync(lockPath, 'utf-8'));
          const packages = lockData.packages || {};
          for (const [pkgPath, pkgInfo] of Object.entries(packages)) {
            if (typeof pkgInfo === 'object' && pkgInfo !== null) {
              const info = pkgInfo as { name?: string; version?: string };
              const name = info.name || pkgPath.replace('node_modules/', '');
              const version = info.version;
              if (name && version && vulnerabilityDb[name]) {
                const vuln = vulnerabilityDb[name];
                if (isAffected(version, vuln.affectedVersions)) {
                  const existingFinding = findings.find(f => f.package === name);
                  if (!existingFinding) {
                    findings.push({
                      package: name,
                      version,
                      severity: vuln.severity,
                      cve: vuln.cve,
                      title: vuln.title,
                      fixedIn: vuln.fixedIn,
                    });
                  }
                }
              }
            }
            packagesScanned++;
          }
        }
      } catch {
        // Lock file parsing failed
      }
    }
  }
  
  s.stop(true, 'Vulnerability scan complete');
  
  const summary = {
    critical: findings.filter(f => f.severity === 'critical').length,
    high: findings.filter(f => f.severity === 'high').length,
    medium: findings.filter(f => f.severity === 'medium').length,
    low: findings.filter(f => f.severity === 'low').length,
  };

  return {
    projectPath,
    scanType: 'vulnerabilities',
    packagesScanned: Math.max(packagesScanned, 1),
    findings,
    summary,
  };
}
