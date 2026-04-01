/**
 * Natural Language Code Search
 * 
 * Revolutionary feature: Search your codebase by describing what the code does,
 * not by keywords. Uses semantic understanding to find relevant code.
 * 
 * Example: "function that validates email addresses" finds all email validation logic
 * even if it doesn't contain the word "email" or "validate"
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { embeddingService } from './embedding-service';

interface SearchResult {
  file: string;
  content: string;
  lineStart: number;
  lineEnd: number;
  similarity: number;
  functionName?: string;
  description: string;
}

interface CodeBlock {
  file: string;
  content: string;
  lineStart: number;
  lineEnd: number;
  functionName?: string;
  type: 'function' | 'class' | 'method' | 'component' | 'block';
}

class NaturalLanguageSearch {
  private codeBlocks: CodeBlock[] = [];
  private embeddings: Map<string, number[]> = new Map();
  private initialized = false;

  /**
   * Index a codebase for natural language search
   */
  async indexCodebase(projectPath: string): Promise<void> {
    console.log('🔍 Indexing codebase for natural language search...');
    
    this.codeBlocks = [];
    this.embeddings.clear();

    const files = await this.getAllFiles(projectPath);
    
    for (const file of files) {
      try {
        const content = await fs.readFile(file, 'utf-8');
        const blocks = this.extractCodeBlocks(file, content);
        this.codeBlocks.push(...blocks);
      } catch (error) {
        console.warn(`Failed to process ${file}:`, error);
      }
    }

    // Generate embeddings for all code blocks
    console.log(`📦 Generating embeddings for ${this.codeBlocks.length} code blocks...`);
    
    for (const block of this.codeBlocks) {
      const key = `${block.file}:${block.lineStart}`;
      const description = this.generateBlockDescription(block);
      const embedding = await embeddingService.generateEmbedding(description);
      this.embeddings.set(key, embedding);
    }

    this.initialized = true;
    console.log('✅ Codebase indexed successfully!');
  }

  /**
   * Search codebase using natural language description
   */
  async search(query: string, limit = 10): Promise<SearchResult[]> {
    if (!this.initialized) {
      throw new Error('Codebase not indexed. Call indexCodebase() first.');
    }

    // Generate embedding for the query
    const queryEmbedding = await embeddingService.generateEmbedding(query);

    // Calculate similarity with all code blocks
    const results: SearchResult[] = [];

    for (const block of this.codeBlocks) {
      const key = `${block.file}:${block.lineStart}`;
      const blockEmbedding = this.embeddings.get(key);

      if (!blockEmbedding) continue;

      const similarity = this.cosineSimilarity(queryEmbedding, blockEmbedding);

      if (similarity > 0.5) { // Threshold for relevance
        results.push({
          file: block.file,
          content: block.content,
          lineStart: block.lineStart,
          lineEnd: block.lineEnd,
          similarity,
          functionName: block.functionName,
          description: this.generateBlockDescription(block),
        });
      }
    }

    // Sort by similarity and return top results
    return results
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, limit);
  }

  /**
   * Search with context-aware ranking
   */
  async searchWithContext(
    query: string,
    context: {
      currentFile?: string;
      recentFiles?: string[];
      technologies?: string[];
    },
    limit = 10
  ): Promise<SearchResult[]> {
    const baseResults = await this.search(query, limit * 2);

    // Boost results based on context
    const boostedResults = baseResults.map(result => {
      let boost = 1.0;

      // Boost results from current file
      if (context.currentFile && result.file === context.currentFile) {
        boost *= 1.3;
      }

      // Boost results from recently viewed files
      if (context.recentFiles?.includes(result.file)) {
        boost *= 1.2;
      }

      // Boost results matching current technologies
      if (context.technologies) {
        for (const tech of context.technologies) {
          if (result.file.includes(tech) || result.content.includes(tech)) {
            boost *= 1.1;
          }
        }
      }

      return {
        ...result,
        similarity: result.similarity * boost,
      };
    });

    return boostedResults
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, limit);
  }

  /**
   * Find similar code to a given snippet
   */
  async findSimilarCode(codeSnippet: string, limit = 10): Promise<SearchResult[]> {
    const embedding = await embeddingService.generateEmbedding(codeSnippet);

    const results: SearchResult[] = [];

    for (const block of this.codeBlocks) {
      const key = `${block.file}:${block.lineStart}`;
      const blockEmbedding = this.embeddings.get(key);

      if (!blockEmbedding) continue;

      const similarity = this.cosineSimilarity(embedding, blockEmbedding);

      if (similarity > 0.6) { // Higher threshold for code similarity
        results.push({
          file: block.file,
          content: block.content,
          lineStart: block.lineStart,
          lineEnd: block.lineEnd,
          similarity,
          functionName: block.functionName,
          description: this.generateBlockDescription(block),
        });
      }
    }

    return results
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, limit);
  }

  /**
   * Extract meaningful code blocks from a file
   */
  private extractCodeBlocks(file: string, content: string): CodeBlock[] {
    const blocks: CodeBlock[] = [];
    const lines = content.split('\n');

    let currentBlock: string[] = [];
    let blockStart = 0;
    let inBlock = false;
    let functionName: string | undefined;
    let blockType: CodeBlock['type'] = 'block';

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmed = line.trim();

      // Detect start of function/class/method
      if (this.isBlockStart(trimmed)) {
        if (inBlock && currentBlock.length > 0) {
          // Save previous block
          blocks.push({
            file,
            content: currentBlock.join('\n'),
            lineStart: blockStart,
            lineEnd: i - 1,
            functionName,
            type: blockType,
          });
        }

        currentBlock = [line];
        blockStart = i;
        inBlock = true;
        functionName = this.extractFunctionName(trimmed);
        blockType = this.detectBlockType(trimmed);
      } else if (inBlock) {
        currentBlock.push(line);

        // End block at closing brace (simplified)
        if (trimmed === '}' && this.isBlockEnd(currentBlock)) {
          blocks.push({
            file,
            content: currentBlock.join('\n'),
            lineStart: blockStart,
            lineEnd: i,
            functionName,
            type: blockType,
          });

          currentBlock = [];
          inBlock = false;
          functionName = undefined;
        }
      }
    }

    // Add remaining block if any
    if (inBlock && currentBlock.length > 0) {
      blocks.push({
        file,
        content: currentBlock.join('\n'),
        lineStart: blockStart,
        lineEnd: lines.length - 1,
        functionName,
        type: blockType,
      });
    }

    return blocks;
  }

  /**
   * Check if line starts a code block
   */
  private isBlockStart(line: string): boolean {
    return (
      /^(function|const|let|var)\s+\w+\s*=/.test(line) ||
      /^(export\s+)?(async\s+)?function\s+/.test(line) ||
      /^(export\s+)?class\s+/.test(line) ||
      /^(public|private|protected)\s+\w+\s*\(/.test(line) ||
      /^const\s+\w+\s*=\s*\(.*\)\s*=>/.test(line)
    );
  }

  /**
   * Check if block should end
   */
  private isBlockEnd(block: string[]): boolean {
    const openBraces = block.filter(l => l.includes('{')).length;
    const closeBraces = block.filter(l => l.includes('}')).length;
    return openBraces === closeBraces;
  }

  /**
   * Extract function name from line
   */
  private extractFunctionName(line: string): string | undefined {
    const patterns = [
      /function\s+(\w+)/,
      /const\s+(\w+)\s*=/,
      /let\s+(\w+)\s*=/,
      /class\s+(\w+)/,
      /(public|private|protected)\s+(\w+)\s*\(/,
    ];

    for (const pattern of patterns) {
      const match = line.match(pattern);
      if (match) {
        return match[match.length - 1];
      }
    }

    return undefined;
  }

  /**
   * Detect block type
   */
  private detectBlockType(line: string): CodeBlock['type'] {
    if (line.includes('class ')) return 'class';
    if (line.includes('function ')) return 'function';
    if (line.includes('=>')) return 'function';
    if (/(public|private|protected)/.test(line)) return 'method';
    if (line.includes('const') && line.includes('=') && line.includes('=>')) return 'component';
    return 'block';
  }

  /**
   * Generate human-readable description of code block
   */
  private generateBlockDescription(block: CodeBlock): string {
    const parts: string[] = [];

    if (block.functionName) {
      parts.push(`${block.type} "${block.functionName}"`);
    } else {
      parts.push(block.type);
    }

    // Extract comments from the block
    const comments = this.extractComments(block.content);
    if (comments.length > 0) {
      parts.push(comments.join(' '));
    }

    // Add first few non-comment lines for context
    const codeLines = block.content
      .split('\n')
      .filter(l => !l.trim().startsWith('//') && !l.trim().startsWith('/*'))
      .slice(0, 3)
      .map(l => l.trim())
      .filter(l => l.length > 0);

    if (codeLines.length > 0) {
      parts.push(codeLines.join(' '));
    }

    return parts.join(' - ');
  }

  /**
   * Extract comments from code
   */
  private extractComments(content: string): string[] {
    const comments: string[] = [];
    const lines = content.split('\n');

    for (const line of lines) {
      const trimmed = line.trim();
      
      // Single-line comment
      if (trimmed.startsWith('//')) {
        comments.push(trimmed.replace(/^\/\/\s*/, ''));
      }
      
      // Multi-line comment (simplified)
      if (trimmed.startsWith('/*') || trimmed.startsWith('*')) {
        comments.push(trimmed.replace(/^\/?\*+\s*/, '').replace(/\*\/$/, ''));
      }
    }

    return comments;
  }

  /**
   * Calculate cosine similarity between two vectors
   */
  private cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) return 0;

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }

    if (normA === 0 || normB === 0) return 0;

    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }

  /**
   * Get all code files in directory
   */
  private async getAllFiles(dir: string): Promise<string[]> {
    const files: string[] = [];
    const entries = await fs.readdir(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);

      // Skip common directories
      if (entry.isDirectory()) {
        if (['node_modules', '.git', 'dist', 'build', 'coverage'].includes(entry.name)) {
          continue;
        }
        const subFiles = await this.getAllFiles(fullPath);
        files.push(...subFiles);
      } else if (entry.isFile() && this.isCodeFile(entry.name)) {
        files.push(fullPath);
      }
    }

    return files;
  }

  /**
   * Check if file is a code file
   */
  private isCodeFile(filename: string): boolean {
    const extensions = ['.ts', '.tsx', '.js', '.jsx', '.py', '.java', '.go', '.rs', '.cpp', '.c', '.cs'];
    return extensions.some(ext => filename.endsWith(ext));
  }

  /**
   * Get statistics about indexed codebase
   */
  getStats() {
    const stats = {
      totalBlocks: this.codeBlocks.length,
      byType: {} as Record<string, number>,
      byFile: {} as Record<string, number>,
    };

    for (const block of this.codeBlocks) {
      stats.byType[block.type] = (stats.byType[block.type] || 0) + 1;
      stats.byFile[block.file] = (stats.byFile[block.file] || 0) + 1;
    }

    return stats;
  }
}

export const naturalLanguageSearch = new NaturalLanguageSearch();
export default naturalLanguageSearch;
