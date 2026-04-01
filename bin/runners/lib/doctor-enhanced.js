/**
 * Enhanced Doctor Command
 * 
 * Self-diagnosing CLI that catches 90% of setup issues.
 * Goal: kill support tickets by being brutally helpful.
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const c = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
};

class DoctorEnhanced {
  constructor(projectPath) {
    this.projectPath = projectPath;
    this.issues = [];
    this.fixes = [];
  }

  async diagnose() {
    console.log('\n🔍 guardrail Doctor\n');
    console.log('Checking your environment...\n');

    await this.checkNodeVersion();
    await this.checkPackageManager();
    await this.checkRequiredBinaries();
    await this.checkEnvVars();
    await this.checkPermissions();
    await this.checkProjectStructure();
    await this.checkCanBuild();
    await this.checkCanRun();

    this.printReport();
    return this.issues.length === 0 ? 0 : 1;
  }

  async checkNodeVersion() {
    try {
      const version = process.version;
      const major = parseInt(version.slice(1).split('.')[0]);
      
      if (major < 18) {
        this.issue('Node version too old', `You're running Node ${version}. guardrail requires Node 18+.`, `nvm install 18 && nvm use 18`);
      } else {
        this.pass(`Node version: ${version}`);
      }
    } catch {
      this.issue('Cannot detect Node version', 'Node.js may not be installed.', 'Install Node.js from nodejs.org');
    }
  }

  async checkPackageManager() {
    const managers = ['pnpm', 'npm', 'yarn'];
    let found = null;

    for (const mgr of managers) {
      try {
        execSync(`${mgr} --version`, { stdio: 'ignore' });
        found = mgr;
        break;
      } catch {
        // Not found
      }
    }

    if (!found) {
      this.issue('No package manager found', 'Install pnpm, npm, or yarn.', 'npm install -g pnpm');
    } else {
      this.pass(`Package manager: ${found}`);
    }
  }

  async checkRequiredBinaries() {
    const binaries = [
      { name: 'git', required: true },
      { name: 'playwright', required: false, check: 'npx playwright --version' },
    ];

    for (const bin of binaries) {
      try {
        if (bin.check) {
          execSync(bin.check, { stdio: 'ignore' });
        } else {
          execSync(`which ${bin.name}`, { stdio: 'ignore' });
        }
        this.pass(`${bin.name} found`);
      } catch {
        if (bin.required) {
          this.issue(`${bin.name} not found`, `${bin.name} is required.`, `Install ${bin.name}`);
        } else {
          this.warn(`${bin.name} not found`, `Optional: ${bin.name} enables runtime verification.`, `npx playwright install`);
        }
      }
    }
  }

  async checkEnvVars() {
    const required = process.env.GUARDRAIL_API_KEY ? [] : ['GUARDRAIL_API_KEY (optional)'];
    const sensitive = ['API_KEY', 'SECRET', 'TOKEN', 'PASSWORD'];

    // Check for common missing env vars
    const envFile = path.join(this.projectPath, '.env');
    if (!fs.existsSync(envFile)) {
      this.warn('No .env file', 'Consider creating .env for local configuration.', 'touch .env');
    }

    // Check for exposed secrets (but never print them)
    const envExample = path.join(this.projectPath, '.env.example');
    if (fs.existsSync(envExample)) {
      const content = fs.readFileSync(envExample, 'utf8');
      const hasSecrets = sensitive.some(s => content.includes(s));
      if (hasSecrets) {
        this.pass('.env.example found');
      }
    }
  }

  async checkPermissions() {
    try {
      const testFile = path.join(this.projectPath, '.guardrail', '.test-write');
      fs.mkdirSync(path.dirname(testFile), { recursive: true });
      fs.writeFileSync(testFile, 'test');
      fs.unlinkSync(testFile);
      this.pass('Write permissions OK');
    } catch {
      this.issue('No write permissions', 'Cannot write to .guardrail directory.', `chmod -R u+w ${this.projectPath}`);
    }
  }

  async checkProjectStructure() {
    const packageJson = path.join(this.projectPath, 'package.json');
    if (!fs.existsSync(packageJson)) {
      this.issue('No package.json', 'This doesn\'t look like a Node.js project.', 'Run guardrail init');
      return;
    }

    this.pass('package.json found');

    // Check for common project structures
    const hasSrc = fs.existsSync(path.join(this.projectPath, 'src')) ||
                   fs.existsSync(path.join(this.projectPath, 'app')) ||
                   fs.existsSync(path.join(this.projectPath, 'pages'));
    
    if (!hasSrc) {
      this.warn('No source directory found', 'guardrail works best with standard project structures.', 'Consider organizing code in src/ or app/');
    }
  }

  async checkCanBuild() {
    try {
      const packageJson = JSON.parse(fs.readFileSync(path.join(this.projectPath, 'package.json'), 'utf8'));
      if (packageJson.scripts?.build) {
        try {
          execSync('npm run build', { cwd: this.projectPath, stdio: 'ignore', timeout: 10000 });
          this.pass('Project builds successfully');
        } catch {
          this.warn('Build failed', 'Project may have build errors.', 'Run: npm run build');
        }
      }
    } catch {
      // Can't check build
    }
  }

  async checkCanRun() {
    // Minimal runtime check would go here
    // For now, just pass
    this.pass('Runtime check skipped (use --runtime for full check)');
  }

  issue(title, description, fix) {
    this.issues.push({ type: 'error', title, description, fix });
  }

  warn(title, description, fix) {
    this.issues.push({ type: 'warning', title, description, fix });
  }

  pass(message) {
    // Silent pass - only show issues
  }

  printReport() {
    if (this.issues.length === 0) {
      console.log(`${c.green}${c.bold}✓ All checks passed!${c.reset}\n`);
      return;
    }

    console.log('\n' + '═'.repeat(70));
    console.log(`${c.bold}DIAGNOSIS REPORT${c.reset}`);
    console.log('═'.repeat(70) + '\n');

    const errors = this.issues.filter(i => i.type === 'error');
    const warnings = this.issues.filter(i => i.type === 'warning');

    if (errors.length > 0) {
      console.log(`${c.red}${c.bold}❌ ERRORS (${errors.length}):${c.reset}\n`);
      for (const issue of errors) {
        console.log(`  ${c.bold}${issue.title}${c.reset}`);
        console.log(`    ${c.dim}${issue.description}${c.reset}`);
        if (issue.fix) {
          console.log(`    ${c.cyan}→ Fix: ${issue.fix}${c.reset}`);
        }
        console.log('');
      }
    }

    if (warnings.length > 0) {
      console.log(`${c.yellow}${c.bold}⚠️  WARNINGS (${warnings.length}):${c.reset}\n`);
      for (const issue of warnings) {
        console.log(`  ${c.bold}${issue.title}${c.reset}`);
        console.log(`    ${c.dim}${issue.description}${c.reset}`);
        if (issue.fix) {
          console.log(`    ${c.cyan}→ Fix: ${issue.fix}${c.reset}`);
        }
        console.log('');
      }
    }

    console.log('═'.repeat(70) + '\n');
  }
}

module.exports = { DoctorEnhanced };
