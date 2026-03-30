"use client";

import { useState } from "react";
import { motion } from "motion/react";
import {
  Github,
  ChevronDown,
  Loader2,
  CheckCircle,
  Play,
  ExternalLink,
  GitBranch,
  AlertCircle,
  Clock,
  Shield,
} from "lucide-react";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { Card, CardContent } from "./ui/card";

// Mock repositories data
const mockRepositories = [
  { id: 1, name: "my-saas-app", fullName: "username/my-saas-app", configured: false },
  { id: 2, name: "guardrail", fullName: "guardiavault/guardrail", configured: true, stats: { scans: 47, issues: 3, lastScan: "2h ago" } },
  { id: 3, name: "internal-api", fullName: "company/internal-api", configured: true, stats: { scans: 123, issues: 12, lastScan: "5m ago" } },
  { id: 4, name: "frontend-dashboard", fullName: "username/frontend-dashboard", configured: false },
  { id: 5, name: "mobile-app", fullName: "company/mobile-app", configured: true, stats: { scans: 89, issues: 0, lastScan: "1h ago" } },
];

export function GitHubConnectWidget() {
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [selectedRepo, setSelectedRepo] = useState<typeof mockRepositories[0] | null>(null);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isScanning, setIsScanning] = useState(false);

  const handleConnect = () => {
    setIsConnecting(true);
    // Simulate OAuth flow
    setTimeout(() => {
      setIsConnected(true);
      setIsConnecting(false);
    }, 1500);
  };

  const handleRepoSelect = (repo: typeof mockRepositories[0]) => {
    setSelectedRepo(repo);
    setIsDropdownOpen(false);
  };

  const handleRunScan = () => {
    setIsScanning(true);
    // Simulate scan
    setTimeout(() => {
      setIsScanning(false);
      // Mark repo as configured with mock stats
      if (selectedRepo) {
        setSelectedRepo({
          ...selectedRepo,
          configured: true,
          stats: { scans: 1, issues: 0, lastScan: "Just now" }
        });
      }
    }, 2000);
  };

  if (!isConnected) {
    return (
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <Card className="border-purple-500/30 bg-gradient-to-br from-purple-950/40 to-pink-950/40 backdrop-blur-xl">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-xl bg-gradient-to-br from-purple-500/20 to-pink-500/20 border border-purple-500/30">
                  <Github className="w-6 h-6 text-purple-400" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-white mb-1">
                    Connect GitHub to Get Started
                  </h3>
                  <p className="text-sm text-zinc-400">
                    Link your repositories to enable automated security scanning and monitoring
                  </p>
                </div>
              </div>
              <Button
                onClick={handleConnect}
                disabled={isConnecting}
                className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 border-0 shadow-lg shadow-purple-500/25"
              >
                {isConnecting ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Connecting...
                  </>
                ) : (
                  <>
                    <Github className="w-4 h-4 mr-2" />
                    Connect GitHub
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
    >
      <Card className="border-zinc-800 bg-zinc-900/50 backdrop-blur-xl">
        <CardContent className="p-6">
          <div className="flex items-center gap-4">
            {/* Connected Status */}
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-lg bg-gradient-to-br from-emerald-500/20 to-green-500/20 border border-emerald-500/30">
                <Github className="w-5 h-5 text-emerald-400" />
              </div>
              <div>
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="text-sm font-medium text-white">GitHub Connected</span>
                  <CheckCircle className="w-4 h-4 text-emerald-400" />
                </div>
                <p className="text-xs text-zinc-500">@username</p>
              </div>
            </div>

            {/* Divider */}
            <div className="h-12 w-px bg-zinc-700" />

            {/* Repository Selector */}
            <div className="flex-1">
              <label className="text-xs text-zinc-500 mb-1.5 block">Select Repository</label>
              <div className="relative">
                <button
                  onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                  className="w-full max-w-md px-3 py-2 rounded-lg bg-zinc-800 border border-zinc-700 hover:border-zinc-600 text-left flex items-center justify-between transition-colors"
                >
                  <span className="text-sm text-white flex items-center gap-2">
                    <GitBranch className="w-4 h-4 text-zinc-400" />
                    {selectedRepo ? selectedRepo.fullName : "Choose a repository..."}
                  </span>
                  <ChevronDown className={`w-4 h-4 text-zinc-400 transition-transform ${isDropdownOpen ? "rotate-180" : ""}`} />
                </button>

                {/* Dropdown */}
                {isDropdownOpen && (
                  <div className="absolute top-full mt-2 w-full max-w-md bg-zinc-800 border border-zinc-700 rounded-lg shadow-xl z-50 overflow-hidden">
                    <div className="max-h-64 overflow-y-auto">
                      {mockRepositories.map((repo) => (
                        <button
                          key={repo.id}
                          onClick={() => handleRepoSelect(repo)}
                          className="w-full px-3 py-2.5 text-left hover:bg-zinc-700/50 transition-colors border-b border-zinc-700/50 last:border-0"
                        >
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="text-sm font-medium text-white">{repo.fullName}</p>
                              <p className="text-xs text-zinc-500 mt-0.5">
                                {repo.configured ? `${repo.stats?.scans} scans • ${repo.stats?.issues} issues` : "Not configured"}
                              </p>
                            </div>
                            {repo.configured && (
                              <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30">
                                Active
                              </Badge>
                            )}
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Action or Stats */}
            {selectedRepo && (
              <>
                {!selectedRepo.configured ? (
                  // New repo - show run scan button
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2 text-amber-400">
                      <AlertCircle className="w-4 h-4" />
                      <span className="text-sm">Not configured</span>
                    </div>
                    <Button
                      onClick={handleRunScan}
                      disabled={isScanning}
                      className="bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 border-0 shadow-lg shadow-blue-500/25"
                    >
                      {isScanning ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Scanning...
                        </>
                      ) : (
                        <>
                          <Play className="w-4 h-4 mr-2" />
                          Run First Scan
                        </>
                      )}
                    </Button>
                  </div>
                ) : (
                  // Configured repo - show stats
                  <div className="flex items-center gap-6">
                    <div className="flex items-center gap-2">
                      <div className="p-2 rounded-lg bg-blue-500/20 border border-blue-500/30">
                        <Shield className="w-4 h-4 text-blue-400" />
                      </div>
                      <div>
                        <p className="text-xs text-zinc-500">Total Scans</p>
                        <p className="text-sm font-semibold text-white">{selectedRepo.stats?.scans}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="p-2 rounded-lg bg-red-500/20 border border-red-500/30">
                        <AlertCircle className="w-4 h-4 text-red-400" />
                      </div>
                      <div>
                        <p className="text-xs text-zinc-500">Open Issues</p>
                        <p className="text-sm font-semibold text-white">{selectedRepo.stats?.issues}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="p-2 rounded-lg bg-emerald-500/20 border border-emerald-500/30">
                        <Clock className="w-4 h-4 text-emerald-400" />
                      </div>
                      <div>
                        <p className="text-xs text-zinc-500">Last Scan</p>
                        <p className="text-sm font-semibold text-white">{selectedRepo.stats?.lastScan}</p>
                      </div>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      className="border-zinc-700 hover:border-blue-500/50 hover:bg-blue-500/10"
                      onClick={() => window.open(`https://github.com/${selectedRepo.fullName}`, '_blank')}
                    >
                      <ExternalLink className="w-4 h-4 mr-2" />
                      View Repo
                    </Button>
                  </div>
                )}
              </>
            )}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
