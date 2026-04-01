/**
 * SEO Polish Engine
 *
 * Checks: robots.txt, sitemap, meta tags, Open Graph.
 */

import path from 'path';
import { pathExists, findFile } from '../utils';
import type { PolishIssue } from '../types';

export default async function seoEngine(projectPath: string): Promise<PolishIssue[]> {
  const issues: PolishIssue[] = [];

  const hasRobots = await pathExists(path.join(projectPath, 'public', 'robots.txt'));
  if (!hasRobots) {
    issues.push({
      id: 'missing-robots',
      category: 'SEO',
      severity: 'medium',
      title: 'Missing robots.txt',
      description: 'No robots.txt file found. Search engines may not crawl correctly.',
      suggestion: 'Add robots.txt to public folder to guide search engine crawlers.',
      autoFixable: true,
    });
  }

  const hasSitemap =
    (await pathExists(path.join(projectPath, 'public', 'sitemap.xml'))) ||
    (await findFile(projectPath, /sitemap/i));
  if (!hasSitemap) {
    issues.push({
      id: 'missing-sitemap',
      category: 'SEO',
      severity: 'medium',
      title: 'Missing Sitemap',
      description: 'No sitemap found. Search engines may miss some pages.',
      suggestion: 'Generate sitemap.xml for better search engine indexing.',
      autoFixable: false,
    });
  }

  const hasMetaTags = await findFile(projectPath, /MetaTags|Seo|Head|metadata/i);
  if (!hasMetaTags) {
    issues.push({
      id: 'missing-meta-setup',
      category: 'SEO',
      severity: 'high',
      title: 'Missing Meta Tag Setup',
      description: 'No meta tag component found. Pages may lack proper SEO metadata.',
      suggestion: 'Add a SEO/MetaTags component for consistent meta descriptions.',
      autoFixable: true,
    });
  }

  const hasOgImage =
    (await pathExists(path.join(projectPath, 'public', 'og-image.png'))) ||
    (await pathExists(path.join(projectPath, 'public', 'og.png'))) ||
    (await findFile(path.join(projectPath, 'public'), /og[-_]?image/i));
  if (!hasOgImage) {
    issues.push({
      id: 'missing-og-image',
      category: 'SEO',
      severity: 'low',
      title: 'Missing Open Graph Image',
      description: 'No OG image found. Social media shares will look plain.',
      suggestion: 'Add og-image.png to public folder for social media previews.',
      autoFixable: false,
    });
  }

  return issues;
}
