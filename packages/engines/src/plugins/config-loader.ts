/**
 * ConfigLoader — Loads guardrail.config.ts/js/json for plugin configuration.
 *
 * Search order:
 * 1. guardrail.config.ts
 * 2. guardrail.config.js
 * 3. guardrail.config.mjs
 * 4. guardrail.config.json
 * 5. .guardrailrc (JSON — existing format, extended with plugin fields)
 * 6. package.json "guardrail" key
 */

import * as path from 'path';
import * as fs from 'fs';
import type { GuardrailPluginConfig } from './types';

const CONFIG_FILES = [
  'guardrail.config.ts',
  'guardrail.config.js',
  'guardrail.config.mjs',
  'guardrail.config.json',
  '.guardrailrc',
];

/**
 * Load the guardrail plugin config from the project root.
 * Returns a merged config with defaults for any missing fields.
 */
export async function loadGuardrailConfig(
  projectRoot: string
): Promise<GuardrailPluginConfig> {
  // Try config files in priority order
  for (const filename of CONFIG_FILES) {
    const configPath = path.join(projectRoot, filename);
    if (!fs.existsSync(configPath)) continue;

    try {
      if (filename.endsWith('.json') || filename === '.guardrailrc') {
        const raw = fs.readFileSync(configPath, 'utf-8');
        const parsed = JSON.parse(raw);
        return extractPluginConfig(parsed);
      }

      // TypeScript/JavaScript config — dynamic import
      const mod = await import(configPath);
      const config = mod.default ?? mod;
      return extractPluginConfig(config);
    } catch (err) {
      // Log but don't throw — fall through to next candidate
      console.warn(
        `Warning: Failed to load config from ${filename}: ${err instanceof Error ? err.message : String(err)}`
      );
    }
  }

  // Try package.json "guardrail" key
  const pkgPath = path.join(projectRoot, 'package.json');
  if (fs.existsSync(pkgPath)) {
    try {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
      if (pkg.guardrail && typeof pkg.guardrail === 'object') {
        return extractPluginConfig(pkg.guardrail);
      }
    } catch {
      // Ignore
    }
  }

  // No config found — return empty (no plugins)
  return { plugins: [], rules: {} };
}

/** Extract and validate plugin-related config from a raw config object. */
function extractPluginConfig(raw: Record<string, unknown>): GuardrailPluginConfig {
  const config: GuardrailPluginConfig = {};

  if (Array.isArray(raw.plugins)) {
    config.plugins = raw.plugins.filter((p): p is string => typeof p === 'string');
  }

  if (raw.rules && typeof raw.rules === 'object' && !Array.isArray(raw.rules)) {
    config.rules = raw.rules as Record<string, any>;
  }

  if (typeof raw.framework === 'string') {
    config.framework = raw.framework;
  }

  if (Array.isArray(raw.languages)) {
    config.languages = raw.languages.filter((l): l is any => typeof l === 'string');
  }

  return config;
}

/**
 * Auto-detect framework from project root by checking for framework-specific files.
 * Used to suggest relevant plugins during `guardrail init`.
 */
export function detectFramework(projectRoot: string): string | null {
  const checks: Array<{ framework: string; markers: string[] }> = [
    { framework: 'nextjs', markers: ['next.config.js', 'next.config.ts', 'next.config.mjs'] },
    { framework: 'express', markers: ['app.js', 'server.js', 'app.ts', 'server.ts'] },
    { framework: 'fastapi', markers: ['main.py', 'app.py'] },
    { framework: 'django', markers: ['manage.py', 'settings.py'] },
    { framework: 'flask', markers: ['app.py', 'wsgi.py'] },
    { framework: 'rails', markers: ['Gemfile', 'config/routes.rb'] },
    { framework: 'nestjs', markers: ['nest-cli.json'] },
    { framework: 'nuxt', markers: ['nuxt.config.ts', 'nuxt.config.js'] },
    { framework: 'sveltekit', markers: ['svelte.config.js'] },
    { framework: 'remix', markers: ['remix.config.js'] },
  ];

  // Also check package.json dependencies
  const pkgPath = path.join(projectRoot, 'package.json');
  let pkgDeps: Record<string, string> = {};
  if (fs.existsSync(pkgPath)) {
    try {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
      pkgDeps = { ...pkg.dependencies, ...pkg.devDependencies };
    } catch {
      // Ignore
    }
  }

  // Check dependency-based detection
  if (pkgDeps['next']) return 'nextjs';
  if (pkgDeps['express']) return 'express';
  if (pkgDeps['@nestjs/core']) return 'nestjs';
  if (pkgDeps['nuxt']) return 'nuxt';
  if (pkgDeps['@sveltejs/kit']) return 'sveltekit';
  if (pkgDeps['@remix-run/node']) return 'remix';

  // Check file markers
  for (const { framework, markers } of checks) {
    for (const marker of markers) {
      if (fs.existsSync(path.join(projectRoot, marker))) {
        return framework;
      }
    }
  }

  // Check for Python frameworks via requirements.txt or pyproject.toml
  const requirementsPath = path.join(projectRoot, 'requirements.txt');
  if (fs.existsSync(requirementsPath)) {
    const content = fs.readFileSync(requirementsPath, 'utf-8').toLowerCase();
    if (content.includes('fastapi')) return 'fastapi';
    if (content.includes('django')) return 'django';
    if (content.includes('flask')) return 'flask';
  }

  const pyprojectPath = path.join(projectRoot, 'pyproject.toml');
  if (fs.existsSync(pyprojectPath)) {
    const content = fs.readFileSync(pyprojectPath, 'utf-8').toLowerCase();
    if (content.includes('fastapi')) return 'fastapi';
    if (content.includes('django')) return 'django';
    if (content.includes('flask')) return 'flask';
  }

  return null;
}
