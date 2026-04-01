/**
 * Pattern Library
 * 
 * Community-contributed code patterns and templates
 */

import * as fs from 'fs';
import * as path from 'path';

export interface CodePattern {
  id: string;
  name: string;
  description: string;
  category: 'component' | 'hook' | 'utility' | 'api' | 'state' | 'routing' | 'auth' | 'data';
  language: 'typescript' | 'javascript' | 'python' | 'rust' | 'go';
  code: string;
  tags: string[];
  author?: string;
  rating?: number;
  usageCount?: number;
  examples?: string[];
}

export interface PatternSearchOptions {
  category?: string;
  language?: string;
  tags?: string[];
  query?: string;
}

class PatternLibrary {
  private patterns: Map<string, CodePattern> = new Map();
  private patternsDir = '.guardrail-patterns';

  constructor() {
    this.loadPatterns();
  }

  /**
   * Add a pattern to the library
   */
  async addPattern(pattern: CodePattern): Promise<void> {
    this.patterns.set(pattern.id, pattern);
    await this.savePattern(pattern);
  }

  /**
   * Search patterns
   */
  search(options: PatternSearchOptions): CodePattern[] {
    let results = Array.from(this.patterns.values());

    if (options.category) {
      results = results.filter(p => p.category === options.category);
    }

    if (options.language) {
      results = results.filter(p => p.language === options.language);
    }

    if (options.tags && options.tags.length > 0) {
      results = results.filter(p =>
        options.tags!.some(tag => p.tags.includes(tag))
      );
    }

    if (options.query) {
      const query = options.query.toLowerCase();
      results = results.filter(p =>
        p.name.toLowerCase().includes(query) ||
        p.description.toLowerCase().includes(query) ||
        p.tags.some(tag => tag.toLowerCase().includes(query))
      );
    }

    // Sort by rating and usage
    results.sort((a, b) => {
      const aScore = (a.rating || 0) * (a.usageCount || 0);
      const bScore = (b.rating || 0) * (b.usageCount || 0);
      return bScore - aScore;
    });

    return results;
  }

  /**
   * Get pattern by ID
   */
  getPattern(id: string): CodePattern | undefined {
    return this.patterns.get(id);
  }

  /**
   * Get patterns by category
   */
  getByCategory(category: string): CodePattern[] {
    return Array.from(this.patterns.values())
      .filter(p => p.category === category);
  }

  /**
   * Get popular patterns
   */
  getPopular(limit: number = 10): CodePattern[] {
    return Array.from(this.patterns.values())
      .sort((a, b) => (b.usageCount || 0) - (a.usageCount || 0))
      .slice(0, limit);
  }

  /**
   * Increment usage count
   */
  async incrementUsage(id: string): Promise<void> {
    const pattern = this.patterns.get(id);
    if (pattern) {
      pattern.usageCount = (pattern.usageCount || 0) + 1;
      await this.savePattern(pattern);
    }
  }

  /**
   * Rate a pattern
   */
  async ratePattern(id: string, rating: number): Promise<void> {
    const pattern = this.patterns.get(id);
    if (pattern) {
      // Simple average (in production, use proper rating system)
      pattern.rating = pattern.rating
        ? (pattern.rating + rating) / 2
        : rating;
      await this.savePattern(pattern);
    }
  }

  /**
   * Load default patterns
   */
  private loadDefaultPatterns(): void {
    const defaultPatterns: CodePattern[] = [
      {
        id: 'error-boundary',
        name: 'React Error Boundary',
        description: 'Error boundary component for React applications',
        category: 'component',
        language: 'typescript',
        code: `import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error('Error caught by boundary:', error, errorInfo);
  }

  render(): ReactNode {
    if (this.state.hasError) {
      return this.props.fallback || <div>Something went wrong</div>;
    }
    return this.props.children;
  }
}`,
        tags: ['react', 'error-handling', 'component'],
        rating: 5,
        usageCount: 0,
      },
      {
        id: 'api-hook',
        name: 'useApi Hook',
        description: 'Custom hook for API calls with loading and error states',
        category: 'hook',
        language: 'typescript',
        code: `import { useState, useEffect } from 'react';

interface UseApiOptions<T> {
  url: string;
  options?: RequestInit;
  immediate?: boolean;
}

export function useApi<T>({ url, options, immediate = true }: UseApiOptions<T>) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(immediate);
  const [error, setError] = useState<Error | null>(null);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(url, options);
      if (!response.ok) throw new Error(response.statusText);
      const result = await response.json();
      setData(result);
    } catch (err) {
      setError(err as Error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (immediate) fetchData();
  }, [url]);

  return { data, loading, error, refetch: fetchData };
}`,
        tags: ['react', 'hook', 'api', 'fetch'],
        rating: 4.5,
        usageCount: 0,
      },
    ];

    defaultPatterns.forEach(pattern => {
      this.patterns.set(pattern.id, pattern);
    });
  }

  /**
   * Load patterns from disk
   */
  private async loadPatterns(): Promise<void> {
    // Load default patterns first
    this.loadDefaultPatterns();

    // Load custom patterns
    const patternsPath = path.join(process.cwd(), this.patternsDir);
    if (await this.pathExists(patternsPath)) {
      try {
        const files = await fs.promises.readdir(patternsPath);
        for (const file of files) {
          if (file.endsWith('.json')) {
            const content = await fs.promises.readFile(
              path.join(patternsPath, file),
              'utf8'
            );
            const pattern: CodePattern = JSON.parse(content);
            this.patterns.set(pattern.id, pattern);
          }
        }
      } catch {
        // Error loading patterns
      }
    }
  }

  /**
   * Save pattern to disk
   */
  private async savePattern(pattern: CodePattern): Promise<void> {
    const patternsPath = path.join(process.cwd(), this.patternsDir);
    await fs.promises.mkdir(patternsPath, { recursive: true });

    const filePath = path.join(patternsPath, `${pattern.id}.json`);
    await fs.promises.writeFile(
      filePath,
      JSON.stringify(pattern, null, 2)
    );
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

export const patternLibrary = new PatternLibrary();

