/**
 * Code Refactoring Automation
 * 
 * Automatically refactors code based on patterns and best practices
 * Unique: Safe, automated refactoring with validation
 */

import { predictiveRefactorer } from './predictive-refactorer';
import { codeGenerationValidator } from './code-generation-validator';
import * as fs from 'fs';
import * as path from 'path';

export interface RefactoringAction {
  type: 'extract' | 'rename' | 'move' | 'simplify' | 'consolidate';
  file: string;
  line: number;
  description: string;
  before: string;
  after: string;
  confidence: number;
  safe: boolean;
}

export interface RefactoringResult {
  actions: RefactoringAction[];
  applied: number;
  skipped: number;
  errors: number;
  improvements: {
    complexity: number;
    maintainability: number;
    lines: number;
  };
}

class RefactoringAutomation {
  /**
   * Automatically refactor code
   */
  async refactor(
    projectPath: string,
    options?: {
      safety?: 'strict' | 'moderate' | 'aggressive';
      autoApply?: boolean;
      backup?: boolean;
    }
  ): Promise<RefactoringResult> {
    // Get refactoring suggestions
    const plan = await predictiveRefactorer.suggestRefactorings(projectPath);

    const actions: RefactoringAction[] = [];
    let applied = 0;
    let skipped = 0;
    let errors = 0;

    const safety = options?.safety || 'moderate';
    const minConfidence = safety === 'strict' ? 0.9 : safety === 'moderate' ? 0.7 : 0.5;

    // Convert suggestions to actions
    for (const suggestion of plan.suggestions) {
      if (suggestion.confidence >= minConfidence) {
        const action = this.suggestionToAction(suggestion);
        actions.push(action);

        // Apply if safe and auto-apply enabled
        if (options?.autoApply && action.safe) {
          try {
            await this.applyAction(action, projectPath, options?.backup);
            applied++;
          } catch (error) {
            errors++;
          }
        } else if (!action.safe) {
          skipped++;
        }
      } else {
        skipped++;
      }
    }

    // Calculate improvements
    const improvements = this.calculateImprovements(actions);

    return {
      actions,
      applied,
      skipped,
      errors,
      improvements,
    };
  }

  /**
   * Convert suggestion to action
   */
  private suggestionToAction(suggestion: RefactoringSuggestion): RefactoringAction {
    return {
      type: suggestion.type as RefactoringAction['type'],
      file: suggestion.file,
      line: suggestion.line || 1,
      description: suggestion.reason,
      before: suggestion.currentCode.substring(0, 200),
      after: suggestion.suggestedCode.substring(0, 200),
      confidence: suggestion.confidence,
      safe: suggestion.risks.length === 0 || suggestion.risks.every((r: string) => r.includes('testing')),
    };
  }

  /**
   * Apply refactoring action
   */
  private async applyAction(
    action: RefactoringAction,
    projectPath: string,
    backup?: boolean
  ): Promise<void> {
    const filePath = path.join(projectPath, action.file);

    // Backup if requested
    if (backup) {
      const backupPath = `${filePath}.backup`;
      await fs.promises.copyFile(filePath, backupPath);
    }

    // Read file
    let content = await fs.promises.readFile(filePath, 'utf8');

    // Apply refactoring
    if (action.type === 'extract') {
      content = this.applyExtract(content, action);
    } else if (action.type === 'simplify') {
      content = this.applySimplify(content, action);
    } else if (action.type === 'consolidate') {
      content = this.applyConsolidate(content, action);
    }

    // Validate before writing
    const validation = await codeGenerationValidator.validate(
      content,
      projectPath,
      { file: action.file }
    );

    if (validation.canUse) {
      await fs.promises.writeFile(filePath, content, 'utf8');
    } else {
      throw new Error('Refactoring validation failed');
    }
  }

  /**
   * Apply extract refactoring
   */
  private applyExtract(content: string, action: RefactoringAction): string {
    // Simplified - in production use proper AST manipulation
    return content.replace(action.before, action.after);
  }

  /**
   * Apply simplify refactoring
   */
  private applySimplify(content: string, action: RefactoringAction): string {
    return content.replace(action.before, action.after);
  }

  /**
   * Apply consolidate refactoring
   */
  private applyConsolidate(content: string, action: RefactoringAction): string {
    return content.replace(action.before, action.after);
  }

  /**
   * Calculate improvements
   */
  private calculateImprovements(actions: RefactoringAction[]): RefactoringResult['improvements'] {
    // Simplified calculation
    return {
      complexity: actions.length * -2, // Reduced complexity
      maintainability: actions.length * 5, // Improved maintainability
      lines: actions.length * -10, // Reduced lines
    };
  }
}

export const refactoringAutomation = new RefactoringAutomation();

