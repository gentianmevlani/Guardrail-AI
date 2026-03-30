"use client";

import { useRef } from "react";
import { motion, useInView } from "framer-motion";
import { Search, Terminal, Zap } from "lucide-react";

const steps = [
  {
    number: "01",
    title: "Install",
    description: "npx @guardrail/cli init",
    icon: Terminal,
  },
  {
    number: "02",
    title: "Scan",
    description: "guardrail ship",
    icon: Search,
  },
  {
    number: "03",
    title: "Autopilot",
    description: "Set and forget",
    icon: Zap,
  },
];

export function HowItWorksSection() {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, amount: 0.2 });

  return (
    <section
      id="how-it-works"
      ref={ref}
      className="relative scroll-mt-28 px-4 py-20 sm:px-6 lg:px-8"
    >
      <div className="relative z-10 mx-auto w-full max-w-6xl">
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.65, ease: [0.16, 1, 0.3, 1] }}
          className="mb-14 max-w-2xl"
        >
          <h2 className="font-display text-3xl font-semibold tracking-tight text-white sm:text-4xl lg:text-5xl">
            Three steps.
            <span className="mt-1 block text-teal-400/95">
              Then you ship with receipts.
            </span>
          </h2>
          <p className="mt-4 text-base text-zinc-400">
            Minutes to setup, not hours.
          </p>
        </motion.div>

        <ol className="grid gap-0 md:grid-cols-10 md:divide-x md:divide-white/10">
          {steps.map((step, i) => {
            const Icon = step.icon;
            return (
              <motion.li
                key={step.number}
                initial={{ opacity: 0, y: 28 }}
                animate={isInView ? { opacity: 1, y: 0 } : {}}
                transition={{
                  duration: 0.5,
                  delay: 0.12 + i * 0.08,
                  ease: [0.16, 1, 0.3, 1],
                }}
                className={`border-t border-white/10 py-10 md:border-t-0 md:px-7 md:py-2 lg:px-9 ${
                  i === 1 ? "md:col-span-4" : "md:col-span-3"
                }`}
              >
                <div className="flex items-center gap-3 text-teal-400/90">
                  <Icon className="h-5 w-5 shrink-0" strokeWidth={1.5} />
                  <span className="font-mono text-[0.65rem] uppercase tracking-[0.2em]">
                    {step.number}
                  </span>
                </div>
                <h3 className="font-display mt-4 text-xl font-semibold text-white">
                  {step.title}
                </h3>
                <p className="mt-2 font-mono text-sm text-zinc-500">
                  {step.description}
                </p>
              </motion.li>
            );
          })}
        </ol>
      </div>
    </section>
  );
}
