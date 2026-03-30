/**
 * Documentation Checker
 * 
 * Ensures code is properly documented
 */

import * as fs from 'fs';
import * as path from 'path';

export interface DocumentationIssue {
  id: string;
  severity: 'high' | 'medium' | 'low';
  title: string;
  description: string;
  file: string;
  line?: number;
  suggestion: string;
}

export interface DocumentationReport {
  totalIssues: number;
  high: number;
  medium: number;
  low: number;
  issues: DocumentationIssue[];
  coverage: number; // Percentage of documented code
}

class DocumentationChecker {
  /**
   * Check project documentation
   */
  async checkProject(projectPath: string): Promise<DocumentationReport> {
    const issues: DocumentationIssue[] = [];
    const files = await this.findCodeFiles(projectPath);
    let documentedFunctions = 0;
    let totalFunctions = 0;

    for (const file of files) {
      const fileIssues = await this.checkFile(file, projectPath);
      issues.push(...fileIssues);

      // Count documentation coverage
      const stats = await this.getDocumentationStats(file);
      documentedFunctions += stats.documented;
      totalFunctions += stats.total;
    }

    const coverage = totalFunctions > 0 
      ? Math.round((documentedFunctions / totalFunctions) * 100)
      : 100;

    return {
      totalIssues: issues.length,
      high: issues.filter(i => i.severity === 'high').length,
      medium: issues.filter(i => i.severity === 'medium').length,
      low: issues.filter(i => i.severity === 'low').length,
      issues,
      coverage,
    };
  }

  /**
   * Check a single file
   */
  private async checkFile(
    filePath: string,
    projectPath: string
  ): Promise<DocumentationIssue[]> {
    const issues: DocumentationIssue[] = [];

    try {
      const content = await fs.promises.readFile(filePath, 'utf8');
      const lines = content.split('\n');
      const relativePath = path.relative(projectPath, filePath);

      // Check for README
      if (this.isMainFile(filePath)) {
        const hasReadme = await this.hasReadme(path.dirname(filePath));
        if (!hasReadme) {
          issues.push({
            id: `missing-readme-${relativePath}`,
            severity: 'medium',
            title: 'Missing README',
            description: 'Main file or directory lacks a README.md file.',
            file: relativePath,
            suggestion: 'Add a README.md file explaining the purpose and usage of this code.',
          });
        }
      }

      // Check function documentation
      const functionIssues = this.checkFunctionDocumentation(
        content,
        relativePath,
        lines
      );
      issues.push(...functionIssues);

      // Check class documentation
      const classIssues = this.checkClassDocumentation(
        content,
        relativePath,
        lines
      );
      issues.push(...classIssues);

      // Check interface/type documentation
      const typeIssues = this.checkTypeDocumentation(
        content,
        relativePath,
        lines
      );
      issues.push(...typeIssues);

      // Check for TODO/FIXME without context
      const todoIssues = this.checkTodos(content, relativePath, lines);
      issues.push(...todoIssues);

    } catch {
      // Error reading file
    }

    return issues;
  }

  /**
   * Check function documentation
   */
  private checkFunctionDocumentation(
    content: string,
    file: string,
    lines: string[]
  ): DocumentationIssue[] {
    const issues: DocumentationIssue[] = [];
    const functionRegex = /(?:export\s+)?(?:async\s+)?function\s+(\w+)|(?:export\s+)?const\s+(\w+)\s*[:=]\s*(?:async\s+)?\(/g;

    let match;
    while ((match = functionRegex.exec(content)) !== null) {
      const funcName = match[1] || match[2];
      const lineNum = content.substring(0, match.index).split('\n').length;
      const funcLine = lines[lineNum - 1];

      // Check if function is exported (should be documented)
      const isExported = funcLine.includes('export');
      const isPublic = !funcName.startsWith('_') && !funcName.startsWith('private');

      if (isExported || isPublic) {
        // Check for JSDoc comment above
        const hasDoc = this.hasDocumentation(lines, lineNum - 1);
        if (!hasDoc) {
          issues.push({
            id: `undocumented-function-${funcName}-${file}`,
            severity: isExported ? 'high' : 'medium',
            title: `Undocumented Function: ${funcName}`,
            description: `Function ${funcName} is ${isExported ? 'exported' : 'public'} but lacks documentation.`,
            file,
            line: lineNum,
            suggestion: `Add JSDoc comment above the function describing its purpose, parameters, and return value.`,
          });
        }
      }
    }

    return issues;
  }

  /**
   * Check class documentation
   */
  private checkClassDocumentation(
    content: string,
    file: string,
    lines: string[]
  ): DocumentationIssue[] {
    const issues: DocumentationIssue[] = [];
    const classRegex = /(?:export\s+)?class\s+(\w+)/g;

    let match;
    while ((match = classRegex.exec(content)) !== null) {
      const className = match[1];
      const lineNum = content.substring(0, match.index).split('\n').length;
      const isExported = lines[lineNum - 1].includes('export');

      if (isExported) {
        const hasDoc = this.hasDocumentation(lines, lineNum - 1);
        if (!hasDoc) {
          issues.push({
            id: `undocumented-class-${className}-${file}`,
            severity: 'high',
            title: `Undocumented Class: ${className}`,
            description: `Exported class ${className} lacks documentation.`,
            file,
            line: lineNum,
            suggestion: 'Add JSDoc comment above the class describing its purpose and usage.',
          });
        }
      }
    }

    return issues;
  }

  /**
   * Check type/interface documentation
   */
  private checkTypeDocumentation(
    content: string,
    file: string,
    lines: string[]
  ): DocumentationIssue[] {
    const issues: DocumentationIssue[] = [];
    const typeRegex = /(?:export\s+)?(?:interface|type)\s+(\w+)/g;

    let match;
    while ((match = typeRegex.exec(content)) !== null) {
      const typeName = match[1];
      const lineNum = content.substring(0, match.index).split('\n').length;
      const isExported = lines[lineNum - 1].includes('export');

      if (isExported) {
        const hasDoc = this.hasDocumentation(lines, lineNum - 1);
        if (!hasDoc) {
          issues.push({
            id: `undocumented-type-${typeName}-${file}`,
            severity: 'medium',
            title: `Undocumented Type: ${typeName}`,
            description: `Exported type/interface ${typeName} lacks documentation.`,
            file,
            line: lineNum,
            suggestion: 'Add JSDoc comment above the type describing its purpose and properties.',
          });
        }
      }
    }

    return issues;
  }

  /**
   * Check for TODOs without context
   */
  private checkTodos(
    content: string,
    file: string,
    lines: string[]
  ): DocumentationIssue[] {
    const issues: DocumentationIssue[] = [];
    const todoRegex = /\/\/\s*TODO:?\s*$/gm;

    let match;
    while ((match = todoRegex.exec(content)) !== null) {
      const lineNum = content.substring(0, match.index).split('\n').length;
      issues.push({
        id: `todo-without-context-${file}-${lineNum}`,
        severity: 'low',
        title: 'TODO Without Context',
        description: 'TODO comment lacks description of what needs to be done.',
        file,
        line: lineNum,
        suggestion: 'Add context to TODO comment explaining what needs to be done and why.',
      });
    }

    return issues;
  }

  /**
   * Check if function/class has documentation
   */
  private hasDocumentation(lines: string[], lineIndex: number): boolean {
    // Check 3 lines above for JSDoc comment
    for (let i = Math.max(0, lineIndex - 3); i < lineIndex; i++) {
      const line = lines[i].trim();
      if (line.startsWith('/**') || line.startsWith('*')) {
        return true;
      }
      // Stop if we hit another declaration
      if (line.match(/^(export|function|class|interface|type|const|let|var)\s/)) {
        break;
      }
    }
    return false;
  }

  /**
   * Get documentation statistics
   */
  private async getDocumentationStats(filePath: string): Promise<{
    documented: number;
    total: number;
  }> {
    try {
      const content = await fs.promises.readFile(filePath, 'utf8');
      const functionRegex = /(?:export\s+)?(?:async\s+)?function\s+\w+|(?:export\s+)?const\s+\w+\s*[:=]\s*(?:async\s+)?\(/g;
      const functions = Array.from(content.matchAll(functionRegex));
      const lines = content.split('\n');

      let documented = 0;
      for (const match of functions) {
        const lineNum = content.substring(0, match.index).split('\n').length;
        if (this.hasDocumentation(lines, lineNum - 1)) {
          documented++;
        }
      }

      return {
        documented,
        total: functions.length,
      };
    } catch {
      return { documented: 0, total: 0 };
    }
  }

  /**
   * Check if file is a main file
   */
  private isMainFile(filePath: string): boolean {
    const name = path.basename(filePath, path.extname(filePath));
    return name === 'index' || name === 'main' || name === 'app';
  }

  /**
   * Check if directory has README
   */
  private async hasReadme(dirPath: string): Promise<boolean> {
    const readmePath = path.join(dirPath, 'README.md');
    try {
      await fs.promises.access(readmePath);
      return true;
    } catch {
      return false;
    }
  }

  private async findCodeFiles(dir: string): Promise<string[]> {
    const files: string[] = [];
    try {
      const items = await fs.promises.readdir(dir, { withFileTypes: true });
      for (const item of items) {
        const fullPath = path.join(dir, item.name);
        if (item.isDirectory() && !this.shouldIgnore(item.name)) {
          files.push(...await this.findCodeFiles(fullPath));
        } else if (item.isFile() && /\.(ts|tsx|js|jsx)$/.test(item.name)) {
          files.push(fullPath);
        }
      }
    } catch {
      // Error reading directory
    }
    return files;
  }

  private shouldIgnore(name: string): boolean {
    return ['node_modules', '.git', 'dist', 'build', '.next', 'coverage'].includes(name);
  }
}

export const documentationChecker = new DocumentationChecker();

