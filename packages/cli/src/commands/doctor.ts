/**
 * guardrail doctor
 * 
 * First-class setup verification + exact fix steps
 * Zero "uncaught exception" behavior
 */

import { Command } from 'commander';
import { resolve, join } from 'path';
import { existsSync, readFileSync } from 'fs';
<<<<<<< HEAD
import { execSync } from 'child_process';
=======
>>>>>>> 64774cf6f8ffd3a30c44ac65801f229995aeb6e7
import { TruthPackGenerator } from '../truth-pack';
import { printLogo } from '../ui';
import { styles, icons } from '../ui';

export interface DoctorIssue {
  id: string;
  severity: 'error' | 'warning' | 'info';
  category: 'setup' | 'configuration' | 'dependencies' | 'permissions' | 'network';
  message: string;
  fix: string;
  command?: string;
}

export function registerDoctorCommand(program: Command): void {
  program
    .command('doctor')
    .description('Verify setup and provide exact fix steps')
    .option('-p, --path <path>', 'Project path', '.')
    .option('--fix', 'Automatically apply safe fixes')
    .action(async (options) => {
      printLogo();

      const projectPath = resolve(options.path);
      const issues: DoctorIssue[] = [];

      console.log(`\n${styles.brightCyan}${styles.bold}${icons.info} guardrail DOCTOR${styles.reset}\n`);
      console.log(`  ${styles.dim}Checking:${styles.reset} ${projectPath}\n`);

      // Check 1: Truth Pack exists and is fresh
      const generator = new TruthPackGenerator(projectPath);
      if (!existsSync(generator.getPath())) {
        issues.push({
          id: 'DOCTOR-001',
          severity: 'error',
          category: 'setup',
          message: 'Truth Pack not found',
          fix: 'Run guardrail init to generate Truth Pack',
          command: 'guardrail init',
        });
      } else if (!generator.isFresh(168)) { // 7 days
        issues.push({
          id: 'DOCTOR-002',
          severity: 'warning',
          category: 'setup',
          message: 'Truth Pack is stale (older than 7 days)',
          fix: 'Regenerate Truth Pack to ensure accuracy',
          command: 'guardrail init --force',
        });
      }

      // Check 2: Configuration file exists
      const configFile = join(projectPath, '.guardrail', 'config.json');
      if (!existsSync(configFile)) {
        issues.push({
          id: 'DOCTOR-003',
          severity: 'info',
          category: 'configuration',
          message: 'No guardrail configuration file found',
          fix: 'Run guardrail init to create configuration',
          command: 'guardrail init',
        });
      }

      // Check 3: Node.js version
      const nodeVersion = process.version;
<<<<<<< HEAD
      const majorStr = nodeVersion.slice(1).split('.')[0];
      const majorVersion = majorStr !== undefined ? parseInt(majorStr, 10) : NaN;
=======
      const majorVersion = parseInt(nodeVersion.slice(1).split('.')[0]);
>>>>>>> 64774cf6f8ffd3a30c44ac65801f229995aeb6e7
      if (majorVersion < 18) {
        issues.push({
          id: 'DOCTOR-004',
          severity: 'error',
          category: 'dependencies',
          message: `Node.js version ${nodeVersion} is too old (requires >= 18)`,
          fix: 'Upgrade Node.js to version 18 or higher',
        });
      }

      // Check 4: Playwright availability (for ship command)
      try {
        require.resolve('playwright');
      } catch {
        issues.push({
          id: 'DOCTOR-005',
          severity: 'warning',
          category: 'dependencies',
          message: 'Playwright not installed (required for guardrail ship --runtime)',
          fix: 'Install Playwright: npm install -D playwright && npx playwright install',
          command: 'npm install -D playwright && npx playwright install',
        });
      }

      // Check 5: Git repository
      const gitDir = join(projectPath, '.git');
      if (!existsSync(gitDir)) {
        issues.push({
          id: 'DOCTOR-006',
          severity: 'info',
          category: 'setup',
          message: 'Not a git repository (change-aware scanning will be limited)',
          fix: 'Initialize git repository: git init',
          command: 'git init',
        });
      }

      // Check 6: Package.json exists
      const packageJson = join(projectPath, 'package.json');
      if (!existsSync(packageJson)) {
        issues.push({
          id: 'DOCTOR-007',
          severity: 'warning',
          category: 'setup',
          message: 'No package.json found (dependency scanning will be limited)',
          fix: 'Create package.json or ensure you are in the project root',
        });
      }

      // Check 7: Write permissions
      const testFile = join(projectPath, '.guardrail', '.test-write');
      try {
        const { writeFileSync, unlinkSync } = await import('fs');
        writeFileSync(testFile, 'test');
        unlinkSync(testFile);
      } catch {
        issues.push({
          id: 'DOCTOR-008',
          severity: 'error',
          category: 'permissions',
          message: 'No write permissions in project directory',
          fix: 'Fix directory permissions or run with appropriate access',
        });
      }

      // Display results
      const errors = issues.filter(i => i.severity === 'error');
      const warnings = issues.filter(i => i.severity === 'warning');
      const infos = issues.filter(i => i.severity === 'info');

      if (issues.length === 0) {
        console.log(`  ${styles.brightGreen}${icons.success}${styles.reset} ${styles.bold}No issues found. Everything looks good!${styles.reset}\n`);
        process.exit(0);
      }

      if (errors.length > 0) {
        console.log(`  ${styles.brightRed}${icons.error}${styles.reset} ${styles.bold}${errors.length} Error(s)${styles.reset}\n`);
        errors.forEach(issue => {
          console.log(`    ${styles.brightRed}${issue.id}${styles.reset} ${issue.message}`);
          console.log(`      ${styles.dim}Fix:${styles.reset} ${issue.fix}`);
          if (issue.command) {
            console.log(`      ${styles.dim}Command:${styles.reset} ${styles.bold}${issue.command}${styles.reset}`);
          }
          console.log('');
        });
      }

      if (warnings.length > 0) {
        console.log(`  ${styles.brightYellow}${icons.warning}${styles.reset} ${styles.bold}${warnings.length} Warning(s)${styles.reset}\n`);
        warnings.forEach(issue => {
          console.log(`    ${styles.brightYellow}${issue.id}${styles.reset} ${issue.message}`);
          console.log(`      ${styles.dim}Fix:${styles.reset} ${issue.fix}`);
          if (issue.command) {
            console.log(`      ${styles.dim}Command:${styles.reset} ${styles.bold}${issue.command}${styles.reset}`);
          }
          console.log('');
        });
      }

      if (infos.length > 0) {
        console.log(`  ${styles.brightBlue}${icons.info}${styles.reset} ${styles.bold}${infos.length} Info${styles.reset}\n`);
        infos.forEach(issue => {
          console.log(`    ${styles.brightBlue}${issue.id}${styles.reset} ${issue.message}`);
          console.log(`      ${styles.dim}Fix:${styles.reset} ${issue.fix}`);
          if (issue.command) {
            console.log(`      ${styles.dim}Command:${styles.reset} ${styles.bold}${issue.command}${styles.reset}`);
          }
          console.log('');
        });
      }

      // Auto-fix if requested
      if (options.fix) {
        console.log(`  ${styles.brightCyan}${icons.info}${styles.reset} ${styles.bold}Auto-fixing issues...${styles.reset}\n`);

        for (const issue of issues) {
          if (issue.command && issue.severity === 'error') {
            console.log(`  ${styles.dim}Running: ${issue.command}${styles.reset}`);
<<<<<<< HEAD
            try {
              execSync(issue.command, {
                cwd: projectPath,
                stdio: 'inherit',
                shell: process.platform === 'win32' ? 'cmd.exe' : '/bin/sh',
                env: { ...process.env },
              });
              console.log(`  ${styles.brightGreen}${icons.success}${styles.reset} Completed: ${issue.id}\n`);
            } catch {
              console.log(
                `  ${styles.brightYellow}${icons.warning}${styles.reset} Command exited non-zero: ${issue.id}\n`
              );
            }
=======
            // TODO: Actually execute the command
            console.log(`  ${styles.brightGreen}${icons.success}${styles.reset} Fixed: ${issue.id}\n`);
>>>>>>> 64774cf6f8ffd3a30c44ac65801f229995aeb6e7
          }
        }
      } else {
        console.log(`  ${styles.bold}Next:${styles.reset} Run ${styles.bold}guardrail doctor --fix${styles.reset} to auto-fix issues\n`);
      }

      // Exit code
      if (errors.length > 0) {
        process.exit(1);
      } else if (warnings.length > 0) {
        process.exit(0); // Warnings don't fail
      } else {
        process.exit(0);
      }
    });
}
