/**
 * Fault-tolerance circuit breaker for engine execution.
 */

enum State {
  Closed,
  Open,
  HalfOpen,
}

export class CircuitBreaker {
  private _state = State.Closed;
  private _failures = 0;
  private _halfOpenTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(
    private readonly _threshold = 5,
    private readonly _cooldownMs = 30_000
  ) {}

  get isOpen(): boolean {
    return this._state === State.Open;
  }

  get state(): 'closed' | 'open' | 'half-open' {
    if (this._state === State.Open) return 'open';
    if (this._state === State.HalfOpen) return 'half-open';
    return 'closed';
  }

  recordSuccess(): void {
    this._failures = 0;
    this._state = State.Closed;
  }

  recordFailure(): void {
    this._failures++;
    if (this._failures >= this._threshold) {
      this._state = State.Open;
      this._scheduleHalfOpen();
    }
  }

  tryAllow(): boolean {
    if (this._state === State.Closed) return true;
    if (this._state === State.HalfOpen) {
      this._state = State.Closed;
      return true;
    }
    return false;
  }

  private _scheduleHalfOpen(): void {
    if (this._halfOpenTimer) clearTimeout(this._halfOpenTimer);
    this._halfOpenTimer = setTimeout(() => {
      this._state = State.HalfOpen;
      this._halfOpenTimer = null;
    }, this._cooldownMs);
  }

  dispose(): void {
    if (this._halfOpenTimer) clearTimeout(this._halfOpenTimer);
  }
}
