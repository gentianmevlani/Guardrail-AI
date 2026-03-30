"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { InlineLoader, SectionLoader } from "@/components/ui/loaders";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  CreditCard,
  Database,
  FileText,
  Lock,
  Minus,
  RefreshCw,
  Rocket,
  Shield,
  TrendingDown,
  TrendingUp,
  XCircle,
  Zap,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

interface HealthCategory {
  id: string;
  name: string;
  icon: React.ReactNode;
  score: number;
  status: "pass" | "warn" | "fail";
  issues: number;
  description: string;
}

interface HealthScoreCardProps {
  score?: number;
  previousScore?: number;
  lastScan?: string;
  categories?: HealthCategory[];
  onRefresh?: () => void;
  loading?: boolean;
}

export function HealthScoreCard({
  score = 75,
  previousScore = 70,
  lastScan,
  categories,
  onRefresh,
  loading = false,
}: HealthScoreCardProps) {
  const [animatedScore, setAnimatedScore] = useState(0);

  // Animate score on mount
  useEffect(() => {
    const timer = setTimeout(() => {
      setAnimatedScore(score);
    }, 100);
    return () => clearTimeout(timer);
  }, [score]);

  // Get traffic light color and emoji
  const getTrafficLight = (s: number) => {
    if (s >= 80)
      return { color: "emerald", emoji: "🟢", label: "Ready to Ship" };
    if (s >= 50) return { color: "amber", emoji: "🟡", label: "Almost Ready" };
    return { color: "red", emoji: "🔴", label: "Not Ready" };
  };

  const traffic = getTrafficLight(score);
  const trend =
    score > previousScore ? "up" : score < previousScore ? "down" : "stable";

  // Default categories if none provided
  const defaultCategories: HealthCategory[] = [
    {
      id: "security",
      name: "Security",
      icon: <Shield className="w-4 h-4" />,
      score: 85,
      status: "pass",
      issues: 0,
      description: "No exposed secrets",
    },
    {
      id: "auth",
      name: "Auth",
      icon: <Lock className="w-4 h-4" />,
      score: 70,
      status: "warn",
      issues: 2,
      description: "2 unprotected routes",
    },
    {
      id: "data",
      name: "Data",
      icon: <Database className="w-4 h-4" />,
      score: 90,
      status: "pass",
      issues: 0,
      description: "Database connected",
    },
    {
      id: "payments",
      name: "Payments",
      icon: <CreditCard className="w-4 h-4" />,
      score: 60,
      status: "warn",
      issues: 1,
      description: "Test mode active",
    },
    {
      id: "legal",
      name: "Legal",
      icon: <FileText className="w-4 h-4" />,
      score: 40,
      status: "fail",
      issues: 2,
      description: "Missing privacy policy",
    },
  ];

  const displayCategories = categories || defaultCategories;

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "pass":
        return <CheckCircle2 className="w-4 h-4 text-success" />;
      case "warn":
        return <AlertTriangle className="w-4 h-4 text-warning" />;
      case "fail":
        return <XCircle className="w-4 h-4 text-destructive" />;
      default:
        return null;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "pass":
        return "bg-success/20 border-success/30";
      case "warn":
        return "bg-warning/20 border-warning/30";
      case "fail":
        return "bg-destructive/20 border-destructive/30";
      default:
        return "bg-muted border-border";
    }
  };

  // Show loader when loading
  if (loading) {
    return (
      <Card className="dashboard-card glass-card scanning">
        <SectionLoader size="lg" message="Analyzing health score..." />
      </Card>
    );
  }

  return (
    <Card className="dashboard-card glass-card overflow-hidden hover-lift">
      {/* Traffic Light Header */}
      <div
        className={`px-6 py-4 bg-gradient-to-r ${
          traffic.color === "emerald"
            ? "from-emerald-950/50 to-emerald-900/30"
            : traffic.color === "amber"
              ? "from-amber-950/50 to-amber-900/30"
              : "from-red-950/50 to-red-900/30"
        }`}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            {/* Large Traffic Light */}
            <div
              className={`traffic-light ${
                traffic.color === "emerald"
                  ? "traffic-light-green"
                  : traffic.color === "amber"
                    ? "traffic-light-yellow"
                    : "traffic-light-red"
              }`}
            >
              {traffic.emoji}
            </div>

            <div>
              <div className="flex items-baseline gap-2">
                <span
                  className={`score-value ${
                    traffic.color === "emerald"
                      ? "score-value-green text-glow-teal"
                      : traffic.color === "amber"
                        ? "score-value-yellow"
                        : "score-value-red"
                  }`}
                >
                  {animatedScore}
                </span>
                <span className="text-muted-foreground text-xl">/100</span>
              </div>
              <p
                className={`text-lg font-medium ${
                  traffic.color === "emerald"
                    ? "text-emerald-400"
                    : traffic.color === "amber"
                      ? "text-amber-400"
                      : "text-red-400"
                }`}
              >
                {traffic.label}
              </p>
            </div>
          </div>

          <div className="text-right">
            {/* Trend Indicator */}
            <div className="flex items-center gap-1 justify-end mb-2">
              {trend === "up" && (
                <>
                  <TrendingUp className="w-4 h-4 text-success" />
                  <span className="text-success text-sm">
                    +{score - previousScore} from last scan
                  </span>
                </>
              )}
              {trend === "down" && (
                <>
                  <TrendingDown className="w-4 h-4 text-destructive" />
                  <span className="text-destructive text-sm">
                    {score - previousScore} from last scan
                  </span>
                </>
              )}
              {trend === "stable" && (
                <>
                  <Minus className="w-4 h-4 text-muted-foreground" />
                  <span className="text-muted-foreground text-sm">
                    No change
                  </span>
                </>
              )}
            </div>

            {lastScan && (
              <p className="text-xs text-muted-foreground">
                Last scan: {new Date(lastScan).toLocaleDateString()}
              </p>
            )}
          </div>
        </div>
      </div>

      <CardContent className="dashboard-card-content space-y-4">
        {/* Quick Actions */}
        <div className="flex gap-2">
          <Link href="/ship" className="flex-1">
            <Button
              className={`w-full transition-smooth ${
                traffic.color === "emerald"
                  ? "btn-teal"
                  : "bg-teal-600 hover:bg-teal-700"
              }`}
            >
              {traffic.color === "emerald" ? (
                <>
                  <Rocket className="w-4 h-4 mr-2" />
                  Ship It!
                </>
              ) : (
                <>
                  <Zap className="w-4 h-4 mr-2" />
                  Fix Issues
                </>
              )}
            </Button>
          </Link>
          <Button
            variant="outline"
            className="border-border/50 hover:border-teal-500/30 transition-smooth"
            onClick={onRefresh}
            disabled={loading}
          >
            {loading ? (
              <InlineLoader size="sm" variant="spinner" />
            ) : (
              <RefreshCw className="w-4 h-4" />
            )}
          </Button>
        </div>

        {/* Category Breakdown */}
        <div className="space-y-3">
          <h4 className="text-sm font-medium text-muted-foreground">
            Health Breakdown
          </h4>

          {displayCategories.map((cat) => (
            <div
              key={cat.id}
              className={`p-3 rounded-lg border ${getStatusColor(cat.status)} transition-smooth hover-lift-sm cursor-pointer`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {getStatusIcon(cat.status)}
                  <div className="flex items-center gap-2">
                    {cat.icon}
                    <span className="text-foreground font-medium">
                      {cat.name}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {cat.issues > 0 && (
                    <Badge
                      variant="outline"
                      className={`text-xs ${
                        cat.status === "fail"
                          ? "border-destructive/50 text-destructive"
                          : cat.status === "warn"
                            ? "border-warning/50 text-warning"
                            : "border-border text-muted-foreground"
                      }`}
                    >
                      {cat.issues} issue{cat.issues > 1 ? "s" : ""}
                    </Badge>
                  )}
                  <ChevronRight className="w-4 h-4 text-muted-foreground" />
                </div>
              </div>
              <p className="text-xs text-muted-foreground mt-1 ml-7">
                {cat.description}
              </p>
            </div>
          ))}
        </div>

        {/* Plain English Summary */}
        <div className="p-4 rounded-lg glass border-border/30">
          <h4 className="text-sm font-medium text-foreground/90 mb-2">
            What This Means
          </h4>
          {traffic.color === "emerald" ? (
            <p className="text-sm text-muted-foreground">
              Your app looks solid! All critical checks passed. You can deploy
              with confidence.
            </p>
          ) : traffic.color === "amber" ? (
            <p className="text-sm text-muted-foreground">
              A few things need attention before you ship. Nothing critical, but
              worth reviewing.
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">
              Critical issues found that could break your app in production. Fix
              these before deploying.
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
