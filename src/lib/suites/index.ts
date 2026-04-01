/**
 * guardrail Power Suites
 *
 * Unified exports for all power feature suites:
 * - AI Intelligence Suite
 * - Security Suite
 * - Architecture Health Suite
 * - Supply Chain Suite
 * - Team Intelligence Suite
 * - Predictive Analytics Suite
 */

export {
  aiIntelligenceSuite,
  type AIAnalysisResult,
  type AIIssue,
  type ProjectAnalysis,
} from "./ai-intelligence-suite";
export {
  securitySuite,
  type SecurityScanResult,
  type SecretFinding,
  type VulnerabilityFinding,
  type ThreatFinding,
} from "./security-suite";
export {
  architectureHealthSuite,
  type ArchitectureHealthReport,
  type CodeSmell,
  type DependencyGraph,
} from "./architecture-health-suite";
export {
  supplyChainSuite,
  type SupplyChainReport,
  type SBOM,
  type LicenseFinding,
} from "./supply-chain-suite";
export {
  teamIntelligenceSuite,
  type TeamIntelligenceReport,
  type ExpertiseMapping,
  type BusFactorAnalysis,
} from "./team-intelligence-suite";
export {
  predictiveAnalyticsSuite,
  type PredictiveAnalyticsReport,
  type QualityPrediction,
  type RiskArea,
} from "./predictive-analytics-suite";

/**
 * Run all suites for comprehensive analysis
 */
export async function runComprehensiveAnalysis(projectPath: string): Promise<{
  ai: import("./ai-intelligence-suite").ProjectAnalysis;
  security: import("./security-suite").SecurityScanResult;
  architecture: import("./architecture-health-suite").ArchitectureHealthReport;
  supplyChain: import("./supply-chain-suite").SupplyChainReport;
  team: import("./team-intelligence-suite").TeamIntelligenceReport;
  predictive: import("./predictive-analytics-suite").PredictiveAnalyticsReport;
  summary: ComprehensiveSummary;
}> {
  const { aiIntelligenceSuite } = await import("./ai-intelligence-suite");
  const { securitySuite } = await import("./security-suite");
  const { architectureHealthSuite } =
    await import("./architecture-health-suite");
  const { supplyChainSuite } = await import("./supply-chain-suite");
  const { teamIntelligenceSuite } = await import("./team-intelligence-suite");
  const { predictiveAnalyticsSuite } =
    await import("./predictive-analytics-suite");

  console.log("🚀 Running Comprehensive Analysis...\n");

  // Run all suites in parallel
  const [ai, security, architecture, supplyChain, team, predictive] =
    await Promise.all([
      aiIntelligenceSuite.analyzeProject(projectPath),
      securitySuite.scan(projectPath),
      architectureHealthSuite.analyze(projectPath),
      supplyChainSuite.analyze(projectPath),
      teamIntelligenceSuite.analyze(projectPath),
      predictiveAnalyticsSuite.analyze(projectPath),
    ]);

  // Generate summary
  const summary = generateComprehensiveSummary(
    ai,
    security,
    architecture,
    supplyChain,
    team,
    predictive,
  );

  return {
    ai,
    security,
    architecture,
    supplyChain,
    team,
    predictive,
    summary,
  };
}

export interface ComprehensiveSummary {
  overallScore: number;
  grade: string;
  verdict: "SHIP" | "NO-SHIP" | "REVIEW";
  scores: {
    aiQuality: number;
    security: number;
    architecture: number;
    supplyChain: number;
    teamHealth: number;
    riskScore: number;
  };
  criticalIssues: number;
  highIssues: number;
  topRecommendations: string[];
  blockers: string[];
}

function generateComprehensiveSummary(
  ai: import("./ai-intelligence-suite").ProjectAnalysis,
  security: import("./security-suite").SecurityScanResult,
  architecture: import("./architecture-health-suite").ArchitectureHealthReport,
  supplyChain: import("./supply-chain-suite").SupplyChainReport,
  team: import("./team-intelligence-suite").TeamIntelligenceReport,
  predictive: import("./predictive-analytics-suite").PredictiveAnalyticsReport,
): ComprehensiveSummary {
  const scores = {
    aiQuality: ai.scores.overall,
    security: security.scores.overall,
    architecture: architecture.scores.overall,
    supplyChain: supplyChain.scores.overall,
    teamHealth: Math.round((team.collaboration.busFactor.overall / 5) * 100),
    riskScore: 100 - predictive.risk.overallRisk,
  };

  const overallScore = Math.round(
    (scores.aiQuality +
      scores.security +
      scores.architecture +
      scores.supplyChain +
      scores.teamHealth +
      scores.riskScore) /
      6,
  );

  const grade =
    overallScore >= 90
      ? "A"
      : overallScore >= 80
        ? "B"
        : overallScore >= 70
          ? "C"
          : overallScore >= 60
            ? "D"
            : "F";

  // Count critical issues
  const criticalIssues =
    ai.bugPredictions.critical +
    security.summary.critical +
    supplyChain.vulnerabilities.critical;

  const highIssues =
    ai.bugPredictions.high +
    security.summary.high +
    supplyChain.vulnerabilities.high;

  // Determine verdict
  const verdict =
    criticalIssues > 0
      ? "NO-SHIP"
      : highIssues > 5 || overallScore < 60
        ? "REVIEW"
        : "SHIP";

  // Collect top recommendations
  const topRecommendations: string[] = [];

  if (ai.recommendations.length > 0) {
    topRecommendations.push(ai.recommendations[0]);
  }
  if (security.recommendations.length > 0) {
    topRecommendations.push(security.recommendations[0].action);
  }
  if (architecture.recommendations.length > 0) {
    topRecommendations.push(architecture.recommendations[0].action);
  }
  if (supplyChain.recommendations.length > 0) {
    topRecommendations.push(supplyChain.recommendations[0].action);
  }
  if (team.recommendations.length > 0) {
    topRecommendations.push(team.recommendations[0].action);
  }

  // Identify blockers
  const blockers: string[] = [];

  if (security.summary.critical > 0) {
    blockers.push(
      `${security.summary.critical} critical security vulnerabilities`,
    );
  }
  if (supplyChain.security.malicious.length > 0) {
    blockers.push(
      `${supplyChain.security.malicious.length} malicious packages detected`,
    );
  }
  if (ai.bugPredictions.critical > 0) {
    blockers.push(`${ai.bugPredictions.critical} critical bug predictions`);
  }

  return {
    overallScore,
    grade,
    verdict,
    scores,
    criticalIssues,
    highIssues,
    topRecommendations: topRecommendations.slice(0, 5),
    blockers,
  };
}
