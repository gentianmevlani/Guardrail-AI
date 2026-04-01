"use client";

import { cn } from "@/lib/utils";
import React, { useEffect, useRef, useState } from "react";
import { logger } from "@/lib/logger";

// Tooltip Types
export interface TooltipProps {
  content: React.ReactNode;
  children: React.ReactNode;
  side?: "top" | "bottom" | "left" | "right";
  align?: "start" | "center" | "end";
  delay?: number;
  disabled?: boolean;
  className?: string;
}

// Tooltip Component
export function Tooltip({
  content,
  children,
  side = "top",
  align = "center",
  delay = 300,
  disabled = false,
  className,
}: TooltipProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const timeoutRef = useRef<NodeJS.Timeout>();
  const triggerRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);

  const calculatePosition = () => {
    if (!triggerRef.current || !tooltipRef.current) return;

    const triggerRect = triggerRef.current.getBoundingClientRect();
    const tooltipRect = tooltipRef.current.getBoundingClientRect();
    const scrollX = window.pageXOffset;
    const scrollY = window.pageYOffset;

    let x = 0;
    let y = 0;

    // Calculate position based on side
    switch (side) {
      case "top":
        x = triggerRect.left + scrollX;
        y = triggerRect.top + scrollY - tooltipRect.height - 8;
        break;
      case "bottom":
        x = triggerRect.left + scrollX;
        y = triggerRect.bottom + scrollY + 8;
        break;
      case "left":
        x = triggerRect.left + scrollX - tooltipRect.width - 8;
        y = triggerRect.top + scrollY;
        break;
      case "right":
        x = triggerRect.right + scrollX + 8;
        y = triggerRect.top + scrollY;
        break;
    }

    // Adjust alignment
    switch (align) {
      case "start":
        if (side === "top" || side === "bottom") {
          x = triggerRect.left + scrollX;
        } else {
          y = triggerRect.top + scrollY;
        }
        break;
      case "center":
        if (side === "top" || side === "bottom") {
          x =
            triggerRect.left +
            scrollX +
            (triggerRect.width - tooltipRect.width) / 2;
        } else {
          y =
            triggerRect.top +
            scrollY +
            (triggerRect.height - tooltipRect.height) / 2;
        }
        break;
      case "end":
        if (side === "top" || side === "bottom") {
          x = triggerRect.right + scrollX - tooltipRect.width;
        } else {
          y = triggerRect.bottom + scrollY - tooltipRect.height;
        }
        break;
    }

    // Ensure tooltip stays within viewport
    const padding = 8;
    if (x < padding) x = padding;
    if (x + tooltipRect.width > window.innerWidth - padding) {
      x = window.innerWidth - tooltipRect.width - padding;
    }
    if (y < padding) y = padding;
    if (y + tooltipRect.height > window.innerHeight - padding) {
      y = window.innerHeight - tooltipRect.height - padding;
    }

    setPosition({ x, y });
  };

  const showTooltip = () => {
    if (disabled) return;

    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    timeoutRef.current = setTimeout(() => {
      setIsVisible(true);
      calculatePosition();
    }, delay);
  };

  const hideTooltip = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    setIsVisible(false);
  };

  useEffect(() => {
    if (isVisible) {
      calculatePosition();
      window.addEventListener("scroll", calculatePosition);
      window.addEventListener("resize", calculatePosition);

      return () => {
        window.removeEventListener("scroll", calculatePosition);
        window.removeEventListener("resize", calculatePosition);
      };
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isVisible]);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return (
    <>
      <div
        ref={triggerRef}
        onMouseEnter={showTooltip}
        onMouseLeave={hideTooltip}
        onFocus={showTooltip}
        onBlur={hideTooltip}
        className="inline-block"
      >
        {children}
      </div>

      {isVisible && (
        <div
          ref={tooltipRef}
          className={cn(
            "fixed z-50 px-3 py-2 text-sm text-white bg-zinc-900 border border-zinc-700 rounded-lg shadow-lg pointer-events-none",
            "max-w-xs break-words",
            className,
          )}
          style={{
            left: position.x,
            top: position.y,
          }}
          role="tooltip"
        >
          {content}
          {/* Arrow */}
          <div
            className={cn(
              "absolute w-2 h-2 bg-zinc-900 border border-zinc-700 rotate-45",
              {
                "top-full left-1/2 -translate-x-1/2 -mt-1 border-l-0 border-t-0":
                  side === "bottom",
                "bottom-full left-1/2 -translate-x-1/2 -mb-1 border-r-0 border-b-0":
                  side === "top",
                "left-full top-1/2 -translate-y-1/2 -ml-1 border-t-0 border-l-0":
                  side === "right",
                "right-full top-1/2 -translate-y-1/2 -mr-1 border-r-0 border-b-0":
                  side === "left",
              },
            )}
          />
        </div>
      )}
    </>
  );
}

// Confirmation Dialog
export interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  confirmText?: string;
  cancelText?: string;
  variant?: "default" | "destructive";
  onConfirm: () => void | Promise<void>;
  loading?: boolean;
}

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmText = "Confirm",
  cancelText = "Cancel",
  variant = "default",
  onConfirm,
  loading = false,
}: ConfirmDialogProps) {
  const [isConfirming, setIsConfirming] = useState(false);

  const handleConfirm = async () => {
    setIsConfirming(true);
    try {
      await onConfirm();
      onOpenChange(false);
    } catch (error) {
      logger.logUnknownError("Confirm action failed", error);
    } finally {
      setIsConfirming(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={() => onOpenChange(false)}
      />

      {/* Dialog */}
      <div className="relative bg-zinc-900 border border-zinc-800 rounded-lg shadow-xl p-6 max-w-md w-full mx-4">
        <h2 className="text-lg font-semibold text-white mb-2">{title}</h2>
        {description && (
          <p className="text-sm text-zinc-400 mb-6">{description}</p>
        )}

        <div className="flex gap-3 justify-end">
          <button
            onClick={() => onOpenChange(false)}
            disabled={isConfirming || loading}
            className="px-4 py-2 text-sm text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {cancelText}
          </button>
          <button
            onClick={handleConfirm}
            disabled={isConfirming || loading}
            className={cn(
              "px-4 py-2 text-sm rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed",
              variant === "destructive"
                ? "bg-red-600 hover:bg-red-700 text-white"
                : "bg-blue-600 hover:bg-blue-700 text-white",
            )}
          >
            {isConfirming || loading ? (
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                {confirmText}
              </div>
            ) : (
              confirmText
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

// Hook for confirmation dialogs
export function useConfirmDialog() {
  const [dialog, setDialog] = useState<ConfirmDialogProps | null>(null);

  const confirm = (
    props: Omit<ConfirmDialogProps, "open" | "onOpenChange">,
  ) => {
    return new Promise<boolean>((resolve) => {
      setDialog({
        ...props,
        open: true,
        onOpenChange: (open) => {
          if (!open) {
            setDialog(null);
            resolve(false);
          }
        },
        onConfirm: async () => {
          await props.onConfirm();
          resolve(true);
        },
      });
    });
  };

  const ConfirmDialogComponent = dialog ? <ConfirmDialog {...dialog} /> : null;

  return { confirm, ConfirmDialog: ConfirmDialogComponent };
}

// Quick Action Tooltip
export function ActionTooltip({
  action,
  description,
  children,
  shortcut,
}: {
  action: string;
  description?: string;
  children: React.ReactNode;
  shortcut?: string;
}) {
  return (
    <Tooltip
      content={
        <div className="space-y-1">
          <div className="font-medium">{action}</div>
          {description && (
            <div className="text-xs opacity-80">{description}</div>
          )}
          {shortcut && (
            <div className="text-xs opacity-60">
              Keyboard:{" "}
              <kbd className="px-1 py-0.5 bg-zinc-800 rounded text-xs">
                {shortcut}
              </kbd>
            </div>
          )}
        </div>
      }
      side="bottom"
      align="center"
    >
      {children}
    </Tooltip>
  );
}

// Status Tooltip
export function StatusTooltip({
  status,
  details,
  children,
}: {
  status: "success" | "warning" | "error" | "info";
  details?: string;
  children: React.ReactNode;
}) {
  const statusColors = {
    success: "bg-emerald-500",
    warning: "bg-amber-500",
    error: "bg-red-500",
    info: "bg-blue-500",
  };

  return (
    <Tooltip
      content={
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <div className={cn("w-2 h-2 rounded-full", statusColors[status])} />
            <span className="capitalize">{status}</span>
          </div>
          {details && <div className="text-xs opacity-80">{details}</div>}
        </div>
      }
      side="top"
      align="center"
    >
      {children}
    </Tooltip>
  );
}

// Progress Tooltip
export function ProgressTooltip({
  progress,
  total,
  label,
  children,
}: {
  progress: number;
  total: number;
  label: string;
  children: React.ReactNode;
}) {
  const percentage = Math.round((progress / total) * 100);

  return (
    <Tooltip
      content={
        <div className="space-y-2">
          <div className="font-medium">{label}</div>
          <div className="text-sm opacity-80">
            {progress} of {total} ({percentage}%)
          </div>
          <div className="w-full bg-zinc-800 rounded-full h-2">
            <div
              className="bg-blue-500 h-2 rounded-full transition-all"
              style={{ width: `${percentage}%` }}
            />
          </div>
        </div>
      }
      side="top"
      align="center"
    >
      {children}
    </Tooltip>
  );
}
