"use client";

import { useOnboarding } from "@/hooks/useOnboarding";
import { OnboardingState, OnboardingStep } from "@/lib/api/onboarding";
import { createContext, ReactNode, useContext } from "react";
import { OnboardingWizard } from "./OnboardingWizard";

interface OnboardingContextValue {
  state: OnboardingState | null;
  isLoading: boolean;
  isComplete: boolean;
  isSkipped: boolean;
  shouldShowOnboarding: boolean;
  currentStep: OnboardingStep;
  resetOnboarding: () => Promise<void>;
}

const OnboardingContext = createContext<OnboardingContextValue | null>(null);

interface OnboardingProviderProps {
  children: ReactNode;
  userId: string | null;
  userName?: string;
  token: string | null;
  userTier?: "free" | "starter" | "pro" | "compliance";
}

export function OnboardingProvider({
  children,
  userId,
  userName,
  token,
  userTier = "free",
}: OnboardingProviderProps) {
  const onboarding = useOnboarding({
    userId,
    token,
    autoCreate: true,
  });

  return (
    <OnboardingContext.Provider
      value={{
        state: onboarding.state,
        isLoading: onboarding.isLoading,
        isComplete: onboarding.isComplete,
        isSkipped: onboarding.isSkipped,
        shouldShowOnboarding: onboarding.shouldShowOnboarding,
        currentStep: onboarding.currentStep,
        resetOnboarding: onboarding.resetOnboarding,
      }}
    >
      {children}
      {userId && token && onboarding.shouldShowOnboarding && (
        <OnboardingWizard
          userId={userId}
          userName={userName}
          token={token}
          userTier={userTier}
          onComplete={() => {
            window.location.reload();
          }}
          onSkip={() => {
            window.location.reload();
          }}
        />
      )}
    </OnboardingContext.Provider>
  );
}

export function useOnboardingContext() {
  const context = useContext(OnboardingContext);
  if (!context) {
    throw new Error("useOnboardingContext must be used within OnboardingProvider");
  }
  return context;
}
