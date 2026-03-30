/**
 * Reality Mode - Playwright Test Execution
 * 
 * Enterprise-grade execution of generated Playwright tests with:
 * - Dependency detection (Playwright, browsers)
 * - Artifact storage (.guardrail/reality/<runId>/)
 * - Configurable execution (headless, timeout, workers, reporter)
 * - Signal handling (Ctrl+C, timeout kill)
 */

import { spawn, ChildProcess, execSync } from 'child_process';
import { existsSync, mkdirSync, copyFileSync, writeFileSync, readFileSync, readdirSync } from 'fs';
import { join, dirname, basename } from 'path';
import { randomUUID } from 'crypto';
import { generateReceipt, generateReceiptSummary, type ReceiptOptions } from './receipt-generator';
import { runtimeTracer, type RuntimeTrace } from './runtime-tracer';

export interface PlaywrightRunOptions {
  testFile: string;
  headless: boolean;
  timeout: number;
  workers: number;
  reporter: string;
  projectPath: string;
  baseUrl: string;
  flow: string;
  trace?: 'on' | 'off' | 'retain-on-failure' | 'on-first-retry';
  video?: 'on' | 'off' | 'retain-on-failure' | 'on-first-retry';
  screenshot?: 'on' | 'off' | 'only-on-failure';
  generateReceipt?: boolean;
  orgKeyId?: string;
  orgPrivateKey?: string;
  criticalPaths?: Array<{
    path: string;
    description: string;
    covered: boolean;
    evidence: string[];
    timestamp: string;
  }>;
}

export interface DependencyCheckResult {
  playwrightInstalled: boolean;
  browsersInstalled: boolean;
  playwrightPath: string | null;
  errorMessage: string | null;
  installCommands: string[];
}

export interface RunArtifacts {
  runId: string;
  artifactDir: string;
  testFilePath: string;
  reportPath: string | null;
  screenshotsDir: string;
}

export interface PlaywrightRunResult {
  success: boolean;
  exitCode: number;
  output: string;
  artifacts: RunArtifacts;
  duration: number;
  receiptPath?: string;
  runtimeTraces?: RuntimeTrace;
}

/**
 * Check if Playwright is installed and browsers are available
 */
export function checkPlaywrightDependencies(projectPath: string): DependencyCheckResult {
  const result: DependencyCheckResult = {
    playwrightInstalled: false,
    browsersInstalled: false,
    playwrightPath: null,
    errorMessage: null,
    installCommands: [],
  };

  // Check for Playwright in node_modules
  const localPlaywright = join(projectPath, 'node_modules', '@playwright', 'test');
  const localPlaywrightBin = join(projectPath, 'node_modules', '.bin', 'playwright');
  
  if (existsSync(localPlaywright)) {
    result.playwrightInstalled = true;
    result.playwrightPath = localPlaywrightBin;
  } else {
    // Check for global Playwright
    try {
      const globalCheck = execSync('npx playwright --version', {
        encoding: 'utf8',
        stdio: ['pipe', 'pipe', 'pipe'],
        timeout: 10000,
      });
      if (globalCheck && globalCheck.includes('.')) {
        result.playwrightInstalled = true;
        result.playwrightPath = 'npx playwright';
      }
    } catch {
      // Not installed globally either
    }
  }

  if (!result.playwrightInstalled) {
    result.errorMessage = 'Playwright is not installed.';
    result.installCommands = [
      'npm install -D @playwright/test',
      'npx playwright install',
    ];
    return result;
  }

  // Check if browsers are installed
  try {
    const browserCheckCmd = result.playwrightPath === 'npx playwright'
      ? 'npx playwright install --dry-run chromium 2>&1'
      : `"${result.playwrightPath}" install --dry-run chromium 2>&1`;
    
    // Try to detect browser installation by checking common paths
    const homeDir = process.env.HOME || process.env.USERPROFILE || '';
    const browserPaths = [
      join(homeDir, '.cache', 'ms-playwright'),
      join(homeDir, 'AppData', 'Local', 'ms-playwright'),
      join(homeDir, 'Library', 'Caches', 'ms-playwright'),
    ];

    let browsersFound = false;
    for (const browserPath of browserPaths) {
      if (existsSync(browserPath)) {
        try {
          const contents = readdirSync(browserPath);
          if (contents.some(f => f.startsWith('chromium'))) {
            browsersFound = true;
            break;
          }
        } catch {
          // Ignore read errors
        }
      }
    }

    if (browsersFound) {
      result.browsersInstalled = true;
    } else {
      // Try running a quick test to see if browsers work
      try {
        execSync('npx playwright test --list 2>&1', {
          encoding: 'utf8',
          stdio: ['pipe', 'pipe', 'pipe'],
          timeout: 15000,
          cwd: projectPath,
        });
        result.browsersInstalled = true;
      } catch (e: any) {
        const errorOutput = e.stdout?.toString() || e.stderr?.toString() || '';
        if (errorOutput.includes('Executable doesn\'t exist') || 
            errorOutput.includes('browserType.launch') ||
            errorOutput.includes('npx playwright install')) {
          result.browsersInstalled = false;
          result.errorMessage = 'Playwright browsers are not installed.';
          result.installCommands = ['npx playwright install'];
        } else {
          // Might just be no tests found, which is fine
          result.browsersInstalled = true;
        }
      }
    }
  } catch {
    // Assume browsers might be installed if we can't check
    result.browsersInstalled = true;
  }

  if (!result.browsersInstalled) {
    result.errorMessage = 'Playwright browsers are not installed.';
    result.installCommands = ['npx playwright install'];
  }

  return result;
}

/**
 * Build Playwright command arguments
 */
export function buildPlaywrightArgs(options: PlaywrightRunOptions): string[] {
  const args: string[] = ['test', options.testFile];

  // Headless mode (Playwright default is headless, --headed overrides)
  if (!options.headless) {
    args.push('--headed');
  }

  // Timeout (in milliseconds)
  if (options.timeout > 0) {
    args.push('--timeout', String(options.timeout * 1000));
  }

  // Workers
  args.push('--workers', String(options.workers));

  // Reporter
  if (options.reporter) {
    args.push('--reporter', options.reporter);
  }

  // Screenshot
  if (options.screenshot) {
    args.push('--screenshot', options.screenshot);
  }

  // Trace mode
  if (options.trace) {
    args.push('--trace', options.trace);
  }

  // Video
  if (options.video) {
    args.push('--video', options.video);
  }

  return args;
}

/**
 * Create artifact directory structure
 */
export function createArtifactDirectory(projectPath: string, flow: string): RunArtifacts {
  const runId = `${flow}-${Date.now()}-${randomUUID().slice(0, 8)}`;
  const artifactDir = join(projectPath, '.guardrail', 'reality', runId);
  const screenshotsDir = join(artifactDir, 'screenshots');
  const reportDir = join(artifactDir, 'report');

  mkdirSync(artifactDir, { recursive: true });
  mkdirSync(screenshotsDir, { recursive: true });
  mkdirSync(reportDir, { recursive: true });

  return {
    runId,
    artifactDir,
    testFilePath: join(artifactDir, `reality-${flow}.test.ts`),
    reportPath: reportDir,
    screenshotsDir,
  };
}

/**
 * Copy test file to artifact directory
 */
export function copyTestToArtifacts(sourceTestFile: string, artifacts: RunArtifacts): void {
  copyFileSync(sourceTestFile, artifacts.testFilePath);
}

/**
 * Run Playwright tests with proper signal handling
 */
export async function runPlaywrightTests(
  options: PlaywrightRunOptions,
  artifacts: RunArtifacts,
  onOutput: (data: string) => void
): Promise<PlaywrightRunResult> {
  return new Promise((resolve) => {
    const startTime = Date.now();
    let output = '';
    let childProcess: ChildProcess | null = null;
    let killed = false;
    let timeoutHandle: NodeJS.Timeout | null = null;

    const depCheck = checkPlaywrightDependencies(options.projectPath);
    
    if (!depCheck.playwrightInstalled || !depCheck.browsersInstalled) {
      resolve({
        success: false,
        exitCode: 2,
        output: depCheck.errorMessage || 'Dependency check failed',
        artifacts,
        duration: Date.now() - startTime,
      });
      return;
    }

    const args = buildPlaywrightArgs(options);
    
    // Add output directory for artifacts
    args.push('--output', artifacts.screenshotsDir);

    // Determine if we should use npx or local binary
    const useNpx = depCheck.playwrightPath === 'npx playwright';
    const command = useNpx ? 'npx' : process.platform === 'win32' ? 'npx' : depCheck.playwrightPath!;
    const spawnArgs = useNpx ? ['playwright', ...args] : args;

    // Write run metadata
    const metadata = {
      runId: artifacts.runId,
      startTime: new Date().toISOString(),
      options: {
        testFile: options.testFile,
        headless: options.headless,
        timeout: options.timeout,
        workers: options.workers,
        reporter: options.reporter,
        baseUrl: options.baseUrl,
        flow: options.flow,
      },
      command: `${command} ${spawnArgs.join(' ')}`,
    };
    writeFileSync(
      join(artifacts.artifactDir, 'run-metadata.json'),
      JSON.stringify(metadata, null, 2)
    );

    childProcess = spawn(command, spawnArgs, {
      cwd: dirname(options.testFile),
      stdio: ['pipe', 'pipe', 'pipe'],
      shell: process.platform === 'win32',
      env: {
        ...process.env,
        PLAYWRIGHT_HTML_REPORT: artifacts.reportPath || undefined,
        BASE_URL: options.baseUrl,
      },
    });

    // Set up timeout
    if (options.timeout > 0) {
      const totalTimeout = options.timeout * 1000 * 2; // 2x timeout for safety
      timeoutHandle = setTimeout(() => {
        if (childProcess && !killed) {
          killed = true;
          output += '\n[TIMEOUT] Test execution exceeded timeout limit. Killing process.\n';
          onOutput('\n[TIMEOUT] Test execution exceeded timeout limit. Killing process.\n');
          childProcess.kill('SIGTERM');
          setTimeout(() => {
            if (childProcess && !childProcess.killed) {
              childProcess.kill('SIGKILL');
            }
          }, 5000);
        }
      }, totalTimeout);
    }

    // Handle Ctrl+C
    const sigintHandler = () => {
      if (childProcess && !killed) {
        killed = true;
        output += '\n[INTERRUPTED] Received SIGINT. Stopping tests.\n';
        onOutput('\n[INTERRUPTED] Received SIGINT. Stopping tests.\n');
        childProcess.kill('SIGTERM');
      }
    };
    process.on('SIGINT', sigintHandler);

    childProcess.stdout?.on('data', (data: Buffer) => {
      const text = data.toString();
      output += text;
      onOutput(text);
    });

    childProcess.stderr?.on('data', (data: Buffer) => {
      const text = data.toString();
      output += text;
      onOutput(text);
    });

    childProcess.on('close', async (code) => {
      if (timeoutHandle) {
        clearTimeout(timeoutHandle);
      }
      process.removeListener('SIGINT', sigintHandler);

      const duration = Date.now() - startTime;
      const exitCode = code ?? 1;
      const success = exitCode === 0;

      // Write output log
      writeFileSync(join(artifacts.artifactDir, 'output.log'), output);

      // Write result summary
      const summary = {
        runId: artifacts.runId,
        success,
        exitCode,
        duration,
        endTime: new Date().toISOString(),
        killed,
      };
      writeFileSync(
        join(artifacts.artifactDir, 'result.json'),
        JSON.stringify(summary, null, 2)
      );

      // Copy any HTML report if available
      copyHtmlReportIfExists(options.projectPath, artifacts);

      // Generate receipt if requested
      let receiptPath: string | undefined;
      let runtimeTraces: RuntimeTrace | undefined;
      
      if (options.generateReceipt) {
        try {
          // Try to load runtime traces from test output
          const runtimeTracesPath = join(artifacts.artifactDir, 'runtime-traces.json');
          if (existsSync(runtimeTracesPath)) {
            try {
              const tracesData = JSON.parse(readFileSync(runtimeTracesPath, 'utf-8'));
              runtimeTraces = {
                requests: tracesData.requests || [],
                routes: tracesData.routes || [],
                dbQueries: [], // DB queries would need additional instrumentation
              };
            } catch (e) {
              // Fall back to runtime tracer
              runtimeTraces = runtimeTracer.getTraces();
            }
          } else {
            // Fall back to runtime tracer
            runtimeTraces = runtimeTracer.getTraces();
          }
          
          // Update critical paths coverage based on routes hit
          if (runtimeTraces && options.criticalPaths) {
            const routesHit = new Set(runtimeTraces.routes.map(r => r.path));
            options.criticalPaths = options.criticalPaths.map(path => ({
              ...path,
              covered: routesHit.has(path.path),
              evidence: path.covered ? [
                ...path.evidence,
                ...runtimeTraces.requests
                  .filter(r => r.url.includes(path.path))
                  .map(r => `request-${r.method}-${r.statusCode}.png`)
              ] : path.evidence,
            }));
          }
          
          // Extract routes from trace files if available
          if (options.trace && options.trace !== 'off') {
            const traceFiles = readdirSync(artifacts.artifactDir).filter(f => f.includes('trace'));
            for (const traceFile of traceFiles) {
              // Routes would be extracted from trace files here
              // For now, we rely on runtime traces from test
            }
          }
          
          // Determine verdict
          const verdict: 'PASS' | 'SHIP' | 'FAIL' = success 
            ? (options.flow === 'checkout' || options.flow === 'auth' ? 'SHIP' : 'PASS')
            : 'FAIL';
          
          // Record command execution
          const commands = [{
            command: useNpx ? 'npx' : command,
            args: spawnArgs,
            exitCode,
            stdout: output.slice(0, 10000), // Limit stdout size
            duration,
            timestamp: new Date(metadata.startTime).toISOString(),
          }];
          
          const receiptOptions: ReceiptOptions = {
            projectPath: options.projectPath,
            runId: artifacts.runId,
            verdict,
            artifactDir: artifacts.artifactDir,
            commands,
            runtimeTraces,
            criticalPaths: options.criticalPaths,
            orgKeyId: options.orgKeyId,
            orgPrivateKey: options.orgPrivateKey,
          };
          
          receiptPath = await generateReceipt(receiptOptions);
          
          // Write receipt summary
          const receiptSummary = generateReceiptSummary(receiptPath);
          writeFileSync(
            join(artifacts.artifactDir, 'receipt-summary.txt'),
            receiptSummary
          );
        } catch (error: any) {
          // Log receipt generation error but don't fail the run
          writeFileSync(
            join(artifacts.artifactDir, 'receipt-error.log'),
            `Receipt generation failed: ${error.message}\n${error.stack}`
          );
        }
      }

      resolve({
        success,
        exitCode,
        output,
        artifacts,
        duration,
        receiptPath,
        runtimeTraces,
      });
    });

    childProcess.on('error', (err) => {
      if (timeoutHandle) {
        clearTimeout(timeoutHandle);
      }
      process.removeListener('SIGINT', sigintHandler);

      const duration = Date.now() - startTime;
      output += `\n[ERROR] Failed to spawn Playwright: ${err.message}\n`;

      writeFileSync(join(artifacts.artifactDir, 'output.log'), output);

      resolve({
        success: false,
        exitCode: 1,
        output,
        artifacts,
        duration,
      });
    });
  });
}

/**
 * Copy HTML report to artifacts if it exists
 */
function copyHtmlReportIfExists(projectPath: string, artifacts: RunArtifacts): void {
  const possibleReportPaths = [
    join(projectPath, 'playwright-report'),
    join(dirname(artifacts.testFilePath), 'playwright-report'),
    join(projectPath, '.guardrail', 'reality-tests', 'playwright-report'),
  ];

  for (const reportPath of possibleReportPaths) {
    if (existsSync(reportPath) && existsSync(join(reportPath, 'index.html'))) {
      try {
        copyDirectoryRecursive(reportPath, artifacts.reportPath!);
        break;
      } catch {
        // Ignore copy errors
      }
    }
  }
}

/**
 * Recursively copy directory
 */
function copyDirectoryRecursive(src: string, dest: string): void {
  if (!existsSync(dest)) {
    mkdirSync(dest, { recursive: true });
  }

  const entries = readdirSync(src, { withFileTypes: true });
  
  for (const entry of entries) {
    const srcPath = join(src, entry.name);
    const destPath = join(dest, entry.name);

    if (entry.isDirectory()) {
      copyDirectoryRecursive(srcPath, destPath);
    } else {
      copyFileSync(srcPath, destPath);
    }
  }
}

/**
 * Format duration for display
 */
export function formatDuration(ms: number): string {
  if (ms < 1000) {
    return `${ms}ms`;
  }
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  
  if (minutes > 0) {
    return `${minutes}m ${remainingSeconds}s`;
  }
  return `${seconds}s`;
}

/**
 * Run Playwright codegen for recording mode
 */
export async function runPlaywrightCodegen(
  baseUrl: string,
  outputFile: string,
  projectPath: string,
  onOutput: (data: string) => void
): Promise<{ success: boolean; exitCode: number; output: string }> {
  return new Promise((resolve) => {
    const depCheck = checkPlaywrightDependencies(projectPath);
    
    if (!depCheck.playwrightInstalled || !depCheck.browsersInstalled) {
      const errorMsg = depCheck.errorMessage || 'Dependency check failed';
      onOutput(errorMsg + '\n');
      if (depCheck.installCommands.length > 0) {
        onOutput('\nInstall commands:\n');
        depCheck.installCommands.forEach(cmd => onOutput(`  ${cmd}\n`));
      }
      resolve({
        success: false,
        exitCode: 2,
        output: errorMsg,
      });
      return;
    }

    let output = '';
    const args = ['codegen', baseUrl, '--target', 'playwright-test', '--output', outputFile];
    
    const useNpx = depCheck.playwrightPath === 'npx playwright';
    const command = useNpx ? 'npx' : process.platform === 'win32' ? 'npx' : depCheck.playwrightPath!;
    const spawnArgs = useNpx ? ['playwright', ...args] : args;

    onOutput(`Starting Playwright codegen...\n`);
    onOutput(`Command: ${command} ${spawnArgs.join(' ')}\n\n`);
    onOutput('Instructions:\n');
    onOutput('  1. Browser will open - interact with your app\n');
    onOutput('  2. Click, type, navigate as needed\n');
    onOutput('  3. Close the browser when done\n');
    onOutput('  4. Generated test will be saved to: ' + outputFile + '\n\n');

    const childProcess = spawn(command, spawnArgs, {
      cwd: dirname(outputFile),
      stdio: ['pipe', 'pipe', 'pipe'],
      shell: process.platform === 'win32',
      env: {
        ...process.env,
      },
    });

    childProcess.stdout?.on('data', (data: Buffer) => {
      const text = data.toString();
      output += text;
      onOutput(text);
    });

    childProcess.stderr?.on('data', (data: Buffer) => {
      const text = data.toString();
      output += text;
      onOutput(text);
    });

    childProcess.on('close', (code) => {
      const exitCode = code ?? 0;
      resolve({
        success: exitCode === 0,
        exitCode,
        output,
      });
    });

    childProcess.on('error', (err) => {
      const errorMsg = `Failed to spawn Playwright codegen: ${err.message}`;
      output += errorMsg;
      onOutput(errorMsg + '\n');
      resolve({
        success: false,
        exitCode: 1,
        output,
      });
    });
  });
}
