/**
 * scan:vulnerabilities command (OSV Integration)
 * 
 * Enterprise-grade vulnerability detection using real-time OSV API
 * 
 * Features:
 * - Real-time OSV API queries with 24h caching
 * - Lockfile parsing (package-lock.json, pnpm-lock.yaml, yarn.lock)
 * - Multi-ecosystem support (npm, PyPI, RubyGems, Go)
 * - CVSS scoring and vectors with optional NVD enrichment
 * - Remediation path analysis
 * - SARIF v2.1.0 output for GitHub code scanning
 * - Direct vs transitive vulnerability grouping
 */

import { Command } from 'commander';
import { resolve, join } from 'path';
import { existsSync, readFileSync } from 'fs';
import { ExitCode, exitWith } from '../runtime/exit-codes';
import { 
  VulnerabilityDatabase, 
  type Ecosystem, 
  type VulnerabilityCheckResult,
  type Vulnerability,
  type VulnerabilityDbOptions 
} from 'guardrail-security';
import { generateEvidence } from './evidence';

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

export interface OSVVulnResult {
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
  nvdEnriched: boolean;
  lockfilesParsed: string[];
}

interface PackageInfo {
  name: string;
  version: string;
  ecosystem: Ecosystem;
  isDirect: boolean;
  location?: { file: string; line?: number };
}

/**
 * Detect ecosystems from project files
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
 * Find line number of a dependency in package.json
 */
function findPackageJsonLine(content: string, packageName: string): number | undefined {
  const lines = content.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line?.includes(`"${packageName}"`)) {
      return i + 1;
    }
  }
  return undefined;
}

/**
 * Parse npm dependencies from package.json and lockfiles
 */
function parseNpmDependencies(projectPath: string): { packages: PackageInfo[]; lockfiles: string[] } {
  const packages: PackageInfo[] = [];
  const lockfiles: string[] = [];
  const packageJsonPath = join(projectPath, 'package.json');
  
  if (!existsSync(packageJsonPath)) return { packages, lockfiles };
  
  let packageJsonContent = '';
  
  try {
    packageJsonContent = readFileSync(packageJsonPath, 'utf-8');
    const packageJson = JSON.parse(packageJsonContent);
    const deps = packageJson.dependencies || {};
    const devDeps = packageJson.devDependencies || {};
    
    for (const [name, version] of Object.entries(deps)) {
      const cleanVersion = String(version).replace(/^[\^~>=<]+/, '');
      const line = findPackageJsonLine(packageJsonContent, name);
      packages.push({ 
        name, 
        version: cleanVersion, 
        ecosystem: 'npm', 
        isDirect: true,
        location: { file: 'package.json', line }
      });
    }
    
    for (const [name, version] of Object.entries(devDeps)) {
      const cleanVersion = String(version).replace(/^[\^~>=<]+/, '');
      const line = findPackageJsonLine(packageJsonContent, name);
      packages.push({ 
        name, 
        version: cleanVersion, 
        ecosystem: 'npm', 
        isDirect: true,
        location: { file: 'package.json', line }
      });
    }
  } catch {
    return { packages, lockfiles };
  }
  
  // Parse package-lock.json
  const npmLockPath = join(projectPath, 'package-lock.json');
  if (existsSync(npmLockPath)) {
    lockfiles.push('package-lock.json');
    try {
      const lockData = JSON.parse(readFileSync(npmLockPath, 'utf-8'));
      const lockPackages = lockData.packages || {};
      
      for (const [pkgPath, pkgInfo] of Object.entries(lockPackages)) {
        if (typeof pkgInfo === 'object' && pkgInfo !== null) {
          const info = pkgInfo as { name?: string; version?: string };
          const name = info.name || pkgPath.replace(/^node_modules\//, '');
          const version = info.version;
          
          if (name && version && !packages.find(p => p.name === name && p.version === version)) {
            packages.push({ 
              name, 
              version, 
              ecosystem: 'npm', 
              isDirect: false,
              location: { file: 'package-lock.json' }
            });
          }
        }
      }
    } catch {
      // Lockfile parsing failed
    }
  }
  
  // Parse pnpm-lock.yaml
  const pnpmLockPath = join(projectPath, 'pnpm-lock.yaml');
  if (existsSync(pnpmLockPath)) {
    lockfiles.push('pnpm-lock.yaml');
    try {
      const content = readFileSync(pnpmLockPath, 'utf-8');
      // Simple YAML parsing for pnpm lockfile
      const lines = content.split('\n');
      let inPackages = false;
      
      for (const line of lines) {
        if (line.startsWith('packages:')) {
          inPackages = true;
          continue;
        }
        
        if (inPackages && line.match(/^\s{2}'?\/([^@]+)@([^':]+)/)) {
          const match = line.match(/^\s{2}'?\/([^@]+)@([^':]+)/);
          if (match) {
            const name = match[1];
            const rawVer = match[2];
            if (name === undefined || rawVer === undefined) continue;
            const version = rawVer.replace(/['"]/g, '');
            if (!packages.find(p => p.name === name && p.version === version)) {
              packages.push({ 
                name, 
                version, 
                ecosystem: 'npm', 
                isDirect: false,
                location: { file: 'pnpm-lock.yaml' }
              });
            }
          }
        }
      }
    } catch {
      // Lockfile parsing failed
    }
  }
  
  // Parse yarn.lock
  const yarnLockPath = join(projectPath, 'yarn.lock');
  if (existsSync(yarnLockPath)) {
    lockfiles.push('yarn.lock');
    try {
      const content = readFileSync(yarnLockPath, 'utf-8');
      const lines = content.split('\n');
      let currentPackage = '';
      
      for (const line of lines) {
        // Match package header: "package@version:" or package@version:
        const headerMatch = line.match(/^"?([^@]+)@[^"]+:?\s*$/);
        if (headerMatch) {
          const pkgName = headerMatch[1];
          if (pkgName === undefined) continue;
          currentPackage = pkgName;
          continue;
        }
        
        // Match version line
        if (currentPackage && line.match(/^\s+version\s+"?([^"]+)"?/)) {
          const versionMatch = line.match(/^\s+version\s+"?([^"]+)"?/);
          if (versionMatch) {
            const version = versionMatch[1];
            if (version === undefined) continue;
            if (!packages.find(p => p.name === currentPackage && p.version === version)) {
              packages.push({ 
                name: currentPackage, 
                version, 
                ecosystem: 'npm', 
                isDirect: false,
                location: { file: 'yarn.lock' }
              });
            }
          }
          currentPackage = '';
        }
      }
    } catch {
      // Lockfile parsing failed
    }
  }
  
  return { packages, lockfiles };
}

/**
 * Parse Python dependencies
 */
function parsePythonDependencies(projectPath: string): { packages: PackageInfo[]; lockfiles: string[] } {
  const packages: PackageInfo[] = [];
  const lockfiles: string[] = [];
  const requirementsPath = join(projectPath, 'requirements.txt');
  
  if (existsSync(requirementsPath)) {
    lockfiles.push('requirements.txt');
    try {
      const content = readFileSync(requirementsPath, 'utf-8');
      const lines = content.split('\n');
      
      for (let i = 0; i < lines.length; i++) {
        const rawLine = lines[i];
        if (rawLine === undefined) continue;
        const line = rawLine.trim();
        if (!line || line.startsWith('#')) continue;
        
        const match = line.match(/^([a-zA-Z0-9_-]+)(?:==|>=|<=|~=|>|<)?([\d.]+)?/);
        if (match) {
          const name = match[1];
          if (name === undefined) continue;
          const version = match[2] || 'latest';
          packages.push({ 
            name, 
            version, 
            ecosystem: 'PyPI', 
            isDirect: true,
            location: { file: 'requirements.txt', line: i + 1 }
          });
        }
      }
    } catch {
      // Requirements parsing failed
    }
  }
  
  // Parse Pipfile.lock
  const pipfileLockPath = join(projectPath, 'Pipfile.lock');
  if (existsSync(pipfileLockPath)) {
    lockfiles.push('Pipfile.lock');
    try {
      const lockData = JSON.parse(readFileSync(pipfileLockPath, 'utf-8'));
      const sections = ['default', 'develop'];
      
      for (const section of sections) {
        const deps = lockData[section] || {};
        for (const [name, info] of Object.entries(deps)) {
          if (typeof info === 'object' && info !== null) {
            const pkgInfo = info as { version?: string };
            const version = pkgInfo.version?.replace(/^==/, '') || 'latest';
            if (!packages.find(p => p.name === name)) {
              packages.push({ 
                name, 
                version, 
                ecosystem: 'PyPI', 
                isDirect: section === 'default',
                location: { file: 'Pipfile.lock' }
              });
            }
          }
        }
      }
    } catch {
      // Pipfile.lock parsing failed
    }
  }
  
  return { packages, lockfiles };
}

/**
 * Parse Ruby dependencies
 */
function parseRubyDependencies(projectPath: string): { packages: PackageInfo[]; lockfiles: string[] } {
  const packages: PackageInfo[] = [];
  const lockfiles: string[] = [];
  
  // Parse Gemfile.lock for exact versions
  const gemfileLockPath = join(projectPath, 'Gemfile.lock');
  if (existsSync(gemfileLockPath)) {
    lockfiles.push('Gemfile.lock');
    try {
      const content = readFileSync(gemfileLockPath, 'utf-8');
      const lines = content.split('\n');
      let inSpecs = false;
      
      for (const line of lines) {
        if (line.trim() === 'specs:') {
          inSpecs = true;
          continue;
        }
        
        if (inSpecs && line.match(/^\s{4}(\S+)\s+\(([^)]+)\)/)) {
          const match = line.match(/^\s{4}(\S+)\s+\(([^)]+)\)/);
          if (match) {
            const gemName = match[1];
            const gemVer = match[2];
            if (gemName === undefined || gemVer === undefined) continue;
            packages.push({
              name: gemName,
              version: gemVer,
              ecosystem: 'RubyGems',
              isDirect: true,
              location: { file: 'Gemfile.lock' }
            });
          }
        }
        
        if (inSpecs && !line.startsWith('    ') && line.trim() !== '') {
          inSpecs = false;
        }
      }
    } catch {
      // Gemfile.lock parsing failed
    }
  }
  
  return { packages, lockfiles };
}

/**
 * Parse Go dependencies
 */
function parseGoDependencies(projectPath: string): { packages: PackageInfo[]; lockfiles: string[] } {
  const packages: PackageInfo[] = [];
  const lockfiles: string[] = [];
  
  // Parse go.sum for exact versions
  const goSumPath = join(projectPath, 'go.sum');
  if (existsSync(goSumPath)) {
    lockfiles.push('go.sum');
    try {
      const content = readFileSync(goSumPath, 'utf-8');
      const lines = content.split('\n');
      const seen = new Set<string>();
      
      for (const line of lines) {
        const match = line.match(/^(\S+)\s+v?([^\s/]+)/);
        if (match) {
          const name = match[1];
          const verRaw = match[2];
          if (name === undefined || verRaw === undefined) continue;
          const version = verRaw.replace('/go.mod', '');
          const key = `${name}@${version}`;
          
          if (!seen.has(key)) {
            seen.add(key);
            packages.push({
              name,
              version,
              ecosystem: 'Go',
              isDirect: true,
              location: { file: 'go.sum' }
            });
          }
        }
      }
    } catch {
      // go.sum parsing failed
    }
  }
  
  return { packages, lockfiles };
}

/**
 * Scan vulnerabilities with OSV integration
 */
export async function scanVulnerabilitiesOSV(
  projectPath: string,
  options: {
    noCache?: boolean;
    nvd?: boolean;
    ecosystem?: string;
  }
): Promise<OSVVulnResult> {
  const startTime = Date.now();
  const ecosystems = options.ecosystem 
    ? [options.ecosystem as Ecosystem]
    : detectEcosystems(projectPath);
  
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
      nvdEnriched: false,
      lockfilesParsed: [],
    };
  }
  
  // Parse dependencies from all detected ecosystems
  let allPackages: PackageInfo[] = [];
  let allLockfiles: string[] = [];
  
  for (const ecosystem of ecosystems) {
    let result: { packages: PackageInfo[]; lockfiles: string[] };
    
    switch (ecosystem) {
      case 'npm':
        result = parseNpmDependencies(projectPath);
        break;
      case 'PyPI':
        result = parsePythonDependencies(projectPath);
        break;
      case 'RubyGems':
        result = parseRubyDependencies(projectPath);
        break;
      case 'Go':
        result = parseGoDependencies(projectPath);
        break;
      default:
        result = { packages: [], lockfiles: [] };
    }
    
    allPackages.push(...result.packages);
    allLockfiles.push(...result.lockfiles);
  }
  
  // Deduplicate packages
  const seen = new Set<string>();
  allPackages = allPackages.filter(pkg => {
    const key = `${pkg.ecosystem}:${pkg.name}:${pkg.version}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  
  // Configure and query OSV
  const dbOptions: VulnerabilityDbOptions = {
    noCache: options.noCache,
    nvdEnrichment: options.nvd,
    cacheDir: join(projectPath, '.guardrail', 'cache'),
  };
  
  const db = new VulnerabilityDatabase(dbOptions);
  const results = await db.checkPackages(allPackages);
  
  // Attach location info to results
  const resultsWithLocation = results.map((result, idx) => ({
    ...result,
    location: allPackages[idx]?.location,
  }));
  
  // Calculate summary
  const summary = {
    critical: 0,
    high: 0,
    medium: 0,
    low: 0,
  };
  
  let directVulnerabilities = 0;
  let transitiveVulnerabilities = 0;
  
  for (const result of resultsWithLocation) {
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
    findings: resultsWithLocation.filter(r => r.isVulnerable),
    summary,
    directVulnerabilities,
    transitiveVulnerabilities,
    cacheHitRate: cacheStats.hitRate,
    scanDuration: Date.now() - startTime,
    nvdEnriched: options.nvd || false,
    lockfilesParsed: [...new Set(allLockfiles)],
  };
}

/**
 * Generate SARIF v2.1.0 output
 */
export function toSarifVulnerabilitiesOSV(results: OSVVulnResult): object {
  const version = '1.0.0';
  const ruleMap = new Map<string, object>();
  
  // Build rules from unique vulnerability IDs
  for (const finding of results.findings) {
    for (const vuln of finding.vulnerabilities) {
      if (!ruleMap.has(vuln.id)) {
        const cveId = vuln.aliases?.find(a => a.startsWith('CVE-'));
        
        ruleMap.set(vuln.id, {
          id: vuln.id,
          name: vuln.title.substring(0, 100),
          shortDescription: { text: vuln.title },
          fullDescription: { text: vuln.description || vuln.title },
          helpUri: vuln.references?.[0] || `https://osv.dev/vulnerability/${vuln.id}`,
          help: {
            text: `Vulnerability ${vuln.id} affects this package.\n\n` +
                  `Severity: ${vuln.severity.toUpperCase()}\n` +
                  (vuln.cvssScore ? `CVSS Score: ${vuln.cvssScore}\n` : '') +
                  (cveId ? `CVE: ${cveId}\n` : '') +
                  `\nReferences:\n${vuln.references?.map(r => `- ${r}`).join('\n') || 'None'}`,
            markdown: `## ${vuln.title}\n\n` +
                      `**Severity:** ${vuln.severity.toUpperCase()}\n\n` +
                      (vuln.cvssScore ? `**CVSS Score:** ${vuln.cvssScore}\n\n` : '') +
                      (vuln.cvssVector ? `**CVSS Vector:** \`${vuln.cvssVector}\`\n\n` : '') +
                      (cveId ? `**CVE:** [${cveId}](https://nvd.nist.gov/vuln/detail/${cveId})\n\n` : '') +
                      `### References\n${vuln.references?.map(r => `- [${r}](${r})`).join('\n') || 'None'}`,
          },
          defaultConfiguration: {
            level: vuln.severity === 'critical' || vuln.severity === 'high' ? 'error' :
                   vuln.severity === 'medium' ? 'warning' : 'note',
          },
          properties: {
            'security-severity': vuln.cvssScore?.toString() || 
                                 (vuln.severity === 'critical' ? '9.0' :
                                  vuln.severity === 'high' ? '7.0' :
                                  vuln.severity === 'medium' ? '4.0' : '2.0'),
            tags: ['security', 'vulnerability', 'dependency', vuln.source],
            precision: 'high',
          },
        });
      }
    }
  }
  
  const sarifResults: object[] = [];
  
  for (const finding of results.findings) {
    for (const vuln of finding.vulnerabilities) {
      const location = (finding as any).location || { file: 'package.json', line: 1 };
      const remediationText = finding.remediationPath
        ? `${finding.remediationPath.description}${finding.remediationPath.breakingChange ? ' (Breaking change)' : ''}`
        : `Upgrade to ${finding.recommendedVersion || 'latest'}`;
      
      sarifResults.push({
        ruleId: vuln.id,
        ruleIndex: Array.from(ruleMap.keys()).indexOf(vuln.id),
        level: vuln.severity === 'critical' || vuln.severity === 'high' ? 'error' :
               vuln.severity === 'medium' ? 'warning' : 'note',
        message: {
          text: `${vuln.title} in ${finding.package}@${finding.version}. ${remediationText}`,
        },
        locations: [{
          physicalLocation: {
            artifactLocation: {
              uri: location.file,
              uriBaseId: '%SRCROOT%',
            },
            region: {
              startLine: location.line || 1,
              startColumn: 1,
            },
          },
        }],
        fingerprints: {
          'guardrail/v1': `${vuln.id}:${finding.package}:${finding.version}`,
        },
        partialFingerprints: {
          'primaryLocationLineHash': `${finding.package}:${finding.version}:${vuln.id}`,
        },
        properties: {
          package: finding.package,
          version: finding.version,
          ecosystem: results.ecosystem,
          isDirect: finding.isDirect,
          severity: vuln.severity,
          cvssScore: vuln.cvssScore,
          cvssVector: vuln.cvssVector,
          cwe: vuln.cwe,
          aliases: vuln.aliases,
          source: vuln.source,
          affectedVersions: vuln.affectedVersions,
          patchedVersions: vuln.patchedVersions,
          references: vuln.references,
          remediationPath: finding.remediationPath,
          recommendedVersion: finding.recommendedVersion,
        },
      });
    }
  }
  
  return {
    $schema: 'https://raw.githubusercontent.com/oasis-tcs/sarif-spec/master/Schemata/sarif-schema-2.1.0.json',
    version: '2.1.0',
    runs: [{
      tool: {
        driver: {
          name: 'guardrail-cli-tool',
          version,
          informationUri: 'https://guardrailai.dev',
          rules: Array.from(ruleMap.values()),
        },
      },
      results: sarifResults,
      invocations: [{
        executionSuccessful: true,
        commandLine: `guardrail scan:vulnerabilities --path ${results.projectPath}`,
        startTimeUtc: new Date().toISOString(),
        workingDirectory: { uri: results.projectPath.replace(/\\/g, '/') },
      }],
    }],
  };
}

/**
 * Output OSV vulnerability results
 */
export function outputOSVVulnResults(results: OSVVulnResult, options: { format?: string }): void {
  if (options.format === 'json') {
    console.log(JSON.stringify(results, null, 2));
    return;
  }
  
  if (options.format === 'sarif') {
    const sarif = toSarifVulnerabilitiesOSV(results);
    console.log(JSON.stringify(sarif, null, 2));
    return;
  }
  
  console.log(`\n  ${c.info('Ecosystem:')} ${results.ecosystem}`);
  console.log(`  ${c.info('Packages scanned:')} ${results.packagesScanned}`);
  console.log(`  ${c.info('Lockfiles parsed:')} ${results.lockfilesParsed.join(', ') || 'none'}`);
  console.log(`  ${c.info('Cache hit rate:')} ${(results.cacheHitRate * 100).toFixed(1)}%`);
  console.log(`  ${c.info('NVD enrichment:')} ${results.nvdEnriched ? 'enabled' : 'disabled'}`);
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
      console.log(`  ${c.dim('├─')} ${c.info('Summary:')} ${vuln.title}`);
      
      if (vuln.cvssScore != null && typeof vuln.cvssScore === 'number') {
        console.log(`  ${c.dim('├─')} ${c.info('CVSS:')} ${vuln.cvssScore.toFixed(1)}${vuln.cvssVector ? ` (${vuln.cvssVector.substring(0, 30)}...)` : ''}`);
      }
      
      if (finding.remediationPath) {
        const remed = finding.remediationPath;
        const breakingLabel = remed.breakingChange ? c.medium(' [BREAKING]') : c.success(' [NON-BREAKING]');
        console.log(`  ${c.dim('└─')} ${c.info('Fix:')} ${remed.description}${breakingLabel}\n`);
      } else {
        console.log(`  ${c.dim('└─')} ${c.info('Fix:')} Upgrade to ${finding.recommendedVersion || 'latest'}\n`);
      }
    }
  }
}

/**
 * Register scan:vulnerabilities command with OSV integration
 */
export function registerScanVulnerabilitiesOSVCommand(
  program: Command,
  requireAuth: () => any,
  printLogo: () => void
): void {
  program
    .command('scan:vulnerabilities')
    .description('Scan dependencies for known vulnerabilities using OSV')
    .option('-p, --path <path>', 'Project path to scan', '.')
    .option('-f, --format <format>', 'Output format: table, json, sarif', 'table')
    .option('-o, --output <file>', 'Output file path')
    .option('--no-cache', 'Bypass cache and fetch fresh data from OSV')
    .option('--nvd', 'Enable NVD enrichment for CVSS scores (slower)')
    .option('--fail-on-critical', 'Exit with error if critical vulnerabilities found', false)
    .option('--fail-on-high', 'Exit with error if high+ vulnerabilities found', false)
    .option('--evidence', 'Generate signed evidence pack', false)
    .option('--ecosystem <ecosystem>', 'Filter by ecosystem: npm, PyPI, RubyGems, Go')
    .action(async (opts) => {
      requireAuth();
      printLogo();
      console.log(`\n${c.bold('🛡️  VULNERABILITY SCAN (OSV Integration)')}\n`);
      
      const projectPath = resolve(opts.path);
      
      if (opts.noCache) {
        console.log(`  ${c.dim('Cache:')} disabled (--no-cache)\n`);
      }
      if (opts.nvd) {
        console.log(`  ${c.dim('NVD enrichment:')} enabled\n`);
      }
      
      const results = await scanVulnerabilitiesOSV(projectPath, {
        noCache: opts.noCache,
        nvd: opts.nvd,
        ecosystem: opts.ecosystem,
      });
      
      console.log(`${c.success('✓')} Vulnerability scan complete`);
      
      outputOSVVulnResults(results, opts);
      
      // Write output file if specified
      if (opts.output) {
        const { writeFileSync } = require('fs');
        const output = opts.format === 'sarif' 
          ? toSarifVulnerabilitiesOSV(results)
          : results;
        writeFileSync(opts.output, JSON.stringify(output, null, 2));
        console.log(`\n  ${c.success('✓')} Report written to ${opts.output}`);
      }
      
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
