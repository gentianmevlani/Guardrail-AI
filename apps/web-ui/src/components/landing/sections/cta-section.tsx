"use client";

import { useRef } from "react";
import { motion, useScroll, useTransform, useInView } from "framer-motion";
import { MagneticButton } from "@/components/landing/magnetic-button";
import { LiquidMetalButton } from "@/components/landing/liquid-metal-button";
import { GlassCardSimple } from "@/components/landing/glass-card";
import dynamic from "next/dynamic";

const WarpBackground = dynamic(
  () => import("@/components/landing/warp-background").then(m => m.WarpBackground),
  { ssr: false, loading: () => <div className="absolute inset-0 bg-black" /> }
);

interface CTASectionProps {
  onOpenAuth: (mode: "login" | "signup") => void;
}

export function CTASection({ onOpenAuth }: CTASectionProps) {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, amount: 0.5 });
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start end", "end start"],
  });
  const yBackground = useTransform(scrollYProgress, [0, 1], ["-20%", "20%"]);
  const scaleBackground = useTransform(scrollYProgress, [0, 1], [1.1, 1]);
  const opacity = useTransform(scrollYProgress, [0, 0.8, 1], [1, 0.8, 0]);

  return (
    <section ref={ref} className="px-4 sm:px-6 lg:px-8 py-20 relative overflow-hidden">
      <motion.div 
        className="absolute inset-0 z-0"
        style={{ y: yBackground, scale: scaleBackground, opacity }}
      >
        <WarpBackground speed={0.4} intensity={0.85} />
      </motion.div>
      <div className="container mx-auto max-w-7xl relative z-10">
        <motion.div
          initial={{ opacity: 0, scale: 0.9, y: 50, rotateX: -10 }}
          animate={
            isInView
              ? { opacity: 1, scale: 1, y: 0, rotateX: 0 }
              : { opacity: 0, scale: 0.9, y: 50, rotateX: -10 }
          }
          transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          style={{ perspective: "1000px" }}
        >
          <GlassCardSimple
            dark
            className="p-8 sm:p-12 text-center"
            hoverScale={false}
          >
            <motion.div 
              className="relative z-10"
              animate={{ 
                boxShadow: [
                  "0 0 20px rgba(59, 130, 246, 0)",
                  "0 0 40px rgba(59, 130, 246, 0.3)",
                  "0 0 20px rgba(59, 130, 246, 0)"
                ]
              }}
              transition={{ duration: 3, repeat: Infinity }}
            >
              <motion.h2
                initial={{ opacity: 0, y: 30, scale: 0.9 }}
                animate={
                  isInView ? { opacity: 1, y: 0, scale: 1 } : { opacity: 0, y: 30, scale: 0.9 }
                }
                transition={{ duration: 0.7, delay: 0.2, type: "spring", stiffness: 100 }}
                className="text-4xl sm:text-5xl lg:text-6xl font-bold"
                style={{ textShadow: '0 4px 8px rgba(0,0,0,0.4), 0 8px 16px rgba(0,0,0,0.2)' }}
              >
                Ready to <span className="text-blue-400">ship?</span>
              </motion.h2>
              <p className="mt-4 text-lg text-slate-300">
                Find out if your app actually works.
              </p>
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={
                  isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }
                }
                transition={{ duration: 0.6, delay: 0.4 }}
                className="mt-7 flex flex-col sm:flex-row gap-3 justify-center"
              >
                <MagneticButton>
                  <LiquidMetalButton
                    onClick={() => onOpenAuth("signup")}
                    size="lg"
                  >
                    Get Started Now →
                  </LiquidMetalButton>
                </MagneticButton>
              </motion.div>
              <motion.div
                initial={{ opacity: 0 }}
                animate={isInView ? { opacity: 1 } : { opacity: 0 }}
                transition={{ duration: 0.6, delay: 0.5 }}
                className="mt-5 text-sm text-gray-600"
              >
                No credit card required • Free tier available • Cancel anytime
              </motion.div>
            </motion.div>
          </GlassCardSimple>
        </motion.div>
      </div>
    </section>
  );
}
