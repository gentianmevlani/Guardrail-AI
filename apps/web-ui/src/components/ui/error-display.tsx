"use client";

import { useState } from "react";
import {
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Copy,
  Check,
  ExternalLink,
  Terminal,
  RefreshCw,
  MessageSquare,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface ErrorDisplayProps {
  title: string;
  description: string;
  command?: string;
  suggestion?: string;
  doctorUrl?: string;
  runId?: string;
  stackTrace?: string;
  onRetry?: () => void;
  onReport?: () => void;
}

function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <button
      onClick={handleCopy}
      className="p-1 rounded hover:bg-zinc-700 transition-colors"
      title="Copy to clipboard"
    >
      {copied ? (
        <Check className="h-3.5 w-3.5 text-emerald-400" />
      ) : (
        <Copy className="h-3.5 w-3.5 text-zinc-500" />
      )}
    </button>
  );
}

export function ErrorDisplay({
  title,
  description,
  command,
  suggestion,
  doctorUrl,
  runId,
  stackTrace,
  onRetry,
  onReport,
}: ErrorDisplayProps) {
  const [showDetails, setShowDetails] = useState(false);

  return (
    <div className="rounded-xl border border-red-500/30 bg-red-950/20 p-6 space-y-4">
      {/* Header */}
      <div className="flex items-start gap-4">
        <div className="p-2 rounded-lg bg-red-500/20">
          <AlertTriangle className="h-6 w-6 text-red-400" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-lg font-semibold text-red-400">{title}</h3>
          <p className="text-sm text-zinc-400 mt-1">{description}</p>
        </div>
      </div>

      {/* Failed command */}
      {command && (
        <div className="space-y-2">
          <div className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
            Command that failed
          </div>
          <div className="relative">
            <pre className="p-4 rounded-lg bg-zinc-900 border border-zinc-800 text-sm text-zinc-300 font-mono overflow-x-auto">
              <Terminal className="inline h-4 w-4 text-zinc-500 mr-2" />
              {command}
            </pre>
            <div className="absolute top-2 right-2">
              <CopyButton value={command} />
            </div>
          </div>
        </div>
      )}

      {/* Suggestion */}
      {suggestion && (
        <div className="p-4 rounded-lg bg-blue-950/20 border border-blue-500/20">
          <div className="flex items-start gap-3">
            <div className="text-blue-400 text-sm font-medium">Suggested fix:</div>
            <div className="text-sm text-zinc-300">{suggestion}</div>
          </div>
        </div>
      )}

      {/* Stack trace (hidden by default) */}
      {stackTrace && (
        <div className="space-y-2">
          <button
            onClick={() => setShowDetails(!showDetails)}
            className="flex items-center gap-2 text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
          >
            {showDetails ? (
              <ChevronUp className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
            {showDetails ? "Hide details" : "Show details"}
          </button>

          {showDetails && (
            <div className="relative">
              <pre className="p-4 rounded-lg bg-zinc-900 border border-zinc-800 text-xs text-zinc-500 font-mono overflow-x-auto max-h-60 overflow-y-auto">
                {stackTrace}
              </pre>
              <div className="absolute top-2 right-2">
                <CopyButton value={stackTrace} />
              </div>
            </div>
          )}
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-3 pt-2">
        {onRetry && (
          <Button
            onClick={onRetry}
            size="sm"
            className="bg-zinc-800 hover:bg-zinc-700 text-white"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Retry
          </Button>
        )}

        {doctorUrl && (
          <Button
            variant="outline"
            size="sm"
            className="border-zinc-700 text-zinc-300"
            asChild
          >
            <a href={doctorUrl} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="h-4 w-4 mr-2" />
              View Doctor Output
            </a>
          </Button>
        )}

        {onReport && runId && (
          <Button
            variant="outline"
            size="sm"
            className="border-zinc-700 text-zinc-300"
            onClick={onReport}
          >
            <MessageSquare className="h-4 w-4 mr-2" />
            Report Issue
          </Button>
        )}
      </div>

      {/* Run ID footer */}
      {runId && (
        <div className="flex items-center gap-2 text-[10px] text-zinc-600 pt-2 border-t border-zinc-800">
          <span>Run ID:</span>
          <code className="font-mono">{runId}</code>
          <CopyButton value={runId} />
        </div>
      )}
    </div>
  );
}

/**
 * Inline error for form fields or small areas
 */
export function InlineError({ message }: { message: string }) {
  return (
    <div className="flex items-center gap-2 text-sm text-red-400 mt-1">
      <AlertTriangle className="h-3.5 w-3.5" />
      <span>{message}</span>
    </div>
  );
}

/**
 * Empty state with action guidance
 */
export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
      <div className="p-4 rounded-full bg-zinc-800/50 mb-4">
        <Icon className="h-10 w-10 text-zinc-500" />
      </div>
      <h3 className="text-lg font-medium text-zinc-300 mb-2">{title}</h3>
      <p className="text-sm text-zinc-500 max-w-md mb-6">{description}</p>
      {action}
    </div>
  );
}
