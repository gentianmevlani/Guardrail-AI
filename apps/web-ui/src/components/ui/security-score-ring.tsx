"use client";

import { AnimatePresence, motion } from "framer-motion";
import {
  Flame,
  Sparkles,
  TrendingDown,
  TrendingUp,
  Trophy,
  Zap,
} from "lucide-react";
import { useEffect, useState } from "react";

interface SecurityScoreRingProps {
  score: number;
  previousScore?: number;
  size?: "sm" | "md" | "lg" | "xl";
  showTrend?: boolean;
  showBadge?: boolean;
  animated?: boolean;
  streak?: number;
}

const sizeConfig = {
  sm: { ring: 80, stroke: 6, fontSize: "text-lg", iconSize: 16 },
  md: { ring: 120, stroke: 8, fontSize: "text-2xl", iconSize: 20 },
  lg: { ring: 160, stroke: 10, fontSize: "text-4xl", iconSize: 28 },
  xl: { ring: 220, stroke: 12, fontSize: "text-5xl", iconSize: 36 },
};

const getScoreColor = (score: number) => {
  if (score >= 90)
    return {
      primary: "#10b981",
      glow: "rgba(16, 185, 129, 0.5)",
      label: "Excellent",
    };
  if (score >= 75)
    return {
      primary: "#3b82f6",
      glow: "rgba(59, 130, 246, 0.5)",
      label: "Good",
    };
  if (score >= 60)
    return {
      primary: "#f59e0b",
      glow: "rgba(245, 158, 11, 0.5)",
      label: "Fair",
    };
  if (score >= 40)
    return {
      primary: "#f97316",
      glow: "rgba(249, 115, 22, 0.5)",
      label: "Needs Work",
    };
  return {
    primary: "#ef4444",
    glow: "rgba(239, 68, 68, 0.5)",
    label: "Critical",
  };
};

const getBadge = (score: number, streak: number) => {
  if (score >= 95 && streak >= 7)
    return { icon: Trophy, label: "Security Champion", color: "#fbbf24" };
  if (score >= 90) return { icon: Sparkles, label: "Elite", color: "#a855f7" };
  if (score >= 80) return { icon: Zap, label: "Pro", color: "#3b82f6" };
  if (streak >= 5)
    return { icon: Flame, label: `${streak} Day Streak`, color: "#f97316" };
  return null;
};

export function SecurityScoreRing({
  score,
  previousScore,
  size = "lg",
  showTrend = true,
  showBadge = true,
  animated = true,
  streak = 0,
}: SecurityScoreRingProps) {
  const [displayScore, setDisplayScore] = useState(animated ? 0 : score);
  const config = sizeConfig[size];
  const colors = getScoreColor(score);
  const badge = getBadge(score, streak);

  const radius = (config.ring - config.stroke) / 2;
  const circumference = radius * 2 * Math.PI;
  const offset = circumference - (displayScore / 100) * circumference;

  const trend = previousScore !== undefined ? score - previousScore : 0;

  useEffect(() => {
    if (!animated) {
      setDisplayScore(score);
      return;
    }

    const duration = 1500;
    const startTime = Date.now();
    const startScore = displayScore;

    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);

      // Easing function for smooth animation
      const easeOut = 1 - Math.pow(1 - progress, 3);
      const current = startScore + (score - startScore) * easeOut;

      setDisplayScore(Math.round(current));

      if (progress < 1) {
        requestAnimationFrame(animate);
      }
    };

    requestAnimationFrame(animate);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [score, animated]);

  return (
    <div className="relative flex flex-col items-center">
      {/* Main Ring */}
      <div
        className="relative"
        style={{ width: config.ring, height: config.ring }}
      >
        {/* Glow effect */}
        <div
          className="absolute inset-0 rounded-full blur-xl opacity-30 transition-all duration-500"
          style={{ backgroundColor: colors.primary }}
        />

        {/* Background ring */}
        <svg
          className="absolute inset-0 -rotate-90"
          viewBox={`0 0 ${config.ring} ${config.ring}`}
        >
          <circle
            cx={config.ring / 2}
            cy={config.ring / 2}
            r={radius}
            fill="none"
            stroke="currentColor"
            strokeWidth={config.stroke}
            className="text-zinc-800"
          />
        </svg>

        {/* Progress ring */}
        <svg
          className="absolute inset-0 -rotate-90"
          viewBox={`0 0 ${config.ring} ${config.ring}`}
        >
          <motion.circle
            cx={config.ring / 2}
            cy={config.ring / 2}
            r={radius}
            fill="none"
            stroke={colors.primary}
            strokeWidth={config.stroke}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            style={{
              filter: `drop-shadow(0 0 8px ${colors.glow})`,
              transition: "stroke-dashoffset 0.5s ease-out, stroke 0.3s ease",
            }}
          />
        </svg>

        {/* Center content */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <motion.span
            className={`font-bold text-white ${config.fontSize}`}
            key={displayScore}
            initial={{ scale: 1.1, opacity: 0.8 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.2 }}
          >
            {displayScore}
          </motion.span>
          <span className="text-xs text-zinc-400 uppercase tracking-wider">
            {colors.label}
          </span>
        </div>

        {/* Trend indicator */}
        {showTrend && trend !== 0 && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className={`absolute -bottom-1 -right-1 flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-xs font-medium ${
              trend > 0
                ? "bg-emerald-500/20 text-emerald-400"
                : "bg-red-500/20 text-red-400"
            }`}
          >
            {trend > 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
            {Math.abs(trend)}
          </motion.div>
        )}
      </div>

      {/* Badge */}
      <AnimatePresence>
        {showBadge && badge && (
          <motion.div
            initial={{ opacity: 0, y: -10, scale: 0.8 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.8 }}
            className="mt-3 flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-zinc-900/80 border border-zinc-700"
          >
            <badge.icon size={14} style={{ color: badge.color }} />
            <span className="text-xs font-medium text-zinc-300">
              {badge.label}
            </span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
