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
/**
 * Strip markdown code fences from raw agent output (forgiving mode)
 */
export declare function stripMarkdownFences(raw: string): string;
/**
 * Validate the guardrail-v1 JSON shape
 */
export declare function validateJsonShape(obj: unknown): ValidationResult;
/**
 * Parse and validate unified diff format
 */
export declare function validateUnifiedDiff(diff: string): DiffValidationResult;
/**
 * Validate that file paths are safe (no traversal, no system paths)
 */
export declare function validatePathSafety(paths: string[], projectRoot: string): {
    safe: boolean;
    issues: string[];
};
/**
 * Validate that commands are safe to run
 */
export declare function validateCommandSafety(commands: string[]): {
    safe: boolean;
    issues: string[];
};
/**
 * Detect placeholder/stub code in diff additions
 */
export declare function detectStubs(diff: string): {
    hasStubs: boolean;
    stubs: string[];
};
export interface FullValidationResult {
    valid: boolean;
    errors: string[];
    warnings: string[];
    output?: GuardrailV1Output;
    diffValidation?: DiffValidationResult;
    pathSafety?: {
        safe: boolean;
        issues: string[];
    };
    commandSafety?: {
        safe: boolean;
        issues: string[];
    };
    stubDetection?: {
        hasStubs: boolean;
        stubs: string[];
    };
    wasMarkdownWrapped?: boolean;
}
/**
 * Full validation pipeline for agent output
 */
export declare function validateAgentOutput(raw: string, projectRoot: string, options?: {
    strictMarkdown?: boolean;
}): FullValidationResult;
/**
 * Quick check if output is markdown-wrapped (for error messages)
 */
export declare function isMarkdownWrapped(raw: string): boolean;
//# sourceMappingURL=format-validator.d.ts.map