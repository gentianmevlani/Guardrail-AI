"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Activity, AlertTriangle, CheckCircle, LineChart, Play, RefreshCw, Target, TrendingDown, TrendingUp } from "lucide-react";
import { useState } from "react";

export default function PredictivePage() {
  const [isRunning, setIsRunning] = useState(false);
  const [score, setScore] = useState(91);

  const handleRunAnalysis = () => {
    setIsRunning(true);
    setTimeout(() => {
      setIsRunning(false);
      setScore(Math.floor(Math.random() * 20) + 80);
    }, 4000);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Predictive Analysis</h1>
          <p className="text-muted-foreground">
            AI-powered predictions and trend analysis for project outcomes
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
              <LineChart className="h-5 w-5" />
              Predictive Score
            </CardTitle>
            <CardDescription>
              AI-powered prediction accuracy and trend analysis
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Prediction Accuracy</span>
                <Badge variant={score >= 80 ? "default" : score >= 60 ? "secondary" : "destructive"}>
                  {score}%
                </Badge>
              </div>
              <Progress value={score} className="h-2" />
              
              <div className="grid grid-cols-2 gap-4 mt-6">
                <div className="space-y-2">
                  <h4 className="text-sm font-medium">Trend Analysis</h4>
                  <div className="flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-green-500" />
                    <span className="text-sm">Positive</span>
                  </div>
                </div>
                <div className="space-y-2">
                  <h4 className="text-sm font-medium">Risk Level</h4>
                  <div className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-500" />
                    <span className="text-sm">Low</span>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Target className="h-5 w-5" />
              Predictions
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="p-3 bg-green-50 dark:bg-green-950/20 rounded-lg">
                <h4 className="text-sm font-medium text-green-900 dark:text-green-100">Delivery</h4>
                <p className="text-xs text-green-700 dark:text-green-300 mt-1">
                  On-time: 94% confidence
                </p>
              </div>
              <div className="p-3 bg-blue-50 dark:bg-blue-950/20 rounded-lg">
                <h4 className="text-sm font-medium text-blue-900 dark:text-blue-100">Quality</h4>
                <p className="text-xs text-blue-700 dark:text-blue-300 mt-1">
                  High quality: 87% confidence
                </p>
              </div>
              <div className="p-3 bg-amber-50 dark:bg-amber-950/20 rounded-lg">
                <h4 className="text-sm font-medium text-amber-900 dark:text-amber-100">Resources</h4>
                <p className="text-xs text-amber-700 dark:text-amber-300 mt-1">
                  Within budget: 78% confidence
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Timeline</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-sm">Estimated</span>
                <span className="text-sm font-medium">6 weeks</span>
              </div>
              <div className="text-xs text-muted-foreground">
                ±1 week accuracy
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Budget</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-sm">Forecast</span>
                <span className="text-sm font-medium">$45k</span>
              </div>
              <div className="text-xs text-muted-foreground">
                ±$5k variance
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Quality</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-sm">Predicted</span>
                <span className="text-sm font-medium">A+</span>
              </div>
              <div className="text-xs text-muted-foreground">
                87% confidence
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Risk</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-sm">Level</span>
                <span className="text-sm font-medium">Low</span>
              </div>
              <div className="text-xs text-muted-foreground">
                12% risk factors
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5" />
              Trend Analysis
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm">Code Quality</span>
                <div className="flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-green-500" />
                  <span className="text-sm font-medium">+15%</span>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">Team Velocity</span>
                <div className="flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-green-500" />
                  <span className="text-sm font-medium">+8%</span>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">Bug Rate</span>
                <div className="flex items-center gap-2">
                  <TrendingDown className="h-4 w-4 text-green-500" />
                  <span className="text-sm font-medium">-22%</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5" />
              Risk Factors
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="p-2 rounded bg-muted/50">
                <div className="flex items-center justify-between">
                  <span className="text-sm">Technical Debt</span>
                  <Badge variant="secondary">Medium</Badge>
                </div>
              </div>
              <div className="p-2 rounded bg-muted/50">
                <div className="flex items-center justify-between">
                  <span className="text-sm">Team Size</span>
                  <Badge variant="default">Low</Badge>
                </div>
              </div>
              <div className="p-2 rounded bg-muted/50">
                <div className="flex items-center justify-between">
                  <span className="text-sm">Timeline</span>
                  <Badge variant="secondary">Medium</Badge>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
