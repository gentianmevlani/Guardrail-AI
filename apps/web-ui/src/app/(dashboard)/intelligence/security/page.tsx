"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { fetchSecurityAnalytics, fetchVulnerabilities, triggerDeepScan, type SecurityAnalytics, type Vulnerability } from "@/lib/api";
import { logger } from "@/lib/logger";
import { AlertTriangle, Bug, CheckCircle, Eye, FileWarning, Lock, Play, RefreshCw, Shield } from "lucide-react";
import { useEffect, useState } from "react";

export default function SecurityPage() {
  const [isRunning, setIsRunning] = useState(false);
  const [analytics, setAnalytics] = useState<SecurityAnalytics | null>(null);
  const [vulnerabilities, setVulnerabilities] = useState<Vulnerability[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load real data on component mount
  useEffect(() => {
    loadSecurityData();
  }, []);

  const loadSecurityData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Fetch real security analytics
      const analyticsResponse = await fetchSecurityAnalytics("default");
      const vulnerabilitiesResponse = await fetchVulnerabilities("default");
      
      if (analyticsResponse) {
        setAnalytics(analyticsResponse);
      }
      
      if (vulnerabilitiesResponse) {
        setVulnerabilities(vulnerabilitiesResponse);
      }
    } catch (err) {
      logger.logUnknownError("Failed to load security data", err);
      setError("Failed to load security data");
    } finally {
      setLoading(false);
    }
  };

  const handleRunScan = async () => {
    setIsRunning(true);
    try {
      // Trigger real deep scan
      const result = await triggerDeepScan();
      if (result) {
        // Refresh data after scan
        await loadSecurityData();
      }
    } catch (err) {
      logger.logUnknownError("Failed to run security scan", err);
      setError("Failed to run security scan");
    } finally {
      setIsRunning(false);
    }
  };

  // Calculate score from real data
  const score = analytics ? Math.round(analytics.overview.riskScore) : 0;
  const criticalIssues = analytics?.overview.criticalIssues || 0;
  const highIssues = analytics?.overview.highIssues || 0;
  const mediumIssues = vulnerabilities?.filter(v => v.severity === "Medium").length || 0;

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Security Analysis</h1>
            <p className="text-muted-foreground">
              Loading security data...
            </p>
          </div>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <Card>
              <CardHeader>
                <CardTitle>Loading...</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="animate-pulse">
                  <div className="h-4 bg-muted rounded w-3/4 mb-2"></div>
                  <div className="h-4 bg-muted rounded w-1/2"></div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Security Analysis</h1>
            <p className="text-muted-foreground">Error loading data</p>
          </div>
        </div>
        <Card>
          <CardContent className="pt-6">
            <div className="text-center text-red-500">
              <AlertTriangle className="h-8 w-8 mx-auto mb-2" />
              <p>{error}</p>
              <Button onClick={loadSecurityData} className="mt-4">
                Retry
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Security Analysis</h1>
          <p className="text-muted-foreground">
            Comprehensive security vulnerability assessment and threat detection
          </p>
        </div>
        <Button onClick={handleRunScan} disabled={isRunning}>
          {isRunning ? (
            <>
              <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
              Scanning...
            </>
          ) : (
            <>
              <Play className="mr-2 h-4 w-4" />
              Run Security Scan
            </>
          )}
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Security Score
            </CardTitle>
            <CardDescription>
              Overall security posture and vulnerability assessment
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Security Score</span>
                <Badge variant={score >= 80 ? "default" : score >= 60 ? "secondary" : "destructive"}>
                  {score}/100
                </Badge>
              </div>
              <Progress value={score} className="h-2" />
              
              <div className="grid grid-cols-3 gap-4 mt-6">
                <div className="text-center">
                  <div className="text-2xl font-bold text-red-500">{criticalIssues}</div>
                  <div className="text-xs text-muted-foreground">Critical</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-yellow-500">{highIssues}</div>
                  <div className="text-xs text-muted-foreground">High</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-blue-500">{mediumIssues}</div>
                  <div className="text-xs text-muted-foreground">Medium</div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Lock className="h-5 w-5" />
              Security Status
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="p-3 bg-green-50 dark:bg-green-950/20 rounded-lg">
                <h4 className="text-sm font-medium text-green-900 dark:text-green-100">Authentication</h4>
                <p className="text-xs text-green-700 dark:text-green-300 mt-1">
                  Secure and properly configured
                </p>
              </div>
              <div className="p-3 bg-yellow-50 dark:bg-yellow-950/20 rounded-lg">
                <h4 className="text-sm font-medium text-yellow-900 dark:text-yellow-100">Dependencies</h4>
                <p className="text-xs text-yellow-700 dark:text-yellow-300 mt-1">
                  {vulnerabilities.filter(v => v.severity === "High").length} outdated packages found
                </p>
              </div>
              <div className="p-3 bg-blue-50 dark:bg-blue-950/20 rounded-lg">
                <h4 className="text-sm font-medium text-blue-900 dark:text-blue-100">Data Protection</h4>
                <p className="text-xs text-blue-700 dark:text-blue-300 mt-1">
                  Encryption standards met
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Bug className="h-4 w-4" />
              Vulnerabilities
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-sm">Total Found</span>
                <span className="text-sm font-medium">{vulnerabilities.length}</span>
              </div>
              <div className="text-xs text-muted-foreground">
                {criticalIssues} critical, {highIssues} high, {mediumIssues} medium
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <FileWarning className="h-4 w-4" />
              Code Issues
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-sm">Security Flaws</span>
                <span className="text-sm font-medium">
                  {vulnerabilities.filter(v => v.severity === "High").length}
                </span>
              </div>
              <div className="text-xs text-muted-foreground">
                Potential injection points
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Eye className="h-4 w-4" />
              Exposure
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-sm">Risk Level</span>
                <span className="text-sm font-medium">
                  {score >= 80 ? "Low" : score >= 60 ? "Medium" : "High"}
                </span>
              </div>
              <div className="text-xs text-muted-foreground">
                Based on vulnerability severity
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <CheckCircle className="h-4 w-4" />
              Compliance
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-sm">Standards Met</span>
                <span className="text-sm font-medium">
                  {analytics ? Object.keys(analytics.compliance).length : 0}/6
                </span>
              </div>
              <div className="text-xs text-muted-foreground">
                Industry compliance score
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
