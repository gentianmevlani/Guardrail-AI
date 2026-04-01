"use client";

import { motion } from "framer-motion";
import { ArrowRight, Crown, Lock, Zap } from "lucide-react";
import Link from "next/link";

export type FeatureTier = "starter" | "pro" | "compliance";

interface LockedFeatureProps {
  children: React.ReactNode;
  requiredTier: FeatureTier;
  currentTier: "free" | "starter" | "pro" | "compliance";
  featureName: string;
  description?: string;
  className?: string;
  compact?: boolean;
  previewMode?: boolean;
}

const TIER_ORDER: Record<string, number> = {
  free: 0,
  starter: 1,
  pro: 2,
  compliance: 3,
};

const TIER_PRICES: Record<FeatureTier, number> = {
  starter: 9.99,
  pro: 29.99,
  compliance: 59.99,
};

const TIER_COLORS: Record<
  FeatureTier,
  { bg: string; text: string; border: string }
> = {
  starter: {
    bg: "from-blue-500/20 to-blue-600/10",
    text: "text-blue-400",
    border: "border-blue-500/30",
  },
  pro: {
    bg: "from-purple-500/20 to-purple-600/10",
    text: "text-purple-400",
    border: "border-purple-500/30",
  },
  compliance: {
    bg: "from-amber-500/20 to-amber-600/10",
    text: "text-amber-400",
    border: "border-amber-500/30",
  },
};

export function LockedFeature({
  children,
  requiredTier,
  currentTier,
  featureName,
  description,
  className = "",
  compact = false,
  previewMode = true,
}: LockedFeatureProps) {
  const isLocked = TIER_ORDER[currentTier] < TIER_ORDER[requiredTier];

  if (!isLocked) {
    return <>{children}</>;
  }

  const colors = TIER_COLORS[requiredTier];
  const price = TIER_PRICES[requiredTier];

  if (compact) {
    return (
      <div className={`relative ${className}`}>
        <div className="opacity-50 pointer-events-none select-none">
          {children}
        </div>
        <div className="absolute top-2 right-2 z-10">
          <div
            className={`flex items-center gap-1.5 px-2 py-1 rounded-full bg-gradient-to-r ${colors.bg} border ${colors.border} backdrop-blur-sm`}
          >
            <Lock className={`h-3 w-3 ${colors.text}`} />
            <span className={`text-xs font-medium ${colors.text}`}>
              {requiredTier.charAt(0).toUpperCase() + requiredTier.slice(1)}
            </span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`relative ${className}`}>
      <div
        className={
          previewMode
            ? "blur-sm pointer-events-none select-none opacity-60"
            : "hidden"
        }
      >
        {children}
      </div>

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className={`absolute inset-0 flex items-center justify-center p-6 rounded-xl bg-gradient-to-br ${colors.bg} border ${colors.border} backdrop-blur-md`}
      >
        <div className="text-center max-w-sm">
          <div className="flex justify-center mb-4">
            <div
              className={`p-3 rounded-full bg-gradient-to-br ${colors.bg} border ${colors.border}`}
            >
              <Crown className={`w-8 h-8 ${colors.text}`} />
            </div>
          </div>

          <h3 className="text-lg font-semibold text-white mb-2">{featureName}</h3>

          {description && (
            <p className="text-sm text-slate-400 mb-4">{description}</p>
          )}

          <div className="flex items-center justify-center gap-2 mb-4">
            <Lock className={`w-4 h-4 ${colors.text}`} />
            <span className={`text-sm font-medium ${colors.text}`}>
              Requires {requiredTier.charAt(0).toUpperCase() + requiredTier.slice(1)} plan
            </span>
          </div>

          <div className="flex items-center justify-center gap-2 mb-6">
            <Zap className={`w-4 h-4 ${colors.text}`} />
            <span className="text-2xl font-bold text-white">
              ${price}
              <span className="text-sm font-normal text-slate-400">/mo</span>
            </span>
          </div>

          <Link
            href="/billing"
            className={`inline-flex items-center gap-2 px-6 py-3 rounded-lg bg-gradient-to-r ${colors.bg} border ${colors.border} text-white font-medium hover:opacity-90 transition-opacity`}
          >
            Upgrade Now
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </motion.div>
    </div>
  );
}
