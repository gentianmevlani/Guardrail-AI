"use client";

import { memo } from "react";

interface DotShaderBackgroundProps {
  dotColor?: string;
  bgColor?: string;
  dotOpacity?: number;
  gridSize?: number;
  className?: string;
  animated?: boolean;
}

/**
 * Lightweight CSS-based dot pattern background
 * Uses GPU-composited CSS for optimal performance
 * No JavaScript animation loop - pure CSS
 */
export const DotShaderBackground = memo(function DotShaderBackground({
  dotColor = "#20b2aa",
  bgColor = "#0d0f12",
  dotOpacity = 0.08,
  gridSize = 40,
  className = "",
  animated = true,
}: DotShaderBackgroundProps) {
  const dotSize = Math.max(1, Math.round(gridSize / 25));
  const spacing = gridSize;

  return (
    <div
      className={`fixed inset-0 -z-10 overflow-hidden ${className}`}
      style={{ backgroundColor: bgColor }}
      aria-hidden="true"
    >
      {/* Base dot pattern layer */}
      <div
        className="absolute inset-0"
        style={{
          backgroundImage: `radial-gradient(circle at center, ${dotColor} ${dotSize}px, transparent ${dotSize}px)`,
          backgroundSize: `${spacing}px ${spacing}px`,
          opacity: dotOpacity,
          willChange: "transform",
        }}
      />

      {/* Radial fade from bottom-right corner */}
      <div
        className="absolute inset-0"
        style={{
          background: `radial-gradient(ellipse 120% 100% at 70% 110%, transparent 30%, ${bgColor} 70%)`,
        }}
      />

      {/* Subtle animated glow layer - GPU composited */}
      {animated && (
        <div
          className="absolute inset-0 dot-bg-pulse"
          style={{
            backgroundImage: `radial-gradient(circle at center, ${dotColor} ${dotSize * 1.5}px, transparent ${dotSize * 2}px)`,
            backgroundSize: `${spacing * 2}px ${spacing * 2}px`,
            opacity: dotOpacity * 0.5,
            willChange: "opacity",
          }}
        />
      )}

      {/* Top fade for readability */}
      <div
        className="absolute inset-x-0 top-0 h-32"
        style={{
          background: `linear-gradient(to bottom, ${bgColor}, transparent)`,
        }}
      />

      <style jsx>{`
        @keyframes dot-pulse {
          0%,
          100% {
            opacity: ${dotOpacity * 0.3};
          }
          50% {
            opacity: ${dotOpacity * 0.8};
          }
        }
        .dot-bg-pulse {
          animation: dot-pulse 8s ease-in-out infinite;
        }
        @media (prefers-reduced-motion: reduce) {
          .dot-bg-pulse {
            animation: none;
            opacity: ${dotOpacity * 0.5};
          }
        }
      `}</style>
    </div>
  );
});

// Export alias for compatibility
// Export for direct use without wrapper
export const DotScreenShader = DotShaderBackground;
