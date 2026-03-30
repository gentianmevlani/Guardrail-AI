/**
 * Repo Fingerprint
 * Detects project tooling and configuration
 */

import * as fs from 'fs';
import * as path from 'path';
import { RepoFingerprint } from './types';

/**
 * Detect package manager from lockfiles
 */
function detectPackageManager(projectRoot: string): RepoFingerprint['packageManager'] {
  const lockfiles: Array<{ file: string; pm: RepoFingerprint['packageManager'] }> = [
    { file: 'pnpm-lock.yaml', pm: 'pnpm' },
    { file: 'yarn.lock', pm: 'yarn' },
    { file: 'bun.lockb', pm: 'bun' },
    { file: 'package-lock.json', pm: 'npm' },
  ];

  for (const { file, pm } of lockfiles) {
    if (fs.existsSync(path.join(projectRoot, file))) {
      return pm;
    }
  }

  return null;
}

/**
 * Detect framework from dependencies
 */
function detectFramework(packageJson: Record<string, unknown>): string | null {
  const deps = {
    ...(packageJson.dependencies as Record<string, string> || {}),
    ...(packageJson.devDependencies as Record<string, string> || {}),
  };

  const frameworks: Array<{ dep: string; name: string }> = [
    { dep: 'next', name: 'Next.js' },
    { dep: 'nuxt', name: 'Nuxt' },
    { dep: '@angular/core', name: 'Angular' },
    { dep: 'vue', name: 'Vue' },
    { dep: 'svelte', name: 'Svelte' },
    { dep: '@sveltejs/kit', name: 'SvelteKit' },
    { dep: 'react', name: 'React' },
    { dep: 'express', name: 'Express' },
    { dep: 'fastify', name: 'Fastify' },
    { dep: 'hono', name: 'Hono' },
    { dep: 'nest', name: 'NestJS' },
    { dep: '@nestjs/core', name: 'NestJS' },
    { dep: 'remix', name: 'Remix' },
    { dep: '@remix-run/node', name: 'Remix' },
    { dep: 'astro', name: 'Astro' },
  ];

  for (const { dep, name } of frameworks) {
    if (deps[dep]) {
      return name;
    }
  }

  return null;
}

/**
 * Detect monorepo tool
 */
function detectMonorepoTool(projectRoot: string, packageJson: Record<string, unknown>): RepoFingerprint['monorepoTool'] {
  const deps = {
    ...(packageJson.dependencies as Record<string, string> || {}),
    ...(packageJson.devDependencies as Record<string, string> || {}),
  };

  if (deps['turbo'] || fs.existsSync(path.join(projectRoot, 'turbo.json'))) {
    return 'turbo';
  }

  if (deps['nx'] || fs.existsSync(path.join(projectRoot, 'nx.json'))) {
    return 'nx';
  }

  if (deps['lerna'] || fs.existsSync(path.join(projectRoot, 'lerna.json'))) {
    return 'lerna';
  }

  if (fs.existsSync(path.join(projectRoot, 'rush.json'))) {
    return 'rush';
  }

  return null;
}

/**
 * Detect test runner
 */
function detectTestRunner(packageJson: Record<string, unknown>): RepoFingerprint['testRunner'] {
  const deps = {
    ...(packageJson.dependencies as Record<string, string> || {}),
    ...(packageJson.devDependencies as Record<string, string> || {}),
  };

  const scripts = packageJson.scripts as Record<string, string> || {};
  const testScript = scripts.test || '';

  // Check devDependencies first, then scripts
  if (deps['vitest'] || testScript.includes('vitest')) {
    return 'vitest';
  }

  if (deps['jest'] || testScript.includes('jest')) {
    return 'jest';
  }

  if (deps['mocha'] || testScript.includes('mocha')) {
    return 'mocha';
  }

  if (deps['ava'] || testScript.includes('ava')) {
    return 'ava';
  }

  return null;
}

/**
 * Detect linter
 */
function detectLinter(projectRoot: string, packageJson: Record<string, unknown>): RepoFingerprint['linter'] {
  const deps = {
    ...(packageJson.dependencies as Record<string, string> || {}),
    ...(packageJson.devDependencies as Record<string, string> || {}),
  };

  // Check for biome first (newer)
  if (deps['@biomejs/biome'] || fs.existsSync(path.join(projectRoot, 'biome.json'))) {
    return 'biome';
  }

  // ESLint configs
  const eslintConfigs = [
    '.eslintrc',
    '.eslintrc.js',
    '.eslintrc.cjs',
    '.eslintrc.json',
    '.eslintrc.yaml',
    '.eslintrc.yml',
    'eslint.config.js',
    'eslint.config.mjs',
  ];

  if (deps['eslint'] || eslintConfigs.some(f => fs.existsSync(path.join(projectRoot, f)))) {
    return 'eslint';
  }

  return null;
}

/**
 * Check for TypeScript
 */
function detectTypeScript(projectRoot: string, packageJson: Record<string, unknown>): boolean {
  const deps = {
    ...(packageJson.dependencies as Record<string, string> || {}),
    ...(packageJson.devDependencies as Record<string, string> || {}),
  };

  return !!(deps['typescript'] || fs.existsSync(path.join(projectRoot, 'tsconfig.json')));
}

/**
 * Check for git repository
 */
function detectGit(projectRoot: string): boolean {
  return fs.existsSync(path.join(projectRoot, '.git'));
}

/**
 * Get scripts from package.json
 */
function getScripts(packageJson: Record<string, unknown>): Record<string, string> {
  const scripts = packageJson.scripts;
  if (scripts && typeof scripts === 'object' && !Array.isArray(scripts)) {
    return scripts as Record<string, string>;
  }
  return {};
}

/**
 * Generate fingerprint for a project
 */
export function fingerprint(projectRoot: string): RepoFingerprint {
  let packageJson: Record<string, unknown> = {};

  const packageJsonPath = path.join(projectRoot, 'package.json');
  if (fs.existsSync(packageJsonPath)) {
    try {
      const content = fs.readFileSync(packageJsonPath, 'utf-8');
      packageJson = JSON.parse(content) as Record<string, unknown>;
    } catch {
      // Invalid package.json, continue with empty
    }
  }

  return {
    packageManager: detectPackageManager(projectRoot),
    framework: detectFramework(packageJson),
    monorepoTool: detectMonorepoTool(projectRoot, packageJson),
    testRunner: detectTestRunner(packageJson),
    linter: detectLinter(projectRoot, packageJson),
    typescript: detectTypeScript(projectRoot, packageJson),
    scripts: getScripts(packageJson),
    hasGit: detectGit(projectRoot),
  };
}

/**
 * Get the run command prefix for the detected package manager
 */
export function getRunPrefix(fp: RepoFingerprint): string {
  switch (fp.packageManager) {
    case 'pnpm':
      return 'pnpm';
    case 'yarn':
      return 'yarn';
    case 'bun':
      return 'bun';
    case 'npm':
    default:
      return 'npm run';
  }
}

/**
 * Get the install command for the detected package manager
 */
export function getInstallCommand(fp: RepoFingerprint): string {
  switch (fp.packageManager) {
    case 'pnpm':
      return 'pnpm install';
    case 'yarn':
      return 'yarn';
    case 'bun':
      return 'bun install';
    case 'npm':
    default:
      return 'npm install';
  }
}
