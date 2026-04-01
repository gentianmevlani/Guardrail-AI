"use client";

import { LiquidMetalButton } from "@/components/landing/liquid-metal-button";
import { MagneticButton } from "@/components/landing/magnetic-button";
import { TerminalVideo } from "@/components/landing/terminal-video";
import { motion, useScroll, useTransform } from "framer-motion";
import dynamic from "next/dynamic";
import { useRef } from "react";

const WarpBackground = dynamic(
  () =>
    import("@/components/landing/warp-background").then(
      (m) => m.WarpBackground,
    ),
  { ssr: false, loading: () => <div className="absolute inset-0 bg-black" /> },
);

interface HeroSectionProps {
  onOpenAuth: (mode: "login" | "signup") => void;
}

export function HeroSection({ onOpenAuth }: HeroSectionProps) {
  const ref = useRef(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start start", "end start"],
  });

  const yBackground = useTransform(scrollYProgress, [0, 1], ["0%", "50%"]);
  const scaleBackground = useTransform(scrollYProgress, [0, 1], [1, 1.1]);
  const yText = useTransform(scrollYProgress, [0, 1], ["0%", "20%"]);
  const yVisual = useTransform(scrollYProgress, [0, 1], ["0%", "-20%"]);
  // Do not tie hero text/terminal opacity to scrollYProgress. On some hosts (e.g. Netlify)
  // layout can report a degenerate scroll range so progress jumps to 1; that drove
  // opacity to 0 and looked like a blank / stuck loading page.

  return (
    <section
      ref={ref}
      className="relative flex w-full min-h-[calc(100vh-4rem)] min-h-[calc(100svh-4rem)] items-center justify-center overflow-hidden"
    >
      {/* CSS fallback gradient (always visible) */}
      <div className="absolute inset-0 z-0">
        <div className="absolute inset-0 bg-gradient-to-b from-black via-black to-teal-950/30" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_50%_-20%,rgba(45,212,191,0.12),transparent)]" />
      </div>

      {/* WebGL warp (renders on top when available) */}
      <motion.div
        className="absolute inset-0 z-[1]"
        style={{ y: yBackground, scale: scaleBackground }}
      >
        <WarpBackground speed={0.3} intensity={0.8} />
      </motion.div>

      <div className="relative z-10 mx-auto w-full max-w-7xl px-4 pb-16 pt-24 sm:px-6 sm:pb-20 sm:pt-28 lg:px-8 lg:pt-32">
        <div className="flex flex-col gap-10 py-8 sm:gap-12 sm:py-10">
          <motion.div className="flex flex-col items-center text-center">
            <motion.div
              style={{ y: yText }}
              initial={false}
              animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
              transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
              className="flex flex-col items-center text-center"
            >
            <p className="mb-4 text-xs font-semibold uppercase tracking-[0.28em] text-teal-400/80">
              guardrail
            </p>
            <h1 className="font-display text-4xl font-semibold leading-[1.08] tracking-tight text-white sm:text-5xl lg:text-6xl xl:text-7xl">
              <motion.span
                initial={false}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.3 }}
                className="inline-block"
              >
                Built with AI?
              </motion.span>
              <br />
              <motion.span
                initial={false}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{
                  duration: 0.8,
                  delay: 0.5,
                  ease: [0.16, 1, 0.3, 1],
                }}
                className="inline-block bg-gradient-to-r from-teal-200 via-cyan-200 to-teal-400 bg-clip-text text-transparent drop-shadow-[0_0_28px_rgba(45,212,191,0.35)]"
              >
                Ship with proof.
              </motion.span>
            </h1>

            <motion.p
              initial={false}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.7 }}
              className="mt-6 max-w-xl text-lg leading-relaxed text-zinc-400 sm:text-xl"
            >
              One command tells you if your app actually works—or just looks
              like it does. Catch fake features, broken auth, and exposed
              secrets before your users do.
            </motion.p>

            <motion.div
              initial={false}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{
                duration: 0.6,
                delay: 0.9,
                type: "spring",
                stiffness: 100,
              }}
              className="mt-8 flex justify-center"
            >
              <motion.div
                whileHover={{ scale: 1.05, y: -2 }}
                whileTap={{ scale: 0.98 }}
                transition={{ type: "spring", stiffness: 400, damping: 17 }}
              >
                <MagneticButton>
                  <LiquidMetalButton
                    onClick={() => onOpenAuth("signup")}
                    size="lg"
                  >
                    Get Started Free →
                  </LiquidMetalButton>
                </MagneticButton>
              </motion.div>
            </motion.div>
            </motion.div>
          </motion.div>

          <motion.div>
            <motion.div
              style={{ y: yVisual }}
              initial={false}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ duration: 1, delay: 0.4, ease: [0.16, 1, 0.3, 1] }}
              className="w-full flex items-center justify-center"
            >
              <TerminalVideo />
            </motion.div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
