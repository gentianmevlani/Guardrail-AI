"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Switch } from "@/components/ui/switch";
import { useGitHub } from "@/context/github-context";
import type { GitHubRepository } from "@/lib/api";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Circle,
  Eye,
  FileCode,
  FolderOpen,
  GitBranch,
  Github,
  HardDrive,
  Loader2,
  Lock,
  RefreshCw,
  Rocket,
  Search,
  Settings,
  Shield,
  Sparkles,
  Terminal,
  Upload,
  Wand2,
  X,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

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

interface SetupWizardModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const STORAGE_KEY = "guardrail_setup_complete";

export function SetupWizardModal({
  open,
  onOpenChange,
}: SetupWizardModalProps) {
  const router = useRouter();

  // Use centralized GitHub context
  const {
    connected: githubConnected,
    loading: loadingGithub,
    user: githubUser,
    repositories,
    connect: connectGitHub,
    sync: syncGitHub,
    syncing: loadingRepos,
  } = useGitHub();

  const [currentStep, setCurrentStep] = useState(0);
  const [isDetecting, setIsDetecting] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [runProgress, setRunProgress] = useState(0);
  const [setupComplete, setSetupComplete] = useState(false);
  const [selectedRepo, setSelectedRepo] = useState<GitHubRepository | null>(
    null,
  );
  const [repoSearch, setRepoSearch] = useState("");

  // Local folder upload state
  const [sourceType, setSourceType] = useState<"github" | "local" | null>(null);
  const [localFolderName, setLocalFolderName] = useState<string>("");
  const [localFiles, setLocalFiles] = useState<File[]>([]);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);

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

  // GitHub status comes from context - no need to fetch manually

  const steps: SetupStep[] = [
    {
      id: "source",
      title: "Choose Source",
      description: "GitHub or Local",
      completed: currentStep > 0,
    },
    {
      id: "select",
      title: sourceType === "local" ? "Upload Folder" : "Select Repo",
      description:
        sourceType === "local" ? "Upload your code" : "Choose repository",
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

  // Handle folder upload via file input (webkitdirectory)
  const handleFolderSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      const fileArray = Array.from(files);
      setLocalFiles(fileArray);
      // Extract folder name from first file's path
      const firstPath = fileArray[0].webkitRelativePath;
      const folderName = firstPath.split("/")[0];
      setLocalFolderName(folderName);
    }
  };

  const handleLocalFolderContinue = () => {
    if (localFiles.length > 0) {
      setIsUploading(true);
      setUploadProgress(0);

      // Simulate upload/processing
      const interval = setInterval(() => {
        setUploadProgress((prev) => {
          if (prev >= 100) {
            clearInterval(interval);
            setIsUploading(false);
            // Detect framework from files
            const hasPackageJson = localFiles.some(
              (f) => f.name === "package.json",
            );
            const hasTsConfig = localFiles.some(
              (f) => f.name === "tsconfig.json",
            );
            const hasNextConfig = localFiles.some(
              (f) =>
                f.name === "next.config.js" || f.name === "next.config.mjs",
            );

            let framework = "Unknown";
            if (hasNextConfig) framework = "Next.js";
            else if (hasTsConfig) framework = "TypeScript";
            else if (hasPackageJson) framework = "Node.js";

            setDetectedFramework({
              name: framework,
              version: "latest",
              confidence: hasNextConfig ? 95 : 75,
            });
            setCurrentStep(2);
            return 100;
          }
          return prev + 10;
        });
      }, 150);
    }
  };

  const handleSelectRepo = (repo: GitHubRepository) => {
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

  const handleComplete = () => {
    localStorage.setItem(STORAGE_KEY, "completed");
    onOpenChange(false);
    router.push("/ship");
  };

  const handleSkip = () => {
    localStorage.setItem(STORAGE_KEY, "skipped");
    onOpenChange(false);
  };

  const toggleFlow = (flowId: string) => {
    setFlows(
      flows.map((f) => (f.id === flowId ? { ...f, enabled: !f.enabled } : f)),
    );
  };

  const filteredRepos = repositories.filter(
    (repo) =>
      repo.name.toLowerCase().includes(repoSearch.toLowerCase()) ||
      repo.fullName.toLowerCase().includes(repoSearch.toLowerCase()),
  );

  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent
        className="max-w-4xl max-h-[90vh] overflow-y-auto bg-background border-border"
        hideCloseButton
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <DialogHeader className="text-center pb-2">
          <div className="flex items-center justify-center gap-2 mb-2">
            <Wand2 className="h-6 w-6 text-primary" />
            <DialogTitle className="text-2xl font-bold text-foreground">
              Repo Setup Wizard
            </DialogTitle>
          </div>
          <DialogDescription className="text-muted-foreground">
            Connect your GitHub repository to get started with guardrail
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center justify-between px-4 py-4">
          {steps.map((step, index) => (
            <div key={step.id} className="flex items-center">
              <div className="flex flex-col items-center">
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center border-2 transition-all ${
                    step.completed
                      ? "bg-success/20 border-success text-success"
                      : currentStep === index
                        ? "bg-primary/20 border-primary text-primary"
                        : "bg-card border-border text-muted-foreground"
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
                    className={`text-xs font-medium ${currentStep === index ? "text-foreground" : "text-muted-foreground"}`}
                  >
                    {step.title}
                  </p>
                </div>
              </div>
              {index < steps.length - 1 && (
                <div
                  className={`w-12 h-0.5 mx-1 ${
                    step.completed ? "bg-success" : "bg-muted"
                  }`}
                />
              )}
            </div>
          ))}
        </div>

        <div className="pt-4">
          {currentStep === 0 && (
            <div className="space-y-6">
              <div className="text-center">
                <FolderOpen className="w-12 h-12 mx-auto text-primary mb-4" />
                <h2 className="text-xl font-bold text-foreground">
                  Choose Your Source
                </h2>
                <p className="text-muted-foreground mt-2">
                  Connect GitHub or upload a local folder to analyze
                </p>
              </div>

              <div className="grid gap-4 md:grid-cols-2 max-w-2xl mx-auto">
                {/* Local Folder Option */}
                <div
                  onClick={() => setSourceType("local")}
                  className={`p-6 rounded-xl border-2 cursor-pointer transition-all hover:scale-[1.02] ${
                    sourceType === "local"
                      ? "bg-primary/10 border-primary ring-2 ring-primary/20"
                      : "bg-card border-border hover:border-primary/50"
                  }`}
                >
                  <div className="flex flex-col items-center text-center">
                    <div
                      className={`w-16 h-16 rounded-full flex items-center justify-center mb-4 ${
                        sourceType === "local" ? "bg-primary/20" : "bg-muted"
                      }`}
                    >
                      <Upload
                        className={`w-8 h-8 ${sourceType === "local" ? "text-primary" : "text-muted-foreground"}`}
                      />
                    </div>
                    <h3 className="text-lg font-bold text-foreground">
                      Local Folder
                    </h3>
                    <p className="text-sm text-muted-foreground mt-2">
                      Upload a folder from your computer
                    </p>
                    <div className="mt-4 flex flex-wrap gap-2 justify-center">
                      <span className="text-xs px-2 py-1 rounded bg-success/20 text-success">
                        No setup
                      </span>
                      <span className="text-xs px-2 py-1 rounded bg-success/20 text-success">
                        Instant
                      </span>
                    </div>
                  </div>
                </div>

                {/* GitHub Option */}
                <div
                  onClick={() => setSourceType("github")}
                  className={`p-6 rounded-xl border-2 cursor-pointer transition-all hover:scale-[1.02] ${
                    sourceType === "github"
                      ? "bg-primary/10 border-primary ring-2 ring-primary/20"
                      : "bg-card border-border hover:border-primary/50"
                  }`}
                >
                  <div className="flex flex-col items-center text-center">
                    <div
                      className={`w-16 h-16 rounded-full flex items-center justify-center mb-4 ${
                        sourceType === "github"
                          ? "bg-primary/20"
                          : "bg-muted"
                      }`}
                    >
                      <Github
                        className={`w-8 h-8 ${
                          sourceType === "github" ? "text-primary" : "text-muted-foreground"
                        }`}
                      />
                    </div>
                    <h3 className="text-lg font-bold text-foreground">
                      GitHub
                    </h3>
                    <p className="text-sm text-muted-foreground mt-2">
                      Connect your GitHub repository
                    </p>
                    <div className="mt-4 flex flex-wrap gap-2 justify-center">
                      <span className="text-xs px-2 py-1 rounded bg-primary/20 text-primary">
                        CI/CD
                      </span>
                      <span className="text-xs px-2 py-1 rounded bg-primary/20 text-primary">
                        Auto-sync
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex justify-center pt-4">
                <Button
                  onClick={() => setCurrentStep(1)}
                  disabled={!sourceType}
                  className="bg-blue-600 hover:bg-blue-700 min-w-[200px]"
                >
                  Continue
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </div>
            </div>
          )}

          {currentStep === 1 && sourceType === "local" && (
            <div className="space-y-6">
              <div className="text-center">
                <HardDrive className="w-12 h-12 mx-auto text-blue-400 mb-4" />
                <h2 className="text-xl font-bold text-white">
                  Upload Local Folder
                </h2>
                <p className="text-muted-foreground mt-2">
                  Select a folder from your computer to analyze
                </p>
              </div>

              <div className="max-w-lg mx-auto space-y-4">
                {/* Hidden file input for folder selection */}
                <input
                  type="file"
                  id="folder-upload"
                  // @ts-expect-error - webkitdirectory is a non-standard attribute for folder selection
                  webkitdirectory="true"
                  directory=""
                  multiple
                  onChange={handleFolderSelect}
                  className="hidden"
                />

                {localFiles.length === 0 ? (
                  <label
                    htmlFor="folder-upload"
                    className="flex flex-col items-center justify-center p-12 border-2 border-dashed border-border rounded-xl cursor-pointer hover:border-primary hover:bg-primary/10 transition-all"
                  >
                    <Upload className="w-12 h-12 text-muted-foreground mb-4" />
                    <p className="text-lg font-medium text-foreground/80">
                      Click to select folder
                    </p>
                    <p className="text-sm text-muted-foreground mt-1">
                      Or drag and drop
                    </p>
                  </label>
                ) : (
                  <div className="p-6 rounded-xl bg-emerald-950/20 border border-emerald-800/50">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-lg bg-emerald-500/20 flex items-center justify-center">
                        <FolderOpen className="w-6 h-6 text-emerald-400" />
                      </div>
                      <div className="flex-1">
                        <p className="font-medium text-emerald-400">
                          {localFolderName}
                        </p>
                        <p className="text-sm text-emerald-400/70">
                          {localFiles.length} files selected
                        </p>
                      </div>
                      <CheckCircle2 className="w-6 h-6 text-emerald-400" />
                    </div>

                    {/* File preview */}
                    <div className="mt-4 max-h-32 overflow-y-auto space-y-1">
                      {localFiles.slice(0, 10).map((file, i) => (
                        <div
                          key={i}
                          className="flex items-center gap-2 text-xs text-muted-foreground"
                        >
                          <FileCode className="w-3 h-3" />
                          <span className="truncate">
                            {file.webkitRelativePath}
                          </span>
                        </div>
                      ))}
                      {localFiles.length > 10 && (
                        <p className="text-xs text-muted-foreground">
                          ...and {localFiles.length - 10} more files
                        </p>
                      )}
                    </div>

                    <label
                      htmlFor="folder-upload"
                      className="mt-4 block text-center text-sm text-blue-400 hover:text-blue-300 cursor-pointer"
                    >
                      Choose different folder
                    </label>
                  </div>
                )}

                {isUploading && (
                  <div className="p-4 rounded-lg bg-blue-950/20 border border-blue-800/50">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm text-blue-300">
                        Processing files...
                      </span>
                      <span className="text-sm text-blue-400">
                        {uploadProgress}%
                      </span>
                    </div>
                    <Progress value={uploadProgress} className="h-2" />
                  </div>
                )}

                <div className="flex justify-between pt-4">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setCurrentStep(0);
                      setLocalFiles([]);
                    }}
                    className="border"
                  >
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    Back
                  </Button>
                  <Button
                    onClick={handleLocalFolderContinue}
                    disabled={localFiles.length === 0 || isUploading}
                    className="bg-blue-600 hover:bg-blue-700"
                  >
                    {isUploading ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Processing...
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

          {currentStep === 1 && sourceType === "github" && (
            <div className="space-y-6">
              <div className="text-center">
                <Github className="w-12 h-12 mx-auto text-purple-400 mb-4" />
                <h2 className="text-xl font-bold text-white">
                  Select Repository
                </h2>
                <p className="text-muted-foreground mt-2">
                  Choose the repository you want to protect with guardrail
                </p>
              </div>

              {!githubConnected ? (
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
                      onClick={() => syncGitHub()}
                      variant="outline"
                      className="border"
                    >
                      <RefreshCw className="w-4 h-4" />
                    </Button>
                  </div>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setSourceType("local");
                    }}
                    className="w-full border"
                  >
                    <Upload className="w-4 h-4 mr-2" />
                    Use Local Folder Instead
                  </Button>
                </div>
              ) : (
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
                    <div className="max-h-60 overflow-y-auto space-y-2">
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
                              {repo.isPrivate ? (
                                <Lock className="w-4 h-4 text-amber-400" />
                              ) : (
                                <GitBranch className="w-4 h-4 text-muted-foreground" />
                              )}
                              <div>
                                <p className="font-medium text-foreground/90">
                                  {repo.name}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  {repo.fullName}
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
                              {repo.isPrivate && (
                                <Badge
                                  variant="outline"
                                  className="text-xs border-amber-700 text-amber-400"
                                >
                                  Private
                                </Badge>
                              )}
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
                </div>
              )}

              <div className="flex justify-between max-w-2xl mx-auto pt-4">
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
                      onClick={handleComplete}
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
                          <span className="text-muted-foreground">Source</span>
                          <span className="text-foreground/90">
                            {sourceType === "local"
                              ? localFolderName
                              : selectedRepo?.name || "N/A"}
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
        </div>

        <div className="pt-4 border-t flex justify-center">
          <Button
            variant="ghost"
            onClick={handleSkip}
            className="text-muted-foreground hover:text-foreground"
          >
            <X className="w-4 h-4 mr-2" />
            Skip for now
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
