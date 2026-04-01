"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import {
    AlertTriangle,
    ArrowLeft,
    Bug,
    RefreshCw,
    Shield,
    WifiOff,
    XCircle
} from "lucide-react";
import React from "react";
import { logger } from "@/lib/logger";

// Error Types
export type ErrorType = 
  | "network"
  | "timeout"
  | "permission"
  | "not-found"
  | "server-error"
  | "validation"
  | "quota-exceeded"
  | "unknown";

// Base Error State Component
interface ErrorStateProps {
  type?: ErrorType;
  title?: string;
  description?: string;
  error?: Error | null;
  action?: {
    label: string;
    onClick: () => void;
    variant?: "default" | "outline" | "secondary";
    icon?: React.ReactNode;
  };
  secondaryAction?: {
    label: string;
    onClick: () => void;
  };
  showDetails?: boolean;
  className?: string;
  size?: "sm" | "md" | "lg";
}

export function ErrorState({
  type = "unknown",
  title,
  description,
  error,
  action,
  secondaryAction,
  showDetails = false,
  className,
  size = "md"
}: ErrorStateProps) {
  const errorConfig = {
    network: {
      icon: <WifiOff className="w-full h-full text-red-400" />,
      defaultTitle: "Network Error",
      defaultDescription: "Unable to connect to the server. Please check your internet connection and try again."
    },
    timeout: {
      icon: <AlertTriangle className="w-full h-full text-amber-400" />,
      defaultTitle: "Request Timeout",
      defaultDescription: "The request took too long to complete. Please try again."
    },
    permission: {
      icon: <Shield className="w-full h-full text-amber-400" />,
      defaultTitle: "Permission Denied",
      defaultDescription: "You don't have permission to access this resource. Contact your administrator if you think this is an error."
    },
    "not-found": {
      icon: <XCircle className="w-full h-full text-zinc-400" />,
      defaultTitle: "Not Found",
      defaultDescription: "The requested resource could not be found."
    },
    "server-error": {
      icon: <Bug className="w-full h-full text-red-400" />,
      defaultTitle: "Server Error",
      defaultDescription: "Something went wrong on our end. Our team has been notified and is working on a fix."
    },
    validation: {
      icon: <AlertTriangle className="w-full h-full text-amber-400" />,
      defaultTitle: "Validation Error",
      defaultDescription: "The provided data is invalid. Please check your input and try again."
    },
    "quota-exceeded": {
      icon: <AlertTriangle className="w-full h-full text-amber-400" />,
      defaultTitle: "Quota Exceeded",
      defaultDescription: "You've reached your usage limit. Upgrade your plan to continue using this feature."
    },
    unknown: {
      icon: <AlertTriangle className="w-full h-full text-red-400" />,
      defaultTitle: "Something Went Wrong",
      defaultDescription: "An unexpected error occurred. Please try again or contact support if the problem persists."
    }
  };

  const config = errorConfig[type];
  const sizeClasses = {
    sm: "p-6",
    md: "p-8",
    lg: "p-12"
  };

  const iconSizes = {
    sm: "w-8 h-8",
    md: "w-12 h-12",
    lg: "w-16 h-16"
  };

  return (
    <div className={cn(
      "flex flex-col items-center justify-center text-center space-y-4 rounded-lg border border-red-800/30 bg-red-950/10",
      sizeClasses[size],
      className
    )}>
      <div className={cn(
        "flex items-center justify-center rounded-full bg-red-950/30 p-3",
        iconSizes[size]
      )}>
        {config.icon}
      </div>
      <div className="space-y-2 max-w-md">
        <h3 className="text-lg font-semibold text-white">{title || config.defaultTitle}</h3>
        <p className="text-sm text-zinc-400">{description || config.defaultDescription}</p>
      </div>
      
      {showDetails && error && (
        <details className="text-left">
          <summary className="text-xs text-zinc-500 cursor-pointer hover:text-zinc-400">
            Error details
          </summary>
          <pre className="mt-2 p-3 bg-zinc-900 rounded text-xs text-zinc-500 overflow-auto">
            {error.stack || error.message}
          </pre>
        </details>
      )}

      <div className="flex flex-col sm:flex-row gap-2">
        {action && (
          <Button
            onClick={action.onClick}
            variant={action.variant || "default"}
            className="flex items-center gap-2"
          >
            {action.icon}
            {action.label}
          </Button>
        )}
        {secondaryAction && (
          <Button
            variant="ghost"
            onClick={secondaryAction.onClick}
            className="text-zinc-400 hover:text-white"
          >
            {secondaryAction.label}
          </Button>
        )}
      </div>
    </div>
  );
}

// Specific Error State Variants

export function NetworkError({ onRetry }: { onRetry?: () => void }) {
  return (
    <ErrorState
      type="network"
      action={onRetry ? {
        label: "Try Again",
        onClick: onRetry,
        icon: <RefreshCw className="w-4 h-4" />
      } : undefined}
    />
  );
}

export function TimeoutError({ onRetry }: { onRetry?: () => void }) {
  return (
    <ErrorState
      type="timeout"
      action={onRetry ? {
        label: "Retry Request",
        onClick: onRetry,
        icon: <RefreshCw className="w-4 h-4" />
      } : undefined}
    />
  );
}

export function PermissionError({ onRequestAccess }: { onRequestAccess?: () => void }) {
  return (
    <ErrorState
      type="permission"
      action={onRequestAccess ? {
        label: "Request Access",
        onClick: onRequestAccess,
        icon: <Shield className="w-4 h-4" />
      } : undefined}
    />
  );
}

export function NotFoundError({ onGoBack }: { onGoBack?: () => void }) {
  return (
    <ErrorState
      type="not-found"
      action={onGoBack ? {
        label: "Go Back",
        onClick: onGoBack,
        icon: <ArrowLeft className="w-4 h-4" />
      } : undefined}
    />
  );
}

export function ServerError({ onRetry, onReport }: { 
  onRetry?: () => void;
  onReport?: () => void;
}) {
  return (
    <ErrorState
      type="server-error"
      action={onRetry ? {
        label: "Try Again",
        onClick: onRetry,
        icon: <RefreshCw className="w-4 h-4" />
      } : undefined}
      secondaryAction={onReport ? {
        label: "Report Issue",
        onClick: onReport
      } : undefined}
      showDetails={true}
    />
  );
}

export function ValidationError({ onFix }: { onFix?: () => void }) {
  return (
    <ErrorState
      type="validation"
      action={onFix ? {
        label: "Fix Issues",
        onClick: onFix,
        icon: <AlertTriangle className="w-4 h-4" />
      } : undefined}
    />
  );
}

export function QuotaExceededError({ onUpgrade }: { onUpgrade?: () => void }) {
  return (
    <ErrorState
      type="quota-exceeded"
      action={onUpgrade ? {
        label: "Upgrade Plan",
        onClick: onUpgrade,
        icon: <Shield className="w-4 h-4" />
      } : undefined}
    />
  );
}

// Error Alert Component
interface ErrorAlertProps {
  error: Error | string;
  variant?: "default" | "destructive";
  showIcon?: boolean;
  dismissible?: boolean;
  onDismiss?: () => void;
  className?: string;
}

export function ErrorAlert({
  error,
  variant = "destructive",
  showIcon = true,
  dismissible = false,
  onDismiss,
  className
}: ErrorAlertProps) {
  const errorMessage = typeof error === 'string' ? error : error.message;
  
  return (
    <div className={cn(
      "relative flex items-start gap-3 p-4 rounded-lg border",
      variant === "destructive" 
        ? "border-red-800/30 bg-red-950/10 text-red-400"
        : "border-zinc-800 bg-zinc-900/50 text-zinc-300",
      className
    )}>
      {showIcon && <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0" />}
      <div className="flex-1 space-y-1">
        <div className="font-medium">Error</div>
        <div className="text-sm opacity-90">{errorMessage}</div>
      </div>
      {dismissible && onDismiss && (
        <Button
          variant="ghost"
          size="sm"
          onClick={onDismiss}
          className="h-auto p-1 hover:bg-zinc-800/50"
        >
          <XCircle className="h-3 w-3" />
        </Button>
      )}
    </div>
  );
}

// Inline Error Component
interface InlineErrorProps {
  error: Error | string;
  onRetry?: () => void;
  onDismiss?: () => void;
  className?: string;
}

export function InlineError({ error, onRetry, onDismiss, className }: InlineErrorProps) {
  const errorMessage = typeof error === 'string' ? error : error.message;
  
  return (
    <div className={cn(
      "flex items-center gap-3 p-3 rounded-lg border border-red-800/30 bg-red-950/10",
      className
    )}>
      <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0" />
      <span className="text-sm text-red-400 flex-1">{errorMessage}</span>
      <div className="flex items-center gap-1">
        {onRetry && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onRetry}
            className="h-auto p-1 text-red-400 hover:text-red-300"
          >
            <RefreshCw className="w-3 h-3" />
          </Button>
        )}
        {onDismiss && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onDismiss}
            className="h-auto p-1 text-red-400 hover:text-red-300"
          >
            <XCircle className="w-3 h-3" />
          </Button>
        )}
      </div>
    </div>
  );
}

// Card Error State
export function ErrorCard({ 
  title, 
  description, 
  error,
  action,
  className 
}: { 
  title: string; 
  description: string; 
  error?: Error | null;
  action?: ErrorStateProps['action'];
  className?: string;
}) {
  return (
    <Card className={cn("bg-red-950/20 border-red-800/30", className)}>
      <CardHeader>
        <CardTitle className="text-red-400 flex items-center gap-2">
          <AlertTriangle className="w-5 h-5" />
          {title}
        </CardTitle>
        <CardDescription className="text-red-300">
          {description}
        </CardDescription>
      </CardHeader>
      {error && (
        <CardContent className="pt-0">
          <details className="text-xs text-red-400">
            <summary className="cursor-pointer hover:text-red-300">
              Technical details
            </summary>
            <pre className="mt-2 p-2 bg-red-950/30 rounded overflow-auto">
              {error.stack || error.message}
            </pre>
          </details>
        </CardContent>
      )}
      {action && (
        <CardContent className="pt-0">
          <Button onClick={action.onClick} variant="outline" className="border-red-800/50 text-red-400 hover:bg-red-950/30">
            {action.icon}
            {action.label}
          </Button>
        </CardContent>
      )}
    </Card>
  );
}

// Smart Error Container
interface SmartErrorProps {
  error?: Error | null;
  children: React.ReactNode;
  fallback?: React.ReactNode;
  onError?: (error: Error) => void;
}

export function SmartError({
  error,
  children,
  fallback,
  onError
}: SmartErrorProps) {
  if (error) {
    onError?.(error);
    return fallback || <InlineError error={error} />;
  }

  return <>{children}</>;
}

// Error Boundary Component
interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends React.Component<
  React.PropsWithChildren<{
    fallback?: React.ReactNode;
    onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
  }>,
  ErrorBoundaryState
> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    this.props.onError?.(error, errorInfo);
    logger.error('Error boundary caught', {
      error: error.message,
      stack: error.stack,
      componentStack: errorInfo.componentStack,
      component: 'ErrorBoundary'
    });
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback || (
        <ServerError 
          onRetry={() => this.setState({ hasError: false, error: undefined })}
          onReport={() => window.open('https://github.com/guardiavault/guardrail/issues', '_blank')}
        />
      );
    }

    return this.props.children;
  }
}
