/**
 * Project Analyzer Service
 * 
 * Analyzes projects to provide real metrics for the dashboard.
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { mockDataScanner } from './mock-data-scanner';

export interface ProjectMetrics {
  fileCount: number;
  lineCount: number;
  sizeBytes: number;
  languages: Record<string, number>;
  framework: string | null;
  hasTests: boolean;
  hasTypeScript: boolean;
  hasCICD: boolean;
}

export interface ProjectAnalysis {
  name: string;
  path: string;
  metrics: ProjectMetrics;
  healthScore: number;
  issues: {
    critical: number;
    warnings: number;
    info: number;
  };
  suggestions: string[];
  timestamp: string;
}

export interface ValidationResult {
  projectStructure: {
    valid: boolean;
    score: number;
    issues: string[];
  };
  apiEndpoints: {
    valid: boolean;
    score: number;
    issues: string[];
  };
  designSystem: {
    valid: boolean;
    score: number;
    issues: string[];
  };
  mockData: {
    valid: boolean;
    issues: number;
    details: string[];
  };
  codeQuality: {
    valid: boolean;
    score: number;
    issues: string[];
  };
  timestamp: string;
}

class ProjectAnalyzer {
  private excludedDirs = [
    'node_modules',
    '.git',
    '.next',
    'dist',
    'build',
    'coverage',
    '.cache',
    '.parcel-cache',
  ];

  private languageExtensions: Record<string, string> = {
    '.ts': 'TypeScript',
    '.tsx': 'TypeScript React',
    '.js': 'JavaScript',
    '.jsx': 'JavaScript React',
    '.py': 'Python',
    '.go': 'Go',
    '.rs': 'Rust',
    '.java': 'Java',
    '.rb': 'Ruby',
    '.php': 'PHP',
    '.vue': 'Vue',
    '.svelte': 'Svelte',
    '.css': 'CSS',
    '.scss': 'SCSS',
    '.html': 'HTML',
    '.json': 'JSON',
    '.md': 'Markdown',
    '.yml': 'YAML',
    '.yaml': 'YAML',
  };

  /**
   * Analyze a project and return comprehensive metrics
   */
  async analyzeProject(directory: string): Promise<ProjectAnalysis> {
    const metrics = await this.collectMetrics(directory);
    const mockDataResult = await mockDataScanner.scanDirectory(directory);
    
    const healthScore = this.calculateHealthScore(metrics, mockDataResult.summary);
    const suggestions = this.generateSuggestions(metrics, mockDataResult);

    return {
      name: path.basename(directory),
      path: directory,
      metrics,
      healthScore,
      issues: {
        critical: mockDataResult.summary.errors,
        warnings: mockDataResult.summary.warnings,
        info: mockDataResult.summary.info,
      },
      suggestions,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Validate a project against guardrails
   */
  async validateProject(directory: string): Promise<ValidationResult> {
    const [
      structureResult,
      apiResult,
      designResult,
      mockDataResult,
      codeQualityResult,
    ] = await Promise.all([
      this.validateProjectStructure(directory),
      this.validateApiEndpoints(directory),
      this.validateDesignSystem(directory),
      mockDataScanner.scanDirectory(directory),
      this.validateCodeQuality(directory),
    ]);

    return {
      projectStructure: structureResult,
      apiEndpoints: apiResult,
      designSystem: designResult,
      mockData: {
        valid: mockDataResult.summary.errors === 0,
        issues: mockDataResult.issues.length,
        details: mockDataResult.issues.slice(0, 5).map(i => 
          `${i.file}:${i.line} - ${i.description}`
        ),
      },
      codeQuality: codeQualityResult,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Collect project metrics
   */
  private async collectMetrics(directory: string): Promise<ProjectMetrics> {
    let fileCount = 0;
    let lineCount = 0;
    let sizeBytes = 0;
    const languages: Record<string, number> = {};

    const files = await this.findAllFiles(directory);
    
    for (const file of files) {
      try {
        const stats = await fs.stat(file);
        const content = await fs.readFile(file, 'utf-8');
        const ext = path.extname(file);

        fileCount++;
        sizeBytes += stats.size;
        lineCount += content.split('\n').length;

        const language = this.languageExtensions[ext];
        if (language) {
          languages[language] = (languages[language] || 0) + 1;
        }
      } catch (error) {
        // Skip files that can't be read
      }
    }

    const framework = await this.detectFramework(directory);
    const hasTests = await this.hasTestFiles(directory);
    const hasTypeScript = await this.hasTypeScriptConfig(directory);
    const hasCICD = await this.hasCICDConfig(directory);

    return {
      fileCount,
      lineCount,
      sizeBytes,
      languages,
      framework,
      hasTests,
      hasTypeScript,
      hasCICD,
    };
  }

  /**
   * Validate project structure
   */
  private async validateProjectStructure(directory: string): Promise<{
    valid: boolean;
    score: number;
    issues: string[];
  }> {
    const issues: string[] = [];
    let score = 100;

    // Check for essential files
    const essentialFiles = ['package.json', 'README.md'];
    for (const file of essentialFiles) {
      try {
        await fs.access(path.join(directory, file));
      } catch {
        issues.push(`Missing ${file}`);
        score -= 10;
      }
    }

    // Check for src directory
    try {
      await fs.access(path.join(directory, 'src'));
    } catch {
      issues.push('No src directory found');
      score -= 5;
    }

    // Check for proper gitignore
    try {
      const gitignore = await fs.readFile(path.join(directory, '.gitignore'), 'utf-8');
      if (!gitignore.includes('node_modules')) {
        issues.push('.gitignore missing node_modules');
        score -= 5;
      }
    } catch {
      issues.push('Missing .gitignore file');
      score -= 10;
    }

    return {
      valid: score >= 70,
      score: Math.max(0, score),
      issues,
    };
  }

  /**
   * Validate API endpoints
   */
  private async validateApiEndpoints(directory: string): Promise<{
    valid: boolean;
    score: number;
    issues: string[];
  }> {
    const issues: string[] = [];
    let score = 100;

    // Check for API directory
    const apiPaths = ['src/api', 'src/pages/api', 'api', 'src/routes'];
    let hasApiDir = false;

    for (const apiPath of apiPaths) {
      try {
        await fs.access(path.join(directory, apiPath));
        hasApiDir = true;
        break;
      } catch {
        // Continue checking
      }
    }

    if (!hasApiDir) {
      // Not necessarily an issue - project might not have API
      score = 100;
    }

    // Check for fetch calls without error handling
    const files = await this.findAllFiles(directory);
    for (const file of files.slice(0, 50)) { // Limit to first 50 files
      try {
        const content = await fs.readFile(file, 'utf-8');
        if (content.includes('fetch(') && !content.includes('.catch') && !content.includes('try {')) {
          issues.push(`${path.relative(directory, file)}: fetch without error handling`);
          score -= 2;
        }
      } catch {
        // Skip unreadable files
      }
    }

    return {
      valid: score >= 70,
      score: Math.max(0, Math.min(100, score)),
      issues: issues.slice(0, 10),
    };
  }

  /**
   * Validate design system usage
   */
  private async validateDesignSystem(directory: string): Promise<{
    valid: boolean;
    score: number;
    issues: string[];
  }> {
    const issues: string[] = [];
    let score = 100;

    // Check for design system files
    const designFiles = ['tailwind.config.js', 'tailwind.config.ts', 'theme.ts', 'theme.js'];
    let hasDesignSystem = false;

    for (const file of designFiles) {
      try {
        await fs.access(path.join(directory, file));
        hasDesignSystem = true;
        break;
      } catch {
        // Continue checking
      }
    }

    if (!hasDesignSystem) {
      issues.push('No design system configuration found');
      score -= 20;
    }

    // Check for inline styles (not recommended)
    const files = await this.findAllFiles(directory);
    let inlineStyleCount = 0;

    for (const file of files.filter(f => f.endsWith('.tsx') || f.endsWith('.jsx')).slice(0, 30)) {
      try {
        const content = await fs.readFile(file, 'utf-8');
        const matches = content.match(/style=\{\{/g);
        if (matches) {
          inlineStyleCount += matches.length;
        }
      } catch {
        // Skip unreadable files
      }
    }

    if (inlineStyleCount > 10) {
      issues.push(`Found ${inlineStyleCount} inline styles - consider using CSS classes`);
      score -= Math.min(20, inlineStyleCount);
    }

    return {
      valid: score >= 70,
      score: Math.max(0, score),
      issues,
    };
  }

  /**
   * Validate code quality
   */
  private async validateCodeQuality(directory: string): Promise<{
    valid: boolean;
    score: number;
    issues: string[];
  }> {
    const issues: string[] = [];
    let score = 100;

    // Check for linting config
    const lintConfigs = ['.eslintrc.js', '.eslintrc.json', 'eslint.config.js', '.eslintrc'];
    let hasLinting = false;

    for (const config of lintConfigs) {
      try {
        await fs.access(path.join(directory, config));
        hasLinting = true;
        break;
      } catch {
        // Continue checking
      }
    }

    if (!hasLinting) {
      issues.push('No ESLint configuration found');
      score -= 15;
    }

    // Check for TypeScript config
    try {
      await fs.access(path.join(directory, 'tsconfig.json'));
    } catch {
      issues.push('No TypeScript configuration - consider adding type safety');
      score -= 10;
    }

    // Check for tests
    const testDirs = ['__tests__', 'tests', 'test', 'spec'];
    let hasTests = false;

    for (const testDir of testDirs) {
      try {
        await fs.access(path.join(directory, testDir));
        hasTests = true;
        break;
      } catch {
        // Continue checking
      }
    }

    // Also check for test files in src
    const files = await this.findAllFiles(directory);
    if (files.some(f => f.includes('.test.') || f.includes('.spec.'))) {
      hasTests = true;
    }

    if (!hasTests) {
      issues.push('No test files found');
      score -= 15;
    }

    return {
      valid: score >= 70,
      score: Math.max(0, score),
      issues,
    };
  }

  /**
   * Calculate health score based on metrics
   */
  private calculateHealthScore(
    metrics: ProjectMetrics,
    mockDataSummary: { errors: number; warnings: number; info: number }
  ): number {
    let score = 100;

    // Deduct for mock data issues
    score -= mockDataSummary.errors * 5;
    score -= mockDataSummary.warnings * 2;
    score -= mockDataSummary.info * 0.5;

    // Bonus for good practices
    if (metrics.hasTypeScript) score += 5;
    if (metrics.hasTests) score += 5;
    if (metrics.hasCICD) score += 5;

    return Math.max(0, Math.min(100, Math.round(score)));
  }

  /**
   * Generate improvement suggestions
   */
  private generateSuggestions(
    metrics: ProjectMetrics,
    mockDataResult: { issues: any[] }
  ): string[] {
    const suggestions: string[] = [];

    if (!metrics.hasTypeScript) {
      suggestions.push('Consider adding TypeScript for better type safety');
    }

    if (!metrics.hasTests) {
      suggestions.push('Add unit tests to improve code reliability');
    }

    if (!metrics.hasCICD) {
      suggestions.push('Set up CI/CD for automated testing and deployment');
    }

    if (mockDataResult.issues.length > 0) {
      suggestions.push(`Replace ${mockDataResult.issues.length} mock data patterns with real API calls`);
    }

    if (metrics.lineCount > 100000) {
      suggestions.push('Consider splitting the codebase into smaller packages');
    }

    return suggestions;
  }

  /**
   * Find all source files in directory
   */
  private async findAllFiles(directory: string): Promise<string[]> {
    const files: string[] = [];

    const walk = async (dir: string) => {
      try {
        const items = await fs.readdir(dir, { withFileTypes: true });

        for (const item of items) {
          const fullPath = path.join(dir, item.name);

          if (item.isDirectory()) {
            if (!this.excludedDirs.includes(item.name) && !item.name.startsWith('.')) {
              await walk(fullPath);
            }
          } else if (item.isFile()) {
            const ext = path.extname(item.name);
            if (this.languageExtensions[ext]) {
              files.push(fullPath);
            }
          }
        }
      } catch (error) {
        // Skip directories that can't be read
      }
    };

    await walk(directory);
    return files;
  }

  /**
   * Detect the framework used in the project
   */
  private async detectFramework(directory: string): Promise<string | null> {
    try {
      const pkgPath = path.join(directory, 'package.json');
      const pkgContent = await fs.readFile(pkgPath, 'utf-8');
      const pkg = JSON.parse(pkgContent);
      const deps = { ...pkg.dependencies, ...pkg.devDependencies };

      // Full-stack frameworks (check first)
      if (deps['next']) return 'Next.js';
      if (deps['nuxt'] || deps['@nuxt/core']) return 'Nuxt';
      if (deps['@remix-run/node'] || deps['@remix-run/react']) return 'Remix';
      
      // Frontend frameworks
      if (deps['react'] || deps['react-dom']) {
        // Check for Vite
        if (deps['vite'] || deps['@vitejs/plugin-react']) {
          return 'Vite + React';
        }
        return 'React';
      }
      if (deps['vue']) {
        // Check for Vite
        if (deps['vite'] || deps['@vitejs/plugin-vue']) {
          return 'Vite + Vue';
        }
        return 'Vue';
      }
      if (deps['@angular/core']) return 'Angular';
      if (deps['svelte'] || deps['svelte-kit']) return 'Svelte';
      
      // Build tools (standalone Vite)
      if (deps['vite'] || deps['@vitejs/plugin-react'] || deps['@vitejs/plugin-vue']) {
        // Check for vite config file
        const viteConfigPaths = [
          path.join(directory, 'vite.config.ts'),
          path.join(directory, 'vite.config.js'),
          path.join(directory, 'vite.config.mjs'),
        ];
        for (const configPath of viteConfigPaths) {
          try {
            await fs.access(configPath);
            return 'Vite';
          } catch {
            // Continue
          }
        }
        return 'Vite';
      }
      
      // Backend frameworks
      if (deps['express']) return 'Express';
      if (deps['fastify']) return 'Fastify';
      if (deps['hono']) return 'Hono';
      if (deps['@nestjs/core']) return 'NestJS';
    } catch {
      // No package.json
    }

    return null;
  }

  /**
   * Check if project has test files
   */
  private async hasTestFiles(directory: string): Promise<boolean> {
    const testDirs = ['__tests__', 'tests', 'test', 'spec'];
    
    for (const testDir of testDirs) {
      try {
        await fs.access(path.join(directory, testDir));
        return true;
      } catch {
        // Continue checking
      }
    }

    // Check for test files in src
    try {
      const files = await this.findAllFiles(directory);
      return files.some(f => f.includes('.test.') || f.includes('.spec.'));
    } catch {
      return false;
    }
  }

  /**
   * Check if project has TypeScript config
   */
  private async hasTypeScriptConfig(directory: string): Promise<boolean> {
    try {
      await fs.access(path.join(directory, 'tsconfig.json'));
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Check if project has CI/CD config
   */
  private async hasCICDConfig(directory: string): Promise<boolean> {
    const cicdPaths = [
      '.github/workflows',
      '.gitlab-ci.yml',
      '.circleci',
      'Jenkinsfile',
      '.travis.yml',
    ];

    for (const ciPath of cicdPaths) {
      try {
        await fs.access(path.join(directory, ciPath));
        return true;
      } catch {
        // Continue checking
      }
    }

    return false;
  }
}

export const projectAnalyzer = new ProjectAnalyzer();
