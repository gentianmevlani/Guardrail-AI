/**
 * Workspace Tests - Temp Workspace Manager
 * 
 * Tests for isolated workspace verification:
 * - Workspace creation (copy and worktree)
 * - Diff application via git apply
 * - Verification command execution
 * - Top 3 failure context extraction
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { execSync } from 'child_process';
import { TempWorkspace } from '../workspace';
import type { ParsedHunk } from '../format-validator';
import type { RepoFingerprint } from '../repo-fingerprint';

describe('TempWorkspace', () => {
  let tempDir: string;
  let workspace: TempWorkspace;

  beforeEach(async () => {
    tempDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'workspace-test-'));
    workspace = new TempWorkspace();
    
    // Create minimal project structure
    await fs.promises.writeFile(
      path.join(tempDir, 'package.json'),
      JSON.stringify({
        name: 'test-project',
        version: '1.0.0',
        scripts: {
          build: 'echo "build complete"',
          test: 'echo "tests passed"',
        },
      })
    );
    
    // Create a source file
    await fs.promises.mkdir(path.join(tempDir, 'src'), { recursive: true });
    await fs.promises.writeFile(
      path.join(tempDir, 'src', 'index.ts'),
      'export const version = "1.0.0";\n'
    );
  });

  afterEach(async () => {
    await workspace.cleanupAll();
    await fs.promises.rm(tempDir, { recursive: true, force: true });
  });

  describe('create', () => {
    it('creates workspace via copy when not a git repo', async () => {
      const info = await workspace.create({
        projectPath: tempDir,
        useWorktree: true, // Will fall back to copy since no .git
      });

      expect(info.type).toBe('copy');
      expect(fs.existsSync(info.path)).toBe(true);
      expect(fs.existsSync(path.join(info.path, 'package.json'))).toBe(true);
      expect(fs.existsSync(path.join(info.path, 'src', 'index.ts'))).toBe(true);
    });

    it('excludes node_modules from copy', async () => {
      // Create fake node_modules
      await fs.promises.mkdir(path.join(tempDir, 'node_modules', 'lodash'), { recursive: true });
      await fs.promises.writeFile(
        path.join(tempDir, 'node_modules', 'lodash', 'index.js'),
        'module.exports = {};'
      );

      const info = await workspace.create({
        projectPath: tempDir,
      });

      expect(fs.existsSync(path.join(info.path, 'node_modules'))).toBe(false);
    });

    it('excludes .git from copy', async () => {
      // Create fake .git
      await fs.promises.mkdir(path.join(tempDir, '.git'), { recursive: true });
      await fs.promises.writeFile(path.join(tempDir, '.git', 'config'), '');

      const info = await workspace.create({
        projectPath: tempDir,
        useWorktree: false, // Force copy mode
      });

      expect(fs.existsSync(path.join(info.path, '.git'))).toBe(false);
    });
  });

  describe('applyDiff', () => {
    it('applies simple hunk to file', async () => {
      const info = await workspace.create({ projectPath: tempDir });
      
      const hunks: ParsedHunk[] = [{
        file: 'src/index.ts',
        oldStart: 1,
        oldLines: 1,
        newStart: 1,
        newLines: 2,
        content: `@@ -1,1 +1,2 @@
 export const version = "1.0.0";
+export const name = "test";`,
      }];

      const diff = `--- a/src/index.ts
+++ b/src/index.ts
@@ -1,1 +1,2 @@
 export const version = "1.0.0";
+export const name = "test";`;

      const result = await workspace.applyDiff(info.path, diff, hunks);
      
      expect(result.success).toBe(true);
      expect(result.applied).toBe(1);
      expect(result.errors).toHaveLength(0);

      // Verify file was modified
      const content = await fs.promises.readFile(
        path.join(info.path, 'src', 'index.ts'),
        'utf8'
      );
      expect(content).toContain('export const name = "test"');
    });

    it('creates new file from diff', async () => {
      const info = await workspace.create({ projectPath: tempDir });
      
      const hunks: ParsedHunk[] = [{
        file: 'src/utils.ts',
        oldStart: 0,
        oldLines: 0,
        newStart: 1,
        newLines: 1,
        content: `@@ -0,0 +1,1 @@
+export const add = (a: number, b: number) => a + b;`,
      }];

      const diff = `--- /dev/null
+++ b/src/utils.ts
@@ -0,0 +1,1 @@
+export const add = (a: number, b: number) => a + b;`;

      const result = await workspace.applyDiff(info.path, diff, hunks);
      
      expect(result.applied).toBeGreaterThan(0);
      expect(fs.existsSync(path.join(info.path, 'src', 'utils.ts'))).toBe(true);
    });
  });

  describe('verify', () => {
    it('runs verification commands based on fingerprint', async () => {
      const info = await workspace.create({ projectPath: tempDir });
      
      const fingerprint: RepoFingerprint = {
        packageManager: 'npm',
        buildTool: 'none',
        framework: 'none',
        testRunner: 'none',
        hasTypeScript: false,
        hasESLint: false,
        hasPrettier: false,
        hasBuildScript: true,
        hasTestScript: true,
        isMonorepo: false,
        workspaces: [],
        dependencies: {},
        devDependencies: {},
      };

      const result = await workspace.verify(info.path, fingerprint, {
        skipTests: true,
      });

      // Build should pass (echo command)
      expect(result.passed).toBe(true);
      expect(result.checks.length).toBeGreaterThan(0);
    });

    it('extracts top 3 failure context on error', async () => {
      const info = await workspace.create({ projectPath: tempDir });
      
      // Create a failing build script
      await fs.promises.writeFile(
        path.join(info.path, 'package.json'),
        JSON.stringify({
          name: 'test',
          scripts: {
            build: 'echo "error TS2322: Type mismatch" && echo "error TS2345: Wrong arg" && echo "error TS2339: Missing prop" && exit 1',
          },
        })
      );
      
      const fingerprint: RepoFingerprint = {
        packageManager: 'npm',
        buildTool: 'none',
        framework: 'none',
        testRunner: 'none',
        hasTypeScript: false,
        hasESLint: false,
        hasPrettier: false,
        hasBuildScript: true,
        hasTestScript: false,
        isMonorepo: false,
        workspaces: [],
        dependencies: {},
        devDependencies: {},
      };

      const result = await workspace.verify(info.path, fingerprint, {
        skipTests: true,
      });

      expect(result.passed).toBe(false);
      expect(result.failureContext.length).toBeLessThanOrEqual(3);
    });
  });

  describe('copyBack', () => {
    it('copies modified files back to project', async () => {
      const info = await workspace.create({ projectPath: tempDir });
      
      // Modify file in workspace
      await fs.promises.writeFile(
        path.join(info.path, 'src', 'index.ts'),
        'export const version = "2.0.0";\n'
      );

      await workspace.copyBack(info.path, tempDir, ['src/index.ts']);

      // Verify original project was updated
      const content = await fs.promises.readFile(
        path.join(tempDir, 'src', 'index.ts'),
        'utf8'
      );
      expect(content).toBe('export const version = "2.0.0";\n');
    });

    it('creates backup before overwriting', async () => {
      const info = await workspace.create({ projectPath: tempDir });
      
      // Modify file in workspace
      await fs.promises.writeFile(
        path.join(info.path, 'src', 'index.ts'),
        'export const version = "2.0.0";\n'
      );

      await workspace.copyBack(info.path, tempDir, ['src/index.ts']);

      // Backup should exist
      const backupPath = path.join(tempDir, 'src', 'index.ts.guardrail-backup');
      expect(fs.existsSync(backupPath)).toBe(true);
      
      const backupContent = await fs.promises.readFile(backupPath, 'utf8');
      expect(backupContent).toBe('export const version = "1.0.0";\n');
    });
  });

  describe('cleanup', () => {
    it('removes workspace directory', async () => {
      const info = await workspace.create({ projectPath: tempDir });
      const workspacePath = info.path;
      
      expect(fs.existsSync(workspacePath)).toBe(true);
      
      await workspace.cleanup(info.id);
      
      expect(fs.existsSync(workspacePath)).toBe(false);
    });
  });
});

describe('TempWorkspace with git repo', () => {
  let tempDir: string;
  let workspace: TempWorkspace;
  let isGitAvailable: boolean;

  beforeAll(() => {
    // Check if git is available
    try {
      execSync('git --version', { stdio: 'pipe' });
      isGitAvailable = true;
    } catch {
      isGitAvailable = false;
    }
  });

  beforeEach(async () => {
    if (!isGitAvailable) return;
    
    tempDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'workspace-git-test-'));
    workspace = new TempWorkspace();
    
    // Initialize git repo
    execSync('git init', { cwd: tempDir, stdio: 'pipe' });
    execSync('git config user.email "test@test.com"', { cwd: tempDir, stdio: 'pipe' });
    execSync('git config user.name "Test"', { cwd: tempDir, stdio: 'pipe' });
    
    // Create and commit a file
    await fs.promises.writeFile(
      path.join(tempDir, 'file.ts'),
      'const x = 1;\n'
    );
    execSync('git add .', { cwd: tempDir, stdio: 'pipe' });
    execSync('git commit -m "initial"', { cwd: tempDir, stdio: 'pipe' });
  });

  afterEach(async () => {
    if (!isGitAvailable) return;
    
    await workspace.cleanupAll();
    await fs.promises.rm(tempDir, { recursive: true, force: true });
  });

  it('uses git worktree when available', async () => {
    if (!isGitAvailable) {
      console.log('Skipping git worktree test - git not available');
      return;
    }

    const info = await workspace.create({
      projectPath: tempDir,
      useWorktree: true,
    });

    expect(info.type).toBe('worktree');
    expect(fs.existsSync(path.join(info.path, 'file.ts'))).toBe(true);
  });

  it('applies diff with git apply', async () => {
    if (!isGitAvailable) {
      console.log('Skipping git apply test - git not available');
      return;
    }

    const info = await workspace.create({
      projectPath: tempDir,
      useWorktree: true,
    });

    const diff = `--- a/file.ts
+++ b/file.ts
@@ -1 +1,2 @@
 const x = 1;
+const y = 2;
`;

    const hunks: ParsedHunk[] = [{
      file: 'file.ts',
      oldStart: 1,
      oldLines: 1,
      newStart: 1,
      newLines: 2,
      content: `@@ -1 +1,2 @@
 const x = 1;
+const y = 2;`,
    }];

    const result = await workspace.applyDiff(info.path, diff, hunks);
    
    expect(result.success).toBe(true);
    
    const content = await fs.promises.readFile(
      path.join(info.path, 'file.ts'),
      'utf8'
    );
    expect(content).toContain('const y = 2');
  });
});
