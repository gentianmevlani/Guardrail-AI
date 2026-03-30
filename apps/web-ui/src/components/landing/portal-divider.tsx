"use client";

import { useRef } from "react";
import { motion, useInView, useScroll, useTransform } from "framer-motion";

interface PortalDividerProps {
  color?: "blue" | "purple" | "cyan" | "orange";
}

export function PortalDivider({ color = "blue" }: PortalDividerProps) {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: false, amount: 0.5 });
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start end", "end start"],
  });

  const scale = useTransform(scrollYProgress, [0, 0.5, 1], [0.5, 1, 0.5]);
  const opacity = useTransform(scrollYProgress, [0, 0.5, 1], [0, 1, 0]);
  const rotate = useTransform(scrollYProgress, [0, 1], [0, 180]);

  const colorMap = {
    blue: {
      primary: "rgba(59, 130, 246, 0.8)",
      secondary: "rgba(96, 165, 250, 0.4)",
      glow: "rgba(59, 130, 246, 0.3)",
    },
    purple: {
      primary: "rgba(139, 92, 246, 0.8)",
      secondary: "rgba(167, 139, 250, 0.4)",
      glow: "rgba(139, 92, 246, 0.3)",
    },
    cyan: {
      primary: "rgba(6, 182, 212, 0.8)",
      secondary: "rgba(34, 211, 238, 0.4)",
      glow: "rgba(6, 182, 212, 0.3)",
    },
    orange: {
      primary: "rgba(249, 115, 22, 0.8)",
      secondary: "rgba(251, 146, 60, 0.4)",
      glow: "rgba(249, 115, 22, 0.3)",
    },
  };

  const colors = colorMap[color];

  return (
    <div ref={ref} className="relative h-40 my-8 overflow-hidden">
      {/* Center portal ring */}
      <motion.div
        className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
        style={{ scale, opacity }}
      >
        {/* Outer glow */}
        <motion.div
          className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full"
          style={{
            width: 300,
            height: 300,
            background: `radial-gradient(circle, ${colors.glow} 0%, transparent 70%)`,
            rotate,
          }}
        />

        {/* Spinning rings */}
        {[0, 1, 2].map((i) => (
          <motion.div
            key={i}
            className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full border"
            style={{
              width: 120 + i * 60,
              height: 120 + i * 60,
              borderColor: i === 1 ? colors.primary : colors.secondary,
              boxShadow: `0 0 20px ${colors.glow}`,
            }}
            animate={{
              rotate: i % 2 === 0 ? 360 : -360,
              scale: isInView ? [1, 1.05, 1] : 1,
            }}
            transition={{
              rotate: {
                duration: 10 + i * 5,
                repeat: Infinity,
                ease: "linear",
              },
              scale: {
                duration: 2,
                repeat: Infinity,
                ease: "easeInOut",
              },
            }}
          />
        ))}

        {/* Center dot */}
        <motion.div
          className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full"
          style={{
            width: 12,
            height: 12,
            background: colors.primary,
            boxShadow: `0 0 30px ${colors.primary}, 0 0 60px ${colors.glow}`,
          }}
          animate={{
            scale: isInView ? [1, 1.5, 1] : 1,
          }}
          transition={{
            duration: 1.5,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        />
      </motion.div>

      {/* Horizontal lines extending from portal */}
      <motion.div
        className="absolute top-1/2 left-0 right-0 h-px -translate-y-1/2"
        style={{
          background: `linear-gradient(90deg, transparent 0%, ${colors.secondary} 30%, ${colors.primary} 50%, ${colors.secondary} 70%, transparent 100%)`,
          opacity,
        }}
      />

      {/* Particle trails */}
      {isInView && (
        <>
          {[...Array(8)].map((_, i) => (
            <motion.div
              key={i}
              className="absolute rounded-full"
              style={{
                width: 4,
                height: 4,
                background: colors.primary,
                boxShadow: `0 0 10px ${colors.primary}`,
                left: "50%",
                top: "50%",
              }}
              animate={{
                x: [0, Math.cos((i * Math.PI) / 4) * 200],
                y: [0, Math.sin((i * Math.PI) / 4) * 100],
                opacity: [1, 0],
                scale: [1, 0],
              }}
              transition={{
                duration: 2,
                repeat: Infinity,
                delay: i * 0.2,
                ease: "easeOut",
              }}
            />
          ))}
        </>
      )}
    </div>
  );
}

// Energy beam divider
export function EnergyBeamDivider() {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: false, amount: 0.5 });

  return (
    <div ref={ref} className="relative h-20 my-4 overflow-hidden">
      <motion.div
        className="absolute inset-0 flex items-center justify-center"
        initial={{ opacity: 0 }}
        animate={{ opacity: isInView ? 1 : 0 }}
        transition={{ duration: 0.5 }}
      >
        {/* Main beam */}
        <motion.div
          className="h-0.5 bg-gradient-to-r from-transparent via-blue-500 to-transparent"
          initial={{ width: "0%" }}
          animate={{ width: isInView ? "100%" : "0%" }}
          transition={{ duration: 1, ease: "easeOut" }}
        />

        {/* Glow effect */}
        <motion.div
          className="absolute h-8 bg-gradient-to-r from-transparent via-blue-500/20 to-transparent blur-xl"
          initial={{ width: "0%" }}
          animate={{ width: isInView ? "80%" : "0%" }}
          transition={{ duration: 1.2, ease: "easeOut" }}
        />

        {/* Traveling pulse */}
        {isInView && (
          <motion.div
            className="absolute h-1 w-20 bg-gradient-to-r from-transparent via-white to-transparent"
            animate={{
              x: ["-50vw", "50vw"],
            }}
            transition={{
              duration: 2,
              repeat: Infinity,
              ease: "linear",
            }}
          />
        )}
      </motion.div>
    </div>
  );
}
