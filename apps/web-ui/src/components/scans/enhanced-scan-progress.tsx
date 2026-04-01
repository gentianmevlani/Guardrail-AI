"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import {
  CheckCircle2,
  Clock,
  FileCode,
  Loader2,
  Shield,
  AlertTriangle,
} from "lucide-react";
import { useRealtimeScan } from "@/hooks/useRealtimeScan";

interface EnhancedScanProgressProps {
  scanId: string;
  onComplete?: () => void;
}

interface ScanStep {
  id: string;
  label: string;
  status: "pending" | "active" | "completed" | "error";
  progress: number;
}

export function EnhancedScanProgress({
  scanId,
  onComplete,
}: EnhancedScanProgressProps) {
  const [steps, setSteps] = useState<ScanStep[]>([
    { id: "init", label: "Initializing scan environment", status: "pending", progress: 0 },
    { id: "security", label: "Scanning security patterns", status: "pending", progress: 0 },
    { id: "mocks", label: "Checking for mock data", status: "pending", progress: 0 },
    { id: "endpoints", label: "Validating API endpoints", status: "pending", progress: 0 },
    { id: "structure", label: "Analyzing code structure", status: "pending", progress: 0 },
    { id: "issues", label: "Detecting potential issues", status: "pending", progress: 0 },
    { id: "processing", label: "Processing findings", status: "pending", progress: 0 },
    { id: "report", label: "Generating report", status: "pending", progress: 0 },
  ]);

  const { status, progress, logs } = useRealtimeScan({
    runId: scanId,
    scanId,
    onStatusChange: (newStatus) => {
      if (newStatus === "complete") {
        // Mark all steps as completed
        setSteps((prev) =>
          prev.map((step) => ({ ...step, status: "completed" as const }))
        );
        onComplete?.();
      } else if (newStatus === "error") {
        // Mark current step as error
        setSteps((prev) =>
          prev.map((step) =>
            step.status === "active" ? { ...step, status: "error" as const } : step
          )
        );
      }
    },
    onProgress: (newProgress) => {
      // Map progress to steps
      const stepIndex = Math.floor((newProgress / 100) * steps.length);
      setSteps((prev) =>
        prev.map((step, index) => {
          if (index < stepIndex) {
            return { ...step, status: "completed" as const, progress: 100 };
          } else if (index === stepIndex) {
            return {
              ...step,
              status: "active" as const,
              progress: ((newProgress % (100 / prev.length)) / (100 / prev.length)) * 100,
            };
          }
          return step;
        })
      );
    },
    onLog: (logLines) => {
      // Update step based on log message
      logLines.forEach((line) => {
        const lowerLine = line.toLowerCase();
        if (lowerLine.includes("security")) {
          setSteps((prev) =>
            prev.map((step) =>
              step.id === "security"
                ? { ...step, status: "active" as const }
                : step
            )
          );
        } else if (lowerLine.includes("mock")) {
          setSteps((prev) =>
            prev.map((step) =>
              step.id === "mocks"
                ? { ...step, status: "active" as const }
                : step
            )
          );
        } else if (lowerLine.includes("endpoint")) {
          setSteps((prev) =>
            prev.map((step) =>
              step.id === "endpoints"
                ? { ...step, status: "active" as const }
                : step
            )
          );
        }
      });
    },
  });

  const getStepIcon = (step: ScanStep) => {
    switch (step.status) {
      case "completed":
        return <CheckCircle2 className="w-4 h-4 text-emerald-400" />;
      case "active":
        return <Loader2 className="w-4 h-4 text-blue-400 animate-spin" />;
      case "error":
        return <AlertTriangle className="w-4 h-4 text-red-400" />;
      default:
        return <Clock className="w-4 h-4 text-muted-foreground" />;
    }
  };

  const getStepColor = (step: ScanStep) => {
    switch (step.status) {
      case "completed":
        return "text-emerald-400";
      case "active":
        return "text-blue-400";
      case "error":
        return "text-red-400";
      default:
        return "text-muted-foreground";
    }
  };

  return (
    <Card className="bg-card border-border">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Shield className="w-5 h-5 text-teal-400" />
          Scan Progress
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Overall Progress */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Overall Progress</span>
            <Badge variant="outline">{progress}%</Badge>
          </div>
          <Progress value={progress} className="h-2" />
        </div>

        {/* Detailed Steps */}
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-foreground">Scan Steps</h3>
          {steps.map((step, index) => (
            <div key={step.id} className="space-y-2">
              <div className="flex items-center gap-3">
                {getStepIcon(step)}
                <span className={`text-sm flex-1 ${getStepColor(step)}`}>
                  {step.label}
                </span>
                {step.status === "active" && (
                  <Badge variant="outline" className="text-xs">
                    {Math.round(step.progress)}%
                  </Badge>
                )}
              </div>
              {step.status === "active" && (
                <Progress value={step.progress} className="h-1 ml-7" />
              )}
            </div>
          ))}
        </div>

        {/* Recent Logs */}
        {logs.length > 0 && (
          <div className="space-y-2">
            <h3 className="text-sm font-semibold text-foreground">Recent Activity</h3>
            <div className="bg-muted/50 rounded-lg p-3 max-h-32 overflow-y-auto">
              <div className="space-y-1">
                {logs.slice(-5).map((log, index) => (
                  <div
                    key={index}
                    className="text-xs font-mono text-muted-foreground"
                  >
                    {log}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Status Badge */}
        <div className="flex items-center justify-center pt-2">
          <Badge
            variant={
              status === "complete"
                ? "default"
                : status === "error"
                ? "destructive"
                : "outline"
            }
            className="text-sm"
          >
            {status === "complete"
              ? "Completed"
              : status === "error"
              ? "Failed"
              : status === "running"
              ? "Running"
              : "Queued"}
          </Badge>
        </div>
      </CardContent>
    </Card>
  );
}
