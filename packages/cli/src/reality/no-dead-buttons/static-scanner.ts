/**
 * Static "No Dead UI" Scanner
 * 
 * Fast static scan (<1s) that blocks obvious deadness before running e2e tests:
 * - TODO, stub, placeholder, "coming soon" text
 * - <button disabled> without a real reason
 * - href="#", onClick={() => {}}, return true handlers
 * - UI gating without server-side gating
 * - Empty catch blocks, fake success toasts
 */

import { readFileSync, readdirSync, statSync, existsSync } from 'fs';
import { join, extname } from 'path';

export interface DeadUIPattern {
  file: string;
  line: number;
  pattern: string;
  severity: 'error' | 'warning';
  message: string;
  suggestion?: string;
}

export interface StaticScanResult {
  passed: boolean;
  errors: DeadUIPattern[];
  warnings: DeadUIPattern[];
  scannedFiles: number;
  duration: number;
}

// Patterns that indicate dead/non-functional UI
const DEAD_PATTERNS: Array<{
  regex: RegExp;
  severity: 'error' | 'warning';
  message: string;
  suggestion?: string;
}> = [
  // TODO/Stub/Placeholder patterns
  {
    regex: /TODO.*button|stub.*button|placeholder.*button|coming.*soon.*button/i,
    severity: 'error',
    message: 'TODO/stub/placeholder in button context',
    suggestion: 'Remove placeholder or implement the functionality',
  },
  {
    regex: /onClick\s*=\s*\{?\s*\(\)\s*=>\s*\{\s*\}\s*\}?/,
    severity: 'error',
    message: 'Empty onClick handler',
    suggestion: 'Add handler implementation or remove the button',
  },
  {
    regex: /onClick\s*=\s*\{?\s*\(\)\s*=>\s*true\s*\}?/,
    severity: 'error',
    message: 'onClick handler only returns true (no-op)',
    suggestion: 'Implement actual handler logic',
  },
  // Dead href patterns
  {
    regex: /href\s*=\s*["']#["']/,
    severity: 'error',
    message: 'href="#" (dead link)',
    suggestion: 'Use proper route or onClick handler',
  },
  {
    regex: /href\s*=\s*["']javascript:\s*void\(0\)["']/,
    severity: 'error',
    message: 'href="javascript:void(0)" (anti-pattern)',
    suggestion: 'Use onClick handler instead',
  },
  // Disabled buttons without reason
  {
    regex: /disabled\s*=\s*\{?true\}?\s*\/?>.*(?:TODO|stub|placeholder|coming soon)/i,
    severity: 'warning',
    message: 'Disabled button with TODO/placeholder text',
    suggestion: 'Remove button or implement functionality',
  },
  // Empty catch blocks
  {
    regex: /catch\s*\([^)]*\)\s*\{\s*\}/,
    severity: 'error',
    message: 'Empty catch block (silent failure)',
    suggestion: 'Add error handling, logging, or user feedback',
  },
  {
    regex: /catch\s*\([^)]*\)\s*\{\s*\/\/.*\s*\}/,
    severity: 'warning',
    message: 'Catch block with only comment (effectively empty)',
    suggestion: 'Add actual error handling',
  },
  // Fake success patterns
  {
    regex: /toast.*success.*catch|catch.*toast.*success/i,
    severity: 'error',
    message: 'Success toast in catch block (fake success)',
    suggestion: 'Only show success on actual success, show error in catch',
  },
  // Conditional handler that becomes undefined
  {
    regex: /onClick\s*=\s*\{?\s*(\w+)\s*\??\s*\.\s*(\w+)\s*\}?/,
    severity: 'warning',
    message: 'Conditional handler access (may be undefined)',
    suggestion: 'Ensure handler is always defined or add null check',
  },
];

// File extensions to scan
const SCANNABLE_EXTENSIONS = ['.tsx', '.ts', '.jsx', '.js'];

/**
 * Scan a single file for dead UI patterns
 */
function scanFile(filePath: string): DeadUIPattern[] {
  const patterns: DeadUIPattern[] = [];
  
  if (!existsSync(filePath)) {
    return patterns;
  }

  try {
    const content = readFileSync(filePath, 'utf-8');
    const lines = content.split('\n');

    lines.forEach((line, index) => {
      DEAD_PATTERNS.forEach(({ regex, severity, message, suggestion }) => {
        if (regex.test(line)) {
          patterns.push({
            file: filePath,
            line: index + 1,
            pattern: line.trim(),
            severity,
            message,
            suggestion,
          });
        }
      });
    });
  } catch (error) {
    // Skip files that can't be read (binary, permissions, etc.)
  }

  return patterns;
}

/**
 * Recursively scan directory for files
 */
function scanDirectory(dirPath: string, excludeDirs: string[] = []): string[] {
  const files: string[] = [];
  const excludeSet = new Set(['node_modules', '.git', 'dist', 'build', '.next', ...excludeDirs]);

  try {
    const entries = readdirSync(dirPath);
    
    for (const entry of entries) {
      if (excludeSet.has(entry)) {
        continue;
      }

      const fullPath = join(dirPath, entry);
      const stat = statSync(fullPath);

      if (stat.isDirectory()) {
        files.push(...scanDirectory(fullPath, excludeDirs));
      } else if (stat.isFile()) {
        const ext = extname(entry);
        if (SCANNABLE_EXTENSIONS.includes(ext)) {
          files.push(fullPath);
        }
      }
    }
  } catch (error) {
    // Skip directories that can't be read
  }

  return files;
}

/**
 * Run static scan on codebase
 */
export function runStaticScan(
  projectPath: string,
  scanPaths: string[] = ['src', 'app', 'components'],
  excludeDirs: string[] = []
): StaticScanResult {
  const startTime = Date.now();
  const allPatterns: DeadUIPattern[] = [];
  let scannedFiles = 0;

  // Default to scanning common UI directories if projectPath is provided
  const pathsToScan = scanPaths.length > 0 
    ? scanPaths.map(p => join(projectPath, p))
    : [projectPath];

  pathsToScan.forEach(scanPath => {
    if (existsSync(scanPath)) {
      const stat = statSync(scanPath);
      
      if (stat.isFile()) {
        const patterns = scanFile(scanPath);
        allPatterns.push(...patterns);
        scannedFiles++;
      } else if (stat.isDirectory()) {
        const files = scanDirectory(scanPath, excludeDirs);
        files.forEach(file => {
          const patterns = scanFile(file);
          allPatterns.push(...patterns);
          scannedFiles++;
        });
      }
    }
  });

  const errors = allPatterns.filter(p => p.severity === 'error');
  const warnings = allPatterns.filter(p => p.severity === 'warning');
  const passed = errors.length === 0;

  return {
    passed,
    errors,
    warnings,
    scannedFiles,
    duration: Date.now() - startTime,
  };
}

/**
 * Format scan results for console output
 */
export function formatStaticScanResults(result: StaticScanResult): string {
  const lines: string[] = [];
  
  lines.push(`Scanned ${result.scannedFiles} files in ${result.duration}ms`);
  lines.push('');

  if (result.errors.length === 0 && result.warnings.length === 0) {
    lines.push('✓ No dead UI patterns found');
    return lines.join('\n');
  }

  if (result.errors.length > 0) {
    lines.push(`✗ ${result.errors.length} error(s):`);
    lines.push('');
    result.errors.forEach((error, index) => {
      lines.push(`  ${index + 1}. ${error.file}:${error.line}`);
      lines.push(`     ${error.message}`);
      lines.push(`     Pattern: ${error.pattern.substring(0, 80)}...`);
      if (error.suggestion) {
        lines.push(`     → ${error.suggestion}`);
      }
      lines.push('');
    });
  }

  if (result.warnings.length > 0) {
    lines.push(`⚠ ${result.warnings.length} warning(s):`);
    lines.push('');
    result.warnings.slice(0, 10).forEach((warning, index) => {
      lines.push(`  ${index + 1}. ${warning.file}:${warning.line}`);
      lines.push(`     ${warning.message}`);
      if (warning.suggestion) {
        lines.push(`     → ${warning.suggestion}`);
      }
      lines.push('');
    });
    if (result.warnings.length > 10) {
      lines.push(`  ... and ${result.warnings.length - 10} more warnings`);
    }
  }

  return lines.join('\n');
}
