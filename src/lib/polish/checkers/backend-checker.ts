/**
 * Backend Polish Checker
 * 
 * Checks for backend-specific polish issues
 */

import * as path from 'path';
import type { PolishChecker, PolishIssue } from '../types';
import { pathExists, findFile, fileContains } from '../utils';

export class BackendPolishChecker implements PolishChecker {
  getCategory(): string {
    return 'Backend';
  }

  async check(projectPath: string): Promise<PolishIssue[]> {
    const issues: PolishIssue[] = [];
    const srcPath = path.join(projectPath, 'src');

    if (!(await pathExists(srcPath))) {
      return issues;
    }

    // Check for health check endpoint
    const hasHealthCheck = await findFile(srcPath, /health|healthcheck/i);
    if (!hasHealthCheck) {
      issues.push({
        id: 'missing-health-check',
        category: this.getCategory(),
        severity: 'high',
        title: 'Missing Health Check Endpoint',
        description: 'No health check endpoint found. Monitoring and load balancers need this.',
        suggestion: 'Add /api/health or /health endpoint that returns service status.',
        autoFixable: true,
      });
    }

    // Check for error handling middleware
    const hasErrorHandler = await findFile(srcPath, /error.*handler|error.*middleware/i);
    if (!hasErrorHandler) {
      issues.push({
        id: 'missing-error-handler',
        category: this.getCategory(),
        severity: 'high',
        title: 'Missing Error Handler',
        description: 'No centralized error handling middleware found. Errors may not be handled consistently.',
        suggestion: 'Add error handling middleware to catch and format errors consistently.',
        autoFixable: true,
      });
    }

    // Check for rate limiting
    const hasRateLimit = await findFile(srcPath, /rate.*limit|ratelimit/i);
    if (!hasRateLimit) {
      issues.push({
        id: 'missing-rate-limiting',
        category: this.getCategory(),
        severity: 'high',
        title: 'Missing Rate Limiting',
        description: 'No rate limiting found. API is vulnerable to abuse and DDoS attacks.',
        suggestion: 'Add rate limiting middleware to protect your API endpoints.',
        autoFixable: false,
      });
    }

    // Check for request validation
    const hasValidation = await findFile(srcPath, /validate|validation|zod|joi/i);
    if (!hasValidation) {
      issues.push({
        id: 'missing-request-validation',
        category: this.getCategory(),
        severity: 'high',
        title: 'Missing Request Validation',
        description: 'No request validation found. Invalid data may cause errors or security issues.',
        suggestion: 'Add request validation using Zod, Joi, or similar library.',
        autoFixable: false,
      });
    }

    return issues;
  }
}


