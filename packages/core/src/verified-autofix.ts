/**
 * Verified Autofix System - PRO+ Feature
 * 
 * Core monetization feature that provides:
 * 1. Strict Build Mode prompts requiring JSON output with unified diff
 * 2. Validation of strict output protocol
 * 3. Temp workspace application with full verification pipeline
 * 4. Auto-reprompt on failure with tight failure context
 * 5. Apply patch only if verification passes
 * 
 * PRICING: This is a PRO+ feature. Prompts alone are free.
 * Paid value = prompts + strict diff protocol + verification + apply-only-if-pass
 */

import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { execSync } from 'child_process';
import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';

// ============================================================================
// TYPES
// ============================================================================

export type FixPackType = 
  | 'route-integrity'    // Dead links, orphan routes
  | 'placeholders'       // Lorem ipsum, mock data
  | 'type-errors'        // TypeScript errors
  | 'build-blockers'     // Build failures
  | 'test-failures';     // Failing tests

export interface FixPackConfig {
  type: FixPackType;
  name: string;
  description: string;
  scanCommand: string;
  verifyCommands: string[];
  maxAttempts: number;
  requiredTier: 'pro' | 'compliance';
}

export interface DiffHunk {
  file: string;
  oldStart: number;
  oldLines: number;
  newStart: number;
  newLines: number;
  content: string;
}

export interface StrictAgentOutput {
  success: boolean;
  explanation: string;
  diffs: DiffHunk[];
  filesModified: string[];
  confidence: number;
  warnings?: string[];
}

export interface VerificationResult {
  passed: boolean;
  checks: {
    name: string;
    passed: boolean;
    message: string;
    duration: number;
  }[];
  blockers: string[];
  duration: number;
}

export interface AutofixResult {
  success: boolean;
  fixPack: FixPackType;
  attempts: number;
  maxAttempts: number;
  duration: number;
  verification: VerificationResult | null;
  appliedDiffs: number;
  filesModified: string[];
  errors: string[];
  generatedDiffs: DiffHunk[];  // Show what AI generated
  aiExplanation: string;       // AI's explanation of changes
  metrics: {
    promptTokens: number;
    completionTokens: number;
    repromptCount: number;
    verificationTime: number;
  };
}

export interface AutofixOptions {
  projectPath: string;
  fixPack: FixPackType;
  dryRun?: boolean;
  verbose?: boolean;
  maxAttempts?: number;
  onProgress?: (stage: string, message: string) => void;
}

// ============================================================================
// FIX PACK CONFIGURATIONS
// ============================================================================

export const FIX_PACKS: Record<FixPackType, FixPackConfig> = {
  'route-integrity': {
    type: 'route-integrity',
    name: 'Route Integrity',
    description: 'Fix dead links and orphan routes',
    scanCommand: 'guardrail scan --truth --json',
    verifyCommands: [
      'npx tsc --noEmit',  // Required: TypeScript must pass
    ],
    maxAttempts: 3,
    requiredTier: 'pro',
  },
  'placeholders': {
    type: 'placeholders',
    name: 'Placeholder Removal',
    description: 'Remove lorem ipsum, mock data, and placeholder content',
    scanCommand: 'guardrail scan --json',
    verifyCommands: [
      'npx tsc --noEmit',  // Required: TypeScript must pass
    ],
    maxAttempts: 3,
    requiredTier: 'pro',
  },
  'type-errors': {
    type: 'type-errors',
    name: 'Type Error Fix',
    description: 'Fix TypeScript type errors',
    scanCommand: 'npx tsc --noEmit 2>&1 || true',
    verifyCommands: [
      'npx tsc --noEmit',
    ],
    maxAttempts: 5,
    requiredTier: 'pro',
  },
  'build-blockers': {
    type: 'build-blockers',
    name: 'Build Blockers',
    description: 'Fix issues preventing successful builds',
    scanCommand: 'npm run build 2>&1 || true',
    verifyCommands: [
      'npm run build',
    ],
    maxAttempts: 5,
    requiredTier: 'pro',
  },
  'test-failures': {
    type: 'test-failures',
    name: 'Test Failures',
    description: 'Fix failing tests',
    scanCommand: 'npm test 2>&1 || true',
    verifyCommands: [
      'npm test',
    ],
    maxAttempts: 5,
    requiredTier: 'pro',
  },
};

// ============================================================================
// STRICT OUTPUT PROTOCOL
// ============================================================================

const STRICT_OUTPUT_SCHEMA = {
  type: 'object',
  required: ['success', 'explanation', 'diffs', 'filesModified', 'confidence'],
  properties: {
    success: { type: 'boolean' },
    explanation: { type: 'string' },
    diffs: {
      type: 'array',
      items: {
        type: 'object',
        required: ['file', 'oldStart', 'oldLines', 'newStart', 'newLines', 'content'],
        properties: {
          file: { type: 'string' },
          oldStart: { type: 'number' },
          oldLines: { type: 'number' },
          newStart: { type: 'number' },
          newLines: { type: 'number' },
          content: { type: 'string' },
        },
      },
    },
    filesModified: { type: 'array', items: { type: 'string' } },
    confidence: { type: 'number', minimum: 0, maximum: 100 },
    warnings: { type: 'array', items: { type: 'string' } },
  },
};

/**
 * Validate strict agent output format
 */
export function validateStrictOutput(output: unknown): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  if (!output || typeof output !== 'object') {
    return { valid: false, errors: ['Output must be a JSON object'] };
  }
  
  const obj = output as Record<string, unknown>;
  
  // Check required fields
  for (const field of STRICT_OUTPUT_SCHEMA.required) {
    if (!(field in obj)) {
      errors.push(`Missing required field: ${field}`);
    }
  }
  
  // Type checks
  if (typeof obj['success'] !== 'boolean') {
    errors.push('Field "success" must be boolean');
  }
  if (typeof obj['explanation'] !== 'string') {
    errors.push('Field "explanation" must be string');
  }
  if (!Array.isArray(obj['diffs'])) {
    errors.push('Field "diffs" must be array');
  }
  if (!Array.isArray(obj['filesModified'])) {
    errors.push('Field "filesModified" must be array');
  }
  const confidence = obj['confidence'];
  if (typeof confidence !== 'number' || confidence < 0 || confidence > 100) {
    errors.push('Field "confidence" must be number 0-100');
  }
  
  // Validate each diff
  const diffs = obj['diffs'];
  if (Array.isArray(diffs)) {
    for (let i = 0; i < diffs.length; i++) {
      const diff = diffs[i] as Record<string, unknown>;
      if (!diff['file'] || typeof diff['file'] !== 'string') {
        errors.push(`diffs[${i}].file must be string`);
      }
      if (typeof diff['oldStart'] !== 'number') {
        errors.push(`diffs[${i}].oldStart must be number`);
      }
      if (typeof diff['content'] !== 'string') {
        errors.push(`diffs[${i}].content must be string`);
      }
    }
  }
  
  return { valid: errors.length === 0, errors };
}

// ============================================================================
// BUILD MODE PROMPT GENERATOR
// ============================================================================

/**
 * Extract affected file paths from scan output
 */
function extractAffectedFiles(scanOutput: string): string[] {
  const files: Set<string> = new Set();
  
  // Match file paths in various formats
  const patterns = [
    /["']([^"']+\.(tsx?|jsx?|vue|svelte))["']/g,
    /(\S+\.(tsx?|jsx?|vue|svelte)):/g,
    /File:\s*(\S+\.(tsx?|jsx?|vue|svelte))/g,
  ];
  
  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(scanOutput)) !== null) {
      const file = match[1];
      if (file && !file.includes('node_modules') && !file.startsWith('http')) {
        files.add(file);
      }
    }
  }
  
  return Array.from(files).slice(0, 5); // Limit to 5 files
}

/**
 * Read file content safely
 */
async function readFileContent(projectPath: string, filePath: string): Promise<string | null> {
  try {
    const fullPath = path.join(projectPath, filePath);
    const content = await fs.promises.readFile(fullPath, 'utf8');
    // Limit content size
    return content.slice(0, 2000);
  } catch {
    return null;
  }
}

/**
 * Generate strict Build Mode prompt for agent with file context
 */
export async function generateBuildModePromptWithContext(
  fixPack: FixPackType,
  scanOutput: string,
  context: { projectPath: string; framework?: string }
): Promise<string> {
  const config = FIX_PACKS[fixPack];
  
  // Extract and read affected files
  const affectedFiles = extractAffectedFiles(scanOutput);
  const fileContents: string[] = [];
  
  for (const file of affectedFiles) {
    const content = await readFileContent(context.projectPath, file);
    if (content) {
      fileContents.push(`### ${file}\n\`\`\`typescript\n${content}\n\`\`\``);
    }
  }
  
  const fileContextSection = fileContents.length > 0
    ? `## AFFECTED FILES (current content)\n\n${fileContents.join('\n\n')}\n\n`
    : '';
  
  return `# STRICT BUILD MODE - ${config.name}

## TASK
${config.description}

## SCAN OUTPUT (issues to fix)
\`\`\`
${scanOutput.slice(0, 3000)}
\`\`\`

${fileContextSection}## PROJECT CONTEXT
- Path: ${context.projectPath}
${context.framework ? `- Framework: ${context.framework}` : ''}

## REQUIRED OUTPUT FORMAT
You MUST respond with ONLY a valid JSON object matching this schema:

\`\`\`json
{
  "success": boolean,
  "explanation": "Brief explanation of changes",
  "diffs": [
    {
      "file": "relative/path/to/file.ts",
      "oldStart": 1,
      "oldLines": 3,
      "newStart": 1,
      "newLines": 4,
      "content": "@@ -1,3 +1,4 @@\\n context line\\n-old line\\n+new line\\n+added line\\n context"
    }
  ],
  "filesModified": ["relative/path/to/file.ts"],
  "confidence": 85,
  "warnings": ["optional warnings"]
}
\`\`\`

## RULES
1. Output ONLY the JSON - no markdown, no explanation outside JSON
2. Use unified diff format for content field matching the ACTUAL file content shown above
3. Paths must be relative to project root
4. Do NOT modify files outside the project
5. Do NOT introduce new dependencies without explicit instruction
6. Keep changes minimal and focused on the specific issue
7. Confidence should reflect certainty that changes will fix the issue
8. The diff content field must use actual line content from the files shown above

## BEGIN`;
}

/**
 * Generate strict Build Mode prompt for agent (sync version for compatibility)
 */
export function generateBuildModePrompt(
  fixPack: FixPackType,
  scanOutput: string,
  context: { projectPath: string; framework?: string }
): string {
  const config = FIX_PACKS[fixPack];
  
  return `# STRICT BUILD MODE - ${config.name}

## TASK
${config.description}

## SCAN OUTPUT
\`\`\`
${scanOutput.slice(0, 4000)}
\`\`\`

## PROJECT CONTEXT
- Path: ${context.projectPath}
${context.framework ? `- Framework: ${context.framework}` : ''}

## REQUIRED OUTPUT FORMAT
You MUST respond with ONLY a valid JSON object matching this schema:

\`\`\`json
{
  "success": boolean,
  "explanation": "Brief explanation of changes",
  "diffs": [
    {
      "file": "relative/path/to/file.ts",
      "oldStart": 1,
      "oldLines": 3,
      "newStart": 1,
      "newLines": 4,
      "content": "@@ -1,3 +1,4 @@\\n context line\\n-old line\\n+new line\\n+added line\\n context"
    }
  ],
  "filesModified": ["relative/path/to/file.ts"],
  "confidence": 85,
  "warnings": ["optional warnings"]
}
\`\`\`

## RULES
1. Output ONLY the JSON - no markdown, no explanation outside JSON
2. Use unified diff format for content field
3. Paths must be relative to project root
4. Do NOT modify files outside the project
5. Do NOT introduce new dependencies without explicit instruction
6. Keep changes minimal and focused on the specific issue
7. Confidence should reflect certainty that changes will fix the issue

## BEGIN`;
}

/**
 * Generate reprompt with failure context
 */
export function generateRepromptWithFailures(
  originalPrompt: string,
  _previousOutput: StrictAgentOutput,
  verification: VerificationResult
): string {
  const topBlockers = verification.blockers.slice(0, 3);
  
  return `${originalPrompt}

## PREVIOUS ATTEMPT FAILED

Your previous changes did not pass verification. Here are the top blockers:

${topBlockers.map((b, i) => `${i + 1}. ${b}`).join('\n')}

## VERIFICATION RESULTS
${verification.checks.map(c => `- ${c.name}: ${c.passed ? '✓' : '✗'} ${c.message}`).join('\n')}

Please provide a corrected fix that addresses these specific issues.
Remember: Output ONLY valid JSON matching the required schema.`;
}

// ============================================================================
// TEMP WORKSPACE MANAGER
// ============================================================================

export class TempWorkspaceManager {
  private baseDir: string;
  private workspaces: Map<string, string> = new Map();
  
  constructor() {
    this.baseDir = path.join(require('os').tmpdir(), 'guardrail-autofix');
  }
  
  /**
   * Create isolated workspace using git worktree (preferred) or copy
   */
  async createWorkspace(projectPath: string): Promise<string> {
    const id = crypto.randomBytes(8).toString('hex');
    const workspacePath = path.join(this.baseDir, id);
    
    await fs.promises.mkdir(workspacePath, { recursive: true });
    
    // Try git worktree first
    try {
      const gitDir = path.join(projectPath, '.git');
      if (fs.existsSync(gitDir)) {
        execSync(`git worktree add "${workspacePath}" HEAD --detach`, {
          cwd: projectPath,
          stdio: 'pipe',
        });
        this.workspaces.set(id, workspacePath);
        return workspacePath;
      }
    } catch {
      // Git worktree failed, fall back to copy
    }
    
    // Copy project (excluding node_modules, .git)
    await this.copyProject(projectPath, workspacePath);
    this.workspaces.set(id, workspacePath);
    
    return workspacePath;
  }
  
  /**
   * Apply diffs to workspace
   */
  async applyDiffs(workspacePath: string, diffs: DiffHunk[]): Promise<{ applied: number; errors: string[] }> {
    let applied = 0;
    const errors: string[] = [];
    
    for (const diff of diffs) {
      try {
        const filePath = path.join(workspacePath, diff.file);
        
        // Ensure directory exists
        await fs.promises.mkdir(path.dirname(filePath), { recursive: true });
        
        // Read existing content or create new
        let content = '';
        try {
          content = await fs.promises.readFile(filePath, 'utf8');
        } catch {
          // New file
        }
        
        // Apply unified diff
        const newContent = this.applyUnifiedDiff(content, diff);
        await fs.promises.writeFile(filePath, newContent);
        applied++;
      } catch (e) {
        errors.push(`Failed to apply diff to ${diff.file}: ${(e as Error).message}`);
      }
    }
    
    return { applied, errors };
  }
  
  /**
   * Cleanup workspace
   */
  async cleanup(workspacePath: string): Promise<void> {
    const projectPath = this.findProjectForWorkspace(workspacePath);
    
    // Try to remove git worktree first
    if (projectPath) {
      try {
        execSync(`git worktree remove "${workspacePath}" --force`, {
          cwd: projectPath,
          stdio: 'pipe',
        });
        return;
      } catch {
        // Fall through to rm
      }
    }
    
    // Remove directory
    try {
      await fs.promises.rm(workspacePath, { recursive: true, force: true });
    } catch {
      // Ignore
    }
  }
  
  private findProjectForWorkspace(workspacePath: string): string | null {
    for (const [, ws] of this.workspaces) {
      if (ws === workspacePath) {
        return ws;
      }
    }
    return null;
  }
  
  private async copyProject(src: string, dest: string): Promise<void> {
    const entries = await fs.promises.readdir(src, { withFileTypes: true });
    
    for (const entry of entries) {
      const srcPath = path.join(src, entry.name);
      const destPath = path.join(dest, entry.name);
      
      // Skip node_modules, .git, dist, build
      if (['node_modules', '.git', 'dist', 'build', '.next', '__pycache__'].includes(entry.name)) {
        continue;
      }
      
      if (entry.isDirectory()) {
        await fs.promises.mkdir(destPath, { recursive: true });
        await this.copyProject(srcPath, destPath);
      } else {
        await fs.promises.copyFile(srcPath, destPath);
      }
    }
  }
  
  private applyUnifiedDiff(content: string, diff: DiffHunk): string {
    // Parse unified diff format and apply
    const lines = content.split('\n');
    const diffLines = diff.content.split('\n');
    
    // Handle simple replacement case (AI often generates simple diffs)
    if (this.isSimpleReplacement(diff)) {
      return this.applySimpleReplacement(content, diff);
    }
    
    // Find the hunk header and process
    let resultLines: string[] = [];
    let srcIdx = 0;
    let diffIdx = 0;
    
    // Copy lines before the change
    while (srcIdx < diff.oldStart - 1 && srcIdx < lines.length) {
      resultLines.push(lines[srcIdx] || '');
      srcIdx++;
    }
    
    // Process diff lines
    for (; diffIdx < diffLines.length; diffIdx++) {
      const line = diffLines[diffIdx] || '';
      
      // Skip hunk header
      if (line.startsWith('@@')) continue;
      
      if (line.startsWith('-')) {
        // Delete line - skip source line
        srcIdx++;
      } else if (line.startsWith('+')) {
        // Add line
        resultLines.push(line.slice(1));
      } else if (line.startsWith(' ') || line === '') {
        // Context line
        if (srcIdx < lines.length) {
          resultLines.push(lines[srcIdx] || '');
          srcIdx++;
        }
      }
    }
    
    // Copy remaining lines
    while (srcIdx < lines.length) {
      resultLines.push(lines[srcIdx] || '');
      srcIdx++;
    }
    
    return resultLines.join('\n');
  }
  
  /**
   * Check if this is a simple line addition/replacement
   */
  private isSimpleReplacement(diff: DiffHunk): boolean {
    const lines = diff.content.split('\n').filter(l => !l.startsWith('@@'));
    const addLines = lines.filter(l => l.startsWith('+'));
    const delLines = lines.filter(l => l.startsWith('-'));
    // Simple if it's just additions at the start
    return addLines.length > 0 && delLines.length === 0 && diff.oldStart === 1;
  }
  
  /**
   * Apply a simple replacement/insertion
   */
  private applySimpleReplacement(content: string, diff: DiffHunk): string {
    const lines = content.split('\n');
    const diffLines = diff.content.split('\n').filter(l => !l.startsWith('@@'));
    const newLines: string[] = [];
    
    // Add new lines first
    for (const line of diffLines) {
      if (line.startsWith('+')) {
        newLines.push(line.slice(1));
      }
    }
    
    // Then add original content
    newLines.push(...lines);
    
    return newLines.join('\n');
  }
}

// ============================================================================
// VERIFICATION PIPELINE
// ============================================================================

export class VerificationPipeline {
  /**
   * Run verification checks on workspace
   */
  async verify(
    workspacePath: string, 
    checks: string[],
    onProgress?: (check: string, status: 'running' | 'passed' | 'failed') => void
  ): Promise<VerificationResult> {
    const startTime = Date.now();
    const results: VerificationResult['checks'] = [];
    const blockers: string[] = [];
    
    for (const check of checks) {
      const checkStart = Date.now();
      onProgress?.(check, 'running');
      
      try {
        execSync(check, {
          cwd: workspacePath,
          stdio: 'pipe',
          timeout: 120000, // 2 min timeout per check
        });
        
        results.push({
          name: check,
          passed: true,
          message: 'Passed',
          duration: Date.now() - checkStart,
        });
        onProgress?.(check, 'passed');
      } catch (e) {
        const error = e as { stderr?: Buffer; stdout?: Buffer; message: string };
        const output = (error.stderr?.toString() || error.stdout?.toString() || error.message).slice(0, 500);
        
        results.push({
          name: check,
          passed: false,
          message: output,
          duration: Date.now() - checkStart,
        });
        blockers.push(`${check}: ${output.split('\n')[0]}`);
        onProgress?.(check, 'failed');
      }
    }
    
    return {
      passed: results.every(r => r.passed),
      checks: results,
      blockers,
      duration: Date.now() - startTime,
    };
  }
  
  /**
   * Run additional security checks
   */
  async securityChecks(workspacePath: string): Promise<{ passed: boolean; issues: string[] }> {
    const issues: string[] = [];
    
    // Check for secrets
    try {
      const secretPatterns = [
        /AKIA[0-9A-Z]{16}/g,  // AWS
        /sk-[a-zA-Z0-9]{48}/g,  // OpenAI
        /ghp_[a-zA-Z0-9]{36}/g,  // GitHub
        /xoxb-[0-9]{11}-[0-9]{11}-[a-zA-Z0-9]{24}/g,  // Slack
      ];
      
      const files = await this.findFiles(workspacePath, ['*.ts', '*.js', '*.json']);
      for (const file of files.slice(0, 100)) {
        const content = await fs.promises.readFile(file, 'utf8');
        for (const pattern of secretPatterns) {
          if (pattern.test(content)) {
            issues.push(`Potential secret in ${path.relative(workspacePath, file)}`);
            break;
          }
        }
      }
    } catch {
      // Ignore
    }
    
    return { passed: issues.length === 0, issues };
  }
  
  private async findFiles(dir: string, patterns: string[]): Promise<string[]> {
    const files: string[] = [];
    
    const walk = async (d: string) => {
      try {
        const entries = await fs.promises.readdir(d, { withFileTypes: true });
        for (const entry of entries) {
          const fullPath = path.join(d, entry.name);
          if (entry.isDirectory() && !['node_modules', '.git'].includes(entry.name)) {
            await walk(fullPath);
          } else if (entry.isFile()) {
            for (const pattern of patterns) {
              const regex = new RegExp(pattern.replace('*', '.*'));
              if (regex.test(entry.name)) {
                files.push(fullPath);
                break;
              }
            }
          }
        }
      } catch {
        // Ignore
      }
    };
    
    await walk(dir);
    return files;
  }
}

// ============================================================================
// MAIN AUTOFIX RUNNER
// ============================================================================

export class VerifiedAutofixRunner {
  private workspaceManager: TempWorkspaceManager;
  private verificationPipeline: VerificationPipeline;
  
  constructor() {
    this.workspaceManager = new TempWorkspaceManager();
    this.verificationPipeline = new VerificationPipeline();
  }
  
  /**
   * Run verified autofix process
   */
  async run(options: AutofixOptions): Promise<AutofixResult> {
    const startTime = Date.now();
    const config = FIX_PACKS[options.fixPack];
    const maxAttempts = options.maxAttempts || config.maxAttempts;
    
    const result: AutofixResult = {
      success: false,
      fixPack: options.fixPack,
      attempts: 0,
      maxAttempts,
      duration: 0,
      verification: null,
      appliedDiffs: 0,
      filesModified: [],
      errors: [],
      generatedDiffs: [],
      aiExplanation: '',
      metrics: {
        promptTokens: 0,
        completionTokens: 0,
        repromptCount: 0,
        verificationTime: 0,
      },
    };
    
    let workspacePath: string | null = null;
    
    try {
      options.onProgress?.('scan', 'Running initial scan...');
      
      // Step 1: Run initial scan
      let scanOutput: string;
      try {
        scanOutput = execSync(config.scanCommand, {
          cwd: options.projectPath,
          encoding: 'utf8',
          timeout: 60000,
        });
      } catch (e) {
        scanOutput = (e as { stdout?: string }).stdout || '';
      }
      
      // Step 2: Generate initial prompt with file context
      options.onProgress?.('context', 'Reading affected files...');
      const prompt = await generateBuildModePromptWithContext(options.fixPack, scanOutput, {
        projectPath: options.projectPath,
      });
      
      let currentPrompt = prompt;
      let lastOutput: StrictAgentOutput | null = null;
      
      // Step 3: Attempt loop
      for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        result.attempts = attempt;
        options.onProgress?.('agent', `Attempt ${attempt}/${maxAttempts}...`);
        
        // Call agent (mock for now - would integrate with actual agent)
        const agentResponse = await this.callAgent(currentPrompt);
        
        // Validate output
        const validation = validateStrictOutput(agentResponse);
        if (!validation.valid) {
          result.errors.push(`Attempt ${attempt}: Invalid output format - ${validation.errors.join(', ')}`);
          continue;
        }
        
        lastOutput = agentResponse as StrictAgentOutput;
        
        // Store AI response for display
        result.generatedDiffs = lastOutput.diffs;
        result.aiExplanation = lastOutput.explanation;
        result.filesModified = lastOutput.filesModified;
        
        if (!lastOutput.success || lastOutput.diffs.length === 0) {
          result.errors.push(`Attempt ${attempt}: Agent reported no fixes available`);
          continue;
        }
        
        // For dry-run, show diffs without full verification
        if (options.dryRun) {
          options.onProgress?.('preview', `Generated ${lastOutput.diffs.length} diff(s) for ${lastOutput.filesModified.length} file(s)`);
          result.success = true;
          result.appliedDiffs = lastOutput.diffs.length;
          break;
        }
        
        // Step 4: Create temp workspace
        options.onProgress?.('workspace', 'Creating temp workspace...');
        workspacePath = await this.workspaceManager.createWorkspace(options.projectPath);
        
        // Step 5: Apply diffs
        options.onProgress?.('apply', 'Applying changes...');
        const applyResult = await this.workspaceManager.applyDiffs(workspacePath, lastOutput.diffs);
        result.appliedDiffs = applyResult.applied;
        
        if (applyResult.errors.length > 0) {
          result.errors.push(...applyResult.errors);
        }
        
        // Step 6: Run verification
        options.onProgress?.('verify', 'Running verification...');
        const verification = await this.verificationPipeline.verify(
          workspacePath,
          config.verifyCommands,
          (check, status) => options.onProgress?.('verify', `${check}: ${status}`)
        );
        result.verification = verification;
        result.metrics.verificationTime = verification.duration;
        
        if (verification.passed) {
          // Step 7: Security check
          const security = await this.verificationPipeline.securityChecks(workspacePath);
          if (!security.passed) {
            result.errors.push(...security.issues);
            continue;
          }
          
          // Step 8: Apply to real workspace
          options.onProgress?.('apply', 'Applying to project...');
          await this.applyToProject(options.projectPath, lastOutput.diffs);
          
          result.success = true;
          break;
        } else {
          // Generate reprompt with failure context
          result.metrics.repromptCount++;
          currentPrompt = generateRepromptWithFailures(prompt, lastOutput, verification);
          
          // Cleanup workspace for next attempt
          await this.workspaceManager.cleanup(workspacePath);
          workspacePath = null;
        }
      }
    } finally {
      // Cleanup
      if (workspacePath) {
        await this.workspaceManager.cleanup(workspacePath);
      }
      result.duration = Date.now() - startTime;
    }
    
    return result;
  }
  
  /**
   * Call AI agent using OpenAI or Anthropic API
   * Prefers OpenAI if OPENAI_API_KEY is set, otherwise falls back to Anthropic
   */
  private async callAgent(prompt: string): Promise<unknown> {
    const openaiKey = process.env['OPENAI_API_KEY'];
    const anthropicKey = process.env['ANTHROPIC_API_KEY'];
    
    if (!openaiKey && !anthropicKey) {
      console.warn('No AI API key set - set OPENAI_API_KEY or ANTHROPIC_API_KEY');
      return {
        success: false,
        explanation: 'No AI API key configured',
        diffs: [],
        filesModified: [],
        confidence: 0,
        warnings: ['Set OPENAI_API_KEY or ANTHROPIC_API_KEY to enable AI-powered autofix'],
      };
    }

    try {
      let text: string;
      
      if (openaiKey) {
        // Use OpenAI
        console.log('Using OpenAI API...');
        const client = new OpenAI({ apiKey: openaiKey });
        
        const response = await client.chat.completions.create({
          model: process.env['OPENAI_MODEL'] || 'gpt-4o',
          max_tokens: 8192,
          temperature: 0.2,
          messages: [
            {
              role: 'system',
              content: 'You are a code fix assistant. Always respond with valid JSON matching the exact schema requested. Do not include any text outside the JSON.',
            },
            {
              role: 'user',
              content: prompt,
            },
          ],
        });

        text = response.choices[0]?.message?.content?.trim() || '';
      } else {
        // Use Anthropic
        console.log('Using Anthropic API...');
        const client = new Anthropic({ apiKey: anthropicKey });
        
        const response = await client.messages.create({
          model: process.env['ANTHROPIC_MODEL'] || 'claude-sonnet-4-20250514',
          max_tokens: 8192,
          temperature: 0.2,
          messages: [
            {
              role: 'user',
              content: prompt,
            },
          ],
        });

        const content = response.content[0];
        if (!content || content.type !== 'text') {
          throw new Error('Unexpected response type from Claude');
        }
        text = content.text.trim();
      }
      
      // Parse JSON from response (may be wrapped in markdown code blocks)
      let jsonStr = text;
      const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (jsonMatch && jsonMatch[1]) {
        jsonStr = jsonMatch[1].trim();
      }

      try {
        const parsed = JSON.parse(jsonStr);
        return parsed;
      } catch (parseError) {
        // If JSON parsing fails, return structured error
        return {
          success: false,
          explanation: 'Failed to parse agent response as JSON',
          diffs: [],
          filesModified: [],
          confidence: 0,
          warnings: [`Parse error: ${(parseError as Error).message}`, `Raw response: ${text.slice(0, 500)}`],
        };
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        success: false,
        explanation: `API call failed: ${errorMessage}`,
        diffs: [],
        filesModified: [],
        confidence: 0,
        warnings: [errorMessage],
      };
    }
  }
  
  /**
   * Apply diffs to actual project
   */
  private async applyToProject(projectPath: string, diffs: DiffHunk[]): Promise<void> {
    for (const diff of diffs) {
      const filePath = path.join(projectPath, diff.file);
      
      // Backup original
      const backupPath = `${filePath}.guardrail-backup`;
      try {
        await fs.promises.copyFile(filePath, backupPath);
      } catch {
        // New file, no backup needed
      }
      
      // Apply diff
      const manager = new TempWorkspaceManager();
      await manager.applyDiffs(projectPath, [diff]);
    }
  }
}

// ============================================================================
// COST ESTIMATION
// ============================================================================

const MODEL_COSTS: Record<string, { input: number; output: number }> = {
  'gpt-4o': { input: 0.005, output: 0.015 },
  'gpt-4o-mini': { input: 0.00015, output: 0.0006 },
  'gpt-4-turbo': { input: 0.01, output: 0.03 },
  'claude-sonnet-4-20250514': { input: 0.003, output: 0.015 },
  'claude-3-haiku-20240307': { input: 0.00025, output: 0.00125 },
};

export interface CostEstimate {
  model: string;
  estimatedTokens: number;
  estimatedCost: number;
  currency: string;
}

export function estimateCost(promptLength: number, model?: string): CostEstimate {
  const selectedModel = model || process.env['OPENAI_MODEL'] || process.env['ANTHROPIC_MODEL'] || 'gpt-4o';
  const defaultCosts = { input: 0.005, output: 0.015 };
  const costs = MODEL_COSTS[selectedModel] ?? defaultCosts;
  
  // Rough estimate: 4 chars per token, expect 2x output
  const inputTokens = Math.ceil(promptLength / 4);
  const outputTokens = Math.ceil(inputTokens * 0.5);
  
  const inputCost = (inputTokens / 1000) * costs.input;
  const outputCost = (outputTokens / 1000) * costs.output;
  
  return {
    model: selectedModel,
    estimatedTokens: inputTokens + outputTokens,
    estimatedCost: inputCost + outputCost,
    currency: 'USD',
  };
}

// ============================================================================
// BACKUP & RESTORE
// ============================================================================

export async function listBackups(projectPath: string): Promise<string[]> {
  const backups: string[] = [];
  
  async function scan(dir: string): Promise<void> {
    try {
      const entries = await fs.promises.readdir(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory() && !entry.name.includes('node_modules')) {
          await scan(fullPath);
        } else if (entry.name.endsWith('.guardrail-backup')) {
          backups.push(fullPath.replace(projectPath + path.sep, ''));
        }
      }
    } catch {
      // Skip inaccessible directories
    }
  }
  
  await scan(projectPath);
  return backups;
}

export async function restoreBackups(projectPath: string): Promise<{ restored: string[]; errors: string[] }> {
  const backups = await listBackups(projectPath);
  const restored: string[] = [];
  const errors: string[] = [];
  
  for (const backup of backups) {
    const backupPath = path.join(projectPath, backup);
    const originalPath = backupPath.replace('.guardrail-backup', '');
    
    try {
      await fs.promises.copyFile(backupPath, originalPath);
      await fs.promises.unlink(backupPath);
      restored.push(originalPath.replace(projectPath + path.sep, ''));
    } catch (e) {
      errors.push(`Failed to restore ${backup}: ${(e as Error).message}`);
    }
  }
  
  return { restored, errors };
}

export async function cleanBackups(projectPath: string): Promise<number> {
  const backups = await listBackups(projectPath);
  let cleaned = 0;
  
  for (const backup of backups) {
    try {
      await fs.promises.unlink(path.join(projectPath, backup));
      cleaned++;
    } catch {
      // Skip errors
    }
  }
  
  return cleaned;
}

// ============================================================================
// EXPORTS
// ============================================================================

export const verifiedAutofix = new VerifiedAutofixRunner();
export const runVerifiedAutofix = (options: AutofixOptions) => verifiedAutofix.run(options);
