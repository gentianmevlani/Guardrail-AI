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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FreeTierIssueDetailsLock } from "@/components/entitlements/FreeTierIssueDetailsLock";
import { useAuth } from "@/context/auth-context";
import { hideIssueDetailsForTier } from "@/lib/tier-gates";
import { useRepository } from "@/context/repository-context";
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Info,
  Rocket,
  Shield,
  ShieldAlert,
  ShieldCheck,
  XCircle,
} from "lucide-react";
import Link from "next/link";
import { useState } from "react";

interface SecurityFinding {
  file: string;
  line: number;
  severity: string;
  type: string;
  snippet: string;
}

interface ScanSecurityData {
  verdict: string;
  findings: SecurityFinding[];
  summary: {
    critical: number;
    high: number;
    medium: number;
    low: number;
    total: number;
  };
  scannedFiles: number;
}

interface SecurityIssue {
  id: string;
  severity: string;
  category: string;
  title: string;
  description: string;
  file: string;
  line: number;
  fix?: string;
}

interface SecurityData {
  summary: {
    critical: number;
    high: number;
    medium: number;
    low: number;
    info: number;
  };
  issues: SecurityIssue[];
}

// Force dynamic rendering
export const dynamic = "force-dynamic";

function getTypeTitle(type: string): string {
  const titles: Record<string, string> = {
    hardcoded_api_key: "Hardcoded API Key",
    hardcoded_password: "Hardcoded Password",
    hardcoded_secret: "Hardcoded Secret",
    unsafe_eval: "Unsafe eval() Usage",
    xss_risk: "Cross-Site Scripting (XSS) Risk",
    command_injection_risk: "Command Injection Risk",
    sql_injection_risk: "SQL Injection Risk",
    insecure_http: "Insecure HTTP URL",
  };
  return (
    titles[type] ||
    type.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
  );
}

function getTypeDescription(type: string): string {
  const descriptions: Record<string, string> = {
    hardcoded_api_key:
      "API keys should not be hardcoded in source code. Use environment variables instead.",
    hardcoded_password:
      "Passwords should never be hardcoded. Use secure secrets management.",
    hardcoded_secret:
      "Secrets should be stored in environment variables or a secrets manager.",
    unsafe_eval:
      "Using eval() can execute arbitrary code and is a security risk.",
    xss_risk: "Directly setting HTML content can lead to XSS attacks.",
    command_injection_risk:
      "Executing shell commands with user input can lead to command injection.",
    sql_injection_risk:
      "String concatenation in SQL queries can lead to SQL injection attacks.",
    insecure_http: "Using HTTP instead of HTTPS exposes data to interception.",
  };
  return descriptions[type] || "This code pattern may pose a security risk.";
}

function transformScanData(scanData: ScanSecurityData): SecurityData {
  const issues: SecurityIssue[] = scanData.findings.map((f, i) => ({
    id: `finding-${i}`,
    severity: f.severity,
    category: f.type,
    title: getTypeTitle(f.type),
    description: getTypeDescription(f.type),
    file: f.file,
    line: f.line,
    fix: f.snippet,
  }));

  return {
    summary: {
      critical: scanData.summary.critical,
      high: scanData.summary.high,
      medium: scanData.summary.medium,
      low: scanData.summary.low,
      info: 0,
    },
    issues,
  };
}

function getSeverityIcon(severity: string) {
  switch (severity.toLowerCase()) {
    case "critical":
      return <ShieldAlert className="h-4 w-4 text-red-500" />;
    case "high":
      return <AlertTriangle className="h-4 w-4 text-orange-500" />;
    case "medium":
      return <Shield className="h-4 w-4 text-yellow-500" />;
    case "low":
      return <ShieldCheck className="h-4 w-4 text-blue-500" />;
    default:
      return <Info className="h-4 w-4 text-muted-foreground" />;
  }
}

function getSeverityBadgeClass(severity: string) {
  switch (severity.toLowerCase()) {
    case "critical":
      return "border-red-500 text-red-500 bg-red-500/10";
    case "high":
      return "border-orange-500 text-orange-500 bg-orange-500/10";
    case "medium":
      return "border-yellow-500 text-yellow-500 bg-yellow-500/10";
    case "low":
      return "border-blue-500 text-blue-500 bg-blue-500/10";
    default:
      return "border text-muted-foreground bg-muted/10";
  }
}

export default function SecurityPage() {
  const { scanResults, selectedRepo } = useRepository();
  const { tier } = useAuth();
  const [activeTab, setActiveTab] = useState("overview");

  const rawSecurityData = scanResults?.security as ScanSecurityData | undefined;
  const securityData: SecurityData | null = rawSecurityData?.findings
    ? transformScanData(rawSecurityData)
    : null;

  if (!securityData) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Security Analysis</h1>
          <p className="text-muted-foreground text-sm mt-1">
            View security vulnerabilities and issues detected in your repository
          </p>
        </div>

        <Card className="bg-card/50 border">
          <CardContent className="pt-6">
            <div className="text-center py-12">
              <ShieldAlert className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
              <h3 className="text-xl font-semibold text-white mb-2">
                No Security Data Available
              </h3>
              <p className="text-muted-foreground max-w-md mx-auto mb-6">
                {selectedRepo
                  ? `Run a security scan on "${selectedRepo.fullName}" from the dashboard to see vulnerabilities and security issues.`
                  : "Select a repository and run a scan from the dashboard to view security analysis results."}
              </p>
              <Link href="/dashboard">
                <Button className="bg-blue-600 hover:bg-blue-700 text-white">
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Go to Dashboard
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const { summary, issues } = securityData;
  const totalFindings =
    summary.critical +
    summary.high +
    summary.medium +
    summary.low +
    summary.info;
  const hasBlockers = summary.critical > 0 || summary.high > 0;

  const criticalIssues = issues.filter(
    (i) => i.severity.toLowerCase() === "critical",
  );
  const highIssues = issues.filter((i) => i.severity.toLowerCase() === "high");
  const mediumIssues = issues.filter(
    (i) => i.severity.toLowerCase() === "medium",
  );
  const lowIssues = issues.filter((i) => i.severity.toLowerCase() === "low");
  const infoIssues = issues.filter((i) => i.severity.toLowerCase() === "info");

  const issuesDetailLocked = hideIssueDetailsForTier(tier) && issues.length > 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Security Analysis</h1>
          <p className="text-muted-foreground text-sm mt-1">
            {selectedRepo
              ? `Security scan results for ${selectedRepo.fullName}`
              : "Security vulnerabilities and issues detected"}
          </p>
        </div>
        <Link href="/dashboard">
          <Button
            variant="outline"
            className="border text-foreground/80 hover:bg-muted"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Dashboard
          </Button>
        </Link>
      </div>

      <Card
        className={`border ${
          !hasBlockers
            ? "bg-emerald-950/30 border-emerald-800/50"
            : "bg-red-950/30 border-red-800/50"
        }`}
      >
        <CardContent className="pt-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {!hasBlockers ? (
                <div className="p-2 rounded-full bg-emerald-500/20">
                  <Rocket className="h-6 w-6 text-emerald-400" />
                </div>
              ) : (
                <div className="p-2 rounded-full bg-red-500/20">
                  <XCircle className="h-6 w-6 text-red-400" />
                </div>
              )}
              <div>
                <h3 className="text-lg font-semibold text-white">
                  {!hasBlockers
                    ? "Security Check Passed ✓"
                    : "Security Issues Found"}
                </h3>
                <p className="text-sm text-muted-foreground">
                  {!hasBlockers
                    ? "No critical or high severity issues detected."
                    : `Found ${summary.critical} critical and ${summary.high} high severity issues that need attention.`}
                </p>
              </div>
            </div>
            <div className="text-right">
              <div className="text-2xl font-bold text-white">
                {totalFindings}
              </div>
              <div className="text-xs text-muted-foreground">
                Total Findings
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-5">
        <Card className="bg-card/40 border backdrop-blur-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-foreground/80">
              Critical
            </CardTitle>
            <ShieldAlert className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-400">
              {summary.critical}
            </div>
            <p className="text-xs text-muted-foreground">
              Immediate action required
            </p>
          </CardContent>
        </Card>

        <Card className="bg-card/40 border backdrop-blur-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-foreground/80">
              High
            </CardTitle>
            <AlertTriangle className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-400">
              {summary.high}
            </div>
            <p className="text-xs text-muted-foreground">Fix before shipping</p>
          </CardContent>
        </Card>

        <Card className="bg-card/40 border backdrop-blur-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-foreground/80">
              Medium
            </CardTitle>
            <Shield className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-400">
              {summary.medium}
            </div>
            <p className="text-xs text-muted-foreground">Review recommended</p>
          </CardContent>
        </Card>

        <Card className="bg-card/40 border backdrop-blur-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-foreground/80">
              Low
            </CardTitle>
            <ShieldCheck className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-400">
              {summary.low}
            </div>
            <p className="text-xs text-muted-foreground">Low priority</p>
          </CardContent>
        </Card>

        <Card className="bg-card/40 border backdrop-blur-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-foreground/80">
              Info
            </CardTitle>
            <Info className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-muted-foreground">
              {summary.info}
            </div>
            <p className="text-xs text-muted-foreground">Informational</p>
          </CardContent>
        </Card>
      </div>

      <FreeTierIssueDetailsLock
        active={issuesDetailLocked}
        bannerMessage="Free plan shows severity counts only. Upgrade to see categories, files, lines, and remediation hints."
        overlayTitle="Security issue details are hidden on the Free plan"
        overlayDescription="Upgrade to unlock the full issue table, tabs, and file-level data."
      >
        <Tabs
          value={activeTab}
          onValueChange={setActiveTab}
          className="space-y-4"
        >
          <TabsList className="bg-card border">
            <TabsTrigger
              value="overview"
              className="data-[state=active]:bg-muted"
            >
              All Issues ({issues.length})
            </TabsTrigger>
            <TabsTrigger
              value="critical"
              className="data-[state=active]:bg-muted"
            >
              Critical ({summary.critical})
            </TabsTrigger>
            <TabsTrigger value="high" className="data-[state=active]:bg-muted">
              High ({summary.high})
            </TabsTrigger>
            <TabsTrigger value="medium" className="data-[state=active]:bg-muted">
              Medium ({summary.medium})
            </TabsTrigger>
            <TabsTrigger value="low" className="data-[state=active]:bg-muted">
              Low/Info ({summary.low + summary.info})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview">
            <IssuesTable issues={issues} title="All Security Issues" />
          </TabsContent>

          <TabsContent value="critical">
            <IssuesTable
              issues={criticalIssues}
              title="Critical Issues"
              emptyMessage="No critical issues found"
            />
          </TabsContent>

          <TabsContent value="high">
            <IssuesTable
              issues={highIssues}
              title="High Severity Issues"
              emptyMessage="No high severity issues found"
            />
          </TabsContent>

          <TabsContent value="medium">
            <IssuesTable
              issues={mediumIssues}
              title="Medium Severity Issues"
              emptyMessage="No medium severity issues found"
            />
          </TabsContent>

          <TabsContent value="low">
            <IssuesTable
              issues={[...lowIssues, ...infoIssues]}
              title="Low & Informational Issues"
              emptyMessage="No low or informational issues found"
            />
          </TabsContent>
        </Tabs>
      </FreeTierIssueDetailsLock>
    </div>
  );
}

function IssuesTable({
  issues,
  title,
  emptyMessage = "No issues found",
}: {
  issues: SecurityIssue[];
  title: string;
  emptyMessage?: string;
}) {
  if (issues.length === 0) {
    return (
      <Card className="bg-card/40 border backdrop-blur-sm">
        <CardHeader>
          <CardTitle className="text-white">{title}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-12 text-muted-foreground">
            <CheckCircle2 className="h-12 w-12 mx-auto mb-3 text-emerald-500/50" />
            <p className="text-lg font-medium text-foreground/80">
              {emptyMessage}
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-card/40 border backdrop-blur-sm">
      <CardHeader>
        <CardTitle className="text-white">{title}</CardTitle>
        <CardDescription className="text-muted-foreground">
          {issues.length} issue{issues.length !== 1 ? "s" : ""} found
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow className="border">
              <TableHead className="text-muted-foreground">Severity</TableHead>
              <TableHead className="text-muted-foreground">Category</TableHead>
              <TableHead className="text-muted-foreground">Title</TableHead>
              <TableHead className="text-muted-foreground">File</TableHead>
              <TableHead className="text-muted-foreground">Line</TableHead>
              <TableHead className="text-muted-foreground">Fix</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {issues.map((issue, idx) => (
              <TableRow key={issue.id || idx} className="border">
                <TableCell>
                  <div className="flex items-center gap-2">
                    {getSeverityIcon(issue.severity)}
                    <Badge
                      variant="outline"
                      className={getSeverityBadgeClass(issue.severity)}
                    >
                      {issue.severity}
                    </Badge>
                  </div>
                </TableCell>
                <TableCell className="text-foreground/80">
                  {issue.category}
                </TableCell>
                <TableCell>
                  <div>
                    <div className="font-medium text-foreground/90">
                      {issue.title}
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      {issue.description}
                    </div>
                  </div>
                </TableCell>
                <TableCell className="font-mono text-xs text-muted-foreground">
                  {issue.file}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {issue.line}
                </TableCell>
                <TableCell className="text-xs text-emerald-400 max-w-[200px] truncate">
                  {issue.fix || "-"}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
