"use client";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import { ChevronRight, Clock, Search, Zap } from "lucide-react";

interface NoScansRunProps {
  onScanNow: () => void;
  hasRepos?: boolean;
  className?: string;
}

export function NoScansRun({ onScanNow, hasRepos = true, className }: NoScansRunProps) {
  return (
    <div className={cn("flex flex-col items-center justify-center py-16 px-4", className)}>
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.3 }}
        className="relative mb-8"
      >
        <ScanIllustration />
      </motion.div>

      <motion.h2
        initial={{ y: 10, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.1, duration: 0.3 }}
        className="text-2xl font-bold text-zinc-100 mb-3 text-center"
      >
        Run your first security scan
      </motion.h2>

      <motion.p
        initial={{ y: 10, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.2, duration: 0.3 }}
        className="text-zinc-400 text-center max-w-md mb-6"
      >
        Takes ~30 seconds for most repositories. Our AI will analyze your code
        for vulnerabilities, security issues, and best practice violations.
      </motion.p>

      <motion.div
        initial={{ y: 10, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.3, duration: 0.3 }}
        className="flex items-center gap-2 px-4 py-2 rounded-full bg-zinc-900/50 border border-zinc-800 mb-8"
      >
        <Clock className="h-4 w-4 text-zinc-500" />
        <span className="text-sm text-zinc-400">Average scan time: 30 seconds</span>
      </motion.div>

      <motion.div
        initial={{ y: 10, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.4, duration: 0.3 }}
      >
        <Button
          onClick={onScanNow}
          size="lg"
          className="bg-blue-600 hover:bg-blue-700 text-white"
          disabled={!hasRepos}
        >
          <Zap className="mr-2 h-5 w-5" />
          Scan Now
          <ChevronRight className="ml-1 h-4 w-4" />
        </Button>
        {!hasRepos && (
          <p className="text-xs text-zinc-500 mt-2 text-center">
            Connect a repository first to run a scan
          </p>
        )}
      </motion.div>
    </div>
  );
}

function ScanIllustration() {
  return (
    <div className="relative w-32 h-32">
      <div className="absolute inset-0 bg-blue-500/10 rounded-full blur-xl" />
      <div className="relative w-full h-full flex items-center justify-center">
        <div className="w-24 h-24 rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-center">
          <Search className="h-10 w-10 text-zinc-600" />
        </div>
        <motion.div
          animate={{
            scale: [1, 1.2, 1],
            opacity: [0.5, 1, 0.5],
          }}
          transition={{
            duration: 2,
            repeat: Infinity,
            ease: "easeInOut",
          }}
          className="absolute inset-0 rounded-2xl border-2 border-blue-500/30"
        />
        <motion.div
          animate={{
            scale: [1, 1.4, 1],
            opacity: [0.3, 0.6, 0.3],
          }}
          transition={{
            duration: 2,
            repeat: Infinity,
            ease: "easeInOut",
            delay: 0.3,
          }}
          className="absolute inset-0 rounded-2xl border-2 border-blue-500/20"
        />
      </div>
    </div>
  );
}
