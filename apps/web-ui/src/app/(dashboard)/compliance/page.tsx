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
import { useRepository } from "@/context/repository-context";
import {
  fetchComplianceDashboard,
  fetchComplianceReports,
  type ComplianceDashboard,
  type ComplianceReport,
} from "@/lib/api";
import { logger } from "@/lib/logger";
import {
  AlertTriangle,
  ArrowRight,
  Bug,
  CheckCircle,
  Code,
  Download,
  FileText,
  Rocket,
  Shield,
  TrendingUp,
  XCircle,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

// Force dynamic rendering
export const dynamic = "force-dynamic";

export default function CompliancePage() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<ComplianceDashboard | null>(null);
  const [reports, setReports] = useState<ComplianceReport[]>([]);

  const { scanResults, selectedRepo } = useRepository();

  useEffect(() => {
    async function loadData() {
      try {
        const projectId = "default-project";
        const [dashboard, reportsData] = await Promise.all([
          fetchComplianceDashboard(projectId),
          fetchComplianceReports(projectId),
        ]);

        if (dashboard) setData(dashboard);
        if (reportsData) setReports(reportsData);
      } catch (error) {
        logger.error("Failed to load compliance data:", error);
      }
      setLoading(false);
    }
    loadData();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center space-y-4">
          <div className="relative">
            <div className="w-16 h-16 rounded-full bg-teal-500/20 flex items-center justify-center mx-auto">
              <Shield className="h-8 w-8 text-teal-400 animate-pulse" />
            </div>
          </div>
          <p className="text-muted-foreground text-sm">
            Loading compliance data...
          </p>
        </div>
      </div>
    );
  }

  const hasScanData = scanResults?.mockproof && scanResults?.reality;
  const mockproofViolations = scanResults?.mockproof?.violations?.length || 0;
  const realityIssues = scanResults?.reality?.issues?.length || 0;
  const overallScore = scanResults?.score || 0;
  const verdict = scanResults?.verdict || "NO_SHIP";

  const isProductionReady = verdict === "SHIP";
  const needsReview = verdict === "REVIEW";

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-3">
            <div className="p-2 rounded-lg bg-teal-500/10">
              <Shield className="h-6 w-6 text-teal-400" />
            </div>
            Compliance Center
          </h1>
          <p className="text-muted-foreground mt-1">
            Monitor security compliance and generate audit reports
          </p>
        </div>
        <Button className="bg-teal-600 hover:bg-teal-700 text-white">
          <FileText className="h-4 w-4 mr-2" />
          Generate Report
        </Button>
      </div>

      {!hasScanData ? (
        <Card className="bg-card border-border glass-card">
          <CardContent className="py-12">
            <div className="text-center space-y-4">
              <div className="mx-auto w-16 h-16 rounded-full bg-amber-500/10 flex items-center justify-center">
                <AlertTriangle className="h-8 w-8 text-amber-400" />
              </div>
              <h2 className="text-xl font-semibold text-foreground">
                No Scan Data Available
              </h2>
              <p className="text-muted-foreground max-w-md mx-auto">
                Run a scan from the dashboard first to view compliance metrics
                based on your repository's code quality and security analysis.
              </p>
              <Link href="/dashboard">
                <Button className="bg-teal-600 hover:bg-teal-700 text-white mt-4">
                  Go to Dashboard <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      ) : (
        <>
          <Card className="bg-card border-border glass-card relative overflow-hidden">
            <div className="absolute top-0 right-0 p-4 opacity-5">
              <Rocket className="h-32 w-32 text-teal-500" />
            </div>
            <CardHeader>
              <CardTitle className="text-foreground flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-teal-400" />
                Scan Results Summary
                {selectedRepo && (
                  <Badge className="bg-muted text-muted-foreground border-border">
                    {selectedRepo.fullName}
                  </Badge>
                )}
              </CardTitle>
              <CardDescription className="text-muted-foreground">
                Based on the latest scan of your repository
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center gap-4 p-4 rounded-lg bg-muted/50 border border-border hover-lift transition-all">
                <div
                  className={`p-3 rounded-full ${
                    isProductionReady
                      ? "bg-emerald-500/20"
                      : needsReview
                        ? "bg-yellow-500/20"
                        : "bg-red-500/20"
                  }`}
                >
                  {isProductionReady ? (
                    <CheckCircle className="h-6 w-6 text-emerald-500" />
                  ) : needsReview ? (
                    <AlertTriangle className="h-6 w-6 text-yellow-500" />
                  ) : (
                    <XCircle className="h-6 w-6 text-red-500" />
                  )}
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-foreground">
                    {isProductionReady
                      ? "Production Ready"
                      : needsReview
                        ? "Needs Review"
                        : "Not Ready for Production"}
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    {isProductionReady
                      ? "Your code passed all checks and is ready to ship!"
                      : needsReview
                        ? "Some issues need to be addressed before shipping."
                        : "Critical issues detected that must be fixed."}
                  </p>
                </div>
                <Badge
                  className={`text-lg px-4 py-2 ${
                    isProductionReady
                      ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20"
                      : needsReview
                        ? "bg-yellow-500/10 text-yellow-500 border-yellow-500/20"
                        : "bg-red-500/10 text-red-500 border-red-500/20"
                  }`}
                >
                  {verdict}
                </Badge>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="p-4 rounded-lg bg-card border border-border text-center hover-lift transition-all">
                  <div className="flex items-center justify-center gap-2 mb-2">
                    <Code className="h-5 w-5 text-orange-500" />
                    <span className="text-sm text-muted-foreground">
                      Mock Violations
                    </span>
                  </div>
                  <p
                    className={`text-3xl font-bold ${mockproofViolations > 0 ? "text-orange-500" : "text-emerald-500"}`}
                  >
                    {mockproofViolations}
                  </p>
                  <p className="text-xs text-muted-foreground/70 mt-1">
                    {scanResults?.mockproof?.verdict === "pass"
                      ? "All clear"
                      : "Issues found"}
                  </p>
                </div>

                <div className="p-4 rounded-lg bg-card border border-border text-center hover-lift transition-all">
                  <div className="flex items-center justify-center gap-2 mb-2">
                    <Bug className="h-5 w-5 text-purple-500" />
                    <span className="text-sm text-muted-foreground">
                      Reality Issues
                    </span>
                  </div>
                  <p
                    className={`text-3xl font-bold ${realityIssues > 5 ? "text-yellow-500" : "text-emerald-500"}`}
                  >
                    {realityIssues}
                  </p>
                  <p className="text-xs text-muted-foreground/70 mt-1">
                    {scanResults?.reality?.verdict === "pass"
                      ? "Production quality"
                      : "Needs attention"}
                  </p>
                </div>

                <div className="p-4 rounded-lg bg-card border border-border text-center hover-lift transition-all">
                  <div className="flex items-center justify-center gap-2 mb-2">
                    <CheckCircle className="h-5 w-5 text-blue-500" />
                    <span className="text-sm text-muted-foreground">
                      Overall Score
                    </span>
                  </div>
                  <p
                    className={`text-3xl font-bold ${
                      overallScore >= 80
                        ? "text-emerald-500"
                        : overallScore >= 50
                          ? "text-yellow-500"
                          : "text-red-500"
                    }`}
                  >
                    {overallScore}%
                  </p>
                  <p className="text-xs text-muted-foreground/70 mt-1">
                    Compliance score
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-foreground">Overall Compliance</span>
                  <span
                    className={`font-bold ${
                      overallScore >= 80
                        ? "text-emerald-500"
                        : overallScore >= 50
                          ? "text-yellow-500"
                          : "text-red-500"
                    }`}
                  >
                    {overallScore}%
                  </span>
                </div>
                <div className="h-3 w-full bg-muted rounded-full overflow-hidden">
                  <div
                    className={`h-full transition-all duration-500 ${
                      overallScore >= 80
                        ? "bg-emerald-500"
                        : overallScore >= 50
                          ? "bg-yellow-500"
                          : "bg-red-500"
                    }`}
                    style={{ width: `${overallScore}%` }}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {(mockproofViolations > 0 || realityIssues > 0) && (
            <div className="grid gap-6 md:grid-cols-2">
              {mockproofViolations > 0 && (
                <Card className="bg-card border-border glass-card hover-lift">
                  <CardHeader>
                    <CardTitle className="text-foreground flex items-center gap-2">
                      <Code className="h-5 w-5 text-orange-500" />
                      MockProof Violations
                    </CardTitle>
                    <CardDescription className="text-muted-foreground">
                      Mock data and placeholder code detected
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2 max-h-60 overflow-y-auto">
                      {scanResults?.mockproof?.violations?.slice(0, 10).map(
                        (
                          violation: {
                            file: string;
                            type: string;
                            count?: number;
                            pattern?: string;
                          },
                          idx: number,
                        ) => (
                          <div
                            key={idx}
                            className="p-3 rounded-lg bg-muted/30 border border-border hover:bg-muted/50 transition-colors"
                          >
                            <div className="flex items-center justify-between">
                              <span className="text-sm text-foreground/80 font-mono truncate flex-1">
                                {violation.file}
                              </span>
                              <Badge className="bg-orange-500/10 text-orange-500 border-orange-500/20 ml-2">
                                {violation.type}
                              </Badge>
                            </div>
                          </div>
                        ),
                      )}
                      {mockproofViolations > 10 && (
                        <p className="text-sm text-muted-foreground text-center pt-2">
                          +{mockproofViolations - 10} more violations
                        </p>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )}

              {realityIssues > 0 && (
                <Card className="bg-card border-border glass-card hover-lift">
                  <CardHeader>
                    <CardTitle className="text-foreground flex items-center gap-2">
                      <Bug className="h-5 w-5 text-purple-500" />
                      Reality Mode Issues
                    </CardTitle>
                    <CardDescription className="text-muted-foreground">
                      Code quality issues for production
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2 max-h-60 overflow-y-auto">
                      {scanResults?.reality?.issues?.slice(0, 10).map(
                        (
                          issue: {
                            file?: string;
                            type: string;
                            message: string;
                            count?: number;
                          },
                          idx: number,
                        ) => (
                          <div
                            key={idx}
                            className="p-3 rounded-lg bg-muted/30 border border-border hover:bg-muted/50 transition-colors"
                          >
                            <div className="flex items-center justify-between">
                              <span className="text-sm text-foreground/80 truncate flex-1">
                                {issue.message}
                              </span>
                              <Badge className="bg-purple-500/10 text-purple-500 border-purple-500/20 ml-2">
                                {issue.type}
                              </Badge>
                            </div>
                            {issue.file && (
                              <p className="text-xs text-muted-foreground font-mono mt-1 truncate">
                                {issue.file}
                              </p>
                            )}
                          </div>
                        ),
                      )}
                      {realityIssues > 10 && (
                        <p className="text-sm text-muted-foreground text-center pt-2">
                          +{realityIssues - 10} more issues
                        </p>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </>
      )}

      <Card className="bg-card border-border glass-card">
        <CardHeader>
          <CardTitle className="text-foreground flex items-center gap-2">
            <Download className="h-5 w-5 text-teal-400" />
            Generated Reports
          </CardTitle>
        </CardHeader>
        <CardContent>
          {reports.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <FileText className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>No reports generated yet</p>
              <p className="text-sm">
                Generate your first compliance report above
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {reports.map((report) => (
                <div
                  key={report.id}
                  className="flex items-center justify-between p-4 border border-border rounded-lg hover:bg-muted/50 transition-all hover-lift-sm"
                >
                  <div className="flex items-center gap-4">
                    <div className="p-2 bg-teal-500/10 rounded-lg text-teal-400">
                      <FileText className="h-6 w-6" />
                    </div>
                    <div>
                      <p className="font-medium text-foreground">
                        {report.name}
                      </p>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span>{report.type}</span>
                        <span>•</span>
                        <span>{report.date}</span>
                      </div>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-teal-400 hover:text-teal-300"
                  >
                    Download
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function ShieldIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10" />
    </svg>
  );
}

function GlobeIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="10" />
      <line x1="2" x2="22" y1="12" y2="12" />
      <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
    </svg>
  );
}
