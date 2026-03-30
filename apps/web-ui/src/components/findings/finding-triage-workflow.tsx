"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import {
  Ban,
  CheckCircle2,
  Eye,
  FileCode,
  MessageSquare,
  MoreHorizontal,
  XCircle,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Finding } from "@/lib/api";

interface FindingTriageWorkflowProps {
  finding: Finding;
  onStatusUpdate: (
    id: string,
    status: "open" | "fixed" | "suppressed" | "accepted_risk",
  ) => Promise<void>;
  onViewCode?: () => void;
  onCreateIssue?: () => void;
  onOpenPR?: () => void;
}

export function FindingTriageWorkflow({
  finding,
  onStatusUpdate,
  onViewCode,
  onCreateIssue,
  onOpenPR,
}: FindingTriageWorkflowProps) {
  const [updating, setUpdating] = useState(false);
  const [showTriageDialog, setShowTriageDialog] = useState(false);
  const [selectedAction, setSelectedAction] = useState<string | null>(null);

  const handleQuickAction = async (action: string) => {
    setUpdating(true);
    try {
      switch (action) {
        case "fix":
          await onStatusUpdate(finding.id, "fixed");
          break;
        case "suppress":
          await onStatusUpdate(finding.id, "suppressed");
          break;
        case "accept":
          await onStatusUpdate(finding.id, "accepted_risk");
          break;
      }
    } finally {
      setUpdating(false);
    }
  };

  const quickActions = [
    {
      id: "fix",
      label: "Mark as Fixed",
      icon: CheckCircle2,
      variant: "default" as const,
      onClick: () => handleQuickAction("fix"),
    },
    {
      id: "suppress",
      label: "Suppress",
      icon: XCircle,
      variant: "outline" as const,
      onClick: () => handleQuickAction("suppress"),
    },
    {
      id: "accept",
      label: "Accept Risk",
      icon: Ban,
      variant: "outline" as const,
      onClick: () => handleQuickAction("accept"),
    },
  ];

  return (
    <>
      <div className="flex items-center gap-2">
        {/* Quick Actions */}
        {finding.status === "open" && (
          <div className="flex items-center gap-1">
            {quickActions.map((action) => {
              const Icon = action.icon;
              return (
                <Button
                  key={action.id}
                  variant={action.variant}
                  size="sm"
                  onClick={action.onClick}
                  disabled={updating}
                  className="h-8"
                >
                  <Icon className="w-3 h-3 mr-1" />
                  {action.label}
                </Button>
              );
            })}
          </div>
        )}

        {/* More Actions Menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
              <MoreHorizontal className="w-4 h-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {onViewCode && (
              <DropdownMenuItem onClick={onViewCode}>
                <FileCode className="w-4 h-4 mr-2" />
                View in Code
              </DropdownMenuItem>
            )}
            {onCreateIssue && (
              <DropdownMenuItem onClick={onCreateIssue}>
                <MessageSquare className="w-4 h-4 mr-2" />
                Create Issue
              </DropdownMenuItem>
            )}
            {onOpenPR && (
              <DropdownMenuItem onClick={onOpenPR}>
                <Eye className="w-4 h-4 mr-2" />
                Open PR
              </DropdownMenuItem>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => setShowTriageDialog(true)}
            >
              <MoreHorizontal className="w-4 h-4 mr-2" />
              Advanced Triage
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Triage Dialog */}
      <Dialog open={showTriageDialog} onOpenChange={setShowTriageDialog}>
        <DialogContent className="bg-background border max-w-2xl">
          <DialogHeader>
            <DialogTitle>Triage Finding</DialogTitle>
            <DialogDescription>
              Review and manage this finding with detailed options
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Finding Details */}
            <Card className="bg-card border-border">
              <CardHeader>
                <CardTitle className="text-base">{finding.rule}</CardTitle>
                <CardDescription>{finding.message}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex items-center gap-2 text-sm">
                  <FileCode className="w-4 h-4 text-muted-foreground" />
                  <code className="text-xs bg-muted px-2 py-1 rounded">
                    {finding.file}:{finding.line}
                  </code>
                </div>
                <Badge
                  variant="outline"
                  className={
                    finding.severity === "critical"
                      ? "border-red-500/30 text-red-400"
                      : finding.severity === "high"
                      ? "border-orange-500/30 text-orange-400"
                      : ""
                  }
                >
                  {finding.severity}
                </Badge>
              </CardContent>
            </Card>

            {/* Action Buttons */}
            <div className="grid grid-cols-2 gap-3">
              {quickActions.map((action) => {
                const Icon = action.icon;
                return (
                  <Button
                    key={action.id}
                    variant={action.variant}
                    onClick={() => {
                      handleQuickAction(action.id);
                      setShowTriageDialog(false);
                    }}
                    disabled={updating}
                    className="justify-start"
                  >
                    <Icon className="w-4 h-4 mr-2" />
                    {action.label}
                  </Button>
                );
              })}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
