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
  const rotateVisual = useTransform(scrollYProgress, [0, 1], [0, 5]);
  const opacity = useTransform(scrollYProgress, [0, 0.8], [1, 0]);

  return (
    <section
      ref={ref}
      className="min-h-screen flex items-center px-4 sm:px-6 lg:px-8 pt-20 sm:pt-0 relative overflow-hidden"
    >
      <motion.div
        className="absolute inset-0 z-0"
        style={{ y: yBackground, scale: scaleBackground, opacity }}
      >
        <WarpBackground speed={0.3} intensity={0.8} />
      </motion.div>
      <div className="container mx-auto max-w-7xl relative z-10">
        <div className="flex flex-col gap-12 py-12">
          <motion.div
            style={{ y: yText, opacity }}
            initial={{ opacity: 0, y: -30, filter: "blur(10px)" }}
            animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
            className="flex flex-col items-center text-center"
          >
            <h1 className="text-5xl sm:text-6xl lg:text-7xl font-display font-bold leading-[1.1] tracking-tight">
              <motion.span
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.3 }}
                className="inline-block"
              >
                Built with AI?
              </motion.span>
              <br />
              <motion.span
                initial={{ opacity: 0, y: 30, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{
                  duration: 0.8,
                  delay: 0.5,
                  ease: [0.16, 1, 0.3, 1],
                }}
                className="inline-block bg-gradient-to-r from-blue-300 via-cyan-300 to-blue-500 bg-clip-text text-transparent drop-shadow-[0_0_30px_rgba(59,130,246,0.5)]"
              >
                Ship with confidence.
              </motion.span>
            </h1>

            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.7 }}
              className="mt-8 text-xl text-gray-400 max-w-2xl leading-relaxed"
            >
              One command tells you if your app actually works—or just looks
              like it does. Catch fake features, broken auth, and exposed
              secrets before your users do.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 30, scale: 0.9 }}
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

          <motion.div
            style={{ y: yVisual, opacity }}
            initial={{ opacity: 0, y: 50, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 1, delay: 0.4, ease: [0.16, 1, 0.3, 1] }}
            className="w-full flex items-center justify-center"
          >
            <TerminalVideo />
          </motion.div>
        </div>
      </div>
    </section>
  );
}
