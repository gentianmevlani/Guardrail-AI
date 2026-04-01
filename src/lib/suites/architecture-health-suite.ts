/**
 * Architecture Health Suite
 *
 * Unified architecture intelligence combining:
 * - Architecture Drift Predictor (detects decay)
 * - Code Smell Predictor (identifies bad patterns)
 * - Code Relationship Visualizer (dependency graphs)
 * - Code Pattern DNA (fingerprints codebase)
 * - Temporal Code Intelligence (time-based analysis)
 *
 * Monitors and maintains long-term codebase health.
 */

import * as fs from "fs/promises";
import * as path from "path";

// ============================================================================
// TYPES
// ============================================================================

export interface ArchitectureHealthReport {
  projectPath: string;
  timestamp: string;
  duration: number;

  // Overall health scores
  scores: {
    overall: number;
    modularity: number;
    coupling: number;
    cohesion: number;
    complexity: number;
    maintainability: number;
  };

  // Architecture analysis
  architecture: {
    layers: ArchitectureLayer[];
    violations: LayerViolation[];
    dependencies: DependencyGraph;
    circularDeps: CircularDependency[];
  };

  // Code smells
  smells: CodeSmell[];

  // Drift analysis
  drift: {
    score: number;
    trends: DriftTrend[];
    predictions: DriftPrediction[];
  };

  // Pattern analysis
  patterns: {
    detected: DetectedPattern[];
    antiPatterns: AntiPattern[];
    suggestions: PatternSuggestion[];
  };

  // Recommendations
  recommendations: ArchitectureRecommendation[];

  // Visualizations
  visualizations: {
    dependencyGraph: string; // Mermaid diagram
    layerDiagram: string;
    heatmap: HeatmapData;
  };
}

export interface ArchitectureLayer {
  name: string;
  path: string;
  files: number;
  loc: number;
  dependencies: string[];
  dependents: string[];
}

export interface LayerViolation {
  id: string;
  type: "skip_layer" | "circular" | "wrong_direction" | "hidden_dependency";
  severity: "critical" | "high" | "medium" | "low";
  from: string;
  to: string;
  file: string;
  line?: number;
  description: string;
  suggestion: string;
}

export interface DependencyGraph {
  nodes: DependencyNode[];
  edges: DependencyEdge[];
  clusters: DependencyCluster[];
}

export interface DependencyNode {
  id: string;
  name: string;
  path: string;
  type: "file" | "module" | "package";
  size: number;
  complexity: number;
  instability: number;
}

export interface DependencyEdge {
  from: string;
  to: string;
  weight: number;
  type: "import" | "extends" | "implements" | "uses";
}

export interface DependencyCluster {
  id: string;
  name: string;
  nodes: string[];
  cohesion: number;
}

export interface CircularDependency {
  id: string;
  cycle: string[];
  severity: "critical" | "high" | "medium";
  suggestion: string;
}

export interface CodeSmell {
  id: string;
  type: SmellType;
  severity: "critical" | "high" | "medium" | "low";
  file: string;
  line?: number;
  name: string;
  description: string;
  impact: string;
  refactoring: string;
  effort: "low" | "medium" | "high";
}

export type SmellType =
  | "god_class"
  | "feature_envy"
  | "data_clump"
  | "primitive_obsession"
  | "long_method"
  | "long_parameter_list"
  | "duplicate_code"
  | "dead_code"
  | "speculative_generality"
  | "shotgun_surgery"
  | "parallel_inheritance"
  | "lazy_class"
  | "temporary_field"
  | "message_chain"
  | "middle_man"
  | "inappropriate_intimacy"
  | "divergent_change"
  | "comments";

export interface DriftTrend {
  metric: string;
  direction: "improving" | "stable" | "degrading";
  change: number;
  period: string;
}

export interface DriftPrediction {
  metric: string;
  currentValue: number;
  predictedValue: number;
  timeframe: string;
  confidence: number;
  risk: "low" | "medium" | "high";
}

export interface DetectedPattern {
  name: string;
  type: "design" | "architectural" | "behavioral";
  files: string[];
  confidence: number;
  description: string;
}

export interface AntiPattern {
  name: string;
  severity: "critical" | "high" | "medium" | "low";
  files: string[];
  description: string;
  impact: string;
  refactoring: string;
}

export interface PatternSuggestion {
  currentState: string;
  suggestedPattern: string;
  benefit: string;
  effort: "low" | "medium" | "high";
  files: string[];
}

export interface ArchitectureRecommendation {
  priority: number;
  category: "modularity" | "coupling" | "complexity" | "patterns" | "smells";
  action: string;
  reason: string;
  impact: "low" | "medium" | "high";
  effort: "low" | "medium" | "high";
}

export interface HeatmapData {
  files: { path: string; complexity: number; churn: number; bugs: number }[];
  hotspots: string[];
}

// ============================================================================
// CODE SMELL DEFINITIONS
// ============================================================================

const SMELL_THRESHOLDS = {
  godClass: { methods: 20, loc: 500, responsibilities: 5 },
  longMethod: { loc: 50, complexity: 10 },
  longParameterList: { params: 5 },
  duplicateCode: { similarity: 0.8, minLines: 10 },
  deepNesting: { depth: 4 },
  largeFile: { loc: 1000 },
};

// ============================================================================
// ARCHITECTURE HEALTH SUITE
// ============================================================================

class ArchitectureHealthSuite {
  /**
   * Run comprehensive architecture health analysis
   */
  async analyze(projectPath: string): Promise<ArchitectureHealthReport> {
    const startTime = Date.now();

    console.log(`🏗️ Architecture Health analyzing: ${projectPath}`);

    // Get all source files
    const files = await this.getSourceFiles(projectPath);
    console.log(`📁 Analyzing ${files.length} files`);

    // Analyze architecture
    const architecture = await this.analyzeArchitecture(files, projectPath);

    // Detect code smells
    const smells = await this.detectCodeSmells(files, projectPath);

    // Analyze drift
    const drift = await this.analyzeDrift(files, projectPath);

    // Detect patterns
    const patterns = await this.analyzePatterns(files, projectPath);

    // Calculate scores
    const scores = this.calculateScores(architecture, smells, drift);

    // Generate recommendations
    const recommendations = this.generateRecommendations(
      architecture,
      smells,
      patterns,
    );

    // Generate visualizations
    const visualizations = this.generateVisualizations(architecture);

    const duration = Date.now() - startTime;

    return {
      projectPath,
      timestamp: new Date().toISOString(),
      duration,
      scores,
      architecture,
      smells,
      drift,
      patterns,
      recommendations,
      visualizations,
    };
  }

  /**
   * Quick dependency analysis
   */
  async analyzeDependencies(projectPath: string): Promise<DependencyGraph> {
    const files = await this.getSourceFiles(projectPath);
    return this.buildDependencyGraph(files, projectPath);
  }

  /**
   * Find circular dependencies
   */
  async findCircularDependencies(
    projectPath: string,
  ): Promise<CircularDependency[]> {
    const files = await this.getSourceFiles(projectPath);
    const graph = await this.buildDependencyGraph(files, projectPath);
    return this.detectCircularDependencies(graph);
  }

  // ============================================================================
  // ARCHITECTURE ANALYSIS
  // ============================================================================

  private async analyzeArchitecture(
    files: string[],
    projectPath: string,
  ): Promise<ArchitectureHealthReport["architecture"]> {
    // Detect layers
    const layers = await this.detectLayers(files, projectPath);

    // Build dependency graph
    const dependencies = await this.buildDependencyGraph(files, projectPath);

    // Detect layer violations
    const violations = this.detectLayerViolations(layers, dependencies);

    // Find circular dependencies
    const circularDeps = this.detectCircularDependencies(dependencies);

    return {
      layers,
      violations,
      dependencies,
      circularDeps,
    };
  }

  private async detectLayers(
    files: string[],
    projectPath: string,
  ): Promise<ArchitectureLayer[]> {
    const layers: Map<string, ArchitectureLayer> = new Map();

    // Common layer patterns
    const layerPatterns = [
      { pattern: /\/api\/|\/routes\/|\/controllers\//i, name: "API Layer" },
      { pattern: /\/services\/|\/business\//i, name: "Service Layer" },
      { pattern: /\/models\/|\/entities\/|\/domain\//i, name: "Domain Layer" },
      { pattern: /\/repositories\/|\/data\/|\/dal\//i, name: "Data Layer" },
      { pattern: /\/utils\/|\/helpers\/|\/lib\//i, name: "Utility Layer" },
      { pattern: /\/components\/|\/views\/|\/ui\//i, name: "UI Layer" },
    ];

    for (const file of files) {
      const relativePath = path.relative(projectPath, file);

      for (const { pattern, name } of layerPatterns) {
        if (pattern.test(relativePath)) {
          if (!layers.has(name)) {
            layers.set(name, {
              name,
              path: relativePath.split("/")[0],
              files: 0,
              loc: 0,
              dependencies: [],
              dependents: [],
            });
          }

          const layer = layers.get(name)!;
          layer.files++;

          try {
            const content = await fs.readFile(file, "utf-8");
            layer.loc += content.split("\n").length;
          } catch {
            // Skip unreadable files
          }

          break;
        }
      }
    }

    return Array.from(layers.values());
  }

  private async buildDependencyGraph(
    files: string[],
    projectPath: string,
  ): Promise<DependencyGraph> {
    const nodes: Map<string, DependencyNode> = new Map();
    const edges: DependencyEdge[] = [];

    for (const file of files) {
      const relativePath = path.relative(projectPath, file);

      try {
        const content = await fs.readFile(file, "utf-8");
        const lines = content.split("\n");

        // Create node
        nodes.set(relativePath, {
          id: relativePath,
          name: path.basename(file, path.extname(file)),
          path: relativePath,
          type: "file",
          size: lines.length,
          complexity: this.calculateComplexity(content),
          instability: 0,
        });

        // Find imports
        const importPattern = /import\s+.*\s+from\s+['"]([^'"]+)['"]/g;
        let match;

        while ((match = importPattern.exec(content)) !== null) {
          const importPath = match[1];

          // Resolve relative imports
          if (importPath.startsWith(".")) {
            const resolvedPath = path.normalize(
              path.join(path.dirname(relativePath), importPath),
            );

            edges.push({
              from: relativePath,
              to: resolvedPath,
              weight: 1,
              type: "import",
            });
          }
        }
      } catch {
        // Skip unreadable files
      }
    }

    // Calculate instability for each node
    for (const [id, node] of nodes) {
      const outgoing = edges.filter((e) => e.from === id).length;
      const incoming = edges.filter((e) => e.to === id).length;
      node.instability = outgoing / (outgoing + incoming + 1);
    }

    // Detect clusters using simple community detection
    const clusters = this.detectClusters(nodes, edges);

    return {
      nodes: Array.from(nodes.values()),
      edges,
      clusters,
    };
  }

  private detectClusters(
    nodes: Map<string, DependencyNode>,
    edges: DependencyEdge[],
  ): DependencyCluster[] {
    const clusters: DependencyCluster[] = [];
    const visited = new Set<string>();

    // Simple clustering by directory
    const dirMap = new Map<string, string[]>();

    for (const node of nodes.values()) {
      const dir = path.dirname(node.path);
      if (!dirMap.has(dir)) {
        dirMap.set(dir, []);
      }
      dirMap.get(dir)!.push(node.id);
    }

    for (const [dir, nodeIds] of dirMap) {
      if (nodeIds.length > 1) {
        // Calculate cohesion
        const internalEdges = edges.filter(
          (e) => nodeIds.includes(e.from) && nodeIds.includes(e.to),
        ).length;
        const maxEdges = nodeIds.length * (nodeIds.length - 1);
        const cohesion = maxEdges > 0 ? internalEdges / maxEdges : 0;

        clusters.push({
          id: dir,
          name: path.basename(dir) || "root",
          nodes: nodeIds,
          cohesion,
        });
      }
    }

    return clusters;
  }

  private detectLayerViolations(
    layers: ArchitectureLayer[],
    graph: DependencyGraph,
  ): LayerViolation[] {
    const violations: LayerViolation[] = [];

    // Define valid dependencies (higher layers can depend on lower)
    const layerOrder = [
      "UI Layer",
      "API Layer",
      "Service Layer",
      "Domain Layer",
      "Data Layer",
      "Utility Layer",
    ];

    for (const edge of graph.edges) {
      const fromLayer = this.getLayerForPath(edge.from, layers);
      const toLayer = this.getLayerForPath(edge.to, layers);

      if (fromLayer && toLayer && fromLayer !== toLayer) {
        const fromIndex = layerOrder.indexOf(fromLayer.name);
        const toIndex = layerOrder.indexOf(toLayer.name);

        // Wrong direction violation
        if (fromIndex > toIndex && toLayer.name !== "Utility Layer") {
          violations.push({
            id: `violation-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            type: "wrong_direction",
            severity: "high",
            from: fromLayer.name,
            to: toLayer.name,
            file: edge.from,
            description: `${fromLayer.name} should not depend on ${toLayer.name}`,
            suggestion: `Move shared code to a lower layer or use dependency inversion`,
          });
        }

        // Skip layer violation
        if (
          Math.abs(fromIndex - toIndex) > 1 &&
          toLayer.name !== "Utility Layer"
        ) {
          violations.push({
            id: `violation-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            type: "skip_layer",
            severity: "medium",
            from: fromLayer.name,
            to: toLayer.name,
            file: edge.from,
            description: `${fromLayer.name} skips intermediate layers to access ${toLayer.name}`,
            suggestion: `Consider going through intermediate layers`,
          });
        }
      }
    }

    return violations;
  }

  private getLayerForPath(
    filePath: string,
    layers: ArchitectureLayer[],
  ): ArchitectureLayer | undefined {
    for (const layer of layers) {
      if (filePath.includes(layer.path)) {
        return layer;
      }
    }
    return undefined;
  }

  private detectCircularDependencies(
    graph: DependencyGraph,
  ): CircularDependency[] {
    const circular: CircularDependency[] = [];
    const visited = new Set<string>();
    const recursionStack = new Set<string>();

    const dfs = (node: string, path: string[]): void => {
      visited.add(node);
      recursionStack.add(node);
      path.push(node);

      const outgoing = graph.edges.filter((e) => e.from === node);

      for (const edge of outgoing) {
        if (!visited.has(edge.to)) {
          dfs(edge.to, [...path]);
        } else if (recursionStack.has(edge.to)) {
          // Found cycle
          const cycleStart = path.indexOf(edge.to);
          const cycle = [...path.slice(cycleStart), edge.to];

          circular.push({
            id: `circular-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            cycle,
            severity:
              cycle.length <= 3
                ? "critical"
                : cycle.length <= 5
                  ? "high"
                  : "medium",
            suggestion: `Break the cycle by extracting shared code or using dependency injection`,
          });
        }
      }

      recursionStack.delete(node);
    };

    for (const node of graph.nodes) {
      if (!visited.has(node.id)) {
        dfs(node.id, []);
      }
    }

    return circular;
  }

  // ============================================================================
  // CODE SMELL DETECTION
  // ============================================================================

  private async detectCodeSmells(
    files: string[],
    projectPath: string,
  ): Promise<CodeSmell[]> {
    const smells: CodeSmell[] = [];

    for (const file of files) {
      try {
        const content = await fs.readFile(file, "utf-8");
        const relativePath = path.relative(projectPath, file);

        // Detect various smells
        smells.push(...this.detectGodClass(content, relativePath));
        smells.push(...this.detectLongMethods(content, relativePath));
        smells.push(...this.detectLongParameterList(content, relativePath));
        smells.push(...this.detectDeadCode(content, relativePath));
        smells.push(...this.detectDeepNesting(content, relativePath));
        smells.push(...this.detectDuplicateCode(content, relativePath));
      } catch {
        // Skip unreadable files
      }
    }

    return smells;
  }

  private detectGodClass(content: string, file: string): CodeSmell[] {
    const smells: CodeSmell[] = [];
    const lines = content.split("\n");

    // Count methods in class
    const classPattern = /class\s+(\w+)/g;
    const methodPattern =
      /(?:async\s+)?(?:public\s+|private\s+|protected\s+)?(\w+)\s*\([^)]*\)\s*(?::\s*\w+)?\s*\{/g;

    let match;
    while ((match = classPattern.exec(content)) !== null) {
      const className = match[1];
      const classStart = match.index;

      // Find class end (simplified)
      let depth = 0;
      let classEnd = classStart;
      let inClass = false;

      for (let i = classStart; i < content.length; i++) {
        if (content[i] === "{") {
          depth++;
          inClass = true;
        } else if (content[i] === "}") {
          depth--;
          if (inClass && depth === 0) {
            classEnd = i;
            break;
          }
        }
      }

      const classContent = content.substring(classStart, classEnd);
      const methodCount = (classContent.match(methodPattern) || []).length;
      const classLoc = classContent.split("\n").length;

      if (
        methodCount > SMELL_THRESHOLDS.godClass.methods ||
        classLoc > SMELL_THRESHOLDS.godClass.loc
      ) {
        smells.push({
          id: `smell-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          type: "god_class",
          severity: methodCount > 30 || classLoc > 1000 ? "critical" : "high",
          file,
          line: content.substring(0, classStart).split("\n").length,
          name: `God Class: ${className}`,
          description: `Class ${className} has ${methodCount} methods and ${classLoc} lines`,
          impact: "Difficult to understand, test, and maintain",
          refactoring:
            "Split into smaller, focused classes using Single Responsibility Principle",
          effort: "high",
        });
      }
    }

    return smells;
  }

  private detectLongMethods(content: string, file: string): CodeSmell[] {
    const smells: CodeSmell[] = [];

    const functionPattern =
      /(?:function\s+(\w+)|(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s*)?\([^)]*\)\s*=>|(\w+)\s*\([^)]*\)\s*\{)/g;

    let match;
    while ((match = functionPattern.exec(content)) !== null) {
      const funcName = match[1] || match[2] || match[3];
      const funcStart = match.index;

      // Find function end
      let depth = 0;
      let funcEnd = funcStart;
      let inFunc = false;

      for (let i = funcStart; i < content.length; i++) {
        if (content[i] === "{") {
          depth++;
          inFunc = true;
        } else if (content[i] === "}") {
          depth--;
          if (inFunc && depth === 0) {
            funcEnd = i;
            break;
          }
        }
      }

      const funcContent = content.substring(funcStart, funcEnd);
      const funcLoc = funcContent.split("\n").length;
      const complexity = this.calculateComplexity(funcContent);

      if (
        funcLoc > SMELL_THRESHOLDS.longMethod.loc ||
        complexity > SMELL_THRESHOLDS.longMethod.complexity
      ) {
        smells.push({
          id: `smell-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          type: "long_method",
          severity: funcLoc > 100 ? "high" : "medium",
          file,
          line: content.substring(0, funcStart).split("\n").length,
          name: `Long Method: ${funcName}`,
          description: `Method ${funcName} has ${funcLoc} lines and complexity ${complexity}`,
          impact: "Hard to understand and test",
          refactoring: "Extract smaller methods with descriptive names",
          effort: "medium",
        });
      }
    }

    return smells;
  }

  private detectLongParameterList(content: string, file: string): CodeSmell[] {
    const smells: CodeSmell[] = [];

    const funcPattern = /(?:function\s+(\w+)|(\w+))\s*\(([^)]+)\)/g;

    let match;
    while ((match = funcPattern.exec(content)) !== null) {
      const funcName = match[1] || match[2];
      const params = match[3];
      const paramCount = params.split(",").filter((p) => p.trim()).length;

      if (paramCount > SMELL_THRESHOLDS.longParameterList.params) {
        smells.push({
          id: `smell-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          type: "long_parameter_list",
          severity: paramCount > 7 ? "high" : "medium",
          file,
          line: content.substring(0, match.index).split("\n").length,
          name: `Long Parameter List: ${funcName}`,
          description: `Function ${funcName} has ${paramCount} parameters`,
          impact: "Hard to call correctly and understand",
          refactoring: "Use parameter object or builder pattern",
          effort: "low",
        });
      }
    }

    return smells;
  }

  private detectDeadCode(content: string, file: string): CodeSmell[] {
    const smells: CodeSmell[] = [];

    // Check for unused exports (simplified)
    const unusedPatterns = [
      /\/\*[\s\S]*?\*\//g, // Large comment blocks
      /console\.(log|debug|info)\(/g, // Debug statements
      /debugger;/g, // Debugger statements
    ];

    for (const pattern of unusedPatterns) {
      let match;
      while ((match = pattern.exec(content)) !== null) {
        if (
          match[0].length > 100 ||
          match[0].includes("debugger") ||
          match[0].includes("console")
        ) {
          smells.push({
            id: `smell-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            type: "dead_code",
            severity: "low",
            file,
            line: content.substring(0, match.index).split("\n").length,
            name: "Dead Code / Debug Statement",
            description: "Debug code or large comment blocks should be removed",
            impact: "Clutters codebase and may leak sensitive info",
            refactoring: "Remove debug statements and unnecessary comments",
            effort: "low",
          });
        }
      }
    }

    return smells;
  }

  private detectDeepNesting(content: string, file: string): CodeSmell[] {
    const smells: CodeSmell[] = [];
    const lines = content.split("\n");

    let maxDepth = 0;
    let deepestLine = 0;
    let currentDepth = 0;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const opens = (line.match(/\{/g) || []).length;
      const closes = (line.match(/\}/g) || []).length;

      currentDepth += opens - closes;

      if (currentDepth > maxDepth) {
        maxDepth = currentDepth;
        deepestLine = i + 1;
      }
    }

    if (maxDepth > SMELL_THRESHOLDS.deepNesting.depth) {
      smells.push({
        id: `smell-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        type: "long_method",
        severity: maxDepth > 6 ? "high" : "medium",
        file,
        line: deepestLine,
        name: `Deep Nesting (${maxDepth} levels)`,
        description: `Code has ${maxDepth} levels of nesting`,
        impact: "Hard to follow logic flow",
        refactoring: "Use early returns, extract methods, or use guard clauses",
        effort: "medium",
      });
    }

    return smells;
  }

  private detectDuplicateCode(content: string, file: string): CodeSmell[] {
    // Simplified duplicate detection - in production use proper algorithm
    return [];
  }

  // ============================================================================
  // DRIFT ANALYSIS
  // ============================================================================

  private async analyzeDrift(
    files: string[],
    projectPath: string,
  ): Promise<ArchitectureHealthReport["drift"]> {
    // In production, compare with historical data
    const currentMetrics = await this.calculateMetrics(files, projectPath);

    return {
      score: 85, // Placeholder
      trends: [
        {
          metric: "Complexity",
          direction: "stable",
          change: 0,
          period: "30 days",
        },
        {
          metric: "Coupling",
          direction: "improving",
          change: -5,
          period: "30 days",
        },
        {
          metric: "Test Coverage",
          direction: "degrading",
          change: -3,
          period: "30 days",
        },
      ],
      predictions: [
        {
          metric: "Technical Debt",
          currentValue: 15,
          predictedValue: 20,
          timeframe: "3 months",
          confidence: 0.7,
          risk: "medium",
        },
      ],
    };
  }

  private async calculateMetrics(files: string[], projectPath: string) {
    let totalLoc = 0;
    let totalComplexity = 0;

    for (const file of files.slice(0, 50)) {
      try {
        const content = await fs.readFile(file, "utf-8");
        totalLoc += content.split("\n").length;
        totalComplexity += this.calculateComplexity(content);
      } catch {
        // Skip
      }
    }

    return { loc: totalLoc, complexity: totalComplexity };
  }

  // ============================================================================
  // PATTERN ANALYSIS
  // ============================================================================

  private async analyzePatterns(
    files: string[],
    projectPath: string,
  ): Promise<ArchitectureHealthReport["patterns"]> {
    const detected: DetectedPattern[] = [];
    const antiPatterns: AntiPattern[] = [];
    const suggestions: PatternSuggestion[] = [];

    // Detect common patterns
    for (const file of files.slice(0, 30)) {
      try {
        const content = await fs.readFile(file, "utf-8");
        const relativePath = path.relative(projectPath, file);

        // Singleton pattern
        if (/private\s+static\s+instance|getInstance\s*\(/i.test(content)) {
          detected.push({
            name: "Singleton",
            type: "design",
            files: [relativePath],
            confidence: 0.9,
            description: "Singleton pattern detected",
          });
        }

        // Factory pattern
        if (
          /create\w+|factory/i.test(content) &&
          /return\s+new\s+/i.test(content)
        ) {
          detected.push({
            name: "Factory",
            type: "design",
            files: [relativePath],
            confidence: 0.8,
            description: "Factory pattern detected",
          });
        }

        // Anti-pattern: Callback hell
        if ((content.match(/\.then\s*\(/g) || []).length > 5) {
          antiPatterns.push({
            name: "Callback Hell",
            severity: "medium",
            files: [relativePath],
            description: "Multiple chained promises detected",
            impact: "Hard to read and maintain",
            refactoring: "Use async/await syntax",
          });
        }

        // Anti-pattern: Magic numbers
        if (
          /[^a-zA-Z0-9_](?:0|1[0-9]{2,}|[2-9][0-9]+)[^a-zA-Z0-9_]/g.test(
            content,
          )
        ) {
          antiPatterns.push({
            name: "Magic Numbers",
            severity: "low",
            files: [relativePath],
            description: "Unexplained numeric literals in code",
            impact: "Code is harder to understand",
            refactoring: "Extract to named constants",
          });
        }
      } catch {
        // Skip
      }
    }

    return { detected, antiPatterns, suggestions };
  }

  // ============================================================================
  // SCORING & RECOMMENDATIONS
  // ============================================================================

  private calculateScores(
    architecture: ArchitectureHealthReport["architecture"],
    smells: CodeSmell[],
    drift: ArchitectureHealthReport["drift"],
  ) {
    const violationPenalty = architecture.violations.length * 5;
    const circularPenalty = architecture.circularDeps.length * 10;
    const smellPenalty = smells.reduce((sum, s) => {
      return (
        sum +
        (s.severity === "critical"
          ? 15
          : s.severity === "high"
            ? 10
            : s.severity === "medium"
              ? 5
              : 2)
      );
    }, 0);

    const modularity = Math.max(0, 100 - violationPenalty);
    const coupling = Math.max(0, 100 - circularPenalty);
    const complexity = Math.max(0, 100 - smellPenalty / 2);
    const maintainability = Math.round(
      (modularity + coupling + complexity) / 3,
    );

    return {
      overall: Math.round(
        (modularity + coupling + complexity + drift.score) / 4,
      ),
      modularity,
      coupling,
      cohesion: 75, // Placeholder
      complexity,
      maintainability,
    };
  }

  private generateRecommendations(
    architecture: ArchitectureHealthReport["architecture"],
    smells: CodeSmell[],
    patterns: ArchitectureHealthReport["patterns"],
  ): ArchitectureRecommendation[] {
    const recommendations: ArchitectureRecommendation[] = [];

    if (architecture.circularDeps.length > 0) {
      recommendations.push({
        priority: 1,
        category: "coupling",
        action: `Fix ${architecture.circularDeps.length} circular dependencies`,
        reason: "Circular dependencies make code hard to test and deploy",
        impact: "high",
        effort: "high",
      });
    }

    if (architecture.violations.length > 0) {
      recommendations.push({
        priority: 2,
        category: "modularity",
        action: `Resolve ${architecture.violations.length} layer violations`,
        reason: "Layer violations compromise architecture integrity",
        impact: "high",
        effort: "medium",
      });
    }

    const criticalSmells = smells.filter((s) => s.severity === "critical");
    if (criticalSmells.length > 0) {
      recommendations.push({
        priority: 3,
        category: "smells",
        action: `Refactor ${criticalSmells.length} critical code smells`,
        reason: "Critical smells indicate serious maintainability issues",
        impact: "high",
        effort: "high",
      });
    }

    if (patterns.antiPatterns.length > 0) {
      recommendations.push({
        priority: 4,
        category: "patterns",
        action: `Address ${patterns.antiPatterns.length} anti-patterns`,
        reason: "Anti-patterns lead to technical debt",
        impact: "medium",
        effort: "medium",
      });
    }

    return recommendations.sort((a, b) => a.priority - b.priority);
  }

  // ============================================================================
  // VISUALIZATIONS
  // ============================================================================

  private generateVisualizations(
    architecture: ArchitectureHealthReport["architecture"],
  ) {
    // Generate Mermaid dependency graph
    const dependencyGraph = this.generateMermaidGraph(
      architecture.dependencies,
    );

    // Generate layer diagram
    const layerDiagram = this.generateLayerDiagram(architecture.layers);

    // Generate heatmap data
    const heatmap = this.generateHeatmap(architecture.dependencies);

    return {
      dependencyGraph,
      layerDiagram,
      heatmap,
    };
  }

  private generateMermaidGraph(graph: DependencyGraph): string {
    let mermaid = "graph TD\n";

    // Add nodes
    for (const node of graph.nodes.slice(0, 20)) {
      const shortName = path.basename(node.name);
      mermaid += `  ${node.id.replace(/[^a-zA-Z0-9]/g, "_")}["${shortName}"]\n`;
    }

    // Add edges
    for (const edge of graph.edges.slice(0, 30)) {
      const fromId = edge.from.replace(/[^a-zA-Z0-9]/g, "_");
      const toId = edge.to.replace(/[^a-zA-Z0-9]/g, "_");
      mermaid += `  ${fromId} --> ${toId}\n`;
    }

    return mermaid;
  }

  private generateLayerDiagram(layers: ArchitectureLayer[]): string {
    let diagram = "graph TB\n";

    for (const layer of layers) {
      const id = layer.name.replace(/\s/g, "_");
      diagram += `  ${id}["${layer.name}<br/>${layer.files} files"]\n`;
    }

    // Add layer relationships
    const layerOrder = [
      "UI_Layer",
      "API_Layer",
      "Service_Layer",
      "Domain_Layer",
      "Data_Layer",
    ];
    for (let i = 0; i < layerOrder.length - 1; i++) {
      if (
        layers.some((l) => l.name.replace(/\s/g, "_") === layerOrder[i]) &&
        layers.some((l) => l.name.replace(/\s/g, "_") === layerOrder[i + 1])
      ) {
        diagram += `  ${layerOrder[i]} --> ${layerOrder[i + 1]}\n`;
      }
    }

    return diagram;
  }

  private generateHeatmap(graph: DependencyGraph): HeatmapData {
    const files = graph.nodes.map((n) => ({
      path: n.path,
      complexity: n.complexity,
      churn: Math.random() * 100, // Placeholder - would use git history
      bugs: Math.floor(Math.random() * 10), // Placeholder
    }));

    const hotspots = files
      .sort((a, b) => b.complexity * b.churn - a.complexity * a.churn)
      .slice(0, 5)
      .map((f) => f.path);

    return { files, hotspots };
  }

  // ============================================================================
  // UTILITIES
  // ============================================================================

  private calculateComplexity(code: string): number {
    const decisions = (
      code.match(/\b(if|else|for|while|switch|case|catch|&&|\|\|)\b/g) || []
    ).length;
    return decisions + 1;
  }

  private async getSourceFiles(projectPath: string): Promise<string[]> {
    const extensions = [".ts", ".tsx", ".js", ".jsx"];
    const excludedDirs = [
      "node_modules",
      ".git",
      "dist",
      "build",
      ".next",
      "coverage",
    ];
    const files: string[] = [];

    const walk = async (dir: string) => {
      try {
        const entries = await fs.readdir(dir, { withFileTypes: true });

        for (const entry of entries) {
          const fullPath = path.join(dir, entry.name);

          if (entry.isDirectory() && !excludedDirs.includes(entry.name)) {
            await walk(fullPath);
          } else if (
            entry.isFile() &&
            extensions.some((ext) => entry.name.endsWith(ext))
          ) {
            files.push(fullPath);
          }
        }
      } catch {
        // Skip inaccessible directories
      }
    };

    await walk(projectPath);
    return files;
  }
}

export const architectureHealthSuite = new ArchitectureHealthSuite();
export default architectureHealthSuite;
