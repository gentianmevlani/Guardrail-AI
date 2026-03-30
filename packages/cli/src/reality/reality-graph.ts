/**
 * Reality Graph - Evidence-Based Dependency + Behavior Graph
 * 
 * Nodes: files, routes, handlers, DB tables, external APIs, permissions, secrets, feature flags
 * Edges: "this route calls this handler", "this handler writes this table", "this flow hits this external API"
 * 
 * Each edge gets a "proof score" based on observed execution + static certainty.
 * 
 * Enables queries like:
 * - "These 3 endpoints exist but were never executed in any proof run."
 * - "This permission check is declared but not enforced on write paths."
 * - "This feature flag guards UI but not API."
 */

import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';

export type NodeType = 
  | 'file'
  | 'route'
  | 'handler'
  | 'db_table'
  | 'external_api'
  | 'permission'
  | 'secret'
  | 'feature_flag'
  | 'middleware'
  | 'service';

export type EdgeType =
  | 'calls'
  | 'writes'
  | 'reads'
  | 'requires'
  | 'guards'
  | 'uses'
  | 'imports'
  | 'depends_on';

export type ProofScore = {
  static: number; // 0-100: Certainty from static analysis
  observed: number; // 0-100: Evidence from runtime execution
  combined: number; // Weighted combination
  evidence: string[]; // Proof artifacts (screenshots, traces, logs)
};

export interface RealityNode {
  id: string;
  type: NodeType;
  label: string;
  metadata: {
    file?: string;
    line?: number;
    route?: string;
    method?: string;
    table?: string;
    api?: string;
    permission?: string;
    secret?: string;
    flag?: string;
    [key: string]: any;
  };
  proofScore: ProofScore;
  discoveredAt: string;
  lastSeenAt?: string;
}

export interface RealityEdge {
  id: string;
  source: string; // Node ID
  target: string; // Node ID
  type: EdgeType;
  label: string;
  proofScore: ProofScore;
  metadata: {
    file?: string;
    line?: number;
    static?: boolean; // Found via static analysis
    observed?: boolean; // Observed in runtime
    [key: string]: any;
  };
  discoveredAt: string;
  lastSeenAt?: string;
}

export interface RealityGraph {
  nodes: Map<string, RealityNode>;
  edges: Map<string, RealityEdge>;
  snapshots: Array<{
    timestamp: string;
    nodeCount: number;
    edgeCount: number;
  }>;
}

export class RealityGraphBuilder {
  private graph: RealityGraph;
  private projectPath: string;

  constructor(projectPath: string) {
    this.projectPath = projectPath;
    this.graph = {
      nodes: new Map(),
      edges: new Map(),
      snapshots: [],
    };
  }

  /**
   * Add a node to the graph
   */
  addNode(node: Omit<RealityNode, 'discoveredAt'>): void {
    const existing = this.graph.nodes.get(node.id);
    if (existing) {
      // Update existing node
      existing.label = node.label;
      existing.metadata = { ...existing.metadata, ...node.metadata };
      existing.proofScore = this.combineProofScores(existing.proofScore, node.proofScore);
      existing.lastSeenAt = new Date().toISOString();
    } else {
      // Add new node
      this.graph.nodes.set(node.id, {
        ...node,
        discoveredAt: new Date().toISOString(),
      });
    }
  }

  /**
   * Add an edge to the graph
   */
  addEdge(
    sourceId: string,
    targetId: string,
    type: EdgeType,
    label: string,
    proofScore?: Partial<ProofScore>,
    metadata?: Record<string, any>
  ): void {
    // Ensure nodes exist
    if (!this.graph.nodes.has(sourceId)) {
      throw new Error(`Source node ${sourceId} does not exist`);
    }
    if (!this.graph.nodes.has(targetId)) {
      throw new Error(`Target node ${targetId} does not exist`);
    }

    const edgeId = `${sourceId}->${targetId}:${type}`;
    const existing = this.graph.edges.get(edgeId);

    const defaultProofScore: ProofScore = {
      static: proofScore?.static ?? 0,
      observed: proofScore?.observed ?? 0,
      combined: 0,
      evidence: proofScore?.evidence || [],
    };
    defaultProofScore.combined = this.calculateCombinedScore(defaultProofScore);

    if (existing) {
      // Update existing edge
      existing.label = label;
      existing.metadata = { ...existing.metadata, ...metadata };
      existing.proofScore = this.combineProofScores(existing.proofScore, defaultProofScore);
      existing.lastSeenAt = new Date().toISOString();
    } else {
      // Add new edge
      this.graph.edges.set(edgeId, {
        id: edgeId,
        source: sourceId,
        target: targetId,
        type,
        label,
        proofScore: defaultProofScore,
        metadata: metadata || {},
        discoveredAt: new Date().toISOString(),
      });
    }
  }

  /**
   * Discover nodes from static analysis
   */
  discoverStaticNodes(): void {
    // Discover routes from framework files
    this.discoverRoutes();
    
    // Discover handlers from route files
    this.discoverHandlers();
    
    // Discover DB tables from Prisma schema
    this.discoverDatabaseTables();
    
    // Discover external APIs from code
    this.discoverExternalAPIs();
    
    // Discover permissions from code
    this.discoverPermissions();
    
    // Discover secrets from code
    this.discoverSecrets();
    
    // Discover feature flags from code
    this.discoverFeatureFlags();
  }

  /**
   * Update graph from runtime traces
   */
  updateFromRuntimeTraces(traces: {
    requests?: Array<{
      method: string;
      url: string;
      statusCode: number;
      timestamp: string;
      duration: number;
    }>;
    routes?: Array<{
      path: string;
      method: string;
      hit: boolean;
      timestamp: string;
    }>;
    dbQueries?: Array<{
      query: string;
      duration: number;
      timestamp: string;
      table?: string;
    }>;
  }): void {
    // Update route nodes with observed execution
    if (traces.routes) {
      for (const route of traces.routes) {
        if (route.hit) {
          const nodeId = `route:${route.method}:${route.path}`;
          const node = this.graph.nodes.get(nodeId);
          if (node) {
            node.proofScore.observed = Math.min(100, node.proofScore.observed + 10);
            node.proofScore.combined = this.calculateCombinedScore(node.proofScore);
            node.lastSeenAt = route.timestamp;
          }
        }
      }
    }

    // Update DB table nodes with observed queries
    if (traces.dbQueries) {
      for (const query of traces.dbQueries) {
        if (query.table) {
          const nodeId = `db_table:${query.table}`;
          const node = this.graph.nodes.get(nodeId);
          if (node) {
            node.proofScore.observed = Math.min(100, node.proofScore.observed + 5);
            node.proofScore.combined = this.calculateCombinedScore(node.proofScore);
            node.lastSeenAt = query.timestamp;
          }
        }
      }
    }

    // Update external API nodes with observed requests
    if (traces.requests) {
      for (const req of traces.requests) {
        try {
          const url = new URL(req.url);
          if (!url.hostname.includes('localhost') && !url.hostname.includes('127.0.0.1')) {
            const nodeId = `external_api:${url.hostname}`;
            const node = this.graph.nodes.get(nodeId);
            if (node) {
              node.proofScore.observed = Math.min(100, node.proofScore.observed + 5);
              node.proofScore.combined = this.calculateCombinedScore(node.proofScore);
              node.lastSeenAt = req.timestamp;
            }
          }
        } catch {
          // Invalid URL, skip
        }
      }
    }
  }

  /**
   * Discover routes from framework files
   */
  private discoverRoutes(): void {
    // Next.js routes
    const nextRoutesPath = path.join(this.projectPath, 'app');
    if (fs.existsSync(nextRoutesPath)) {
      this.discoverNextRoutes(nextRoutesPath);
    }

    // Express/Fastify routes
    const routesPath = path.join(this.projectPath, 'src', 'routes');
    if (fs.existsSync(routesPath)) {
      this.discoverExpressRoutes(routesPath);
    }
  }

  /**
   * Discover Next.js routes
   */
  private discoverNextRoutes(dir: string, prefix = ''): void {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      const routePath = prefix + '/' + entry.name.replace(/\.(tsx?|jsx?)$/, '');
      
      if (entry.isDirectory()) {
        this.discoverNextRoutes(fullPath, routePath);
      } else if (entry.name.match(/^(page|route|layout)\.(tsx?|jsx?)$/)) {
        const method = entry.name === 'route.ts' || entry.name === 'route.tsx' ? 'GET' : 'GET';
        const nodeId = `route:${method}:${routePath}`;
        
        this.addNode({
          id: nodeId,
          type: 'route',
          label: `${method} ${routePath}`,
          metadata: {
            file: fullPath,
            route: routePath,
            method,
          },
          proofScore: {
            static: 100, // Found in filesystem
            observed: 0,
            combined: 50,
            evidence: [],
          },
        });
      }
    }
  }

  /**
   * Discover Express/Fastify routes
   */
  private discoverExpressRoutes(dir: string): void {
    const routeFiles = this.getAllFiles(dir, ['.ts', '.js']);
    
    for (const file of routeFiles) {
      const content = fs.readFileSync(file, 'utf-8');
      
      // Match route definitions: fastify.get('/path', ...) or app.get('/path', ...)
      const routeRegex = /(?:fastify|app|router)\.(get|post|put|delete|patch|all)\s*\(\s*['"]([^'"]+)['"]/g;
      let match;
      
      while ((match = routeRegex.exec(content)) !== null) {
        const method = match[1].toUpperCase();
        const routePath = match[2];
        const nodeId = `route:${method}:${routePath}`;
        
        this.addNode({
          id: nodeId,
          type: 'route',
          label: `${method} ${routePath}`,
          metadata: {
            file,
            route: routePath,
            method,
          },
          proofScore: {
            static: 100,
            observed: 0,
            combined: 50,
            evidence: [],
          },
        });
      }
    }
  }

  /**
   * Discover handlers from route files
   */
  private discoverHandlers(): void {
    const routeFiles = this.getAllFiles(this.projectPath, ['.ts', '.js', '.tsx', '.jsx']);
    
    for (const file of routeFiles) {
      const content = fs.readFileSync(file, 'utf-8');
      
      // Match handler functions: export async function handler(...) or const handler = ...
      const handlerRegex = /(?:export\s+)?(?:async\s+)?function\s+(\w+Handler|\w+Controller|\w+Action)/g;
      let match;
      
      while ((match = handlerRegex.exec(content)) !== null) {
        const handlerName = match[1];
        const nodeId = `handler:${handlerName}`;
        
        this.addNode({
          id: nodeId,
          type: 'handler',
          label: handlerName,
          metadata: {
            file,
            handler: handlerName,
          },
          proofScore: {
            static: 80, // Found in code
            observed: 0,
            combined: 40,
            evidence: [],
          },
        });
      }
    }
  }

  /**
   * Discover database tables from Prisma schema
   */
  private discoverDatabaseTables(): void {
    const schemaPath = path.join(this.projectPath, 'prisma', 'schema.prisma');
    if (!fs.existsSync(schemaPath)) {
      return;
    }

    const content = fs.readFileSync(schemaPath, 'utf-8');
    const modelRegex = /model\s+(\w+)\s*\{/g;
    let match;

    while ((match = modelRegex.exec(content)) !== null) {
      const tableName = match[1];
      const nodeId = `db_table:${tableName}`;
      
      this.addNode({
        id: nodeId,
        type: 'db_table',
        label: tableName,
        metadata: {
          table: tableName,
          file: schemaPath,
        },
        proofScore: {
          static: 100, // Found in schema
          observed: 0,
          combined: 50,
          evidence: [],
        },
      });
    }
  }

  /**
   * Discover external APIs from code
   */
  private discoverExternalAPIs(): void {
    const codeFiles = this.getAllFiles(this.projectPath, ['.ts', '.js', '.tsx', '.jsx']);
    
    for (const file of codeFiles) {
      const content = fs.readFileSync(file, 'utf-8');
      
      // Match API URLs: https://api.example.com or fetch('https://...')
      const apiRegex = /https?:\/\/([a-zA-Z0-9.-]+)/g;
      let match;
      
      while ((match = apiRegex.exec(content)) !== null) {
        const hostname = match[1];
        if (!hostname.includes('localhost') && !hostname.includes('127.0.0.1')) {
          const nodeId = `external_api:${hostname}`;
          
          this.addNode({
            id: nodeId,
            type: 'external_api',
            label: hostname,
            metadata: {
              api: hostname,
              file,
            },
            proofScore: {
              static: 60, // Found in code
              observed: 0,
              combined: 30,
              evidence: [],
            },
          });
        }
      }
    }
  }

  /**
   * Discover permissions from code
   */
  private discoverPermissions(): void {
    const codeFiles = this.getAllFiles(this.projectPath, ['.ts', '.js', '.tsx', '.jsx']);
    
    for (const file of codeFiles) {
      const content = fs.readFileSync(file, 'utf-8');
      
      // Match permission checks: hasPermission('read:users') or checkPermission(...)
      const permRegex = /(?:hasPermission|checkPermission|requirePermission|can)\s*\(['"]([^'"]+)['"]/g;
      let match;
      
      while ((match = permRegex.exec(content)) !== null) {
        const permission = match[1];
        const nodeId = `permission:${permission}`;
        
        this.addNode({
          id: nodeId,
          type: 'permission',
          label: permission,
          metadata: {
            permission,
            file,
          },
          proofScore: {
            static: 70, // Found in code
            observed: 0,
            combined: 35,
            evidence: [],
          },
        });
      }
    }
  }

  /**
   * Discover secrets from code
   */
  private discoverSecrets(): void {
    const codeFiles = this.getAllFiles(this.projectPath, ['.ts', '.js', '.tsx', '.jsx']);
    
    for (const file of codeFiles) {
      const content = fs.readFileSync(file, 'utf-8');
      
      // Match secret references: process.env.SECRET_KEY or getSecret('key')
      const secretRegex = /(?:process\.env\.|getSecret|getSecretValue)\s*\(?['"]?([A-Z_][A-Z0-9_]+)['"]?\)?/g;
      let match;
      
      while ((match = secretRegex.exec(content)) !== null) {
        const secret = match[1];
        const nodeId = `secret:${secret}`;
        
        this.addNode({
          id: nodeId,
          type: 'secret',
          label: secret,
          metadata: {
            secret,
            file,
          },
          proofScore: {
            static: 80, // Found in code
            observed: 0,
            combined: 40,
            evidence: [],
          },
        });
      }
    }
  }

  /**
   * Discover feature flags from code
   */
  private discoverFeatureFlags(): void {
    const codeFiles = this.getAllFiles(this.projectPath, ['.ts', '.js', '.tsx', '.jsx']);
    
    for (const file of codeFiles) {
      const content = fs.readFileSync(file, 'utf-8');
      
      // Match feature flags: isFeatureEnabled('flag') or featureFlags.get('flag')
      const flagRegex = /(?:isFeatureEnabled|featureFlags\.(?:get|has)|hasFeature)\s*\(['"]([^'"]+)['"]/g;
      let match;
      
      while ((match = flagRegex.exec(content)) !== null) {
        const flag = match[1];
        const nodeId = `feature_flag:${flag}`;
        
        this.addNode({
          id: nodeId,
          type: 'feature_flag',
          label: flag,
          metadata: {
            flag,
            file,
          },
          proofScore: {
            static: 70, // Found in code
            observed: 0,
            combined: 35,
            evidence: [],
          },
        });
      }
    }
  }

  /**
   * Query: Find nodes that exist but were never executed
   */
  findUnexecutedNodes(): RealityNode[] {
    const unexecuted: RealityNode[] = [];
    
    for (const node of this.graph.nodes.values()) {
      if (node.proofScore.static > 0 && node.proofScore.observed === 0) {
        unexecuted.push(node);
      }
    }
    
    return unexecuted;
  }

  /**
   * Query: Find routes that exist but were never hit
   */
  findUnhitRoutes(): RealityNode[] {
    const unhit: RealityNode[] = [];
    
    for (const node of this.graph.nodes.values()) {
      if (node.type === 'route' && node.proofScore.static > 0 && node.proofScore.observed === 0) {
        unhit.push(node);
      }
    }
    
    return unhit;
  }

  /**
   * Query: Find permission checks that are declared but not enforced
   */
  findUnguardedWritePaths(): Array<{ route: RealityNode; permission: RealityNode }> {
    const unguarded: Array<{ route: RealityNode; permission: RealityNode }> = [];
    
    // Find write routes (POST, PUT, DELETE, PATCH)
    const writeRoutes = Array.from(this.graph.nodes.values()).filter(
      node => node.type === 'route' && 
      ['POST', 'PUT', 'DELETE', 'PATCH'].includes(node.metadata.method || '')
    );
    
    // Find permissions
    const permissions = Array.from(this.graph.nodes.values()).filter(
      node => node.type === 'permission'
    );
    
    // Check if routes have permission edges
    for (const route of writeRoutes) {
      const hasPermissionEdge = Array.from(this.graph.edges.values()).some(
        edge => edge.source === route.id && edge.type === 'requires' && edge.target.startsWith('permission:')
      );
      
      if (!hasPermissionEdge) {
        // Find relevant permission
        const relevantPermission = permissions.find(p => 
          route.metadata.route?.includes(p.metadata.permission || '')
        );
        
        if (relevantPermission) {
          unguarded.push({ route, permission: relevantPermission });
        }
      }
    }
    
    return unguarded;
  }

  /**
   * Query: Find feature flags that guard UI but not API
   */
  findIncompleteFeatureFlags(): Array<{ flag: RealityNode; uiGuarded: boolean; apiGuarded: boolean }> {
    const incomplete: Array<{ flag: RealityNode; uiGuarded: boolean; apiGuarded: boolean }> = [];
    
    const flags = Array.from(this.graph.nodes.values()).filter(
      node => node.type === 'feature_flag'
    );
    
    for (const flag of flags) {
      const uiEdges = Array.from(this.graph.edges.values()).filter(
        edge => edge.target === flag.id && edge.type === 'guards' && 
        (edge.source.includes('page') || edge.source.includes('component'))
      );
      
      const apiEdges = Array.from(this.graph.edges.values()).filter(
        edge => edge.target === flag.id && edge.type === 'guards' && 
        edge.source.startsWith('route:')
      );
      
      if (uiEdges.length > 0 && apiEdges.length === 0) {
        incomplete.push({
          flag,
          uiGuarded: true,
          apiGuarded: false,
        });
      }
    }
    
    return incomplete;
  }

  /**
   * Get the graph
   */
  getGraph(): RealityGraph {
    return this.graph;
  }

  /**
   * Export graph to JSON
   */
  export(): string {
    return JSON.stringify({
      nodes: Array.from(this.graph.nodes.values()),
      edges: Array.from(this.graph.edges.values()),
      snapshots: this.graph.snapshots,
    }, null, 2);
  }

  /**
   * Save graph snapshot
   */
  saveSnapshot(): void {
    this.graph.snapshots.push({
      timestamp: new Date().toISOString(),
      nodeCount: this.graph.nodes.size,
      edgeCount: this.graph.edges.size,
    });
  }

  /**
   * Helper: Get all files recursively
   */
  private getAllFiles(dir: string, extensions: string[]): string[] {
    const files: string[] = [];
    
    if (!fs.existsSync(dir)) {
      return files;
    }
    
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      
      if (entry.isDirectory()) {
        // Skip node_modules, .git, etc.
        if (!entry.name.startsWith('.') && entry.name !== 'node_modules') {
          files.push(...this.getAllFiles(fullPath, extensions));
        }
      } else if (extensions.some(ext => entry.name.endsWith(ext))) {
        files.push(fullPath);
      }
    }
    
    return files;
  }

  /**
   * Calculate combined proof score
   */
  private calculateCombinedScore(score: ProofScore): number {
    // Weight: 40% static, 60% observed (execution is stronger proof)
    return Math.round(score.static * 0.4 + score.observed * 0.6);
  }

  /**
   * Combine two proof scores (take maximum observed, average static)
   */
  private combineProofScores(existing: ProofScore, newScore: ProofScore): ProofScore {
    return {
      static: Math.max(existing.static, newScore.static),
      observed: Math.max(existing.observed, newScore.observed),
      combined: 0, // Will be recalculated
      evidence: [...new Set([...existing.evidence, ...newScore.evidence])],
    };
  }
}
