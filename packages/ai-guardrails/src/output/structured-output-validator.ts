import type { StructuredOutputConfig, StructuredOutputValidationResult } from '@guardrail/core';

/**
 * Validates structured model output (JSON + required keys) for agentic workflows.
 */
export class StructuredOutputValidator {
  validate(output: string, config: StructuredOutputConfig): StructuredOutputValidationResult {
    const start = Date.now();

    if (!config.enabled || !config.expectJson) {
      return {
        valid: true,
        errors: [],
        processingTimeMs: Date.now() - start,
      };
    }

    const trimmed = output.trim();
    const fence = trimmed.match(/^```(?:json)?\s*([\s\S]*?)```$/i);
    const jsonStr = fence && fence[1] !== undefined ? fence[1].trim() : trimmed;

    let parsed: unknown;
    try {
      parsed = JSON.parse(jsonStr) as unknown;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      return {
        valid: false,
        errors: [`Output is not valid JSON: ${msg}`],
        processingTimeMs: Date.now() - start,
      };
    }

    const errors: string[] = [];
    if (config.requiredKeys && config.requiredKeys.length > 0) {
      if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
        errors.push('JSON root must be an object when requiredKeys are set');
      } else {
        const o = parsed as Record<string, unknown>;
        for (const k of config.requiredKeys) {
          if (!(k in o)) {
            errors.push(`Missing required key: ${k}`);
          }
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      parsed,
      processingTimeMs: Date.now() - start,
    };
  }
}

export const structuredOutputValidator = new StructuredOutputValidator();
