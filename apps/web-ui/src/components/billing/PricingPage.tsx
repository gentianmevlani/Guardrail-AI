"use client";

import { ArrowRight, Check, Sparkles, Zap } from "lucide-react";
import { useState } from "react";

interface PricingTier {
  name: string;
  price: number;
  annualPrice: number;
  description: string;
  features: string[];
  highlighted?: boolean;
  cta: string;
  tier: "free" | "starter" | "pro" | "compliance";
}

const tiers: PricingTier[] = [
  {
    name: "Free",
    price: 0,
    annualPrice: 0,
    description: "Severity counts — findings blurred",
    tier: "free",
    features: [
      "10 scans/month",
      "1 project",
      "Blurred findings — upgrade to see details",
      "CLI & extension",
    ],
    cta: "Get Started",
  },
  {
    name: "Starter",
    price: 9.99,
    annualPrice: 96,
    description: "Full findings — no auto-fix",
    tier: "starter",
    features: [
      "100 scans/month, 20 Reality runs",
      "Full paths, rules, messages, snippets",
      "3 projects",
      "No auto-fix (Pro+)",
    ],
    cta: "Subscribe",
  },
  {
    name: "Pro",
    price: 29.99,
    annualPrice: 288,
    description: "Auto-fix & automation",
    tier: "pro",
    highlighted: true,
    features: [
      "Everything in Starter",
      "Auto-fix",
      "AI Agent, autopilot, MCP",
      "500 scans, 100 Reality, 50 AI Agent runs/month",
      "10 projects",
    ],
    cta: "Subscribe",
  },
  {
    name: "Compliance",
    price: 59.99,
    annualPrice: 576,
    description: "Frameworks & audit-ready",
    tier: "compliance",
    features: [
      "Everything in Pro",
      "SOC2, HIPAA, GDPR, PCI, NIST, ISO 27001",
      "PDF reports, deploy hooks",
      "25 projects, 10 seats",
    ],
    cta: "Subscribe",
  },
];

interface PricingPageProps {
  currentTier?: string;
  onSelectPlan?: (tier: string, interval: "month" | "year") => void;
}

export function PricingPage({
  currentTier = "free",
  onSelectPlan,
}: PricingPageProps) {
  const [billingInterval, setBillingInterval] = useState<"month" | "year">(
    "month",
  );

  const handleSelectPlan = (tier: string) => {
    if (tier === "free") {
      window.location.href = "/signup";
      return;
    }
    onSelectPlan?.(tier, billingInterval);
  };

  const getPrice = (tier: PricingTier) => {
    if (tier.price === 0) return "Free";
    const price = billingInterval === "year" ? tier.annualPrice : tier.price;
    return `$${price}`;
  };

  const getPeriod = (tier: PricingTier) => {
    if (tier.price === 0) return "";
    return billingInterval === "year" ? "/year" : "/month";
  };

  const getSavings = (tier: PricingTier) => {
    if (tier.price === 0 || billingInterval !== "year") return null;
    const monthlyCost = tier.price * 12;
    const savings = monthlyCost - tier.annualPrice;
    return savings > 0 ? `Save $${savings.toFixed(0)}` : null;
  };

  return (
    <div className="py-16 px-4 sm:px-6 lg:px-8 bg-gradient-to-b from-slate-900 to-slate-800 min-h-screen">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-white mb-4">
            Simple, Transparent Pricing
          </h1>
          <p className="text-xl text-slate-400 max-w-2xl mx-auto">
            Free, Starter, Pro, and Compliance — upgrade when you need full detail
            or auto-fix.
          </p>
        </div>

        <div className="flex justify-center mb-12">
          <div className="bg-slate-800 p-1 rounded-lg inline-flex">
            <button
              type="button"
              onClick={() => setBillingInterval("month")}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                billingInterval === "month"
                  ? "bg-emerald-500 text-white"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              Monthly
            </button>
            <button
              type="button"
              onClick={() => setBillingInterval("year")}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                billingInterval === "year"
                  ? "bg-emerald-500 text-white"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              Annual
              <span className="ml-1.5 text-xs bg-emerald-600 px-1.5 py-0.5 rounded">
                Save ~20%
              </span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {tiers.map((tier) => {
            const isCurrentPlan = tier.tier === currentTier;
            const savings = getSavings(tier);

            return (
              <div
                key={tier.name}
                className={`relative rounded-2xl p-6 ${
                  tier.highlighted
                    ? "bg-gradient-to-b from-emerald-500/20 to-emerald-500/5 border-2 border-emerald-500"
                    : "bg-slate-800/50 border border-slate-700"
                }`}
              >
                {tier.highlighted && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <span className="bg-emerald-500 text-white text-xs font-semibold px-3 py-1 rounded-full flex items-center gap-1">
                      <Sparkles className="w-3 h-3" />
                      Most Popular
                    </span>
                  </div>
                )}

                <div className="mb-6">
                  <div className="flex items-center gap-2 mb-2">
                    <Zap className="w-5 h-5 text-emerald-400" />
                    <h3 className="text-lg font-semibold text-white">
                      {tier.name}
                    </h3>
                  </div>
                  <p className="text-sm text-slate-400">{tier.description}</p>
                </div>

                <div className="mb-6">
                  <div className="flex items-baseline gap-1">
                    <span className="text-4xl font-bold text-white">
                      {getPrice(tier)}
                    </span>
                    <span className="text-slate-400">{getPeriod(tier)}</span>
                  </div>
                  {savings && (
                    <span className="text-xs text-emerald-400">{savings}</span>
                  )}
                </div>

                <ul className="space-y-3 mb-6">
                  {tier.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-2">
                      <Check className="w-5 h-5 text-emerald-400 flex-shrink-0 mt-0.5" />
                      <span className="text-sm text-slate-300">{feature}</span>
                    </li>
                  ))}
                </ul>

                <button
                  type="button"
                  onClick={() => handleSelectPlan(tier.tier)}
                  disabled={isCurrentPlan}
                  className={`w-full py-3 px-4 rounded-lg font-medium transition-all flex items-center justify-center gap-2 ${
                    isCurrentPlan
                      ? "bg-slate-700 text-slate-400 cursor-not-allowed"
                      : tier.highlighted
                        ? "bg-emerald-500 hover:bg-emerald-600 text-white"
                        : "bg-slate-700 hover:bg-slate-600 text-white"
                  }`}
                >
                  {isCurrentPlan ? "Current plan" : tier.cta}
                  {!isCurrentPlan && <ArrowRight className="w-4 h-4" />}
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
