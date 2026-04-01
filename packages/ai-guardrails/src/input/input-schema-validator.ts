import {
  InputSchemaRule,
  InputSchemaResult,
} from '@guardrail/core';

/**
 * Input Schema Validator — Input Guardrail
 *
 * Validates user input against configurable structural rules:
 * length constraints, language detection, blocked patterns,
 * required fields, and custom validation functions.
 */
export class InputSchemaValidator {
  private rules: InputSchemaRule;

  constructor(rules?: Partial<InputSchemaRule>) {
    this.rules = {
      maxLength: rules?.maxLength ?? 100_000,
      minLength: rules?.minLength ?? 1,
      allowedLanguages: rules?.allowedLanguages,
      blockedPatterns: rules?.blockedPatterns ?? [],
      requiredFields: rules?.requiredFields,
      customValidators: rules?.customValidators ?? [],
    };
  }

  /**
   * Validate input against schema rules
   */
  async validate(input: string): Promise<InputSchemaResult> {
    const errors: Array<{ field: string; message: string; code: string }> = [];
    const warnings: Array<{ field: string; message: string }> = [];

    // Length validation
    if (this.rules.maxLength && input.length > this.rules.maxLength) {
      errors.push({
        field: 'content',
        message: `Input exceeds maximum length of ${this.rules.maxLength} characters (got ${input.length})`,
        code: 'INPUT_TOO_LONG',
      });
    }

    if (this.rules.minLength && input.trim().length < this.rules.minLength) {
      errors.push({
        field: 'content',
        message: `Input is below minimum length of ${this.rules.minLength} characters`,
        code: 'INPUT_TOO_SHORT',
      });
    }

    // Empty/whitespace check
    if (input.trim().length === 0) {
      errors.push({
        field: 'content',
        message: 'Input is empty or contains only whitespace',
        code: 'INPUT_EMPTY',
      });
    }

    // Blocked patterns
    if (this.rules.blockedPatterns) {
      for (const pattern of this.rules.blockedPatterns) {
        if (pattern.test(input)) {
          errors.push({
            field: 'content',
            message: `Input matches blocked pattern: ${pattern.source}`,
            code: 'BLOCKED_PATTERN',
          });
        }
      }
    }

    // Character encoding validation
    const encodingIssues = this.validateEncoding(input);
    for (const issue of encodingIssues) {
      warnings.push({ field: 'encoding', message: issue });
    }

    // Control character detection
    const controlChars = this.detectControlCharacters(input);
    if (controlChars.length > 0) {
      warnings.push({
        field: 'content',
        message: `Input contains ${controlChars.length} control characters at positions: ${controlChars.slice(0, 5).join(', ')}${controlChars.length > 5 ? '...' : ''}`,
      });
    }

    // Excessive repetition detection
    const repetitionResult = this.detectExcessiveRepetition(input);
    if (repetitionResult.excessive) {
      warnings.push({
        field: 'content',
        message: `Excessive character repetition detected: "${repetitionResult.pattern}" repeated ${repetitionResult.count} times`,
      });
    }

    // Token estimation warning
    const estimatedTokens = this.estimateTokens(input);
    if (estimatedTokens > 10_000) {
      warnings.push({
        field: 'tokens',
        message: `Input estimated at ~${estimatedTokens} tokens — may be expensive to process`,
      });
    }

    // Custom validators
    if (this.rules.customValidators) {
      for (const validator of this.rules.customValidators) {
        const result = validator(input);
        if (!result.valid) {
          errors.push({
            field: 'custom',
            message: result.reason || 'Custom validation failed',
            code: 'CUSTOM_VALIDATION_FAILED',
          });
        }
      }
    }

    // Normalize input
    const normalizedInput = this.normalize(input);

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      normalizedInput,
    };
  }

  /**
   * Update schema rules
   */
  updateRules(rules: Partial<InputSchemaRule>): void {
    this.rules = { ...this.rules, ...rules };
  }

  /**
   * Get current rules
   */
  getRules(): InputSchemaRule {
    return { ...this.rules };
  }

  private validateEncoding(input: string): string[] {
    const issues: string[] = [];

    // Check for null bytes
    if (input.includes('\0')) {
      issues.push('Input contains null bytes');
    }

    // Check for byte order marks
    if (input.charCodeAt(0) === 0xFEFF) {
      issues.push('Input contains BOM (Byte Order Mark)');
    }

    // Check for mixed directional text
    const rtlChars = input.match(/[\u0591-\u07FF\uFB1D-\uFDFD\uFE70-\uFEFC]/g);
    const ltrChars = input.match(/[a-zA-Z]/g);
    if (rtlChars && ltrChars && rtlChars.length > 5 && ltrChars.length > 5) {
      issues.push('Input contains mixed directional text (potential BiDi attack)');
    }

    return issues;
  }

  private detectControlCharacters(input: string): number[] {
    const positions: number[] = [];
    for (let i = 0; i < input.length; i++) {
      const code = input.charCodeAt(i);
      // Control chars except tab, newline, carriage return
      if ((code < 32 && code !== 9 && code !== 10 && code !== 13) ||
          (code >= 127 && code <= 159)) {
        positions.push(i);
      }
    }
    return positions;
  }

  private detectExcessiveRepetition(input: string): {
    excessive: boolean;
    pattern?: string;
    count?: number;
  } {
    // Single character repetition
    const singleRepeat = input.match(/(.)\1{49,}/);
    if (singleRepeat) {
      return {
        excessive: true,
        pattern: singleRepeat[1],
        count: singleRepeat[0].length,
      };
    }

    // Word repetition
    const words = input.split(/\s+/);
    if (words.length > 10) {
      let maxRepeat = 0;
      let repeatedWord = '';
      let currentWord = '';
      let currentCount = 0;

      for (const word of words) {
        if (word.toLowerCase() === currentWord) {
          currentCount++;
          if (currentCount > maxRepeat) {
            maxRepeat = currentCount;
            repeatedWord = word;
          }
        } else {
          currentWord = word.toLowerCase();
          currentCount = 1;
        }
      }

      if (maxRepeat >= 10) {
        return { excessive: true, pattern: repeatedWord, count: maxRepeat };
      }
    }

    return { excessive: false };
  }

  private estimateTokens(input: string): number {
    // Rough estimation: ~4 chars per token for English
    return Math.ceil(input.length / 4);
  }

  private normalize(input: string): string {
    let normalized = input;

    // Remove null bytes
    normalized = normalized.replace(/\0/g, '');

    // Remove BOM
    if (normalized.charCodeAt(0) === 0xFEFF) {
      normalized = normalized.slice(1);
    }

    // Normalize unicode
    normalized = normalized.normalize('NFC');

    // Trim
    normalized = normalized.trim();

    return normalized;
  }
}

export const inputSchemaValidator = new InputSchemaValidator();
