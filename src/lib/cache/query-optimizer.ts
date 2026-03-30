import { redisCache } from './redis-cache-manager';
import { performance } from 'perf_hooks';

export interface QueryPlan {
  query: string;
  params?: any;
  cacheKey: string;
  cacheStrategy: 'aggressive' | 'moderate' | 'minimal';
  priority: 'low' | 'medium' | 'high';
  estimatedCost: number;
}

export interface OptimizationResult {
  originalQuery: string;
  optimizedQuery: string;
  improvements: string[];
  performanceGain: number;
}

export class QueryOptimizer {
  private queryHistory: Map<string, { count: number; avgTime: number }> = new Map();
  private readonly optimizationThreshold = 100;

  async executeWithOptimization<T>(
    query: string,
    executor: () => Promise<T>,
    options: {
      cacheStrategy?: 'aggressive' | 'moderate' | 'minimal';
      priority?: 'low' | 'medium' | 'high';
      ttl?: number;
      tags?: string[];
    } = {}
  ): Promise<T> {
    const startTime = performance.now();
    const {
      cacheStrategy = 'moderate',
      priority = 'medium',
      ttl = this.getTTLOnStrategy(cacheStrategy),
      tags = [],
    } = options;

    const optimizedQuery = this.optimizeQuery(query);
    
    const cached = await redisCache.get<T>(optimizedQuery);
    if (cached) {
      return cached;
    }

    const result = await executor();
    
    await redisCache.set(optimizedQuery, result, {
      ttl,
      tags: [...tags, cacheStrategy, priority],
      priority,
      compress: cacheStrategy === 'aggressive',
    });

    const endTime = performance.now();
    const executionTime = endTime - startTime;
    
    this.updateQueryHistory(query, executionTime);

    if (executionTime > this.optimizationThreshold) {
      await this.suggestFurtherOptimizations(query, executionTime);
    }

    return result;
  }

  private optimizeQuery(query: string): string {
    let optimized = query;

    optimized = this.removeRedundantWhitespace(optimized);
    optimized = this.optimizeSelectStatements(optimized);
    optimized = this.optimizeJoinOrder(optimized);
    optimized = this.addQueryHints(optimized);

    return optimized;
  }

  private removeRedundantWhitespace(query: string): string {
    return query.replace(/\s+/g, ' ').trim();
  }

  private optimizeSelectStatements(query: string): string {
    if (query.toUpperCase().includes('SELECT *')) {
      console.warn('Consider specifying explicit columns instead of SELECT *');
    }
    
    if (query.toUpperCase().includes('SELECT DISTINCT') && 
        !query.toUpperCase().includes('ORDER BY')) {
      console.warn('DISTINCT without ORDER BY may be inefficient');
    }

    return query;
  }

  private optimizeJoinOrder(query: string): string {
    const joinRegex = /JOIN\s+(\w+)\s+ON/gi;
    const joins: string[] = [];
    let match;

    while ((match = joinRegex.exec(query)) !== null) {
      joins.push(match[1]);
    }

    if (joins.length > 3) {
      console.warn(`Query has ${joins.length} joins. Consider breaking into smaller queries`);
    }

    return query;
  }

  private addQueryHints(query: string): string {
    if (query.toUpperCase().includes('WHERE') && 
        !query.toUpperCase().includes('INDEX')) {
      console.info('Consider adding index hints for WHERE clauses');
    }

    return query;
  }

  private getTTLOnStrategy(strategy: 'aggressive' | 'moderate' | 'minimal'): number {
    switch (strategy) {
      case 'aggressive':
        return 7200;
      case 'moderate':
        return 3600;
      case 'minimal':
        return 300;
      default:
        return 3600;
    }
  }

  private updateQueryHistory(query: string, executionTime: number): void {
    const key = this.createQuerySignature(query);
    const current = this.queryHistory.get(key) || { count: 0, avgTime: 0 };
    
    const newCount = current.count + 1;
    const newAvgTime = (current.avgTime * current.count + executionTime) / newCount;
    
    this.queryHistory.set(key, { count: newCount, avgTime: newAvgTime });
  }

  private createQuerySignature(query: string): string {
    return query
      .replace(/\d+/g, '?')
      .replace(/'[^']*'/g, '?')
      .replace(/\s+/g, ' ')
      .trim()
      .toLowerCase();
  }

  private async suggestFurtherOptimizations(query: string, executionTime: number): Promise<void> {
    const suggestions: string[] = [];

    if (executionTime > 1000) {
      suggestions.push('Query took over 1 second - consider adding indexes');
    }

    if (query.toUpperCase().split('JOIN').length > 4) {
      suggestions.push('Too many joins - consider query decomposition');
    }

    if (query.toUpperCase().includes('LIKE %')) {
      suggestions.push('Leading wildcard LIKE queries cannot use indexes');
    }

    if (query.toUpperCase().includes('OR') && !query.toUpperCase().includes('UNION')) {
      suggestions.push('Consider using UNION instead of OR for better index usage');
    }

    if (suggestions.length > 0) {
      console.warn('Query optimization suggestions:', suggestions);
    }
  }

  async analyzeAndOptimizeBatch(queries: string[]): Promise<OptimizationResult[]> {
    const results: OptimizationResult[] = [];

    for (const query of queries) {
      const optimized = this.optimizeQuery(query);
      const improvements = this.compareQueries(query, optimized);
      
      results.push({
        originalQuery: query,
        optimizedQuery: optimized,
        improvements,
        performanceGain: this.estimatePerformanceGain(improvements),
      });
    }

    return results;
  }

  private compareQueries(original: string, optimized: string): string[] {
    const improvements: string[] = [];

    if (original.length !== optimized.length) {
      improvements.push('Reduced query size');
    }

    if (this.countJoins(original) > this.countJoins(optimized)) {
      improvements.push('Optimized join structure');
    }

    if (this.hasSubqueries(original) && !this.hasSubqueries(optimized)) {
      improvements.push('Eliminated subqueries');
    }

    return improvements;
  }

  private countJoins(query: string): number {
    return (query.match(/JOIN/gi) || []).length;
  }

  private hasSubqueries(query: string): boolean {
    return /\(SELECT.*?\)/i.test(query);
  }

  private estimatePerformanceGain(improvements: string[]): number {
    let gain = 0;
    
    improvements.forEach(improvement => {
      switch (improvement) {
        case 'Reduced query size':
          gain += 5;
          break;
        case 'Optimized join structure':
          gain += 20;
          break;
        case 'Eliminated subqueries':
          gain += 15;
          break;
        default:
          gain += 2;
      }
    });

    return gain;
  }

  createIndex(): QueryIndexManager {
    return new QueryIndexManager();
  }

  async getOptimizationReport(): Promise<{
    totalQueries: number;
    averageExecutionTime: number;
    slowQueriesCount: number;
    optimizationSuggestions: string[];
  }> {
    const stats = await redisCache.getCacheStats();
    const slowQueries = await redisCache.getSlowQueries();
    
    return {
      totalQueries: stats.totalQueries,
      averageExecutionTime: stats.averageResponseTime,
      slowQueriesCount: slowQueries.length,
      optimizationSuggestions: await this.generateOptimizationSuggestions(),
    };
  }

  private async generateOptimizationSuggestions(): Promise<string[]> {
    const suggestions: string[] = [];
    const stats = await redisCache.getCacheStats();
    
    if (stats.hitRate < 70) {
      suggestions.push('Increase cache TTL for frequently accessed data');
    }

    if (stats.averageResponseTime > 200) {
      suggestions.push('Review and optimize slow queries');
    }

    const frequentQueries = Array.from(this.queryHistory.entries())
      .filter(([, data]) => data.count > 10)
      .sort(([, a], [, b]) => b.count - a.count);

    if (frequentQueries.length > 0) {
      suggestions.push(`${frequentQueries.length} queries executed frequently - consider caching`);
    }

    return suggestions;
  }
}

export class QueryIndexManager {
  private indexSuggestions: Map<string, string[]> = new Map();

  suggestIndexes(query: string): string[] {
    const suggestions: string[] = [];
    const tables = this.extractTables(query);
    const whereColumns = this.extractWhereColumns(query);
    const joinColumns = this.extractJoinColumns(query);
    const orderColumns = this.extractOrderColumns(query);

    tables.forEach(table => {
      const tableSuggestions: string[] = [];
      
      whereColumns.forEach(col => {
        tableSuggestions.push(`CREATE INDEX idx_${table}_${col} ON ${table}(${col})`);
      });

      joinColumns.forEach(col => {
        tableSuggestions.push(`CREATE INDEX idx_${table}_${col} ON ${table}(${col})`);
      });

      if (orderColumns.length > 0) {
        const compositeIndex = `CREATE INDEX idx_${table}_order ON ${table}(${orderColumns.join(', ')})`;
        tableSuggestions.push(compositeIndex);
      }

      if (tableSuggestions.length > 0) {
        suggestions.push(...tableSuggestions);
        this.indexSuggestions.set(table, tableSuggestions);
      }
    });

    return suggestions;
  }

  private extractTables(query: string): string[] {
    const fromRegex = /FROM\s+(\w+)/gi;
    const joinRegex = /JOIN\s+(\w+)/gi;
    const tables: string[] = [];
    
    let match;
    while ((match = fromRegex.exec(query)) !== null) {
      tables.push(match[1]);
    }
    
    while ((match = joinRegex.exec(query)) !== null) {
      tables.push(match[1]);
    }
    
    return [...new Set(tables)];
  }

  private extractWhereColumns(query: string): string[] {
    const whereRegex = /WHERE\s+([\s\S]*?)(?:GROUP BY|ORDER BY|LIMIT|$)/i;
    const match = whereRegex.exec(query);
    
    if (!match) return [];
    
    const whereClause = match[1];
    const columnRegex = /(\w+)\s*(?:=|!=|>|<|>=|<=|LIKE|IN)/gi;
    const columns: string[] = [];
    
    let columnMatch;
    while ((columnMatch = columnRegex.exec(whereClause)) !== null) {
      columns.push(columnMatch[1]);
    }
    
    return [...new Set(columns)];
  }

  private extractJoinColumns(query: string): string[] {
    const joinRegex = /ON\s+(\w+)\.(\w+)\s*=\s*(\w+)\.(\w+)/gi;
    const columns: string[] = [];
    
    let match;
    while ((match = joinRegex.exec(query)) !== null) {
      columns.push(match[2], match[4]);
    }
    
    return [...new Set(columns)];
  }

  private extractOrderColumns(query: string): string[] {
    const orderRegex = /ORDER BY\s+([\s\S]*?)(?:LIMIT|$)/i;
    const match = orderRegex.exec(query);
    
    if (!match) return [];
    
    const orderClause = match[1];
    return orderClause
      .split(',')
      .map(col => col.trim().split(' ')[0])
      .filter(col => col.length > 0);
  }

  getIndexSuggestions(): Map<string, string[]> {
    return this.indexSuggestions;
  }
}

export const queryOptimizer = new QueryOptimizer();
