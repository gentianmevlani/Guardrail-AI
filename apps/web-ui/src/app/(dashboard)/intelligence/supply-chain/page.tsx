"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { scanSupplyChain, type SupplyChainReport } from "@/lib/api";
import { logger } from "@/lib/logger";
import { AlertTriangle, CheckCircle, Package, Play, RefreshCw, Truck } from "lucide-react";
import { useEffect, useState } from "react";

export default function SupplyChainPage() {
  const [isRunning, setIsRunning] = useState(false);
  const [report, setReport] = useState<SupplyChainReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load real data on component mount
  useEffect(() => {
    loadSupplyChainData();
  }, []);

  const loadSupplyChainData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Trigger real supply chain scan
      const result = await scanSupplyChain({
        projectPath: ".",
        checkLicenses: true,
      });
      
      if (result.success && result.data) {
        setReport(result.data);
      }
    } catch (err) {
      logger.logUnknownError("Failed to load supply chain data", err);
      setError("Failed to load supply chain data");
    } finally {
      setLoading(false);
    }
  };

  const handleRunAnalysis = async () => {
    setIsRunning(true);
    try {
      await loadSupplyChainData();
    } catch (err) {
      logger.logUnknownError("Failed to run supply chain analysis", err);
      setError("Failed to run supply chain analysis");
    } finally {
      setIsRunning(false);
    }
  };

  // Calculate score from real data
  const score = report ? Math.round(((report.totalDependencies - report.vulnerableDependencies) / report.totalDependencies) * 100) : 0;
  const vulnerableDependencies = report?.vulnerableDependencies || 0;
  const outdatedDependencies = report?.outdatedDependencies || 0;

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Supply Chain Analysis</h1>
            <p className="text-muted-foreground">
              Loading supply chain data...
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
            <h1 className="text-3xl font-bold">Supply Chain Analysis</h1>
            <p className="text-muted-foreground">Error loading data</p>
          </div>
        </div>
        <Card>
          <CardContent className="pt-6">
            <div className="text-center text-red-500">
              <AlertTriangle className="h-8 w-8 mx-auto mb-2" />
              <p>{error}</p>
              <Button onClick={loadSupplyChainData} className="mt-4">
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
          <h1 className="text-3xl font-bold">Supply Chain Analysis</h1>
          <p className="text-muted-foreground">
            Third-party dependencies and supply chain security assessment
          </p>
        </div>
        <Button onClick={handleRunAnalysis} disabled={isRunning}>
          {isRunning ? (
            <>
              <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
              Analyzing...
            </>
          ) : (
            <>
              <Play className="mr-2 h-4 w-4" />
              Run Analysis
            </>
          )}
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Package className="h-5 w-5" />
              Supply Chain Score
            </CardTitle>
            <CardDescription>
              Overall supply chain security and dependency health
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Supply Chain Score</span>
                <Badge variant={score >= 80 ? "default" : score >= 60 ? "secondary" : "destructive"}>
                  {score}/100
                </Badge>
              </div>
              <Progress value={score} className="h-2" />
              
              <div className="grid grid-cols-2 gap-4 mt-6">
                <div className="space-y-2">
                  <h4 className="text-sm font-medium">Dependencies</h4>
                  <div className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-500" />
                    <span className="text-sm">{report?.totalDependencies || 0} total</span>
                  </div>
                </div>
                <div className="space-y-2">
                  <h4 className="text-sm font-medium">Licenses</h4>
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-yellow-500" />
                    <span className="text-sm">{report?.licenseIssues || 0} conflicts</span>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Truck className="h-5 w-5" />
              Supply Chain Health
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="p-3 bg-green-50 dark:bg-green-950/20 rounded-lg">
                <h4 className="text-sm font-medium text-green-900 dark:text-green-100">Vulnerabilities</h4>
                <p className="text-xs text-green-700 dark:text-green-300 mt-1">
                  {vulnerableDependencies} issues found
                </p>
              </div>
              <div className="p-3 bg-blue-50 dark:bg-blue-950/20 rounded-lg">
                <h4 className="text-sm font-medium text-blue-900 dark:text-blue-100">Updates</h4>
                <p className="text-xs text-blue-700 dark:text-blue-300 mt-1">
                  {outdatedDependencies} packages available
                </p>
              </div>
              <div className="p-3 bg-amber-50 dark:bg-amber-950/20 rounded-lg">
                <h4 className="text-sm font-medium text-amber-900 dark:text-amber-100">Outdated</h4>
                <p className="text-xs text-amber-700 dark:text-amber-300 mt-1">
                  {outdatedDependencies} major versions behind
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Dependencies</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-sm">Total</span>
                <span className="text-sm font-medium">{report?.totalDependencies || 0}</span>
              </div>
              <div className="text-xs text-muted-foreground">
                Direct and indirect
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Vulnerable</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-sm">Found</span>
                <span className="text-sm font-medium">{vulnerableDependencies}</span>
              </div>
              <div className="text-xs text-muted-foreground">
                Low severity only
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Licenses</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-sm">Compatible</span>
                <span className="text-sm font-medium">{Math.round(((report?.totalDependencies || 0) - (report?.licenseIssues || 0)) / (report?.totalDependencies || 1) * 100)}%</span>
              </div>
              <div className="text-xs text-muted-foreground">
                License compliance
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Risk Score</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-sm">Overall</span>
                <span className="text-sm font-medium">
                  {score >= 80 ? "Low" : score >= 60 ? "Medium" : "High"}
                </span>
              </div>
              <div className="text-xs text-muted-foreground">
                Based on vulnerability count
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
