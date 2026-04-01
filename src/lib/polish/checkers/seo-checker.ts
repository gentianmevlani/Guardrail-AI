/**
 * SEO Polish Checker
 */

import * as path from 'path';
import * as fs from 'fs';
import type { PolishChecker, PolishIssue } from '../types';
import { pathExists, findAllFiles, readFileSafe } from '../utils';

export class SEOPolishChecker implements PolishChecker {
  getCategory(): string {
    return 'SEO';
  }

  async check(projectPath: string): Promise<PolishIssue[]> {
    const issues: PolishIssue[] = [];

    if (!(await this.isWebProject(projectPath))) {
      return issues;
    }

    // Check HTML files for meta tags
    const htmlFiles = await findAllFiles(projectPath, /\.html$/);
    for (const htmlFile of htmlFiles.slice(0, 5)) {
      const content = await readFileSafe(htmlFile);
      if (!content) continue;

      if (!content.includes('<meta name="description"')) {
        issues.push({
          id: 'missing-meta-description',
          category: this.getCategory(),
          severity: 'high',
          title: 'Missing Meta Description',
          description: 'HTML file missing meta description tag.',
          file: path.relative(projectPath, htmlFile),
          suggestion: 'Add <meta name="description" content="..."> to HTML head.',
          autoFixable: false,
        });
      }

      if (!content.includes('<meta name="viewport"')) {
        issues.push({
          id: 'missing-viewport',
          category: this.getCategory(),
          severity: 'critical',
          title: 'Missing Viewport Meta Tag',
          description: 'Missing viewport meta tag. Mobile devices won\'t render correctly.',
          file: path.relative(projectPath, htmlFile),
          suggestion: 'Add <meta name="viewport" content="width=device-width, initial-scale=1">',
          autoFixable: true,
        });
      }

      if (!content.includes('<title>')) {
        issues.push({
          id: 'missing-title',
          category: this.getCategory(),
          severity: 'high',
          title: 'Missing Page Title',
          description: 'HTML file missing <title> tag.',
          file: path.relative(projectPath, htmlFile),
          suggestion: 'Add <title> tag to HTML head.',
          autoFixable: false,
        });
      }
    }

    // Check for robots.txt
    const hasRobots = await pathExists(path.join(projectPath, 'public', 'robots.txt')) ||
                     await pathExists(path.join(projectPath, 'robots.txt'));
    if (!hasRobots) {
      issues.push({
        id: 'missing-robots-txt',
        category: this.getCategory(),
        severity: 'low',
        title: 'Missing robots.txt',
        description: 'No robots.txt file. Search engines may not crawl correctly.',
        suggestion: 'Add robots.txt to public folder.',
        autoFixable: true,
      });
    }

    // Check for sitemap.xml
    const hasSitemap = await pathExists(path.join(projectPath, 'public', 'sitemap.xml')) ||
                      await pathExists(path.join(projectPath, 'sitemap.xml'));
    if (!hasSitemap) {
      issues.push({
        id: 'missing-sitemap',
        category: this.getCategory(),
        severity: 'low',
        title: 'Missing sitemap.xml',
        description: 'No sitemap.xml file. Search engines may not discover all pages.',
        suggestion: 'Add sitemap.xml or generate dynamically.',
        autoFixable: false,
      });
    }

    return issues;
  }

  private async isWebProject(projectPath: string): Promise<boolean> {
    const packageJson = path.join(projectPath, 'package.json');
    if (!(await pathExists(packageJson))) return false;
    
    try {
      const pkg = JSON.parse(await fs.promises.readFile(packageJson, 'utf8'));
      const deps = { ...pkg.dependencies, ...pkg.devDependencies };
      return !!(deps['react'] || deps['next'] || deps['vue'] || deps['angular']);
    } catch {
      return false;
    }
  }
}


