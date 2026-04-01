"use client";

import { useState } from "react";
import { X, Sparkles, Check, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "./badge";
import { Button } from "./button";

interface ChangelogEntry {
  id: string;
  version: string;
  date: string;
  title: string;
  description: string;
  type: "feature" | "improvement" | "fix";
  isNew?: boolean;
}

const changelogEntries: ChangelogEntry[] = [
  {
    id: "1",
    version: "2.4.0",
    date: "2026-01-01",
    title: "Airlock Supply Chain Gate",
    description: "New dependency vulnerability scanning integrated into Ship Check",
    type: "feature",
    isNew: true,
  },
  {
    id: "2",
    version: "2.3.5",
    date: "2025-12-28",
    title: "Faster Reality Mode",
    description: "50% faster flow verification with parallel execution",
    type: "improvement",
  },
  {
    id: "3",
    version: "2.3.4",
    date: "2025-12-25",
    title: "Policy Diff Viewer",
    description: "See before/after when policy changes are made",
    type: "feature",
  },
  {
    id: "4",
    version: "2.3.3",
    date: "2025-12-20",
    title: "Fixed false positive in no-localhost",
    description: "Localhost detection now respects allowlist domains",
    type: "fix",
  },
];

interface ChangelogPanelProps {
  onClose: () => void;
}

export function ChangelogPanel({ onClose }: ChangelogPanelProps) {
  const [dismissedIds, setDismissedIds] = useState<string[]>([]);

  const visibleEntries = changelogEntries.filter((e) => !dismissedIds.includes(e.id));

  const getTypeBadge = (type: ChangelogEntry["type"]) => {
    switch (type) {
      case "feature":
        return <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30">Feature</Badge>;
      case "improvement":
        return <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30">Improvement</Badge>;
      case "fix":
        return <Badge className="bg-zinc-500/20 text-zinc-400 border-zinc-500/30">Fix</Badge>;
    }
  };

  return (
    <div className="fixed bottom-4 right-4 w-96 bg-zinc-900 border border-zinc-800 rounded-xl shadow-2xl overflow-hidden z-40">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800 bg-gradient-to-r from-blue-950/50 to-purple-950/50">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-blue-400" />
          <span className="font-semibold text-white">What's New</span>
          {visibleEntries.some((e) => e.isNew) && (
            <span className="px-1.5 py-0.5 text-[10px] font-medium rounded-full bg-blue-500 text-white">
              {visibleEntries.filter((e) => e.isNew).length}
            </span>
          )}
        </div>
        <button
          onClick={onClose}
          className="p-1 rounded hover:bg-zinc-800 text-zinc-500 hover:text-zinc-300"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Content */}
      <div className="max-h-80 overflow-y-auto">
        {visibleEntries.length === 0 ? (
          <div className="p-6 text-center text-zinc-500">
            <Check className="w-8 h-8 mx-auto mb-2 text-emerald-500" />
            <p className="text-sm">You're all caught up!</p>
          </div>
        ) : (
          <div className="divide-y divide-zinc-800">
            {visibleEntries.map((entry) => (
              <div
                key={entry.id}
                className={cn(
                  "p-4 transition-colors",
                  entry.isNew && "bg-blue-950/10"
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      {getTypeBadge(entry.type)}
                      <span className="text-xs text-zinc-600 font-mono">{entry.version}</span>
                      {entry.isNew && (
                        <span className="text-[10px] font-medium text-blue-400">NEW</span>
                      )}
                    </div>
                    <h4 className="font-medium text-zinc-200 text-sm">{entry.title}</h4>
                    <p className="text-xs text-zinc-500 mt-1">{entry.description}</p>
                  </div>
                  <button
                    onClick={() => setDismissedIds([...dismissedIds, entry.id])}
                    className="p-1 rounded hover:bg-zinc-800 text-zinc-600 hover:text-zinc-400"
                    title="Dismiss"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="px-4 py-3 border-t border-zinc-800">
        <Button variant="outline" size="sm" className="w-full border-zinc-700 text-xs">
          View Full Changelog
          <ArrowRight className="w-3 h-3 ml-1" />
        </Button>
      </div>
    </div>
  );
}
