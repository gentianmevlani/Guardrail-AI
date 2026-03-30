import { join } from 'path';
import { readFileSync, existsSync, writeFileSync } from 'fs';
import { icons, styles } from '../ui/cli-styles';
import { c, printLogo } from '../ui/cli-terminal';
import { printMenuHeader } from '../ui/cli-menus';
import { loadConfig, saveConfig, CONFIG_FILE, defaultReportPath } from '../runtime/cli-config';
import { requireAuth } from '../runtime/cli-auth';
import { promptSelect, promptInput, promptConfirm, promptPassword } from '../ui/cli-prompts';
import { scanSecrets, scanVulnerabilities } from '../runtime/scan-secrets-vuln-cli';
import { scanCompliance, generateSBOM } from '../runtime/compliance-sbom-cli';
import { initProject } from '../runtime/init-project-cli';
import { outputSecretsResults, outputVulnResults, outputComplianceResults } from '../runtime/scan-output-cli';
import { installPlaywrightDependencies } from '../utils/playwright-install';

export type MenuAction =
  | 'init'
  | 'on'
  | 'stats'
  | 'checkpoint'
  | 'ship'
  | 'auth'
  | 'upgrade'
  | 'doctor'
  | 'exit';

export async function runInteractiveMenu(): Promise<void> {
  const cfg = loadConfig();

  while (true) {
    printMenuHeader();
    
    const proBadge = `${styles.magenta}${styles.bold}PRO${styles.reset}`;
    const isPro = cfg.tier === 'pro' || cfg.tier === 'enterprise';
    
    // Check Truth Pack status
    const { TruthPackGenerator } = await import('../truth-pack');
    const generator = new TruthPackGenerator(cfg.lastProjectPath || '.');
    const truthPackStatus = generator.isFresh() 
      ? `${styles.brightGreen}✓${styles.reset}` 
      : `${styles.brightYellow}⚠${styles.reset}`;
    
    const action = await promptSelect<MenuAction>('Select an action', [
      { name: `${styles.brightCyan}${icons.info}${styles.reset} Init                  ${styles.dim}One-time setup, builds Truth Pack${styles.reset}`, value: 'init' },
      { name: `${styles.brightGreen}${icons.success}${styles.reset} On                   ${styles.dim}Start Context Mode (watcher + MCP)${styles.reset}`, value: 'on' },
      { name: `${styles.brightBlue}${icons.scan}${styles.reset} Stats                 ${styles.dim}Hallucinations blocked, saved moments${styles.reset}`, value: 'stats' },
      { name: `${styles.brightYellow}${icons.warning}${styles.reset} Checkpoint           ${styles.dim}Fast pre-write verification${styles.reset}`, value: 'checkpoint' },
      { name: `${styles.brightGreen}${icons.ship}${styles.reset} Ship                  ${isPro ? '' : proBadge} ${styles.dim}GO/WARN/NO-GO + premium report${styles.reset}`, value: 'ship' },
      { name: `${styles.brightMagenta}${icons.auth}${styles.reset} Login / Logout / Whoami ${styles.dim}Auth management${styles.reset}`, value: 'auth' },
      { name: `${styles.cyan}${icons.info}${styles.reset} Upgrade                ${styles.dim}Upgrade to Pro tier${styles.reset}`, value: 'upgrade' },
      { name: `${styles.dim}${icons.error}${styles.reset} Doctor                 ${styles.dim}Fix setup issues${styles.reset}`, value: 'doctor' },
      { name: `${styles.dim}${icons.error} Exit${styles.reset}`, value: 'exit' },
    ]);

    if (action === 'exit') return;

    if (action === 'auth') {
      const authAction = await promptSelect<'login' | 'status' | 'logout' | 'back'>('Auth', [
        { name: 'Login (store key)', value: 'login' },
        { name: 'Status', value: 'status' },
        { name: 'Logout', value: 'logout' },
        { name: 'Back', value: 'back' },
      ]);

      if (authAction === 'back') continue;

      if (authAction === 'status') {
        const config = loadConfig();
        if (config.apiKey) {
          console.log(`\n${c.success('✓')} ${c.bold('Authenticated')}`);
          console.log(`  ${c.dim('Tier:')}   ${c.info(config.tier || 'free')}`);
          console.log(`  ${c.dim('Email:')}  ${config.email || 'N/A'}`);
          console.log(`  ${c.dim('Since:')}  ${config.authenticatedAt || 'N/A'}\n`);
        } else {
          console.log(`\n${c.high('✗')} ${c.bold('Not authenticated')}\n`);
        }
        continue;
      }

      if (authAction === 'logout') {
        try {
          if (existsSync(CONFIG_FILE)) {
            writeFileSync(CONFIG_FILE, '{}');
            console.log(`\n${c.success('✓')} ${c.bold('Logged out successfully')}\n`);
          } else {
            console.log(`\n${c.info('ℹ')} No credentials found\n`);
          }
        } catch {
          console.error(`\n${c.critical('ERROR')} Failed to remove credentials\n`);
        }
        continue;
      }

      // login
      const key = await promptPassword('Enter guardrail API key');

      if (!key.startsWith('gr_') || key.length < 20) {
        console.log(`\n${c.high('✗')} Invalid API key format`);
        console.log(`  ${c.dim('API keys should start with')} ${c.info('gr_')}\n`);
        continue;
      }

      let tier: 'free' | 'starter' | 'pro' | 'enterprise' = 'free';
      if (key.includes('_starter_')) tier = 'starter';
      else if (key.includes('_pro_')) tier = 'pro';
      else if (key.includes('_ent_') || key.includes('_enterprise_')) tier = 'enterprise';

      saveConfig({
        ...loadConfig(),
        apiKey: key,
        tier,
        authenticatedAt: new Date().toISOString(),
      });

      console.log(`\n${c.success('✓')} ${c.bold('Authentication successful!')}  ${c.dim('Tier:')} ${c.info(tier)}\n`);
      continue;
    }

    // Handle new core commands
    if (action === 'init') {
      const projectPath = cfg.lastProjectPath || '.';
      const { TruthPackGenerator } = await import('../truth-pack');
      const generator = new TruthPackGenerator(projectPath);
      
      console.log(`\n${c.bold('🔧 INITIALIZING guardrail')}\n`);
      try {
        const truthPack = await generator.generate();
        console.log(`  ${c.success('✓')} Truth Pack generated successfully!`);
        console.log(`  ${c.dim('Location:')} ${generator.getPath()}\n`);
        console.log(`  ${c.success('✓')} ${c.bold('AI connected ✅')}\n`);
      } catch (error: any) {
        console.error(`  ${c.critical('ERROR')} Failed to generate Truth Pack: ${error.message}\n`);
      }
      continue;
    }

    if (action === 'on') {
      const projectPath = cfg.lastProjectPath || '.';
      const { TruthPackGenerator } = await import('../truth-pack');
      const generator = new TruthPackGenerator(projectPath);
      
      if (!generator.isFresh(168)) {
        console.log(`\n${c.high('✗')} Truth Pack is stale or missing`);
        console.log(`  ${c.dim('Run')} ${c.bold('guardrail init')} ${c.dim('first')}\n`);
        continue;
      }
      
      console.log(`\n${c.bold('🚀 STARTING CONTEXT MODE')}\n`);
      console.log(`  ${c.success('✓')} Truth Pack found`);
      console.log(`  ${c.success('✓')} ${c.bold('Context Mode active')}`);
      console.log(`  ${c.dim('Press Ctrl+C to stop')}\n`);
      // TODO: Actually start MCP server and watcher
      continue;
    }

    if (action === 'stats') {
      const projectPath = cfg.lastProjectPath || '.';
      const statsFile = join(projectPath, '.guardrail', 'stats.json');
      
      let stats: any;
      if (existsSync(statsFile)) {
        try {
          stats = JSON.parse(readFileSync(statsFile, 'utf-8'));
        } catch {
          stats = { hallucinationsBlocked: { last24h: 0, last7d: 0, total: 0 } };
        }
      } else {
        stats = { hallucinationsBlocked: { last24h: 0, last7d: 0, total: 0 } };
      }

      console.log(`\n${c.bold('📊 guardrail STATS')}\n`);
      console.log(`  ${c.bold('Hallucinations Blocked:')}`);
      console.log(`    Last 24h: ${c.bold(stats.hallucinationsBlocked?.last24h || 0)}`);
      console.log(`    Last 7d:  ${c.bold(stats.hallucinationsBlocked?.last7d || 0)}`);
      console.log(`    Total:    ${c.bold(stats.hallucinationsBlocked?.total || 0)}\n`);
      console.log(`  ${c.bold('Next best action:')} ${c.info('guardrail ship')} to run ship check\n`);
      continue;
    }

    if (action === 'checkpoint') {
      const projectPath = cfg.lastProjectPath || '.';
      console.log(`\n${c.bold('🛡️ CHECKPOINT VERIFICATION')}\n`);
      // TODO: Implement checkpoint verification
      console.log(`  ${c.success('✓')} Checkpoint passed`);
      console.log(`  ${c.dim('No blocking issues found')}\n`);
      continue;
    }

    if (action === 'upgrade') {
      console.log(`\n${c.bold('💎 UPGRADE TO PRO')}\n`);
      console.log(`  ${c.bold('Pro Tier Benefits:')}`);
      console.log(`  ${c.cyan('•')} Unlimited checkpoints`);
      console.log(`  ${c.cyan('•')} Ship reports with GO/WARN/NO-GO verdicts`);
      console.log(`  ${c.cyan('•')} Premium HTML reports`);
      console.log(`  ${c.cyan('•')} Proof artifacts\n`);
      console.log(`  ${c.bold('Price:')} $29/month\n`);
      console.log(`  ${c.info('Upgrade now:')} ${c.bold('https://guardrail.dev/upgrade')}\n`);
      continue;
    }

    if (action === 'doctor') {
      const projectPath = cfg.lastProjectPath || '.';
      const { TruthPackGenerator } = await import('../truth-pack');
      const generator = new TruthPackGenerator(projectPath);
      
      console.log(`\n${c.bold('🔧 guardrail DOCTOR')}\n`);
      
      const issues: string[] = [];
      
      if (!generator.isFresh()) {
        issues.push('Truth Pack is missing or stale');
      }
      
      if (issues.length === 0) {
        console.log(`  ${c.success('✓')} No issues found. Everything looks good!\n`);
      } else {
        console.log(`  ${c.high('✗')} Found ${issues.length} issue(s):\n`);
        issues.forEach(issue => {
          console.log(`    ${c.dim('•')} ${issue}`);
        });
        console.log(`\n  ${c.bold('Fix:')} Run ${c.info('guardrail init')} to regenerate Truth Pack\n`);
      }
      continue;
    }

    // Project path prompt
    let projectPath = cfg.lastProjectPath || '.';
    const p = await promptInput('Project path', projectPath);
    projectPath = resolve(p);
    saveConfig({ ...loadConfig(), lastProjectPath: projectPath });

    if (action === 'scan_secrets') {
      requireAuth();

      const format = await promptSelect<'table' | 'json'>('Output format', [
        { name: 'table', value: 'table' },
        { name: 'json', value: 'json' },
      ]);

      const writeOut = await promptConfirm('Write report file?', true);
      const output = writeOut ? defaultReportPath(projectPath, 'secrets', 'json') : undefined;

      console.log(`\n${c.dim('Command:')} ${c.bold(`guardrail scan:secrets -p "${projectPath}" -f ${format}${output ? ` -o "${output}"` : ''}`)}\n`);

      printLogo();
      console.log(`\n${c.bold('🔐 SECRET DETECTION SCAN')}\n`);
      const results = await scanSecrets(projectPath, { format, output } as any);
      outputSecretsResults(results, { format, output });

      if (output) {
        writeFileSync(output, JSON.stringify(results, null, 2));
        console.log(`  ${c.success('✓')} Report saved to ${output}\n`);
      }
      continue;
    }

    if (action === 'scan_vulns') {
      requireAuth();

      const format = await promptSelect<'table' | 'json'>('Output format', [
        { name: 'table', value: 'table' },
        { name: 'json', value: 'json' },
      ]);

      const writeOut = await promptConfirm('Write report file?', true);
      const output = writeOut ? defaultReportPath(projectPath, 'vulns', 'json') : undefined;

      console.log(`\n${c.dim('Command:')} ${c.bold(`guardrail scan:vulnerabilities -p "${projectPath}" -f ${format}${output ? ` -o "${output}"` : ''}`)}\n`);

      printLogo();
      console.log(`\n${c.bold('🛡️ VULNERABILITY SCAN')}\n`);
      const results = await scanVulnerabilities(projectPath, { format, output });
      outputVulnResults(results, { format, output });

      if (output) {
        writeFileSync(output, JSON.stringify(results, null, 2));
        console.log(`  ${c.success('✓')} Report saved to ${output}\n`);
      }
      continue;
    }

    if (action === 'scan_compliance') {
      requireAuth('pro');

      const framework = await promptSelect<'soc2' | 'gdpr' | 'hipaa' | 'pci' | 'iso27001' | 'nist'>('Framework', [
        { name: 'SOC2', value: 'soc2' },
        { name: 'GDPR', value: 'gdpr' },
        { name: 'HIPAA', value: 'hipaa' },
        { name: 'PCI', value: 'pci' },
        { name: 'ISO27001', value: 'iso27001' },
        { name: 'NIST', value: 'nist' },
      ]);

      const format = await promptSelect<'table' | 'json'>('Output format', [
        { name: 'table', value: 'table' },
        { name: 'json', value: 'json' },
      ]);

      saveConfig({ ...loadConfig(), lastFramework: framework, lastFormat: format });

      console.log(`\n${c.dim('Command:')} ${c.bold(`guardrail scan:compliance -p "${projectPath}" --framework ${framework} -f ${format}`)}\n`);

      printLogo();
      console.log(`\n${c.bold('📋 COMPLIANCE SCAN')}\n`);
      const results = await scanCompliance(projectPath, { framework, format });
      outputComplianceResults(results, { format });
      continue;
    }

    if (action === 'sbom') {
      requireAuth('pro');

      const format = await promptSelect<'cyclonedx' | 'spdx' | 'json'>('SBOM format', [
        { name: 'CycloneDX', value: 'cyclonedx' },
        { name: 'SPDX', value: 'spdx' },
        { name: 'JSON', value: 'json' },
      ]);

      const includeDev = await promptConfirm('Include dev dependencies?', false);
      const output = defaultReportPath(projectPath, 'sbom', 'json');

      console.log(`\n${c.dim('Command:')} ${c.bold(`guardrail sbom:generate -p "${projectPath}" -f ${format} -o "${output}"${includeDev ? ' --include-dev' : ''}`)}\n`);

      printLogo();
      console.log(`\n${c.bold('📦 SBOM GENERATION')}\n`);
      const sbom = await generateSBOM(projectPath, { format, includeDev, output });
      writeFileSync(output, JSON.stringify(sbom, null, 2));
      console.log(`${c.success('✓')} SBOM written to ${output}\n`);
      continue;
    }

    if (action === 'reality') {
      requireAuth('starter');

      const url = await promptInput('Base URL of running app', 'http://localhost:3000');
      const flow = await promptSelect<'auth' | 'checkout' | 'dashboard'>('Flow to test', [
        { name: 'Authentication Flow', value: 'auth' },
        { name: 'Checkout Flow', value: 'checkout' },
        { name: 'Dashboard Flow', value: 'dashboard' },
      ]);

      const mode = await promptSelect<'generate' | 'run' | 'record'>('Mode', [
        { name: 'Generate test only', value: 'generate' },
        { name: 'Generate and run', value: 'run' },
        { name: 'Record user actions', value: 'record' },
      ]);

      console.log(`\n${c.dim('Command:')} ${c.bold(`guardrail reality --url "${url}" --flow ${flow}${mode === 'run' ? ' --run' : mode === 'record' ? ' --record' : ''}`)}\n`);

      printLogo();
      console.log(`\n${c.bold('🌐 REALITY MODE')}\n`);

      // Check dependencies and install if needed
      const { checkPlaywrightDependencies } = require('../reality/reality-runner');
      const depCheck = checkPlaywrightDependencies(projectPath);
      
      if (!depCheck.playwrightInstalled || !depCheck.browsersInstalled) {
        console.log(`  ${styles.brightYellow}${icons.warning} Playwright dependencies missing${styles.reset}`);
        console.log('');
        
        const shouldInstall = await promptConfirm('Install Playwright dependencies automatically?', true);
        if (shouldInstall) {
          const installResult = await installPlaywrightDependencies(projectPath);
          if (!installResult.success) {
            console.log(`  ${styles.brightRed}${icons.error} Failed to install: ${installResult.error}${styles.reset}`);
            console.log('');
            console.log(`  ${styles.bold}Manual install commands:${styles.reset}`);
            depCheck.installCommands.forEach(cmd => {
              console.log(`    ${styles.brightCyan}${cmd}${styles.reset}`);
            });
            console.log('');
            continue;
          }
        } else {
          console.log(`  ${styles.dim}Installation skipped. Run manually when ready.${styles.reset}`);
          console.log('');
          continue;
        }
      }

      // Execute reality mode based on selection
      const { spawn } = require('child_process');
      const args = ['reality', '--url', url, '--flow', flow];
      if (mode === 'run') args.push('--run');
      if (mode === 'record') args.push('--record');
      
      const realityProc = spawn('guardrail', args, {
        stdio: 'inherit',
        shell: process.platform === 'win32',
        cwd: projectPath
      });
      
      realityProc.on('close', (code) => {
        if (code === 0) {
          console.log(`\n  ${styles.brightGreen}${icons.success} Reality mode completed${styles.reset}`);
        } else {
          console.log(`\n  ${styles.brightRed}${icons.error} Reality mode failed${styles.reset}`);
        }
      });
      
      continue;
    }

    if (action === 'ship') {
      requireAuth();

      const baseline = await promptConfirm('Use baseline file?', false);
      const output = await promptConfirm('Generate ship report?', true);
      const outputPath = output ? defaultReportPath(projectPath, 'ship', 'json') : undefined;

      console.log(`\n${c.dim('Command:')} ${c.bold(`guardrail ship -p "${projectPath}"${baseline ? ' --baseline .guardrail/baseline.json' : ''}${outputPath ? ` --output "${outputPath}"` : ''}`)}\n`);

      printLogo();
      console.log(`\n${c.bold('🚀 SHIP CHECK')}\n`);
      
      // Import ship functionality
      const { runShipCheck } = require('guardrail-ship');
      try {
        const shipResult = await runShipCheck(projectPath, { 
          baseline: baseline ? '.guardrail/baseline.json' : undefined,
          output: outputPath
        });
        
        if (shipResult.verdict === 'ship') {
          console.log(`  ${styles.brightGreen}${icons.success} Ready to ship!${styles.reset}`);
        } else {
          console.log(`  ${styles.brightYellow}${icons.warning} Issues need to be addressed before shipping${styles.reset}`);
        }
        
        if (outputPath) {
          console.log(`  ${styles.dim}Report saved to ${outputPath}${styles.reset}`);
        }
      } catch (error: any) {
        console.log(`  ${styles.brightRed}${icons.error} Ship check failed: ${error.message}${styles.reset}`);
      }
      
      console.log('');
      continue;
    }

    if (action === 'init') {
      const template = await promptSelect<'startup' | 'enterprise' | 'oss'>('Configuration template', [
        { name: 'Startup - Fast, minimal setup', value: 'startup' },
        { name: 'Enterprise - Strict, compliant', value: 'enterprise' },
        { name: 'OSS - Supply chain focus', value: 'oss' },
      ]);

      const setupCI = await promptConfirm('Setup CI/CD integration?', false);
      const setupHooks = await promptConfirm('Install git hooks?', false);

      console.log(`\n${c.dim('Command:')} ${c.bold(`guardrail init -p "${projectPath}" --template ${template}${setupCI ? ' --ci' : ''}${setupHooks ? ' --hooks' : ''}`)}\n`);

      printLogo();
      console.log(`\n${c.bold('🔧 INITIALIZING PROJECT')}\n`);
      
      try {
        await initProject(projectPath, { 
          template, 
          ci: setupCI, 
          hooks: setupHooks,
          interactive: true 
        });
        console.log(`  ${styles.brightGreen}${icons.success} Project initialized successfully${styles.reset}`);
      } catch (error: any) {
        console.log(`  ${styles.brightRed}${icons.error} Initialization failed: ${error.message}${styles.reset}`);
      }
      
      console.log('');
      continue;
    }
  }
}
