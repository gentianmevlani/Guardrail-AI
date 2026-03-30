"use client";

import { Badge } from "@/components/ui/badge";
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
  Clock,
  Shield,
  TrendingDown,
  TrendingUp,
  XCircle,
} from "lucide-react";

export type ComplianceStatus = "compliant" | "partial" | "non-compliant" | "pending";

export interface ComplianceStatusCardProps {
  frameworkId: string;
  frameworkName: string;
  score: number;
  status: ComplianceStatus;
  lastAssessment?: Date;
  nextAssessment?: Date;
  controlsTotal: number;
  controlsPassed: number;
  trend?: "up" | "down" | "stable";
  className?: string;
}

const STATUS_CONFIG: Record<
  ComplianceStatus,
  { icon: React.ElementType; color: string; bgColor: string; label: string }
> = {
  compliant: {
    icon: CheckCircle,
    color: "text-emerald-500",
    bgColor: "bg-emerald-500/10",
    label: "Compliant",
  },
  partial: {
    icon: AlertTriangle,
    color: "text-amber-500",
    bgColor: "bg-amber-500/10",
    label: "Partial",
  },
  "non-compliant": {
    icon: XCircle,
    color: "text-red-500",
    bgColor: "bg-red-500/10",
    label: "Non-Compliant",
  },
  pending: {
    icon: Clock,
    color: "text-gray-400",
    bgColor: "bg-gray-500/10",
    label: "Pending",
  },
};

export function ComplianceStatusCard({
  frameworkId,
  frameworkName,
  score,
  status,
  lastAssessment,
  nextAssessment,
  controlsTotal,
  controlsPassed,
  trend,
  className,
}: ComplianceStatusCardProps) {
  const config = STATUS_CONFIG[status];
  const StatusIcon = config.icon;

  const formatDate = (date: Date | undefined) => {
    if (!date) return "N/A";
    return new Date(date).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  return (
    <Card
      className={cn(
        "bg-card border-border hover:border-border/80 transition-all hover-lift",
        className
      )}
    >
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className={cn("p-2 rounded-lg", config.bgColor)}>
              <Shield className={cn("h-4 w-4", config.color)} />
            </div>
            <div>
              <CardTitle className="text-base font-semibold text-foreground">
                {frameworkName}
              </CardTitle>
              <CardDescription className="text-xs text-muted-foreground uppercase tracking-wide">
                {frameworkId}
              </CardDescription>
            </div>
          </div>
          <Badge
            className={cn(
              "border",
              status === "compliant" &&
                "bg-emerald-500/10 text-emerald-500 border-emerald-500/20",
              status === "partial" &&
                "bg-amber-500/10 text-amber-500 border-amber-500/20",
              status === "non-compliant" &&
                "bg-red-500/10 text-red-500 border-red-500/20",
              status === "pending" &&
                "bg-gray-500/10 text-gray-400 border-gray-500/20"
            )}
          >
            <StatusIcon className="h-3 w-3 mr-1" />
            {config.label}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-3xl font-bold text-foreground">{score}%</p>
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              {trend === "up" && (
                <>
                  <TrendingUp className="h-3 w-3 text-emerald-500" />
                  <span className="text-emerald-500">Improving</span>
                </>
              )}
              {trend === "down" && (
                <>
                  <TrendingDown className="h-3 w-3 text-red-500" />
                  <span className="text-red-500">Declining</span>
                </>
              )}
              {trend === "stable" && <span>Stable</span>}
            </div>
          </div>
          <div className="text-right space-y-1">
            <p className="text-sm text-muted-foreground">Controls</p>
            <p className="text-lg font-semibold text-foreground">
              {controlsPassed}/{controlsTotal}
            </p>
          </div>
        </div>

        <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
          <div
            className={cn(
              "h-full transition-all duration-500",
              score >= 90 && "bg-emerald-500",
              score >= 70 && score < 90 && "bg-amber-500",
              score < 70 && "bg-red-500"
            )}
            style={{ width: `${score}%` }}
          />
        </div>

        <div className="grid grid-cols-2 gap-4 pt-2 border-t border-border">
          <div>
            <p className="text-xs text-muted-foreground">Last Assessment</p>
            <p className="text-sm font-medium text-foreground">
              {formatDate(lastAssessment)}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Next Assessment</p>
            <p className="text-sm font-medium text-foreground">
              {formatDate(nextAssessment)}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
