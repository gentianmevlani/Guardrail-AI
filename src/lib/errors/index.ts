/**
 * Custom Error Classes
 * 
 * Provides typed, contextual errors for better error handling
 */

import { Result, err } from '../types/result';

/**
 * Base error class for all guardrail AI errors
 */
export class GuardrailError extends Error {
  public readonly code: string;
  public readonly context?: Record<string, unknown>;
  public cause?: Error;

  constructor(
    message: string,
    code: string,
    context?: Record<string, unknown>,
    cause?: Error
  ) {
    super(message);
    this.name = 'GuardrailError';
    this.code = code;
    this.context = context;
    this.cause = cause;
    Error.captureStackTrace(this, this.constructor);
  }

  /**
   * Convert to JSON for logging
   */
  toJSON(): Record<string, unknown> {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      context: this.context,
      stack: this.stack,
      cause: this.cause,
    };
  }
}

/**
 * guardrail validation error
 */
export class GuardrailValidationError extends GuardrailError {
  constructor(
    message: string,
    public readonly ruleId: string,
    public readonly filePath?: string,
    context?: Record<string, unknown>
  ) {
    super(message, 'GUARDRAIL_VALIDATION_ERROR', { ruleId, filePath, ...context });
    this.name = 'GuardrailValidationError';
  }
}

/**
 * Codebase analysis error
 */
export class CodebaseAnalysisError extends GuardrailError {
  constructor(
    message: string,
    public readonly projectPath?: string,
    cause?: Error,
    context?: Record<string, unknown>
  ) {
    super(message, 'CODEBASE_ANALYSIS_ERROR', { projectPath, ...context }, cause);
    this.name = 'CodebaseAnalysisError';
  }
}

/**
 * File operation error
 */
export class FileOperationError extends GuardrailError {
  constructor(
    message: string,
    public readonly filePath: string,
    public readonly operation: 'read' | 'write' | 'delete' | 'exists',
    cause?: Error
  ) {
    super(message, 'FILE_OPERATION_ERROR', { filePath, operation }, cause);
    this.name = 'FileOperationError';
  }
}

/**
 * Configuration error
 */
export class ConfigurationError extends GuardrailError {
  constructor(
    message: string,
    public readonly configKey?: string,
    context?: Record<string, unknown>
  ) {
    super(message, 'CONFIGURATION_ERROR', { configKey, ...context });
    this.name = 'ConfigurationError';
  }
}

/**
 * Validation error
 */
export class ValidationError extends GuardrailError {
  constructor(
    message: string,
    public readonly field?: string,
    public readonly value?: unknown,
    context?: Record<string, unknown>
  ) {
    super(message, 'VALIDATION_ERROR', { field, value, ...context });
    this.name = 'ValidationError';
  }
}

/**
 * API error
 */
export class APIError extends GuardrailError {
  constructor(
    message: string,
    public readonly endpoint?: string,
    public readonly statusCode?: number,
    cause?: Error
  ) {
    super(message, 'API_ERROR', { endpoint, statusCode }, cause);
    this.name = 'APIError';
  }
}

/**
 * ML Model error
 */
export class MLModelError extends GuardrailError {
  constructor(
    message: string,
    public readonly modelPath?: string,
    public readonly operation?: string,
    cause?: Error
  ) {
    super(message, 'ML_MODEL_ERROR', { modelPath, operation }, cause);
    this.name = 'MLModelError';
  }
}

/**
 * Knowledge base error
 */
export class KnowledgeBaseError extends GuardrailError {
  constructor(
    message: string,
    public readonly projectPath?: string,
    public readonly operation?: string,
    cause?: Error
  ) {
    super(message, 'KNOWLEDGE_BASE_ERROR', { projectPath, operation }, cause);
    this.name = 'KnowledgeBaseError';
  }
}

/**
 * Helper to create error result
 */
export function createErrorResult<T>(
  error: GuardrailError
): Result<T, GuardrailError> {
  return err(error);
}


