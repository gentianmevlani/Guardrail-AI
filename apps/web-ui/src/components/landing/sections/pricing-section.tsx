"use client";

import { GlassCardSimple } from "@/components/landing/glass-card";
import { LiquidMetalButton } from "@/components/landing/liquid-metal-button";
import { MagneticButton } from "@/components/landing/magnetic-button";
import { AnimatePresence, motion, useInView } from "framer-motion";
import { memo, useRef, useState } from "react";

const PRICING_TIERS = [
  {
    id: "free",
    name: "Free",
    price: 0,
    annual: 0,
    description: "Stop embarrassing yourself.",
    popular: false,
    features: [
      "10 scans/month",
      "1 seat",
      "Static scan + AI code validation",
      "Ship badge",
    ],
  },
  {
    id: "starter",
    name: "Starter",
    price: 29,
    annual: 278, // 20% off: 29 * 12 * 0.8 = 278
    description: "Ship weekly with proof.",
    popular: false,
    features: [
      "100 scans",
      "20 Reality runs",
      "1 seat",
      "Reality Mode + CI deploy blocking",
      "Mock detection",
    ],
  },
  {
    id: "pro",
    name: "Pro",
    price: 99,
    annual: 950, // 20% off: 99 * 12 * 0.8 = 950
    description: "Fix it for me. Verify it. Don't waste my time.",
    popular: true,
    features: [
      "100 Reality runs",
      "50 Agent runs",
      "5 seats included (+$25/seat/mo)",
      "Autonomous agent runs + verified auto-fix",
      "Autopilot + IDE/MCP",
    ],
  },
  {
    id: "compliance",
    name: "Compliance",
    price: 199,
    annual: 1910, // 20% off: 199 * 12 * 0.8 = 1910
    description: "Auditors want receipts.",
    popular: false,
    features: [
      "200 Reality runs",
      "100 Agent runs",
      "10 seats included (+$35/seat/mo)",
      "Framework mapping + audit-ready PDFs",
      "Enterprise policy controls",
    ],
  },
];

const PricingCard = memo(function PricingCard({ 
  tier, 
  billingCycle, 
  isInView 
}: { 
  tier: typeof PRICING_TIERS[0]; 
  billingCycle: "monthly" | "annual";
  isInView: boolean;
}) {
  const price = billingCycle === "monthly" ? tier.price : tier.annual;
  const displayPrice = billingCycle === "annual" && price ? price / 12 : price || 0;
  
  const calculateSavings = (monthly: number, annual: number) => {
    const monthlyTotal = monthly * 12;
    return Math.round(((monthlyTotal - annual) / monthlyTotal) * 100);
  };
  
  const savings = tier.price && tier.annual ? calculateSavings(tier.price, tier.annual) : 0;

  const stripeLinks: Record<string, { monthly: string; annual: string }> = {
    starter: {
      monthly: "https://buy.stripe.com/8x2fZa4GZegD9QU7YW3Nm03",
      annual: "https://buy.stripe.com/fZu8wI4GZgoL8MQ6US3Nm04",
    },
    pro: {
      monthly: "https://buy.stripe.com/cNi14g7TbegDbZ25QO3Nm05",
      annual: "https://buy.stripe.com/bJecMY4GZfkHgfi6US3Nm06",
    },
    compliance: {
      monthly: "https://buy.stripe.com/cNi5kwflD0pN4wAfro3Nm07",
      annual: "https://buy.stripe.com/14A8wI4GZ4G34wAgvs3Nm08",
    },
  };

  return (
    <motion.div
      variants={{
        hidden: { opacity: 0, y: 50, scale: 0.9 },
        visible: {
          opacity: 1,
          y: 0,
          scale: 1,
          transition: { type: "spring", stiffness: 100, damping: 15 },
        },
      }}
    >
      <GlassCardSimple
        className={[
          "p-6 h-full",
          tier.popular && "ring-2 ring-blue-500/30",
        ]
          .filter(Boolean)
          .join(" ")}
      >
        <AnimatePresence>
          {tier.popular && (
            <motion.div
              initial={{ y: -20, opacity: 0, scale: 0 }}
              animate={{ y: 0, opacity: 1, scale: 1 }}
              exit={{ y: -20, opacity: 0, scale: 0 }}
              className="absolute -top-3 right-4 z-10"
            >
              <motion.div
                animate={{ y: [0, -3, 0] }}
                transition={{ duration: 2, repeat: Infinity }}
                className="inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold text-white"
                style={{
                  background: "linear-gradient(135deg, #94a3b8 0%, #64748b 100%)",
                  boxShadow: "0 10px 30px -5px rgba(148, 163, 184, 0.6), inset 0 1px 0 rgba(255, 255, 255, 0.3)",
                }}
              >
                Most Popular
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="text-center mb-6 relative z-10">
          <h3 className="text-2xl font-semibold mb-2 text-white drop-shadow-lg">
            {tier.name}
          </h3>
          <p className="text-sm text-slate-300">{tier.description}</p>
        </div>

        <div className="text-center mb-6 relative z-10">
          {price !== null ? (
            <div>
              <motion.div
                key={billingCycle}
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                className="flex items-baseline justify-center gap-1"
              >
                <span className="text-5xl font-bold text-white drop-shadow-lg">
                  ${displayPrice === 0 ? "0" : Math.round(displayPrice)}
                </span>
                {displayPrice > 0 && (
                  <span className="text-slate-300">/month</span>
                )}
              </motion.div>
              {billingCycle === "annual" && price > 0 && savings > 0 && (
                <p className="text-sm text-slate-200 mt-2">
                  Save {savings}% with annual billing
                </p>
              )}
              {billingCycle === "annual" && price > 0 && (
                <p className="text-xs text-slate-400 mt-1">
                  ${price} billed annually
                </p>
              )}
            </div>
          ) : (
            <div className="text-4xl font-bold text-white drop-shadow-lg">
              Custom
            </div>
          )}
        </div>

        <div className="relative z-10 mb-6">
          <MagneticButton>
            <LiquidMetalButton
              onClick={() => {
                if (tier.id === "free") {
                  window.location.href = "/dashboard";
                } else if (stripeLinks[tier.id]) {
                  window.open(stripeLinks[tier.id][billingCycle], "_blank");
                }
              }}
              size="md"
            >
              {tier.id === "free" ? "Start Free" : "Get Started"}
            </LiquidMetalButton>
          </MagneticButton>
        </div>

        <ul className="space-y-2 relative z-10">
          {tier.features.map((feature, index) => (
            <motion.li
              key={index}
              initial={{ opacity: 0 }}
              animate={isInView ? { opacity: 1 } : { opacity: 0 }}
              transition={{ delay: 0.5 + index * 0.05 }}
              className={`text-sm ${
                index === 0 && feature.includes("plus:")
                  ? "text-slate-400 text-xs uppercase tracking-wide list-none"
                  : "text-slate-200 list-disc ml-4"
              }`}
            >
              {feature}
            </motion.li>
          ))}
        </ul>
      </GlassCardSimple>
    </motion.div>
  );
});

export function PricingSection() {
  const [billingCycle, setBillingCycle] = useState<"monthly" | "annual">("monthly");
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, amount: 0.2 });

  return (
    <section id="pricing" ref={ref} className="px-4 sm:px-6 lg:px-8 py-20">
      <div className="container mx-auto max-w-7xl">
        <motion.div
          initial={{ opacity: 0, y: 60, filter: "blur(8px)" }}
          animate={isInView ? { opacity: 1, y: 0, filter: "blur(0px)" } : { opacity: 0, y: 60, filter: "blur(8px)" }}
          transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          className="text-center mb-14"
        >
          <h2 className="text-4xl sm:text-5xl lg:text-6xl font-display font-bold mb-4 tracking-tight" style={{ textShadow: '0 4px 8px rgba(0,0,0,0.4), 0 8px 16px rgba(0,0,0,0.2)' }}>
            Pick a plan.
            <br />
            <span className="text-blue-400">Get a verdict.</span>
          </h2>
          <p className="text-lg text-gray-400 mb-8">
            Most upgrades happen after the first Reality Mode failure.
          </p>

          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={isInView ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.9 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="inline-flex items-center gap-1 p-1 rounded-2xl overflow-hidden relative bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900"
            style={{
              border: "1px solid rgba(148, 163, 184, 0.3)",
              boxShadow: "0 4px 12px rgba(71, 85, 105, 0.2), inset 0 1px 0 rgba(255, 255, 255, 0.1)",
            }}
          >
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setBillingCycle("monthly")}
              className={[
                "px-6 py-2 rounded-xl transition-all duration-200",
                billingCycle === "monthly"
                  ? "bg-white text-black"
                  : "text-gray-400 hover:text-white",
              ].join(" ")}
            >
              Monthly
            </motion.button>
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setBillingCycle("annual")}
              className={[
                "px-6 py-2 rounded-xl transition-all duration-200 flex items-center gap-2",
                billingCycle === "annual"
                  ? "bg-white text-black"
                  : "text-gray-400 hover:text-white",
              ].join(" ")}
            >
              <span>Annual</span>
              <span className="inline-flex items-center rounded-full bg-blue-500/20 px-2 py-0.5 text-xs text-blue-400">
                Save 20%
              </span>
            </motion.button>
          </motion.div>
        </motion.div>

        <motion.div
          initial="hidden"
          animate={isInView ? "visible" : "hidden"}
          variants={{
            hidden: { opacity: 0 },
            visible: {
              opacity: 1,
              transition: { staggerChildren: 0.15, delayChildren: 0.3 },
            },
          }}
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6"
        >
          {PRICING_TIERS.map((tier) => (
            <PricingCard 
              key={tier.id} 
              tier={tier} 
              billingCycle={billingCycle}
              isInView={isInView}
            />
          ))}
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 50, filter: "blur(6px)" }}
          animate={isInView ? { opacity: 1, y: 0, filter: "blur(0px)" } : { opacity: 0, y: 50, filter: "blur(6px)" }}
          transition={{ duration: 0.7, delay: 0.8, ease: [0.16, 1, 0.3, 1] }}
          className="mt-16 text-center"
        >
          <p className="text-gray-400 mb-2">
            Start with the Free plan or upgrade anytime. Cancel anytime.
          </p>
          <p className="text-sm text-gray-600">
            Questions?{" "}
            <button
              onClick={() => {
                const event = new CustomEvent("open-modal", {
                  detail: "Contact",
                });
                window.dispatchEvent(event);
              }}
              className="text-blue-400 hover:text-blue-300"
            >
              Contact our sales team
            </button>
          </p>
        </motion.div>
      </div>
    </section>
  );
}
