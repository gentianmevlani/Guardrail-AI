import { resolve, basename, join } from 'path';
import { existsSync, mkdirSync, writeFileSync } from 'fs';
import { requireAuth } from '../runtime/cli-auth';
import { ExitCode, exitWith } from '../runtime/exit-codes';
import { icons, styles, frameLines, truncatePath, printDivider, printLogo } from '../ui';
import { getCriticalPathsForFlow } from '../reality/critical-paths';
import { installPlaywrightDependencies } from '../utils/playwright-install';
import { runRealityRecordMode } from './reality-command-record';
import { strOpt, type RealityCliOptions } from './reality-cli-options';

export async function runRealityCommand(options: Record<string, unknown>): Promise<void> {
    const o = options as RealityCliOptions;

    requireAuth('starter'); // Require Starter tier
    printLogo();
    
    console.log('');
    const projectPath = resolve(strOpt(o.path, '.'));
    const projectName = basename(projectPath);
    const timeout = parseInt(strOpt(o.timeout, '30'), 10) || 30;
    const workers = parseInt(strOpt(o.workers, '1'), 10) || 1;
    
    // Determine mode
    const mode = o.record ? 'Record' : o.run ? 'Generate + Run' : 'Generate Only';
    
    const headerLines = [
      `${styles.brightBlue}${styles.bold}${icons.reality} REALITY MODE${styles.reset}`,
      '',
      `${styles.dim}Project:${styles.reset}     ${styles.bold}${projectName}${styles.reset}`,
      `${styles.dim}Path:${styles.reset}        ${truncatePath(projectPath)}`,
      `${styles.dim}URL:${styles.reset}         ${o.url}`,
      `${styles.dim}Flow:${styles.reset}        ${o.flow}`,
      `${styles.dim}Mode:${styles.reset}        ${mode}`,
      `${styles.dim}Started:${styles.reset}     ${new Date().toLocaleString()}`,
    ];
    const framed = frameLines(headerLines, { padding: 2 });
    console.log(framed.join('\n'));
    console.log('');
    
    try {
      // Import reality functionality
      const { realityScanner } = require('guardrail-ship');
      const {
        checkPlaywrightDependencies,
        runPlaywrightTests,
        createArtifactDirectory,
        copyTestToArtifacts,
        formatDuration,
      } = require('../reality/reality-runner');
      const {
        runStaticScan,
        formatStaticScanResults,
        generateButtonSweepTest,
      } = require('../reality/no-dead-buttons');
      const { spawn } = require('child_process');

      if (o.record) {
        await runRealityRecordMode(projectPath, o);
        return;
      }

      // Run static "No Dead UI" scan if requested
      if (o.noDeadUi) {
        console.log(`  ${styles.brightCyan}${icons.info} Running static "No Dead UI" scan...${styles.reset}`);
        console.log('');
        
        const scanResult = runStaticScan(projectPath, ['src', 'app', 'components', 'pages'], []);
        const scanOutput = formatStaticScanResults(scanResult);
        console.log(scanOutput);
        console.log('');
        
        if (!scanResult.passed) {
          console.log(`  ${styles.brightRed}${icons.error} Static scan failed - found ${scanResult.errors.length} error(s)${styles.reset}`);
          console.log(`  ${styles.dim}Fix dead UI patterns before continuing${styles.reset}`);
          console.log('');
          
          if (o.run) {
            // If --run is set, fail early
            exitWith(ExitCode.POLICY_FAIL, 'Dead UI patterns detected');
          } else {
            console.log(`  ${styles.brightYellow}${icons.warning} Continuing despite errors (use --run to enforce)${styles.reset}`);
            console.log('');
          }
        } else {
          console.log(`  ${styles.brightGreen}${icons.success} Static scan passed${styles.reset}`);
          console.log('');
        }
      }

      // Generate button sweep test if requested
      if (o.buttonSweep) {
        console.log(`  ${styles.brightCyan}${icons.info} Generating button sweep test...${styles.reset}`);
        console.log('');
        
        const buttonSweepConfig = {
          baseUrl: o.url,
          auth: o.authEmail && o.authPassword
            ? { email: o.authEmail, password: o.authPassword }
            : undefined,
          pages: ['/', '/dashboard', '/settings', '/billing'],
          requireDataActionId: false,
        };
        
        const buttonSweepTest = generateButtonSweepTest(buttonSweepConfig);
        const buttonSweepOutputDir = join(process.cwd(), '.guardrail', 'reality-tests');
        if (!existsSync(buttonSweepOutputDir)) {
          mkdirSync(buttonSweepOutputDir, { recursive: true });
        }
        const buttonSweepFile = join(buttonSweepOutputDir, 'button-sweep.test.ts');
        writeFileSync(buttonSweepFile, buttonSweepTest);
        
        console.log(`  ${styles.brightGreen}${icons.success} Button sweep test generated${styles.reset}`);
        console.log(`  ${styles.dim}File:${styles.reset} ${truncatePath(buttonSweepFile)}`);
        console.log('');
        
        if (o.run) {
          // If --run is set, run the button sweep test instead of the regular test
          const artifacts = createArtifactDirectory(projectPath, 'button-sweep');
          copyTestToArtifacts(buttonSweepFile, artifacts);
          
          console.log(`  ${styles.bold}RUNNING BUTTON SWEEP TEST${styles.reset}`);
          printDivider();
          console.log('');
          
          const depCheck = checkPlaywrightDependencies(projectPath);
          if (!depCheck.playwrightInstalled || !depCheck.browsersInstalled) {
            console.log(`  ${styles.brightYellow}${icons.warning} Playwright dependencies required${styles.reset}`);
            exitWith(ExitCode.SYSTEM_ERROR, 'Playwright not installed');
          }
          
          const runResult = await runPlaywrightTests(
            {
              testFile: artifacts.testFilePath,
              headless: o.headless,
              timeout,
              workers,
              reporter: o.reporter,
              projectPath,
              baseUrl: o.url,
              flow: 'button-sweep',
              trace: o.trace,
              video: o.video,
              screenshot: o.screenshot,
            },
            artifacts,
            (data: string) => process.stdout.write(data)
          );
          
          console.log('');
          const summaryLines = runResult.success
            ? [
                `${styles.brightGreen}${styles.bold}${icons.success} BUTTON SWEEP PASSED${styles.reset}`,
                '',
                `${styles.dim}Duration:${styles.reset}    ${formatDuration(runResult.duration)}`,
                `${styles.dim}Artifacts:${styles.reset}   ${truncatePath(artifacts.artifactDir)}`,
              ]
            : [
                `${styles.brightRed}${styles.bold}${icons.error} BUTTON SWEEP FAILED${styles.reset}`,
                '',
                `${styles.dim}Duration:${styles.reset}    ${formatDuration(runResult.duration)}`,
                `${styles.dim}Artifacts:${styles.reset}   ${truncatePath(artifacts.artifactDir)}`,
              ];
          
          const framedSummary = frameLines(summaryLines, { padding: 2 });
          console.log(framedSummary.join('\n'));
          console.log('');
          
          process.exit(runResult.exitCode);
        }
      }

      // Generate Playwright test for reality mode
      const outputDir = join(process.cwd(), '.guardrail', 'reality-tests');
      if (!existsSync(outputDir)) {
        mkdirSync(outputDir, { recursive: true });
      }
      
      // Define basic click paths for different flows
      const clickPaths = {
        auth: [
          'input[name="email"]',
          'input[name="password"]', 
          'button[type="submit"]'
        ],
        checkout: [
          'button:has-text("Add to Cart")',
          'button:has-text("Checkout")',
          'input[name="cardNumber"]'
        ],
        dashboard: [
          '[href*="/dashboard"]',
          'button:has-text("Settings")',
          'button:has-text("Save")'
        ]
      };
      
      const selectedClickPaths = [clickPaths[o.flow as keyof typeof clickPaths] || clickPaths.auth];
      
      const testCode = realityScanner.generatePlaywrightTest({
        baseUrl: o.url,
        clickPaths: selectedClickPaths,
        outputDir
      });
      
      // Write test file
      const testFile = join(outputDir, `reality-${o.flow}.test.ts`);
      writeFileSync(testFile, testCode);
      
      const resultLines = [
        `${styles.brightGreen}${styles.bold}${icons.success} TEST GENERATED SUCCESSFULLY${styles.reset}`,
        '',
        `${styles.dim}File:${styles.reset}        ${truncatePath(testFile)}`,
        `${styles.dim}Base URL:${styles.reset}    ${o.url}`,
        `${styles.dim}Flow:${styles.reset}        ${o.flow}`,
        `${styles.dim}Mode:${styles.reset}        ${o.headless ? 'Headless' : 'Headed'}`,
      ];
      
      const framedResult = frameLines(resultLines, { padding: 2 });
      console.log(framedResult.join('\n'));
      console.log('');
      
      // If --run flag is set, execute the test immediately
      if (o.run) {
        console.log(`  ${styles.brightCyan}${icons.reality} Checking dependencies...${styles.reset}`);
        console.log('');
        
        const depCheck = checkPlaywrightDependencies(projectPath);
        
        if (!depCheck.playwrightInstalled) {
          console.log(`  ${styles.brightYellow}${icons.warning} Playwright not installed${styles.reset}`);
          console.log('');
          
          // Try to install automatically
          console.log(`  ${styles.brightCyan}${icons.info} Attempting automatic installation...${styles.reset}`);
          const installResult = await installPlaywrightDependencies(projectPath);
          
          if (!installResult.success) {
            console.log(`  ${styles.brightRed}${icons.error} Auto-installation failed: ${installResult.error}${styles.reset}`);
            console.log('');
            console.log(`  ${styles.bold}Manual install commands:${styles.reset}`);
            depCheck.installCommands.forEach((cmd: string) => {
              console.log(`    ${styles.brightCyan}${cmd}${styles.reset}`);
            });
            console.log('');
            exitWith(ExitCode.SYSTEM_ERROR, 'Playwright not installed');
          }
          
          // Re-check after installation
          const newDepCheck = checkPlaywrightDependencies(projectPath);
          if (!newDepCheck.playwrightInstalled) {
            console.log(`  ${styles.brightRed}${icons.error} Installation verification failed${styles.reset}`);
            exitWith(ExitCode.SYSTEM_ERROR, 'Playwright installation failed');
          }
          
          console.log(`  ${styles.brightGreen}${icons.success} Playwright installed successfully${styles.reset}`);
          console.log('');
        }
        
        if (!depCheck.browsersInstalled) {
          console.log(`  ${styles.brightYellow}${icons.warning} Playwright browsers not installed${styles.reset}`);
          console.log('');
          
          // Try to install browsers only
          console.log(`  ${styles.brightCyan}${icons.info} Installing browsers...${styles.reset}`);
          try {
            const { spawn } = require('child_process');
            await new Promise<void>((resolve, reject) => {
              const browserInstall = spawn('npx', ['playwright', 'install'], {
                cwd: projectPath,
                stdio: 'pipe'
              });
              
              browserInstall.on('close', (code: number | null) => {
                if (code === 0) {
                  console.log(`  ${styles.brightGreen}${icons.success} Browsers installed successfully${styles.reset}`);
                  resolve();
                } else {
                  reject(new Error('browser install failed'));
                }
              });
              
              browserInstall.on('error', reject);
            });
          } catch (error: unknown) {
            const em = error instanceof Error ? error.message : String(error);
            console.log(`  ${styles.brightRed}${icons.error} Browser installation failed: ${em}${styles.reset}`);
            console.log(`  ${styles.brightCyan}npx playwright install${styles.reset}`);
            console.log('');
            process.exit(2);
          }
        }
        
        console.log(`  ${styles.brightGreen}${icons.success}${styles.reset} Playwright installed`);
        console.log(`  ${styles.brightGreen}${icons.success}${styles.reset} Browsers available`);
        console.log('');
        
        // Create artifact directory
        const artifacts = createArtifactDirectory(projectPath, o.flow);
        copyTestToArtifacts(testFile, artifacts);
        
        console.log(`  ${styles.bold}EXECUTING TESTS${styles.reset}`);
        printDivider();
        console.log(`  ${styles.dim}Run ID:${styles.reset}      ${artifacts.runId}`);
        console.log(`  ${styles.dim}Artifacts:${styles.reset}   ${truncatePath(artifacts.artifactDir)}`);
        console.log(`  ${styles.dim}Timeout:${styles.reset}     ${timeout}s`);
        console.log(`  ${styles.dim}Workers:${styles.reset}     ${workers}`);
        console.log(`  ${styles.dim}Reporter:${styles.reset}    ${o.reporter}`);
        console.log('');
        console.log(`  ${styles.dim}--- Playwright Output ---${styles.reset}`);
        console.log('');
        
        // Define critical paths for coverage tracking
        const criticalPaths = getCriticalPathsForFlow(strOpt(o.flow, 'auth'), strOpt(o.url, 'http://localhost:3000'));
        
        const runResult = await runPlaywrightTests(
          {
            testFile: artifacts.testFilePath,
            headless: o.headless,
            timeout,
            workers,
            reporter: o.reporter,
            projectPath,
            baseUrl: o.url,
            flow: o.flow,
            trace: o.trace,
            video: o.video,
            screenshot: o.screenshot,
            generateReceipt: o.receipt,
            orgKeyId: o.orgKeyId,
            orgPrivateKey: o.orgPrivateKey,
            criticalPaths,
          },
          artifacts,
          (data: string) => process.stdout.write(data)
        );
        
        console.log('');
        console.log(`  ${styles.dim}--- End Playwright Output ---${styles.reset}`);
        console.log('');
        
        // Display run summary
        const summaryLines = runResult.success
          ? [
              `${styles.brightGreen}${styles.bold}${icons.success} TESTS PASSED${styles.reset}`,
              '',
              `${styles.dim}Duration:${styles.reset}    ${formatDuration(runResult.duration)}`,
              `${styles.dim}Exit Code:${styles.reset}   ${runResult.exitCode}`,
              `${styles.dim}Artifacts:${styles.reset}   ${truncatePath(artifacts.artifactDir)}`,
              ...(runResult.receiptPath ? [
                '',
                `${styles.brightCyan}${styles.bold}📜 PROOF-OF-EXECUTION RECEIPT${styles.reset}`,
                `${styles.dim}Receipt:${styles.reset}    ${truncatePath(runResult.receiptPath)}`,
                `${styles.dim}Verified:${styles.reset}   ${styles.brightGreen}✓ Tamper-evident${styles.reset}`,
              ] : []),
            ]
          : [
              `${styles.brightRed}${styles.bold}${icons.error} TESTS FAILED${styles.reset}`,
              '',
              `${styles.dim}Duration:${styles.reset}    ${formatDuration(runResult.duration)}`,
              `${styles.dim}Exit Code:${styles.reset}   ${runResult.exitCode}`,
              `${styles.dim}Artifacts:${styles.reset}   ${truncatePath(artifacts.artifactDir)}`,
              `${styles.dim}Screenshots:${styles.reset} ${truncatePath(artifacts.screenshotsDir)}`,
              ...(runResult.receiptPath ? [
                '',
                `${styles.brightYellow}${styles.bold}📜 PROOF-OF-EXECUTION RECEIPT${styles.reset}`,
                `${styles.dim}Receipt:${styles.reset}    ${truncatePath(runResult.receiptPath)}`,
                `${styles.dim}Note:${styles.reset}       Receipt generated despite test failure`,
              ] : []),
            ];
        
        const framedSummary = frameLines(summaryLines, { padding: 2 });
        console.log(framedSummary.join('\n'));
        console.log('');
        
        // Show how to view HTML report if reporter includes html
        if (strOpt(o.reporter, 'list').includes('html')) {
          console.log(`  ${styles.bold}VIEW HTML REPORT${styles.reset}`);
          printDivider();
          console.log(`     ${styles.brightCyan}npx playwright show-report ${artifacts.reportPath}${styles.reset}`);
          console.log('');
        }
        
        // Exit with Playwright's exit code
        process.exit(runResult.exitCode);
      } else {
        // Generate-only mode - show manual run instructions
        console.log(`  ${styles.bold}HOW TO RUN${styles.reset}`);
        printDivider();
        console.log(`  ${styles.dim}Option 1: Use --run flag (recommended):${styles.reset}`);
        console.log(`     ${styles.brightCyan}guardrail reality --run -f ${o.flow}${styles.reset}`);
        console.log('');
        console.log(`  ${styles.dim}Option 2: Run manually:${styles.reset}`);
        console.log(`     ${styles.brightCyan}cd ${outputDir}${styles.reset}`);
        console.log(`     ${styles.brightCyan}npx playwright test reality-${o.flow}.test.ts${!o.headless ? ' --headed' : ''}${styles.reset}`);
        console.log('');
        
        console.log(`  ${styles.bold}WHERE ARTIFACTS ARE SAVED${styles.reset}`);
        printDivider();
        console.log(`  ${styles.dim}When using --run, artifacts are stored under:${styles.reset}`);
        console.log(`     ${styles.brightCyan}.guardrail/reality/<runId>/${styles.reset}`);
        console.log('');
        console.log(`  ${styles.dim}Contents:${styles.reset}`);
        console.log(`     ${styles.bullet} ${styles.bold}reality-*.test.ts${styles.reset} - Generated test file`);
        console.log(`     ${styles.bullet} ${styles.bold}output.log${styles.reset} - Playwright console output`);
        console.log(`     ${styles.bullet} ${styles.bold}result.json${styles.reset} - Run result summary`);
        console.log(`     ${styles.bullet} ${styles.bold}screenshots/${styles.reset} - Failure screenshots`);
        console.log(`     ${styles.bullet} ${styles.bold}report/${styles.reset} - HTML report (if --reporter html)`);
        console.log('');
        
        console.log(`  ${styles.brightGreen}${icons.success}${styles.reset} ${styles.bold}Reality test ready - detect fake data now${styles.reset}`);
        console.log('');
      }
      
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      console.log('');
      console.log(`  ${styles.brightRed}${icons.error}${styles.reset} ${styles.bold}Reality mode failed:${styles.reset} ${msg}`);
      console.log('');
      exitWith(ExitCode.SYSTEM_ERROR, 'Reality mode execution failed');
    }
}
