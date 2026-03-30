/**
 * Impersonation Banner
 *
 * Shows a prominent banner when an admin is impersonating a user.
 * Provides controls to end impersonation and shows session info.
 *
 * SECURITY: Always visible during impersonation with clear indicators
 */

"use client";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { logger } from "@/lib/logger";
import { AlertTriangle, Clock, Eye, LogOut, Shield } from "lucide-react";
import { useEffect, useState } from "react";

// =============================================================================
// TYPE DEFINITIONS
// =============================================================================

interface ImpersonationInfo {
  actorUserId: string;
  actorName: string;
  actorEmail: string;
  targetUserId: string;
  targetName: string;
  targetEmail: string;
  sessionId: string;
  startedAt: string;
  reason: string;
  expiresAt: string;
}

// =============================================================================
// IMPERSONATION BANNER COMPONENT
// =============================================================================

export function ImpersonationBanner() {
  const [impersonationInfo, setImpersonationInfo] =
    useState<ImpersonationInfo | null>(null);
  const [timeRemaining, setTimeRemaining] = useState<number>(0);
  const [isEnding, setIsEnding] = useState(false);

  // Check for impersonation on mount and URL changes
  useEffect(() => {
    checkImpersonation();

    // Check URL params for impersonation token
    const urlParams = new URLSearchParams(window.location.search);
    const impersonationToken = urlParams.get("impersonate");

    if (impersonationToken) {
      // Store token and clean URL
      localStorage.setItem("impersonationToken", impersonationToken);
      const newUrl = window.location.pathname;
      window.history.replaceState({}, "", newUrl);
      checkImpersonation();
    }

    // Update timer every second
    const interval = setInterval(() => {
      if (impersonationInfo) {
        const remaining = Math.max(
          0,
          new Date(impersonationInfo.expiresAt).getTime() - Date.now(),
        );
        setTimeRemaining(remaining);

        // Auto-end if expired
        if (remaining === 0) {
          endImpersonation();
        }
      }
    }, 1000);

    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [impersonationInfo]);

  // Check for active impersonation
  const checkImpersonation = async () => {
    const token = localStorage.getItem("impersonationToken");

    if (!token) {
      setImpersonationInfo(null);
      return;
    }

    try {
      // Verify token with API
      const response = await fetch("/api/v1/admin/impersonation/verify", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setImpersonationInfo(data.data);

        // Update auth header for subsequent requests
        // This would typically be handled by your auth provider
        updateAuthContext(token);
      } else {
        // Token invalid, remove it
        localStorage.removeItem("impersonationToken");
        setImpersonationInfo(null);
      }
    } catch (error) {
      logger.logUnknownError("Failed to verify impersonation", error);
      localStorage.removeItem("impersonationToken");
      setImpersonationInfo(null);
    }
  };

  // Update auth context with impersonation token
  const updateAuthContext = (token: string) => {
    // This would integrate with your auth system
    // For now, we'll just store it for API calls
    // In a real implementation, this would update your session/auth context
  };

  // End impersonation
  const endImpersonation = async () => {
    if (isEnding) return;

    setIsEnding(true);

    try {
      const token = localStorage.getItem("impersonationToken");

      if (token) {
        await fetch("/api/v1/admin/impersonate/stop", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
      }

      // Clean up
      localStorage.removeItem("impersonationToken");
      setImpersonationInfo(null);

      // Redirect back to admin dashboard
      window.location.href = "/admin";
    } catch (error) {
      logger.logUnknownError("Failed to end impersonation", error);
      // Still clean up locally even if API call fails
      localStorage.removeItem("impersonationToken");
      setImpersonationInfo(null);
      window.location.href = "/admin";
    } finally {
      setIsEnding(false);
    }
  };

  // Format time remaining
  const formatTimeRemaining = (ms: number): string => {
    const minutes = Math.floor(ms / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    return `${minutes}:${seconds.toString().padStart(2, "0")}`;
  };

  // Get urgency level based on time remaining
  const getUrgencyLevel = (): "default" | "secondary" | "destructive" => {
    if (timeRemaining < 60000) return "destructive"; // Less than 1 minute
    if (timeRemaining < 300000) return "secondary"; // Less than 5 minutes
    return "default";
  };

  if (!impersonationInfo) {
    return null;
  }

  return (
    <Alert className="border-2 border-orange-200 bg-orange-50 dark:border-orange-800 dark:bg-orange-950">
      <div className="flex items-start justify-between w-full">
        <div className="flex items-start space-x-3 flex-1">
          <Shield className="h-5 w-5 text-orange-600 dark:text-orange-400 mt-0.5" />
          <div className="flex-1 space-y-2">
            <div className="flex items-center space-x-2">
              <Badge
                variant="outline"
                className="bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200"
              >
                <Eye className="h-3 w-3 mr-1" />
                IMPERSONATION MODE
              </Badge>
              <span className="text-sm font-medium text-orange-800 dark:text-orange-200">
                You are viewing as:{" "}
                <strong>{impersonationInfo.targetName}</strong> (
                {impersonationInfo.targetEmail})
              </span>
            </div>

            <AlertDescription className="text-orange-700 dark:text-orange-300">
              <div className="space-y-1">
                <p>
                  <strong>Admin:</strong> {impersonationInfo.actorName} (
                  {impersonationInfo.actorEmail})
                </p>
                <p>
                  <strong>Reason:</strong> {impersonationInfo.reason}
                </p>
                <div className="flex items-center space-x-4 text-sm">
                  <span className="flex items-center">
                    <Clock className="h-3 w-3 mr-1" />
                    Started:{" "}
                    {new Date(impersonationInfo.startedAt).toLocaleTimeString()}
                  </span>
                  <span className="flex items-center">
                    <AlertTriangle className="h-3 w-3 mr-1" />
                    Expires in: {formatTimeRemaining(timeRemaining)}
                  </span>
                </div>
              </div>
            </AlertDescription>
          </div>
        </div>

        <div className="flex items-center space-x-2 ml-4">
          <Badge variant={getUrgencyLevel()}>
            {formatTimeRemaining(timeRemaining)}
          </Badge>
          <Button
            variant="outline"
            size="sm"
            onClick={endImpersonation}
            disabled={isEnding}
            className="border-orange-300 text-orange-700 hover:bg-orange-100 dark:border-orange-700 dark:text-orange-300 dark:hover:bg-orange-900"
          >
            {isEnding ? (
              "Ending..."
            ) : (
              <>
                <LogOut className="h-4 w-4 mr-2" />
                End Impersonation
              </>
            )}
          </Button>
        </div>
      </div>
    </Alert>
  );
}

// =============================================================================
// IMPERSONATION HOOK
// =============================================================================

/**
 * Hook to check if current session is impersonated
 */
export function useImpersonation() {
  const [isImpersonated, setIsImpersonated] = useState(false);
  const [impersonationInfo, setImpersonationInfo] =
    useState<ImpersonationInfo | null>(null);

  useEffect(() => {
    const token = localStorage.getItem("impersonationToken");
    setIsImpersonated(!!token);

    if (token) {
      // You could decode the token locally for basic info
      // or fetch from API as shown in the banner component
    }
  }, []);

  return { isImpersonated, impersonationInfo };
}

// =============================================================================
// IMPERSONATION PROVIDER
// =============================================================================

/**
 * Context provider for impersonation state
 * This would wrap your app to provide impersonation context globally
 */
export function ImpersonationProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <ImpersonationBanner />
      {children}
    </>
  );
}
