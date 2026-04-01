'use client';

import React, { useMemo } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

interface FloatingOrbsProps {
  className?: string;
  count?: number;
  colors?: string[];
}

interface Orb {
  id: number;
  size: number;
  color: string;
  initialX: number;
  initialY: number;
  duration: number;
  delay: number;
  path: {
    x: number[];
    y: number[];
  };
}

export const FloatingOrbs: React.FC<FloatingOrbsProps> = ({
  className,
  count = 5,
  colors = [
    "rgba(59, 130, 246, 0.15)",   // blue
    "rgba(139, 92, 246, 0.15)",   // purple
    "rgba(236, 72, 153, 0.15)",   // pink
    "rgba(14, 165, 233, 0.15)",   // sky
    "rgba(168, 85, 247, 0.15)",   // violet
  ]
}) => {
  const orbs = useMemo<Orb[]>(() => {
    return Array.from({ length: count }, (_, i) => {
      const size = 100 + Math.random() * 200;
      const color = colors[i % colors.length];

      // Random starting position
      const initialX = Math.random() * 100;
      const initialY = Math.random() * 100;

      // Create a smooth path with 4 points for complex motion
      const pathPoints = 4;
      const path = {
        x: Array.from({ length: pathPoints }, () => Math.random() * 30 - 15),
        y: Array.from({ length: pathPoints }, () => Math.random() * 30 - 15),
      };

      return {
        id: i,
        size,
        color,
        initialX,
        initialY,
        duration: 15 + Math.random() * 10,
        delay: Math.random() * 5,
        path,
      };
    });
  }, [count, colors]);

  return (
    <div className={cn("absolute inset-0 overflow-hidden pointer-events-none", className)}>
      {orbs.map((orb) => (
        <motion.div
          key={orb.id}
          className="absolute rounded-full blur-[80px]"
          style={{
            width: orb.size,
            height: orb.size,
            left: `${orb.initialX}%`,
            top: `${orb.initialY}%`,
            backgroundColor: orb.color,
          }}
          animate={{
            x: orb.path.x,
            y: orb.path.y,
            scale: [1, 1.2, 0.8, 1],
            opacity: [0.3, 0.6, 0.4, 0.3],
          }}
          transition={{
            duration: orb.duration,
            delay: orb.delay,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        />
      ))}
    </div>
  );
};

// Glowing cursor follower orb
export const CursorGlow: React.FC<{
  className?: string;
  color?: string;
  size?: number;
}> = ({ className, color = "rgba(59, 130, 246, 0.2)", size = 300 }) => {
  const [mousePosition, setMousePosition] = React.useState({ x: 0, y: 0 });

  React.useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      setMousePosition({ x: e.clientX, y: e.clientY });
    };

    window.addEventListener("mousemove", handleMouseMove);
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, []);

  return (
    <motion.div
      className={cn("fixed rounded-full blur-[100px] pointer-events-none z-0", className)}
      style={{
        width: size,
        height: size,
        backgroundColor: color,
      }}
      animate={{
        x: mousePosition.x - size / 2,
        y: mousePosition.y - size / 2,
      }}
      transition={{
        type: "spring",
        stiffness: 50,
        damping: 20,
      }}
    />
  );
};

// Pulsing glow effect for highlighting elements
export const PulsingGlow: React.FC<{
  children: React.ReactNode;
  className?: string;
  color?: string;
  intensity?: "low" | "medium" | "high";
}> = ({ children, className, color = "blue", intensity = "medium" }) => {
  const blurAmount = {
    low: "blur-sm",
    medium: "blur-md",
    high: "blur-lg",
  }[intensity];

  const glowColors = {
    blue: "shadow-blue-500/50",
    purple: "shadow-purple-500/50",
    pink: "shadow-pink-500/50",
    green: "shadow-green-500/50",
  };

  return (
    <div className={cn("relative", className)}>
      <motion.div
        className={cn(
          "absolute inset-0 rounded-lg",
          blurAmount,
          glowColors[color as keyof typeof glowColors] || glowColors.blue
        )}
        animate={{
          opacity: [0.3, 0.6, 0.3],
          scale: [1, 1.05, 1],
        }}
        transition={{
          duration: 2,
          repeat: Infinity,
          ease: "easeInOut",
        }}
      />
      <div className="relative z-10">{children}</div>
    </div>
  );
};

// Animated gradient border
export const AnimatedGradientBorder: React.FC<{
  children: React.ReactNode;
  className?: string;
  borderWidth?: number;
  gradientColors?: string[];
}> = ({
  children,
  className,
  borderWidth = 2,
  gradientColors = ["#3b82f6", "#8b5cf6", "#ec4899", "#3b82f6"]
}) => {
  return (
    <div className={cn("relative", className)}>
      <motion.div
        className="absolute inset-0 rounded-lg"
        style={{
          padding: borderWidth,
          background: `linear-gradient(90deg, ${gradientColors.join(", ")})`,
          backgroundSize: "400% 400%",
        }}
        animate={{
          backgroundPosition: ["0% 50%", "100% 50%", "0% 50%"],
        }}
        transition={{
          duration: 3,
          repeat: Infinity,
          ease: "linear",
        }}
      >
        <div className="w-full h-full bg-black rounded-lg" />
      </motion.div>
      <div className="relative z-10">{children}</div>
    </div>
  );
};

// Shimmer effect
export const ShimmerEffect: React.FC<{
  children: React.ReactNode;
  className?: string;
}> = ({ children, className }) => {
  return (
    <div className={cn("relative overflow-hidden", className)}>
      <motion.div
        className="absolute inset-0 w-full h-full"
        style={{
          background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.1), transparent)",
        }}
        animate={{
          x: ["-100%", "100%"],
        }}
        transition={{
          duration: 2,
          repeat: Infinity,
          ease: "linear",
        }}
      />
      <div className="relative z-10">{children}</div>
    </div>
  );
};
