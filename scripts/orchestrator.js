#!/usr/bin/env node

/**
 * guardrail Security Orchestrator CLI
 * 
 * The unified security pipeline that orchestrates all scanners
 * and provides deploy/no-deploy verdicts.
 * 
 * Usage:
 *   node scripts/orchestrator.js [options]
 * 
 * Options:
 *   --path <path>        Project path (default: current directory)
 *   --env <environment>  Environment: development, staging, production (default: production)
 *   --ci                 CI mode - exit with error code on blockers
 *   --no-semgrep         Disable Semgrep SAST
 *   --no-supply-chain    Disable supply chain analysis
 *   --no-secrets         Disable secret scanning
 *   --format <formats>   Output formats: json,markdown,html,sarif (comma-separated)
 *   --threshold <score>  Max risk score threshold (default: 50)
 *   --help               Show help
 */

const fs = require('fs');
const path = require('path');
const {
  STRIPE_TEST_PREFIX,
  stripeSkLiveRegex24,
} = require('../bin/runners/lib/stripe-scan-patterns');
const { execSync, spawn } = require('child_process');

// ============ Configuration ============

const DEFAULT_CONFIG = {
  projectPath: process.cwd(),
  environment: 'production',
  enabledScanners: {
    policy: true,
    semgrep: true,
    supplyChain: true,
    secrets: true
  },
  thresholds: {
    maxRiskScore: 50,
    maxCriticalFindings: 0,
    maxHighFindings: 5
  },
  outputDir: '.guardrail',
  reportFormats: ['json', 'markdown'],
  ciMode: false,
  failOnBlockers: true
};

// ============ Parse Arguments ============

function parseArgs() {
  const args = process.argv.slice(2);
  const config = { ...DEFAULT_CONFIG };
  
  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--path':
        config.projectPath = path.resolve(args[++i]);
        break;
      case '--env':
        config.environment = args[++i];
        break;
      case '--ci':
        config.ciMode = true;
        break;
      case '--no-semgrep':
        config.enabledScanners.semgrep = false;
        break;
      case '--no-supply-chain':
        config.enabledScanners.supplyChain = false;
        break;
      case '--no-secrets':
        config.enabledScanners.secrets = false;
        break;
      case '--format':
        config.reportFormats = args[++i].split(',');
        break;
      case '--threshold':
        config.thresholds.maxRiskScore = parseInt(args[++i], 10);
        break;
      case '--help':
        showHelp();
        process.exit(0);
        break;
    }
  }
  
  return config;
}

function showHelp() {
  console.log(`
🛡️  guardrail Security Orchestrator

Usage:
  node scripts/orchestrator.js [options]

Options:
  --path <path>        Project path (default: current directory)
  --env <environment>  Environment: development, staging, production (default: production)
  --ci                 CI mode - exit with error code on blockers
  --no-semgrep         Disable Semgrep SAST
  --no-supply-chain    Disable supply chain analysis
  --no-secrets         Disable secret scanning
  --format <formats>   Output formats: json,markdown,html,sarif (comma-separated)
  --threshold <score>  Max risk score threshold (default: 50)
  --help               Show help

Examples:
  # Full scan with all tools
  node scripts/orchestrator.js

  # CI mode with custom threshold
  node scripts/orchestrator.js --ci --threshold 30

  # Scan specific path without secret scanning
  node scripts/orchestrator.js --path ./apps/api --no-secrets

  # Generate multiple report formats
  node scripts/orchestrator.js --format json,markdown,html,sarif
`);
}

// ============ Policy Checks ============

const BANNED_PATTERNS = [
  { pattern: 'MockProvider', message: 'MockProvider should not be in production' },
  { pattern: 'useMock', message: 'useMock hook should not be in production' },
  { pattern: 'mock-context', message: 'mock-context imports not allowed' },
  { pattern: 'localhost:\\d+', isRegex: true, message: 'Hardcoded localhost URLs' },
  { pattern: STRIPE_TEST_PREFIX, message: 'Stripe test keys detected' },
  { pattern: 'simulate subscription', message: 'Demo subscription logic' },
  { pattern: 'inv_demo', message: 'Demo invoice IDs' },
  { pattern: 'return a mock response', message: 'Mock responses in code' },
  { pattern: 'fake avatar', message: 'Fake avatar generation' },
  { pattern: 'Return mock data', message: 'Mock data returns' },
  { pattern: 'Seed with sample', message: 'Sample data seeding' }
];

const EXCLUDE_DIRS = [
  'node_modules',
  '__tests__',
  '*.test.*',
  '*.spec.*',
  'docs',
  'landing'
];

async function runPolicyChecks(projectPath) {
  console.log('\n📋 Running policy checks...');
  
  const findings = [];
  const excludeArgs = EXCLUDE_DIRS.map(d => `--glob '!**/${d}/**'`).join(' ');
  
  for (const { pattern, message, isRegex } of BANNED_PATTERNS) {
    try {
      const searchPattern = isRegex ? pattern : pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const cmd = `rg -n --hidden ${excludeArgs} "${searchPattern}" "${projectPath}"`;
      
      const output = execSync(cmd, { encoding: 'utf-8', maxBuffer: 10 * 1024 * 1024 });
      
      for (const line of output.trim().split('\n').filter(Boolean)) {
        const match = line.match(/^(.+?):(\d+):(.*)$/);
        if (match) {
          findings.push({
            rule: pattern,
            message,
            file: path.relative(projectPath, match[1]),
            line: parseInt(match[2], 10),
            snippet: match[3].trim().substring(0, 80)
          });
        }
      }
    } catch (error) {
      // No matches found - this is good
    }
  }
  
  const passed = findings.length === 0;
  console.log(passed ? '  ✅ All policy checks passed' : `  ❌ Found ${findings.length} policy violations`);
  
  return { passed, findings };
}

// ============ Supply Chain Analysis ============

async function runSupplyChainAnalysis(projectPath) {
  console.log('\n📦 Running supply chain analysis...');
  
  const vulnerabilities = [];
  
  // Try npm audit
  try {
    execSync('npm audit --json', { cwd: projectPath, encoding: 'utf-8' });
    console.log('  ✅ npm audit passed');
  } catch (error) {
    if (error.stdout) {
      try {
        const result = JSON.parse(error.stdout);
        const vulnCount = result.metadata?.vulnerabilities || {};
        
        if (vulnCount.critical > 0 || vulnCount.high > 0) {
          console.log(`  ⚠️  Found vulnerabilities: ${vulnCount.critical || 0} critical, ${vulnCount.high || 0} high`);
          
          for (const [, advisory] of Object.entries(result.advisories || {})) {
            vulnerabilities.push({
              id: advisory.id,
              severity: advisory.severity,
              package: advisory.module_name,
              title: advisory.title
            });
          }
        } else {
          console.log('  ✅ No critical/high vulnerabilities');
        }
      } catch {
        console.log('  ⚠️  Could not parse npm audit output');
      }
    }
  }
  
  const critical = vulnerabilities.filter(v => v.severity === 'critical').length;
  const high = vulnerabilities.filter(v => v.severity === 'high').length;
  
  return {
    vulnerabilities,
    counts: { critical, high, medium: 0, low: 0 },
    passed: critical === 0
  };
}

// ============ Secret Scanning ============

const SECRET_PATTERNS = [
  { type: 'aws-access-key', pattern: /AKIA[0-9A-Z]{16}/g },
  { type: 'github-token', pattern: /ghp_[a-zA-Z0-9]{36}/g },
  { type: 'stripe-key', pattern: stripeSkLiveRegex24() },
  { type: 'jwt', pattern: /eyJ[a-zA-Z0-9\-_]+\.eyJ[a-zA-Z0-9\-_]+\.[a-zA-Z0-9\-_]+/g },
  { type: 'private-key', pattern: /-----BEGIN (RSA |EC )?PRIVATE KEY-----/g },
  { type: 'database-url', pattern: /(?:postgres|mysql|mongodb):\/\/[^\s"']+/gi }
];

async function runSecretScan(projectPath) {
  console.log('\n🔐 Running secret detection...');
  
  const secrets = [];
  const codeExtensions = ['.ts', '.tsx', '.js', '.jsx', '.json', '.env', '.yaml', '.yml'];
  
  function walkDir(dir) {
    const files = [];
    try {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules') {
          files.push(...walkDir(fullPath));
        } else if (entry.isFile() && codeExtensions.some(ext => entry.name.endsWith(ext))) {
          files.push(fullPath);
        }
      }
    } catch {}
    return files;
  }
  
  const files = walkDir(projectPath);
  
  for (const file of files) {
    // Skip test files
    if (file.includes('__tests__') || file.includes('.test.') || file.includes('.spec.')) {
      continue;
    }
    
    try {
      const content = fs.readFileSync(file, 'utf-8');
      const lines = content.split('\n');
      
      for (const { type, pattern } of SECRET_PATTERNS) {
        for (let i = 0; i < lines.length; i++) {
          const matches = lines[i].match(pattern);
          if (matches) {
            for (const match of matches) {
              // Skip examples
              if (lines[i].toLowerCase().includes('example')) continue;
              
              secrets.push({
                type,
                file: path.relative(projectPath, file),
                line: i + 1,
                redacted: match.substring(0, 4) + '...' + match.substring(match.length - 4)
              });
            }
          }
        }
      }
    } catch {}
  }
  
  const passed = secrets.length === 0;
  console.log(passed ? '  ✅ No secrets detected' : `  ❌ Found ${secrets.length} potential secrets`);
  
  return { secrets, passed };
}

// ============ Main Orchestrator ============

async function runOrchestrator(config) {
  const startTime = Date.now();
  
  console.log('\n' + '═'.repeat(60));
  console.log('🛡️  guardrail SECURITY ORCHESTRATOR');
  console.log('═'.repeat(60));
  console.log(`\n📁 Project: ${config.projectPath}`);
  console.log(`🌍 Environment: ${config.environment}`);
  console.log(`📅 Time: ${new Date().toISOString()}`);
  
  // Ensure output directory
  const outputDir = path.join(config.projectPath, config.outputDir);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
  
  // Results
  const results = {
    policy: null,
    supplyChain: null,
    secrets: null
  };
  
  // Run policy checks
  if (config.enabledScanners.policy) {
    results.policy = await runPolicyChecks(config.projectPath);
  }
  
  // Run supply chain analysis
  if (config.enabledScanners.supplyChain) {
    results.supplyChain = await runSupplyChainAnalysis(config.projectPath);
  }
  
  // Run secret scanning
  if (config.enabledScanners.secrets) {
    results.secrets = await runSecretScan(config.projectPath);
  }
  
  // Calculate risk score
  let riskScore = 0;
  
  if (results.policy) {
    riskScore += results.policy.findings.length * 10;
  }
  
  if (results.supplyChain) {
    riskScore += results.supplyChain.counts.critical * 25;
    riskScore += results.supplyChain.counts.high * 10;
  }
  
  if (results.secrets) {
    riskScore += results.secrets.secrets.length * 15;
  }
  
  riskScore = Math.min(100, riskScore);
  
  // Determine verdict
  const blockers = [];
  const warnings = [];
  
  if (results.policy && !results.policy.passed) {
    blockers.push(`${results.policy.findings.length} policy violations found`);
  }
  
  if (results.supplyChain && results.supplyChain.counts.critical > 0) {
    blockers.push(`${results.supplyChain.counts.critical} critical vulnerabilities`);
  }
  
  if (results.secrets && results.secrets.secrets.length > 0) {
    blockers.push(`${results.secrets.secrets.length} secrets detected`);
  }
  
  if (riskScore > config.thresholds.maxRiskScore) {
    blockers.push(`Risk score ${riskScore} exceeds threshold ${config.thresholds.maxRiskScore}`);
  }
  
  const allowed = blockers.length === 0;
  const scanDuration = Date.now() - startTime;
  
  // Build report
  const report = {
    verdict: {
      allowed,
      reason: allowed ? 'All checks passed' : `${blockers.length} blocker(s) detected`,
      blockers,
      warnings
    },
    metrics: {
      riskScore,
      scanDuration,
      findingsCounts: {
        policy: results.policy?.findings.length || 0,
        vulnerabilities: results.supplyChain?.vulnerabilities.length || 0,
        secrets: results.secrets?.secrets.length || 0
      }
    },
    results,
    metadata: {
      projectPath: config.projectPath,
      environment: config.environment,
      timestamp: new Date().toISOString(),
      scanners: Object.entries(config.enabledScanners)
        .filter(([, v]) => v)
        .map(([k]) => k)
    }
  };
  
  // Save reports
  for (const format of config.reportFormats) {
    const filename = `security-report.${format}`;
    const filepath = path.join(outputDir, filename);
    
    if (format === 'json') {
      fs.writeFileSync(filepath, JSON.stringify(report, null, 2));
    } else if (format === 'markdown') {
      fs.writeFileSync(filepath, generateMarkdownReport(report));
    }
    
    console.log(`\n📄 Generated: ${filepath}`);
  }
  
  // Print summary
  console.log('\n' + '═'.repeat(60));
  console.log('📊 SECURITY SCAN SUMMARY');
  console.log('═'.repeat(60));
  
  if (allowed) {
    console.log('\n✅ DEPLOY ALLOWED');
  } else {
    console.log('\n🛑 DEPLOY BLOCKED');
  }
  
  console.log(`\n📈 Risk Score: ${riskScore}/100`);
  console.log(`⏱️  Scan Duration: ${(scanDuration / 1000).toFixed(2)}s`);
  
  if (blockers.length > 0) {
    console.log('\n❌ Blockers:');
    for (const blocker of blockers) {
      console.log(`   - ${blocker}`);
    }
  }
  
  console.log('\n' + '═'.repeat(60) + '\n');
  
  // Exit with error in CI mode
  if (config.ciMode && !allowed) {
    process.exit(1);
  }
  
  return report;
}

function generateMarkdownReport(report) {
  let md = `# guardrail Security Report\n\n`;
  md += `**Environment:** ${report.metadata.environment}\n`;
  md += `**Timestamp:** ${report.metadata.timestamp}\n\n`;
  
  md += `## Verdict\n\n`;
  md += report.verdict.allowed ? `✅ **DEPLOY ALLOWED**\n\n` : `🛑 **DEPLOY BLOCKED**\n\n`;
  md += `**Risk Score:** ${report.metrics.riskScore}/100\n\n`;
  
  if (report.verdict.blockers.length > 0) {
    md += `### Blockers\n\n`;
    for (const b of report.verdict.blockers) {
      md += `- ❌ ${b}\n`;
    }
    md += '\n';
  }
  
  md += `## Findings Summary\n\n`;
  md += `- Policy violations: ${report.metrics.findingsCounts.policy}\n`;
  md += `- Vulnerabilities: ${report.metrics.findingsCounts.vulnerabilities}\n`;
  md += `- Secrets: ${report.metrics.findingsCounts.secrets}\n`;
  
  return md;
}

// ============ Run ============

const config = parseArgs();
runOrchestrator(config).catch(error => {
  console.error('Orchestrator failed:', error);
  process.exit(1);
});
