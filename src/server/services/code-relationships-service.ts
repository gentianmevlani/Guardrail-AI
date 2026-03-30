/**
 * Code Relationships Service
 * 
 * Real implementation for analyzing code dependencies and relationships.
 * Builds import graphs, detects circular dependencies, and identifies hubs.
 */

import * as fs from 'fs/promises';
import * as path from 'path';

export interface GraphNode {
  id: string;
  label: string;
  type: 'file' | 'function' | 'class' | 'module';
  path: string;
  connections: number;
}

export interface GraphEdge {
  from: string;
  to: string;
  type: 'import' | 'call' | 'extends' | 'uses';
}

export interface Cluster {
  id: string;
  label: string;
  nodes: string[];
}

export interface CodeGraph {
  nodes: GraphNode[];
  edges: GraphEdge[];
  clusters: Cluster[];
}

export interface RelationshipAnalysis {
  graph: CodeGraph;
  circularDependencies: string[][];
  hubs: GraphNode[];
  orphans: GraphNode[];
  stats: {
    totalFiles: number;
    totalConnections: number;
    avgConnectionsPerFile: number;
    maxConnections: number;
  };
  analyzedAt: string;
}

class CodeRelationshipsService {
  private excludedDirs = ['node_modules', '.git', 'dist', 'build', '.next', 'coverage'];
  private codeExtensions = ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs'];

  /**
   * Analyze code relationships in a directory
   */
  async analyzeRelationships(directory: string): Promise<RelationshipAnalysis> {
    const files = await this.getAllCodeFiles(directory);
    const nodes: GraphNode[] = [];
    const edges: GraphEdge[] = [];
    const importMap = new Map<string, string[]>();

    // Process each file
    for (const file of files) {
      const relativePath = path.relative(directory, file);
      const nodeId = this.fileToNodeId(relativePath);
      
      // Create node
      nodes.push({
        id: nodeId,
        label: path.basename(file),
        type: 'file',
        path: relativePath,
        connections: 0,
      });

      // Extract imports
      try {
        const content = await fs.readFile(file, 'utf-8');
        const imports = this.extractImports(content, file, directory);
        importMap.set(nodeId, imports);

        // Create edges for imports
        for (const imp of imports) {
          edges.push({
            from: nodeId,
            to: imp,
            type: 'import',
          });
        }
      } catch (error) {
        console.warn(`Failed to process ${file}:`, error);
      }
    }

    // Calculate connection counts
    for (const node of nodes) {
      node.connections = edges.filter(
        e => e.from === node.id || e.to === node.id
      ).length;
    }

    // Detect circular dependencies
    const circularDependencies = this.detectCircularDependencies(importMap);

    // Find hubs (nodes with many connections)
    const sortedByConnections = [...nodes].sort((a, b) => b.connections - a.connections);
    const avgConnections = nodes.reduce((sum, n) => sum + n.connections, 0) / nodes.length;
    const hubs = sortedByConnections.filter(n => n.connections > avgConnections * 2).slice(0, 5);

    // Find orphans (nodes with no connections)
    const orphans = nodes.filter(n => n.connections === 0);

    // Create clusters based on directory structure
    const clusters = this.createClusters(nodes);

    // Calculate stats
    const stats = {
      totalFiles: nodes.length,
      totalConnections: edges.length,
      avgConnectionsPerFile: Math.round(avgConnections * 10) / 10,
      maxConnections: sortedByConnections[0]?.connections || 0,
    };

    return {
      graph: { nodes, edges, clusters },
      circularDependencies,
      hubs,
      orphans,
      stats,
      analyzedAt: new Date().toISOString(),
    };
  }

  /**
   * Extract imports from file content
   */
  private extractImports(content: string, filePath: string, baseDir: string): string[] {
    const imports: string[] = [];
    const fileDir = path.dirname(filePath);

    // Match ES6 imports
    const importRegex = /import\s+(?:(?:\{[^}]*\}|\*\s+as\s+\w+|\w+)\s+from\s+)?['"]([^'"]+)['"]/g;
    let match;

    while ((match = importRegex.exec(content)) !== null) {
      const importPath = match[1];
      
      // Skip external packages
      if (!importPath.startsWith('.') && !importPath.startsWith('/')) {
        continue;
      }

      // Resolve relative imports
      const resolvedPath = this.resolveImportPath(importPath, fileDir, baseDir);
      if (resolvedPath) {
        imports.push(resolvedPath);
      }
    }

    // Match require() calls
    const requireRegex = /require\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
    while ((match = requireRegex.exec(content)) !== null) {
      const importPath = match[1];
      
      if (!importPath.startsWith('.') && !importPath.startsWith('/')) {
        continue;
      }

      const resolvedPath = this.resolveImportPath(importPath, fileDir, baseDir);
      if (resolvedPath) {
        imports.push(resolvedPath);
      }
    }

    return [...new Set(imports)];
  }

  /**
   * Resolve an import path to a node ID
   */
  private resolveImportPath(importPath: string, fromDir: string, baseDir: string): string | null {
    // Handle relative paths
    let resolved = path.resolve(fromDir, importPath);
    
    // Try different extensions
    for (const ext of ['', '.ts', '.tsx', '.js', '.jsx', '/index.ts', '/index.tsx', '/index.js']) {
      const tryPath = resolved + ext;
      const relativePath = path.relative(baseDir, tryPath);
      const nodeId = this.fileToNodeId(relativePath);
      
      // Check if this is a valid node
      if (this.codeExtensions.some(e => relativePath.endsWith(e))) {
        return nodeId;
      }
    }

    return null;
  }

  /**
   * Convert file path to node ID
   */
  private fileToNodeId(filePath: string): string {
    return filePath.replace(/\\/g, '/').replace(/\.[^.]+$/, '');
  }

  /**
   * Detect circular dependencies using DFS
   */
  private detectCircularDependencies(importMap: Map<string, string[]>): string[][] {
    const cycles: string[][] = [];
    const visited = new Set<string>();
    const recursionStack = new Set<string>();
    const path: string[] = [];

    const dfs = (node: string): void => {
      if (recursionStack.has(node)) {
        // Found a cycle
        const cycleStart = path.indexOf(node);
        if (cycleStart !== -1) {
          const cycle = path.slice(cycleStart);
          cycle.push(node);
          
          // Only add if not already found (check sorted version)
          const sortedCycle = [...cycle].sort().join(',');
          if (!cycles.some(c => [...c].sort().join(',') === sortedCycle)) {
            cycles.push(cycle);
          }
        }
        return;
      }

      if (visited.has(node)) {
        return;
      }

      visited.add(node);
      recursionStack.add(node);
      path.push(node);

      const imports = importMap.get(node) || [];
      for (const imp of imports) {
        dfs(imp);
      }

      path.pop();
      recursionStack.delete(node);
    };

    for (const node of importMap.keys()) {
      dfs(node);
    }

    return cycles;
  }

  /**
   * Create clusters based on directory structure
   */
  private createClusters(nodes: GraphNode[]): Cluster[] {
    const clusterMap = new Map<string, string[]>();

    for (const node of nodes) {
      const dir = path.dirname(node.path);
      const topDir = dir.split('/')[0] || 'root';
      
      if (!clusterMap.has(topDir)) {
        clusterMap.set(topDir, []);
      }
      clusterMap.get(topDir)!.push(node.id);
    }

    return Array.from(clusterMap.entries()).map(([dir, nodeIds]) => ({
      id: dir,
      label: this.formatClusterLabel(dir),
      nodes: nodeIds,
    }));
  }

  /**
   * Format cluster label
   */
  private formatClusterLabel(dir: string): string {
    const labels: Record<string, string> = {
      'src': 'Source',
      'lib': 'Library',
      'components': 'Components',
      'pages': 'Pages',
      'api': 'API',
      'utils': 'Utilities',
      'hooks': 'Hooks',
      'services': 'Services',
      'types': 'Types',
      'root': 'Root',
    };
    return labels[dir] || dir.charAt(0).toUpperCase() + dir.slice(1);
  }

  /**
   * Get all code files in directory
   */
  private async getAllCodeFiles(dir: string): Promise<string[]> {
    const files: string[] = [];

    const walk = async (directory: string) => {
      try {
        const entries = await fs.readdir(directory, { withFileTypes: true });

        for (const entry of entries) {
          const fullPath = path.join(directory, entry.name);

          if (entry.isDirectory()) {
            if (!this.excludedDirs.includes(entry.name) && !entry.name.startsWith('.')) {
              await walk(fullPath);
            }
          } else if (entry.isFile()) {
            if (this.codeExtensions.some(ext => entry.name.endsWith(ext))) {
              files.push(fullPath);
            }
          }
        }
      } catch (error) {
        console.warn(`Error reading ${directory}:`, error);
      }
    };

    await walk(dir);
    return files;
  }

  /**
   * Export graph in different formats
   */
  exportGraph(graph: CodeGraph, format: 'json' | 'dot' | 'mermaid'): string {
    switch (format) {
      case 'json':
        return JSON.stringify(graph, null, 2);
      
      case 'dot':
        return this.toDotFormat(graph);
      
      case 'mermaid':
        return this.toMermaidFormat(graph);
      
      default:
        return JSON.stringify(graph, null, 2);
    }
  }

  private toDotFormat(graph: CodeGraph): string {
    const lines = ['digraph CodeRelationships {', '  rankdir=LR;'];
    
    for (const node of graph.nodes) {
      lines.push(`  "${node.id}" [label="${node.label}"];`);
    }
    
    for (const edge of graph.edges) {
      lines.push(`  "${edge.from}" -> "${edge.to}";`);
    }
    
    lines.push('}');
    return lines.join('\n');
  }

  private toMermaidFormat(graph: CodeGraph): string {
    const lines = ['graph LR'];
    
    for (const edge of graph.edges) {
      const fromLabel = graph.nodes.find(n => n.id === edge.from)?.label || edge.from;
      const toLabel = graph.nodes.find(n => n.id === edge.to)?.label || edge.to;
      lines.push(`  ${edge.from.replace(/[^a-zA-Z0-9]/g, '_')}[${fromLabel}] --> ${edge.to.replace(/[^a-zA-Z0-9]/g, '_')}[${toLabel}]`);
    }
    
    return lines.join('\n');
  }
}

export const codeRelationshipsService = new CodeRelationshipsService();
