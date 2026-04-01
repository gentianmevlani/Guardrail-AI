/**
 * Error Recovery System
 * 
 * Graceful error handling with recovery suggestions
 */

export interface ErrorContext {
  command: string;
  error: Error;
  timestamp: string;
  context: Record<string, any>;
  recovery?: RecoveryAction[];
}

export interface RecoveryAction {
  type: 'retry' | 'suggest' | 'fallback' | 'skip';
  description: string;
  action?: () => Promise<void>;
}

class ErrorRecovery {
  private errorHistory: ErrorContext[] = [];
  private readonly maxHistory = 100;

  /**
   * Handle error with recovery
   */
  async handleError(
    command: string,
    error: Error,
    context: Record<string, any> = {}
  ): Promise<ErrorContext> {
    const errorContext: ErrorContext = {
      command,
      error,
      timestamp: new Date().toISOString(),
      context,
      recovery: this.generateRecoveryActions(command, error, context),
    };

    this.errorHistory.push(errorContext);

    // Keep only last N errors
    if (this.errorHistory.length > this.maxHistory) {
      this.errorHistory.shift();
    }

    return errorContext;
  }

  /**
   * Generate recovery actions
   */
  private generateRecoveryActions(
    command: string,
    error: Error,
    context: Record<string, any>
  ): RecoveryAction[] {
    const actions: RecoveryAction[] = [];
    const errorMessage = error.message.toLowerCase();

    // File not found errors
    if (errorMessage.includes('cannot find') || errorMessage.includes('enoent')) {
      actions.push({
        type: 'suggest',
        description: 'File or directory not found. Check if the path is correct.',
      });
      actions.push({
        type: 'suggest',
        description: 'Run "guardrail setup" to ensure all files are created.',
      });
    }

    // Permission errors
    if (errorMessage.includes('permission') || errorMessage.includes('eacces')) {
      actions.push({
        type: 'suggest',
        description: 'Permission denied. Try running with appropriate permissions.',
      });
    }

    // Network errors
    if (errorMessage.includes('network') || errorMessage.includes('fetch')) {
      actions.push({
        type: 'retry',
        description: 'Network error detected. You can retry the command.',
      });
      actions.push({
        type: 'suggest',
        description: 'Check your internet connection and try again.',
      });
    }

    // Configuration errors
    if (errorMessage.includes('config') || errorMessage.includes('missing')) {
      actions.push({
        type: 'suggest',
        description: 'Configuration issue detected. Run "guardrail setup" to fix.',
      });
    }

    // Generic retry
    if (actions.length === 0) {
      actions.push({
        type: 'retry',
        description: 'You can try running the command again.',
      });
      actions.push({
        type: 'suggest',
        description: 'Run "guardrail help" for available commands.',
      });
    }

    return actions;
  }

  /**
   * Get error history
   */
  getErrorHistory(limit: number = 10): ErrorContext[] {
    return this.errorHistory.slice(-limit);
  }

  /**
   * Get most common errors
   */
  getCommonErrors(): Array<{ error: string; count: number }> {
    const errorCounts = new Map<string, number>();

    for (const errorContext of this.errorHistory) {
      const key = errorContext.error.message;
      errorCounts.set(key, (errorCounts.get(key) || 0) + 1);
    }

    return Array.from(errorCounts.entries())
      .map(([error, count]) => ({ error, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
  }

  /**
   * Clear error history
   */
  clearHistory(): void {
    this.errorHistory = [];
  }
}

export const errorRecovery = new ErrorRecovery();

