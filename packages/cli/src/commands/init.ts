/**
 * guardrail init
 *
 * Interactive setup wizard. Detects framework, picks template,
 * offers CI + hooks, generates Truth Pack, runs first scan.
 * 30-second zero-to-protected experience.
 */

import { Command } from 'commander';
import { join, basename } from 'path';
import { existsSync, writeFileSync, mkdirSync } from 'fs';
import * as readline from 'readline';
import { TruthPackGenerator } from '../truth-pack';
import { printLogo } from '../ui';
import { styles, icons } from '../ui';
import { createSteps } from '../ui/index';
import { ExitCode } from '../runtime/exit-codes';
import { validateProjectPath, withErrorHandler } from './shared';
import {
  detectFramework,
  formatFrameworkName,
  getTemplate,
  getTemplateChoices,
  mergeWithFrameworkDefaults,
  generateCIWorkflow,
  getCIProviderFromProject,
  installHooks,
  getRecommendedRunner,
  type GuardrailConfig,
  type TemplateType,
} from '../init';

// ─────────────────────────────────────────────────────────────────────────────
// Simple prompt helper (no external dependency needed)
// ─────────────────────────────────────────────────────────────────────────────

function prompt(question: string, defaultValue?: string): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  const suffix = defaultValue ? ` ${styles.dim}(${defaultValue})${styles.reset}` : '';
  return new Promise((resolve) => {
    rl.question(`  ${question}${suffix}: `, (answer) => {
      rl.close();
      resolve(answer.trim() || defaultValue || '');
    });
  });
}

function promptChoice(question: string, choices: Array<{ name: string; value: string; description: string }>, defaultIdx = 0): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    console.log(`  ${styles.bold}${question}${styles.reset}\n`);
    choices.forEach((c, i) => {
      const marker = i === defaultIdx ? `${styles.brightCyan}›${styles.reset}` : ' ';
      console.log(`  ${marker} ${styles.bold}${i + 1}.${styles.reset} ${c.name} ${styles.dim}— ${c.description}${styles.reset}`);
    });
    console.log('');

    rl.question(`  ${styles.dim}Choose (1-${choices.length}, default ${defaultIdx + 1})${styles.reset}: `, (answer) => {
      rl.close();
      const idx = parseInt(answer) - 1;
      if (idx >= 0 && idx < choices.length) {
        resolve(choices[idx].value);
      } else {
        resolve(choices[defaultIdx].value);
      }
    });
  });
}

function promptYesNo(question: string, defaultYes = true): Promise<boolean> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  const hint = defaultYes ? 'Y/n' : 'y/N';
  return new Promise((resolve) => {
    rl.question(`  ${question} ${styles.dim}(${hint})${styles.reset}: `, (answer) => {
      rl.close();
      if (!answer.trim()) return resolve(defaultYes);
      resolve(answer.trim().toLowerCase().startsWith('y'));
    });
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Init command
// ─────────────────────────────────────────────────────────────────────────────

export function registerInitCommand(program: Command): void {
  program
    .command('init')
    .description('Interactive setup wizard — detect, configure, scan')
    .option('-p, --path <path>', 'Project path', '.')
    .option('-y, --yes', 'Accept all defaults (non-interactive)')
    .option('--force', 'Regenerate even if already initialized')
    .option('--template <template>', 'Template: startup, enterprise, oss')
    .action(async (options) => {
      await withErrorHandler('init', async () => {
      const startTime = performance.now();
      printLogo();

      const projectPath = validateProjectPath(options.path);
      const projectName = basename(projectPath);
      const interactive = !options.yes && process.stdin.isTTY;

      console.log(`\n${styles.brightCyan}${styles.bold}  Let's set up Guardrail for ${styles.brightWhite}${projectName}${styles.reset}\n`);

      // ── Check if already initialized ──
      const guardrailrcPath = join(projectPath, '.guardrailrc');
      if (!options.force && existsSync(guardrailrcPath)) {
        console.log(`  ${styles.brightGreen}${icons.success}${styles.reset} Already initialized ${styles.dim}(.guardrailrc exists)${styles.reset}`);
        console.log(`  ${styles.dim}Run with --force to reconfigure${styles.reset}\n`);
        return;
      }

      const steps = createSteps(6);

      // ── Step 1: Detect framework ──
      steps.start('Detecting framework');
      const detection = detectFramework(projectPath);
      const frameworkName = formatFrameworkName(detection.framework);
      steps.complete(`Detected: ${styles.bold}${frameworkName}${styles.reset} ${styles.dim}(${detection.confidence} confidence)${styles.reset}`);

      if (detection.signals.length > 0 && interactive) {
        detection.signals.slice(0, 3).forEach(s => {
          console.log(`        ${styles.dim}${s}${styles.reset}`);
        });
        console.log('');
      }

      // ── Step 2: Choose template ──
      let templateType: TemplateType;
      if (options.template) {
        templateType = options.template as TemplateType;
      } else if (interactive) {
        const choices = getTemplateChoices();
        templateType = await promptChoice(
          'Choose a configuration template:',
          choices,
          0, // default to Startup
        ) as TemplateType;
        console.log('');
      } else {
        templateType = 'startup';
      }

      steps.start('Generating configuration');
      const template = getTemplate(templateType);
      const config = mergeWithFrameworkDefaults(template.config, detection.framework, detection.recommendedScans);
      steps.complete(`Template: ${styles.bold}${template.name}${styles.reset}`);

      // ── Step 3: CI workflow ──
      const ciProvider = getCIProviderFromProject(projectPath);
      let installCI = false;

      if (ciProvider) {
        if (interactive) {
          installCI = await promptYesNo(
            `Install ${ciProvider} CI workflow?`,
            true,
          );
        } else {
          installCI = true;
        }
      }

      if (installCI && ciProvider) {
        steps.start(`Installing ${ciProvider} CI workflow`);
        try {
          const ciResult = generateCIWorkflow({ projectPath, config, provider: ciProvider as 'github' | 'gitlab' | 'azure' | 'bitbucket' });
          steps.complete(`CI workflow: ${styles.dim}${ciResult.workflowPath}${styles.reset}`);
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : String(err);
          steps.fail(`CI workflow: ${msg}`);
        }
      } else {
        steps.skip('CI workflow');
      }

      // ── Step 4: Git hooks ──
      let installGitHooks = false;
      const hookRunner = getRecommendedRunner(projectPath);

      if (interactive) {
        installGitHooks = await promptYesNo(
          `Install pre-commit hook (${hookRunner})?`,
          true,
        );
      } else {
        installGitHooks = true;
      }

      if (installGitHooks) {
        steps.start(`Installing ${hookRunner} hooks`);
        try {
          const hookResult = installHooks({
            projectPath,
            config,
            runner: hookRunner,
            preCommit: true,
          });
          if (hookResult.success) {
            steps.complete(`Hooks: ${hookResult.installedHooks.join(', ')}`);
          } else {
            steps.fail(`Hooks: ${hookResult.error}`);
          }
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : String(err);
          steps.fail(`Hooks: ${msg}`);
        }
      } else {
        steps.skip('Git hooks');
      }

      // ── Step 5: Generate Truth Pack ──
      steps.start('Building Truth Pack');
      const generator = new TruthPackGenerator(projectPath);
      try {
        await generator.generate();
        steps.complete(`Truth Pack: ${styles.dim}${generator.getPath()}${styles.reset}`);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        steps.fail(`Truth Pack: ${msg}`);
      }

      // ── Step 6: Write config ──
      steps.start('Writing .guardrailrc');
      const rcContent = {
        version: config.version,
        template: templateType,
        framework: detection.framework,
        checks: detection.recommendedScans,
        output: '.guardrail',
        policy: config.gating,
        scans: config.scans,
      };
      writeFileSync(guardrailrcPath, JSON.stringify(rcContent, null, 2));
      steps.complete('.guardrailrc created');

      // ── Install MCP config ──
      try {
        const mcpDir = join(projectPath, '.guardrail', 'mcp');
        if (!existsSync(mcpDir)) {
          mkdirSync(mcpDir, { recursive: true });
        }
        const mcpConfig = {
          version: '1.0.0',
          tools: {
            truth: ['repo_map', 'symbols_exists', 'symbols_find', 'symbols_fuzzy', 'versions_allowed'],
            impact: ['graph_related'],
            standards: ['patterns_pick', 'architecture_check', 'boundary_check'],
            security: ['antipatterns_scan', 'antipatterns_check', 'vulnerabilities_scan', 'vulnerability_check'],
            workflow: ['scope_declare', 'scope_check', 'autopilot', 'verify_fast', 'verify_deep'],
          },
        };
        writeFileSync(join(projectPath, '.guardrail', 'mcp-config.json'), JSON.stringify(mcpConfig, null, 2));
      } catch {
        // MCP config is optional
      }

      // ── Done! ──
      const elapsed = Math.round(performance.now() - startTime);

      console.log('');
      console.log(`  ${styles.brightGreen}${styles.bold}✓ Guardrail initialized${styles.reset} ${styles.dim}(${elapsed}ms)${styles.reset}`);
      console.log('');

      // ── Next steps ──
      console.log(`  ${styles.bold}Next steps:${styles.reset}`);
      console.log(`  ${styles.brightCyan}›${styles.reset} Run your first scan:      ${styles.bold}guardrail scan${styles.reset}`);
      console.log(`  ${styles.brightCyan}›${styles.reset} Ship readiness check:     ${styles.bold}guardrail ship${styles.reset}`);
      console.log(`  ${styles.brightCyan}›${styles.reset} Watch mode (continuous):   ${styles.bold}guardrail watch${styles.reset}`);
      console.log(`  ${styles.brightCyan}›${styles.reset} Always-on context:         ${styles.bold}guardrail on${styles.reset}`);
      console.log('');
      console.log(`  ${styles.dim}Guardrail is now protecting ${projectName}. Happy shipping.${styles.reset}\n`);
      })();
    });
}
