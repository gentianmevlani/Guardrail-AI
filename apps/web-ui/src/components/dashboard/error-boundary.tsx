"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { logger } from "@/lib/logger";
import { AlertTriangle, RefreshCw } from "lucide-react";
import React, { Component, type ReactNode } from "react";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    logger.error("ErrorBoundary caught an error:", {
      error: error.message,
      stack: error.stack,
      componentStack: errorInfo.componentStack,
    });
    this.props.onError?.(error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <Card className="bg-red-950/30 border-red-800/50">
          <CardHeader>
            <CardTitle className="text-red-400 flex items-center gap-2">
              <AlertTriangle className="h-5 w-5" />
              Something went wrong
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              An error occurred while rendering this component. This has been
              logged for investigation.
            </p>
            {this.state.error && (
              <div className="space-y-2">
                <p className="text-xs font-medium text-red-300">
                  {this.state.error.message}
                </p>
                {process.env.NODE_ENV === 'development' && this.state.error.stack && (
                  <details className="mt-2">
                    <summary className="text-xs text-muted-foreground cursor-pointer mb-1">
                      Stack trace (development only)
                    </summary>
                    <pre className="text-xs text-red-300 bg-black/30 p-3 rounded-lg overflow-auto max-h-32">
                      {this.state.error.stack}
                    </pre>
                  </details>
                )}
              </div>
            )}
            <div className="flex gap-3">
              <Button
                variant="outline"
                size="sm"
                onClick={this.handleReset}
                className="border-red-700 text-red-400 hover:bg-red-950/50"
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Try Again
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => window.location.reload()}
                className="text-muted-foreground"
              >
                Reload Page
              </Button>
            </div>
          </CardContent>
        </Card>
      );
    }

    return this.props.children;
  }
}

interface AsyncBoundaryProps {
  children: ReactNode;
  loading?: ReactNode;
  error?: ReactNode;
}

export function AsyncBoundary({
  children,
  loading,
  error,
}: AsyncBoundaryProps) {
  return (
    <ErrorBoundary fallback={error}>
      <React.Suspense fallback={loading || <DefaultLoading />}>
        {children}
      </React.Suspense>
    </ErrorBoundary>
  );
}

function DefaultLoading() {
  return (
    <div className="flex items-center justify-center p-8">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
    </div>
  );
}

export default ErrorBoundary;
