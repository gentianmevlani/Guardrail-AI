"use client";

import React from "react";
import { AlertTriangle, Zap, ArrowRight, X } from "lucide-react";

interface UpgradePromptProps {
  type: "limit" | "feature";
  currentUsage?: number;
  limit?: number;
  feature?: string;
  tier?: string;
  onUpgrade?: () => void;
  onDismiss?: () => void;
  variant?: "banner" | "modal" | "inline";
}

export function UpgradePrompt({
  type,
  currentUsage,
  limit,
  feature,
  tier = "free",
  onUpgrade,
  onDismiss,
  variant = "banner",
}: UpgradePromptProps) {
  const getMessage = () => {
    if (type === "limit") {
      const percentage = limit
        ? Math.round((currentUsage! / limit) * 100)
        : 100;
      if (percentage >= 100) {
        return {
          title: "Monthly Limit Reached",
          description: `You've used all ${limit} scans this month. Upgrade to Pro for unlimited scans.`,
          urgent: true,
        };
      }
      if (percentage >= 80) {
        return {
          title: "Approaching Limit",
          description: `You've used ${currentUsage} of ${limit} scans (${percentage}%). Consider upgrading soon.`,
          urgent: false,
        };
      }
    }

    return {
      title: "Feature Not Available",
      description: `${feature || "This feature"} requires a Pro plan or higher.`,
      urgent: false,
    };
  };

  const { title, description, urgent } = getMessage();

  const upgradeUrl =
    tier === "free" ? "/pricing?upgrade=pro" : "/pricing?upgrade=team";

  if (variant === "inline") {
    return (
      <div
        className={`rounded-lg p-4 ${urgent ? "bg-amber-500/10 border border-amber-500/30" : "bg-slate-800 border border-slate-700"}`}
      >
        <div className="flex items-start gap-3">
          {urgent ? (
            <AlertTriangle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
          ) : (
            <Zap className="w-5 h-5 text-emerald-400 flex-shrink-0 mt-0.5" />
          )}
          <div className="flex-1">
            <h4
              className={`font-medium ${urgent ? "text-amber-300" : "text-white"}`}
            >
              {title}
            </h4>
            <p className="text-sm text-slate-400 mt-1">{description}</p>
            <button
              onClick={onUpgrade || (() => (window.location.href = upgradeUrl))}
              className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-emerald-400 hover:text-emerald-300 transition-colors"
            >
              Upgrade Now <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (variant === "banner") {
    return (
      <div
        className={`relative ${urgent ? "bg-gradient-to-r from-amber-500/20 to-orange-500/20" : "bg-gradient-to-r from-emerald-500/20 to-teal-500/20"}`}
      >
        <div className="max-w-7xl mx-auto py-3 px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-3">
              {urgent ? (
                <AlertTriangle className="w-5 h-5 text-amber-400" />
              ) : (
                <Zap className="w-5 h-5 text-emerald-400" />
              )}
              <p className="text-sm text-white">
                <span className="font-medium">{title}:</span>{" "}
                <span className="text-slate-300">{description}</span>
              </p>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={
                  onUpgrade || (() => (window.location.href = upgradeUrl))
                }
                className="bg-white/10 hover:bg-white/20 text-white text-sm font-medium px-4 py-1.5 rounded-lg transition-colors flex items-center gap-1.5"
              >
                Upgrade <ArrowRight className="w-4 h-4" />
              </button>
              {onDismiss && (
                <button
                  onClick={onDismiss}
                  className="text-slate-400 hover:text-white transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Modal variant
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-slate-900 rounded-2xl p-6 max-w-md w-full border border-slate-700 shadow-xl">
        <div className="text-center">
          <div
            className={`w-12 h-12 rounded-full mx-auto mb-4 flex items-center justify-center ${urgent ? "bg-amber-500/20" : "bg-emerald-500/20"}`}
          >
            {urgent ? (
              <AlertTriangle className="w-6 h-6 text-amber-400" />
            ) : (
              <Zap className="w-6 h-6 text-emerald-400" />
            )}
          </div>
          <h3 className="text-xl font-semibold text-white mb-2">{title}</h3>
          <p className="text-slate-400 mb-6">{description}</p>

          <div className="space-y-3">
            <button
              onClick={onUpgrade || (() => (window.location.href = upgradeUrl))}
              className="w-full py-3 px-4 bg-emerald-500 hover:bg-emerald-400 text-white font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
            >
              Upgrade to Pro - $19/month
              <ArrowRight className="w-4 h-4" />
            </button>
            {onDismiss && (
              <button
                onClick={onDismiss}
                className="w-full py-3 px-4 bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium rounded-lg transition-colors"
              >
                Maybe Later
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default UpgradePrompt;
