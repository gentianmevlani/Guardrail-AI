/**
 * Playwright Agent Service
 * 
 * Runs real E2E tests on projects and captures results
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import { existsSync, readFileSync, readdirSync } from 'fs';
import { join } from 'path';
import { toErrorMessage, getErrorStack } from "../utils/toErrorMessage";

const execAsync = promisify(exec);

interface PlaywrightTestResult {
  verdict: 'pass' | 'fail' | 'error';
  totalTests: number;
  passed: number;
  failed: number;
  skipped: number;
  duration: number;
  failures: TestFailure[];
  traceFiles: string[];
  videoFiles: string[];
  reportJson?: unknown;
}

interface TestFailure {
  title: string;
  file: string;
  line?: number;
  error: string;
  step?: string;
  screenshot?: string;
}

export class PlaywrightAgent {
  private projectPath: string;
  private outputDir: string;
  
  constructor(projectPath: string) {
    this.projectPath = projectPath;
    this.outputDir = join(projectPath, 'playwright-report');
  }
  
  /**
   * Run Playwright tests on the project
   */
  async runTests(options: {
    testPattern?: string;
    browser?: 'chromium' | 'firefox' | 'webkit';
    timeout?: number;
    captureTrace?: boolean;
    captureVideo?: boolean;
  } = {}): Promise<PlaywrightTestResult> {
    const hasPlaywright = await this.detectPlaywright();
    
    if (!hasPlaywright) {
      return {
        verdict: 'error',
        totalTests: 0,
        passed: 0,
        failed: 0,
        skipped: 0,
        duration: 0,
        failures: [{
          title: 'No Playwright Setup',
          file: '',
          error: 'No playwright.config.ts or @playwright/test found in project',
        }],
        traceFiles: [],
        videoFiles: [],
      };
    }
    
    try {
      const args = [
        'npx', 'playwright', 'test',
        '--reporter=json',
        options.captureTrace !== false ? '--trace=on' : '',
        options.testPattern ? `--grep="${options.testPattern}"` : '',
      ].filter(Boolean).join(' ');
      
      const { stdout, stderr } = await execAsync(args, {
        cwd: this.projectPath,
        timeout: options.timeout || 300000,
        env: { ...process.env, CI: 'true', PLAYWRIGHT_JSON_OUTPUT_NAME: 'report.json' },
      }).catch(e => ({ stdout: e.stdout || '', stderr: e.stderr || e.message }));
      
      const reportPath = join(this.projectPath, 'report.json');
      let reportJson: any = null;
      
      if (existsSync(reportPath)) {
        try {
          reportJson = JSON.parse(readFileSync(reportPath, 'utf-8'));
        } catch (error) {
          // Report file exists but is invalid JSON - will fall back to stdout parsing
        }
      }
      
      const result = this.parseResults(reportJson, stdout, stderr);
      
      result.traceFiles = this.collectArtifacts('*.zip');
      result.videoFiles = this.collectArtifacts('*.webm');
      
      return result;
    } catch (error: unknown) {
      return {
        verdict: 'error',
        totalTests: 0,
        passed: 0,
        failed: 0,
        skipped: 0,
        duration: 0,
        failures: [{
          title: 'Test Execution Error',
          file: '',
          error: toErrorMessage(error),
        }],
        traceFiles: [],
        videoFiles: [],
      };
    }
  }
  
  private async detectPlaywright(): Promise<boolean> {
    const configFiles = ['playwright.config.ts', 'playwright.config.js'];
    for (const file of configFiles) {
      if (existsSync(join(this.projectPath, file))) {
        return true;
      }
    }
    
    try {
      const pkgPath = join(this.projectPath, 'package.json');
      if (existsSync(pkgPath)) {
        const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));
        const deps = { ...pkg.dependencies, ...pkg.devDependencies };
        if (deps['@playwright/test']) return true;
      }
    } catch (error) {
      // Package.json not found or invalid - continue with file-based detection
    }
    
    return false;
  }
  
  private parseResults(reportJson: any, stdout: string, stderr: string): PlaywrightTestResult {
    let result: PlaywrightTestResult = {
      verdict: 'pass',
      totalTests: 0,
      passed: 0,
      failed: 0,
      skipped: 0,
      duration: 0,
      failures: [],
      traceFiles: [],
      videoFiles: [],
      reportJson,
    };
    
    if (reportJson?.suites) {
      this.parseJsonReport(reportJson, result);
    } else {
      const passMatch = stdout.match(/(\d+) passed/);
      const failMatch = stdout.match(/(\d+) failed/);
      const skipMatch = stdout.match(/(\d+) skipped/);
      
      result.passed = passMatch ? parseInt(passMatch[1]) : 0;
      result.failed = failMatch ? parseInt(failMatch[1]) : 0;
      result.skipped = skipMatch ? parseInt(skipMatch[1]) : 0;
      result.totalTests = result.passed + result.failed + result.skipped;
      
      if (stderr && result.failed > 0) {
        const errorLines = stderr.split('\n').filter(l => l.includes('Error') || l.includes('failed'));
        result.failures = errorLines.slice(0, 10).map(line => ({
          title: 'Test Failed',
          file: '',
          error: line.trim(),
        }));
      }
    }
    
    result.verdict = result.failed > 0 ? 'fail' : 'pass';
    return result;
  }
  
  private parseJsonReport(report: any, result: PlaywrightTestResult): void {
    for (const suite of report.suites || []) {
      this.parseSuite(suite, result, '');
    }
    result.totalTests = result.passed + result.failed + result.skipped;
    result.duration = report.stats?.duration || 0;
  }
  
  private parseSuite(suite: any, result: PlaywrightTestResult, prefix: string): void {
    for (const spec of suite.specs || []) {
      for (const test of spec.tests || []) {
        if (test.status === 'passed' || test.status === 'expected') {
          result.passed++;
        } else if (test.status === 'failed' || test.status === 'unexpected') {
          result.failed++;
          result.failures.push({
            title: `${prefix}${suite.title} > ${spec.title}`,
            file: suite.file || '',
            line: spec.line,
            error: test.results?.[0]?.error?.message || 'Test failed',
            step: test.results?.[0]?.steps?.find((s: any) => s.error)?.title,
          });
        } else if (test.status === 'skipped') {
          result.skipped++;
        }
      }
    }
    
    for (const childSuite of suite.suites || []) {
      this.parseSuite(childSuite, result, `${prefix}${suite.title} > `);
    }
  }
  
  private collectArtifacts(pattern: string): string[] {
    const files: string[] = [];
    const reportDir = join(this.projectPath, 'test-results');
    
    if (!existsSync(reportDir)) return files;
    
    try {
      const walk = (dir: string) => {
        for (const entry of readdirSync(dir, { withFileTypes: true })) {
          const fullPath = join(dir, entry.name);
          if (entry.isDirectory()) {
            walk(fullPath);
          } else if (entry.name.match(pattern.replace('*', '.*'))) {
            files.push(fullPath);
          }
        }
      };
      walk(reportDir);
    } catch (error) {
      // Failed to collect artifacts - return empty array
    }
    
    return files;
  }
}

export const createPlaywrightAgent = (projectPath: string) => new PlaywrightAgent(projectPath);
