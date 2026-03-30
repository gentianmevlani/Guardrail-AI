/**
 * MockProof Build Gate - Import Graph Scanner
 * 
 * Scans the import graph from production entrypoints to detect
 * banned imports (MockProvider, useMock, mock-context, localhost, etc.)
 * that would ship to production.
 * 
 * This is the "one rule, one red line" feature that vibecoders love.
 */

import * as fs from 'fs';
import * as path from 'path';
import { stripeTestSkOrPkTestPatternString } from 'guardrail-security/secrets/stripe-placeholder-prefix';

export interface BannedImport {
  pattern: string;
  message: string;
  isRegex: boolean;
  allowedIn: string[];
}

export interface ImportNode {
  file: string;
  imports: string[];
  importedBy: string[];
}

export interface ViolationPath {
  entrypoint: string;
  bannedImport: string;
  importChain: string[];
  pattern: string;
  message: string;
}

export interface MockProofResult {
  verdict: 'pass' | 'fail';
  violations: ViolationPath[];
  scannedFiles: number;
  entrypoints: string[];
  timestamp: string;
  summary: {
    totalViolations: number;
    uniqueBannedImports: number;
    affectedEntrypoints: number;
  };
}

export interface MockProofConfig {
  entrypoints: string[];
  bannedImports: BannedImport[];
  excludeDirs: string[];
  includeExtensions: string[];
}

const DEFAULT_BANNED_IMPORTS: BannedImport[] = [
  {
    pattern: 'MockProvider',
    message: 'MockProvider should not be reachable from production entrypoints',
    isRegex: false,
    allowedIn: ['**/__tests__/**', '**/test/**', '**/stories/**', '**/landing/**', '**/*.test.*', '**/*.spec.*']
  },
  {
    pattern: 'useMock',
    message: 'useMock hook should not be reachable from production entrypoints',
    isRegex: false,
    allowedIn: ['**/__tests__/**', '**/test/**', '**/stories/**']
  },
  {
    pattern: 'mock-context',
    message: 'mock-context imports are not allowed in production',
    isRegex: false,
    allowedIn: ['**/__tests__/**', '**/test/**']
  },
  {
    pattern: 'localhost:\\d+',
    message: 'Hardcoded localhost URLs will break in production',
    isRegex: true,
    allowedIn: ['**/*.test.*', '**/*.spec.*', '**/docs/**', '**/.env.example', '**/e2e/**']
  },
  {
    pattern: 'jsonplaceholder\\.typicode\\.com',
    message: 'JSONPlaceholder is a mock API - not for production',
    isRegex: true,
    allowedIn: ['**/__tests__/**', '**/docs/**', '**/examples/**']
  },
  {
    pattern: '\\.ngrok\\.io',
    message: 'ngrok URLs are temporary and will break in production',
    isRegex: true,
    allowedIn: ['**/__tests__/**', '**/docs/**']
  },
  {
    pattern: stripeTestSkOrPkTestPatternString(),
    message: 'Test API keys should not be in production code',
    isRegex: true,
    allowedIn: ['**/__tests__/**', '**/docs/**', '**/*.example']
  },
  {
    pattern: 'demo_|inv_demo|fake_',
    message: 'Demo/fake identifiers detected - not for production',
    isRegex: true,
    allowedIn: ['**/__tests__/**', '**/docs/**']
  },
  {
    pattern: 'DEMO_MODE|MOCK_MODE|USE_MOCKS',
    message: 'Feature flags for mock mode detected',
    isRegex: true,
    allowedIn: ['**/__tests__/**', '**/.env.example']
  }
];

const DEFAULT_CONFIG: MockProofConfig = {
  entrypoints: [
    'src/app/layout.tsx',
    'src/app/page.tsx',
    'src/pages/_app.tsx',
    'src/pages/index.tsx',
    'src/index.tsx',
    'src/main.tsx',
    'apps/web-ui/src/app/layout.tsx',
    'apps/web-ui/src/app/page.tsx',
    'apps/api/src/index.ts',
    'apps/api/src/main.ts'
  ],
  bannedImports: DEFAULT_BANNED_IMPORTS,
  excludeDirs: [
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
    'e2e',
    'stories',
    '.storybook'
  ],
  includeExtensions: ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs']
};

export class ImportGraphScanner {
  private config: MockProofConfig;
  private importGraph: Map<string, ImportNode> = new Map();
  private fileContents: Map<string, string> = new Map();

  constructor(config: Partial<MockProofConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Scan a project for banned imports reachable from production entrypoints
   */
  async scan(projectPath: string): Promise<MockProofResult> {
    this.importGraph.clear();
    this.fileContents.clear();

    // 1. Find all source files
    const files = await this.findSourceFiles(projectPath);
    
    // 2. Build import graph
    for (const file of files) {
      await this.parseFile(file, projectPath);
    }

    // 3. Find valid entrypoints
    const validEntrypoints = this.config.entrypoints
      .map(ep => path.join(projectPath, ep))
      .filter(ep => fs.existsSync(ep));

    // 4. Trace from entrypoints to find violations
    const violations: ViolationPath[] = [];

    for (const entrypoint of validEntrypoints) {
      const entrypointViolations = this.traceFromEntrypoint(entrypoint, projectPath);
      violations.push(...entrypointViolations);
    }

    // 5. Build result
    const uniqueBanned = new Set(violations.map(v => v.bannedImport));
    const affectedEntrypoints = new Set(violations.map(v => v.entrypoint));

    return {
      verdict: violations.length > 0 ? 'fail' : 'pass',
      violations,
      scannedFiles: this.importGraph.size,
      entrypoints: validEntrypoints.map(ep => path.relative(projectPath, ep)),
      timestamp: new Date().toISOString(),
      summary: {
        totalViolations: violations.length,
        uniqueBannedImports: uniqueBanned.size,
        affectedEntrypoints: affectedEntrypoints.size
      }
    };
  }

  /**
   * Find all source files in the project
   */
  private async findSourceFiles(projectPath: string): Promise<string[]> {
    const files: string[] = [];
    
    const walk = async (dir: string): Promise<void> => {
      try {
        const entries = await fs.promises.readdir(dir, { withFileTypes: true });
        
        for (const entry of entries) {
          const fullPath = path.join(dir, entry.name);
          
          if (entry.isDirectory()) {
            // Skip excluded directories
            if (!this.config.excludeDirs.includes(entry.name) && !entry.name.startsWith('.')) {
              await walk(fullPath);
            }
          } else if (entry.isFile()) {
            const ext = path.extname(entry.name);
            if (this.config.includeExtensions.includes(ext)) {
              files.push(fullPath);
            }
          }
        }
      } catch (error) {
        // Skip directories that can't be read
      }
    };

    await walk(projectPath);
    return files;
  }

  /**
   * Parse a file and extract its imports
   */
  private async parseFile(filePath: string, projectPath: string): Promise<void> {
    try {
      const content = await fs.promises.readFile(filePath, 'utf-8');
      this.fileContents.set(filePath, content);

      const imports = this.extractImports(content, filePath, projectPath);
      
      const node: ImportNode = {
        file: filePath,
        imports,
        importedBy: []
      };

      this.importGraph.set(filePath, node);

      // Update importedBy for resolved imports
      for (const imp of imports) {
        const resolved = this.resolveImport(imp, filePath, projectPath);
        if (resolved && this.importGraph.has(resolved)) {
          this.importGraph.get(resolved)!.importedBy.push(filePath);
        }
      }
    } catch (error) {
      // Skip files that can't be read
    }
  }

  /**
   * Extract import statements from file content
   */
  private extractImports(content: string, filePath: string, projectPath: string): string[] {
    const imports: string[] = [];
    
    // ES6 imports: import X from 'Y', import { X } from 'Y', import 'Y'
    const es6ImportRegex = /import\s+(?:(?:\{[^}]*\}|[\w*]+(?:\s+as\s+\w+)?|\*\s+as\s+\w+)\s+from\s+)?['"]([^'"]+)['"]/g;
    let match;
    while ((match = es6ImportRegex.exec(content)) !== null) {
      imports.push(match[1]);
    }

    // Dynamic imports: import('Y')
    const dynamicImportRegex = /import\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
    while ((match = dynamicImportRegex.exec(content)) !== null) {
      imports.push(match[1]);
    }

    // CommonJS requires: require('Y')
    const requireRegex = /require\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
    while ((match = requireRegex.exec(content)) !== null) {
      imports.push(match[1]);
    }

    return imports;
  }

  /**
   * Resolve an import path to an absolute file path
   */
  private resolveImport(importPath: string, fromFile: string, projectPath: string): string | null {
    // Skip node_modules imports
    if (!importPath.startsWith('.') && !importPath.startsWith('/') && !importPath.startsWith('@/')) {
      return null;
    }

    const fromDir = path.dirname(fromFile);
    let resolved: string;

    if (importPath.startsWith('@/')) {
      // Alias resolution (common in Next.js/React projects)
      resolved = path.join(projectPath, 'src', importPath.slice(2));
    } else {
      resolved = path.resolve(fromDir, importPath);
    }

    // Try different extensions
    for (const ext of ['', '.ts', '.tsx', '.js', '.jsx', '/index.ts', '/index.tsx', '/index.js', '/index.jsx']) {
      const candidate = resolved + ext;
      if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
        return candidate;
      }
    }

    return null;
  }

  /**
   * Trace from an entrypoint to find all reachable files with violations
   */
  private traceFromEntrypoint(entrypoint: string, projectPath: string): ViolationPath[] {
    const violations: ViolationPath[] = [];
    const visited = new Set<string>();
    const queue: Array<{ file: string; chain: string[] }> = [{ file: entrypoint, chain: [entrypoint] }];

    while (queue.length > 0) {
      const { file, chain } = queue.shift()!;
      
      if (visited.has(file)) continue;
      visited.add(file);

      const content = this.fileContents.get(file);
      if (!content) continue;

      // Check for banned patterns in file content
      for (const banned of this.config.bannedImports) {
        if (this.isFileAllowed(file, banned.allowedIn, projectPath)) {
          continue;
        }

        const regex = banned.isRegex 
          ? new RegExp(banned.pattern, 'g')
          : new RegExp(this.escapeRegex(banned.pattern), 'g');

        if (regex.test(content)) {
          violations.push({
            entrypoint: path.relative(projectPath, entrypoint),
            bannedImport: path.relative(projectPath, file),
            importChain: chain.map(f => path.relative(projectPath, f)),
            pattern: banned.pattern,
            message: banned.message
          });
        }
      }

      // Add imports to queue
      const node = this.importGraph.get(file);
      if (node) {
        for (const imp of node.imports) {
          const resolved = this.resolveImport(imp, file, projectPath);
          if (resolved && !visited.has(resolved)) {
            queue.push({ file: resolved, chain: [...chain, resolved] });
          }
        }
      }
    }

    return violations;
  }

  /**
   * Check if a file matches any allowed patterns
   */
  private isFileAllowed(file: string, allowedPatterns: string[], projectPath: string): boolean {
    const relativePath = path.relative(projectPath, file);
    
    for (const pattern of allowedPatterns) {
      if (this.matchGlob(relativePath, pattern)) {
        return true;
      }
    }
    
    return false;
  }

  /**
   * Simple glob matching
   */
  private matchGlob(filePath: string, pattern: string): boolean {
    // Convert glob to regex
    const regexPattern = pattern
      .replace(/\*\*/g, '{{DOUBLE_STAR}}')
      .replace(/\*/g, '[^/]*')
      .replace(/\{\{DOUBLE_STAR\}\}/g, '.*')
      .replace(/\?/g, '.');
    
    const regex = new RegExp(`^${regexPattern}$`);
    return regex.test(filePath.replace(/\\/g, '/'));
  }

  /**
   * Escape special regex characters
   */
  private escapeRegex(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  /**
   * Generate a human-readable report
   */
  generateReport(result: MockProofResult): string {
    const lines: string[] = [];
    
    lines.push('╔══════════════════════════════════════════════════════════════╗');
    lines.push('║           🛡️  MockProof Build Gate Report  🛡️               ║');
    lines.push('╚══════════════════════════════════════════════════════════════╝');
    lines.push('');

    if (result.verdict === 'pass') {
      lines.push('✅ VERDICT: PASS - No banned imports reachable from production');
      lines.push('');
      lines.push(`   Scanned ${result.scannedFiles} files from ${result.entrypoints.length} entrypoints`);
    } else {
      lines.push('❌ VERDICT: FAIL - Banned imports detected in production code');
      lines.push('');
      lines.push(`   Found ${result.summary.totalViolations} violations`);
      lines.push(`   ${result.summary.uniqueBannedImports} unique banned patterns`);
      lines.push(`   ${result.summary.affectedEntrypoints} affected entrypoints`);
      lines.push('');
      lines.push('─'.repeat(64));
      lines.push('');

      // Group violations by entrypoint
      const byEntrypoint = new Map<string, ViolationPath[]>();
      for (const v of result.violations) {
        if (!byEntrypoint.has(v.entrypoint)) {
          byEntrypoint.set(v.entrypoint, []);
        }
        byEntrypoint.get(v.entrypoint)!.push(v);
      }

      byEntrypoint.forEach((violations, entrypoint) => {
        lines.push(`📍 Entrypoint: ${entrypoint}`);
        lines.push('');
        
        for (const v of violations) {
          lines.push(`   ❌ ${v.pattern}`);
          lines.push(`      Message: ${v.message}`);
          lines.push(`      Found in: ${v.bannedImport}`);
          lines.push(`      Import chain:`);
          for (let i = 0; i < v.importChain.length; i++) {
            const prefix = i === 0 ? '      📦' : '         ↓';
            lines.push(`${prefix} ${v.importChain[i]}`);
          }
          lines.push('');
        }
      });
    }

    lines.push('─'.repeat(64));
    lines.push(`Generated: ${result.timestamp}`);
    
    return lines.join('\n');
  }
}

export const importGraphScanner = new ImportGraphScanner();
