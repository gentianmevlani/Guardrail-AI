"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  fetchIntelligenceFindings,
  fetchIntelligenceOverview,
  runAllIntelligenceSuites,
  runIntelligenceSuite,
  type IntelligenceFinding,
  type IntelligenceOverview,
} from "@/lib/api";
import { logger } from "@/lib/logger";
import {
  AlertTriangle,
  Brain,
  Bug,
  Building2,
  CheckCircle,
  FileWarning,
  GitBranch,
  LineChart,
  Loader2,
  Lock,
  Minus,
  Package,
  Play,
  RefreshCw,
  Shield,
  TrendingDown,
  TrendingUp,
  Users,
  XCircle,
  Zap,
} from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";

// Score badge component
function ScoreBadge({ score }: { score: number }) {
  const variant =
    score >= 80 ? "default" : score >= 60 ? "secondary" : "destructive";
  const icon =
    score >= 80 ? (
      <CheckCircle className="w-3 h-3" />
    ) : score >= 60 ? (
      <AlertTriangle className="w-3 h-3" />
    ) : (
      <XCircle className="w-3 h-3" />
    );

  return (
    <Badge variant={variant} className="gap-1">
      {icon} {score}/100
    </Badge>
  );
}

// Trend indicator
function TrendIndicator({ trend }: { trend: "up" | "down" | "stable" }) {
  if (trend === "up") return <TrendingUp className="w-4 h-4 text-green-500" />;
  if (trend === "down")
    return <TrendingDown className="w-4 h-4 text-red-500" />;
  return <Minus className="w-4 h-4 text-yellow-500" />;
}

// Suite card component
function SuiteCard({
  title,
  description,
  icon: Icon,
  score,
  status,
  findings,
  lastRun,
  onRun,
}: {
  title: string;
  description: string;
  icon: any;
  score?: number;
  status: "idle" | "running" | "complete" | "error";
  findings?: number;
  lastRun?: string | null;
  onRun: () => void;
}) {
  return (
    <Card className="hover:shadow-lg transition-shadow">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <Icon className="w-5 h-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-lg">{title}</CardTitle>
              <CardDescription className="text-sm">
                {description}
              </CardDescription>
            </div>
          </div>
          {score !== undefined && <ScoreBadge score={score} />}
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            {findings !== undefined && (
              <p className="text-sm text-muted-foreground">
                {findings} findings
              </p>
            )}
            {lastRun && (
              <p className="text-xs text-muted-foreground">
                Last run: {lastRun}
              </p>
            )}
          </div>
          <Button size="sm" onClick={onRun} disabled={status === "running"}>
            {status === "running" ? (
              <>
                <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                Running...
              </>
            ) : (
              <>
                <Play className="w-4 h-4 mr-2" />
                Run
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// Main page component
function IntelligencePageContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState("overview");

  // Read tab from URL parameter
  useEffect(() => {
    const tab = searchParams?.get("tab");
    if (
      tab &&
      [
        "overview",
        "ai",
        "security",
        "architecture",
        "supply-chain",
        "team",
        "predictive",
      ].includes(tab)
    ) {
      setActiveTab(tab);
    }
  }, [searchParams]);

  const [runningStatus, setRunningStatus] = useState<
    Record<string, "idle" | "running" | "complete" | "error">
  >({
    ai: "idle",
    security: "idle",
    architecture: "idle",
    supplyChain: "idle",
    team: "idle",
    predictive: "idle",
  });

  const [loading, setLoading] = useState(true);
  const [overview, setOverview] = useState<IntelligenceOverview | null>(null);
  const [recentFindings, setRecentFindings] = useState<IntelligenceFinding[]>(
    [],
  );

  // Fetch data from API
  useEffect(() => {
    async function loadData() {
      setLoading(true);
      try {
        const [overviewData, findingsData] = await Promise.all([
          fetchIntelligenceOverview(),
          fetchIntelligenceFindings({ limit: 5 }),
        ]);
        setOverview(overviewData);
        setRecentFindings(findingsData);
      } catch (error) {
        logger.logUnknownError("Failed to load intelligence data", error);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  // Default suite data for when API returns null
  const defaultSuiteData = {
    score: 0,
    findings: 0,
    lastRun: null as string | null,
    trend: "stable" as const,
  };

  const suiteData = {
    ai: overview?.ai || defaultSuiteData,
    security: overview?.security || defaultSuiteData,
    architecture: overview?.architecture || defaultSuiteData,
    supplyChain: overview?.supplyChain || defaultSuiteData,
    team: overview?.team || defaultSuiteData,
    predictive: overview?.predictive || defaultSuiteData,
  };

  const overallScore = overview?.overallScore || 0;

  const handleRunSuite = async (suite: string) => {
    setRunningStatus((prev) => ({ ...prev, [suite]: "running" }));

    try {
      const result = await runIntelligenceSuite(suite);
      if (result.success) {
        setRunningStatus((prev) => ({ ...prev, [suite]: "complete" }));
        // Refresh data after successful run
        const newOverview = await fetchIntelligenceOverview();
        if (newOverview) setOverview(newOverview);
      } else {
        setRunningStatus((prev) => ({ ...prev, [suite]: "error" }));
      }
    } catch (error) {
      setRunningStatus((prev) => ({ ...prev, [suite]: "error" }));
    }
  };

  const handleRunAll = async () => {
    Object.keys(runningStatus).forEach((suite) => {
      setRunningStatus((prev) => ({ ...prev, [suite]: "running" }));
    });

    try {
      const result = await runAllIntelligenceSuites();
      if (result.success) {
        Object.keys(runningStatus).forEach((suite) => {
          setRunningStatus((prev) => ({ ...prev, [suite]: "complete" }));
        });
        // Refresh data after successful run
        const newOverview = await fetchIntelligenceOverview();
        if (newOverview) setOverview(newOverview);
      } else {
        Object.keys(runningStatus).forEach((suite) => {
          setRunningStatus((prev) => ({ ...prev, [suite]: "error" }));
        });
      }
    } catch (error) {
      Object.keys(runningStatus).forEach((suite) => {
        setRunningStatus((prev) => ({ ...prev, [suite]: "error" }));
      });
    }
  };

  // Loading state
  if (loading) {
    return (
      <div className="container mx-auto py-6 flex items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
          <p className="text-muted-foreground">Loading intelligence data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Intelligence Suite</h1>
          <p className="text-muted-foreground">
            Comprehensive code analysis powered by AI
          </p>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right">
            <p className="text-sm text-muted-foreground">Overall Score</p>
            <p className="text-3xl font-bold">{overallScore}/100</p>
          </div>
          <Button onClick={handleRunAll} size="lg">
            <Zap className="w-4 h-4 mr-2" />
            Run All Suites
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-7">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="ai">AI Intelligence</TabsTrigger>
          <TabsTrigger value="security">Security</TabsTrigger>
          <TabsTrigger value="architecture">Architecture</TabsTrigger>
          <TabsTrigger value="supply-chain">Supply Chain</TabsTrigger>
          <TabsTrigger value="team">Team</TabsTrigger>
          <TabsTrigger value="predictive">Predictive</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-6">
          {/* Score Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <SuiteCard
              title="AI Intelligence"
              description="Code review, bug prediction, patterns"
              icon={Brain}
              score={suiteData.ai.score}
              status={runningStatus.ai}
              findings={suiteData.ai.findings}
              lastRun={suiteData.ai.lastRun}
              onRun={() => handleRunSuite("ai")}
            />
            <SuiteCard
              title="Security Suite"
              description="Secrets, vulnerabilities, compliance"
              icon={Shield}
              score={suiteData.security.score}
              status={runningStatus.security}
              findings={suiteData.security.findings}
              lastRun={suiteData.security.lastRun}
              onRun={() => handleRunSuite("security")}
            />
            <SuiteCard
              title="Architecture Health"
              description="Code smells, dependencies, coupling"
              icon={Building2}
              score={suiteData.architecture.score}
              status={runningStatus.architecture}
              findings={suiteData.architecture.findings}
              lastRun={suiteData.architecture.lastRun}
              onRun={() => handleRunSuite("architecture")}
            />
            <SuiteCard
              title="Supply Chain"
              description="SBOM, licenses, vulnerabilities"
              icon={Package}
              score={suiteData.supplyChain.score}
              status={runningStatus.supplyChain}
              findings={suiteData.supplyChain.findings}
              lastRun={suiteData.supplyChain.lastRun}
              onRun={() => handleRunSuite("supplyChain")}
            />
            <SuiteCard
              title="Team Intelligence"
              description="Expertise, bus factor, decisions"
              icon={Users}
              score={suiteData.team.score}
              status={runningStatus.team}
              findings={suiteData.team.findings}
              lastRun={suiteData.team.lastRun}
              onRun={() => handleRunSuite("team")}
            />
            <SuiteCard
              title="Predictive Analytics"
              description="Quality trends, risk assessment"
              icon={LineChart}
              score={suiteData.predictive.score}
              status={runningStatus.predictive}
              findings={suiteData.predictive.findings}
              lastRun={suiteData.predictive.lastRun}
              onRun={() => handleRunSuite("predictive")}
            />
          </div>

          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Total Findings
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2">
                  <FileWarning className="w-5 h-5 text-yellow-500" />
                  <span className="text-2xl font-bold">
                    {Object.values(suiteData).reduce(
                      (sum, d) => sum + d.findings,
                      0,
                    )}
                  </span>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Critical Issues
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 text-red-500" />
                  <span className="text-2xl font-bold">
                    {overview?.criticalIssues || 0}
                  </span>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Bug Predictions
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2">
                  <Bug className="w-5 h-5 text-orange-500" />
                  <span className="text-2xl font-bold">
                    {overview?.bugPredictions || 0}
                  </span>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Security Score
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2">
                  <Lock className="w-5 h-5 text-green-500" />
                  <span className="text-2xl font-bold">
                    {suiteData.security.score}%
                  </span>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Recent Activity */}
          <Card>
            <CardHeader>
              <CardTitle>Recent Findings</CardTitle>
              <CardDescription>
                Latest issues detected across all suites
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {recentFindings.length === 0 ? (
                  <p className="text-muted-foreground text-center py-4">
                    No recent findings. Run a suite to detect issues.
                  </p>
                ) : (
                  recentFindings.map((finding) => (
                    <div
                      key={finding.id}
                      className="flex items-center justify-between p-3 rounded-lg bg-muted/50"
                    >
                      <div className="flex items-center gap-3">
                        <Badge
                          variant={
                            finding.severity === "critical"
                              ? "destructive"
                              : finding.severity === "high"
                                ? "destructive"
                                : finding.severity === "medium"
                                  ? "secondary"
                                  : "outline"
                          }
                        >
                          {finding.severity}
                        </Badge>
                        <div>
                          <p className="font-medium">{finding.message}</p>
                          <p className="text-sm text-muted-foreground">
                            {finding.file}
                            {finding.line ? `:${finding.line}` : ""}
                          </p>
                        </div>
                      </div>
                      <Badge variant="outline">{finding.type}</Badge>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* AI Intelligence Tab */}
        <TabsContent value="ai" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Brain className="w-5 h-5" />
                  AI Code Analysis
                </CardTitle>
                <CardDescription>
                  Automated code review, bug prediction, and pattern learning
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 rounded-lg bg-muted/50">
                    <p className="text-sm text-muted-foreground">
                      Code Quality
                    </p>
                    <p className="text-2xl font-bold">
                      {suiteData.ai.score}/100
                    </p>
                    <Progress value={suiteData.ai.score} className="mt-2" />
                  </div>
                  <div className="p-4 rounded-lg bg-muted/50">
                    <p className="text-sm text-muted-foreground">
                      Bug Predictions
                    </p>
                    <p className="text-2xl font-bold">8</p>
                    <div className="flex gap-2 mt-2">
                      <Badge variant="destructive">2 Critical</Badge>
                      <Badge variant="secondary">3 High</Badge>
                    </div>
                  </div>
                </div>

                <div>
                  <h4 className="font-medium mb-2">Top Issues</h4>
                  <div className="space-y-2">
                    {[
                      {
                        severity: "critical",
                        title: "Potential SQL injection",
                        file: "src/api/users.ts:45",
                      },
                      {
                        severity: "high",
                        title: "Missing error handling",
                        file: "src/services/payment.ts:89",
                      },
                      {
                        severity: "medium",
                        title: "Long function (120 lines)",
                        file: "src/utils/parser.ts:23",
                      },
                    ].map((issue, i) => (
                      <div
                        key={i}
                        className="flex items-center justify-between p-2 rounded bg-muted/30"
                      >
                        <div className="flex items-center gap-2">
                          <Badge
                            variant={
                              issue.severity === "critical"
                                ? "destructive"
                                : issue.severity === "high"
                                  ? "destructive"
                                  : "secondary"
                            }
                          >
                            {issue.severity}
                          </Badge>
                          <span>{issue.title}</span>
                        </div>
                        <span className="text-sm text-muted-foreground">
                          {issue.file}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Recommendations</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {[
                  "Fix 2 critical security vulnerabilities",
                  "Add error handling to 5 functions",
                  "Refactor complex functions (>50 lines)",
                  "Improve test coverage to 80%",
                ].map((rec, i) => (
                  <div
                    key={i}
                    className="flex items-start gap-2 p-2 rounded bg-muted/30"
                  >
                    <CheckCircle className="w-4 h-4 text-green-500 mt-0.5" />
                    <span className="text-sm">{rec}</span>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Security Tab */}
        <TabsContent value="security" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="w-5 h-5" />
                  Security Analysis
                </CardTitle>
                <CardDescription>
                  Secrets detection, vulnerability scanning, and compliance
                  checking
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-4 gap-4">
                  <div className="p-4 rounded-lg bg-muted/50 text-center">
                    <p className="text-sm text-muted-foreground">Overall</p>
                    <p className="text-2xl font-bold">
                      {suiteData.security.score}%
                    </p>
                  </div>
                  <div className="p-4 rounded-lg bg-muted/50 text-center">
                    <p className="text-sm text-muted-foreground">Secrets</p>
                    <p className="text-2xl font-bold">95%</p>
                  </div>
                  <div className="p-4 rounded-lg bg-muted/50 text-center">
                    <p className="text-sm text-muted-foreground">
                      Vulnerabilities
                    </p>
                    <p className="text-2xl font-bold">78%</p>
                  </div>
                  <div className="p-4 rounded-lg bg-muted/50 text-center">
                    <p className="text-sm text-muted-foreground">Compliance</p>
                    <p className="text-2xl font-bold">82%</p>
                  </div>
                </div>

                <div>
                  <h4 className="font-medium mb-2">Compliance Status</h4>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { name: "SOC2", compliant: true },
                      { name: "HIPAA", compliant: true },
                      { name: "GDPR", compliant: false },
                      { name: "PCI-DSS", compliant: true },
                    ].map((item, i) => (
                      <div
                        key={i}
                        className="flex items-center justify-between p-2 rounded bg-muted/30"
                      >
                        <span>{item.name}</span>
                        {item.compliant ? (
                          <Badge variant="default" className="bg-green-500">
                            Compliant
                          </Badge>
                        ) : (
                          <Badge variant="destructive">Non-compliant</Badge>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Security Findings</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Critical</span>
                    <span className="font-bold text-red-500">1</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>High</span>
                    <span className="font-bold text-orange-500">3</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>Medium</span>
                    <span className="font-bold text-yellow-500">5</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>Low</span>
                    <span className="font-bold text-blue-500">4</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Architecture Tab */}
        <TabsContent value="architecture" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="w-5 h-5" />
                Architecture Health
              </CardTitle>
              <CardDescription>
                Code structure, dependencies, and maintainability analysis
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-6 gap-4 mb-6">
                {[
                  { label: "Overall", value: suiteData.architecture.score },
                  { label: "Modularity", value: 80 },
                  { label: "Coupling", value: 70 },
                  { label: "Cohesion", value: 75 },
                  { label: "Complexity", value: 65 },
                  { label: "Maintainability", value: 72 },
                ].map((metric, i) => (
                  <div
                    key={i}
                    className="p-3 rounded-lg bg-muted/50 text-center"
                  >
                    <p className="text-xs text-muted-foreground">
                      {metric.label}
                    </p>
                    <p className="text-xl font-bold">{metric.value}%</p>
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <h4 className="font-medium mb-2">
                    Code Smells ({suiteData.architecture.findings})
                  </h4>
                  <div className="space-y-2">
                    {[
                      { type: "God Class", count: 3, severity: "high" },
                      { type: "Long Method", count: 8, severity: "medium" },
                      { type: "Deep Nesting", count: 4, severity: "medium" },
                    ].map((smell, i) => (
                      <div
                        key={i}
                        className="flex items-center justify-between p-2 rounded bg-muted/30"
                      >
                        <span>{smell.type}</span>
                        <Badge
                          variant={
                            smell.severity === "high"
                              ? "destructive"
                              : "secondary"
                          }
                        >
                          {smell.count}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </div>
                <div>
                  <h4 className="font-medium mb-2">
                    Circular Dependencies (2)
                  </h4>
                  <div className="space-y-2">
                    {[
                      "services/auth → utils/crypto → services/auth",
                      "components/form → hooks/useForm → components/form",
                    ].map((cycle, i) => (
                      <div
                        key={i}
                        className="p-2 rounded bg-red-500/10 text-sm"
                      >
                        <GitBranch className="w-4 h-4 inline mr-2 text-red-500" />
                        {cycle}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Supply Chain Tab */}
        <TabsContent value="supply-chain" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Package className="w-5 h-5" />
                Supply Chain Security
              </CardTitle>
              <CardDescription>
                Dependencies, licenses, and vulnerability management
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-4 gap-4 mb-6">
                <div className="p-4 rounded-lg bg-muted/50 text-center">
                  <p className="text-sm text-muted-foreground">Dependencies</p>
                  <p className="text-2xl font-bold">142</p>
                </div>
                <div className="p-4 rounded-lg bg-muted/50 text-center">
                  <p className="text-sm text-muted-foreground">Outdated</p>
                  <p className="text-2xl font-bold text-yellow-500">12</p>
                </div>
                <div className="p-4 rounded-lg bg-muted/50 text-center">
                  <p className="text-sm text-muted-foreground">
                    Vulnerabilities
                  </p>
                  <p className="text-2xl font-bold text-red-500">5</p>
                </div>
                <div className="p-4 rounded-lg bg-muted/50 text-center">
                  <p className="text-sm text-muted-foreground">
                    License Issues
                  </p>
                  <p className="text-2xl font-bold">2</p>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <h4 className="font-medium mb-2">Vulnerable Dependencies</h4>
                  <div className="space-y-2">
                    {[
                      {
                        pkg: "lodash",
                        version: "4.17.20",
                        severity: "high",
                        cve: "CVE-2021-23337",
                      },
                      {
                        pkg: "axios",
                        version: "0.21.1",
                        severity: "medium",
                        cve: "CVE-2021-3749",
                      },
                    ].map((vuln, i) => (
                      <div
                        key={i}
                        className="flex items-center justify-between p-2 rounded bg-muted/30"
                      >
                        <div>
                          <span className="font-medium">
                            {vuln.pkg}@{vuln.version}
                          </span>
                          <span className="text-sm text-muted-foreground ml-2">
                            {vuln.cve}
                          </span>
                        </div>
                        <Badge
                          variant={
                            vuln.severity === "high"
                              ? "destructive"
                              : "secondary"
                          }
                        >
                          {vuln.severity}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Team Tab */}
        <TabsContent value="team" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="w-5 h-5" />
                Team Intelligence
              </CardTitle>
              <CardDescription>
                Knowledge distribution, expertise mapping, and collaboration
                metrics
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-4 gap-4 mb-6">
                <div className="p-4 rounded-lg bg-muted/50 text-center">
                  <p className="text-sm text-muted-foreground">Contributors</p>
                  <p className="text-2xl font-bold">8</p>
                </div>
                <div className="p-4 rounded-lg bg-muted/50 text-center">
                  <p className="text-sm text-muted-foreground">Active (30d)</p>
                  <p className="text-2xl font-bold">5</p>
                </div>
                <div className="p-4 rounded-lg bg-muted/50 text-center">
                  <p className="text-sm text-muted-foreground">Bus Factor</p>
                  <p className="text-2xl font-bold text-yellow-500">2</p>
                </div>
                <div className="p-4 rounded-lg bg-muted/50 text-center">
                  <p className="text-sm text-muted-foreground">
                    Knowledge Silos
                  </p>
                  <p className="text-2xl font-bold text-red-500">3</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <h4 className="font-medium mb-2">Top Experts</h4>
                  <div className="space-y-2">
                    {[
                      { name: "Alice", commits: 234, areas: "API, Auth" },
                      { name: "Bob", commits: 189, areas: "UI, Tests" },
                      { name: "Carol", commits: 156, areas: "Database, Core" },
                    ].map((expert, i) => (
                      <div
                        key={i}
                        className="flex items-center justify-between p-2 rounded bg-muted/30"
                      >
                        <div>
                          <span className="font-medium">{expert.name}</span>
                          <span className="text-sm text-muted-foreground ml-2">
                            {expert.areas}
                          </span>
                        </div>
                        <span className="text-sm">
                          {expert.commits} commits
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
                <div>
                  <h4 className="font-medium mb-2">Knowledge Silos (Risk)</h4>
                  <div className="space-y-2">
                    {[
                      { area: "src/auth/", risk: "high", owner: "Alice" },
                      { area: "src/billing/", risk: "medium", owner: "Bob" },
                      { area: "src/legacy/", risk: "high", owner: "Unknown" },
                    ].map((silo, i) => (
                      <div
                        key={i}
                        className="flex items-center justify-between p-2 rounded bg-muted/30"
                      >
                        <div>
                          <span className="font-medium">{silo.area}</span>
                          <span className="text-sm text-muted-foreground ml-2">
                            ({silo.owner})
                          </span>
                        </div>
                        <Badge
                          variant={
                            silo.risk === "high" ? "destructive" : "secondary"
                          }
                        >
                          {silo.risk}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Predictive Tab */}
        <TabsContent value="predictive" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <LineChart className="w-5 h-5" />
                Predictive Analytics
              </CardTitle>
              <CardDescription>
                Quality trends, risk assessment, and future predictions
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-4 mb-6">
                <div className="p-4 rounded-lg bg-muted/50">
                  <p className="text-sm text-muted-foreground">
                    Current Quality
                  </p>
                  <p className="text-2xl font-bold">
                    {suiteData.predictive.score}/100
                  </p>
                  <div className="flex items-center gap-1 mt-1">
                    <TrendIndicator trend="down" />
                    <span className="text-sm text-muted-foreground">
                      -3 from last month
                    </span>
                  </div>
                </div>
                <div className="p-4 rounded-lg bg-muted/50">
                  <p className="text-sm text-muted-foreground">
                    Predicted (30d)
                  </p>
                  <p className="text-2xl font-bold text-yellow-500">67/100</p>
                  <div className="flex items-center gap-1 mt-1">
                    <TrendIndicator trend="down" />
                    <span className="text-sm text-muted-foreground">
                      Declining trend
                    </span>
                  </div>
                </div>
                <div className="p-4 rounded-lg bg-muted/50">
                  <p className="text-sm text-muted-foreground">Overall Risk</p>
                  <p className="text-2xl font-bold text-orange-500">35%</p>
                  <div className="flex items-center gap-1 mt-1">
                    <TrendIndicator trend="up" />
                    <span className="text-sm text-muted-foreground">
                      Rising
                    </span>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <h4 className="font-medium mb-2">Risk Categories</h4>
                  <div className="space-y-2">
                    {[
                      {
                        name: "Code Quality",
                        score: 30,
                        trend: "stable" as const,
                      },
                      {
                        name: "Technical Debt",
                        score: 45,
                        trend: "up" as const,
                      },
                      {
                        name: "Scalability",
                        score: 25,
                        trend: "stable" as const,
                      },
                      { name: "Stability", score: 40, trend: "down" as const },
                    ].map((risk, i) => (
                      <div
                        key={i}
                        className="flex items-center justify-between p-2 rounded bg-muted/30"
                      >
                        <span>{risk.name}</span>
                        <div className="flex items-center gap-2">
                          <span>{risk.score}%</span>
                          <TrendIndicator trend={risk.trend} />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                <div>
                  <h4 className="font-medium mb-2">High-Risk Areas</h4>
                  <div className="space-y-2">
                    {[
                      { path: "src/legacy/parser.ts", risk: 85 },
                      { path: "src/services/payment.ts", risk: 72 },
                      { path: "src/utils/crypto.ts", risk: 68 },
                    ].map((area, i) => (
                      <div key={i} className="p-2 rounded bg-muted/30">
                        <div className="flex justify-between mb-1">
                          <span className="text-sm">{area.path}</span>
                          <span className="text-sm font-bold text-red-500">
                            {area.risk}%
                          </span>
                        </div>
                        <Progress value={area.risk} className="h-1" />
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default function IntelligencePage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[50vh] flex-col items-center justify-center gap-3 text-muted-foreground">
          <Loader2 className="h-8 w-8 animate-spin text-cyan-400" />
          <p className="text-sm">Loading intelligence…</p>
        </div>
      }
    >
      <IntelligencePageContent />
    </Suspense>
  );
}
