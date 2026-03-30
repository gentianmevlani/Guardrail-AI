/**
 * Semantic Code Search
 * 
 * Understands code meaning, not just text matching
 * Uses embeddings and vector search for intelligent code discovery
 */

import * as fs from 'fs';
import * as path from 'path';
import { codebaseKnowledgeBase } from './codebase-knowledge';

export interface CodeSnippet {
  file: string;
  code: string;
  startLine: number;
  endLine: number;
  context: string;
  embedding?: number[];
}

export interface SemanticSearchResult {
  snippet: CodeSnippet;
  similarity: number;
  reason: string;
}

class SemanticCodeSearch {
  private snippets: CodeSnippet[] = [];
  private embeddings: Map<string, number[]> = new Map();

  /**
   * Index codebase for semantic search
   */
  async indexCodebase(projectPath: string): Promise<void> {
    console.log('🔍 Indexing codebase for semantic search...');
    
    const files = await this.findCodeFiles(projectPath);
    this.snippets = [];

    for (const file of files) {
      try {
        const content = await fs.promises.readFile(file, 'utf8');
        const snippets = this.extractSnippets(file, content, projectPath);
        this.snippets.push(...snippets);
      } catch (error) {
        // Failed to read file - skip and continue with other files
      }
    }

    console.log(`✅ Indexed ${this.snippets.length} code snippets`);
  }

  /**
   * Extract meaningful code snippets
   */
  private extractSnippets(
    file: string,
    content: string,
    projectPath: string
  ): CodeSnippet[] {
    const snippets: CodeSnippet[] = [];
    const lines = content.split('\n');
    const relativePath = path.relative(projectPath, file);

    // Extract functions, classes, components
    const functionRegex = /(?:export\s+)?(?:async\s+)?function\s+(\w+)/g;
    const classRegex = /(?:export\s+)?class\s+(\w+)/g;
    const componentRegex = /(?:export\s+)?(?:const|function)\s+(\w+)\s*[:=]\s*(?:\(|React\.FC|React\.Component)/g;

    let match;
    const functions: Array<{ name: string; start: number }> = [];

    // Find functions
    while ((match = functionRegex.exec(content)) !== null) {
      const lineNum = content.substring(0, match.index).split('\n').length;
      functions.push({ name: match[1], start: lineNum });
    }

    // Find classes
    while ((match = classRegex.exec(content)) !== null) {
      const lineNum = content.substring(0, match.index).split('\n').length;
      functions.push({ name: match[1], start: lineNum });
    }

    // Find components
    while ((match = componentRegex.exec(content)) !== null) {
      const lineNum = content.substring(0, match.index).split('\n').length;
      functions.push({ name: match[1], start: lineNum });
    }

    // Extract snippets around functions
    for (const func of functions) {
      const startLine = Math.max(0, func.start - 5);
      const endLine = Math.min(lines.length - 1, func.start + 30);
      
      const snippetCode = lines.slice(startLine, endLine).join('\n');
      const context = this.extractContext(snippetCode, func.name);

      snippets.push({
        file: relativePath,
        code: snippetCode,
        startLine: startLine + 1,
        endLine: endLine + 1,
        context,
      });
    }

    return snippets;
  }

  /**
   * Extract semantic context from code
   */
  private extractContext(code: string, name: string): string {
    // Extract comments, types, parameters
    const comments = code.match(/\/\*\*[\s\S]*?\*\//g) || [];
    const params = code.match(/(?:\(|,)\s*(\w+):\s*([^,)]+)/g) || [];
    const returns = code.match(/:\s*([^{=]+)/g) || [];

    let context = `Function: ${name}\n`;
    
    if (comments.length > 0) {
      context += `Description: ${comments[0].replace(/\/\*\*|\*\//g, '').trim()}\n`;
    }

    if (params.length > 0) {
      context += `Parameters: ${params.slice(0, 3).join(', ')}\n`;
    }

    return context;
  }

  /**
   * Generate embedding using embedding service
   */
  private async generateEmbedding(text: string): Promise<number[]> {
    // Use embedding service (supports OpenAI, Cohere, or local fallback)
    const { embeddingService } = await import('./embedding-service');
    return await embeddingService.generateEmbedding(text, {
      cache: true,
    });
  }

  private simpleHash(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = ((hash << 5) - hash) + str.charCodeAt(i);
      hash = hash & hash;
    }
    return Math.abs(hash);
  }

  /**
   * Semantic search
   */
  async search(
    query: string,
    projectPath: string,
    limit: number = 5
  ): Promise<SemanticSearchResult[]> {
    if (this.snippets.length === 0) {
      await this.indexCodebase(projectPath);
    }

    const queryEmbedding = await this.generateEmbedding(query);
    const results: SemanticSearchResult[] = [];

    for (const snippet of this.snippets) {
      if (!snippet.embedding) {
        snippet.embedding = await this.generateEmbedding(snippet.code + ' ' + snippet.context);
      }

      const similarity = this.cosineSimilarity(queryEmbedding, snippet.embedding);
      
      if (similarity > 0.1) { // Threshold
        results.push({
          snippet,
          similarity,
          reason: this.explainMatch(query, snippet),
        });
      }
    }

    // Sort by similarity
    results.sort((a, b) => b.similarity - a.similarity);

    return results.slice(0, limit);
  }

  /**
   * Calculate cosine similarity
   */
  private cosineSimilarity(a: number[], b: number[]): number {
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }

    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }

  /**
   * Explain why a snippet matches
   */
  private explainMatch(query: string, snippet: CodeSnippet): string {
    const queryWords = query.toLowerCase().split(/\s+/);
    const codeLower = snippet.code.toLowerCase();
    const contextLower = snippet.context.toLowerCase();

    const matches: string[] = [];

    queryWords.forEach(word => {
      if (codeLower.includes(word)) {
        matches.push(`contains "${word}"`);
      }
      if (contextLower.includes(word)) {
        matches.push(`context mentions "${word}"`);
      }
    });

    if (matches.length === 0) {
      return 'semantic similarity';
    }

    return matches.slice(0, 2).join(' and ');
  }

  /**
   * Find similar code patterns
   */
  async findSimilar(
    file: string,
    projectPath: string,
    limit: number = 3
  ): Promise<SemanticSearchResult[]> {
    if (this.snippets.length === 0) {
      await this.indexCodebase(projectPath);
    }

    const targetSnippet = this.snippets.find(s => s.file === file);
    if (!targetSnippet) {
      return [];
    }

    if (!targetSnippet.embedding) {
      targetSnippet.embedding = await this.generateEmbedding(targetSnippet.code + ' ' + targetSnippet.context);
    }

    const results: SemanticSearchResult[] = [];

    for (const snippet of this.snippets) {
      if (snippet.file === file) continue; // Skip self

      if (!snippet.embedding) {
        snippet.embedding = await this.generateEmbedding(snippet.code + ' ' + snippet.context);
      }

      const similarity = this.cosineSimilarity(targetSnippet.embedding, snippet.embedding);
      
      if (similarity > 0.3) {
        results.push({
          snippet,
          similarity,
          reason: 'similar code pattern',
        });
      }
    }

    results.sort((a, b) => b.similarity - a.similarity);
    return results.slice(0, limit);
  }

  // Helper methods
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
    } catch (error) {
      // Failed to read directory - return files found so far
    }
    return files;
  }

  private shouldIgnore(name: string): boolean {
    return ['node_modules', '.git', 'dist', 'build', '.next', 'coverage'].includes(name);
  }
}

export const semanticCodeSearch = new SemanticCodeSearch();

