/**
 * Phase 0.3: Navigation Graph Model
 * 
 * Builds a graph representation of route navigation:
 * - Nodes: routes (patterns + concrete paths)
 * - Edges: source route → target route with metadata
 * - Supports reachability analysis and cluster detection
 */

import {
  NavigationGraph,
  NavigationNode,
  NavigationEdge,
  RouteSource,
  NodeMetadata,
  EdgeExtraction,
  EdgeGuard,
  RouteCluster,
  GraphMetadata,
  ExtractionType,
  ExtractedLink,
  FrameworkType,
} from '../types';
import { RouteNormalizer } from '../normalization/route-normalizer';

export class NavigationGraphBuilder {
  private nodes: Map<string, NavigationNode> = new Map();
  private edges: NavigationEdge[] = [];
  private normalizer: RouteNormalizer;
  private edgeIdCounter = 0;

  constructor(normalizer?: RouteNormalizer) {
    this.normalizer = normalizer || new RouteNormalizer();
  }

  addRoute(
    pattern: string,
    source: RouteSource,
    metadata?: Partial<NodeMetadata>
  ): string {
    const normalized = this.normalizer.normalize(pattern);
    const nodeId = this.createNodeId(normalized.pattern);

    if (this.nodes.has(nodeId)) {
      const existing = this.nodes.get(nodeId)!;
      if (!existing.concreteExamples.includes(pattern)) {
        existing.concreteExamples.push(pattern);
      }
      return nodeId;
    }

    const node: NavigationNode = {
      id: nodeId,
      pattern: normalized.pattern,
      concreteExamples: [pattern],
      source,
      metadata: {
        isLayout: metadata?.isLayout ?? false,
        isError: metadata?.isError ?? false,
        isLoading: metadata?.isLoading ?? false,
        isNotFound: metadata?.isNotFound ?? false,
        hasGetServerSideProps: metadata?.hasGetServerSideProps ?? false,
        hasGetStaticProps: metadata?.hasGetStaticProps ?? false,
        hasGetStaticPaths: metadata?.hasGetStaticPaths ?? false,
        generateStaticParams: metadata?.generateStaticParams ?? false,
        isApiRoute: metadata?.isApiRoute ?? false,
        httpMethods: metadata?.httpMethods ?? [],
        middleware: metadata?.middleware ?? [],
      },
    };

    this.nodes.set(nodeId, node);
    return nodeId;
  }

  addEdge(
    sourceNodeId: string,
    targetHref: string,
    extraction: EdgeExtraction,
    confidence: 'high' | 'medium' | 'low',
    guards: EdgeGuard[] = []
  ): string {
    const normalized = this.normalizer.normalize(targetHref);
    const targetNodeId = this.findMatchingNode(normalized.pattern) || 
                         this.createNodeId(normalized.pattern);

    const edgeId = `edge_${this.edgeIdCounter++}`;

    const edge: NavigationEdge = {
      id: edgeId,
      sourceNodeId,
      targetNodeId,
      targetPattern: normalized.pattern,
      targetLiteral: normalized.hasParams ? null : targetHref,
      extraction,
      confidence,
      guards,
    };

    this.edges.push(edge);
    return edgeId;
  }

  addExtractedLink(
    sourceFile: string,
    sourceRoute: string,
    link: ExtractedLink
  ): string | null {
    const sourceNodeId = this.findNodeByFile(sourceFile) || 
                         this.addRoute(sourceRoute, {
                           type: 'discovered',
                           file: sourceFile,
                           line: null,
                           column: null,
                           framework: 'unknown',
                         });

    const extraction: EdgeExtraction = {
      type: link.type,
      file: link.location.file,
      line: link.location.line,
      column: link.location.column,
      snippet: '',
      resolvedFrom: link.resolvedValue !== link.href ? link.resolvedValue : null,
    };

    return this.addEdge(
      sourceNodeId,
      link.resolvedValue || link.href,
      extraction,
      link.confidence,
      link.guards
    );
  }

  build(): NavigationGraph {
    const entryPoints = this.findEntryPoints();
    const reachable = this.computeReachability(entryPoints);
    const orphanNodes = this.findOrphanNodes();
    const unreachableNodes = this.findUnreachableNodes(reachable);
    const clusters = this.detectClusters();
    const coveragePercent = this.computeCoverage(reachable);

    const metadata: GraphMetadata = {
      totalRoutes: this.nodes.size,
      totalEdges: this.edges.length,
      coveragePercent,
      clusters,
      crawledAt: null,
    };

    return {
      nodes: new Map(this.nodes),
      edges: [...this.edges],
      entryPoints,
      orphanNodes,
      unreachableNodes,
      metadata,
    };
  }

  private createNodeId(pattern: string): string {
    return `route_${pattern.replace(/[^a-zA-Z0-9]/g, '_')}`;
  }

  private findMatchingNode(pattern: string): string | null {
    const entries = Array.from(this.nodes.entries());
    for (const [nodeId, node] of entries) {
      if (node.pattern === pattern) {
        return nodeId;
      }
      if (this.normalizer.patternMatches(node.pattern, pattern)) {
        return nodeId;
      }
    }
    return null;
  }

  private findNodeByFile(file: string): string | null {
    const entries = Array.from(this.nodes.entries());
    for (const [nodeId, node] of entries) {
      if (node.source.file === file) {
        return nodeId;
      }
    }
    return null;
  }

  private findEntryPoints(): string[] {
    const entryPoints: string[] = [];
    const entries = Array.from(this.nodes.entries());

    for (const [nodeId, node] of entries) {
      if (node.pattern === '/') {
        entryPoints.push(nodeId);
        continue;
      }

      if (node.source.type === 'manifest-route' || node.source.type === 'file-route') {
        const hasIncoming = this.edges.some(e => e.targetNodeId === nodeId);
        if (!hasIncoming) {
          entryPoints.push(nodeId);
        }
      }
    }

    const rootNode = this.findMatchingNode('/');
    if (rootNode && !entryPoints.includes(rootNode)) {
      entryPoints.unshift(rootNode);
    }

    return entryPoints;
  }

  private computeReachability(entryPoints: string[]): Set<string> {
    const reachable = new Set<string>();
    const queue = [...entryPoints];

    while (queue.length > 0) {
      const nodeId = queue.shift()!;
      if (reachable.has(nodeId)) {
        continue;
      }
      reachable.add(nodeId);

      const outgoingEdges = this.edges.filter(e => e.sourceNodeId === nodeId);
      for (const edge of outgoingEdges) {
        if (!reachable.has(edge.targetNodeId)) {
          queue.push(edge.targetNodeId);
        }
      }
    }

    return reachable;
  }

  private findOrphanNodes(): string[] {
    const orphans: string[] = [];
    const entries = Array.from(this.nodes.entries());

    for (const [nodeId, node] of entries) {
      if (node.metadata.isLayout || node.metadata.isError || 
          node.metadata.isLoading || node.metadata.isNotFound) {
        continue;
      }

      const hasOutgoing = this.edges.some(e => e.sourceNodeId === nodeId);
      const hasIncoming = this.edges.some(e => e.targetNodeId === nodeId);

      if (!hasOutgoing && !hasIncoming && node.pattern !== '/') {
        orphans.push(nodeId);
      }
    }

    return orphans;
  }

  private findUnreachableNodes(reachable: Set<string>): string[] {
    const unreachable: string[] = [];
    const nodeIds = Array.from(this.nodes.keys());

    for (const nodeId of nodeIds) {
      if (!reachable.has(nodeId)) {
        const node = this.nodes.get(nodeId)!;
        if (!node.metadata.isLayout && !node.metadata.isError &&
            !node.metadata.isLoading && !node.metadata.isNotFound) {
          unreachable.push(nodeId);
        }
      }
    }

    return unreachable;
  }

  private detectClusters(): RouteCluster[] {
    const clusters: RouteCluster[] = [];
    const visited = new Set<string>();
    let clusterCounter = 0;

    const getConnected = (nodeId: string): Set<string> => {
      const connected = new Set<string>();
      const queue = [nodeId];

      while (queue.length > 0) {
        const current = queue.shift()!;
        if (connected.has(current)) continue;
        connected.add(current);

        const outgoing = this.edges
          .filter(e => e.sourceNodeId === current)
          .map(e => e.targetNodeId);
        const incoming = this.edges
          .filter(e => e.targetNodeId === current)
          .map(e => e.sourceNodeId);

        for (const next of [...outgoing, ...incoming]) {
          if (!connected.has(next)) {
            queue.push(next);
          }
        }
      }

      return connected;
    };

    const allNodeIds = Array.from(this.nodes.keys());
    for (const nodeId of allNodeIds) {
      if (visited.has(nodeId)) continue;

      const connected = getConnected(nodeId);
      const connectedIds = Array.from(connected);
      for (const id of connectedIds) {
        visited.add(id);
      }

      const nodeIds = Array.from(connected);
      const hasRoot = nodeIds.some(id => this.nodes.get(id)?.pattern === '/');
      const isIsolated = !hasRoot && nodeIds.length < this.nodes.size;

      const hasAuthGuard = this.edges
        .filter(e => nodeIds.includes(e.sourceNodeId) || nodeIds.includes(e.targetNodeId))
        .some(e => e.guards.some(g => g.type === 'auth-required'));

      const name = this.inferClusterName(nodeIds);

      clusters.push({
        id: `cluster_${clusterCounter++}`,
        name,
        nodeIds,
        isIsolated,
        requiresAuth: hasAuthGuard,
      });
    }

    return clusters;
  }

  private inferClusterName(nodeIds: string[]): string {
    if (nodeIds.length === 0) return 'empty';

    const patterns = nodeIds
      .map(id => this.nodes.get(id)?.pattern || '')
      .filter(Boolean);

    if (patterns.includes('/')) {
      return 'main';
    }

    const commonPrefix = this.findCommonPrefix(patterns);
    if (commonPrefix && commonPrefix !== '/') {
      return commonPrefix.split('/').filter(Boolean)[0] || 'unknown';
    }

    return 'isolated';
  }

  private findCommonPrefix(strings: string[]): string {
    if (strings.length === 0) return '';
    if (strings.length === 1) return strings[0];

    let prefix = strings[0];
    for (let i = 1; i < strings.length; i++) {
      while (!strings[i].startsWith(prefix)) {
        prefix = prefix.slice(0, -1);
        const lastSlash = prefix.lastIndexOf('/');
        if (lastSlash > 0) {
          prefix = prefix.slice(0, lastSlash + 1);
        }
        if (prefix === '') break;
      }
    }

    return prefix;
  }

  private computeCoverage(reachable: Set<string>): number {
    const totalRoutes = Array.from(this.nodes.values()).filter(
      n => !n.metadata.isLayout && !n.metadata.isError &&
           !n.metadata.isLoading && !n.metadata.isNotFound
    ).length;

    if (totalRoutes === 0) return 100;

    const reachableRoutes = Array.from(reachable).filter(id => {
      const node = this.nodes.get(id);
      return node && !node.metadata.isLayout && !node.metadata.isError &&
             !node.metadata.isLoading && !node.metadata.isNotFound;
    }).length;

    return Math.round((reachableRoutes / totalRoutes) * 100);
  }

  getNode(nodeId: string): NavigationNode | undefined {
    return this.nodes.get(nodeId);
  }

  getEdgesFrom(nodeId: string): NavigationEdge[] {
    return this.edges.filter(e => e.sourceNodeId === nodeId);
  }

  getEdgesTo(nodeId: string): NavigationEdge[] {
    return this.edges.filter(e => e.targetNodeId === nodeId);
  }

  getAllNodes(): NavigationNode[] {
    return Array.from(this.nodes.values());
  }

  getAllEdges(): NavigationEdge[] {
    return [...this.edges];
  }
}

export function createNavigationGraph(): NavigationGraphBuilder {
  return new NavigationGraphBuilder();
}

export function mergeGraphs(graphs: NavigationGraph[]): NavigationGraph {
  const builder = new NavigationGraphBuilder();

  for (const graph of graphs) {
    const nodes = Array.from(graph.nodes.values());
    for (const node of nodes) {
      builder.addRoute(node.pattern, node.source, node.metadata);
    }

    for (const edge of graph.edges) {
      const sourceNode = graph.nodes.get(edge.sourceNodeId);
      if (sourceNode) {
        builder.addEdge(
          edge.sourceNodeId,
          edge.targetPattern,
          edge.extraction,
          edge.confidence,
          edge.guards
        );
      }
    }
  }

  return builder.build();
}

export function computeNavigationCoverage(graph: NavigationGraph): {
  totalRoutes: number;
  reachableFromRoot: number;
  coveragePercent: number;
  unreachable: string[];
} {
  return {
    totalRoutes: graph.metadata.totalRoutes,
    reachableFromRoot: graph.metadata.totalRoutes - graph.unreachableNodes.length,
    coveragePercent: graph.metadata.coveragePercent,
    unreachable: graph.unreachableNodes,
  };
}
