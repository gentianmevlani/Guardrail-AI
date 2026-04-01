/**
 * Framework Integration Manager
 * 
 * Manages deep integrations with different frameworks
 * Unique: Unified interface for framework-specific features
 */

import { frameworkDetector } from './framework-detector';
import { reactAdapter } from './framework-adapters/react-adapter';
import { vueAdapter } from './framework-adapters/vue-adapter';
import { angularAdapter } from './framework-adapters/angular-adapter';
import { backendAdapter } from './framework-adapters/backend-adapter';
import { pythonAdapter } from './framework-adapters/python-adapter';
import { advancedContextManager } from './advanced-context-manager';

export interface FrameworkIntegration {
  framework: string;
  adapter: FrameworkAdapter | null;
  context: string;
  optimizations: Array<{
    type: string;
    description: string;
    impact: string;
  }>;
  patterns: Array<{
    name: string;
    description: string;
    example: string;
  }>;
}

export interface IntegrationReport {
  detected: Array<{
    framework: string;
    version?: string;
    type: string;
    confidence: number;
  }>;
  integrations: FrameworkIntegration[];
  recommendations: string[];
  context: string;
}

class FrameworkIntegrationManager {
  /**
   * Get deep integration for project
   */
  async integrate(projectPath: string): Promise<IntegrationReport> {
    // Detect frameworks
    const structure = await frameworkDetector.detect(projectPath);

    const integrations: FrameworkIntegration[] = [];

    // Integrate with each detected framework
    for (const framework of structure.frameworks) {
      if (framework.detected) {
        const integration = await this.createIntegration(projectPath, framework);
        if (integration) {
          integrations.push(integration);
        }
      }
    }

    // Generate combined context
    const context = await this.generateCombinedContext(projectPath, integrations);

    // Generate recommendations
    const recommendations = this.generateRecommendations(structure, integrations);

    return {
      detected: structure.frameworks
        .filter(f => f.detected)
        .map(f => ({
          framework: f.name,
          version: f.version,
          type: f.type,
          confidence: f.confidence,
        })),
      integrations,
      recommendations,
      context,
    };
  }

  /**
   * Create integration for framework
   */
  private async createIntegration(
    projectPath: string,
    framework: string
  ): Promise<FrameworkIntegration | null> {
    let adapter: FrameworkAdapter | null = null;
    let context = '';

    // Get appropriate adapter
    if (framework.name === 'React' || framework.name === 'Next.js') {
      adapter = reactAdapter;
      context = await reactAdapter.generateContext(projectPath);
    } else if (framework.name === 'Vue' || framework.name === 'Nuxt') {
      adapter = vueAdapter;
      context = await vueAdapter.generateContext(projectPath);
    } else if (framework.name === 'Angular') {
      adapter = angularAdapter;
      context = await angularAdapter.generateContext(projectPath);
    } else if (['Express', 'Fastify', 'NestJS'].includes(framework.name)) {
      adapter = backendAdapter;
      context = await backendAdapter.generateContext(projectPath);
    } else if (['Django', 'Flask', 'FastAPI'].includes(framework.name)) {
      adapter = pythonAdapter;
      context = await pythonAdapter.generateContext(projectPath);
    }

    if (!adapter) {
      return null;
    }

    // Get optimizations
    const optimizations = await this.getOptimizations(adapter, projectPath);

    // Get patterns
    const patterns = await this.getPatterns(adapter, projectPath);

    return {
      framework: framework.name,
      adapter,
      context,
      optimizations,
      patterns,
    };
  }

  /**
   * Get optimizations for framework
   */
  private async getOptimizations(adapter: any, projectPath: string): Promise<FrameworkIntegration['optimizations']> {
    const optimizations: FrameworkIntegration['optimizations'] = [];

    // Framework-specific optimizations
    if (adapter.analyze) {
      const analysis = await adapter.analyze(projectPath);
      
      if (analysis.optimizations) {
        optimizations.push(...analysis.optimizations);
      }

      // React-specific
      if (analysis.components) {
        const componentsWithoutMemo = analysis.components.filter((c) => 
          !c.hooks?.includes('useMemo') && !c.hooks?.includes('useCallback')
        );
        if (componentsWithoutMemo.length > 0) {
          optimizations.push({
            type: 'memoization',
            description: 'Add memoization to components',
            impact: 'Reduces re-renders by 30-50%',
          });
        }
      }

      // Vue-specific
      if (analysis.composables) {
        optimizations.push({
          type: 'composables',
          description: 'Use composables for reusable logic',
          impact: 'Improves code reusability',
        });
      }

      // Backend-specific
      if (analysis.routes) {
        if (analysis.routes.length > 20) {
          optimizations.push({
            type: 'routing',
            description: 'Consider route grouping',
            impact: 'Improves maintainability',
          });
        }
      }
    }

    return optimizations;
  }

  /**
   * Get patterns for framework
   */
  private async getPatterns(adapter: any, projectPath: string): Promise<FrameworkIntegration['patterns']> {
    const patterns: FrameworkIntegration['patterns'] = [];

    if (adapter.analyze) {
      const analysis = await adapter.analyze(projectPath);

      // React patterns
      if (analysis.patterns) {
        for (const pattern of analysis.patterns) {
          patterns.push({
            name: pattern.name,
            description: `${pattern.type} pattern`,
            example: pattern.usage?.[0] || '',
          });
        }
      }

      // Vue patterns
      if (analysis.composables) {
        patterns.push({
          name: 'Composition API',
          description: 'Uses Vue Composition API',
          example: 'const { data } = useComposable()',
        });
      }

      // Angular patterns
      if (analysis.modules) {
        patterns.push({
          name: 'Module Pattern',
          description: 'Uses Angular modules',
          example: '@NgModule({ ... })',
        });
      }
    }

    return patterns;
  }

  /**
   * Generate combined context
   */
  private async generateCombinedContext(
    projectPath: string,
    integrations: FrameworkIntegration[]
  ): Promise<string> {
    const parts: string[] = [];

    parts.push('# Multi-Framework Project Context\n');

    for (const integration of integrations) {
      parts.push(`## ${integration.framework}`);
      parts.push(integration.context);
      parts.push('');
    }

    // Add framework-specific optimizations
    parts.push('## Framework-Specific Optimizations');
    for (const integration of integrations) {
      if (integration.optimizations.length > 0) {
        parts.push(`### ${integration.framework}`);
        for (const opt of integration.optimizations) {
          parts.push(`- **${opt.type}**: ${opt.description} (${opt.impact})`);
        }
        parts.push('');
      }
    }

    return parts.join('\n');
  }

  /**
   * Generate recommendations
   */
  private generateRecommendations(
    structure: ProjectStructure,
    integrations: FrameworkIntegration[]
  ): string[] {
    const recommendations: string[] = [];

    // Multi-framework recommendations
      if (structure.frameworks.filter((f) => f.detected).length > 1) {
      recommendations.push('Multiple frameworks detected - ensure consistent patterns');
    }

    // Framework-specific recommendations
    for (const integration of integrations) {
      if (integration.optimizations.length > 0) {
        recommendations.push(`${integration.framework}: ${integration.optimizations.length} optimization(s) available`);
      }
    }

    return recommendations;
  }

  /**
   * Get enhanced context for code generation
   */
  async getEnhancedContext(
    projectPath: string,
    request?: {
      file?: string;
      purpose?: string;
    }
  ): Promise<string> {
    // Get framework integration
    const integration = await this.integrate(projectPath);

    // Get advanced context
    const advancedContext = await advancedContextManager.generatePrompt(projectPath, {
      file: request?.file,
      purpose: request?.purpose,
    });

    // Combine
    return `${integration.context}\n\n${advancedContext}`;
  }

  /**
   * Apply framework-specific optimizations
   */
  async applyOptimizations(
    projectPath: string,
    framework?: string
  ): Promise<Array<{
    type: string;
    applied: boolean;
    description: string;
  }>> {
    const integration = await this.integrate(projectPath);
    const results: Array<{ type: string; applied: boolean; description: string }> = [];

    for (const integrationItem of integration.integrations) {
      if (framework && integrationItem.framework !== framework) {
        continue;
      }

      for (const opt of integrationItem.optimizations) {
        // In production, apply actual optimizations
        results.push({
          type: opt.type,
          applied: false, // Would be true after applying
          description: opt.description,
        });
      }
    }

    return results;
  }
}

export const frameworkIntegrationManager = new FrameworkIntegrationManager();

