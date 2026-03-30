/**
 * Enhanced Code Search Service
 *
 * Improved implementation with semantic search using embeddings,
 * caching, and better performance optimizations.
 */

import * as fs from "fs/promises";
import * as path from "path";
import { createHash } from "crypto";
import { OpenAI } from "openai";

export interface SearchResult {
  file: string;
  content: string;
  lineStart: number;
  lineEnd: number;
  similarity: number;
  functionName?: string;
  description: string;
  preview: string;
  semanticScore?: number;
  keywordScore?: number;
}

export interface CodeBlock {
  id: string;
  file: string;
  content: string;
  lineStart: number;
  lineEnd: number;
  functionName?: string;
  type: "function" | "class" | "method" | "component" | "block";
  embedding?: number[];
  hash: string;
  language: string;
  metadata: {
    imports: string[];
    exports: string[];
    dependencies: string[];
    complexity: number;
  };
}

export interface IndexStats {
  totalFiles: number;
  totalBlocks: number;
  languages: Record<string, number>;
  indexedAt: string;
  averageComplexity: number;
  totalTokens: number;
}

export interface SearchCache {
  query: string;
  results: SearchResult[];
  timestamp: number;
}

class EnhancedCodeSearchService {
  private codeBlocks: Map<string, CodeBlock> = new Map();
  private embeddings: Map<string, number[]> = new Map();
  private indexedDirectory: string | null = null;
  private indexStats: IndexStats | null = null;
  private searchCache: Map<string, SearchCache> = new Map();
  private openai: OpenAI | null = null;

  private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes
  private readonly MAX_CACHE_SIZE = 1000;
  private readonly BATCH_SIZE = 100;

  private excludedDirs = [
    "node_modules",
    ".git",
    ".next",
    "dist",
    "build",
    "coverage",
    "__pycache__",
    ".cache",
    ".turbo",
    "out",
  ];

  private languageExtensions: Record<string, string> = {
    ".ts": "TypeScript",
    ".tsx": "TypeScript",
    ".js": "JavaScript",
    ".jsx": "JavaScript",
    ".py": "Python",
    ".go": "Go",
    ".rs": "Rust",
    ".java": "Java",
    ".rb": "Ruby",
    ".php": "PHP",
    ".vue": "Vue",
    ".svelte": "Svelte",
    ".cpp": "C++",
    ".c": "C",
    ".cs": "C#",
    ".swift": "Swift",
    ".kt": "Kotlin",
    ".scala": "Scala",
    ".dart": "Dart",
  };

  constructor() {
    // Initialize OpenAI if API key is available
    if (process.env.OPENAI_API_KEY) {
      this.openai = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY,
      });
    }
  }

  /**
   * Index a codebase for searching with enhanced features
   */
  async indexCodebase(
    directory: string,
    options: {
      useEmbeddings?: boolean;
      forceReindex?: boolean;
    } = {},
  ): Promise<IndexStats> {
    const { useEmbeddings = !!this.openai, forceReindex = false } = options;

    console.log(`🔍 Enhanced indexing of ${directory}...`);
    console.log(`📊 Using embeddings: ${useEmbeddings}`);

    // Check if we can use cached index
    const cacheFile = path.join(directory, ".guardrail", "search-index.json");
    if (!forceReindex) {
      try {
        const cached = await this.loadCachedIndex(cacheFile);
        if (cached) {
          console.log("✅ Using cached search index");
          return cached.stats;
        }
      } catch (error) {
        console.log("Cache miss, rebuilding index...");
      }
    }

    this.codeBlocks.clear();
    this.embeddings.clear();
    this.indexedDirectory = directory;

    const languages: Record<string, number> = {};
    let totalFiles = 0;
    let totalComplexity = 0;
    let totalTokens = 0;

    const files = await this.getAllFiles(directory);
    console.log(`📁 Found ${files.length} files to process`);

    // Process files in batches
    for (let i = 0; i < files.length; i += this.BATCH_SIZE) {
      const batch = files.slice(i, i + this.BATCH_SIZE);
      console.log(
        `Processing batch ${Math.floor(i / this.BATCH_SIZE) + 1}/${Math.ceil(files.length / this.BATCH_SIZE)}`,
      );

      const batchPromises = batch.map(async (file) => {
        try {
          const content = await fs.readFile(file, "utf-8");
          const blocks = await this.extractCodeBlocks(file, content);

          for (const block of blocks) {
            this.codeBlocks.set(block.id, block);

            // Track language stats
            const ext = path.extname(file);
            const lang = this.languageExtensions[ext] || "Other";
            languages[lang] = (languages[lang] || 0) + 1;
            totalComplexity += block.metadata.complexity;
            totalTokens += this.estimateTokens(block.content);
          }

          return blocks.length;
        } catch (error) {
          console.warn(`Failed to process ${file}:`, error);
          return 0;
        }
      });

      const results = await Promise.all(batchPromises);
      totalFiles += batch.filter((_, idx) => results[idx] > 0).length;
    }

    // Generate embeddings if enabled
    if (useEmbeddings && this.openai) {
      console.log("🧠 Generating embeddings for semantic search...");
      await this.generateEmbeddings();
    }

    this.indexStats = {
      totalFiles,
      totalBlocks: this.codeBlocks.size,
      languages,
      indexedAt: new Date().toISOString(),
      averageComplexity: totalComplexity / this.codeBlocks.size || 0,
      totalTokens,
    };

    // Save index to cache
    await this.saveCachedIndex(cacheFile);

    console.log(
      `✅ Indexed ${this.codeBlocks.size} code blocks from ${totalFiles} files`,
    );
    return this.indexStats;
  }

  /**
   * Enhanced search with semantic and keyword matching
   */
  async search(
    query: string,
    options: {
      limit?: number;
      threshold?: number;
      useSemantic?: boolean;
      includeContent?: boolean;
    } = {},
  ): Promise<SearchResult[]> {
    const {
      limit = 20,
      threshold = 0.1,
      useSemantic = !!this.openai && this.embeddings.size > 0,
      includeContent = true,
    } = options;

    // Check cache first
    const cacheKey = `${query}:${limit}:${threshold}`;
    const cached = this.searchCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
      console.log("🎯 Using cached search results");
      return cached.results;
    }

    console.log(`🔍 Searching for: "${query}" (semantic: ${useSemantic})`);

    const queryEmbedding =
      useSemantic && this.openai
        ? await this.generateQueryEmbedding(query)
        : null;

    const results: SearchResult[] = [];

    for (const [id, block] of this.codeBlocks) {
      let semanticScore = 0;
      let keywordScore = 0;

      // Semantic similarity
      if (queryEmbedding && block.embedding) {
        semanticScore = this.cosineSimilarity(queryEmbedding, block.embedding);
      }

      // Keyword matching
      keywordScore = this.calculateKeywordScore(query, block);

      // Combined score
      const similarity = useSemantic
        ? semanticScore * 0.6 + keywordScore * 0.4
        : keywordScore;

      if (similarity >= threshold) {
        results.push({
          file: block.file,
          content: includeContent ? block.content : "",
          lineStart: block.lineStart,
          lineEnd: block.lineEnd,
          similarity,
          functionName: block.functionName,
          description: this.generateDescription(block),
          preview: this.generatePreview(block.content),
          semanticScore: useSemantic ? semanticScore : undefined,
          keywordScore,
        });
      }
    }

    // Sort by similarity and limit results
    const sortedResults = results
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, limit);

    // Cache results
    this.cacheSearchResults(cacheKey, sortedResults);

    console.log(`📊 Found ${sortedResults.length} results`);
    return sortedResults;
  }

  /**
   * Generate embeddings for all code blocks
   */
  private async generateEmbeddings(): Promise<void> {
    if (!this.openai) return;

    const blocks = Array.from(this.codeBlocks.values());
    console.log(`Generating embeddings for ${blocks.length} blocks...`);

    // Process in batches to avoid rate limits
    for (let i = 0; i < blocks.length; i += this.BATCH_SIZE) {
      const batch = blocks.slice(i, i + this.BATCH_SIZE);

      const promises = batch.map(async (block) => {
        try {
          const response = await this.openai!.embeddings.create({
            model: "text-embedding-3-small",
            input: this.prepareTextForEmbedding(block),
          });

          const embedding = response.data[0].embedding;
          this.embeddings.set(block.id, embedding);
          block.embedding = embedding;
        } catch (error) {
          console.warn(`Failed to generate embedding for ${block.id}:`, error);
        }
      });

      await Promise.all(promises);

      // Add delay to avoid rate limits
      if (i + this.BATCH_SIZE < blocks.length) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }

    console.log(`✅ Generated ${this.embeddings.size} embeddings`);
  }

  /**
   * Generate embedding for search query
   */
  private async generateQueryEmbedding(query: string): Promise<number[]> {
    if (!this.openai) throw new Error("OpenAI not initialized");

    const response = await this.openai.embeddings.create({
      model: "text-embedding-3-small",
      input: `code search: ${query}`,
    });

    return response.data[0].embedding;
  }

  /**
   * Calculate cosine similarity between two vectors
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

    if (normA === 0 || normB === 0) return 0;
    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }

  /**
   * Enhanced keyword scoring
   */
  private calculateKeywordScore(query: string, block: CodeBlock): number {
    const queryLower = query.toLowerCase();
    const content = block.content.toLowerCase();
    let score = 0;

    // Exact phrase match
    if (content.includes(queryLower)) {
      score += 0.5;
    }

    // Word matches
    const queryWords = queryLower.split(/\s+/);
    const contentWords = content.split(/\s+/);
    const matches = queryWords.filter((word) => contentWords.includes(word));
    score += (matches.length / queryWords.length) * 0.3;

    // Function name match
    if (block.functionName) {
      const nameLower = block.functionName.toLowerCase();
      if (nameLower.includes(queryLower) || queryLower.includes(nameLower)) {
        score += 0.2;
      }
    }

    return Math.min(score, 1.0);
  }

  /**
   * Prepare text for embedding
   */
  private prepareTextForEmbedding(block: CodeBlock): string {
    const parts = [
      block.functionName || "anonymous",
      block.type,
      block.content.slice(0, 1000), // Limit to first 1000 chars
      ...block.metadata.imports,
      ...block.metadata.exports,
    ];

    return parts.join(" ");
  }

  /**
   * Enhanced code block extraction with metadata
   */
  private async extractCodeBlocks(
    file: string,
    content: string,
  ): Promise<CodeBlock[]> {
    const blocks: CodeBlock[] = [];
    const lines = content.split("\n");
    const ext = path.extname(file);
    const language = this.languageExtensions[ext] || "Other";

    // Extract imports
    const imports = this.extractImports(content, language);

    // Extract functions, classes, and components
    const patterns = this.getLanguagePatterns(language);

    for (const pattern of patterns) {
      const matches = content.matchAll(pattern.regex);

      for (const match of matches) {
        const startLine =
          content.substring(0, match.index!).split("\n").length - 1;
        const blockContent = this.extractBlockContent(
          lines,
          startLine,
          pattern.endPattern,
        );

        if (blockContent) {
          const id = this.generateBlockId(file, startLine, match[1] || "block");
          const block: CodeBlock = {
            id,
            file,
            content: blockContent.content,
            lineStart: startLine,
            lineEnd: blockContent.endLine,
            functionName: match[1] || undefined,
            type: pattern.type as
              | "function"
              | "class"
              | "method"
              | "component"
              | "block",
            hash: this.hashContent(blockContent.content),
            language,
            metadata: {
              imports,
              exports: this.extractExports(blockContent.content, language),
              dependencies: this.extractDependencies(blockContent.content),
              complexity: this.calculateComplexity(blockContent.content),
            },
          };

          blocks.push(block);
        }
      }
    }

    // If no blocks found, create file-level block
    if (blocks.length === 0 && content.trim()) {
      const id = this.generateBlockId(file, 0, "file");
      blocks.push({
        id,
        file,
        content,
        lineStart: 0,
        lineEnd: lines.length - 1,
        type: "block" as const,
        hash: this.hashContent(content),
        language,
        metadata: {
          imports,
          exports: this.extractExports(content, language),
          dependencies: this.extractDependencies(content),
          complexity: this.calculateComplexity(content),
        },
      });
    }

    return blocks;
  }

  /**
   * Get regex patterns for different languages
   */
  private getLanguagePatterns(language: string) {
    const patterns = [
      {
        type: "function",
        regex: /(?:function|const|let|var)\s+(\w+)\s*[=:]/g,
        endPattern: /^}/m,
      },
      {
        type: "class",
        regex: /class\s+(\w+)/g,
        endPattern: /^}/m,
      },
      {
        type: "method",
        regex: /(?:async\s+)?(\w+)\s*\([^)]*\)\s*[:{]/g,
        endPattern: /^}/m,
      },
    ];

    if (language === "TypeScript" || language === "JavaScript") {
      patterns.push({
        type: "component",
        regex: /(?:const|function)\s+(\w+.*?React\.\w*|FC|Component)/g,
        endPattern: /^}/m,
      });
    }

    return patterns;
  }

  /**
   * Helper methods
   */
  private async getAllFiles(dir: string): Promise<string[]> {
    const files: string[] = [];
    const entries = await fs.readdir(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);

      if (entry.isDirectory() && !this.excludedDirs.includes(entry.name)) {
        files.push(...(await this.getAllFiles(fullPath)));
      } else if (entry.isFile() && this.isSourceFile(entry.name)) {
        files.push(fullPath);
      }
    }

    return files;
  }

  private isSourceFile(filename: string): boolean {
    const ext = path.extname(filename);
    return Object.keys(this.languageExtensions).includes(ext);
  }

  private extractBlockContent(
    lines: string[],
    startLine: number,
    endPattern: RegExp,
  ): { content: string; endLine: number } | null {
    let content = lines[startLine];
    let endLine = startLine;
    let braceCount =
      (content.match(/{/g) || []).length - (content.match(/}/g) || []).length;

    for (let i = startLine + 1; i < lines.length; i++) {
      content += "\n" + lines[i];
      endLine = i;

      braceCount +=
        (lines[i].match(/{/g) || []).length -
        (lines[i].match(/}/g) || []).length;

      if (braceCount <= 0 || endPattern.test(lines[i])) {
        break;
      }
    }

    return { content, endLine };
  }

  private generateBlockId(file: string, line: number, name: string): string {
    return createHash("md5")
      .update(`${file}:${line}:${name || "block"}`)
      .digest("hex")
      .substring(0, 16);
  }

  private hashContent(content: string): string {
    return createHash("md5").update(content).digest("hex");
  }

  private extractImports(content: string, language: string): string[] {
    const imports: string[] = [];
    const lines = content.split("\n");

    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.startsWith("import ") || trimmed.startsWith("require(")) {
        const match = trimmed.match(
          /(?:import.*from\s+['"`]([^'"`]+)['"`]|require\(['"`]([^'"`]+)['"`]\))/,
        );
        if (match) {
          imports.push(match[1] || match[2]);
        }
      }
    }

    return imports;
  }

  private extractExports(content: string, language: string): string[] {
    const exports: string[] = [];
    const lines = content.split("\n");

    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.startsWith("export ")) {
        const match = trimmed.match(
          /export\s+(?:default\s+)?(?:function|class|const|let|var)\s+(\w+)/,
        );
        if (match) {
          exports.push(match[1]);
        }
      }
    }

    return exports;
  }

  private extractDependencies(content: string): string[] {
    const deps: string[] = [];
    const patterns = [
      /import.*from\s+['"`]([^'"`]+)['"`]/g,
      /require\(['"`]([^'"`]+)['"`]\)/g,
      /from\s+['"`]([^'"`]+)['"`]/g,
    ];

    for (const pattern of patterns) {
      const matches = content.matchAll(pattern);
      for (const match of matches) {
        deps.push(match[1]);
      }
    }

    return [...new Set(deps)];
  }

  private calculateComplexity(content: string): number {
    let complexity = 1;

    // Add complexity for control structures
    complexity += (content.match(/\b(if|else|for|while|switch|case)\b/g) || [])
      .length;

    // Add complexity for nested structures
    const maxDepth = this.getMaxNestingDepth(content);
    complexity += maxDepth * 0.5;

    // Add complexity for try-catch
    complexity += (content.match(/\b(try|catch)\b/g) || []).length * 0.5;

    return Math.round(complexity * 10) / 10;
  }

  private getMaxNestingDepth(content: string): number {
    let depth = 0;
    let maxDepth = 0;

    for (const char of content) {
      if (char === "{") {
        depth++;
        maxDepth = Math.max(maxDepth, depth);
      } else if (char === "}") {
        depth--;
      }
    }

    return maxDepth;
  }

  private estimateTokens(content: string): number {
    // Rough estimation: ~4 characters per token
    return Math.ceil(content.length / 4);
  }

  private generateDescription(block: CodeBlock): string {
    const parts: string[] = [block.type];
    if (block.functionName) {
      parts.push(block.functionName);
    }
    parts.push(`(${block.lineStart}-${block.lineEnd})`);
    parts.push(`[${block.language}]`);

    return parts.join(" ");
  }

  private generatePreview(content: string, maxLength: number = 200): string {
    const preview = content.substring(0, maxLength);
    return preview.length < content.length ? preview + "..." : preview;
  }

  private async loadCachedIndex(
    cacheFile: string,
  ): Promise<{ stats: IndexStats } | null> {
    try {
      const data = await fs.readFile(cacheFile, "utf-8");
      const cached = JSON.parse(data);

      // Check if cache is still valid
      const statsPath = path.join(
        path.dirname(cacheFile),
        "..",
        ".git",
        "HEAD",
      );
      let currentHash = "";

      try {
        const headContent = await fs.readFile(statsPath, "utf-8");
        currentHash = createHash("md5").update(headContent).digest("hex");
      } catch {
        // Not a git repo, use timestamp
        currentHash = Date.now().toString();
      }

      if (cached.hash === currentHash) {
        // Restore cached data
        this.codeBlocks = new Map(cached.blocks.map((b: any) => [b.id, b]));
        this.embeddings = new Map(cached.embeddings || []);
        this.indexStats = cached.stats;
        return { stats: cached.stats };
      }
    } catch {
      // Cache file doesn't exist or is invalid
    }

    return null;
  }

  private async saveCachedIndex(cacheFile: string): Promise<void> {
    try {
      await fs.mkdir(path.dirname(cacheFile), { recursive: true });

      // Get git hash for cache invalidation
      const statsPath = path.join(
        path.dirname(cacheFile),
        "..",
        ".git",
        "HEAD",
      );
      let hash = "";

      try {
        const headContent = await fs.readFile(statsPath, "utf-8");
        hash = createHash("md5").update(headContent).digest("hex");
      } catch {
        hash = Date.now().toString();
      }

      const data = {
        hash,
        blocks: Array.from(this.codeBlocks.values()),
        embeddings: Array.from(this.embeddings.entries()),
        stats: this.indexStats,
      };

      await fs.writeFile(cacheFile, JSON.stringify(data));
    } catch (error) {
      console.warn("Failed to save search index cache:", error);
    }
  }

  private cacheSearchResults(key: string, results: SearchResult[]): void {
    // Remove oldest entries if cache is full
    if (this.searchCache.size >= this.MAX_CACHE_SIZE) {
      const oldestKey = this.searchCache.keys().next().value;
      if (oldestKey) {
        this.searchCache.delete(oldestKey);
      }
    }

    this.searchCache.set(key, {
      query: key,
      results,
      timestamp: Date.now(),
    });
  }

  /**
   * Get search statistics
   */
  getStats(): IndexStats | null {
    return this.indexStats;
  }

  /**
   * Clear search cache
   */
  clearCache(): void {
    this.searchCache.clear();
    console.log("🗑️ Search cache cleared");
  }
}

export const enhancedCodeSearchService = new EnhancedCodeSearchService();
