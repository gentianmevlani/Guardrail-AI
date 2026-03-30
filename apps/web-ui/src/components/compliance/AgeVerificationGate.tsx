/**
 * Age Verification Gate
 *
 * Minimal but defensible age verification component for GDPR compliance.
 * Requires users to confirm they are at least 16 years old.
 */

import { logger } from "@/lib/logger";
import { AlertCircle, Calendar, CheckCircle, Shield } from "lucide-react";
import { useEffect, useState } from "react";

interface AgeVerificationGateProps {
  onVerified?: () => void;
  minimumAge?: number;
  className?: string;
}

export function AgeVerificationGate({
  onVerified,
  minimumAge = 16,
  className = "",
}: AgeVerificationGateProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [isVerified, setIsVerified] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedAge, setSelectedAge] = useState<number | null>(null);

  // Check verification status on mount
  useEffect(() => {
    checkVerificationStatus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const checkVerificationStatus = async () => {
    try {
      const response = await fetch("/api/v1/legal/age/status");
      if (response.ok) {
        const data = await response.json();
        if (data.data.isAgeConfirmed) {
          setIsVerified(true);
          onVerified?.();
        } else {
          setIsVisible(true);
        }
      } else {
        setIsVisible(true);
      }
    } catch (error) {
      logger.logUnknownError("Failed to check age verification status", error);
      setIsVisible(true);
    }
  };

  const handleAgeConfirmation = async (age: number) => {
    if (age < minimumAge) {
      setError(
        `You must be at least ${minimumAge} years old to use guardrail.`,
      );
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/v1/legal/age/confirm", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ age }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to verify age");
      }

      setIsVerified(true);
      setIsVisible(false);
      onVerified?.();
    } catch (error) {
      setError(error instanceof Error ? error.message : "Failed to verify age");
    } finally {
      setIsLoading(false);
    }
  };

  const handleCheckboxConfirmation = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/v1/legal/age/confirm", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ age: minimumAge }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to verify age");
      }

      setIsVerified(true);
      setIsVisible(false);
      onVerified?.();
    } catch (error) {
      setError(error instanceof Error ? error.message : "Failed to verify age");
    } finally {
      setIsLoading(false);
    }
  };

  if (isVerified || !isVisible) return null;

  return (
    <div
      className={`fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 ${className}`}
    >
      <div className="bg-white rounded-lg max-w-md w-full p-6">
        {/* Header */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-12 h-12 bg-blue-100 rounded-full mb-4">
            <Shield className="w-6 h-6 text-blue-600" />
          </div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">
            Age Verification Required
          </h2>
          <p className="text-gray-600 text-sm">
            guardrail requires age verification to comply with privacy
            regulations.
          </p>
        </div>

        {/* Content */}
        <div className="space-y-4">
          {/* Age Selection Method */}
          <div className="border rounded-lg p-4">
            <h3 className="font-medium mb-3 flex items-center gap-2">
              <Calendar className="w-4 h-4" />
              Confirm Your Age
            </h3>

            {/* Simple Checkbox Method */}
            <div className="space-y-3">
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={selectedAge !== null}
                  onChange={(e) => {
                    if (e.target.checked) {
                      setSelectedAge(minimumAge);
                    } else {
                      setSelectedAge(null);
                    }
                  }}
                  className="mt-1 w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                />
                <div>
                  <p className="text-sm font-medium">
                    I confirm that I am at least {minimumAge} years old
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    This information is used for compliance purposes only
                  </p>
                </div>
              </label>
            </div>
          </div>

          {/* Legal Notice */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
              <div>
                <h4 className="text-sm font-medium text-blue-800 mb-1">
                  Privacy Notice
                </h4>
                <p className="text-xs text-blue-700">
                  Your age verification is stored securely and used only to
                  ensure compliance with privacy laws like GDPR and COPPA. This
                  information will not be used for marketing or shared with
                  third parties.
                </p>
              </div>
            </div>
          </div>

          {/* Error Display */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3">
              <div className="flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-red-600 mt-0.5 flex-shrink-0" />
                <p className="text-sm text-red-700">{error}</p>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="space-y-2">
            <button
              onClick={handleCheckboxConfirmation}
              disabled={selectedAge === null || isLoading}
              className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Verifying...
                </>
              ) : (
                <>
                  <CheckCircle className="w-4 h-4" />
                  Confirm and Continue
                </>
              )}
            </button>

            <button
              onClick={() => window.history.back()}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors text-sm"
            >
              Go Back
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-6 pt-4 border-t text-center">
          <p className="text-xs text-gray-500">
            Questions? Contact{" "}
            <a
              href="mailto:privacy@guardrail.dev"
              className="text-blue-600 hover:underline"
            >
              privacy@guardrail.dev
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
