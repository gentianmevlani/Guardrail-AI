/**
 * Auto-Fix System
 * 
 * Automatically fixes common code issues detected by guardrails and polish service
 */

import * as fs from 'fs';
import * as path from 'path';
import type { PolishIssue } from './polish/types';
import { GuardrailRule } from './universal-guardrails';

export interface FixResult {
  success: boolean;
  file: string;
  changes: string[];
  errors?: string[];
}

export interface FixReport {
  totalFixed: number;
  totalFailed: number;
  results: FixResult[];
  summary: string;
}

class AutoFixer {
  /**
   * Fix a single issue
   */
  async fixIssue(issue: PolishIssue, projectPath: string): Promise<FixResult> {
    const result: FixResult = {
      success: false,
      file: issue.file || '',
      changes: [],
      errors: [],
    };

    try {
      switch (issue.id) {
        case 'missing-error-boundary':
          await this.fixMissingErrorBoundary(projectPath, result);
          break;
        case 'missing-404':
          await this.fixMissing404(projectPath, result);
          break;
        case 'missing-loading-states':
          await this.fixMissingLoadingStates(projectPath, result);
          break;
        case 'missing-empty-states':
          await this.fixMissingEmptyStates(projectPath, result);
          break;
        case 'no-console-log':
          await this.fixConsoleLog(issue.file!, projectPath, result);
          break;
        case 'no-any-type':
          await this.fixAnyType(issue.file!, projectPath, result);
          break;
        case 'no-relative-imports-deep':
          await this.fixDeepImports(issue.file!, projectPath, result);
          break;
        case 'no-unused-imports':
          await this.fixUnusedImports(issue.file!, projectPath, result);
          break;
        default:
          result.errors?.push(`No auto-fix strategy for issue: ${issue.id}`);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      result.errors?.push(errorMessage);
    }

    return result;
  }

  /**
   * Fix all auto-fixable issues
   */
  async fixAll(issues: PolishIssue[], projectPath: string): Promise<FixReport> {
    const autoFixable = issues.filter(i => i.autoFixable);
    const results: FixResult[] = [];
    let fixed = 0;
    let failed = 0;

    for (const issue of autoFixable) {
      const result = await this.fixIssue(issue, projectPath);
      if (result.success) {
        fixed++;
      } else {
        failed++;
      }
      results.push(result);
    }

    return {
      totalFixed: fixed,
      totalFailed: failed,
      results,
      summary: `Fixed ${fixed} issue(s), ${failed} failed`,
    };
  }

  /**
   * Fix missing error boundary
   */
  private async fixMissingErrorBoundary(projectPath: string, result: FixResult): Promise<void> {
    const srcPath = path.join(projectPath, 'src');
    const componentsPath = path.join(srcPath, 'components');
    
    // Create components directory if it doesn't exist
    if (!await this.pathExists(componentsPath)) {
      await fs.promises.mkdir(componentsPath, { recursive: true });
    }

    const errorBoundaryPath = path.join(componentsPath, 'ErrorBoundary.tsx');
    
    // Check if already exists
    if (await this.pathExists(errorBoundaryPath)) {
      result.errors?.push('ErrorBoundary already exists');
      return;
    }

    const template = `import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error('Error caught by boundary:', error, errorInfo);
    // TODO: Send to error reporting service (Sentry, etc.)
  }

  render(): ReactNode {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="error-boundary">
          <h2>Something went wrong</h2>
          <p>We're sorry, but something unexpected happened.</p>
          <button onClick={() => this.setState({ hasError: false })}>
            Try again
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
`;

    await fs.promises.writeFile(errorBoundaryPath, template);
    result.success = true;
    result.changes.push('Created ErrorBoundary component');
  }

  /**
   * Fix missing 404 page
   */
  private async fixMissing404(projectPath: string, result: FixResult): Promise<void> {
    const srcPath = path.join(projectPath, 'src');
    const pagesPath = path.join(srcPath, 'pages');
    
    // Try different locations
    const possiblePaths = [
      path.join(pagesPath, '404.tsx'),
      path.join(pagesPath, 'NotFound.tsx'),
      path.join(srcPath, 'app', 'not-found.tsx'),
      path.join(srcPath, 'pages', '404.tsx'),
    ];

    for (const filePath of possiblePaths) {
      if (await this.pathExists(filePath)) {
        result.errors?.push('404 page already exists');
        return;
      }
    }

    // Create pages directory if needed
    if (!await this.pathExists(pagesPath)) {
      await fs.promises.mkdir(pagesPath, { recursive: true });
    }

    const notFoundPath = path.join(pagesPath, 'NotFound.tsx');
    const template = `import { Link } from 'react-router-dom'; // or Next.js Link

export default function NotFound() {
  return (
    <div className="not-found">
      <h1>404</h1>
      <h2>Page Not Found</h2>
      <p>The page you're looking for doesn't exist.</p>
      <Link to="/">Go back home</Link>
    </div>
  );
}
`;

    await fs.promises.writeFile(notFoundPath, template);
    result.success = true;
    result.changes.push('Created NotFound page');
  }

  /**
   * Fix missing loading states
   */
  private async fixMissingLoadingStates(projectPath: string, result: FixResult): Promise<void> {
    const srcPath = path.join(projectPath, 'src');
    const componentsPath = path.join(srcPath, 'components');
    
    if (!await this.pathExists(componentsPath)) {
      await fs.promises.mkdir(componentsPath, { recursive: true });
    }

    const loadingPath = path.join(componentsPath, 'LoadingState.tsx');
    
    if (await this.pathExists(loadingPath)) {
      result.errors?.push('LoadingState already exists');
      return;
    }

    const template = `import React from 'react';

interface LoadingStateProps {
  message?: string;
  size?: 'sm' | 'md' | 'lg';
}

export function LoadingState({ message = 'Loading...', size = 'md' }: LoadingStateProps) {
  const sizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-8 h-8',
    lg: 'w-12 h-12',
  };

  return (
    <div className="loading-state flex items-center justify-center p-8">
      <div className="flex flex-col items-center gap-4">
        <div className={\`spinner border-4 border-gray-200 border-t-blue-600 rounded-full animate-spin \${sizeClasses[size]}\`} />
        {message && <p className="text-gray-600">{message}</p>}
      </div>
    </div>
  );
}

export function Spinner({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
  const sizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-8 h-8',
    lg: 'w-12 h-12',
  };

  return (
    <div className={\`spinner border-4 border-gray-200 border-t-blue-600 rounded-full animate-spin \${sizeClasses[size]}\`} />
  );
}
`;

    await fs.promises.writeFile(loadingPath, template);
    result.success = true;
    result.changes.push('Created LoadingState component');
  }

  /**
   * Fix missing empty states
   */
  private async fixMissingEmptyStates(projectPath: string, result: FixResult): Promise<void> {
    const srcPath = path.join(projectPath, 'src');
    const componentsPath = path.join(srcPath, 'components');
    
    if (!await this.pathExists(componentsPath)) {
      await fs.promises.mkdir(componentsPath, { recursive: true });
    }

    const emptyStatePath = path.join(componentsPath, 'EmptyState.tsx');
    
    if (await this.pathExists(emptyStatePath)) {
      result.errors?.push('EmptyState already exists');
      return;
    }

    const template = `import React from 'react';

interface EmptyStateProps {
  title: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
  icon?: React.ReactNode;
}

export function EmptyState({ title, description, action, icon }: EmptyStateProps) {
  return (
    <div className="empty-state flex flex-col items-center justify-center p-12 text-center">
      {icon && <div className="mb-4">{icon}</div>}
      <h3 className="text-xl font-semibold mb-2">{title}</h3>
      {description && <p className="text-gray-600 mb-6 max-w-md">{description}</p>}
      {action && (
        <button
          onClick={action.onClick}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          {action.label}
        </button>
      )}
    </div>
  );
}
`;

    await fs.promises.writeFile(emptyStatePath, template);
    result.success = true;
    result.changes.push('Created EmptyState component');
  }

  /**
   * Fix console.log statements
   */
  private async fixConsoleLog(filePath: string, projectPath: string, result: FixResult): Promise<void> {
    const fullPath = path.isAbsolute(filePath) ? filePath : path.join(projectPath, filePath);
    
    if (!await this.pathExists(fullPath)) {
      result.errors?.push(`File not found: ${filePath}`);
      return;
    }

    let content = await fs.promises.readFile(fullPath, 'utf8');
    const originalContent = content;

    // Replace console.log with logger
    content = content.replace(
      /console\.(log|debug)\(/g,
      'logger.info('
    );

    // Replace console.error with logger.error
    content = content.replace(
      /console\.error\(/g,
      'logger.error('
    );

    // Replace console.warn with logger.warn
    content = content.replace(
      /console\.warn\(/g,
      'logger.warn('
    );

    // Add logger import if not present
    if (content !== originalContent && !content.includes('import') && !content.includes('logger')) {
      const importStatement = "import { logger } from '@/lib/logger';\n";
      const lines = content.split('\n');
      const lastImportIndex = lines.findIndex(line => line.startsWith('import'));
      if (lastImportIndex >= 0) {
        lines.splice(lastImportIndex + 1, 0, importStatement);
      } else {
        lines.unshift(importStatement);
      }
      content = lines.join('\n');
    }

    if (content !== originalContent) {
      await fs.promises.writeFile(fullPath, content);
      result.success = true;
      result.changes.push('Replaced console.log with logger');
    } else {
      result.errors?.push('No console.log statements found');
    }
  }

  /**
   * Fix 'any' types
   */
  private async fixAnyType(filePath: string, projectPath: string, result: FixResult): Promise<void> {
    const fullPath = path.isAbsolute(filePath) ? filePath : path.join(projectPath, filePath);
    
    if (!await this.pathExists(fullPath)) {
      result.errors?.push(`File not found: ${filePath}`);
      return;
    }

    let content = await fs.promises.readFile(fullPath, 'utf8');
    const originalContent = content;

    // Replace : any with : unknown (safer default)
    content = content.replace(/:\s*any\b/g, ': unknown');

    if (content !== originalContent) {
      await fs.promises.writeFile(fullPath, content);
      result.success = true;
      result.changes.push('Replaced any types with unknown');
    } else {
      result.errors?.push('No any types found');
    }
  }

  /**
   * Fix deep relative imports
   */
  private async fixDeepImports(filePath: string, projectPath: string, result: FixResult): Promise<void> {
    const fullPath = path.isAbsolute(filePath) ? filePath : path.join(projectPath, filePath);
    
    if (!await this.pathExists(fullPath)) {
      result.errors?.push(`File not found: ${filePath}`);
      return;
    }

    let content = await fs.promises.readFile(fullPath, 'utf8');
    const originalContent = content;

    // Match deep relative imports (../../../)
    const deepImportRegex = /from\s+['"]\.\.\/\.\.\/\.\.\/(.+?)['"]/g;
    const matches = Array.from(content.matchAll(deepImportRegex));

    if (matches.length === 0) {
      result.errors?.push('No deep relative imports found');
      return;
    }

    // Replace with @ alias (simplified - would need proper path resolution)
    content = content.replace(deepImportRegex, "from '@/lib/$1'");

    if (content !== originalContent) {
      await fs.promises.writeFile(fullPath, content);
      result.success = true;
      result.changes.push(`Fixed ${matches.length} deep relative import(s)`);
    }
  }

  /**
   * Fix unused imports
   */
  private async fixUnusedImports(filePath: string, projectPath: string, result: FixResult): Promise<void> {
    const fullPath = path.isAbsolute(filePath) ? filePath : path.join(projectPath, filePath);
    
    if (!await this.pathExists(fullPath)) {
      result.errors?.push(`File not found: ${filePath}`);
      return;
    }

    // This is a simplified version - in production, use ESLint's unused import detection
    // For now, we'll just note that this should be handled by ESLint --fix
    result.errors?.push('Use ESLint --fix to remove unused imports automatically');
  }

  private async pathExists(p: string): Promise<boolean> {
    try {
      await fs.promises.access(p);
      return true;
    } catch {
      return false;
    }
  }
}

export const autoFixer = new AutoFixer();

