"use client";

import Link from "next/link";
import {
  History,
  Clock,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  GitBranch,
  ScrollText,
  ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "./badge";

interface RecentRun {
  id: string;
  repo: string;
  branch: string;
  verdict: "SHIP" | "NO_SHIP" | "ERROR";
  timestamp: string;
}

interface RecentBlocker {
  rule: string;
  count: number;
  lastSeen: string;
}

interface RecentPolicyChange {
  id: string;
  action: string;
  user: string;
  timestamp: string;
}

interface RecentItemsProps {
  runs?: RecentRun[];
  blockers?: RecentBlocker[];
  policyChanges?: RecentPolicyChange[];
}

function formatTimeAgo(timestamp: string): string {
  if (typeof window === 'undefined') return 'just now';
  
  const now = new Date();
  const then = new Date(timestamp);
  const diff = Math.floor((now.getTime() - then.getTime()) / 1000);

  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

function getVerdictIcon(verdict: RecentRun["verdict"]) {
  switch (verdict) {
    case "SHIP":
      return <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />;
    case "NO_SHIP":
      return <XCircle className="w-3.5 h-3.5 text-red-400" />;
    case "ERROR":
      return <AlertTriangle className="w-3.5 h-3.5 text-orange-400" />;
  }
}

export function RecentRuns({ runs }: { runs: RecentRun[] }) {
  if (runs.length === 0) return null;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
          Recent Runs
        </h3>
        <Link href="/runs" className="text-xs text-blue-400 hover:text-blue-300">
          View all
        </Link>
      </div>
      <div className="space-y-1">
        {runs.slice(0, 5).map((run) => (
          <Link
            key={run.id}
            href={`/runs/${run.id}`}
            className="flex items-center gap-3 p-2 rounded-lg hover:bg-zinc-800/50 transition-colors group"
          >
            {getVerdictIcon(run.verdict)}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-sm text-zinc-300 truncate">{run.repo}</span>
                <GitBranch className="w-3 h-3 text-zinc-600" />
                <span className="text-xs text-zinc-500 truncate">{run.branch}</span>
              </div>
            </div>
            <span className="text-xs text-zinc-600">{formatTimeAgo(run.timestamp)}</span>
            <ChevronRight className="w-4 h-4 text-zinc-700 opacity-0 group-hover:opacity-100 transition-opacity" />
          </Link>
        ))}
      </div>
    </div>
  );
}

export function RecentBlockers({ blockers }: { blockers: RecentBlocker[] }) {
  if (blockers.length === 0) return null;

  return (
    <div className="space-y-2">
      <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
        Top Blockers
      </h3>
      <div className="space-y-1">
        {blockers.slice(0, 5).map((blocker) => (
          <div
            key={blocker.rule}
            className="flex items-center gap-3 p-2 rounded-lg hover:bg-zinc-800/50 transition-colors"
          >
            <AlertTriangle className="w-3.5 h-3.5 text-red-400" />
            <div className="flex-1 min-w-0">
              <span className="text-sm text-zinc-300 font-mono">{blocker.rule}</span>
            </div>
            <Badge variant="outline" className="border-zinc-700 text-zinc-500 text-xs">
              {blocker.count}x
            </Badge>
          </div>
        ))}
      </div>
    </div>
  );
}

export function RecentPolicyChanges({ changes }: { changes: RecentPolicyChange[] }) {
  if (changes.length === 0) return null;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
          Policy Changes
        </h3>
        <Link href="/audit" className="text-xs text-blue-400 hover:text-blue-300">
          View all
        </Link>
      </div>
      <div className="space-y-1">
        {changes.slice(0, 5).map((change) => (
          <Link
            key={change.id}
            href={`/audit?id=${change.id}`}
            className="flex items-center gap-3 p-2 rounded-lg hover:bg-zinc-800/50 transition-colors group"
          >
            <ScrollText className="w-3.5 h-3.5 text-blue-400" />
            <div className="flex-1 min-w-0">
              <span className="text-sm text-zinc-300">{change.action}</span>
              <span className="text-xs text-zinc-600 ml-2">by {change.user}</span>
            </div>
            <span className="text-xs text-zinc-600">{formatTimeAgo(change.timestamp)}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}

export function RecentItems({ runs, blockers, policyChanges }: RecentItemsProps) {
  const hasContent = (runs?.length || 0) > 0 || (blockers?.length || 0) > 0 || (policyChanges?.length || 0) > 0;

  if (!hasContent) {
    return (
      <div className="p-4 rounded-lg border border-zinc-800 bg-zinc-900/50">
        <div className="flex items-center gap-2 text-zinc-500">
          <History className="w-4 h-4" />
          <span className="text-sm">No recent activity</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-4 rounded-lg border border-zinc-800 bg-zinc-900/50">
      {runs && runs.length > 0 && <RecentRuns runs={runs} />}
      {blockers && blockers.length > 0 && <RecentBlockers blockers={blockers} />}
      {policyChanges && policyChanges.length > 0 && <RecentPolicyChanges changes={policyChanges} />}
    </div>
  );
}
