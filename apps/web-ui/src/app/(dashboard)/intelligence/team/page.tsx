"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { fetchActivities, fetchRecentActivity, type Activity, type ActivityEvent } from "@/lib/api";
import { logger } from "@/lib/logger";
import { AlertTriangle, CheckCircle, GitBranch, MessageSquare, Play, RefreshCw, UserPlus, Users } from "lucide-react";
import { useEffect, useState } from "react";

export default function TeamPage() {
  const [isRunning, setIsRunning] = useState(false);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [recentActivity, setRecentActivity] = useState<ActivityEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load real data on component mount
  useEffect(() => {
    loadTeamData();
  }, []);

  const loadTeamData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Fetch real team activity data
      const [activitiesResponse, recentResponse] = await Promise.all([
        fetchActivities(10),
        fetchRecentActivity(10)
      ]);
      
      if (activitiesResponse) {
        setActivities(activitiesResponse);
      }
      
      if (recentResponse) {
        setRecentActivity(recentResponse);
      }
    } catch (err) {
      logger.logUnknownError("Failed to load team data", err);
      setError("Failed to load team data");
    } finally {
      setLoading(false);
    }
  };

  const handleRunAnalysis = async () => {
    setIsRunning(true);
    try {
      await loadTeamData();
    } catch (err) {
      logger.logUnknownError("Failed to run team analysis", err);
      setError("Failed to run team analysis");
    } finally {
      setIsRunning(false);
    }
  };

  // Calculate score from real data
  const score = activities.length > 0 ? Math.min(100, Math.round((activities.filter(a => a.type === "info").length / activities.length) * 100)) : 0;
  const commitsThisWeek = recentActivity.filter(a => a.action === "commit").length;
  const pullRequests = recentActivity.filter(a => a.action === "pull_request").length;

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Team Analysis</h1>
            <p className="text-muted-foreground">
              Loading team data...
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
            <h1 className="text-3xl font-bold">Team Analysis</h1>
            <p className="text-muted-foreground">Error loading data</p>
          </div>
        </div>
        <Card>
          <CardContent className="pt-6">
            <div className="text-center text-red-500">
              <AlertTriangle className="h-8 w-8 mx-auto mb-2" />
              <p>{error}</p>
              <Button onClick={loadTeamData} className="mt-4">
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
          <h1 className="text-3xl font-bold">Team Analysis</h1>
          <p className="text-muted-foreground">
            Team collaboration patterns and development workflow insights
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
              <Users className="h-5 w-5" />
              Team Collaboration Score
            </CardTitle>
            <CardDescription>
              Overall team effectiveness and collaboration quality
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Team Score</span>
                <Badge variant={score >= 80 ? "default" : score >= 60 ? "secondary" : "destructive"}>
                  {score}/100
                </Badge>
              </div>
              <Progress value={score} className="h-2" />
              
              <div className="grid grid-cols-2 gap-4 mt-6">
                <div className="space-y-2">
                  <h4 className="text-sm font-medium">Collaboration</h4>
                  <div className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-500" />
                    <span className="text-sm">Excellent</span>
                  </div>
                </div>
                <div className="space-y-2">
                  <h4 className="text-sm font-medium">Code Quality</h4>
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-yellow-500" />
                    <span className="text-sm">Good</span>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UserPlus className="h-5 w-5" />
              Team Metrics
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="p-3 bg-green-50 dark:bg-green-950/20 rounded-lg">
                <h4 className="text-sm font-medium text-green-900 dark:text-green-100">Active Members</h4>
                <p className="text-xs text-green-700 dark:text-green-300 mt-1">
                  {activities.length} developers active
                </p>
              </div>
              <div className="p-3 bg-blue-50 dark:bg-blue-950/20 rounded-lg">
                <h4 className="text-sm font-medium text-blue-900 dark:text-blue-100">Contributions</h4>
                <p className="text-xs text-blue-700 dark:text-blue-300 mt-1">
                  {commitsThisWeek} commits this week
                </p>
              </div>
              <div className="p-3 bg-amber-50 dark:bg-amber-950/20 rounded-lg">
                <h4 className="text-sm font-medium text-amber-900 dark:text-amber-100">PR Rate</h4>
                <p className="text-xs text-amber-700 dark:text-amber-300 mt-1">
                  {pullRequests > 0 ? Math.round((recentActivity.filter(a => a.action === "pull_request" && a.severity === "success").length / pullRequests) * 100) : 0}% merge rate
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Commits</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-sm">This Week</span>
                <span className="text-sm font-medium">{commitsThisWeek}</span>
              </div>
              <div className="text-xs text-muted-foreground">
                Based on recent activity
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Pull Requests</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-sm">Open</span>
                <span className="text-sm font-medium">{pullRequests}</span>
              </div>
              <div className="text-xs text-muted-foreground">
                {recentActivity.filter(a => a.action === "pull_request").length} total
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Reviews</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-sm">Completed</span>
                <span className="text-sm font-medium">{activities.filter(a => a.type === "scan").length}</span>
              </div>
              <div className="text-xs text-muted-foreground">
                Team collaboration
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Issues</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-sm">Open</span>
                <span className="text-sm font-medium">{activities.filter(a => a.type === "alert").length}</span>
              </div>
              <div className="text-xs text-muted-foreground">
                Active issues
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5" />
              Communication
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm">Code Comments</span>
                <div className="flex items-center gap-2">
                  <div className="w-16 bg-muted rounded-full h-2">
                    <div className="bg-green-500 h-2 rounded-full" style={{ width: "78%" }}></div>
                  </div>
                  <span className="text-sm font-medium">78%</span>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">PR Discussions</span>
                <div className="flex items-center gap-2">
                  <div className="w-16 bg-muted rounded-full h-2">
                    <div className="bg-blue-500 h-2 rounded-full" style={{ width: "92%" }}></div>
                  </div>
                  <span className="text-sm font-medium">92%</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <GitBranch className="h-5 w-5" />
              Branch Management
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm">Active Branches</span>
                <span className="text-sm font-medium">{activities.filter(a => a.type === "scan").length}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">Merged PRs</span>
                <span className="text-sm font-medium">{activities.filter(a => a.type === "scan").length}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">Conflicts</span>
                <span className="text-sm font-medium">{activities.filter(a => a.type === "alert").length}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
