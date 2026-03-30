/**
 * Architect Agent
 * 
 * Intelligent orchestrator that:
 * - Analyzes project context
 * - Selects appropriate templates
 * - Applies them in correct order
 * - Handles dependencies
 * - Works seamlessly with IDE
 */

import * as fs from 'fs';
import * as path from 'path';
import { polishService } from './polish/polish-service';
import type { PolishReport } from './polish/types';
import { projectGrowthManager } from './project-growth';
import { codebaseSizeTracker } from './codebase-size';
import { platformDetector } from './platform-detector';

export interface ProjectContext {
  type: 'frontend' | 'backend' | 'fullstack' | 'unknown';
  framework: string[];
  hasDatabase: boolean;
  hasAuth: boolean;
  hasAPI: boolean;
  stage: 'new' | 'growing' | 'mature';
  issues: string[];
  missingFeatures: string[];
}

export interface TemplatePlan {
  templates: Array<{
    id: string;
    name: string;
    category: string;
    priority: number;
    dependencies: string[];
    file: string;
    targetPath: string;
    reason: string;
  }>;
  order: string[];
  estimatedTime: string;
}

export interface ArchitectRecommendation {
  action: 'setup' | 'enhance' | 'fix' | 'polish';
  priority: 'critical' | 'high' | 'medium' | 'low';
  description: string;
  templates: string[];
  autoApply: boolean;
}

/**
 * Architect Agent
 * 
 * Intelligent orchestrator that analyzes projects and creates template application plans.
 * Automatically detects project context, identifies missing features, and recommends templates.
 */
class ArchitectAgent {
  /**
   * Analyze project and create intelligent plan
   * 
   * Detects project context, identifies polish issues, checks for growth features,
   * and generates recommendations with a template application plan.
   * 
   * @param projectPath - Path to the project root directory
   * @returns Analysis with context, recommendations, and template plan
   * 
   * @example
   * ```typescript
   * const analysis = await architectAgent.analyzeProject('./my-project');
   * 
   * // Apply recommendations
   * for (const rec of analysis.recommendations) {
   *   if (rec.autoApply) {
   *     await architectAgent.applyTemplates(analysis.plan.templates);
   *   }
   * }
   * ```
   */
  async analyzeProject(projectPath: string): Promise<{
    context: ProjectContext;
    recommendations: ArchitectRecommendation[];
    plan: TemplatePlan;
  }> {
    // Detect project context
    const context = await this.detectContext(projectPath);
    
    // Get polish issues
    const polishReport = await polishService.analyzeProject(projectPath);
    
    // Get growth features needed
    const growthFeatures = await projectGrowthManager.checkGrowth(projectPath);
    
    // Generate recommendations
    const recommendations = this.generateRecommendations(context, polishReport, growthFeatures);
    
    // Create template plan
    const plan = await this.createTemplatePlan(context, recommendations);
    
    return {
      context,
      recommendations,
      plan,
    };
  }

  /**
   * Detect project context
   */
  private async detectContext(projectPath: string): Promise<ProjectContext> {
    const packageJsonPath = path.join(projectPath, 'package.json');
    let framework: string[] = [];
    let hasDatabase = false;
    let hasAuth = false;
    let hasAPI = false;

    if (await this.pathExists(packageJsonPath)) {
      const pkg = JSON.parse(await fs.promises.readFile(packageJsonPath, 'utf8'));
      const deps = { ...pkg.dependencies, ...pkg.devDependencies };

      // Detect frameworks
      if (deps['react']) framework.push('react');
      if (deps['vue']) framework.push('vue');
      if (deps['angular']) framework.push('angular');
      if (deps['next']) framework.push('next');
      if (deps['express']) framework.push('express');
      if (deps['fastify']) framework.push('fastify');
      if (deps['nestjs']) framework.push('nestjs');

      // Detect database
      hasDatabase = !!(deps['pg'] || deps['mysql2'] || deps['mongodb'] || deps['prisma']);

      // Detect auth
      hasAuth = !!(deps['passport'] || deps['@auth/core'] || deps['next-auth']);

      // Detect API
      hasAPI = !!(deps['axios'] || deps['fetch'] || deps['@tanstack/react-query']);
    }

    // Detect project type
    const srcPath = path.join(projectPath, 'src');
    const hasFrontend = await this.pathExists(srcPath) && 
                       (framework.includes('react') || framework.includes('vue') || framework.includes('angular'));
    const hasBackend = await this.pathExists(path.join(projectPath, 'server')) ||
                      await this.pathExists(path.join(projectPath, 'backend')) ||
                      framework.includes('express') || framework.includes('fastify');

    const type = hasFrontend && hasBackend ? 'fullstack' :
                 hasFrontend ? 'frontend' :
                 hasBackend ? 'backend' : 'unknown';

    // Detect stage
    const metrics = await codebaseSizeTracker.calculateSize(projectPath);
    const stage = metrics.totalFiles < 50 ? 'new' :
                  metrics.totalFiles < 500 ? 'growing' : 'mature';

    // Detect issues
    const issues: string[] = [];
    if (!await this.pathExists(path.join(projectPath, '.gitignore'))) {
      issues.push('missing-gitignore');
    }
    if (!await this.pathExists(path.join(projectPath, 'README.md'))) {
      issues.push('missing-readme');
    }

    return {
      type,
      framework,
      hasDatabase,
      hasAuth,
      hasAPI,
      stage,
      issues,
      missingFeatures: [],
    };
  }

  /**
   * Generate intelligent recommendations
   */
  private generateRecommendations(
    context: ProjectContext,
    polishReport: PolishReport,
    growthFeatures: Array<{ name: string; description: string; priority: number }>
  ): ArchitectRecommendation[] {
    const recommendations: ArchitectRecommendation[] = [];

    // Critical setup items
    if (context.issues.includes('missing-gitignore')) {
      recommendations.push({
        action: 'setup',
        priority: 'critical',
        description: 'Missing .gitignore - critical for security',
        templates: ['gitignore'],
        autoApply: true,
      });
    }

    // Project type specific
    if (context.type === 'frontend' || context.type === 'fullstack') {
      if (!context.framework.includes('react') && !context.framework.includes('vue')) {
        recommendations.push({
          action: 'setup',
          priority: 'high',
          description: 'Frontend framework detected but missing core setup',
          templates: ['error-boundary', 'loading-state', 'empty-state'],
          autoApply: true,
        });
      }
    }

    if (context.type === 'backend' || context.type === 'fullstack') {
      recommendations.push({
        action: 'setup',
        priority: 'critical',
        description: 'Backend needs essential middleware',
        templates: ['error-handler', 'rate-limit', 'cors', 'health-check'],
        autoApply: true,
      });
    }

    // Observability (always recommended)
    recommendations.push({
      action: 'enhance',
      priority: 'high',
      description: 'Add observability for production debugging',
      templates: ['logger', 'correlation-id', 'error-reporting'],
      autoApply: false,
    });

    // Resilience (always recommended)
    recommendations.push({
      action: 'enhance',
      priority: 'high',
      description: 'Add resilience patterns for reliability',
      templates: ['retry', 'circuit-breaker'],
      autoApply: false,
    });

    // Design system (for frontend)
    if (context.type === 'frontend' || context.type === 'fullstack') {
      recommendations.push({
        action: 'enhance',
        priority: 'medium',
        description: 'Create design system for UI consistency',
        templates: ['design-tokens', 'theme', 'component-library'],
        autoApply: false,
      });
    }

    // Growth features
    for (const feature of growthFeatures) {
      recommendations.push({
        action: 'enhance',
        priority: feature.priority >= 8 ? 'high' : 'medium',
        description: feature.description,
        templates: [feature.name.toLowerCase().replace(/\s+/g, '-')],
        autoApply: true,
      });
    }

    // Polish issues
    const criticalIssues = polishReport.issues.filter(i => i.severity === 'critical');
    if (criticalIssues.length > 0) {
      recommendations.push({
        action: 'fix',
        priority: 'critical',
        description: `${criticalIssues.length} critical polish issues found`,
        templates: criticalIssues.map(i => i.id),
        autoApply: true,
      });
    }

    return recommendations.sort((a, b) => {
      const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    });
  }

  /**
   * Create template application plan
   */
  private async createTemplatePlan(
    context: ProjectContext,
    recommendations: ArchitectRecommendation[]
  ): Promise<TemplatePlan> {
    const templates: TemplatePlan['templates'] = [];
    const templateMap = new Map<string, any>();

    // Build template list from recommendations
    for (const rec of recommendations) {
      for (const templateId of rec.templates) {
        if (!templateMap.has(templateId)) {
          const template = await this.getTemplateInfo(templateId, context);
          if (template) {
            templates.push(template);
            templateMap.set(templateId, template);
          }
        }
      }
    }

    // Resolve dependencies and order
    const order = this.resolveDependencies(templates);

    // Estimate time
    const estimatedTime = this.estimateTime(templates.length);

    return {
      templates,
      order,
      estimatedTime,
    };
  }

  /**
   * Get template information
   */
  private async getTemplateInfo(
    templateId: string,
    context: ProjectContext
  ): Promise<TemplatePlan['templates'][0] | null> {
    // Template registry
    const templateRegistry: Record<string, any> = {
      'error-boundary': {
        name: 'Error Boundary',
        category: 'Frontend',
        priority: 10,
        dependencies: [],
        file: 'templates/components/ErrorBoundary.tsx',
        targetPath: 'src/components/ErrorBoundary.tsx',
        reason: 'Essential for React error handling',
      },
      'loading-state': {
        name: 'Loading State',
        category: 'Frontend',
        priority: 8,
        dependencies: [],
        file: 'templates/components/LoadingState.tsx',
        targetPath: 'src/components/LoadingState.tsx',
        reason: 'Better UX during async operations',
      },
      'empty-state': {
        name: 'Empty State',
        category: 'Frontend',
        priority: 7,
        dependencies: [],
        file: 'templates/components/EmptyState.tsx',
        targetPath: 'src/components/EmptyState.tsx',
        reason: 'Better UX when no data',
      },
      'error-handler': {
        name: 'Error Handler',
        category: 'Backend',
        priority: 10,
        dependencies: [],
        file: 'templates/backend/middleware/error-handler.middleware.ts',
        targetPath: 'src/backend/middleware/error-handler.middleware.ts',
        reason: 'Critical for production error handling',
      },
      'rate-limit': {
        name: 'Rate Limiting',
        category: 'Backend',
        priority: 9,
        dependencies: [],
        file: 'templates/backend/middleware/rate-limit.middleware.ts',
        targetPath: 'src/backend/middleware/rate-limit.middleware.ts',
        reason: 'Protect API from abuse',
      },
      'cors': {
        name: 'CORS',
        category: 'Backend',
        priority: 9,
        dependencies: [],
        file: 'templates/backend/middleware/cors.middleware.ts',
        targetPath: 'src/backend/middleware/cors.middleware.ts',
        reason: 'Required for frontend to connect',
      },
      'health-check': {
        name: 'Health Check',
        category: 'Backend',
        priority: 8,
        dependencies: [],
        file: 'templates/backend/routes/health.route.ts',
        targetPath: 'src/backend/routes/health.route.ts',
        reason: 'Required for deployment monitoring',
      },
      'logger': {
        name: 'Structured Logging',
        category: 'Observability',
        priority: 10,
        dependencies: [],
        file: 'templates/infrastructure/observability/logger.ts',
        targetPath: 'src/infrastructure/observability/logger.ts',
        reason: 'Essential for production debugging',
      },
      'correlation-id': {
        name: 'Correlation ID',
        category: 'Observability',
        priority: 9,
        dependencies: ['logger'],
        file: 'templates/infrastructure/observability/correlation-id.middleware.ts',
        targetPath: 'src/infrastructure/observability/correlation-id.middleware.ts',
        reason: 'Track requests across services',
      },
      'error-reporting': {
        name: 'Error Reporting',
        category: 'Observability',
        priority: 9,
        dependencies: ['logger'],
        file: 'templates/infrastructure/observability/error-reporting.ts',
        targetPath: 'src/infrastructure/observability/error-reporting.ts',
        reason: 'Catch production errors',
      },
      'retry': {
        name: 'Retry Logic',
        category: 'Resilience',
        priority: 8,
        dependencies: [],
        file: 'templates/infrastructure/resilience/retry.ts',
        targetPath: 'src/infrastructure/resilience/retry.ts',
        reason: 'Handle transient failures',
      },
      'circuit-breaker': {
        name: 'Circuit Breaker',
        category: 'Resilience',
        priority: 7,
        dependencies: [],
        file: 'templates/infrastructure/resilience/circuit-breaker.ts',
        targetPath: 'src/infrastructure/resilience/circuit-breaker.ts',
        reason: 'Prevent cascading failures',
      },
      'design-tokens': {
        name: 'Design Tokens',
        category: 'Design System',
        priority: 8,
        dependencies: [],
        file: 'templates/infrastructure/design-system/design-tokens.css',
        targetPath: 'src/design-system/design-tokens.css',
        reason: 'Single source of truth for design',
      },
      'theme': {
        name: 'Theme System',
        category: 'Design System',
        priority: 7,
        dependencies: ['design-tokens'],
        file: 'templates/infrastructure/design-system/theme.tsx',
        targetPath: 'src/design-system/theme.tsx',
        reason: 'Consistent theming across app',
      },
      'component-library': {
        name: 'Component Library',
        category: 'Design System',
        priority: 6,
        dependencies: ['design-tokens', 'theme'],
        file: 'templates/infrastructure/design-system/Button.tsx',
        targetPath: 'src/design-system/components/Button.tsx',
        reason: 'Reusable UI components',
      },
      'gitignore': {
        name: '.gitignore',
        category: 'Configuration',
        priority: 10,
        dependencies: [],
        file: '.gitignore',
        targetPath: '.gitignore',
        reason: 'Critical for security',
      },
    };

    return templateRegistry[templateId] || null;
  }

  /**
   * Resolve template dependencies and create order
   */
  private resolveDependencies(templates: TemplatePlan['templates']): string[] {
    const order: string[] = [];
    const added = new Set<string>();
    const templateMap = new Map(templates.map(t => [t.id, t]));

    // Topological sort
    const visit = (id: string) => {
      if (added.has(id)) return;
      
      const template = templateMap.get(id);
      if (!template) return;

      // Add dependencies first
      for (const dep of template.dependencies) {
        visit(dep);
      }

      order.push(id);
      added.add(id);
    };

    // Visit all templates
    for (const template of templates) {
      visit(template.id);
    }

    return order;
  }

  /**
   * Estimate time for template application
   */
  private estimateTime(count: number): string {
    if (count === 0) return '0 minutes';
    if (count <= 5) return '5-10 minutes';
    if (count <= 10) return '10-20 minutes';
    if (count <= 20) return '20-30 minutes';
    return '30+ minutes';
  }

  /**
   * Apply templates in order
   */
  async applyTemplates(
    projectPath: string,
    plan: TemplatePlan,
    autoApply: boolean = false
  ): Promise<{
    applied: string[];
    skipped: string[];
    errors: Array<{ template: string; error: string }>;
  }> {
    const applied: string[] = [];
    const skipped: string[] = [];
    const errors: Array<{ template: string; error: string }> = [];

    for (const templateId of plan.order) {
      const template = plan.templates.find(t => t.id === templateId);
      if (!template) continue;

      try {
        // Check if already exists
        const targetPath = path.join(projectPath, template.targetPath);
        if (await this.pathExists(targetPath)) {
          skipped.push(templateId);
          continue;
        }

        // Apply template
        if (autoApply || template.priority >= 9) {
          await this.copyTemplate(projectPath, template);
          applied.push(templateId);
        } else {
          skipped.push(templateId);
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        errors.push({
          template: templateId,
          error: errorMessage,
        });
      }
    }

    return { applied, skipped, errors };
  }

  private async copyTemplate(projectPath: string, template: TemplatePlan['templates'][number]): Promise<void> {
    const kitDir = path.dirname(path.dirname(__dirname));
    const sourcePath = path.join(kitDir, template.file);
    const targetPath = path.join(projectPath, template.targetPath);

    // Create target directory
    const targetDir = path.dirname(targetPath);
    await fs.promises.mkdir(targetDir, { recursive: true });

    // Copy file
    await fs.promises.copyFile(sourcePath, targetPath);
  }

  private async pathExists(p: string): Promise<boolean> {
    try {
      await fs.promises.access(p);
      return true;
    } catch {
      return false;
    }
  }
}

export const architectAgent = new ArchitectAgent();

