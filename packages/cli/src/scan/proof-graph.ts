/**
 * Reality Proof Graph
 * 
 * A graph model per scan that connects claims → evidence → verdict
 */

export interface ProofNode {
  id: string;
  type: 'route' | 'handler' | 'middleware' | 'auth' | 'env' | 'db_model' | 'runtime_probe';
  name: string;
  file?: string;
  line?: number;
  metadata?: Record<string, any>;
}

export interface ProofEdge {
  from: string;
  to: string;
  type: 'reachable_via' | 'guarded_by' | 'depends_on' | 'validated_by';
  evidence?: any;
}

export interface ProofGraph {
  nodes: ProofNode[];
  edges: ProofEdge[];
  verdict: 'PASS' | 'FAIL' | 'WARN';
  evidenceStrength: number; // 0-1
  findings: string[]; // Finding IDs
}

export class ProofGraphBuilder {
  private nodes: Map<string, ProofNode> = new Map();
  private edges: ProofEdge[] = [];

  /**
   * Add node to graph
   */
  addNode(node: ProofNode): void {
    this.nodes.set(node.id, node);
  }

  /**
   * Add edge to graph
   */
  addEdge(edge: ProofEdge): void {
    this.edges.push(edge);
  }

  /**
   * Build final graph
   */
  build(verdict: 'PASS' | 'FAIL' | 'WARN', evidenceStrength: number, findings: string[]): ProofGraph {
    return {
      nodes: Array.from(this.nodes.values()),
      edges: this.edges,
      verdict,
      evidenceStrength,
      findings,
    };
  }

  /**
   * Find node by type and name
   */
  findNode(type: ProofNode['type'], name: string): ProofNode | undefined {
    return Array.from(this.nodes.values()).find(n => n.type === type && n.name === name);
  }

  /**
   * Get all nodes of type
   */
  getNodesByType(type: ProofNode['type']): ProofNode[] {
    return Array.from(this.nodes.values()).filter(n => n.type === type);
  }

  /**
   * Get edges from node
   */
  getEdgesFrom(nodeId: string): ProofEdge[] {
    return this.edges.filter(e => e.from === nodeId);
  }

  /**
   * Get edges to node
   */
  getEdgesTo(nodeId: string): Promise<ProofEdge[]> {
    return Promise.resolve(this.edges.filter(e => e.to === nodeId));
  }
}
