/**
 * Infrastructure Polish Engine
 *
 * Checks: Docker, CI/CD, deployment config, env validation.
 */

import path from 'path';
import { pathExists, readFileSafe } from '../utils';
import type { PolishIssue } from '../types';

export default async function infrastructureEngine(projectPath: string): Promise<PolishIssue[]> {
  const issues: PolishIssue[] = [];
  const packageJson = await readFileSafe(path.join(projectPath, 'package.json'));

  const hasDocker =
    (await pathExists(path.join(projectPath, 'Dockerfile'))) ||
    (await pathExists(path.join(projectPath, 'docker-compose.yml')));
  if (!hasDocker) {
    issues.push({
      id: 'missing-docker',
      category: 'Infrastructure',
      severity: 'low',
      title: 'Missing Docker Configuration',
      description: 'No Docker setup found. Deployment may be inconsistent.',
      suggestion: 'Add Dockerfile for consistent deployment environments.',
      autoFixable: true,
    });
  }

  const hasCi =
    (await pathExists(path.join(projectPath, '.github', 'workflows'))) ||
    (await pathExists(path.join(projectPath, '.gitlab-ci.yml'))) ||
    (await pathExists(path.join(projectPath, '.circleci')));
  if (!hasCi) {
    issues.push({
      id: 'missing-ci',
      category: 'Infrastructure',
      severity: 'high',
      title: 'Missing CI/CD Configuration',
      description: 'No CI/CD pipeline found. Code changes are not automatically tested.',
      suggestion: 'Add GitHub Actions, GitLab CI, or CircleCI for automated testing.',
      autoFixable: true,
    });
  }

  const hasDeployConfig =
    (await pathExists(path.join(projectPath, 'vercel.json'))) ||
    (await pathExists(path.join(projectPath, 'netlify.toml'))) ||
    (await pathExists(path.join(projectPath, 'railway.json')));
  if (!hasDeployConfig && !hasDocker) {
    issues.push({
      id: 'missing-deployment-config',
      category: 'Infrastructure',
      severity: 'medium',
      title: 'No Deployment Configuration',
      description: 'No deployment platform configuration found.',
      suggestion: 'Add vercel.json, netlify.toml, or similar for deployment settings.',
      autoFixable: false,
    });
  }

  const hasEnvValidation = packageJson && /@t3-oss\/env|envalid|dotenv-safe/i.test(packageJson);
  if (!hasEnvValidation) {
    issues.push({
      id: 'missing-env-validation',
      category: 'Infrastructure',
      severity: 'medium',
      title: 'No Environment Validation',
      description: 'Environment variables are not validated at startup.',
      suggestion: 'Add @t3-oss/env-nextjs or envalid to validate env vars at startup.',
      autoFixable: false,
    });
  }

  return issues;
}
