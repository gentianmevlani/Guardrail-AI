"use client";

import { Button } from "@/components/ui/button";
import { logger } from "@/lib/logger";
import { cn } from "@/lib/utils";
import { AlertTriangle, CheckCircle, Info, X, XCircle } from "lucide-react";
import React, { useEffect, useState } from "react";

// Global toast store for standalone functions (outside React context)
type ToastListener = (toast: Omit<Toast, "id">) => void;
let globalToastListener: ToastListener | null = null;

export function setGlobalToastListener(listener: ToastListener | null) {
  globalToastListener = listener;
}

// Standalone toast functions (can be called outside React components)
export function showSuccess(title: string, description?: string) {
  if (globalToastListener) {
    globalToastListener({ type: "success", title, description });
  } else {
    logger.info(`Toast success: ${title}`, { description });
  }
}

export function showError(title: string, description?: string) {
  if (globalToastListener) {
    globalToastListener({ type: "error", title, description });
  } else {
    logger.error(`Toast error: ${title}`, { description });
  }
}

export function showWarning(title: string, description?: string) {
  if (globalToastListener) {
    globalToastListener({ type: "warning", title, description });
  } else {
    logger.warn(`Toast warning: ${title}`, { description });
  }
}

export function showInfo(title: string, description?: string) {
  if (globalToastListener) {
    globalToastListener({ type: "info", title, description });
  } else {
    logger.info(`Toast info: ${title}`, { description });
  }
}

// Toast Types
export type ToastType = "success" | "error" | "warning" | "info";

export interface Toast {
  id: string;
  type: ToastType;
  title: string;
  description?: string;
  duration?: number;
  action?: {
    label: string;
    onClick: () => void;
  };
  dismissible?: boolean;
  onDismiss?: () => void;
}

// Toast Context
interface ToastContextType {
  toasts: Toast[];
  addToast: (toast: Omit<Toast, "id">) => string;
  removeToast: (id: string) => void;
  clearAll: () => void;
}

const ToastContext = React.createContext<ToastContextType | null>(null);

export function useToast() {
  const context = React.useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used within a ToastProvider");
  }
  return context;
}

// Toast Provider
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = React.useCallback((toast: Omit<Toast, "id">) => {
    const id = Math.random().toString(36).substr(2, 9);
    const newToast = { ...toast, id };

    setToasts((prev) => [...prev, newToast]);

    // Auto-dismiss after duration
    if (toast.duration !== 0) {
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, toast.duration || 5000);
    }

    return id;
  }, []);

  const removeToast = React.useCallback((id: string) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  }, []);

  const clearAll = React.useCallback(() => {
    setToasts([]);
  }, []);

  // Register global toast listener for standalone functions
  React.useEffect(() => {
    setGlobalToastListener(addToast);
    return () => setGlobalToastListener(null);
  }, [addToast]);

  return (
    <ToastContext.Provider value={{ toasts, addToast, removeToast, clearAll }}>
      {children}
      <ToastContainer />
    </ToastContext.Provider>
  );
}

// Toast Container
function ToastContainer() {
  const { toasts } = useToast();

  return (
    <div className="fixed top-4 right-4 z-50 space-y-2 max-w-sm w-full">
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} />
      ))}
    </div>
  );
}

// Toast Item
function ToastItem({ toast }: { toast: Toast }) {
  const { removeToast } = useToast();
  const [isVisible, setIsVisible] = useState(false);
  const [isExiting, setIsExiting] = useState(false);

  useEffect(() => {
    // Trigger entrance animation
    setIsVisible(true);
  }, []);

  const handleDismiss = () => {
    setIsExiting(true);
    setTimeout(() => {
      removeToast(toast.id);
      toast.onDismiss?.();
    }, 300);
  };

  const getIcon = () => {
    switch (toast.type) {
      case "success":
        return <CheckCircle className="w-5 h-5 text-emerald-400" />;
      case "error":
        return <XCircle className="w-5 h-5 text-red-400" />;
      case "warning":
        return <AlertTriangle className="w-5 h-5 text-amber-400" />;
      case "info":
        return <Info className="w-5 h-5 text-blue-400" />;
    }
  };

  const getStyles = () => {
    const base =
      "p-4 rounded-lg border shadow-lg backdrop-blur-sm transition-all duration-300 transform";
    const typeStyles = {
      success: "bg-emerald-950/30 border-emerald-800/50",
      error: "bg-red-950/30 border-red-800/50",
      warning: "bg-amber-950/30 border-amber-800/50",
      info: "bg-blue-950/30 border-blue-800/50",
    };

    return cn(
      base,
      typeStyles[toast.type],
      isVisible && !isExiting
        ? "translate-x-0 opacity-100"
        : "translate-x-full opacity-0",
    );
  };

  return (
    <div className={getStyles()}>
      <div className="flex items-start gap-3">
        {getIcon()}
        <div className="flex-1 min-w-0">
          <h4 className="text-sm font-medium text-white mb-1">{toast.title}</h4>
          {toast.description && (
            <p className="text-sm text-zinc-400">{toast.description}</p>
          )}
          {toast.action && (
            <Button
              variant="ghost"
              size="sm"
              onClick={toast.action.onClick}
              className="mt-2 text-zinc-400 hover:text-white"
            >
              {toast.action.label}
            </Button>
          )}
        </div>
        {toast.dismissible !== false && (
          <Button
            variant="ghost"
            size="sm"
            onClick={handleDismiss}
            className="h-auto p-1 text-zinc-400 hover:text-white"
          >
            <X className="w-4 h-4" />
          </Button>
        )}
      </div>
    </div>
  );
}

// Toast Helper Hooks - Use these inside React components
export function useToastHelpers() {
  const { addToast } = useToast();

  const showSuccess = (
    title: string,
    description?: string,
    options?: Partial<Toast>,
  ) => {
    return addToast({ type: "success", title, description, ...options });
  };

  const showError = (
    title: string,
    description?: string,
    options?: Partial<Toast>,
  ) => {
    return addToast({ type: "error", title, description, ...options });
  };

  const showWarning = (
    title: string,
    description?: string,
    options?: Partial<Toast>,
  ) => {
    return addToast({ type: "warning", title, description, ...options });
  };

  const showInfo = (
    title: string,
    description?: string,
    options?: Partial<Toast>,
  ) => {
    return addToast({ type: "info", title, description, ...options });
  };

  const showAutoSuccess = (title: string, description?: string) => {
    return addToast({ type: "success", title, description, duration: 3000 });
  };

  const showPersistentError = (title: string, description?: string) => {
    return addToast({ type: "error", title, description, duration: 0 });
  };

  const showActionToast = (
    type: ToastType,
    title: string,
    actionLabel: string,
    actionCallback: () => void,
    description?: string,
  ) => {
    return addToast({
      type,
      title,
      description,
      action: {
        label: actionLabel,
        onClick: actionCallback,
      },
      duration: 0,
    });
  };

  return {
    showSuccess,
    showError,
    showWarning,
    showInfo,
    showAutoSuccess,
    showPersistentError,
    showActionToast,
  };
}
