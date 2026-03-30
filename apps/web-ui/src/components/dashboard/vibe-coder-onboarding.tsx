"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  ArrowRight,
  Bot,
  Check,
  CheckCircle2,
  Copy,
  Github,
  MousePointer2,
  Rocket,
  Shield,
  Sparkles,
  Terminal,
  Zap,
} from "lucide-react";
import { STRIPE_LIVE_PREFIX } from "guardrail-security/secrets/stripe-placeholder-prefix";
import { useRouter } from "next/navigation";
import { useState } from "react";

interface VibeCoderOnboardingProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const STORAGE_KEY = "guardrail_vibe_onboarding_complete";

export function VibeCoderOnboarding({
  open,
  onOpenChange,
}: VibeCoderOnboardingProps) {
  const router = useRouter();
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
      title: "Welcome, Vibe Coder! 🎉",
      content: (
        <div className="space-y-6 text-center">
          <div className="relative mx-auto w-24 h-24">
            <div className="absolute inset-0 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full blur-xl opacity-50 animate-pulse" />
            <div className="relative w-24 h-24 rounded-full bg-gradient-to-r from-blue-600 to-purple-600 flex items-center justify-center">
              <Sparkles className="w-12 h-12 text-white" />
            </div>
          </div>

          <div>
            <h2 className="text-2xl font-bold text-white mb-2">
              You build with AI. We make sure it works.
            </h2>
            <p className="text-muted-foreground">
              guardrail catches code that <em>looks</em> like it works but
              doesn't. No jargon. Plain English. One click.
            </p>
          </div>

          <div className="grid grid-cols-3 gap-3 text-center">
            <div className="p-4 rounded-lg bg-emerald-950/20 border border-emerald-800/30">
              <p className="text-3xl mb-1">🟢</p>
              <p className="text-sm text-emerald-400 font-medium">Ship it!</p>
              <p className="text-xs text-muted-foreground">80+ score</p>
            </div>
            <div className="p-4 rounded-lg bg-amber-950/20 border border-amber-800/30">
              <p className="text-3xl mb-1">🟡</p>
              <p className="text-sm text-amber-400 font-medium">Almost</p>
              <p className="text-xs text-muted-foreground">50-79 score</p>
            </div>
            <div className="p-4 rounded-lg bg-red-950/20 border border-red-800/30">
              <p className="text-3xl mb-1">🔴</p>
              <p className="text-sm text-red-400 font-medium">Fix first</p>
              <p className="text-xs text-muted-foreground">&lt;50 score</p>
            </div>
          </div>
        </div>
      ),
    },
    {
      id: "problems",
      title: "What We Catch",
      content: (
        <div className="space-y-4">
          <p className="text-center text-muted-foreground mb-6">
            AI-generated code often has these problems. We find them for you.
          </p>

          <div className="space-y-3">
            {[
              {
                emoji: "🔑",
                title: "Exposed Secrets",
                description:
                  "API keys visible in your code that hackers can steal",
                example: `const apiKey = '${STRIPE_LIVE_PREFIX}abc123...'`,
              },
              {
                emoji: "🎭",
                title: "Fake Save Buttons",
                description:
                  "UI that looks like it saves but actually does nothing",
                example: "onClick={() => console.log('saved')}",
              },
              {
                emoji: "🔓",
                title: "Unprotected Routes",
                description: "Admin pages anyone can access without logging in",
                example: "/admin accessible to everyone",
              },
              {
                emoji: "📡",
                title: "Missing API Endpoints",
                description: "Frontend calls APIs that don't exist",
                example: "fetch('/api/users') → 404",
              },
            ].map((problem, i) => (
              <div
                key={i}
                className="p-4 rounded-lg bg-card/50 border hover:border-primary/30 transition-all"
              >
                <div className="flex items-start gap-3">
                  <span className="text-2xl">{problem.emoji}</span>
                  <div className="flex-1">
                    <h4 className="font-medium text-white">{problem.title}</h4>
                    <p className="text-sm text-muted-foreground">
                      {problem.description}
                    </p>
                    <code className="text-xs text-red-400 bg-red-950/30 px-2 py-1 rounded mt-2 inline-block">
                      {problem.example}
                    </code>
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
      title: "Get Started in 10 Seconds",
      content: (
        <div className="space-y-6">
          <p className="text-center text-muted-foreground">
            One command. That's it. No config files, no setup.
          </p>

          <div className="p-4 rounded-lg bg-card border">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Terminal className="w-4 h-4 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">Terminal</span>
              </div>
              <Button
                size="sm"
                variant="ghost"
                className="h-6 px-2 text-xs"
                onClick={() => copyCommand("npx guardrail ship")}
              >
                {copied ? (
                  <Check className="w-3 h-3" />
                ) : (
                  <Copy className="w-3 h-3" />
                )}
              </Button>
            </div>
            <code className="text-emerald-400 font-mono text-lg">
              npx guardrail ship
            </code>
          </div>

          <div className="space-y-3">
            <div className="flex items-center gap-3 p-3 rounded-lg bg-blue-950/20 border border-blue-800/30">
              <div className="w-8 h-8 rounded-full bg-blue-500/20 flex items-center justify-center text-blue-400 font-bold">
                1
              </div>
              <div>
                <p className="text-sm text-white font-medium">
                  Run the command
                </p>
                <p className="text-xs text-muted-foreground">
                  In your project folder
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3 p-3 rounded-lg bg-purple-950/20 border border-purple-800/30">
              <div className="w-8 h-8 rounded-full bg-purple-500/20 flex items-center justify-center text-purple-400 font-bold">
                2
              </div>
              <div>
                <p className="text-sm text-white font-medium">See your score</p>
                <p className="text-xs text-muted-foreground">
                  Traffic light + plain English
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3 p-3 rounded-lg bg-emerald-950/20 border border-emerald-800/30">
              <div className="w-8 h-8 rounded-full bg-emerald-500/20 flex items-center justify-center text-emerald-400 font-bold">
                3
              </div>
              <div>
                <p className="text-sm text-white font-medium">
                  Auto-fix with --fix
                </p>
                <p className="text-xs text-muted-foreground">
                  We fix safe issues automatically
                </p>
              </div>
            </div>
          </div>

          <div className="p-3 rounded-lg bg-amber-950/20 border border-amber-800/30">
            <div className="flex items-center gap-2 text-amber-400 text-sm">
              <Zap className="w-4 h-4" />
              <span className="font-medium">Pro tip:</span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Run{" "}
              <code className="text-amber-400">npx guardrail ship --fix</code>{" "}
              to automatically fix problems!
            </p>
          </div>
        </div>
      ),
    },
    {
      id: "features",
      title: "Your New Superpowers",
      content: (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            {[
              {
                icon: <Rocket className="w-6 h-6" />,
                title: "guardrail ship",
                description: "Is my app ready to deploy?",
                color: "emerald",
              },
              {
                icon: <Shield className="w-6 h-6" />,
                title: "guardrail launch",
                description: "Pre-launch checklist",
                color: "blue",
              },
              {
                icon: <Bot className="w-6 h-6" />,
                title: "guardrail autopilot",
                description: "24/7 protection",
                color: "purple",
              },
              {
                icon: <MousePointer2 className="w-6 h-6" />,
                title: "Is It Real?",
                description: "Check if buttons work",
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
                <p className="text-xs text-muted-foreground">
                  {feature.description}
                </p>
              </div>
            ))}
          </div>

          <div className="p-4 rounded-lg bg-gradient-to-r from-blue-950/30 to-purple-950/30 border border-blue-800/30">
            <div className="flex items-center gap-2 mb-2">
              <Github className="w-5 h-5 text-white" />
              <span className="font-medium text-white">GitHub Integration</span>
              <Badge
                variant="outline"
                className="text-xs border-blue-500/30 text-blue-400"
              >
                Coming Soon
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground">
              Auto-scan on every PR. Block deploys that would break production.
            </p>
          </div>
        </div>
      ),
    },
    {
      id: "done",
      title: "You're All Set! 🚀",
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
              Ready to ship with confidence!
            </h2>
            <p className="text-muted-foreground">
              Run{" "}
              <code className="text-emerald-400 bg-emerald-950/30 px-2 py-1 rounded">
                guardrail ship
              </code>{" "}
              anytime to check your app.
            </p>
          </div>

          <div className="space-y-3">
            <Button
              className="w-full bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white"
              onClick={() => {
                handleComplete();
                router.push("/dashboard");
              }}
            >
              <Rocket className="w-4 h-4 mr-2" />
              Go to Dashboard
            </Button>

            <Button
              variant="outline"
              className="w-full border"
              onClick={() => {
                copyCommand("npx guardrail ship");
                handleComplete();
              }}
            >
              <Terminal className="w-4 h-4 mr-2" />
              Copy Command & Close
            </Button>
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
        className="max-w-lg bg-background border"
        hideCloseButton
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        {/* Progress Bar */}
        <div
          className="absolute top-0 left-0 right-0 h-1 bg-muted"
          role="progressbar"
          aria-valuenow={progress}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={`Onboarding progress: ${progress}% complete`}
        >
          <div
            className="h-full bg-gradient-to-r from-blue-500 to-purple-500 transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>

        <DialogHeader className="text-center pt-4">
          <DialogTitle className="text-xl font-bold text-white">
            {currentStepData.title}
          </DialogTitle>
        </DialogHeader>

        <div className="py-4">{currentStepData.content}</div>

        {/* Navigation */}
        <div className="flex items-center justify-between pt-4 border-t">
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
                      : "bg-muted"
                }`}
              />
            ))}
          </div>

          <div className="flex gap-2">
            {step > 0 && step < steps.length - 1 && (
              <Button
                variant="ghost"
                className="text-muted-foreground"
                onClick={() => setStep(step - 1)}
              >
                Back
              </Button>
            )}

            {step < steps.length - 1 && (
              <Button
                className="bg-blue-600 hover:bg-blue-700"
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
            className="text-xs text-muted-foreground/70 hover:text-muted-foreground text-center mt-2 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-background rounded px-2 py-1"
            aria-label="Skip onboarding and go to dashboard"
          >
            Skip onboarding
          </button>
        )}
      </DialogContent>
    </Dialog>
  );
}
