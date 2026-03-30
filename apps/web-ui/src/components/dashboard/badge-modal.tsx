"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Award, CheckCircle, Copy } from "lucide-react";
import { useState } from "react";

interface BadgeModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  shipStatus: string;
  badgeMarkdown: string;
  badgeHtml: string;
}

export function BadgeModal({
  open,
  onOpenChange,
  shipStatus,
  badgeMarkdown,
  badgeHtml,
}: BadgeModalProps) {
  const [copiedBadge, setCopiedBadge] = useState(false);

  const copyBadgeCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedBadge(true);
    setTimeout(() => setCopiedBadge(false), 2000);
  };

  const getBadgeStyles = () => {
    switch (shipStatus) {
      case "SHIP":
        return "bg-success text-success-foreground";
      case "NO_SHIP":
        return "bg-destructive text-destructive-foreground";
      case "REVIEW":
        return "bg-warning text-warning-foreground";
      default:
        return "bg-muted text-foreground";
    }
  };

  const getBadgeText = () => {
    switch (shipStatus) {
      case "SHIP":
        return "✓ SHIP";
      case "NO_SHIP":
        return "✗ NO SHIP";
      case "REVIEW":
        return "⚠ REVIEW";
      default:
        return "◯ PENDING";
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card border max-w-lg w-full sm:rounded-lg">
        <DialogHeader className="flex flex-row items-center justify-between space-y-0">
          <DialogTitle className="text-white flex items-center gap-2">
            <Award className="h-5 w-5 text-warning" />
            Get Your Ship Badge
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Badge Preview */}
          <div className="flex justify-center p-4 bg-muted rounded-lg">
            <div
              className={`px-4 py-2 rounded-lg font-bold text-lg ${getBadgeStyles()}`}
            >
              {getBadgeText()}
            </div>
          </div>

          {/* Markdown Code */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground/90">
              Markdown
            </label>
            <div className="relative">
              <pre className="bg-muted p-3 rounded-lg text-xs text-foreground/80 overflow-x-auto pr-12">
                {badgeMarkdown}
              </pre>
              <Button
                size="sm"
                variant="ghost"
                className="absolute top-2 right-2 text-muted-foreground hover:text-foreground"
                onClick={() => copyBadgeCode(badgeMarkdown)}
              >
                {copiedBadge ? (
                  <CheckCircle className="h-4 w-4 text-success" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>

          {/* HTML Code */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground/90">
              HTML
            </label>
            <div className="relative">
              <pre className="bg-muted p-3 rounded-lg text-xs text-foreground/80 overflow-x-auto pr-12">
                {badgeHtml}
              </pre>
              <Button
                size="sm"
                variant="ghost"
                className="absolute top-2 right-2 text-muted-foreground hover:text-foreground"
                onClick={() => copyBadgeCode(badgeHtml)}
              >
                {copiedBadge ? (
                  <CheckCircle className="h-4 w-4 text-success" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>

          {/* Instructions */}
          <p className="text-xs text-muted-foreground text-center">
            Add this badge to your README to show your Ship status.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
