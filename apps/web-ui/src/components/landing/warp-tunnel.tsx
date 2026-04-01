"use client";

import { useEffect, useRef } from "react";
import { motion, useScroll, useTransform, useSpring } from "framer-motion";

export function WarpTunnel() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { scrollYProgress } = useScroll();
  
  // Smooth the scroll progress
  const smoothProgress = useSpring(scrollYProgress, {
    stiffness: 50,
    damping: 20,
    restDelta: 0.001,
  });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animationId: number;
    let stars: Array<{
      x: number;
      y: number;
      z: number;
      prevX: number;
      prevY: number;
    }> = [];

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };

    const initStars = () => {
      stars = [];
      const numStars = 400;
      for (let i = 0; i < numStars; i++) {
        stars.push({
          x: Math.random() * canvas.width - canvas.width / 2,
          y: Math.random() * canvas.height - canvas.height / 2,
          z: Math.random() * 1000,
          prevX: 0,
          prevY: 0,
        });
      }
    };

    let currentSpeed = 0;
    let targetSpeed = 0;

    const animate = () => {
      // Get scroll velocity for warp effect
      const scrollVelocity = smoothProgress.getVelocity();
      targetSpeed = Math.min(Math.abs(scrollVelocity) * 50, 30);
      
      // Smooth speed transition
      currentSpeed += (targetSpeed - currentSpeed) * 0.1;
      
      // Clear with fade effect for trails
      ctx.fillStyle = "rgba(0, 0, 0, 0.15)";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      const centerX = canvas.width / 2;
      const centerY = canvas.height / 2;

      stars.forEach((star) => {
        // Store previous position for trails
        star.prevX = (star.x / star.z) * 500 + centerX;
        star.prevY = (star.y / star.z) * 500 + centerY;

        // Move star towards viewer
        star.z -= currentSpeed + 2;

        // Reset star if it's too close
        if (star.z <= 0) {
          star.x = Math.random() * canvas.width - centerX;
          star.y = Math.random() * canvas.height - centerY;
          star.z = 1000;
          star.prevX = (star.x / star.z) * 500 + centerX;
          star.prevY = (star.y / star.z) * 500 + centerY;
        }

        // Calculate current position
        const x = (star.x / star.z) * 500 + centerX;
        const y = (star.y / star.z) * 500 + centerY;

        // Calculate size and opacity based on distance
        const size = Math.max(0.5, (1 - star.z / 1000) * 3);
        const opacity = Math.min(1, (1 - star.z / 1000) * 1.5);

        // Draw star trail when moving fast
        if (currentSpeed > 5) {
          const gradient = ctx.createLinearGradient(
            star.prevX,
            star.prevY,
            x,
            y
          );
          gradient.addColorStop(0, `rgba(59, 130, 246, 0)`);
          gradient.addColorStop(1, `rgba(59, 130, 246, ${opacity * 0.8})`);

          ctx.beginPath();
          ctx.strokeStyle = gradient;
          ctx.lineWidth = size;
          ctx.moveTo(star.prevX, star.prevY);
          ctx.lineTo(x, y);
          ctx.stroke();
        }

        // Draw star
        ctx.beginPath();
        ctx.fillStyle = `rgba(255, 255, 255, ${opacity})`;
        ctx.arc(x, y, size, 0, Math.PI * 2);
        ctx.fill();

        // Add glow effect for closer stars
        if (star.z < 300) {
          ctx.beginPath();
          const glowGradient = ctx.createRadialGradient(x, y, 0, x, y, size * 4);
          glowGradient.addColorStop(0, `rgba(59, 130, 246, ${opacity * 0.5})`);
          glowGradient.addColorStop(1, "rgba(59, 130, 246, 0)");
          ctx.fillStyle = glowGradient;
          ctx.arc(x, y, size * 4, 0, Math.PI * 2);
          ctx.fill();
        }
      });

      // Draw center vortex glow when moving fast
      if (currentSpeed > 10) {
        const vortexGradient = ctx.createRadialGradient(
          centerX,
          centerY,
          0,
          centerX,
          centerY,
          Math.min(canvas.width, canvas.height) * 0.3
        );
        vortexGradient.addColorStop(0, `rgba(59, 130, 246, ${currentSpeed * 0.01})`);
        vortexGradient.addColorStop(0.5, `rgba(139, 92, 246, ${currentSpeed * 0.005})`);
        vortexGradient.addColorStop(1, "rgba(0, 0, 0, 0)");
        ctx.fillStyle = vortexGradient;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }

      animationId = requestAnimationFrame(animate);
    };

    resize();
    initStars();
    animate();

    window.addEventListener("resize", () => {
      resize();
      initStars();
    });

    return () => {
      cancelAnimationFrame(animationId);
      window.removeEventListener("resize", resize);
    };
  }, [smoothProgress]);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none z-0"
      style={{ opacity: 0.6 }}
    />
  );
}

// Circular portal ring effect component
export function PortalRing({ progress }: { progress: number }) {
  return (
    <div className="fixed inset-0 pointer-events-none z-[1] flex items-center justify-center overflow-hidden">
      {/* Outer ring */}
      <motion.div
        className="absolute rounded-full border-2 border-blue-500/20"
        style={{
          width: `${150 + progress * 100}vw`,
          height: `${150 + progress * 100}vw`,
          boxShadow: `
            0 0 60px rgba(59, 130, 246, ${0.1 + progress * 0.1}),
            inset 0 0 60px rgba(59, 130, 246, ${0.05 + progress * 0.05})
          `,
        }}
        animate={{
          rotate: 360,
        }}
        transition={{
          duration: 60,
          repeat: Infinity,
          ease: "linear",
        }}
      />
      
      {/* Middle ring */}
      <motion.div
        className="absolute rounded-full border border-purple-500/20"
        style={{
          width: `${120 + progress * 80}vw`,
          height: `${120 + progress * 80}vw`,
          boxShadow: `
            0 0 40px rgba(139, 92, 246, ${0.1 + progress * 0.1}),
            inset 0 0 40px rgba(139, 92, 246, ${0.05 + progress * 0.05})
          `,
        }}
        animate={{
          rotate: -360,
        }}
        transition={{
          duration: 45,
          repeat: Infinity,
          ease: "linear",
        }}
      />
      
      {/* Inner ring */}
      <motion.div
        className="absolute rounded-full border border-cyan-500/20"
        style={{
          width: `${90 + progress * 60}vw`,
          height: `${90 + progress * 60}vw`,
          boxShadow: `
            0 0 30px rgba(6, 182, 212, ${0.1 + progress * 0.1}),
            inset 0 0 30px rgba(6, 182, 212, ${0.05 + progress * 0.05})
          `,
        }}
        animate={{
          rotate: 360,
        }}
        transition={{
          duration: 30,
          repeat: Infinity,
          ease: "linear",
        }}
      />
    </div>
  );
}

// Floating particles that react to scroll
export function FloatingParticles() {
  const particles = Array.from({ length: 30 }, (_, i) => ({
    id: i,
    size: Math.random() * 4 + 2,
    x: Math.random() * 100,
    y: Math.random() * 100,
    duration: Math.random() * 10 + 15,
    delay: Math.random() * 5,
  }));

  return (
    <div className="fixed inset-0 pointer-events-none z-[1] overflow-hidden">
      {particles.map((particle) => (
        <motion.div
          key={particle.id}
          className="absolute rounded-full"
          style={{
            width: particle.size,
            height: particle.size,
            left: `${particle.x}%`,
            top: `${particle.y}%`,
            background: `radial-gradient(circle, rgba(59, 130, 246, 0.8) 0%, rgba(139, 92, 246, 0.4) 50%, transparent 100%)`,
            boxShadow: `0 0 ${particle.size * 2}px rgba(59, 130, 246, 0.5)`,
          }}
          animate={{
            y: [0, -30, 0],
            x: [0, Math.random() * 20 - 10, 0],
            opacity: [0.3, 0.8, 0.3],
            scale: [1, 1.2, 1],
          }}
          transition={{
            duration: particle.duration,
            repeat: Infinity,
            delay: particle.delay,
            ease: "easeInOut",
          }}
        />
      ))}
    </div>
  );
}
