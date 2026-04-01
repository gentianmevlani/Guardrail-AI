/**
 * React/Next.js Deep Integration Adapter
 * 
 * Framework-specific optimizations and patterns for React
 */

import * as fs from 'fs';
import * as path from 'path';
import { codebaseKnowledgeBase } from '../codebase-knowledge';

export interface ReactPattern {
  type: 'hook' | 'component' | 'context' | 'hoc' | 'custom-hook';
  name: string;
  file: string;
  usage: string[];
}

export interface ReactAnalysis {
  hooks: string[];
  components: Array<{
    name: string;
    type: 'functional' | 'class';
    props: string[];
    hooks: string[];
  }>;
  contexts: string[];
  patterns: ReactPattern[];
  optimizations: Array<{
    type: string;
    suggestion: string;
    impact: string;
  }>;
}

class ReactAdapter {
  /**
   * Analyze React codebase
   */
  async analyze(projectPath: string): Promise<ReactAnalysis> {
    const hooks: string[] = [];
    const components: ReactAnalysis['components'] = [];
    const contexts: string[] = [];
    const patterns: ReactPattern[] = [];

    // Find React files
    const reactFiles = await this.findReactFiles(projectPath);

    for (const file of reactFiles) {
      try {
        const content = await fs.promises.readFile(file, 'utf8');

        // Extract hooks
        const fileHooks = this.extractHooks(content);
        hooks.push(...fileHooks);

        // Extract components
        const fileComponents = this.extractComponents(content, file);
        components.push(...fileComponents);

        // Extract contexts
        const fileContexts = this.extractContexts(content);
        contexts.push(...fileContexts);

        // Extract patterns
        const filePatterns = this.extractPatterns(content, file);
        patterns.push(...filePatterns);
      } catch {
        // Error reading file
      }
    }

    // Generate optimizations
    const optimizations = this.generateOptimizations(components, hooks, patterns);

    return {
      hooks: [...new Set(hooks)],
      components,
      contexts: [...new Set(contexts)],
      patterns,
      optimizations,
    };
  }

  /**
   * Generate React-specific context
   */
  async generateContext(projectPath: string): Promise<string> {
    const analysis = await this.analyze(projectPath);
    const knowledge = await codebaseKnowledgeBase.getKnowledge(projectPath);

    const context = `# React/Next.js Project Context

## Framework Information
- React Components: ${analysis.components.length}
- Custom Hooks: ${analysis.hooks.filter(h => h.startsWith('use')).length}
- Contexts: ${analysis.contexts.length}
- Patterns: ${analysis.patterns.length}

## Available Hooks
${analysis.hooks.map(h => `- ${h}`).join('\n')}

## Component Patterns
${analysis.patterns.map(p => `- ${p.type}: ${p.name}`).join('\n')}

## Conventions
${knowledge?.architecture?.conventions ? JSON.stringify(knowledge.architecture.conventions, null, 2) : 'None detected'}

## Optimizations Available
${analysis.optimizations.map(o => `- ${o.type}: ${o.suggestion}`).join('\n')}
`;

    return context;
  }

  /**
   * Extract React hooks
   */
  private extractHooks(code: string): string[] {
    const hooks: string[] = [];
    const hookRegex = /(?:use[A-Z]\w+|useState|useEffect|useContext|useReducer|useMemo|useCallback|useRef|useImperativeHandle|useLayoutEffect|useDebugValue)/g;
    let match;
    while ((match = hookRegex.exec(code)) !== null) {
      hooks.push(match[0]);
    }
    return hooks;
  }

  /**
   * Extract React components
   */
  private extractComponents(code: string, file: string): ReactAnalysis['components'] {
    const components: ReactAnalysis['components'] = [];

    // Functional components
    const funcRegex = /(?:export\s+)?(?:const|function)\s+([A-Z]\w+)\s*[:=]\s*(?:\([^)]*\)\s*=>|\([^)]*\)\s*\{)/g;
    let match;
    while ((match = funcRegex.exec(code)) !== null) {
      const componentName = match[1];
      const props = this.extractProps(code, match.index);
      const hooks = this.extractHooks(code.substring(match.index));

      components.push({
        name: componentName,
        type: 'functional',
        props,
        hooks,
      });
    }

    // Class components
    const classRegex = /(?:export\s+)?class\s+([A-Z]\w+)\s+extends\s+React\.Component/g;
    while ((match = classRegex.exec(code)) !== null) {
      components.push({
        name: match[1],
        type: 'class',
        props: ['props'],
        hooks: [],
      });
    }

    return components;
  }

  /**
   * Extract React contexts
   */
  private extractContexts(code: string): string[] {
    const contexts: string[] = [];
    const contextRegex = /(?:createContext|React\.createContext)\(([^)]+)\)/g;
    let match;
    while ((match = contextRegex.exec(code)) !== null) {
      contexts.push(match[1].trim());
    }
    return contexts;
  }

  /**
   * Extract patterns
   */
  private extractPatterns(code: string, file: string): ReactPattern[] {
    const patterns: ReactPattern[] = [];

    // Custom hooks pattern
    const customHookRegex = /(?:export\s+)?(?:const|function)\s+(use[A-Z]\w+)/g;
    let match;
    while ((match = customHookRegex.exec(code)) !== null) {
      patterns.push({
        type: 'custom-hook',
        name: match[1],
        file: path.basename(file),
        usage: [],
      });
    }

    // HOC pattern
    if (/\([A-Z]\w+\)\s*=>/.test(code)) {
      patterns.push({
        type: 'hoc',
        name: 'Higher Order Component',
        file: path.basename(file),
        usage: [],
      });
    }

    return patterns;
  }

  /**
   * Extract component props
   */
  private extractProps(code: string, startIndex: number): string[] {
    // Find props interface/type
    const propsMatch = code.substring(startIndex).match(/:\s*\{([^}]+)\}/);
    if (propsMatch) {
      return propsMatch[1].split(',').map(p => p.trim().split(':')[0]).filter(Boolean);
    }
    return [];
  }

  /**
   * Generate optimizations
   */
  private generateOptimizations(
    components: ReactAnalysis['components'],
    hooks: string[],
    patterns: ReactPattern[]
  ): ReactAnalysis['optimizations'] {
    const optimizations: ReactAnalysis['optimizations'] = [];

    // Check for missing memoization
    const componentsWithExpensiveOps = components.filter(c => 
      c.hooks.some(h => ['useMemo', 'useCallback'].includes(h)) === false &&
      c.hooks.length > 3
    );

    if (componentsWithExpensiveOps.length > 0) {
      optimizations.push({
        type: 'memoization',
        suggestion: 'Add useMemo/useCallback for expensive operations',
        impact: 'Reduces unnecessary re-renders',
      });
    }

    // Check for prop drilling
    const componentsWithoutContext = components.filter(c => 
      !c.hooks.includes('useContext') && c.props.length > 3
    );

    if (componentsWithoutContext.length > 5) {
      optimizations.push({
        type: 'context',
        suggestion: 'Consider using Context API for prop drilling',
        impact: 'Reduces prop passing complexity',
      });
    }

    return optimizations;
  }

  /**
   * Find React files
   */
  private async findReactFiles(dir: string): Promise<string[]> {
    const files: string[] = [];
    try {
      const items = await fs.promises.readdir(dir, { withFileTypes: true });
      for (const item of items) {
        const fullPath = path.join(dir, item.name);
        if (item.isDirectory() && !this.shouldIgnore(item.name)) {
          files.push(...await this.findReactFiles(fullPath));
        } else if (item.isFile() && /\.(tsx|jsx)$/.test(item.name)) {
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

export const reactAdapter = new ReactAdapter();

