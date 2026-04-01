"use client";

import { GlassCardSimple } from "@/components/landing/glass-card";
import { InfiniteGridBackground } from "@/components/landing/infinite-grid-background";
import { MagneticButton } from "@/components/landing/magnetic-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { motion, useInView } from "framer-motion";
import {
  ArrowLeft,
  CheckCircle2,
  Loader2,
  Lock,
} from "lucide-react";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, useState } from "react";

// Force dynamic rendering
export const dynamic = "force-dynamic";

const PRICING_TIERS = [
  {
    id: "starter",
    name: "Starter",
    price: 9.99,
    annual: 96,
    description: "Full findings — no auto-fix",
    popular: false,
    features: [
      "Full issue paths, rules, and snippets",
      "100 scans/month, 20 Reality runs",
      "3 projects",
      "CLI & extension",
    ],
  },
  {
    id: "pro",
    name: "Pro",
    price: 29.99,
    annual: 288,
    description: "Auto-fix & automation",
    popular: true,
    features: [
      "Everything in Starter",
      "Auto-fix",
      "AI Agent, autopilot, MCP",
      "500 scans, 100 Reality, 50 AI Agent runs/month",
    ],
  },
  {
    id: "compliance",
    name: "Compliance",
    price: 59.99,
    annual: 576,
    description: "Frameworks & audit-ready",
    popular: false,
    features: [
      "Everything in Pro",
      "SOC2, HIPAA, GDPR, PCI, NIST, ISO 27001",
      "PDF reports, deploy hooks",
      "25 projects, 10 seats",
    ],
  },
];

function CheckoutContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [selectedTier, setSelectedTier] = useState<string>("pro");
  const [billingCycle, setBillingCycle] = useState<"monthly" | "annual">(
    "monthly",
  );
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, amount: 0.2 });

  useEffect(() => {
    if (!searchParams) return;

    const tier = searchParams.get("tier");
    const cycle = searchParams.get("cycle");

    if (tier && ["starter", "pro", "compliance"].includes(tier)) {
      setSelectedTier(tier);
    }

    if (cycle && ["monthly", "annual"].includes(cycle)) {
      setBillingCycle(cycle as "monthly" | "annual");
    }
  }, [searchParams]);

  const handleCheckout = async () => {
    if (!email) {
      setError("Please enter your email address");
      return;
    }

    setIsLoading(true);
    setError("");

    try {
      const response = await fetch("/api/checkout", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          tierId: selectedTier,
          email,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.message || data.error || "Failed to create checkout session",
        );
      }

      if (data.url) {
        // Redirect to Stripe checkout
        window.location.href = data.url;
      } else {
        throw new Error("No checkout URL returned");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setIsLoading(false);
    }
  };

  const tier =
    PRICING_TIERS.find((t) => t.id === selectedTier) || PRICING_TIERS[1];
  const price = billingCycle === "monthly" ? tier.price : tier.annual;
  const displayPrice =
    billingCycle === "annual" && price ? price / 12 : price || 0;

  const calculateSavings = (monthly: number, annual: number) => {
    const monthlyTotal = monthly * 12;
    return Math.round(((monthlyTotal - annual) / monthlyTotal) * 100);
  };

  const savings =
    tier.price && tier.annual ? calculateSavings(tier.price, tier.annual) : 0;

  return (
    <main className="min-h-screen bg-black text-white relative overflow-hidden">
      <InfiniteGridBackground
        opacity={0.05}
        highlightOpacity={0.3}
        showGradients={true}
      />

      <div className="relative z-10">
        {/* Header */}
        <header className="fixed top-0 left-0 right-0 z-[100] border-b bg-black/80 backdrop-blur-xl border-gray-800">
          <div className="container mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="flex h-16 items-center justify-between">
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => router.push("/")}
                className="flex items-center gap-3 hover:opacity-80 transition-opacity"
              >
                <Image
                  src="/guardrail-logo.png"
                  alt="guardrail"
                  width={48}
                  height={48}
                  className="h-12 w-auto object-contain"
                />
                <span className="text-base sm:text-lg font-semibold">
                  guardrail
                </span>
              </motion.button>

              <Button
                onClick={() => router.push("/")}
                variant="ghost"
                className="text-white hover:bg-white/10"
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Home
              </Button>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <section ref={ref} className="px-4 sm:px-6 lg:px-8 py-20 pt-32">
          <div className="container mx-auto max-w-6xl">
            {/* Header */}
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 30 }}
              transition={{ duration: 0.6 }}
              className="text-center mb-12"
            >
              <h1 className="text-4xl sm:text-5xl font-bold mb-4">
                <span className="bg-gradient-to-r from-white via-blue-200 to-blue-400 bg-clip-text text-transparent">
                  Complete Your Purchase
                </span>
              </h1>
              <p className="text-lg text-gray-400 max-w-2xl mx-auto">
                Start building better code with guardrail's AI guardrails
              </p>
            </motion.div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Left Side - Order Summary */}
              <motion.div
                initial={{ opacity: 0, x: -30 }}
                animate={
                  isInView ? { opacity: 1, x: 0 } : { opacity: 0, x: -30 }
                }
                transition={{ duration: 0.6, delay: 0.2 }}
              >
                <GlassCardSimple className="p-6 sm:p-8">
                  <h2 className="text-2xl font-semibold mb-6 relative z-10">
                    Order Summary
                  </h2>

                  {/* Plan Selection */}
                  <div className="space-y-4 mb-6 relative z-10">
                    <label className="text-sm text-gray-400">Select Plan</label>
                    <div className="space-y-3">
                      {PRICING_TIERS.map((t) => (
                        <motion.button
                          key={t.id}
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                          onClick={() => setSelectedTier(t.id)}
                          className={[
                            "w-full p-4 rounded-xl border-2 transition-all text-left relative overflow-hidden",
                            selectedTier === t.id
                              ? "border-blue-500 bg-blue-500/10"
                              : "border-white/10 bg-white/5 hover:border-white/20",
                          ].join(" ")}
                        >
                          {t.popular && (
                            <Badge className="absolute top-2 right-2 bg-gradient-to-r from-blue-500 to-blue-400 text-white border-0">
                              Popular
                            </Badge>
                          )}
                          <div className="flex items-center justify-between mb-2">
                            <h3 className="text-lg font-semibold text-white">
                              {t.name}
                            </h3>
                            <div className="text-right">
                              <span className="text-2xl font-bold text-white">
                                $
                                {billingCycle === "annual" && t.annual
                                  ? Math.round(t.annual / 12)
                                  : t.price}
                              </span>
                              <span className="text-sm text-gray-400">
                                /mo
                              </span>
                            </div>
                          </div>
                          <p className="text-sm text-gray-400">
                            {t.description}
                          </p>
                        </motion.button>
                      ))}
                    </div>
                  </div>

                  {/* Billing Cycle */}
                  <div className="mb-6 relative z-10">
                    <label className="text-sm text-gray-400 mb-3 block">
                      Billing Cycle
                    </label>
                    <div
                      className="inline-flex items-center gap-1 p-1 rounded-2xl overflow-hidden relative bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 w-full"
                      style={{
                        border: "1px solid rgba(148, 163, 184, 0.3)",
                        boxShadow:
                          "0 4px 12px rgba(71, 85, 105, 0.2), inset 0 1px 0 rgba(255, 255, 255, 0.1)",
                      }}
                    >
                      <button
                        type="button"
                        onClick={() => setBillingCycle("monthly")}
                        className={[
                          "flex-1 px-6 py-2 rounded-xl transition-all duration-200",
                          billingCycle === "monthly"
                            ? "bg-white text-black"
                            : "text-gray-400 hover:text-white",
                        ].join(" ")}
                      >
                        Monthly
                      </button>
                      <button
                        type="button"
                        onClick={() => setBillingCycle("annual")}
                        className={[
                          "flex-1 px-6 py-2 rounded-xl transition-all duration-200 flex items-center justify-center gap-2",
                          billingCycle === "annual"
                            ? "bg-white text-black"
                            : "text-gray-400 hover:text-white",
                        ].join(" ")}
                      >
                        <span>Annual</span>
                        {savings > 0 && (
                          <span className="inline-flex items-center rounded-full bg-blue-500/20 px-2 py-0.5 text-xs text-blue-400">
                            Save {savings}%
                          </span>
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Features */}
                  <div className="mb-6 relative z-10">
                    <h3 className="text-sm text-gray-400 mb-3">
                      What's included:
                    </h3>
                    <ul className="space-y-2">
                      {tier.features.map((feature, index) => (
                        <li
                          key={index}
                          className="flex items-start gap-2 text-sm text-slate-200"
                        >
                          <CheckCircle2 className="h-5 w-5 text-blue-400 flex-shrink-0 mt-0.5" />
                          <span>{feature}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* Price Summary */}
                  <div className="border-t border-white/10 pt-4 relative z-10">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-gray-400">
                        {tier.name} Plan (
                        {billingCycle === "monthly" ? "Monthly" : "Annual"})
                      </span>
                      <span className="text-white font-semibold">
                        ${displayPrice.toFixed(2)}/mo
                      </span>
                    </div>
                    {billingCycle === "annual" && price && (
                      <div className="text-sm text-gray-500 text-right">
                        ${price} billed annually
                      </div>
                    )}
                    {billingCycle === "annual" && savings > 0 && (
                      <div className="text-sm text-blue-400 text-right">
                        You save ${tier.price! * 12 - tier.annual!} per year
                      </div>
                    )}
                  </div>
                </GlassCardSimple>
              </motion.div>

              {/* Right Side - Checkout Form */}
              <motion.div
                initial={{ opacity: 0, x: 30 }}
                animate={
                  isInView ? { opacity: 1, x: 0 } : { opacity: 0, x: 30 }
                }
                transition={{ duration: 0.6, delay: 0.4 }}
              >
                <GlassCardSimple className="p-6 sm:p-8">
                  <h2 className="text-2xl font-semibold mb-6 relative z-10">
                    Payment Details
                  </h2>

                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      handleCheckout();
                    }}
                    className="space-y-6 relative z-10"
                  >
                    {/* Email */}
                    <div>
                      <label
                        htmlFor="email"
                        className="block text-sm text-gray-400 mb-2"
                      >
                        Email Address
                      </label>
                      <input
                        id="email"
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="you@example.com"
                        required
                        className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                      />
                    </div>

                    {error && (
                      <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
                        {error}
                      </div>
                    )}

                    {/* Submit Button */}
                    <MagneticButton>
                      <Button
                        type="submit"
                        disabled={isLoading}
                        className="bg-white text-black hover:bg-gray-200 px-8 py-6 text-lg font-medium rounded-full w-full"
                      >
                        {isLoading ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Processing...
                          </>
                        ) : (
                          <>
                            <Lock className="mr-2 h-4 w-4" />
                            Complete Secure Purchase
                          </>
                        )}
                      </Button>
                    </MagneticButton>

                    {/* Security Notice */}
                    <div className="flex items-start gap-3 p-4 rounded-xl bg-white/5 border border-white/10">
                      <Lock className="h-5 w-5 text-blue-400 flex-shrink-0 mt-0.5" />
                      <div className="text-sm">
                        <p className="text-white font-medium mb-1">
                          Secure Payment
                        </p>
                        <p className="text-gray-400">
                          You'll be redirected to Stripe's secure checkout to
                          complete your payment. We never store your payment
                          information.
                        </p>
                        <div className="flex items-center gap-2 text-sm text-gray-400 mt-2">
                          <Lock className="h-4 w-4" />
                          <span>SSL Secure • PCI Compliant</span>
                        </div>
                      </div>
                    </div>

                    <p className="text-center text-sm text-gray-500">
                      By continuing, you agree to our Terms of Service and
                      Privacy Policy
                    </p>
                  </form>
                </GlassCardSimple>
              </motion.div>
            </div>

            {/* Features Strip */}
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 30 }}
              transition={{ duration: 0.6, delay: 0.6 }}
              className="mt-12 text-center"
            >
              <div className="flex flex-wrap justify-center gap-8 text-sm text-gray-400">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-blue-400" />
                  <span>Cancel anytime</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-blue-400" />
                  <span>14-day money back guarantee</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-blue-400" />
                  <span>24/7 support</span>
                </div>
              </div>
            </motion.div>
          </div>
        </section>
      </div>
    </main>
  );
}

export default function CheckoutPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-slate-950">
          <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
        </div>
      }
    >
      <CheckoutContent />
    </Suspense>
  );
}
