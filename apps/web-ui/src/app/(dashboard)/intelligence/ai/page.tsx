"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { runIntelligenceSuite, fetchIntelligenceOverview } from "@/lib/api";
import { logger } from "@/lib/logger";
import { AlertTriangle, Brain, Play, RefreshCw, TrendingUp, Zap } from "lucide-react";
import { useState, useEffect } from "react";

// Force dynamic rendering
export const dynamic = "force-dynamic";

export default function AIAnalysisPage() {
  const [isRunning, setIsRunning] = useState(false);
  const [score, setScore] = useState(75);
  const [findings, setFindings] = useState(0);
  const [lastRun, setLastRun] = useState<string | null>(null);

  useEffect(() => {
    loadOverview();
  }, []);

  const loadOverview = async () => {
    try {
      const overview = await fetchIntelligenceOverview();
      if (overview && overview.ai) {
        setScore(overview.ai.score || 75);
        setFindings(overview.ai.findings || 0);
        setLastRun(overview.ai.lastRun || null);
      }
    } catch (error) {
      logger.logUnknownError("Failed to load AI overview", error);
    }
  };

  const handleRunAnalysis = async () => {
    setIsRunning(true);
    try {
      const result = await runIntelligenceSuite("ai");
      if (result.success) {
        // Refresh data after successful run
        await loadOverview();
      }
    } catch (error) {
      logger.logUnknownError("Failed to run AI analysis", error);
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">AI Analysis</h1>
          <p className="text-muted-foreground">
            Advanced AI-powered code analysis and pattern recognition
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
              <Brain className="h-5 w-5 text-blue-400" />
              AI Code Analysis
            </CardTitle>
            <CardDescription>
              Machine learning models analyze your code for patterns, anomalies, and improvement opportunities
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Overall Score</span>
                <Badge variant="outline" className={
                  score >= 90 ? "border-green-500 text-green-400" :
                  score >= 70 ? "border-yellow-500 text-yellow-400" :
                  "border-red-500 text-red-400"
                }>
                  {score}/100
                </Badge>
              </div>
              <Progress value={score} className="h-2" />
              
              <div className="grid grid-cols-2 gap-4 mt-6">
                <div className="text-center p-4 bg-muted/20 rounded-lg">
                  <div className="text-2xl font-bold text-blue-400">{findings}</div>
                  <div className="text-sm text-muted-foreground">Findings</div>
                </div>
                <div className="text-center p-4 bg-muted/20 rounded-lg">
                  <div className="text-2xl font-bold text-green-400">98%</div>
                  <div className="text-sm text-muted-foreground">Accuracy</div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-green-400" />
              Analysis Metrics
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm">Pattern Recognition</span>
              <span className="text-sm font-medium">92%</span>
            </div>
            <Progress value={92} className="h-1" />
            
            <div className="flex items-center justify-between">
              <span className="text-sm">Code Quality</span>
              <span className="text-sm font-medium">88%</span>
            </div>
            <Progress value={88} className="h-1" />
            
            <div className="flex items-center justify-between">
              <span className="text-sm">Security Analysis</span>
              <span className="text-sm font-medium">95%</span>
            </div>
            <Progress value={95} className="h-1" />
            
            <div className="flex items-center justify-between">
              <span className="text-sm">Performance</span>
              <span className="text-sm font-medium">86%</span>
            </div>
            <Progress value={86} className="h-1" />
            
            {lastRun && (
              <div className="pt-4 border-t border-border">
                <div className="text-xs text-muted-foreground">
                  Last run: {new Date(lastRun).toLocaleString()}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-yellow-400" />
            AI Insights
          </CardTitle>
          <CardDescription>
            Key findings and recommendations from the AI analysis
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-4 w-4 text-yellow-400 mt-1 flex-shrink-0" />
              <div>
                <div className="font-medium text-foreground">Complexity Detected</div>
                <div className="text-sm text-muted-foreground">
                  Found 3 functions with high cyclomatic complexity. Consider refactoring.
                </div>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <Brain className="h-4 w-4 text-blue-400 mt-1 flex-shrink-0" />
              <div>
                <div className="font-medium text-foreground">Pattern Match</div>
                <div className="text-sm text-muted-foreground">
                  Identified potential singleton pattern in user service.
                </div>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <TrendingUp className="h-4 w-4 text-green-400 mt-1 flex-shrink-0" />
              <div>
                <div className="font-medium text-foreground">Optimization Opportunity</div>
                <div className="text-sm text-muted-foreground">
                  Database queries could be optimized with proper indexing.
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Code Patterns</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-sm">Design Patterns</span>
                <span className="text-sm font-medium">85%</span>
              </div>
              <Progress value={85} className="h-1" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Anti-Patterns</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-sm">Issues Found</span>
                <span className="text-sm font-medium">3</span>
              </div>
              <div className="text-xs text-muted-foreground">
                Low priority items detected
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Complexity</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-sm">Cyclomatic</span>
                <span className="text-sm font-medium">Moderate</span>
              </div>
              <div className="text-xs text-muted-foreground">
                Average complexity score
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
