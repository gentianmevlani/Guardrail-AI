"use client";

import { useCallback, useEffect, useState } from "react";

export const TERMS_VERSION = "2.0";
export const PRIVACY_VERSION = "2.0";

interface TermsAcceptance {
  termsVersion: string;
  privacyVersion: string;
  acceptedAt: string;
  ipHash?: string;
  userAgent?: string;
}

interface UseTermsAcceptanceOptions {
  userId?: string;
  onAccept?: (acceptance: TermsAcceptance) => Promise<void>;
}

interface UseTermsAcceptanceReturn {
  hasAcceptedTerms: boolean;
  hasAcceptedPrivacy: boolean;
  isLoading: boolean;
  error: string | null;
  acceptTerms: () => Promise<void>;
  acceptPrivacy: () => Promise<void>;
  acceptBoth: () => Promise<void>;
  checkAcceptance: () => Promise<void>;
  termsVersion: string;
  privacyVersion: string;
}

export function useTermsAcceptance(
  options: UseTermsAcceptanceOptions = {},
): UseTermsAcceptanceReturn {
  const { userId, onAccept } = options;

  const [hasAcceptedTerms, setHasAcceptedTerms] = useState(false);
  const [hasAcceptedPrivacy, setHasAcceptedPrivacy] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const checkAcceptance = useCallback(async () => {
    if (!userId) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/legal/acceptance?userId=${userId}`);

      if (!response.ok) {
        throw new Error("Failed to check acceptance status");
      }

      const data = await response.json();

      setHasAcceptedTerms(
        data.terms?.version === TERMS_VERSION && data.terms?.accepted,
      );
      setHasAcceptedPrivacy(
        data.privacy?.version === PRIVACY_VERSION && data.privacy?.accepted,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setIsLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    checkAcceptance();
  }, [checkAcceptance]);

  const acceptTerms = useCallback(async () => {
    if (!userId) {
      setError("User ID required");
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const acceptance: TermsAcceptance = {
        termsVersion: TERMS_VERSION,
        privacyVersion: "",
        acceptedAt: new Date().toISOString(),
        userAgent:
          typeof navigator !== "undefined" ? navigator.userAgent : undefined,
      };

      const response = await fetch("/api/legal/acceptance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId,
          docType: "terms",
          version: TERMS_VERSION,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to record terms acceptance");
      }

      setHasAcceptedTerms(true);

      if (onAccept) {
        await onAccept(acceptance);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setIsLoading(false);
    }
  }, [userId, onAccept]);

  const acceptPrivacy = useCallback(async () => {
    if (!userId) {
      setError("User ID required");
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const acceptance: TermsAcceptance = {
        termsVersion: "",
        privacyVersion: PRIVACY_VERSION,
        acceptedAt: new Date().toISOString(),
        userAgent:
          typeof navigator !== "undefined" ? navigator.userAgent : undefined,
      };

      const response = await fetch("/api/legal/acceptance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId,
          docType: "privacy",
          version: PRIVACY_VERSION,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to record privacy acceptance");
      }

      setHasAcceptedPrivacy(true);

      if (onAccept) {
        await onAccept(acceptance);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setIsLoading(false);
    }
  }, [userId, onAccept]);

  const acceptBoth = useCallback(async () => {
    if (!userId) {
      setError("User ID required");
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const acceptance: TermsAcceptance = {
        termsVersion: TERMS_VERSION,
        privacyVersion: PRIVACY_VERSION,
        acceptedAt: new Date().toISOString(),
        userAgent:
          typeof navigator !== "undefined" ? navigator.userAgent : undefined,
      };

      const response = await fetch("/api/legal/acceptance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId,
          acceptBoth: true,
          termsVersion: TERMS_VERSION,
          privacyVersion: PRIVACY_VERSION,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to record acceptance");
      }

      setHasAcceptedTerms(true);
      setHasAcceptedPrivacy(true);

      if (onAccept) {
        await onAccept(acceptance);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setIsLoading(false);
    }
  }, [userId, onAccept]);

  return {
    hasAcceptedTerms,
    hasAcceptedPrivacy,
    isLoading,
    error,
    acceptTerms,
    acceptPrivacy,
    acceptBoth,
    checkAcceptance,
    termsVersion: TERMS_VERSION,
    privacyVersion: PRIVACY_VERSION,
  };
}
