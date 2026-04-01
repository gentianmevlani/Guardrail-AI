/**
 * Code Relationship Visualizer
 * 
 * Creates visual graphs of code dependencies, relationships, and flows
 * Unique feature: Interactive code relationship mapping
 */

import { codebaseKnowledgeBase } from './codebase-knowledge';
import * as fs from 'fs';
import * as path from 'path';

export interface CodeNode {
  id: string;
  label: string;
  type: 'file' | 'function' | 'class' | 'module' | 'component';
  file?: string;
  size?: number;
  metadata?: Record<string, any>;
}

export interface CodeEdge {
  from: string;
  to: string;
  type: 'import' | 'call' | 'extends' | 'implements' | 'uses' | 'depends';
  weight?: number;
  metadata?: Record<string, any>;
}

export interface CodeGraph {
  nodes: CodeNode[];
  edges: CodeEdge[];
  clusters?: Array<{
    id: string;
    label: string;
    nodes: string[];
  }>;
}

export interface VisualizationOptions {
  depth?: number;
  includeTypes?: string[];
  excludeTypes?: string[];
  minConnections?: number;
  clusterBy?: 'module' | 'type' | 'dependency';
}

class CodeRelationshipVisualizer {
  /**
   * Generate code relationship graph
   */
  async generateGraph(
    projectPath: string,
    options: VisualizationOptions = {}
  ): Promise<CodeGraph> {
    const {
      depth = 2,
      includeTypes = ['file', 'function', 'class'],
      excludeTypes = [],
      minConnections = 1,
      clusterBy = 'module',
    } = options;

    const knowledge = await codebaseKnowledgeBase.getKnowledge(projectPath);
    if (!knowledge) {
      throw new Error('Knowledge base not found');
    }

    const nodes: CodeNode[] = [];
    const edges: CodeEdge[] = [];

    // Build nodes from knowledge base
    for (const [file, imports] of knowledge.relationships.imports.entries()) {
      if (includeTypes.includes('file')) {
        nodes.push({
          id: file,
          label: path.basename(file),
          type: 'file',
          file,
          metadata: {
            imports: imports.length,
          },
        });
      }

      // Add edges for imports
      for (const imp of imports) {
        const targetId = this.normalizeImport(imp, file);
        if (targetId) {
          edges.push({
            from: file,
            to: targetId,
            type: 'import',
            weight: 1,
          });
        }
      }
    }

    // Add function and class nodes
    const functions = await this.extractFunctions(projectPath);
    for (const func of functions) {
      if (includeTypes.includes('function')) {
        nodes.push({
          id: func.id,
          label: func.name,
          type: 'function',
          file: func.file,
          metadata: {
            line: func.line,
            params: func.params,
          },
        });

        // Add call edges
        for (const call of func.calls) {
          edges.push({
            from: func.id,
            to: call,
            type: 'call',
            weight: 1,
          });
        }
      }
    }

    // Filter by minimum connections
    const nodeIds = new Set(nodes.map(n => n.id));
    const filteredEdges = edges.filter(e => 
      nodeIds.has(e.from) && nodeIds.has(e.to) &&
      this.countConnections(e.from, edges) >= minConnections
    );

    // Generate clusters
    const clusters = this.generateClusters(nodes, filteredEdges, clusterBy);

    return {
      nodes,
      edges: filteredEdges,
      clusters,
    };
  }

  /**
   * Export graph to various formats
   */
  async exportGraph(
    graph: CodeGraph,
    format: 'json' | 'dot' | 'graphml' | 'mermaid'
  ): Promise<string> {
    switch (format) {
      case 'json':
        return JSON.stringify(graph, null, 2);

      case 'dot':
        return this.toDotFormat(graph);

      case 'graphml':
        return this.toGraphML(graph);

      case 'mermaid':
        return this.toMermaid(graph);

      default:
        throw new Error(`Unsupported format: ${format}`);
    }
  }

  /**
   * Find code paths between two nodes
   */
  async findPaths(
    graph: CodeGraph,
    from: string,
    to: string,
    maxDepth: number = 5
  ): Promise<string[][]> {
    const paths: string[][] = [];
    const visited = new Set<string>();

    const dfs = (current: string, path: string[]) => {
      if (path.length > maxDepth) return;
      if (current === to) {
        paths.push([...path, to]);
        return;
      }

      visited.add(current);
      const edges = graph.edges.filter(e => e.from === current);
      
      for (const edge of edges) {
        if (!visited.has(edge.to)) {
          dfs(edge.to, [...path, current]);
        }
      }

      visited.delete(current);
    };

    dfs(from, []);
    return paths;
  }

  /**
   * Detect circular dependencies
   */
  detectCircularDependencies(graph: CodeGraph): string[][] {
    const cycles: string[][] = [];
    const visited = new Set<string>();
    const recStack = new Set<string>();

    const dfs = (node: string, path: string[]) => {
      visited.add(node);
      recStack.add(node);

      const edges = graph.edges.filter(e => e.from === node);
      for (const edge of edges) {
        if (!visited.has(edge.to)) {
          dfs(edge.to, [...path, node]);
        } else if (recStack.has(edge.to)) {
          // Found cycle
          const cycleStart = path.indexOf(edge.to);
          if (cycleStart >= 0) {
            cycles.push([...path.slice(cycleStart), node, edge.to]);
          }
        }
      }

      recStack.delete(node);
    };

    for (const node of graph.nodes) {
      if (!visited.has(node.id)) {
        dfs(node.id, []);
      }
    }

    return cycles;
  }

  /**
   * Find most connected nodes (hub analysis)
   */
  findHubs(graph: CodeGraph, topN: number = 10): CodeNode[] {
    const connectionCounts = new Map<string, number>();

    for (const edge of graph.edges) {
      connectionCounts.set(edge.from, (connectionCounts.get(edge.from) || 0) + 1);
      connectionCounts.set(edge.to, (connectionCounts.get(edge.to) || 0) + 1);
    }

    return Array.from(connectionCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, topN)
      .map(([id]) => graph.nodes.find(n => n.id === id)!)
      .filter(Boolean);
  }

  /**
   * Generate clusters
   */
  private generateClusters(
    nodes: CodeNode[],
    edges: CodeEdge[],
    method: 'module' | 'type' | 'dependency'
  ): Array<{ id: string; label: string; nodes: string[] }> {
    const clusters: Array<{ id: string; label: string; nodes: string[] }> = [];

    if (method === 'module') {
      const byModule = new Map<string, string[]>();
      for (const node of nodes) {
        const module = node.file?.split('/')[0] || 'root';
        if (!byModule.has(module)) {
          byModule.set(module, []);
        }
        byModule.get(module)!.push(node.id);
      }

      for (const [module, nodeIds] of byModule.entries()) {
        clusters.push({
          id: module,
          label: module,
          nodes: nodeIds,
        });
      }
    } else if (method === 'type') {
      const byType = new Map<string, string[]>();
      for (const node of nodes) {
        if (!byType.has(node.type)) {
          byType.set(node.type, []);
        }
        byType.get(node.type)!.push(node.id);
      }

      for (const [type, nodeIds] of byType.entries()) {
        clusters.push({
          id: type,
          label: type,
          nodes: nodeIds,
        });
      }
    }

    return clusters;
  }

  /**
   * Convert to DOT format (Graphviz)
   */
  private toDotFormat(graph: CodeGraph): string {
    let dot = 'digraph CodeGraph {\n';
    dot += '  rankdir=LR;\n';
    dot += '  node [shape=box];\n\n';

    // Add nodes
    for (const node of graph.nodes) {
      dot += `  "${node.id}" [label="${node.label}"];\n`;
    }

    dot += '\n';

    // Add edges
    for (const edge of graph.edges) {
      dot += `  "${edge.from}" -> "${edge.to}" [label="${edge.type}"];\n`;
    }

    dot += '}\n';
    return dot;
  }

  /**
   * Convert to GraphML format
   */
  private toGraphML(graph: CodeGraph): string {
    let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
    xml += '<graphml xmlns="http://graphml.graphdrawing.org/xmlns">\n';
    xml += '  <graph id="codegraph" edgedefault="directed">\n';

    for (const node of graph.nodes) {
      xml += `    <node id="${node.id}">\n`;
      xml += `      <data key="label">${node.label}</data>\n`;
      xml += `      <data key="type">${node.type}</data>\n`;
      xml += '    </node>\n';
    }

    for (const edge of graph.edges) {
      xml += `    <edge source="${edge.from}" target="${edge.to}">\n`;
      xml += `      <data key="type">${edge.type}</data>\n`;
      xml += '    </edge>\n';
    }

    xml += '  </graph>\n';
    xml += '</graphml>\n';
    return xml;
  }

  /**
   * Convert to Mermaid format
   */
  private toMermaid(graph: CodeGraph): string {
    let mermaid = 'graph LR\n';

    for (const edge of graph.edges) {
      const fromNode = graph.nodes.find(n => n.id === edge.from);
      const toNode = graph.nodes.find(n => n.id === edge.to);
      mermaid += `  ${edge.from}["${fromNode?.label || edge.from}"] -->|${edge.type}| ${edge.to}["${toNode?.label || edge.to}"]\n`;
    }

    return mermaid;
  }

  private normalizeImport(imp: string, fromFile: string): string | null {
    // Normalize import path to node ID
    if (imp.startsWith('.')) {
      return path.resolve(path.dirname(fromFile), imp).replace(/\\/g, '/');
    }
    return imp;
  }

  private countConnections(nodeId: string, edges: CodeEdge[]): number {
    return edges.filter(e => e.from === nodeId || e.to === nodeId).length;
  }

  private async extractFunctions(projectPath: string): Promise<Array<{
    id: string;
    name: string;
    file: string;
    line: number;
    params: number;
    calls: string[];
  }>> {
    // Simplified - in production use AST parsing
    return [];
  }
}

export const codeRelationshipVisualizer = new CodeRelationshipVisualizer();

