/**
 * Path Validator
 * 
 * Validates API paths between frontend and backend
 */

const { apiEndpointTracker } = require('./api-endpoint-tracker.js');
const fs = require('fs');
const path = require('path');

class PathValidator {
  /**
   * Validate API paths in frontend code
   */
  validateFrontendPaths(projectPath = process.cwd()) {
    const result = {
      valid: true,
      errors: [],
      warnings: [],
    };

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
  findFrontendFiles(projectPath) {
    const files = [];
    const extensions = ['.ts', '.tsx', '.js', '.jsx'];
    const dirs = ['src', 'app', 'pages', 'components', 'lib', 'utils'];

    const scanDir = (dir) => {
      try {
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        
        for (const entry of entries) {
          const fullPath = path.join(dir, entry.name);
          
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
  validateFilePaths(content, filePath, projectPath) {
    const errors = [];
    const warnings = [];

    const fetchPattern = /(?:fetch|axios\.(?:get|post|put|delete|patch))\s*\(\s*['"`]([^'"`]+)['"`]/g;
    const lines = content.split('\n');
    
    let match;
    while ((match = fetchPattern.exec(content)) !== null) {
      const apiPath = match[1];
      const lineNumber = content.substring(0, match.index).split('\n').length;
      
      if (!apiPath.startsWith('/api')) {
        continue;
      }

      const method = this.extractMethod(content, match.index);
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
  extractMethod(content, index) {
    const before = content.substring(Math.max(0, index - 200), index);
    
    if (before.match(/\.post\s*\(/i)) return 'POST';
    if (before.match(/\.put\s*\(/i)) return 'PUT';
    if (before.match(/\.delete\s*\(/i)) return 'DELETE';
    if (before.match(/\.patch\s*\(/i)) return 'PATCH';
    if (before.match(/method:\s*['"](POST|PUT|DELETE|PATCH)['"]/i)) {
      const methodMatch = before.match(/method:\s*['"](POST|PUT|DELETE|PATCH)['"]/i);
      if (methodMatch) return methodMatch[1].toUpperCase();
    }
    
    return 'GET';
  }

  /**
   * Auto-fix path mismatches
   */
  autoFixPaths(filePath, projectPath = process.cwd()) {
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split('\n');
    const changes = [];
    
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
      changes.forEach(change => {
        lines[change.line - 1] = change.new;
      });
      
      fs.writeFileSync(filePath, lines.join('\n'));
      return { fixed: true, changes };
    }

    return { fixed: false, changes: [] };
  }
}

module.exports = { pathValidator: new PathValidator() };

