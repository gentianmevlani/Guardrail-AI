"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useAuth } from "@/context/auth-context";
import { PRICING_PLANS } from "@/lib/pricing";
import type { PaidTier } from "@/lib/tier-gates";
import {
  ArrowRight,
  Check,
  CheckCircle,
  Crown,
  Loader2,
  Shield,
  Sparkles,
  Star,
  Zap,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

// Map icons to pricing plans

// Force dynamic rendering
export const dynamic = "force-dynamic";

const PLAN_ICONS = {
  free: Shield,
  starter: Sparkles,
  pro: Zap,
  compliance: Crown,
} as const;

export default function PricingPage() {
  const router = useRouter();
  const { user, subscribe, isAuthenticated, isLoading, isPaid } = useAuth();
  const [loading, setLoading] = useState<string | null>(null);
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  // Redirect to landing if not authenticated
  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push("/");
    }
  }, [isLoading, isAuthenticated, router]);

  // Redirect to dashboard if already paid
  useEffect(() => {
    if (!isLoading && isAuthenticated && isPaid) {
      router.push("/dashboard");
    }
  }, [isLoading, isAuthenticated, isPaid, router]);

  // Show loading while checking auth
  if (isLoading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-blue-500 mx-auto mb-4" />
          <p className="text-white">Loading...</p>
        </div>
      </div>
    );
  }

  // Don't render if not authenticated (will redirect)
  if (!isAuthenticated) {
    return null;
  }

  const handleSubscribe = async (planId: string) => {
    setLoading(planId);
    setMessage(null);

    try {
      if (planId === "free") {
        router.push("/dashboard");
        setLoading(null);
        return;
      }
      const result = await subscribe(planId as PaidTier);

      if (result.success) {
        if (result.checkoutUrl) {
          // Redirect to Stripe checkout
          window.location.href = result.checkoutUrl;
        } else {
          // Direct subscription (for demo)
          setMessage({
            type: "success",
            text: "Successfully subscribed! Redirecting to dashboard...",
          });
          setTimeout(() => router.push("/dashboard"), 2000);
        }
      } else {
        setMessage({
          type: "error",
          text: result.error || "Subscription failed",
        });
      }
    } catch (error) {
      setMessage({
        type: "error",
        text: "Something went wrong. Please try again.",
      });
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="space-y-8 max-w-7xl">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-bold text-white">Choose Your Plan</h1>
        <p className="text-muted-foreground">
          Start free, upgrade when you need more power
        </p>
      </div>

      {/* Message */}
      {message && (
        <div
          className={`p-4 rounded-lg border ${
            message.type === "success"
              ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
              : "bg-red-500/10 border-red-500/30 text-red-400"
          }`}
        >
          {message.text}
        </div>
      )}

      {/* Current Plan Notice */}
      {user?.subscription && user.subscription.status === "active" && (
        <div className="p-4 rounded-lg bg-blue-500/10 border border-blue-500/30">
          <div className="flex items-center gap-3">
            <CheckCircle className="h-5 w-5 text-blue-400" />
            <div>
              <p className="text-blue-400 font-medium">
                You're on the {user.subscription.plan} plan
              </p>
              <p className="text-sm text-muted-foreground">
                {user.subscription.currentPeriodEnd &&
                  `Renews on ${new Date(user.subscription.currentPeriodEnd).toLocaleDateString()}`}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Pricing Cards */}
      <div className="grid md:grid-cols-2 xl:grid-cols-4 gap-8">
        {PRICING_PLANS.map((plan) => {
          const IconComponent =
            PLAN_ICONS[plan.id as keyof typeof PLAN_ICONS] ?? Shield;
          return (
            <Card
              key={plan.id}
              className={`relative ${
                plan.popular
                  ? "bg-blue-500/5 border-blue-500/30 shadow-[0_0_30px_-10px_rgba(37,99,235,0.3)]"
                  : "bg-card/40 border"
              } backdrop-blur-sm`}
            >
              {plan.popular && (
                <Badge className="absolute -top-3 left-1/2 -translate-x-1/2 bg-blue-600 text-white">
                  <Star className="h-3 w-3 mr-1" />
                  Most Popular
                </Badge>
              )}

              <CardHeader className="text-center">
                <div className="flex justify-center mb-4">
                  <div
                    className={`p-3 rounded-xl ${
                      plan.popular ? "bg-blue-500/20" : "bg-muted"
                    }`}
                  >
                    <IconComponent
                      className={`h-8 w-8 ${
                        plan.popular ? "text-blue-400" : "text-muted-foreground"
                      }`}
                    />
                  </div>
                </div>
                <CardTitle className="text-xl">{plan.name}</CardTitle>
                <CardDescription>{plan.description}</CardDescription>
                <div className="flex items-baseline justify-center gap-1 pt-2">
                  <span className="text-4xl font-bold text-white">
                    {plan.price === null
                      ? "Custom"
                      : plan.price === 0
                        ? "$0"
                        : `$${plan.price}`}
                  </span>
                  <span className="text-muted-foreground">
                    {plan.price === null || plan.price === 0 ? "" : plan.period}
                  </span>
                </div>
                {plan.trialDays && (
                  <p className="text-sm text-emerald-400">
                    {plan.trialDays} days free trial
                  </p>
                )}
              </CardHeader>

              <CardContent className="space-y-6">
                <ul className="space-y-3">
                  {plan.features.map((feature, i) => (
                    <li key={i} className="flex items-start gap-3">
                      <Check className="h-5 w-5 text-emerald-400 flex-shrink-0 mt-0.5" />
                      <span className="text-sm text-foreground/80">
                        {feature}
                      </span>
                    </li>
                  ))}
                </ul>

                {(() => {
                  const currentPlan = user?.subscription?.plan || "free";
                  const isCurrentPlan = plan.id === currentPlan;

                  return (
                    <Button
                      onClick={() => {
                        if (isCurrentPlan) return;
                        handleSubscribe(plan.id);
                      }}
                      disabled={
                        loading === plan.id || plan.disabled || isCurrentPlan
                      }
                      className={`w-full ${
                        isCurrentPlan
                          ? "bg-emerald-600/20 border border-emerald-500/30 text-emerald-400 cursor-default"
                          : plan.popular
                            ? "bg-blue-600 hover:bg-blue-700 text-white"
                            : "bg-muted hover:bg-muted/80 text-foreground"
                      }`}
                    >
                      {loading === plan.id ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Processing...
                        </>
                      ) : isCurrentPlan ? (
                        <>
                          <CheckCircle className="h-4 w-4 mr-2" />
                          Current Plan
                        </>
                      ) : (
                        plan.cta
                      )}
                    </Button>
                  );
                })()}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* FAQ Section */}
      <Card className="bg-card/40 border backdrop-blur-sm">
        <CardHeader>
          <CardTitle className="text-white">
            Frequently Asked Questions
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div>
            <h4 className="font-medium text-white mb-2">
              Can I switch plans anytime?
            </h4>
            <p className="text-sm text-muted-foreground">
              Yes! You can upgrade or downgrade your plan at any time. Changes
              take effect at the next billing cycle.
            </p>
          </div>
          <div>
            <h4 className="font-medium text-white mb-2">
              What happens after the free trial?
            </h4>
            <p className="text-sm text-muted-foreground">
              After the 14-day trial, you'll be prompted to choose a plan. You
              can continue with Pro or downgrade to Free.
            </p>
          </div>
          <div>
            <h4 className="font-medium text-white mb-2">
              Do you offer refunds?
            </h4>
            <p className="text-sm text-muted-foreground">
              We offer a 30-day money-back guarantee for all paid plans. No
              questions asked.
            </p>
          </div>
          <div>
            <h4 className="font-medium text-white mb-2">
              What payment methods do you accept?
            </h4>
            <p className="text-sm text-muted-foreground">
              We accept all major credit cards and PayPal. Compliance plans can
              also use invoicing on request.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* CTA Section */}
      {!isAuthenticated && (
        <Card className="bg-gradient-to-r from-blue-500/10 to-purple-500/10 border-blue-500/30 backdrop-blur-sm">
          <CardContent className="pt-6">
            <div className="text-center space-y-4">
              <Sparkles className="h-12 w-12 text-blue-400 mx-auto" />
              <h3 className="text-xl font-semibold text-white">
                Ready to get started?
              </h3>
              <p className="text-muted-foreground">
                Join thousands of developers shipping secure code with guardrail
              </p>
              <Link href="/">
                <Button className="bg-blue-600 hover:bg-blue-700 text-white">
                  Sign up for free
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
