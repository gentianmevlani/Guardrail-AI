"use strict";
/**
 * Verified AutoFix Pipeline - Orchestration Layer
 *
 * Pipeline order:
 * 1. format → validate JSON shape + strip markdown
 * 2. diff/path safety → validate unified diff + paths within project
 * 3. command safety → warn on risky commands
 * 4. stub detection → block TODO/placeholder in production
 * 5. apply diff → git apply --check then git apply
 * 6. typecheck → tsc --noEmit
 * 7. build (ship) → npm run build
 * 8. tests → npm test
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
exports.verifiedAutofixPipeline = exports.VerifiedAutofixPipeline = void 0;
exports.formatPipelineResult = formatPipelineResult;
exports.formatPipelineResultJson = formatPipelineResultJson;
const fs = __importStar(require("fs"));
const format_validator_1 = require("./format-validator");
const workspace_1 = require("./workspace");
const repo_fingerprint_1 = require("./repo-fingerprint");
const entitlements_1 = require("../entitlements");
// ============================================================================
// PIPELINE CLASS
// ============================================================================
class VerifiedAutofixPipeline {
    workspace;
    constructor() {
        this.workspace = new workspace_1.TempWorkspace();
    }
    /**
     * Run the full verification pipeline
     */
    async run(options) {
        const startTime = Date.now();
        const result = {
            success: false,
            stage: 'init',
            duration: 0,
            filesModified: [],
            errors: [],
            warnings: [],
            failureContext: [],
        };
        let workspaceId = null;
        try {
            // Enforce feature entitlement (Pro+ required)
            if (!options.skipEntitlements) {
                await (0, entitlements_1.enforceFeature)('fix:auto');
            }
            options.onProgress?.('init', 'Starting verified autofix pipeline');
            // Step 1: Read agent output
            result.stage = 'validate';
            options.onProgress?.('validate', 'Reading agent output');
            let rawOutput;
            if (options.agentOutputFile) {
                if (!fs.existsSync(options.agentOutputFile)) {
                    throw new Error(`Agent output file not found: ${options.agentOutputFile}`);
                }
                rawOutput = await fs.promises.readFile(options.agentOutputFile, 'utf8');
            }
            else if (options.agentOutputRaw) {
                rawOutput = options.agentOutputRaw;
            }
            else {
                throw new Error('Either agentOutputFile or agentOutputRaw must be provided');
            }
            // Step 2: Validate format
            options.onProgress?.('validate', 'Validating output format');
            const validation = (0, format_validator_1.validateAgentOutput)(rawOutput, options.projectPath, {
                strictMarkdown: options.strictMarkdown,
            });
            result.validation = validation;
            if (!validation.valid || !validation.output) {
                result.errors.push(...validation.errors);
                result.warnings.push(...validation.warnings);
                throw new Error(`Validation failed: ${validation.errors.join('; ')}`);
            }
            result.output = validation.output;
            result.warnings.push(...validation.warnings);
            result.filesModified = validation.diffValidation?.filesAffected || [];
            options.onProgress?.('validate', `Validated ${result.filesModified.length} file(s)`, {
                files: result.filesModified,
            });
            // Empty diff is a no-op success
            if (!validation.output.diff || validation.output.diff.trim() === '') {
                options.onProgress?.('done', 'No changes to apply');
                result.success = true;
                result.stage = 'done';
                result.duration = Date.now() - startTime;
                return result;
            }
            // Step 3: Fingerprint repo
            result.stage = 'fingerprint';
            options.onProgress?.('fingerprint', 'Analyzing project structure');
            const { fingerprint, detectionNotes } = (0, repo_fingerprint_1.fingerprintRepo)(options.projectPath);
            result.fingerprint = fingerprint;
            result.warnings.push(...detectionNotes);
            options.onProgress?.('fingerprint', `Detected ${fingerprint.framework} + ${fingerprint.packageManager}`, {
                fingerprint,
            });
            // Dry run: stop here and report what would happen
            if (options.dryRun) {
                options.onProgress?.('done', 'Dry run complete - no changes applied');
                result.success = true;
                result.stage = 'done';
                result.duration = Date.now() - startTime;
                return result;
            }
            // Step 4: Create temp workspace
            result.stage = 'workspace';
            options.onProgress?.('workspace', 'Creating isolated workspace');
            const workspaceInfo = await this.workspace.create({
                projectPath: options.projectPath,
                useWorktree: true,
                installDeps: false, // Don't install deps in workspace for speed
                timeout: options.timeout,
            });
            workspaceId = workspaceInfo.id;
            options.onProgress?.('workspace', `Created ${workspaceInfo.type} workspace`, {
                path: workspaceInfo.path,
            });
            // Step 5: Apply diff
            result.stage = 'apply';
            options.onProgress?.('apply', 'Applying diff to workspace');
            const applyResult = await this.workspace.applyDiff(workspaceInfo.path, validation.output.diff, validation.diffValidation?.hunks || []);
            if (!applyResult.success) {
                result.errors.push(...applyResult.errors);
                throw new Error(`Diff application failed: ${applyResult.errors.join('; ')}`);
            }
            options.onProgress?.('apply', `Applied ${applyResult.applied} hunk(s)`);
            // Step 6-8: Run verification (typecheck, build, tests)
            result.stage = 'typecheck';
            options.onProgress?.('typecheck', 'Running verification checks');
            const verification = await this.workspace.verify(workspaceInfo.path, fingerprint, {
                skipTests: options.skipTests,
                timeout: options.timeout,
            });
            result.verification = verification;
            result.failureContext = verification.failureContext;
            // Report check progress
            for (const check of verification.checks) {
                const status = check.passed ? '✓' : '✗';
                const stage = check.name.toLowerCase().includes('build') ? 'build' :
                    check.name.toLowerCase().includes('test') ? 'test' : 'typecheck';
                options.onProgress?.(stage, `${status} ${check.name} (${check.duration}ms)`);
            }
            if (!verification.passed) {
                result.errors.push('Verification failed');
                result.errors.push(...verification.failureContext);
                throw new Error(`Verification failed: ${verification.failureContext.slice(0, 3).join('; ')}`);
            }
            // Step 9: Copy verified changes back to project
            result.stage = 'commit';
            options.onProgress?.('commit', 'Applying verified changes to project');
            await this.workspace.copyBack(workspaceInfo.path, options.projectPath, result.filesModified);
            // Track usage
            await (0, entitlements_1.trackUsage)('fixRuns', 1);
            // Success!
            result.success = true;
            result.stage = 'done';
            options.onProgress?.('done', `Successfully modified ${result.filesModified.length} file(s)`);
        }
        catch (e) {
            const error = e;
            result.errors.push(error.message);
            // Handle entitlement errors
            if (error.code === 'FEATURE_NOT_AVAILABLE') {
                result.stage = 'error';
                result.errors = [`Feature requires upgrade: ${error.message}`];
            }
            options.onProgress?.('error', error.message);
        }
        finally {
            // Cleanup workspace
            if (workspaceId) {
                try {
                    await this.workspace.cleanup(workspaceId);
                }
                catch {
                    // Ignore cleanup errors
                }
            }
            result.duration = Date.now() - startTime;
        }
        return result;
    }
    /**
     * Run from a file (CLI convenience method)
     */
    async runFromFile(agentOutputFile, projectPath, options) {
        return this.run({
            projectPath,
            agentOutputFile,
            ...options,
        });
    }
    /**
     * Validate only (no apply) - for checking output format
     */
    validateOnly(raw, projectPath) {
        return (0, format_validator_1.validateAgentOutput)(raw, projectPath);
    }
}
exports.VerifiedAutofixPipeline = VerifiedAutofixPipeline;
// ============================================================================
// RESULT FORMATTING
// ============================================================================
/**
 * Format pipeline result for CLI output
 */
function formatPipelineResult(result) {
    const lines = [];
    // Header
    if (result.success) {
        lines.push('✓ VERIFIED AUTOFIX SUCCESSFUL');
    }
    else {
        lines.push('✗ VERIFIED AUTOFIX FAILED');
    }
    lines.push('');
    // Stage info
    lines.push(`Stage: ${result.stage}`);
    lines.push(`Duration: ${result.duration}ms`);
    lines.push('');
    // Files modified
    if (result.filesModified.length > 0) {
        lines.push('Files modified:');
        for (const file of result.filesModified.slice(0, 10)) {
            lines.push(`  • ${file}`);
        }
        if (result.filesModified.length > 10) {
            lines.push(`  ... and ${result.filesModified.length - 10} more`);
        }
        lines.push('');
    }
    // Verification results
    if (result.verification) {
        lines.push('Verification:');
        for (const check of result.verification.checks) {
            const icon = check.passed ? '✓' : '✗';
            lines.push(`  ${icon} ${check.name} (${check.duration}ms)`);
        }
        lines.push('');
    }
    // Errors
    if (result.errors.length > 0) {
        lines.push('Errors:');
        for (const err of result.errors.slice(0, 5)) {
            lines.push(`  • ${err}`);
        }
        lines.push('');
    }
    // Failure context (top 3)
    if (result.failureContext.length > 0) {
        lines.push('Top failures:');
        for (const ctx of result.failureContext) {
            lines.push(`  1. ${ctx}`);
        }
        lines.push('');
    }
    // Warnings
    if (result.warnings.length > 0) {
        lines.push('Warnings:');
        for (const warn of result.warnings.slice(0, 5)) {
            lines.push(`  ⚠ ${warn}`);
        }
    }
    return lines.join('\n');
}
/**
 * Format result as JSON for machine consumption
 */
function formatPipelineResultJson(result) {
    return JSON.stringify({
        success: result.success,
        stage: result.stage,
        duration: result.duration,
        filesModified: result.filesModified,
        errors: result.errors,
        warnings: result.warnings,
        failureContext: result.failureContext,
        verification: result.verification ? {
            passed: result.verification.passed,
            checks: result.verification.checks.map(c => ({
                name: c.name,
                passed: c.passed,
                duration: c.duration,
            })),
        } : null,
    }, null, 2);
}
// ============================================================================
// EXPORTS
// ============================================================================
exports.verifiedAutofixPipeline = new VerifiedAutofixPipeline();
