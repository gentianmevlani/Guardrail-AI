import { existsSync } from 'fs';
import { spawn } from 'child_process';
import { ExitCode, exitWith } from '../runtime/exit-codes';
import { icons, styles, truncatePath } from '../ui';
import { installPlaywrightDependencies } from '../utils/playwright-install';
import { strOpt, type RealityCliOptions } from './reality-cli-options';

/**
 * Playwright codegen path for `guardrail reality --record`.
 */
export async function runRealityRecordMode(projectPath: string, o: RealityCliOptions): Promise<void> {
  const {
    checkPlaywrightDependencies,
    createArtifactDirectory,
  } = require('../reality/reality-runner');
  console.log(`  ${styles.brightCyan}${icons.reality} Starting Playwright Codegen...${styles.reset}`);
  console.log('');
  console.log(`  ${styles.dim}Recording user actions for flow: ${o.flow}${styles.reset}`);
  console.log(`  ${styles.dim}Press Ctrl+C when done recording${styles.reset}`);
  console.log('');

  const depCheck = checkPlaywrightDependencies(projectPath);
  if (!depCheck.playwrightInstalled) {
    console.log(`  ${styles.brightYellow}${icons.warning} Playwright not installed${styles.reset}`);
    console.log('');
    console.log(`  ${styles.brightCyan}${icons.info} Attempting automatic installation...${styles.reset}`);
    const installResult = await installPlaywrightDependencies(projectPath);

    if (!installResult.success) {
      console.log(`  ${styles.brightRed}${icons.error} Auto-installation failed: ${installResult.error}${styles.reset}`);
      console.log('');
      console.log(`${styles.bold}Manual install commands:${styles.reset}`);
      depCheck.installCommands.forEach((cmd: string) => {
        console.log(`    ${styles.brightCyan}${cmd}${styles.reset}`);
      });
      console.log('');
      exitWith(ExitCode.SYSTEM_ERROR, 'Playwright not installed');
    }

    console.log(`  ${styles.brightGreen}${icons.success} Playwright installed successfully${styles.reset}`);
    console.log('');
  }

  if (!depCheck.browsersInstalled) {
    console.log(`  ${styles.brightYellow}${icons.warning} Playwright browsers not installed${styles.reset}`);
    console.log('');
    console.log(`  ${styles.brightCyan}${icons.info} Installing browsers...${styles.reset}`);
    try {
      await new Promise<void>((resolve, reject) => {
        const browserInstall = spawn('npx', ['playwright', 'install'], {
          cwd: projectPath,
          stdio: 'pipe',
        });

        browserInstall.on('close', (code) => {
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
      console.log(`${styles.brightCyan}npx playwright install${styles.reset}`);
      console.log('');
      exitWith(ExitCode.SYSTEM_ERROR, 'Playwright browsers not installed');
    }
  }

  const artifacts = createArtifactDirectory(projectPath, strOpt(o.flow, 'auth'));
  const codegenArgs = [
    'playwright',
    'codegen',
    strOpt(o.url, 'http://localhost:3000'),
    '--target',
    'playwright-test',
    '-o',
    artifacts.testFilePath,
  ];
  const codegenProc = spawn('npx', codegenArgs, {
    stdio: 'inherit',
    shell: process.platform === 'win32',
    cwd: projectPath,
  });

  codegenProc.on('close', (code) => {
    if (code === 0 && existsSync(artifacts.testFilePath)) {
      console.log('');
      console.log(`  ${styles.brightGreen}${icons.success} Recording saved${styles.reset}`);
      console.log('');
      console.log(`${styles.dim}Test file:${styles.reset} ${truncatePath(artifacts.testFilePath)}`);
      console.log(`${styles.dim}Artifacts:${styles.reset} ${truncatePath(artifacts.artifactDir)}`);
      console.log('');
      console.log(`${styles.bold}To run the recorded test:${styles.reset}`);
      console.log(`    ${styles.brightCyan}guardrail reality --run --flow ${o.flow}${styles.reset}`);
      console.log('');
      process.exit(0);
    } else {
      console.log('');
      console.log(`  ${styles.brightRed}${icons.error} Recording cancelled or failed${styles.reset}`);
      console.log('');
      process.exit(code || 1);
    }
  });
}
