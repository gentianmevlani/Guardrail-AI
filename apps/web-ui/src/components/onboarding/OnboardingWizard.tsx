"use client";

import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { useOnboarding } from "@/hooks/useOnboarding";
import { ONBOARDING_STEPS, OnboardingStep } from "@/lib/api/onboarding";
import { cn } from "@/lib/utils";
import { AnimatePresence, motion } from "framer-motion";
import { AlertTriangle, X } from "lucide-react";
import { useCallback, useState } from "react";

import { ConnectSourceStep } from "./steps/ConnectSourceStep";
import { FirstScanStep } from "./steps/FirstScanStep";
import { ResultsStep } from "./steps/ResultsStep";
import { WelcomeStep } from "./steps/WelcomeStep";

interface OnboardingWizardProps {
  userId: string;
  userName?: string;
  token: string;
  userTier?: "free" | "starter" | "pro" | "compliance";
  onComplete?: () => void;
  onSkip?: () => void;
}

export function OnboardingWizard({
  userId,
  userName,
  token,
  userTier = "free",
  onComplete,
  onSkip,
}: OnboardingWizardProps) {
  const {
    state,
    isLoading,
    currentStep,
    currentStepIndex,
    shouldShowOnboarding,
    nextStep,
    prevStep,
    completeStep,
    skipOnboarding,
    completeOnboarding,
  } = useOnboarding({ userId, token });

  const [showSkipWarning, setShowSkipWarning] = useState(false);
  const [scanResults, setScanResults] = useState<{
    issuesFound: number;
    score: number;
    repoName?: string;
  } | null>(null);

  const handleSkipClick = useCallback(() => {
    setShowSkipWarning(true);
  }, []);

  const handleConfirmSkip = useCallback(async () => {
    await skipOnboarding();
    setShowSkipWarning(false);
    onSkip?.();
  }, [skipOnboarding, onSkip]);

  const handleStepComplete = useCallback(
    async (step: OnboardingStep, data?: Record<string, unknown>) => {
      await completeStep(step, data);
      
      if (step === "results") {
        await completeOnboarding();
        onComplete?.();
      } else {
        await nextStep();
      }
    },
    [completeStep, nextStep, completeOnboarding, onComplete]
  );

  const handleScanComplete = useCallback(
    (results: { issuesFound: number; score: number; repoName?: string }) => {
      setScanResults(results);
      handleStepComplete("first-scan", { firstScanCompleted: true });
    },
    [handleStepComplete]
  );

  if (isLoading || !shouldShowOnboarding) {
    return null;
  }

  const stepComponents: Record<OnboardingStep, React.ReactNode> = {
    welcome: (
      <WelcomeStep
        userName={userName}
        onContinue={() => handleStepComplete("welcome")}
      />
    ),
    "connect-source": (
      <ConnectSourceStep
        onGitHubConnect={() => handleStepComplete("connect-source", { githubConnected: true })}
        onFileUpload={() => handleStepComplete("connect-source")}
        onSkip={() => handleStepComplete("connect-source")}
      />
    ),
    "first-scan": (
      <FirstScanStep
        githubConnected={state?.githubConnected || false}
        onScanComplete={handleScanComplete}
        onBack={prevStep}
      />
    ),
    results: (
      <ResultsStep
        issuesFound={scanResults?.issuesFound || 0}
        score={scanResults?.score || 100}
        repoName={scanResults?.repoName}
        userTier={userTier}
        githubConnected={state?.githubConnected || false}
        onComplete={() => handleStepComplete("results")}
      />
    ),
  };

  return (
    <>
      <Dialog open={shouldShowOnboarding} onOpenChange={() => {}}>
        <DialogContent
          className="sm:max-w-[540px] p-0 gap-0 overflow-hidden"
          hideCloseButton
        >
          <DialogHeader className="px-6 pt-6 pb-4 border-b border-zinc-800">
            <div className="flex items-center justify-between">
              <DialogTitle className="text-xl font-semibold text-zinc-100">
                Get Started with guardrail
              </DialogTitle>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0 text-zinc-500 hover:text-zinc-300"
                onClick={handleSkipClick}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            
            {/* Progress indicator */}
            <div className="flex items-center gap-2 mt-4">
              {ONBOARDING_STEPS.map((step, index) => (
                <div
                  key={step}
                  className={cn(
                    "h-1.5 flex-1 rounded-full transition-colors duration-300",
                    index <= currentStepIndex
                      ? "bg-blue-500"
                      : "bg-zinc-800"
                  )}
                />
              ))}
            </div>
            <p className="text-xs text-zinc-500 mt-2">
              Step {currentStepIndex + 1} of {ONBOARDING_STEPS.length}
            </p>
          </DialogHeader>

          <div className="px-6 py-6 min-h-[320px]">
            <AnimatePresence mode="wait">
              <motion.div
                key={currentStep}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.2 }}
              >
                {stepComponents[currentStep]}
              </motion.div>
            </AnimatePresence>
          </div>
        </DialogContent>
      </Dialog>

      {/* Skip Warning Dialog */}
      <Dialog open={showSkipWarning} onOpenChange={setShowSkipWarning}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-full bg-amber-500/10">
                <AlertTriangle className="h-5 w-5 text-amber-500" />
              </div>
              <DialogTitle>Skip Setup?</DialogTitle>
            </div>
          </DialogHeader>
          <p className="text-sm text-zinc-400 mt-2">
            You&apos;ll miss out on guided setup for connecting your repos and running your first scan. 
            You can always restart onboarding from Settings.
          </p>
          <div className="flex justify-end gap-3 mt-6">
            <Button
              variant="outline"
              onClick={() => setShowSkipWarning(false)}
              className="border-zinc-700"
            >
              Continue Setup
            </Button>
            <Button
              variant="ghost"
              onClick={handleConfirmSkip}
              className="text-zinc-400 hover:text-zinc-200"
            >
              Skip Anyway
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
