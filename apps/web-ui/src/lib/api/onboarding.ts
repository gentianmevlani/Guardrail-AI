"use server";

import { logger } from "../logger";

export interface OnboardingState {
  id: string;
  userId: string;
  completedSteps: string[];
  currentStep: number;
  githubConnected: boolean;
  firstScanCompleted: boolean;
  firstRepoId: string | null;
  skippedAt: Date | null;
  completedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export type OnboardingStep = "welcome" | "connect-source" | "first-scan" | "results";

export const ONBOARDING_STEPS: OnboardingStep[] = [
  "welcome",
  "connect-source",
  "first-scan",
  "results",
];

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "";

export async function getOnboardingState(
  userId: string,
  token: string
): Promise<OnboardingState | null> {
  try {
    const response = await fetch(`${API_BASE}/api/onboarding/${userId}`, {
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      cache: "no-store",
    });

    if (!response.ok) {
      if (response.status === 404) {
        return null;
      }
      throw new Error(`Failed to fetch onboarding state: ${response.status}`);
    }

    return response.json();
  } catch (error) {
    logger.error("Error fetching onboarding state", {
      error: error instanceof Error ? error.message : String(error),
      userId,
      component: 'onboarding-api'
    });
    return null;
  }
}

export async function createOnboardingState(
  userId: string,
  token: string
): Promise<OnboardingState> {
  const response = await fetch(`${API_BASE}/api/onboarding`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ userId }),
  });

  if (!response.ok) {
    throw new Error(`Failed to create onboarding state: ${response.status}`);
  }

  return response.json();
}

export async function updateOnboardingStep(
  userId: string,
  token: string,
  step: OnboardingStep,
  data?: Partial<OnboardingState>
): Promise<OnboardingState> {
  const stepIndex = ONBOARDING_STEPS.indexOf(step);
  
  const response = await fetch(`${API_BASE}/api/onboarding/${userId}`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      completedStep: step,
      currentStep: stepIndex + 1,
      ...data,
    }),
  });

  if (!response.ok) {
    throw new Error(`Failed to update onboarding step: ${response.status}`);
  }

  return response.json();
}

export async function skipOnboarding(
  userId: string,
  token: string
): Promise<OnboardingState> {
  const response = await fetch(`${API_BASE}/api/onboarding/${userId}/skip`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to skip onboarding: ${response.status}`);
  }

  return response.json();
}

export async function completeOnboarding(
  userId: string,
  token: string
): Promise<OnboardingState> {
  const response = await fetch(`${API_BASE}/api/onboarding/${userId}/complete`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to complete onboarding: ${response.status}`);
  }

  return response.json();
}

export async function resetOnboarding(
  userId: string,
  token: string
): Promise<OnboardingState> {
  const response = await fetch(`${API_BASE}/api/onboarding/${userId}/reset`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to reset onboarding: ${response.status}`);
  }

  return response.json();
}
