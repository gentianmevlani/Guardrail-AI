'use client';

import { useEffect } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  maxWidth?: "sm" | "md" | "lg" | "xl";
}

export function Modal({ isOpen, onClose, title, children, maxWidth = "md" }: ModalProps) {
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "unset";
    }

    return () => {
      document.body.style.overflow = "unset";
    };
  }, [isOpen]);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };

    if (isOpen) {
      window.addEventListener("keydown", handleEscape);
      return () => window.removeEventListener("keydown", handleEscape);
    }
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const maxWidthClasses = {
    sm: "max-w-md",
    md: "max-w-2xl",
    lg: "max-w-4xl",
    xl: "max-w-6xl",
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center">
      <div
        className="absolute inset-0 bg-black/80 backdrop-blur-sm"
        onClick={onClose}
      />

      <div
        className={`relative ${maxWidthClasses[maxWidth]} w-full mx-4 max-h-[90vh] overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-slate-900 to-black shadow-2xl`}
      >
        <div className="flex items-center justify-between border-b border-white/10 px-6 py-4 bg-white/[0.02]">
          <h2 className="text-xl font-semibold text-white">{title}</h2>
          <button
            onClick={onClose}
            className="rounded-lg p-2 text-white/60 hover:bg-white/10 hover:text-white transition-all"
            aria-label="Close modal"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="overflow-y-auto max-h-[calc(90vh-80px)] px-6 py-6">
          {children}
        </div>
      </div>
    </div>
  );
}
