import { EventEmitter } from 'events';
import { createHash } from 'crypto';

export interface Project {
  id: string;
  name: string;
  description: string;
  repository: {
    url: string;
    provider: 'github' | 'gitlab' | 'bitbucket' | 'azure';
    branch: string;
  };
  technologies: Technology[];
  metrics: ProjectMetrics;
  health: ProjectHealth;
  lastAnalyzed: Date;
  createdAt: Date;
  tags: string[];
  team: TeamMember[];
  dependencies: ProjectDependency[];
}

export interface Technology {
  name: string;
  version: string;
  type: 'language' | 'framework' | 'library' | 'database' | 'tool' | 'platform';
  category: string;
  popularity: number;
  securityScore: number;
  maturity: 'emerging' | 'stable' | 'mature' | 'legacy';
}

export interface ProjectMetrics {
  linesOfCode: number;
  complexity: number;
  testCoverage: number;
  duplicateCode: number;
  maintainabilityIndex: number;
  technicalDebt: number;
  bugCount: number;
  vulnerabilityCount: number;
  codeChurn: number;
  commitFrequency: number;
  contributorCount: number;
}

export interface ProjectHealth {
  overall: 'excellent' | 'good' | 'fair' | 'poor' | 'critical';
  scores: {
    codeQuality: number;
    security: number;
    performance: number;
    maintainability: number;
    testability: number;
    documentation: number;
  };
  issues: HealthIssue[];
  recommendations: string[];
}

export interface HealthIssue {
  type: 'quality' | 'security' | 'performance' | 'maintainability' | 'documentation';
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  affectedFiles: string[];
  suggestion: string;
}

export interface TeamMember {
  id: string;
  name: string;
  email: string;
  role: 'owner' | 'maintainer' | 'contributor' | 'viewer';
  expertise: string[];
  contributionScore: number;
  lastActive: Date;
}

export interface ProjectDependency {
  name: string;
  version: string;
  type: 'direct' | 'indirect' | 'dev';
  source: string;
  vulnerabilities: Vulnerability[];
  outdated: boolean;
  latestVersion?: string;
  license: string;
  size: number;
}

export interface Vulnerability {
  id: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  cve?: string;
  patchedIn?: string;
  publishedAt: Date;
}

export interface CrossProjectInsight {
  id: string;
  type: InsightType;
  title: string;
  description: string;
  projects: string[];
  impact: 'low' | 'medium' | 'high' | 'critical';
  confidence: number;
  data: InsightData;
  recommendations: InsightRecommendation[];
  timestamp: Date;
}

export type InsightType = 
  | 'shared_vulnerability'
  | 'duplicate_code'
  | 'technology_drift'
  | 'dependency_risk'
  | 'knowledge_gap'
  | 'performance_regression'
  | 'security_trend'
  | 'best_practice_violation'
  | 'resource_optimization'
  | 'team_collaboration';

export interface InsightData {
  metrics: { [key: string]: number };
  affectedProjects: ProjectReference[];
  trend?: TrendData;
  comparison?: ComparisonData;
  correlations?: CorrelationData;
}

export interface ProjectReference {
  id: string;
  name: string;
  impact: number;
  relevance: number;
}

export interface TrendData {
  period: string;
  dataPoints: { date: string; value: number }[];
  direction: 'improving' | 'declining' | 'stable';
  changeRate: number;
}

export interface ComparisonData {
  baseline: { [key: string]: number };
  current: { [key: string]: number };
  variance: number;
}

export interface CorrelationData {
  factors: { factor: string; correlation: number }[];
  strongestCorrelation: { factor: string; correlation: number };
}

export interface InsightRecommendation {
  priority: 'low' | 'medium' | 'high' | 'critical';
  action: string;
  description: string;
  effort: 'low' | 'medium' | 'high';
  expectedImpact: string;
  dependencies: string[];
}

export interface KnowledgeGraph {
  nodes: KnowledgeNode[];
  edges: KnowledgeEdge[];
  clusters: KnowledgeCluster[];
}

export interface KnowledgeNode {
  id: string;
  type: 'project' | 'technology' | 'concept' | 'pattern' | 'person' | 'issue';
  label: string;
  properties: { [key: string]: any };
  importance: number;
  connections: number;
}

export interface KnowledgeEdge {
  source: string;
  target: string;
  type: 'uses' | 'implements' | 'extends' | 'depends_on' | 'relates_to' | 'similar_to';
  weight: number;
  properties: { [key: string]: any };
}

export interface KnowledgeCluster {
  id: string;
  name: string;
  type: 'technology_stack' | 'architecture_pattern' | 'domain' | 'team';
  nodes: string[];
  centrality: number;
  cohesion: number;
}

export class CrossProjectIntelligence extends EventEmitter {
  private projects: Map<string, Project> = new Map();
  private insights: Map<string, CrossProjectInsight> = new Map();
  private knowledgeGraph: KnowledgeGraph;
  private patterns: Map<string, Pattern> = new Map();
  private benchmarks: Map<string, Benchmark> = new Map();

  constructor() {
    super();
    this.knowledgeGraph = {
      nodes: [],
      edges: [],
      clusters: [],
    };
    this.initializePatterns();
    this.initializeBenchmarks();
  }

  private initializePatterns(): void {
    this.patterns.set('technology_stack', {
      name: 'Technology Stack Analysis',
      description: 'Identify common technology patterns across projects',
      type: 'technology',
      algorithm: 'clustering',
      parameters: {
        similarity: 0.8,
        minClusterSize: 2,
      },
    });

    this.patterns.set('code_similarity', {
      name: 'Code Similarity Detection',
      description: 'Find duplicate or similar code across projects',
      type: 'code',
      algorithm: 'similarity_hash',
      parameters: {
        threshold: 0.7,
        minLines: 10,
      },
    });

    this.patterns.set('dependency_analysis', {
      name: 'Dependency Risk Analysis',
      description: 'Analyze shared dependencies and their risks',
      type: 'dependency',
      algorithm: 'graph_analysis',
      parameters: {
        depth: 3,
        riskThreshold: 0.5,
      },
    });
  }

  private initializeBenchmarks(): void {
    this.benchmarks.set('code_quality', {
      name: 'Code Quality Benchmark',
      metrics: ['maintainability', 'complexity', 'duplication', 'testCoverage'],
      industry: {
        maintainability: 70,
        complexity: 10,
        duplication: 5,
        testCoverage: 80,
      },
      topQuartile: {
        maintainability: 85,
        complexity: 5,
        duplication: 3,
        testCoverage: 90,
      },
    });

    this.benchmarks.set('security', {
      name: 'Security Benchmark',
      metrics: ['vulnerabilities', 'securityScore', 'encryptedData'],
      industry: {
        vulnerabilities: 5,
        securityScore: 75,
        encryptedData: 90,
      },
      topQuartile: {
        vulnerabilities: 0,
        securityScore: 90,
        encryptedData: 100,
      },
    });
  }

  async addProject(project: Omit<Project, 'id' | 'createdAt' | 'lastAnalyzed'>): Promise<string> {
    const id = this.generateProjectId();
    const fullProject: Project = {
      ...project,
      id,
      createdAt: new Date(),
      lastAnalyzed: new Date(),
    };

    this.projects.set(id, fullProject);
    await this.updateKnowledgeGraph(fullProject);
    await this.generateInsightsForProject(id);
    
    this.emit('project-added', fullProject);
    return id;
  }

  async analyzeProjects(projectIds?: string[]): Promise<{
    insights: CrossProjectInsight[];
    trends: { [key: string]: TrendData };
    benchmarks: { [key: string]: BenchmarkResult };
    recommendations: InsightRecommendation[];
  }> {
    const projectsToAnalyze = projectIds 
      ? projectIds.map(id => this.projects.get(id)).filter(p => p !== undefined) as Project[]
      : Array.from(this.projects.values());

    const insights = await this.generateCrossProjectInsights(projectsToAnalyze);
    const trends = await this.calculateTrends(projectsToAnalyze);
    const benchmarks = await this.runBenchmarks(projectsToAnalyze);
    const recommendations = await this.generateRecommendations(insights);

    return {
      insights,
      trends,
      benchmarks,
      recommendations,
    };
  }

  async findSimilarProjects(projectId: string, options: {
    technology?: string;
    pattern?: string;
    complexity?: 'low' | 'medium' | 'high';
    team?: string;
  } = {}): Promise<{
    projects: ProjectSimilarity[];
    insights: string[];
  }> {
    const sourceProject = this.projects.get(projectId);
    if (!sourceProject) {
      throw new Error(`Project ${projectId} not found`);
    }

    const similarities: ProjectSimilarity[] = [];
    
    for (const [id, project] of this.projects) {
      if (id === projectId) continue;
      
      const similarity = await this.calculateProjectSimilarity(sourceProject, project, options || {});
      if (similarity.score > 0.5) {
        similarities.push(similarity);
      }
    }

    similarities.sort((a, b) => b.score - a.score);

    const insights = this.generateSimilarityInsights(similarities);

    return {
      projects: similarities.slice(0, 10),
      insights,
    };
  }

  async detectTechnologyDrift(): Promise<{
    drifts: TechnologyDrift[];
    impact: 'low' | 'medium' | 'high' | 'critical';
    recommendations: string[];
  }> {
    const techUsage: Map<string, Project[]> = new Map();
    
    for (const project of this.projects.values()) {
      for (const tech of project.technologies) {
        const key = `${tech.name}:${tech.type}`;
        if (!techUsage.has(key)) {
          techUsage.set(key, []);
        }
        techUsage.get(key)!.push(project);
      }
    }

    const drifts: TechnologyDrift[] = [];
    
    for (const [techKey, projects] of techUsage) {
      if (projects.length > 1) {
        const versions = projects.map(p => 
          p.technologies.find(t => `${t.name}:${t.type}` === techKey)?.version
        ).filter(Boolean);

        if (new Set(versions).size > 1) {
          const drift: TechnologyDrift = {
            technology: techKey,
            projects: projects.map(p => ({ id: p.id, name: p.name, version: 
              p.technologies.find(t => `${t.name}:${t.type}` === techKey)?.version || 'unknown'
            })),
            severity: this.calculateDriftSeverity(versions),
            risk: this.calculateDriftRisk(techKey, versions),
            recommendation: this.generateDriftRecommendation(techKey, versions),
          };
          drifts.push(drift);
        }
      }
    }

    const overallImpact = this.calculateOverallDriftImpact(drifts);
    const recommendations = this.generateDriftRecommendations(drifts);

    return {
      drifts,
      impact: overallImpact,
      recommendations,
    };
  }

  async identifySharedVulnerabilities(): Promise<{
    vulnerabilities: SharedVulnerability[];
    affectedProjects: string[];
    riskScore: number;
    remediationPlan: RemediationStep[];
  }> {
    const vulnerabilityMap: Map<string, { projects: string[]; vulnerability: Vulnerability }> = new Map();
    
    for (const project of this.projects.values()) {
      for (const dep of project.dependencies) {
        for (const vuln of dep.vulnerabilities) {
          const key = vuln.id;
          if (!vulnerabilityMap.has(key)) {
            vulnerabilityMap.set(key, { projects: [], vulnerability: vuln });
          }
          vulnerabilityMap.get(key)!.projects.push(project.id);
        }
      }
    }

    const sharedVulnerabilities: SharedVulnerability[] = [];
    
    for (const [vulnId, data] of vulnerabilityMap) {
      if (data.projects.length > 1) {
        sharedVulnerabilities.push({
          vulnerability: data.vulnerability,
          affectedProjects: data.projects,
          impact: this.calculateVulnerabilityImpact(data.vulnerability, data.projects.length),
          priority: this.calculateVulnerabilityPriority(data.vulnerability),
        });
      }
    }

    const affectedProjects = Array.from(new Set(
      sharedVulnerabilities.flatMap(v => v.affectedProjects)
    ));
    
    const riskScore = this.calculateOverallRiskScore(sharedVulnerabilities);
    const remediationPlan = this.generateRemediationPlan(sharedVulnerabilities);

    return {
      vulnerabilities: sharedVulnerabilities,
      affectedProjects,
      riskScore,
      remediationPlan,
    };
  }

  async generateKnowledgeGraph(): Promise<KnowledgeGraph> {
    const nodes: KnowledgeNode[] = [];
    const edges: KnowledgeEdge[] = [];

    for (const project of this.projects.values()) {
      const projectNode: KnowledgeNode = {
        id: `project:${project.id}`,
        type: 'project',
        label: project.name,
        properties: {
          health: project.health.overall,
          complexity: project.metrics.complexity,
          techCount: project.technologies.length,
        },
        importance: this.calculateProjectImportance(project),
        connections: 0,
      };
      nodes.push(projectNode);

      for (const tech of project.technologies) {
        const techNode: KnowledgeNode = {
          id: `tech:${tech.name}`,
          type: 'technology',
          label: tech.name,
          properties: {
            type: tech.type,
            category: tech.category,
            maturity: tech.maturity,
          },
          importance: tech.popularity,
          connections: 0,
        };
        nodes.push(techNode);

        edges.push({
          source: projectNode.id,
          target: techNode.id,
          type: 'uses',
          weight: 1,
          properties: {
            version: tech.version,
          },
        });
      }

      for (const member of project.team) {
        const memberNode: KnowledgeNode = {
          id: `person:${member.id}`,
          type: 'person',
          label: member.name,
          properties: {
            role: member.role,
            expertise: member.expertise,
          },
          importance: member.contributionScore,
          connections: 0,
        };
        nodes.push(memberNode);

        edges.push({
          source: memberNode.id,
          target: projectNode.id,
          type: 'relates_to',
          weight: member.contributionScore / 100,
          properties: {},
        });
      }
    }

    const clusters = this.identifyClusters(nodes, edges);

    this.knowledgeGraph = { nodes, edges, clusters };
    return this.knowledgeGraph;
  }

  async getPortfolioReport(): Promise<{
    overview: PortfolioOverview;
    healthTrends: HealthTrend[];
    technologySummary: TechnologySummary;
    teamInsights: TeamInsight[];
    riskAssessment: RiskAssessment;
    recommendations: PortfolioRecommendation[];
  }> {
    const projects = Array.from(this.projects.values());
    
    const overview = this.calculatePortfolioOverview(projects);
    const healthTrends = this.calculateHealthTrends(projects);
    const technologySummary = this.summarizeTechnologies(projects);
    const teamInsights = this.analyzeTeamInsights(projects);
    const riskAssessment = this.assessPortfolioRisks(projects);
    const recommendations = this.generatePortfolioRecommendations(overview, riskAssessment);

    return {
      overview,
      healthTrends,
      technologySummary,
      teamInsights,
      riskAssessment,
      recommendations,
    };
  }

  private async generateCrossProjectInsights(projects: Project[]): Promise<CrossProjectInsight[]> {
    const insights: CrossProjectInsight[] = [];

    const sharedVulns = await this.identifySharedVulnerabilities();
    if (sharedVulns.vulnerabilities.length > 0) {
      insights.push({
        id: this.generateInsightId(),
        type: 'shared_vulnerability',
        title: 'Shared Vulnerabilities Detected',
        description: `Found ${sharedVulns.vulnerabilities.length} vulnerabilities shared across projects`,
        projects: sharedVulns.affectedProjects,
        impact: sharedVulns.riskScore > 50 ? 'critical' : 'high',
        confidence: 0.95,
        data: {
          metrics: { vulnerabilityCount: sharedVulns.vulnerabilities.length, riskScore: sharedVulns.riskScore },
          affectedProjects: sharedVulns.affectedProjects.map(id => ({ id, name: '', impact: 1, relevance: 1 })),
        },
        recommendations: sharedVulns.remediationPlan.map(step => ({
          priority: 'high' as const,
          action: step.action,
          description: step.description,
          effort: 'medium' as const,
          expectedImpact: 'Reduced security risk',
          dependencies: [],
        })),
        timestamp: new Date(),
      });
    }

    const techDrift = await this.detectTechnologyDrift();
    if (techDrift.drifts.length > 0) {
      insights.push({
        id: this.generateInsightId(),
        type: 'technology_drift',
        title: 'Technology Version Drift',
        description: `Detected version drift in ${techDrift.drifts.length} technologies`,
        projects: techDrift.drifts.flatMap(d => d.projects.map(p => p.id)),
        impact: techDrift.impact,
        confidence: 0.9,
        data: {
          metrics: { driftCount: techDrift.drifts.length },
          affectedProjects: techDrift.drifts.flatMap(d => d.projects.map(p => ({ id: p.id, name: '', impact: 1, relevance: 1 }))),
        },
        recommendations: techDrift.recommendations.map(rec => ({
          priority: 'medium' as const,
          action: 'Standardize versions',
          description: rec,
          effort: 'medium' as const,
          expectedImpact: 'Reduced maintenance overhead',
          dependencies: [],
        })),
        timestamp: new Date(),
      });
    }

    return insights;
  }

  private async calculateProjectSimilarity(
    project1: Project,
    project2: Project,
    options: any
  ): Promise<ProjectSimilarity> {
    let score = 0;
    const factors: { [key: string]: number } = {};

    const techSimilarity = this.calculateTechnologySimilarity(project1.technologies, project2.technologies);
    factors['technology'] = techSimilarity;
    score += factors['technology'] * 0.3;

    const sizeSimilarity = this.calculateSizeSimilarity(project1.metrics, project2.metrics);
    factors['size'] = sizeSimilarity;
    score += sizeSimilarity * 0.2;

    const complexitySimilarity = this.calculateComplexitySimilarity(project1.metrics, project2.metrics);
    factors['complexity'] = complexitySimilarity;
    score += complexitySimilarity * 0.2;

    const healthSimilarity = this.calculateHealthSimilarity(project1.health, project2.health);
    factors['health'] = healthSimilarity;
    score += healthSimilarity * 0.3;

    return {
      projectId: project2.id,
      projectName: project2.name,
      score,
      factors,
      similarTechnologies: this.findSimilarTechnologies(project1.technologies, project2.technologies),
      differences: this.identifyKeyDifferences(project1, project2),
    };
  }

  private calculateTechnologySimilarity(tech1: Technology[], tech2: Technology[]): number {
    const set1 = new Set(tech1.map(t => t.name));
    const set2 = new Set(tech2.map(t => t.name));
    const intersection = new Set([...set1].filter(x => set2.has(x)));
    const union = new Set([...set1, ...set2]);
    return intersection.size / union.size;
  }

  private calculateSizeSimilarity(metrics1: ProjectMetrics, metrics2: ProjectMetrics): number {
    const diff = Math.abs(metrics1.linesOfCode - metrics2.linesOfCode);
    const max = Math.max(metrics1.linesOfCode, metrics2.linesOfCode);
    return 1 - (diff / max);
  }

  private calculateComplexitySimilarity(metrics1: ProjectMetrics, metrics2: ProjectMetrics): number {
    const diff = Math.abs(metrics1.complexity - metrics2.complexity);
    const max = Math.max(metrics1.complexity, metrics2.complexity);
    return 1 - (diff / max);
  }

  private calculateHealthSimilarity(health1: ProjectHealth, health2: ProjectHealth): number {
    const score1 = Object.values(health1.scores).reduce((a, b) => a + b, 0) / Object.keys(health1.scores).length;
    const score2 = Object.values(health2.scores).reduce((a, b) => a + b, 0) / Object.keys(health2.scores).length;
    return 1 - Math.abs(score1 - score2) / 100;
  }

  private findSimilarTechnologies(tech1: Technology[], tech2: Technology[]): Technology[] {
    const names1 = new Set(tech1.map(t => t.name));
    return tech2.filter(t => names1.has(t.name));
  }

  private identifyKeyDifferences(project1: Project, project2: Project): string[] {
    const differences: string[] = [];
    
    if (Math.abs(project1.metrics.complexity - project2.metrics.complexity) > 10) {
      differences.push('Significant difference in code complexity');
    }
    
    if (Math.abs(project1.metrics.testCoverage - project2.metrics.testCoverage) > 20) {
      differences.push('Significant difference in test coverage');
    }
    
    return differences;
  }

  private async updateKnowledgeGraph(project: Project): Promise<void> {
  }

  private async generateInsightsForProject(projectId: string): Promise<void> {
  }

  private async calculateTrends(projects: Project[]): Promise<{ [key: string]: TrendData }> {
    return {};
  }

  private async runBenchmarks(projects: Project[]): Promise<{ [key: string]: BenchmarkResult }> {
    return {};
  }

  private async generateRecommendations(insights: CrossProjectInsight[]): Promise<InsightRecommendation[]> {
    return [];
  }

  private generateSimilarityInsights(similarities: ProjectSimilarity[]): string[] {
    return [];
  }

  private calculateDriftSeverity(versions: (string | undefined)[]): 'low' | 'medium' | 'high' | 'critical' {
    const uniqueVersions = new Set(versions).size;
    if (uniqueVersions > 5) return 'critical';
    if (uniqueVersions > 3) return 'high';
    if (uniqueVersions > 2) return 'medium';
    return 'low';
  }

  private calculateDriftRisk(techKey: string, versions: (string | undefined)[]): number {
    return Math.random() * 100;
  }

  private generateDriftRecommendation(techKey: string, versions: (string | undefined)[]): string {
    return `Consider standardizing ${techKey} across all projects`;
  }

  private calculateOverallDriftImpact(drifts: TechnologyDrift[]): 'low' | 'medium' | 'high' | 'critical' {
    const criticalCount = drifts.filter(d => d.severity === 'critical').length;
    if (criticalCount > 0) return 'critical';
    if (drifts.length > 5) return 'high';
    if (drifts.length > 2) return 'medium';
    return 'low';
  }

  private generateDriftRecommendations(drifts: TechnologyDrift[]): string[] {
    return drifts.map(d => d.recommendation);
  }

  private calculateVulnerabilityImpact(vulnerability: Vulnerability, projectCount: number): 'low' | 'medium' | 'high' | 'critical' {
    if (vulnerability.severity === 'critical' && projectCount > 5) return 'critical';
    if (vulnerability.severity === 'high' && projectCount > 3) return 'high';
    if (vulnerability.severity === 'medium' && projectCount > 1) return 'medium';
    return 'low';
  }

  private calculateVulnerabilityPriority(vulnerability: Vulnerability): 'low' | 'medium' | 'high' | 'critical' {
    return vulnerability.severity;
  }

  private calculateOverallRiskScore(vulnerabilities: SharedVulnerability[]): number {
    return vulnerabilities.reduce((score, v) => {
      const severityWeight = v.priority === 'critical' ? 4 : v.priority === 'high' ? 3 : v.priority === 'medium' ? 2 : 1;
      return score + (severityWeight * v.affectedProjects.length);
    }, 0);
  }

  private generateRemediationPlan(vulnerabilities: SharedVulnerability[]): RemediationStep[] {
    return vulnerabilities.map(v => ({
      action: `Update ${v.vulnerability.id}`,
      description: `Update to patched version ${v.vulnerability.patchedIn || 'latest'}`,
      priority: v.priority,
      estimatedEffort: 'medium',
      dependencies: v.affectedProjects,
    }));
  }

  private identifyClusters(nodes: KnowledgeNode[], edges: KnowledgeEdge[]): KnowledgeCluster[] {
    return [];
  }

  private calculateProjectImportance(project: Project): number {
    return (project.metrics.commitFrequency * 0.3) +
           (project.team.length * 0.2) +
           (project.technologies.length * 0.2) +
           ((100 - project.metrics.technicalDebt) * 0.3);
  }

  private calculatePortfolioOverview(projects: Project[]): PortfolioOverview {
    return {
      totalProjects: projects.length,
      activeProjects: projects.filter(p => p.metrics.commitFrequency > 0).length,
      totalLinesOfCode: projects.reduce((sum, p) => sum + p.metrics.linesOfCode, 0),
      averageHealth: projects.reduce((sum, p) => sum + Object.values(p.health.scores).reduce((a, b) => a + b, 0) / Object.keys(p.health.scores).length, 0) / projects.length,
      technologies: this.summarizeTechnologies(projects),
      teamSize: projects.reduce((sum, p) => sum + p.team.length, 0),
    };
  }

  private calculateHealthTrends(projects: Project[]): HealthTrend[] {
    return [];
  }

  private summarizeTechnologies(projects: Project[]): TechnologySummary {
    const techMap: Map<string, { count: number; projects: string[] }> = new Map();
    
    for (const project of projects) {
      for (const tech of project.technologies) {
        if (!techMap.has(tech.name)) {
          techMap.set(tech.name, { count: 0, projects: [] });
        }
        const data = techMap.get(tech.name)!;
        data.count++;
        data.projects.push(project.id);
      }
    }

    const top = Array.from(techMap.entries())
      .sort(([, a], [, b]) => b.count - a.count)
      .slice(0, 10)
      .map(([name, data]) => ({ name, usage: data.count, projects: data.projects.length }));

    return {
      total: techMap.size,
      top,
      emerging: [],
      deprecated: [],
    };
  }

  private analyzeTeamInsights(projects: Project[]): TeamInsight[] {
    return [];
  }

  private assessPortfolioRisks(projects: Project[]): RiskAssessment {
    return {
      overall: 'medium',
      security: this.calculateSecurityRisk(projects),
      technical: this.calculateTechnicalRisk(projects),
      operational: this.calculateOperationalRisk(projects),
      compliance: this.calculateComplianceRisk(projects),
    };
  }

  private calculateSecurityRisk(projects: Project[]): 'low' | 'medium' | 'high' | 'critical' {
    const totalVulns = projects.reduce((sum, p) => sum + p.metrics.vulnerabilityCount, 0);
    if (totalVulns > 50) return 'critical';
    if (totalVulns > 20) return 'high';
    if (totalVulns > 5) return 'medium';
    return 'low';
  }

  private calculateTechnicalRisk(projects: Project[]): 'low' | 'medium' | 'high' | 'critical' {
    const avgDebt = projects.reduce((sum, p) => sum + p.metrics.technicalDebt, 0) / projects.length;
    if (avgDebt > 1000) return 'critical';
    if (avgDebt > 500) return 'high';
    if (avgDebt > 200) return 'medium';
    return 'low';
  }

  private calculateOperationalRisk(projects: Project[]): 'low' | 'medium' | 'high' | 'critical' {
    return 'medium';
  }

  private calculateComplianceRisk(projects: Project[]): 'low' | 'medium' | 'high' | 'critical' {
    return 'low';
  }

  private generatePortfolioRecommendations(
    overview: PortfolioOverview,
    risk: RiskAssessment
  ): PortfolioRecommendation[] {
    return [];
  }

  private generateProjectId(): string {
    return createHash('sha256').update(Date.now().toString() + Math.random().toString()).digest('hex').substring(0, 16);
  }

  private generateInsightId(): string {
    return createHash('sha256').update(Date.now().toString() + Math.random().toString()).digest('hex').substring(0, 16);
  }
}

export interface ProjectSimilarity {
  projectId: string;
  projectName: string;
  score: number;
  factors: { [key: string]: number };
  similarTechnologies: Technology[];
  differences: string[];
}

export interface TechnologyDrift {
  technology: string;
  projects: { id: string; name: string; version: string }[];
  severity: 'low' | 'medium' | 'high' | 'critical';
  risk: number;
  recommendation: string;
}

export interface SharedVulnerability {
  vulnerability: Vulnerability;
  affectedProjects: string[];
  impact: 'low' | 'medium' | 'high' | 'critical';
  priority: 'low' | 'medium' | 'high' | 'critical';
}

export interface RemediationStep {
  action: string;
  description: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  estimatedEffort: 'low' | 'medium' | 'high';
  dependencies: string[];
}

export interface PortfolioOverview {
  totalProjects: number;
  activeProjects: number;
  totalLinesOfCode: number;
  averageHealth: number;
  technologies: TechnologySummary;
  teamSize: number;
}

export interface TechnologySummary {
  total: number;
  top: { name: string; usage: number; projects: number }[];
  emerging: string[];
  deprecated: string[];
}

export interface HealthTrend {
  metric: string;
  trend: TrendData;
}

export interface TeamInsight {
  teamId: string;
  insight: string;
  impact: string;
}

export interface RiskAssessment {
  overall: 'low' | 'medium' | 'high' | 'critical';
  security: 'low' | 'medium' | 'high' | 'critical';
  technical: 'low' | 'medium' | 'high' | 'critical';
  operational: 'low' | 'medium' | 'high' | 'critical';
  compliance: 'low' | 'medium' | 'high' | 'critical';
}

export interface PortfolioRecommendation {
  priority: 'low' | 'medium' | 'high' | 'critical';
  category: 'technology' | 'security' | 'process' | 'team';
  title: string;
  description: string;
  expectedImpact: string;
}

export interface Pattern {
  name: string;
  description: string;
  type: string;
  algorithm: string;
  parameters: { [key: string]: any };
}

export interface Benchmark {
  name: string;
  metrics: string[];
  industry: { [key: string]: number };
  topQuartile: { [key: string]: number };
}

export interface BenchmarkResult {
  benchmark: string;
  score: number;
  percentile: number;
  comparison: { [key: string]: number };
}

export const crossProjectIntelligence = new CrossProjectIntelligence();
