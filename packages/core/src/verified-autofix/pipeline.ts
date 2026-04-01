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

import * as fs from 'fs';
import {
  validateAgentOutput,
  type FullValidationResult,
  type GuardrailV1Output,
} from './format-validator';
import { TempWorkspace, type VerifyResult } from './workspace';
import { fingerprintRepo, type RepoFingerprint } from './repo-fingerprint';
import { trackUsage, enforceFeature } from '../entitlements';

// ============================================================================
// TYPES
// ============================================================================

export interface PipelineOptions {
  projectPath: string;
  agentOutputFile?: string;
  agentOutputRaw?: string;
  dryRun?: boolean;
  skipTests?: boolean;
  verbose?: boolean;
  timeout?: number;
  skipEntitlements?: boolean;
  strictMarkdown?: boolean;
  onProgress?: (stage: PipelineStage, message: string, data?: unknown) => void;
}

export type PipelineStage =
  | 'init'
  | 'validate'
  | 'fingerprint'
  | 'workspace'
  | 'apply'
  | 'typecheck'
  | 'build'
  | 'test'
  | 'commit'
  | 'done'
  | 'error';

export interface PipelineResult {
  success: boolean;
  stage: PipelineStage;
  duration: number;
  validation?: FullValidationResult;
  fingerprint?: RepoFingerprint;
  verification?: VerifyResult;
  filesModified: string[];
  errors: string[];
  warnings: string[];
  failureContext: string[];
  output?: GuardrailV1Output;
}

// ============================================================================
// PIPELINE CLASS
// ============================================================================

export class VerifiedAutofixPipeline {
  private workspace: TempWorkspace;
  
  constructor() {
    this.workspace = new TempWorkspace();
  }
  
  /**
   * Run the full verification pipeline
   */
  async run(options: PipelineOptions): Promise<PipelineResult> {
    const startTime = Date.now();
    const result: PipelineResult = {
      success: false,
      stage: 'init',
      duration: 0,
      filesModified: [],
      errors: [],
      warnings: [],
      failureContext: [],
    };
    
    let workspaceId: string | null = null;
    
    try {
      // Enforce feature entitlement (Pro+ required)
      if (!options.skipEntitlements) {
        await enforceFeature('fix:auto');
      }
      
      options.onProgress?.('init', 'Starting verified autofix pipeline');
      
      // Step 1: Read agent output
      result.stage = 'validate';
      options.onProgress?.('validate', 'Reading agent output');
      
      let rawOutput: string;
      if (options.agentOutputFile) {
        if (!fs.existsSync(options.agentOutputFile)) {
          throw new Error(`Agent output file not found: ${options.agentOutputFile}`);
        }
        rawOutput = await fs.promises.readFile(options.agentOutputFile, 'utf8');
      } else if (options.agentOutputRaw) {
        rawOutput = options.agentOutputRaw;
      } else {
        throw new Error('Either agentOutputFile or agentOutputRaw must be provided');
      }
      
      // Step 2: Validate format
      options.onProgress?.('validate', 'Validating output format');
      const validation = validateAgentOutput(rawOutput, options.projectPath, {
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
      
      const { fingerprint, detectionNotes } = fingerprintRepo(options.projectPath);
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
      
      const applyResult = await this.workspace.applyDiff(
        workspaceInfo.path,
        validation.output.diff,
        validation.diffValidation?.hunks || []
      );
      
      if (!applyResult.success) {
        result.errors.push(...applyResult.errors);
        throw new Error(`Diff application failed: ${applyResult.errors.join('; ')}`);
      }
      
      options.onProgress?.('apply', `Applied ${applyResult.applied} hunk(s)`);
      
      // Step 6-8: Run verification (typecheck, build, tests)
      result.stage = 'typecheck';
      options.onProgress?.('typecheck', 'Running verification checks');
      
      const verification = await this.workspace.verify(
        workspaceInfo.path,
        fingerprint,
        {
          skipTests: options.skipTests,
          timeout: options.timeout,
        }
      );
      result.verification = verification;
      result.failureContext = verification.failureContext;
      
      // Report check progress
      for (const check of verification.checks) {
        const status = check.passed ? '✓' : '✗';
        const stage = check.name.toLowerCase().includes('build') ? 'build' :
                     check.name.toLowerCase().includes('test') ? 'test' : 'typecheck';
        options.onProgress?.(stage as PipelineStage, `${status} ${check.name} (${check.duration}ms)`);
      }
      
      if (!verification.passed) {
        result.errors.push('Verification failed');
        result.errors.push(...verification.failureContext);
        throw new Error(`Verification failed: ${verification.failureContext.slice(0, 3).join('; ')}`);
      }
      
      // Step 9: Copy verified changes back to project
      result.stage = 'commit';
      options.onProgress?.('commit', 'Applying verified changes to project');
      
      await this.workspace.copyBack(
        workspaceInfo.path,
        options.projectPath,
        result.filesModified
      );
      
      // Track usage
      await trackUsage('fixRuns', 1);
      
      // Success!
      result.success = true;
      result.stage = 'done';
      options.onProgress?.('done', `Successfully modified ${result.filesModified.length} file(s)`);
      
    } catch (e) {
      const error = e as Error & { code?: string };
      result.errors.push(error.message);
      
      // Handle entitlement errors
      if (error.code === 'FEATURE_NOT_AVAILABLE') {
        result.stage = 'error';
        result.errors = [`Feature requires upgrade: ${error.message}`];
      }
      
      options.onProgress?.('error', error.message);
    } finally {
      // Cleanup workspace
      if (workspaceId) {
        try {
          await this.workspace.cleanup(workspaceId);
        } catch {
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
  async runFromFile(
    agentOutputFile: string,
    projectPath: string,
    options?: Partial<PipelineOptions>
  ): Promise<PipelineResult> {
    return this.run({
      projectPath,
      agentOutputFile,
      ...options,
    });
  }
  
  /**
   * Validate only (no apply) - for checking output format
   */
  validateOnly(raw: string, projectPath: string): FullValidationResult {
    return validateAgentOutput(raw, projectPath);
  }
}

// ============================================================================
// RESULT FORMATTING
// ============================================================================

/**
 * Format pipeline result for CLI output
 */
export function formatPipelineResult(result: PipelineResult): string {
  const lines: string[] = [];
  
  // Header
  if (result.success) {
    lines.push('✓ VERIFIED AUTOFIX SUCCESSFUL');
  } else {
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
export function formatPipelineResultJson(result: PipelineResult): string {
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

export const verifiedAutofixPipeline = new VerifiedAutofixPipeline();
