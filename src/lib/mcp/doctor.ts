/**
 * Doctor - Setup Diagnostics and Auto-Fix
 * 
 * Provides smart onboarding and environment health checks.
 * "What will happen" previews before running commands.
 */

import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';
import { policyManager } from './policy-manager';

export interface DiagnosticCheck {
  id: string;
  name: string;
  description: string;
  status: 'pass' | 'fail' | 'warn' | 'pending';
  message?: string;
  fix?: {
    command?: string;
    action?: string;
    preview: string;
  };
}

export interface DoctorResult {
  healthy: boolean;
  checks: DiagnosticCheck[];
  recommendations: string[];
  nextSteps: {
    action: string;
    description: string;
    command?: string;
  }[];
}

export interface OnboardingState {
  step: number;
  totalSteps: number;
  currentAction: string;
  completed: string[];
  pending: string[];
}

class Doctor {
  private projectPath: string = '';

  async initialize(projectPath: string): Promise<void> {
    this.projectPath = projectPath;
  }

  async runDiagnostics(): Promise<DoctorResult> {
    const checks: DiagnosticCheck[] = [];
    const recommendations: string[] = [];

    // Check 1: Node.js version
    checks.push(await this.checkNodeVersion());

    // Check 2: Package manager
    checks.push(await this.checkPackageManager());

    // Check 3: Playwright installed
    checks.push(await this.checkPlaywright());

    // Check 4: Playwright browsers
    checks.push(await this.checkPlaywrightBrowsers());

    // Check 5: .guardrailrc exists
    checks.push(await this.checkGuardrailConfig());

    // Check 6: .guardrail directory
    checks.push(await this.checkGuardrailDir());

    // Check 7: Git repository
    checks.push(await this.checkGitRepo());

    // Check 8: TypeScript config
    checks.push(await this.checkTypeScript());

    // Check 9: Next.js build mode (if applicable)
    checks.push(await this.checkNextJsBuildMode());

    // Check 10: Environment variables
    checks.push(await this.checkEnvSetup());

    // Generate recommendations based on failed checks
    const failedChecks = checks.filter(c => c.status === 'fail');
    const warnChecks = checks.filter(c => c.status === 'warn');

    if (failedChecks.length > 0) {
      recommendations.push(`Fix ${failedChecks.length} failed check(s) before running ship checks.`);
    }
    if (warnChecks.length > 0) {
      recommendations.push(`Review ${warnChecks.length} warning(s) for optimal setup.`);
    }

    const nextSteps = this.generateNextSteps(checks);

    return {
      healthy: failedChecks.length === 0,
      checks,
      recommendations,
      nextSteps,
    };
  }

  private async checkNodeVersion(): Promise<DiagnosticCheck> {
    try {
      const version = process.version;
      const major = parseInt(version.slice(1).split('.')[0], 10);
      
      if (major >= 18) {
        return {
          id: 'node-version',
          name: 'Node.js Version',
          description: 'Check Node.js version is 18+',
          status: 'pass',
          message: `Node.js ${version} detected`,
        };
      } else {
        return {
          id: 'node-version',
          name: 'Node.js Version',
          description: 'Check Node.js version is 18+',
          status: 'fail',
          message: `Node.js ${version} is below minimum (18.0.0)`,
          fix: {
            preview: 'Upgrade Node.js to version 18 or higher',
            action: 'Visit https://nodejs.org to download the latest version',
          },
        };
      }
    } catch {
      return {
        id: 'node-version',
        name: 'Node.js Version',
        description: 'Check Node.js version is 18+',
        status: 'fail',
        message: 'Could not detect Node.js version',
      };
    }
  }

  private async checkPackageManager(): Promise<DiagnosticCheck> {
    const pnpmLock = path.join(this.projectPath, 'pnpm-lock.yaml');
    const yarnLock = path.join(this.projectPath, 'yarn.lock');
    const npmLock = path.join(this.projectPath, 'package-lock.json');

    let manager = 'unknown';
    if (fs.existsSync(pnpmLock)) manager = 'pnpm';
    else if (fs.existsSync(yarnLock)) manager = 'yarn';
    else if (fs.existsSync(npmLock)) manager = 'npm';

    return {
      id: 'package-manager',
      name: 'Package Manager',
      description: 'Detect package manager',
      status: manager !== 'unknown' ? 'pass' : 'warn',
      message: manager !== 'unknown' ? `Using ${manager}` : 'No lock file detected',
    };
  }

  private async checkPlaywright(): Promise<DiagnosticCheck> {
    try {
      const pkgPath = path.join(this.projectPath, 'package.json');
      if (fs.existsSync(pkgPath)) {
        const pkg = JSON.parse(await fs.promises.readFile(pkgPath, 'utf-8'));
        const deps = { ...pkg.dependencies, ...pkg.devDependencies };
        
        if (deps['@playwright/test'] || deps['playwright']) {
          return {
            id: 'playwright-installed',
            name: 'Playwright Installed',
            description: 'Check if Playwright is installed',
            status: 'pass',
            message: 'Playwright is installed',
          };
        }
      }
      
      return {
        id: 'playwright-installed',
        name: 'Playwright Installed',
        description: 'Check if Playwright is installed',
        status: 'fail',
        message: 'Playwright is not installed (required for Reality Mode)',
        fix: {
          command: 'npm install -D @playwright/test',
          preview: 'This will install Playwright as a dev dependency',
        },
      };
    } catch {
      return {
        id: 'playwright-installed',
        name: 'Playwright Installed',
        description: 'Check if Playwright is installed',
        status: 'fail',
        message: 'Could not check Playwright installation',
      };
    }
  }

  private async checkPlaywrightBrowsers(): Promise<DiagnosticCheck> {
    try {
      execSync('npx playwright --version', { encoding: 'utf-8', stdio: 'pipe' });
      
      // Check if browsers are installed by looking for chromium
      const homeDir = process.env.HOME || process.env.USERPROFILE || '';
      const browserPaths = [
        path.join(homeDir, '.cache', 'ms-playwright'),
        path.join(homeDir, 'AppData', 'Local', 'ms-playwright'),
      ];
      
      const hasBrowsers = browserPaths.some(p => fs.existsSync(p));
      
      if (hasBrowsers) {
        return {
          id: 'playwright-browsers',
          name: 'Playwright Browsers',
          description: 'Check if Playwright browsers are installed',
          status: 'pass',
          message: 'Playwright browsers are installed',
        };
      }
      
      return {
        id: 'playwright-browsers',
        name: 'Playwright Browsers',
        description: 'Check if Playwright browsers are installed',
        status: 'warn',
        message: 'Playwright browsers may not be installed',
        fix: {
          command: 'npx playwright install',
          preview: 'This will download Chromium, Firefox, and WebKit browsers',
        },
      };
    } catch {
      return {
        id: 'playwright-browsers',
        name: 'Playwright Browsers',
        description: 'Check if Playwright browsers are installed',
        status: 'pending',
        message: 'Playwright not available to check browsers',
      };
    }
  }

  private async checkGuardrailConfig(): Promise<DiagnosticCheck> {
    const configPath = path.join(this.projectPath, '.guardrailrc');
    
    if (fs.existsSync(configPath)) {
      return {
        id: 'guardrail-config',
        name: 'guardrail Config',
        description: 'Check if .guardrailrc exists',
        status: 'pass',
        message: '.guardrailrc found',
      };
    }
    
    return {
      id: 'guardrail-config',
      name: 'guardrail Config',
      description: 'Check if .guardrailrc exists',
      status: 'warn',
      message: '.guardrailrc not found',
      fix: {
        action: 'guardrail init',
        preview: 'This will create a .guardrailrc file with default settings',
      },
    };
  }

  private async checkGuardrailDir(): Promise<DiagnosticCheck> {
    const dirPath = path.join(this.projectPath, '.guardrail');
    
    if (fs.existsSync(dirPath)) {
      return {
        id: 'guardrail-dir',
        name: 'guardrail Directory',
        description: 'Check if .guardrail/ directory exists',
        status: 'pass',
        message: '.guardrail/ directory found',
      };
    }
    
    return {
      id: 'guardrail-dir',
      name: 'guardrail Directory',
      description: 'Check if .guardrail/ directory exists',
      status: 'pass',
      message: '.guardrail/ will be created on first run',
    };
  }

  private async checkGitRepo(): Promise<DiagnosticCheck> {
    const gitPath = path.join(this.projectPath, '.git');
    
    if (fs.existsSync(gitPath)) {
      return {
        id: 'git-repo',
        name: 'Git Repository',
        description: 'Check if project is a git repository',
        status: 'pass',
        message: 'Git repository detected',
      };
    }
    
    return {
      id: 'git-repo',
      name: 'Git Repository',
      description: 'Check if project is a git repository',
      status: 'warn',
      message: 'Not a git repository (some features may be limited)',
      fix: {
        command: 'git init',
        preview: 'This will initialize a new git repository',
      },
    };
  }

  private async checkTypeScript(): Promise<DiagnosticCheck> {
    const tsconfigPath = path.join(this.projectPath, 'tsconfig.json');
    
    if (fs.existsSync(tsconfigPath)) {
      return {
        id: 'typescript',
        name: 'TypeScript Config',
        description: 'Check if TypeScript is configured',
        status: 'pass',
        message: 'tsconfig.json found',
      };
    }
    
    return {
      id: 'typescript',
      name: 'TypeScript Config',
      description: 'Check if TypeScript is configured',
      status: 'warn',
      message: 'No tsconfig.json found (JavaScript project)',
    };
  }

  private async checkNextJsBuildMode(): Promise<DiagnosticCheck> {
    const nextConfigPaths = [
      path.join(this.projectPath, 'next.config.js'),
      path.join(this.projectPath, 'next.config.mjs'),
      path.join(this.projectPath, 'next.config.ts'),
    ];
    
    for (const configPath of nextConfigPaths) {
      if (fs.existsSync(configPath)) {
        try {
          const content = await fs.promises.readFile(configPath, 'utf-8');
          
          if (content.includes("output: 'standalone'") || content.includes('output: "standalone"')) {
            return {
              id: 'nextjs-build-mode',
              name: 'Next.js Build Mode',
              description: 'Check Next.js output configuration',
              status: 'pass',
              message: 'Next.js standalone output mode configured',
            };
          }
          
          return {
            id: 'nextjs-build-mode',
            name: 'Next.js Build Mode',
            description: 'Check Next.js output configuration',
            status: 'warn',
            message: 'Consider using standalone output for production',
            fix: {
              preview: 'Add output: "standalone" to next.config.js for optimized production builds',
            },
          };
        } catch {
          // Continue to next config file
        }
      }
    }
    
    return {
      id: 'nextjs-build-mode',
      name: 'Next.js Build Mode',
      description: 'Check Next.js output configuration',
      status: 'pending',
      message: 'Not a Next.js project',
    };
  }

  private async checkEnvSetup(): Promise<DiagnosticCheck> {
    const envPath = path.join(this.projectPath, '.env');
    const envLocalPath = path.join(this.projectPath, '.env.local');
    const envExamplePath = path.join(this.projectPath, '.env.example');
    
    const hasEnv = fs.existsSync(envPath) || fs.existsSync(envLocalPath);
    const hasExample = fs.existsSync(envExamplePath);
    
    if (hasEnv && hasExample) {
      return {
        id: 'env-setup',
        name: 'Environment Setup',
        description: 'Check environment file configuration',
        status: 'pass',
        message: 'Environment files configured',
      };
    }
    
    if (hasEnv) {
      return {
        id: 'env-setup',
        name: 'Environment Setup',
        description: 'Check environment file configuration',
        status: 'warn',
        message: 'Consider adding .env.example for team documentation',
      };
    }
    
    return {
      id: 'env-setup',
      name: 'Environment Setup',
      description: 'Check environment file configuration',
      status: 'warn',
      message: 'No environment files found',
    };
  }

  private generateNextSteps(checks: DiagnosticCheck[]): DoctorResult['nextSteps'] {
    const steps: DoctorResult['nextSteps'] = [];
    
    // Prioritize fixes for failed checks
    for (const check of checks) {
      if (check.status === 'fail' && check.fix) {
        steps.push({
          action: `Fix: ${check.name}`,
          description: check.fix.preview,
          command: check.fix.command,
        });
      }
    }
    
    // Check if config needs to be created
    const configCheck = checks.find(c => c.id === 'guardrail-config');
    if (configCheck?.status === 'warn') {
      steps.push({
        action: 'Create .guardrailrc',
        description: 'Initialize guardrail configuration',
        command: 'guardrail init',
      });
    }
    
    // Suggest first ship check if healthy
    const healthyChecks = checks.filter(c => c.status === 'pass' || c.status === 'pending');
    if (healthyChecks.length >= checks.length - 1) {
      steps.push({
        action: 'Run first Ship Check',
        description: 'Verify your app is ready to ship',
        command: 'guardrail ship check',
      });
    }
    
    return steps;
  }

  async autoFix(checkId: string): Promise<{ success: boolean; message: string }> {
    const result = await this.runDiagnostics();
    const check = result.checks.find(c => c.id === checkId);
    
    if (!check) {
      return { success: false, message: `Check "${checkId}" not found` };
    }
    
    if (check.status === 'pass') {
      return { success: true, message: `${check.name} is already passing` };
    }
    
    if (!check.fix) {
      return { success: false, message: `No auto-fix available for ${check.name}` };
    }
    
    try {
      if (check.fix.command) {
        execSync(check.fix.command, { cwd: this.projectPath, stdio: 'pipe' });
        return { success: true, message: `Executed: ${check.fix.command}` };
      }
      
      if (check.fix.action === 'guardrail init') {
        await policyManager.initialize(this.projectPath);
        await policyManager.create();
        return { success: true, message: 'Created .guardrailrc' };
      }
      
      return { success: false, message: 'Auto-fix action not implemented' };
    } catch (error: any) {
      return { success: false, message: `Fix failed: ${error.message}` };
    }
  }

  formatReport(result: DoctorResult): string {
    const lines: string[] = [];
    
    lines.push('');
    lines.push('guardrail Doctor');
    lines.push('================');
    lines.push('');
    
    const statusIcon = (status: string) => {
      switch (status) {
        case 'pass': return '[PASS]';
        case 'fail': return '[FAIL]';
        case 'warn': return '[WARN]';
        default: return '[----]';
      }
    };
    
    for (const check of result.checks) {
      lines.push(`${statusIcon(check.status)} ${check.name}`);
      if (check.message) {
        lines.push(`       ${check.message}`);
      }
    }
    
    lines.push('');
    
    if (result.healthy) {
      lines.push('Status: HEALTHY');
      lines.push('Your environment is ready for guardrail.');
    } else {
      lines.push('Status: NEEDS ATTENTION');
      lines.push('');
      lines.push('Recommendations:');
      for (const rec of result.recommendations) {
        lines.push(`  - ${rec}`);
      }
    }
    
    if (result.nextSteps.length > 0) {
      lines.push('');
      lines.push('Next Steps:');
      for (const step of result.nextSteps) {
        lines.push(`  ${step.action}`);
        lines.push(`    ${step.description}`);
        if (step.command) {
          lines.push(`    $ ${step.command}`);
        }
      }
    }
    
    return lines.join('\n');
  }
}

export const doctor = new Doctor();
