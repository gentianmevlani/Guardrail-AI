"use client";

import {
    ONBOARDING_STEPS,
    OnboardingState,
    OnboardingStep,
    completeOnboarding as apiCompleteOnboarding,
    resetOnboarding as apiResetOnboarding,
    skipOnboarding as apiSkipOnboarding,
    createOnboardingState,
    getOnboardingState,
    updateOnboardingStep,
} from "@/lib/api/onboarding";
import { useCallback, useEffect, useState } from "react";

interface UseOnboardingOptions {
  userId: string | null;
  token: string | null;
  autoCreate?: boolean;
}

interface UseOnboardingReturn {
  state: OnboardingState | null;
  isLoading: boolean;
  error: Error | null;
  currentStep: OnboardingStep;
  currentStepIndex: number;
  isComplete: boolean;
  isSkipped: boolean;
  shouldShowOnboarding: boolean;
  nextStep: () => Promise<void>;
  prevStep: () => void;
  goToStep: (step: OnboardingStep) => void;
  completeStep: (step: OnboardingStep, data?: Partial<OnboardingState>) => Promise<void>;
  skipOnboarding: () => Promise<void>;
  completeOnboarding: () => Promise<void>;
  resetOnboarding: () => Promise<void>;
  refetch: () => Promise<void>;
}

export function useOnboarding({
  userId,
  token,
  autoCreate = true,
}: UseOnboardingOptions): UseOnboardingReturn {
  const [state, setState] = useState<OnboardingState | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [localStepIndex, setLocalStepIndex] = useState(0);

  const fetchState = useCallback(async () => {
    if (!userId || !token) {
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      let onboardingState = await getOnboardingState(userId, token);

      if (!onboardingState && autoCreate) {
        onboardingState = await createOnboardingState(userId, token);
      }

      setState(onboardingState);
      if (onboardingState) {
        setLocalStepIndex(onboardingState.currentStep);
      }
    } catch (err) {
      setError(err instanceof Error ? err : new Error("Failed to fetch onboarding state"));
    } finally {
      setIsLoading(false);
    }
  }, [userId, token, autoCreate]);

  useEffect(() => {
    fetchState();
  }, [fetchState]);

  const currentStep = ONBOARDING_STEPS[localStepIndex] || "welcome";
  const isComplete = state?.completedAt !== null;
  const isSkipped = state?.skippedAt !== null;
  const shouldShowOnboarding = !isLoading && state !== null && !isComplete && !isSkipped;

  const nextStep = useCallback(async () => {
    if (localStepIndex < ONBOARDING_STEPS.length - 1) {
      setLocalStepIndex((prev) => prev + 1);
    }
  }, [localStepIndex]);

  const prevStep = useCallback(() => {
    if (localStepIndex > 0) {
      setLocalStepIndex((prev) => prev - 1);
    }
  }, [localStepIndex]);

  const goToStep = useCallback((step: OnboardingStep) => {
    const index = ONBOARDING_STEPS.indexOf(step);
    if (index !== -1) {
      setLocalStepIndex(index);
    }
  }, []);

  const completeStep = useCallback(
    async (step: OnboardingStep, data?: Partial<OnboardingState>) => {
      if (!userId || !token) return;

      try {
        const updatedState = await updateOnboardingStep(userId, token, step, data);
        setState(updatedState);
      } catch (err) {
        setError(err instanceof Error ? err : new Error("Failed to complete step"));
        throw err;
      }
    },
    [userId, token]
  );

  const skipOnboarding = useCallback(async () => {
    if (!userId || !token) return;

    try {
      const updatedState = await apiSkipOnboarding(userId, token);
      setState(updatedState);
    } catch (err) {
      setError(err instanceof Error ? err : new Error("Failed to skip onboarding"));
      throw err;
    }
  }, [userId, token]);

  const completeOnboarding = useCallback(async () => {
    if (!userId || !token) return;

    try {
      const updatedState = await apiCompleteOnboarding(userId, token);
      setState(updatedState);
    } catch (err) {
      setError(err instanceof Error ? err : new Error("Failed to complete onboarding"));
      throw err;
    }
  }, [userId, token]);

  const resetOnboarding = useCallback(async () => {
    if (!userId || !token) return;

    try {
      const updatedState = await apiResetOnboarding(userId, token);
      setState(updatedState);
      setLocalStepIndex(0);
    } catch (err) {
      setError(err instanceof Error ? err : new Error("Failed to reset onboarding"));
      throw err;
    }
  }, [userId, token]);

  return {
    state,
    isLoading,
    error,
    currentStep,
    currentStepIndex: localStepIndex,
    isComplete,
    isSkipped,
    shouldShowOnboarding,
    nextStep,
    prevStep,
    goToStep,
    completeStep,
    skipOnboarding,
    completeOnboarding,
    resetOnboarding,
    refetch: fetchState,
  };
}
