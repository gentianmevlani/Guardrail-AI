/**
 * Repo Fingerprint - Project Detection & Configuration
 * 
 * Detects project characteristics:
 * 1. Package manager (pnpm, yarn, npm)
 * 2. Build tool (turbo, nx, none)
 * 3. Framework (next, vite, cra, etc.)
 * 4. Test runner (jest, vitest, mocha, etc.)
 * 5. Language features (TypeScript, ESLint, etc.)
 */

import * as fs from 'fs';
import * as path from 'path';

// ============================================================================
// TYPES
// ============================================================================

export type PackageManager = 'pnpm' | 'yarn' | 'npm' | 'bun' | 'unknown';
export type BuildTool = 'turbo' | 'nx' | 'lerna' | 'none';
export type Framework = 'next' | 'vite' | 'cra' | 'remix' | 'gatsby' | 'nuxt' | 'svelte' | 'angular' | 'express' | 'fastify' | 'none';
export type TestRunner = 'jest' | 'vitest' | 'mocha' | 'ava' | 'playwright' | 'cypress' | 'none';

export interface RepoFingerprint {
  packageManager: PackageManager;
  buildTool: BuildTool;
  framework: Framework;
  testRunner: TestRunner;
  hasTypeScript: boolean;
  hasESLint: boolean;
  hasPrettier: boolean;
  hasBuildScript: boolean;
  hasTestScript: boolean;
  isMonorepo: boolean;
  workspaces: string[];
  nodeVersion?: string;
  dependencies: Record<string, string>;
  devDependencies: Record<string, string>;
}

export interface FingerprintResult {
  fingerprint: RepoFingerprint;
  confidence: number;
  detectionNotes: string[];
}

// ============================================================================
// DETECTION FUNCTIONS
// ============================================================================

/**
 * Detect package manager from lock files
 */
function detectPackageManager(projectPath: string): PackageManager {
  if (fs.existsSync(path.join(projectPath, 'pnpm-lock.yaml'))) {
    return 'pnpm';
  }
  if (fs.existsSync(path.join(projectPath, 'yarn.lock'))) {
    return 'yarn';
  }
  if (fs.existsSync(path.join(projectPath, 'bun.lockb'))) {
    return 'bun';
  }
  if (fs.existsSync(path.join(projectPath, 'package-lock.json'))) {
    return 'npm';
  }
  return 'unknown';
}

/**
 * Detect build tool (monorepo orchestrator)
 */
function detectBuildTool(projectPath: string, pkg: PackageJson): BuildTool {
  // Turbo
  if (
    fs.existsSync(path.join(projectPath, 'turbo.json')) ||
    pkg.devDependencies?.['turbo'] ||
    pkg.dependencies?.['turbo']
  ) {
    return 'turbo';
  }
  
  // Nx
  if (
    fs.existsSync(path.join(projectPath, 'nx.json')) ||
    pkg.devDependencies?.['nx'] ||
    pkg.dependencies?.['nx']
  ) {
    return 'nx';
  }
  
  // Lerna
  if (
    fs.existsSync(path.join(projectPath, 'lerna.json')) ||
    pkg.devDependencies?.['lerna']
  ) {
    return 'lerna';
  }
  
  return 'none';
}

/**
 * Detect framework from dependencies
 */
function detectFramework(pkg: PackageJson): Framework {
  const deps = { ...pkg.dependencies, ...pkg.devDependencies };
  
  // Next.js
  if (deps['next']) {
    return 'next';
  }
  
  // Remix
  if (deps['@remix-run/react'] || deps['remix']) {
    return 'remix';
  }
  
  // Gatsby
  if (deps['gatsby']) {
    return 'gatsby';
  }
  
  // Nuxt
  if (deps['nuxt'] || deps['nuxt3']) {
    return 'nuxt';
  }
  
  // SvelteKit
  if (deps['@sveltejs/kit'] || deps['svelte']) {
    return 'svelte';
  }
  
  // Angular
  if (deps['@angular/core']) {
    return 'angular';
  }
  
  // Vite (generic)
  if (deps['vite']) {
    return 'vite';
  }
  
  // Create React App
  if (deps['react-scripts']) {
    return 'cra';
  }
  
  // Express
  if (deps['express']) {
    return 'express';
  }
  
  // Fastify
  if (deps['fastify']) {
    return 'fastify';
  }
  
  return 'none';
}

/**
 * Detect test runner
 */
function detectTestRunner(projectPath: string, pkg: PackageJson): TestRunner {
  const deps = { ...pkg.dependencies, ...pkg.devDependencies };
  
  // Vitest
  if (deps['vitest']) {
    return 'vitest';
  }
  
  // Jest
  if (deps['jest'] || fs.existsSync(path.join(projectPath, 'jest.config.js')) ||
      fs.existsSync(path.join(projectPath, 'jest.config.ts'))) {
    return 'jest';
  }
  
  // Mocha
  if (deps['mocha']) {
    return 'mocha';
  }
  
  // AVA
  if (deps['ava']) {
    return 'ava';
  }
  
  // Playwright
  if (deps['@playwright/test'] || deps['playwright']) {
    return 'playwright';
  }
  
  // Cypress
  if (deps['cypress']) {
    return 'cypress';
  }
  
  return 'none';
}

/**
 * Detect if project is a monorepo
 */
function detectMonorepo(projectPath: string, pkg: PackageJson): { isMonorepo: boolean; workspaces: string[] } {
  // Check package.json workspaces
  if (pkg.workspaces) {
    const workspaces = Array.isArray(pkg.workspaces) 
      ? pkg.workspaces 
      : pkg.workspaces.packages || [];
    return { isMonorepo: true, workspaces };
  }
  
  // Check pnpm-workspace.yaml
  const pnpmWorkspacePath = path.join(projectPath, 'pnpm-workspace.yaml');
  if (fs.existsSync(pnpmWorkspacePath)) {
    try {
      const content = fs.readFileSync(pnpmWorkspacePath, 'utf8');
      const workspaces: string[] = [];
      const matches = content.match(/packages:\s*\n((?:\s+-\s*['"]?[^\n]+['"]?\n?)+)/);
      if (matches && matches[1]) {
        const lines = matches[1].split('\n');
        for (const line of lines) {
          const match = line.match(/^\s*-\s*['"]?([^'"]+)['"]?/);
          if (match && match[1]) {
            workspaces.push(match[1]);
          }
        }
      }
      return { isMonorepo: true, workspaces };
    } catch {
      return { isMonorepo: true, workspaces: [] };
    }
  }
  
  // Check for common monorepo directories
  const monorepoIndicators = ['packages', 'apps', 'libs', 'modules'];
  for (const dir of monorepoIndicators) {
    const dirPath = path.join(projectPath, dir);
    if (fs.existsSync(dirPath) && fs.statSync(dirPath).isDirectory()) {
      // Check if any subdirectory has a package.json
      try {
        const subdirs = fs.readdirSync(dirPath);
        for (const subdir of subdirs) {
          if (fs.existsSync(path.join(dirPath, subdir, 'package.json'))) {
            return { isMonorepo: true, workspaces: [`${dir}/*`] };
          }
        }
      } catch {
        // Ignore read errors
      }
    }
  }
  
  return { isMonorepo: false, workspaces: [] };
}

/**
 * Read Node.js version from .nvmrc or similar
 */
function readNodeVersion(projectPath: string): string | undefined {
  const versionFiles = ['.nvmrc', '.node-version', '.tool-versions'];
  
  for (const file of versionFiles) {
    const filePath = path.join(projectPath, file);
    if (fs.existsSync(filePath)) {
      try {
        const content = fs.readFileSync(filePath, 'utf8').trim();
        if (file === '.tool-versions') {
          const match = content.match(/nodejs\s+([^\s]+)/);
          return match ? match[1] : undefined;
        }
        return content.replace(/^v/, '');
      } catch {
        // Ignore read errors
      }
    }
  }
  
  return undefined;
}

// ============================================================================
// TYPES
// ============================================================================

interface PackageJson {
  name?: string;
  scripts?: Record<string, string>;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  workspaces?: string[] | { packages: string[] };
}

// ============================================================================
// MAIN FINGERPRINT FUNCTION
// ============================================================================

/**
 * Analyze a project and return its fingerprint
 */
export function fingerprintRepo(projectPath: string): FingerprintResult {
  const notes: string[] = [];
  let confidence = 100;
  
  // Read package.json
  const pkgPath = path.join(projectPath, 'package.json');
  let pkg: PackageJson = {};
  
  if (fs.existsSync(pkgPath)) {
    try {
      pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
    } catch (e) {
      notes.push(`Failed to parse package.json: ${(e as Error).message}`);
      confidence -= 20;
    }
  } else {
    notes.push('No package.json found');
    confidence -= 30;
  }
  
  const packageManager = detectPackageManager(projectPath);
  const buildTool = detectBuildTool(projectPath, pkg);
  const framework = detectFramework(pkg);
  const testRunner = detectTestRunner(projectPath, pkg);
  const { isMonorepo, workspaces } = detectMonorepo(projectPath, pkg);
  const nodeVersion = readNodeVersion(projectPath);
  
  // TypeScript detection
  const hasTypeScript = !!(
    fs.existsSync(path.join(projectPath, 'tsconfig.json')) ||
    pkg.devDependencies?.['typescript'] ||
    pkg.dependencies?.['typescript']
  );
  
  // ESLint detection
  const hasESLint = !!(
    fs.existsSync(path.join(projectPath, '.eslintrc.js')) ||
    fs.existsSync(path.join(projectPath, '.eslintrc.json')) ||
    fs.existsSync(path.join(projectPath, '.eslintrc.yml')) ||
    fs.existsSync(path.join(projectPath, 'eslint.config.js')) ||
    pkg.devDependencies?.['eslint']
  );
  
  // Prettier detection
  const hasPrettier = !!(
    fs.existsSync(path.join(projectPath, '.prettierrc')) ||
    fs.existsSync(path.join(projectPath, '.prettierrc.js')) ||
    fs.existsSync(path.join(projectPath, '.prettierrc.json')) ||
    fs.existsSync(path.join(projectPath, 'prettier.config.js')) ||
    pkg.devDependencies?.['prettier']
  );
  
  // Script detection
  const hasBuildScript = !!(pkg.scripts?.['build']);
  const hasTestScript = !!(pkg.scripts?.['test']);
  
  // Add detection notes
  if (packageManager === 'unknown') {
    notes.push('Could not detect package manager');
    confidence -= 10;
  }
  
  if (framework === 'none') {
    notes.push('No major framework detected');
  }
  
  if (testRunner === 'none') {
    notes.push('No test runner detected');
  }
  
  const fingerprint: RepoFingerprint = {
    packageManager,
    buildTool,
    framework,
    testRunner,
    hasTypeScript,
    hasESLint,
    hasPrettier,
    hasBuildScript,
    hasTestScript,
    isMonorepo,
    workspaces,
    nodeVersion,
    dependencies: pkg.dependencies || {},
    devDependencies: pkg.devDependencies || {},
  };
  
  return {
    fingerprint,
    confidence: Math.max(0, confidence),
    detectionNotes: notes,
  };
}

/**
 * Get appropriate install command for package manager
 */
export function getInstallCommand(packageManager: PackageManager): string {
  switch (packageManager) {
    case 'pnpm':
      return 'pnpm install --frozen-lockfile';
    case 'yarn':
      return 'yarn install --frozen-lockfile';
    case 'bun':
      return 'bun install --frozen-lockfile';
    case 'npm':
    default:
      return 'npm ci';
  }
}

/**
 * Get appropriate build command
 */
export function getBuildCommand(fingerprint: RepoFingerprint): string {
  if (fingerprint.buildTool === 'turbo') {
    return 'npx turbo run build';
  }
  if (fingerprint.buildTool === 'nx') {
    return 'npx nx run-many --target=build';
  }
  if (fingerprint.hasBuildScript) {
    return 'npm run build';
  }
  return 'echo "No build script"';
}

/**
 * Get appropriate test command
 */
export function getTestCommand(fingerprint: RepoFingerprint): string {
  switch (fingerprint.testRunner) {
    case 'vitest':
      return 'npx vitest run';
    case 'jest':
      return 'npx jest --passWithNoTests';
    case 'mocha':
      return 'npx mocha';
    case 'ava':
      return 'npx ava';
    case 'playwright':
      return 'npx playwright test';
    case 'cypress':
      return 'npx cypress run';
    default:
      return fingerprint.hasTestScript ? 'npm test' : 'echo "No test runner"';
  }
}

/**
 * Get typecheck command if TypeScript is present
 */
export function getTypecheckCommand(fingerprint: RepoFingerprint): string | null {
  if (!fingerprint.hasTypeScript) {
    return null;
  }
  return 'npx tsc --noEmit';
}
