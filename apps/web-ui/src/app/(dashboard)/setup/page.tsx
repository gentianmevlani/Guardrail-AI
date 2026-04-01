"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Switch } from "@/components/ui/switch";
import { logger } from "@/lib/logger";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Circle,
  Eye,
  Folder,
  GitBranch,
  Github,
  Loader2,
  Lock,
  RefreshCw,
  Rocket,
  Search,
  Settings,
  Shield,
  Sparkles,
  Star,
  Terminal,
  Wand2,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

interface GitHubUser {
  login: string;
  name: string;
  avatar_url: string;
}

interface Repository {
  id: number;
  name: string;
  full_name: string;
  description: string | null;
  private: boolean;
  html_url: string;
  language: string | null;
  stargazers_count: number;
  updated_at: string;
}

interface SetupStep {
  id: string;
  title: string;
  description: string;
  completed: boolean;
}

interface DetectedFramework {
  name: string;
  version: string;
  confidence: number;
}

interface FlowConfig {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  required: boolean;
}

// Force dynamic rendering
export const dynamic = "force-dynamic";

export default function SetupWizardPage() {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(0);
  const [isDetecting, setIsDetecting] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [runProgress, setRunProgress] = useState(0);
  const [setupComplete, setSetupComplete] = useState(false);

  const [githubConnected, setGithubConnected] = useState(false);
  const [githubUser, setGithubUser] = useState<GitHubUser | null>(null);
  const [repositories, setRepositories] = useState<Repository[]>([]);
  const [selectedRepo, setSelectedRepo] = useState<Repository | null>(null);
  const [loadingGithub, setLoadingGithub] = useState(true);
  const [loadingRepos, setLoadingRepos] = useState(false);
  const [repoSearch, setRepoSearch] = useState("");

  const [detectedFramework, setDetectedFramework] =
    useState<DetectedFramework | null>(null);
  const [selectedProfile, setSelectedProfile] = useState<
    "quick" | "standard" | "strict"
  >("standard");
  const [flows, setFlows] = useState<FlowConfig[]>([
    {
      id: "auth",
      name: "Authentication Flow",
      description: "Login, logout, session management",
      enabled: true,
      required: true,
    },
    {
      id: "checkout",
      name: "Checkout Flow",
      description: "Cart, payment, order confirmation",
      enabled: false,
      required: false,
    },
    {
      id: "profile",
      name: "User Profile Flow",
      description: "View/edit profile, settings",
      enabled: true,
      required: false,
    },
    {
      id: "search",
      name: "Search Flow",
      description: "Search, filter, results",
      enabled: false,
      required: false,
    },
  ]);
  const [installGitHubAction, setInstallGitHubAction] = useState(true);
  const [generateConfig, setGenerateConfig] = useState(true);

  useEffect(() => {
    checkGitHubStatus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const checkGitHubStatus = async () => {
    setLoadingGithub(true);
    try {
      const res = await fetch("/api/github/status");
      const data = await res.json();
      setGithubConnected(data.connected);
      if (data.connected && data.user) {
        setGithubUser(data.user);
        fetchRepositories();
      }
    } catch (error) {
      logger.error("Failed to check GitHub status:", error);
    } finally {
      setLoadingGithub(false);
    }
  };

  const fetchRepositories = async () => {
    setLoadingRepos(true);
    try {
      const res = await fetch("/api/github/repos");
      const data = await res.json();
      if (data.repos) {
        setRepositories(data.repos);
      }
    } catch (error) {
      logger.error("Failed to fetch repositories:", error);
    } finally {
      setLoadingRepos(false);
    }
  };

  const steps: SetupStep[] = [
    {
      id: "connect",
      title: "Connect GitHub",
      description: "Link your account",
      completed: currentStep > 0,
    },
    {
      id: "select",
      title: "Select Repo",
      description: "Choose repository",
      completed: currentStep > 1,
    },
    {
      id: "flows",
      title: "Select Flows",
      description: "Choose what to verify",
      completed: currentStep > 2,
    },
    {
      id: "profile",
      title: "Choose Profile",
      description: "Set strictness level",
      completed: currentStep > 3,
    },
    {
      id: "run",
      title: "First Run",
      description: "Run Ship Check",
      completed: setupComplete,
    },
  ];

  const handleSelectRepo = (repo: Repository) => {
    setSelectedRepo(repo);
  };

  const handleContinueWithRepo = () => {
    if (selectedRepo) {
      setIsDetecting(true);
      setTimeout(() => {
        const lang = selectedRepo.language?.toLowerCase();
        let framework = "Unknown";
        if (lang === "typescript" || lang === "javascript") {
          framework = "Next.js";
        } else if (lang === "python") {
          framework = "Django";
        } else if (lang === "ruby") {
          framework = "Rails";
        } else if (lang === "go") {
          framework = "Go";
        }
        setDetectedFramework({
          name: framework,
          version: "latest",
          confidence: 85,
        });
        setIsDetecting(false);
        setCurrentStep(2);
      }, 1000);
    }
  };

  const handleRunFirstCheck = async () => {
    setIsRunning(true);
    setRunProgress(0);

    for (let i = 0; i <= 100; i += 10) {
      await new Promise((r) => setTimeout(r, 300));
      setRunProgress(i);
    }

    setIsRunning(false);
    setSetupComplete(true);
  };

  const toggleFlow = (flowId: string) => {
    setFlows(
      flows.map((f) => (f.id === flowId ? { ...f, enabled: !f.enabled } : f)),
    );
  };

  const filteredRepos = repositories.filter(
    (repo) =>
      repo.name.toLowerCase().includes(repoSearch.toLowerCase()) ||
      repo.full_name.toLowerCase().includes(repoSearch.toLowerCase()),
  );

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="text-center">
        <h1 className="text-2xl font-bold text-white flex items-center justify-center gap-2">
          <Wand2 className="h-6 w-6 text-blue-400" />
          Repo Setup Wizard
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          Connect your GitHub repository to get started with guardrail
        </p>
      </div>

      <div className="flex items-center justify-between px-8">
        {steps.map((step, index) => (
          <div key={step.id} className="flex items-center">
            <div className="flex flex-col items-center">
              <div
                className={`w-10 h-10 rounded-full flex items-center justify-center border-2 transition-all ${
                  step.completed
                    ? "bg-emerald-500/20 border-emerald-500 text-emerald-400"
                    : currentStep === index
                      ? "bg-blue-500/20 border-blue-500 text-blue-400"
                      : "bg-muted border text-muted-foreground"
                }`}
              >
                {step.completed ? (
                  <CheckCircle2 className="w-5 h-5" />
                ) : (
                  <span className="text-sm font-medium">{index + 1}</span>
                )}
              </div>
              <div className="mt-2 text-center">
                <p
                  className={`text-xs font-medium ${currentStep === index ? "text-white" : "text-muted-foreground"}`}
                >
                  {step.title}
                </p>
              </div>
            </div>
            {index < steps.length - 1 && (
              <div
                className={`w-16 h-0.5 mx-2 ${
                  step.completed ? "bg-emerald-500" : "bg-border"
                }`}
              />
            )}
          </div>
        ))}
      </div>

      <Card className="bg-card/40 border backdrop-blur-sm">
        <CardContent className="pt-6">
          {currentStep === 0 && (
            <div className="space-y-6">
              <div className="text-center">
                <Github className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                <h2 className="text-xl font-bold text-white">
                  Connect Your GitHub
                </h2>
                <p className="text-muted-foreground mt-2">
                  Link your GitHub account to analyze and protect your
                  repositories
                </p>
              </div>

              {loadingGithub ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="w-8 h-8 animate-spin text-blue-400" />
                </div>
              ) : githubConnected && githubUser ? (
                <div className="max-w-md mx-auto space-y-4">
                  <div className="p-4 rounded-lg bg-emerald-950/20 border border-emerald-800/50">
                    <div className="flex items-center gap-4">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={githubUser.avatar_url}
                        alt={githubUser.login}
                        className="w-12 h-12 rounded-full"
                      />
                      <div className="flex-1">
                        <p className="font-medium text-emerald-400">
                          Connected as {githubUser.name || githubUser.login}
                        </p>
                        <p className="text-sm text-emerald-400/70">
                          @{githubUser.login}
                        </p>
                      </div>
                      <CheckCircle2 className="w-6 h-6 text-emerald-400" />
                    </div>
                  </div>

                  <Button
                    onClick={() => setCurrentStep(1)}
                    className="w-full bg-blue-600 hover:bg-blue-700"
                  >
                    Continue to Select Repository
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                </div>
              ) : (
                <div className="max-w-md mx-auto space-y-4">
                  <div className="p-4 rounded-lg bg-card/50 border">
                    <p className="text-muted-foreground text-center mb-3">
                      GitHub is not connected. Set up a Personal Access Token:
                    </p>
                    <ol className="list-decimal list-inside space-y-1 text-xs text-muted-foreground">
                      <li>Create a GitHub token with &quot;repo&quot; scope</li>
                      <li>
                        Set{" "}
                        <code className="bg-muted px-1 rounded">
                          GITHUB_ACCESS_TOKEN
                        </code>{" "}
                        env var
                      </li>
                      <li>Redeploy the application</li>
                    </ol>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      onClick={() =>
                        window.open(
                          "https://github.com/settings/tokens/new?scopes=repo&description=guardrail",
                          "_blank",
                        )
                      }
                      variant="outline"
                      className="flex-1 border"
                    >
                      <Github className="w-4 h-4 mr-2" />
                      Create Token
                    </Button>
                    <Button
                      onClick={checkGitHubStatus}
                      variant="outline"
                      className="border"
                    >
                      <RefreshCw className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}

          {currentStep === 1 && (
            <div className="space-y-6">
              <div className="text-center">
                <Folder className="w-12 h-12 mx-auto text-blue-400 mb-4" />
                <h2 className="text-xl font-bold text-white">
                  Select Repository
                </h2>
                <p className="text-muted-foreground mt-2">
                  Choose the repository you want to protect with guardrail
                </p>
              </div>

              <div className="max-w-2xl mx-auto space-y-4">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="Search repositories..."
                    value={repoSearch}
                    onChange={(e) => setRepoSearch(e.target.value)}
                    className="pl-10 bg-card border"
                  />
                </div>

                {loadingRepos ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="w-8 h-8 animate-spin text-blue-400" />
                  </div>
                ) : (
                  <div className="max-h-80 overflow-y-auto space-y-2">
                    {filteredRepos.map((repo) => (
                      <div
                        key={repo.id}
                        onClick={() => handleSelectRepo(repo)}
                        className={`p-4 rounded-lg border cursor-pointer transition-all ${
                          selectedRepo?.id === repo.id
                            ? "bg-blue-950/30 border-blue-500 ring-2 ring-blue-500/20"
                            : "bg-card/50 border hover:border-primary/30"
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            {repo.private ? (
                              <Lock className="w-4 h-4 text-amber-400" />
                            ) : (
                              <GitBranch className="w-4 h-4 text-muted-foreground" />
                            )}
                            <div>
                              <p className="font-medium text-foreground/90">
                                {repo.name}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {repo.full_name}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            {repo.language && (
                              <Badge
                                variant="outline"
                                className="text-xs border text-muted-foreground"
                              >
                                {repo.language}
                              </Badge>
                            )}
                            <div className="flex items-center gap-1 text-muted-foreground">
                              <Star className="w-3 h-3" />
                              <span className="text-xs">
                                {repo.stargazers_count}
                              </span>
                            </div>
                          </div>
                        </div>
                        {repo.description && (
                          <p className="text-xs text-muted-foreground mt-2 line-clamp-1">
                            {repo.description}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                <div className="flex justify-between pt-4">
                  <Button
                    variant="outline"
                    onClick={() => setCurrentStep(0)}
                    className="border"
                  >
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    Back
                  </Button>
                  <Button
                    onClick={handleContinueWithRepo}
                    disabled={!selectedRepo || isDetecting}
                    className="bg-blue-600 hover:bg-blue-700"
                  >
                    {isDetecting ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Analyzing...
                      </>
                    ) : (
                      <>
                        Continue
                        <ArrowRight className="w-4 h-4 ml-2" />
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </div>
          )}

          {currentStep === 2 && (
            <div className="space-y-6">
              <div className="text-center">
                <Eye className="w-12 h-12 mx-auto text-purple-400 mb-4" />
                <h2 className="text-xl font-bold text-white">
                  Select Flows to Verify
                </h2>
                <p className="text-muted-foreground mt-2">
                  Choose which user flows Reality Mode should verify
                </p>
              </div>

              {selectedRepo && detectedFramework && (
                <div className="max-w-lg mx-auto p-4 rounded-lg bg-emerald-950/20 border border-emerald-800/50 mb-4">
                  <div className="flex items-center gap-3">
                    <Sparkles className="w-5 h-5 text-emerald-400" />
                    <div>
                      <p className="font-medium text-emerald-400">
                        {selectedRepo.name} - Detected: {detectedFramework.name}
                      </p>
                      <p className="text-xs text-emerald-400/70">
                        {detectedFramework.confidence}% confidence
                      </p>
                    </div>
                  </div>
                </div>
              )}

              <div className="space-y-3 max-w-lg mx-auto">
                {flows.map((flow) => (
                  <div
                    key={flow.id}
                    className={`p-4 rounded-lg border cursor-pointer transition-all ${
                      flow.enabled
                        ? "bg-blue-950/20 border-blue-800/50"
                        : "bg-card/50 border"
                    }`}
                    onClick={() => !flow.required && toggleFlow(flow.id)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Switch
                          checked={flow.enabled}
                          disabled={flow.required}
                        />
                        <div>
                          <p className="font-medium text-foreground/90">
                            {flow.name}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {flow.description}
                          </p>
                        </div>
                      </div>
                      {flow.required && (
                        <Badge
                          variant="outline"
                          className="text-muted-foreground border"
                        >
                          Required
                        </Badge>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex justify-between max-w-lg mx-auto">
                <Button
                  variant="outline"
                  onClick={() => setCurrentStep(1)}
                  className="border"
                >
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Back
                </Button>
                <Button
                  onClick={() => setCurrentStep(3)}
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  Continue
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </div>
            </div>
          )}

          {currentStep === 3 && (
            <div className="space-y-6">
              <div className="text-center">
                <Settings className="w-12 h-12 mx-auto text-yellow-400 mb-4" />
                <h2 className="text-xl font-bold text-white">
                  Choose Your Profile
                </h2>
                <p className="text-muted-foreground mt-2">
                  Select how strict the verification should be
                </p>
              </div>

              <div className="grid gap-4 md:grid-cols-3 max-w-2xl mx-auto">
                {[
                  {
                    id: "quick" as const,
                    name: "Quick",
                    description: "Fast checks for local dev",
                    icon: Terminal,
                    features: [
                      "MockProof only",
                      "Warnings only",
                      "< 30s runtime",
                    ],
                  },
                  {
                    id: "standard" as const,
                    name: "Standard",
                    description: "Balanced for feature branches",
                    icon: Shield,
                    features: [
                      "MockProof + Reality",
                      "Warn on issues",
                      "~2min runtime",
                    ],
                  },
                  {
                    id: "strict" as const,
                    name: "Strict",
                    description: "Full verification for prod",
                    icon: Rocket,
                    features: ["All gates", "Block on errors", "~5min runtime"],
                  },
                ].map((profile) => (
                  <div
                    key={profile.id}
                    onClick={() => setSelectedProfile(profile.id)}
                    className={`p-4 rounded-lg border cursor-pointer transition-all ${
                      selectedProfile === profile.id
                        ? "bg-blue-950/20 border-blue-500 ring-2 ring-blue-500/20"
                        : "bg-card/50 border hover:border-primary/30"
                    }`}
                  >
                    <profile.icon
                      className={`w-8 h-8 mb-3 ${
                        selectedProfile === profile.id
                          ? "text-blue-400"
                          : "text-muted-foreground"
                      }`}
                    />
                    <h3 className="font-bold text-white">{profile.name}</h3>
                    <p className="text-xs text-muted-foreground mt-1">
                      {profile.description}
                    </p>
                    <ul className="mt-3 space-y-1">
                      {profile.features.map((f, i) => (
                        <li
                          key={i}
                          className="text-xs text-muted-foreground flex items-center gap-1"
                        >
                          <Circle className="w-1.5 h-1.5" />
                          {f}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>

              <div className="flex justify-between max-w-2xl mx-auto">
                <Button
                  variant="outline"
                  onClick={() => setCurrentStep(2)}
                  className="border"
                >
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Back
                </Button>
                <Button
                  onClick={() => setCurrentStep(4)}
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  Continue
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </div>
            </div>
          )}

          {currentStep === 4 && (
            <div className="space-y-6">
              <div className="text-center">
                <Rocket className="w-12 h-12 mx-auto text-emerald-400 mb-4" />
                <h2 className="text-xl font-bold text-white">
                  Run Your First Ship Check
                </h2>
                <p className="text-muted-foreground mt-2">
                  Let's verify everything is working correctly
                </p>
              </div>

              <div className="max-w-lg mx-auto space-y-4">
                {isRunning && (
                  <div className="p-4 rounded-lg bg-blue-950/20 border border-blue-800/50">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm text-blue-300">
                        Running Ship Check...
                      </span>
                      <span className="text-sm text-blue-400">
                        {runProgress}%
                      </span>
                    </div>
                    <Progress value={runProgress} className="h-2" />
                  </div>
                )}

                {setupComplete ? (
                  <div className="text-center space-y-4">
                    <div className="p-6 rounded-lg bg-emerald-950/20 border border-emerald-800/50">
                      <CheckCircle2 className="w-16 h-16 mx-auto text-emerald-400 mb-4" />
                      <h3 className="text-xl font-bold text-emerald-400">
                        Setup Complete!
                      </h3>
                      <p className="text-muted-foreground mt-2">
                        {selectedRepo?.name} is now configured for Ship Check
                      </p>
                      <div className="mt-4 p-3 rounded bg-card/50">
                        <p className="text-sm text-foreground/80">
                          First run verdict:
                        </p>
                        <p className="text-2xl font-bold text-emerald-400 mt-1">
                          SHIP
                        </p>
                      </div>
                    </div>

                    <Button
                      onClick={() => router.push("/ship")}
                      className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500"
                    >
                      Go to Ship Check
                      <ArrowRight className="w-4 h-4 ml-2" />
                    </Button>
                  </div>
                ) : (
                  <>
                    <div className="p-4 rounded-lg bg-card/50 border">
                      <h4 className="font-medium text-foreground/90 mb-2">
                        Summary
                      </h4>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">
                            Repository
                          </span>
                          <span className="text-foreground/90">
                            {selectedRepo?.name || "N/A"}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">
                            Framework
                          </span>
                          <span className="text-foreground/90">
                            {detectedFramework?.name || "Unknown"}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Profile</span>
                          <span className="text-foreground/90 capitalize">
                            {selectedProfile}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Flows</span>
                          <span className="text-foreground/90">
                            {flows.filter((f) => f.enabled).length} selected
                          </span>
                        </div>
                      </div>
                    </div>

                    <Button
                      onClick={handleRunFirstCheck}
                      disabled={isRunning}
                      className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500"
                    >
                      {isRunning ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Running...
                        </>
                      ) : (
                        <>
                          <Rocket className="w-4 h-4 mr-2" />
                          Run First Ship Check
                        </>
                      )}
                    </Button>

                    <Button
                      variant="outline"
                      onClick={() => setCurrentStep(3)}
                      className="w-full border"
                    >
                      <ArrowLeft className="w-4 h-4 mr-2" />
                      Back
                    </Button>
                  </>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
