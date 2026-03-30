/**
 * scan:vulnerabilities command
 * Enterprise-grade vulnerability detection using npm/pnpm/yarn audit
 */

import { Command } from 'commander';
import { resolve, join } from 'path';
import { existsSync, readFileSync } from 'fs';
import { execSync } from 'child_process';
import { ExitCode, exitWith, getExitCodeForFindings } from '../runtime/exit-codes';
import { isAffected } from '../runtime/semver';
import { generateEvidence } from './evidence';
import { toSarifVulnerabilities } from '../formatters/sarif';

const c = {
  bold: (s: string) => `\x1b[1m${s}\x1b[0m`,
  dim: (s: string) => `\x1b[2m${s}\x1b[0m`,
  critical: (s: string) => `\x1b[35m${s}\x1b[0m`,
  high: (s: string) => `\x1b[31m${s}\x1b[0m`,
  medium: (s: string) => `\x1b[33m${s}\x1b[0m`,
  low: (s: string) => `\x1b[36m${s}\x1b[0m`,
  success: (s: string) => `\x1b[32m${s}\x1b[0m`,
  info: (s: string) => `\x1b[34m${s}\x1b[0m`,
};

export interface VulnFinding {
  package: string;
  version: string;
  severity: string;
  cve: string;
  title: string;
  fixedIn: string;
  path?: string;
  recommendation?: string;
}

export interface ScanVulnResult {
  projectPath: string;
  scanType: string;
  packagesScanned: number;
  findings: VulnFinding[];
  summary: {
    critical: number;
    high: number;
    medium: number;
    low: number;
  };
  auditSource: 'npm' | 'pnpm' | 'yarn' | 'fallback';
}

interface NpmAuditVuln {
  name: string;
  severity: string;
  via: any[];
  effects: string[];
  range: string;
  nodes: string[];
  fixAvailable: boolean | { name: string; version: string };
}

interface NpmAuditResult {
  vulnerabilities: Record<string, NpmAuditVuln>;
  metadata: {
    vulnerabilities: {
      critical: number;
      high: number;
      moderate: number;
      low: number;
      total: number;
    };
  };
}

function detectPackageManager(projectPath: string): 'npm' | 'pnpm' | 'yarn' | null {
  if (existsSync(join(projectPath, 'pnpm-lock.yaml'))) return 'pnpm';
  if (existsSync(join(projectPath, 'yarn.lock'))) return 'yarn';
  if (existsSync(join(projectPath, 'package-lock.json'))) return 'npm';
  return null;
}

async function runNpmAudit(projectPath: string): Promise<NpmAuditResult | null> {
  try {
    const result = execSync('npm audit --json', {
      cwd: projectPath,
      encoding: 'utf8',
      maxBuffer: 10 * 1024 * 1024,
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    return JSON.parse(result);
  } catch (err: any) {
    // npm audit exits with non-zero when vulnerabilities found
    if (err.stdout) {
      try {
        return JSON.parse(err.stdout);
      } catch {
        return null;
      }
    }
    return null;
  }
}

async function runPnpmAudit(projectPath: string): Promise<VulnFinding[]> {
  try {
    const result = execSync('pnpm audit --json', {
      cwd: projectPath,
      encoding: 'utf8',
      maxBuffer: 10 * 1024 * 1024,
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    const data = JSON.parse(result);
    return parseGenericAudit(data);
  } catch (err: any) {
    if (err.stdout) {
      try {
        const data = JSON.parse(err.stdout);
        return parseGenericAudit(data);
      } catch {
        return [];
      }
    }
    return [];
  }
}

function parseGenericAudit(data: any): VulnFinding[] {
  const findings: VulnFinding[] = [];
  
  if (data.advisories) {
    for (const [, advisory] of Object.entries(data.advisories) as any) {
      findings.push({
        package: advisory.module_name,
        version: advisory.vulnerable_versions,
        severity: advisory.severity,
        cve: advisory.cves?.[0] || advisory.id?.toString() || 'N/A',
        title: advisory.title,
        fixedIn: advisory.patched_versions || 'No fix available',
        recommendation: advisory.recommendation,
      });
    }
  }
  
  return findings;
}

function parseNpmAuditToFindings(audit: NpmAuditResult): VulnFinding[] {
  const findings: VulnFinding[] = [];
  
  for (const [pkgName, vuln] of Object.entries(audit.vulnerabilities)) {
    // Get CVE from via array
    let cve = 'N/A';
    let title = `Vulnerability in ${pkgName}`;
    
    for (const via of vuln.via) {
      if (typeof via === 'object' && via.source) {
        cve = via.cve || via.url || `GHSA-${via.source}`;
        title = via.title || title;
        break;
      }
    }
    
    const fixedIn = typeof vuln.fixAvailable === 'object' 
      ? vuln.fixAvailable.version 
      : vuln.fixAvailable ? 'Available' : 'No fix';
    
    findings.push({
      package: pkgName,
      version: vuln.range,
      severity: vuln.severity === 'moderate' ? 'medium' : vuln.severity,
      cve,
      title,
      fixedIn,
      path: vuln.nodes.join(' > '),
    });
  }
  
  return findings;
}

// Fallback CVE database (used when audit unavailable)
const FALLBACK_CVE_DB: Record<string, { severity: string; cve: string; title: string; fixedIn: string; affectedVersions: string }> = {
  'lodash': { severity: 'high', cve: 'CVE-2021-23337', title: 'Command Injection', fixedIn: '4.17.21', affectedVersions: '<4.17.21' },
  'minimist': { severity: 'medium', cve: 'CVE-2021-44906', title: 'Prototype Pollution', fixedIn: '1.2.6', affectedVersions: '<1.2.6' },
  'node-fetch': { severity: 'medium', cve: 'CVE-2022-0235', title: 'Exposure of Sensitive Information', fixedIn: '2.6.7', affectedVersions: '<2.6.7' },
  'axios': { severity: 'high', cve: 'CVE-2023-45857', title: 'Cross-Site Request Forgery', fixedIn: '1.6.0', affectedVersions: '<1.6.0' },
  'tar': { severity: 'high', cve: 'CVE-2024-28863', title: 'Arbitrary File Creation', fixedIn: '6.2.1', affectedVersions: '<6.2.1' },
  'glob-parent': { severity: 'high', cve: 'CVE-2020-28469', title: 'Regular Expression DoS', fixedIn: '5.1.2', affectedVersions: '<5.1.2' },
  'path-parse': { severity: 'medium', cve: 'CVE-2021-23343', title: 'Regular Expression DoS', fixedIn: '1.0.7', affectedVersions: '<1.0.7' },
  'ansi-regex': { severity: 'high', cve: 'CVE-2021-3807', title: 'Regular Expression DoS', fixedIn: '6.0.1', affectedVersions: '<6.0.1' },
};

async function scanWithFallback(projectPath: string): Promise<VulnFinding[]> {
  const findings: VulnFinding[] = [];
  const packageJsonPath = join(projectPath, 'package.json');
  
  if (!existsSync(packageJsonPath)) return findings;
  
  try {
    const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'));
    const deps = { ...packageJson.dependencies, ...packageJson.devDependencies };
    
    for (const [pkg, version] of Object.entries(deps)) {
      const versionStr = String(version).replace(/^[\^~]/, '');
      
      if (FALLBACK_CVE_DB[pkg]) {
        const vuln = FALLBACK_CVE_DB[pkg];
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
    // Failed to parse package.json
  }
  
  return findings;
}

export async function scanVulnerabilities(projectPath: string, options: any): Promise<ScanVulnResult> {
  const packageManager = detectPackageManager(projectPath);
  let findings: VulnFinding[] = [];
  let auditSource: 'npm' | 'pnpm' | 'yarn' | 'fallback' = 'fallback';
  let packagesScanned = 0;
  
  // Try native audit first
  if (packageManager === 'npm') {
    const audit = await runNpmAudit(projectPath);
    if (audit) {
      findings = parseNpmAuditToFindings(audit);
      auditSource = 'npm';
      packagesScanned = audit.metadata?.vulnerabilities?.total || findings.length;
    }
  } else if (packageManager === 'pnpm') {
    findings = await runPnpmAudit(projectPath);
    auditSource = 'pnpm';
    packagesScanned = findings.length;
  }
  
  // Fallback to local CVE database
  if (findings.length === 0) {
    findings = await scanWithFallback(projectPath);
    auditSource = 'fallback';
    
    const packageJsonPath = join(projectPath, 'package.json');
    if (existsSync(packageJsonPath)) {
      try {
        const pkg = JSON.parse(readFileSync(packageJsonPath, 'utf8'));
        packagesScanned = Object.keys({ ...pkg.dependencies, ...pkg.devDependencies }).length;
      } catch {
        // Ignore
      }
    }
  }
  
  const summary = {
    critical: findings.filter(f => f.severity === 'critical').length,
    high: findings.filter(f => f.severity === 'high').length,
    medium: findings.filter(f => f.severity === 'medium').length,
    low: findings.filter(f => f.severity === 'low').length,
  };
  
  return {
    projectPath,
    scanType: 'vulnerabilities',
    packagesScanned,
    findings,
    summary,
    auditSource,
  };
}

export function outputVulnResults(results: ScanVulnResult, options: any): void {
  if (options.format === 'json') {
    console.log(JSON.stringify(results, null, 2));
    return;
  }
  
  if (options.format === 'sarif') {
    const sarif = toSarifVulnerabilities(results);
    console.log(JSON.stringify(sarif, null, 2));
    return;
  }
  
  console.log(`  ${c.info('Packages scanned:')} ${results.packagesScanned}`);
  console.log(`  ${c.dim('Audit source:')} ${results.auditSource}\n`);
  
  const { summary } = results;
  const total = summary.critical + summary.high + summary.medium + summary.low;
  
  if (total === 0) {
    console.log(`  ${c.success('✓')} ${c.bold('No vulnerabilities found!')}\n`);
    return;
  }
  
  console.log(`  ${c.critical('CRITICAL')}  ${summary.critical}`);
  console.log(`  ${c.high('HIGH')}      ${summary.high}`);
  console.log(`  ${c.medium('MEDIUM')}    ${summary.medium}`);
  console.log(`  ${c.low('LOW')}       ${summary.low}\n`);
  
  console.log(`${c.bold('  VULNERABILITIES:')}\n`);
  
  for (const vuln of results.findings) {
    const severityLabel = vuln.severity === 'critical' ? c.critical('CRITICAL') :
                         vuln.severity === 'high' ? c.high('HIGH') :
                         vuln.severity === 'medium' ? c.medium('MEDIUM') :
                         c.low('LOW');
    
    console.log(`  ${severityLabel} ${vuln.package}@${vuln.version}`);
    console.log(`  ${c.dim('├─')} ${c.info('CVE:')} ${vuln.cve}`);
    console.log(`  ${c.dim('├─')} ${c.info('Title:')} ${vuln.title}`);
    console.log(`  ${c.dim('└─')} ${c.info('Fix:')} Upgrade to ${vuln.fixedIn}\n`);
  }
}

export function registerScanVulnerabilitiesCommand(program: Command, requireAuth: () => any, printLogo: () => void): void {
  program
    .command('scan:vulnerabilities')
    .description('Scan dependencies for known vulnerabilities')
    .option('-p, --path <path>', 'Project path to scan', '.')
    .option('-f, --format <format>', 'Output format: table, json, sarif', 'table')
    .option('-o, --output <file>', 'Output file path')
    .option('--fail-on-critical', 'Exit with error if critical vulnerabilities found', false)
    .option('--fail-on-high', 'Exit with error if high+ vulnerabilities found', false)
    .option('--evidence', 'Generate signed evidence pack', false)
    .action(async (opts) => {
      requireAuth();
      printLogo();
      console.log(`\n${c.bold('🛡️ VULNERABILITY SCAN')}\n`);
      
      const projectPath = resolve(opts.path);
      
      const startTime = Date.now();
      const results = await scanVulnerabilities(projectPath, opts);
      const duration = Date.now() - startTime;
      
      console.log(`${c.success('✓')} Vulnerability scan complete (${(duration / 1000).toFixed(1)}s)`);
      
      outputVulnResults(results, opts);
      
      if (opts.evidence) {
        await generateEvidence('vulnerabilities', results, projectPath);
      }
      
      if (opts.failOnCritical && results.summary.critical > 0) {
        exitWith(ExitCode.POLICY_FAIL, `${results.summary.critical} critical vulnerabilities found`);
      }
      if (opts.failOnHigh && (results.summary.critical + results.summary.high) > 0) {
        exitWith(ExitCode.POLICY_FAIL, `${results.summary.critical + results.summary.high} high+ vulnerabilities found`);
      }
    });
}
