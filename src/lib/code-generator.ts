/**
 * Context-Aware Code Generator
 * 
 * Generates code that follows YOUR project's patterns and conventions
 */

import { codebaseKnowledgeBase } from './codebase-knowledge';
import { semanticCodeSearch } from './semantic-search';

export interface CodeGenerationContext {
  task: string;
  patterns: string[];
  conventions: {
    naming: string;
    imports: string[];
    structure: string;
  };
  examples: Array<{
    file: string;
    code: string;
    relevance: string;
  }>;
  suggestions: string[];
}

class ContextAwareCodeGenerator {
  /**
   * Generate code generation context
   */
  async generateContext(
    task: string,
    projectPath: string
  ): Promise<CodeGenerationContext> {
    const knowledge = await codebaseKnowledgeBase.getKnowledge(projectPath);
    if (!knowledge) {
      throw new Error('Knowledge base not found. Run build-knowledge first.');
    }

    // Search for similar code
    const similarCode = await semanticCodeSearch.search(task, projectPath, 3);

    // Get relevant patterns
    const relevantPatterns = knowledge.patterns
      .filter(p => task.toLowerCase().includes(p.category) || 
                   p.name.toLowerCase().includes(task.toLowerCase()))
      .map(p => p.name);

    // Get conventions
    const conventions = {
      naming: knowledge.architecture.conventions.naming.files || 'camelCase',
      imports: knowledge.architecture.conventions.importPatterns,
      structure: knowledge.architecture.structure.type,
    };

    // Build examples from similar code
    const examples = similarCode.map(result => ({
      file: result.snippet.file,
      code: result.snippet.code.substring(0, 500), // Limit code length
      relevance: result.reason,
    }));

    // Generate suggestions
    const suggestions = this.generateSuggestions(knowledge, task, similarCode);

    return {
      task,
      patterns: relevantPatterns,
      conventions,
      examples,
      suggestions,
    };
  }

  /**
   * Generate code generation prompt
   */
  async generatePrompt(
    task: string,
    projectPath: string
  ): Promise<string> {
    const context = await this.generateContext(task, projectPath);

    let prompt = `# Code Generation Request\n\n`;
    prompt += `## Task\n${task}\n\n`;

    prompt += `## Project Context\n`;
    prompt += `This is a ${context.conventions.structure} project.\n`;
    prompt += `Follow these conventions:\n`;
    prompt += `- File naming: ${context.conventions.naming}\n`;
    if (context.conventions.imports.length > 0) {
      prompt += `- Import patterns: ${context.conventions.imports.join(', ')}\n`;
    }
    prompt += `\n`;

    if (context.patterns.length > 0) {
      prompt += `## Relevant Patterns\n`;
      context.patterns.forEach(pattern => {
        prompt += `- ${pattern}\n`;
      });
      prompt += `\n`;
    }

    if (context.examples.length > 0) {
      prompt += `## Similar Code Examples\n`;
      context.examples.forEach((example, i) => {
        prompt += `\n### Example ${i + 1}: ${example.file}\n`;
        prompt += `Relevance: ${example.relevance}\n`;
        prompt += `\`\`\`typescript\n${example.code}\n\`\`\`\n`;
      });
      prompt += `\n`;
    }

    if (context.suggestions.length > 0) {
      prompt += `## Suggestions\n`;
      context.suggestions.forEach(suggestion => {
        prompt += `- ${suggestion}\n`;
      });
      prompt += `\n`;
    }

    prompt += `## Instructions\n`;
    prompt += `Generate code that:\n`;
    prompt += `1. Follows the project's conventions\n`;
    prompt += `2. Uses similar patterns to the examples\n`;
    prompt += `3. Matches the existing code style\n`;
    prompt += `4. Is consistent with the project structure\n`;

    return prompt;
  }

  /**
   * Generate suggestions based on context
   */
  private generateSuggestions(
    knowledge: any,
    task: string,
    similarCode: any[]
  ): string[] {
    const suggestions: string[] = [];

    // Architecture suggestions
    if (knowledge.architecture.structure.type === 'modular') {
      suggestions.push('Organize code in feature-based modules');
    }

    // Pattern suggestions
    if (similarCode.length > 0) {
      suggestions.push(`Follow patterns similar to ${similarCode[0].snippet.file}`);
    }

    // Convention suggestions
    if (knowledge.architecture.conventions.importPatterns.includes('path-aliases')) {
      suggestions.push('Use path aliases (@/) for imports');
    }

    // Naming suggestions
    if (knowledge.architecture.conventions.naming.files) {
      suggestions.push(`Use ${knowledge.architecture.conventions.naming.files} for file names`);
    }

    return suggestions;
  }
}

export const codeGenerator = new ContextAwareCodeGenerator();

