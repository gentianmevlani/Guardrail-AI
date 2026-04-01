"use strict";
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
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.fingerprintRepo = fingerprintRepo;
exports.getInstallCommand = getInstallCommand;
exports.getBuildCommand = getBuildCommand;
exports.getTestCommand = getTestCommand;
exports.getTypecheckCommand = getTypecheckCommand;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
// ============================================================================
// DETECTION FUNCTIONS
// ============================================================================
/**
 * Detect package manager from lock files
 */
function detectPackageManager(projectPath) {
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
function detectBuildTool(projectPath, pkg) {
    // Turbo
    if (fs.existsSync(path.join(projectPath, 'turbo.json')) ||
        pkg.devDependencies?.['turbo'] ||
        pkg.dependencies?.['turbo']) {
        return 'turbo';
    }
    // Nx
    if (fs.existsSync(path.join(projectPath, 'nx.json')) ||
        pkg.devDependencies?.['nx'] ||
        pkg.dependencies?.['nx']) {
        return 'nx';
    }
    // Lerna
    if (fs.existsSync(path.join(projectPath, 'lerna.json')) ||
        pkg.devDependencies?.['lerna']) {
        return 'lerna';
    }
    return 'none';
}
/**
 * Detect framework from dependencies
 */
function detectFramework(pkg) {
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
function detectTestRunner(projectPath, pkg) {
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
function detectMonorepo(projectPath, pkg) {
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
            const workspaces = [];
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
        }
        catch {
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
            }
            catch {
                // Ignore read errors
            }
        }
    }
    return { isMonorepo: false, workspaces: [] };
}
/**
 * Read Node.js version from .nvmrc or similar
 */
function readNodeVersion(projectPath) {
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
            }
            catch {
                // Ignore read errors
            }
        }
    }
    return undefined;
}
// ============================================================================
// MAIN FINGERPRINT FUNCTION
// ============================================================================
/**
 * Analyze a project and return its fingerprint
 */
function fingerprintRepo(projectPath) {
    const notes = [];
    let confidence = 100;
    // Read package.json
    const pkgPath = path.join(projectPath, 'package.json');
    let pkg = {};
    if (fs.existsSync(pkgPath)) {
        try {
            pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
        }
        catch (e) {
            notes.push(`Failed to parse package.json: ${e.message}`);
            confidence -= 20;
        }
    }
    else {
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
    const hasTypeScript = !!(fs.existsSync(path.join(projectPath, 'tsconfig.json')) ||
        pkg.devDependencies?.['typescript'] ||
        pkg.dependencies?.['typescript']);
    // ESLint detection
    const hasESLint = !!(fs.existsSync(path.join(projectPath, '.eslintrc.js')) ||
        fs.existsSync(path.join(projectPath, '.eslintrc.json')) ||
        fs.existsSync(path.join(projectPath, '.eslintrc.yml')) ||
        fs.existsSync(path.join(projectPath, 'eslint.config.js')) ||
        pkg.devDependencies?.['eslint']);
    // Prettier detection
    const hasPrettier = !!(fs.existsSync(path.join(projectPath, '.prettierrc')) ||
        fs.existsSync(path.join(projectPath, '.prettierrc.js')) ||
        fs.existsSync(path.join(projectPath, '.prettierrc.json')) ||
        fs.existsSync(path.join(projectPath, 'prettier.config.js')) ||
        pkg.devDependencies?.['prettier']);
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
    const fingerprint = {
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
function getInstallCommand(packageManager) {
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
function getBuildCommand(fingerprint) {
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
function getTestCommand(fingerprint) {
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
function getTypecheckCommand(fingerprint) {
    if (!fingerprint.hasTypeScript) {
        return null;
    }
    return 'npx tsc --noEmit';
}
