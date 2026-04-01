"use client";

import { useEffect } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

interface DetailsDrawerProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  subtitle?: string;
  children: React.ReactNode;
  width?: "sm" | "md" | "lg" | "xl";
}

const widthClasses = {
  sm: "max-w-sm",
  md: "max-w-md",
  lg: "max-w-lg",
  xl: "max-w-xl",
};

export function DetailsDrawer({
  open,
  onClose,
  title,
  subtitle,
  children,
  width = "md",
}: DetailsDrawerProps) {
  // Close on escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && open) {
        onClose();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  // Prevent body scroll when open
  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Drawer */}
      <div
        className={cn(
          "absolute right-0 top-0 h-full w-full bg-zinc-900 border-l border-zinc-800 shadow-2xl",
          "transform transition-transform duration-200 ease-out",
          widthClasses[width],
          open ? "translate-x-0" : "translate-x-full"
        )}
      >
        {/* Header */}
        <div className="flex items-start justify-between p-4 border-b border-zinc-800">
          <div>
            {title && <h2 className="text-lg font-semibold text-white">{title}</h2>}
            {subtitle && <p className="text-sm text-zinc-500 mt-0.5">{subtitle}</p>}
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-zinc-800 text-zinc-500 hover:text-zinc-300 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="overflow-y-auto h-[calc(100%-65px)] p-4">
          {children}
        </div>
      </div>
    </div>
  );
}
