"use client";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import type { LucideIcon } from "lucide-react";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  GitBranch,
  Users,
  Zap,
} from "lucide-react";
import { useEffect, useRef } from "react";

interface ResultsStepProps {
  issuesFound: number;
  score: number;
  repoName?: string;
  userTier: "free" | "starter" | "pro" | "compliance";
  githubConnected: boolean;
  onComplete: () => void;
}

export function ResultsStep({
  issuesFound,
  score,
  repoName,
  userTier,
  githubConnected,
  onComplete,
}: ResultsStepProps) {
  const confettiRef = useRef<HTMLCanvasElement>(null);
  const isClean = issuesFound === 0;
  const isPaidTier = userTier !== "free";

  useEffect(() => {
    if (isClean && confettiRef.current) {
      triggerConfetti(confettiRef.current);
    }
  }, [isClean]);

  return (
    <div className="flex flex-col items-center">
      {isClean && (
        <canvas
          ref={confettiRef}
          className="fixed inset-0 pointer-events-none z-50"
          style={{ width: "100vw", height: "100vh" }}
        />
      )}

      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "spring", duration: 0.5 }}
        className="relative mb-6"
      >
        <div
          className={cn(
            "p-4 rounded-2xl",
            isClean
              ? "bg-gradient-to-br from-green-500/20 to-emerald-600/10 border border-green-500/30"
              : "bg-gradient-to-br from-amber-500/20 to-orange-600/10 border border-amber-500/30",
          )}
        >
          {isClean ? (
            <CheckCircle2 className="h-12 w-12 text-green-400" />
          ) : (
            <AlertTriangle className="h-12 w-12 text-amber-400" />
          )}
        </div>
        {isClean && (
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.3, type: "spring" }}
            className="absolute -top-1 -right-1 p-1 rounded-full bg-green-500"
          >
            <CheckCircle2 className="h-4 w-4 text-white" />
          </motion.div>
        )}
      </motion.div>

      <motion.h2
        initial={{ y: 10, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.1 }}
        className="text-2xl font-bold text-zinc-100 mb-2 text-center"
      >
        {isClean ? "Your code looks great!" : `${issuesFound} issues found`}
      </motion.h2>

      <motion.p
        initial={{ y: 10, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.2 }}
        className="text-zinc-400 mb-2 text-center"
      >
        {isClean
          ? "No security issues detected in your code."
          : "We found some areas that need attention."}
      </motion.p>

      {repoName && (
        <motion.p
          initial={{ y: 10, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.25 }}
          className="text-sm text-zinc-500 mb-6"
        >
          Scanned: {repoName}
        </motion.p>
      )}

      <motion.div
        initial={{ y: 10, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.3 }}
        className="w-full max-w-sm mb-6"
      >
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm text-zinc-500">Security Score</span>
          <span
            className={cn(
              "text-lg font-bold",
              score >= 80
                ? "text-green-400"
                : score >= 60
                  ? "text-amber-400"
                  : "text-red-400",
            )}
          >
            {score}/100
          </span>
        </div>
        <div className="h-2 rounded-full bg-zinc-800 overflow-hidden">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${score}%` }}
            transition={{ delay: 0.4, duration: 0.8, ease: "easeOut" }}
            className={cn(
              "h-full rounded-full",
              score >= 80
                ? "bg-green-500"
                : score >= 60
                  ? "bg-amber-500"
                  : "bg-red-500",
            )}
          />
        </div>
      </motion.div>

      <motion.div
        initial={{ y: 10, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.4 }}
        className="w-full space-y-2 mb-6"
      >
        <p className="text-xs text-zinc-500 uppercase tracking-wide mb-3">
          Recommended Next Steps
        </p>

        {githubConnected && (
          <NextStepCard
            icon={GitBranch}
            title="Set up CI/CD Integration"
            description="Automatically scan every PR"
            onClick={() => {}}
          />
        )}

        <NextStepCard
          icon={Zap}
          title={isClean ? "Enable Autopilot" : "Review & Fix Issues"}
          description={
            isClean
              ? "Get notified when new issues appear"
              : "See detailed recommendations"
          }
          onClick={() => {}}
        />

        {isPaidTier && (
          <NextStepCard
            icon={Users}
            title="Invite Your Team"
            description="Collaborate on security together"
            onClick={() => {}}
          />
        )}
      </motion.div>

      <motion.div
        initial={{ y: 10, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.5 }}
      >
        <Button
          onClick={onComplete}
          size="lg"
          className="bg-blue-600 hover:bg-blue-700 text-white px-8"
        >
          Go to Dashboard
          <ChevronRight className="ml-1 h-4 w-4" />
        </Button>
      </motion.div>
    </div>
  );
}

function NextStepCard({
  icon: Icon,
  title,
  description,
  onClick,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-3 p-3 rounded-lg border border-zinc-800 bg-zinc-900/30 hover:border-zinc-600 hover:bg-zinc-900/50 transition-colors text-left group"
    >
      <div className="p-2 rounded-lg bg-zinc-800 group-hover:bg-zinc-700 transition-colors">
        <Icon className="h-4 w-4 text-blue-400" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-zinc-200">{title}</p>
        <p className="text-xs text-zinc-500">{description}</p>
      </div>
      <ChevronRight className="h-4 w-4 text-zinc-600 group-hover:text-zinc-400 transition-colors" />
    </button>
  );
}

function triggerConfetti(canvas: HTMLCanvasElement) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;

  const particles: Array<{
    x: number;
    y: number;
    vx: number;
    vy: number;
    color: string;
    size: number;
    rotation: number;
    rotationSpeed: number;
  }> = [];

  const colors = [
    "#3B82F6",
    "#10B981",
    "#F59E0B",
    "#EF4444",
    "#8B5CF6",
    "#EC4899",
  ];

  for (let i = 0; i < 150; i++) {
    particles.push({
      x: canvas.width / 2,
      y: canvas.height / 2,
      vx: (Math.random() - 0.5) * 20,
      vy: (Math.random() - 0.5) * 20 - 10,
      color: colors[Math.floor(Math.random() * colors.length)],
      size: Math.random() * 8 + 4,
      rotation: Math.random() * Math.PI * 2,
      rotationSpeed: (Math.random() - 0.5) * 0.2,
    });
  }

  let frame = 0;
  const maxFrames = 120;

  function animate() {
    if (frame >= maxFrames) {
      ctx!.clearRect(0, 0, canvas.width, canvas.height);
      return;
    }

    ctx!.clearRect(0, 0, canvas.width, canvas.height);

    particles.forEach((p) => {
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.5;
      p.rotation += p.rotationSpeed;
      p.vx *= 0.99;

      ctx!.save();
      ctx!.translate(p.x, p.y);
      ctx!.rotate(p.rotation);
      ctx!.fillStyle = p.color;
      ctx!.globalAlpha = Math.max(0, 1 - frame / maxFrames);
      ctx!.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
      ctx!.restore();
    });

    frame++;
    requestAnimationFrame(animate);
  }

  animate();
}
