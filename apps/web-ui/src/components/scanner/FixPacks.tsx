"use client";

import { Badge } from "@/components/ui/badge";
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
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Switch } from "@/components/ui/switch";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import {
  AlertTriangle,
  ArrowRight,
  Check,
  CheckCircle,
  ChevronDown,
  ChevronUp,
  Code2,
  Download,
  FileCode,
  GitBranch,
  Loader2,
  Package,
  Play,
  RefreshCw,
  Sparkles,
  Wand2,
  X,
  XCircle,
  Zap,
} from "lucide-react";
import { useCallback, useMemo, useState } from "react";

// Types
interface Fix {
  id: string;
  findingId: string;
  type: string;
  title: string;
  description: string;
  file: string;
  line: number;
  severity: "critical" | "warning" | "info";
  confidence: number;
  risk: "safe" | "moderate" | "risky";
  oldCode: string;
  newCode: string;
  explanation?: string;
  autoApplicable: boolean;
}

interface FixPack {
  id: string;
  name: string;
  description: string;
  category: string;
  fixes: Fix[];
  totalRisk: "safe" | "moderate" | "risky";
  estimatedTime: string;
}

interface FixPacksProps {
  fixPacks: FixPack[];
  onApplyFix?: (fix: Fix) => Promise<void>;
  onApplyPack?: (pack: FixPack, selectedFixes: string[]) => Promise<void>;
  onDownloadPatch?: (fixes: Fix[]) => void;
  className?: string;
}

// Risk badge colors
const riskColors = {
  safe: {
    bg: "bg-emerald-500/20",
    text: "text-emerald-400",
    border: "border-emerald-500/30",
  },
  moderate: {
    bg: "bg-yellow-500/20",
    text: "text-yellow-400",
    border: "border-yellow-500/30",
  },
  risky: {
    bg: "bg-red-500/20",
    text: "text-red-400",
    border: "border-red-500/30",
  },
};

// Diff highlighting component
function DiffView({
  oldCode,
  newCode,
  language = "typescript",
}: {
  oldCode: string;
  newCode: string;
  language?: string;
}) {
  const oldLines = oldCode.split("\n");
  const newLines = newCode.split("\n");

  // Simple diff algorithm
  const diff = useMemo(() => {
    const result: Array<{
      type: "unchanged" | "removed" | "added";
      content: string;
      lineNumber?: number;
    }> = [];

    const maxLength = Math.max(oldLines.length, newLines.length);

    for (let i = 0; i < maxLength; i++) {
      const oldLine = oldLines[i];
      const newLine = newLines[i];

      if (oldLine === newLine) {
        if (oldLine !== undefined) {
          result.push({ type: "unchanged", content: oldLine, lineNumber: i + 1 });
        }
      } else {
        if (oldLine !== undefined) {
          result.push({ type: "removed", content: oldLine, lineNumber: i + 1 });
        }
        if (newLine !== undefined) {
          result.push({ type: "added", content: newLine, lineNumber: i + 1 });
        }
      }
    }

    return result;
  }, [oldLines, newLines]);

  return (
    <div className="font-mono text-sm bg-charcoal-900 rounded-lg overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2 bg-charcoal-800 border-b border-charcoal-700">
        <span className="text-xs text-muted-foreground">Changes Preview</span>
        <div className="flex items-center gap-4 text-xs">
          <span className="flex items-center gap-1 text-red-400">
            <span className="w-3 h-3 rounded-sm bg-red-500/30" />
            Removed
          </span>
          <span className="flex items-center gap-1 text-emerald-400">
            <span className="w-3 h-3 rounded-sm bg-emerald-500/30" />
            Added
          </span>
        </div>
      </div>
      <ScrollArea className="max-h-80">
        <div className="p-2">
          {diff.map((line, index) => (
            <div
              key={index}
              className={cn(
                "flex items-start px-2 py-0.5 rounded",
                line.type === "removed" && "bg-red-500/10",
                line.type === "added" && "bg-emerald-500/10"
              )}
            >
              <span className="w-8 text-right pr-3 text-muted-foreground select-none shrink-0">
                {line.lineNumber}
              </span>
              <span
                className={cn(
                  "w-4 shrink-0 select-none",
                  line.type === "removed" && "text-red-400",
                  line.type === "added" && "text-emerald-400"
                )}
              >
                {line.type === "removed" ? "-" : line.type === "added" ? "+" : " "}
              </span>
              <code
                className={cn(
                  "flex-1",
                  line.type === "removed" && "text-red-300",
                  line.type === "added" && "text-emerald-300",
                  line.type === "unchanged" && "text-foreground/70"
                )}
              >
                {line.content || " "}
              </code>
            </div>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}

// Individual Fix Card
function FixCard({
  fix,
  selected,
  onToggle,
  onPreview,
  onApply,
  applying,
}: {
  fix: Fix;
  selected: boolean;
  onToggle: () => void;
  onPreview: () => void;
  onApply: () => void;
  applying: boolean;
}) {
  const risk = riskColors[fix.risk];

  return (
    <div
      className={cn(
        "p-4 rounded-lg border transition-all",
        selected
          ? "bg-teal-950/30 border-teal-500/50"
          : "bg-card/50 border-border hover:border-border/80"
      )}
    >
      <div className="flex items-start gap-3">
        <Switch
          checked={selected}
          onCheckedChange={onToggle}
          disabled={applying}
          className="mt-1"
        />

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h4 className="font-medium text-foreground truncate">{fix.title}</h4>
            <Badge variant="outline" className={cn(risk.text, risk.border)}>
              {fix.risk}
            </Badge>
            {fix.autoApplicable && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger>
                    <Sparkles className="w-4 h-4 text-purple-400" />
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Auto-applicable fix</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
          </div>

          <p className="text-sm text-muted-foreground mb-2">{fix.description}</p>

          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <FileCode className="w-3 h-3" />
              {fix.file}
            </span>
            <span>Line {fix.line}</span>
            <span
              className={cn(
                fix.severity === "critical" && "text-red-400",
                fix.severity === "warning" && "text-yellow-400",
                fix.severity === "info" && "text-blue-400"
              )}
            >
              {fix.severity}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Button
            variant="outline"
            size="sm"
            onClick={onPreview}
            className="border-border"
          >
            <Code2 className="w-4 h-4" />
          </Button>
          <Button
            size="sm"
            onClick={onApply}
            disabled={applying}
            className="bg-teal-600 hover:bg-teal-700"
          >
            {applying ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Wand2 className="w-4 h-4" />
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}

// Fix Pack Card
function FixPackCard({
  pack,
  onApply,
  onPreview,
  expanded,
  onToggleExpand,
}: {
  pack: FixPack;
  onApply: (selectedFixes: string[]) => Promise<void>;
  onPreview: (fix: Fix) => void;
  expanded: boolean;
  onToggleExpand: () => void;
}) {
  const [selectedFixes, setSelectedFixes] = useState<Set<string>>(
    new Set(pack.fixes.filter((f) => f.risk === "safe").map((f) => f.id))
  );
  const [applying, setApplying] = useState(false);
  const [applyingFix, setApplyingFix] = useState<string | null>(null);

  const risk = riskColors[pack.totalRisk];

  const stats = useMemo(() => {
    return {
      safe: pack.fixes.filter((f) => f.risk === "safe").length,
      moderate: pack.fixes.filter((f) => f.risk === "moderate").length,
      risky: pack.fixes.filter((f) => f.risk === "risky").length,
      critical: pack.fixes.filter((f) => f.severity === "critical").length,
    };
  }, [pack.fixes]);

  const toggleFix = (fixId: string) => {
    setSelectedFixes((prev) => {
      const next = new Set(prev);
      if (next.has(fixId)) {
        next.delete(fixId);
      } else {
        next.add(fixId);
      }
      return next;
    });
  };

  const selectAll = () => {
    setSelectedFixes(new Set(pack.fixes.map((f) => f.id)));
  };

  const selectSafe = () => {
    setSelectedFixes(
      new Set(pack.fixes.filter((f) => f.risk === "safe").map((f) => f.id))
    );
  };

  const handleApply = async () => {
    setApplying(true);
    try {
      await onApply(Array.from(selectedFixes));
    } finally {
      setApplying(false);
    }
  };

  return (
    <Card className="bg-card/50 border overflow-hidden">
      <CardHeader
        className="cursor-pointer hover:bg-secondary/30 transition-colors"
        onClick={onToggleExpand}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={cn("p-2 rounded-lg", risk.bg)}>
              <Package className={cn("w-5 h-5", risk.text)} />
            </div>
            <div>
              <CardTitle className="text-lg flex items-center gap-2">
                {pack.name}
                <Badge variant="outline" className={cn(risk.text, risk.border)}>
                  {pack.fixes.length} fixes
                </Badge>
              </CardTitle>
              <CardDescription>{pack.description}</CardDescription>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="text-right text-sm">
              <div className="text-muted-foreground">Est. time</div>
              <div className="font-medium text-foreground">
                {pack.estimatedTime}
              </div>
            </div>
            {expanded ? (
              <ChevronUp className="w-5 h-5 text-muted-foreground" />
            ) : (
              <ChevronDown className="w-5 h-5 text-muted-foreground" />
            )}
          </div>
        </div>

        {/* Stats */}
        <div className="flex items-center gap-4 mt-3 pt-3 border-t border-border/50">
          {stats.critical > 0 && (
            <span className="flex items-center gap-1 text-xs text-red-400">
              <XCircle className="w-3 h-3" />
              {stats.critical} critical
            </span>
          )}
          <span className="flex items-center gap-1 text-xs text-emerald-400">
            <CheckCircle className="w-3 h-3" />
            {stats.safe} safe
          </span>
          {stats.moderate > 0 && (
            <span className="flex items-center gap-1 text-xs text-yellow-400">
              <AlertTriangle className="w-3 h-3" />
              {stats.moderate} moderate
            </span>
          )}
          {stats.risky > 0 && (
            <span className="flex items-center gap-1 text-xs text-red-400">
              <AlertTriangle className="w-3 h-3" />
              {stats.risky} risky
            </span>
          )}
        </div>
      </CardHeader>

      {expanded && (
        <CardContent className="space-y-4 pt-0">
          {/* Quick Actions */}
          <div className="flex items-center justify-between py-2 border-b border-border/50">
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={selectAll}>
                Select All
              </Button>
              <Button variant="outline" size="sm" onClick={selectSafe}>
                Select Safe Only
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSelectedFixes(new Set())}
              >
                Clear
              </Button>
            </div>
            <div className="text-sm text-muted-foreground">
              {selectedFixes.size} of {pack.fixes.length} selected
            </div>
          </div>

          {/* Fix List */}
          <div className="space-y-3">
            {pack.fixes.map((fix) => (
              <FixCard
                key={fix.id}
                fix={fix}
                selected={selectedFixes.has(fix.id)}
                onToggle={() => toggleFix(fix.id)}
                onPreview={() => onPreview(fix)}
                onApply={async () => {
                  setApplyingFix(fix.id);
                  await onApply([fix.id]);
                  setApplyingFix(null);
                }}
                applying={applyingFix === fix.id}
              />
            ))}
          </div>

          {/* Apply Selected */}
          <div className="flex items-center justify-between pt-4 border-t border-border/50">
            <p className="text-sm text-muted-foreground">
              {selectedFixes.size > 0 ? (
                <>
                  Ready to apply{" "}
                  <span className="text-teal-400 font-medium">
                    {selectedFixes.size} fixes
                  </span>
                </>
              ) : (
                "Select fixes to apply"
              )}
            </p>
            <Button
              onClick={handleApply}
              disabled={selectedFixes.size === 0 || applying}
              className="bg-teal-600 hover:bg-teal-700"
            >
              {applying ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Applying...
                </>
              ) : (
                <>
                  <Play className="w-4 h-4 mr-2" />
                  Apply Selected
                </>
              )}
            </Button>
          </div>
        </CardContent>
      )}
    </Card>
  );
}

// Main Fix Packs Component
export function FixPacks({
  fixPacks,
  onApplyFix,
  onApplyPack,
  onDownloadPatch,
  className,
}: FixPacksProps) {
  const [expandedPacks, setExpandedPacks] = useState<Set<string>>(new Set());
  const [previewFix, setPreviewFix] = useState<Fix | null>(null);
  const [appliedFixes, setAppliedFixes] = useState<Set<string>>(new Set());

  const toggleExpand = (packId: string) => {
    setExpandedPacks((prev) => {
      const next = new Set(prev);
      if (next.has(packId)) {
        next.delete(packId);
      } else {
        next.add(packId);
      }
      return next;
    });
  };

  const handleApplyFix = async (fix: Fix) => {
    if (onApplyFix) {
      await onApplyFix(fix);
      setAppliedFixes((prev) => new Set(prev).add(fix.id));
    }
  };

  const handleApplyPack = async (pack: FixPack, selectedFixes: string[]) => {
    if (onApplyPack) {
      await onApplyPack(pack, selectedFixes);
      setAppliedFixes((prev) => {
        const next = new Set(prev);
        selectedFixes.forEach((id) => next.add(id));
        return next;
      });
    }
  };

  // Stats
  const stats = useMemo(() => {
    const allFixes = fixPacks.flatMap((p) => p.fixes);
    return {
      totalPacks: fixPacks.length,
      totalFixes: allFixes.length,
      safeFixes: allFixes.filter((f) => f.risk === "safe").length,
      criticalFixes: allFixes.filter((f) => f.severity === "critical").length,
      applied: appliedFixes.size,
    };
  }, [fixPacks, appliedFixes]);

  return (
    <div className={cn("space-y-6", className)}>
      {/* Header */}
      <Card className="bg-gradient-to-r from-card to-card/50 border">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-xl bg-teal-500/20 border border-teal-500/30">
                <Wand2 className="w-8 h-8 text-teal-400" />
              </div>
              <div>
                <CardTitle className="text-2xl">Fix Packs</CardTitle>
                <CardDescription>
                  Grouped fixes with one-click application. Review changes before
                  applying.
                </CardDescription>
              </div>
            </div>

            <div className="flex items-center gap-3">
              {onDownloadPatch && (
                <Button
                  variant="outline"
                  onClick={() =>
                    onDownloadPatch(fixPacks.flatMap((p) => p.fixes))
                  }
                >
                  <Download className="w-4 h-4 mr-2" />
                  Download Patch
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Stats Overview */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card className="bg-card/50 border">
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <Package className="w-5 h-5 text-teal-400" />
              <div>
                <p className="text-2xl font-bold text-foreground">
                  {stats.totalPacks}
                </p>
                <p className="text-xs text-muted-foreground">Fix Packs</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card/50 border">
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <Zap className="w-5 h-5 text-purple-400" />
              <div>
                <p className="text-2xl font-bold text-foreground">
                  {stats.totalFixes}
                </p>
                <p className="text-xs text-muted-foreground">Total Fixes</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card/50 border">
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <CheckCircle className="w-5 h-5 text-emerald-400" />
              <div>
                <p className="text-2xl font-bold text-emerald-400">
                  {stats.safeFixes}
                </p>
                <p className="text-xs text-muted-foreground">Safe Fixes</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card/50 border">
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <XCircle className="w-5 h-5 text-red-400" />
              <div>
                <p className="text-2xl font-bold text-red-400">
                  {stats.criticalFixes}
                </p>
                <p className="text-xs text-muted-foreground">Critical</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card/50 border">
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <Check className="w-5 h-5 text-teal-400" />
              <div>
                <p className="text-2xl font-bold text-teal-400">
                  {stats.applied}
                </p>
                <p className="text-xs text-muted-foreground">Applied</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Fix Packs List */}
      <div className="space-y-4">
        {fixPacks.map((pack) => (
          <FixPackCard
            key={pack.id}
            pack={pack}
            expanded={expandedPacks.has(pack.id)}
            onToggleExpand={() => toggleExpand(pack.id)}
            onApply={(selectedFixes) => handleApplyPack(pack, selectedFixes)}
            onPreview={setPreviewFix}
          />
        ))}
      </div>

      {/* Preview Dialog */}
      <Dialog open={!!previewFix} onOpenChange={() => setPreviewFix(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Code2 className="w-5 h-5 text-teal-400" />
              {previewFix?.title}
            </DialogTitle>
            <DialogDescription>
              {previewFix?.file} (line {previewFix?.line})
            </DialogDescription>
          </DialogHeader>

          {previewFix && (
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <Badge
                  variant="outline"
                  className={cn(
                    riskColors[previewFix.risk].text,
                    riskColors[previewFix.risk].border
                  )}
                >
                  {previewFix.risk} risk
                </Badge>
                <Badge
                  variant="outline"
                  className={cn(
                    previewFix.severity === "critical" &&
                      "text-red-400 border-red-500/30",
                    previewFix.severity === "warning" &&
                      "text-yellow-400 border-yellow-500/30",
                    previewFix.severity === "info" &&
                      "text-blue-400 border-blue-500/30"
                  )}
                >
                  {previewFix.severity}
                </Badge>
                <span className="text-sm text-muted-foreground">
                  {Math.round(previewFix.confidence * 100)}% confidence
                </span>
              </div>

              <p className="text-sm text-muted-foreground">
                {previewFix.description}
              </p>

              {previewFix.explanation && (
                <div className="p-3 rounded-lg bg-teal-950/30 border border-teal-500/30">
                  <p className="text-sm text-teal-300">
                    <Sparkles className="w-4 h-4 inline mr-2" />
                    {previewFix.explanation}
                  </p>
                </div>
              )}

              <DiffView oldCode={previewFix.oldCode} newCode={previewFix.newCode} />
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setPreviewFix(null)}>
              Close
            </Button>
            {previewFix && (
              <Button
                onClick={async () => {
                  await handleApplyFix(previewFix);
                  setPreviewFix(null);
                }}
                className="bg-teal-600 hover:bg-teal-700"
              >
                <Wand2 className="w-4 h-4 mr-2" />
                Apply Fix
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Empty State */}
      {fixPacks.length === 0 && (
        <Card className="bg-card/50 border">
          <CardContent className="py-12 text-center">
            <Package className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium text-foreground mb-2">
              No Fix Packs Available
            </h3>
            <p className="text-muted-foreground max-w-md mx-auto">
              Run a scan to detect issues and generate fix packs. Fixes are
              grouped by category for easier review and application.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default FixPacks;
