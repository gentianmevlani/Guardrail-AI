/**
 * guardrail context
 *
 * Generates a machine-readable context file that AI coding tools
 * can consume to avoid hallucinating routes, env vars, schemas, etc.
 *
 * Outputs .guardrail/context.md — a structured markdown file with:
 *   - Real routes (from truth pack)
 *   - Real env vars (from .env.example or truth pack)
 *   - Real schemas (from Prisma/Zod/OpenAPI)
 *   - Real dependencies (from package.json)
 *   - Coding rules and patterns
 *
 * AI tools (Claude, Cursor, Copilot) can reference this to stay grounded.
 */

import { Command } from 'commander';
import { resolve, join, basename } from 'path';
import { existsSync, readFileSync, writeFileSync, mkdirSync, readdirSync } from 'fs';
import { styles, icons } from '../ui';
import { createSteps } from '../ui/progress';
import { printLogo } from '../ui';

interface ContextData {
  projectName: string;
  framework: string;
  routes: Array<{ method: string; path: string; file: string }>;
  envVars: Array<{ name: string; required: boolean; description?: string }>;
  schemas: Array<{ name: string; type: string; file: string }>;
  dependencies: Record<string, string>;
  patterns: string[];
}

// ─────────────────────────────────────────────────────────────────────────────
// EXTRACTORS
// ─────────────────────────────────────────────────────────────────────────────

function extractEnvVars(projectPath: string): ContextData['envVars'] {
  const vars: ContextData['envVars'] = [];
  const envFiles = ['.env.example', '.env.sample', '.env.template', 'env.example'];

  for (const file of envFiles) {
    const filePath = join(projectPath, file);
    if (!existsSync(filePath)) continue;

    const content = readFileSync(filePath, 'utf-8');
    for (const line of content.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;

      const match = trimmed.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
      if (match) {
        const [, name, value] = match;
        vars.push({
          name,
          required: !value || value === '' || value.includes('your_') || value.includes('CHANGE_ME'),
          description: undefined,
        });
      }
    }
    break; // Use first found
  }

  return vars;
}

function extractRoutesFromTruthPack(projectPath: string): ContextData['routes'] {
  const routes: ContextData['routes'] = [];

  // Try truth pack context
  const contextPath = join(projectPath, '.guardrail-context', 'routes.json');
  if (existsSync(contextPath)) {
    try {
      const data = JSON.parse(readFileSync(contextPath, 'utf-8'));
      if (Array.isArray(data)) {
        for (const r of data) {
          routes.push({
            method: r.method || 'GET',
            path: r.path || r.route,
            file: r.file || 'unknown',
          });
        }
      }
      return routes;
    } catch { /* fall through */ }
  }

  // Try vibecheck truthpack
  const truthpackPath = join(projectPath, '.vibecheck', 'truthpack', 'routes.json');
  if (existsSync(truthpackPath)) {
    try {
      const data = JSON.parse(readFileSync(truthpackPath, 'utf-8'));
      if (data.routes && Array.isArray(data.routes)) {
        for (const r of data.routes) {
          routes.push({
            method: r.method || 'GET',
            path: r.path || r.route || r.url,
            file: r.file || r.handler || 'unknown',
          });
        }
      }
      return routes;
    } catch { /* fall through */ }
  }

  return routes;
}

function extractDependencies(projectPath: string): Record<string, string> {
  const pkgPath = join(projectPath, 'package.json');
  if (!existsSync(pkgPath)) return {};

  try {
    const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));
    return { ...pkg.dependencies, ...pkg.devDependencies };
  } catch {
    return {};
  }
}

function extractSchemas(projectPath: string): ContextData['schemas'] {
  const schemas: ContextData['schemas'] = [];

  // Check for Prisma
  const prismaPath = join(projectPath, 'prisma', 'schema.prisma');
  if (existsSync(prismaPath)) {
    const content = readFileSync(prismaPath, 'utf-8');
    const models = content.match(/model\s+(\w+)\s*\{/g);
    if (models) {
      for (const m of models) {
        const name = m.match(/model\s+(\w+)/)?.[1];
        if (name) schemas.push({ name, type: 'prisma', file: 'prisma/schema.prisma' });
      }
    }
  }

  return schemas;
}

function detectFrameworkFromPkg(projectPath: string): string {
  const pkgPath = join(projectPath, 'package.json');
  if (!existsSync(pkgPath)) return 'unknown';

  try {
    const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));
    const deps = { ...pkg.dependencies, ...pkg.devDependencies };
    if (deps.next) return 'Next.js';
    if (deps['@nestjs/core']) return 'NestJS';
    if (deps.fastify) return 'Fastify';
    if (deps.express) return 'Express';
    if (deps['@remix-run/node']) return 'Remix';
    if (deps.vite && deps.react) return 'Vite + React';
    return 'Node.js';
  } catch {
    return 'unknown';
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// CONTEXT MARKDOWN GENERATOR
// ─────────────────────────────────────────────────────────────────────────────

function generateContextMarkdown(data: ContextData): string {
  const lines: string[] = [];

  lines.push(`# Guardrail Context — ${data.projectName}`);
  lines.push('');
  lines.push('> This file is auto-generated by `guardrail context`.');
  lines.push('> AI coding tools should reference this to avoid hallucinating routes, env vars, and schemas.');
  lines.push('> Regenerate: `guardrail context`');
  lines.push('');

  // Framework
  lines.push(`## Framework`);
  lines.push(`- **${data.framework}**`);
  lines.push('');

  // Routes
  if (data.routes.length > 0) {
    lines.push(`## API Routes (${data.routes.length} verified)`);
    lines.push('');
    lines.push('| Method | Path | Handler |');
    lines.push('|--------|------|---------|');
    for (const r of data.routes.slice(0, 100)) {
      lines.push(`| ${r.method} | \`${r.path}\` | ${r.file} |`);
    }
    if (data.routes.length > 100) {
      lines.push(`| ... | ${data.routes.length - 100} more routes | ... |`);
    }
    lines.push('');
    lines.push('> DO NOT invent routes not in this table. If you need a new route, add it explicitly.');
    lines.push('');
  }

  // Env vars
  if (data.envVars.length > 0) {
    lines.push(`## Environment Variables (${data.envVars.length})`);
    lines.push('');
    for (const v of data.envVars) {
      const required = v.required ? ' **(required)**' : '';
      lines.push(`- \`${v.name}\`${required}`);
    }
    lines.push('');
    lines.push('> DO NOT fabricate environment variables. Only use variables listed above.');
    lines.push('');
  }

  // Schemas
  if (data.schemas.length > 0) {
    lines.push(`## Database Models (${data.schemas.length})`);
    lines.push('');
    for (const s of data.schemas) {
      lines.push(`- **${s.name}** (${s.type}) — \`${s.file}\``);
    }
    lines.push('');
    lines.push('> Reference actual model names and fields. Do not invent table names.');
    lines.push('');
  }

  // Key dependencies
  const keyDeps = Object.entries(data.dependencies)
    .filter(([name]) => !name.startsWith('@types/'))
    .slice(0, 30);

  if (keyDeps.length > 0) {
    lines.push(`## Key Dependencies`);
    lines.push('');
    for (const [name, version] of keyDeps) {
      lines.push(`- \`${name}\`: ${version}`);
    }
    lines.push('');
  }

  // Rules
  lines.push('## Coding Rules');
  lines.push('');
  lines.push('1. **Never hardcode secrets** — use `process.env.VAR_NAME`');
  lines.push('2. **Never use mock data in production code** — no `example.com`, `test@test.com`');
  lines.push('3. **All sensitive routes must have auth middleware**');
  lines.push('4. **Do not invent API routes** — check the routes table above');
  lines.push('5. **Do not invent env vars** — check the env vars list above');
  lines.push('6. **Run `guardrail scan` before committing** to verify');
  lines.push('');

  return lines.join('\n');
}

// ─────────────────────────────────────────────────────────────────────────────
// COMMAND
// ─────────────────────────────────────────────────────────────────────────────

export function registerContextCommand(program: Command): void {
  program
    .command('context')
    .description('Generate AI context file (.guardrail/context.md) with real routes, env vars, schemas')
    .option('-p, --path <path>', 'Project path', '.')
    .option('--json', 'Output as JSON instead of markdown')
    .option('--stdout', 'Print to stdout instead of writing file')
    .action(async (options) => {
      const projectPath = resolve(options.path);
      const projectName = basename(projectPath);
      const silent = Boolean(options.json && options.stdout);

      if (!silent && !options.stdout) {
        printLogo();
        console.log(`\n${styles.brightCyan}${styles.bold}  📋 CONTEXT GENERATION${styles.reset}`);
        console.log(`  ${styles.dim}${projectPath}${styles.reset}\n`);
      }

      const steps = silent ? null : createSteps(4);

      // Extract data
      if (steps) steps.start('Extracting routes');
      const routes = extractRoutesFromTruthPack(projectPath);
      if (steps) steps.complete(`${routes.length} routes found`);

      if (steps) steps.start('Extracting env vars');
      const envVars = extractEnvVars(projectPath);
      if (steps) steps.complete(`${envVars.length} env vars found`);

      if (steps) steps.start('Extracting schemas');
      const schemas = extractSchemas(projectPath);
      if (steps) steps.complete(`${schemas.length} schemas found`);

      if (steps) steps.start('Building context');
      const framework = detectFrameworkFromPkg(projectPath);
      const dependencies = extractDependencies(projectPath);

      const data: ContextData = {
        projectName,
        framework,
        routes,
        envVars,
        schemas,
        dependencies,
        patterns: [],
      };

      if (options.json) {
        const output = JSON.stringify(data, null, 2);
        if (options.stdout) {
          console.log(output);
        } else {
          const outPath = join(projectPath, '.guardrail', 'context.json');
          const outDir = join(projectPath, '.guardrail');
          if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });
          writeFileSync(outPath, output);
          if (steps) steps.complete(`Written to ${outPath}`);
        }
      } else {
        const markdown = generateContextMarkdown(data);
        if (options.stdout) {
          console.log(markdown);
        } else {
          const outPath = join(projectPath, '.guardrail', 'context.md');
          const outDir = join(projectPath, '.guardrail');
          if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });
          writeFileSync(outPath, markdown);
          if (steps) steps.complete(`Written to .guardrail/context.md`);
        }
      }

      if (!silent && !options.stdout) {
        console.log('');
        console.log(`  ${styles.brightGreen}${icons.success}${styles.reset} ${styles.bold}Context generated${styles.reset}`);
        console.log('');
        console.log(`  ${styles.bold}How to use:${styles.reset}`);
        console.log(`  ${styles.brightCyan}›${styles.reset} Claude Code:  Add to CLAUDE.md or .claude/CLAUDE.md`);
        console.log(`  ${styles.brightCyan}›${styles.reset} Cursor:       Add to .cursorrules`);
        console.log(`  ${styles.brightCyan}›${styles.reset} Copilot:      Add to .github/copilot-instructions.md`);
        console.log(`  ${styles.brightCyan}›${styles.reset} Any AI:       Reference .guardrail/context.md in your prompt`);
        console.log('');
      }
    });
}
