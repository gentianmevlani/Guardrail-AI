/**
 * Mock Data Scanner Service
 * 
 * Real implementation that scans code files for mock data patterns.
 * This actually reads and analyzes source files.
 */

import * as fs from 'fs/promises';
import * as path from 'path';

export interface MockDataIssue {
  file: string;
  line: number;
  column: number;
  pattern: string;
  description: string;
  severity: 'error' | 'warning' | 'info';
  codeSnippet: string;
  suggestion: string;
}

export interface MockDataScanResult {
  scanned: number;
  issues: MockDataIssue[];
  summary: {
    errors: number;
    warnings: number;
    info: number;
  };
  timestamp: string;
  directory: string;
}

interface MockPattern {
  regex: RegExp;
  description: string;
  severity: 'error' | 'warning' | 'info';
  suggestion: string;
}

class MockDataScanner {
  private patterns: MockPattern[] = [
    {
      regex: /const\s+(\w+)\s*=\s*\[\s*\{[^}]*id:\s*\d+[^}]*name:\s*["'][A-Z][a-z]+/gm,
      description: 'Hardcoded array of objects with sequential IDs and names (likely mock user data)',
      severity: 'error',
      suggestion: 'Replace with data fetched from a real API endpoint',
    },
    {
      regex: /const\s+(\w+)\s*=\s*\[\s*\{[^}]*title:\s*["'].*["'][^}]*\}/gm,
      description: 'Hardcoded array with title/description objects (likely mock content)',
      severity: 'warning',
      suggestion: 'Load this data from a database or CMS',
    },
    {
      regex: /lorem\s+ipsum|dolor\s+sit\s+amet/gi,
      description: 'Lorem ipsum placeholder text detected',
      severity: 'warning',
      suggestion: 'Replace with real content or fetch from a content API',
    },
    {
      regex: /example\.com|test\.com|fake\.com|dummy\.com/gi,
      description: 'Fake/placeholder domain detected',
      severity: 'warning',
      suggestion: 'Use real URLs or environment variables for API endpoints',
    },
    {
      regex: /["']user@example\.com["']|["']test@test\.com["']/gi,
      description: 'Fake email address detected',
      severity: 'warning',
      suggestion: 'Use real email validation or environment variables',
    },
    {
      regex: /const\s+mock\w*\s*=/gi,
      description: 'Variable named with "mock" prefix',
      severity: 'info',
      suggestion: 'Consider renaming or moving to a test/mock file',
    },
    {
      regex: /const\s+fake\w*\s*=/gi,
      description: 'Variable named with "fake" prefix',
      severity: 'info',
      suggestion: 'Consider renaming or moving to a test/mock file',
    },
    {
      regex: /const\s+dummy\w*\s*=/gi,
      description: 'Variable named with "dummy" prefix',
      severity: 'info',
      suggestion: 'Consider renaming or moving to a test/mock file',
    },
    {
      regex: /["']placeholder["']|PLACEHOLDER/g,
      description: 'Placeholder text detected',
      severity: 'warning',
      suggestion: 'Replace with real content',
    },
    {
      regex: /setTimeout\s*\(\s*.*\s*,\s*\d+\s*\)\s*;\s*\/\/\s*simulate/gi,
      description: 'Simulated delay (likely fake async operation)',
      severity: 'warning',
      suggestion: 'Replace with real async API call',
    },
    {
      regex: /Math\.random\(\)\s*\*\s*\d+.*(?:id|price|amount)/gi,
      description: 'Random number used for ID or amount (likely mock data)',
      severity: 'error',
      suggestion: 'Use real data from API or database',
    },
    {
      regex: /uuid|uuidv4|nanoid.*["']\w{8}-\w{4}-\w{4}-\w{4}-\w{12}["']/gi,
      description: 'Hardcoded UUID detected',
      severity: 'warning',
      suggestion: 'Generate UUIDs dynamically or fetch from API',
    },
    {
      regex: /return\s+\[\s*\{[^}]*(?:id|name|title):[^}]*\}[^;]*\];/gm,
      description: 'Function returning hardcoded array of objects',
      severity: 'error',
      suggestion: 'Return data fetched from a real data source',
    },
    {
      regex: /["']John\s+Doe["']|["']Jane\s+Doe["']|["']Test\s+User["']/gi,
      description: 'Common placeholder name detected',
      severity: 'warning',
      suggestion: 'Use real user data or generate fake data only in tests',
    },
    {
      regex: /["']123-45-6789["']|["']555-\d{4}["']/g,
      description: 'Fake SSN or phone number pattern',
      severity: 'error',
      suggestion: 'Never hardcode sensitive data patterns',
    },
  ];

  private excludedDirs = [
    'node_modules',
    '.git',
    '.next',
    'dist',
    'build',
    'coverage',
    '__tests__',
    '__mocks__',
    'test',
    'tests',
    'spec',
    '__fixtures__',
    'fixtures',
  ];

  private excludedFiles = [
    '.test.',
    '.spec.',
    '.mock.',
    '.fixture.',
    'mock-data.',
    'test-utils.',
    'setupTests.',
  ];

  private includedExtensions = ['.ts', '.tsx', '.js', '.jsx', '.vue', '.svelte'];

  /**
   * Scan a directory for mock data patterns
   */
  async scanDirectory(directory: string): Promise<MockDataScanResult> {
    const files = await this.findFiles(directory);
    const allIssues: MockDataIssue[] = [];

    for (const file of files) {
      try {
        const content = await fs.readFile(file, 'utf-8');
        const issues = this.scanContent(content, file);
        allIssues.push(...issues.issues);
      } catch (error) {
        console.error(`Error scanning file ${file}:`, error);
      }
    }

    return {
      scanned: files.length,
      issues: allIssues,
      summary: {
        errors: allIssues.filter(i => i.severity === 'error').length,
        warnings: allIssues.filter(i => i.severity === 'warning').length,
        info: allIssues.filter(i => i.severity === 'info').length,
      },
      timestamp: new Date().toISOString(),
      directory,
    };
  }

  /**
   * Scan specific content for mock data patterns
   */
  scanContent(content: string, filename: string): { issues: MockDataIssue[]; filename: string } {
    const issues: MockDataIssue[] = [];
    const lines = content.split('\n');

    // Skip test files
    if (this.excludedFiles.some(pattern => filename.includes(pattern))) {
      return { issues: [], filename };
    }

    for (const pattern of this.patterns) {
      let match;
      // Reset regex lastIndex to ensure fresh matching
      pattern.regex.lastIndex = 0;
      
      while ((match = pattern.regex.exec(content)) !== null) {
        // Calculate line number
        const beforeMatch = content.substring(0, match.index);
        const lineNumber = beforeMatch.split('\n').length;
        const lineStart = beforeMatch.lastIndexOf('\n') + 1;
        const column = match.index - lineStart;

        // Get code snippet (the matched line with some context)
        const snippetStart = Math.max(0, lineNumber - 2);
        const snippetEnd = Math.min(lines.length, lineNumber + 1);
        const codeSnippet = lines.slice(snippetStart, snippetEnd).join('\n');

        issues.push({
          file: filename,
          line: lineNumber,
          column,
          pattern: match[0].substring(0, 100) + (match[0].length > 100 ? '...' : ''),
          description: pattern.description,
          severity: pattern.severity,
          codeSnippet,
          suggestion: pattern.suggestion,
        });

        // Prevent infinite loops with patterns that match empty strings
        if (match[0].length === 0) {
          pattern.regex.lastIndex++;
        }
      }
    }

    return { issues, filename };
  }

  /**
   * Recursively find all source files in a directory
   */
  private async findFiles(dir: string): Promise<string[]> {
    const files: string[] = [];

    try {
      const items = await fs.readdir(dir, { withFileTypes: true });

      for (const item of items) {
        const fullPath = path.join(dir, item.name);

        // Skip excluded directories
        if (item.isDirectory()) {
          if (!this.excludedDirs.includes(item.name) && !item.name.startsWith('.')) {
            const subFiles = await this.findFiles(fullPath);
            files.push(...subFiles);
          }
        } else if (item.isFile()) {
          // Check file extension
          const ext = path.extname(item.name);
          if (this.includedExtensions.includes(ext)) {
            files.push(fullPath);
          }
        }
      }
    } catch (error) {
      console.error(`Error reading directory ${dir}:`, error);
    }

    return files;
  }

  /**
   * Check if content contains mock data patterns (quick check)
   */
  detectMockData(content: string): boolean {
    for (const pattern of this.patterns) {
      pattern.regex.lastIndex = 0;
      if (pattern.regex.test(content)) {
        return true;
      }
    }
    return false;
  }
}

export const mockDataScanner = new MockDataScanner();
