/**
 * Code Context Generator
 * 
 * Generates context-aware code prompts that follow project patterns
 */

import * as fs from 'fs/promises';
import * as path from 'path';

interface CodePattern {
  type: 'component' | 'hook' | 'utility' | 'service' | 'model' | 'test';
  framework: string;
  language: string;
  conventions: {
    naming: 'camelCase' | 'PascalCase' | 'snake_case';
    fileStructure: string[];
    imports: string[];
    exports: string[];
    styling: string;
  };
  examples: CodeExample[];
}

interface CodeExample {
  description: string;
  code: string;
  filePath: string;
}

interface GeneratedPrompt {
  task: string;
  context: string;
  patterns: CodePattern[];
  prompt: string;
  examples: CodeExample[];
  bestPractices: string[];
}

class CodeContextGenerator {
  private projectPatterns: Map<string, CodePattern[]> = new Map();
  private analyzed = false;

  /**
   * Generate context-aware code prompt
   */
  async generatePrompt(projectPath: string, task: string): Promise<GeneratedPrompt> {
    console.log(`⚙️ Generating code context for: ${task}`);
    
    // Analyze project if not already done
    if (!this.analyzed) {
      await this.analyzeProject(projectPath);
      this.analyzed = true;
    }
    
    // Detect task type
    const taskType = this.detectTaskType(task);
    
    // Get relevant patterns
    const patterns = this.getRelevantPatterns(projectPath, taskType);
    
    // Extract context
    const context = await this.extractContext(projectPath, taskType);
    
    // Generate prompt
    const prompt = this.buildPrompt(task, context, patterns);
    
    // Get best practices
    const bestPractices = this.getBestPractices(patterns);
    
    return {
      task,
      context,
      patterns,
      prompt,
      examples: patterns.flatMap(p => p.examples.slice(0, 2)),
      bestPractices
    };
  }

  /**
   * Analyze project to detect patterns
   */
  private async analyzeProject(projectPath: string): Promise<void> {
    console.log('🔍 Analyzing project patterns...');
    
    // Detect framework
    const framework = await this.detectFramework(projectPath);
    
    // Find source files
    const sourceFiles = await this.findSourceFiles(projectPath);
    
    // Analyze patterns by type
    const patterns: CodePattern[] = [];
    
    // Analyze components
    if (framework === 'react' || framework === 'vue' || framework === 'angular') {
      patterns.push(...await this.analyzeComponents(projectPath, sourceFiles, framework));
    }
    
    // Analyze hooks
    if (framework === 'react') {
      patterns.push(...await this.analyzeHooks(projectPath, sourceFiles));
    }
    
    // Analyze utilities
    patterns.push(...await this.analyzeUtilities(projectPath, sourceFiles));
    
    // Analyze services
    patterns.push(...await this.analyzeServices(projectPath, sourceFiles));
    
    // Analyze tests
    patterns.push(...await this.analyzeTests(projectPath, sourceFiles));
    
    this.projectPatterns.set(projectPath, patterns);
    console.log(`✅ Analyzed ${patterns.length} pattern types`);
  }

  /**
   * Detect the framework being used
   */
  private async detectFramework(projectPath: string): Promise<string> {
    try {
      const packageJson = JSON.parse(await fs.readFile(path.join(projectPath, 'package.json'), 'utf-8'));
      
      if (packageJson.dependencies?.react) return 'react';
      if (packageJson.dependencies?.vue) return 'vue';
      if (packageJson.dependencies?.['@angular/core']) return 'angular';
      if (packageJson.dependencies?.express) return 'express';
      if (packageJson.dependencies?.fastify) return 'fastify';
      if (packageJson.dependencies?.next) return 'next';
      
      return 'vanilla';
    } catch {
      return 'vanilla';
    }
  }

  /**
   * Find all source files
   */
  private async findSourceFiles(projectPath: string): Promise<string[]> {
    const extensions = ['.ts', '.tsx', '.js', '.jsx', '.vue'];
    const files: string[] = [];
    
    const scan = async (dir: string) => {
      const entries = await fs.readdir(dir, { withFileTypes: true });
      
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        
        if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules') {
          await scan(fullPath);
        } else if (entry.isFile() && extensions.some(ext => entry.name.endsWith(ext))) {
          files.push(fullPath);
        }
      }
    };
    
    await scan(projectPath);
    return files;
  }

  /**
   * Analyze component patterns
   */
  private async analyzeComponents(projectPath: string, files: string[], framework: string): Promise<CodePattern[]> {
    const componentFiles = files.filter(f => 
      f.includes('/components/') || 
      f.includes('/views/') || 
      f.includes('/pages/') ||
      (framework === 'react' && (f.endsWith('.tsx') || f.endsWith('.jsx')))
    );
    
    const pattern: CodePattern = {
      type: 'component',
      framework,
      language: 'typescript',
      conventions: {
        naming: 'PascalCase',
        fileStructure: [],
        imports: [],
        exports: [],
        styling: ''
      },
      examples: []
    };
    
    // Analyze first few components for patterns
    for (const file of componentFiles.slice(0, 5)) {
      const content = await fs.readFile(file, 'utf-8');
      
      // Extract imports
      const importMatches = content.matchAll(/^import\s+.*$/gm);
      for (const match of importMatches) {
        if (!pattern.conventions.imports.includes(match[0])) {
          pattern.conventions.imports.push(match[0]);
        }
      }
      
      // Add example
      pattern.examples.push({
        description: `Component: ${path.basename(file)}`,
        code: content.substring(0, 500) + '...',
        filePath: file
      });
    }
    
    return [pattern];
  }

  /**
   * Analyze hook patterns (React specific)
   */
  private async analyzeHooks(projectPath: string, files: string[]): Promise<CodePattern[]> {
    const hookFiles = files.filter(f => 
      f.includes('/hooks/') || 
      f.includes('/use') ||
      /^use[A-Z]/.test(path.basename(f))
    );
    
    const pattern: CodePattern = {
      type: 'hook',
      framework: 'react',
      language: 'typescript',
      conventions: {
        naming: 'camelCase',
        fileStructure: [],
        imports: ['import { useState, useEffect } from \'react\';'],
        exports: ['export function use'],
        styling: ''
      },
      examples: []
    };
    
    for (const file of hookFiles.slice(0, 3)) {
      const content = await fs.readFile(file, 'utf-8');
      pattern.examples.push({
        description: `Hook: ${path.basename(file)}`,
        code: content.substring(0, 500) + '...',
        filePath: file
      });
    }
    
    return [pattern];
  }

  /**
   * Analyze utility patterns
   */
  private async analyzeUtilities(projectPath: string, files: string[]): Promise<CodePattern[]> {
    const utilFiles = files.filter(f => 
      f.includes('/utils/') || 
      f.includes('/lib/') || 
      f.includes('/helpers/')
    );
    
    const pattern: CodePattern = {
      type: 'utility',
      framework: 'vanilla',
      language: 'typescript',
      conventions: {
        naming: 'camelCase',
        fileStructure: [],
        imports: [],
        exports: ['export function', 'export const'],
        styling: ''
      },
      examples: []
    };
    
    for (const file of utilFiles.slice(0, 3)) {
      const content = await fs.readFile(file, 'utf-8');
      pattern.examples.push({
        description: `Utility: ${path.basename(file)}`,
        code: content.substring(0, 500) + '...',
        filePath: file
      });
    }
    
    return [pattern];
  }

  /**
   * Analyze service patterns
   */
  private async analyzeServices(projectPath: string, files: string[]): Promise<CodePattern[]> {
    const serviceFiles = files.filter(f => 
      f.includes('/services/') || 
      f.includes('/api/') || 
      f.includes('/routes/')
    );
    
    const pattern: CodePattern = {
      type: 'service',
      framework: 'express',
      language: 'typescript',
      conventions: {
        naming: 'camelCase',
        fileStructure: [],
        imports: ['import express from \'express\';'],
        exports: ['export class', 'export async function'],
        styling: ''
      },
      examples: []
    };
    
    for (const file of serviceFiles.slice(0, 3)) {
      const content = await fs.readFile(file, 'utf-8');
      pattern.examples.push({
        description: `Service: ${path.basename(file)}`,
        code: content.substring(0, 500) + '...',
        filePath: file
      });
    }
    
    return [pattern];
  }

  /**
   * Analyze test patterns
   */
  private async analyzeTests(projectPath: string, files: string[]): Promise<CodePattern[]> {
    const testFiles = files.filter(f => 
      f.includes('.test.') || 
      f.includes('.spec.') || 
      f.includes('/__tests__/')
    );
    
    const pattern: CodePattern = {
      type: 'test',
      framework: 'jest',
      language: 'typescript',
      conventions: {
        naming: 'camelCase',
        fileStructure: [],
        imports: ['import { describe, it, expect } from \'@jest/globals\';'],
        exports: [],
        styling: ''
      },
      examples: []
    };
    
    for (const file of testFiles.slice(0, 3)) {
      const content = await fs.readFile(file, 'utf-8');
      pattern.examples.push({
        description: `Test: ${path.basename(file)}`,
        code: content.substring(0, 500) + '...',
        filePath: file
      });
    }
    
    return [pattern];
  }

  /**
   * Detect task type from description
   */
  private detectTaskType(task: string): string {
    const lowerTask = task.toLowerCase();
    
    if (lowerTask.includes('component') || lowerTask.includes('ui')) return 'component';
    if (lowerTask.includes('hook') || lowerTask.includes('state')) return 'hook';
    if (lowerTask.includes('service') || lowerTask.includes('api')) return 'service';
    if (lowerTask.includes('test')) return 'test';
    if (lowerTask.includes('util') || lowerTask.includes('helper')) return 'utility';
    
    return 'general';
  }

  /**
   * Get relevant patterns for task type
   */
  private getRelevantPatterns(projectPath: string, taskType: string): CodePattern[] {
    const patterns = this.projectPatterns.get(projectPath) || [];
    
    if (taskType === 'general') return patterns;
    
    return patterns.filter(p => p.type === taskType);
  }

  /**
   * Extract context from project
   */
  private async extractContext(projectPath: string, taskType: string): Promise<string> {
    try {
      const packageJson = JSON.parse(await fs.readFile(path.join(projectPath, 'package.json'), 'utf-8'));
      
      let context = `Project: ${packageJson.name || 'Unknown'}\n`;
      context += `Framework: ${Object.keys(packageJson.dependencies || {}).join(', ')}\n`;
      context += `Task Type: ${taskType}\n`;
      
      return context;
    } catch {
      return 'Project: Unknown\nTask Type: ' + taskType;
    }
  }

  /**
   * Build the actual prompt
   */
  private buildPrompt(task: string, context: string, patterns: CodePattern[]): string {
    let prompt = `Generate code for the following task following the project's established patterns:\n\n`;
    prompt += `Task: ${task}\n`;
    prompt += `Context:\n${context}\n\n`;
    
    if (patterns.length > 0) {
      prompt += `Patterns to follow:\n`;
      patterns.forEach(p => {
        prompt += `- Use ${p.naming} naming convention\n`;
        prompt += `- Follow this import structure: ${p.conventions.imports.slice(0, 3).join(', ')}\n`;
      });
    }
    
    prompt += `\nPlease provide:\n`;
    prompt += `1. Complete, production-ready code\n`;
    prompt += `2. Proper TypeScript types\n`;
    prompt += `3. Error handling where appropriate\n`;
    prompt += `4. Comments for complex logic\n`;
    
    return prompt;
  }

  /**
   * Get best practices from patterns
   */
  private getBestPractices(patterns: CodePattern[]): string[] {
    const practices: string[] = [];
    
    patterns.forEach(p => {
      if (p.type === 'component') {
        practices.push('Keep components focused on a single responsibility');
        practices.push('Use proper TypeScript interfaces for props');
      }
      if (p.type === 'hook') {
        practices.push('Start custom hooks with "use"');
        practices.push('Return state and actions as an array or object');
      }
      if (p.type === 'service') {
        practices.push('Handle errors gracefully');
        practices.push('Use async/await for asynchronous operations');
      }
    });
    
    return [...new Set(practices)]; // Remove duplicates
  }
}

// Export singleton instance
export const codeContextGenerator = new CodeContextGenerator();
