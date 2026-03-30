/**
 * BaseEngine — Standardized error handling and lifecycle for all detection engines.
 *
 * Provides:
 * - Consistent error wrapping with context
 * - Timeout protection with AbortSignal
 * - Structured error logging
 * - Resource cleanup tracking
 * - Metrics collection
 */

import type { Finding, DeltaContext, ScanEngine } from './core-types';

export interface EngineError extends Error {
  engineId: string;
  code: string;
  context?: Record<string, unknown>;
  originalError?: Error;
}

export interface EngineMetrics {
  scansCompleted: number;
  scansFailed: number;
  avgScanMs: number;
  totalFindings: number;
  lastScanAt: number;
}

export abstract class BaseEngine implements ScanEngine {
  public abstract readonly id: string;
  
  protected metrics: EngineMetrics = {
    scansCompleted: 0,
    scansFailed: 0,
    avgScanMs: 0,
    totalFindings: 0,
    lastScanAt: 0,
  };

  protected defaultTimeoutMs = 30000; // 30 seconds default
  
  /**
   * Core scan implementation with error handling and timeout protection
   */
  async scan(delta: DeltaContext, signal: AbortSignal): Promise<Finding[]> {
    const startTime = Date.now();
    let findings: Finding[] = [];

    try {
      // Create timeout controller if not provided
      const timeoutController = new AbortController();
      const timeoutId = setTimeout(() => {
        timeoutController.abort();
      }, this.defaultTimeoutMs);

      // Chain abort signals
      signal.addEventListener('abort', () => {
        clearTimeout(timeoutId);
        timeoutController.abort();
      }, { once: true });

      // Run the actual scan
      findings = await this.scanWithTimeout(delta, timeoutController.signal);
      
      // Update metrics
      const scanMs = Date.now() - startTime;
      this.updateMetrics(scanMs, findings.length, true);
      
      return findings;
    } catch (error) {
      const scanMs = Date.now() - startTime;
      this.updateMetrics(scanMs, 0, false);
      
      // Wrap and rethrow with context
      throw this.wrapError(error as Error);
    }
  }

  /**
   * Override this method in concrete engines
   */
  protected abstract scanWithTimeout(delta: DeltaContext, signal: AbortSignal): Promise<Finding[]>;

  /**
   * Optional activation hook
   */
  async activate?(): Promise<void> {
    // Default implementation does nothing
  }

  /**
   * Optional cleanup hook
   */
  dispose?(): void {
    // Default implementation does nothing
  }

  /**
   * Get current engine metrics
   */
  getMetrics(): EngineMetrics {
    return { ...this.metrics };
  }

  /**
   * Wrap errors with engine context
   */
  protected wrapError(error: Error, context?: Record<string, unknown>): EngineError {
    const engineError: EngineError = {
      name: 'EngineError',
      message: `${this.id}: ${error.message}`,
      stack: error.stack,
      engineId: this.id,
      code: this.getErrorCode(error),
      context,
      originalError: error,
    };

    return engineError;
  }

  /**
   * Convert errors to standardized codes
   */
  protected getErrorCode(error: Error): string {
    if (error.name === 'AbortError') return 'TIMEOUT';
    if (error.name === 'ValidationError') return 'VALIDATION';
    if (error.name === 'NetworkError') return 'NETWORK';
    if (error.name === 'FileSystemError') return 'FS_ERROR';
    return 'UNKNOWN';
  }

  /**
   * Update engine metrics
   */
  private updateMetrics(scanMs: number, findingsCount: number, success: boolean): void {
    if (success) {
      this.metrics.scansCompleted++;
      this.metrics.totalFindings += findingsCount;
    } else {
      this.metrics.scansFailed++;
    }

    // Update rolling average
    const totalScans = this.metrics.scansCompleted + this.metrics.scansFailed;
    if (totalScans === 1) {
      this.metrics.avgScanMs = scanMs;
    } else {
      this.metrics.avgScanMs = 
        (this.metrics.avgScanMs * (totalScans - 1) + scanMs) / totalScans;
    }

    this.metrics.lastScanAt = Date.now();
  }

  /**
   * Log structured error information
   */
  protected logError(error: EngineError): void {
    const logData = {
      engine: this.id,
      code: error.code,
      message: error.message,
      context: error.context,
      timestamp: new Date().toISOString(),
    };

    // Use structured logging - in real implementation this would go to a logger
    console.error('[ENGINE_ERROR]', JSON.stringify(logData, null, 2));
  }
}
