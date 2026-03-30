"use client";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import { Bell, CheckCircle2, Shield, Sparkles } from "lucide-react";
import { useEffect, useRef, useState } from "react";

interface NoIssuesFoundProps {
  onSetupMonitoring: () => void;
  showConfetti?: boolean;
  className?: string;
}

export function NoIssuesFound({
  onSetupMonitoring,
  showConfetti = true,
  className,
}: NoIssuesFoundProps) {
  const confettiRef = useRef<HTMLCanvasElement>(null);
  const [hasTriggeredConfetti, setHasTriggeredConfetti] = useState(false);

  useEffect(() => {
    if (showConfetti && confettiRef.current && !hasTriggeredConfetti) {
      setHasTriggeredConfetti(true);
      triggerConfetti(confettiRef.current);
    }
  }, [showConfetti, hasTriggeredConfetti]);

  return (
    <div className={cn("flex flex-col items-center justify-center py-16 px-4 relative", className)}>
      {showConfetti && (
        <canvas
          ref={confettiRef}
          className="absolute inset-0 pointer-events-none z-10"
          style={{ width: "100%", height: "100%" }}
        />
      )}

      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "spring", duration: 0.5 }}
        className="relative mb-8"
      >
        <div className="relative">
          <div className="absolute inset-0 bg-green-500/20 rounded-full blur-xl" />
          <div className="relative p-6 rounded-full bg-gradient-to-br from-green-500/20 to-emerald-600/10 border border-green-500/30">
            <CheckCircle2 className="h-16 w-16 text-green-400" />
          </div>
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.3, type: "spring" }}
            className="absolute -top-1 -right-1"
          >
            <Sparkles className="h-6 w-6 text-yellow-400" />
          </motion.div>
        </div>
      </motion.div>

      <motion.h2
        initial={{ y: 10, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.2, duration: 0.3 }}
        className="text-2xl font-bold text-zinc-100 mb-3 text-center"
      >
        Your code looks great! 🎉
      </motion.h2>

      <motion.p
        initial={{ y: 10, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.3, duration: 0.3 }}
        className="text-zinc-400 text-center max-w-md mb-8"
      >
        No security issues detected in your codebase. Set up continuous
        monitoring to stay protected as your code evolves.
      </motion.p>

      <motion.div
        initial={{ y: 10, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.4, duration: 0.3 }}
        className="flex flex-col sm:flex-row items-center gap-3"
      >
        <Button
          onClick={onSetupMonitoring}
          size="lg"
          className="bg-green-600 hover:bg-green-700 text-white"
        >
          <Bell className="mr-2 h-5 w-5" />
          Set up monitoring to stay protected
        </Button>
      </motion.div>

      <motion.div
        initial={{ y: 10, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.5, duration: 0.3 }}
        className="mt-8 p-4 rounded-lg bg-zinc-900/50 border border-zinc-800 max-w-md"
      >
        <div className="flex items-start gap-3">
          <Shield className="h-5 w-5 text-green-400 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-zinc-200">Stay Protected</p>
            <p className="text-xs text-zinc-500 mt-1">
              Enable Autopilot to automatically scan every commit and get
              notified when new vulnerabilities are introduced.
            </p>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

function triggerConfetti(canvas: HTMLCanvasElement) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const rect = canvas.getBoundingClientRect();
  canvas.width = rect.width;
  canvas.height = rect.height;

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

  const colors = ["#10B981", "#34D399", "#6EE7B7", "#3B82F6", "#60A5FA", "#F59E0B"];

  for (let i = 0; i < 100; i++) {
    particles.push({
      x: canvas.width / 2,
      y: canvas.height / 3,
      vx: (Math.random() - 0.5) * 15,
      vy: (Math.random() - 0.5) * 15 - 8,
      color: colors[Math.floor(Math.random() * colors.length)],
      size: Math.random() * 6 + 3,
      rotation: Math.random() * Math.PI * 2,
      rotationSpeed: (Math.random() - 0.5) * 0.2,
    });
  }

  let frame = 0;
  const maxFrames = 100;

  function animate() {
    if (frame >= maxFrames) {
      ctx!.clearRect(0, 0, canvas.width, canvas.height);
      return;
    }

    ctx!.clearRect(0, 0, canvas.width, canvas.height);

    particles.forEach((p) => {
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.4;
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
