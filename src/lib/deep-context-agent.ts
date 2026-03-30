/**
 * Deep Context Agent
 * 
 * Project-specific agent with deeper understanding than general AI
 * Uses codebase knowledge base for context-aware assistance
 */

import { CodebaseKnowledge, codebaseKnowledgeBase } from './codebase-knowledge';
import { architectAgent } from './architect-agent';
import { responseStyleService, ResponseStyle, StyleConfig, StyledResponse } from './response-style-service';
import type { KnowledgeSearchResults } from './types/common';

export interface DeepContextResponse {
  understanding: {
    architecture: string;
    patterns: string[];
    conventions: string[];
    currentFocus: string[];
  };
  recommendations: Array<{
    type: 'pattern' | 'convention' | 'improvement' | 'warning';
    message: string;
    context: string;
    files?: string[];
  }>;
  suggestions: string[];
  context: string;
}

export interface StyledDeepContextResponse extends DeepContextResponse {
  styled?: StyledResponse;
}

class DeepContextAgent {
  private knowledge: CodebaseKnowledge | null = null;

  /**
   * Initialize with project knowledge
   * 
   * Loads or builds the knowledge base for the project.
   * 
   * @param projectPath - Path to the project root directory
   * 
   * @example
   * ```typescript
   * await agent.initialize('./my-project');
   * // Agent is now ready to provide context-aware assistance
   * ```
   */
  async initialize(projectPath: string): Promise<void> {
    this.knowledge = await codebaseKnowledgeBase.getKnowledge(projectPath);
    
    if (!this.knowledge) {
      // Build knowledge if it doesn't exist
      this.knowledge = await codebaseKnowledgeBase.buildKnowledge(projectPath);
    }
  }

  /**
   * Get deep context for a query
   * 
   * Provides project-specific context and recommendations based on the query.
   * 
   * @param query - The question or request
   * @param projectPath - Path to the project root directory
   * @param styleConfig - Optional style configuration for response formatting
   * @returns Deep context response with understanding, recommendations, and suggestions
   * 
   * @example
   * ```typescript
   * const response = await agent.getContext(
   *   'How should I structure authentication?',
   *   './my-project'
   * );
   * 
   * response.recommendations.forEach(rec => {
   *   console.log(`${rec.type}: ${rec.message}`);
   * });
   * ```
   */
  async getContext(
    query: string, 
    projectPath: string, 
    styleConfig?: StyleConfig
  ): Promise<DeepContextResponse & { styled?: StyledResponse }> {
    if (!this.knowledge) {
      await this.initialize(projectPath);
    }

    if (!this.knowledge) {
      throw new Error('Failed to build knowledge base');
    }

    // Search knowledge base
    const searchResults = await codebaseKnowledgeBase.searchKnowledge(projectPath, query);

    // Build understanding
    const understanding = {
      architecture: this.buildArchitectureSummary(this.knowledge),
      patterns: this.knowledge.patterns.map(p => p.name),
      conventions: this.buildConventionsSummary(this.knowledge),
      currentFocus: this.knowledge.context.currentFocus,
    };

    // Generate recommendations
    const recommendations = this.generateRecommendations(this.knowledge, query, searchResults);

    // Generate suggestions
    const suggestions = this.generateSuggestions(this.knowledge, query);

    // Build context string for AI
    const context = this.buildContextString(this.knowledge, query, searchResults);

    const response: DeepContextResponse = {
      understanding,
      recommendations,
      suggestions,
      context,
    };

    // Apply styling if requested
    if (styleConfig) {
      const styled = responseStyleService.formatResponse(
        {
          query,
          understanding,
          recommendations,
          suggestions,
          context,
        },
        styleConfig
      );
      return { ...response, styled };
    }

    return response;
  }

  /**
   * Get formatted response with style
   */
  async getFormattedContext(
    query: string,
    projectPath: string,
    style: ResponseStyle = 'professional',
    options?: {
      useEmojis?: boolean;
      maxLength?: number;
      includeExamples?: boolean;
    }
  ): Promise<string> {
    const styleConfig: StyleConfig = {
      style,
      useEmojis: options?.useEmojis ?? true,
      maxLength: options?.maxLength,
      includeExamples: options?.includeExamples ?? false,
    };

    const response = await this.getContext(query, projectPath, styleConfig);
    
    if (response.styled) {
      return response.styled.formatted;
    }

    // Fallback to basic formatting
    return this.formatBasicResponse(response);
  }

  /**
   * Format basic response (fallback)
   */
  private formatBasicResponse(response: DeepContextResponse): string {
    let formatted = `🧠 Deep Context\n\n`;
    formatted += `## Understanding\n${response.understanding.architecture}\n\n`;
    
    if (response.recommendations.length > 0) {
      formatted += `## Recommendations\n`;
      response.recommendations.forEach(r => {
        formatted += `- ${r.message}\n`;
      });
      formatted += `\n`;
    }

    if (response.suggestions.length > 0) {
      formatted += `## Suggestions\n`;
      response.suggestions.forEach(s => {
        formatted += `- ${s}\n`;
      });
      formatted += `\n`;
    }

    return formatted;
  }

  /**
   * Build architecture summary
   */
  private buildArchitectureSummary(knowledge: CodebaseKnowledge): string {
    const { structure, techStack } = knowledge.architecture;
    
    return `This is a ${structure.type} project using:
- Frontend: ${techStack.frontend.join(', ') || 'None detected'}
- Backend: ${techStack.backend.join(', ') || 'None detected'}
- Database: ${techStack.database.join(', ') || 'None detected'}
- Structure: ${structure.layers.join(' → ')}
- Main modules: ${structure.mainModules.join(', ')}`;
  }

  /**
   * Build conventions summary
   */
  private buildConventionsSummary(knowledge: CodebaseKnowledge): string[] {
    const conventions: string[] = [];
    
    if (knowledge.architecture.conventions.naming.files) {
      conventions.push(`File naming: ${knowledge.architecture.conventions.naming.files}`);
    }
    
    if (knowledge.architecture.conventions.importPatterns.length > 0) {
      conventions.push(`Import patterns: ${knowledge.architecture.conventions.importPatterns.join(', ')}`);
    }

    return conventions;
  }

  /**
   * Generate recommendations
   */
  private generateRecommendations(
    knowledge: CodebaseKnowledge,
    query: string,
    searchResults: KnowledgeSearchResults
  ): DeepContextResponse['recommendations'] {
    const recommendations: DeepContextResponse['recommendations'] = [];

    // Pattern recommendations
    if (searchResults.patterns.length > 0) {
      recommendations.push({
        type: 'pattern',
        message: `Found ${searchResults.patterns.length} relevant patterns in codebase`,
        context: 'Consider using existing patterns for consistency',
        files: searchResults.patterns.flatMap(p => p.examples),
      });
    }

    // Convention recommendations
    const conventions = knowledge.architecture.conventions;
    if (conventions.naming.files) {
      recommendations.push({
        type: 'convention',
        message: `Follow ${conventions.naming.files} naming convention`,
        context: 'This is the established pattern in this codebase',
      });
    }

    // Decision recommendations
    if (searchResults.decisions.length > 0) {
      const decision = searchResults.decisions[0];
      recommendations.push({
        type: 'convention',
        message: `Previous decision: ${decision.decision}`,
        context: decision.rationale,
        files: decision.files,
      });
    }

    return recommendations;
  }

  /**
   * Generate suggestions
   */
  private generateSuggestions(
    knowledge: CodebaseKnowledge,
    query: string
  ): string[] {
    const suggestions: string[] = [];

    // Architecture-aware suggestions
    if (knowledge.architecture.structure.type === 'modular') {
      suggestions.push('Consider organizing new features in the features/ directory');
    }

    // Pattern-aware suggestions
    if (knowledge.patterns.some(p => p.category === 'component')) {
      suggestions.push('Use existing component patterns for consistency');
    }

    // Convention-aware suggestions
    if (knowledge.architecture.conventions.importPatterns.includes('path-aliases')) {
      suggestions.push('Use path aliases (@/) for imports instead of relative paths');
    }

    return suggestions;
  }

  /**
   * Build context string for AI
   */
  private buildContextString(
    knowledge: CodebaseKnowledge,
    query: string,
    searchResults: KnowledgeSearchResults
  ): string {
    let context = `# Codebase Context\n\n`;

    // Architecture
    context += `## Architecture\n`;
    context += this.buildArchitectureSummary(knowledge) + '\n\n';

    // Patterns
    if (knowledge.patterns.length > 0) {
      context += `## Common Patterns\n`;
      knowledge.patterns.forEach(pattern => {
        context += `- **${pattern.name}**: ${pattern.description} (used ${pattern.frequency} times)\n`;
        if (pattern.examples.length > 0) {
          context += `  Examples: ${pattern.examples.slice(0, 3).join(', ')}\n`;
        }
      });
      context += '\n';
    }

    // Conventions
    context += `## Conventions\n`;
    const conventions = knowledge.architecture.conventions;
    if (conventions.naming.files) {
      context += `- File naming: ${conventions.naming.files}\n`;
    }
    if (conventions.importPatterns.length > 0) {
      context += `- Import patterns: ${conventions.importPatterns.join(', ')}\n`;
    }
    context += '\n';

    // Relevant decisions
    if (searchResults.decisions.length > 0) {
      context += `## Relevant Decisions\n`;
      searchResults.decisions.slice(0, 3).forEach((decision) => {
        context += `- **${decision.question}**: ${decision.decision}\n`;
        context += `  Rationale: ${decision.rationale}\n`;
        if (decision.files.length > 0) {
          context += `  Files: ${decision.files.join(', ')}\n`;
        }
      });
      context += '\n';
    }

    // Recent changes
    if (knowledge.context.recentChanges.length > 0) {
      context += `## Recent Changes\n`;
      knowledge.context.recentChanges.slice(0, 5).forEach(change => {
        context += `- ${change.file}: ${change.change}\n`;
      });
      context += '\n';
    }

    // Active features
    if (knowledge.context.activeFeatures.length > 0) {
      context += `## Active Features\n`;
      context += knowledge.context.activeFeatures.join(', ') + '\n\n';
    }

    context += `## Query Context\n`;
    context += `User is asking about: ${query}\n`;
    context += `Consider the above context when responding.\n`;

    return context;
  }

  /**
   * Get knowledge for AI prompt
   */
  getKnowledgeForPrompt(): string {
    if (!this.knowledge) {
      return 'No knowledge base available. Run build-knowledge first.';
    }

    return this.buildContextString(this.knowledge, '', {
      patterns: [],
      decisions: [],
      files: [],
    });
  }

  /**
   * Update knowledge after changes
   */
  async updateKnowledge(projectPath: string): Promise<void> {
    this.knowledge = await codebaseKnowledgeBase.buildKnowledge(projectPath);
  }
}

export const deepContextAgent = new DeepContextAgent();

