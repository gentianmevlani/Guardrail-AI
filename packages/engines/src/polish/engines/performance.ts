/**
 * Performance Polish Engine
 *
 * Checks: Image optimization, caching, bundle analysis.
 */

import path from 'path';
import { findFile, readFileSafe } from '../utils';
import type { PolishIssue } from '../types';

export default async function performanceEngine(projectPath: string): Promise<PolishIssue[]> {
  const issues: PolishIssue[] = [];
  const packageJson = await readFileSafe(path.join(projectPath, 'package.json'));

  const nextConfig =
    (await readFileSafe(path.join(projectPath, 'next.config.js'))) ||
    (await readFileSafe(path.join(projectPath, 'next.config.mjs')));
  const hasImageOptimization =
    (packageJson && /sharp|next\/image|@next\/image/i.test(packageJson)) ||
    (nextConfig && /images:/i.test(nextConfig ?? ''));

  if (!hasImageOptimization) {
    issues.push({
      id: 'missing-image-optimization',
      category: 'Performance',
      severity: 'medium',
      title: 'Missing Image Optimization',
      description: 'No image optimization setup found. Images may be served unoptimized.',
      suggestion: 'Use Next.js Image component or sharp for image optimization.',
      autoFixable: false,
    });
  }

  const hasCaching = await findFile(projectPath, /cache|stale-while-revalidate/i);
  if (!hasCaching) {
    issues.push({
      id: 'missing-caching',
      category: 'Performance',
      severity: 'medium',
      title: 'No Caching Strategy',
      description: 'No caching configuration found. API responses may not be cached.',
      suggestion: 'Add Cache-Control headers or use SWR/React Query for client-side caching.',
      autoFixable: false,
    });
  }

  const hasBundleAnalyzer =
    packageJson && /@next\/bundle-analyzer|webpack-bundle-analyzer/i.test(packageJson);
  if (!hasBundleAnalyzer) {
    issues.push({
      id: 'missing-bundle-analyzer',
      category: 'Performance',
      severity: 'low',
      title: "No Bundle Analyzer",
      description: "No bundle analyzer installed. Can't visualize bundle size.",
      suggestion: 'Add @next/bundle-analyzer to track and optimize bundle size.',
      autoFixable: false,
    });
  }

  return issues;
}
