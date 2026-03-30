"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  Trophy,
  Shield,
  Zap,
  Flame,
  Star,
  Crown,
  Target,
  Lock,
  Eye,
  Brain,
  Sparkles,
  Medal,
  type LucideIcon,
} from "lucide-react";
import {
  getAchievements,
  type Achievement as APIAchievement,
} from "@/lib/guardrails-api";

export interface Achievement {
  id: string;
  name: string;
  description: string;
  icon: LucideIcon;
  rarity: "common" | "rare" | "epic" | "legendary";
  unlockedAt?: Date;
  progress?: number;
  maxProgress?: number;
}

const rarityConfig = {
  common: {
    bg: "from-zinc-600 to-zinc-700",
    border: "border-zinc-500",
    glow: "shadow-zinc-500/20",
    text: "text-zinc-300",
    label: "Common",
  },
  rare: {
    bg: "from-blue-600 to-blue-700",
    border: "border-blue-400",
    glow: "shadow-blue-500/30",
    text: "text-blue-300",
    label: "Rare",
  },
  epic: {
    bg: "from-purple-600 to-purple-700",
    border: "border-purple-400",
    glow: "shadow-purple-500/30",
    text: "text-purple-300",
    label: "Epic",
  },
  legendary: {
    bg: "from-amber-500 to-orange-600",
    border: "border-amber-400",
    glow: "shadow-amber-500/40",
    text: "text-amber-300",
    label: "Legendary",
  },
};

// Predefined achievements
export const ACHIEVEMENTS: Achievement[] = [
  {
    id: "first_scan",
    name: "First Steps",
    description: "Run your first security scan",
    icon: Shield,
    rarity: "common",
  },
  {
    id: "clean_code",
    name: "Clean Coder",
    description: "Pass 10 validations with no issues",
    icon: Sparkles,
    rarity: "common",
    maxProgress: 10,
  },
  {
    id: "streak_3",
    name: "On Fire",
    description: "Maintain a 3-day security streak",
    icon: Flame,
    rarity: "rare",
  },
  {
    id: "streak_7",
    name: "Unstoppable",
    description: "Maintain a 7-day security streak",
    icon: Zap,
    rarity: "epic",
  },
  {
    id: "perfect_score",
    name: "Perfectionist",
    description: "Achieve a 100% security score",
    icon: Star,
    rarity: "rare",
  },
  {
    id: "hallucination_hunter",
    name: "Hallucination Hunter",
    description: "Catch 5 AI hallucinations",
    icon: Brain,
    rarity: "epic",
    maxProgress: 5,
  },
  {
    id: "injection_defender",
    name: "Injection Defender",
    description: "Block 10 prompt injection attempts",
    icon: Lock,
    rarity: "epic",
    maxProgress: 10,
  },
  {
    id: "security_champion",
    name: "Security Champion",
    description: "Maintain 95%+ score for 30 days",
    icon: Crown,
    rarity: "legendary",
  },
  {
    id: "ai_whisperer",
    name: "AI Whisperer",
    description: "Configure 50 custom guardrails",
    icon: Target,
    rarity: "legendary",
    maxProgress: 50,
  },
  {
    id: "eagle_eye",
    name: "Eagle Eye",
    description: "Review 100 AI-generated code blocks",
    icon: Eye,
    rarity: "rare",
    maxProgress: 100,
  },
];

interface AchievementBadgeProps {
  achievement: Achievement;
  size?: "sm" | "md" | "lg";
  showProgress?: boolean;
  isNew?: boolean;
}

export function AchievementBadge({
  achievement,
  size = "md",
  showProgress = true,
  isNew = false,
}: AchievementBadgeProps) {
  const config = rarityConfig[achievement.rarity];
  const isUnlocked = !!achievement.unlockedAt;
  const progress = achievement.progress || 0;
  const maxProgress = achievement.maxProgress || 1;
  const progressPercent = Math.min((progress / maxProgress) * 100, 100);

  const sizeClasses = {
    sm: "w-12 h-12",
    md: "w-16 h-16",
    lg: "w-24 h-24",
  };

  const iconSizes = {
    sm: 20,
    md: 28,
    lg: 40,
  };

  return (
    <motion.div
      initial={isNew ? { scale: 0, rotate: -180 } : false}
      animate={{ scale: 1, rotate: 0 }}
      transition={{ type: "spring", duration: 0.8 }}
      className="relative group"
    >
      {/* Badge */}
      <div
        className={`
          relative ${sizeClasses[size]} rounded-xl 
          bg-gradient-to-br ${config.bg}
          border-2 ${config.border}
          shadow-lg ${config.glow}
          flex items-center justify-center
          transition-all duration-300
          ${isUnlocked ? "opacity-100" : "opacity-40 grayscale"}
          ${isUnlocked ? "hover:scale-110 cursor-pointer" : "cursor-not-allowed"}
        `}
      >
        {/* Shine effect */}
        {isUnlocked && (
          <div className="absolute inset-0 rounded-xl overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-tr from-white/0 via-white/20 to-white/0 -translate-x-full group-hover:translate-x-full transition-transform duration-700" />
          </div>
        )}

        {/* Icon */}
        <achievement.icon
          size={iconSizes[size]}
          className={`relative z-10 ${isUnlocked ? "text-white" : "text-zinc-400"}`}
        />

        {/* New indicator */}
        {isNew && isUnlocked && (
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full flex items-center justify-center"
          >
            <span className="text-[8px] font-bold text-white">!</span>
          </motion.div>
        )}
      </div>

      {/* Progress bar (for locked achievements with progress) */}
      {!isUnlocked && showProgress && achievement.maxProgress && (
        <div className="mt-2 w-full h-1 bg-zinc-800 rounded-full overflow-hidden">
          <motion.div
            className={`h-full bg-gradient-to-r ${config.bg}`}
            initial={{ width: 0 }}
            animate={{ width: `${progressPercent}%` }}
            transition={{ duration: 0.5 }}
          />
        </div>
      )}

      {/* Tooltip */}
      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-20">
        <div className="bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 min-w-[160px] shadow-xl">
          <div className="flex items-center gap-2 mb-1">
            <span className={`text-xs font-medium ${config.text}`}>
              {config.label}
            </span>
          </div>
          <p className="text-sm font-semibold text-white">{achievement.name}</p>
          <p className="text-xs text-zinc-400 mt-1">
            {achievement.description}
          </p>
          {!isUnlocked && achievement.maxProgress && (
            <p className="text-xs text-zinc-500 mt-1">
              Progress: {progress}/{maxProgress}
            </p>
          )}
          {isUnlocked && achievement.unlockedAt && (
            <p className="text-xs text-zinc-500 mt-1">
              Unlocked {achievement.unlockedAt.toLocaleDateString()}
            </p>
          )}
        </div>
        <div className="absolute top-full left-1/2 -translate-x-1/2 border-8 border-transparent border-t-zinc-900" />
      </div>
    </motion.div>
  );
}

interface AchievementGridProps {
  achievements: Achievement[];
  columns?: number;
}

export function AchievementGrid({
  achievements,
  columns = 5,
}: AchievementGridProps) {
  return (
    <div
      className="grid gap-4"
      style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
    >
      {achievements.map((achievement, index) => (
        <motion.div
          key={achievement.id}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: index * 0.05 }}
          className="flex flex-col items-center"
        >
          <AchievementBadge achievement={achievement} size="md" />
          <span className="mt-2 text-xs text-zinc-400 text-center truncate max-w-full">
            {achievement.name}
          </span>
        </motion.div>
      ))}
    </div>
  );
}
