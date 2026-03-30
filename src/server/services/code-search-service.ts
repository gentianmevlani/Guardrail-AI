/**
 * Code Search Service
 * 
 * Real implementation for natural language code search.
 * Indexes code files and searches using semantic matching.
 */

import * as fs from 'fs/promises';
import * as path from 'path';

export interface SearchResult {
  file: string;
  content: string;
  lineStart: number;
  lineEnd: number;
  similarity: number;
  functionName?: string;
  description: string;
  preview: string;
}

export interface CodeBlock {
  file: string;
  content: string;
  lineStart: number;
  lineEnd: number;
  functionName?: string;
  type: 'function' | 'class' | 'method' | 'component' | 'block';
}

export interface IndexStats {
  totalFiles: number;
  totalBlocks: number;
  languages: Record<string, number>;
  indexedAt: string;
}

class CodeSearchService {
  private codeBlocks: CodeBlock[] = [];
  private indexedDirectory: string | null = null;
  private indexStats: IndexStats | null = null;

  private excludedDirs = [
    'node_modules',
    '.git',
    '.next',
    'dist',
    'build',
    'coverage',
    '__pycache__',
    '.cache',
  ];

  private languageExtensions: Record<string, string> = {
    '.ts': 'TypeScript',
    '.tsx': 'TypeScript',
    '.js': 'JavaScript',
    '.jsx': 'JavaScript',
    '.py': 'Python',
    '.go': 'Go',
    '.rs': 'Rust',
    '.java': 'Java',
    '.rb': 'Ruby',
    '.php': 'PHP',
    '.vue': 'Vue',
    '.svelte': 'Svelte',
    '.cpp': 'C++',
    '.c': 'C',
    '.cs': 'C#',
  };

  /**
   * Index a codebase for searching
   */
  async indexCodebase(directory: string): Promise<IndexStats> {
    console.log('🔍 Indexing codebase for search...');
    
    this.codeBlocks = [];
    this.indexedDirectory = directory;
    const languages: Record<string, number> = {};
    let totalFiles = 0;

    const files = await this.getAllFiles(directory);
    
    for (const file of files) {
      try {
        const content = await fs.readFile(file, 'utf-8');
        const blocks = this.extractCodeBlocks(file, content);
        this.codeBlocks.push(...blocks);
        
        // Track language stats
        const ext = path.extname(file);
        const lang = this.languageExtensions[ext] || 'Other';
        languages[lang] = (languages[lang] || 0) + 1;
        totalFiles++;
      } catch (error) {
        console.warn(`Failed to process ${file}:`, error);
      }
    }

    this.indexStats = {
      totalFiles,
      totalBlocks: this.codeBlocks.length,
      languages,
      indexedAt: new Date().toISOString(),
    };

    console.log(`✅ Indexed ${totalFiles} files with ${this.codeBlocks.length} code blocks`);
    
    return this.indexStats;
  }

  /**
   * Search codebase using natural language query
   */
  async search(query: string, limit = 10): Promise<SearchResult[]> {
    if (this.codeBlocks.length === 0) {
      throw new Error('No codebase indexed. Call indexCodebase() first.');
    }

    const queryLower = query.toLowerCase();
    const queryWords = this.tokenize(query);
    const results: SearchResult[] = [];

    for (const block of this.codeBlocks) {
      const similarity = this.calculateSimilarity(queryWords, queryLower, block);
      
      if (similarity > 0.2) { // Threshold for relevance
        results.push({
          file: block.file,
          content: block.content,
          lineStart: block.lineStart,
          lineEnd: block.lineEnd,
          similarity,
          functionName: block.functionName,
          description: this.generateDescription(block),
          preview: this.generatePreview(block.content),
        });
      }
    }

    // Sort by similarity and return top results
    return results
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, limit);
  }

  /**
   * Find similar code to a given snippet
   */
  async findSimilar(codeSnippet: string, limit = 10): Promise<SearchResult[]> {
    if (this.codeBlocks.length === 0) {
      throw new Error('No codebase indexed. Call indexCodebase() first.');
    }

    const snippetWords = this.tokenize(codeSnippet);
    const results: SearchResult[] = [];

    for (const block of this.codeBlocks) {
      const blockWords = this.tokenize(block.content);
      const similarity = this.jaccardSimilarity(snippetWords, blockWords);
      
      if (similarity > 0.3) { // Higher threshold for code similarity
        results.push({
          file: block.file,
          content: block.content,
          lineStart: block.lineStart,
          lineEnd: block.lineEnd,
          similarity,
          functionName: block.functionName,
          description: this.generateDescription(block),
          preview: this.generatePreview(block.content),
        });
      }
    }

    return results
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, limit);
  }

  /**
   * Get indexing statistics
   */
  getStats(): IndexStats | null {
    return this.indexStats;
  }

  /**
   * Calculate similarity between query and code block
   */
  private calculateSimilarity(queryWords: Set<string>, queryLower: string, block: CodeBlock): number {
    const blockContent = block.content.toLowerCase();
    const blockWords = this.tokenize(block.content);
    
    let score = 0;
    
    // 1. Check if query words appear in content
    const wordMatches = this.jaccardSimilarity(queryWords, blockWords);
    score += wordMatches * 0.3;
    
    // 2. Check function/class name match
    if (block.functionName) {
      const nameLower = block.functionName.toLowerCase();
      if (queryLower.includes(nameLower) || nameLower.includes(queryLower.split(' ')[0])) {
        score += 0.3;
      }
    }
    
    // 3. Semantic keyword matching
    const semanticScore = this.semanticMatch(queryLower, blockContent, block.type);
    score += semanticScore * 0.4;
    
    return Math.min(score, 1.0);
  }

  /**
   * Semantic matching based on common patterns
   */
  private semanticMatch(query: string, content: string, blockType: string): number {
    let score = 0;
    
    // Common semantic patterns
    const patterns: Record<string, string[]> = {
      'authentication': ['auth', 'login', 'logout', 'session', 'token', 'jwt', 'password', 'credential'],
      'user': ['user', 'account', 'profile', 'member', 'person'],
      'database': ['database', 'db', 'query', 'sql', 'prisma', 'mongoose', 'model', 'schema'],
      'api': ['api', 'endpoint', 'route', 'request', 'response', 'fetch', 'http'],
      'payment': ['payment', 'stripe', 'transaction', 'checkout', 'billing', 'price'],
      'file': ['file', 'upload', 'download', 'stream', 'buffer', 'read', 'write'],
      'error': ['error', 'exception', 'catch', 'throw', 'handle', 'try'],
      'validation': ['validate', 'check', 'verify', 'sanitize', 'parse'],
      'email': ['email', 'mail', 'smtp', 'send', 'notification'],
      'search': ['search', 'find', 'filter', 'query', 'lookup'],
      'form': ['form', 'input', 'submit', 'field', 'validation'],
      'security': ['security', 'encrypt', 'decrypt', 'hash', 'secure', 'protect'],
      'test': ['test', 'spec', 'expect', 'assert', 'mock', 'describe', 'it'],
      'component': ['component', 'render', 'props', 'state', 'useEffect', 'useState'],
      'hook': ['hook', 'use', 'custom', 'state', 'effect', 'ref', 'memo'],
      'utility': ['util', 'helper', 'format', 'parse', 'convert', 'transform'],
    };

    for (const [concept, keywords] of Object.entries(patterns)) {
      // Check if query relates to this concept
      if (query.includes(concept) || keywords.some(k => query.includes(k))) {
        // Check if content matches this concept
        const matches = keywords.filter(k => content.includes(k)).length;
        if (matches > 0) {
          score += (matches / keywords.length) * 0.5;
        }
      }
    }

    // Boost for matching block type
    if (query.includes('function') && blockType === 'function') score += 0.2;
    if (query.includes('class') && blockType === 'class') score += 0.2;
    if (query.includes('method') && blockType === 'method') score += 0.2;
    if (query.includes('component') && blockType === 'component') score += 0.2;

    return Math.min(score, 1.0);
  }

  /**
   * Jaccard similarity between two sets
   */
  private jaccardSimilarity(set1: Set<string>, set2: Set<string>): number {
    const intersection = new Set([...set1].filter(x => set2.has(x)));
    const union = new Set([...set1, ...set2]);
    
    if (union.size === 0) return 0;
    return intersection.size / union.size;
  }

  /**
   * Tokenize text into words
   */
  private tokenize(text: string): Set<string> {
    const words = text
      .toLowerCase()
      .replace(/[^a-zA-Z0-9]/g, ' ')
      .split(/\s+/)
      .filter(w => w.length > 2);
    
    // Add camelCase/PascalCase split words
    const expanded: string[] = [];
    for (const word of words) {
      expanded.push(word);
      // Split camelCase
      const parts = word.replace(/([a-z])([A-Z])/g, '$1 $2').toLowerCase().split(' ');
      expanded.push(...parts);
    }
    
    return new Set(expanded);
  }

  /**
   * Extract code blocks from file content
   */
  private extractCodeBlocks(file: string, content: string): CodeBlock[] {
    const blocks: CodeBlock[] = [];
    const lines = content.split('\n');

    let currentBlock: string[] = [];
    let blockStart = 0;
    let inBlock = false;
    let functionName: string | undefined;
    let blockType: CodeBlock['type'] = 'block';
    let braceCount = 0;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmed = line.trim();

      // Skip empty lines and comments at top level
      if (!inBlock && (trimmed === '' || trimmed.startsWith('//'))) {
        continue;
      }

      // Detect start of function/class/method
      if (!inBlock && this.isBlockStart(trimmed)) {
        currentBlock = [line];
        blockStart = i;
        inBlock = true;
        functionName = this.extractFunctionName(trimmed);
        blockType = this.detectBlockType(trimmed);
        braceCount = (line.match(/{/g) || []).length - (line.match(/}/g) || []).length;
      } else if (inBlock) {
        currentBlock.push(line);
        braceCount += (line.match(/{/g) || []).length - (line.match(/}/g) || []).length;

        // End block when braces are balanced
        if (braceCount <= 0 || i === lines.length - 1) {
          if (currentBlock.length >= 2) { // Minimum 2 lines
            blocks.push({
              file: path.relative(this.indexedDirectory || '', file),
              content: currentBlock.join('\n'),
              lineStart: blockStart + 1,
              lineEnd: i + 1,
              functionName,
              type: blockType,
            });
          }

          currentBlock = [];
          inBlock = false;
          functionName = undefined;
          braceCount = 0;
        }
      }
    }

    return blocks;
  }

  /**
   * Check if line starts a code block
   */
  private isBlockStart(line: string): boolean {
    return (
      /^(export\s+)?(async\s+)?function\s+\w+/.test(line) ||
      /^(export\s+)?class\s+\w+/.test(line) ||
      /^(export\s+)?(const|let|var)\s+\w+\s*=\s*(async\s+)?\(/.test(line) ||
      /^(export\s+)?(const|let|var)\s+\w+\s*=\s*(async\s+)?function/.test(line) ||
      /^(public|private|protected)\s+(async\s+)?\w+\s*\(/.test(line) ||
      /^(export\s+)?interface\s+\w+/.test(line) ||
      /^(export\s+)?type\s+\w+\s*=/.test(line)
    );
  }

  /**
   * Extract function name from line
   */
  private extractFunctionName(line: string): string | undefined {
    const patterns = [
      /function\s+(\w+)/,
      /class\s+(\w+)/,
      /const\s+(\w+)\s*=/,
      /let\s+(\w+)\s*=/,
      /interface\s+(\w+)/,
      /type\s+(\w+)/,
      /(public|private|protected)\s+(?:async\s+)?(\w+)\s*\(/,
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
    if (/class\s/.test(line)) return 'class';
    if (/function\s/.test(line)) return 'function';
    if (/(public|private|protected)\s/.test(line)) return 'method';
    if (/=\s*\(.*\)\s*=>/.test(line) && /[A-Z]/.test(line.charAt(line.indexOf('const') + 6) || '')) {
      return 'component';
    }
    return 'function';
  }

  /**
   * Generate description for a code block
   */
  private generateDescription(block: CodeBlock): string {
    const parts: string[] = [];

    // Add type and name
    if (block.functionName) {
      parts.push(`${block.type} "${block.functionName}"`);
    } else {
      parts.push(block.type);
    }

    // Extract JSDoc/comments
    const comments = this.extractComments(block.content);
    if (comments.length > 0) {
      parts.push('-', comments[0]);
    }

    return parts.join(' ');
  }

  /**
   * Generate preview of code
   */
  private generatePreview(content: string): string {
    const lines = content.split('\n');
    const previewLines = lines.slice(0, 5).map(l => l.trim()).filter(l => l.length > 0);
    
    if (lines.length > 5) {
      previewLines.push('...');
    }
    
    return previewLines.join('\n');
  }

  /**
   * Extract comments from code
   */
  private extractComments(content: string): string[] {
    const comments: string[] = [];
    const lines = content.split('\n');

    for (const line of lines.slice(0, 5)) { // Only check first few lines
      const trimmed = line.trim();
      
      if (trimmed.startsWith('//')) {
        comments.push(trimmed.replace(/^\/\/\s*/, ''));
      } else if (trimmed.startsWith('/*') || trimmed.startsWith('*')) {
        const cleaned = trimmed.replace(/^\/?\*+\s*/, '').replace(/\*\/$/, '').trim();
        if (cleaned) comments.push(cleaned);
      }
    }

    return comments;
  }

  /**
   * Get all code files in directory
   */
  private async getAllFiles(dir: string): Promise<string[]> {
    const files: string[] = [];

    const walk = async (directory: string) => {
      try {
        const entries = await fs.readdir(directory, { withFileTypes: true });

        for (const entry of entries) {
          const fullPath = path.join(directory, entry.name);

          if (entry.isDirectory()) {
            if (!this.excludedDirs.includes(entry.name) && !entry.name.startsWith('.')) {
              await walk(fullPath);
            }
          } else if (entry.isFile() && this.isCodeFile(entry.name)) {
            files.push(fullPath);
          }
        }
      } catch (error) {
        console.warn(`Error reading ${directory}:`, error);
      }
    };

    await walk(dir);
    return files;
  }

  /**
   * Check if file is a code file
   */
  private isCodeFile(filename: string): boolean {
    return Object.keys(this.languageExtensions).some(ext => filename.endsWith(ext));
  }
}

export const codeSearchService = new CodeSearchService();
