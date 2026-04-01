/**
 * Circuit Breaker Pattern
 * 
 * Prevents cascading failures
 */

export interface CircuitBreakerOptions {
  timeout?: number; // Timeout in ms
  errorThresholdPercentage?: number; // % errors before opening
  resetTimeout?: number; // Time before attempting reset
  monitoringPeriod?: number; // Period for error rate calculation
}

export type CircuitState = 'closed' | 'open' | 'half-open';

export class CircuitBreaker {
  private state: CircuitState = 'closed';
  private failures = 0;
  private successes = 0;
  private lastFailureTime: number | null = null;
  private nextAttemptTime: number | null = null;

  constructor(
    private fn: (...args: any[]) => Promise<any>,
    private options: CircuitBreakerOptions = {}
  ) {
    const {
      timeout = 5000,
      errorThresholdPercentage = 50,
      resetTimeout = 30000,
      monitoringPeriod = 60000,
    } = options;

    this.options = {
      timeout,
      errorThresholdPercentage,
      resetTimeout,
      monitoringPeriod,
    };
  }

  async execute(...args: any[]): Promise<any> {
    // Check if circuit should transition
    this.updateState();

    // If circuit is open, return fallback immediately
    if (this.state === 'open') {
      if (this.nextAttemptTime && Date.now() < this.nextAttemptTime) {
        throw new Error('Circuit breaker is open');
      }
      // Try half-open
      this.state = 'half-open';
    }

    try {
      // Execute with timeout
      const result = await Promise.race([
        this.fn(...args),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Timeout')), this.options.timeout)
        ),
      ]);

      // Success
      this.onSuccess();
      return result;
    } catch (error) {
      // Failure
      this.onFailure();
      throw error;
    }
  }

  private updateState() {
    const now = Date.now();

    // Reset monitoring window
    if (this.lastFailureTime && now - this.lastFailureTime > this.options.monitoringPeriod!) {
      this.failures = 0;
      this.successes = 0;
    }

    // Check if should open circuit
    const total = this.failures + this.successes;
    if (total > 0) {
      const errorRate = (this.failures / total) * 100;
      if (errorRate >= this.options.errorThresholdPercentage!) {
        if (this.state === 'closed') {
          this.state = 'open';
          this.nextAttemptTime = now + this.options.resetTimeout!;
        }
      }
    }
  }

  private onSuccess() {
    this.successes++;
    if (this.state === 'half-open') {
      this.state = 'closed';
      this.failures = 0;
      this.successes = 0;
    }
  }

  private onFailure() {
    this.failures++;
    this.lastFailureTime = Date.now();
    if (this.state === 'half-open') {
      this.state = 'open';
      this.nextAttemptTime = Date.now() + this.options.resetTimeout!;
    }
  }

  getState(): CircuitState {
    return this.state;
  }

  reset() {
    this.state = 'closed';
    this.failures = 0;
    this.successes = 0;
    this.lastFailureTime = null;
    this.nextAttemptTime = null;
  }
}

/**
 * Create circuit breaker with fallback
 */
export function createCircuitBreaker<T extends (...args: any[]) => Promise<any>>(
  fn: T,
  fallback: (...args: Parameters<T>) => Promise<ReturnType<T>>,
  options?: CircuitBreakerOptions
): T {
  const breaker = new CircuitBreaker(fn, options);

  return (async (...args: Parameters<T>) => {
    try {
      return await breaker.execute(...args);
    } catch (error) {
      // Return fallback if circuit is open or function fails
      return fallback(...args);
    }
  }) as T;
}

