import { join } from 'path';
import { existsSync, writeFileSync, mkdirSync } from 'fs';
import { spinner } from '../ui/cli-terminal';
import { delay } from '../utils/delay';
import { frameLines, truncatePath } from '../ui/cli-frame-inline';
import { icons, styles } from '../ui/cli-styles';
import { promptSelect } from '../ui/cli-prompts';
import {
  detectFramework,
  formatFrameworkName,
  getTemplate,
  validateConfig,
  mergeWithFrameworkDefaults,
  getTemplateChoices,
  generateCIWorkflow,
  getCIProviderFromProject,
  installHooks,
  getRecommendedRunner,
  type TemplateType,
} from '../init';


export async function initProject(projectPath: string, options: any): Promise<void> {
  const configDir = join(projectPath, '.guardrail');
  const isTTY = process.stdin.isTTY && process.stdout.isTTY && options.interactive !== false;
  
  // Step 1: Framework Detection
  const s1 = spinner('Detecting project framework...');
  await delay(300);
  const frameworkResult = detectFramework(projectPath);
  s1.stop(true, `Detected: ${formatFrameworkName(frameworkResult.framework)}`);
  
  // Display framework detection results
  console.log('');
  const frameworkLines = [
    `${styles.brightBlue}${styles.bold}📦 FRAMEWORK DETECTION${styles.reset}`,
    '',
    `${styles.dim}Framework:${styles.reset}   ${styles.bold}${formatFrameworkName(frameworkResult.framework)}${styles.reset}`,
    `${styles.dim}Confidence:${styles.reset}  ${frameworkResult.confidence}`,
    '',
    `${styles.dim}Signals:${styles.reset}`,
    ...frameworkResult.signals.map(s => `  ${styles.cyan}${icons.bullet}${styles.reset} ${s}`),
    '',
    `${styles.dim}Recommended scans:${styles.reset} ${styles.brightCyan}${frameworkResult.recommendedScans.join(', ')}${styles.reset}`,
    `${styles.dim}${frameworkResult.scanDescription}${styles.reset}`,
  ];
  console.log(frameLines(frameworkLines, { padding: 2 }).join('\n'));
  console.log('');
  
  // Step 2: Template Selection
  let templateType: TemplateType = 'startup';
  
  if (options.template) {
    const validTemplates = ['startup', 'enterprise', 'oss'];
    if (validTemplates.includes(options.template)) {
      templateType = options.template as TemplateType;
    } else {
      console.log(`  ${styles.brightYellow}${icons.warning}${styles.reset} Invalid template '${options.template}', using 'startup'`);
    }
  } else if (isTTY) {
    const templateChoices = getTemplateChoices();
    const [a, b, c] = templateChoices;
    if (!a || !b || !c) {
      throw new Error('getTemplateChoices: expected 3 templates');
    }
    templateType = await promptSelect<TemplateType>('Select a configuration template', [
      { 
        name: `${styles.brightGreen}Startup${styles.reset} - ${a.description}`, 
        value: 'startup',
        badge: `${styles.dim}(fast, minimal)${styles.reset}`,
      },
      { 
        name: `${styles.brightBlue}Enterprise${styles.reset} - ${b.description}`, 
        value: 'enterprise',
        badge: `${styles.dim}(strict, compliant)${styles.reset}`,
      },
      { 
        name: `${styles.brightMagenta}OSS${styles.reset} - ${c.description}`, 
        value: 'oss',
        badge: `${styles.dim}(supply chain focus)${styles.reset}`,
      },
    ]);
  }
  
  const s2 = spinner(`Applying ${templateType} template...`);
  await delay(300);
  const template = getTemplate(templateType);
  let config = mergeWithFrameworkDefaults(
    template.config,
    frameworkResult.framework,
    frameworkResult.recommendedScans
  );
  s2.stop(true, `Template: ${template.name}`);
  
  // Step 3: Create configuration directory and write config
  const s3 = spinner('Creating configuration...');
  await delay(200);
  if (!existsSync(configDir)) {
    mkdirSync(configDir, { recursive: true });
  }
  
  // Validate config before writing
  const validation = validateConfig(config);
  if (!validation.success) {
    s3.stop(false, 'Configuration validation failed');
    console.log(`  ${styles.brightRed}${icons.error}${styles.reset} Config validation errors:`);
    const validationError = validation as any;
    if (validationError.error && Array.isArray(validationError.error.errors)) {
      validationError.error.errors.forEach((err: any) => {
        console.log(`    ${styles.dim}${err.path?.join('.') || 'field'}:${styles.reset} ${err.message}`);
      });
    } else {
      console.log(`    ${styles.dim}Unknown validation error${styles.reset}`);
    }
    return;
  }
  
  // Atomic write
  const configPath = join(configDir, 'config.json');
  const tmpPath = `${configPath}.tmp`;
  writeFileSync(tmpPath, JSON.stringify(config, null, 2), 'utf-8');
  const { renameSync } = await import('fs');
  renameSync(tmpPath, configPath);
  s3.stop(true, 'Configuration saved');
  
  // Step 4: CI Setup
  let ciResult: { workflowPath?: string; provider?: string } = {};
  if (options.ci) {
    const s4 = spinner('Setting up CI/CD integration...');
    await delay(300);
    
    const ciProvider = getCIProviderFromProject(projectPath) || 'github';
    const ciGenResult = generateCIWorkflow({
      projectPath,
      config,
      provider: ciProvider,
    });
    
    ciResult = ciGenResult;
    s4.stop(true, `CI workflow created (${ciProvider})`);
  }
  
  // Step 5: Git Hooks Setup
  let hooksResult: { runner?: string; installedHooks?: string[] } = {};
  if (options.hooks) {
    const s5 = spinner('Installing git hooks...');
    await delay(300);
    
    const hookRunner = options.hookRunner || getRecommendedRunner(projectPath);
    const hookInstallResult = installHooks({
      projectPath,
      config,
      runner: hookRunner,
      preCommit: true,
      prePush: true,
    });
    
    hooksResult = hookInstallResult;
    s5.stop(true, `Hooks installed (${hookInstallResult.runner}): ${hookInstallResult.installedHooks.join(', ')}`);
  }
  
  // Summary
  console.log('');
  const successLines = [
    `${styles.brightGreen}${styles.bold}${icons.success} INITIALIZATION COMPLETE${styles.reset}`,
    '',
    `${styles.dim}Framework:${styles.reset}   ${styles.bold}${formatFrameworkName(frameworkResult.framework)}${styles.reset}`,
    `${styles.dim}Template:${styles.reset}    ${styles.bold}${template.name}${styles.reset}`,
    `${styles.dim}Config:${styles.reset}      ${truncatePath(configDir)}/config.json`,
    `${styles.dim}CI Setup:${styles.reset}    ${options.ci ? `Yes (${ciResult.provider || 'github'})` : 'No'}`,
    `${styles.dim}Hooks:${styles.reset}       ${options.hooks ? `Yes (${hooksResult.runner || 'husky'})` : 'No'}`,
    '',
    `${styles.dim}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${styles.reset}`,
    '',
    `${styles.bold}RECOMMENDED COMMANDS${styles.reset}`,
  ];
  
  // Add recommended commands based on framework
  const recommendedCmds = frameworkResult.recommendedScans.map(scan => {
    switch (scan) {
      case 'secrets':
        return `  ${styles.cyan}${icons.bullet}${styles.reset} ${styles.bold}guardrail scan:secrets${styles.reset} - Detect hardcoded credentials`;
      case 'vuln':
        return `  ${styles.cyan}${icons.bullet}${styles.reset} ${styles.bold}guardrail scan:vulnerabilities${styles.reset} - Check for CVEs`;
      case 'ship':
        return `  ${styles.cyan}${icons.bullet}${styles.reset} ${styles.bold}guardrail ship${styles.reset} - Pre-deployment readiness check`;
      case 'reality':
        return `  ${styles.cyan}${icons.bullet}${styles.reset} ${styles.bold}guardrail reality${styles.reset} - Browser testing for auth flows`;
      case 'compliance':
        return `  ${styles.cyan}${icons.bullet}${styles.reset} ${styles.bold}guardrail scan:compliance${styles.reset} - SOC2/GDPR compliance checks`;
      default:
        return `  ${styles.cyan}${icons.bullet}${styles.reset} ${styles.bold}guardrail ${scan}${styles.reset}`;
    }
  });
  
  successLines.push(...recommendedCmds);
  successLines.push('');
  successLines.push(`${styles.dim}Documentation:${styles.reset} ${styles.brightBlue}https://guardrailai.dev/docs${styles.reset}`);
  
  const framedSuccess = frameLines(successLines, { padding: 2 });
  console.log(framedSuccess.join('\n'));
  console.log('');
  
  // Show CI workflow path if created
  if (options.ci && ciResult.workflowPath) {
    console.log(`  ${styles.dim}CI Workflow:${styles.reset} ${truncatePath(ciResult.workflowPath)}`);
    console.log(`  ${styles.dim}Add${styles.reset} ${styles.brightCyan}GUARDRAIL_API_KEY${styles.reset} ${styles.dim}to your repository secrets${styles.reset}`);
    console.log('');
  }
  
  // Show hooks info if installed
  if (options.hooks && hooksResult.installedHooks?.length) {
    console.log(`  ${styles.dim}Git hooks:${styles.reset} ${hooksResult.installedHooks.join(', ')} ${styles.dim}(${hooksResult.runner})${styles.reset}`);
    console.log(`  ${styles.dim}Run${styles.reset} ${styles.brightCyan}npm run prepare${styles.reset} ${styles.dim}to activate hooks${styles.reset}`);
    console.log('');
  }
}
