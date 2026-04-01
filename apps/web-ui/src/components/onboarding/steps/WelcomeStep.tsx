"use client";

import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import type { LucideIcon } from "lucide-react";
import { Shield, Sparkles, Zap } from "lucide-react";

interface WelcomeStepProps {
  userName?: string;
  onContinue: () => void;
}

export function WelcomeStep({ userName, onContinue }: WelcomeStepProps) {
  const greeting = userName ? `Welcome, ${userName}!` : "Welcome to guardrail!";

  return (
    <div className="flex flex-col items-center text-center">
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ delay: 0.1, duration: 0.3 }}
        className="relative mb-6"
      >
        <div className="absolute inset-0 bg-blue-500/20 blur-xl rounded-full" />
        <div className="relative p-4 rounded-2xl bg-gradient-to-br from-blue-500/20 to-blue-600/10 border border-blue-500/30">
          <Shield className="h-12 w-12 text-blue-400" />
        </div>
      </motion.div>

      <motion.h2
        initial={{ y: 10, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.2, duration: 0.3 }}
        className="text-2xl font-bold text-zinc-100 mb-2"
      >
        {greeting}
      </motion.h2>

      <motion.p
        initial={{ y: 10, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.3, duration: 0.3 }}
        className="text-zinc-400 mb-8 max-w-sm"
      >
        AI-native code security that catches what others miss. Let&apos;s get
        you protected in under 2 minutes.
      </motion.p>

      <motion.div
        initial={{ y: 10, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.4, duration: 0.3 }}
        className="grid grid-cols-1 gap-3 w-full max-w-sm mb-8"
      >
        <FeatureItem
          icon={Zap}
          title="Instant Security Scans"
          description="Analyze your code in seconds"
        />
        <FeatureItem
          icon={Sparkles}
          title="AI-Powered Detection"
          description="Find issues traditional tools miss"
        />
        <FeatureItem
          icon={Shield}
          title="Continuous Protection"
          description="Monitor every commit automatically"
        />
      </motion.div>

      <motion.div
        initial={{ y: 10, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.5, duration: 0.3 }}
      >
        <Button
          onClick={onContinue}
          size="lg"
          className="bg-blue-600 hover:bg-blue-700 text-white px-8"
        >
          Let&apos;s get you set up
        </Button>
      </motion.div>
    </div>
  );
}

function FeatureItem({
  icon: Icon,
  title,
  description,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
}) {
  return (
    <div className="flex items-center gap-3 p-3 rounded-lg bg-zinc-900/50 border border-zinc-800">
      <div className="p-2 rounded-lg bg-zinc-800">
        <Icon className="h-4 w-4 text-blue-400" />
      </div>
      <div className="text-left">
        <p className="text-sm font-medium text-zinc-200">{title}</p>
        <p className="text-xs text-zinc-500">{description}</p>
      </div>
    </div>
  );
}
