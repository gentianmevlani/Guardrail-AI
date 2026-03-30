import { Command } from 'commander';
import { resolve, basename } from 'path';
import { readFileSync, existsSync, writeFileSync, mkdirSync, readdirSync, statSync } from 'fs';
import { join } from 'path';
import { SecretsGuardian, SBOMGenerator } from 'guardrail-security';
import {
  loadAuthState,
  saveAuthState,
  clearAuthState,
  type AuthState,
  type Tier,
  getConfigPath,
} from '../runtime/creds';
import { validateCredentials, validateApiKey, getCacheExpiry } from '../runtime/client';
import { ExitCode, exitWith, getExitCodeForFindings } from '../runtime/exit-codes';
import { createJsonOutput, formatScanResults } from '../runtime/json-output';
import { isAffected } from '../runtime/semver';
import {
  scanVulnerabilitiesOSV,
  outputOSVVulnResults,
  toSarifVulnerabilitiesOSV,
} from './scan-vulnerabilities-osv';
import { maskApiKey, isExpiryWarning, formatExpiry, validateApiKeyFormat, hoursUntilExpiry } from '../runtime/auth-utils';
import { printCommandHeader } from '../ui/frame';
import {
  detectFramework,
  formatFrameworkName,
  getTemplate,
  validateConfig,
  mergeWithFrameworkDefaults,
  getTemplateChoices,
  generateCIWorkflow,
  getCIProviderFromProject,
  installHooks,
  getRecommendedRunner,
  type TemplateType,
} from '../init';
import { CLI_VERSION } from '../cli-program';
import { loadConfig, saveConfig, CONFIG_FILE, isInteractiveAllowed, defaultReportPath } from '../runtime/cli-config';
import { requireAuth, requireAuthAsync } from '../runtime/cli-auth';
import { delay } from '../utils/delay';
import { icons, styles, box, c, frameLines, truncatePath, printDivider, printLogo, spinner, promptSelect, promptInput, promptConfirm, promptPassword } from '../ui';
import { printMenuHeader } from '../ui/cli-menus';
import { runScanEnterprise, outputResultsEnterprise } from '../runtime/enterprise-scan-cli';
import { runScan } from '../runtime/local-scan-demo';
import { scanSecrets, scanVulnerabilities } from '../runtime/scan-secrets-vuln-cli';
import { scanCompliance, generateSBOM, generateContainerSBOM } from '../runtime/compliance-sbom-cli';
import { initProject } from '../runtime/init-project-cli';
import {
  outputResults,
  outputSecretsResults,
  outputVulnResults,
  outputComplianceResults,
} from '../runtime/scan-output-cli';
import { getCriticalPathsForFlow } from '../reality/critical-paths';


export function registerScansCoreCommands(program: Command): void {
// Enterprise / API-backed umbrella scan (distinct from `scan` = local Reality Sniff in scan-consolidated.ts)
program
  .command('scan:enterprise')
  .description(
    'Run full security scans via enterprise pipeline (secrets, vulns, compliance by type). For local Reality Sniff + proof graph, use `scan`.'
  )
  .option('-p, --path <path>', 'Project path to scan', '.')
  .option('-t, --type <type>', 'Scan type: all, secrets, vulnerabilities, compliance', 'all')
  .option('-f, --format <format>', 'Output format: json, sarif, table, markdown', 'table')
  .option('-o, --output <file>', 'Output file path')
  .option('--fail-on-critical', 'Exit with error if critical issues found', false)
  .option('--fail-on-high', 'Exit with error if high or critical issues found', false)
  .option('-q, --quiet', 'Suppress output except for errors', false)
  .option('--since <commit>', 'Incremental mode: scan only files changed since commit')
  .option('--baseline <path>', 'Suppress known findings from baseline file')
  .action(async (options) => {
    const config = requireAuth();
    printLogo();
    const projectPath = resolve(options.path);
    const projectName = basename(projectPath);
    
    const metadata: Array<{ key: string; value: string }> = [
      { key: 'Scan Type', value: options.type },
    ];
    if (options.since) {
      metadata.push({ key: 'Incremental', value: `since ${options.since}` });
    }
    if (options.baseline) {
      metadata.push({ key: 'Baseline', value: options.baseline });
    }
    
    printCommandHeader({
      title: 'SECURITY SCAN',
      icon: icons.scan,
      projectName,
      projectPath,
      metadata,
      tier: (await config).tier,
      authenticated: !!(await config).apiKey,
    });
    
    try {
      const results = await runScanEnterprise(projectPath, options);
      outputResultsEnterprise(results, options);
      
      // Safe property access with defaults for graceful degradation
      const summary = results?.summary || { critical: 0, high: 0, medium: 0, low: 0, info: 0 };
      
      if (options.failOnCritical && (summary.critical || 0) > 0) {
        console.log('');
        console.log(`  ${styles.brightRed}${icons.error}${styles.reset} ${styles.bold}Critical issues found${styles.reset}`);
        console.log('');
        exitWith(ExitCode.POLICY_FAIL, 'Critical issues detected');
      }
      if (options.failOnHigh && ((summary.critical || 0) > 0 || (summary.high || 0) > 0)) {
        console.log('');
        console.log(`  ${styles.brightRed}${icons.error}${styles.reset} ${styles.bold}High severity issues found${styles.reset}`);
        console.log('');
        exitWith(ExitCode.POLICY_FAIL, 'High severity issues detected');
      }
      
    } catch (error) {
      console.log('');
      console.log(`  ${styles.brightRed}${icons.error}${styles.reset} ${styles.bold}Scan failed:${styles.reset} ${error}`);
      console.log('');
      exitWith(ExitCode.SYSTEM_ERROR, 'Scan execution failed');
    }
  });

// Secrets scanning
program
  .command('scan:secrets')
  .description('Scan for hardcoded secrets and credentials')
  .option('-p, --path <path>', 'Project path to scan', '.')
  .option('-f, --format <format>', 'Output format', 'table')
  .option('-o, --output <file>', 'Output file path')
  .option('--staged', 'Only scan staged git files')
  .option('--fail-on-detection', 'Exit with error if secrets found', false)
  .action(async (options) => {
    const config = requireAuth();
    printLogo();
    
    const projectPath = resolve(options.path);
    const projectName = basename(projectPath);
    
    printCommandHeader({
      title: 'SECRET DETECTION SCAN',
      icon: icons.secret,
      projectName,
      projectPath,
      tier: (await config).tier,
      authenticated: !!(await config).apiKey,
    });
    
    const results = await scanSecrets(projectPath, options);
    outputSecretsResults(results, options);
    
    if (options.failOnDetection && results.findings.length > 0) {
      console.log('');
      console.log(`  ${styles.brightRed}${icons.warning}${styles.reset} ${styles.bold}${results.findings.length} secrets detected${styles.reset}`);
      console.log('');
      exitWith(ExitCode.POLICY_FAIL, 'Secrets detected');
    }
  });

// Vulnerability scanning
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
  .option('--ecosystem <ecosystem>', 'Filter by ecosystem: npm, PyPI, RubyGems, Go')
  .action(async (options) => {
    const config = requireAuth();
    printLogo();
    
    const projectPath = resolve(options.path);
    const projectName = basename(projectPath);
    
    printCommandHeader({
      title: 'VULNERABILITY SCAN (OSV)',
      icon: icons.scan,
      projectName,
      projectPath,
      tier: (await config).tier,
      authenticated: !!(await config).apiKey,
    });
    
    if (options.noCache) {
      console.log(`  ${styles.dim}Cache: disabled (--no-cache)${styles.reset}`);
    }
    if (options.nvd) {
      console.log(`  ${styles.dim}NVD enrichment: enabled${styles.reset}`);
    }
    console.log('');
    
    const results = await scanVulnerabilitiesOSV(projectPath, {
      noCache: options.noCache,
      nvd: options.nvd,
      ecosystem: options.ecosystem,
    });
    
    outputOSVVulnResults(results, options);
    
    // Write output file if specified
    if (options.output) {
      const output = options.format === 'sarif' 
        ? toSarifVulnerabilitiesOSV(results)
        : results;
      writeFileSync(options.output, JSON.stringify(output, null, 2));
      console.log(`\n  ${styles.brightGreen}✓${styles.reset} Report written to ${options.output}`);
    }
    
    // Safe property access with defaults for graceful degradation
    const summary = results?.summary || { critical: 0, high: 0, medium: 0, low: 0, info: 0 };
    
    if (options.failOnCritical && (summary.critical || 0) > 0) {
      console.log('');
      console.log(`  ${styles.brightRed}${icons.error}${styles.reset} ${styles.bold}${summary.critical} critical vulnerabilities found${styles.reset}`);
      console.log('');
      exitWith(ExitCode.POLICY_FAIL, 'Critical vulnerabilities detected');
    }
    if (options.failOnHigh && ((summary.critical || 0) > 0 || (summary.high || 0) > 0)) {
      console.log('');
      console.log(`  ${styles.brightRed}${icons.error}${styles.reset} ${styles.bold}${(summary.critical || 0) + (summary.high || 0)} high+ vulnerabilities found${styles.reset}`);
      console.log('');
      exitWith(ExitCode.POLICY_FAIL, 'High severity vulnerabilities detected');
    }
  });

// Compliance scanning (Pro feature)
program
  .command('scan:compliance')
  .description('Run compliance assessment (Pro/Enterprise)')
  .option('-p, --path <path>', 'Project path to scan', '.')
  .option('--framework <framework>', 'Compliance framework: soc2, gdpr, hipaa, pci, iso27001, nist', 'soc2')
  .option('-f, --format <format>', 'Output format', 'table')
  .option('-o, --output <file>', 'Output file path')
  .action(async (options) => {
    requireAuth('pro'); // Require Pro tier
    printLogo();
    
    console.log('');
    const projectPath = resolve(options.path);
    const projectName = basename(projectPath);
    
    const headerLines = [
      `${styles.brightYellow}${styles.bold}${icons.compliance} ${options.framework.toUpperCase()} COMPLIANCE ASSESSMENT${styles.reset}`,
      '',
      `${styles.dim}Project:${styles.reset}     ${styles.bold}${projectName}${styles.reset}`,
      `${styles.dim}Path:${styles.reset}        ${truncatePath(projectPath)}`,
      `${styles.dim}Framework:${styles.reset}   ${options.framework.toUpperCase()}`,
      `${styles.dim}Started:${styles.reset}     ${new Date().toLocaleString()}`,
    ];
    const framed = frameLines(headerLines, { padding: 2 });
    console.log(framed.join('\n'));
    console.log('');
    
    const results = await scanCompliance(projectPath, options);
    outputComplianceResults(results, options);
  });

// SBOM generation (Pro feature)
program
  .command('sbom:generate')
  .description('Generate Software Bill of Materials (Pro/Enterprise)')
  .option('-p, --path <path>', 'Project path', '.')
  .option('-f, --format <format>', 'SBOM format: cyclonedx, spdx, json', 'cyclonedx')
  .option('-o, --output <file>', 'Output file path')
  .option('--include-dev', 'Include dev dependencies', false)
  .option('--include-hashes', 'Include SHA-256 hashes for components', false)
  .option('--vex', 'Generate VEX document', false)
  .option('--sign', 'Sign SBOM with cosign', false)
  .action(async (options) => {
    requireAuth('pro'); // Require Pro tier
    printLogo();
    
    console.log('');
    const projectPath = resolve(options.path);
    const projectName = basename(projectPath);
    
    const headerLines = [
      `${styles.brightBlue}${styles.bold}${icons.sbom} SOFTWARE BILL OF MATERIALS${styles.reset}`,
      '',
      `${styles.dim}Project:${styles.reset}     ${styles.bold}${projectName}${styles.reset}`,
      `${styles.dim}Path:${styles.reset}        ${truncatePath(projectPath)}`,
      `${styles.dim}Format:${styles.reset}      ${options.format.toUpperCase()}`,
      `${styles.dim}Hashes:${styles.reset}      ${options.includeHashes ? 'Enabled' : 'Disabled'}`,
      `${styles.dim}VEX:${styles.reset}         ${options.vex ? 'Enabled' : 'Disabled'}`,
      `${styles.dim}Signing:${styles.reset}     ${options.sign ? 'Enabled' : 'Disabled'}`,
    ];
    const framed = frameLines(headerLines, { padding: 2 });
    console.log(framed.join('\n'));
    console.log('');
    
    const sbom = await generateSBOM(projectPath, options);
    
    console.log('');
    const summaryLines = [
      `${styles.brightGreen}${styles.bold}${icons.success} SBOM GENERATED${styles.reset}`,
      '',
      `${styles.dim}Components:${styles.reset}  ${styles.bold}${sbom.components.length}${styles.reset} packages`,
      `${styles.dim}Licenses:${styles.reset}    ${styles.bold}${sbom.licenseSummary.length}${styles.reset} unique`,
    ];
    
    if (options.includeHashes) {
      const hashedCount = sbom.components.filter((c: any) => c.hashes && c.hashes.length > 0).length;
      summaryLines.push(`${styles.dim}Hashed:${styles.reset}      ${styles.bold}${hashedCount}${styles.reset} components`);
    }
    
    if (options.output) {
      writeFileSync(options.output, JSON.stringify(sbom, null, 2));
      summaryLines.push('');
      summaryLines.push(`${styles.dim}Saved to:${styles.reset}    ${options.output}`);
      
      if (options.vex) {
        const vexPath = options.output.replace(/\.(json|xml)$/, '.vex.json');
        summaryLines.push(`${styles.dim}VEX:${styles.reset}         ${vexPath}`);
      }
      
      if (options.sign) {
        summaryLines.push(`${styles.dim}Signature:${styles.reset}   ${options.output}.sig`);
      }
    }
    
    const framedSummary = frameLines(summaryLines, { padding: 2 });
    console.log(framedSummary.join('\n'));
    console.log('');
    
    if (!options.output) {
      console.log(JSON.stringify(sbom, null, 2));
    }
  });


}
