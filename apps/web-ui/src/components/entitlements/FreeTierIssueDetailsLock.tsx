"use client";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Lock } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

interface FreeTierIssueDetailsLockProps {
  /** When true, children are blurred and an upgrade overlay is shown. */
  active: boolean;
  children: ReactNode;
  /** Optional class on the outer relative wrapper when active */
  className?: string;
  /** Shown above the blurred region when active */
  bannerMessage?: string;
  /** Overlay title */
  overlayTitle?: string;
  /** Overlay description */
  overlayDescription?: string;
}

/**
 * Wraps issue-detail UIs for free-tier users: keeps severity summaries visible
 * outside this component; blurs children and prompts upgrade.
 */
export function FreeTierIssueDetailsLock({
  active,
  children,
  className,
  bannerMessage = "Free plan shows severity counts only. Upgrade to see rules, file paths, and full details.",
  overlayTitle = "Issue details are hidden on the Free plan",
  overlayDescription = "Upgrade to unlock the full list, search, filters, and triage.",
}: FreeTierIssueDetailsLockProps) {
  if (!active) {
    return <>{children}</>;
  }

  return (
    <>
      <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 px-4 py-3 flex flex-wrap items-center gap-2 text-sm text-amber-200/90">
        <Lock className="w-4 h-4 shrink-0 text-amber-400" />
        <span>{bannerMessage}</span>
        <Button
          asChild
          size="sm"
          className="bg-amber-500/20 text-amber-100 border border-amber-500/40 hover:bg-amber-500/30"
        >
          <Link href="/billing">View plans</Link>
        </Button>
      </div>

      <div
        className={cn(
          "relative rounded-xl border border-border/60 overflow-hidden",
          className,
        )}
      >
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/65 px-4 backdrop-blur-[2px]">
          <div className="max-w-md rounded-xl border border-border bg-card p-6 text-center shadow-xl">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-amber-500/15">
              <Lock className="h-6 w-6 text-amber-400" />
            </div>
            <p className="text-base font-semibold text-foreground">{overlayTitle}</p>
            <p className="mt-2 text-sm text-muted-foreground">{overlayDescription}</p>
            <Button asChild className="mt-4 w-full sm:w-auto">
              <Link href="/billing">Upgrade to see issues</Link>
            </Button>
          </div>
        </div>

        <div
          className={cn(
            "p-1",
            "pointer-events-none select-none blur-md min-h-[280px]",
          )}
        >
          {children}
        </div>
      </div>
    </>
  );
}
