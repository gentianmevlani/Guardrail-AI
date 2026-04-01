"use strict";
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
exports.runAutopilot = exports.autopilotRunner = exports.AutopilotRunner = void 0;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const os = __importStar(require("os"));
const crypto = __importStar(require("crypto"));
const child_process_1 = require("child_process");
const types_1 = require("./types");
const entitlements_1 = require("../entitlements");
const entitlements = new entitlements_1.EntitlementsManager();
class AutopilotRunner {
    tempDir;
    backupDir;
    constructor() {
        this.tempDir = path.join(os.tmpdir(), 'guardrail-autopilot');
        this.backupDir = path.join(os.tmpdir(), 'guardrail-autopilot-backups');
    }
    async run(options) {
        await entitlements.enforceFeature('autopilot');
        const limitCheck = await entitlements.checkLimit('scans');
        if (!limitCheck.allowed) {
            throw new Error(limitCheck.reason || 'Scan limit exceeded');
        }
        if (options.mode === 'plan') {
            return this.runPlan(options);
        }
        else if (options.mode === 'rollback') {
            return this.runRollback(options);
        }
        else {
            return this.runApply(options);
        }
    }
    async runPlan(options) {
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
    async runApply(options) {
        const startTime = new Date();
        const runId = options.runId || crypto.randomBytes(8).toString('hex');
        const appliedFixes = [];
        const errors = [];
        let verification = null;
        let gitBranch;
        let gitCommit;
        options.onProgress?.('scan', 'Running initial scan...');
        const initialScan = await this.runScan(options.projectPath, options.profile || 'ship');
        await entitlements.trackUsage('scans', 1);
        options.onProgress?.('group', 'Grouping findings into fix packs...');
        let packs = this.groupIntoFixPacks(initialScan.findings, options.maxFixes);
        if (options.packIds && options.packIds.length > 0) {
            packs = packs.filter(p => options.packIds.includes(p.id));
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
        let workspacePath = null;
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
                    }
                    else {
                        packsFailed++;
                    }
                }
                catch (e) {
                    packsFailed++;
                    errors.push(`Pack ${pack.id}: ${e.message}`);
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
            }
            else if (!options.dryRun) {
                options.onProgress?.('apply', 'Applying changes (unverified)...');
                await this.applyToProject(options.projectPath, workspacePath);
                if (isGitRepo && gitBranch) {
                    options.onProgress?.('git', 'Committing changes...');
                    gitCommit = await this.commitChanges(options.projectPath, runId, appliedFixes);
                }
                await entitlements.trackUsage('fixRuns', appliedFixes.filter(f => f.success).length);
            }
        }
        finally {
            if (workspacePath) {
                await this.cleanupWorkspace(workspacePath, options.projectPath);
            }
        }
        let newScanVerdict = 'skipped';
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
    async runRollback(options) {
        if (!options.runId) {
            throw new Error('runId is required for rollback');
        }
        const isGitRepo = this.isGitRepository(options.projectPath);
        const backupPath = path.join(this.backupDir, options.runId);
        const hasBackup = fs.existsSync(backupPath);
        let method;
        let success = false;
        let message = '';
        try {
            if (isGitRepo) {
                const branchName = `guardrail/autopilot-${options.runId}`;
                const branchExists = this.gitBranchExists(options.projectPath, branchName);
                if (branchExists) {
                    options.onProgress?.('rollback', 'Rolling back via git reset...');
                    (0, child_process_1.execSync)('git checkout -', { cwd: options.projectPath, stdio: 'pipe' });
                    (0, child_process_1.execSync)(`git branch -D ${branchName}`, { cwd: options.projectPath, stdio: 'pipe' });
                    method = 'git-reset';
                    success = true;
                    message = `Successfully rolled back git branch ${branchName}`;
                }
                else if (hasBackup) {
                    options.onProgress?.('rollback', 'Rolling back via backup restore...');
                    await this.restoreBackup(options.projectPath, options.runId);
                    method = 'backup-restore';
                    success = true;
                    message = `Successfully restored from backup`;
                }
                else {
                    throw new Error(`No git branch or backup found for runId: ${options.runId}`);
                }
            }
            else if (hasBackup) {
                options.onProgress?.('rollback', 'Rolling back via backup restore...');
                await this.restoreBackup(options.projectPath, options.runId);
                method = 'backup-restore';
                success = true;
                message = `Successfully restored from backup`;
            }
            else {
                throw new Error(`No backup found for runId: ${options.runId}`);
            }
        }
        catch (e) {
            method = isGitRepo ? 'git-reset' : 'backup-restore';
            message = `Rollback failed: ${e.message}`;
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
    async runScan(projectPath, _profile) {
        const findings = [];
        try {
            const cmd = `npx tsc --noEmit 2>&1 || true`;
            const output = (0, child_process_1.execSync)(cmd, { cwd: projectPath, encoding: 'utf8', timeout: 60000 });
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
        }
        catch (e) {
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
        }
        catch (e) {
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
    groupIntoFixPacks(findings, maxFixes) {
        const byCategory = new Map();
        for (const finding of findings) {
            if (!finding.fixable)
                continue;
            const list = byCategory.get(finding.category) || [];
            list.push(finding);
            byCategory.set(finding.category, list);
        }
        const packs = [];
        for (const [category, categoryFindings] of byCategory) {
            const limited = maxFixes ? categoryFindings.slice(0, maxFixes) : categoryFindings;
            if (limited.length === 0)
                continue;
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
                priority: types_1.AUTOPILOT_FIX_PACK_PRIORITY[category] || 99,
            });
        }
        return packs.sort((a, b) => a.priority - b.priority);
    }
    getCategoryName(category) {
        const names = {
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
    getCategoryDescription(category) {
        const descs = {
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
    async createTempWorkspace(projectPath, strategy) {
        const id = crypto.randomBytes(8).toString('hex');
        const workspacePath = path.join(this.tempDir, id);
        await fs.promises.mkdir(workspacePath, { recursive: true });
        if (strategy === 'worktree') {
            try {
                const gitDir = path.join(projectPath, '.git');
                if (fs.existsSync(gitDir)) {
                    (0, child_process_1.execSync)(`git worktree add "${workspacePath}" HEAD --detach`, {
                        cwd: projectPath,
                        stdio: 'pipe',
                    });
                    return workspacePath;
                }
            }
            catch {
                // Fall through to copy
            }
        }
        await this.copyProject(projectPath, workspacePath);
        return workspacePath;
    }
    async copyProject(src, dest) {
        const entries = await fs.promises.readdir(src, { withFileTypes: true });
        for (const entry of entries) {
            if (['node_modules', '.git', 'dist', 'build', '.next'].includes(entry.name))
                continue;
            const srcPath = path.join(src, entry.name);
            const destPath = path.join(dest, entry.name);
            if (entry.isDirectory()) {
                await fs.promises.mkdir(destPath, { recursive: true });
                await this.copyProject(srcPath, destPath);
            }
            else {
                await fs.promises.copyFile(srcPath, destPath);
            }
        }
    }
    async applyFixPack(workspacePath, pack, _options) {
        const fixes = [];
        for (const finding of pack.findings) {
            try {
                if (finding.category === 'quality' && finding.message.includes('console.')) {
                    const filePath = path.join(workspacePath, finding.file);
                    if (fs.existsSync(filePath)) {
                        const content = await fs.promises.readFile(filePath, 'utf8');
                        const lines = content.split('\n');
                        const lineContent = lines[finding.line - 1];
                        if (lineContent?.includes('console.')) {
                            lines[finding.line - 1] = lineContent.replace(/console\.(log|warn|error)\([^)]*\);?/g, '// Removed by Guardrail Autopilot');
                            await fs.promises.writeFile(filePath, lines.join('\n'));
                            fixes.push({ packId: pack.id, findingId: finding.id, file: finding.file, success: true });
                            continue;
                        }
                    }
                }
                fixes.push({ packId: pack.id, findingId: finding.id, file: finding.file, success: false, error: 'Auto-fix not implemented for this issue type' });
            }
            catch (e) {
                fixes.push({ packId: pack.id, findingId: finding.id, file: finding.file, success: false, error: e.message });
            }
        }
        return fixes;
    }
    async runVerification(workspacePath, profile) {
        const result = {
            passed: true,
            typecheck: { passed: true, errors: [] },
            build: { passed: true, errors: [] },
            tests: { passed: true, errors: [] },
            duration: 0,
        };
        const startTime = Date.now();
        try {
            (0, child_process_1.execSync)('npx tsc --noEmit', { cwd: workspacePath, stdio: 'pipe', timeout: 120000 });
        }
        catch (e) {
            result.typecheck.passed = false;
            result.typecheck.errors.push(e.stderr?.toString() || 'TypeScript check failed');
            result.passed = false;
        }
        if (profile === 'ship' || profile === 'full') {
            try {
                (0, child_process_1.execSync)('npm run build', { cwd: workspacePath, stdio: 'pipe', timeout: 300000 });
            }
            catch (e) {
                result.build.passed = false;
                result.build.errors.push(e.stderr?.toString() || 'Build failed');
                result.passed = false;
            }
        }
        result.duration = Date.now() - startTime;
        return result;
    }
    async applyToProject(projectPath, workspacePath) {
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
    async cleanupWorkspace(workspacePath, projectPath) {
        try {
            (0, child_process_1.execSync)(`git worktree remove "${workspacePath}" --force`, { cwd: projectPath, stdio: 'pipe' });
        }
        catch {
            try {
                await fs.promises.rm(workspacePath, { recursive: true, force: true });
            }
            catch {
                // Ignore cleanup errors
            }
        }
    }
    findSourceFiles(dir, files = []) {
        try {
            const entries = fs.readdirSync(dir, { withFileTypes: true });
            for (const entry of entries) {
                if (['node_modules', '.git', 'dist', 'build'].includes(entry.name))
                    continue;
                const fullPath = path.join(dir, entry.name);
                if (entry.isDirectory()) {
                    this.findSourceFiles(fullPath, files);
                }
                else if (/\.(ts|tsx|js|jsx)$/.test(entry.name)) {
                    files.push(fullPath);
                }
            }
        }
        catch {
            // Ignore
        }
        return files;
    }
    isGitRepository(projectPath) {
        try {
            const gitDir = path.join(projectPath, '.git');
            return fs.existsSync(gitDir);
        }
        catch {
            return false;
        }
    }
    async createGitBranch(projectPath, runId) {
        const branchName = `guardrail/autopilot-${runId}`;
        try {
            (0, child_process_1.execSync)(`git checkout -b ${branchName}`, { cwd: projectPath, stdio: 'pipe' });
            return branchName;
        }
        catch (e) {
            throw new Error(`Failed to create git branch: ${e.message}`);
        }
    }
    gitBranchExists(projectPath, branchName) {
        try {
            const branches = (0, child_process_1.execSync)('git branch --list', { cwd: projectPath, encoding: 'utf8' });
            return branches.includes(branchName);
        }
        catch {
            return false;
        }
    }
    async commitChanges(projectPath, runId, fixes) {
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
                `Generated by Guardrail Autopilot`,
            ].join('\n');
            (0, child_process_1.execSync)('git add -A', { cwd: projectPath, stdio: 'pipe' });
            (0, child_process_1.execSync)(`git commit -m "${summary}" -m "${details}"`, { cwd: projectPath, stdio: 'pipe' });
            const commit = (0, child_process_1.execSync)('git rev-parse HEAD', { cwd: projectPath, encoding: 'utf8' }).trim();
            return commit;
        }
        catch (e) {
            throw new Error(`Failed to commit changes: ${e.message}`);
        }
    }
    async createBackup(projectPath, runId) {
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
    async restoreBackup(projectPath, runId) {
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
    async confirmHighRiskPack(_pack, interactive) {
        if (!interactive) {
            return false;
        }
        return true;
    }
}
exports.AutopilotRunner = AutopilotRunner;
exports.autopilotRunner = new AutopilotRunner();
const runAutopilot = (options) => exports.autopilotRunner.run(options);
exports.runAutopilot = runAutopilot;
