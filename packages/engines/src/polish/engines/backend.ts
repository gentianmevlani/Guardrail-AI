/**
 * Backend Polish Engine
 *
 * Checks: Health endpoints, input validation, rate limiting, error handling.
 */

import path from 'path';
import { pathExists, findFile, readFileSafe } from '../utils';
import type { PolishIssue } from '../types';

export default async function backendEngine(projectPath: string): Promise<PolishIssue[]> {
  const issues: PolishIssue[] = [];
  const apiPath = path.join(projectPath, 'src', 'server');
  const apiAltPath = path.join(projectPath, 'api');
  const pagesApiPath = path.join(projectPath, 'pages', 'api');
  const appApiPath = path.join(projectPath, 'app', 'api');

  const hasApi =
    (await pathExists(apiPath)) ||
    (await pathExists(apiAltPath)) ||
    (await pathExists(pagesApiPath)) ||
    (await pathExists(appApiPath));

  if (!hasApi) return issues;

  const packageJson = await readFileSafe(path.join(projectPath, 'package.json'));

  const hasHealth = await findFile(projectPath, /health|healthcheck|status/i);
  if (!hasHealth) {
    issues.push({
      id: 'missing-health-endpoint',
      category: 'Backend',
      severity: 'high',
      title: 'Missing Health Endpoint',
      description:
        "No health check endpoint found. Load balancers and monitoring can't verify service status.",
      suggestion: 'Add a /health or /api/health endpoint that returns service status.',
      autoFixable: true,
    });
  }

  if (packageJson) {
    const hasValidation = /zod|yup|joi|class-validator|ajv/i.test(packageJson);
    if (!hasValidation) {
      issues.push({
        id: 'missing-validation',
        category: 'Backend',
        severity: 'high',
        title: 'Missing Input Validation',
        description: 'No validation library found. API inputs may not be properly validated.',
        suggestion: 'Add zod, yup, joi, or similar for input validation.',
        autoFixable: false,
      });
    }
  }

  const hasRateLimiting =
    packageJson && /rate-limit|ratelimit|express-rate-limit|@upstash\/ratelimit/i.test(packageJson);
  if (!hasRateLimiting) {
    issues.push({
      id: 'missing-rate-limiting',
      category: 'Backend',
      severity: 'high',
      title: 'Missing Rate Limiting',
      description: 'No rate limiting found. API is vulnerable to abuse and DDoS.',
      suggestion: 'Add rate limiting middleware to protect your API.',
      autoFixable: false,
    });
  }

  const hasErrorMiddleware = await findFile(projectPath, /errorHandler|error-handler|errorMiddleware/i);
  if (!hasErrorMiddleware) {
    issues.push({
      id: 'missing-error-handler',
      category: 'Backend',
      severity: 'medium',
      title: 'Missing Global Error Handler',
      description: 'No global error handler found. Unhandled errors may leak stack traces.',
      suggestion: 'Add a global error handler middleware that catches and formats errors.',
      autoFixable: true,
    });
  }

  return issues;
}
