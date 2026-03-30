/**
 * Dependency Graph Visualization Module
 * Generates visual maps of component/module relationships
 */

const fs = require("fs");
const path = require("path");

/**
 * Find files recursively (local helper)
 */
function findFiles(dir, extensions, maxDepth = 5, currentDepth = 0) {
  if (currentDepth >= maxDepth || !fs.existsSync(dir)) return [];
  
  const files = [];
  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory() && !entry.name.startsWith(".") && entry.name !== "node_modules") {
        files.push(...findFiles(fullPath, extensions, maxDepth, currentDepth + 1));
      } else if (entry.isFile() && extensions.some(ext => entry.name.endsWith(ext))) {
        files.push(fullPath);
      }
    }
  } catch {}
  return files;
}

/**
 * Extract imports from a file
 */
function extractImports(filePath) {
  const imports = [];
  try {
    const content = fs.readFileSync(filePath, "utf-8");
    const relativePath = path.relative(process.cwd(), filePath).replace(/\\/g, "/");
    
    // Match import statements
    const importMatches = content.match(/import\s+.*?\s+from\s+['"]([^'"]+)['"]/g) || [];
    
    for (const match of importMatches) {
      const source = match.match(/from\s+['"]([^'"]+)['"]/)?.[1];
      if (source) {
        imports.push({
          from: relativePath,
          to: source,
          type: source.startsWith(".") ? "internal" : "external",
        });
      }
    }
  } catch {}
  return imports;
}

/**
 * Build dependency graph
 */
function buildDependencyGraph(projectPath) {
  const graph = {
    nodes: new Map(),
    edges: [],
    stats: {
      totalFiles: 0,
      internalImports: 0,
      externalImports: 0,
      circularDeps: 0,
    },
  };

  const srcFiles = findFiles(projectPath, [".ts", ".tsx", ".js", ".jsx"], 5);
  graph.stats.totalFiles = srcFiles.length;

  // Extract all imports
  const allImports = [];
  for (const file of srcFiles) {
    const imports = extractImports(file);
    allImports.push(...imports);
  }

  // Build nodes
  for (const file of srcFiles) {
    const relativePath = path.relative(projectPath, file).replace(/\\/g, "/");
    const ext = path.extname(relativePath);
    const baseName = path.basename(relativePath, ext);
    const dir = path.dirname(relativePath);
    
    // Determine node type
    let type = "file";
    if (relativePath.includes("/components/") && /^[A-Z]/.test(baseName)) {
      type = "component";
    } else if (relativePath.includes("/hooks/") || baseName.startsWith("use")) {
      type = "hook";
    } else if (relativePath.includes("/api/") || relativePath.includes("/routes/")) {
      type = "api";
    } else if (relativePath.includes("/lib/") || relativePath.includes("/utils/")) {
      type = "utility";
    } else if (ext === ".json") {
      type = "config";
    }
    
    graph.nodes.set(relativePath, {
      id: relativePath,
      label: baseName,
      path: relativePath,
      type,
      imports: [],
      importedBy: [],
    });
  }

  // Build edges
  for (const imp of allImports) {
    if (imp.type === "internal") {
      // Resolve relative import
      const fromDir = path.dirname(imp.from);
      const toPath = path.resolve(fromDir, imp.to);
      const relativeToPath = path.relative(projectPath, toPath).replace(/\\/g, "/");
      
      // Try different file extensions
      let resolvedPath = relativeToPath;
      if (!graph.nodes.has(relativeToPath)) {
        for (const ext of [".ts", ".tsx", ".js", ".jsx", "/index.ts", "/index.js"]) {
          const withExt = relativeToPath + (relativeToPath.endsWith("/") ? ext.slice(1) : ext);
          if (graph.nodes.has(withExt)) {
            resolvedPath = withExt;
            break;
          }
        }
      }
      
      if (graph.nodes.has(resolvedPath)) {
        graph.edges.push({
          from: imp.from,
          to: resolvedPath,
          type: "internal",
        });
        
        // Update node references
        const fromNode = graph.nodes.get(imp.from);
        const toNode = graph.nodes.get(resolvedPath);
        if (fromNode) fromNode.imports.push(resolvedPath);
        if (toNode) toNode.importedBy.push(imp.from);
        
        graph.stats.internalImports++;
      }
    } else {
      graph.stats.externalImports++;
    }
  }

  // Detect circular dependencies
  const visited = new Set();
  const recursionStack = new Set();
  
  function detectCycle(node, path = []) {
    if (recursionStack.has(node)) {
      const cycleStart = path.indexOf(node);
      if (cycleStart > -1) {
        graph.stats.circularDeps++;
        return path.slice(cycleStart);
      }
    }
    
    if (visited.has(node)) return null;
    
    visited.add(node);
    recursionStack.add(node);
    
    const nodeData = graph.nodes.get(node);
    if (nodeData) {
      for (const importPath of nodeData.imports) {
        const cycle = detectCycle(importPath, [...path, node]);
        if (cycle) return cycle;
      }
    }
    
    recursionStack.delete(node);
    return null;
  }
  
  for (const nodeId of graph.nodes.keys()) {
    if (!visited.has(nodeId)) {
      detectCycle(nodeId);
    }
  }

  return graph;
}

/**
 * Generate Mermaid diagram from graph
 */
function generateMermaidDiagram(graph, options = {}) {
  const { maxNodes = 50, includeExternal = false } = options;
  
  let diagram = "graph TD\n";
  diagram += "    %% Generated by guardrail Context v3.0\n\n";
  
  // Add nodes with styling
  const nodes = Array.from(graph.nodes.values()).slice(0, maxNodes);
  const nodeStyles = {
    component: "fill:#e1f5fe",
    hook: "fill:#f3e5f5",
    api: "fill:#ffebee",
    utility: "fill:#e8f5e9",
    config: "fill:#fff3e0",
    file: "fill:#f5f5f5",
  };
  
  for (const node of nodes) {
    const style = nodeStyles[node.type] || nodeStyles.file;
    diagram += `    ${node.id.replace(/[\/\.:]/g, "_")}["${node.label}"]:::${node.type}\n`;
  }
  
  // Add styles
  diagram += "\n    classDef component fill:#e1f5fe,stroke:#0288d1\n";
  diagram += "    classDef hook fill:#f3e5f5,stroke:#7b1fa2\n";
  diagram += "    classDef api fill:#ffebee,stroke:#d32f2f\n";
  diagram += "    classDef utility fill:#e8f5e9,stroke:#388e3c\n";
  diagram += "    classDef config fill:#fff3e0,stroke:#f57c00\n";
  diagram += "    classDef file fill:#f5f5f5,stroke:#616161\n\n";
  
  // Add edges
  const internalEdges = graph.edges.filter(e => e.type === "internal");
  const edgeCount = Math.min(internalEdges.length, 100);
  
  for (let i = 0; i < edgeCount; i++) {
    const edge = internalEdges[i];
    const fromId = edge.from.replace(/[\/\.:]/g, "_");
    const toId = edge.to.replace(/[\/\.:]/g, "_");
    diagram += `    ${fromId} --> ${toId}\n`;
  }
  
  // Add node classes
  for (const node of nodes) {
    diagram += `    class ${node.id.replace(/[\/\.:]/g, "_")} ${node.type}\n`;
  }
  
  return diagram;
}

/**
 * Generate DOT graph for Graphviz
 */
function generateDotGraph(graph, options = {}) {
  const { maxNodes = 50 } = options;
  
  let dot = "digraph DependencyGraph {\n";
  dot += "    // Generated by guardrail Context v3.0\n";
  dot += "    rankdir=LR;\n";
  dot += "    node [shape=box, style=filled];\n\n";
  
  const nodes = Array.from(graph.nodes.values()).slice(0, maxNodes);
  const colors = {
    component: "#e1f5fe",
    hook: "#f3e5f5",
    api: "#ffebee",
    utility: "#e8f5e9",
    config: "#fff3e0",
    file: "#f5f5f5",
  };
  
  // Add nodes
  for (const node of nodes) {
    const color = colors[node.type] || colors.file;
    dot += `    "${node.id}" [label="${node.label}", fillcolor="${color}"];\n`;
  }
  
  // Add edges
  const internalEdges = graph.edges.filter(e => e.type === "internal");
  const edgeCount = Math.min(internalEdges.length, 100);
  
  for (let i = 0; i < edgeCount; i++) {
    const edge = internalEdges[i];
    dot += `    "${edge.from}" -> "${edge.to}";\n`;
  }
  
  dot += "}\n";
  return dot;
}

/**
 * Generate HTML visualization with D3.js
 */
function generateHtmlVisualization(graph, options = {}) {
  const { maxNodes = 100 } = options;
  
  const nodes = Array.from(graph.nodes.values()).slice(0, maxNodes);
  const edges = graph.edges.filter(e => e.type === "internal").slice(0, 200);
  
  const html = `<!DOCTYPE html>
<html>
<head>
    <title>Dependency Graph - ${path.basename(process.cwd())}</title>
    <script src="https://d3js.org/d3.v7.min.js"></script>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        .node { cursor: pointer; }
        .node circle { stroke: #333; stroke-width: 2px; }
        .node text { font-size: 12px; pointer-events: none; }
        .link { stroke: #999; stroke-opacity: 0.6; }
        .component { fill: #e1f5fe; }
        .hook { fill: #f3e5f5; }
        .api { fill: #ffebee; }
        .utility { fill: #e8f5e9; }
        .config { fill: #fff3e0; }
        .file { fill: #f5f5f5; }
        .stats { background: #f5f5f5; padding: 15px; border-radius: 5px; margin-bottom: 20px; }
    </style>
</head>
<body>
    <h1>Dependency Graph Visualization</h1>
    <div class="stats">
        <strong>Stats:</strong> 
        Files: ${graph.stats.totalFiles} | 
        Internal Imports: ${graph.stats.internalImports} | 
        External Imports: ${graph.stats.externalImports} | 
        Circular Dependencies: ${graph.stats.circularDeps}
    </div>
    <svg width="1200" height="800"></svg>
    
    <script>
        const data = {
            nodes: ${JSON.stringify(nodes.map(n => ({
                id: n.id,
                label: n.label,
                type: n.type,
                imports: n.imports.length,
                importedBy: n.importedBy.length
            })))},
            links: ${JSON.stringify(edges.map(e => ({
                source: e.from,
                target: e.to
            })))}
        };
        
        const svg = d3.select("svg");
        const width = +svg.attr("width");
        const height = +svg.attr("height");
        
        const simulation = d3.forceSimulation(data.nodes)
            .force("link", d3.forceLink(data.links).id(d => d.id).distance(100))
            .force("charge", d3.forceManyBody().strength(-300))
            .force("center", d3.forceCenter(width / 2, height / 2));
        
        const link = svg.append("g")
            .selectAll("line")
            .data(data.links)
            .enter().append("line")
            .attr("class", "link");
        
        const node = svg.append("g")
            .selectAll("g")
            .data(data.nodes)
            .enter().append("g")
            .attr("class", "node")
            .call(d3.drag()
                .on("start", dragstarted)
                .on("drag", dragged)
                .on("end", dragended));
        
        node.append("circle")
            .attr("r", d => Math.max(10, Math.min(30, d.imports + d.importedBy)))
            .attr("class", d => d.type);
        
        node.append("text")
            .text(d => d.label)
            .attr("x", 0)
            .attr("y", 0);
        
        node.on("click", function(event, d) {
            alert(\`File: \${d.id}\\nType: \${d.type}\\nImports: \${d.imports}\\nImported by: \${d.importedBy}\`);
        });
        
        simulation.on("tick", () => {
            link
                .attr("x1", d => d.source.x)
                .attr("y1", d => d.source.y)
                .attr("x2", d => d.target.x)
                .attr("y2", d => d.target.y);
            
            node.attr("transform", d => \`translate(\${d.x},\${d.y})\`);
        });
        
        function dragstarted(event, d) {
            if (!event.active) simulation.alphaTarget(0.3).restart();
            d.fx = d.x;
            d.fy = d.y;
        }
        
        function dragged(event, d) {
            d.fx = event.x;
            d.fy = event.y;
        }
        
        function dragended(event, d) {
            if (!event.active) simulation.alphaTarget(0);
            d.fx = null;
            d.fy = null;
        }
    </script>
</body>
</html>`;
  
  return html;
}

module.exports = {
  buildDependencyGraph,
  generateMermaidDiagram,
  generateDotGraph,
  generateHtmlVisualization,
};
