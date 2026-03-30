"use client";

import { validateCode } from "@/lib/guardrails-api";
import { logger } from "@/lib/logger";
import { AnimatePresence, motion } from "framer-motion";
import {
  AlertTriangle,
  Brain,
  CheckCircle2,
  Code,
  Loader2,
  Lock,
  Package,
  Shield,
  Sparkles,
  Target,
  XCircle,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";

interface ValidationStage {
  id: string;
  name: string;
  icon: typeof Shield;
  status: "pending" | "running" | "passed" | "failed" | "warning";
  message?: string;
  duration?: number;
}

interface LiveValidationStreamProps {
  isValidating: boolean;
  code?: string;
  language?: string;
  stages?: ValidationStage[];
  onComplete?: (result: {
    passed: boolean;
    score: number;
    findings?: Array<{
      id?: string;
      rule?: string;
      severity?: string;
      message?: string;
    }>;
  }) => void;
}

const defaultStages: ValidationStage[] = [
  { id: "syntax", name: "Syntax Check", icon: Code, status: "pending" },
  {
    id: "imports",
    name: "Import Verification",
    icon: Package,
    status: "pending",
  },
  {
    id: "hallucination",
    name: "Hallucination Detection",
    icon: Brain,
    status: "pending",
  },
  { id: "intent", name: "Intent Alignment", icon: Target, status: "pending" },
  { id: "quality", name: "Quality Gate", icon: Sparkles, status: "pending" },
  { id: "security", name: "Security Scan", icon: Lock, status: "pending" },
];

const statusConfig = {
  pending: { color: "text-zinc-500", bg: "bg-zinc-800", icon: null },
  running: { color: "text-blue-400", bg: "bg-blue-500/20", icon: Loader2 },
  passed: {
    color: "text-emerald-400",
    bg: "bg-emerald-500/20",
    icon: CheckCircle2,
  },
  failed: { color: "text-red-400", bg: "bg-red-500/20", icon: XCircle },
  warning: {
    color: "text-amber-400",
    bg: "bg-amber-500/20",
    icon: AlertTriangle,
  },
};

export function LiveValidationStream({
  isValidating,
  code,
  language = "typescript",
  stages: initialStages,
  onComplete,
}: LiveValidationStreamProps) {
  const [stages, setStages] = useState<ValidationStage[]>(
    initialStages || defaultStages,
  );
  const [currentStage, setCurrentStage] = useState(-1);
  const [overallStatus, setOverallStatus] = useState<
    "idle" | "running" | "passed" | "failed"
  >("idle");
  const completedRef = useRef(false);

  // Map API stage status to UI status
  const mapStatus = (status: string): ValidationStage["status"] => {
    if (status === "passed") return "passed";
    if (status === "failed") return "failed";
    if (status === "warning") return "warning";
    return "pending";
  };

  useEffect(() => {
    if (!isValidating) {
      setStages(initialStages || defaultStages);
      setCurrentStage(-1);
      setOverallStatus("idle");
      completedRef.current = false;
      return;
    }

    if (completedRef.current) return;

    setOverallStatus("running");

    // If we have code, use real API validation
    if (code && code.trim()) {
      runRealValidation();
    } else {
      // Demo mode - simulate validation
      runDemoValidation();
    }

    async function runRealValidation() {
      try {
        // Show stages as running one by one for visual effect
        for (let i = 0; i < defaultStages.length; i++) {
          setCurrentStage(i);
          setStages((prev) =>
            prev.map((s, idx) =>
              idx === i ? { ...s, status: "running" as const } : s,
            ),
          );
          await new Promise((r) => setTimeout(r, 200));
        }

        // Call real API
        const result = await validateCode(code!, language);

        // Update stages with real results
        const updatedStages = defaultStages.map((stage) => {
          const apiStage = result.stages.find((s) => s.id === stage.id);
          if (apiStage) {
            return {
              ...stage,
              status: mapStatus(apiStage.status),
              duration: apiStage.duration,
              message: apiStage.message,
            };
          }
          return { ...stage, status: "passed" as const };
        });

        setStages(updatedStages);

        const allPassed = result.passed;
        setOverallStatus(allPassed ? "passed" : "failed");
        completedRef.current = true;

        onComplete?.({
          passed: result.passed,
          score: result.score,
          findings: result.findings,
        });
      } catch (error) {
        logger.error("Validation failed:", error);
        setOverallStatus("failed");
        completedRef.current = true;
        onComplete?.({ passed: false, score: 0 });
      }
    }

    function runDemoValidation() {
      let stageIndex = 0;

      const runStage = () => {
        if (stageIndex >= stages.length) {
          const allPassed = stages.every(
            (s) => s.status === "passed" || s.status === "warning",
          );
          setOverallStatus(allPassed ? "passed" : "failed");
          completedRef.current = true;

          const score = stages.reduce((acc, s) => {
            if (s.status === "passed") return acc + 100 / stages.length;
            if (s.status === "warning") return acc + 80 / stages.length;
            return acc;
          }, 0);

          onComplete?.({ passed: allPassed, score: Math.round(score) });
          return;
        }

        setCurrentStage(stageIndex);

        setStages((prev) =>
          prev.map((s, i) =>
            i === stageIndex ? { ...s, status: "running" as const } : s,
          ),
        );

        const duration = 300 + Math.random() * 500;

        setTimeout(() => {
          const rand = Math.random();
          const newStatus: ValidationStage["status"] =
            rand > 0.1 ? "passed" : rand > 0.05 ? "warning" : "failed";

          setStages((prev) =>
            prev.map((s, i) =>
              i === stageIndex
                ? {
                    ...s,
                    status: newStatus,
                    duration: Math.round(duration),
                    message:
                      newStatus === "passed"
                        ? "All checks passed"
                        : newStatus === "warning"
                          ? "Minor issues detected"
                          : "Critical issues found",
                  }
                : s,
            ),
          );

          stageIndex++;
          setTimeout(runStage, 150);
        }, duration);
      };

      runStage();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isValidating, code, language]);

  return (
    <div className="relative">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Shield
            className={`h-5 w-5 ${
              overallStatus === "running"
                ? "text-blue-400 animate-pulse"
                : overallStatus === "passed"
                  ? "text-emerald-400"
                  : overallStatus === "failed"
                    ? "text-red-400"
                    : "text-zinc-500"
            }`}
          />
          <span className="font-medium text-white">AI Output Validation</span>
        </div>

        {overallStatus === "running" && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex items-center gap-2 text-sm text-blue-400"
          >
            <Loader2 className="h-4 w-4 animate-spin" />
            Validating...
          </motion.div>
        )}

        {overallStatus === "passed" && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex items-center gap-2 text-sm text-emerald-400"
          >
            <CheckCircle2 className="h-4 w-4" />
            All Checks Passed
          </motion.div>
        )}

        {overallStatus === "failed" && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex items-center gap-2 text-sm text-red-400"
          >
            <XCircle className="h-4 w-4" />
            Validation Failed
          </motion.div>
        )}
      </div>

      {/* Progress bar */}
      <div className="h-1 bg-zinc-800 rounded-full mb-4 overflow-hidden">
        <motion.div
          className={`h-full ${
            overallStatus === "passed"
              ? "bg-emerald-500"
              : overallStatus === "failed"
                ? "bg-red-500"
                : "bg-blue-500"
          }`}
          initial={{ width: "0%" }}
          animate={{
            width:
              overallStatus === "idle"
                ? "0%"
                : `${((currentStage + 1) / stages.length) * 100}%`,
          }}
          transition={{ duration: 0.3 }}
        />
      </div>

      {/* Stages */}
      <div className="space-y-2">
        <AnimatePresence mode="popLayout">
          {stages.map((stage, index) => {
            const config = statusConfig[stage.status];
            const StatusIcon = config.icon || stage.icon;

            return (
              <motion.div
                key={stage.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{
                  opacity: 1,
                  x: 0,
                  transition: { delay: index * 0.05 },
                }}
                className={`flex items-center justify-between p-3 rounded-lg border transition-all duration-300 ${
                  stage.status === "running"
                    ? "border-blue-500/50 bg-blue-500/10"
                    : "border-zinc-800 bg-zinc-900/50"
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg ${config.bg}`}>
                    <StatusIcon
                      className={`h-4 w-4 ${config.color} ${
                        stage.status === "running" ? "animate-spin" : ""
                      }`}
                    />
                  </div>
                  <div>
                    <span
                      className={`text-sm font-medium ${
                        stage.status === "pending"
                          ? "text-zinc-500"
                          : "text-white"
                      }`}
                    >
                      {stage.name}
                    </span>
                    {stage.message && stage.status !== "pending" && (
                      <motion.p
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        className={`text-xs ${config.color}`}
                      >
                        {stage.message}
                      </motion.p>
                    )}
                  </div>
                </div>

                {stage.duration &&
                  stage.status !== "pending" &&
                  stage.status !== "running" && (
                    <span className="text-xs text-zinc-500">
                      {stage.duration}ms
                    </span>
                  )}
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </div>
  );
}
