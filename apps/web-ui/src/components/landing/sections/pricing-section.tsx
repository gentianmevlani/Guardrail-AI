"use client";

import { Button } from "@/components/ui/button";
import { PRICING_PLANS, calculateSavings, type PricingPlan } from "@/lib/pricing";
import { motion, useInView } from "framer-motion";
import { Check } from "lucide-react";
import Link from "next/link";
import { useRef, useState } from "react";

const fmt = (n: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: n % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(n);

/** Stripe Payment Links — keep in sync with billing backend */
const STRIPE_CHECKOUT: Record<string, { monthly: string; annual: string }> = {
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

function PlanColumn({
  plan,
  billingCycle,
  isInView,
  index,
}: {
  plan: PricingPlan;
  billingCycle: "monthly" | "annual";
  isInView: boolean;
  index: number;
}) {
  const isFree = plan.id === "free";
  const monthlyPrice = plan.price ?? 0;
  const annualTotal = plan.annual ?? 0;
  const savings =
    !isFree && monthlyPrice > 0 && annualTotal > 0
      ? calculateSavings(monthlyPrice, annualTotal)
      : 0;

  const effectiveMonthly =
    billingCycle === "annual" && annualTotal > 0
      ? annualTotal / 12
      : monthlyPrice;

  const stripe = STRIPE_CHECKOUT[plan.id];

  return (
    <motion.article
      initial={{ opacity: 0, y: 32 }}
      animate={isInView ? { opacity: 1, y: 0 } : {}}
      transition={{
        duration: 0.5,
        delay: 0.08 * index,
        ease: [0.16, 1, 0.3, 1],
      }}
      className={[
        "relative flex h-full flex-col rounded-2xl border bg-zinc-950/40 px-6 pb-8 pt-10 backdrop-blur-sm transition-[box-shadow,transform] duration-300",
        plan.popular
          ? "z-[1] border-teal-400/35 shadow-[0_0_0_1px_rgba(45,212,191,0.12),0_24px_48px_-24px_rgba(0,0,0,0.7),inset_0_1px_0_rgba(255,255,255,0.06)] md:-translate-y-1 md:scale-[1.02]"
          : "border-white/[0.09] shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] hover:border-white/15",
      ].join(" ")}
    >
      {plan.popular ? (
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-teal-400/60 to-transparent" />
      ) : null}

      {plan.popular ? (
        <p className="absolute left-1/2 top-0 -translate-x-1/2 -translate-y-1/2 rounded-full border border-teal-500/40 bg-zinc-950 px-3 py-0.5 text-[0.65rem] font-semibold uppercase tracking-[0.16em] text-teal-300">
          Most teams start here
        </p>
      ) : null}

      <header className="mb-6">
        <h3 className="font-display text-xl font-semibold tracking-tight text-white">
          {plan.name}
        </h3>
        <p className="mt-1 text-sm leading-snug text-zinc-500">
          {plan.description}
        </p>
        {plan.limit ? (
          <p className="mt-3 text-xs font-medium uppercase tracking-wider text-zinc-600">
            {plan.limit}
          </p>
        ) : null}
      </header>

      <div className="mb-6 border-b border-white/[0.07] pb-6">
        <motion.div
          key={`${plan.id}-${billingCycle}`}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25 }}
          className="flex flex-wrap items-baseline gap-x-1.5 gap-y-1"
        >
          <span className="font-display text-4xl font-semibold tracking-tight text-white tabular-nums sm:text-[2.75rem]">
            {isFree ? fmt(0) : fmt(effectiveMonthly)}
          </span>
          {!isFree ? (
            <span className="text-sm text-zinc-500">/month</span>
          ) : (
            <span className="text-sm text-zinc-500">forever</span>
          )}
        </motion.div>

        {!isFree && billingCycle === "annual" && annualTotal > 0 ? (
          <p className="mt-2 text-xs text-zinc-500">
            <span className="text-zinc-400">{fmt(annualTotal)}</span> billed once
            per year
            {savings > 0 ? (
              <span className="ml-2 text-teal-400/90">
                · Save {savings}% vs monthly
              </span>
            ) : null}
          </p>
        ) : null}

        {!isFree && billingCycle === "monthly" && annualTotal > 0 && savings > 0 ? (
          <p className="mt-2 text-xs text-zinc-600">
            Annual billing saves {savings}%
          </p>
        ) : null}
      </div>

      <div className="mb-8">
        {isFree ? (
          <Button
            className="h-11 w-full rounded-lg border border-white/15 bg-transparent font-medium text-white hover:bg-white/[0.06]"
            variant="outline"
            asChild
          >
            <Link href="/auth?mode=signup">Start free</Link>
          </Button>
        ) : stripe ? (
          <Button
            className={[
              "h-11 w-full rounded-lg font-semibold",
              plan.popular
                ? "bg-teal-500 text-black hover:bg-teal-400"
                : "border border-white/20 bg-transparent text-white hover:bg-white/[0.08]",
            ].join(" ")}
            variant={plan.popular ? "default" : "outline"}
            onClick={() => {
              window.open(stripe[billingCycle], "_blank", "noopener,noreferrer");
            }}
          >
            {plan.cta}
          </Button>
        ) : (
          <Button className="h-11 w-full rounded-lg" asChild>
            <Link href="/auth?mode=signup">{plan.cta}</Link>
          </Button>
        )}
      </div>

      <ul className="flex flex-1 flex-col gap-3 text-sm text-zinc-400">
        {plan.features.map((line) => (
          <li key={line} className="flex gap-3 leading-snug">
            <Check
              className="mt-0.5 h-4 w-4 shrink-0 text-teal-500/90"
              strokeWidth={2.5}
              aria-hidden
            />
            <span>{line}</span>
          </li>
        ))}
      </ul>
    </motion.article>
  );
}

export function PricingSection() {
  const [billingCycle, setBillingCycle] = useState<"monthly" | "annual">(
    "monthly",
  );
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, amount: 0.12 });

  const samplePaid = PRICING_PLANS.find((p) => p.id === "pro");
  const annualSavingsPct =
    samplePaid &&
    samplePaid.price != null &&
    samplePaid.annual != null &&
    samplePaid.price > 0
      ? calculateSavings(samplePaid.price, samplePaid.annual)
      : 20;

  return (
    <section
      id="pricing"
      ref={ref}
      className="scroll-mt-28 border-t border-white/[0.07] bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,rgba(45,212,191,0.08),transparent)] px-4 py-24 sm:px-6 lg:px-8"
    >
      <div className="mx-auto w-full max-w-7xl">
        <div className="flex flex-col gap-10 lg:flex-row lg:items-end lg:justify-between">
          <motion.div
            initial={{ opacity: 0, y: 28 }}
            animate={isInView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
            className="max-w-xl"
          >
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-teal-400/85">
              Pricing
            </p>
            <h2 className="font-display mt-4 text-3xl font-semibold tracking-tight text-white sm:text-4xl lg:text-[2.75rem] lg:leading-[1.1]">
              Straight numbers.
              <span className="mt-1 block text-teal-300/95">
                No spreadsheet archaeology.
              </span>
            </h2>
            <p className="mt-4 text-base leading-relaxed text-zinc-500">
              Same tiers as in-app. Upgrade when findings stop being hypothetical.
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={isInView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.45, delay: 0.1 }}
            className="flex shrink-0 rounded-xl border border-white/10 bg-zinc-950/80 p-1 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]"
            role="tablist"
            aria-label="Billing period"
          >
            <button
              type="button"
              role="tab"
              aria-selected={billingCycle === "monthly"}
              onClick={() => setBillingCycle("monthly")}
              className={[
                "rounded-lg px-5 py-2.5 text-sm font-medium transition-colors",
                billingCycle === "monthly"
                  ? "bg-white text-black"
                  : "text-zinc-400 hover:text-white",
              ].join(" ")}
            >
              Monthly
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={billingCycle === "annual"}
              onClick={() => setBillingCycle("annual")}
              className={[
                "flex items-center gap-2 rounded-lg px-5 py-2.5 text-sm font-medium transition-colors",
                billingCycle === "annual"
                  ? "bg-white text-black"
                  : "text-zinc-400 hover:text-white",
              ].join(" ")}
            >
              Annual
              <span className="rounded-md bg-teal-500/15 px-1.5 py-0.5 text-[0.7rem] font-semibold uppercase tracking-wide text-teal-400">
                ~{annualSavingsPct}% off
              </span>
            </button>
          </motion.div>
        </div>

        <div className="mt-16 grid gap-5 sm:grid-cols-2 lg:grid-cols-4 lg:gap-4 lg:pt-2">
          {PRICING_PLANS.map((plan, index) => (
            <PlanColumn
              key={plan.id}
              plan={plan}
              billingCycle={billingCycle}
              isInView={isInView}
              index={index}
            />
          ))}
        </div>

        <motion.p
          initial={{ opacity: 0 }}
          animate={isInView ? { opacity: 1 } : {}}
          transition={{ delay: 0.45, duration: 0.4 }}
          className="mt-14 text-center text-sm text-zinc-500"
        >
          Cancel anytime. Questions?{" "}
          <button
            type="button"
            onClick={() => {
              window.dispatchEvent(
                new CustomEvent("open-modal", { detail: "Contact" }),
              );
            }}
            className="font-medium text-teal-400 underline-offset-4 hover:text-teal-300 hover:underline"
          >
            Talk to us
          </button>
          .
        </motion.p>
      </div>
    </section>
  );
}
