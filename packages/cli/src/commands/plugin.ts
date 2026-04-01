/**
 * guardrail plugin — Manage custom rules and framework packs.
 *
 * Subcommands:
 *   guardrail plugin list           — List installed plugins and active rules
 *   guardrail plugin install <name> — Install a plugin from npm
 *   guardrail plugin create <name>  — Scaffold a new plugin project
 *   guardrail plugin packs          — List built-in framework packs
 *   guardrail plugin info <name>    — Show detailed info about a plugin
 */

import { Command } from 'commander';
import { resolve, join } from 'path';
import { existsSync, writeFileSync, mkdirSync } from 'fs';
import { execSync } from 'child_process';
import { styles, icons } from '../ui';

export function registerPluginCommand(program: Command): void {
  const plugin = program
    .command('plugin')
    .description('Manage custom rules, framework packs, and community plugins');

  // ─── guardrail plugin list ──────────────────────────────────────────────────
  plugin
    .command('list')
    .description('List installed plugins and their rules')
    .option('-p, --path <path>', 'Project path', '.')
    .action(async (options) => {
      const projectRoot = resolve(options.path);

      try {
        const {
          loadGuardrailConfig,
          PluginLoader,
          detectFramework,
          listBuiltinPacks,
        } = await import('@guardrail/engines/plugins');

        const config = await loadGuardrailConfig(projectRoot);
        const loader = new PluginLoader(projectRoot);
        const plugins = await loader.loadAll(config);

        const framework = detectFramework(projectRoot);

        console.log(`\n${styles.bold}${icons.info} Guardrail Plugins${styles.reset}\n`);

        if (framework) {
          console.log(`  ${styles.dim}Detected framework: ${styles.reset}${styles.brightCyan}${framework}${styles.reset}\n`);
        }

        if (plugins.length === 0) {
          console.log(`  ${styles.dim}No plugins installed.${styles.reset}`);
          console.log(`  ${styles.dim}Run ${styles.reset}guardrail plugin packs${styles.dim} to see built-in framework packs.${styles.reset}`);
          console.log(`  ${styles.dim}Run ${styles.reset}guardrail plugin install <name>${styles.dim} to add a community plugin.${styles.reset}\n`);
          return;
        }

        for (const p of plugins) {
          const enabledCount = p.activeRules.filter((r) => r.enabled).length;
          const totalCount = p.activeRules.length;
          const sourceLabel = p.source === 'builtin' ? ' (builtin)' : p.source === 'local' ? ' (local)' : '';

          console.log(`  ${styles.brightGreen}${icons.success}${styles.reset} ${styles.bold}${p.manifest.name}${styles.reset} v${p.manifest.version}${styles.dim}${sourceLabel}${styles.reset}`);
          console.log(`    ${styles.dim}${p.manifest.description}${styles.reset}`);
          console.log(`    ${styles.dim}Rules: ${enabledCount}/${totalCount} enabled${styles.reset}`);

          for (const rule of p.activeRules) {
            const status = rule.enabled ? styles.brightGreen + '●' : styles.dim + '○';
            const sevColor = getSeverityColor(rule.effectiveSeverity);
            console.log(`      ${status}${styles.reset} ${rule.definition.id} ${styles.dim}—${styles.reset} ${rule.definition.name} ${sevColor}[${rule.effectiveSeverity}]${styles.reset}`);
          }
          console.log('');
        }
      } catch (err) {
        console.error(`  ${styles.red}${icons.error}${styles.reset} Failed to load plugins: ${err instanceof Error ? err.message : String(err)}`);
        process.exit(1);
      }
    });

  // ─── guardrail plugin packs ─────────────────────────────────────────────────
  plugin
    .command('packs')
    .description('List built-in framework rule packs')
    .action(async () => {
      const { listBuiltinPacks } = await import('@guardrail/engines/plugins');
      const packs = listBuiltinPacks();

      console.log(`\n${styles.bold}${icons.info} Built-in Framework Packs${styles.reset}\n`);

      for (const { framework, manifest } of packs) {
        console.log(`  ${styles.brightCyan}${framework}${styles.reset} — ${styles.bold}${manifest.name}${styles.reset} v${manifest.version}`);
        console.log(`    ${styles.dim}${manifest.description}${styles.reset}`);
        console.log(`    ${styles.dim}Rules: ${manifest.rules.length} | Languages: ${manifest.languages?.join(', ')}${styles.reset}`);
        console.log('');
      }

      console.log(`  ${styles.dim}Add to guardrail.config.ts:${styles.reset}`);
      console.log(`  ${styles.dim}  plugins: ['@guardrail/rules-nextjs']${styles.reset}\n`);
      console.log(`  ${styles.dim}Or auto-detect: framework packs activate when the framework is detected.${styles.reset}\n`);
    });

  // ─── guardrail plugin install <name> ────────────────────────────────────────
  plugin
    .command('install <name>')
    .description('Install a plugin from npm')
    .option('-p, --path <path>', 'Project path', '.')
    .option('-D, --dev', 'Install as devDependency', true)
    .action(async (name: string, options) => {
      const projectRoot = resolve(options.path);
      const devFlag = options.dev ? '-D' : '';

      // Normalize package name
      const packageName = name.startsWith('guardrail-plugin-') || name.startsWith('@')
        ? name
        : `guardrail-plugin-${name}`;

      console.log(`\n${styles.bold}${icons.info} Installing ${packageName}...${styles.reset}\n`);

      try {
        // Detect package manager
        const pm = detectPackageManager(projectRoot);
        const installCmd = pm === 'pnpm'
          ? `pnpm add ${devFlag} ${packageName}`
          : pm === 'yarn'
            ? `yarn add ${devFlag} ${packageName}`
            : `npm install ${devFlag} ${packageName}`;

        execSync(installCmd, { cwd: projectRoot, stdio: 'inherit' });

        console.log(`\n  ${styles.brightGreen}${icons.success}${styles.reset} Installed ${packageName}`);

        // Add to guardrail config if not already present
        await addPluginToConfig(projectRoot, packageName);

        console.log(`  ${styles.brightGreen}${icons.success}${styles.reset} Added to guardrail.config.ts`);
        console.log(`\n  ${styles.dim}Run ${styles.reset}guardrail plugin list${styles.dim} to see active rules.${styles.reset}\n`);
      } catch (err) {
        console.error(`  ${styles.red}${icons.error}${styles.reset} Failed to install: ${err instanceof Error ? err.message : String(err)}`);
        process.exit(1);
      }
    });

  // ─── guardrail plugin create <name> ─────────────────────────────────────────
  plugin
    .command('create <name>')
    .description('Scaffold a new Guardrail plugin project')
    .option('-o, --output <dir>', 'Output directory', '.')
    .action(async (name: string, options) => {
      const pluginName = name.startsWith('guardrail-plugin-')
        ? name
        : `guardrail-plugin-${name}`;

      const outputDir = resolve(options.output, pluginName);

      if (existsSync(outputDir)) {
        console.error(`  ${styles.red}${icons.error}${styles.reset} Directory already exists: ${outputDir}`);
        process.exit(1);
      }

      console.log(`\n${styles.bold}${icons.info} Creating ${pluginName}...${styles.reset}\n`);

      mkdirSync(outputDir, { recursive: true });
      mkdirSync(join(outputDir, 'src'), { recursive: true });

      // package.json
      writeFileSync(
        join(outputDir, 'package.json'),
        JSON.stringify(
          {
            name: pluginName,
            version: '0.1.0',
            description: `Guardrail plugin: ${name}`,
            main: 'src/index.ts',
            types: 'src/index.ts',
            keywords: ['guardrail', 'guardrail-plugin', 'code-quality'],
            peerDependencies: {
              '@guardrail/engines': '>=1.0.0',
            },
            devDependencies: {
              '@guardrail/engines': '*',
              typescript: '^5.0.0',
            },
            license: 'MIT',
          },
          null,
          2
        )
      );

      // tsconfig.json
      writeFileSync(
        join(outputDir, 'tsconfig.json'),
        JSON.stringify(
          {
            compilerOptions: {
              target: 'ES2022',
              module: 'ESNext',
              moduleResolution: 'bundler',
              strict: true,
              esModuleInterop: true,
              declaration: true,
              outDir: 'dist',
              rootDir: 'src',
            },
            include: ['src'],
          },
          null,
          2
        )
      );

      // src/index.ts — Plugin scaffold
      writeFileSync(
        join(outputDir, 'src/index.ts'),
        `/**
 * ${pluginName} — Custom Guardrail rules.
 *
 * Add your rules to the \`rules\` array below.
 * Each rule has an \`id\`, \`name\`, \`description\`, \`severity\`, \`languages\`, and a \`check\` function.
 *
 * The check function receives a RuleContext with:
 *   - ctx.source: full file source text
 *   - ctx.lines: source split into lines
 *   - ctx.filePath: relative file path
 *   - ctx.language: detected language ID
 *   - ctx.extension: file extension
 *   - ctx.report(): call to report a finding
 *
 * Usage in guardrail.config.ts:
 *   plugins: ['${pluginName}']
 *   rules: { '${name.toUpperCase().replace(/-/g, '')}-001': 'error' }
 */

import type { PluginManifest, RuleContext } from '@guardrail/engines/plugins';

const PREFIX = '${name.toUpperCase().replace(/-/g, '').substring(0, 6)}';

export const plugin: PluginManifest = {
  name: '${pluginName}',
  version: '0.1.0',
  description: 'Custom Guardrail rules for ${name}.',
  rules: [
    {
      id: \`\${PREFIX}-001\`,
      name: 'example-rule',
      description: 'Example rule — replace this with your own checks.',
      severity: 'medium',
      languages: ['typescript', 'javascript'],
      category: 'custom',
      check(ctx: RuleContext) {
        // Example: find TODO comments
        for (let i = 0; i < ctx.lines.length; i++) {
          if (ctx.lines[i]!.includes('TODO')) {
            ctx.report({
              message: 'Found a TODO comment — consider resolving before shipping.',
              line: i + 1,
              severity: 'info',
              evidence: ctx.lines[i]!.trim(),
            });
          }
        }
      },
    },
  ],
};
`
      );

      console.log(`  ${styles.brightGreen}${icons.success}${styles.reset} Created ${pluginName}/`);
      console.log(`    ${styles.dim}├── package.json${styles.reset}`);
      console.log(`    ${styles.dim}├── tsconfig.json${styles.reset}`);
      console.log(`    ${styles.dim}└── src/index.ts  ← add your rules here${styles.reset}`);
      console.log(`\n  ${styles.dim}Next steps:${styles.reset}`);
      console.log(`    ${styles.dim}cd ${pluginName} && npm install${styles.reset}`);
      console.log(`    ${styles.dim}Edit src/index.ts to add your rules${styles.reset}`);
      console.log(`    ${styles.dim}Add "${pluginName}" to plugins in guardrail.config.ts${styles.reset}\n`);
    });

  // ─── guardrail plugin info <name> ───────────────────────────────────────────
  plugin
    .command('info <name>')
    .description('Show detailed info about a plugin')
    .option('-p, --path <path>', 'Project path', '.')
    .action(async (name: string, options) => {
      const projectRoot = resolve(options.path);

      try {
        const { loadGuardrailConfig, PluginLoader, getBuiltinPack } = await import('@guardrail/engines/plugins');

        // Check builtin packs first
        const builtin = getBuiltinPack(name);
        if (builtin) {
          printPluginInfo(builtin, 'builtin');
          return;
        }

        // Try loading from config
        const config = await loadGuardrailConfig(projectRoot);
        const loader = new PluginLoader(projectRoot);
        const plugins = await loader.loadAll({ ...config, plugins: [...(config.plugins ?? []), name] });
        const found = plugins.find((p) => p.manifest.name === name || p.manifest.name.includes(name));

        if (!found) {
          console.error(`  ${styles.red}${icons.error}${styles.reset} Plugin "${name}" not found. Is it installed?`);
          process.exit(1);
        }

        printPluginInfo(found.manifest, found.source);
      } catch (err) {
        console.error(`  ${styles.red}${icons.error}${styles.reset} ${err instanceof Error ? err.message : String(err)}`);
        process.exit(1);
      }
    });
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getSeverityColor(severity: string): string {
  switch (severity) {
    case 'critical': return styles.red || '\x1b[31m';
    case 'high': return styles.red || '\x1b[31m';
    case 'medium': return styles.yellow || '\x1b[33m';
    case 'low': return styles.brightCyan || '\x1b[36m';
    case 'info': return styles.dim || '\x1b[2m';
    default: return '';
  }
}

function printPluginInfo(manifest: { name: string; version: string; description: string; author?: string; homepage?: string; keywords?: string[]; rules: Array<{ id: string; name: string; description: string; severity: string; languages?: string[]; category?: string }> }, source: string): void {
  console.log(`\n${styles.bold}${manifest.name}${styles.reset} v${manifest.version} ${styles.dim}(${source})${styles.reset}`);
  console.log(`  ${manifest.description}`);
  if (manifest.author) console.log(`  ${styles.dim}Author: ${manifest.author}${styles.reset}`);
  if (manifest.homepage) console.log(`  ${styles.dim}Homepage: ${manifest.homepage}${styles.reset}`);
  if (manifest.keywords?.length) console.log(`  ${styles.dim}Tags: ${manifest.keywords.join(', ')}${styles.reset}`);
  console.log(`\n  ${styles.bold}Rules (${manifest.rules.length}):${styles.reset}\n`);

  for (const rule of manifest.rules) {
    const sevColor = getSeverityColor(rule.severity);
    console.log(`    ${styles.bold}${rule.id}${styles.reset} — ${rule.name}`);
    console.log(`      ${styles.dim}${rule.description}${styles.reset}`);
    console.log(`      ${sevColor}${rule.severity}${styles.reset} | ${styles.dim}${rule.languages?.join(', ') ?? 'any'}${styles.reset} | ${styles.dim}${rule.category ?? 'general'}${styles.reset}`);
  }
  console.log('');
}

function detectPackageManager(projectRoot: string): 'pnpm' | 'yarn' | 'npm' {
  if (existsSync(join(projectRoot, 'pnpm-lock.yaml'))) return 'pnpm';
  if (existsSync(join(projectRoot, 'yarn.lock'))) return 'yarn';
  return 'npm';
}

async function addPluginToConfig(projectRoot: string, packageName: string): Promise<void> {
  const configPath = join(projectRoot, 'guardrail.config.ts');

  if (existsSync(configPath)) {
    // TODO: Parse and update existing config file
    return;
  }

  // Create new config file
  writeFileSync(
    configPath,
    `import type { GuardrailPluginConfig } from '@guardrail/engines/plugins';

const config: GuardrailPluginConfig = {
  plugins: ['${packageName}'],
  rules: {
    // Override rule severities or disable rules:
    // 'RULE-001': 'off',
    // 'RULE-002': 'critical',
  },
};

export default config;
`
  );
}
