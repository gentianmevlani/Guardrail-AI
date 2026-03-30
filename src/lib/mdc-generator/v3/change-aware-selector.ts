/**
 * Change-Aware Selector
 * 
 * Git-diff driven context selection with dependency closure:
 * - Detects changed files (staged + unstaged)
 * - Computes dependency closure (imports + referenced symbols)
 * - Excludes node_modules, dist, build, .next, coverage, fixtures/examples
 */

import { execSync } from 'child_process';
import { existsSync, readFileSync } from 'fs';
import { join, relative, dirname } from 'path';
import * as ts from 'typescript';

export interface ChangedFile {
  path: string;
  relativePath: string;
  status: 'added' | 'modified' | 'deleted';
  diff?: string;
}

export interface DependencyClosure {
  changedFiles: ChangedFile[];
  dependentFiles: string[]; // Files that import/use changed files
  relatedSymbols: Array<{
    file: string;
    symbol: string;
    type: 'export' | 'import' | 'reference';
  }>;
}

export interface ChangeAwareOptions {
  projectPath: string;
  baseRef?: string; // Git ref (default: 'main' or 'master')
  includeStaged?: boolean;
  includeUnstaged?: boolean;
  excludePatterns?: string[];
  program?: ts.Program;
  checker?: ts.TypeChecker;
}

const DEFAULT_EXCLUDES = [
  'node_modules',
  'dist',
  'build',
  '.next',
  'out',
  'coverage',
  'fixtures',
  'examples',
  '*.min.*',
  '*.map',
  '*.snap',
  '*.lock',
];

export class ChangeAwareSelector {
  private options: Required<Omit<ChangeAwareOptions, 'baseRef' | 'program' | 'checker'>> & {
    baseRef?: string;
    program?: ts.Program;
    checker?: ts.TypeChecker;
  };

  constructor(options: ChangeAwareOptions) {
    this.options = {
      projectPath: options.projectPath,
      baseRef: options.baseRef,
      includeStaged: options.includeStaged ?? true,
      includeUnstaged: options.includeUnstaged ?? true,
      excludePatterns: [...DEFAULT_EXCLUDES, ...(options.excludePatterns || [])],
      program: options.program,
      checker: options.checker,
    };
  }

  /**
   * Get changed files from git
   */
  async getChangedFiles(): Promise<ChangedFile[]> {
    const changedFiles: ChangedFile[] = [];
    const gitDir = join(this.options.projectPath, '.git');

    if (!existsSync(gitDir)) {
      // Not a git repo - return empty (will scan all files in fallback)
      return [];
    }

    try {
      // Get base ref (default to main/master)
      const baseRef = this.options.baseRef || this.detectBaseBranch();

      // Get staged files
      if (this.options.includeStaged) {
        const staged = this.getGitFiles('--cached', baseRef);
        changedFiles.push(...staged);
      }

      // Get unstaged files
      if (this.options.includeUnstaged) {
        const unstaged = this.getGitFiles('', baseRef);
        // Dedupe (unstaged might overlap with staged)
        for (const file of unstaged) {
          if (!changedFiles.find(f => f.relativePath === file.relativePath)) {
            changedFiles.push(file);
          }
        }
      }

      // Filter out excluded patterns
      return changedFiles.filter(file => 
        !this.isExcluded(file.relativePath)
      );
    } catch (error) {
      // Git command failed - return empty
      return [];
    }
  }

  /**
   * Compute dependency closure for changed files
   */
  async computeDependencyClosure(changedFiles: ChangedFile[]): Promise<DependencyClosure> {
    const dependentFiles: Set<string> = new Set();
    const relatedSymbols: DependencyClosure['relatedSymbols'] = [];

    if (!this.options.program || !this.options.checker) {
      // No AST - return minimal closure
      return {
        changedFiles,
        dependentFiles: [],
        relatedSymbols: [],
      };
    }

    // For each changed file, find files that import it
    for (const changedFile of changedFiles) {
      if (changedFile.status === 'deleted') continue;

      const fullPath = join(this.options.projectPath, changedFile.relativePath);
      if (!existsSync(fullPath)) continue;

      // Find all files that import this file
      const importers = this.findImporters(fullPath);
      importers.forEach(imp => dependentFiles.add(imp));

      // Extract exported symbols
      const exports = this.extractExports(fullPath);
      relatedSymbols.push(...exports);
    }

    return {
      changedFiles,
      dependentFiles: Array.from(dependentFiles).filter(f => !this.isExcluded(f)),
      relatedSymbols,
    };
  }

  /**
   * Get git files with status
   */
  private getGitFiles(cachedFlag: string, baseRef: string): ChangedFile[] {
    try {
      const command = baseRef
        ? `git diff ${cachedFlag} --name-status ${baseRef}...HEAD`
        : `git diff ${cachedFlag} --name-status`;

      const output = execSync(command, {
        cwd: this.options.projectPath,
        encoding: 'utf8',
        stdio: ['pipe', 'pipe', 'pipe'],
      });

      const files: ChangedFile[] = [];
      const lines = output.split('\n').filter(l => l.trim());

      for (const line of lines) {
        const match = line.match(/^([AMD])\s+(.+)$/);
        if (match) {
          const [, status, filePath] = match;
          const relativePath = relative(this.options.projectPath, filePath);
          
          let changeStatus: ChangedFile['status'];
          if (status === 'A') changeStatus = 'added';
          else if (status === 'M') changeStatus = 'modified';
          else changeStatus = 'deleted';

          files.push({
            path: filePath,
            relativePath,
            status: changeStatus,
          });
        }
      }

      return files;
    } catch {
      return [];
    }
  }

  /**
   * Detect base branch (main or master)
   */
  private detectBaseBranch(): string {
    try {
      // Try main first
      execSync('git show-ref --verify --quiet refs/heads/main', {
        cwd: this.options.projectPath,
        stdio: 'ignore',
      });
      return 'main';
    } catch {
      // Fallback to master
      try {
        execSync('git show-ref --verify --quiet refs/heads/master', {
          cwd: this.options.projectPath,
          stdio: 'ignore',
        });
        return 'master';
      } catch {
        return 'HEAD~1'; // Fallback to previous commit
      }
    }
  }

  /**
   * Find files that import a given file
   */
  private findImporters(targetPath: string): string[] {
    const importers: string[] = [];
    if (!this.options.program) return importers;

    const sourceFile = this.options.program.getSourceFile(targetPath);
    if (!sourceFile) return importers;

    // Get all source files
    const allFiles = this.options.program.getSourceFiles();

    for (const file of allFiles) {
      if (file === sourceFile) continue;
      if (this.isExcluded(file.fileName)) continue;

      // Check if this file imports the target
      const imports = this.getImports(file);
      const targetModule = this.getModuleName(targetPath);
      
      if (imports.some(imp => imp === targetModule || imp.endsWith(targetModule))) {
        importers.push(relative(this.options.projectPath, file.fileName));
      }
    }

    return importers;
  }

  /**
   * Extract exports from a file
   */
  private extractExports(filePath: string): DependencyClosure['relatedSymbols'] {
    const symbols: DependencyClosure['relatedSymbols'] = [];
    if (!this.options.program || !this.options.checker) return symbols;

    const sourceFile = this.options.program.getSourceFile(filePath);
    if (!sourceFile) return symbols;

    const relativePath = relative(this.options.projectPath, filePath);

    const visit = (node: ts.Node) => {
      // Export declarations
      if (ts.isExportDeclaration(node) || ts.isExportAssignment(node)) {
        // Extract exported names
        if (ts.isExportDeclaration(node) && node.moduleSpecifier) {
          // Re-export
        } else {
          // Direct export
        }
      }

      // Named exports
      if (ts.isVariableStatement(node) && node.modifiers?.some(m => m.kind === ts.SyntaxKind.ExportKeyword)) {
        node.declarationList.declarations.forEach(decl => {
          if (ts.isIdentifier(decl.name)) {
            symbols.push({
              file: relativePath,
              symbol: decl.name.text,
              type: 'export',
            });
          }
        });
      }

      // Function/class exports
      if ((ts.isFunctionDeclaration(node) || ts.isClassDeclaration(node)) && 
          node.modifiers?.some(m => m.kind === ts.SyntaxKind.ExportKeyword)) {
        if (node.name) {
          symbols.push({
            file: relativePath,
            symbol: node.name.text,
            type: 'export',
          });
        }
      }

      ts.forEachChild(node, visit);
    };

    visit(sourceFile);
    return symbols;
  }

  /**
   * Get imports from a source file
   */
  private getImports(sourceFile: ts.SourceFile): string[] {
    const imports: string[] = [];

    const visit = (node: ts.Node) => {
      if (ts.isImportDeclaration(node) && node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) {
        imports.push(node.moduleSpecifier.text);
      }
      ts.forEachChild(node, visit);
    };

    visit(sourceFile);
    return imports;
  }

  /**
   * Get module name from file path
   */
  private getModuleName(filePath: string): string {
    // Remove extension
    const withoutExt = filePath.replace(/\.(ts|tsx|js|jsx)$/, '');
    // Normalize path separators
    return withoutExt.replace(/\\/g, '/');
  }

  /**
   * Check if path is excluded
   */
  private isExcluded(relativePath: string): boolean {
    const normalized = relativePath.replace(/\\/g, '/');
    
    return this.options.excludePatterns.some(pattern => {
      // Simple glob matching
      if (pattern.includes('*')) {
        const regex = new RegExp(pattern.replace(/\*/g, '.*'));
        return regex.test(normalized);
      }
      return normalized.includes(pattern);
    });
  }
}
