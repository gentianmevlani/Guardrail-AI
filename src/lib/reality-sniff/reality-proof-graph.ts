/**
 * Reality Proof Graph
 * 
 * Builds a graph model where every finding becomes a node with evidence edges.
 * Used for:
 * - Deduplication and prioritization
 * - Evidence strength calculation
 * - Topological "blocks shipping first" ordering
 * - Receipt generation
 */

import { RealityFinding, Evidence } from './reality-sniff-scanner';

export type NodeType = 'finding' | 'evidence' | 'route' | 'file' | 'dependency';
export type EdgeType = 'depends_on' | 'reachable_via' | 'guarded_by' | 'validated_by' | 'evidence_of';

export interface ProofNode {
  id: string;
  type: NodeType;
  label: string;
  data: {
    finding?: RealityFinding;
    evidence?: Evidence;
    route?: string;
    file?: string;
    dependency?: string;
    metadata?: Record<string, any>;
  };
  strength: number; // 0-1, evidence strength
  reachable: boolean;
}

export interface ProofEdge {
  id: string;
  from: string;
  to: string;
  type: EdgeType;
  weight: number; // 0-1, relationship strength
  metadata?: Record<string, any>;
}

export interface ProofGraph {
  nodes: Map<string, ProofNode>;
  edges: Map<string, ProofEdge>;
}

export interface BlockingPath {
  nodes: string[];
  edges: string[];
  strength: number;
  description: string;
}

export class RealityProofGraph {
  private graph: ProofGraph;

  constructor() {
    this.graph = {
      nodes: new Map(),
      edges: new Map(),
    };
  }

  /**
   * Add a finding to the graph
   */
  addFinding(finding: RealityFinding): void {
    const nodeId = `finding_${finding.id}`;
    
    this.graph.nodes.set(nodeId, {
      id: nodeId,
      type: 'finding',
      label: finding.ruleName,
      data: { finding },
      strength: this.calculateFindingStrength(finding),
      reachable: finding.reachable && finding.inProdPath,
    });

    // Add file node
    const fileNodeId = `file_${finding.file}`;
    if (!this.graph.nodes.has(fileNodeId)) {
      this.graph.nodes.set(fileNodeId, {
        id: fileNodeId,
        type: 'file',
        label: finding.file,
        data: { file: finding.file },
        strength: 1.0,
        reachable: finding.inProdPath,
      });
    }

    // Connect finding to file
    this.addEdge(nodeId, fileNodeId, 'depends_on', 1.0);

    // Add evidence nodes and edges
    for (const evidence of finding.evidence) {
      const evidenceNodeId = `evidence_${evidence.type}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      this.graph.nodes.set(evidenceNodeId, {
        id: evidenceNodeId,
        type: 'evidence',
        label: evidence.description,
        data: { evidence },
        strength: this.calculateEvidenceStrength(evidence),
        reachable: finding.reachable,
      });

      this.addEdge(nodeId, evidenceNodeId, 'evidence_of', this.calculateEvidenceStrength(evidence));
    }
  }

  /**
   * Find blocking paths (topological ordering of blockers)
   */
  findBlockingPaths(): BlockingPath[] {
    const blockers = Array.from(this.graph.nodes.values())
      .filter(node => node.type === 'finding' && node.data.finding?.verdict === 'FAIL')
      .sort((a, b) => b.strength - a.strength);

    const paths: BlockingPath[] = [];

    for (const blocker of blockers) {
      const path = this.traceBlockingPath(blocker.id);
      if (path) {
        paths.push(path);
      }
    }

    return paths.sort((a, b) => b.strength - a.strength);
  }

  /**
   * Calculate evidence strength for a finding
   */
  calculateFindingStrength(finding: RealityFinding): number {
    let strength = 0;

    // Base strength from evidence level
    switch (finding.evidenceLevel) {
      case 'lexical':
        strength = 0.3;
        break;
      case 'structural':
        strength = 0.7;
        break;
      case 'runtime':
        strength = 0.95;
        break;
    }

    // Boost if in prod path
    if (finding.inProdPath) {
      strength += 0.2;
    }

    // Boost if high confidence
    strength += finding.confidence * 0.3;

    // Boost if high score
    strength += Math.min(finding.score / 10, 0.2);

    return Math.min(strength, 1.0);
  }

  /**
   * Calculate evidence strength
   */
  private calculateEvidenceStrength(evidence: Evidence): number {
    switch (evidence.type) {
      case 'lexical':
        return 0.3;
      case 'structural':
        return 0.7;
      case 'runtime':
        return 0.95;
      default:
        return 0.5;
    }
  }

  /**
   * Add an edge to the graph
   */
  private addEdge(from: string, to: string, type: EdgeType, weight: number): void {
    const edgeId = `edge_${from}_${to}_${type}`;
    
    this.graph.edges.set(edgeId, {
      id: edgeId,
      from,
      to,
      type,
      weight,
    });
  }

  /**
   * Trace a blocking path from a finding
   */
  private traceBlockingPath(startNodeId: string): BlockingPath | null {
    const visited = new Set<string>();
    const path: string[] = [startNodeId];
    const edges: string[] = [];

    const node = this.graph.nodes.get(startNodeId);
    if (!node || node.type !== 'finding') {
      return null;
    }

    visited.add(startNodeId);

    // Follow evidence edges
    for (const edge of this.graph.edges.values()) {
      if (edge.from === startNodeId && edge.type === 'evidence_of') {
        if (!visited.has(edge.to)) {
          path.push(edge.to);
          edges.push(edge.id);
          visited.add(edge.to);
        }
      }
    }

    // Follow dependency edges
    for (const edge of this.graph.edges.values()) {
      if (edge.from === startNodeId && edge.type === 'depends_on') {
        if (!visited.has(edge.to)) {
          path.push(edge.to);
          edges.push(edge.id);
        }
      }
    }

    const finding = node.data.finding;
    if (!finding) {
      return null;
    }

    return {
      nodes: path,
      edges,
      strength: node.strength,
      description: `${finding.ruleName}: ${finding.message}`,
    };
  }

  /**
   * Get top blockers (ranked by strength)
   */
  getTopBlockers(limit = 10): RealityFinding[] {
    const blockers = Array.from(this.graph.nodes.values())
      .filter(node => node.type === 'finding' && node.data.finding?.verdict === 'FAIL')
      .sort((a, b) => b.strength - a.strength)
      .slice(0, limit)
      .map(node => node.data.finding!)
      .filter(f => f !== undefined);

    return blockers;
  }

  /**
   * Generate receipt for a finding
   */
  generateReceipt(finding: RealityFinding): string {
    const lines: string[] = [];

    lines.push(`╔══════════════════════════════════════════════════════════════╗`);
    lines.push(`║                    REALITY SNIFF RECEIPT                     ║`);
    lines.push(`╚══════════════════════════════════════════════════════════════╝`);
    lines.push(``);
    lines.push(`VERDICT: ${finding.verdict}`);
    lines.push(`RULE: ${finding.ruleName}`);
    lines.push(`SEVERITY: ${finding.severity.toUpperCase()}`);
    lines.push(`CONFIDENCE: ${Math.round(finding.confidence * 100)}%`);
    lines.push(``);
    lines.push(`FILE: ${finding.file}`);
    lines.push(`LINE: ${finding.line}`);
    if (finding.column) {
      lines.push(`COLUMN: ${finding.column}`);
    }
    lines.push(``);
    lines.push(`MESSAGE: ${finding.message}`);
    lines.push(``);
    lines.push(`EVIDENCE:`);
    for (const evidence of finding.evidence) {
      lines.push(`  [${evidence.type.toUpperCase()}] ${evidence.description}`);
      if (evidence.file && evidence.line) {
        lines.push(`    → ${evidence.file}:${evidence.line}`);
      }
    }
    lines.push(``);
    lines.push(`REACHABLE: ${finding.reachable ? 'YES' : 'NO'}`);
    lines.push(`IN PROD PATH: ${finding.inProdPath ? 'YES' : 'NO'}`);
    lines.push(`SCORE: ${finding.score} points`);
    lines.push(``);
    if (finding.fixSuggestion) {
      lines.push(`FIX SUGGESTION:`);
      lines.push(`  ${finding.fixSuggestion}`);
      lines.push(``);
    }
    if (finding.replayCommand) {
      lines.push(`REPLAY:`);
      lines.push(`  ${finding.replayCommand}`);
      lines.push(``);
    }
    lines.push(`═══════════════════════════════════════════════════════════════`);

    return lines.join('\n');
  }

  /**
   * Export graph as JSON
   */
  exportGraph(): any {
    return {
      nodes: Array.from(this.graph.nodes.values()),
      edges: Array.from(this.graph.edges.values()),
    };
  }
}
