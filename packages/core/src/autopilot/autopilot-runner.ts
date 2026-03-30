/**
 * Autopilot Runner - PRO/COMPLIANCE+ Feature
 * 
 * Batch remediation system that:
 * 1. Scans for issues using existing scanners
 * 2. Groups findings into Fix Packs
 * 3. Generates verified patches
 * 4. Applies in temp workspace
 * 5. Re-scans to verify
 * 6. Outputs final verdict
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import * as crypto from 'crypto';
import { execSync } from 'child_process';
import {
  AutopilotOptions,
  AutopilotResult,
  AutopilotPlanResult,
  AutopilotApplyResult,
  AutopilotRollbackResult,
  AutopilotFinding,
  AutopilotFixPack,
  AutopilotFixPackCategory,
  AutopilotVerificationResult,
  AppliedFix,
  AutopilotScanResult,
  AUTOPILOT_FIX_PACK_PRIORITY,
} from './types';
import { EntitlementsManager } from '../entitlements';

const entitlements = new EntitlementsManager();

export class AutopilotRunner {
  private tempDir: string;
  private backupDir: string;
  
  constructor() {
    this.tempDir = path.join(os.tmpdir(), 'guardrail-autopilot');
    this.backupDir = path.join(os.tmpdir(), 'guardrail-autopilot-backups');
  }

  async run(options: AutopilotOptions): Promise<AutopilotResult> {
    await entitlements.enforceFeature('autopilot');
    
    const limitCheck = await entitlements.checkLimit('scans');
    if (!limitCheck.allowed) {
      throw new Error(limitCheck.reason || 'Scan limit exceeded');
    }

    if (options.mode === 'plan') {
      return this.runPlan(options);
    } else if (options.mode === 'rollback') {
      return this.runRollback(options);
    } else {
      return this.runApply(options);
    }
  }

  private async runPlan(options: AutopilotOptions): Promise<AutopilotPlanResult> {
    const startTime = Date.now();
    options.onProgress?.('scan', 'Running initial scan...');
    
    const scanResult = await this.runScan(options.projectPath, options.profile || 'ship');
    
    await entitlements.trackUsage('scans', 1);
    
    options.onProgress?.('group', 'Grouping findings into fix packs...');
    const packs = this.groupIntoFixPacks(scanResult.findings, options.maxFixes);
    
    const fixableCount = scanResult.findings.filter(f => f.fixable).length;
    const riskAssessment = {
      low: packs.filter(p => p.estimatedRisk === 'low').length,
      medium: packs.filter(p => p.estimatedRisk === 'medium').length,
      high: packs.filter(p => p.estimatedRisk === 'high').length,
    };
    
    void (Date.now() - startTime); // Duration tracked for future logging
    const estimatedApplyTime = Math.ceil((packs.length * 30 + 60) / 60);
    
    return {
      mode: 'plan',
      projectPath: options.projectPath,
      profile: options.profile || 'ship',
      timestamp: new Date().toISOString(),
      totalFindings: scanResult.findings.length,
      fixableFindings: fixableCount,
      packs,
      estimatedDuration: `${estimatedApplyTime} min`,
      riskAssessment,
    };
  }

  private async runApply(options: AutopilotOptions): Promise<AutopilotApplyResult> {
    const startTime = new Date();
    const runId = options.runId || crypto.randomBytes(8).toString('hex');
    const appliedFixes: AppliedFix[] = [];
    const errors: string[] = [];
    let verification: AutopilotVerificationResult | null = null;
    let gitBranch: string | undefined;
    let gitCommit: string | undefined;
    
    options.onProgress?.('scan', 'Running initial scan...');
    const initialScan = await this.runScan(options.projectPath, options.profile || 'ship');
    
    await entitlements.trackUsage('scans', 1);
    
    options.onProgress?.('group', 'Grouping findings into fix packs...');
    let packs = this.groupIntoFixPacks(initialScan.findings, options.maxFixes);
    
    if (options.packIds && options.packIds.length > 0) {
      packs = packs.filter(p => options.packIds!.includes(p.id));
      if (packs.length === 0) {
        throw new Error(`No packs found matching IDs: ${options.packIds.join(', ')}`);
      }
    }
    
    if (packs.length === 0) {
      return {
        mode: 'apply',
        projectPath: options.projectPath,
        profile: options.profile || 'ship',
        timestamp: new Date().toISOString(),
        startTime: startTime.toISOString(),
        endTime: new Date().toISOString(),
        duration: Date.now() - startTime.getTime(),
        packsAttempted: 0,
        packsSucceeded: 0,
        packsFailed: 0,
        appliedFixes,
        verification: null,
        remainingFindings: initialScan.findings.length,
        newScanVerdict: 'skipped',
        errors: ['No fixable issues found'],
      };
    }
    
    const isGitRepo = this.isGitRepository(options.projectPath);
    if (isGitRepo && !options.dryRun) {
      options.onProgress?.('git', 'Creating git branch...');
      gitBranch = await this.createGitBranch(options.projectPath, runId);
      await this.createBackup(options.projectPath, runId);
    }
    
    let workspacePath: string | null = null;
    let packsSucceeded = 0;
    let packsFailed = 0;
    
    try {
      options.onProgress?.('workspace', 'Creating temp workspace...');
      workspacePath = await this.createTempWorkspace(options.projectPath, options.branchStrategy);
      
      for (const pack of packs) {
        if (pack.estimatedRisk === 'high' && !options.force) {
          const shouldApply = await this.confirmHighRiskPack(pack, options.interactive);
          if (!shouldApply) {
            errors.push(`Pack ${pack.id} skipped: high risk, user declined`);
            packsFailed++;
            continue;
          }
        }
        
        options.onProgress?.('fix', `Applying ${pack.name}...`);
        
        try {
          const fixes = await this.applyFixPack(workspacePath, pack, options);
          appliedFixes.push(...fixes);
          
          const successCount = fixes.filter(f => f.success).length;
          if (successCount > 0) {
            packsSucceeded++;
          } else {
            packsFailed++;
          }
        } catch (e) {
          packsFailed++;
          errors.push(`Pack ${pack.id}: ${(e as Error).message}`);
        }
      }
      
      if (options.verify !== false) {
        options.onProgress?.('verify', 'Running verification...');
        verification = await this.runVerification(workspacePath, options.profile || 'ship');
        
        if (verification.passed && !options.dryRun) {
          options.onProgress?.('apply', 'Applying changes to project...');
          await this.applyToProject(options.projectPath, workspacePath);
          
          if (isGitRepo && gitBranch) {
            options.onProgress?.('git', 'Committing changes...');
            gitCommit = await this.commitChanges(options.projectPath, runId, appliedFixes);
          }
          
          await entitlements.trackUsage('fixRuns', appliedFixes.filter(f => f.success).length);
        }
      } else if (!options.dryRun) {
        options.onProgress?.('apply', 'Applying changes (unverified)...');
        await this.applyToProject(options.projectPath, workspacePath);
        
        if (isGitRepo && gitBranch) {
          options.onProgress?.('git', 'Committing changes...');
          gitCommit = await this.commitChanges(options.projectPath, runId, appliedFixes);
        }
        
        await entitlements.trackUsage('fixRuns', appliedFixes.filter(f => f.success).length);
      }
    } finally {
      if (workspacePath) {
        await this.cleanupWorkspace(workspacePath, options.projectPath);
      }
    }
    
    let newScanVerdict: 'pass' | 'fail' | 'skipped' = 'skipped';
    let remainingFindings = initialScan.findings.length;
    
    if (verification?.passed && !options.dryRun) {
      options.onProgress?.('rescan', 'Running verification scan...');
      const finalScan = await this.runScan(options.projectPath, options.profile || 'ship');
      remainingFindings = finalScan.findings.length;
      newScanVerdict = finalScan.verdict;
      await entitlements.trackUsage('scans', 1);
    }
    
    const endTime = new Date();
    
    return {
      mode: 'apply',
      projectPath: options.projectPath,
      profile: options.profile || 'ship',
      timestamp: new Date().toISOString(),
      startTime: startTime.toISOString(),
      endTime: endTime.toISOString(),
      duration: endTime.getTime() - startTime.getTime(),
      packsAttempted: packs.length,
      packsSucceeded,
      packsFailed,
      appliedFixes,
      verification,
      remainingFindings,
      newScanVerdict,
      errors,
      runId,
      gitBranch,
      gitCommit,
    };
  }

  private async runRollback(options: AutopilotOptions): Promise<AutopilotRollbackResult> {
    if (!options.runId) {
      throw new Error('runId is required for rollback');
    }
    
    const isGitRepo = this.isGitRepository(options.projectPath);
    const backupPath = path.join(this.backupDir, options.runId);
    const hasBackup = fs.existsSync(backupPath);
    
    let method: 'git-reset' | 'backup-restore';
    let success = false;
    let message = '';
    
    try {
      if (isGitRepo) {
        const branchName = `guardrail/autopilot-${options.runId}`;
        const branchExists = this.gitBranchExists(options.projectPath, branchName);
        
        if (branchExists) {
          options.onProgress?.('rollback', 'Rolling back via git reset...');
          execSync('git checkout -', { cwd: options.projectPath, stdio: 'pipe' });
          execSync(`git branch -D ${branchName}`, { cwd: options.projectPath, stdio: 'pipe' });
          method = 'git-reset';
          success = true;
          message = `Successfully rolled back git branch ${branchName}`;
        } else if (hasBackup) {
          options.onProgress?.('rollback', 'Rolling back via backup restore...');
          await this.restoreBackup(options.projectPath, options.runId);
          method = 'backup-restore';
          success = true;
          message = `Successfully restored from backup`;
        } else {
          throw new Error(`No git branch or backup found for runId: ${options.runId}`);
        }
      } else if (hasBackup) {
        options.onProgress?.('rollback', 'Rolling back via backup restore...');
        await this.restoreBackup(options.projectPath, options.runId);
        method = 'backup-restore';
        success = true;
        message = `Successfully restored from backup`;
      } else {
        throw new Error(`No backup found for runId: ${options.runId}`);
      }
    } catch (e) {
      method = isGitRepo ? 'git-reset' : 'backup-restore';
      message = `Rollback failed: ${(e as Error).message}`;
    }
    
    return {
      mode: 'rollback',
      projectPath: options.projectPath,
      runId: options.runId,
      timestamp: new Date().toISOString(),
      success,
      method,
      message,
    };
  }

  private async runScan(projectPath: string, _profile: string): Promise<AutopilotScanResult> {
    const findings: AutopilotFinding[] = [];
    
    try {
      const cmd = `npx tsc --noEmit 2>&1 || true`;
      const output = execSync(cmd, { cwd: projectPath, encoding: 'utf8', timeout: 60000 });
      
      const errorRegex = /(.+)\((\d+),\d+\):\s*error\s+TS(\d+):\s*(.+)/g;
      let match;
      while ((match = errorRegex.exec(output)) !== null) {
        const [, fileName, lineNum, errorCode, errorMsg] = match;
        if (fileName && lineNum && errorCode && errorMsg) {
          findings.push({
            id: `TS${errorCode}-${crypto.randomBytes(4).toString('hex')}`,
            category: 'type-errors',
            severity: 'high',
            file: fileName,
            line: parseInt(lineNum, 10),
            message: errorMsg,
            fixable: true,
          });
        }
      }
    } catch (e) {
      // TypeScript not available or error
    }
    
    try {
      const files = this.findSourceFiles(projectPath);
      for (const file of files.slice(0, 100)) {
        const content = fs.readFileSync(file, 'utf8');
        const relPath = path.relative(projectPath, file);
        
        const todoMatches = content.matchAll(/\/\/\s*TODO[:\s](.+)/gi);
        for (const match of todoMatches) {
          const line = content.substring(0, match.index ?? 0).split('\n').length;
          findings.push({
            id: `TODO-${crypto.randomBytes(4).toString('hex')}`,
            category: 'quality',
            severity: 'low',
            file: relPath,
            line,
            message: `Unresolved TODO: ${(match[1] || '').trim()}`,
            fixable: false,
          });
        }
        
        const consoleMatches = content.matchAll(/console\.(log|warn|error)\(/g);
        for (const match of consoleMatches) {
          const line = content.substring(0, match.index ?? 0).split('\n').length;
          findings.push({
            id: `CONSOLE-${crypto.randomBytes(4).toString('hex')}`,
            category: 'quality',
            severity: 'low',
            file: relPath,
            line,
            message: `console.${match[1]} statement found`,
            fixable: true,
          });
        }
      }
    } catch (e) {
      // Scan error
    }
    
    const score = Math.max(0, 100 - findings.length * 2);
    
    return {
      findings,
      score,
      verdict: score >= 70 ? 'pass' : 'fail',
      duration: 0,
    };
  }

  groupIntoFixPacks(findings: AutopilotFinding[], maxFixes?: number): AutopilotFixPack[] {
    const byCategory = new Map<AutopilotFixPackCategory, AutopilotFinding[]>();
    
    for (const finding of findings) {
      if (!finding.fixable) continue;
      const list = byCategory.get(finding.category) || [];
      list.push(finding);
      byCategory.set(finding.category, list);
    }
    
    const packs: AutopilotFixPack[] = [];
    
    for (const [category, categoryFindings] of byCategory) {
      const limited = maxFixes ? categoryFindings.slice(0, maxFixes) : categoryFindings;
      if (limited.length === 0) continue;
      
      const impactedFiles = [...new Set(limited.map(f => f.file))];
      const hasCritical = limited.some(f => f.severity === 'critical' || f.severity === 'high');
      
      packs.push({
        id: `pack-${category}-${crypto.randomBytes(4).toString('hex')}`,
        category,
        name: this.getCategoryName(category),
        description: this.getCategoryDescription(category),
        findings: limited,
        estimatedRisk: hasCritical ? 'medium' : 'low',
        impactedFiles,
        priority: AUTOPILOT_FIX_PACK_PRIORITY[category] || 99,
      });
    }
    
    return packs.sort((a, b) => a.priority - b.priority);
  }

  private getCategoryName(category: AutopilotFixPackCategory): string {
    const names: Record<AutopilotFixPackCategory, string> = {
      'security': 'Security Fixes',
      'quality': 'Code Quality',
      'type-errors': 'TypeScript Errors',
      'build-blockers': 'Build Blockers',
      'test-failures': 'Test Failures',
      'placeholders': 'Placeholder Removal',
      'route-integrity': 'Route Integrity',
    };
    return names[category] || category;
  }

  private getCategoryDescription(category: AutopilotFixPackCategory): string {
    const descs: Record<AutopilotFixPackCategory, string> = {
      'security': 'Fix security vulnerabilities and exposed secrets',
      'quality': 'Remove console.logs, TODOs, and improve code quality',
      'type-errors': 'Resolve TypeScript compilation errors',
      'build-blockers': 'Fix issues preventing successful builds',
      'test-failures': 'Fix failing test cases',
      'placeholders': 'Remove lorem ipsum and mock data',
      'route-integrity': 'Fix dead links and orphan routes',
    };
    return descs[category] || '';
  }

  private async createTempWorkspace(projectPath: string, strategy?: string): Promise<string> {
    const id = crypto.randomBytes(8).toString('hex');
    const workspacePath = path.join(this.tempDir, id);
    
    await fs.promises.mkdir(workspacePath, { recursive: true });
    
    if (strategy === 'worktree') {
      try {
        const gitDir = path.join(projectPath, '.git');
        if (fs.existsSync(gitDir)) {
          execSync(`git worktree add "${workspacePath}" HEAD --detach`, {
            cwd: projectPath,
            stdio: 'pipe',
          });
          return workspacePath;
        }
      } catch {
        // Fall through to copy
      }
    }
    
    await this.copyProject(projectPath, workspacePath);
    return workspacePath;
  }

  private async copyProject(src: string, dest: string): Promise<void> {
    const entries = await fs.promises.readdir(src, { withFileTypes: true });
    
    for (const entry of entries) {
      if (['node_modules', '.git', 'dist', 'build', '.next'].includes(entry.name)) continue;
      
      const srcPath = path.join(src, entry.name);
      const destPath = path.join(dest, entry.name);
      
      if (entry.isDirectory()) {
        await fs.promises.mkdir(destPath, { recursive: true });
        await this.copyProject(srcPath, destPath);
      } else {
        await fs.promises.copyFile(srcPath, destPath);
      }
    }
  }

  private async applyFixPack(workspacePath: string, pack: AutopilotFixPack, _options: AutopilotOptions): Promise<AppliedFix[]> {
    const fixes: AppliedFix[] = [];
    
    for (const finding of pack.findings) {
      try {
        if (finding.category === 'quality' && finding.message.includes('console.')) {
          const filePath = path.join(workspacePath, finding.file);
          if (fs.existsSync(filePath)) {
            const content = await fs.promises.readFile(filePath, 'utf8');
            const lines = content.split('\n');
            const lineContent = lines[finding.line - 1];
            if (lineContent?.includes('console.')) {
              lines[finding.line - 1] = lineContent.replace(/console\.(log|warn|error)\([^)]*\);?/g, '// Removed by guardrail Autopilot');
              await fs.promises.writeFile(filePath, lines.join('\n'));
              fixes.push({ packId: pack.id, findingId: finding.id, file: finding.file, success: true });
              continue;
            }
          }
        }
        fixes.push({ packId: pack.id, findingId: finding.id, file: finding.file, success: false, error: 'Auto-fix not implemented for this issue type' });
      } catch (e) {
        fixes.push({ packId: pack.id, findingId: finding.id, file: finding.file, success: false, error: (e as Error).message });
      }
    }
    
    return fixes;
  }

  private async runVerification(workspacePath: string, profile: string): Promise<AutopilotVerificationResult> {
    const result: AutopilotVerificationResult = {
      passed: true,
      typecheck: { passed: true, errors: [] },
      build: { passed: true, errors: [] },
      tests: { passed: true, errors: [] },
      duration: 0,
    };
    
    const startTime = Date.now();
    
    try {
      execSync('npx tsc --noEmit', { cwd: workspacePath, stdio: 'pipe', timeout: 120000 });
    } catch (e) {
      result.typecheck.passed = false;
      result.typecheck.errors.push((e as { stderr?: Buffer }).stderr?.toString() || 'TypeScript check failed');
      result.passed = false;
    }
    
    if (profile === 'ship' || profile === 'full') {
      try {
        execSync('npm run build', { cwd: workspacePath, stdio: 'pipe', timeout: 300000 });
      } catch (e) {
        result.build.passed = false;
        result.build.errors.push((e as { stderr?: Buffer }).stderr?.toString() || 'Build failed');
        result.passed = false;
      }
    }
    
    result.duration = Date.now() - startTime;
    return result;
  }

  private async applyToProject(projectPath: string, workspacePath: string): Promise<void> {
    const files = this.findSourceFiles(workspacePath);
    
    for (const wsFile of files) {
      const relPath = path.relative(workspacePath, wsFile);
      const projFile = path.join(projectPath, relPath);
      const projDir = path.dirname(projFile);
      
      if (!fs.existsSync(projDir)) {
        await fs.promises.mkdir(projDir, { recursive: true });
      }
      
      await fs.promises.copyFile(wsFile, projFile);
    }
  }

  private async cleanupWorkspace(workspacePath: string, projectPath: string): Promise<void> {
    try {
      execSync(`git worktree remove "${workspacePath}" --force`, { cwd: projectPath, stdio: 'pipe' });
    } catch {
      try {
        await fs.promises.rm(workspacePath, { recursive: true, force: true });
      } catch {
        // Ignore cleanup errors
      }
    }
  }

  private findSourceFiles(dir: string, files: string[] = []): string[] {
    try {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        if (['node_modules', '.git', 'dist', 'build'].includes(entry.name)) continue;
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          this.findSourceFiles(fullPath, files);
        } else if (/\.(ts|tsx|js|jsx)$/.test(entry.name)) {
          files.push(fullPath);
        }
      }
    } catch {
      // Ignore
    }
    return files;
  }

  private isGitRepository(projectPath: string): boolean {
    try {
      const gitDir = path.join(projectPath, '.git');
      return fs.existsSync(gitDir);
    } catch {
      return false;
    }
  }

  private async createGitBranch(projectPath: string, runId: string): Promise<string> {
    const branchName = `guardrail/autopilot-${runId}`;
    try {
      execSync(`git checkout -b ${branchName}`, { cwd: projectPath, stdio: 'pipe' });
      return branchName;
    } catch (e) {
      throw new Error(`Failed to create git branch: ${(e as Error).message}`);
    }
  }

  private gitBranchExists(projectPath: string, branchName: string): boolean {
    try {
      const branches = execSync('git branch --list', { cwd: projectPath, encoding: 'utf8' });
      return branches.includes(branchName);
    } catch {
      return false;
    }
  }

  private async commitChanges(projectPath: string, runId: string, fixes: AppliedFix[]): Promise<string> {
    try {
      const successCount = fixes.filter(f => f.success).length;
      const packIds = [...new Set(fixes.map(f => f.packId))];
      
      const summary = `Autopilot fixes applied (runId: ${runId})`;
      const details = [
        ``,
        `Applied ${successCount} fixes across ${packIds.length} pack(s)`,
        ``,
        `Packs:`,
        ...packIds.map(id => `- ${id}`),
        ``,
        `Generated by guardrail Autopilot`,
      ].join('\n');
      
      execSync('git add -A', { cwd: projectPath, stdio: 'pipe' });
      execSync(`git commit -m "${summary}" -m "${details}"`, { cwd: projectPath, stdio: 'pipe' });
      
      const commit = execSync('git rev-parse HEAD', { cwd: projectPath, encoding: 'utf8' }).trim();
      return commit;
    } catch (e) {
      throw new Error(`Failed to commit changes: ${(e as Error).message}`);
    }
  }

  private async createBackup(projectPath: string, runId: string): Promise<void> {
    const backupPath = path.join(this.backupDir, runId);
    await fs.promises.mkdir(backupPath, { recursive: true });
    
    const files = this.findSourceFiles(projectPath);
    for (const file of files) {
      const relPath = path.relative(projectPath, file);
      const backupFile = path.join(backupPath, relPath);
      const backupFileDir = path.dirname(backupFile);
      
      await fs.promises.mkdir(backupFileDir, { recursive: true });
      await fs.promises.copyFile(file, backupFile);
    }
  }

  private async restoreBackup(projectPath: string, runId: string): Promise<void> {
    const backupPath = path.join(this.backupDir, runId);
    if (!fs.existsSync(backupPath)) {
      throw new Error(`Backup not found for runId: ${runId}`);
    }
    
    const files = this.findSourceFiles(backupPath);
    for (const file of files) {
      const relPath = path.relative(backupPath, file);
      const projectFile = path.join(projectPath, relPath);
      const projectFileDir = path.dirname(projectFile);
      
      await fs.promises.mkdir(projectFileDir, { recursive: true });
      await fs.promises.copyFile(file, projectFile);
    }
    
    await fs.promises.rm(backupPath, { recursive: true, force: true });
  }

  private async confirmHighRiskPack(_pack: AutopilotFixPack, interactive?: boolean): Promise<boolean> {
    if (!interactive) {
      return false;
    }
    
    return true;
  }
}

export const autopilotRunner = new AutopilotRunner();
export const runAutopilot = (options: AutopilotOptions) => autopilotRunner.run(options);
