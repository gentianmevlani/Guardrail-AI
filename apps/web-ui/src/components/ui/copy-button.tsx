"use client";

import { logger } from "@/lib/logger";
import { useState } from "react";
import { Copy, Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface CopyButtonProps {
  value: string;
  className?: string;
  size?: "sm" | "md";
}

export function CopyButton({ value, className, size = "sm" }: CopyButtonProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      logger.error('Failed to copy:', err);
    }
  };

  const iconSize = size === "sm" ? "w-3 h-3" : "w-4 h-4";
  const padding = size === "sm" ? "p-1" : "p-1.5";

  return (
    <button
      onClick={handleCopy}
      className={cn(
        "rounded hover:bg-zinc-700 transition-colors",
        padding,
        copied ? "text-emerald-400" : "text-zinc-500 hover:text-zinc-300",
        className
      )}
      title={copied ? "Copied!" : "Copy to clipboard"}
      aria-label={copied ? "Copied to clipboard" : "Copy to clipboard"}
      aria-live="polite"
    >
      {copied ? (
        <Check className={iconSize} aria-hidden="true" />
      ) : (
        <Copy className={iconSize} aria-hidden="true" />
      )}
      <span className="sr-only">{copied ? "Copied" : "Copy"}</span>
    </button>
  );
}

interface CopyableTextProps {
  value: string;
  display?: string;
  className?: string;
  mono?: boolean;
}

export function CopyableText({ value, display, className, mono = true }: CopyableTextProps) {
  return (
    <span className={cn("inline-flex items-center gap-1 group", className)}>
      <span className={cn(mono && "font-mono text-xs")}>{display || value}</span>
      <CopyButton value={value} className="opacity-0 group-hover:opacity-100" />
    </span>
  );
}
