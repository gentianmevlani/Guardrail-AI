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
/**
 * Analyze a project and return its fingerprint
 */
export declare function fingerprintRepo(projectPath: string): FingerprintResult;
/**
 * Get appropriate install command for package manager
 */
export declare function getInstallCommand(packageManager: PackageManager): string;
/**
 * Get appropriate build command
 */
export declare function getBuildCommand(fingerprint: RepoFingerprint): string;
/**
 * Get appropriate test command
 */
export declare function getTestCommand(fingerprint: RepoFingerprint): string;
/**
 * Get typecheck command if TypeScript is present
 */
export declare function getTypecheckCommand(fingerprint: RepoFingerprint): string | null;
//# sourceMappingURL=repo-fingerprint.d.ts.map