"use client";

import { useRef } from "react";
import { motion, useInView } from "framer-motion";
import { Search, Terminal, Zap } from "lucide-react";
import { GlassCardSimple } from "@/components/landing/glass-card";
import { FloatingElement, TiltCard } from "@/components/landing/animated-section";

const steps = [
  {
    number: "1",
    title: "Install",
    description: "npx @guardrail/cli init",
    icon: Terminal,
  },
  {
    number: "2",
    title: "Scan",
    description: "guardrail ship",
    icon: Search,
  },
  {
    number: "3",
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
      className="px-4 sm:px-6 lg:px-8 py-20 relative"
    >
      <div className="container mx-auto max-w-6xl relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 60, filter: "blur(8px)" }}
          animate={isInView ? { opacity: 1, y: 0, filter: "blur(0px)" } : { opacity: 0, y: 60, filter: "blur(8px)" }}
          transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          className="text-center mb-14"
        >
          <h2 className="text-4xl sm:text-5xl lg:text-6xl font-display font-bold mb-4 tracking-tight" style={{ textShadow: '0 4px 8px rgba(0,0,0,0.4), 0 8px 16px rgba(0,0,0,0.2)' }}>
            3 steps.
            <br />
            <span className="text-blue-400">Done.</span>
          </h2>
          <p className="text-lg text-gray-400">
            Minutes to setup, not hours.
          </p>
        </motion.div>

        <motion.div
          initial="hidden"
          animate={isInView ? "visible" : "hidden"}
          variants={{
            hidden: { opacity: 0 },
            visible: {
              opacity: 1,
              transition: { staggerChildren: 0.2, delayChildren: 0.2 },
            },
          }}
          className="grid grid-cols-1 md:grid-cols-3 gap-8"
        >
          {steps.map((step) => {
            const Icon = step.icon;
            return (
              <motion.div
                key={step.number}
                variants={{
                  hidden: { opacity: 0, y: 40 },
                  visible: {
                    opacity: 1,
                    y: 0,
                    transition: { type: "spring", stiffness: 100, damping: 12 },
                  },
                }}
              >
                <TiltCard>
                  <GlassCardSimple className="p-8 text-center h-full">
                    <div className="inline-flex items-center justify-center mb-4">
                      <div className="h-12 w-12 rounded-full flex items-center justify-center bg-slate-800/80 border border-white/20">
                        <span className="text-xl font-bold text-white">
                          {step.number}
                        </span>
                      </div>
                    </div>
                    <FloatingElement
                      amplitude={10}
                      duration={3}
                      delay={Number(step.number) * 0.3}
                    >
                      <Icon className="h-8 w-8 text-slate-400 mx-auto mb-3" />
                    </FloatingElement>
                    <h3 className="text-xl font-semibold text-white mb-2">
                      {step.title}
                    </h3>
                    <p className="text-gray-400">{step.description}</p>
                  </GlassCardSimple>
                </TiltCard>
              </motion.div>
            );
          })}
        </motion.div>
      </div>
    </section>
  );
}
