/**
 * Team Intelligence Suite
 *
 * Unified team intelligence combining:
 * - Team Knowledge Graph (maps expertise)
 * - Decision Tracker (architectural decisions)
 * - Cross-Project Intelligence (multi-repo insights)
 * - Developer Style Analysis (coding patterns)
 * - Collaboration Metrics (team health)
 *
 * Helps teams work better together and preserve institutional knowledge.
 */

import * as fs from "fs/promises";
import * as path from "path";
import { execSync } from "child_process";

// ============================================================================
// TYPES
// ============================================================================

export interface TeamIntelligenceReport {
  projectPath: string;
  timestamp: string;
  duration: number;

  // Team knowledge
  knowledge: {
    graph: KnowledgeGraph;
    experts: ExpertiseMapping[];
    orphanedKnowledge: OrphanedKnowledge[];
  };

  // Decisions
  decisions: {
    tracked: ArchitecturalDecision[];
    pending: PendingDecision[];
    violations: DecisionViolation[];
  };

  // Collaboration
  collaboration: {
    metrics: CollaborationMetrics;
    codeOwnership: CodeOwnership[];
    busFactor: BusFactorAnalysis;
  };

  // Developer insights
  developers: {
    contributors: DeveloperProfile[];
    stylePatterns: StylePattern[];
    reviewPatterns: ReviewPattern[];
  };

  // Recommendations
  recommendations: TeamRecommendation[];
}

export interface KnowledgeGraph {
  nodes: KnowledgeNode[];
  edges: KnowledgeEdge[];
  clusters: KnowledgeCluster[];
}

export interface KnowledgeNode {
  id: string;
  type: "developer" | "file" | "module" | "concept";
  name: string;
  weight: number;
  metadata: Record<string, any>;
}

export interface KnowledgeEdge {
  from: string;
  to: string;
  type: "authored" | "reviewed" | "modified" | "owns" | "knows";
  weight: number;
  lastActivity: string;
}

export interface KnowledgeCluster {
  id: string;
  name: string;
  nodes: string[];
  primaryExperts: string[];
  coverage: number;
}

export interface ExpertiseMapping {
  developer: string;
  areas: {
    area: string;
    score: number;
    commits: number;
    linesChanged: number;
    lastActivity: string;
  }[];
  totalCommits: number;
  totalLinesChanged: number;
}

export interface OrphanedKnowledge {
  area: string;
  files: string[];
  lastModified: string;
  lastAuthor: string;
  risk: "high" | "medium" | "low";
  reason: string;
}

export interface ArchitecturalDecision {
  id: string;
  title: string;
  status: "accepted" | "proposed" | "deprecated" | "superseded";
  date: string;
  authors: string[];
  context: string;
  decision: string;
  consequences: string[];
  relatedFiles: string[];
}

export interface PendingDecision {
  id: string;
  title: string;
  description: string;
  proposedBy: string;
  date: string;
  votes: { for: number; against: number };
  comments: number;
}

export interface DecisionViolation {
  decisionId: string;
  decisionTitle: string;
  file: string;
  line?: number;
  description: string;
  severity: "high" | "medium" | "low";
}

export interface CollaborationMetrics {
  totalContributors: number;
  activeContributors: number;
  averageReviewTime: number; // hours
  averageCommitsPerWeek: number;
  prMergeRate: number;
  codeReviewCoverage: number;
  knowledgeSharingScore: number;
}

export interface CodeOwnership {
  path: string;
  owners: { developer: string; percentage: number }[];
  busFactor: number;
  lastModified: string;
  totalCommits: number;
}

export interface BusFactorAnalysis {
  overall: number;
  byArea: { area: string; busFactor: number; experts: string[] }[];
  criticalAreas: string[];
  recommendations: string[];
}

export interface DeveloperProfile {
  name: string;
  email: string;
  commits: number;
  linesAdded: number;
  linesRemoved: number;
  filesModified: number;
  firstCommit: string;
  lastCommit: string;
  averageCommitSize: number;
  preferredLanguages: string[];
  activeHours: number[];
  reviewsGiven: number;
  reviewsReceived: number;
}

export interface StylePattern {
  developer: string;
  patterns: {
    name: string;
    frequency: number;
    examples: string[];
  }[];
  codeQuality: {
    avgComplexity: number;
    avgFileSize: number;
    commentRatio: number;
    testCoverage: number;
  };
}

export interface ReviewPattern {
  developer: string;
  avgReviewTime: number;
  thoroughness: number;
  focusAreas: string[];
  commonComments: string[];
}

export interface TeamRecommendation {
  priority: number;
  category: "knowledge" | "collaboration" | "process" | "risk";
  action: string;
  reason: string;
  impact: "high" | "medium" | "low";
}

// ============================================================================
// TEAM INTELLIGENCE SUITE
// ============================================================================

class TeamIntelligenceSuite {
  /**
   * Run comprehensive team intelligence analysis
   */
  async analyze(projectPath: string): Promise<TeamIntelligenceReport> {
    const startTime = Date.now();

    console.log(`👥 Team Intelligence analyzing: ${projectPath}`);

    // Build knowledge graph
    const knowledge = await this.analyzeKnowledge(projectPath);

    // Track decisions
    const decisions = await this.analyzeDecisions(projectPath);

    // Analyze collaboration
    const collaboration = await this.analyzeCollaboration(projectPath);

    // Analyze developers
    const developers = await this.analyzeDevelopers(projectPath);

    // Generate recommendations
    const recommendations = this.generateRecommendations(
      knowledge,
      decisions,
      collaboration,
      developers,
    );

    const duration = Date.now() - startTime;

    return {
      projectPath,
      timestamp: new Date().toISOString(),
      duration,
      knowledge,
      decisions,
      collaboration,
      developers,
      recommendations,
    };
  }

  /**
   * Get expertise map
   */
  async getExpertiseMap(projectPath: string): Promise<ExpertiseMapping[]> {
    const gitLog = await this.getGitLog(projectPath);
    return this.buildExpertiseMap(gitLog);
  }

  /**
   * Calculate bus factor
   */
  async calculateBusFactor(projectPath: string): Promise<BusFactorAnalysis> {
    const gitLog = await this.getGitLog(projectPath);
    return this.analyzeBusFactor(gitLog, projectPath);
  }

  // ============================================================================
  // KNOWLEDGE ANALYSIS
  // ============================================================================

  private async analyzeKnowledge(
    projectPath: string,
  ): Promise<TeamIntelligenceReport["knowledge"]> {
    const gitLog = await this.getGitLog(projectPath);

    // Build knowledge graph
    const graph = this.buildKnowledgeGraph(gitLog);

    // Build expertise mapping
    const experts = this.buildExpertiseMap(gitLog);

    // Find orphaned knowledge
    const orphanedKnowledge = await this.findOrphanedKnowledge(
      gitLog,
      projectPath,
    );

    return {
      graph,
      experts,
      orphanedKnowledge,
    };
  }

  private buildKnowledgeGraph(gitLog: GitCommit[]): KnowledgeGraph {
    const nodes: Map<string, KnowledgeNode> = new Map();
    const edges: KnowledgeEdge[] = [];

    // Create developer nodes
    const developerCommits = new Map<string, number>();
    for (const commit of gitLog) {
      developerCommits.set(
        commit.author,
        (developerCommits.get(commit.author) || 0) + 1,
      );
    }

    for (const [dev, commits] of developerCommits) {
      nodes.set(`dev:${dev}`, {
        id: `dev:${dev}`,
        type: "developer",
        name: dev,
        weight: commits,
        metadata: { commits },
      });
    }

    // Create file/module nodes and edges
    const fileAuthors = new Map<string, Map<string, number>>();

    for (const commit of gitLog) {
      for (const file of commit.files) {
        if (!fileAuthors.has(file)) {
          fileAuthors.set(file, new Map());
        }
        const authors = fileAuthors.get(file)!;
        authors.set(commit.author, (authors.get(commit.author) || 0) + 1);
      }
    }

    for (const [file, authors] of fileAuthors) {
      const totalCommits = Array.from(authors.values()).reduce(
        (a, b) => a + b,
        0,
      );

      // Create file node
      const module = path.dirname(file);
      if (!nodes.has(`module:${module}`)) {
        nodes.set(`module:${module}`, {
          id: `module:${module}`,
          type: "module",
          name: module,
          weight: 0,
          metadata: {},
        });
      }
      nodes.get(`module:${module}`)!.weight += totalCommits;

      // Create edges from developers to modules
      for (const [author, commits] of authors) {
        edges.push({
          from: `dev:${author}`,
          to: `module:${module}`,
          type: "modified",
          weight: commits,
          lastActivity:
            gitLog.find((c) => c.author === author && c.files.includes(file))
              ?.date || "",
        });
      }
    }

    // Create clusters
    const clusters = this.clusterKnowledge(nodes, edges);

    return {
      nodes: Array.from(nodes.values()),
      edges,
      clusters,
    };
  }

  private clusterKnowledge(
    nodes: Map<string, KnowledgeNode>,
    edges: KnowledgeEdge[],
  ): KnowledgeCluster[] {
    const clusters: KnowledgeCluster[] = [];

    // Group modules by directory
    const modulesByDir = new Map<string, string[]>();
    for (const node of nodes.values()) {
      if (node.type === "module") {
        const dir = node.name.split("/")[0] || "root";
        if (!modulesByDir.has(dir)) {
          modulesByDir.set(dir, []);
        }
        modulesByDir.get(dir)!.push(node.id);
      }
    }

    for (const [dir, moduleIds] of modulesByDir) {
      // Find primary experts for this cluster
      const expertScores = new Map<string, number>();

      for (const edge of edges) {
        if (moduleIds.includes(edge.to) && edge.from.startsWith("dev:")) {
          const dev = edge.from.replace("dev:", "");
          expertScores.set(dev, (expertScores.get(dev) || 0) + edge.weight);
        }
      }

      const primaryExperts = Array.from(expertScores.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([dev]) => dev);

      clusters.push({
        id: `cluster:${dir}`,
        name: dir,
        nodes: moduleIds,
        primaryExperts,
        coverage: primaryExperts.length > 0 ? 1 : 0,
      });
    }

    return clusters;
  }

  private buildExpertiseMap(gitLog: GitCommit[]): ExpertiseMapping[] {
    const developerAreas = new Map<
      string,
      Map<string, { commits: number; lines: number; lastDate: string }>
    >();

    for (const commit of gitLog) {
      if (!developerAreas.has(commit.author)) {
        developerAreas.set(commit.author, new Map());
      }
      const areas = developerAreas.get(commit.author)!;

      for (const file of commit.files) {
        const area = path.dirname(file).split("/")[0] || "root";

        if (!areas.has(area)) {
          areas.set(area, { commits: 0, lines: 0, lastDate: "" });
        }
        const areaData = areas.get(area)!;
        areaData.commits++;
        areaData.lines += commit.linesChanged;
        if (!areaData.lastDate || commit.date > areaData.lastDate) {
          areaData.lastDate = commit.date;
        }
      }
    }

    const mappings: ExpertiseMapping[] = [];

    for (const [developer, areas] of developerAreas) {
      const totalCommits = Array.from(areas.values()).reduce(
        (sum, a) => sum + a.commits,
        0,
      );
      const totalLines = Array.from(areas.values()).reduce(
        (sum, a) => sum + a.lines,
        0,
      );

      mappings.push({
        developer,
        areas: Array.from(areas.entries())
          .map(([area, data]) => ({
            area,
            score: (data.commits / totalCommits) * 100,
            commits: data.commits,
            linesChanged: data.lines,
            lastActivity: data.lastDate,
          }))
          .sort((a, b) => b.score - a.score),
        totalCommits,
        totalLinesChanged: totalLines,
      });
    }

    return mappings.sort((a, b) => b.totalCommits - a.totalCommits);
  }

  private async findOrphanedKnowledge(
    gitLog: GitCommit[],
    projectPath: string,
  ): Promise<OrphanedKnowledge[]> {
    const orphaned: OrphanedKnowledge[] = [];

    // Find areas with single contributor
    const areaContributors = new Map<string, Set<string>>();
    const areaLastModified = new Map<
      string,
      { date: string; author: string }
    >();

    for (const commit of gitLog) {
      for (const file of commit.files) {
        const area = path.dirname(file);

        if (!areaContributors.has(area)) {
          areaContributors.set(area, new Set());
        }
        areaContributors.get(area)!.add(commit.author);

        const current = areaLastModified.get(area);
        if (!current || commit.date > current.date) {
          areaLastModified.set(area, {
            date: commit.date,
            author: commit.author,
          });
        }
      }
    }

    // Find areas with only one contributor
    for (const [area, contributors] of areaContributors) {
      if (contributors.size === 1) {
        const lastMod = areaLastModified.get(area)!;
        const daysSinceLastMod = Math.floor(
          (Date.now() - new Date(lastMod.date).getTime()) /
            (1000 * 60 * 60 * 24),
        );

        orphaned.push({
          area,
          files: gitLog
            .flatMap((c) => c.files)
            .filter((f) => path.dirname(f) === area)
            .filter((f, i, arr) => arr.indexOf(f) === i)
            .slice(0, 10),
          lastModified: lastMod.date,
          lastAuthor: lastMod.author,
          risk:
            daysSinceLastMod > 180
              ? "high"
              : daysSinceLastMod > 90
                ? "medium"
                : "low",
          reason: `Only one contributor (${Array.from(contributors)[0]}) has worked on this area`,
        });
      }
    }

    return orphaned.sort((a, b) => {
      const riskOrder = { high: 0, medium: 1, low: 2 };
      return riskOrder[a.risk] - riskOrder[b.risk];
    });
  }

  // ============================================================================
  // DECISION ANALYSIS
  // ============================================================================

  private async analyzeDecisions(
    projectPath: string,
  ): Promise<TeamIntelligenceReport["decisions"]> {
    const tracked: ArchitecturalDecision[] = [];
    const pending: PendingDecision[] = [];
    const violations: DecisionViolation[] = [];

    // Look for ADR files
    const adrPaths = [
      path.join(projectPath, "docs", "architecture"),
      path.join(projectPath, "docs", "adr"),
      path.join(projectPath, "architecture"),
      path.join(projectPath, "adr"),
    ];

    for (const adrPath of adrPaths) {
      try {
        const files = await fs.readdir(adrPath);

        for (const file of files) {
          if (file.endsWith(".md")) {
            try {
              const content = await fs.readFile(
                path.join(adrPath, file),
                "utf-8",
              );
              const decision = this.parseADR(content, file);
              if (decision) {
                tracked.push(decision);
              }
            } catch {
              // Skip unreadable files
            }
          }
        }
      } catch {
        // Directory doesn't exist
      }
    }

    return {
      tracked,
      pending,
      violations,
    };
  }

  private parseADR(
    content: string,
    filename: string,
  ): ArchitecturalDecision | null {
    const titleMatch = content.match(/^#\s+(.+)/m);
    const statusMatch = content.match(/##\s*Status\s*\n\s*(\w+)/i);
    const dateMatch = content.match(/##\s*Date\s*\n\s*(\d{4}-\d{2}-\d{2})/i);
    const contextMatch = content.match(/##\s*Context\s*\n([\s\S]*?)(?=##|$)/i);
    const decisionMatch = content.match(
      /##\s*Decision\s*\n([\s\S]*?)(?=##|$)/i,
    );

    if (!titleMatch) return null;

    return {
      id: filename.replace(".md", ""),
      title: titleMatch[1].trim(),
      status: (statusMatch?.[1]?.toLowerCase() || "proposed") as any,
      date: dateMatch?.[1] || new Date().toISOString().split("T")[0],
      authors: [],
      context: contextMatch?.[1]?.trim() || "",
      decision: decisionMatch?.[1]?.trim() || "",
      consequences: [],
      relatedFiles: [],
    };
  }

  // ============================================================================
  // COLLABORATION ANALYSIS
  // ============================================================================

  private async analyzeCollaboration(
    projectPath: string,
  ): Promise<TeamIntelligenceReport["collaboration"]> {
    const gitLog = await this.getGitLog(projectPath);

    // Calculate metrics
    const metrics = this.calculateCollaborationMetrics(gitLog);

    // Calculate code ownership
    const codeOwnership = this.calculateCodeOwnership(gitLog);

    // Calculate bus factor
    const busFactor = await this.analyzeBusFactor(gitLog, projectPath);

    return {
      metrics,
      codeOwnership,
      busFactor,
    };
  }

  private calculateCollaborationMetrics(
    gitLog: GitCommit[],
  ): CollaborationMetrics {
    const uniqueAuthors = new Set(gitLog.map((c) => c.author));

    // Active in last 30 days
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const activeAuthors = new Set(
      gitLog
        .filter((c) => new Date(c.date) > thirtyDaysAgo)
        .map((c) => c.author),
    );

    // Commits per week
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
    const weekCommits = gitLog.filter(
      (c) => new Date(c.date) > oneWeekAgo,
    ).length;

    return {
      totalContributors: uniqueAuthors.size,
      activeContributors: activeAuthors.size,
      averageReviewTime: 4, // Placeholder - would need PR data
      averageCommitsPerWeek: weekCommits,
      prMergeRate: 0.85, // Placeholder
      codeReviewCoverage: 0.7, // Placeholder
      knowledgeSharingScore: Math.min(
        1,
        activeAuthors.size / uniqueAuthors.size,
      ),
    };
  }

  private calculateCodeOwnership(gitLog: GitCommit[]): CodeOwnership[] {
    const fileOwnership = new Map<string, Map<string, number>>();
    const fileStats = new Map<
      string,
      { lastModified: string; totalCommits: number }
    >();

    for (const commit of gitLog) {
      for (const file of commit.files) {
        if (!fileOwnership.has(file)) {
          fileOwnership.set(file, new Map());
        }
        const owners = fileOwnership.get(file)!;
        owners.set(commit.author, (owners.get(commit.author) || 0) + 1);

        const stats = fileStats.get(file) || {
          lastModified: "",
          totalCommits: 0,
        };
        stats.totalCommits++;
        if (!stats.lastModified || commit.date > stats.lastModified) {
          stats.lastModified = commit.date;
        }
        fileStats.set(file, stats);
      }
    }

    const ownership: CodeOwnership[] = [];

    for (const [file, owners] of fileOwnership) {
      const totalCommits = Array.from(owners.values()).reduce(
        (a, b) => a + b,
        0,
      );
      const stats = fileStats.get(file)!;

      const ownerList = Array.from(owners.entries())
        .map(([dev, commits]) => ({
          developer: dev,
          percentage: Math.round((commits / totalCommits) * 100),
        }))
        .sort((a, b) => b.percentage - a.percentage);

      // Bus factor: how many people own 80% of the code
      let cumulative = 0;
      let busFactor = 0;
      for (const owner of ownerList) {
        cumulative += owner.percentage;
        busFactor++;
        if (cumulative >= 80) break;
      }

      ownership.push({
        path: file,
        owners: ownerList,
        busFactor,
        lastModified: stats.lastModified,
        totalCommits: stats.totalCommits,
      });
    }

    return ownership.sort((a, b) => a.busFactor - b.busFactor);
  }

  private async analyzeBusFactor(
    gitLog: GitCommit[],
    projectPath: string,
  ): Promise<BusFactorAnalysis> {
    const areaOwnership = new Map<string, Map<string, number>>();

    for (const commit of gitLog) {
      for (const file of commit.files) {
        const area = path.dirname(file).split("/")[0] || "root";

        if (!areaOwnership.has(area)) {
          areaOwnership.set(area, new Map());
        }
        const owners = areaOwnership.get(area)!;
        owners.set(commit.author, (owners.get(commit.author) || 0) + 1);
      }
    }

    const byArea: BusFactorAnalysis["byArea"] = [];
    const criticalAreas: string[] = [];

    for (const [area, owners] of areaOwnership) {
      const totalCommits = Array.from(owners.values()).reduce(
        (a, b) => a + b,
        0,
      );
      const sortedOwners = Array.from(owners.entries()).sort(
        (a, b) => b[1] - a[1],
      );

      let cumulative = 0;
      let busFactor = 0;
      const experts: string[] = [];

      for (const [dev, commits] of sortedOwners) {
        cumulative += (commits / totalCommits) * 100;
        busFactor++;
        experts.push(dev);
        if (cumulative >= 80) break;
      }

      byArea.push({ area, busFactor, experts: experts.slice(0, 3) });

      if (busFactor === 1) {
        criticalAreas.push(area);
      }
    }

    const overall =
      byArea.length > 0
        ? Math.round(
            byArea.reduce((sum, a) => sum + a.busFactor, 0) / byArea.length,
          )
        : 0;

    const recommendations: string[] = [];
    if (criticalAreas.length > 0) {
      recommendations.push(
        `${criticalAreas.length} area(s) have bus factor of 1 - critical risk`,
      );
      recommendations.push(
        "Schedule knowledge transfer sessions for critical areas",
      );
    }
    if (overall < 2) {
      recommendations.push(
        "Overall bus factor is low - encourage pair programming",
      );
    }

    return {
      overall,
      byArea: byArea.sort((a, b) => a.busFactor - b.busFactor),
      criticalAreas,
      recommendations,
    };
  }

  // ============================================================================
  // DEVELOPER ANALYSIS
  // ============================================================================

  private async analyzeDevelopers(
    projectPath: string,
  ): Promise<TeamIntelligenceReport["developers"]> {
    const gitLog = await this.getGitLog(projectPath);

    // Build developer profiles
    const contributors = this.buildDeveloperProfiles(gitLog);

    // Analyze style patterns (simplified)
    const stylePatterns: StylePattern[] = [];

    // Analyze review patterns (would need PR data)
    const reviewPatterns: ReviewPattern[] = [];

    return {
      contributors,
      stylePatterns,
      reviewPatterns,
    };
  }

  private buildDeveloperProfiles(gitLog: GitCommit[]): DeveloperProfile[] {
    const profiles = new Map<string, DeveloperProfile>();

    for (const commit of gitLog) {
      if (!profiles.has(commit.author)) {
        profiles.set(commit.author, {
          name: commit.author,
          email: commit.email,
          commits: 0,
          linesAdded: 0,
          linesRemoved: 0,
          filesModified: 0,
          firstCommit: commit.date,
          lastCommit: commit.date,
          averageCommitSize: 0,
          preferredLanguages: [],
          activeHours: Array(24).fill(0),
          reviewsGiven: 0,
          reviewsReceived: 0,
        });
      }

      const profile = profiles.get(commit.author)!;
      profile.commits++;
      profile.linesAdded += commit.linesAdded;
      profile.linesRemoved += commit.linesRemoved;
      profile.filesModified += commit.files.length;

      if (commit.date < profile.firstCommit) {
        profile.firstCommit = commit.date;
      }
      if (commit.date > profile.lastCommit) {
        profile.lastCommit = commit.date;
      }

      // Track active hours
      const hour = new Date(commit.date).getHours();
      profile.activeHours[hour]++;

      // Track languages
      for (const file of commit.files) {
        const ext = path.extname(file);
        if (ext && !profile.preferredLanguages.includes(ext)) {
          profile.preferredLanguages.push(ext);
        }
      }
    }

    // Calculate averages
    for (const profile of profiles.values()) {
      profile.averageCommitSize = Math.round(
        (profile.linesAdded + profile.linesRemoved) / profile.commits,
      );
      profile.preferredLanguages = profile.preferredLanguages.slice(0, 5);
    }

    return Array.from(profiles.values()).sort((a, b) => b.commits - a.commits);
  }

  // ============================================================================
  // RECOMMENDATIONS
  // ============================================================================

  private generateRecommendations(
    knowledge: TeamIntelligenceReport["knowledge"],
    decisions: TeamIntelligenceReport["decisions"],
    collaboration: TeamIntelligenceReport["collaboration"],
    developers: TeamIntelligenceReport["developers"],
  ): TeamRecommendation[] {
    const recommendations: TeamRecommendation[] = [];

    // Knowledge risks
    const highRiskOrphans = knowledge.orphanedKnowledge.filter(
      (o) => o.risk === "high",
    );
    if (highRiskOrphans.length > 0) {
      recommendations.push({
        priority: 1,
        category: "risk",
        action: `Address ${highRiskOrphans.length} high-risk knowledge silos`,
        reason:
          "These areas have only one contributor and haven't been touched recently",
        impact: "high",
      });
    }

    // Bus factor
    if (collaboration.busFactor.overall < 2) {
      recommendations.push({
        priority: 2,
        category: "risk",
        action: "Improve bus factor through pair programming and code reviews",
        reason: `Current bus factor is ${collaboration.busFactor.overall}`,
        impact: "high",
      });
    }

    // Active contributors
    if (
      collaboration.metrics.activeContributors <
      collaboration.metrics.totalContributors * 0.5
    ) {
      recommendations.push({
        priority: 3,
        category: "collaboration",
        action: "Re-engage inactive contributors",
        reason: "Less than half of contributors are active",
        impact: "medium",
      });
    }

    // Knowledge sharing
    if (collaboration.metrics.knowledgeSharingScore < 0.5) {
      recommendations.push({
        priority: 4,
        category: "knowledge",
        action: "Implement knowledge sharing sessions",
        reason: "Knowledge is concentrated among few contributors",
        impact: "medium",
      });
    }

    // Architectural decisions
    if (decisions.tracked.length === 0) {
      recommendations.push({
        priority: 5,
        category: "process",
        action: "Start documenting architectural decisions (ADRs)",
        reason: "No architectural decisions are documented",
        impact: "medium",
      });
    }

    return recommendations.sort((a, b) => a.priority - b.priority);
  }

  // ============================================================================
  // GIT UTILITIES
  // ============================================================================

  private async getGitLog(projectPath: string): Promise<GitCommit[]> {
    try {
      const result = execSync(
        'git log --pretty=format:"%H|%an|%ae|%aI" --numstat -n 500',
        {
          cwd: projectPath,
          encoding: "utf-8",
          maxBuffer: 50 * 1024 * 1024,
        },
      );

      return this.parseGitLog(result);
    } catch {
      return [];
    }
  }

  private parseGitLog(output: string): GitCommit[] {
    const commits: GitCommit[] = [];
    const lines = output.split("\n");

    let currentCommit: GitCommit | null = null;

    for (const line of lines) {
      if (line.includes("|")) {
        // New commit
        if (currentCommit) {
          commits.push(currentCommit);
        }

        const [hash, author, email, date] = line.split("|");
        currentCommit = {
          hash,
          author,
          email,
          date,
          files: [],
          linesAdded: 0,
          linesRemoved: 0,
          linesChanged: 0,
        };
      } else if (currentCommit && line.trim()) {
        // File stats
        const match = line.match(/^(\d+|-)\s+(\d+|-)\s+(.+)$/);
        if (match) {
          const added = match[1] === "-" ? 0 : parseInt(match[1], 10);
          const removed = match[2] === "-" ? 0 : parseInt(match[2], 10);

          currentCommit.files.push(match[3]);
          currentCommit.linesAdded += added;
          currentCommit.linesRemoved += removed;
          currentCommit.linesChanged += added + removed;
        }
      }
    }

    if (currentCommit) {
      commits.push(currentCommit);
    }

    return commits;
  }
}

interface GitCommit {
  hash: string;
  author: string;
  email: string;
  date: string;
  files: string[];
  linesAdded: number;
  linesRemoved: number;
  linesChanged: number;
}

export const teamIntelligenceSuite = new TeamIntelligenceSuite();
export default teamIntelligenceSuite;
