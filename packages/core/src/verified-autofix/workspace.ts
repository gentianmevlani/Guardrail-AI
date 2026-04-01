/**
 * Temp Workspace Manager - Isolated Verification Environment
 * 
 * Creates isolated workspaces for testing patches:
 * 1. Prefers git worktree when available
 * 2. Falls back to directory copy
 * 3. Applies diffs with git apply --check validation
 * 4. Runs verification commands (typecheck, build, tests)
 */

import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { execSync, ExecSyncOptionsWithBufferEncoding } from 'child_process';
import type { ParsedHunk } from './format-validator';
import type { RepoFingerprint } from './repo-fingerprint';

// ============================================================================
// TYPES
// ============================================================================

export interface WorkspaceOptions {
  projectPath: string;
  useWorktree?: boolean;
  installDeps?: boolean;
  timeout?: number;
}

export interface WorkspaceInfo {
  id: string;
  path: string;
  type: 'worktree' | 'copy';
  projectPath: string;
  createdAt: Date;
}

export interface ApplyResult {
  success: boolean;
  applied: number;
  failed: number;
  errors: string[];
}

export interface VerifyResult {
  passed: boolean;
  checks: CheckResult[];
  duration: number;
  failureContext: string[];
}

export interface CheckResult {
  name: string;
  command: string;
  passed: boolean;
  output: string;
  duration: number;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const WORKSPACE_BASE_DIR = path.join(require('os').tmpdir(), 'guardrail-verified-autofix');
const DEFAULT_TIMEOUT = 120000; // 2 minutes per command
const MAX_OUTPUT_LINES = 100;

const EXCLUDE_PATTERNS = [
  'node_modules',
  '.git',
  'dist',
  'build',
  '.next',
  '.nuxt',
  '.output',
  '__pycache__',
  '.cache',
  'coverage',
  '.turbo',
];

// ============================================================================
// WORKSPACE MANAGER CLASS
// ============================================================================

export class TempWorkspace {
  private workspaces: Map<string, WorkspaceInfo> = new Map();
  
  /**
   * Create an isolated workspace for verification
   */
  async create(options: WorkspaceOptions): Promise<WorkspaceInfo> {
    const id = crypto.randomBytes(8).toString('hex');
    const workspacePath = path.join(WORKSPACE_BASE_DIR, id);
    
    await fs.promises.mkdir(workspacePath, { recursive: true });
    
    let type: 'worktree' | 'copy' = 'copy';
    
    // Try git worktree first (much faster, shares objects)
    if (options.useWorktree !== false) {
      const worktreeCreated = await this.tryCreateWorktree(
        options.projectPath,
        workspacePath
      );
      if (worktreeCreated) {
        type = 'worktree';
      }
    }
    
    // Fall back to copy
    if (type === 'copy') {
      await this.copyProject(options.projectPath, workspacePath);
    }
    
    // Install dependencies if requested
    if (options.installDeps) {
      await this.installDependencies(workspacePath, options.timeout);
    }
    
    const info: WorkspaceInfo = {
      id,
      path: workspacePath,
      type,
      projectPath: options.projectPath,
      createdAt: new Date(),
    };
    
    this.workspaces.set(id, info);
    return info;
  }
  
  /**
   * Apply a unified diff to the workspace
   */
  async applyDiff(
    workspacePath: string,
    diff: string,
    hunks: ParsedHunk[]
  ): Promise<ApplyResult> {
    const errors: string[] = [];
    let applied = 0;
    let failed = 0;
    
    // First, try git apply --check to validate
    const gitCheckResult = await this.tryGitApply(workspacePath, diff, true);
    
    if (gitCheckResult.success) {
      // Git apply --check passed, do the real apply
      const gitApplyResult = await this.tryGitApply(workspacePath, diff, false);
      if (gitApplyResult.success) {
        return { success: true, applied: hunks.length, failed: 0, errors: [] };
      }
      errors.push(`git apply failed: ${gitApplyResult.error}`);
    } else {
      errors.push(`git apply --check failed: ${gitCheckResult.error}`);
    }
    
    // Fall back to manual hunk application
    for (const hunk of hunks) {
      try {
        await this.applyHunk(workspacePath, hunk);
        applied++;
      } catch (e) {
        failed++;
        errors.push(`Failed to apply hunk to ${hunk.file}: ${(e as Error).message}`);
      }
    }
    
    return {
      success: failed === 0,
      applied,
      failed,
      errors,
    };
  }
  
  /**
   * Run verification checks in the workspace
   */
  async verify(
    workspacePath: string,
    fingerprint: RepoFingerprint,
    options?: { skipTests?: boolean; timeout?: number }
  ): Promise<VerifyResult> {
    const startTime = Date.now();
    const checks: CheckResult[] = [];
    const timeout = options?.timeout || DEFAULT_TIMEOUT;
    
    // Build verification command list based on fingerprint
    const commands = this.getVerificationCommands(fingerprint, options?.skipTests);
    
    for (const { name, command } of commands) {
      const checkStart = Date.now();
      let passed = false;
      let output = '';
      
      try {
        const result = execSync(command, {
          cwd: workspacePath,
          encoding: 'utf8',
          timeout,
          stdio: ['pipe', 'pipe', 'pipe'],
          env: {
            ...process.env,
            CI: 'true',
            NODE_ENV: 'test',
          },
        });
        passed = true;
        output = this.truncateOutput(result);
      } catch (e) {
        const err = e as { stdout?: string; stderr?: string; message: string };
        output = this.truncateOutput(
          (err.stderr || '') + '\n' + (err.stdout || '') || err.message
        );
      }
      
      checks.push({
        name,
        command,
        passed,
        output,
        duration: Date.now() - checkStart,
      });
      
      // Stop on first failure for faster feedback
      if (!passed) break;
    }
    
    // Extract top 3 failure contexts
    const failureContext = this.extractFailureContext(checks);
    
    return {
      passed: checks.every(c => c.passed),
      checks,
      duration: Date.now() - startTime,
      failureContext,
    };
  }
  
  /**
   * Copy changes back to the original project
   */
  async copyBack(workspacePath: string, projectPath: string, files: string[]): Promise<void> {
    for (const file of files) {
      const src = path.join(workspacePath, file);
      const dest = path.join(projectPath, file);
      
      try {
        // Create backup
        if (fs.existsSync(dest)) {
          await fs.promises.copyFile(dest, `${dest}.guardrail-backup`);
        }
        
        // Copy new version
        await fs.promises.mkdir(path.dirname(dest), { recursive: true });
        await fs.promises.copyFile(src, dest);
      } catch (e) {
        throw new Error(`Failed to copy ${file}: ${(e as Error).message}`);
      }
    }
  }
  
  /**
   * Cleanup a workspace
   */
  async cleanup(workspaceId: string): Promise<void> {
    const info = this.workspaces.get(workspaceId);
    if (!info) return;
    
    // Remove git worktree if applicable
    if (info.type === 'worktree') {
      try {
        execSync(`git worktree remove "${info.path}" --force`, {
          cwd: info.projectPath,
          stdio: 'pipe',
        });
      } catch {
        // Fall through to rm
      }
    }
    
    // Remove directory
    try {
      await fs.promises.rm(info.path, { recursive: true, force: true });
    } catch {
      // Ignore errors
    }
    
    this.workspaces.delete(workspaceId);
  }
  
  /**
   * Cleanup all workspaces
   */
  async cleanupAll(): Promise<void> {
    for (const id of this.workspaces.keys()) {
      await this.cleanup(id);
    }
  }
  
  // ==========================================================================
  // PRIVATE METHODS
  // ==========================================================================
  
  private async tryCreateWorktree(
    projectPath: string,
    workspacePath: string
  ): Promise<boolean> {
    try {
      const gitDir = path.join(projectPath, '.git');
      if (!fs.existsSync(gitDir)) {
        return false;
      }
      
      execSync(`git worktree add "${workspacePath}" HEAD --detach`, {
        cwd: projectPath,
        stdio: 'pipe',
      });
      
      return true;
    } catch {
      return false;
    }
  }
  
  private async copyProject(src: string, dest: string): Promise<void> {
    const entries = await fs.promises.readdir(src, { withFileTypes: true });
    
    for (const entry of entries) {
      if (EXCLUDE_PATTERNS.includes(entry.name)) {
        continue;
      }
      
      const srcPath = path.join(src, entry.name);
      const destPath = path.join(dest, entry.name);
      
      if (entry.isDirectory()) {
        await fs.promises.mkdir(destPath, { recursive: true });
        await this.copyProject(srcPath, destPath);
      } else if (entry.isFile()) {
        await fs.promises.copyFile(srcPath, destPath);
      }
    }
  }
  
  private async installDependencies(workspacePath: string, timeout?: number): Promise<void> {
    const execOpts: ExecSyncOptionsWithBufferEncoding = {
      cwd: workspacePath,
      stdio: 'pipe',
      timeout: timeout || DEFAULT_TIMEOUT,
    };
    
    // Detect package manager
    if (fs.existsSync(path.join(workspacePath, 'pnpm-lock.yaml'))) {
      execSync('pnpm install --frozen-lockfile', execOpts);
    } else if (fs.existsSync(path.join(workspacePath, 'yarn.lock'))) {
      execSync('yarn install --frozen-lockfile', execOpts);
    } else if (fs.existsSync(path.join(workspacePath, 'package-lock.json'))) {
      execSync('npm ci', execOpts);
    }
  }
  
  private async tryGitApply(
    workspacePath: string,
    diff: string,
    checkOnly: boolean
  ): Promise<{ success: boolean; error?: string }> {
    const tempFile = path.join(workspacePath, '.guardrail-patch.diff');
    
    try {
      await fs.promises.writeFile(tempFile, diff);
      
      const cmd = checkOnly
        ? `git apply --check "${tempFile}"`
        : `git apply "${tempFile}"`;
      
      execSync(cmd, {
        cwd: workspacePath,
        stdio: 'pipe',
      });
      
      return { success: true };
    } catch (e) {
      const err = e as { stderr?: Buffer; message: string };
      return {
        success: false,
        error: err.stderr?.toString() || err.message,
      };
    } finally {
      try {
        await fs.promises.unlink(tempFile);
      } catch {
        // Ignore
      }
    }
  }
  
  private async applyHunk(workspacePath: string, hunk: ParsedHunk): Promise<void> {
    const filePath = path.join(workspacePath, hunk.file);
    
    // Ensure directory exists
    await fs.promises.mkdir(path.dirname(filePath), { recursive: true });
    
    // Read existing content or empty for new files
    let content = '';
    try {
      content = await fs.promises.readFile(filePath, 'utf8');
    } catch {
      // New file
    }
    
    const lines = content.split('\n');
    const hunkLines = hunk.content.split('\n').filter(l => !l.startsWith('@@'));
    
    const result: string[] = [];
    let srcIdx = 0;
    
    // Copy lines before hunk
    while (srcIdx < hunk.oldStart - 1 && srcIdx < lines.length) {
      result.push(lines[srcIdx] || '');
      srcIdx++;
    }
    
    // Process hunk
    for (const line of hunkLines) {
      if (line.startsWith('-')) {
        srcIdx++; // Skip deleted line
      } else if (line.startsWith('+')) {
        result.push(line.slice(1)); // Add new line
      } else if (line.startsWith(' ') || line === '') {
        if (srcIdx < lines.length) {
          result.push(lines[srcIdx] || '');
          srcIdx++;
        }
      }
    }
    
    // Copy remaining lines
    while (srcIdx < lines.length) {
      result.push(lines[srcIdx] || '');
      srcIdx++;
    }
    
    await fs.promises.writeFile(filePath, result.join('\n'));
  }
  
  private getVerificationCommands(
    fingerprint: RepoFingerprint,
    skipTests?: boolean
  ): Array<{ name: string; command: string }> {
    const commands: Array<{ name: string; command: string }> = [];
    
    // TypeScript check
    if (fingerprint.hasTypeScript) {
      commands.push({
        name: 'TypeScript',
        command: 'npx tsc --noEmit',
      });
    }
    
    // Build check based on framework
    if (fingerprint.buildTool === 'turbo') {
      commands.push({ name: 'Build (Turbo)', command: 'npx turbo run build' });
    } else if (fingerprint.buildTool === 'nx') {
      commands.push({ name: 'Build (Nx)', command: 'npx nx run-many --target=build' });
    } else if (fingerprint.framework === 'next') {
      commands.push({ name: 'Build (Next.js)', command: 'npm run build' });
    } else if (fingerprint.framework === 'vite') {
      commands.push({ name: 'Build (Vite)', command: 'npm run build' });
    } else if (fingerprint.hasBuildScript) {
      commands.push({ name: 'Build', command: 'npm run build' });
    }
    
    // Tests (optional)
    if (!skipTests && fingerprint.testRunner) {
      const testCmd = fingerprint.testRunner === 'vitest' 
        ? 'npx vitest run'
        : fingerprint.testRunner === 'jest'
          ? 'npx jest --passWithNoTests'
          : 'npm test';
      commands.push({ name: `Tests (${fingerprint.testRunner})`, command: testCmd });
    }
    
    return commands;
  }
  
  private truncateOutput(output: string): string {
    const lines = output.split('\n');
    if (lines.length <= MAX_OUTPUT_LINES) {
      return output;
    }
    return lines.slice(0, MAX_OUTPUT_LINES).join('\n') + `\n... (${lines.length - MAX_OUTPUT_LINES} more lines)`;
  }
  
  private extractFailureContext(checks: CheckResult[]): string[] {
    const failures: string[] = [];
    
    for (const check of checks) {
      if (check.passed) continue;
      
      const lines = check.output.split('\n');
      const errorLines: string[] = [];
      
      for (const line of lines) {
        // TypeScript errors
        if (line.includes('error TS') || line.includes(': error')) {
          errorLines.push(line.trim());
        }
        // Build errors
        else if (line.includes('Error:') || line.includes('error:')) {
          errorLines.push(line.trim());
        }
        // Test failures
        else if (line.includes('FAIL') || line.includes('✗') || line.includes('×')) {
          errorLines.push(line.trim());
        }
        
        if (errorLines.length >= 3) break;
      }
      
      failures.push(...errorLines);
      if (failures.length >= 3) break;
    }
    
    return failures.slice(0, 3);
  }
}

// Export singleton
export const tempWorkspace = new TempWorkspace();
