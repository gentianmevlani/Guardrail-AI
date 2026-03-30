/**
 * Observability Polish Engine
 *
 * Checks: OpenTelemetry, structured logging, metrics, correlation IDs.
 */

import path from 'path';
import { pathExists, findFile, readFileSafe } from '../utils';
import type { PolishIssue } from '../types';

export default async function observabilityEngine(projectPath: string): Promise<PolishIssue[]> {
  const issues: PolishIssue[] = [];
  const packageJson = await readFileSafe(path.join(projectPath, 'package.json'));
  const srcPath = path.join(projectPath, 'src');
  const hasSrc = await pathExists(srcPath);
  const searchPath = hasSrc ? srcPath : projectPath;

  if (!(packageJson && /@opentelemetry|otel/i.test(packageJson))) {
    issues.push({
      id: 'missing-opentelemetry',
      category: 'Observability',
      severity: 'medium',
      title: 'Missing OpenTelemetry',
      description: 'No OpenTelemetry setup found. Distributed tracing helps debug production issues.',
      suggestion: 'Add @opentelemetry/sdk-node and configure tracing for your application.',
      autoFixable: false,
      aiPrompt: 'Set up OpenTelemetry for distributed tracing in my Node.js/Next.js application.',
    });
  }

  if (!(packageJson && /pino|winston|bunyan|@elastic\/ecs-pino-format/i.test(packageJson))) {
    issues.push({
      id: 'missing-structured-logging',
      category: 'Observability',
      severity: 'high',
      title: 'Missing Structured Logging',
      description: 'No structured logging library found. console.log is hard to parse in production.',
      suggestion: 'Add pino or winston for structured JSON logging.',
      autoFixable: false,
      aiPrompt:
        'Set up structured logging using pino with JSON output and proper error serialization.',
    });
  }

  if (!(packageJson && /prom-client|@opentelemetry\/sdk-metrics|datadog-metrics/i.test(packageJson))) {
    issues.push({
      id: 'missing-metrics',
      category: 'Observability',
      severity: 'medium',
      title: 'Missing Metrics Collection',
      description: "No metrics library found. You won't have visibility into application performance.",
      suggestion: 'Add prom-client or OpenTelemetry metrics for application monitoring.',
      autoFixable: false,
      aiPrompt: 'Set up Prometheus metrics collection using prom-client.',
    });
  }

  const hasCorrelationId = await findFile(searchPath, /correlation|request.*id|trace.*id|x-request-id/i);
  if (!hasCorrelationId && hasSrc) {
    issues.push({
      id: 'missing-correlation-ids',
      category: 'Observability',
      severity: 'medium',
      title: 'Missing Request Correlation IDs',
      description: 'No correlation ID handling found. Debugging distributed requests is difficult.',
      suggestion: 'Add correlation ID middleware to trace requests across services.',
      autoFixable: true,
      aiPrompt: 'Add request correlation ID middleware.',
    });
  }

  return issues;
}
