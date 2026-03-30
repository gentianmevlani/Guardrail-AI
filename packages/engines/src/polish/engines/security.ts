/**
 * Security Polish Engine
 *
 * Checks: .env management, gitignore, security headers, CORS.
 */

import path from 'path';
import { pathExists, readFileSafe } from '../utils';
import type { PolishIssue } from '../types';

export default async function securityEngine(projectPath: string): Promise<PolishIssue[]> {
  const issues: PolishIssue[] = [];

  const hasEnvExample =
    (await pathExists(path.join(projectPath, '.env.example'))) ||
    (await pathExists(path.join(projectPath, '.env.sample')));
  if (!hasEnvExample) {
    issues.push({
      id: 'missing-env-example',
      category: 'Security',
      severity: 'medium',
      title: 'Missing .env.example',
      description: "No .env.example file found. Team members won't know what env vars are needed.",
      suggestion: 'Create .env.example with all required environment variables (without values).',
      autoFixable: true,
    });
  }

  const gitignore = await readFileSafe(path.join(projectPath, '.gitignore'));
  if (gitignore && !gitignore.includes('.env')) {
    issues.push({
      id: 'env-not-gitignored',
      category: 'Security',
      severity: 'critical',
      title: '.env Not in .gitignore',
      description: 'Environment files may be committed to git, exposing secrets.',
      suggestion: 'Add .env* to .gitignore immediately.',
      autoFixable: true,
    });
  }

  const packageJson = await readFileSafe(path.join(projectPath, 'package.json'));
  const hasHelmet = packageJson && /helmet|next-secure-headers/i.test(packageJson);
  if (!hasHelmet) {
    issues.push({
      id: 'missing-security-headers',
      category: 'Security',
      severity: 'high',
      title: 'Missing Security Headers',
      description: 'No security headers library found (helmet, etc.).',
      suggestion: 'Add helmet or security headers middleware for CSP, HSTS, etc.',
      autoFixable: false,
    });
  }

  const hasCors = packageJson && /cors|@fastify\/cors/i.test(packageJson);
  const nextConfig =
    (await readFileSafe(path.join(projectPath, 'next.config.js'))) ||
    (await readFileSafe(path.join(projectPath, 'next.config.mjs'))) ||
    (await readFileSafe(path.join(projectPath, 'next.config.ts')));
  const hasNextCors = nextConfig && /headers|Access-Control/i.test(nextConfig ?? '');

  if (!hasCors && !hasNextCors) {
    issues.push({
      id: 'missing-cors',
      category: 'Security',
      severity: 'medium',
      title: 'No CORS Configuration',
      description: 'No CORS configuration found. May have issues with cross-origin requests.',
      suggestion: 'Add CORS configuration to control which origins can access your API.',
      autoFixable: false,
    });
  }

  return issues;
}
