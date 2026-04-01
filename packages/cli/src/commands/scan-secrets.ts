/**
 * scan:secrets command
 * Enterprise-grade secret detection with SecretsGuardian
 */

import { Command } from 'commander';
import { resolve } from 'path';
import { SecretsGuardian, Allowlist, scanGitHistory, ConfigValidationError } from 'guardrail-security';
import { ExitCode, exitWith, getExitCodeForFindings } from '../runtime/exit-codes';
import { generateEvidence } from './evidence';
import { toSarif } from '../formatters/sarif';
import { writeFileSync } from 'fs';

// Color helpers
const c = {
  reset: '\x1b[0m',
  bold: (s: string) => `\x1b[1m${s}\x1b[0m`,
  dim: (s: string) => `\x1b[2m${s}\x1b[0m`,
  high: (s: string) => `\x1b[31m${s}\x1b[0m`,
  medium: (s: string) => `\x1b[33m${s}\x1b[0m`,
  low: (s: string) => `\x1b[36m${s}\x1b[0m`,
  success: (s: string) => `\x1b[32m${s}\x1b[0m`,
  info: (s: string) => `\x1b[34m${s}\x1b[0m`,
};

export interface ScanSecretsOptions {
  path: string;
  format: 'table' | 'json' | 'sarif';
  output?: string;
  excludeTests: boolean;
  minConfidence?: number;
  failOnDetection: boolean;
  evidence: boolean;
  history?: boolean;
  historyDepth?: number;
  noCustomPatterns?: boolean;
  noAllowlist?: boolean;
  noContextualRisk?: boolean;
}

export interface SecretFinding {
  type: string;
  file: string;
  line: number;
  risk: string;
  confidence: number;
  entropy: number;
  match: string;
  isTest: boolean;
  recommendation: any;
}

export interface ScanSecretsResult {
  projectPath: string;
  scanType: string;
  filesScanned: number;
  patterns: string[];
  findings: SecretFinding[];
  summary: {
    total: number;
    highEntropy: number;
    lowEntropy: number;
    byRisk: Record<string, number>;
  };
}

export async function scanSecrets(projectPath: string, options: ScanSecretsOptions): Promise<ScanSecretsResult> {
  const guardian = new SecretsGuardian();
  
  // Scan git history if requested
  if (options.history) {
    try {
      const historyReport = await scanGitHistory(
        projectPath,
        'cli-scan',
        guardian,
        {
          depth: options.historyDepth || 50,
          excludeTests: options.excludeTests,
          minConfidence: options.minConfidence,
          useCustomPatterns: !options.noCustomPatterns,
          useAllowlist: !options.noAllowlist,
          useContextualRisk: !options.noContextualRisk,
        }
      );
      
      const findings: SecretFinding[] = historyReport.detections.map(d => ({
        type: d.secretType,
        file: `${d.filePath} (commit: ${d.commitHash.substring(0, 7)})`,
        line: d.location.line,
        risk: d.risk,
        confidence: d.confidence,
        entropy: d.entropy,
        match: d.maskedValue,
        isTest: d.isTest,
        recommendation: d.recommendation,
      }));
      
      return {
        projectPath,
        scanType: 'secrets-history',
        filesScanned: historyReport.commitsScanned,
        patterns: Array.from(new Set(findings.map(f => f.type))),
        findings,
        summary: {
          total: findings.length,
          highEntropy: findings.filter(f => f.entropy >= 4.0).length,
          lowEntropy: findings.filter(f => f.entropy < 4.0).length,
          byRisk: historyReport.summary.byType as any,
        },
      };
    } catch (err) {
      if ((err as Error).message.includes('Not a git repository')) {
        console.error(`\n  ${c.high('✗')} Not a git repository. Use --history only in git repos.\n`);
        process.exit(1);
      }
      throw err;
    }
  }
  
  const report = await guardian.scanProject(projectPath, 'cli-scan', {
    excludeTests: options.excludeTests,
    minConfidence: options.minConfidence,
    maxFileSizeBytes: 2 * 1024 * 1024,
    concurrency: 8,
    skipBinaryFiles: true,
    useCustomPatterns: !options.noCustomPatterns,
    useAllowlist: !options.noAllowlist,
    useContextualRisk: !options.noContextualRisk,
  });
  
  const findings: SecretFinding[] = report.detections.map(d => ({
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
  
  // Log performance stats if verbose
  if (report.performance.customPatternsLoaded > 0) {
    console.log(`  ${c.info('ℹ')} Loaded ${report.performance.customPatternsLoaded} custom patterns from .guardrail/secrets.yaml`);
  }
  if (report.performance.allowlistSuppressed > 0) {
    console.log(`  ${c.info('ℹ')} Suppressed ${report.performance.allowlistSuppressed} allowlisted detections`);
  }
  if (report.performance.skippedLarge > 0 || report.performance.skippedBinary > 0) {
    console.log(`  ${c.dim(`Skipped: ${report.performance.skippedLarge} large files, ${report.performance.skippedBinary} binary files`)}`);
  }
  
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

export function outputSecretsResults(results: ScanSecretsResult, options: ScanSecretsOptions): void {
  if (options.format === 'json') {
    console.log(JSON.stringify(results, null, 2));
    return;
  }
  
  if (options.format === 'sarif') {
    const sarif = toSarif(results);
    console.log(JSON.stringify(sarif, null, 2));
    return;
  }
  
  console.log(`  ${c.info('Patterns checked:')} ${results.patterns.join(', ')}\n`);
  
  if (results.findings.length === 0) {
    console.log(`  ${c.success('✓')} ${c.bold('No secrets detected!')}\n`);
    return;
  }
  
  const highRisk = results.findings.filter(f => f.risk === 'high').length;
  const mediumRisk = results.findings.filter(f => f.risk === 'medium').length;
  const lowRisk = results.findings.filter(f => f.risk === 'low').length;
  const testFiles = results.findings.filter(f => f.isTest).length;
  
  console.log(`  ${c.high('⚠')} ${c.bold(`${results.findings.length} potential secrets found:`)}`);
  console.log(`     ${c.high('HIGH:')} ${highRisk}  ${c.medium('MEDIUM:')} ${mediumRisk}  ${c.low('LOW:')} ${lowRisk}  ${c.dim(`(${testFiles} in test files)`)}\n`);
  
  for (const finding of results.findings) {
    const riskLabel = finding.risk === 'high' ? c.high('HIGH') : 
                      finding.risk === 'medium' ? c.medium('MEDIUM') : c.low('LOW');
    const testTag = finding.isTest ? c.dim(' [TEST]') : '';
    
    console.log(`  ${riskLabel} ${finding.type}${testTag}`);
    console.log(`  ${c.dim('├─')} ${c.info('File:')} ${finding.file}:${finding.line}`);
    console.log(`  ${c.dim('├─')} ${c.info('Confidence:')} ${(finding.confidence * 100).toFixed(0)}%  ${c.dim('Entropy:')} ${finding.entropy.toFixed(1)}`);
    console.log(`  ${c.dim('├─')} ${c.info('Match:')} ${finding.match}`);
    console.log(`  ${c.dim('└─')} ${c.info('Fix:')} ${finding.recommendation?.remediation || 'Move to environment variables'}\n`);
  }
}

export function registerScanSecretsCommand(program: Command, requireAuth: () => any, printLogo: () => void): void {
  program
    .command('scan:secrets')
    .description('Scan for hardcoded secrets and credentials')
    .option('-p, --path <path>', 'Project path to scan', '.')
    .option('-f, --format <format>', 'Output format: table, json, sarif', 'table')
    .option('-o, --output <file>', 'Output file path')
    .option('--exclude-tests', 'Exclude test files from scan', false)
    .option('--min-confidence <number>', 'Minimum confidence threshold (0-1)')
    .option('--fail-on-detection', 'Exit with error if secrets found', false)
    .option('--evidence', 'Generate signed evidence pack', false)
    .option('--history', 'Scan git commit history for secrets', false)
    .option('--history-depth <number>', 'Number of commits to scan (default: 50)', '50')
    .option('--no-custom-patterns', 'Disable custom patterns from .guardrail/secrets.yaml')
    .option('--no-allowlist', 'Disable allowlist from .guardrail/secrets.allowlist')
    .option('--no-contextual-risk', 'Disable contextual risk adjustment')
    .action(async (opts) => {
      requireAuth();
      printLogo();
      console.log(`\n${c.bold('🔐 SECRET DETECTION SCAN')}\n`);
      
      const projectPath = resolve(opts.path);
      const options: ScanSecretsOptions = {
        path: projectPath,
        format: opts.format,
        output: opts.output,
        excludeTests: opts.excludeTests,
        minConfidence: opts.minConfidence ? parseFloat(opts.minConfidence) : undefined,
        failOnDetection: opts.failOnDetection,
        evidence: opts.evidence,
        history: opts.history,
        historyDepth: opts.historyDepth ? parseInt(opts.historyDepth) : 50,
        noCustomPatterns: opts.noCustomPatterns,
        noAllowlist: opts.noAllowlist,
        noContextualRisk: opts.noContextualRisk,
      };
      
      const startTime = Date.now();
      let results: ScanSecretsResult;
      try {
        results = await scanSecrets(projectPath, options);
      } catch (err) {
        if (err instanceof ConfigValidationError) {
          console.error(`\n  ${c.high('✗')} Custom patterns validation failed:\n`);
          console.error(`  ${err.message}\n`);
          if (err.details) {
            for (const detail of err.details) {
              console.error(`    • ${detail}`);
            }
          }
          console.error(`\n  Fix .guardrail/secrets.yaml and try again.\n`);
          process.exit(1);
        }
        throw err;
      }
      const duration = Date.now() - startTime;
      
      console.log(`\n${c.success('✓')} Secret scan complete (${(duration / 1000).toFixed(1)}s)`);
      
      outputSecretsResults(results, options);
      
      // Save to output file if specified
      if (options.output) {
        const outputData = options.format === 'sarif' ? toSarif(results) : results;
        writeFileSync(options.output, JSON.stringify(outputData, null, 2));
        console.log(`\n  ${c.success('✓')} Results saved to ${options.output}`);
      }
      
      if (options.evidence) {
        await generateEvidence('secrets', results, projectPath);
      }
      
      if (options.failOnDetection && results.findings.length > 0) {
        const exitCode = getExitCodeForFindings(
          { high: results.summary.byRisk?.high || 0, medium: results.summary.byRisk?.medium || 0 },
          { failOnHigh: true }
        );
        exitWith(exitCode, `${results.findings.length} secrets detected`);
      }
    });
}
