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
import { cn } from "@/lib/utils";
import {
  AlertTriangle,
  CheckCircle,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  Shield,
  XCircle,
} from "lucide-react";
import { useState } from "react";

export interface ControlStatus {
  controlId: string;
  title: string;
  category: string;
  status: "compliant" | "partial" | "non-compliant" | "not-assessed";
  score: number;
  findings: string[];
  gaps: string[];
}

export interface FrameworkCoverage {
  frameworkId: string;
  frameworkName: string;
  version: string;
  controls: ControlStatus[];
  summary: {
    total: number;
    compliant: number;
    partial: number;
    nonCompliant: number;
    notAssessed: number;
  };
}

interface FrameworkCoverageTableProps {
  frameworks: FrameworkCoverage[];
  onViewDetails?: (frameworkId: string, controlId: string) => void;
  className?: string;
}

const FRAMEWORK_ICONS: Record<string, string> = {
  soc2: "SOC 2",
  hipaa: "HIPAA",
  gdpr: "GDPR",
  pci: "PCI DSS",
  nist: "NIST",
  iso27001: "ISO 27001",
};

const STATUS_CONFIG = {
  compliant: {
    icon: CheckCircle,
    color: "text-emerald-500",
    bg: "bg-emerald-500/10",
  },
  partial: {
    icon: AlertTriangle,
    color: "text-amber-500",
    bg: "bg-amber-500/10",
  },
  "non-compliant": {
    icon: XCircle,
    color: "text-red-500",
    bg: "bg-red-500/10",
  },
  "not-assessed": {
    icon: Shield,
    color: "text-gray-400",
    bg: "bg-gray-500/10",
  },
};

export function FrameworkCoverageTable({
  frameworks,
  onViewDetails,
  className,
}: FrameworkCoverageTableProps) {
  const [expandedFrameworks, setExpandedFrameworks] = useState<Set<string>>(
    new Set()
  );
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(
    new Set()
  );

  const toggleFramework = (frameworkId: string) => {
    setExpandedFrameworks((prev) => {
      const next = new Set(prev);
      if (next.has(frameworkId)) {
        next.delete(frameworkId);
      } else {
        next.add(frameworkId);
      }
      return next;
    });
  };

  const toggleCategory = (key: string) => {
    setExpandedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  const groupControlsByCategory = (controls: ControlStatus[]) => {
    return controls.reduce(
      (acc, control) => {
        const category = control.category || "Uncategorized";
        if (!acc[category]) {
          acc[category] = [];
        }
        acc[category].push(control);
        return acc;
      },
      {} as Record<string, ControlStatus[]>
    );
  };

  return (
    <Card className={cn("bg-card border-border", className)}>
      <CardHeader>
        <CardTitle className="text-foreground flex items-center gap-2">
          <Shield className="h-5 w-5 text-teal-400" />
          Framework Coverage
        </CardTitle>
        <CardDescription className="text-muted-foreground">
          Detailed control status across all compliance frameworks
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {frameworks.map((framework) => {
            const isExpanded = expandedFrameworks.has(framework.frameworkId);
            const groupedControls = groupControlsByCategory(framework.controls);
            const overallScore = Math.round(
              (framework.summary.compliant / framework.summary.total) * 100
            );

            return (
              <div
                key={framework.frameworkId}
                className="border border-border rounded-lg overflow-hidden"
              >
                <button
                  onClick={() => toggleFramework(framework.frameworkId)}
                  className="w-full px-4 py-3 flex items-center justify-between bg-muted/30 hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    {isExpanded ? (
                      <ChevronDown className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    )}
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-foreground">
                        {FRAMEWORK_ICONS[framework.frameworkId] ||
                          framework.frameworkName}
                      </span>
                      <Badge
                        variant="outline"
                        className="text-xs text-muted-foreground"
                      >
                        v{framework.version}
                      </Badge>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2 text-sm">
                      <span className="text-emerald-500">
                        {framework.summary.compliant}
                      </span>
                      <span className="text-muted-foreground">/</span>
                      <span className="text-amber-500">
                        {framework.summary.partial}
                      </span>
                      <span className="text-muted-foreground">/</span>
                      <span className="text-red-500">
                        {framework.summary.nonCompliant}
                      </span>
                    </div>
                    <div className="w-24 h-2 bg-muted rounded-full overflow-hidden">
                      <div
                        className={cn(
                          "h-full",
                          overallScore >= 90 && "bg-emerald-500",
                          overallScore >= 70 &&
                            overallScore < 90 &&
                            "bg-amber-500",
                          overallScore < 70 && "bg-red-500"
                        )}
                        style={{ width: `${overallScore}%` }}
                      />
                    </div>
                    <span className="text-sm font-medium text-foreground w-12 text-right">
                      {overallScore}%
                    </span>
                  </div>
                </button>

                {isExpanded && (
                  <div className="border-t border-border">
                    {Object.entries(groupedControls).map(
                      ([category, controls]) => {
                        const categoryKey = `${framework.frameworkId}-${category}`;
                        const isCategoryExpanded =
                          expandedCategories.has(categoryKey);
                        const categoryCompliant = controls.filter(
                          (c) => c.status === "compliant"
                        ).length;

                        return (
                          <div key={categoryKey}>
                            <button
                              onClick={() => toggleCategory(categoryKey)}
                              className="w-full px-6 py-2 flex items-center justify-between bg-card hover:bg-muted/20 transition-colors border-b border-border"
                            >
                              <div className="flex items-center gap-2">
                                {isCategoryExpanded ? (
                                  <ChevronDown className="h-3 w-3 text-muted-foreground" />
                                ) : (
                                  <ChevronRight className="h-3 w-3 text-muted-foreground" />
                                )}
                                <span className="text-sm font-medium text-foreground capitalize">
                                  {category.replace(/-/g, " ")}
                                </span>
                              </div>
                              <span className="text-xs text-muted-foreground">
                                {categoryCompliant}/{controls.length} compliant
                              </span>
                            </button>

                            {isCategoryExpanded && (
                              <div className="bg-card">
                                {controls.map((control) => {
                                  const statusConfig =
                                    STATUS_CONFIG[control.status];
                                  const StatusIcon = statusConfig.icon;

                                  return (
                                    <div
                                      key={control.controlId}
                                      className="px-8 py-3 flex items-center justify-between border-b border-border last:border-b-0 hover:bg-muted/10 transition-colors"
                                    >
                                      <div className="flex items-center gap-3 flex-1">
                                        <div
                                          className={cn(
                                            "p-1 rounded",
                                            statusConfig.bg
                                          )}
                                        >
                                          <StatusIcon
                                            className={cn(
                                              "h-3 w-3",
                                              statusConfig.color
                                            )}
                                          />
                                        </div>
                                        <div>
                                          <p className="text-sm font-medium text-foreground">
                                            {control.controlId}
                                          </p>
                                          <p className="text-xs text-muted-foreground line-clamp-1">
                                            {control.title}
                                          </p>
                                        </div>
                                      </div>
                                      <div className="flex items-center gap-4">
                                        <div className="w-16 h-1.5 bg-muted rounded-full overflow-hidden">
                                          <div
                                            className={cn(
                                              "h-full",
                                              control.score >= 90 &&
                                                "bg-emerald-500",
                                              control.score >= 70 &&
                                                control.score < 90 &&
                                                "bg-amber-500",
                                              control.score < 70 && "bg-red-500"
                                            )}
                                            style={{
                                              width: `${control.score}%`,
                                            }}
                                          />
                                        </div>
                                        <span className="text-xs text-muted-foreground w-10 text-right">
                                          {control.score}%
                                        </span>
                                        {onViewDetails && (
                                          <Button
                                            variant="ghost"
                                            size="sm"
                                            className="h-6 w-6 p-0"
                                            onClick={() =>
                                              onViewDetails(
                                                framework.frameworkId,
                                                control.controlId
                                              )
                                            }
                                          >
                                            <ExternalLink className="h-3 w-3" />
                                          </Button>
                                        )}
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        );
                      }
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
