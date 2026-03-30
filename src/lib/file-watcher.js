/**
 * File Watcher
 * 
 * Watches for file changes and automatically updates registries
 */

const chokidar = require('chokidar');
const fs = require('fs');
const path = require('path');
const { apiEndpointTracker } = require('./api-endpoint-tracker.js');

class FileWatcher {
  constructor(projectPath = process.cwd()) {
    this.projectPath = projectPath;
    this.watcher = null;
    this.isWatching = false;
    this.changeHandlers = [];
  }

  /**
   * Start watching for changes
   */
  startWatching(patterns = ['**/*.ts', '**/*.tsx', '**/*.js', '**/*.jsx']) {
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
  stopWatching() {
    if (this.watcher) {
      this.watcher.close();
      this.watcher = null;
      this.isWatching = false;
    }
  }

  /**
   * Register change handler
   */
  onChange(handler) {
    this.changeHandlers.push(handler);
  }

  /**
   * Handle file change
   */
  handleFileChange(type, filePath) {
    const change = {
      type,
      filePath,
      timestamp: new Date().toISOString(),
    };

    this.changeHandlers.forEach(handler => {
      try {
        handler(change);
      } catch (error) {
        console.error('Error in change handler:', error);
      }
    });

    if (type !== 'deleted' && this.isAPIFile(filePath)) {
      this.scanForEndpoints(filePath);
    }
  }

  /**
   * Check if file is an API file
   */
  isAPIFile(filePath) {
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
  scanForEndpoints(filePath) {
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
  extractEndpoints(content, filePath) {
    // Match Express routes
    const expressPattern = /(?:app|router)\.(get|post|put|delete|patch)\s*\(\s*['"`]([^'"`]+)['"`]\s*,\s*(\w+)/g;
    let match;
    
    while ((match = expressPattern.exec(content)) !== null) {
      const method = match[1].toUpperCase();
      const apiPath = match[2];
      const handler = match[3];
      
      const pathModule = require('path');
      apiEndpointTracker.registerEndpoint(method, apiPath, filePath, handler, {
        description: `Auto-detected from ${pathModule.basename(filePath)}`,
      });
    }

    // Match Next.js API routes
    const nextjsPattern = /export\s+(?:async\s+)?function\s+(GET|POST|PUT|DELETE|PATCH)\s*\(/g;
    while ((match = nextjsPattern.exec(content)) !== null) {
      const method = match[1];
      const routePath = this.extractNextJSPath(filePath);
      
      apiEndpointTracker.registerEndpoint(method, routePath, filePath, method, {
        description: `Auto-detected Next.js API route`,
      });
    }
  }

  /**
   * Extract path from Next.js route file
   */
  extractNextJSPath(filePath) {
    const apiMatch = filePath.match(/\/api\/(.+?)\/route\.(ts|tsx|js|jsx)$/);
    if (apiMatch) {
      return `/api/${apiMatch[1]}`;
    }
    
    const pagesMatch = filePath.match(/\/pages\/api\/(.+?)(?:\/index)?\.(ts|tsx|js|jsx)$/);
    if (pagesMatch) {
      return `/api/${pagesMatch[1]}`;
    }
    
    return '/api/unknown';
  }
}

module.exports = { fileWatcher: new FileWatcher() };

