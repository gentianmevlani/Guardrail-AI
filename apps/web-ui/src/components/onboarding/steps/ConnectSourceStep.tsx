"use client";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import type { LucideIcon } from "lucide-react";
import { AlertCircle, Check, ChevronRight, Github, Upload } from "lucide-react";
import { useState } from "react";

interface ConnectSourceStepProps {
  onGitHubConnect: () => void;
  onFileUpload: () => void;
  onSkip: () => void;
}

type ConnectionOption = "github" | "upload" | null;

export function ConnectSourceStep({
  onGitHubConnect,
  onFileUpload,
  onSkip,
}: ConnectSourceStepProps) {
  const [selectedOption, setSelectedOption] = useState<ConnectionOption>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);

  const handleGitHubConnect = async () => {
    setIsConnecting(true);
    setConnectionError(null);

    try {
      const width = 600;
      const height = 700;
      const left = window.screenX + (window.outerWidth - width) / 2;
      const top = window.screenY + (window.outerHeight - height) / 2;

      const popup = window.open(
        "/api/auth/github",
        "github-oauth",
        `width=${width},height=${height},left=${left},top=${top}`,
      );

      if (!popup) {
        throw new Error("Popup blocked. Please allow popups for this site.");
      }

      const checkClosed = setInterval(() => {
        if (popup.closed) {
          clearInterval(checkClosed);
          setIsConnecting(false);
          onGitHubConnect();
        }
      }, 500);

      setTimeout(() => {
        clearInterval(checkClosed);
        if (!popup.closed) {
          popup.close();
          setIsConnecting(false);
        }
      }, 120000);
    } catch (error) {
      setConnectionError(
        error instanceof Error ? error.message : "Failed to connect to GitHub",
      );
      setIsConnecting(false);
    }
  };

  const handleFileUpload = () => {
    onFileUpload();
  };

  return (
    <div className="flex flex-col">
      <motion.div
        initial={{ y: 10, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.3 }}
      >
        <h2 className="text-xl font-semibold text-zinc-100 mb-2">
          Connect Your Code
        </h2>
        <p className="text-sm text-zinc-400 mb-6">
          Choose how you&apos;d like to analyze your code. GitHub is recommended
          for the best experience.
        </p>
      </motion.div>

      <div className="space-y-3 mb-6">
        <motion.div
          initial={{ y: 10, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.1, duration: 0.3 }}
        >
          <ConnectionCard
            icon={Github}
            title="Connect GitHub"
            description="Recommended • Real-time monitoring, PR checks, and automatic scans"
            selected={selectedOption === "github"}
            recommended
            onClick={() => setSelectedOption("github")}
          />
        </motion.div>

        <motion.div
          initial={{ y: 10, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.2, duration: 0.3 }}
        >
          <ConnectionCard
            icon={Upload}
            title="Upload Files"
            description="Drag & drop or browse to upload your code files"
            selected={selectedOption === "upload"}
            onClick={() => setSelectedOption("upload")}
          />
        </motion.div>
      </div>

      {connectionError && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-2 p-3 mb-4 rounded-lg bg-red-500/10 border border-red-500/20"
        >
          <AlertCircle className="h-4 w-4 text-red-400 flex-shrink-0" />
          <p className="text-sm text-red-400">{connectionError}</p>
        </motion.div>
      )}

      <motion.div
        initial={{ y: 10, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.3, duration: 0.3 }}
        className="flex items-center justify-between"
      >
        <Button
          variant="ghost"
          onClick={onSkip}
          className="text-zinc-500 hover:text-zinc-300"
        >
          Skip for now
        </Button>

        <Button
          onClick={
            selectedOption === "github" ? handleGitHubConnect : handleFileUpload
          }
          disabled={!selectedOption || isConnecting}
          className="bg-blue-600 hover:bg-blue-700"
        >
          {isConnecting ? (
            <>
              <span className="animate-spin mr-2">⏳</span>
              Connecting...
            </>
          ) : (
            <>
              Continue
              <ChevronRight className="ml-1 h-4 w-4" />
            </>
          )}
        </Button>
      </motion.div>
    </div>
  );
}

function ConnectionCard({
  icon: Icon,
  title,
  description,
  selected,
  recommended,
  onClick,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  selected: boolean;
  recommended?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full p-4 rounded-lg border text-left transition-all duration-200",
        "hover:border-zinc-600 hover:bg-zinc-900/50",
        selected
          ? "border-blue-500 bg-blue-500/5"
          : "border-zinc-800 bg-zinc-900/30",
      )}
    >
      <div className="flex items-start gap-4">
        <div
          className={cn(
            "p-2.5 rounded-lg transition-colors",
            selected ? "bg-blue-500/20" : "bg-zinc-800",
          )}
        >
          <Icon
            className={cn(
              "h-5 w-5",
              selected ? "text-blue-400" : "text-zinc-400",
            )}
          />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span
              className={cn(
                "font-medium",
                selected ? "text-zinc-100" : "text-zinc-300",
              )}
            >
              {title}
            </span>
            {recommended && (
              <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-blue-500/20 text-blue-400">
                Recommended
              </span>
            )}
          </div>
          <p className="text-sm text-zinc-500 mt-0.5">{description}</p>
        </div>
        <div
          className={cn(
            "w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors",
            selected
              ? "border-blue-500 bg-blue-500"
              : "border-zinc-700 bg-transparent",
          )}
        >
          {selected && <Check className="h-3 w-3 text-white" />}
        </div>
      </div>
    </button>
  );
}
