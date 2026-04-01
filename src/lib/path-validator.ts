/**
 * Path Validator
 * 
 * Validates API paths between frontend and backend
 */

import { apiEndpointTracker } from './api-endpoint-tracker';
import * as fs from 'fs';
import * as path from 'path';

export interface PathValidationResult {
  valid: boolean;
  errors: Array<{
    file: string;
    line?: number;
    path: string;
    method: string;
    issue: string;
    suggestion?: string;
  }>;
  warnings: Array<{
    file: string;
    line?: number;
    path: string;
    issue: string;
  }>;
}

class PathValidator {
  /**
   * Validate API paths in frontend code
   */
  validateFrontendPaths(projectPath: string = process.cwd()): PathValidationResult {
    const result: PathValidationResult = {
      valid: true,
      errors: [],
      warnings: [],
    };

    // Find frontend files
    const frontendFiles = this.findFrontendFiles(projectPath);

    frontendFiles.forEach(file => {
      const content = fs.readFileSync(file, 'utf8');
      const issues = this.validateFilePaths(content, file, projectPath);
      
      result.errors.push(...issues.errors);
      result.warnings.push(...issues.warnings);
    });

    result.valid = result.errors.length === 0;
    return result;
  }

  /**
   * Find frontend files
   */
  private findFrontendFiles(projectPath: string): string[] {
    const files: string[] = [];
    const extensions = ['.ts', '.tsx', '.js', '.jsx'];
    const dirs = ['src', 'app', 'pages', 'components', 'lib', 'utils'];

    const scanDir = (dir: string): void => {
      try {
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        
        for (const entry of entries) {
          const fullPath = path.join(dir, entry.name);
          
          // Skip certain directories
          if (entry.isDirectory()) {
            if (!entry.name.startsWith('.') && 
                !['node_modules', 'dist', 'build', '.next'].includes(entry.name)) {
              scanDir(fullPath);
            }
          } else if (entry.isFile()) {
            const ext = path.extname(entry.name);
            if (extensions.includes(ext)) {
              files.push(fullPath);
            }
          }
        }
      } catch {
        // Skip if can't read
      }
    };

    dirs.forEach(dir => {
      const dirPath = path.join(projectPath, dir);
      if (fs.existsSync(dirPath)) {
        scanDir(dirPath);
      }
    });

    return files;
  }

  /**
   * Validate paths in a file
   */
  private validateFilePaths(
    content: string,
    filePath: string,
    projectPath: string
  ): { errors: PathValidationResult['errors']; warnings: PathValidationResult['warnings'] } {
    const errors: PathValidationResult['errors'] = [];
    const warnings: PathValidationResult['warnings'] = [];

    // Match fetch/axios calls
    const fetchPattern = /(?:fetch|axios\.(?:get|post|put|delete|patch))\s*\(\s*['"`]([^'"`]+)['"`]/g;
    const lines = content.split('\n');
    
    let match;
    while ((match = fetchPattern.exec(content)) !== null) {
      const apiPath = match[1];
      const lineNumber = content.substring(0, match.index).split('\n').length;
      
      // Skip if not an API path
      if (!apiPath.startsWith('/api')) {
        continue;
      }

      // Extract method from context
      const method = this.extractMethod(content, match.index);
      
      // Validate path exists
      const validation = apiEndpointTracker.validatePath(method, apiPath);
      
      if (!validation.valid) {
        errors.push({
          file: path.relative(projectPath, filePath),
          line: lineNumber,
          path: apiPath,
          method,
          issue: 'API endpoint not found in registry',
          suggestion: validation.suggestions?.[0],
        });
      } else {
        // Check if path matches exactly
        if (validation.endpoint && validation.endpoint.fullPath !== apiPath) {
          warnings.push({
            file: path.relative(projectPath, filePath),
            line: lineNumber,
            path: apiPath,
            issue: `Path mismatch. Expected: ${validation.endpoint.fullPath}`,
          });
        }
      }
    }

    return { errors, warnings };
  }

  /**
   * Extract HTTP method from code context
   */
  private extractMethod(content: string, index: number): 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' {
    // Look backwards for method hint
    const before = content.substring(Math.max(0, index - 200), index);
    
    if (before.match(/\.post\s*\(/i)) return 'POST';
    if (before.match(/\.put\s*\(/i)) return 'PUT';
    if (before.match(/\.delete\s*\(/i)) return 'DELETE';
    if (before.match(/\.patch\s*\(/i)) return 'PATCH';
    if (before.match(/method:\s*['"](POST|PUT|DELETE|PATCH)['"]/i)) {
      const methodMatch = before.match(/method:\s*['"](POST|PUT|DELETE|PATCH)['"]/i);
      if (methodMatch) return methodMatch[1].toUpperCase() as any;
    }
    
    // Default to GET
    return 'GET';
  }

  /**
   * Auto-fix path mismatches
   */
  autoFixPaths(filePath: string, projectPath: string = process.cwd()): {
    fixed: boolean;
    changes: Array<{ line: number; old: string; new: string }>;
  } {
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split('\n');
    const changes: Array<{ line: number; old: string; new: string }> = [];
    
    lines.forEach((line, index) => {
      const fetchMatch = line.match(/(?:fetch|axios\.(?:get|post|put|delete|patch))\s*\(\s*['"`]([^'"`]+)['"`]/);
      if (fetchMatch && fetchMatch[1].startsWith('/api')) {
        const apiPath = fetchMatch[1];
        const method = this.extractMethod(content, content.indexOf(line));
        const validation = apiEndpointTracker.validatePath(method, apiPath);
        
        if (validation.endpoint && validation.endpoint.fullPath !== apiPath) {
          const newLine = line.replace(apiPath, validation.endpoint.fullPath);
          changes.push({
            line: index + 1,
            old: line,
            new: newLine,
          });
        }
      }
    });

    if (changes.length > 0) {
      // Apply changes
      changes.forEach(change => {
        lines[change.line - 1] = change.new;
      });
      
      fs.writeFileSync(filePath, lines.join('\n'));
      return { fixed: true, changes };
    }

    return { fixed: false, changes: [] };
  }
}

export const pathValidator = new PathValidator();

