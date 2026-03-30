"use client";

import { cn } from "@/lib/utils";
import {
  motion,
  useAnimationFrame,
  useMotionTemplate,
  useMotionValue,
  useSpring,
  useTransform,
} from "framer-motion";
import React, { useEffect, useRef, useState } from "react";

interface InfiniteGridBackgroundProps {
  className?: string;
  showGradients?: boolean;
  opacity?: number;
  highlightOpacity?: number;
  /** Disable heavy particle effects for performance (default: true) */
  disableParticles?: boolean;
  /** Disable ripple effects for performance (default: true) */
  disableRipples?: boolean;
}

interface Particle {
  id: number;
  x: number;
  y: number;
  velocity: { x: number; y: number };
  life: number;
  maxLife: number;
}

interface Ripple {
  id: number;
  x: number;
  y: number;
  radius: number;
  maxRadius: number;
  opacity: number;
}

export const InfiniteGridBackground: React.FC<InfiniteGridBackgroundProps> = ({
  className,
  showGradients = true,
  opacity = 0.15,
  highlightOpacity = 0.6,
  disableParticles = true,
  disableRipples = true,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isMobile, setIsMobile] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const [particles, setParticles] = useState<Particle[]>([]);
  const [ripples, setRipples] = useState<Ripple[]>([]);
  const particleIdCounter = useRef(0);
  const rippleIdCounter = useRef(0);

  // Mouse tracking with spring physics for smooth movement
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);
  const smoothMouseX = useSpring(mouseX, { stiffness: 50, damping: 20 });
  const smoothMouseY = useSpring(mouseY, { stiffness: 50, damping: 20 });

  // Grid offset values
  const gridOffsetX = useMotionValue(0);
  const gridOffsetY = useMotionValue(0);

  // Pre-compute transformed values at hook level to avoid calling hooks in render
  const parallelGridOffsetX = useTransform(gridOffsetX, (v) => (v ?? 0) * 1.5);
  const parallelGridOffsetY = useTransform(gridOffsetY, (v) => (v ?? 0) * 1.5);

  // Color pulse animation
  const colorPhase = useMotionValue(0);

  // Detect mobile on mount
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth <= 768);
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  // Pause animation when not visible (huge perf win)
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const observer = new IntersectionObserver(
      ([entry]) => setIsVisible(entry.isIntersecting),
      { threshold: 0 },
    );

    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  // Adaptive speed based on device
  const speedX = isMobile ? 0.25 : 0.5;
  const speedY = isMobile ? 0.25 : 0.5;

  // Main animation loop - only runs when visible
  useAnimationFrame((time, delta) => {
    // Skip animation when not visible (saves CPU/GPU)
    if (!isVisible) return;

    // Animate grid movement
    const currentX = gridOffsetX.get();
    const currentY = gridOffsetY.get();
    gridOffsetX.set((currentX + speedX) % 40);
    gridOffsetY.set((currentY + speedY) % 40);

    // Animate color phase for subtle color transitions
    colorPhase.set((time / 5000) % (Math.PI * 2));

    // Update particles (only if enabled and not on mobile)
    if (!isMobile && !disableParticles && particles.length > 0) {
      setParticles((prev) =>
        prev
          .map((p) => ({
            ...p,
            x: p.x + p.velocity.x,
            y: p.y + p.velocity.y,
            life: p.life + delta,
          }))
          .filter((p) => p.life < p.maxLife),
      );
    }

    // Update ripples (only if enabled)
    if (!disableRipples && ripples.length > 0) {
      setRipples((prev) =>
        prev
          .map((r) => ({
            ...r,
            radius: r.radius + delta * 0.3,
            opacity: Math.max(0, 1 - r.radius / r.maxRadius),
          }))
          .filter((r) => r.radius < r.maxRadius),
      );
    }
  });

  // Handle mouse/touch movement
  const handlePointerMove = (
    e: React.MouseEvent<HTMLDivElement> | React.TouchEvent<HTMLDivElement>,
  ) => {
    if (!containerRef.current) return;

    const { left, top } = containerRef.current.getBoundingClientRect();
    let clientX: number, clientY: number;

    if ("touches" in e) {
      if (e.touches.length === 0) return;
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = e.clientX;
      clientY = e.clientY;
    }

    const x = clientX - left;
    const y = clientY - top;

    mouseX.set(x);
    mouseY.set(y);

    // Spawn particles on desktop (only if enabled)
    if (!isMobile && !disableParticles && Math.random() > 0.95) {
      spawnParticle(x, y);
    }
  };

  // Handle click/tap for ripple effect
  const handlePointerDown = (
    e: React.MouseEvent<HTMLDivElement> | React.TouchEvent<HTMLDivElement>,
  ) => {
    if (!containerRef.current) return;

    const { left, top } = containerRef.current.getBoundingClientRect();
    let clientX: number, clientY: number;

    if ("touches" in e) {
      if (e.touches.length === 0) return;
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = e.clientX;
      clientY = e.clientY;
    }

    const x = clientX - left;
    const y = clientY - top;

    if (!disableRipples) {
      createRipple(x, y);
    }
  };

  // Spawn particle at position
  const spawnParticle = (x: number, y: number) => {
    const angle = Math.random() * Math.PI * 2;
    const speed = 0.2 + Math.random() * 0.3;

    setParticles((prev) => [
      ...prev,
      {
        id: particleIdCounter.current++,
        x,
        y,
        velocity: {
          x: Math.cos(angle) * speed,
          y: Math.sin(angle) * speed,
        },
        life: 0,
        maxLife: 1000 + Math.random() * 1000,
      },
    ]);
  };

  // Create ripple effect
  const createRipple = (x: number, y: number) => {
    setRipples((prev) => [
      ...prev,
      {
        id: rippleIdCounter.current++,
        x,
        y,
        radius: 0,
        maxRadius: isMobile ? 150 : 300,
        opacity: 1,
      },
    ]);
  };

  // Dynamic mask with multiple highlights
  const maskImage = useMotionTemplate`radial-gradient(${isMobile ? "200px" : "400px"} circle at ${smoothMouseX}px ${smoothMouseY}px, black, transparent)`;

  // Secondary highlight for depth
  const secondaryMaskImage = useMotionTemplate`radial-gradient(${isMobile ? "300px" : "600px"} circle at ${smoothMouseX}px ${smoothMouseY}px, black, transparent)`;

  return (
    <div
      ref={containerRef}
      onMouseMove={handlePointerMove}
      onTouchMove={handlePointerMove}
      onMouseDown={handlePointerDown}
      onTouchStart={handlePointerDown}
      className={cn(
        "absolute inset-0 w-full h-full overflow-hidden pointer-events-none",
        className,
      )}
    >
      {/* Base grid layer with subtle rotation */}
      <motion.div
        className="absolute inset-0 z-0"
        style={{
          opacity,
        }}
      >
        <GridPattern offsetX={gridOffsetX} offsetY={gridOffsetY} />
      </motion.div>

      {/* Secondary parallax grid layer */}
      {!isMobile && (
        <motion.div
          className="absolute inset-0 z-0"
          style={{
            opacity: opacity * 0.5,
            maskImage: secondaryMaskImage,
            WebkitMaskImage: secondaryMaskImage,
          }}
        >
          <GridPattern
            offsetX={parallelGridOffsetX}
            offsetY={parallelGridOffsetY}
          />
        </motion.div>
      )}

      {/* Primary highlighted grid layer */}
      <motion.div
        className="absolute inset-0 z-0"
        style={{
          maskImage,
          WebkitMaskImage: maskImage,
          opacity: highlightOpacity,
        }}
      >
        <GridPattern offsetX={gridOffsetX} offsetY={gridOffsetY} />
      </motion.div>

      {/* Animated particles (disabled by default for performance) */}
      {!isMobile &&
        !disableParticles &&
        particles.map((particle) => (
          <motion.div
            key={particle.id}
            className="absolute w-1 h-1 rounded-full bg-blue-400"
            style={{
              left: particle.x,
              top: particle.y,
              opacity: Math.max(0, 1 - particle.life / particle.maxLife),
              boxShadow: "0 0 4px rgba(59, 130, 246, 0.8)",
            }}
          />
        ))}

      {/* Ripple effects */}
      {ripples.map((ripple) => (
        <motion.div
          key={ripple.id}
          className="absolute rounded-full border-2 border-blue-400"
          style={{
            left: ripple.x - ripple.radius,
            top: ripple.y - ripple.radius,
            width: ripple.radius * 2,
            height: ripple.radius * 2,
            opacity: ripple.opacity * 0.6,
            boxShadow: `0 0 20px rgba(59, 130, 246, ${ripple.opacity * 0.5})`,
          }}
        />
      ))}

      {/* Gradient overlays with animation */}
      {showGradients && (
        <div className="absolute inset-0 pointer-events-none z-0">
          <motion.div
            className="absolute right-[-20%] top-[-20%] w-[40%] h-[40%] rounded-full bg-blue-500/20 blur-[120px]"
            animate={{
              scale: [1, 1.2, 1],
              opacity: [0.2, 0.3, 0.2],
            }}
            transition={{
              duration: 8,
              repeat: Infinity,
              ease: "easeInOut",
            }}
          />
          <motion.div
            className="absolute right-[10%] top-[-10%] w-[20%] h-[20%] rounded-full bg-blue-400/15 blur-[100px]"
            animate={{
              scale: [1, 1.3, 1],
              opacity: [0.15, 0.25, 0.15],
            }}
            transition={{
              duration: 6,
              repeat: Infinity,
              ease: "easeInOut",
              delay: 1,
            }}
          />
          <motion.div
            className="absolute left-[-10%] bottom-[-20%] w-[40%] h-[40%] rounded-full bg-purple-500/20 blur-[120px]"
            animate={{
              scale: [1, 1.15, 1],
              opacity: [0.2, 0.3, 0.2],
            }}
            transition={{
              duration: 10,
              repeat: Infinity,
              ease: "easeInOut",
              delay: 2,
            }}
          />
        </div>
      )}
    </div>
  );
};

const GridPattern = ({
  offsetX,
  offsetY,
}: {
  offsetX: number | import("framer-motion").MotionValue<number>;
  offsetY: number | import("framer-motion").MotionValue<number>;
}) => {
  return (
    <svg className="w-full h-full">
      <defs>
        <motion.pattern
          id="infinite-grid-pattern"
          width="40"
          height="40"
          patternUnits="userSpaceOnUse"
          x={offsetX}
          y={offsetY}
        >
          <path
            d="M 40 0 L 0 0 0 40"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            className="text-gray-500"
          />
        </motion.pattern>

        <motion.pattern
          id="grid-dots"
          width="40"
          height="40"
          patternUnits="userSpaceOnUse"
          x={offsetX}
          y={offsetY}
        >
          <circle
            cx="0"
            cy="0"
            r="1.5"
            fill="currentColor"
            className="text-blue-400/50"
          />
        </motion.pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#infinite-grid-pattern)" />
      <rect width="100%" height="100%" fill="url(#grid-dots)" />
    </svg>
  );
};
