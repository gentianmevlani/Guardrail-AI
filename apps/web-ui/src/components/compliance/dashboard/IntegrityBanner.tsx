"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  AlertTriangle,
  CheckCircle,
  ExternalLink,
  Link2,
  RefreshCw,
  Shield,
  XCircle,
} from "lucide-react";

export interface IntegrityStatus {
  valid: boolean;
  totalEvents: number;
  lastVerified: Date;
  violations: Array<{
    eventId: string;
    sequenceNumber: number;
    issue: string;
  }>;
}

interface IntegrityBannerProps {
  status: IntegrityStatus | null;
  loading?: boolean;
  onVerify?: () => void;
  onViewViolations?: () => void;
  className?: string;
}

export function IntegrityBanner({
  status,
  loading = false,
  onVerify,
  onViewViolations,
  className,
}: IntegrityBannerProps) {
  if (loading) {
    return (
      <div
        className={cn(
          "flex items-center justify-between p-4 rounded-lg border bg-muted/30 border-border",
          className
        )}
      >
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-teal-500/10">
            <RefreshCw className="h-5 w-5 text-teal-400 animate-spin" />
          </div>
          <div>
            <p className="font-medium text-foreground">
              Verifying Audit Trail Integrity
            </p>
            <p className="text-sm text-muted-foreground">
              Checking hash chain and sequence integrity...
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (!status) {
    return (
      <div
        className={cn(
          "flex items-center justify-between p-4 rounded-lg border bg-muted/30 border-border",
          className
        )}
      >
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-gray-500/10">
            <Shield className="h-5 w-5 text-gray-400" />
          </div>
          <div>
            <p className="font-medium text-foreground">
              Audit Trail Not Verified
            </p>
            <p className="text-sm text-muted-foreground">
              Run integrity verification to check hash chain status
            </p>
          </div>
        </div>
        {onVerify && (
          <Button
            variant="outline"
            size="sm"
            onClick={onVerify}
            className="border-border"
          >
            <Link2 className="h-4 w-4 mr-2" />
            Verify Integrity
          </Button>
        )}
      </div>
    );
  }

  const isValid = status.valid;
  const violationCount = status.violations.length;

  return (
    <div
      className={cn(
        "flex items-center justify-between p-4 rounded-lg border",
        isValid
          ? "bg-emerald-500/5 border-emerald-500/20"
          : "bg-red-500/5 border-red-500/20",
        className
      )}
    >
      <div className="flex items-center gap-3">
        <div
          className={cn(
            "p-2 rounded-lg",
            isValid ? "bg-emerald-500/10" : "bg-red-500/10"
          )}
        >
          {isValid ? (
            <CheckCircle className="h-5 w-5 text-emerald-500" />
          ) : (
            <XCircle className="h-5 w-5 text-red-500" />
          )}
        </div>
        <div>
          <div className="flex items-center gap-2">
            <p
              className={cn(
                "font-medium",
                isValid ? "text-emerald-500" : "text-red-500"
              )}
            >
              {isValid
                ? "Hash Chain Integrity Verified"
                : "Hash Chain Integrity Broken"}
            </p>
            <Badge
              className={cn(
                "text-xs border",
                isValid
                  ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20"
                  : "bg-red-500/10 text-red-500 border-red-500/20"
              )}
            >
              {status.totalEvents} events
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            {isValid ? (
              <>
                All {status.totalEvents} audit events have valid hash chains.
                Last verified:{" "}
                {new Date(status.lastVerified).toLocaleString("en-US", {
                  month: "short",
                  day: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </>
            ) : (
              <>
                <span className="text-red-400 font-medium">
                  {violationCount} integrity violation
                  {violationCount !== 1 ? "s" : ""}
                </span>{" "}
                detected in the audit trail
              </>
            )}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2">
        {!isValid && onViewViolations && (
          <Button
            variant="outline"
            size="sm"
            onClick={onViewViolations}
            className="border-red-500/30 text-red-400 hover:bg-red-500/10"
          >
            <AlertTriangle className="h-4 w-4 mr-2" />
            View Issues
          </Button>
        )}
        {onVerify && (
          <Button
            variant="outline"
            size="sm"
            onClick={onVerify}
            disabled={loading}
            className="border-border"
          >
            <RefreshCw
              className={cn("h-4 w-4 mr-2", loading && "animate-spin")}
            />
            Re-verify
          </Button>
        )}
      </div>
    </div>
  );
}

export function IntegrityViolationsList({
  violations,
  onClose,
  className,
}: {
  violations: IntegrityStatus["violations"];
  onClose?: () => void;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "p-4 rounded-lg border bg-red-500/5 border-red-500/20 space-y-3",
        className
      )}
    >
      <div className="flex items-center justify-between">
        <h4 className="font-medium text-red-400 flex items-center gap-2">
          <AlertTriangle className="h-4 w-4" />
          Integrity Violations ({violations.length})
        </h4>
        {onClose && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground"
          >
            <XCircle className="h-4 w-4" />
          </Button>
        )}
      </div>
      <div className="space-y-2 max-h-60 overflow-y-auto">
        {violations.map((violation, idx) => (
          <div
            key={idx}
            className="p-3 rounded-lg bg-red-500/10 border border-red-500/20"
          >
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm font-mono text-red-400">
                Event #{violation.sequenceNumber}
              </span>
              <span className="text-xs text-muted-foreground font-mono">
                {violation.eventId}
              </span>
            </div>
            <p className="text-sm text-foreground">{violation.issue}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
