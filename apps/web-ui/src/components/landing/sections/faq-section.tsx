"use client";

import { useRef } from "react";
import { motion, useInView } from "framer-motion";
import { MagneticButton } from "@/components/landing/magnetic-button";
import { LiquidMetalButton } from "@/components/landing/liquid-metal-button";
import { GlassCardSimple } from "@/components/landing/glass-card";
import { FAQAccordion } from "@/components/landing/faq-accordion";

const faqs = [
  {
    question: "What is guardrail?",
    answer:
      "A tool that verifies your AI-built app actually works before you ship it.",
  },
  {
    question: "How does it work?",
    answer:
      "Run one command. guardrail tests your app, finds issues, and tells you exactly what to fix.",
  },
  {
    question: "Is my code secure?",
    answer:
      "Your code never leaves your machine. Everything runs locally.",
  },
  {
    question: "Which IDEs work?",
    answer:
      "Cursor, VS Code, Claude Desktop, Windsurf, and any MCP-compatible editor.",
  },
  {
    question: "How long to setup?",
    answer:
      "2 minutes. Run the init command and you're ready.",
  },
  {
    question: "Multiple projects?",
    answer:
      "Yes. guardrail learns patterns across all your repos.",
  },
];

export function FAQSection() {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, amount: 0.2 });

  return (
    <section
      id="faq"
      ref={ref}
      className="scroll-mt-28 px-4 py-20 sm:px-6 lg:px-8"
    >
      <div className="mx-auto w-full max-w-6xl">
        <motion.div
          initial={{ opacity: 0, y: 60, filter: "blur(8px)" }}
          animate={isInView ? { opacity: 1, y: 0, filter: "blur(0px)" } : { opacity: 0, y: 60, filter: "blur(8px)" }}
          transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          className="text-center mb-14"
        >
          <h2 className="text-4xl sm:text-5xl lg:text-6xl font-display font-bold mb-4 tracking-tight">
            Questions?
            <br />
            <span className="text-teal-400">Answers.</span>
          </h2>
          <p className="text-lg text-gray-400 max-w-2xl mx-auto">
            Can&apos;t find what you need?
            <button
              onClick={() => {
                window.dispatchEvent(
                  new CustomEvent("open-modal", { detail: "Contact" }),
                );
              }}
              className="ml-1 text-teal-400 hover:text-teal-300"
            >
              Reach out to our team
            </button>
            .
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 60, filter: "blur(8px)" }}
          animate={isInView ? { opacity: 1, y: 0, filter: "blur(0px)" } : { opacity: 0, y: 60, filter: "blur(8px)" }}
          transition={{ duration: 0.8, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
        >
          <FAQAccordion faqs={faqs} />
        </motion.div>

        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={isInView ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.95 }}
          transition={{ duration: 0.6, delay: 0.4 }}
          className="mt-12 text-center"
        >
          <GlassCardSimple className="p-8">
            <h3 className="text-xl font-semibold text-white mb-3 relative z-10">
              Still have questions?
            </h3>
            <p className="text-slate-300 mb-5 relative z-10">
              Our team is here to help. Get in touch and we&apos;ll get back to
              you within 24 hours.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center relative z-10">
              <MagneticButton>
                <LiquidMetalButton
                  onClick={() => {
                    window.dispatchEvent(
                      new CustomEvent("open-modal", { detail: "Contact" }),
                    );
                  }}
                  size="md"
                >
                  Contact Support
                </LiquidMetalButton>
              </MagneticButton>
            </div>
          </GlassCardSimple>
        </motion.div>
      </div>
    </section>
  );
}
