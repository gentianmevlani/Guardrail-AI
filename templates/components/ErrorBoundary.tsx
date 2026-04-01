/**
 * Error Boundary Component
 * 
 * Catches React errors and displays a beautiful error UI
 * Automatically included in templates - AI agents often miss this!
 */

import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';
import './ErrorBoundary.css';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      error,
      errorInfo: null,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Log error to error reporting service
    console.error('ErrorBoundary caught an error:', error, errorInfo);
    
    this.setState({
      error,
      errorInfo,
    });

    // Call custom error handler if provided
    this.props.onError?.(error, errorInfo);
  }

  handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
  };

  handleReload = () => {
    window.location.reload();
  };

  handleGoHome = () => {
    window.location.href = '/';
  };

  render() {
    if (this.state.hasError) {
      // Use custom fallback if provided
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // Default error UI
      return (
        <div className="error-boundary">
          <div className="error-boundary__container">
            <div className="error-boundary__icon">
              <AlertTriangle className="w-16 h-16 text-red-500" />
            </div>
            
            <h1 className="error-boundary__title">Something went wrong</h1>
            <p className="error-boundary__message">
              We're sorry, but something unexpected happened. Our team has been notified.
            </p>

            {this.state.error && (
              <details className="error-boundary__details">
                <summary className="error-boundary__summary">
                  Error Details (for developers)
                </summary>
                <div className="error-boundary__error-info">
                  <p className="error-boundary__error-message">
                    {this.state.error.toString()}
                  </p>
                  {this.state.errorInfo && (
                    <pre className="error-boundary__stack">
                      {this.state.errorInfo.componentStack}
                    </pre>
                  )}
                </div>
              </details>
            )}

            <div className="error-boundary__actions">
              <button
                onClick={this.handleReset}
                className="error-boundary__button error-boundary__button--primary"
              >
                <RefreshCw className="w-5 h-5" />
                Try Again
              </button>
              <button
                onClick={this.handleReload}
                className="error-boundary__button error-boundary__button--secondary"
              >
                Reload Page
              </button>
              <button
                onClick={this.handleGoHome}
                className="error-boundary__button error-boundary__button--secondary"
              >
                <Home className="w-5 h-5" />
                Go Home
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

/**
 * Hook for error boundary (for functional components)
 */
export function useErrorHandler() {
  return (error: Error, errorInfo?: ErrorInfo) => {
    // Throw error to be caught by ErrorBoundary
    throw error;
  };
}

export default ErrorBoundary;

