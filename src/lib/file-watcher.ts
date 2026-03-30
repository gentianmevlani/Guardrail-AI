/**
 * File Watcher
 * 
 * Watches for file changes and automatically updates registries
 */

import * as chokidar from 'chokidar';
import * as fs from 'fs';
import * as path from 'path';
import { apiEndpointTracker } from './api-endpoint-tracker';

export interface FileChange {
  type: 'created' | 'modified' | 'deleted';
  filePath: string;
  timestamp: string;
}

class FileWatcher {
  private watcher: chokidar.FSWatcher | null = null;
  private projectPath: string;
  private isWatching: boolean = false;
  private changeHandlers: Array<(change: FileChange) => void> = [];

  constructor(projectPath: string = process.cwd()) {
    this.projectPath = projectPath;
  }

  /**
   * Start watching for changes
   */
  startWatching(patterns: string[] = ['**/*.ts', '**/*.tsx', '**/*.js', '**/*.jsx']): void {
    if (this.isWatching) {
      return;
    }

    const watchPaths = patterns.map(p => path.join(this.projectPath, p));

    this.watcher = chokidar.watch(watchPaths, {
      ignored: [
        /node_modules/,
        /\.git/,
        /\.next/,
        /\.guardrail/,
        /dist/,
        /build/,
      ],
      persistent: true,
      ignoreInitial: true,
    });

    this.watcher
      .on('add', (filePath) => this.handleFileChange('created', filePath))
      .on('change', (filePath) => this.handleFileChange('modified', filePath))
      .on('unlink', (filePath) => this.handleFileChange('deleted', filePath));

    this.isWatching = true;
  }

  /**
   * Stop watching
   */
  stopWatching(): void {
    if (this.watcher) {
      this.watcher.close();
      this.watcher = null;
      this.isWatching = false;
    }
  }

  /**
   * Register change handler
   */
  onChange(handler: (change: FileChange) => void): void {
    this.changeHandlers.push(handler);
  }

  /**
   * Handle file change
   */
  private handleFileChange(type: FileChange['type'], filePath: string): void {
    const change: FileChange = {
      type,
      filePath,
      timestamp: new Date().toISOString(),
    };

    // Notify handlers
    this.changeHandlers.forEach(handler => {
      try {
        handler(change);
      } catch (error) {
        console.error('Error in change handler:', error);
      }
    });

    // Auto-detect and register API endpoints
    if (type !== 'deleted' && this.isAPIFile(filePath)) {
      this.scanForEndpoints(filePath);
    }
  }

  /**
   * Check if file is an API file
   */
  private isAPIFile(filePath: string): boolean {
    return (
      filePath.includes('/api/') ||
      filePath.includes('/routes/') ||
      filePath.includes('/endpoints/') ||
      filePath.match(/route\.(ts|tsx|js|jsx)$/) !== null
    );
  }

  /**
   * Scan file for API endpoints
   */
  private scanForEndpoints(filePath: string): void {
    try {
      const content = fs.readFileSync(filePath, 'utf8');
      this.extractEndpoints(content, filePath);
    } catch (error) {
      // File might not exist yet
    }
  }

  /**
   * Extract endpoints from code
   */
  private extractEndpoints(content: string, filePath: string): void {
    // Match Express routes: app.get('/path', handler)
    const expressPattern = /(?:app|router)\.(get|post|put|delete|patch)\s*\(\s*['"`]([^'"`]+)['"`]\s*,\s*(\w+)/g;
    let match;
    
    while ((match = expressPattern.exec(content)) !== null) {
      const method = match[1].toUpperCase() as any;
      const path = match[2];
      const handler = match[3];
      
      apiEndpointTracker.registerEndpoint(method, path, filePath, handler, {
        description: `Auto-detected from ${path.basename(filePath)}`,
      });
    }

    // Match Next.js API routes: export async function GET/POST/etc
    const nextjsPattern = /export\s+(?:async\s+)?function\s+(GET|POST|PUT|DELETE|PATCH)\s*\(/g;
    while ((match = nextjsPattern.exec(content)) !== null) {
      const method = match[1] as any;
      const routePath = this.extractNextJSPath(filePath);
      
      apiEndpointTracker.registerEndpoint(method, routePath, filePath, method, {
        description: `Auto-detected Next.js API route`,
      });
    }
  }

  /**
   * Extract path from Next.js route file
   */
  private extractNextJSPath(filePath: string): string {
    // Convert /app/api/users/route.ts to /api/users
    const apiMatch = filePath.match(/\/api\/(.+?)\/route\.(ts|tsx|js|jsx)$/);
    if (apiMatch) {
      return `/api/${apiMatch[1]}`;
    }
    
    // Convert /pages/api/users/index.ts to /api/users
    const pagesMatch = filePath.match(/\/pages\/api\/(.+?)(?:\/index)?\.(ts|tsx|js|jsx)$/);
    if (pagesMatch) {
      return `/api/${pagesMatch[1]}`;
    }
    
    return '/api/unknown';
  }
}

export const fileWatcher = new FileWatcher();

