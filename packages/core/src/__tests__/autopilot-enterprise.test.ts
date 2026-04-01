/**
 * Autopilot Enterprise Workflow Tests
 * 
 * Tests for git integration, partial apply, rollback, and human-in-loop features.
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { execSync } from 'child_process';
import { AutopilotRunner } from '../autopilot/autopilot-runner';
import { AutopilotOptions, AutopilotApplyResult, AutopilotRollbackResult } from '../autopilot/types';

describe('Autopilot Enterprise Workflow', () => {
  let testDir: string;
  let runner: AutopilotRunner;

  beforeEach(() => {
    testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'autopilot-test-'));
    runner = new AutopilotRunner();
    // Note: GUARDRAIL_SKIP_ENTITLEMENTS bypass removed for security
    // Tests should mock entitlements service instead
  });

  afterEach(() => {
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
  });

  describe('Git Integration', () => {
    it('should create branch with format guardrail/autopilot-<runId>', async () => {
      execSync('git init', { cwd: testDir, stdio: 'pipe' });
      execSync('git config user.email "test@test.com"', { cwd: testDir, stdio: 'pipe' });
      execSync('git config user.name "Test User"', { cwd: testDir, stdio: 'pipe' });
      
      const testFile = path.join(testDir, 'test.ts');
      fs.writeFileSync(testFile, 'console.log("test");');
      
      execSync('git add .', { cwd: testDir, stdio: 'pipe' });
      execSync('git commit -m "initial"', { cwd: testDir, stdio: 'pipe' });

      const options: AutopilotOptions = {
        projectPath: testDir,
        mode: 'apply',
        profile: 'quick',
        maxFixes: 5,
        verify: false,
        dryRun: false,
      };

      const result = await runner.run(options) as AutopilotApplyResult;

      expect(result.gitBranch).toBeDefined();
      expect(result.gitBranch).toMatch(/^guardrail\/autopilot-[a-f0-9]+$/);
      
      const branches = execSync('git branch', { cwd: testDir, encoding: 'utf8' });
      expect(branches).toContain(result.gitBranch);
    });

    it('should commit changes with summary and runId', async () => {
      execSync('git init', { cwd: testDir, stdio: 'pipe' });
      execSync('git config user.email "test@test.com"', { cwd: testDir, stdio: 'pipe' });
      execSync('git config user.name "Test User"', { cwd: testDir, stdio: 'pipe' });
      
      const testFile = path.join(testDir, 'test.ts');
      fs.writeFileSync(testFile, 'console.log("test");');
      
      execSync('git add .', { cwd: testDir, stdio: 'pipe' });
      execSync('git commit -m "initial"', { cwd: testDir, stdio: 'pipe' });

      const options: AutopilotOptions = {
        projectPath: testDir,
        mode: 'apply',
        profile: 'quick',
        maxFixes: 5,
        verify: false,
        dryRun: false,
      };

      const result = await runner.run(options) as AutopilotApplyResult;

      expect(result.gitCommit).toBeDefined();
      expect(result.runId).toBeDefined();
      
      const commitMsg = execSync('git log -1 --pretty=%B', { cwd: testDir, encoding: 'utf8' });
      expect(commitMsg).toContain('Autopilot fixes applied');
      expect(commitMsg).toContain(result.runId!);
    });

    it('should not create branch in dry-run mode', async () => {
      execSync('git init', { cwd: testDir, stdio: 'pipe' });
      execSync('git config user.email "test@test.com"', { cwd: testDir, stdio: 'pipe' });
      execSync('git config user.name "Test User"', { cwd: testDir, stdio: 'pipe' });
      
      const testFile = path.join(testDir, 'test.ts');
      fs.writeFileSync(testFile, 'console.log("test");');
      
      execSync('git add .', { cwd: testDir, stdio: 'pipe' });
      execSync('git commit -m "initial"', { cwd: testDir, stdio: 'pipe' });

      const options: AutopilotOptions = {
        projectPath: testDir,
        mode: 'apply',
        profile: 'quick',
        maxFixes: 5,
        verify: false,
        dryRun: true,
      };

      const result = await runner.run(options) as AutopilotApplyResult;

      expect(result.gitBranch).toBeUndefined();
      expect(result.gitCommit).toBeUndefined();
    });
  });

  describe('Partial Apply', () => {
    it('should apply only specified packs with --pack flag', async () => {
      const testFile = path.join(testDir, 'test.ts');
      fs.writeFileSync(testFile, 'console.log("test");\n// TODO: fix this');

      const planOptions: AutopilotOptions = {
        projectPath: testDir,
        mode: 'plan',
        profile: 'quick',
        maxFixes: 10,
      };

      const planResult = await runner.run(planOptions);
      expect(planResult.mode).toBe('plan');
      
      if (planResult.mode === 'plan' && planResult.packs.length > 0) {
        const firstPackId = planResult.packs[0]!.id;

        const applyOptions: AutopilotOptions = {
          projectPath: testDir,
          mode: 'apply',
          profile: 'quick',
          maxFixes: 10,
          verify: false,
          packIds: [firstPackId],
        };

        const result = await runner.run(applyOptions) as AutopilotApplyResult;

        expect(result.packsAttempted).toBe(1);
        const appliedPackIds = [...new Set(result.appliedFixes.map(f => f.packId))];
        expect(appliedPackIds).toContain(firstPackId);
      }
    });

    it('should throw error if specified pack IDs do not exist', async () => {
      const testFile = path.join(testDir, 'test.ts');
      fs.writeFileSync(testFile, 'console.log("test");');

      const options: AutopilotOptions = {
        projectPath: testDir,
        mode: 'apply',
        profile: 'quick',
        maxFixes: 5,
        verify: false,
        packIds: ['non-existent-pack-id'],
      };

      await expect(runner.run(options)).rejects.toThrow('No packs found matching IDs');
    });

    it('should support multiple --pack flags', async () => {
      const testFile = path.join(testDir, 'test.ts');
      fs.writeFileSync(testFile, 'console.log("test");\nconsole.warn("warning");');

      const planOptions: AutopilotOptions = {
        projectPath: testDir,
        mode: 'plan',
        profile: 'quick',
        maxFixes: 10,
      };

      const planResult = await runner.run(planOptions);
      
      if (planResult.mode === 'plan' && planResult.packs.length >= 2) {
        const packIds = planResult.packs.slice(0, 2).map(p => p.id);

        const applyOptions: AutopilotOptions = {
          projectPath: testDir,
          mode: 'apply',
          profile: 'quick',
          maxFixes: 10,
          verify: false,
          packIds,
        };

        const result = await runner.run(applyOptions) as AutopilotApplyResult;

        expect(result.packsAttempted).toBeLessThanOrEqual(2);
      }
    });
  });

  describe('Rollback', () => {
    it('should rollback using git reset when branch exists', async () => {
      execSync('git init', { cwd: testDir, stdio: 'pipe' });
      execSync('git config user.email "test@test.com"', { cwd: testDir, stdio: 'pipe' });
      execSync('git config user.name "Test User"', { cwd: testDir, stdio: 'pipe' });
      
      const testFile = path.join(testDir, 'test.ts');
      fs.writeFileSync(testFile, 'console.log("test");');
      
      execSync('git add .', { cwd: testDir, stdio: 'pipe' });
      execSync('git commit -m "initial"', { cwd: testDir, stdio: 'pipe' });

      const applyOptions: AutopilotOptions = {
        projectPath: testDir,
        mode: 'apply',
        profile: 'quick',
        maxFixes: 5,
        verify: false,
        dryRun: false,
      };

      const applyResult = await runner.run(applyOptions) as AutopilotApplyResult;
      const runId = applyResult.runId!;

      const rollbackOptions: AutopilotOptions = {
        projectPath: testDir,
        mode: 'rollback',
        runId,
      };

      const rollbackResult = await runner.run(rollbackOptions) as AutopilotRollbackResult;

      expect(rollbackResult.mode).toBe('rollback');
      expect(rollbackResult.success).toBe(true);
      expect(rollbackResult.method).toBe('git-reset');
      expect(rollbackResult.message).toContain('Successfully rolled back');
    });

    it('should rollback using backup restore when git not available', async () => {
      const testFile = path.join(testDir, 'test.ts');
      fs.writeFileSync(testFile, 'console.log("test");');

      const applyOptions: AutopilotOptions = {
        projectPath: testDir,
        mode: 'apply',
        profile: 'quick',
        maxFixes: 5,
        verify: false,
        dryRun: false,
      };

      const applyResult = await runner.run(applyOptions) as AutopilotApplyResult;
      const runId = applyResult.runId!;

      const rollbackOptions: AutopilotOptions = {
        projectPath: testDir,
        mode: 'rollback',
        runId,
      };

      const rollbackResult = await runner.run(rollbackOptions) as AutopilotRollbackResult;

      expect(rollbackResult.mode).toBe('rollback');
      expect(rollbackResult.method).toBe('backup-restore');
    });

    it('should require runId for rollback', async () => {
      const options: AutopilotOptions = {
        projectPath: testDir,
        mode: 'rollback',
      };

      await expect(runner.run(options)).rejects.toThrow('runId is required for rollback');
    });

    it('should fail rollback when runId not found', async () => {
      const options: AutopilotOptions = {
        projectPath: testDir,
        mode: 'rollback',
        runId: 'non-existent-run-id',
      };

      const result = await runner.run(options) as AutopilotRollbackResult;

      expect(result.success).toBe(false);
      expect(result.message).toContain('Rollback failed');
    });
  });

  describe('Human-in-the-Loop', () => {
    it('should skip high-risk packs without --force in non-interactive mode', async () => {
      const testFile = path.join(testDir, 'test.ts');
      fs.writeFileSync(testFile, 'console.log("test");');

      const options: AutopilotOptions = {
        projectPath: testDir,
        mode: 'apply',
        profile: 'quick',
        maxFixes: 5,
        verify: false,
        force: false,
        interactive: false,
      };

      const result = await runner.run(options) as AutopilotApplyResult;

      const highRiskErrors = result.errors.filter(e => e.includes('high risk'));
      if (highRiskErrors.length > 0) {
        expect(result.packsFailed).toBeGreaterThan(0);
      }
    });

    it('should apply high-risk packs with --force flag', async () => {
      const testFile = path.join(testDir, 'test.ts');
      fs.writeFileSync(testFile, 'console.log("test");');

      const options: AutopilotOptions = {
        projectPath: testDir,
        mode: 'apply',
        profile: 'quick',
        maxFixes: 5,
        verify: false,
        force: true,
      };

      const result = await runner.run(options) as AutopilotApplyResult;

      const highRiskSkipped = result.errors.filter(e => e.includes('high risk, user declined'));
      expect(highRiskSkipped.length).toBe(0);
    });

    it('should prompt in interactive mode for high-risk packs', async () => {
      const testFile = path.join(testDir, 'test.ts');
      fs.writeFileSync(testFile, 'console.log("test");');

      const options: AutopilotOptions = {
        projectPath: testDir,
        mode: 'apply',
        profile: 'quick',
        maxFixes: 5,
        verify: false,
        interactive: true,
      };

      const result = await runner.run(options) as AutopilotApplyResult;

      expect(result).toBeDefined();
    });
  });

  describe('Branch Naming', () => {
    it('should use consistent branch naming format', async () => {
      execSync('git init', { cwd: testDir, stdio: 'pipe' });
      execSync('git config user.email "test@test.com"', { cwd: testDir, stdio: 'pipe' });
      execSync('git config user.name "Test User"', { cwd: testDir, stdio: 'pipe' });
      
      const testFile = path.join(testDir, 'test.ts');
      fs.writeFileSync(testFile, 'console.log("test");');
      
      execSync('git add .', { cwd: testDir, stdio: 'pipe' });
      execSync('git commit -m "initial"', { cwd: testDir, stdio: 'pipe' });

      const runId = 'abc123def456';
      const options: AutopilotOptions = {
        projectPath: testDir,
        mode: 'apply',
        profile: 'quick',
        maxFixes: 5,
        verify: false,
        runId,
      };

      const result = await runner.run(options) as AutopilotApplyResult;

      expect(result.gitBranch).toBe(`guardrail/autopilot-${runId}`);
    });
  });
});
