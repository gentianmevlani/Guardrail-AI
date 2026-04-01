/**
 * scan:vulnerabilities command (Enhanced)
 * Enterprise-grade vulnerability detection using real-time OSV integration
 * 
 * Features:
 * - Real-time OSV API queries with 24h caching
 * - Multi-ecosystem support (npm, PyPI, RubyGems, Go)
 * - CVSS scoring and vectors
 * - Remediation path analysis
 * - Direct vs transitive vulnerability grouping
 * - SARIF output support
 */

import { Command } from 'commander';
import { resolve, join } from 'path';
import { existsSync, readFileSync } from 'fs';
import { ExitCode, exitWith } from '../runtime/exit-codes';
import { VulnerabilityDatabase, type Ecosystem, type VulnerabilityCheckResult } from 'guardrail-security';
import { generateEvidence } from './evidence';
import { toSarifVulnerabilitiesEnhanced } from '../formatters/sarif-enhanced';

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

export interface EnhancedVulnResult {
  projectPath: string;
  scanType: string;
  ecosystem: Ecosystem;
  packagesScanned: number;
  findings: VulnerabilityCheckResult[];
  summary: {
    critical: number;
    high: number;
    medium: number;
    low: number;
  };
  directVulnerabilities: number;
  transitiveVulnerabilities: number;
  cacheHitRate: number;
  scanDuration: number;
}

interface PackageInfo {
  name: string;
  version: string;
  ecosystem: Ecosystem;
  isDirect: boolean;
}

/**
 * Detect ecosystem from project files
 */
function detectEcosystems(projectPath: string): Ecosystem[] {
  const ecosystems: Ecosystem[] = [];
  
  if (existsSync(join(projectPath, 'package.json')) || 
      existsSync(join(projectPath, 'package-lock.json')) ||
      existsSync(join(projectPath, 'pnpm-lock.yaml')) ||
      existsSync(join(projectPath, 'yarn.lock'))) {
    ecosystems.push('npm');
  }
  
  if (existsSync(join(projectPath, 'requirements.txt')) ||
      existsSync(join(projectPath, 'Pipfile')) ||
      existsSync(join(projectPath, 'poetry.lock')) ||
      existsSync(join(projectPath, 'pyproject.toml'))) {
    ecosystems.push('PyPI');
  }
  
  if (existsSync(join(projectPath, 'Gemfile')) ||
      existsSync(join(projectPath, 'Gemfile.lock'))) {
    ecosystems.push('RubyGems');
  }
  
  if (existsSync(join(projectPath, 'go.mod')) ||
      existsSync(join(projectPath, 'go.sum'))) {
    ecosystems.push('Go');
  }
  
  return ecosystems;
}

/**
 * Parse npm dependencies
 */
function parseNpmDependencies(projectPath: string): PackageInfo[] {
  const packages: PackageInfo[] = [];
  const packageJsonPath = join(projectPath, 'package.json');
  
  if (!existsSync(packageJsonPath)) return packages;
  
  try {
    const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'));
    const deps = packageJson.dependencies || {};
    const devDeps = packageJson.devDependencies || {};
    
    for (const [name, version] of Object.entries(deps)) {
      const cleanVersion = String(version).replace(/^[\^~>=<]+/, '');
      packages.push({ name, version: cleanVersion, ecosystem: 'npm', isDirect: true });
    }
    
    for (const [name, version] of Object.entries(devDeps)) {
      const cleanVersion = String(version).replace(/^[\^~>=<]+/, '');
      packages.push({ name, version: cleanVersion, ecosystem: 'npm', isDirect: true });
    }
    
    // Parse lockfile for transitive dependencies
    const lockPath = join(projectPath, 'package-lock.json');
    if (existsSync(lockPath)) {
      try {
        const lockData = JSON.parse(readFileSync(lockPath, 'utf-8'));
        const lockPackages = lockData.packages || {};
        
        for (const [pkgPath, pkgInfo] of Object.entries(lockPackages)) {
          if (typeof pkgInfo === 'object' && pkgInfo !== null) {
            const info = pkgInfo as { name?: string; version?: string };
            const name = info.name || pkgPath.replace(/^node_modules\//, '');
            const version = info.version;
            
            if (name && version && !packages.find(p => p.name === name)) {
              packages.push({ name, version, ecosystem: 'npm', isDirect: false });
            }
          }
        }
      } catch {
        // Lockfile parsing failed
      }
    }
  } catch {
    // Package.json parsing failed
  }
  
  return packages;
}

/**
 * Parse Python dependencies
 */
function parsePythonDependencies(projectPath: string): PackageInfo[] {
  const packages: PackageInfo[] = [];
  const requirementsPath = join(projectPath, 'requirements.txt');
  
  if (existsSync(requirementsPath)) {
    try {
      const content = readFileSync(requirementsPath, 'utf-8');
      const lines = content.split('\n');
      
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;
        
        const match = trimmed.match(/^([a-zA-Z0-9_-]+)(?:==|>=|<=|~=|>|<)?([\d.]+)?/);
        if (match) {
          const name = match[1];
          if (name === undefined) continue;
          const version = match[2] || 'latest';
          packages.push({ name, version, ecosystem: 'PyPI', isDirect: true });
        }
      }
    } catch {
      // Requirements.txt parsing failed
    }
  }
  
  return packages;
}

/**
 * Parse Ruby dependencies
 */
function parseRubyDependencies(projectPath: string): PackageInfo[] {
  const packages: PackageInfo[] = [];
  const gemfilePath = join(projectPath, 'Gemfile');
  
  if (existsSync(gemfilePath)) {
    try {
      const content = readFileSync(gemfilePath, 'utf-8');
      const lines = content.split('\n');
      
      for (const line of lines) {
        const trimmed = line.trim();
        const match = trimmed.match(/gem\s+['"]([^'"]+)['"]\s*,?\s*['"]?([~>=<\d.]+)?['"]?/);
        if (match) {
          const name = match[1];
          if (name === undefined) continue;
          const version = match[2]?.replace(/[~>=<]/g, '') || 'latest';
          packages.push({ name, version, ecosystem: 'RubyGems', isDirect: true });
        }
      }
    } catch {
      // Gemfile parsing failed
    }
  }
  
  return packages;
}

/**
 * Parse Go dependencies
 */
function parseGoDependencies(projectPath: string): PackageInfo[] {
  const packages: PackageInfo[] = [];
  const goModPath = join(projectPath, 'go.mod');
  
  if (existsSync(goModPath)) {
    try {
      const content = readFileSync(goModPath, 'utf-8');
      const lines = content.split('\n');
      let inRequire = false;
      
      for (const line of lines) {
        const trimmed = line.trim();
        
        if (trimmed.startsWith('require (')) {
          inRequire = true;
          continue;
        }
        
        if (inRequire && trimmed === ')') {
          inRequire = false;
          continue;
        }
        
        const match = trimmed.match(/^(?:require\s+)?([^\s]+)\s+v?([\d.]+)/);
        if (match) {
          const name = match[1];
          const version = match[2];
          if (name === undefined || version === undefined) continue;
          packages.push({ name, version, ecosystem: 'Go', isDirect: true });
        }
      }
    } catch {
      // go.mod parsing failed
    }
  }
  
  return packages;
}

/**
 * Scan vulnerabilities with OSV integration
 */
export async function scanVulnerabilitiesEnhanced(
  projectPath: string,
  options: any
): Promise<EnhancedVulnResult> {
  const startTime = Date.now();
  const ecosystems = detectEcosystems(projectPath);
  
  if (ecosystems.length === 0) {
    return {
      projectPath,
      scanType: 'vulnerabilities',
      ecosystem: 'npm',
      packagesScanned: 0,
      findings: [],
      summary: { critical: 0, high: 0, medium: 0, low: 0 },
      directVulnerabilities: 0,
      transitiveVulnerabilities: 0,
      cacheHitRate: 0,
      scanDuration: Date.now() - startTime,
    };
  }
  
  // Parse dependencies from all detected ecosystems
  let allPackages: PackageInfo[] = [];
  
  for (const ecosystem of ecosystems) {
    switch (ecosystem) {
      case 'npm':
        allPackages.push(...parseNpmDependencies(projectPath));
        break;
      case 'PyPI':
        allPackages.push(...parsePythonDependencies(projectPath));
        break;
      case 'RubyGems':
        allPackages.push(...parseRubyDependencies(projectPath));
        break;
      case 'Go':
        allPackages.push(...parseGoDependencies(projectPath));
        break;
    }
  }
  
  // Query OSV for vulnerabilities
  const db = new VulnerabilityDatabase();
  const results = await db.checkPackages(allPackages);
  
  // Calculate summary
  const summary = {
    critical: 0,
    high: 0,
    medium: 0,
    low: 0,
  };
  
  let directVulnerabilities = 0;
  let transitiveVulnerabilities = 0;
  
  for (const result of results) {
    if (result.isVulnerable) {
      for (const vuln of result.vulnerabilities) {
        summary[vuln.severity]++;
      }
      if (result.isDirect) {
        directVulnerabilities += result.vulnerabilities.length;
      } else {
        transitiveVulnerabilities += result.vulnerabilities.length;
      }
    }
  }
  
  const cacheStats = db.getCacheStats();
  
  return {
    projectPath,
    scanType: 'vulnerabilities',
    ecosystem: ecosystems[0] ?? 'npm',
    packagesScanned: allPackages.length,
    findings: results.filter(r => r.isVulnerable),
    summary,
    directVulnerabilities,
    transitiveVulnerabilities,
    cacheHitRate: cacheStats.hitRate,
    scanDuration: Date.now() - startTime,
  };
}

/**
 * Output enhanced vulnerability results
 */
export function outputEnhancedVulnResults(results: EnhancedVulnResult, options: any): void {
  if (options.format === 'json') {
    console.log(JSON.stringify(results, null, 2));
    return;
  }
  
  if (options.format === 'sarif') {
    const sarif = toSarifVulnerabilitiesEnhanced(results);
    console.log(JSON.stringify(sarif, null, 2));
    return;
  }
  
  console.log(`\n  ${c.info('Ecosystem:')} ${results.ecosystem}`);
  console.log(`  ${c.info('Packages scanned:')} ${results.packagesScanned}`);
  console.log(`  ${c.info('Cache hit rate:')} ${(results.cacheHitRate * 100).toFixed(1)}%`);
  console.log(`  ${c.info('Scan duration:')} ${(results.scanDuration / 1000).toFixed(2)}s\n`);
  
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
  
  console.log(`  ${c.info('Direct:')} ${results.directVulnerabilities} | ${c.info('Transitive:')} ${results.transitiveVulnerabilities}\n`);
  
  // Group by direct vs transitive
  const directFindings = results.findings.filter(f => f.isDirect);
  const transitiveFindings = results.findings.filter(f => !f.isDirect);
  
  if (directFindings.length > 0) {
    console.log(`${c.bold('  DIRECT DEPENDENCIES:')}\n`);
    outputFindingsList(directFindings);
  }
  
  if (transitiveFindings.length > 0) {
    console.log(`\n${c.bold('  TRANSITIVE DEPENDENCIES:')}\n`);
    outputFindingsList(transitiveFindings);
  }
}

function outputFindingsList(findings: VulnerabilityCheckResult[]): void {
  for (const finding of findings) {
    for (const vuln of finding.vulnerabilities) {
      const severityLabel = vuln.severity === 'critical' ? c.critical('CRITICAL') :
                           vuln.severity === 'high' ? c.high('HIGH') :
                           vuln.severity === 'medium' ? c.medium('MEDIUM') :
                           c.low('LOW');
      
      console.log(`  ${severityLabel} ${finding.package}@${finding.version}`);
      console.log(`  ${c.dim('├─')} ${c.info('ID:')} ${vuln.id}`);
      console.log(`  ${c.dim('├─')} ${c.info('Title:')} ${vuln.title}`);
      
      if (vuln.cvssScore != null && typeof vuln.cvssScore === 'number') {
        console.log(`  ${c.dim('├─')} ${c.info('CVSS:')} ${vuln.cvssScore.toFixed(1)}${vuln.cvssVector ? ` (${vuln.cvssVector})` : ''}`);
      }
      
      if (finding.remediationPath) {
        const remed = finding.remediationPath;
        const breakingLabel = remed.breakingChange ? c.medium(' [BREAKING]') : c.success(' [NON-BREAKING]');
        console.log(`  ${c.dim('└─')} ${c.info('Fix:')} ${remed.description}${breakingLabel}\n`);
      } else {
        console.log(`  ${c.dim('└─')} ${c.info('Fix:')} ${finding.recommendedVersion || 'No fix available'}\n`);
      }
    }
  }
}

export function registerScanVulnerabilitiesEnhancedCommand(
  program: Command,
  requireAuth: () => any,
  printLogo: () => void
): void {
  program
    .command('scan:vulnerabilities')
    .description('Scan dependencies for known vulnerabilities (OSV integration)')
    .option('-p, --path <path>', 'Project path to scan', '.')
    .option('-f, --format <format>', 'Output format: table, json, sarif', 'table')
    .option('-o, --output <file>', 'Output file path')
    .option('--fail-on-critical', 'Exit with error if critical vulnerabilities found', false)
    .option('--fail-on-high', 'Exit with error if high+ vulnerabilities found', false)
    .option('--evidence', 'Generate signed evidence pack', false)
    .option('--ecosystem <ecosystem>', 'Filter by ecosystem: npm, PyPI, RubyGems, Go')
    .action(async (opts) => {
      requireAuth();
      printLogo();
      console.log(`\n${c.bold('🛡️  VULNERABILITY SCAN (OSV Integration)')}\n`);
      
      const projectPath = resolve(opts.path);
      
      const results = await scanVulnerabilitiesEnhanced(projectPath, opts);
      
      console.log(`${c.success('✓')} Vulnerability scan complete`);
      
      outputEnhancedVulnResults(results, opts);
      
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
