"use client";

import { CheckCircle2, XCircle, AlertTriangle, Clock, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

type Verdict = "SHIP" | "NO_SHIP" | "REVIEW" | "PENDING" | "ERROR";
type GateStatus = "PASS" | "BLOCKED" | "WARN" | "SKIP";

interface VerdictBadgeProps {
  verdict: Verdict;
  size?: "sm" | "md" | "lg";
  showLabel?: boolean;
}

interface GateBadgeProps {
  status: GateStatus;
  gate: string;
  size?: "sm" | "md";
}

const verdictConfig = {
  SHIP: {
    label: "SHIP",
    icon: CheckCircle2,
    bg: "bg-emerald-500/20",
    border: "border-emerald-500/30",
    text: "text-emerald-400",
  },
  NO_SHIP: {
    label: "NO_SHIP",
    icon: XCircle,
    bg: "bg-red-500/20",
    border: "border-red-500/30",
    text: "text-red-400",
  },
  REVIEW: {
    label: "REVIEW",
    icon: AlertTriangle,
    bg: "bg-yellow-500/20",
    border: "border-yellow-500/30",
    text: "text-yellow-400",
  },
  PENDING: {
    label: "PENDING",
    icon: Loader2,
    bg: "bg-zinc-500/20",
    border: "border-zinc-500/30",
    text: "text-zinc-400",
  },
  ERROR: {
    label: "ERROR",
    icon: AlertTriangle,
    bg: "bg-orange-500/20",
    border: "border-orange-500/30",
    text: "text-orange-400",
  },
};

const gateConfig = {
  PASS: {
    icon: CheckCircle2,
    bg: "bg-emerald-500/20",
    border: "border-emerald-500/30",
    text: "text-emerald-400",
  },
  BLOCKED: {
    icon: XCircle,
    bg: "bg-red-500/20",
    border: "border-red-500/30",
    text: "text-red-400",
  },
  WARN: {
    icon: AlertTriangle,
    bg: "bg-yellow-500/20",
    border: "border-yellow-500/30",
    text: "text-yellow-400",
  },
  SKIP: {
    icon: Clock,
    bg: "bg-zinc-500/20",
    border: "border-zinc-500/30",
    text: "text-zinc-400",
  },
};

const sizeConfig = {
  sm: { badge: "px-2 py-0.5", icon: "w-3 h-3", text: "text-xs" },
  md: { badge: "px-2.5 py-1", icon: "w-3.5 h-3.5", text: "text-sm" },
  lg: { badge: "px-3 py-1.5", icon: "w-4 h-4", text: "text-base" },
};

export function VerdictBadge({ verdict, size = "md", showLabel = true }: VerdictBadgeProps) {
  const config = verdictConfig[verdict];
  const sizes = sizeConfig[size];
  const Icon = config.icon;
  const isSpinning = verdict === "PENDING";

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border font-medium",
        config.bg,
        config.border,
        config.text,
        sizes.badge,
        sizes.text
      )}
      role="status"
      aria-label={`Verdict: ${config.label}`}
    >
      <Icon className={cn(sizes.icon, isSpinning && "animate-spin")} aria-hidden="true" />
      {showLabel && <span>{config.label}</span>}
    </span>
  );
}

export function GateBadge({ status, gate, size = "md" }: GateBadgeProps) {
  const config = gateConfig[status];
  const sizes = sizeConfig[size];
  const Icon = config.icon;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md border font-medium",
        config.bg,
        config.border,
        config.text,
        sizes.badge,
        sizes.text
      )}
      role="status"
      aria-label={`${gate} gate: ${status}`}
    >
      <Icon className={sizes.icon} aria-hidden="true" />
      <span>{gate}</span>
      <span className="opacity-70" aria-hidden="true">•</span>
      <span>{status}</span>
    </span>
  );
}

export function VerdictStrip({ verdict }: { verdict: Verdict }) {
  const config = verdictConfig[verdict];
  const Icon = config.icon;

  return (
    <div
      className={cn(
        "flex items-center justify-between p-4 rounded-lg border",
        config.bg,
        config.border
      )}
      role="status"
      aria-live="polite"
      aria-label={`Ship status: ${verdict === "SHIP" ? "Ready to Ship" : verdict === "NO_SHIP" ? "Not Ready" : verdict === "REVIEW" ? "Needs Review" : verdict === "PENDING" ? "Running" : "Error"}`}
    >
      <div className="flex items-center gap-3">
        <div className={cn("p-2 rounded-full", config.bg)} aria-hidden="true">
          <Icon className={cn("w-6 h-6", config.text)} />
        </div>
        <div>
          <p className={cn("text-lg font-bold", config.text)}>
            {verdict === "SHIP" ? "Ready to Ship" : 
             verdict === "NO_SHIP" ? "Not Ready" :
             verdict === "REVIEW" ? "Needs Review" :
             verdict === "PENDING" ? "Running..." :
             "Error"}
          </p>
          <p className="text-xs text-zinc-500">
            {verdict === "SHIP" ? "All gates passing" :
             verdict === "NO_SHIP" ? "Fix blocking issues before deploy" :
             verdict === "REVIEW" ? "Manual review recommended" :
             verdict === "PENDING" ? "Ship check in progress" :
             "Check failed to complete"}
          </p>
        </div>
      </div>
      <VerdictBadge verdict={verdict} size="lg" />
    </div>
  );
}
