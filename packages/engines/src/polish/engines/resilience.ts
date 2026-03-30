/**
 * Resilience Polish Engine
 *
 * Checks: Circuit breakers, retry logic, timeouts, graceful shutdown, bulkhead.
 */

import path from 'path';
import { pathExists, findFile, readFileSafe } from '../utils';
import type { PolishIssue } from '../types';

export default async function resilienceEngine(projectPath: string): Promise<PolishIssue[]> {
  const issues: PolishIssue[] = [];
  const packageJson = await readFileSafe(path.join(projectPath, 'package.json'));
  const srcPath = path.join(projectPath, 'src');
  const hasSrc = await pathExists(srcPath);
  const searchPath = hasSrc ? srcPath : projectPath;

  if (!(packageJson && /opossum|cockatiel|resilience4j|circuit.*breaker/i.test(packageJson))) {
    issues.push({
      id: 'missing-circuit-breaker',
      category: 'Resilience',
      severity: 'medium',
      title: 'Missing Circuit Breaker',
      description: 'No circuit breaker library found. External service failures can cascade.',
      suggestion: 'Add opossum or cockatiel for circuit breaker patterns on external calls.',
      autoFixable: false,
      aiPrompt: 'Implement circuit breaker pattern using opossum for external API calls.',
    });
  }

  const hasRetryLib = packageJson && /axios-retry|got|ky|p-retry|async-retry/i.test(packageJson);
  const hasRetryInCode = await findFile(searchPath, /retry|exponential.*backoff|maxRetries/i);
  if (!hasRetryLib && !hasRetryInCode) {
    issues.push({
      id: 'missing-retry-logic',
      category: 'Resilience',
      severity: 'high',
      title: 'Missing Retry Logic',
      description: 'No retry mechanism found. Transient failures will cause immediate errors.',
      suggestion: 'Add retry logic with exponential backoff for external API calls.',
      autoFixable: false,
      aiPrompt: 'Add retry logic with exponential backoff using p-retry.',
    });
  }

  const hasTimeoutConfig = await findFile(searchPath, /timeout|AbortController|AbortSignal/i);
  if (!hasTimeoutConfig && hasSrc) {
    issues.push({
      id: 'missing-timeouts',
      category: 'Resilience',
      severity: 'high',
      title: 'Missing Request Timeouts',
      description: 'No timeout configuration found. Slow external services can hang your app.',
      suggestion: 'Add timeouts to all external HTTP calls and database queries.',
      autoFixable: false,
      aiPrompt: 'Add timeout handling to all external API calls and database queries.',
    });
  }

  const hasGracefulShutdown = await findFile(searchPath, /graceful.*shutdown|SIGTERM|SIGINT|beforeExit/i);
  if (!hasGracefulShutdown) {
    issues.push({
      id: 'missing-graceful-shutdown',
      category: 'Resilience',
      severity: 'high',
      title: 'Missing Graceful Shutdown',
      description: 'No graceful shutdown handling found. In-flight requests may be dropped.',
      suggestion: 'Add SIGTERM/SIGINT handlers to drain connections before shutdown.',
      autoFixable: true,
      aiPrompt: 'Implement graceful shutdown with SIGTERM/SIGINT handlers.',
    });
  }

  if (!(packageJson && /bottleneck|p-limit|p-queue|semaphore/i.test(packageJson))) {
    issues.push({
      id: 'missing-bulkhead',
      category: 'Resilience',
      severity: 'low',
      title: 'Missing Bulkhead/Rate Limiting for Internal Operations',
      description: 'No internal concurrency limiting found. Resource exhaustion possible.',
      suggestion: 'Add bottleneck or p-limit to limit concurrent operations.',
      autoFixable: false,
      aiPrompt: 'Add concurrency limiting using bottleneck or p-limit.',
    });
  }

  return issues;
}
