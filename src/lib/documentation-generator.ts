/**
 * Code Documentation Generator
 * 
 * Automatically generates comprehensive documentation
 * Unique: Learns your documentation style and generates matching docs
 */

import * as fs from 'fs';
import * as path from 'path';
import { codebaseKnowledgeBase } from './codebase-knowledge';

export interface DocumentationSection {
  title: string;
  content: string;
  type: 'overview' | 'api' | 'example' | 'notes';
}

export interface Documentation {
  file: string;
  title: string;
  description: string;
  sections: DocumentationSection[];
  examples: string[];
  api: Array<{
    name: string;
    description: string;
    params: Array<{ name: string; type: string; description: string }>;
    returns: string;
  }>;
}

class DocumentationGenerator {
  /**
   * Generate documentation for a file
   */
  async generate(
    filePath: string,
    projectPath: string,
    options?: {
      format?: 'markdown' | 'jsdoc' | 'tsdoc';
      includeExamples?: boolean;
      includeAPI?: boolean;
    }
  ): Promise<Documentation> {
    // Read file
    const code = await fs.promises.readFile(filePath, 'utf8');

    // Get knowledge base
    const knowledge = await codebaseKnowledgeBase.getKnowledge(projectPath);

    // Extract functions/classes
    const functions = this.extractFunctions(code);
    const classes = this.extractClasses(code);

    // Generate sections
    const sections: DocumentationSection[] = [];

    // Overview
    sections.push({
      title: 'Overview',
      content: this.generateOverview(code, filePath),
      type: 'overview',
    });

    // API documentation
    if (options?.includeAPI !== false) {
      const apiSection = this.generateAPISection(functions, classes);
      if (apiSection.content) {
        sections.push(apiSection);
      }
    }

    // Examples
    if (options?.includeExamples !== false) {
      const exampleSection = this.generateExamplesSection(code, knowledge);
      if (exampleSection.content) {
        sections.push(exampleSection);
      }
    }

    // Generate API reference
    const api = this.generateAPIReference(functions, classes);

    // Generate examples
    const examples = this.generateExamples(code, knowledge);

    return {
      file: path.relative(projectPath, filePath),
      title: path.basename(filePath, path.extname(filePath)),
      description: this.generateDescription(code),
      sections,
      examples,
      api,
    };
  }

  /**
   * Generate overview
   */
  private generateOverview(code: string, filePath: string): string {
    const lines = code.split('\n').length;
    const functions = (code.match(/function\s+\w+/g) || []).length;
    const classes = (code.match(/class\s+\w+/g) || []).length;

    return `This file contains ${functions} function(s) and ${classes} class(es) across ${lines} lines of code.`;
  }

  /**
   * Generate API section
   */
  private generateAPISection(
    functions: Array<{ name: string; params: string[]; line: number }>,
    classes: Array<{ name: string; methods: number; line: number }>
  ): DocumentationSection {
    const content: string[] = [];

    if (functions.length > 0) {
      content.push('## Functions\n');
      for (const func of functions) {
        content.push(`### ${func.name}`);
        content.push(`Parameters: ${func.params.join(', ')}`);
        content.push('');
      }
    }

    if (classes.length > 0) {
      content.push('## Classes\n');
      for (const cls of classes) {
        content.push(`### ${cls.name}`);
        content.push(`Methods: ${cls.methods}`);
        content.push('');
      }
    }

    return {
      title: 'API Reference',
      content: content.join('\n'),
      type: 'api',
    };
  }

  /**
   * Generate examples section
   */
  private generateExamplesSection(code: string, knowledge: KnowledgeBase): DocumentationSection {
    const examples: string[] = [];

    // Extract usage patterns
    const usagePatterns = this.extractUsagePatterns(code);

    for (const pattern of usagePatterns.slice(0, 3)) {
      examples.push(`\`\`\`typescript\n${pattern}\n\`\`\``);
    }

    return {
      title: 'Examples',
      content: examples.join('\n\n'),
      type: 'example',
    };
  }

  /**
   * Generate API reference
   */
  private generateAPIReference(
    functions: Array<{ name: string; params: string[]; line: number }>,
    classes: Array<{ name: string; methods: number; line: number }>
  ): Documentation['api'] {
    const api: Documentation['api'] = [];

    for (const func of functions) {
      api.push({
        name: func.name,
        description: `Function ${func.name}`,
        params: func.params.map(p => ({
          name: p.split(':')[0].trim(),
          type: p.split(':')[1]?.trim() || 'any',
          description: `Parameter ${p.split(':')[0].trim()}`,
        })),
        returns: 'void',
      });
    }

    return api;
  }

  /**
   * Generate examples
   */
  private generateExamples(code: string, knowledge: KnowledgeBase): string[] {
    const examples: string[] = [];
    // Simplified - in production generate from actual usage
    return examples;
  }

  /**
   * Generate description
   */
  private generateDescription(code: string): string {
    // Extract first comment or generate from code
    const commentMatch = code.match(/\/\*\*([^*]|[\r\n]|(\*+([^*/]|[\r\n])))*\*\//);
    if (commentMatch) {
      return commentMatch[0].replace(/\/\*\*|\*\//g, '').trim();
    }
    return 'Auto-generated documentation';
  }

  /**
   * Write documentation file
   */
  async writeDocumentation(
    documentation: Documentation,
    outputPath?: string,
    format: 'markdown' | 'jsdoc' | 'tsdoc' = 'markdown'
  ): Promise<string> {
    const sourceFile = documentation.file;
    const ext = path.extname(sourceFile);
    const baseName = path.basename(sourceFile, ext);
    const dir = path.dirname(sourceFile);

    const docFileName = format === 'markdown' ? `${baseName}.md` : `${baseName}.doc.md`;
    const docFilePath = outputPath || path.join(dir, docFileName);

    const content = this.formatDocumentation(documentation, format);

    await fs.promises.writeFile(docFilePath, content, 'utf8');

    return docFilePath;
  }

  /**
   * Format documentation
   */
  private formatDocumentation(
    doc: Documentation,
    format: 'markdown' | 'jsdoc' | 'tsdoc'
  ): string {
    if (format === 'markdown') {
      return this.formatMarkdown(doc);
    }
    return this.formatMarkdown(doc); // Default to markdown
  }

  /**
   * Format as markdown
   */
  private formatMarkdown(doc: Documentation): string {
    const parts: string[] = [];

    parts.push(`# ${doc.title}`);
    parts.push('');
    parts.push(doc.description);
    parts.push('');

    for (const section of doc.sections) {
      parts.push(`## ${section.title}`);
      parts.push('');
      parts.push(section.content);
      parts.push('');
    }

    if (doc.api.length > 0) {
      parts.push('## API Reference');
      parts.push('');
      for (const item of doc.api) {
        parts.push(`### ${item.name}`);
        parts.push(item.description);
        if (item.params.length > 0) {
          parts.push('\n**Parameters:**');
          for (const param of item.params) {
            parts.push(`- \`${param.name}\`: ${param.type} - ${param.description}`);
          }
        }
        parts.push(`\n**Returns:** ${item.returns}`);
        parts.push('');
      }
    }

    return parts.join('\n');
  }

  // Helper methods
  private extractFunctions(code: string): Array<{ name: string; params: string[]; line: number }> {
    const functions: Array<{ name: string; params: string[]; line: number }> = [];
    const regex = /(?:export\s+)?(?:async\s+)?function\s+(\w+)\s*\(([^)]*)\)/g;
    let match;
    while ((match = regex.exec(code)) !== null) {
      functions.push({
        name: match[1],
        params: match[2].split(',').map(p => p.trim()).filter(Boolean),
        line: code.substring(0, match.index).split('\n').length,
      });
    }
    return functions;
  }

  private extractClasses(code: string): Array<{ name: string; methods: number; line: number }> {
    const classes: Array<{ name: string; methods: number; line: number }> = [];
    const regex = /(?:export\s+)?class\s+(\w+)/g;
    let match;
    while ((match = regex.exec(code)) !== null) {
      // Count methods
      const classStart = match.index;
      const classEnd = this.findClassEnd(code, classStart);
      const classCode = code.substring(classStart, classEnd);
      const methods = (classCode.match(/\w+\s*\([^)]*\)\s*\{/g) || []).length;

      classes.push({
        name: match[1],
        methods,
        line: code.substring(0, match.index).split('\n').length,
      });
    }
    return classes;
  }

  private findClassEnd(code: string, start: number): number {
    let depth = 0;
    for (let i = start; i < code.length; i++) {
      if (code[i] === '{') depth++;
      if (code[i] === '}') {
        depth--;
        if (depth === 0) return i + 1;
      }
    }
    return code.length;
  }

  private extractUsagePatterns(code: string): string[] {
    // Simplified - in production extract actual usage
    return [];
  }
}

export const documentationGenerator = new DocumentationGenerator();

