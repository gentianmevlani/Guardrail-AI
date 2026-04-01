"use client";

import { Button } from "@/components/ui/button";
import { Check, Copy } from "lucide-react";
import { useState } from "react";

interface IntegrationCodeBlockProps {
  children: string;
  /** e.g. "bash", "yaml", "json" — visual only */
  label?: string;
}

export function IntegrationCodeBlock({
  children,
  label,
}: IntegrationCodeBlockProps) {
  const [copied, setCopied] = useState(false);

  const copy = () => {
    void navigator.clipboard.writeText(children);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="mt-2">
      {label ? (
        <span className="text-[10px] uppercase tracking-wide text-muted-foreground/80">
          {label}
        </span>
      ) : null}
      <div className="relative">
        <pre className="rounded-md border border-border bg-muted/40 p-3 pr-12 text-xs text-muted-foreground overflow-x-auto whitespace-pre-wrap font-mono leading-relaxed">
          {children}
        </pre>
        <Button
        type="button"
        size="icon"
        variant="ghost"
        className="absolute right-1 top-1 h-8 w-8 opacity-70 hover:opacity-100"
        onClick={copy}
        aria-label="Copy snippet"
      >
        {copied ? (
          <Check className="h-4 w-4 text-emerald-400" />
        ) : (
          <Copy className="h-4 w-4" />
        )}
      </Button>
      </div>
    </div>
  );
}
