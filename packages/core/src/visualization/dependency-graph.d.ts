/**
 * Visual Dependency Graph Generator
 *
 * Generates interactive dependency graphs showing:
 * - Package dependencies and their relationships
 * - Vulnerability status of each package
 * - License compatibility
 * - Security risk levels
 */
export interface DependencyNode {
  id: string;
  name: string;
  version: string;
  type: "root" | "direct" | "transitive";
  vulnerabilities: VulnerabilityInfo[];
  license: string;
  riskLevel: "none" | "low" | "medium" | "high" | "critical";
  depth: number;
  size?: number;
}
export interface DependencyEdge {
  source: string;
  target: string;
  type: "dependency" | "devDependency" | "peerDependency";
}
export interface VulnerabilityInfo {
  id: string;
  severity: "low" | "medium" | "high" | "critical";
  title: string;
}
export interface DependencyGraph {
  nodes: DependencyNode[];
  edges: DependencyEdge[];
  metadata: {
    projectName: string;
    totalPackages: number;
    vulnerablePackages: number;
    riskDistribution: Record<string, number>;
    generatedAt: string;
  };
}
export interface GraphRenderOptions {
  format: "svg" | "html" | "json" | "d3" | "mermaid";
  width?: number;
  height?: number;
  showVulnerabilities?: boolean;
  showLicenses?: boolean;
  highlightVulnerable?: boolean;
  maxDepth?: number;
  colorScheme?: "default" | "colorblind" | "dark";
}
export declare class DependencyGraphGenerator {
  /**
   * Generate dependency graph from package.json
   */
  generateFromPackageJson(
    packageJsonPath: string,
    options?: Partial<GraphRenderOptions>,
  ): Promise<DependencyGraph>;
  /**
   * Create a dependency node
   */
  private createNode;
  /**
   * Get transitive dependencies
   */
  private getTransitiveDeps;
  /**
   * Render graph to Mermaid format
   */
  renderToMermaid(graph: DependencyGraph): string;
  /**
   * Render graph to D3.js compatible JSON
   */
  renderToD3(graph: DependencyGraph): string;
  /**
   * Render graph to HTML with embedded visualization
   */
  renderToHTML(
    graph: DependencyGraph,
    options?: Partial<GraphRenderOptions>,
  ): string;
}
export declare const dependencyGraphGenerator: DependencyGraphGenerator;
//# sourceMappingURL=dependency-graph.d.ts.map
