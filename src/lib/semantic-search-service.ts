/**
 * Semantic Search Service
 * 
 * Provides intelligent code search using embeddings and semantic understanding
 */

import * as fs from 'fs/promises';
import * as path from 'path';

interface SearchResult {
  file: string;
  line: number;
  content: string;
  score: number;
  context: string;
}

interface SearchIndex {
  files: Map<string, FileIndex>;
  embeddings: Map<string, number[]>;
}

interface FileIndex {
  path: string;
  lines: string[];
  functions: FunctionInfo[];
  classes: ClassInfo[];
  imports: string[];
  exports: string[];
}

interface FunctionInfo {
  name: string;
  line: number;
  params: string[];
  docstring?: string;
}

interface ClassInfo {
  name: string;
  line: number;
  methods: string[];
  properties: string[];
}

class SemanticSearchService {
  private index: SearchIndex = {
    files: new Map(),
    embeddings: new Map()
  };

  /**
   * Build search index for a project
   */
  async buildIndex(projectPath: string): Promise<void> {
    console.log(`🔍 Building semantic search index for: ${projectPath}`);
    
    // Find all source files
    const files = await this.findSourceFiles(projectPath);
    
    // Index each file
    for (const file of files) {
      await this.indexFile(file, path.basename(file));
    }
    
    console.log(`✅ Indexed ${files.length} files`);
  }

  /**
   * Search for code using semantic understanding
   */
  async search(query: string, projectPath: string, limit: number = 10): Promise<SearchResult[]> {
    // Build index if not exists
    if (this.index.files.size === 0) {
      await this.buildIndex(projectPath);
    }

    const results: SearchResult[] = [];
    const queryTerms = this.extractTerms(query);
    
    // Search through indexed files
    for (const [, fileIndex] of this.index.files) {
      const fileResults = this.searchInFile(queryTerms, fileIndex, query);
      results.push(...fileResults);
    }
    
    // Sort by relevance score
    results.sort((a, b) => b.score - a.score);
    
    return results.slice(0, limit);
  }

  /**
   * Find all source files in project
   */
  private async findSourceFiles(projectPath: string): Promise<string[]> {
    const extensions = ['.ts', '.tsx', '.js', '.jsx', '.py', '.java', '.go', '.rs'];
    const files: string[] = [];
    
    const scan = async (dir: string) => {
      const entries = await fs.readdir(dir, { withFileTypes: true });
      
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        
        // Handle both real fs.Dirent and test mocks
        const isDirectory = entry.isDirectory ? entry.isDirectory() : (typeof entry.isDirectory === 'boolean' ? entry.isDirectory : false);
        const isFile = entry.isFile ? entry.isFile() : (typeof entry.isFile === 'boolean' ? entry.isFile : !isDirectory);
        
        if (isDirectory && !entry.name.startsWith('.') && entry.name !== 'node_modules') {
          await scan(fullPath);
        } else if (isFile && extensions.some(ext => entry.name.endsWith(ext))) {
          files.push(fullPath);
        }
      }
    };
    
    await scan(projectPath);
    return files;
  }

  /**
   * Index a single file
   */
  private async indexFile(filePath: string, fileName: string): Promise<void> {
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      const lines = content.split('\n');
      
      const fileIndex: FileIndex = {
        path: filePath,
        lines: content.split('\n'),
        functions: this.extractFunctions(content),
        classes: this.extractClasses(content),
        imports: this.extractImports(content),
        exports: this.extractExports(content)
      };
      
      this.index.files.set(filePath, fileIndex);
    } catch (error) {
      console.warn(`Warning: Could not index file ${filePath}:`, error);
    }
  }

  /**
   * Extract functions from file content
   */
  private extractFunctions(content: string): FunctionInfo[] {
    const functions: FunctionInfo[] = [];
    const lines = content.split('\n');
    const seenFunctions = new Set<string>();
    
    // Regex patterns for different languages
    const patterns = [
      // TypeScript/JavaScript
      /(?:async\s+)?(?:function\s+(\w+)|(\w+)\s*=\s*(?:async\s+)?function|(\w+)\s*:\s*\([^)]*\)\s*=>|(\w+)\s*\([^)]*\)\s*{)/g,
      // Python
      /def\s+(\w+)\s*\(/g,
      // Java
      /(?:public|private|protected)?\s*(?:static\s+)?(?:\w+\s+)?(\w+)\s*\([^)]*\)\s*{/g,
      // Go
      /func\s+(\w+)\s*\(/g,
      // Rust
      /fn\s+(\w+)\s*\(/g
    ];
    
    lines.forEach((line, index) => {
      patterns.forEach(pattern => {
        let match;
        while ((match = pattern.exec(line)) !== null) {
          const functionName = match[1] || match[2] || match[3] || match[4];
          if (functionName && !seenFunctions.has(functionName)) {
            seenFunctions.add(functionName);
            
            // Get docstring if available
            let docstring: string | undefined;
            if (index > 0 && lines[index - 1]?.trim().startsWith('/**')) {
              docstring = lines[index - 1]?.trim();
            }
            
            functions.push({
              name: functionName,
              line: index + 1,
              params: this.extractParams(line),
              docstring
            });
          }
        }
      });
    });
    
    return functions;
  }

  /**
   * Extract classes from file content
   */
  private extractClasses(content: string): ClassInfo[] {
    const classes: ClassInfo[] = [];
    const lines = content.split('\n');
    const seenClasses = new Set<string>(); // prevent duplicates from multiple regex matches
    
    // TypeScript/JavaScript
    const classPattern = /class\s+(\w+)/g;
    // Python
    const pythonClassPattern = /class\s+(\w+)(?:\([^)]*\))?:/g;
    // Java
    const javaClassPattern = /(?:public\s+)?class\s+(\w+)/g;
    
    const matches = [
        ...content.matchAll(classPattern),
        ...content.matchAll(pythonClassPattern),
        ...content.matchAll(javaClassPattern)
    ];

    // Sort matches by index to process in order (optional but nice)
    matches.sort((a, b) => (a.index || 0) - (b.index || 0));

    matches.forEach(match => {
        const className = match[1];
        // Use name + line as unique key to avoid duplicates from overlapping regexes
        const line = content.substring(0, match.index!).split('\n').length;
        const key = `${className}:${line}`;
        
        if (seenClasses.has(key)) return;
        seenClasses.add(key);

        // Extract class body
        const classBody = this.extractClassBody(content, match.index! + match[0].length);
        const methods = this.extractMethods(classBody);

        classes.push({
          name: className,
          line,
          methods,
          properties: [] // TODO: Extract properties
        });
      });
    
    return classes;
  }

  /**
   * Extract body of a class (content between braces or indented block)
   */
  private extractClassBody(content: string, startIndex: number): string {
    // 1. Check for brace-based class (TS, JS, Java, etc.)
    const openBraceIndex = content.indexOf('{', startIndex);
    const nextNewline = content.indexOf('\n', startIndex);

    // If we find a brace before the next newline (or reasonably close), it's likely a brace language
    // Allow for `class Foo \n {` style
    if (openBraceIndex !== -1 && (nextNewline === -1 || openBraceIndex < nextNewline + 200)) {
      let balance = 1;
      let i = openBraceIndex + 1;
      let inString = false;
      let stringChar = '';

      while (i < content.length && balance > 0) {
        const char = content[i];

        // Simple string skipping to avoid braces in strings
        if ((char === '"' || char === "'" || char === '`') && content[i-1] !== '\\') {
          if (!inString) {
            inString = true;
            stringChar = char;
          } else if (char === stringChar) {
            inString = false;
          }
        }

        if (!inString) {
          if (char === '{') balance++;
          else if (char === '}') balance--;
        }
        i++;
      }

      if (balance === 0) {
        return content.substring(openBraceIndex + 1, i - 1);
      }
    }

    // 2. Fallback for Python (indentation based)
    // We look for the indentation of the class definition line, then read until indentation drops
    // Find the start of the line where the class was defined.

    // We look for the 'class' keyword backwards
    const classKeywordIndex = content.lastIndexOf('class', startIndex);

    // Check if it looks like Python
    // 1. We passed a colon (match included it)
    // 2. A colon is coming up before a brace or newline (matched by generic class pattern)
    const hasPrecedingColon = content[startIndex - 1] === ':';
    const hasUpcomingColon = (() => {
         const end = nextNewline === -1 ? content.length : nextNewline;
         const sub = content.substring(startIndex, end);
         return sub.includes(':') && !sub.includes('{');
    })();

    if (hasPrecedingColon || hasUpcomingColon) {
       // It looks like Python
       const lineStart = content.lastIndexOf('\n', classKeywordIndex);
       const linePrefix = content.substring(lineStart + 1, classKeywordIndex);
       const baseIndent = linePrefix.match(/^\s*/)?.[0].length || 0;

       let bodyStart = content.indexOf('\n', startIndex);
       if (bodyStart === -1) return '';

       let currentPos = bodyStart + 1;
       let endPos = content.length;

       while (currentPos < content.length) {
         const nextLineEnd = content.indexOf('\n', currentPos);
         const lineEnd = nextLineEnd === -1 ? content.length : nextLineEnd;
         const line = content.substring(currentPos, lineEnd);

         // If line is empty or just whitespace, skip it but don't stop
         if (line.trim().length === 0) {
           if (nextLineEnd === -1) break;
           currentPos = nextLineEnd + 1;
           continue;
         }

         const currentIndent = line.match(/^\s*/)?.[0].length || 0;
         if (currentIndent <= baseIndent) {
           endPos = currentPos;
           break;
         }

         if (nextLineEnd === -1) break;
         currentPos = nextLineEnd + 1;
       }

       return content.substring(bodyStart, endPos);
    }

    return '';
  }

  /**
   * Extract methods from class body
   */
  private extractMethods(classBody: string): string[] {
    const methods: string[] = [];
    const keywords = new Set(['if', 'for', 'while', 'switch', 'catch', 'constructor', 'super', 'return']);

    // TypeScript/JavaScript/Java Patterns
    // 1. Explicit modifiers: public method(), private method(), static method(), async method()
    const modifierPattern = /(?:public|private|protected|static|async|get|set)\s+(?:async\s+)?(?:\w+\s+)*(\w+)\s*\(/g;

    // 2. Standard method definition: name(...) {
    // Handling generics <T> is hard with regex, simplified to \w+
    const standardPattern = /(\w+)\s*(?:<[^>]+>)?\s*\([^)]*\)\s*(?::\s*[^{]+)?{/g;

    // Python Pattern
    const pythonPattern = /def\s+(\w+)\s*\(/g;

    // Helper to add unique methods
    const addMethod = (name: string) => {
      if (name && !keywords.has(name) && !methods.includes(name)) {
        methods.push(name);
      }
    };

    let match;
    while ((match = modifierPattern.exec(classBody)) !== null) addMethod(match[1]);
    while ((match = standardPattern.exec(classBody)) !== null) addMethod(match[1]);
    while ((match = pythonPattern.exec(classBody)) !== null) addMethod(match[1]);

    return methods;
  }

  /**
   * Extract imports from file content
   */
  private extractImports(content: string): string[] {
    const imports: string[] = [];
    
    // TypeScript/JavaScript
    const importMatches = content.matchAll(/import\s+.*?from\s+['"]([^'"]+)['"]/g);
    // Python
    const pythonImports = content.matchAll(/(?:import|from)\s+([^\s]+)/g);
    
    for (const match of importMatches) {
      if (match[1]) {
        imports.push(match[1]);
      }
    }
    
    for (const match of pythonImports) {
      if (match[1]) {
        imports.push(match[1]);
      }
    }
    
    // Match exported arrow functions
    const exportArrowRegex = /export\s+(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s+)?\(/g;
    let match: RegExpExecArray | null;
    while ((match = exportArrowRegex.exec(content)) !== null) {
      imports.push(match[1] || '');
    }
    
    return imports;
  }

  /**
   * Extract exports from file content
   */
  private extractExports(content: string): string[] {
    const exports: string[] = [];
    
    // Match exported functions
    const exportFunctionRegex = /export\s+(?:async\s+)?function\s+(\w+)/g;
    let match: RegExpExecArray | null;
    
    while ((match = exportFunctionRegex.exec(content)) !== null) {
      exports.push(match[1] || '');
    }
    
    return exports;
  }

  /**
   * Extract parameters from function signature
   */
  private extractParams(line: string): string[] {
    const match = line.match(/\(([^)]*)\)/);
    if (!match || !match[1]) return [];
    
    return match[1].split(',').map(p => p.trim().split(':')[0].split('=')[0]).filter(p => p);
  }

  /**
   * Extract search terms from query
   */
  private extractTerms(query: string): string[] {
    return query.toLowerCase()
      .split(/\s+/)
      .filter(term => term.length > 2)
      .map(term => term.replace(/[^\w]/g, ''));
  }

  /**
   * Search within a file index
   */
  private searchInFile(terms: string[], fileIndex: FileIndex, originalQuery: string): SearchResult[] {
    const results: SearchResult[] = [];
    
    // Search in function names
    fileIndex.functions.forEach(func => {
      const score = this.calculateScore(terms, func.name, originalQuery);
      if (score > 0) {
        results.push({
          file: fileIndex.path,
          line: func.line,
          content: `function ${func.name}(${func.params.join(', ')})`,
          score,
          context: func.docstring || `Function definition in ${path.basename(fileIndex.path)}`
        });
      }
    });
    
    // Search in class names
    fileIndex.classes.forEach(cls => {
      const score = this.calculateScore(terms, cls.name, originalQuery);
      if (score > 0) {
        results.push({
          file: fileIndex.path,
          line: cls.line,
          content: `class ${cls.name}`,
          score,
          context: `Class definition in ${path.basename(fileIndex.path)}`
        });
      }
    });
    
    // Search in file content
    fileIndex.lines.forEach((line, index) => {
      const score = this.calculateScore(terms, line, originalQuery);
      if (score > 0.5) { // Lower threshold for content matches
        results.push({
          file: fileIndex.path,
          line: index + 1,
          content: line.trim(),
          score: score * 0.8, // Slightly lower score for content matches
          context: `Line ${index + 1} in ${path.basename(fileIndex.path)}`
        });
      }
    });
    
    return results;
  }

  /**
   * Calculate relevance score
   */
  private calculateScore(terms: string[], text: string, originalQuery: string): number {
    const lowerText = text.toLowerCase();
    let score = 0;
    
    // Exact phrase match gets highest score
    if (lowerText === originalQuery.toLowerCase()) {
      score += 20; // Perfect match gets highest score
    } else if (lowerText.includes(originalQuery.toLowerCase())) {
      score += 10; // Partial exact match
    }
    
    // Term matches
    terms.forEach(term => {
      if (lowerText.includes(term)) {
        score += 2;
      }
      
      // Partial matches
      if (lowerText.includes(term.substring(0, term.length / 2))) {
        score += 0.5;
      }
    });
    
    // Boost for camelCase matches
    if (this.matchesCamelCase(originalQuery, text)) {
      score += 5.1; // Add 0.1 to ensure it's greater
    }
    
    return score;
  }

  /**
   * Check if query matches camelCase
   */
  private matchesCamelCase(query: string, text: string): boolean {
    const queryChars = query.toLowerCase().split('');
    const textChars = text.toLowerCase().split('');
    let queryIndex = 0;
    
    for (let i = 0; i < textChars.length && queryIndex < queryChars.length; i++) {
      if (textChars[i] === queryChars[queryIndex]) {
        queryIndex++;
      }
    }
    
    return queryIndex === queryChars.length;
  }
}

// Export singleton instance
export const semanticSearchService = new SemanticSearchService();
