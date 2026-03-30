/**
 * Format Validator - Strict Output Protocol Enforcement
 * 
 * Validates AI agent output format:
 * 1. JSON shape validation (guardrail-v1 format)
 * 2. Unified diff validity checking
 * 3. Markdown fence stripping (forgiving)
 * 4. Path safety validation
 * 5. Stub/placeholder detection
 */

import * as path from 'path';

// ============================================================================
// TYPES
// ============================================================================

export interface GuardrailV1Output {
  format: 'guardrail-v1';
  diff: string;
  commands: string[];
  tests: string[];
  notes: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  sanitized?: GuardrailV1Output;
}

export interface DiffValidationResult {
  valid: boolean;
  errors: string[];
  hunks: ParsedHunk[];
  filesAffected: string[];
}

export interface ParsedHunk {
  file: string;
  oldStart: number;
  oldLines: number;
  newStart: number;
  newLines: number;
  content: string;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const STUB_PATTERNS = [
  /TODO\s*:/i,
  /FIXME\s*:/i,
  /XXX\s*:/i,
  /HACK\s*:/i,
  /\bplaceholder\b/i,
  /\bstub\b/i,
  /\bnot\s+implemented\b/i,
  /throw\s+new\s+Error\s*\(\s*['"`]Not implemented/i,
  /\/\/\s*TODO/i,
  /\/\*\s*TODO/i,
  /console\.log\s*\(\s*['"`]TODO/i,
];

const UNSAFE_PATH_PATTERNS = [
  /\.\.\//,                    // Parent directory traversal
  /^\/etc\//,                  // System config
  /^\/usr\//,                  // System binaries
  /^\/var\//,                  // System var
  /^\/root\//,                 // Root home
  /^\/home\/(?![\w-]+\/)/,     // Other users' homes
  /^C:\\Windows\\/i,           // Windows system
  /^C:\\Program Files/i,       // Windows programs
  /node_modules\//,            // Dependencies
  /\.git\//,                   // Git internals
];

const UNSAFE_COMMANDS = [
  /\brm\s+-rf?\s+\//,          // Delete root
  /\brm\s+-rf?\s+~\//,         // Delete home
  /\bsudo\b/,                  // Elevated privileges
  /\bchmod\s+777\b/,           // Insecure permissions
  /\bcurl\b.*\|\s*sh\b/,       // Pipe to shell
  /\bwget\b.*\|\s*sh\b/,       // Pipe to shell
  /\beval\s*\(/,               // Code injection
  /\bexec\s*\(/,               // Code execution
  /\b--force\b/,               // Force flags (risky)
  /\bgit\s+push\s+--force\b/,  // Force push
];

// ============================================================================
// MARKDOWN FENCE STRIPPING
// ============================================================================

/**
 * Strip markdown code fences from raw agent output (forgiving mode)
 */
export function stripMarkdownFences(raw: string): string {
  let content = raw.trim();
  
  // Remove ```json ... ``` wrapper
  const jsonFenceMatch = content.match(/^```(?:json)?\s*([\s\S]*?)```\s*$/);
  if (jsonFenceMatch && jsonFenceMatch[1]) {
    content = jsonFenceMatch[1].trim();
  }
  
  // Remove leading/trailing ``` if partial
  if (content.startsWith('```json')) {
    content = content.slice(7).trim();
  } else if (content.startsWith('```')) {
    content = content.slice(3).trim();
  }
  
  if (content.endsWith('```')) {
    content = content.slice(0, -3).trim();
  }
  
  return content;
}

// ============================================================================
// JSON SHAPE VALIDATION
// ============================================================================

/**
 * Validate the guardrail-v1 JSON shape
 */
export function validateJsonShape(obj: unknown): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  
  if (!obj || typeof obj !== 'object') {
    return { valid: false, errors: ['Input must be a JSON object'], warnings: [] };
  }
  
  const data = obj as Record<string, unknown>;
  
  // Check format field
  if (data['format'] !== 'guardrail-v1') {
    errors.push(`Missing or invalid "format" field. Expected "guardrail-v1", got "${data['format']}"`);
  }
  
  // Check diff field
  if (typeof data['diff'] !== 'string') {
    errors.push('Missing or invalid "diff" field. Must be a string.');
  } else if (data['diff'].length === 0) {
    warnings.push('Empty diff field - no changes to apply');
  }
  
  // Check commands field
  if (!Array.isArray(data['commands'])) {
    errors.push('Missing or invalid "commands" field. Must be an array.');
  } else {
    for (let i = 0; i < data['commands'].length; i++) {
      if (typeof data['commands'][i] !== 'string') {
        errors.push(`commands[${i}] must be a string`);
      }
    }
  }
  
  // Check tests field
  if (!Array.isArray(data['tests'])) {
    errors.push('Missing or invalid "tests" field. Must be an array.');
  } else {
    for (let i = 0; i < data['tests'].length; i++) {
      if (typeof data['tests'][i] !== 'string') {
        errors.push(`tests[${i}] must be a string`);
      }
    }
  }
  
  // Check notes field
  if (typeof data['notes'] !== 'string') {
    errors.push('Missing or invalid "notes" field. Must be a string.');
  }
  
  if (errors.length > 0) {
    return { valid: false, errors, warnings };
  }
  
  const sanitized: GuardrailV1Output = {
    format: 'guardrail-v1',
    diff: data['diff'] as string,
    commands: data['commands'] as string[],
    tests: data['tests'] as string[],
    notes: data['notes'] as string,
  };
  
  return { valid: true, errors: [], warnings, sanitized };
}

// ============================================================================
// UNIFIED DIFF VALIDATION
// ============================================================================

/**
 * Parse and validate unified diff format
 */
export function validateUnifiedDiff(diff: string): DiffValidationResult {
  const errors: string[] = [];
  const hunks: ParsedHunk[] = [];
  const filesAffected: string[] = [];
  
  if (!diff || diff.trim().length === 0) {
    return { valid: true, errors: [], hunks: [], filesAffected: [] };
  }
  
  const lines = diff.split('\n');
  let currentFile: string | null = null;
  let currentHunk: ParsedHunk | null = null;
  let hunkContent: string[] = [];
  let lineIndex = 0;
  
  while (lineIndex < lines.length) {
    const line = lines[lineIndex] || '';
    
    // File header: --- a/path or --- path
    if (line.startsWith('--- ')) {
      const filePath = line.slice(4).replace(/^[ab]\//, '').split('\t')[0];
      if (filePath) {
        currentFile = filePath;
      }
      lineIndex++;
      continue;
    }
    
    // File header: +++ b/path or +++ path
    if (line.startsWith('+++ ')) {
      const filePath = line.slice(4).replace(/^[ab]\//, '').split('\t')[0];
      if (filePath && filePath !== '/dev/null') {
        currentFile = filePath;
        if (!filesAffected.includes(filePath)) {
          filesAffected.push(filePath);
        }
      }
      lineIndex++;
      continue;
    }
    
    // Hunk header: @@ -start,count +start,count @@
    const hunkMatch = line.match(/^@@\s+-(\d+)(?:,(\d+))?\s+\+(\d+)(?:,(\d+))?\s+@@/);
    if (hunkMatch) {
      // Save previous hunk
      if (currentHunk && currentFile) {
        currentHunk.content = hunkContent.join('\n');
        hunks.push(currentHunk);
      }
      
      currentHunk = {
        file: currentFile || 'unknown',
        oldStart: parseInt(hunkMatch[1] || '1', 10),
        oldLines: parseInt(hunkMatch[2] || '1', 10),
        newStart: parseInt(hunkMatch[3] || '1', 10),
        newLines: parseInt(hunkMatch[4] || '1', 10),
        content: '',
      };
      hunkContent = [line];
      lineIndex++;
      continue;
    }
    
    // Diff content lines
    if (currentHunk) {
      if (line.startsWith('+') || line.startsWith('-') || line.startsWith(' ') || line === '') {
        hunkContent.push(line);
      } else if (line.startsWith('diff --git')) {
        // New file in multi-file diff - save current hunk
        if (currentFile) {
          currentHunk.content = hunkContent.join('\n');
          hunks.push(currentHunk);
        }
        currentHunk = null;
        hunkContent = [];
        currentFile = null;
      } else if (line.startsWith('index ') || line.startsWith('new file') || line.startsWith('deleted file')) {
        // Git diff metadata - skip
      } else if (line.trim() !== '') {
        // Unexpected line in hunk
        errors.push(`Unexpected line in diff at line ${lineIndex + 1}: "${line.slice(0, 50)}..."`);
      }
    }
    
    lineIndex++;
  }
  
  // Save last hunk
  if (currentHunk && currentFile) {
    currentHunk.content = hunkContent.join('\n');
    hunks.push(currentHunk);
  }
  
  // Validate hunk line counts
  for (const hunk of hunks) {
    const hunkLines = hunk.content.split('\n').filter(l => !l.startsWith('@@'));
    const addLines = hunkLines.filter(l => l.startsWith('+')).length;
    const delLines = hunkLines.filter(l => l.startsWith('-')).length;
    const ctxLines = hunkLines.filter(l => l.startsWith(' ') || l === '').length;
    
    const expectedOld = delLines + ctxLines;
    const expectedNew = addLines + ctxLines;
    
    // Allow some tolerance for trailing newlines
    if (Math.abs(expectedOld - hunk.oldLines) > 1) {
      errors.push(`Hunk for ${hunk.file}: old line count mismatch (header: ${hunk.oldLines}, actual: ${expectedOld})`);
    }
    if (Math.abs(expectedNew - hunk.newLines) > 1) {
      errors.push(`Hunk for ${hunk.file}: new line count mismatch (header: ${hunk.newLines}, actual: ${expectedNew})`);
    }
  }
  
  return {
    valid: errors.length === 0,
    errors,
    hunks,
    filesAffected,
  };
}

// ============================================================================
// PATH SAFETY VALIDATION
// ============================================================================

/**
 * Validate that file paths are safe (no traversal, no system paths)
 */
export function validatePathSafety(paths: string[], projectRoot: string): { safe: boolean; issues: string[] } {
  const issues: string[] = [];
  
  for (const filePath of paths) {
    // Check for unsafe patterns
    for (const pattern of UNSAFE_PATH_PATTERNS) {
      if (pattern.test(filePath)) {
        issues.push(`Unsafe path pattern detected: ${filePath}`);
        break;
      }
    }
    
    // Resolve and check if within project
    const resolved = path.resolve(projectRoot, filePath);
    const relative = path.relative(projectRoot, resolved);
    
    if (relative.startsWith('..') || path.isAbsolute(relative)) {
      issues.push(`Path escapes project root: ${filePath}`);
    }
  }
  
  return { safe: issues.length === 0, issues };
}

// ============================================================================
// COMMAND SAFETY VALIDATION
// ============================================================================

/**
 * Validate that commands are safe to run
 */
export function validateCommandSafety(commands: string[]): { safe: boolean; issues: string[] } {
  const issues: string[] = [];
  
  for (const cmd of commands) {
    for (const pattern of UNSAFE_COMMANDS) {
      if (pattern.test(cmd)) {
        issues.push(`Potentially unsafe command: ${cmd}`);
        break;
      }
    }
  }
  
  return { safe: issues.length === 0, issues };
}

// ============================================================================
// STUB DETECTION
// ============================================================================

/**
 * Detect placeholder/stub code in diff additions
 */
export function detectStubs(diff: string): { hasStubs: boolean; stubs: string[] } {
  const stubs: string[] = [];
  const lines = diff.split('\n');
  
  for (const line of lines) {
    // Only check added lines
    if (!line.startsWith('+') || line.startsWith('+++')) {
      continue;
    }
    
    const content = line.slice(1); // Remove the + prefix
    
    for (const pattern of STUB_PATTERNS) {
      if (pattern.test(content)) {
        stubs.push(content.trim().slice(0, 100));
        break;
      }
    }
  }
  
  return { hasStubs: stubs.length > 0, stubs };
}

// ============================================================================
// MAIN VALIDATOR
// ============================================================================

export interface FullValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  output?: GuardrailV1Output;
  diffValidation?: DiffValidationResult;
  pathSafety?: { safe: boolean; issues: string[] };
  commandSafety?: { safe: boolean; issues: string[] };
  stubDetection?: { hasStubs: boolean; stubs: string[] };
  wasMarkdownWrapped?: boolean;
}

/**
 * Full validation pipeline for agent output
 */
export function validateAgentOutput(
  raw: string,
  projectRoot: string,
  options?: { strictMarkdown?: boolean }
): FullValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  
  // Step 1: Check for markdown fences and strip them (forgiving mode)
  const wasMarkdownWrapped = isMarkdownWrapped(raw);
  
  if (wasMarkdownWrapped) {
    if (options?.strictMarkdown) {
      // In strict mode, reject markdown-wrapped output entirely
      return {
        valid: false,
        errors: ['Output must be raw JSON, not wrapped in markdown fences. Remove ```json and ``` markers.'],
        warnings: [],
        wasMarkdownWrapped: true,
      };
    }
    // In forgiving mode, strip fences but warn
    warnings.push('Output was wrapped in markdown fences (```json). Stripped automatically. AI should return raw JSON.');
  }
  
  const stripped = stripMarkdownFences(raw);
  
  // Step 2: Parse JSON
  let parsed: unknown;
  try {
    parsed = JSON.parse(stripped);
  } catch (e) {
    return {
      valid: false,
      errors: [`Invalid JSON: ${(e as Error).message}`],
      warnings: [],
    };
  }
  
  // Step 3: Validate JSON shape
  const shapeResult = validateJsonShape(parsed);
  if (!shapeResult.valid || !shapeResult.sanitized) {
    return {
      valid: false,
      errors: shapeResult.errors,
      warnings: shapeResult.warnings,
    };
  }
  warnings.push(...shapeResult.warnings);
  const output = shapeResult.sanitized;
  
  // Step 4: Validate unified diff
  const diffValidation = validateUnifiedDiff(output.diff);
  if (!diffValidation.valid) {
    errors.push(...diffValidation.errors);
  }
  
  // Step 5: Validate path safety
  const pathSafety = validatePathSafety(diffValidation.filesAffected, projectRoot);
  if (!pathSafety.safe) {
    errors.push(...pathSafety.issues);
  }
  
  // Step 6: Validate command safety
  const commandSafety = validateCommandSafety(output.commands);
  if (!commandSafety.safe) {
    warnings.push(...commandSafety.issues); // Warn but don't block
  }
  
  // Step 7: Detect stubs
  const stubDetection = detectStubs(output.diff);
  if (stubDetection.hasStubs) {
    errors.push(`Stub/placeholder code detected in diff: ${stubDetection.stubs.slice(0, 3).join(', ')}`);
  }
  
  return {
    valid: errors.length === 0,
    errors,
    warnings,
    output,
    diffValidation,
    pathSafety,
    commandSafety,
    stubDetection,
    wasMarkdownWrapped,
  };
}

/**
 * Quick check if output is markdown-wrapped (for error messages)
 */
export function isMarkdownWrapped(raw: string): boolean {
  const trimmed = raw.trim();
  return trimmed.startsWith('```') || trimmed.includes('```json');
}
