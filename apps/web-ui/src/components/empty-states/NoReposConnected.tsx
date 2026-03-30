"use client";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import type { LucideIcon } from "lucide-react";
import {
  Bell,
  FolderGit2,
  Github,
  GitPullRequest,
  Shield,
  Upload,
} from "lucide-react";

interface NoReposConnectedProps {
  onConnectGitHub: () => void;
  onUploadFiles: () => void;
  className?: string;
}

export function NoReposConnected({
  onConnectGitHub,
  onUploadFiles,
  className,
}: NoReposConnectedProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center py-16 px-4",
        className,
      )}
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.3 }}
        className="relative mb-8"
      >
        <RepoIllustration />
      </motion.div>

      <motion.h2
        initial={{ y: 10, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.1, duration: 0.3 }}
        className="text-2xl font-bold text-zinc-100 mb-3 text-center"
      >
        Connect your first repository
      </motion.h2>

      <motion.p
        initial={{ y: 10, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.2, duration: 0.3 }}
        className="text-zinc-400 text-center max-w-md mb-8"
      >
        Link your GitHub repositories to enable real-time security monitoring,
        automatic PR checks, and continuous protection.
      </motion.p>

      <motion.div
        initial={{ y: 10, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.3, duration: 0.3 }}
        className="grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-lg mb-8"
      >
        <BenefitItem icon={Shield} label="Real-time monitoring" />
        <BenefitItem icon={GitPullRequest} label="PR security checks" />
        <BenefitItem icon={Bell} label="Instant alerts" />
      </motion.div>

      <motion.div
        initial={{ y: 10, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.4, duration: 0.3 }}
        className="flex flex-col sm:flex-row items-center gap-3"
      >
        <Button
          onClick={onConnectGitHub}
          size="lg"
          className="bg-blue-600 hover:bg-blue-700 text-white"
        >
          <Github className="mr-2 h-5 w-5" />
          Connect GitHub
        </Button>
        <Button
          variant="outline"
          onClick={onUploadFiles}
          className="border-zinc-700 text-zinc-300 hover:bg-zinc-800"
        >
          <Upload className="mr-2 h-4 w-4" />
          Upload files instead
        </Button>
      </motion.div>
    </div>
  );
}

function BenefitItem({
  icon: Icon,
  label,
}: {
  icon: LucideIcon;
  label: string;
}) {
  return (
    <div className="flex items-center gap-2 text-sm text-zinc-400">
      <Icon className="h-4 w-4 text-blue-400" />
      <span>{label}</span>
    </div>
  );
}

function RepoIllustration() {
  return (
    <div className="relative w-32 h-32">
      <div className="absolute inset-0 bg-blue-500/10 rounded-full blur-xl" />
      <div className="relative w-full h-full flex items-center justify-center">
        <div className="absolute w-20 h-20 rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-center transform -rotate-6">
          <FolderGit2 className="h-8 w-8 text-zinc-600" />
        </div>
        <div className="absolute w-20 h-20 rounded-2xl bg-zinc-900 border border-zinc-700 flex items-center justify-center transform rotate-6 translate-x-2 translate-y-2">
          <Github className="h-8 w-8 text-zinc-500" />
        </div>
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.3, type: "spring" }}
          className="absolute -bottom-2 -right-2 p-2 rounded-full bg-blue-500/20 border border-blue-500/30"
        >
          <Shield className="h-5 w-5 text-blue-400" />
        </motion.div>
      </div>
    </div>
  );
}
