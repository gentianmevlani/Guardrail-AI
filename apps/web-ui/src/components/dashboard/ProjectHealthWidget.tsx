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
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  CheckCircle,
  Clock,
  ExternalLink,
  GitBranch,
  RefreshCw,
  Shield,
  TrendingDown,
  TrendingUp,
  XCircle,
  Zap,
} from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";

// Types
interface ProjectHealth {
  id: string;
  name: string;
  fullName: string;
  realityScore: number;
  previousScore?: number;
  lastScan?: {
    timestamp: string;
    verdict: "SHIP" | "NO_SHIP" | "PENDING";
    duration: number;
  };
  issues: {
    critical: number;
    warning: number;
    info: number;
  };
  trend: "improving" | "declining" | "stable";
  isActive: boolean;
}

interface ProjectHealthWidgetProps {
  projects: ProjectHealth[];
  onRefresh?: () => Promise<void>;
  onProjectClick?: (project: ProjectHealth) => void;
  maxDisplay?: number;
  className?: string;
}

// Score colors
function getScoreColor(score: number): string {
  if (score >= 90) return "text-emerald-400";
  if (score >= 70) return "text-teal-400";
  if (score >= 50) return "text-yellow-400";
  if (score >= 30) return "text-orange-400";
  return "text-red-400";
}

function getScoreBgColor(score: number): string {
  if (score >= 90) return "bg-emerald-500";
  if (score >= 70) return "bg-teal-500";
  if (score >= 50) return "bg-yellow-500";
  if (score >= 30) return "bg-orange-500";
  return "bg-red-500";
}

function getScoreGradient(score: number): string {
  if (score >= 90) return "from-emerald-500/20 to-emerald-500/5";
  if (score >= 70) return "from-teal-500/20 to-teal-500/5";
  if (score >= 50) return "from-yellow-500/20 to-yellow-500/5";
  if (score >= 30) return "from-orange-500/20 to-orange-500/5";
  return "from-red-500/20 to-red-500/5";
}

// Time ago helper
function timeAgo(timestamp: string): string {
  const now = new Date();
  const then = new Date(timestamp);
  const diffMs = now.getTime() - then.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return then.toLocaleDateString();
}

// Individual Project Card
function ProjectCard({
  project,
  onClick,
}: {
  project: ProjectHealth;
  onClick?: () => void;
}) {
  const scoreDiff = project.previousScore
    ? project.realityScore - project.previousScore
    : 0;

  return (
    <div
      className={cn(
        "p-4 rounded-lg border cursor-pointer transition-all duration-200",
        "hover:border-teal-500/50 hover:shadow-lg hover:shadow-teal-500/10",
        "bg-gradient-to-br",
        getScoreGradient(project.realityScore)
      )}
      onClick={onClick}
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1 min-w-0">
          <h4 className="font-medium text-foreground truncate">{project.name}</h4>
          <p className="text-xs text-muted-foreground truncate">
            {project.fullName}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Reality Score */}
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <div
                  className={cn(
                    "text-2xl font-bold",
                    getScoreColor(project.realityScore)
                  )}
                >
                  {project.realityScore}
                </div>
              </TooltipTrigger>
              <TooltipContent>
                <p>Reality Score: {project.realityScore}/100</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>

          {/* Trend Indicator */}
          {scoreDiff !== 0 && (
            <div
              className={cn(
                "flex items-center text-xs",
                scoreDiff > 0 ? "text-emerald-400" : "text-red-400"
              )}
            >
              {scoreDiff > 0 ? (
                <TrendingUp className="w-3 h-3" />
              ) : (
                <TrendingDown className="w-3 h-3" />
              )}
              <span>{Math.abs(scoreDiff)}</span>
            </div>
          )}
        </div>
      </div>

      {/* Progress Bar */}
      <div className="mb-3">
        <Progress
          value={project.realityScore}
          className="h-1.5 bg-charcoal-800"
          indicatorClassName={getScoreBgColor(project.realityScore)}
        />
      </div>

      {/* Issues Summary */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3 text-xs">
          {project.issues.critical > 0 && (
            <span className="flex items-center gap-1 text-red-400">
              <XCircle className="w-3 h-3" />
              {project.issues.critical}
            </span>
          )}
          {project.issues.warning > 0 && (
            <span className="flex items-center gap-1 text-yellow-400">
              <AlertTriangle className="w-3 h-3" />
              {project.issues.warning}
            </span>
          )}
          {project.issues.critical === 0 && project.issues.warning === 0 && (
            <span className="flex items-center gap-1 text-emerald-400">
              <CheckCircle className="w-3 h-3" />
              Clean
            </span>
          )}
        </div>

        {/* Last Scan */}
        {project.lastScan && (
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <Clock className="w-3 h-3" />
            {timeAgo(project.lastScan.timestamp)}
          </div>
        )}
      </div>
    </div>
  );
}

// Aggregate Stats Component
function AggregateStats({ projects }: { projects: ProjectHealth[] }) {
  const stats = useMemo(() => {
    const avgScore =
      projects.length > 0
        ? Math.round(
            projects.reduce((sum, p) => sum + p.realityScore, 0) / projects.length
          )
        : 0;

    const totalCritical = projects.reduce((sum, p) => sum + p.issues.critical, 0);
    const totalWarnings = projects.reduce((sum, p) => sum + p.issues.warning, 0);
    const shipReady = projects.filter((p) => p.realityScore >= 70).length;
    const needsWork = projects.filter((p) => p.realityScore < 50).length;

    return {
      avgScore,
      totalCritical,
      totalWarnings,
      shipReady,
      needsWork,
      total: projects.length,
    };
  }, [projects]);

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
      <Card className="bg-card/50 border">
        <CardContent className="pt-3 pb-3">
          <div className="flex items-center gap-2">
            <Shield className={cn("w-4 h-4", getScoreColor(stats.avgScore))} />
            <div>
              <p className={cn("text-xl font-bold", getScoreColor(stats.avgScore))}>
                {stats.avgScore}
              </p>
              <p className="text-xs text-muted-foreground">Avg Score</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-card/50 border">
        <CardContent className="pt-3 pb-3">
          <div className="flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-emerald-400" />
            <div>
              <p className="text-xl font-bold text-emerald-400">
                {stats.shipReady}/{stats.total}
              </p>
              <p className="text-xs text-muted-foreground">Ship Ready</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-card/50 border">
        <CardContent className="pt-3 pb-3">
          <div className="flex items-center gap-2">
            <XCircle className="w-4 h-4 text-red-400" />
            <div>
              <p className="text-xl font-bold text-red-400">{stats.totalCritical}</p>
              <p className="text-xs text-muted-foreground">Critical</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-card/50 border">
        <CardContent className="pt-3 pb-3">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-yellow-400" />
            <div>
              <p className="text-xl font-bold text-yellow-400">
                {stats.totalWarnings}
              </p>
              <p className="text-xs text-muted-foreground">Warnings</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// Main Widget Component
export function ProjectHealthWidget({
  projects,
  onRefresh,
  onProjectClick,
  maxDisplay = 6,
  className,
}: ProjectHealthWidgetProps) {
  const [isRefreshing, setIsRefreshing] = useState(false);

  const sortedProjects = useMemo(() => {
    return [...projects]
      .sort((a, b) => {
        // Sort by: critical issues first, then by score ascending
        if (a.issues.critical !== b.issues.critical) {
          return b.issues.critical - a.issues.critical;
        }
        return a.realityScore - b.realityScore;
      })
      .slice(0, maxDisplay);
  }, [projects, maxDisplay]);

  const handleRefresh = async () => {
    if (!onRefresh) return;
    setIsRefreshing(true);
    try {
      await onRefresh();
    } finally {
      setIsRefreshing(false);
    }
  };

  return (
    <Card className={cn("bg-card/50 border", className)}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-teal-500/10">
              <Activity className="w-5 h-5 text-teal-400" />
            </div>
            <div>
              <CardTitle>Project Health</CardTitle>
              <CardDescription>
                Reality scores across your repositories
              </CardDescription>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {onRefresh && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleRefresh}
                disabled={isRefreshing}
              >
                <RefreshCw
                  className={cn("w-4 h-4", isRefreshing && "animate-spin")}
                />
              </Button>
            )}
            <Link href="/runs">
              <Button variant="outline" size="sm">
                View All
                <ArrowRight className="w-4 h-4 ml-1" />
              </Button>
            </Link>
          </div>
        </div>
      </CardHeader>

      <CardContent>
        {/* Aggregate Stats */}
        {projects.length > 0 && <AggregateStats projects={projects} />}

        {/* Project Grid */}
        {sortedProjects.length > 0 ? (
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {sortedProjects.map((project) => (
              <ProjectCard
                key={project.id}
                project={project}
                onClick={() => onProjectClick?.(project)}
              />
            ))}
          </div>
        ) : (
          <div className="text-center py-8">
            <GitBranch className="w-12 h-12 mx-auto text-muted-foreground mb-3" />
            <h3 className="text-lg font-medium text-foreground mb-2">
              No Projects Yet
            </h3>
            <p className="text-sm text-muted-foreground mb-4">
              Connect a repository to start monitoring project health
            </p>
            <Link href="/dashboard">
              <Button className="bg-teal-600 hover:bg-teal-700">
                <Zap className="w-4 h-4 mr-2" />
                Connect Repository
              </Button>
            </Link>
          </div>
        )}

        {/* Show More Link */}
        {projects.length > maxDisplay && (
          <div className="mt-4 text-center">
            <Link href="/runs">
              <Button variant="link" className="text-teal-400 hover:text-teal-300">
                View all {projects.length} projects
                <ExternalLink className="w-3 h-3 ml-1" />
              </Button>
            </Link>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default ProjectHealthWidget;
