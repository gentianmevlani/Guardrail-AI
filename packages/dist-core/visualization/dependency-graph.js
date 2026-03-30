"use strict";
/**
 * Visual Dependency Graph Generator
 *
 * Generates interactive dependency graphs showing:
 * - Package dependencies and their relationships
 * - Vulnerability status of each package
 * - License compatibility
 * - Security risk levels
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.dependencyGraphGenerator = exports.DependencyGraphGenerator = void 0;
class DependencyGraphGenerator {
    /**
     * Generate dependency graph from package.json
     */
    async generateFromPackageJson(packageJsonPath, options = {}) {
        const { readFileSync } = await Promise.resolve().then(() => __importStar(require("fs")));
        const { dirname } = await Promise.resolve().then(() => __importStar(require("path")));
        const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf-8"));
        const projectDir = dirname(packageJsonPath);
        const nodes = [];
        const edges = [];
        const visited = new Set();
        // Add root node
        const rootId = `${packageJson.name}@${packageJson.version}`;
        nodes.push({
            id: rootId,
            name: packageJson.name || "root",
            version: packageJson.version || "0.0.0",
            type: "root",
            vulnerabilities: [],
            license: packageJson.license || "UNKNOWN",
            riskLevel: "none",
            depth: 0,
        });
        // Process direct dependencies
        const deps = packageJson.dependencies || {};
        const devDeps = packageJson.devDependencies || {};
        for (const [name, version] of Object.entries(deps)) {
            const nodeId = `${name}@${version}`;
            if (!visited.has(nodeId)) {
                visited.add(nodeId);
                const node = await this.createNode(name, String(version), "direct", 1, projectDir);
                nodes.push(node);
                edges.push({ source: rootId, target: nodeId, type: "dependency" });
                // Check for transitive dependencies
                if (options.maxDepth !== 1) {
                    const transitives = await this.getTransitiveDeps(name, projectDir, visited, 2, options.maxDepth || 3);
                    for (const trans of transitives.nodes) {
                        nodes.push(trans);
                    }
                    for (const edge of transitives.edges) {
                        edges.push(edge);
                    }
                }
            }
        }
        for (const [name, version] of Object.entries(devDeps)) {
            const nodeId = `${name}@${version}`;
            if (!visited.has(nodeId)) {
                visited.add(nodeId);
                const node = await this.createNode(name, String(version), "direct", 1, projectDir);
                nodes.push(node);
                edges.push({ source: rootId, target: nodeId, type: "devDependency" });
            }
        }
        // Calculate risk distribution
        const riskDistribution = {
            none: 0,
            low: 0,
            medium: 0,
            high: 0,
            critical: 0,
        };
        for (const node of nodes) {
            const level = node.riskLevel;
            if (typeof riskDistribution[level] === "number") {
                riskDistribution[level]++;
            }
        }
        const vulnerablePackages = nodes.filter((n) => n.vulnerabilities.length > 0).length;
        return {
            nodes,
            edges,
            metadata: {
                projectName: packageJson.name || "unknown",
                totalPackages: nodes.length,
                vulnerablePackages,
                riskDistribution,
                generatedAt: new Date().toISOString(),
            },
        };
    }
    /**
     * Create a dependency node
     */
    async createNode(name, version, type, depth, projectDir) {
        const { existsSync, readFileSync } = await Promise.resolve().then(() => __importStar(require("fs")));
        const { join } = await Promise.resolve().then(() => __importStar(require("path")));
        const versionStr = String(version).replace(/^[\^~]/, "");
        const nodeId = `${name}@${version}`;
        // Try to get license from node_modules
        let license = "UNKNOWN";
        const pkgPath = join(projectDir, "node_modules", name, "package.json");
        if (existsSync(pkgPath)) {
            try {
                const pkg = JSON.parse(readFileSync(pkgPath, "utf-8"));
                license = pkg.license || "UNKNOWN";
            }
            catch {
                // Skip
            }
        }
        // Placeholder for vulnerability check - would integrate with vulnerability DB
        const vulnerabilities = [];
        // Calculate risk level based on vulnerabilities
        let riskLevel = "none";
        if (vulnerabilities.some((v) => v.severity === "critical")) {
            riskLevel = "critical";
        }
        else if (vulnerabilities.some((v) => v.severity === "high")) {
            riskLevel = "high";
        }
        else if (vulnerabilities.some((v) => v.severity === "medium")) {
            riskLevel = "medium";
        }
        else if (vulnerabilities.length > 0) {
            riskLevel = "low";
        }
        return {
            id: nodeId,
            name,
            version: versionStr,
            type,
            vulnerabilities,
            license,
            riskLevel,
            depth,
        };
    }
    /**
     * Get transitive dependencies
     */
    async getTransitiveDeps(packageName, projectDir, visited, currentDepth, maxDepth) {
        const { existsSync, readFileSync } = await Promise.resolve().then(() => __importStar(require("fs")));
        const { join } = await Promise.resolve().then(() => __importStar(require("path")));
        const nodes = [];
        const edges = [];
        if (currentDepth > maxDepth) {
            return { nodes, edges };
        }
        const pkgPath = join(projectDir, "node_modules", packageName, "package.json");
        if (!existsSync(pkgPath)) {
            return { nodes, edges };
        }
        try {
            const pkg = JSON.parse(readFileSync(pkgPath, "utf-8"));
            const deps = pkg.dependencies || {};
            const parentId = `${packageName}@${pkg.version}`;
            for (const [name, version] of Object.entries(deps)) {
                const nodeId = `${name}@${version}`;
                if (!visited.has(nodeId)) {
                    visited.add(nodeId);
                    const node = await this.createNode(name, String(version), "transitive", currentDepth, projectDir);
                    nodes.push(node);
                    edges.push({ source: parentId, target: nodeId, type: "dependency" });
                    // Recurse for deeper transitive deps
                    const deeper = await this.getTransitiveDeps(name, projectDir, visited, currentDepth + 1, maxDepth);
                    nodes.push(...deeper.nodes);
                    edges.push(...deeper.edges);
                }
            }
        }
        catch {
            // Skip packages we can't read
        }
        return { nodes, edges };
    }
    /**
     * Render graph to Mermaid format
     */
    renderToMermaid(graph) {
        const lines = ["graph TD"];
        // Define node styles based on risk level
        const riskStyles = {
            none: "fill:#90EE90",
            low: "fill:#FFFF99",
            medium: "fill:#FFB347",
            high: "fill:#FF6B6B",
            critical: "fill:#FF0000,color:#fff",
        };
        // Add nodes
        for (const node of graph.nodes) {
            const label = `${node.name}@${node.version}`;
            const safeId = node.id.replace(/[@./]/g, "_");
            lines.push(`  ${safeId}["${label}"]`);
        }
        // Add edges
        for (const edge of graph.edges) {
            const sourceId = edge.source.replace(/[@./]/g, "_");
            const targetId = edge.target.replace(/[@./]/g, "_");
            const edgeStyle = edge.type === "devDependency" ? "-->" : "-->";
            lines.push(`  ${sourceId} ${edgeStyle} ${targetId}`);
        }
        // Add styles
        lines.push("");
        for (const node of graph.nodes) {
            const safeId = node.id.replace(/[@./]/g, "_");
            const style = riskStyles[node.riskLevel];
            lines.push(`  style ${safeId} ${style}`);
        }
        return lines.join("\n");
    }
    /**
     * Render graph to D3.js compatible JSON
     */
    renderToD3(graph) {
        const d3Data = {
            nodes: graph.nodes.map((node) => ({
                id: node.id,
                name: node.name,
                version: node.version,
                group: node.type === "root" ? 1 : node.type === "direct" ? 2 : 3,
                riskLevel: node.riskLevel,
                vulnerabilities: node.vulnerabilities.length,
                license: node.license,
            })),
            links: graph.edges.map((edge) => ({
                source: edge.source,
                target: edge.target,
                type: edge.type,
            })),
        };
        return JSON.stringify(d3Data, null, 2);
    }
    /**
     * Render graph to HTML with embedded visualization
     */
    renderToHTML(graph, options = {}) {
        const width = options.width || 1200;
        const height = options.height || 800;
        const d3Data = this.renderToD3(graph);
        return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Dependency Graph - ${graph.metadata.projectName}</title>
  <script src="https://d3js.org/d3.v7.min.js"></script>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 20px; background: #f5f5f5; }
    .container { background: white; border-radius: 8px; padding: 20px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
    h1 { margin: 0 0 10px 0; color: #333; }
    .stats { display: flex; gap: 20px; margin-bottom: 20px; }
    .stat { background: #f0f0f0; padding: 10px 15px; border-radius: 4px; }
    .stat-label { font-size: 12px; color: #666; }
    .stat-value { font-size: 24px; font-weight: bold; }
    .critical { color: #ff0000; }
    .high { color: #ff6b6b; }
    .medium { color: #ffb347; }
    .low { color: #ffd700; }
    svg { display: block; margin: 0 auto; }
    .node circle { stroke: #fff; stroke-width: 2px; }
    .node text { font-size: 10px; pointer-events: none; }
    .link { stroke: #999; stroke-opacity: 0.6; }
    .tooltip { position: absolute; background: #333; color: white; padding: 8px 12px; border-radius: 4px; font-size: 12px; pointer-events: none; }
  </style>
</head>
<body>
  <div class="container">
    <h1>Dependency Graph: ${graph.metadata.projectName}</h1>
    <div class="stats">
      <div class="stat">
        <div class="stat-label">Total Packages</div>
        <div class="stat-value">${graph.metadata.totalPackages}</div>
      </div>
      <div class="stat">
        <div class="stat-label">Vulnerable</div>
        <div class="stat-value critical">${graph.metadata.vulnerablePackages}</div>
      </div>
      <div class="stat">
        <div class="stat-label">Critical</div>
        <div class="stat-value critical">${graph.metadata.riskDistribution["critical"]}</div>
      </div>
      <div class="stat">
        <div class="stat-label">High</div>
        <div class="stat-value high">${graph.metadata.riskDistribution["high"]}</div>
      </div>
    </div>
    <svg width="${width}" height="${height}"></svg>
  </div>
  <script>
    const data = ${d3Data};
    const width = ${width};
    const height = ${height};
    
    const color = d3.scaleOrdinal()
      .domain(['none', 'low', 'medium', 'high', 'critical'])
      .range(['#90EE90', '#FFFF99', '#FFB347', '#FF6B6B', '#FF0000']);
    
    const simulation = d3.forceSimulation(data.nodes)
      .force('link', d3.forceLink(data.links).id(d => d.id).distance(100))
      .force('charge', d3.forceManyBody().strength(-200))
      .force('center', d3.forceCenter(width / 2, height / 2));
    
    const svg = d3.select('svg');
    
    const link = svg.append('g')
      .selectAll('line')
      .data(data.links)
      .join('line')
      .attr('class', 'link');
    
    const node = svg.append('g')
      .selectAll('g')
      .data(data.nodes)
      .join('g')
      .attr('class', 'node')
      .call(d3.drag()
        .on('start', dragstarted)
        .on('drag', dragged)
        .on('end', dragended));
    
    node.append('circle')
      .attr('r', d => d.group === 1 ? 20 : d.group === 2 ? 12 : 8)
      .attr('fill', d => color(d.riskLevel));
    
    node.append('text')
      .attr('dx', 15)
      .attr('dy', 4)
      .text(d => d.name);
    
    simulation.on('tick', () => {
      link
        .attr('x1', d => d.source.x)
        .attr('y1', d => d.source.y)
        .attr('x2', d => d.target.x)
        .attr('y2', d => d.target.y);
      node.attr('transform', d => \`translate(\${d.x},\${d.y})\`);
    });
    
    function dragstarted(event) {
      if (!event.active) simulation.alphaTarget(0.3).restart();
      event.subject.fx = event.subject.x;
      event.subject.fy = event.subject.y;
    }
    
    function dragged(event) {
      event.subject.fx = event.x;
      event.subject.fy = event.y;
    }
    
    function dragended(event) {
      if (!event.active) simulation.alphaTarget(0);
      event.subject.fx = null;
      event.subject.fy = null;
    }
  </script>
</body>
</html>`;
    }
}
exports.DependencyGraphGenerator = DependencyGraphGenerator;
// Export singleton
exports.dependencyGraphGenerator = new DependencyGraphGenerator();
