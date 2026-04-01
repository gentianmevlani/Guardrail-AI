"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, XCircle, Clock, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useWebSocket } from "@/hooks/useWebSocket";

interface RealTimeProgressProps {
  runId?: string;
  scanId?: string;
}

export function RealTimeProgress({ runId, scanId }: RealTimeProgressProps) {
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState<"running" | "completed" | "failed">("running");
  const [currentStep, setCurrentStep] = useState<string>("Initializing...");
  const [steps, setSteps] = useState<Array<{ name: string; status: "pending" | "running" | "completed" | "failed" }>>([]);

  const { lastMessage } = useWebSocket({
    url: process.env.NEXT_PUBLIC_WS_URL || "ws://localhost:3000",
    autoConnect: true,
    onMessage: (message) => {
      if (message.type === "scan-progress") {
        const data = message.data as
          | {
              progress?: number;
              message?: string;
              steps?: Array<{
                name: string;
                status: "pending" | "running" | "completed" | "failed";
              }>;
            }
          | undefined;
        setProgress(Number(data?.progress ?? 0));
        setCurrentStep(
          typeof data?.message === "string" ? data.message : "Processing...",
        );

        // Update steps
        if (data?.steps && Array.isArray(data.steps)) {
          setSteps(data.steps);
        }
      } else if (message.type === "scan-complete") {
        setStatus("completed");
        setProgress(100);
        setCurrentStep("Completed");
      } else if (message.type === "scan-failed") {
        setStatus("failed");
        setCurrentStep("Failed");
      }
    },
  });

  useEffect(() => {
    // Initialize steps
    setSteps([
      { name: "MockProof Scan", status: "pending" },
      { name: "Security Scan", status: "pending" },
      { name: "Reality Mode", status: "pending" },
      { name: "Ship Badge", status: "pending" },
    ]);
  }, []);

  const getStatusIcon = (stepStatus: string) => {
    switch (stepStatus) {
      case "completed":
        return <CheckCircle2 className="w-4 h-4 text-emerald-400" />;
      case "failed":
        return <XCircle className="w-4 h-4 text-red-400" />;
      case "running":
        return <Loader2 className="w-4 h-4 text-blue-400 animate-spin" />;
      default:
        return <Clock className="w-4 h-4 text-zinc-500" />;
    }
  };

  const getStatusColor = () => {
    switch (status) {
      case "completed":
        return "text-emerald-400";
      case "failed":
        return "text-red-400";
      default:
        return "text-blue-400";
    }
  };

  return (
    <Card className="bg-black/40 border-zinc-800 backdrop-blur-sm">
      <CardHeader>
        <CardTitle className="text-white flex items-center gap-2">
          {status === "running" && <Loader2 className="w-5 h-5 animate-spin text-blue-400" />}
          {status === "completed" && <CheckCircle2 className="w-5 h-5 text-emerald-400" />}
          {status === "failed" && <XCircle className="w-5 h-5 text-red-400" />}
          Real-Time Progress
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Progress Bar */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-zinc-400">{currentStep}</span>
            <span className={`text-sm font-medium ${getStatusColor()}`}>
              {progress.toFixed(0)}%
            </span>
          </div>
          <Progress value={progress} className="h-2" />
        </div>

        {/* Steps */}
        <div className="space-y-2">
          {steps.map((step, idx) => (
            <div
              key={idx}
              className="flex items-center gap-3 p-2 rounded-lg bg-zinc-900/50"
            >
              {getStatusIcon(step.status)}
              <span
                className={`text-sm ${
                  step.status === "completed"
                    ? "text-emerald-400"
                    : step.status === "failed"
                      ? "text-red-400"
                      : step.status === "running"
                        ? "text-blue-400"
                        : "text-zinc-500"
                }`}
              >
                {step.name}
              </span>
              {step.status === "running" && (
                <Badge variant="outline" className="text-xs ml-auto">
                  Running...
                </Badge>
              )}
            </div>
          ))}
        </div>

        {/* Status Badge */}
        <div className="flex justify-center pt-2">
          <Badge
            className={
              status === "completed"
                ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30"
                : status === "failed"
                  ? "bg-red-500/20 text-red-400 border-red-500/30"
                  : "bg-blue-500/20 text-blue-400 border-blue-500/30"
            }
          >
            {status === "running" && "In Progress"}
            {status === "completed" && "Completed"}
            {status === "failed" && "Failed"}
          </Badge>
        </div>
      </CardContent>
    </Card>
  );
}
