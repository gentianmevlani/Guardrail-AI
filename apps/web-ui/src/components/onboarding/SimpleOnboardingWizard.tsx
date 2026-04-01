"use client";

import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight, CheckCircle, Github, Shield, Terminal, X } from "lucide-react";
import { useCallback, useState } from "react";

interface SimpleOnboardingWizardProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete?: () => void;
}

const STEPS = [
  {
    id: "welcome",
    title: "Welcome to guardrail",
    description: "AI-native code security and guardrail platform",
  },
  {
    id: "cli",
    title: "Install the CLI",
    description: "Get started with the guardrail command-line tool",
  },
  {
    id: "scan",
    title: "Run Your First Scan",
    description: "Analyze your codebase for security issues",
  },
  {
    id: "dashboard",
    title: "View Results",
    description: "Monitor your security score and track improvements",
  },
];

export function SimpleOnboardingWizard({
  isOpen,
  onClose,
  onComplete,
}: SimpleOnboardingWizardProps) {
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const currentStep = STEPS[currentStepIndex];

  const handleNext = useCallback(() => {
    if (currentStepIndex < STEPS.length - 1) {
      setCurrentStepIndex(currentStepIndex + 1);
    } else {
      onComplete?.();
      onClose();
    }
  }, [currentStepIndex, onComplete, onClose]);

  const handlePrevious = useCallback(() => {
    if (currentStepIndex > 0) {
      setCurrentStepIndex(currentStepIndex - 1);
    }
  }, [currentStepIndex]);

  const renderStepContent = () => {
    switch (currentStep.id) {
      case "welcome":
        return (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6"
          >
            <div className="text-center space-y-4">
              <div className="mx-auto w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-600 rounded-2xl flex items-center justify-center">
                <Shield className="w-8 h-8 text-white" />
              </div>
              <div>
                <h3 className="text-2xl font-bold text-gray-900">
                  Welcome to guardrail
                </h3>
                <p className="text-gray-600 mt-2">
                  AI-native code security and guardrail platform
                </p>
              </div>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h4 className="font-semibold text-blue-900 mb-2">What you'll learn:</h4>
              <ul className="space-y-2 text-sm text-blue-800">
                <li className="flex items-start gap-2">
                  <CheckCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                  <span>Install and configure the guardrail CLI</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                  <span>Run comprehensive security scans on your code</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                  <span>Monitor security scores and track improvements</span>
                </li>
              </ul>
            </div>
          </motion.div>
        );

      case "cli":
        return (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6"
          >
            <div className="text-center space-y-4">
              <Terminal className="w-12 h-12 text-gray-600 mx-auto" />
              <h3 className="text-xl font-bold text-gray-900">
                Install the guardrail CLI
              </h3>
            </div>

            <div className="bg-gray-900 rounded-lg p-4 font-mono text-sm">
              <div className="text-green-400"># Install via npm</div>
              <div className="text-white">npm install -g @guardrail/cli</div>
              <div className="mt-3 text-green-400"># Or via pnpm</div>
              <div className="text-white">pnpm add -g @guardrail/cli</div>
            </div>

            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
              <h4 className="font-semibold text-amber-900 mb-2">Quick Start:</h4>
              <ol className="space-y-2 text-sm text-amber-800 list-decimal list-inside">
                <li>Install the CLI using the command above</li>
                <li>Navigate to your project directory</li>
                <li>Run <code className="bg-amber-100 px-1 rounded">guardrail scan</code></li>
                <li>View results in this dashboard</li>
              </ol>
            </div>
          </motion.div>
        );

      case "scan":
        return (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6"
          >
            <div className="text-center space-y-4">
              <Github className="w-12 h-12 text-gray-600 mx-auto" />
              <h3 className="text-xl font-bold text-gray-900">
                Run Your First Scan
              </h3>
            </div>

            <div className="space-y-4">
              <div className="bg-gray-900 rounded-lg p-4 font-mono text-sm">
                <div className="text-green-400"># Navigate to your project</div>
                <div className="text-white">cd your-project</div>
                <div className="mt-3 text-green-400"># Run a comprehensive scan</div>
                <div className="text-white">guardrail scan</div>
                <div className="mt-3 text-green-400"># Or scan with fixes</div>
                <div className="text-white">guardrail scan --fix</div>
              </div>

              <div className="grid grid-cols-1 gap-3">
                <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                  <h4 className="font-semibold text-green-900 text-sm">What guardrail Scans:</h4>
                  <ul className="text-xs text-green-800 mt-1 space-y-1">
                    <li>• Security vulnerabilities</li>
                    <li>• Code quality issues</li>
                    <li>• Dependency problems</li>
                    <li>• Configuration errors</li>
                  </ul>
                </div>
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                  <h4 className="font-semibold text-blue-900 text-sm">Scan Results:</h4>
                  <ul className="text-xs text-blue-800 mt-1 space-y-1">
                    <li>• Overall security score (0-100)</li>
                    <li>• Detailed issue reports</li>
                    <li>• Fix recommendations</li>
                    <li>• Trend tracking</li>
                  </ul>
                </div>
              </div>
            </div>
          </motion.div>
        );

      case "dashboard":
        return (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6"
          >
            <div className="text-center space-y-4">
              <Shield className="w-12 h-12 text-gray-600 mx-auto" />
              <h3 className="text-xl font-bold text-gray-900">
                View Results in Dashboard
              </h3>
            </div>

            <div className="space-y-4">
              <div className="bg-gradient-to-r from-green-50 to-blue-50 border border-green-200 rounded-lg p-4">
                <h4 className="font-semibold text-gray-900 mb-3">Dashboard Features:</h4>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                    <span className="text-gray-700">Security Score</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                    <span className="text-gray-700">Issue Tracking</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
                    <span className="text-gray-700">Trend Analysis</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-amber-500 rounded-full"></div>
                    <span className="text-gray-700">Team Reports</span>
                  </div>
                </div>
              </div>

              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                <h4 className="font-semibold text-gray-900 mb-2">Next Steps:</h4>
                <ol className="text-sm text-gray-700 space-y-1 list-decimal list-inside">
                  <li>Run your first scan using the CLI</li>
                  <li>Results will appear here automatically</li>
                  <li>Track your security score over time</li>
                  <li>Set up team notifications (optional)</li>
                </ol>
              </div>
            </div>
          </motion.div>
        );

      default:
        return null;
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="text-xl">{currentStep.title}</DialogTitle>
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              className="h-8 w-8 p-0"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </DialogHeader>

        <div className="mt-6">
          {/* Progress indicator */}
          <div className="flex items-center justify-between mb-8">
            {STEPS.map((step, index) => (
              <div
                key={step.id}
                className={cn(
                  "flex items-center",
                  index < STEPS.length - 1 && "flex-1"
                )}
              >
                <div
                  className={cn(
                    "w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium",
                    index <= currentStepIndex
                      ? "bg-blue-600 text-white"
                      : "bg-gray-200 text-gray-600"
                  )}
                >
                  {index < currentStepIndex ? (
                    <CheckCircle className="w-4 h-4" />
                  ) : (
                    index + 1
                  )}
                </div>
                {index < STEPS.length - 1 && (
                  <div
                    className={cn(
                      "flex-1 h-1 mx-2",
                      index < currentStepIndex ? "bg-blue-600" : "bg-gray-200"
                    )}
                  />
                )}
              </div>
            ))}
          </div>

          {/* Step content */}
          <div className="min-h-[300px]">
            <AnimatePresence mode="wait">
              {renderStepContent()}
            </AnimatePresence>
          </div>

          {/* Navigation */}
          <div className="flex items-center justify-between mt-8">
            <Button
              variant="outline"
              onClick={currentStepIndex === 0 ? onClose : handlePrevious}
              disabled={currentStepIndex === 0}
            >
              {currentStepIndex === 0 ? "Skip" : "Previous"}
            </Button>
            <Button onClick={handleNext} className="flex items-center gap-2">
              {currentStepIndex === STEPS.length - 1 ? "Get Started" : "Next"}
              <ArrowRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
