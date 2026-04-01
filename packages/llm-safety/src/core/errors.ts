/**
 * Error hierarchy for the LLM guardrail framework.
 */

export class GuardrailError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly cause?: unknown
  ) {
    super(message);
    this.name = 'GuardrailError';
  }
}

export class EngineExecutionError extends GuardrailError {
  constructor(engineId: string, message: string, cause?: unknown) {
    super(`[${engineId}] ${message}`, 'ENGINE_EXECUTION', cause);
    this.name = 'EngineExecutionError';
  }
}

export class ConfigValidationError extends GuardrailError {
  constructor(message: string, public readonly errors: string[]) {
    super(message, 'CONFIG_VALIDATION');
    this.name = 'ConfigValidationError';
  }
}

export class CircuitOpenError extends GuardrailError {
  constructor(engineId: string) {
    super(`Circuit breaker open for engine ${engineId}`, 'CIRCUIT_OPEN');
    this.name = 'CircuitOpenError';
  }
}
