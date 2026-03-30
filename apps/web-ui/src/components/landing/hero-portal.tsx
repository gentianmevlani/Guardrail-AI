"use client";

import { useRef, useEffect, useState } from "react";
import { motion, useScroll, useTransform, useSpring } from "framer-motion";

export function HeroPortalEffect() {
  const containerRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start start", "end start"],
  });

  // Create smooth transforms for the portal zoom effect
  const scale = useTransform(scrollYProgress, [0, 0.5], [1, 2.5]);
  const opacity = useTransform(scrollYProgress, [0, 0.3, 0.5], [1, 0.8, 0]);
  const blur = useTransform(scrollYProgress, [0, 0.5], [0, 10]);
  
  // Ring animations
  const ring1Scale = useTransform(scrollYProgress, [0, 0.5], [1, 3]);
  const ring2Scale = useTransform(scrollYProgress, [0, 0.5], [1, 4]);
  const ring3Scale = useTransform(scrollYProgress, [0, 0.5], [1, 5]);
  const ringOpacity = useTransform(scrollYProgress, [0, 0.3, 0.5], [0.6, 0.3, 0]);

  return (
    <div ref={containerRef} className="absolute inset-0 pointer-events-none overflow-hidden">
      {/* Central vortex glow */}
      <motion.div
        className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
        style={{
          scale,
          opacity,
        }}
      >
        <div
          className="w-[600px] h-[600px] rounded-full"
          style={{
            background: `
              radial-gradient(circle, 
                rgba(59, 130, 246, 0.15) 0%, 
                rgba(139, 92, 246, 0.1) 30%, 
                rgba(6, 182, 212, 0.05) 60%, 
                transparent 70%
              )
            `,
          }}
        />
      </motion.div>

      {/* Spinning portal rings */}
      <motion.div
        className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full border border-blue-500/30"
        style={{
          width: 400,
          height: 400,
          scale: ring1Scale,
          opacity: ringOpacity,
          boxShadow: "0 0 40px rgba(59, 130, 246, 0.2), inset 0 0 40px rgba(59, 130, 246, 0.1)",
        }}
        animate={{ rotate: 360 }}
        transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
      />
      
      <motion.div
        className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full border border-purple-500/20"
        style={{
          width: 500,
          height: 500,
          scale: ring2Scale,
          opacity: ringOpacity,
          boxShadow: "0 0 30px rgba(139, 92, 246, 0.15)",
        }}
        animate={{ rotate: -360 }}
        transition={{ duration: 30, repeat: Infinity, ease: "linear" }}
      />
      
      <motion.div
        className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full border border-cyan-500/10"
        style={{
          width: 600,
          height: 600,
          scale: ring3Scale,
          opacity: ringOpacity,
          boxShadow: "0 0 20px rgba(6, 182, 212, 0.1)",
        }}
        animate={{ rotate: 360 }}
        transition={{ duration: 40, repeat: Infinity, ease: "linear" }}
      />

      {/* Radial light rays */}
      {[...Array(12)].map((_, i) => (
        <motion.div
          key={i}
          className="absolute left-1/2 top-1/2 origin-bottom"
          style={{
            width: 2,
            height: 300,
            background: `linear-gradient(to top, rgba(59, 130, 246, 0.3), transparent)`,
            transform: `translate(-50%, -100%) rotate(${i * 30}deg)`,
            opacity: ringOpacity,
            scale: ring1Scale,
          }}
        />
      ))}
    </div>
  );
}

// Glowing orbs that float around
export function GlowingOrbs() {
  const orbs = [
    { size: 80, x: "15%", y: "20%", color: "blue", delay: 0 },
    { size: 60, x: "80%", y: "30%", color: "purple", delay: 1 },
    { size: 100, x: "70%", y: "70%", color: "cyan", delay: 2 },
    { size: 50, x: "20%", y: "75%", color: "blue", delay: 0.5 },
    { size: 70, x: "50%", y: "15%", color: "purple", delay: 1.5 },
  ];

  const colorMap = {
    blue: "rgba(59, 130, 246, 0.15)",
    purple: "rgba(139, 92, 246, 0.15)",
    cyan: "rgba(6, 182, 212, 0.15)",
  };

  const glowMap = {
    blue: "rgba(59, 130, 246, 0.4)",
    purple: "rgba(139, 92, 246, 0.4)",
    cyan: "rgba(6, 182, 212, 0.4)",
  };

  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      {orbs.map((orb, i) => (
        <motion.div
          key={i}
          className="absolute rounded-full blur-xl"
          style={{
            width: orb.size,
            height: orb.size,
            left: orb.x,
            top: orb.y,
            background: colorMap[orb.color as keyof typeof colorMap],
            boxShadow: `0 0 ${orb.size}px ${glowMap[orb.color as keyof typeof glowMap]}`,
          }}
          animate={{
            y: [0, -30, 0],
            x: [0, 15, 0],
            scale: [1, 1.2, 1],
            opacity: [0.5, 0.8, 0.5],
          }}
          transition={{
            duration: 8 + i * 2,
            repeat: Infinity,
            delay: orb.delay,
            ease: "easeInOut",
          }}
        />
      ))}
    </div>
  );
}

// Cyber grid floor effect
export function CyberGrid() {
  const { scrollYProgress } = useScroll();
  const perspective = useTransform(scrollYProgress, [0, 0.3], [800, 400]);
  const rotateX = useTransform(scrollYProgress, [0, 0.3], [60, 75]);
  const opacity = useTransform(scrollYProgress, [0, 0.2, 0.4], [0.4, 0.6, 0]);
  const y = useTransform(scrollYProgress, [0, 0.3], ["50%", "30%"]);

  return (
    <motion.div
      className="absolute inset-x-0 bottom-0 h-[50vh] pointer-events-none overflow-hidden"
      style={{ opacity }}
    >
      <motion.div
        className="absolute inset-0"
        style={{
          perspective,
          perspectiveOrigin: "50% 100%",
        }}
      >
        <motion.div
          className="absolute inset-0"
          style={{
            rotateX,
            transformOrigin: "50% 100%",
            y,
            backgroundImage: `
              linear-gradient(rgba(59, 130, 246, 0.3) 1px, transparent 1px),
              linear-gradient(90deg, rgba(59, 130, 246, 0.3) 1px, transparent 1px)
            `,
            backgroundSize: "60px 60px",
            maskImage: "linear-gradient(to top, white 0%, transparent 80%)",
          }}
        />
        
        {/* Horizon glow */}
        <div
          className="absolute bottom-0 left-0 right-0 h-32"
          style={{
            background: "linear-gradient(to top, rgba(59, 130, 246, 0.2), transparent)",
          }}
        />
      </motion.div>
    </motion.div>
  );
}
