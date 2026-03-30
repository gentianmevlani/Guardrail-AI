/**
 * Engine Error Standardization
 * 
 * Provides unified error handling across all detection engines.
 * Ensures consistent error shapes and proper error propagation.
 */

export enum EngineErrorCode {
  // Configuration errors
  INVALID_CONFIG = 'INVALID_CONFIG',
  MISSING_CONFIG = 'MISSING_CONFIG',
  
  // Network/IO errors
  NETWORK_ERROR = 'NETWORK_ERROR',
  TIMEOUT_ERROR = 'TIMEOUT_ERROR',
  IO_ERROR = 'IO_ERROR',
  
  // Parsing/AST errors
  PARSE_ERROR = 'PARSE_ERROR',
  INVALID_SYNTAX = 'INVALID_SYNTAX',
  
  // Cache errors
  CACHE_ERROR = 'CACHE_ERROR',
  CACHE_MISS = 'CACHE_MISS',
  
  // Validation errors
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  INVALID_INPUT = 'INVALID_INPUT',
  
  // Runtime errors
  RUNTIME_ERROR = 'RUNTIME_ERROR',
  MEMORY_ERROR = 'MEMORY_ERROR',
  RESOURCE_EXHAUSTED = 'RESOURCE_EXHAUSTED',
  
  // External service errors
  SERVICE_UNAVAILABLE = 'SERVICE_UNAVAILABLE',
  RATE_LIMITED = 'RATE_LIMITED',
  AUTHENTICATION_ERROR = 'AUTHENTICATION_ERROR',
  
  // Generic errors
  UNKNOWN_ERROR = 'UNKNOWN_ERROR',
  INTERNAL_ERROR = 'INTERNAL_ERROR',
}

export interface EngineErrorContext {
  engine?: string;
  filePath?: string;
  line?: number;
  column?: number;
  package?: string;
  url?: string;
  [key: string]: unknown;
}

/**
 * Standardized engine error class
 */
export class EngineError extends Error {
  public readonly code: EngineErrorCode;
  public readonly context: EngineErrorContext;
  public readonly recoverable: boolean;
  public readonly retryable: boolean;

  constructor(
    code: EngineErrorCode,
    message: string,
    context: EngineErrorContext = {},
    recoverable: boolean = false,
    retryable: boolean = false
  ) {
    super(message);
    this.name = 'EngineError';
    this.code = code;
    this.context = context;
    this.recoverable = recoverable;
    this.retryable = retryable;
    
    // Maintains proper stack trace for where our error was thrown
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, EngineError);
    }
  }

  /**
   * Convert to serializable format for logging/transport
   */
  toJSON(): Record<string, unknown> {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      context: this.context,
      recoverable: this.recoverable,
      retryable: this.retryable,
      stack: this.stack,
    };
  }

  /**
   * Create a network error with retry capability
   */
  static network(message: string, context: EngineErrorContext = {}): EngineError {
    return new EngineError(
      EngineErrorCode.NETWORK_ERROR,
      message,
      context,
      true, // recoverable
      true  // retryable
    );
  }

  /**
   * Create a timeout error with retry capability
   */
  static timeout(message: string, context: EngineErrorContext = {}): EngineError {
    return new EngineError(
      EngineErrorCode.TIMEOUT_ERROR,
      message,
      context,
      true, // recoverable
      true  // retryable
    );
  }

  /**
   * Create a parse error (not retryable)
   */
  static parse(message: string, context: EngineErrorContext = {}): EngineError {
    return new EngineError(
      EngineErrorCode.PARSE_ERROR,
      message,
      context,
      false, // not recoverable
      false  // not retryable
    );
  }

  /**
   * Create a configuration error (not retryable)
   */
  static config(message: string, context: EngineErrorContext = {}): EngineError {
    return new EngineError(
      EngineErrorCode.INVALID_CONFIG,
      message,
      context,
      false, // not recoverable
      false  // not retryable
    );
  }

  /**
   * Create a service unavailable error (retryable)
   */
  static unavailable(message: string, context: EngineErrorContext = {}): EngineError {
    return new EngineError(
      EngineErrorCode.SERVICE_UNAVAILABLE,
      message,
      context,
      true, // recoverable
      true  // retryable
    );
  }

  /**
   * Create a validation error (not retryable)
   */
  static validation(message: string, context: EngineErrorContext = {}): EngineError {
    return new EngineError(
      EngineErrorCode.VALIDATION_ERROR,
      message,
      context,
      false, // not recoverable
      false  // not retryable
    );
  }
}

/**
 * Utility to wrap async operations with standardized error handling
 */
export function withEngineErrorHandling<T>(
  operation: () => Promise<T>,
  context: EngineErrorContext = {},
  errorMapper?: (error: unknown) => EngineError
): Promise<T> {
  return operation().catch((error: unknown) => {
    if (error instanceof EngineError) {
      throw error;
    }

    // Try to map common error types
    if (error instanceof Error) {
      if (error.name === 'AbortError' || error.message.includes('timeout')) {
        throw EngineError.timeout(error.message, context);
      }
      
      if (error.message.includes('fetch') || error.message.includes('network')) {
        throw EngineError.network(error.message, context);
      }

      if (error.message.includes('parse') || error.message.includes('syntax')) {
        throw EngineError.parse(error.message, context);
      }
    }

    // Use custom error mapper if provided
    if (errorMapper) {
      throw errorMapper(error);
    }

    // Fallback to generic error
    throw new EngineError(
      EngineErrorCode.UNKNOWN_ERROR,
      error instanceof Error ? error.message : String(error),
      context,
      false,
      false
    );
  });
}

/**
 * Type guard to check if an error is an EngineError
 */
export function isEngineError(error: unknown): error is EngineError {
  return error instanceof EngineError;
}

/**
 * Helper to create context for errors
 */
export function createContext(
  engine: string,
  filePath?: string,
  additional: Record<string, unknown> = {}
): EngineErrorContext {
  return {
    engine,
    filePath,
    timestamp: new Date().toISOString(),
    ...additional,
  };
}
