"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  ArrowRight,
  Check,
  CheckCircle2,
  Copy,
  Github,
  Rocket,
  Shield,
  Sparkles,
  Terminal,
  Zap,
  Lock,
  AlertTriangle,
  Activity,
  Eye,
} from "lucide-react";
import { useState } from "react";

interface SecurityOnboardingProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const STORAGE_KEY = "security_dashboard_onboarding_complete";

export function SecurityOnboarding({
  open,
  onOpenChange,
}: SecurityOnboardingProps) {
  const [step, setStep] = useState(0);
  const [copied, setCopied] = useState(false);

  const copyCommand = (cmd: string) => {
    navigator.clipboard.writeText(cmd);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleComplete = () => {
    localStorage.setItem(STORAGE_KEY, "completed");
    onOpenChange(false);
  };

  const steps = [
    {
      id: "welcome",
      title: "Welcome to Security Dashboard! 🎉",
      description: "Learn how to secure your code and ship with confidence",
      content: (
        <div className="space-y-6 text-center">
          <div className="relative mx-auto w-24 h-24">
            <div className="absolute inset-0 bg-gradient-to-r from-blue-500 to-cyan-500 rounded-full blur-xl opacity-50 animate-pulse" />
            <div className="relative w-24 h-24 rounded-full bg-gradient-to-r from-blue-600 to-cyan-600 flex items-center justify-center">
              <Shield className="w-12 h-12 text-white" />
            </div>
          </div>

          <div>
            <h2 className="text-2xl font-bold text-white mb-2">
              Secure your code before it ships
            </h2>
            <p className="text-zinc-400">
              Analyze GitHub repositories for vulnerabilities and code quality issues.
              Get actionable insights in plain English.
            </p>
          </div>

          <div className="grid grid-cols-3 gap-3 text-center">
            <div className="p-4 rounded-lg bg-emerald-950/20 border border-emerald-800/30">
              <p className="text-3xl mb-1">🟢</p>
              <p className="text-sm text-emerald-400 font-medium">Ship it!</p>
              <p className="text-xs text-zinc-500">80+ score</p>
            </div>
            <div className="p-4 rounded-lg bg-amber-950/20 border border-amber-800/30">
              <p className="text-3xl mb-1">🟡</p>
              <p className="text-sm text-amber-400 font-medium">Review</p>
              <p className="text-xs text-zinc-500">50-79 score</p>
            </div>
            <div className="p-4 rounded-lg bg-red-950/20 border border-red-800/30">
              <p className="text-3xl mb-1">🔴</p>
              <p className="text-sm text-red-400 font-medium">Fix first</p>
              <p className="text-xs text-zinc-500">&lt;50 score</p>
            </div>
          </div>
        </div>
      ),
    },
    {
      id: "threats",
      title: "Security Threats We Detect",
      description: "Understand the vulnerabilities our scanner identifies",
      content: (
        <div className="space-y-4">
          <p className="text-center text-zinc-400 mb-6">
            Our scanner identifies critical security vulnerabilities across your codebase.
          </p>

          <div className="space-y-3">
            {[
              {
                emoji: "🔑",
                title: "Exposed Secrets",
                description: "API keys, tokens, and credentials hardcoded in source code",
                severity: "Critical",
                color: "red",
              },
              {
                emoji: "🔓",
                title: "Authentication Bypass",
                description: "Missing auth checks on protected routes and endpoints",
                severity: "High",
                color: "orange",
              },
              {
                emoji: "💉",
                title: "Injection Vulnerabilities",
                description: "SQL injection, XSS, and command injection risks",
                severity: "High",
                color: "orange",
              },
              {
                emoji: "📦",
                title: "Vulnerable Dependencies",
                description: "Outdated packages with known security exploits",
                severity: "Medium",
                color: "yellow",
              },
            ].map((threat, i) => (
              <div
                key={i}
                className="p-4 rounded-lg bg-zinc-900/50 border border-zinc-800 hover:border-blue-500/30 transition-all"
              >
                <div className="flex items-start gap-3">
                  <span className="text-2xl">{threat.emoji}</span>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="font-medium text-white">{threat.title}</h4>
                      <Badge className={`text-xs bg-${threat.color}-500/20 text-${threat.color}-400 border-${threat.color}-500/30`}>
                        {threat.severity}
                      </Badge>
                    </div>
                    <p className="text-sm text-zinc-400">{threat.description}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ),
    },
    {
      id: "quickstart",
      title: "Get Started in 3 Steps",
      description: "Quick and easy setup - no configuration needed",
      content: (
        <div className="space-y-6">
          <p className="text-center text-zinc-400">
            Connect GitHub and start scanning in seconds. No configuration required.
          </p>

          <div className="space-y-3">
            <div className="flex items-center gap-3 p-4 rounded-lg bg-blue-950/20 border border-blue-800/30">
              <div className="w-10 h-10 rounded-full bg-blue-500/20 flex items-center justify-center text-blue-400 font-bold shrink-0">
                1
              </div>
              <div className="flex-1">
                <p className="text-sm text-white font-medium flex items-center gap-2">
                  <Github className="w-4 h-4" />
                  Connect GitHub Account
                </p>
                <p className="text-xs text-zinc-400 mt-1">
                  Securely authorize access to your repositories
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3 p-4 rounded-lg bg-cyan-950/20 border border-cyan-800/30">
              <div className="w-10 h-10 rounded-full bg-cyan-500/20 flex items-center justify-center text-cyan-400 font-bold shrink-0">
                2
              </div>
              <div className="flex-1">
                <p className="text-sm text-white font-medium flex items-center gap-2">
                  <Eye className="w-4 h-4" />
                  Select Repository
                </p>
                <p className="text-xs text-zinc-400 mt-1">
                  Choose any public or private repo to scan
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3 p-4 rounded-lg bg-emerald-950/20 border border-emerald-800/30">
              <div className="w-10 h-10 rounded-full bg-emerald-500/20 flex items-center justify-center text-emerald-400 font-bold shrink-0">
                3
              </div>
              <div className="flex-1">
                <p className="text-sm text-white font-medium flex items-center gap-2">
                  <Zap className="w-4 h-4" />
                  Run Security Scan
                </p>
                <p className="text-xs text-zinc-400 mt-1">
                  Get instant feedback on vulnerabilities and code quality
                </p>
              </div>
            </div>
          </div>

          <div className="p-4 rounded-lg bg-gradient-to-r from-blue-950/30 to-cyan-950/30 border border-blue-800/30">
            <div className="flex items-start gap-2">
              <Sparkles className="w-5 h-5 text-blue-400 mt-0.5 shrink-0" />
              <div>
                <p className="text-sm text-white font-medium">Pro Tip</p>
                <p className="text-xs text-zinc-400 mt-1">
                  Run different scan types: <span className="text-blue-400 font-mono">Ship</span> for quick checks, 
                  <span className="text-cyan-400 font-mono ml-1">Security</span> for deep analysis, or 
                  <span className="text-purple-400 font-mono ml-1">Full</span> for comprehensive coverage.
                </p>
              </div>
            </div>
          </div>
        </div>
      ),
    },
    {
      id: "features",
      title: "Powerful Security Features",
      description: "Explore all the tools at your disposal",
      content: (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            {[
              {
                icon: <Shield className="w-6 h-6" />,
                title: "Security Scan",
                description: "Find vulnerabilities fast",
                color: "blue",
              },
              {
                icon: <Rocket className="w-6 h-6" />,
                title: "Ship Check",
                description: "Is it ready to deploy?",
                color: "emerald",
              },
              {
                icon: <Activity className="w-6 h-6" />,
                title: "Live Monitoring",
                description: "Track security health",
                color: "cyan",
              },
              {
                icon: <AlertTriangle className="w-6 h-6" />,
                title: "Severity Levels",
                description: "Prioritize critical issues",
                color: "amber",
              },
            ].map((feature, i) => (
              <div
                key={i}
                className={`p-4 rounded-lg border bg-${feature.color}-950/20 border-${feature.color}-800/30`}
              >
                <div className={`text-${feature.color}-400 mb-2`}>
                  {feature.icon}
                </div>
                <h4 className="font-medium text-white text-sm">
                  {feature.title}
                </h4>
                <p className="text-xs text-zinc-400 mt-1">
                  {feature.description}
                </p>
              </div>
            ))}
          </div>

          <div className="p-4 rounded-lg bg-gradient-to-r from-purple-950/30 to-pink-950/30 border border-purple-800/30">
            <div className="flex items-center gap-2 mb-2">
              <Lock className="w-5 h-5 text-purple-400" />
              <span className="font-medium text-white">Compliance Ready</span>
              <Badge variant="outline" className="text-xs border-purple-500/30 text-purple-400">
                Enterprise
              </Badge>
            </div>
            <p className="text-sm text-zinc-400">
              Meet security standards with automated compliance checks and detailed audit reports.
            </p>
          </div>
        </div>
      ),
    },
    {
      id: "done",
      title: "You're Ready to Secure Your Code! 🚀",
      description: "Start analyzing repositories and shipping secure code",
      content: (
        <div className="space-y-6 text-center">
          <div className="relative mx-auto w-24 h-24">
            <div className="absolute inset-0 bg-emerald-500 rounded-full blur-xl opacity-30 animate-pulse" />
            <div className="relative w-24 h-24 rounded-full bg-emerald-500/20 border-4 border-emerald-500 flex items-center justify-center">
              <CheckCircle2 className="w-12 h-12 text-emerald-400" />
            </div>
          </div>

          <div>
            <h2 className="text-2xl font-bold text-white mb-2">
              Start scanning with confidence!
            </h2>
            <p className="text-zinc-400">
              Your dashboard is ready. Connect GitHub to begin analyzing your repositories.
            </p>
          </div>

          <div className="space-y-3">
            <Button
              className="w-full bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-white h-12"
              onClick={handleComplete}
            >
              <Shield className="w-5 h-5 mr-2" />
              Go to Dashboard
            </Button>

            <div className="grid grid-cols-2 gap-2">
              <Button
                variant="outline"
                className="border-zinc-700 bg-zinc-900/50 hover:bg-zinc-800"
                onClick={() => window.open("https://docs.example.com", "_blank")}
              >
                <Terminal className="w-4 h-4 mr-2" />
                Docs
              </Button>
              <Button
                variant="outline"
                className="border-zinc-700 bg-zinc-900/50 hover:bg-zinc-800"
                onClick={() => window.open("https://github.com/example", "_blank")}
              >
                <Github className="w-4 h-4 mr-2" />
                GitHub
              </Button>
            </div>
          </div>
        </div>
      ),
    },
  ];

  const currentStepData = steps[step];
  const progress = ((step + 1) / steps.length) * 100;

  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent
        className="max-w-2xl bg-zinc-950 border border-zinc-800"
        hideCloseButton
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        {/* Progress Bar */}
        <div
          className="absolute top-0 left-0 right-0 h-1 bg-zinc-900"
          role="progressbar"
          aria-valuenow={progress}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={`Onboarding progress: ${progress}% complete`}
        >
          <div
            className="h-full bg-gradient-to-r from-blue-500 to-cyan-500 transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>

        <DialogHeader className="text-center pt-4">
          <DialogTitle className="text-xl font-bold text-white">
            {currentStepData.title}
          </DialogTitle>
          <DialogDescription className="text-sm text-zinc-400">
            {currentStepData.description}
          </DialogDescription>
        </DialogHeader>

        <div className="py-4">{currentStepData.content}</div>

        {/* Navigation */}
        <div className="flex items-center justify-between pt-4 border-t border-zinc-800">
          <div
            className="flex gap-1"
            role="tablist"
            aria-label="Onboarding steps"
          >
            {steps.map((s, i) => (
              <div
                key={i}
                role="tab"
                aria-selected={i === step}
                aria-label={`Step ${i + 1}: ${s.title}`}
                className={`w-2 h-2 rounded-full transition-all ${
                  i === step
                    ? "bg-blue-500 w-4"
                    : i < step
                      ? "bg-emerald-500"
                      : "bg-zinc-700"
                }`}
              />
            ))}
          </div>

          <div className="flex gap-2">
            {step > 0 && step < steps.length - 1 && (
              <Button
                variant="ghost"
                className="text-zinc-400 hover:text-white"
                onClick={() => setStep(step - 1)}
              >
                Back
              </Button>
            )}

            {step < steps.length - 1 && (
              <Button
                className="bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500"
                onClick={() => setStep(step + 1)}
              >
                {step === 0 ? "Get Started" : "Next"}
                <ArrowRight className="w-4 h-4 ml-1" />
              </Button>
            )}
          </div>
        </div>

        {step < steps.length - 1 && (
          <button
            onClick={handleComplete}
            className="text-xs text-zinc-500 hover:text-zinc-400 text-center mt-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-zinc-950 rounded px-2 py-1"
            aria-label="Skip onboarding and go to dashboard"
          >
            Skip onboarding
          </button>
        )}
      </DialogContent>
    </Dialog>
  );
}