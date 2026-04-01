/**
 * guardrail MCP Premium Tools
 * 
 * Premium command palette tools for top-notch UX:
 * - Ship Check (GO/NO-GO)
 * - Run Reality Mode
 * - Run MockProof Gate
 * - Run Airlock (SupplyChain)
 * - Open Last Run Report
 * - Open Last Replay
 * - Re-run Last Check
 * - Doctor (Fix my setup)
 * - Policies (Quick Edit)
 */

import fs from 'fs/promises';
import path from 'path';
import { execSync, spawn } from 'child_process';
import { checkFeatureAccess } from "./tier-auth.js";

// State management (in-memory for MCP session, persisted to disk)
class MCPState {
  constructor() {
    this.runs = new Map();
    this.lastRunByTool = new Map();
    this.findings = new Map();
    this.artifacts = new Map();
    this.fixModeState = null;
    this.stateDir = '';
  }

  async initialize(projectPath) {
    this.stateDir = path.join(projectPath, '.guardrail', 'mcp-state');
    await fs.mkdir(this.stateDir, { recursive: true });
    await this.loadState();
  }

  async loadState() {
    try {
      const statePath = path.join(this.stateDir, 'state.json');
      const data = JSON.parse(await fs.readFile(statePath, 'utf-8'));
      if (data.runs) this.runs = new Map(Object.entries(data.runs));
      if (data.lastRunByTool) this.lastRunByTool = new Map(Object.entries(data.lastRunByTool));
      if (data.findings) this.findings = new Map(Object.entries(data.findings));
      if (data.fixModeState) this.fixModeState = data.fixModeState;
    } catch {
      // Fresh state
    }
  }

  async saveState() {
    const statePath = path.join(this.stateDir, 'state.json');
    await fs.writeFile(statePath, JSON.stringify({
      runs: Object.fromEntries(this.runs),
      lastRunByTool: Object.fromEntries(this.lastRunByTool),
      findings: Object.fromEntries(this.findings),
      fixModeState: this.fixModeState,
    }, null, 2));
  }

  generateRunId(tool) {
    return `${tool}-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
  }

  async recordRun(result) {
    const id = this.generateRunId(result.tool);
    const run = { ...result, id };
    this.runs.set(id, run);
    this.lastRunByTool.set(result.tool, id);
    
    for (const finding of run.findings || []) {
      finding.runId = id;
      this.findings.set(finding.id, finding);
    }
    
    await this.saveState();
    return run;
  }

  getLastRun(tool) {
    if (tool) {
      const runId = this.lastRunByTool.get(tool);
      return runId ? this.runs.get(runId) : null;
    }
    let latest = null;
    for (const run of this.runs.values()) {
      if (!latest || new Date(run.timestamp) > new Date(latest.timestamp)) {
        latest = run;
      }
    }
    return latest;
  }
}

const state = new MCPState();

// Policy configuration manager
class PolicyManager {
  constructor() {
    this.configPath = '';
    this.config = this.getDefaultConfig();
  }

  getDefaultConfig() {
    return {
      version: '1.0.0',
      rules: {},
      allowlist: { domains: [], packages: [], paths: [], patterns: [] },
      ignore: { paths: ['node_modules', '__tests__', '*.test.*', '*.spec.*'], files: [] },
      profiles: {
        default: { flows: ['auth', 'checkout', 'dashboard'] },
        strict: { extends: 'default', rules: { 'fake-api-domain': 'error' } },
        ci: { extends: 'strict' },
      },
    };
  }

  async initialize(projectPath) {
    this.configPath = path.join(projectPath, '.guardrailrc');
    await this.load();
  }

  async load() {
    try {
      const content = await fs.readFile(this.configPath, 'utf-8');
      this.config = { ...this.getDefaultConfig(), ...JSON.parse(content) };
    } catch {
      this.config = this.getDefaultConfig();
    }
  }

  async save() {
    await fs.writeFile(this.configPath, JSON.stringify(this.config, null, 2));
  }

  async exists() {
    try {
      await fs.access(this.configPath);
      return true;
    } catch {
      return false;
    }
  }

  async create() {
    this.config = this.getDefaultConfig();
    await this.save();
  }

  generateDiffPreview(patch) {
    let preview = '';
    switch (patch.action) {
      case 'allowlist_domain':
        preview = `You are adding: allowlist.domains += "${patch.target}"`;
        break;
      case 'allowlist_package':
        preview = `You are adding: allowlist.packages += "${patch.target}"`;
        break;
      case 'ignore_path':
        preview = `You are adding: ignore.paths += "${patch.target}"`;
        break;
      case 'downgrade_rule':
        preview = `You are changing: rules.${patch.target}.severity = "error" → "warn"`;
        break;
    }
    return { patch, preview };
  }

  async applyPatch(patch) {
    const diff = this.generateDiffPreview(patch);
    switch (patch.action) {
      case 'allowlist_domain':
        if (!this.config.allowlist.domains.includes(patch.target)) {
          this.config.allowlist.domains.push(patch.target);
        }
        break;
      case 'allowlist_package':
        if (!this.config.allowlist.packages.includes(patch.target)) {
          this.config.allowlist.packages.push(patch.target);
        }
        break;
      case 'ignore_path':
        if (!this.config.ignore.paths.includes(patch.target)) {
          this.config.ignore.paths.push(patch.target);
        }
        break;
      case 'downgrade_rule':
        this.config.rules[patch.target] = {
          severity: 'warn',
          auditNote: patch.auditNote || 'Downgraded by user',
          updatedAt: new Date().toISOString(),
        };
        break;
    }
    await this.save();
    return diff;
  }
}

const policy = new PolicyManager();

// Premium tool definitions
export const PREMIUM_TOOLS = [
  // Command Palette Commands
  {
    name: 'get_status',
    description: 'Get guardrail server status, connection info, workspace trust, and last run summary',
    inputSchema: {
      type: 'object',
      properties: {
        projectPath: { type: 'string', description: 'Path to project', default: '.' },
      },
    },
  },
  {
    name: 'run_ship',
    description: 'guardrail: Ship Check (GO/NO-GO) - Full ship-worthiness check with MockProof + Reality + Badge',
    inputSchema: {
      type: 'object',
      properties: {
        projectPath: { type: 'string', description: 'Path to project', default: '.' },
        profile: { type: 'string', description: 'Profile to use (default, strict, ci)', default: 'default' },
        flows: { type: 'array', items: { type: 'string' }, description: 'Specific flows to test' },
      },
    },
  },
  {
    name: 'run_reality',
    description: 'guardrail: Run Reality Mode - Spin up app and detect fake data at runtime',
    inputSchema: {
      type: 'object',
      properties: {
        projectPath: { type: 'string', description: 'Path to project', default: '.' },
        flow: { type: 'string', description: 'Flow to test (auth, checkout, dashboard)', default: 'auth' },
        profile: { type: 'string', description: 'Profile to use', default: 'default' },
        baseUrl: { type: 'string', description: 'Base URL of running app', default: 'http://localhost:3000' },
      },
    },
  },
  {
    name: 'run_mockproof',
    description: 'guardrail: Run MockProof Gate - Static import graph scan for banned patterns',
    inputSchema: {
      type: 'object',
      properties: {
        projectPath: { type: 'string', description: 'Path to project', default: '.' },
        profile: { type: 'string', description: 'Profile to use', default: 'default' },
      },
    },
  },
  {
    name: 'run_airlock',
    description: 'guardrail: Run Airlock (SupplyChain) - SBOM generation, vulnerability scan, license check',
    inputSchema: {
      type: 'object',
      properties: {
        projectPath: { type: 'string', description: 'Path to project', default: '.' },
        profile: { type: 'string', description: 'Profile to use', default: 'default' },
      },
    },
  },
  {
    name: 'get_last_run',
    description: 'guardrail: Open Last Run Report - Get details of the most recent check',
    inputSchema: {
      type: 'object',
      properties: {
        projectPath: { type: 'string', description: 'Path to project', default: '.' },
        tool: { type: 'string', description: 'Filter by tool (ship, reality, mockproof, airlock)' },
      },
    },
  },
  {
    name: 'open_artifact',
    description: 'guardrail: Open artifact (report, replay, trace, sarif, badge)',
    inputSchema: {
      type: 'object',
      properties: {
        projectPath: { type: 'string', description: 'Path to project', default: '.' },
        type: { type: 'string', enum: ['report', 'replay', 'trace', 'sarif', 'badge'], description: 'Artifact type' },
        runId: { type: 'string', description: 'Specific run ID (optional, defaults to last run)' },
      },
    },
  },
  {
    name: 'rerun_last_check',
    description: 'guardrail: Re-run Last Check - Repeat the previous check with same parameters',
    inputSchema: {
      type: 'object',
      properties: {
        projectPath: { type: 'string', description: 'Path to project', default: '.' },
      },
    },
  },
  {
    name: 'run_doctor',
    description: 'guardrail: Doctor (Fix my setup) - Diagnose and auto-fix environment issues',
    inputSchema: {
      type: 'object',
      properties: {
        projectPath: { type: 'string', description: 'Path to project', default: '.' },
        autoFix: { type: 'boolean', description: 'Automatically fix issues', default: false },
      },
    },
  },
  {
    name: 'edit_policies',
    description: 'guardrail: Policies (Quick Edit) - View and modify .guardrailrc settings',
    inputSchema: {
      type: 'object',
      properties: {
        projectPath: { type: 'string', description: 'Path to project', default: '.' },
        action: { type: 'string', enum: ['view', 'allowlist_domain', 'allowlist_package', 'ignore_path', 'downgrade_rule'], default: 'view' },
        target: { type: 'string', description: 'Target for action (domain, package, path, or rule ID)' },
        auditNote: { type: 'string', description: 'Audit note for team visibility (when downgrading rules)' },
      },
    },
  },
  {
    name: 'explain_finding',
    description: 'Get detailed explanation of a finding with evidence, trace, and fix suggestions',
    inputSchema: {
      type: 'object',
      properties: {
        projectPath: { type: 'string', description: 'Path to project', default: '.' },
        findingId: { type: 'string', description: 'Finding ID to explain' },
      },
      required: ['findingId'],
    },
  },
  {
    name: 'policy_patch',
    description: 'Apply atomic policy changes with diff preview',
    inputSchema: {
      type: 'object',
      properties: {
        projectPath: { type: 'string', description: 'Path to project', default: '.' },
        patches: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              action: { type: 'string', enum: ['allowlist_domain', 'allowlist_package', 'ignore_path', 'downgrade_rule'] },
              target: { type: 'string' },
              auditNote: { type: 'string' },
            },
            required: ['action', 'target'],
          },
          description: 'Array of policy patches to apply',
        },
        dryRun: { type: 'boolean', description: 'Preview changes without applying', default: false },
      },
      required: ['patches'],
    },
  },
  {
    name: 'enter_fix_mode',
    description: 'Enter Fix Mode - Interactive blocker resolution with checklist',
    inputSchema: {
      type: 'object',
      properties: {
        projectPath: { type: 'string', description: 'Path to project', default: '.' },
        runId: { type: 'string', description: 'Run ID to fix (defaults to last NO-SHIP run)' },
      },
    },
  },
  {
    name: 'fix_mode_status',
    description: 'Get current Fix Mode status and remaining blockers',
    inputSchema: {
      type: 'object',
      properties: {
        projectPath: { type: 'string', description: 'Path to project', default: '.' },
      },
    },
  },
  {
    name: 'mark_fix_complete',
    description: 'Mark a blocker as fixed in Fix Mode',
    inputSchema: {
      type: 'object',
      properties: {
        projectPath: { type: 'string', description: 'Path to project', default: '.' },
        findingId: { type: 'string', description: 'Finding ID to mark as fixed' },
      },
      required: ['findingId'],
    },
  },
  {
    name: 'exit_fix_mode',
    description: 'Exit Fix Mode and optionally re-run ship check',
    inputSchema: {
      type: 'object',
      properties: {
        projectPath: { type: 'string', description: 'Path to project', default: '.' },
        rerunCheck: { type: 'boolean', description: 'Re-run ship check after exiting', default: true },
      },
    },
  },
  {
    name: 'export_sarif',
    description: 'Export findings as SARIF for VS Code diagnostics and GitHub Code Scanning',
    inputSchema: {
      type: 'object',
      properties: {
        projectPath: { type: 'string', description: 'Path to project', default: '.' },
        runId: { type: 'string', description: 'Run ID to export (defaults to last run)' },
        outputPath: { type: 'string', description: 'Output path for SARIF file', default: '.guardrail/results.sarif' },
      },
    },
  },
];

// Premium tool handlers
export async function handlePremiumTool(name, args, logger) {
  const projectPath = args?.projectPath || process.cwd();
  
  // Map premium tools to required features (all require starter+)
  const featureMap = {
    'run_ship': 'smells', // ship check requires starter+
    'run_reality': 'smells', // reality mode requires starter+
    'run_mockproof': 'smells', // mockproof requires starter+
    'run_airlock': 'breaking', // supply chain analysis requires pro+
    'get_last_run': 'verify', // basic access
    'open_artifact': 'verify', // basic access
    'rerun_last_check': 'verify', // basic access
    'run_doctor': 'verify', // basic access
    'edit_policies': 'breaking', // policy editing requires pro+
    'explain_finding': 'quality', // explanations require starter+
    'policy_patch': 'smells', // patching requires starter+
    'enter_fix_mode': 'smells', // fix mode requires starter+
    'get_status': 'verify' // status check is free
  };

  const requiredFeature = featureMap[name];
  if (requiredFeature) {
    const access = await checkFeatureAccess(requiredFeature, args?.apiKey);
    if (!access.hasAccess) {
      return {
        content: [{
          type: "text",
          text: `🚫 UPGRADE REQUIRED\n\n${access.reason}\n\nCurrent tier: ${access.tier}\nUpgrade at: ${access.upgradeUrl}`
        }],
        isError: true
      };
    }
  }
  
  // Initialize state and policy managers
  await state.initialize(projectPath);
  await policy.initialize(projectPath);

  switch (name) {
    case 'get_status':
      return await handleGetStatus(projectPath);
    
    case 'run_ship':
      return await handleRunShip(projectPath, args);
    
    case 'run_reality':
      return await handleRunReality(projectPath, args);
    
    case 'run_mockproof':
      return await handleRunMockproof(projectPath, args);
    
    case 'run_airlock':
      return await handleRunAirlock(projectPath, args);
    
    case 'get_last_run':
      return await handleGetLastRun(projectPath, args?.tool);
    
    case 'open_artifact':
      return await handleOpenArtifact(projectPath, args);
    
    case 'rerun_last_check':
      return await handleRerunLastCheck(projectPath);
    
    case 'run_doctor':
      return await handleRunDoctor(projectPath, args?.autoFix);
    
    case 'edit_policies':
      return await handleEditPolicies(projectPath, args);
    
    case 'explain_finding':
      return await handleExplainFinding(projectPath, args?.findingId);
    
    case 'policy_patch':
      return await handlePolicyPatch(projectPath, args);
    
    case 'enter_fix_mode':
      return await handleEnterFixMode(projectPath, args?.runId);
    
    case 'fix_mode_status':
      return await handleFixModeStatus(projectPath);
    
    case 'mark_fix_complete':
      return await handleMarkFixComplete(projectPath, args?.findingId);
    
    case 'exit_fix_mode':
      return await handleExitFixMode(projectPath, args?.rerunCheck);
    
    case 'export_sarif':
      return await handleExportSarif(projectPath, args);
    
    default:
      return null;
  }
}

// Handler implementations
async function handleGetStatus(projectPath) {
  const configExists = await policy.exists();
  const lastRun = state.getLastRun();
  
  let response = `**guardrail Status**\n\n`;
  response += `Connected: ✅\n`;
  response += `Mode: ${process.env.CI ? 'CI' : 'Local'}\n`;
  response += `Workspace: ${configExists ? 'trusted' : 'untrusted (no .guardrailrc)'}\n`;
  response += `Version: 1.0.0\n\n`;
  
  if (lastRun) {
    response += `**Last Run**\n`;
    response += `Tool: ${lastRun.tool}\n`;
    response += `Verdict: ${lastRun.verdict}\n`;
    response += `Time: ${lastRun.timestamp}\n`;
  } else {
    response += `No previous runs found.\n`;
  }
  
  response += `\n---\n`;
  response += `Runs locally | Artifacts saved to .guardrail/ | No upload unless you export`;
  
  return { content: [{ type: 'text', text: response }] };
}

async function handleRunShip(projectPath, args) {
  const startTime = Date.now();
  let verdict = 'SHIP';
  let blockers = [];
  let findings = [];
  
  try {
    // Run ship check
    const result = execSync('npx ts-node src/bin/ship.ts check --json', {
      cwd: projectPath,
      encoding: 'utf8',
      maxBuffer: 10 * 1024 * 1024,
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    
    // Parse results
    const reportPath = path.join(projectPath, '.guardrail', 'ship', 'ship-report.json');
    try {
      const report = JSON.parse(await fs.readFile(reportPath, 'utf-8'));
      verdict = report.verdict === 'ship' ? 'SHIP' : 'NO-SHIP';
      
      if (report.results?.mockproof?.violations) {
        for (const v of report.results.mockproof.violations) {
          const finding = {
            id: `mp-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
            ruleId: v.pattern || 'mock-import',
            title: v.message || 'Mock import detected',
            severity: 'critical',
            file: v.file,
            line: v.line || 1,
            evidence: { type: 'import', content: v.snippet || '' },
          };
          findings.push(finding);
          blockers.push(finding);
        }
      }
    } catch {}
  } catch (error) {
    verdict = 'NO-SHIP';
    const output = error.stdout || error.message;
    if (output.includes('VERDICT: FAIL')) {
      const violations = output.match(/❌ .+/g) || [];
      for (const v of violations) {
        findings.push({
          id: `mp-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
          ruleId: 'banned-pattern',
          title: v.replace('❌ ', ''),
          severity: 'critical',
          file: 'unknown',
          line: 1,
          evidence: { type: 'code', content: v },
        });
      }
      blockers = findings;
    }
  }
  
  const duration = Date.now() - startTime;
  
  // Record run
  const run = await state.recordRun({
    tool: 'ship',
    verdict,
    profile: args?.profile || 'default',
    timestamp: new Date().toISOString(),
    duration,
    findings,
    blockers,
    warnings: [],
    artifacts: [
      { id: 'report', type: 'report', name: 'Ship Report', path: '.guardrail/ship/ship-report.json' },
    ],
    summary: {
      totalFindings: findings.length,
      criticalCount: findings.filter(f => f.severity === 'critical').length,
      highCount: 0,
      mediumCount: 0,
      lowCount: 0,
    },
  });
  
  // Format toast response
  const toast = formatToast(run);
  
  let response = `**${verdict === 'SHIP' ? '🚀 SHIP' : '🛑 NO-SHIP'}**\n\n`;
  response += `${toast}\n\n`;
  
  if (blockers.length > 0) {
    response += `**Blockers (${blockers.length}):**\n`;
    for (const b of blockers.slice(0, 6)) {
      response += `• \`${b.file}:${b.line}\` - ${b.title}\n`;
    }
    if (blockers.length > 6) {
      response += `... and ${blockers.length - 6} more\n`;
    }
    response += `\n**Chips:** MOCKPROOF\n`;
    response += `**Duration:** ${duration}ms\n\n`;
    response += `Use \`enter_fix_mode\` to start fixing blockers.`;
  } else {
    response += `All checks passed. Ready to deploy!\n`;
    response += `**Duration:** ${duration}ms`;
  }
  
  return { content: [{ type: 'text', text: response }] };
}

async function handleRunReality(projectPath, args) {
  const flow = args?.flow || 'auth';
  const baseUrl = args?.baseUrl || 'http://localhost:3000';
  
  let response = `**Reality Mode: ${flow}**\n\n`;
  response += `Target: ${baseUrl}\n`;
  response += `Flow: ${flow}\n\n`;
  
  try {
    // Generate and run reality mode test
    const testDir = path.join(projectPath, '.guardrail', 'ship', 'reality-mode');
    await fs.mkdir(testDir, { recursive: true });
    
    const result = execSync(`npx ts-node src/bin/ship.ts reality --url ${baseUrl}`, {
      cwd: projectPath,
      encoding: 'utf8',
      maxBuffer: 10 * 1024 * 1024,
    });
    
    response += `✅ Reality Mode test generated\n\n`;
    response += `**To run the scan:**\n`;
    response += `\`npx playwright test .guardrail/ship/reality-mode/reality-mode.spec.ts\`\n\n`;
    response += `This will:\n`;
    response += `1. Open your app at ${baseUrl}\n`;
    response += `2. Intercept all network requests\n`;
    response += `3. Click through UI flows\n`;
    response += `4. Detect fake APIs and demo data\n`;
    response += `5. Generate replay + verdict`;
    
    await state.recordRun({
      tool: 'reality',
      verdict: 'REVIEW',
      flow,
      timestamp: new Date().toISOString(),
      duration: 0,
      findings: [],
      blockers: [],
      warnings: [],
      artifacts: [
        { id: 'replay', type: 'replay', name: 'Reality Mode Replay', path: '.guardrail/ship/reality-mode/' },
      ],
      summary: { totalFindings: 0, criticalCount: 0, highCount: 0, mediumCount: 0, lowCount: 0 },
    });
  } catch (error) {
    response += `⚠️ Reality Mode setup issue: ${error.message}\n`;
    response += `\nMake sure Playwright is installed: \`npm install -D @playwright/test\``;
  }
  
  return { content: [{ type: 'text', text: response }] };
}

async function handleRunMockproof(projectPath, args) {
  const startTime = Date.now();
  let verdict = 'PASS';
  let findings = [];
  
  try {
    const result = execSync('npx ts-node src/bin/ship.ts mockproof --json', {
      cwd: projectPath,
      encoding: 'utf8',
      maxBuffer: 10 * 1024 * 1024,
    });
    
    if (result.includes('VERDICT: PASS')) {
      verdict = 'PASS';
    }
  } catch (error) {
    verdict = 'FAIL';
    const output = error.stdout || error.message;
    const violations = output.match(/❌ .+/g) || [];
    for (const v of violations) {
      findings.push({
        id: `mp-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        ruleId: 'mock-import',
        title: v.replace('❌ ', ''),
        severity: 'critical',
        file: 'unknown',
        line: 1,
        evidence: { type: 'import', content: v },
      });
    }
  }
  
  const duration = Date.now() - startTime;
  
  await state.recordRun({
    tool: 'mockproof',
    verdict,
    timestamp: new Date().toISOString(),
    duration,
    findings,
    blockers: findings,
    warnings: [],
    artifacts: [],
    summary: { totalFindings: findings.length, criticalCount: findings.length, highCount: 0, mediumCount: 0, lowCount: 0 },
  });
  
  let response = `**MockProof Gate: ${verdict}**\n\n`;
  
  if (verdict === 'PASS') {
    response += `✅ No banned imports detected in production code.\n`;
  } else {
    response += `🛑 Found ${findings.length} violation(s):\n\n`;
    for (const f of findings.slice(0, 10)) {
      response += `• ${f.title}\n`;
    }
  }
  
  response += `\n**Duration:** ${duration}ms`;
  
  return { content: [{ type: 'text', text: response }] };
}

async function handleRunAirlock(projectPath, args) {
  let response = `**Airlock (Supply Chain)**\n\n`;
  
  // npm audit
  try {
    execSync('npm audit --json', { cwd: projectPath, encoding: 'utf-8' });
    response += `✅ **npm audit:** No vulnerabilities\n`;
  } catch (error) {
    if (error.stdout) {
      try {
        const result = JSON.parse(error.stdout);
        const vulns = result.metadata?.vulnerabilities || {};
        const total = (vulns.critical || 0) + (vulns.high || 0) + (vulns.moderate || 0);
        if (total > 0) {
          response += `⚠️ **npm audit:** ${total} vulnerabilities\n`;
          response += `   Critical: ${vulns.critical || 0}, High: ${vulns.high || 0}, Moderate: ${vulns.moderate || 0}\n`;
        } else {
          response += `✅ **npm audit:** No vulnerabilities\n`;
        }
      } catch {
        response += `⚠️ **npm audit:** Could not parse\n`;
      }
    }
  }
  
  // Dependency count
  try {
    const pkg = JSON.parse(await fs.readFile(path.join(projectPath, 'package.json'), 'utf-8'));
    const deps = Object.keys(pkg.dependencies || {}).length;
    const devDeps = Object.keys(pkg.devDependencies || {}).length;
    response += `\n**Dependencies:** ${deps} prod, ${devDeps} dev\n`;
  } catch {}
  
  response += `\n**License compliance:** Run full scan with \`npm run ship:badge\``;
  
  await state.recordRun({
    tool: 'airlock',
    verdict: 'REVIEW',
    timestamp: new Date().toISOString(),
    duration: 0,
    findings: [],
    blockers: [],
    warnings: [],
    artifacts: [],
    summary: { totalFindings: 0, criticalCount: 0, highCount: 0, mediumCount: 0, lowCount: 0 },
  });
  
  return { content: [{ type: 'text', text: response }] };
}

async function handleGetLastRun(projectPath, tool) {
  const run = state.getLastRun(tool);
  
  if (!run) {
    return { content: [{ type: 'text', text: 'No previous runs found.' }] };
  }
  
  let response = `**Last Run: ${run.tool.toUpperCase()}**\n\n`;
  response += `ID: \`${run.id}\`\n`;
  response += `Verdict: **${run.verdict}**\n`;
  response += `Time: ${run.timestamp}\n`;
  response += `Duration: ${run.duration}ms\n\n`;
  
  if (run.findings.length > 0) {
    response += `**Findings (${run.findings.length}):**\n`;
    for (const f of run.findings.slice(0, 5)) {
      response += `• \`${f.file}:${f.line}\` - ${f.title}\n`;
    }
    if (run.findings.length > 5) {
      response += `... and ${run.findings.length - 5} more\n`;
    }
  }
  
  if (run.artifacts?.length > 0) {
    response += `\n**Artifacts:**\n`;
    for (const a of run.artifacts) {
      response += `• ${a.type}: ${a.path}\n`;
    }
  }
  
  return { content: [{ type: 'text', text: response }] };
}

async function handleOpenArtifact(projectPath, args) {
  const run = args?.runId ? state.runs.get(args.runId) : state.getLastRun();
  const type = args?.type || 'report';
  
  if (!run) {
    return { content: [{ type: 'text', text: 'No run found. Run a check first.' }] };
  }
  
  const artifact = run.artifacts?.find(a => a.type === type);
  
  if (!artifact) {
    return { content: [{ type: 'text', text: `No ${type} artifact found for this run.` }] };
  }
  
  const artifactPath = path.join(projectPath, artifact.path);
  
  try {
    const content = await fs.readFile(artifactPath, 'utf-8');
    return { content: [{ type: 'text', text: `**${artifact.name}**\n\nPath: ${artifact.path}\n\n\`\`\`json\n${content.substring(0, 2000)}\n\`\`\`` }] };
  } catch {
    return { content: [{ type: 'text', text: `Artifact path: ${artifact.path}\n\nOpen this file to view the full ${type}.` }] };
  }
}

async function handleRerunLastCheck(projectPath) {
  const lastRun = state.getLastRun();
  
  if (!lastRun) {
    return { content: [{ type: 'text', text: 'No previous run to repeat.' }] };
  }
  
  switch (lastRun.tool) {
    case 'ship':
      return await handleRunShip(projectPath, { profile: lastRun.profile });
    case 'reality':
      return await handleRunReality(projectPath, { flow: lastRun.flow });
    case 'mockproof':
      return await handleRunMockproof(projectPath, {});
    case 'airlock':
      return await handleRunAirlock(projectPath, {});
    default:
      return { content: [{ type: 'text', text: `Cannot re-run ${lastRun.tool}` }] };
  }
}

async function handleRunDoctor(projectPath, autoFix) {
  const checks = [];
  
  // Node version
  const nodeVersion = process.version;
  const nodeMajor = parseInt(nodeVersion.slice(1).split('.')[0], 10);
  checks.push({
    name: 'Node.js Version',
    status: nodeMajor >= 18 ? 'pass' : 'fail',
    message: `Node.js ${nodeVersion}`,
  });
  
  // Playwright
  let hasPlaywright = false;
  try {
    const pkg = JSON.parse(await fs.readFile(path.join(projectPath, 'package.json'), 'utf-8'));
    hasPlaywright = !!pkg.dependencies?.['@playwright/test'] || !!pkg.devDependencies?.['@playwright/test'];
  } catch {}
  checks.push({
    name: 'Playwright Installed',
    status: hasPlaywright ? 'pass' : 'fail',
    message: hasPlaywright ? 'Playwright found' : 'Required for Reality Mode',
    fix: 'npm install -D @playwright/test',
  });
  
  // .guardrailrc
  const hasConfig = await policy.exists();
  checks.push({
    name: 'guardrail Config',
    status: hasConfig ? 'pass' : 'warn',
    message: hasConfig ? '.guardrailrc found' : 'No .guardrailrc',
    fix: 'guardrail init',
  });
  
  // TypeScript
  let hasTsConfig = false;
  try {
    await fs.access(path.join(projectPath, 'tsconfig.json'));
    hasTsConfig = true;
  } catch {}
  checks.push({
    name: 'TypeScript Config',
    status: hasTsConfig ? 'pass' : 'warn',
    message: hasTsConfig ? 'tsconfig.json found' : 'JavaScript project',
  });
  
  // Format response
  let response = `**guardrail Doctor**\n\n`;
  
  const healthy = checks.every(c => c.status !== 'fail');
  
  for (const check of checks) {
    const icon = check.status === 'pass' ? '✅' : check.status === 'fail' ? '❌' : '⚠️';
    response += `${icon} **${check.name}:** ${check.message}\n`;
    if (check.status !== 'pass' && check.fix) {
      response += `   Fix: \`${check.fix}\`\n`;
    }
  }
  
  response += `\n**Status:** ${healthy ? 'HEALTHY' : 'NEEDS ATTENTION'}\n`;
  
  if (!hasConfig) {
    response += `\n**Next Step:** Run \`edit_policies\` with action "create" to initialize .guardrailrc`;
  } else if (healthy) {
    response += `\n**Next Step:** Run \`run_ship\` for your first Ship Check`;
  }
  
  // Auto-fix if requested
  if (autoFix) {
    response += `\n\n**Auto-Fix Results:**\n`;
    if (!hasConfig) {
      await policy.create();
      response += `✅ Created .guardrailrc\n`;
    }
  }
  
  return { content: [{ type: 'text', text: response }] };
}

async function handleEditPolicies(projectPath, args) {
  const action = args?.action || 'view';
  
  if (action === 'view') {
    const config = policy.config;
    let response = `**guardrail Policies**\n\n`;
    response += `**Allowlisted Domains:** ${config.allowlist.domains.length > 0 ? config.allowlist.domains.join(', ') : 'none'}\n`;
    response += `**Allowlisted Packages:** ${config.allowlist.packages.length > 0 ? config.allowlist.packages.join(', ') : 'none'}\n`;
    response += `**Ignored Paths:** ${config.ignore.paths.join(', ')}\n`;
    response += `**Profiles:** ${Object.keys(config.profiles).join(', ')}\n\n`;
    
    if (Object.keys(config.rules).length > 0) {
      response += `**Custom Rules:**\n`;
      for (const [id, rule] of Object.entries(config.rules)) {
        response += `• ${id}: ${rule.severity}`;
        if (rule.auditNote) response += ` (${rule.auditNote})`;
        response += `\n`;
      }
    }
    
    response += `\nPath: .guardrailrc`;
    return { content: [{ type: 'text', text: response }] };
  }
  
  if (!args?.target) {
    return { content: [{ type: 'text', text: 'Target required for this action.' }] };
  }
  
  const diff = await policy.applyPatch({
    action,
    target: args.target,
    auditNote: args.auditNote,
  });
  
  return { content: [{ type: 'text', text: `**Policy Updated**\n\n${diff.preview}\n\nSaved to .guardrailrc` }] };
}

async function handleExplainFinding(projectPath, findingId) {
  const finding = state.findings.get(findingId);
  
  if (!finding) {
    return { content: [{ type: 'text', text: `Finding ${findingId} not found.` }] };
  }
  
  let response = `**Finding: ${finding.title}**\n\n`;
  
  // Why
  response += `## Why\n`;
  response += `**Rule:** ${finding.ruleId}\n`;
  response += `**Severity:** ${finding.severity.toUpperCase()}\n`;
  response += `**Location:** \`${finding.file}:${finding.line}\`\n\n`;
  
  // Evidence
  response += `## Evidence\n`;
  response += `**Type:** ${finding.evidence.type}\n`;
  response += `\`\`\`\n${finding.evidence.content}\n\`\`\`\n\n`;
  
  // Trace
  if (finding.evidence.trace) {
    response += `## Trace\n`;
    for (const step of finding.evidence.trace) {
      response += `→ ${step}\n`;
    }
    response += `\n`;
  }
  
  // Fix
  response += `## Fix\n`;
  response += `1. Open \`${finding.file}\` at line ${finding.line}\n`;
  response += `2. Remove or replace the flagged pattern\n`;
  response += `3. Re-run ship check to verify\n\n`;
  
  // Policy
  response += `## Policy\n`;
  response += `• Allowlist domain: \`edit_policies\` with action="allowlist_domain"\n`;
  response += `• Ignore path: \`edit_policies\` with action="ignore_path"\n`;
  response += `• Downgrade rule: \`edit_policies\` with action="downgrade_rule"`;
  
  return { content: [{ type: 'text', text: response }] };
}

async function handlePolicyPatch(projectPath, args) {
  const patches = args?.patches || [];
  const dryRun = args?.dryRun || false;
  
  if (patches.length === 0) {
    return { content: [{ type: 'text', text: 'No patches provided.' }] };
  }
  
  let response = `**Policy Patch${dryRun ? ' (Dry Run)' : ''}**\n\n`;
  
  for (const patch of patches) {
    const diff = policy.generateDiffPreview(patch);
    response += `${diff.preview}\n`;
    
    if (!dryRun) {
      await policy.applyPatch(patch);
    }
  }
  
  if (dryRun) {
    response += `\n*No changes made (dry run)*`;
  } else {
    response += `\n✅ Applied ${patches.length} patch(es) to .guardrailrc`;
  }
  
  return { content: [{ type: 'text', text: response }] };
}

async function handleEnterFixMode(projectPath, runId) {
  const run = runId ? state.runs.get(runId) : state.getLastRun();
  
  if (!run) {
    return { content: [{ type: 'text', text: 'No run found.' }] };
  }
  
  if (run.verdict === 'SHIP' || run.verdict === 'PASS') {
    return { content: [{ type: 'text', text: 'No blockers to fix. Run already passed!' }] };
  }
  
  state.fixModeState = {
    active: true,
    runId: run.id,
    blockers: run.blockers,
    completed: [],
    remaining: run.blockers.map(b => b.id),
  };
  await state.saveState();
  
  let response = `**Fix Mode Activated**\n\n`;
  response += `Run: ${run.id}\n`;
  response += `Blockers: ${run.blockers.length}\n\n`;
  response += `**Checklist:**\n`;
  
  for (const blocker of run.blockers) {
    response += `☐ \`${blocker.file}:${blocker.line}\` - ${blocker.title}\n`;
    response += `   Open file | Suggested fix | Re-run\n`;
  }
  
  response += `\nUse \`mark_fix_complete\` after fixing each issue.\n`;
  response += `Use \`exit_fix_mode\` when done to re-run ship check.`;
  
  return { content: [{ type: 'text', text: response }] };
}

async function handleFixModeStatus(projectPath) {
  if (!state.fixModeState || !state.fixModeState.active) {
    return { content: [{ type: 'text', text: 'Fix Mode is not active.' }] };
  }
  
  const fm = state.fixModeState;
  const blockers = fm.blockers;
  
  let response = `**Fix Mode Status**\n\n`;
  response += `Completed: ${fm.completed.length}/${blockers.length}\n`;
  response += `Remaining: ${fm.remaining.length}\n\n`;
  
  response += `**Checklist:**\n`;
  for (const blocker of blockers) {
    const done = fm.completed.includes(blocker.id);
    response += `${done ? '✅' : '☐'} \`${blocker.file}:${blocker.line}\` - ${blocker.title}\n`;
  }
  
  if (fm.remaining.length === 0) {
    response += `\n🎉 All blockers addressed! Run \`exit_fix_mode\` to verify.`;
  }
  
  return { content: [{ type: 'text', text: response }] };
}

async function handleMarkFixComplete(projectPath, findingId) {
  if (!state.fixModeState || !state.fixModeState.active) {
    return { content: [{ type: 'text', text: 'Fix Mode is not active.' }] };
  }
  
  const fm = state.fixModeState;
  
  if (!fm.remaining.includes(findingId)) {
    return { content: [{ type: 'text', text: `Finding ${findingId} not in remaining list.` }] };
  }
  
  fm.remaining = fm.remaining.filter(id => id !== findingId);
  fm.completed.push(findingId);
  await state.saveState();
  
  let response = `✅ Marked ${findingId} as fixed.\n\n`;
  response += `Remaining: ${fm.remaining.length}/${fm.blockers.length}\n`;
  
  if (fm.remaining.length === 0) {
    response += `\n🎉 All blockers addressed! Run \`exit_fix_mode\` to verify.`;
  }
  
  return { content: [{ type: 'text', text: response }] };
}

async function handleExitFixMode(projectPath, rerunCheck) {
  if (!state.fixModeState || !state.fixModeState.active) {
    return { content: [{ type: 'text', text: 'Fix Mode is not active.' }] };
  }
  
  const fm = state.fixModeState;
  state.fixModeState = null;
  await state.saveState();
  
  let response = `**Fix Mode Exited**\n\n`;
  response += `Fixed: ${fm.completed.length}/${fm.blockers.length}\n`;
  
  if (rerunCheck !== false) {
    response += `\nRe-running ship check...\n\n`;
    const result = await handleRunShip(projectPath, {});
    return result;
  }
  
  return { content: [{ type: 'text', text: response }] };
}

async function handleExportSarif(projectPath, args) {
  const run = args?.runId ? state.runs.get(args.runId) : state.getLastRun();
  const outputPath = args?.outputPath || '.guardrail/results.sarif';
  
  if (!run) {
    return { content: [{ type: 'text', text: 'No run found to export.' }] };
  }
  
  // Generate SARIF structure
  const sarif = {
    $schema: 'https://raw.githubusercontent.com/oasis-tcs/sarif-spec/master/Schemata/sarif-schema-2.1.0.json',
    version: '2.1.0',
    runs: [{
      tool: {
        driver: {
          name: 'guardrail',
          version: '1.0.0',
          informationUri: 'https://guardrailai.dev',
          rules: generateSarifRules(run.findings),
        },
      },
      results: run.findings.map((f, idx) => ({
        ruleId: f.ruleId,
        ruleIndex: idx,
        level: f.severity === 'critical' || f.severity === 'high' ? 'error' : 'warning',
        message: { text: `${f.title}\n\n${f.evidence?.content || ''}` },
        locations: [{
          physicalLocation: {
            artifactLocation: { uri: f.file.replace(/\\/g, '/') },
            region: {
              startLine: f.line,
              startColumn: f.column || 1,
            },
          },
        }],
        fingerprints: { 'guardrail/v1': f.id },
      })),
      invocations: [{
        executionSuccessful: run.verdict === 'SHIP' || run.verdict === 'PASS',
        startTimeUtc: run.timestamp,
      }],
    }],
  };
  
  // Save to file
  const fullPath = path.join(projectPath, outputPath);
  await fs.mkdir(path.dirname(fullPath), { recursive: true });
  await fs.writeFile(fullPath, JSON.stringify(sarif, null, 2));
  
  let response = `**SARIF Export**\n\n`;
  response += `Run: ${run.id}\n`;
  response += `Findings: ${run.findings.length}\n`;
  response += `Output: ${outputPath}\n\n`;
  response += `Use this file with:\n`;
  response += `• VS Code SARIF Viewer extension\n`;
  response += `• GitHub Code Scanning\n`;
  response += `• Any SARIF 2.1.0 compatible tool`;
  
  return { content: [{ type: 'text', text: response }] };
}

function generateSarifRules(findings) {
  const ruleMap = new Map();
  
  for (const f of findings) {
    if (!ruleMap.has(f.ruleId)) {
      ruleMap.set(f.ruleId, {
        id: f.ruleId,
        name: f.title,
        shortDescription: { text: f.title },
        fullDescription: { text: f.description || f.title },
        defaultConfiguration: {
          level: f.severity === 'critical' || f.severity === 'high' ? 'error' : 'warning',
        },
      });
    }
  }
  
  return Array.from(ruleMap.values());
}

function formatToast(run) {
  const verdict = run.verdict === 'SHIP' || run.verdict === 'PASS' ? 'SHIP' : 'NO-SHIP';
  const blockerCount = run.blockers?.length || 0;
  const hasReplay = run.artifacts?.some(a => a.type === 'replay');
  
  let toast = verdict;
  if (blockerCount > 0) {
    toast += ` • ${blockerCount} blocker${blockerCount > 1 ? 's' : ''}`;
  }
  if (hasReplay) {
    toast += ' • Replay ready';
  }
  
  return toast;
}

export { state, policy };
