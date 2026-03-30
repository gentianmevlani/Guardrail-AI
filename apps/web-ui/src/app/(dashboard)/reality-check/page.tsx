"use client";

import {
  AlertTriangle,
  CheckCircle,
  Code,
  Database,
  Download,
  Eye,
  Link2,
  Loader2,
  Lock,
  Server,
  XCircle,
  Zap,
} from "lucide-react";
import { useState } from "react";

// Force dynamic rendering
export const dynamic = "force-dynamic";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "";

interface RealityCheckResult {
  score: number;
  grade: string;
  canShip: boolean;
  counts: {
    api: { connected: number; missing: number };
    auth: { protected: number; exposed: number };
    secrets: { critical: number };
    routes: { deadLinks: number };
    mocks: { critical: number; high: number };
  };
  deductions: Array<{ category: string; points: number; reason: string }>;
}

function StatItem({
  icon,
  label,
  value,
  status,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  status: "good" | "bad";
}) {
  return (
    <div className="flex items-center justify-between py-2">
      <div className="flex items-center gap-3">
        <span
          className={status === "good" ? "text-success" : "text-destructive"}
        >
          {icon}
        </span>
        <span className="text-muted-foreground text-sm">{label}</span>
      </div>
      <span
        className={`font-mono text-sm ${status === "good" ? "text-success" : "text-destructive"}`}
      >
        {value}
      </span>
    </div>
  );
}

function RealityRow({
  think,
  truth,
  isGood,
}: {
  think: string;
  truth: string;
  isGood: boolean;
}) {
  return (
    <tr className="border-b border-border/50">
      <td className="py-4 px-4 text-foreground/90">"{think}"</td>
      <td className="py-4 px-4 text-muted-foreground">{truth}</td>
      <td className="py-4 px-4 text-center">
        {isGood ? (
          <CheckCircle className="w-5 h-5 text-success mx-auto" />
        ) : (
          <XCircle className="w-5 h-5 text-destructive mx-auto" />
        )}
      </td>
    </tr>
  );
}

function ActionItem({
  priority,
  title,
  description,
}: {
  priority: string;
  title: string;
  description: string;
}) {
  const colors: Record<string, string> = {
    P0: "bg-destructive/20 border-destructive/30 text-destructive",
    P1: "bg-warning/20 border-warning/30 text-warning",
    P2: "bg-warning/10 border-warning/20 text-warning/80",
  };
  return (
    <div className={`p-4 rounded-xl border ${colors[priority] || colors.P2}`}>
      <div className="flex items-center gap-3 mb-2">
        <span className="px-2 py-1 bg-black/30 rounded text-xs font-bold">
          {priority}
        </span>
        <h4 className="font-semibold">{title}</h4>
      </div>
      <p className="text-muted-foreground text-sm">{description}</p>
    </div>
  );
}

export default function RealityCheckPage() {
  const [isLoading, setIsLoading] = useState(false);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [projectPath, setProjectPath] = useState("");
  const [result, setResult] = useState<RealityCheckResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"overview" | "actions">(
    "overview",
  );

  const runRealityCheck = async () => {
    if (!projectPath.trim()) {
      setError("Please enter a project path");
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/api/reality-check/run`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectPath: projectPath.trim() }),
      });
      if (!res.ok) throw new Error("Failed to run reality check");
      const data = await res.json();
      setResult(data.summary);
    } catch (err: unknown) {
      const error = err as Error;
      setError(error.message || "Failed to run reality check");
    } finally {
      setIsLoading(false);
    }
  };

  const downloadPdf = async () => {
    if (!result) return;
    setIsGeneratingPdf(true);
    try {
      const res = await fetch(`${API_BASE}/api/reality-check/pdf`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectPath: projectPath.trim(), result }),
      });
      if (!res.ok) throw new Error("Failed to generate PDF");
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `reality-check-${new Date().toISOString().split("T")[0]}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err: unknown) {
      const error = err as Error;
      setError(error.message || "Failed to generate PDF");
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  const getGradeColor = (grade: string) => {
    if (grade.startsWith("A")) return "text-success";
    if (grade.startsWith("B")) return "text-primary";
    if (grade.startsWith("C")) return "text-warning";
    return "text-destructive";
  };

  const getScoreGradient = (score: number) => {
    if (score >= 80) return "from-success to-success/80";
    if (score >= 60) return "from-primary to-primary/80";
    if (score >= 40) return "from-warning to-warning/80";
    return "from-destructive to-destructive/80";
  };

  return (
    <div className="min-h-screen bg-background text-foreground p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-gradient-to-br from-primary/20 to-accent-cyan/20 rounded-xl border border-primary/30">
              <Eye className="w-8 h-8 text-primary" />
            </div>
            <div>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-primary to-accent-cyan bg-clip-text text-transparent">
                Reality Check
              </h1>
              <p className="text-muted-foreground text-sm">
                Where Your Code Lies To You
              </p>
            </div>
          </div>
          {result && (
            <button
              onClick={downloadPdf}
              disabled={isGeneratingPdf}
              className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-primary to-accent-cyan rounded-lg hover:from-primary/90 hover:to-accent-cyan/90 transition-all disabled:opacity-50"
            >
              {isGeneratingPdf ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Download className="w-4 h-4" />
              )}
              Download PDF
            </button>
          )}
        </div>

        {/* Input */}
        <div className="bg-card rounded-2xl border p-6 mb-8">
          <div className="flex gap-4">
            <div className="flex-1">
              <label className="block text-sm text-muted-foreground mb-2">
                Project Path
              </label>
              <input
                type="text"
                value={projectPath}
                onChange={(e) => setProjectPath(e.target.value)}
                placeholder="C:\path\to\your\project"
                className="w-full px-4 py-3 bg-muted border rounded-xl text-foreground placeholder-muted-foreground focus:border-primary focus:outline-none"
              />
            </div>
            <div className="flex items-end">
              <button
                onClick={runRealityCheck}
                disabled={isLoading}
                className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-primary to-accent-cyan rounded-xl hover:from-primary/90 hover:to-accent-cyan/90 disabled:opacity-50 font-medium"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Analyzing...
                  </>
                ) : (
                  <>
                    <Zap className="w-5 h-5" />
                    Run Reality Check
                  </>
                )}
              </button>
            </div>
          </div>
          {error && (
            <div className="mt-4 p-4 bg-destructive/10 border border-destructive/30 rounded-xl text-destructive flex items-center gap-2">
              <AlertTriangle className="w-5 h-5" />
              {error}
            </div>
          )}
        </div>

        {/* Results */}
        {result && (
          <>
            {/* Score Card */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
              <div className="col-span-2 bg-card rounded-2xl border p-8">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-muted-foreground text-sm mb-2">
                      Reality Score
                    </p>
                    <div className="flex items-baseline gap-4">
                      <span
                        className={`text-7xl font-bold ${getGradeColor(result.grade)}`}
                      >
                        {result.score}
                      </span>
                      <span className="text-4xl text-muted-foreground">
                        /100
                      </span>
                    </div>
                    <div
                      className={`text-2xl font-bold mt-2 ${getGradeColor(result.grade)}`}
                    >
                      Grade: {result.grade}
                    </div>
                  </div>
                  <div
                    className={`p-6 rounded-2xl ${result.canShip ? "bg-success/20" : "bg-destructive/20"}`}
                  >
                    {result.canShip ? (
                      <div className="text-center">
                        <CheckCircle className="w-16 h-16 text-success mx-auto mb-2" />
                        <p className="text-success font-bold text-xl">
                          CLEAR TO SHIP
                        </p>
                      </div>
                    ) : (
                      <div className="text-center">
                        <XCircle className="w-16 h-16 text-destructive mx-auto mb-2" />
                        <p className="text-destructive font-bold text-xl">
                          NOT READY
                        </p>
                      </div>
                    )}
                  </div>
                </div>
                <div className="mt-6 h-4 bg-muted rounded-full overflow-hidden">
                  <div
                    className={`h-full bg-gradient-to-r ${getScoreGradient(result.score)} transition-all duration-1000`}
                    style={{ width: `${result.score}%` }}
                  />
                </div>
              </div>

              <div className="bg-card rounded-2xl border p-6">
                <h3 className="text-lg font-semibold mb-4 text-foreground/90">
                  Quick Stats
                </h3>
                <div className="space-y-3">
                  <StatItem
                    icon={<Server className="w-5 h-5" />}
                    label="API Endpoints"
                    value={`${result.counts.api.missing} missing`}
                    status={result.counts.api.missing === 0 ? "good" : "bad"}
                  />
                  <StatItem
                    icon={<Lock className="w-5 h-5" />}
                    label="Auth"
                    value={`${result.counts.auth.exposed} exposed`}
                    status={result.counts.auth.exposed === 0 ? "good" : "bad"}
                  />
                  <StatItem
                    icon={<Database className="w-5 h-5" />}
                    label="Secrets"
                    value={`${result.counts.secrets.critical} critical`}
                    status={
                      result.counts.secrets.critical === 0 ? "good" : "bad"
                    }
                  />
                  <StatItem
                    icon={<Link2 className="w-5 h-5" />}
                    label="Dead Links"
                    value={`${result.counts.routes.deadLinks}`}
                    status={
                      result.counts.routes.deadLinks === 0 ? "good" : "bad"
                    }
                  />
                  <StatItem
                    icon={<Code className="w-5 h-5" />}
                    label="Mock Code"
                    value={`${result.counts.mocks.critical + result.counts.mocks.high} blocking`}
                    status={
                      result.counts.mocks.critical +
                        result.counts.mocks.high ===
                      0
                        ? "good"
                        : "bad"
                    }
                  />
                </div>
              </div>
            </div>

            {/* Tabs */}
            <div className="flex gap-2 mb-6">
              {(["overview", "actions"] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`px-4 py-2 rounded-lg font-medium transition-all ${activeTab === tab ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:text-foreground"}`}
                >
                  {tab.charAt(0).toUpperCase() + tab.slice(1)}
                </button>
              ))}
            </div>

            <div className="bg-card rounded-2xl border p-6">
              {activeTab === "overview" && (
                <div>
                  <h3 className="text-xl font-semibold mb-6">The Reality</h3>
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-border">
                        <th className="text-left py-3 px-4 text-muted-foreground font-medium">
                          What You Think
                        </th>
                        <th className="text-left py-3 px-4 text-muted-foreground font-medium">
                          The Truth
                        </th>
                        <th className="text-center py-3 px-4 text-muted-foreground font-medium">
                          Status
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      <RealityRow
                        think="All APIs work"
                        truth={`${result.counts.api.missing} endpoints missing`}
                        isGood={result.counts.api.missing === 0}
                      />
                      <RealityRow
                        think="App is secure"
                        truth={`${result.counts.auth.exposed} exposed`}
                        isGood={result.counts.auth.exposed === 0}
                      />
                      <RealityRow
                        think="Secrets are safe"
                        truth={`${result.counts.secrets.critical} hardcoded`}
                        isGood={result.counts.secrets.critical === 0}
                      />
                      <RealityRow
                        think="All pages work"
                        truth={`${result.counts.routes.deadLinks} dead links`}
                        isGood={result.counts.routes.deadLinks === 0}
                      />
                      <RealityRow
                        think="No test code"
                        truth={`${result.counts.mocks.critical + result.counts.mocks.high} issues`}
                        isGood={
                          result.counts.mocks.critical +
                            result.counts.mocks.high ===
                          0
                        }
                      />
                    </tbody>
                  </table>
                  {result.deductions.length > 0 && (
                    <div className="mt-8">
                      <h4 className="text-lg font-semibold mb-4 text-foreground/90">
                        Score Breakdown
                      </h4>
                      <div className="space-y-2">
                        <div className="flex justify-between py-2 px-4 bg-muted rounded-lg">
                          <span className="text-muted-foreground">
                            Base Score
                          </span>
                          <span className="text-success font-mono">100</span>
                        </div>
                        {result.deductions.map((d, i) => (
                          <div
                            key={i}
                            className="flex justify-between py-2 px-4 bg-muted rounded-lg"
                          >
                            <span className="text-muted-foreground">
                              {d.category}
                            </span>
                            <span className="text-destructive font-mono">
                              {d.points}
                            </span>
                          </div>
                        ))}
                        <div className="flex justify-between py-2 px-4 bg-primary/20 rounded-lg border border-primary/30">
                          <span className="font-semibold">Final Score</span>
                          <span
                            className={`font-mono font-bold ${getGradeColor(result.grade)}`}
                          >
                            {result.score}
                          </span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
              {activeTab === "actions" && (
                <div className="space-y-4">
                  <h3 className="text-xl font-semibold mb-4">Action Items</h3>
                  {result.counts.secrets.critical > 0 && (
                    <ActionItem
                      priority="P0"
                      title="Remove hardcoded secrets"
                      description={`${result.counts.secrets.critical} critical secrets in code`}
                    />
                  )}
                  {result.counts.mocks.critical > 0 && (
                    <ActionItem
                      priority="P0"
                      title="Remove test code"
                      description={`${result.counts.mocks.critical} mock code issues`}
                    />
                  )}
                  {result.counts.auth.exposed > 0 && (
                    <ActionItem
                      priority="P0"
                      title="Secure endpoints"
                      description={`${result.counts.auth.exposed} exposed`}
                    />
                  )}
                  {result.counts.api.missing > 0 && (
                    <ActionItem
                      priority="P1"
                      title="Implement APIs"
                      description={`${result.counts.api.missing} missing`}
                    />
                  )}
                  {result.counts.routes.deadLinks > 0 && (
                    <ActionItem
                      priority="P2"
                      title="Fix dead links"
                      description={`${result.counts.routes.deadLinks} broken`}
                    />
                  )}
                  {result.canShip && (
                    <div className="p-6 bg-success/10 border border-success/30 rounded-xl text-center">
                      <CheckCircle className="w-12 h-12 text-success mx-auto mb-4" />
                      <h4 className="text-xl font-bold text-success">
                        Ready to Ship! 🚀
                      </h4>
                    </div>
                  )}
                </div>
              )}
            </div>
          </>
        )}

        {!result && !isLoading && (
          <div className="bg-card rounded-2xl border p-12 text-center">
            <Eye className="w-16 h-16 text-primary/50 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-muted-foreground mb-2">
              No Reality Check Run Yet
            </h3>
            <p className="text-muted-foreground/70">
              Enter a project path and click "Run Reality Check" to see where
              your code lies to you.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
