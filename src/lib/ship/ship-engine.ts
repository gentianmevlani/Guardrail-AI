/**
 * Ship Engine - Unified Ship Check Runner
 * 
 * Orchestrates all ship checks (MockProof, Reality Mode, Badge) and
 * produces unified run artifacts with deterministic outputs.
 */

import * as fs from 'fs';
import * as path from 'path';
import { execSync, spawn } from 'child_process';
import { RunManager, RunSummary, RunArtifacts, EXIT_CODES } from './run-manager';
import { importGraphScanner, MockProofResult } from '../mockproof/import-graph-scanner';
import { shipBadgeGenerator, ShipBadgeResult } from '../ship-badge/ship-badge-generator';

export interface ShipEngineOptions {
  projectPath: string;
  outputDir?: string;
  baseUrl?: string;
  ci?: boolean;
  json?: boolean;
  sarif?: boolean;
  profile?: 'default' | 'strict' | 'relaxed';
  runReality?: boolean;
  runMockproof?: boolean;
  runBadge?: boolean;
}

export interface ShipEngineResult {
  runId: string;
  verdict: 'ship' | 'no-ship';
  exitCode: number;
  score: number;
  mockproof: MockProofResult | null;
  badge: ShipBadgeResult | null;
  reality: any | null;
  blockers: string[];
  artifacts: RunArtifacts;
  duration: number;
}

const ANSI = {
  Reset: '\x1b[0m',
  Bright: '\x1b[1m',
  Dim: '\x1b[2m',
  FgRed: '\x1b[31m',
  FgGreen: '\x1b[32m',
  FgYellow: '\x1b[33m',
  FgBlue: '\x1b[34m',
  FgMagenta: '\x1b[35m',
  FgCyan: '\x1b[36m',
  BgRed: '\x1b[41m',
  BgGreen: '\x1b[42m',
};

export class ShipEngine {
  private options: Required<ShipEngineOptions>;
  private runManager: RunManager;

  constructor(options: ShipEngineOptions) {
    this.options = {
      projectPath: options.projectPath,
      outputDir: options.outputDir || path.join(options.projectPath, '.guardrail', 'ship'),
      baseUrl: options.baseUrl || 'http://localhost:3000',
      ci: options.ci || false,
      json: options.json || false,
      sarif: options.sarif || false,
      profile: options.profile || 'default',
      runReality: options.runReality !== false,
      runMockproof: options.runMockproof !== false,
      runBadge: options.runBadge !== false,
    };
    this.runManager = new RunManager(this.options.projectPath);
  }

  /**
   * Run all ship checks
   */
  async run(): Promise<ShipEngineResult> {
    const startTime = Date.now();
    const runId = this.runManager.generateRunId();
    
    // Create run folder
    const artifacts = await this.runManager.createRun(runId, this.options.profile);
    
    let mockproofResult: MockProofResult | null = null;
    let badgeResult: ShipBadgeResult | null = null;
    let realityResult: any = null;
    const blockers: string[] = [];
    let allPassed = true;

    try {
      // 1. Run MockProof Build Gate
      if (this.options.runMockproof) {
        if (!this.options.json) {
          console.log(`\n${ANSI.FgMagenta}${ANSI.Bright}━━━ MockProof Build Gate ━━━${ANSI.Reset}\n`);
        }
        
        mockproofResult = await importGraphScanner.scan(this.options.projectPath);
        
        if (!this.options.json) {
          console.log(importGraphScanner.generateReport(mockproofResult));
        }
        
        if (mockproofResult.verdict === 'fail') {
          allPassed = false;
          for (const v of mockproofResult.violations.slice(0, 3)) {
            blockers.push(`MockProof: ${v.pattern} in ${v.bannedImport}`);
          }
        }
      }

      // 2. Run Ship Badge checks
      if (this.options.runBadge) {
        if (!this.options.json) {
          console.log(`\n${ANSI.FgMagenta}${ANSI.Bright}━━━ Ship Badge ━━━${ANSI.Reset}\n`);
        }
        
        badgeResult = await shipBadgeGenerator.generateShipBadge({
          projectPath: this.options.projectPath,
          outputDir: path.join(artifacts.runDir, 'badges'),
        });
        
        if (!this.options.json) {
          console.log(shipBadgeGenerator.generateReport(badgeResult));
        }
        
        if (badgeResult.verdict === 'no-ship') {
          allPassed = false;
          for (const check of badgeResult.checks.filter(c => c.status === 'fail').slice(0, 3)) {
            blockers.push(`Badge: ${check.name} - ${check.message}`);
          }
        }
      }

      // 3. Generate Reality Mode test (doesn't run it, just generates)
      if (this.options.runReality) {
        if (!this.options.json) {
          console.log(`\n${ANSI.FgMagenta}${ANSI.Bright}━━━ Reality Mode ━━━${ANSI.Reset}\n`);
        }
        
        realityResult = await this.generateRealityTest(artifacts);
        
        if (!this.options.json) {
          console.log(`${ANSI.FgGreen}✓${ANSI.Reset} Generated Reality Mode test`);
          console.log(`  ${ANSI.Dim}→ ${path.relative(this.options.projectPath, realityResult.testPath)}${ANSI.Reset}`);
        }
      }

      // Calculate final verdict
      const verdict: 'ship' | 'no-ship' = allPassed ? 'ship' : 'no-ship';
      const exitCode = allPassed ? EXIT_CODES.SHIP : EXIT_CODES.NO_SHIP;
      const duration = Date.now() - startTime;
      
      // Calculate score
      let score = 100;
      if (mockproofResult?.verdict === 'fail') {
        score -= Math.min(50, mockproofResult.violations.length * 10);
      }
      if (badgeResult) {
        score = Math.round((score + badgeResult.score) / 2);
      }

      // Save summary
      const summary: RunSummary = {
        verdict,
        exitCode,
        score,
        gates: {
          mockproof: {
            verdict: mockproofResult?.verdict || 'skip',
            violations: mockproofResult?.violations.length || 0,
          },
          reality: {
            verdict: realityResult ? 'pass' : 'skip',
            detections: 0,
          },
          badge: {
            verdict: badgeResult?.verdict === 'ship' ? 'pass' : badgeResult?.verdict === 'no-ship' ? 'fail' : 'skip',
            score: badgeResult?.score || 0,
          },
        },
        blockers,
        duration,
      };

      await this.runManager.saveSummary(artifacts.runDir, summary);

      // Save reports
      const fullReport = this.generateFullReport(verdict, score, mockproofResult, badgeResult, realityResult, blockers, duration);
      await this.runManager.saveReportTxt(artifacts.runDir, fullReport);
      
      await this.runManager.saveReportJson(artifacts.runDir, {
        runId,
        verdict,
        score,
        mockproof: mockproofResult,
        badge: badgeResult,
        reality: realityResult,
        blockers,
        duration,
      });

      // Save SARIF if requested
      if (this.options.sarif && mockproofResult?.violations) {
        const sarifViolations = mockproofResult.violations.map(v => ({
          pattern: v.pattern,
          message: v.message,
          file: v.bannedImport,
          severity: 'critical',
        }));
        artifacts.sarifJson = await this.runManager.saveSarifReport(artifacts.runDir, sarifViolations);
      }

      // Print final verdict
      if (!this.options.json) {
        this.printFinalVerdict(verdict, score, blockers);
        console.log(`\n${ANSI.Dim}Run ID: ${runId}${ANSI.Reset}`);
        console.log(`${ANSI.Dim}Artifacts: ${path.relative(this.options.projectPath, artifacts.runDir)}${ANSI.Reset}`);
      }

      // JSON output
      if (this.options.json) {
        console.log(JSON.stringify({
          runId,
          verdict,
          exitCode,
          score,
          blockers,
          artifacts: {
            runDir: artifacts.runDir,
            report: artifacts.reportJson,
            sarif: artifacts.sarifJson,
          },
        }, null, 2));
      }

      return {
        runId,
        verdict,
        exitCode,
        score,
        mockproof: mockproofResult,
        badge: badgeResult,
        reality: realityResult,
        blockers,
        artifacts,
        duration,
      };

    } catch (error: any) {
      // Runtime error
      const errorMessage = error.message || 'Unknown error';
      
      await this.runManager.saveReportTxt(artifacts.runDir, `RUNTIME ERROR: ${errorMessage}\n\n${error.stack || ''}`);
      
      const summary: RunSummary = {
        verdict: 'no-ship',
        exitCode: EXIT_CODES.RUNTIME_ERROR,
        score: 0,
        gates: {
          mockproof: { verdict: 'skip', violations: 0 },
          reality: { verdict: 'skip', detections: 0 },
          badge: { verdict: 'skip', score: 0 },
        },
        blockers: [`Runtime error: ${errorMessage}`],
        duration: Date.now() - startTime,
      };
      
      await this.runManager.saveSummary(artifacts.runDir, summary);

      if (!this.options.json) {
        console.error(`\n${ANSI.FgRed}${ANSI.Bright}RUNTIME ERROR:${ANSI.Reset} ${errorMessage}`);
      }

      return {
        runId,
        verdict: 'no-ship',
        exitCode: EXIT_CODES.RUNTIME_ERROR,
        score: 0,
        mockproof: mockproofResult,
        badge: badgeResult,
        reality: realityResult,
        blockers: [`Runtime error: ${errorMessage}`],
        artifacts,
        duration: Date.now() - startTime,
      };
    }
  }

  /**
   * Generate Reality Mode test file
   */
  private async generateRealityTest(artifacts: RunArtifacts): Promise<{ testPath: string; baseUrl: string }> {
    const { realityScanner } = await import('../reality-mode/reality-scanner');
    
    const testCode = realityScanner.generatePlaywrightTest({
      baseUrl: this.options.baseUrl,
      clickPaths: realityScanner.generateDefaultClickPaths(),
      outputDir: path.join(artifacts.runDir, 'reality-mode'),
    });
    
    const testDir = path.join(artifacts.runDir, 'reality-mode');
    await fs.promises.mkdir(testDir, { recursive: true });
    
    const testPath = path.join(testDir, 'reality-mode.spec.ts');
    await fs.promises.writeFile(testPath, testCode);
    
    // Also copy to the default ship output location for backwards compatibility
    const legacyDir = path.join(this.options.outputDir, 'reality-mode');
    await fs.promises.mkdir(legacyDir, { recursive: true });
    await fs.promises.writeFile(path.join(legacyDir, 'reality-mode.spec.ts'), testCode);
    
    return { testPath, baseUrl: this.options.baseUrl };
  }

  /**
   * Generate full text report
   */
  private generateFullReport(
    verdict: 'ship' | 'no-ship',
    score: number,
    mockproof: MockProofResult | null,
    badge: ShipBadgeResult | null,
    reality: any | null,
    blockers: string[],
    duration: number
  ): string {
    const lines: string[] = [];
    
    lines.push('╔══════════════════════════════════════════════════════════════╗');
    lines.push('║            🚀 guardrail Ship Report 🚀                       ║');
    lines.push('╚══════════════════════════════════════════════════════════════╝');
    lines.push('');
    
    if (verdict === 'ship') {
      lines.push('🚀 VERDICT: SHIP IT!');
      lines.push('');
      lines.push('   All checks passed. Your app is ready for production.');
    } else {
      lines.push('🛑 VERDICT: NO SHIP');
      lines.push('');
      lines.push(`   Found ${blockers.length} blocker(s) that must be fixed.`);
      lines.push('');
      lines.push('BLOCKERS:');
      for (const blocker of blockers) {
        lines.push(`   ❌ ${blocker}`);
      }
    }
    
    lines.push('');
    lines.push('─'.repeat(64));
    lines.push('');
    lines.push('GATE RESULTS:');
    lines.push('');
    
    // MockProof
    if (mockproof) {
      const mpIcon = mockproof.verdict === 'pass' ? '✅' : '❌';
      lines.push(`${mpIcon} MockProof Build Gate: ${mockproof.verdict.toUpperCase()}`);
      lines.push(`   Scanned ${mockproof.scannedFiles} files, ${mockproof.violations.length} violations`);
    } else {
      lines.push('⏭️  MockProof Build Gate: SKIPPED');
    }
    
    // Badge
    if (badge) {
      const badgeIcon = badge.verdict === 'ship' ? '✅' : badge.verdict === 'no-ship' ? '❌' : '⚠️';
      lines.push(`${badgeIcon} Ship Badge: ${badge.verdict.toUpperCase()} (${badge.score}/100)`);
    } else {
      lines.push('⏭️  Ship Badge: SKIPPED');
    }
    
    // Reality
    if (reality) {
      lines.push(`✅ Reality Mode: TEST GENERATED`);
      lines.push(`   Run with: npx playwright test ${reality.testPath}`);
    } else {
      lines.push('⏭️  Reality Mode: SKIPPED');
    }
    
    lines.push('');
    lines.push('─'.repeat(64));
    lines.push(`Score: ${score}/100`);
    lines.push(`Duration: ${duration}ms`);
    lines.push(`Generated: ${new Date().toISOString()}`);
    
    return lines.join('\n');
  }

  /**
   * Print final verdict banner
   */
  private printFinalVerdict(verdict: 'ship' | 'no-ship', score: number, blockers: string[]): void {
    console.log(`\n${ANSI.FgCyan}${ANSI.Bright}
╔══════════════════════════════════════════════════════════════╗
║                      FINAL VERDICT                           ║
╚══════════════════════════════════════════════════════════════╝
${ANSI.Reset}`);

    if (verdict === 'ship') {
      console.log(`${ANSI.BgGreen}${ANSI.Bright}  🚀 SHIP IT!  ${ANSI.Reset}`);
      console.log(`\n${ANSI.FgGreen}All checks passed. Your app is ready to ship.${ANSI.Reset}`);
      console.log(`${ANSI.FgGreen}Score: ${score}/100${ANSI.Reset}`);
    } else {
      console.log(`${ANSI.BgRed}${ANSI.Bright}  🛑 NO SHIP  ${ANSI.Reset}`);
      console.log(`\n${ANSI.FgRed}Some checks failed. Fix the issues before shipping.${ANSI.Reset}`);
      console.log(`${ANSI.FgRed}Score: ${score}/100${ANSI.Reset}`);
      
      if (blockers.length > 0) {
        console.log(`\n${ANSI.FgYellow}Top blockers:${ANSI.Reset}`);
        for (const blocker of blockers.slice(0, 5)) {
          console.log(`  ${ANSI.FgRed}❌${ANSI.Reset} ${blocker}`);
        }
      }
    }
  }
}

/**
 * Run doctor checks to validate environment
 */
export async function runDoctor(projectPath: string): Promise<{ passed: boolean; exitCode: number }> {
  console.log('🩺 Running guardrail Doctor...\n');
  
  const checks: Array<{ name: string; status: 'pass' | 'fail' | 'warn' | 'info'; message: string; fix?: string }> = [];
  
  // Node version
  const nodeVersion = process.version;
  const nodeMajor = parseInt(nodeVersion.slice(1).split('.')[0], 10);
  checks.push({
    name: 'Node.js Version',
    status: nodeMajor >= 18 ? 'pass' : 'fail',
    message: `Node.js ${nodeVersion}`,
    fix: nodeMajor < 18 ? 'Upgrade to Node.js 18+' : undefined,
  });
  
  // Check for package.json
  const pkgPath = path.join(projectPath, 'package.json');
  const hasPkg = fs.existsSync(pkgPath);
  checks.push({
    name: 'package.json',
    status: hasPkg ? 'pass' : 'fail',
    message: hasPkg ? 'Found' : 'Not found',
    fix: !hasPkg ? 'Initialize with: npm init' : undefined,
  });
  
  // Check for Playwright
  let hasPlaywright = false;
  let playwrightInstalled = false;
  if (hasPkg) {
    try {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
      hasPlaywright = !!(pkg.dependencies?.['@playwright/test'] || pkg.devDependencies?.['@playwright/test']);
      
      // Check if browsers are installed
      if (hasPlaywright) {
        try {
          execSync('npx playwright --version', { cwd: projectPath, stdio: 'pipe' });
          playwrightInstalled = true;
        } catch {
          playwrightInstalled = false;
        }
      }
    } catch {
      // Playwright check failed - continue with other checks
    }
  }
  
  checks.push({
    name: 'Playwright',
    status: hasPlaywright ? (playwrightInstalled ? 'pass' : 'warn') : 'warn',
    message: hasPlaywright 
      ? (playwrightInstalled ? 'Installed and ready' : 'Installed but browsers may need setup')
      : 'Not found (needed for Reality Mode)',
    fix: !hasPlaywright 
      ? 'Run: npm install -D @playwright/test && npx playwright install' 
      : (!playwrightInstalled ? 'Run: npx playwright install' : undefined),
  });
  
  // Check for TypeScript
  const hasTsConfig = fs.existsSync(path.join(projectPath, 'tsconfig.json'));
  checks.push({
    name: 'TypeScript',
    status: hasTsConfig ? 'pass' : 'info',
    message: hasTsConfig ? 'tsconfig.json found' : 'JavaScript project (TypeScript optional)',
  });
  
  // Check for .guardrailrc
  const configPath = path.join(projectPath, '.guardrailrc');
  const configJsonPath = path.join(projectPath, '.guardrailrc.json');
  const hasConfig = fs.existsSync(configPath) || fs.existsSync(configJsonPath);
  checks.push({
    name: 'guardrail Config',
    status: hasConfig ? 'pass' : 'info',
    message: hasConfig ? 'Configuration found' : 'Using defaults (optional)',
    fix: !hasConfig ? 'Create .guardrailrc.json to customize' : undefined,
  });
  
  // Check for git
  let hasGit = false;
  try {
    execSync('git rev-parse --git-dir', { cwd: projectPath, stdio: 'pipe' });
    hasGit = true;
  } catch {
    // Not a git repository - this is acceptable, just a warning
  }
  
  checks.push({
    name: 'Git Repository',
    status: hasGit ? 'pass' : 'warn',
    message: hasGit ? 'Git initialized' : 'Not a git repository',
    fix: !hasGit ? 'Run: git init' : undefined,
  });
  
  // Output results
  let hasFailures = false;
  for (const check of checks) {
    const icon = check.status === 'pass' ? '✅' 
               : check.status === 'fail' ? '❌' 
               : check.status === 'warn' ? '⚠️' 
               : 'ℹ️';
    console.log(`${icon} ${check.name}: ${check.message}`);
    if (check.fix) {
      console.log(`   Fix: ${check.fix}`);
    }
    if (check.status === 'fail') hasFailures = true;
  }
  
  console.log('');
  if (hasFailures) {
    console.log('❌ Some critical issues need attention.');
    return { passed: false, exitCode: EXIT_CODES.MISCONFIG };
  } else {
    console.log('✅ Environment is ready for guardrail!');
    return { passed: true, exitCode: EXIT_CODES.SHIP };
  }
}
